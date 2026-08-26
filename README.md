# VedaAI - Assessment Extraction & Answer Mapping

This project is a teacher-facing assessment tool for reviewing a question paper alongside a student answer sheet. The interface lets the user upload both documents, inspect the extracted questions, and navigate to the mapped answer region on the answer sheet.

## Approach

The application uses a layered flow instead of trying to ask a single model to do everything at once. The intended pipeline is:

1. OCR the question paper and answer sheet.
2. Extract the printed question list in order, while preserving numbering and sub-parts such as 11 (a) and 11 (b).
3. Match answer text blocks to the relevant question by content and position rather than by guesswork.
4. Highlight the corresponding answer region using the OCR-derived coordinates.
5. Grade the result and show teacher feedback separately from the highlight logic.

This matters because the real problem is not just reading text. It is grounding the answer to the correct page, the correct question, and the correct region of the document. A model that is asked to invent coordinate percentages will often produce plausible but incorrect boxes, which breaks the assignment requirement for exact highlighting.

## Why the earlier version failed

The initial implementation tried to send raw OCR output directly to the LLM and ask it to estimate CSS positions such as left, top, width, and height. That is fragile because an LLM is not a geometry engine. It can produce convincing-looking coordinates, but those values are not guaranteed to reflect the true answer region. On real documents, especially when there are multiple pages, out-of-order answers, and sub-parts, the result drifts and the highlight becomes unreliable.

## What this code does now

The extraction route runs a four-stage pipeline, each stage using the right tool for the job.

### Stage 1 - Question Extraction
The question paper is sent to `mistral-ocr-latest` through `/v1/ocr` without any annotation schema. The route collects the per-page markdown, then sends it to `mistral-large-latest` with a strict JSON schema that returns an ordered `questions` array. The system prompt forces the model to preserve the exact printed numbering and to split labelled sub-parts such as `11(a)` and `11(b)` into separate entries. This is reliable because the question paper is printed text and the LLM is only structuring text it has already read.

### Stage 2 - Answer Extraction
The answer sheet is OCR'd the same way. Mistral returns `pages[].blocks`, where each block carries the recognised text and a real pixel bounding box. The route groups consecutive blocks on a page into answer regions using a deterministic spatial heuristic: blocks are sorted top-to-bottom and a new region starts whenever the vertical gap exceeds roughly 1.5x the median line height. This produces answer regions with genuine coordinates without ever asking the OCR model to guess which question a handwritten block belongs to.

### Stage 3 - Answer Mapping
The route sends `mistral-large-latest` the list of questions (id, number, text, maxMarks) and the list of answer regions (id, text, page). The model matches by content, not by a question number the OCR might have misread. It returns only `answer_region_ids` from the supplied list. Answers can be out of order, can span multiple regions, or can be missing entirely (empty array). The server validates every returned ID against the OCR regions before creating a highlight, so the LLM can never invent coordinates.

### Stage 4 - Grading and Feedback
The same mapping call also returns `marksAwarded` and `feedback` per question, graded against `maxMarks`. Unanswered questions get zero marks and an empty region list.

### Highlighting
The server converts each matched region's pixel bounding box to percentages using the real page dimensions returned by Mistral for that exact page, with fallbacks for missing dimension fields. The frontend renders these percentage boxes as an overlay locked to the PDF page. Multiple boxes per question are supported for answers that span multiple lines or pages.

## Important assumptions and limitations

- The app stores state in memory only. Reloading the page clears the current upload and mapping state.
- Real OCR accuracy depends on the quality of the source PDFs or images and the clarity of the handwriting.
- A valid `MISTRAL_API_KEY` is required. The route returns a configuration error instead of showing inaccurate fake highlights when the key is missing.
- Two files do not need the `/v1/batch` endpoint; the route runs the two independent `/v1/ocr` requests concurrently. Batching is useful for larger asynchronous workloads.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open the application in the browser and upload the question paper and answer sheet.

4. Add `MISTRAL_API_KEY` to `.env.local`, then restart the development server. The route will call `mistral-ocr-latest` and use OCR annotation coordinates for highlights.
