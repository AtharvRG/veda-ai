# VedaAI - Assessment Extraction & Answer Mapping

This application allows teachers to upload a question paper and a student's handwritten answer sheet. It extracts the questions, maps the student's answers, provides an AI-assisted evaluation, and highlights the exact spatial region of the answer on the original document.

## Technical Architecture

The application is built using Next.js (App Router), React 19, and Tailwind CSS v4. State is managed purely in-memory using React Context, adhering to the requirement of having no external database.

### The AI Approach: OCR + LLM Orchestration
Rather than relying on standard Vision LLMs (which are notoriously prone to spatial hallucination when guessing coordinate geometry), this system is architected around a two-step deterministic pipeline utilizing the Mistral AI stack:

1. **Document Bounding Box Extraction (Mistral OCR 4.1)**: The student's answer sheet is processed by a dedicated OCR model. This returns highly structured JSON containing discrete text blocks, alongside their exact spatial bounding boxes `[x_min, y_min, x_max, y_max]` and page numbers.
2. **Reasoning & Mapping (Mistral LLM)**: The extracted text from the question paper and the structured JSON blocks from the answer sheet are passed to an LLM. The LLM is prompted to match the text blocks to specific questions, evaluate the accuracy, and return the corresponding `block_id`. 

Because the LLM only returns the `block_id`, the frontend maps this ID back to the exact coordinates provided by the OCR model. This guarantees 100% accurate visual highlighting over the PDF canvas without coordinate hallucinations.

## Key Features & Quality of Life Enhancements

- **Spatial Highlighting**: Clicking a question seamlessly navigates the PDF viewer to the correct page and draws an absolute-positioned highlight over the mapped answer using calculated CSS percentages.
- **Retained State for Bulk Grading**: Teachers can click "Evaluate Next Answer Sheet", which clears the student data but retains the Question Paper file and extracted JSON in memory, preventing redundant uploads.
- **Live Scoring Tally**: A fixed summary footer provides an immediate overview of the total marks awarded and the overall percentage.
- **Responsive Layout**: Adapts from a split-pane desktop view to a clean, segmented tab control on mobile devices.

## Assumptions & Limitations

- **Mock Implementation for Review**: To ensure the application is immediately reviewable without requiring the evaluator to input private API keys (and to bypass severe free-tier rate limits), the API orchestration logic is documented in `src/app/api/extract/route.ts`, while the frontend utilizes a structured mock state to demonstrate the spatial bounding box UI.
- **PDF Format**: The document viewer relies on `react-pdf`. It assumes the uploaded files are standard PDF documents. 
- **In-Memory Storage**: Reloading the page will clear all current uploads and mappings.

## Getting Started

1. Install dependencies:
   ```bash
   npm install