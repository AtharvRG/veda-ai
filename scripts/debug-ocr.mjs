// scripts/debug-ocr.mjs
// Usage: node scripts/debug-ocr.mjs <path-to-file>
// Runs the answer sheet through Mistral OCR and prints the structure so we can
// see exactly where bounding boxes live.
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/debug-ocr.mjs <path-to-file>');
  process.exit(1);
}

const apiKey = readFileSync('.env.local', 'utf8')
  .split('\n')
  .find((l) => l.startsWith('MISTRAL_API_KEY='))
  ?.split('=')[1]
  ?.trim();

if (!apiKey) {
  console.error('MISTRAL_API_KEY not found in .env.local');
  process.exit(1);
}

const ext = extname(filePath).toLowerCase();
const mime = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';
const base64 = readFileSync(filePath).toString('base64');
const dataUrl = `data:${mime};base64,${base64}`;

console.log(`Sending ${filePath} (${base64.length} bytes b64) to Mistral OCR...`);

const response = await fetch('https://api.mistral.ai/v1/ocr', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    model: 'mistral-ocr-latest',
    document: { type: 'document_url', document_url: dataUrl },
  }),
});

console.log('HTTP status:', response.status);
if (!response.ok) {
  console.log('Body:', await response.text());
  process.exit(1);
}

const ocr = await response.json();

console.log('\n=== TOP-LEVEL KEYS ===');
console.log(Object.keys(ocr));

const pages = ocr.pages ?? [];
console.log('\n=== PAGES ===');
console.log('page count:', pages.length);

if (pages[0]) {
  const p = pages[0];
  console.log('\n=== FIRST PAGE KEYS ===');
  console.log(Object.keys(p));
  console.log('\n=== FIRST PAGE dimensions ===');
  console.log(JSON.stringify(p.dimensions ?? p.width ?? p.height ?? 'NONE', null, 2));

  console.log('\n=== FIRST PAGE markdown (first 500 chars) ===');
  console.log(String(p.markdown ?? '').slice(0, 500));

  console.log('\n=== FIRST PAGE blocks ===');
  console.log('blocks type:', Array.isArray(p.blocks) ? `array (${p.blocks.length})` : typeof p.blocks);
  if (Array.isArray(p.blocks) && p.blocks[0]) {
    console.log('first block keys:', Object.keys(p.blocks[0]));
    console.log('first block:', JSON.stringify(p.blocks[0], null, 2));
  }

  // Look for any other array fields that might hold bbox data
  console.log('\n=== ALL KEYS ON FIRST PAGE THAT ARE ARRAYS ===');
  for (const [k, v] of Object.entries(p)) {
    if (Array.isArray(v)) console.log(`  ${k}: array (${v.length})`);
  }
}

// Recursively find anything that looks like a bbox anywhere in the response
function findBoxes(value, path = '', results = []) {
  if (results.length > 30) return results;
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      value.forEach((item, i) => findBoxes(item, `${path}[${i}]`, results));
    } else {
      const rec = value;
      for (const key of ['bbox', 'bounding_box', 'box', 'bboxs']) {
        if (Array.isArray(rec[key]) && rec[key].length === 4) {
          results.push({ path: path ? `${path}.${key}` : key, value: rec[key] });
        }
      }
      for (const [k, v] of Object.entries(rec)) {
        if (!['bbox', 'bounding_box', 'box', 'bboxs'].includes(k)) {
          findBoxes(v, path ? `${path}.${k}` : k, results);
        }
      }
    }
  }
  return results;
}

const boxes = findBoxes(ocr);
console.log('\n=== BBOX-LIKE FIELDS FOUND ===');
console.log(`count: ${boxes.length}`);
boxes.slice(0, 10).forEach((b) => console.log(`  ${b.path}: ${JSON.stringify(b.value)}`));

console.log('\n=== FULL FIRST PAGE (raw JSON) ===');
console.log(JSON.stringify(pages[0] ?? {}, null, 2).slice(0, 3000));
