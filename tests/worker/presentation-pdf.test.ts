import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderPresentationPdf, validatePresentationPdf, PresentationPdfError } from '../../apps/worker/src/presentation-pdf.ts';
import { nativePresentation } from './presentation-native-fixture.ts';

test('registered renderer and registry remain the retained 1.0.0 bytes', async () => {
  for (const [file, expected] of [['packages/templates/src/render.ts', 'c7dbfd1418a24387b816fcc746ba85bf4092102c4e9ec6200868ba85bd847f34'], ['packages/templates/registry.json', 'a4cee8acd9675c5038517ce48880350c7bd28f9d1971eef55ab846f0996db53d']]) assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), expected);
});
test('actual PDF includes all 0/1/2/3 source frames, original Arabic text, transparent logos and fixed-version links', { timeout: 120000 }, async () => {
  const { snapshot, images } = nativePresentation(); const result = await renderPresentationPdf(snapshot, images);
  assert.equal(Buffer.from(result.bytes).subarray(0, 5).toString(), '%PDF-');
  assert.equal(result.proof.page_count, snapshot.slides.length); assert.equal(result.proof.frame_draw_count, 6);
  assert.equal(result.proof.logo_draw_count, snapshot.slides.length); assert.equal(result.proof.candidate_field_count, 40);
  const proof = await validatePresentationPdf(snapshot, images, result.bytes);
  assert.equal(proof.page_count, snapshot.slides.length); assert.ok(Math.abs(proof.width_points - 1200) < 0.5); assert.ok(Math.abs(proof.height_points - 675) < 0.5);
  assert.equal(proof.video_links_checked, 4); assert.equal(proof.image_draws_checked, 6 + snapshot.slides.length);
  assert.ok(proof.embedded_font_count > 0); assert.ok(proof.text_regions_checked >= 40);
});
test('missing, swapped or mislabeled image bytes never become a PDF', async () => {
  for (const mode of ['missing', 'swapped', 'mime'] as const) {
    const { snapshot, images } = nativePresentation([1]); const frame = snapshot.slides[1].frames[0];
    if (mode === 'missing') images.delete(frame.asset_id);
    if (mode === 'swapped') images.set(frame.asset_id, images.get(snapshot.cover.logo_asset_id!)!);
    if (mode === 'mime') snapshot.asset_inventory.find(asset => asset.asset_id === frame.asset_id)!.mime_type = 'image/png';
    await assert.rejects(renderPresentationPdf(snapshot, images), PresentationPdfError);
  }
});
test('accepted two-line wording renders; overflowing wording is reported without clipping or tiny fonts', { timeout: 120000 }, async () => {
  const { snapshot, images } = nativePresentation([0], false);
  snapshot.slides[1].fields!.skills_experience = 'Experienced theatre performer\nClear dialogue and movement';
  const result = await renderPresentationPdf(snapshot, images); await validatePresentationPdf(snapshot, images, result.bytes);
  snapshot.slides[1].fields!.skills_experience = 'Long wording requiring correction. '.repeat(35);
  await assert.rejects(renderPresentationPdf(snapshot, images), (error: unknown) => error instanceof PresentationPdfError && error.code === 'PDF_OVERFLOW');
});
test('invalid PDFs, unsafe origins and cancellation are closed failures', async () => {
  const { snapshot, images } = nativePresentation([0], false);
  await assert.rejects(validatePresentationPdf(snapshot, images, Buffer.from('%PDF-invalid')), PresentationPdfError);
  snapshot.render_configuration.application_origin = 'https://untrusted.invalid/path?token=private';
  await assert.rejects(renderPresentationPdf(snapshot, images), PresentationPdfError);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(renderPresentationPdf(nativePresentation([0], false).snapshot, new Map(), { signal: controller.signal }), (error: unknown) => error instanceof PresentationPdfError && error.code === 'PDF_ABORTED');
});
test('soft-wrapped mixed Arabic/English/numbers retain order; swapped numeric and negation text fail', { timeout: 120000 }, async () => {
  const { snapshot, images } = nativePresentation([0], false);
  snapshot.slides[1].fields!.name_or_id = 'مريم حسن / Maya';
  snapshot.slides[1].fields!.skills_experience = 'ممثلة مسرحية Maya 16 سنة وتجيد العربية والإنجليزية';
  const rendered = await renderPresentationPdf(snapshot, images); await validatePresentationPdf(snapshot, images, rendered.bytes);
  const changed = structuredClone(snapshot); changed.slides[1].fields!.skills_experience = changed.slides[1].fields!.skills_experience.replace('16', '61');
  await assert.rejects(validatePresentationPdf(changed, images, rendered.bytes), PresentationPdfError);
  changed.slides[1].fields!.skills_experience = snapshot.slides[1].fields!.skills_experience.replace('وتجيد', 'ولا تجيد');
  await assert.rejects(validatePresentationPdf(changed, images, rendered.bytes), PresentationPdfError);
});
test('1.1 Pending shows category and all eleven requirements, including missing values; no-role fallback retains the same layout', { timeout: 120000 }, async () => {
  for (const pending of ['role', 'no_role'] as const) {
    const { snapshot, images } = nativePresentation([], true, pending); const result = await renderPresentationPdf(snapshot, images); const proof = await validatePresentationPdf(snapshot, images, result.bytes);
    assert.equal(proof.page_count, 2); assert.equal(proof.text_regions_checked, 30); assert.equal(proof.image_draws_checked, 2); assert.equal(proof.video_links_checked, 0);
    snapshot.slides[1].requirements!.other_instructions = 'Instruction requiring correction. '.repeat(40);
    await assert.rejects(renderPresentationPdf(snapshot, images), (error: unknown) => error instanceof PresentationPdfError && error.code === 'PDF_OVERFLOW');
  }
});
