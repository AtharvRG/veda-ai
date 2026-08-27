// src/app/api/extract/route.ts
import { NextResponse } from 'next/server';
import { getLineBoxes } from '@/lib/lineBoxes';
import { groupLinesIntoAnswers } from '@/lib/groupAnswers';

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
// Stage 2: Answer Extraction (line-level boxes + LLM content grouping)
// ---------------------------------------------------------------------------
//
// Old approach (removed): tried to split Mistral's paragraph-level blocks
// with regex heuristics. Failed because students use bare numbering, sub-lists,
// merged answers, etc. - no regex can robustly find answer boundaries.
//
// New approach: Tesseract gives us a box per LINE (the atomic unit that's
// always correct). An LLM reads the line texts in order + the question list
// and returns per-answer line ranges by CONTENT. We union the line boxes into
// one box per answer. Mistral OCR still runs in parallel for high-quality
// answer text, but the boxes come from Tesseract lines.

/**
 * Build answer regions from Tesseract line boxes + LLM grouping.
 *
 * `lines` are the line-level boxes from Tesseract (in reading order).
 * `groups` are the LLM's per-answer line ranges (1-indexed, inclusive).
 * We union the line boxes for each group into one AnswerRegion. The region
 * text is the joined Tesseract line texts - messy but sufficient for the
 * grading LLM, which is robust to OCR noise.
 */
function buildRegionsFromLineGroups(
  lines: { page: number; text: string; bbox: OcrBox; pageWidth: number; pageHeight: number }[],
  groups: { questionNumber: string; startLine: number; endLine: number }[],
): AnswerRegion[] {
  const regions: AnswerRegion[] = [];
  for (const group of groups) {
    const slice = lines.slice(group.startLine - 1, group.endLine); // 1-indexed inclusive
    if (!slice.length) continue;
    // Union boxes. Lines may span pages; if so, keep them on the first page
    // but the bbox is still valid for that page. (Multi-page answers are rare
    // and the viewer highlights per page anyway.)
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const l of slice) {
      x0 = Math.min(x0, l.bbox[0]);
      y0 = Math.min(y0, l.bbox[1]);
      x1 = Math.max(x1, l.bbox[2]);
      y1 = Math.max(y1, l.bbox[3]);
    }
    const first = slice[0];
    const text = slice.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim();
    regions.push({
      id: `r-${regions.length + 1}`,
      label: group.questionNumber,
      text,
      page: first.page,
      bbox: [x0, y0, x1, y1],
      pageWidth: first.pageWidth,
      pageHeight: first.pageHeight,
    });
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

    // Stage 1 + 2 in parallel: OCR the question paper (Mistral, for clean text)
    // and extract line-level boxes from the answer sheet (Tesseract). The
    // answer sheet's text also comes from Tesseract lines - messy but good
    // enough for the grading LLM, and it keeps boxes + text perfectly aligned.
    const [questionOcr, answerLines] = await Promise.all([
      runOcr(questionFile, apiKey),
      getLineBoxes(answerFile),
    ]);

    // Stage 1: extract ordered questions from the question paper markdown.
    const questionMarkdown = getQuestionMarkdown(questionOcr);
    if (!questionMarkdown) throw new Error('Question paper OCR returned no text.');
    const questions = await extractQuestions(questionMarkdown, apiKey);
    if (!questions.length) throw new Error('Could not extract any questions from the question paper.');

    // Stage 2: group Tesseract lines into per-answer regions via an LLM call.
    // The LLM reads line texts + the question list and returns line ranges.
    console.log('[DEBUG] tesseract line count:', answerLines.length);
    console.log('[DEBUG] first 10 lines:', answerLines.slice(0, 10).map((l, i) => `${i + 1}. ${l.text}`));
    const lineGroups = await groupLinesIntoAnswers(answerLines, questions, apiKey);
    console.log('[DEBUG] line groups:', lineGroups);
    const answerRegions = buildRegionsFromLineGroups(answerLines, lineGroups);
    console.log('[DEBUG] answer regions:', answerRegions.map((r) => ({ id: r.id, label: r.label, page: r.page, text: r.text.slice(0, 60) })));

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
