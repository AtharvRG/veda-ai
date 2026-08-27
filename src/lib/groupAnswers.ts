// src/lib/groupAnswers.ts
//
// Groups Mistral OCR blocks into per-answer regions using an LLM.
//
// Why: Mistral OCR gives us clean readable text AND a bounding box per block.
// But one answer can span multiple blocks (e.g. answer 9 continues across
// blocks 11-13 on page 2 and block 1 on page 3). An LLM reading the block
// texts in order + the question list can robustly say "blocks 11-13 + page 3
// block 1 are answer 9" based on CONTENT.
//
// The LLM only decides block ranges. It never touches coordinates - we union
// the block bboxes ourselves, so boxes are always grounded in real OCR output.

export type OcrBlock = {
  page: number;
  text: string;
  bbox: [number, number, number, number]; // x0, y0, x1, y1 in OCR pixel space
  pageWidth: number;
  pageHeight: number;
};

export type BlockGroup = {
  questionNumber: string; // matches the question's `number` from the question list
  blockIds: string[]; // ids of blocks that form this answer (e.g. ["b-3","b-4","b-11"])
};

const groupingSchema = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          questionNumber: { type: 'string', description: 'The question number this answer addresses, e.g. "1", "11(a)"' },
          blockIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs of the OCR blocks that form this answer, in reading order',
          },
        },
        required: ['questionNumber', 'blockIds'],
      },
    },
  },
  required: ['groups'],
};

/**
 * Ask Mistral Large to group OCR blocks into per-answer regions.
 *
 * Inputs:
 *  - blocks: the Mistral OCR blocks with clean text, in reading order (each
 *    has an id like "b-1", "b-2", ...)
 *  - questions: the extracted question list (number + text) so the LLM can
 *    match answers to questions by content
 *
 * Output: one BlockGroup per answered question, referencing block ids.
 * Blocks not part of any answer (headers, names, doodles) are left out.
 */
export async function groupBlocksIntoAnswers(
  blocks: (OcrBlock & { id: string })[],
  questions: { number: string; text: string }[],
  apiKey: string,
): Promise<BlockGroup[]> {
  if (!blocks.length || !questions.length) return [];

  // Build the block list for the prompt. Keep it compact: id + page + text.
  const blockList = blocks.map((b) => `${b.id} [page ${b.page}]: ${b.text}`).join('\n');
  const questionList = questions.map((q, i) => `${i + 1}. ${q.number} ${q.text}`.slice(0, 200)).join('\n');

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'block_groups', schema: groupingSchema, strict: true },
      },
      messages: [
        {
          role: 'system',
          content:
            'You group OCR blocks from a student answer sheet into per-answer regions. ' +
            'You are given blocks (each with an id, page number, and clean readable text) in reading order, plus the exam question list. ' +
            'Each answer is one or more consecutive blocks. Decide which blocks form each answer by CONTENT and numbering. ' +
            'Rules: ' +
            '1. Use the question NUMBER (e.g. "1", "11(a)") as questionNumber. ' +
            '2. A block starting with "N." or "N)" usually begins the answer for question N - but sub-list items (1., 2. inside an answer) are part of the current answer, not new answers. ' +
            '3. If an answer continues across pages, include all its blocks in one group. ' +
            '4. Skip blocks that are not part of any answer (name, roll number, headers) - simply do not include them in any group. ' +
            '5. Match each answer to the question it addresses by reading the answer content against the question list. ' +
            '6. Only return groups for questions that were actually answered. ' +
            '7. Only use block ids from the supplied list - never invent ids. ' +
            'Return only the groups array.',
        },
        {
          role: 'user',
          content: `QUESTIONS:\n${questionList}\n\nANSWER SHEET BLOCKS (in reading order):\n${blockList}`,
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Block grouping failed: ${await response.text()}`);
  const data = await response.json();
  const parsed = data?.choices?.[0]?.message?.content;
  let obj: { groups?: unknown };
  try {
    obj = JSON.parse(String(parsed ?? '{}'));
  } catch {
    obj = {};
  }
  const groups = Array.isArray(obj.groups) ? obj.groups : [];

  // Validate: keep only groups with valid questionNumber + non-empty blockIds
  // that reference real block ids.
  const validIds = new Set(blocks.map((b) => b.id));
  return groups
    .map((g) => {
      const r = g as Record<string, unknown>;
      const questionNumber = String(r.questionNumber ?? '').trim();
      const blockIds = Array.isArray(r.blockIds) ? r.blockIds.map(String).filter((id) => validIds.has(id)) : [];
      if (!questionNumber || !blockIds.length) return null;
      return { questionNumber, blockIds } satisfies BlockGroup;
    })
    .filter((g): g is BlockGroup => g !== null);
}
