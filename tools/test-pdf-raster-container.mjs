import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { TextEncoder } from 'node:util';
import { rasterPdfPages } from '../apps/worker/src/pdf-raster.ts';
import { pdf } from '../tests/worker/document-fixtures.ts';
import { imageOnlyPdf } from '../tests/worker/pdf-image-fixtures.ts';
import { preparePdfWithVision } from '../apps/worker/src/pdf-vision.ts';
const imageId = process.env.EPS_PDF_RASTER_IMAGE_ID;
if (process.argv.length !== 2 || !/^sha256:[a-f0-9]{64}$/u.test(imageId ?? '')) throw new Error('Provide the built immutable EPS_PDF_RASTER_IMAGE_ID.');
const tests = []; const run = new Date().toISOString().replace(/[:.]/gu, '-');
async function check(name, action) { try { tests.push({ name, result: 'passed', ...await action() }); } catch (error) { tests.push({ name, result: 'failed', code: error.code ?? 'ASSERTION_FAILED' }); } }
await check('native-page-raster-source-hash-and-real-page-numbers', async () => { const value = await rasterPdfPages(pdf(['Raster this real page', 'Second actual page']), 'synthetic-source', [2], { imageId }); assert.equal(value.pages.length, 1); assert.equal(value.pages[0].page, 2); assert(value.pages[0].width <= 2048 && value.pages[0].height <= 2048); assert.equal(value.pages[0].bytes[0], 0xff); return { rasterizer_version: value.rasterizer_version, page: value.pages[0].page, width: value.pages[0].width, height: value.pages[0].height, sha256: value.pages[0].sha256 }; });
await check('corrupt-source-rejected-without-provider-work', async () => { await assert.rejects(rasterPdfPages(new TextEncoder().encode('%PDF-corrupt'), 'synthetic-corrupt', [1], { imageId })); return {}; });
await check('missing-source-page-rejected-honestly', async () => { await assert.rejects(rasterPdfPages(pdf(['Only one source page']), 'synthetic-page-range', [3], { imageId })); return {}; });
await check('digital-header-plus-large-scanned-body-triggers-whole-page-vision', async () => {
  const actualRaster = await rasterPdfPages(pdf(['Synthetic scanned body role: Archive Clerk']), 'synthetic-raster-origin', [1], { imageId }); const image = actualRaster.pages[0];
  const hybrid = imageOnlyPdf([{ bytes: image.bytes, width: image.width, height: image.height }], 'Digital header only'); let calls = 0;
  const result = await preparePdfWithVision(hybrid, 'synthetic-hybrid-source', { imageId, openAI: { apiKey: 'synthetic-unused', model: 'synthetic-unused' }, read: async input => { calls++; assert.equal(input.page, 1); return { text: 'Synthetic scanned body role: Archive Clerk', uncertainties: [], metadata: { provider: 'openai', sdk_version: '7.45.1', requested_model: 'synthetic-unused', resolved_model: 'synthetic-unused', response_id: 'synthetic-not-provider', request_id: null, source_asset_id: input.source_asset_id, source_sha256: input.source_sha256, page: input.page, image_sha256: input.image_sha256, prompt_version: 'pdf-page-ocr.v1', prompt_sha256: 'a'.repeat(64), schema_sha256: 'b'.repeat(64), elapsed_ms: 0, usage: null } }; } });
  assert.equal(calls, 1); assert.equal(result.extractionMethod, 'pdf_vision'); assert.match(result.text, /Digital header only/); assert.match(result.text, /Archive Clerk/); return { provider_transport: 'deterministic injected OCR text only', actual_raster_and_coverage: true, retained_digital_header: true, page: result.paragraphs[0].page };
});
const summary = { observed_at: new Date().toISOString(), image_id: imageId, environment: 'Owned local network-disabled Poppler container only', provider_called: false, hosted: false, passed: tests.every(test => test.result === 'passed'), tests };
const directory = path.resolve('tracking/evidence/m02/pdf-raster'); await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, `${run}.json`), JSON.stringify(summary, null, 2) + '\n'); process.stdout.write(JSON.stringify(summary) + '\n'); if (!summary.passed) process.exitCode = 1;
