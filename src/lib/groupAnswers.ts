// src/lib/groupAnswers.ts
//
// Groups Tesseract line-level boxes into per-answer regions using an LLM.
//
// Why an LLM: text heuristics (regex for "Ans N" / "N.") fail on real answer
// sheets - students use bare numbering, sub-lists, merged answers, missing
// numbers, etc. An LLM reading the line texts in order + the question list can
// robustly say "lines 5-9 are answer 3" based on CONTENT, not numbering.
//
// The LLM only decides line ranges. It never touches coordinates - we union
// the line bboxes ourselves, so boxes are always grounded in real OCR output.

import type { LineBox } from './lineBoxes';

export type LineGroup = {
  questionNumber: string; // matches the question's `number` from the question list
  startLine: number; // 1-indexed, inclusive
  endLine: number; // 1-indexed, inclusive
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
          startLine: { type: 'number' },
          endLine: { type: 'number' },
        },
        required: ['questionNumber', 'startLine', 'endLine'],
      },
    },
  },
  required: ['groups'],
};

/**
 * Ask Mistral Large to group answer-sheet lines into per-answer ranges.
 *
 * Inputs:
 *  - lines: the Tesseract line texts in reading order (1-indexed in the prompt)
 *  - questions: the extracted question list (number + text) so the LLM can
 *    match answers to questions by content
 *
 * Output: one LineGroup per answered question, referencing line indices.
 * Lines not part of any answer (headers, names, doodles) are simply left out.
 */
export async function groupLinesIntoAnswers(
  lines: LineBox[],
  questions: { number: string; text: string }[],
  apiKey: string,
): Promise<LineGroup[]> {
  if (!lines.length || !questions.length) return [];

  // Build the line list for the prompt. Keep it compact: index + text.
  const lineList = lines
    .map((l, i) => `${i + 1}. ${l.text}`)
    .join('\n');
  const questionList = questions
    .map((q, i) => `${i + 1}. ${q.number} ${q.text}`.slice(0, 200))
    .join('\n');

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'line_groups', schema: groupingSchema, strict: true },
      },
      messages: [
        {
          role: 'system',
          content:
            'You group OCR lines from a student answer sheet into per-answer ranges. ' +
            'You are given lines in reading order (1-indexed) and the exam question list. ' +
            'Each answer is a RUN of CONSECUTIVE lines. Decide where each answer starts and ends by CONTENT and numbering, not by OCR-guessed labels alone. ' +
            'Rules: ' +
            '1. Each group covers consecutive lines (startLine <= endLine). ' +
            '2. Use the question NUMBER (e.g. "1", "11(a)") as questionNumber. ' +
            '3. A bare "1." / "2." at the start of a line usually begins a new answer for that question - but sub-list items (1., 2. inside an answer) do NOT start a new answer; they belong to the current answer. ' +
            '4. If an answer continues across pages, include all its lines in one group. ' +
            '5. Skip lines that are not part of any answer (name, roll number, headers, doodles) - simply do not include them in any group. ' +
            '6. Match each answer to the question it addresses by reading the answer content against the question list. ' +
            '7. Only return groups for questions that were actually answered. ' +
            'Return only the groups array.',
        },
        {
          role: 'user',
          content: `QUESTIONS:\n${questionList}\n\nANSWER SHEET LINES (in reading order):\n${lineList}`,
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Line grouping failed: ${await response.text()}`);
  const data = await response.json();
  const parsed = data?.choices?.[0]?.message?.content;
  let obj: { groups?: unknown };
  try {
    obj = JSON.parse(String(parsed ?? '{}'));
  } catch {
    obj = {};
  }
  const groups = Array.isArray(obj.groups) ? obj.groups : [];

  // Validate and clamp line indices to the actual range.
  const n = lines.length;
  return groups
    .map((g) => {
      const r = g as Record<string, unknown>;
      const questionNumber = String(r.questionNumber ?? '').trim();
      const startLine = Number(r.startLine);
      const endLine = Number(r.endLine);
      if (!questionNumber || !Number.isFinite(startLine) || !Number.isFinite(endLine)) return null;
      const s = Math.max(1, Math.min(n, Math.round(startLine)));
      const e = Math.max(s, Math.min(n, Math.round(endLine)));
      return { questionNumber, startLine: s, endLine: e } satisfies LineGroup;
    })
    .filter((g): g is LineGroup => g !== null);
}
