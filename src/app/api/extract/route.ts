// src/app/api/extract/route.ts
import { NextResponse } from 'next/server';

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
  text: string;
  page: number;
  bbox: OcrBox;
  pageWidth: number;
  pageHeight: number;
};

type PageDimensions = { width: number; height: number };

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

function asBox(value: unknown): OcrBox | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const numbers = value.map(Number);
  if (numbers.some((n) => !Number.isFinite(n))) return null;
  const [xMin, yMin, xMax, yMax] = numbers;
  return xMax > xMin && yMax > yMin ? [xMin, yMin, xMax, yMax] : null;
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
// Page dimension extraction (with fallbacks)
// ---------------------------------------------------------------------------

function getPageDimensions(page: unknown): PageDimensions {
  const record = asRecord(page);
  const dims = asRecord(record.dimensions);
  const width = Number(dims.width ?? record.width ?? 0);
  const height = Number(dims.height ?? record.height ?? 0);
  return { width, height };
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
// Stage 2: Answer Extraction (group OCR blocks into answer regions)
// ---------------------------------------------------------------------------

type OcrBlock = { text: string; bbox: OcrBox; type: string };

function getPageBlocks(page: unknown): OcrBlock[] {
  const record = asRecord(page);
  const blocks = Array.isArray(record.blocks) ? record.blocks : [];
  const out: OcrBlock[] = [];
  for (const raw of blocks) {
    const b = asRecord(raw);
    const text = String(b.content ?? b.text ?? '').trim();
    // Mistral returns bbox as 4 separate fields: top_left_x/y, bottom_right_x/y
    const xMin = Number(b.top_left_x);
    const yMin = Number(b.top_left_y);
    const xMax = Number(b.bottom_right_x);
    const yMax = Number(b.bottom_right_y);
    const bbox: OcrBox | null =
      Number.isFinite(xMin) && Number.isFinite(yMin) && Number.isFinite(xMax) && Number.isFinite(yMax) && xMax > xMin && yMax > yMin
        ? [xMin, yMin, xMax, yMax]
        : asBox(b.bbox); // fallback for any block that uses the array form
    if (text && bbox) out.push({ text, bbox, type: String(b.type ?? 'text') });
  }
  return out;
}

/**
 * Group OCR blocks on a page into answer regions.
 *
 * Strategy:
 *  - A block of type "title" (e.g. "## Answer 1") starts a NEW region.
 *  - Otherwise, a vertical gap larger than `gapThreshold` pixels also starts a new region.
 * This handles handwritten sheets where answers are labelled, and falls back to
 * gap-based grouping when no titles are present.
 */
function groupBlocksIntoRegions(blocks: OcrBlock[], page: number, dims: PageDimensions, gapThreshold: number): AnswerRegion[] {
  if (!blocks.length || !dims.width || !dims.height) return [];

  // Sort top-to-bottom, then left-to-right.
  const sorted = [...blocks].sort((a, b) => {
    const [, ayMin] = a.bbox;
    const [, byMin] = b.bbox;
    return ayMin - byMin || a.bbox[0] - b.bbox[0];
  });

  const regions: AnswerRegion[] = [];
  let currentBox: OcrBox | null = null;
  let currentText: string[] = [];
  let lastBottom = 0;

  const flush = () => {
    if (!currentBox || !currentText.length) return;
    regions.push({
      id: `r-${page}-${regions.length + 1}`,
      text: currentText.join(' ').replace(/\s+/g, ' ').trim(),
      page,
      bbox: currentBox,
      pageWidth: dims.width,
      pageHeight: dims.height,
    });
    currentBox = null;
    currentText = [];
  };

  for (const block of sorted) {
    const [, yMin, , yMax] = block.bbox;
    // A title block (e.g. "## Answer 1") always starts a new region.
    const isTitle = block.type === 'title' || /^#{1,6}\s/i.test(block.text);
    if (currentBox && (isTitle || yMin - lastBottom > gapThreshold)) flush();

    const [bxMin, byMin, bxMax, byMax] = block.bbox;
    currentBox = currentBox
      ? [Math.min(currentBox[0], bxMin), Math.min(currentBox[1], byMin), Math.max(currentBox[2], bxMax), Math.max(currentBox[3], byMax)]
      : [bxMin, byMin, bxMax, byMax];
    // Strip leading markdown headers from the region text for cleaner LLM matching.
    currentText.push(block.text.replace(/^#{1,6}\s+/, ''));
    lastBottom = yMax;
  }
  flush();
  return regions;
}

function extractAnswerRegions(ocr: unknown): AnswerRegion[] {
  const root = asRecord(ocr);
  const pages = Array.isArray(root.pages) ? root.pages : [];
  const regions: AnswerRegion[] = [];

  pages.forEach((rawPage, i) => {
    const page = i + 1;
    const dims = getPageDimensions(rawPage);
    const blocks = getPageBlocks(rawPage);
    // Gap threshold ~ 1.5x the median line height on the page, fallback to 30px.
    const heights = blocks.map((b) => b.bbox[3] - b.bbox[1]).sort((a, b) => a - b);
    const median = heights.length ? heights[Math.floor(heights.length / 2)] : 20;
    const gap = Math.max(median * 1.5, 30);
    regions.push(...groupBlocksIntoRegions(blocks, page, dims, gap));
  });

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
            'Match by CONTENT - compare the question text to the OCR text of each answer region. ' +
            'Answers may be out of order or span multiple regions. ' +
            'Only return region IDs from the supplied list - never invent IDs or coordinates. ' +
            'For unanswered questions return an empty answer_region_ids array and 0 marks. ' +
            'Grade fairly out of maxMarks and give concise feedback.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            questions: questions.map(({ id, number, text, maxMarks }) => ({ id, number, text, maxMarks })),
            answer_regions: regions.map(({ id, text, page }) => ({ id, text, page })),
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

  return questions.map((q) => {
    const g = gradeMap.get(q.id) ?? {};
    const ids = Array.isArray(g.answer_region_ids) ? g.answer_region_ids.map(String) : [];
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

    // Stage 1 + 2 in parallel: OCR both documents.
    const [questionOcr, answerOcr] = await Promise.all([
      runOcr(questionFile, apiKey),
      runOcr(answerFile, apiKey),
    ]);

    // Stage 1: extract ordered questions from the question paper markdown.
    const questionMarkdown = getQuestionMarkdown(questionOcr);
    if (!questionMarkdown) throw new Error('Question paper OCR returned no text.');
    const questions = await extractQuestions(questionMarkdown, apiKey);
    if (!questions.length) throw new Error('Could not extract any questions from the question paper.');

    // Stage 2: group answer-sheet OCR blocks into regions with real bboxes.
    const answerRegions = extractAnswerRegions(answerOcr);

    // Stage 3 + 4: map regions to questions by content and grade.
    const grading = answerRegions.length
      ? await mapAndGrade(questions, answerRegions, apiKey)
      : {};

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
