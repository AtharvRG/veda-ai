// src/app/api/extract/route.ts
import { NextResponse } from 'next/server';
import { groupBlocksIntoAnswers, type OcrBlock, type BlockGroup } from '@/lib/groupAnswers';

/**
 * Four-stage pipeline:
 *   1. Question Extraction  - OCR question paper -> markdown -> ordered question list (with sub-parts)
 *   2. Answer Extraction     - OCR answer sheet -> markdown + per-page blocks with pixel bboxes
 *   3. Answer Mapping         - LLM matches answer regions to questions by CONTENT (not by OCR-guessed numbers)
 *   4. Grading/Feedback       - same LLM call returns marks + feedback per question
 *
 * Coordinates are NEVER invented by the LLM. Bounding boxes come straight from the OCR layer
 * and are converted to percentages using the real page dimensions returned by Mistral.
 */

type OcrBox = [number, number, number, number];
type JsonRecord = Record<string, unknown>;

type AnswerRegion = {
  id: string;
  label: string; // e.g. "Answer 1" or "1." extracted from the region's first line
  text: string;
  page: number;
  bbox: OcrBox;
  pageWidth: number;
  pageHeight: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidDocumentFile(file: File | null | undefined) {
  if (!file) return false;
  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  return allowedTypes.includes(file.type) || /\.(pdf|png|jpe?g)$/i.test(file.name);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function percent(value: number) {
  return `${Math.max(0, Math.min(100, value)).toFixed(2)}%`;
}

function toPercentageBox(region: AnswerRegion) {
  const [xMin, yMin, xMax, yMax] = region.bbox;
  return {
    page: region.page,
    top: percent((yMin / region.pageHeight) * 100),
    left: percent((xMin / region.pageWidth) * 100),
    width: percent(((xMax - xMin) / region.pageWidth) * 100),
    height: percent(((yMax - yMin) / region.pageHeight) * 100),
  };
}

function parseJson(value: unknown): JsonRecord {
  try {
    const parsed = JSON.parse(String(value ?? '{}'));
    return asRecord(parsed);
  } catch {
    return {};
  }
}

async function fileToBase64(file: File) {
  return Buffer.from(await file.arrayBuffer()).toString('base64');
}

// ---------------------------------------------------------------------------
// Stage 0: raw OCR (no annotation schema - we just want markdown + blocks)
// ---------------------------------------------------------------------------

async function runOcr(file: File, apiKey: string) {
  const dataUrl = `data:${file.type || 'application/pdf'};base64,${await fileToBase64(file)}`;
  const response = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: { type: 'document_url', document_url: dataUrl },
      // NOTE: no document_annotation_format. We use the native pages[].blocks output
      // which carries real bounding boxes for every text span on the page.
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Mistral OCR failed (HTTP ${response.status}): ${detail}`);
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Stage 1: Question Extraction
// ---------------------------------------------------------------------------

function getQuestionMarkdown(ocr: unknown): string {
  const root = asRecord(ocr);
  const pages = Array.isArray(root.pages) ? root.pages : [];
  return pages
    .map((p) => String(asRecord(p).markdown ?? ''))
    .join('\n\n')
    .trim();
}

const questionSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          number: { type: 'string', description: 'Exact printed label, e.g. "1", "11(a)", "11 (b)"' },
          text: { type: 'string' },
          maxMarks: { type: 'number' },
        },
        required: ['number', 'text', 'maxMarks'],
      },
    },
  },
  required: ['questions'],
};

async function extractQuestions(markdown: string, apiKey: string) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'question_list', schema: questionSchema, strict: true },
      },
      messages: [
        {
          role: 'system',
          content:
            'You extract a question paper into an ordered list. Preserve the EXACT printed numbering, including sub-parts such as "11(a)" and "11(b)" as SEPARATE entries. Keep the original order. If maxMarks is not visible, use 0. Return only the questions array.',
        },
        { role: 'user', content: markdown },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Question extraction failed: ${await response.text()}`);
  const data = await response.json();
  const parsed = parseJson(data?.choices?.[0]?.message?.content);
  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];

  return rawQuestions.map((raw, index) => {
    const item = asRecord(raw);
    return {
      id: `q-${index + 1}`,
      number: String(item.number ?? index + 1).trim(),
      text: String(item.text ?? '').trim(),
      maxMarks: Number(item.maxMarks ?? 0),
    };
  }).filter((q) => q.text);
}

// ---------------------------------------------------------------------------
// Stage 2: Answer Extraction (Mistral OCR blocks + LLM content grouping)
// ---------------------------------------------------------------------------
//
// Mistral OCR returns pages[].blocks, each with clean readable text AND a
// real bounding box (top_left_x/y, bottom_right_x/y) plus page dimensions.
// One answer can span multiple blocks (e.g. answer 9 continues across pages).
// An LLM reads the block texts in order + the question list and returns which
// blocks form each answer. We union the block bboxes into one box per answer.

/**
 * Extract flat, ordered OCR blocks from Mistral's pages[].blocks output.
 * Each block gets a stable id (b-1, b-2, ...) in reading order across pages.
 *
 * List blocks (type "list") contain multiple numbered answers in one block
 * with a single bbox. We split them into per-line sub-blocks, giving each
 * line a proportional vertical slice of the parent block's bbox. This is an
 * approximation but works well for handwriting with roughly even line spacing.
 */
function extractOcrBlocks(ocr: unknown): (OcrBlock & { id: string })[] {
  const root = asRecord(ocr);
  const pages = Array.isArray(root.pages) ? root.pages : [];
  const out: (OcrBlock & { id: string })[] = [];
  let idx = 0;
  const push = (page: number, text: string, bbox: OcrBox, pageWidth: number, pageHeight: number) => {
    if (!text.trim() || !pageWidth || !pageHeight) return;
    idx++;
    out.push({ id: `b-${idx}`, page, text: text.trim(), bbox, pageWidth, pageHeight });
  };
  for (const page of pages) {
    const p = asRecord(page);
    const dims = asRecord(p.dimensions);
    const pageWidth = Number(dims.width ?? 0);
    const pageHeight = Number(dims.height ?? 0);
    // Mistral's `index` is 0-based; fall back to 1-based position.
    const pageNum = Number(p.index ?? 0) + 1;
    const blocks = Array.isArray(p.blocks) ? p.blocks : [];
    for (const blk of blocks) {
      const b = asRecord(blk);
      const bbox: OcrBox = [
        Number(b.top_left_x ?? 0),
        Number(b.top_left_y ?? 0),
        Number(b.bottom_right_x ?? 0),
        Number(b.bottom_right_y ?? 0),
      ];
      const text = String(b.content ?? '');
      const type = String(b.type ?? 'text');
      if (!text.trim()) continue;

      if (type === 'list') {
        // Split the list block into per-line sub-blocks. Each line gets a
        // vertical slice of the parent bbox weighted by its text length, so
        // longer answers get proportionally more height than short ones.
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        const [x0, y0, x1, y1] = bbox;
        const totalHeight = y1 - y0;
        const weights = lines.map((l) => Math.max(1, l.length));
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let acc = 0;
        for (let i = 0; i < lines.length; i++) {
          const lineY0 = y0 + Math.round((totalHeight * acc) / totalWeight);
          acc += weights[i];
          const lineY1 = y0 + Math.round((totalHeight * acc) / totalWeight);
          push(pageNum, lines[i], [x0, lineY0, x1, lineY1], pageWidth, pageHeight);
        }
      } else {
        push(pageNum, text, bbox, pageWidth, pageHeight);
      }
    }
  }
  return out;
}

/**
 * Build answer regions from OCR blocks + LLM grouping.
 *
 * `blocks` are the Mistral OCR blocks (with clean text + real bboxes).
 * `groups` are the LLM's per-answer block-id lists.
 * We union the block bboxes for each group into one AnswerRegion. The region
 * text is the joined block texts - clean and readable for the grading LLM.
 */
function buildRegionsFromBlockGroups(
  blocks: (OcrBlock & { id: string })[],
  groups: BlockGroup[],
): AnswerRegion[] {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const regions: AnswerRegion[] = [];
  for (const group of groups) {
    const picked = group.blockIds.map((id) => byId.get(id)).filter((b): b is OcrBlock & { id: string } => !!b);
    if (!picked.length) continue;
    // Group blocks by page. An answer spanning multiple pages gets one region
    // per page (the grading LLM already supports multiple region ids per
    // question). This keeps each page's box tight to that page's blocks.
    const byPage = new Map<number, (OcrBlock & { id: string })[]>();
    for (const b of picked) {
      const arr = byPage.get(b.page) ?? [];
      arr.push(b);
      byPage.set(b.page, arr);
    }
    for (const [page, pageBlocks] of byPage) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const b of pageBlocks) {
        x0 = Math.min(x0, b.bbox[0]);
        y0 = Math.min(y0, b.bbox[1]);
        x1 = Math.max(x1, b.bbox[2]);
        y1 = Math.max(y1, b.bbox[3]);
      }
      const text = pageBlocks.map((b) => b.text).join('\n').trim();
      regions.push({
        id: `r-${regions.length + 1}`,
        label: group.questionNumber,
        text,
        page,
        bbox: [x0, y0, x1, y1],
        pageWidth: pageBlocks[0].pageWidth,
        pageHeight: pageBlocks[0].pageHeight,
      });
    }
  }
  return regions;
}

// ---------------------------------------------------------------------------
// Stage 3 + 4: Answer Mapping & Grading (single LLM call)
// ---------------------------------------------------------------------------

const gradingSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          marksAwarded: { type: 'number' },
          feedback: { type: 'string' },
          answer_region_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs of answer regions that answer this question. Empty if unanswered.',
          },
        },
        required: ['id', 'marksAwarded', 'feedback', 'answer_region_ids'],
      },
    },
  },
  required: ['questions'],
};

async function mapAndGrade(
  questions: { id: string; number: string; text: string; maxMarks: number }[],
  regions: AnswerRegion[],
  apiKey: string,
) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'grading_result', schema: gradingSchema, strict: true },
      },
      messages: [
        {
          role: 'system',
          content:
            'You map student answer regions to exam questions and grade them. ' +
            'Each answer region has a "label" field extracted from the sheet (e.g. "Ans 1", "Answer 7", "10."). ' +
            'PRIMARY RULE: match a region to the question whose NUMBER equals the number in the region label. "Ans 1" matches question 1, "Ans 7" matches question 7, "10." matches question 10. ' +
            'If a region has no label, fall back to matching by content similarity between the question text and the region text. ' +
            'CRITICAL constraints: each region maps to AT MOST ONE question. Do NOT assign the same region to multiple questions. Do NOT return all regions on a page for one question. ' +
            'Answers may span multiple consecutive regions (e.g. an answer continuing onto the next page) - in that case return all the continuation region IDs. ' +
            'IMPORTANT GRADING RULE: If an answer maps to multiple regions, evaluate their COMBINED text as a single cohesive answer. DO NOT penalize the student or deduct marks simply because the answer is split across regions or pages. Do NOT mention "split across regions" in the feedback. ' +
            'Only return region IDs from the supplied list - never invent IDs or coordinates. ' +
            'For unanswered questions return an empty answer_region_ids array and 0 marks. ' +
            'Grade fairly out of maxMarks and give concise feedback.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            questions: questions.map(({ id, number, text, maxMarks }) => ({ id, number, text, maxMarks })),
            answer_regions: regions.map(({ id, label, text, page }) => ({ id, label, text, page })),
          }),
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Mapping/grading failed: ${await response.text()}`);
  const data = await response.json();
  return parseJson(data?.choices?.[0]?.message?.content);
}

// ---------------------------------------------------------------------------
// Assemble final response
// ---------------------------------------------------------------------------

function buildQuestions(
  questions: { id: string; number: string; text: string; maxMarks: number }[],
  regions: AnswerRegion[],
  grading: JsonRecord,
) {
  const regionMap = new Map(regions.map((r) => [r.id, r]));
  const graded = Array.isArray(grading.questions) ? grading.questions : [];
  const gradeMap = new Map(graded.map((g) => [String(asRecord(g).id), asRecord(g)]));

  // Raw region IDs per question from the LLM.
  const rawIdsByQuestion = new Map<string, string[]>();
  for (const q of questions) {
    const g = gradeMap.get(q.id) ?? {};
    const ids = Array.isArray(g.answer_region_ids) ? g.answer_region_ids.map(String) : [];
    rawIdsByQuestion.set(q.id, ids);
  }

  // Enforce one-to-one: if a region is assigned to multiple questions, keep it only
  // on the question whose number matches the number in the region's label.
  const regionOwner = new Map<string, string>(); // regionId -> questionId
  const labelNumber = (label: string) => {
    const m = label.match(/(\d+(?:\s*[()a-z]+)?)/i);
    return m ? m[1].replace(/\s+/g, '').toLowerCase() : '';
  };

  // First pass: assign regions that appear for exactly one question.
  const regionQuestionCount = new Map<string, number>();
  for (const ids of rawIdsByQuestion.values()) {
    for (const id of ids) regionQuestionCount.set(id, (regionQuestionCount.get(id) ?? 0) + 1);
  }
  for (const q of questions) {
    for (const id of rawIdsByQuestion.get(q.id) ?? []) {
      if (regionQuestionCount.get(id) === 1) regionOwner.set(id, q.id);
    }
  }
  // Second pass: for contested regions, give to the question whose number matches the label.
  for (const q of questions) {
    for (const id of rawIdsByQuestion.get(q.id) ?? []) {
      if (regionOwner.has(id)) continue;
      const region = regionMap.get(id);
      if (region && labelNumber(region.label) === labelNumber(q.number)) {
        regionOwner.set(id, q.id);
      }
    }
  }
  // Any still-unowned contested region: assign to the first question that claims it.
  for (const q of questions) {
    for (const id of rawIdsByQuestion.get(q.id) ?? []) {
      if (!regionOwner.has(id)) regionOwner.set(id, q.id);
    }
  }

  return questions.map((q) => {
    const g = gradeMap.get(q.id) ?? {};
    const rawIds = rawIdsByQuestion.get(q.id) ?? [];
    // Keep only regions this question owns (one-to-one enforcement).
    const ids = rawIds.filter((id) => regionOwner.get(id) === q.id);
    const boxes = ids
      .map((id) => regionMap.get(id))
      .filter((r): r is AnswerRegion => Boolean(r))
      .map(toPercentageBox);

    return {
      id: q.id,
      number: q.number,
      text: q.text,
      maxMarks: q.maxMarks,
      marksAwarded: Number(g.marksAwarded ?? 0),
      feedback: String(g.feedback ?? 'No feedback provided.'),
      answered: boxes.length > 0,
      bboxes: boxes.length ? boxes : undefined,
      bbox: boxes[0],
    };
  });
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const questionFile = formData.get('questionFile') as File | null;
    const answerFile = formData.get('answerFile') as File | null;
    const apiKey = process.env.MISTRAL_API_KEY;

    if (!questionFile || !answerFile) {
      return NextResponse.json({ error: 'Both a question paper and an answer sheet are required.' }, { status: 400 });
    }
    if (!isValidDocumentFile(questionFile) || !isValidDocumentFile(answerFile)) {
      return NextResponse.json({ error: 'Only PDF, PNG, and JPG files are supported.' }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'MISTRAL_API_KEY is not configured.' }, { status: 500 });
    }

    // Stage 1 + 2 in parallel: OCR both documents with Mistral. The question
    // paper gives us the question list (from markdown). The answer sheet gives
    // us clean readable text AND a bounding box per block - we group blocks
    // into answers and union their boxes.
    const [questionOcr, answerOcr] = await Promise.all([
      runOcr(questionFile, apiKey),
      runOcr(answerFile, apiKey),
    ]);

    // Stage 1: extract ordered questions from the question paper markdown.
    const questionMarkdown = getQuestionMarkdown(questionOcr);
    if (!questionMarkdown) throw new Error('Question paper OCR returned no text.');
    const questions = await extractQuestions(questionMarkdown, apiKey);
    if (!questions.length) throw new Error('Could not extract any questions from the question paper.');

    // Stage 2: group Mistral OCR blocks into per-answer regions via an LLM call.
    // The LLM reads clean block texts + the question list and returns block ids.
    const answerBlocks = extractOcrBlocks(answerOcr);
    console.log('[DEBUG] ocr block count:', answerBlocks.length);
    console.log('[DEBUG] blocks:', JSON.stringify(answerBlocks.map((b) => ({ id: b.id, page: b.page, text: b.text.slice(0, 80) }))));
    const blockGroups = await groupBlocksIntoAnswers(answerBlocks, questions, apiKey);
    console.log('[DEBUG] block groups:', JSON.stringify(blockGroups));
    const answerRegions = buildRegionsFromBlockGroups(answerBlocks, blockGroups);
    console.log('[DEBUG] answer regions:', JSON.stringify(answerRegions.map((r) => ({ id: r.id, label: r.label, page: r.page, bbox: r.bbox, text: r.text.slice(0, 60) }))));

    // Stage 3 + 4: map regions to questions by content and grade.
    const grading = answerRegions.length
      ? await mapAndGrade(questions, answerRegions, apiKey)
      : {};
    console.log('[DEBUG] grading mapping:', (Array.isArray(grading.questions) ? grading.questions : []).map((q) => {
      const r = asRecord(q);
      return { id: r.id, regionIds: r.answer_region_ids, marks: r.marksAwarded };
    }));

    const finalQuestions = buildQuestions(questions, answerRegions, grading);

    return NextResponse.json({
      success: true,
      source: 'mistral-ocr-latest',
      questions: finalQuestions,
      stats: {
        questionCount: finalQuestions.length,
        answeredCount: finalQuestions.filter((q) => q.answered).length,
        regionCount: answerRegions.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Document extraction failed.';
    console.error('[API ERROR]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
