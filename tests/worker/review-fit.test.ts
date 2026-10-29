import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import process from 'node:process';
import { createSpecsWorkerEnvironment } from '../../tools/worker-runtime-env.mjs';
import { measureReviewFit, loadReviewTemplateAssets } from '../../apps/worker/src/review-fit.ts';
import { fitReview } from './review-fit-fixture.ts';
import { nativeBrowserEnvironment } from '../../apps/worker/src/native-browser.ts';

test('native browser receives only OS configuration and cannot inherit worker provider/database/dispatch secrets', () => {
  const environment = nativeBrowserEnvironment({ SystemRoot: 'synthetic-system', TEMP: 'synthetic-temp', OPENAI_API_KEY: 'private', EPS_SPECS_PG_PASSWORD: 'private',
    N8N_REVIEW_DISPATCH_SECRET: 'private', N8N_DISPATCH_SECRET: 'private', NODE_OPTIONS: '--require=untrusted', PATH: 'untrusted' });
  assert.deepEqual(environment, { PATH: '', SystemRoot: 'synthetic-system', TEMP: 'synthetic-temp' });
});

test('actual pinned browser/fonts measure the selected ten-field template without page network', async () => {
  const review = fitReview(); const proof = await measureReviewFit(review);
  assert.equal(proof.input_fingerprint, review.input_fingerprint); assert.equal(proof.template_content_sha256, review.template.content_sha256);
  assert.equal(proof.renderer_version, 'everyone-casting-fit-v1'); assert.equal(Object.keys(proof.font_hashes).length, 6);
  assert.match(proof.chromium_version, /^[0-9]+\.[0-9.]+$/u); assert.deepEqual(proof.overflows, []);
  assert.ok(Number.isFinite(Date.parse(proof.measured_at))); assert.equal(proof.schema_version, '1.0');
});
test('actual layout identifies the exact long field and preserves Arabic/source text', async () => {
  const review = fitReview(); const long = 'No acting credits; rehearsals only. '.repeat(400);
  review.slides[0].fields.skills_experience = long; review.slides[0].fields.name_or_id = 'شخص تجريبي';
  const before = structuredClone(review); const proof = await measureReviewFit(review);
  assert.ok(proof.overflows.some(row => row.slide_index === 1 && row.field === 'skills_experience' && row.axis === 'vertical' && row.overflow_px > 0));
  assert.equal(proof.overflows.some(row => row.field === 'name_or_id'), false); assert.deepEqual(review, before);
});
test('wrong pins, altered font bytes and cancellation are refused before browser work', async () => {
  const review = fitReview(); await assert.rejects(loadReviewTemplateAssets({ ...review.template, content_sha256: 'b'.repeat(64) }), { code: 'FIT_TEMPLATE_MISMATCH' });
  await assert.rejects(loadReviewTemplateAssets(review.template, { read: async file => {
    const bytes = await readFile(file); return file.endsWith('IBMPlexSans-Regular.woff2') ? new Uint8Array([...bytes.subarray(0, -1), bytes.at(-1)! ^ 1]) : bytes;
  } }), { code: 'FIT_TEMPLATE_MISMATCH' });
  const controller = new AbortController(); controller.abort(); await assert.rejects(measureReviewFit(review, { signal: controller.signal }), { code: 'FIT_ABORTED' });
});

test('selected logo cover and every-slide geometry is measured without reading private image bytes', async () => {
  for (const placement of ['cover', 'every_slide'] as const) {
    const review = fitReview(); review.cover.logo_asset_id = 'synthetic-logo'; review.cover.logo_placement = placement;
    const proof = await measureReviewFit(review); assert.deepEqual(proof.overflows, []); assert.equal(proof.input_fingerprint, review.input_fingerprint);
  }
});

test('selected original-video footer link is measured without requesting an access URL', async () => {
  const review = fitReview(); review.slides[0].video_asset_id = 'synthetic-original';
  const proof = await measureReviewFit(review); assert.deepEqual(proof.overflows, []);
});

test('actual native measurement also launches from the scrubbed production worker environment', async () => {
  const environment = createSpecsWorkerEnvironment({ OPENAI_API_KEY: 'synthetic-unused-key', OPENAI_EXTRACTION_MODEL: 'synthetic-unused-model' },
    { EPS_SPECS_PG_HOST: 'synthetic-unused-host', EPS_SPECS_PG_PASSWORD: 'synthetic-unused-password', EPS_SPECS_PG_CA_BASE64: 'synthetic-unused-ca', N8N_DISPATCH_URL: 'https://synthetic.invalid/webhook/unused', N8N_DISPATCH_SECRET: 'synthetic-unused-secret' }, process.env);
  const { stdout, stderr } = await promisify(execFile)(process.execPath, ['--import', 'tsx', 'tests/worker/review-fit-child-fixture.ts'], { env: environment, encoding: 'utf8', windowsHide: true, shell: false, timeout: 30000, maxBuffer: 4096 });
  assert.equal(stderr, ''); const proof = JSON.parse(stdout); assert.equal(proof.renderer_version, 'everyone-casting-fit-v1');
  assert.equal(proof.input_fingerprint, fitReview().input_fingerprint); assert.deepEqual(proof.overflows, []); assert.equal(Object.keys(proof.font_hashes).length, 6);
});
