// src/lib/lineBoxes.ts
//
// Line-level bounding-box extraction for answer sheets.
//
// Why this exists: Mistral OCR returns paragraph-level blocks, which don't map
// 1:1 to answers (some answers are merged into one block, some are split across
// many blocks). Lines are the atomic unit that's always correct: an answer is
// just a run of consecutive lines. So we render the PDF to images and run
// Tesseract to get a box per line, then group lines into answers elsewhere.
//
// We only need Tesseract for the BOXES. Mistral OCR (called separately) gives us
// higher-quality text for handwriting, so we don't rely on Tesseract's text.
//
// Rendering path: pdfjs-dist (legacy build) + @napi-rs/canvas. pdfjs renders
// each page into a node-canvas, we encode it to PNG, and feed the PNG to
// Tesseract. @napi-rs/canvas is used (not node-canvas) because it handles
// pdfjs's drawImage calls for embedded raster images cleanly.

import { createWorker, type Worker } from 'tesseract.js';
import { createCanvas, Image as NapiImage } from '@napi-rs/canvas';

export type LineBox = {
  page: number;
  text: string;
  bbox: [number, number, number, number]; // x0, y0, x1, y1 in rendered-image pixels
  pageWidth: number; // rendered image width (px)
  pageHeight: number; // rendered image height (px)
};

// 2x scale ≈ ~300 DPI on a typical page. Good for Tesseract line boxes.
const RENDER_SCALE = 2;

// Lazy singleton so we don't re-initialise the WASM worker on every request.
let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) workerPromise = createWorker('eng');
  return workerPromise;
}

// pdfjs internally does `new Image()` for embedded raster images. Node has no
// global Image, so we expose @napi-rs/canvas's Image before pdfjs is imported.
if (!globalThis.Image) {
  (globalThis as unknown as { Image: typeof NapiImage }).Image = NapiImage;
}

// Minimal canvas factory pdfjs can use in Node. Each create() returns a
// node-canvas + its 2D context.
class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    return { canvas, ctx: canvas.getContext('2d') };
  }
  reset(o: { canvas: { width: number; height: number } }, width: number, height: number) {
    o.canvas.width = width;
    o.canvas.height = height;
  }
  destroy(o: { canvas: { width: number; height: number } }) {
    o.canvas.width = 0;
    o.canvas.height = 0;
  }
}

/**
 * Render every page of a PDF to a PNG buffer using pdfjs + @napi-rs/canvas.
 * Returns one PNG per page plus the pixel dimensions.
 */
async function renderPagesToPng(pdfBytes: Uint8Array): Promise<{ png: Buffer; width: number; height: number }[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { pathToFileURL } = await import('node:url');
  const { resolve } = await import('node:path');
  // Point the worker at the bundled worker file via a file:// URL so pdfjs
  // can spawn it in Node.
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ).href;

  const doc = await pdfjs.getDocument({ data: pdfBytes }).promise;
  const canvasFactory = new NodeCanvasFactory();
  const pages: { png: Buffer; width: number; height: number }[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const width = Math.floor(viewport.width);
    const height = Math.floor(viewport.height);
    const { canvas, ctx } = canvasFactory.create(width, height);
    await page.render({
      canvasContext: ctx,
      viewport,
      canvasFactory,
    } as unknown as Parameters<typeof page.render>[0]).promise;
    const png = canvas.toBuffer('image/png');
    pages.push({ png, width, height });
    canvasFactory.destroy({ canvas });
  }

  await doc.cleanup();
  return pages;
}

/**
 * Run Tesseract on a PNG and return one box per text line.
 */
async function ocrLinesFromPng(
  png: Buffer,
  width: number,
  height: number,
  worker: Worker,
  pageNumber: number,
): Promise<LineBox[]> {
  const { data } = await worker.recognize(png, {}, { blocks: true } as never);
  const lines: LineBox[] = [];
  const blocks = (data.blocks ?? []) as Array<{
    paragraphs?: Array<{
      lines?: Array<{
        text?: string;
        bbox?: { x0: number; y0: number; x1: number; y1: number };
      }>;
    }>;
  }>;
  for (const block of blocks) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        const text = (line.text ?? '').trim();
        const b = line.bbox;
        if (text && b && b.x1 > b.x0 && b.y1 > b.y0) {
          lines.push({
            page: pageNumber,
            text,
            bbox: [b.x0, b.y0, b.x1, b.y1],
            pageWidth: width,
            pageHeight: height,
          });
        }
      }
    }
  }
  return lines;
}

/**
 * Public entry point: given a File-like object (from a Next.js Route request)
 * for an answer-sheet PDF (or image), return line-level boxes across all
 * pages, in reading order.
 *
 * For image inputs (PNG/JPG) we skip pdfjs and feed the bytes straight to
 * Tesseract.
 */
export async function getLineBoxes(file: { type: string; arrayBuffer: () => Promise<ArrayBuffer> }): Promise<LineBox[]> {
  const worker = await getWorker();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPdf = file.type === 'application/pdf' || bytes[0] === 0x25 /* %PDF */;

  const allLines: LineBox[] = [];

  if (isPdf) {
    const pages = await renderPagesToPng(bytes);
    for (let i = 0; i < pages.length; i++) {
      const { png, width, height } = pages[i];
      const lines = await ocrLinesFromPng(png, width, height, worker, i + 1);
      allLines.push(...lines);
    }
  } else {
    // Single image: one "page". Tesseract reads width/height from the image.
    const { data } = await worker.recognize(Buffer.from(bytes), {}, { blocks: true } as never);
    const imgData = data as unknown as { image_width?: number; image_height?: number; blocks?: Array<{
      paragraphs?: Array<{
        lines?: Array<{
          text?: string;
          bbox?: { x0: number; y0: number; x1: number; y1: number };
        }>;
      }>;
    }> };
    const width = imgData.image_width ?? 0;
    const height = imgData.image_height ?? 0;
    const blocks = imgData.blocks ?? [];
    for (const block of blocks) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) {
          const text = (line.text ?? '').trim();
          const b = line.bbox;
          if (text && b && b.x1 > b.x0 && b.y1 > b.y0 && width && height) {
            allLines.push({ page: 1, text, bbox: [b.x0, b.y0, b.x1, b.y1], pageWidth: width, pageHeight: height });
          }
        }
      }
    }
  }

  return allLines;
}

/**
 * Union a list of line boxes into a single bounding box. Used when an answer
 * spans multiple consecutive lines.
 */
export function unionLineBoxes(lines: LineBox[]): {
  bbox: [number, number, number, number];
  page: number;
  pageWidth: number;
  pageHeight: number;
} | null {
  if (!lines.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of lines) {
    x0 = Math.min(x0, l.bbox[0]);
    y0 = Math.min(y0, l.bbox[1]);
    x1 = Math.max(x1, l.bbox[2]);
    y1 = Math.max(y1, l.bbox[3]);
  }
  const first = lines[0];
  return { bbox: [x0, y0, x1, y1], page: first.page, pageWidth: first.pageWidth, pageHeight: first.pageHeight };
}
