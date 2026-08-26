// src/app/api/debug-ocr/route.ts
// Temporary debug route: uploads a single file, runs Mistral OCR, and dumps the
// raw response structure so we can see exactly where bounding boxes live.
import { NextResponse } from 'next/server';

function summarize(value: unknown, depth = 0, maxDepth = 4): unknown {
  if (depth > maxDepth) return '...';
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    // For arrays, show count + first 2 items summarized
    const sample = value.slice(0, 2).map((v) => summarize(v, depth + 1, maxDepth));
    return { _arrayLength: value.length, _sample: sample };
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = summarize(v, depth + 1, maxDepth);
  }
  return out;
}

function findBoxes(value: unknown, path = '', results: { path: string; sample: unknown }[] = []) {
  if (results.length > 20) return results;
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      value.forEach((item, i) => findBoxes(item, `${path}[${i}]`, results));
    } else {
      const rec = value as Record<string, unknown>;
      // Look for anything that looks like a bbox: array of 4 numbers, or keys like bbox/box/bounding_box
      if (Array.isArray(rec.bbox) && rec.bbox.length === 4) {
        results.push({ path: path ? `${path}.bbox` : 'bbox', sample: rec.bbox });
      }
      if (Array.isArray(rec.bounding_box) && rec.bounding_box.length === 4) {
        results.push({ path: path ? `${path}.bounding_box` : 'bounding_box', sample: rec.bounding_box });
      }
      if (Array.isArray(rec.box) && rec.box.length === 4) {
        results.push({ path: path ? `${path}.box` : 'box', sample: rec.box });
      }
      for (const [k, v] of Object.entries(rec)) {
        if (k !== 'bbox' && k !== 'bounding_box' && k !== 'box') {
          findBoxes(v, path ? `${path}.${k}` : k, results);
        }
      }
    }
  }
  return results;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = (formData.get('file') as File | null) ?? (formData.get('answerFile') as File | null);
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!file) return NextResponse.json({ error: 'No file provided (use field "file" or "answerFile").' }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: 'MISTRAL_API_KEY missing.' }, { status: 500 });

    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const dataUrl = `data:${file.type || 'application/pdf'};base64,${base64}`;

    const response = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'mistral-ocr-latest',
        document: { type: 'document_url', document_url: dataUrl },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `OCR HTTP ${response.status}`, body: await response.text() }, { status: 502 });
    }

    const ocr = await response.json();

    // Top-level keys
    const topKeys = Object.keys(ocr ?? {});
    const pages = Array.isArray((ocr as Record<string, unknown>).pages) ? (ocr as Record<string, unknown>).pages : [];
    const firstPage = pages[0] as Record<string, unknown> | undefined;

    return NextResponse.json({
      meta: {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        topLevelKeys: topKeys,
        pageCount: pages.length,
        firstPageKeys: firstPage ? Object.keys(firstPage) : [],
        firstPageDimensions: firstPage?.dimensions ?? firstPage?.width ?? firstPage?.height ?? 'none',
      },
      // Where do bounding boxes live?
      bboxLocations: findBoxes(ocr),
      // Structural summary (truncated arrays, 4 levels deep)
      structure: summarize(ocr),
      // The raw first page in full so we can see exact field names
      rawFirstPage: firstPage ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Debug OCR failed.';
    console.error('[DEBUG OCR ERROR]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
