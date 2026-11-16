import assert from 'node:assert/strict';
import test from 'node:test';
import registry from '../../packages/templates/versions/1.4.0/registry.json';
import { manifestFromSnapshot, parsePresentationManifest, parseRenderSnapshot, reviewFromRenderSnapshot } from '../../packages/domain/src/presentation.ts';
import { PresentationPdfError, renderPresentationPdf, validatePresentationPdf } from '../../apps/worker/src/presentation-pdf.ts';
import { loadReviewTemplateAssets, measureReviewFit } from '../../apps/worker/src/review-fit.ts';
import { editorialExpectations, editorialPersonSlides, isEditorialTemplate } from '../../apps/worker/src/editorial-template.ts';
import { floward, referenceReview } from '../fixtures/reference-review.ts';
import { referenceSnapshot } from '../fixtures/reference-snapshot.ts';

/** Template 1.4.0 through the worker's actual Chromium PDF path, on synthetic people only. */
test('1.4.0 is an editorial template with its own pinned registry, renderer files and the nine fonts', async () => {
  assert.equal(isEditorialTemplate({ key: 'everyone-casting', version: '1.4.0' }), true);
  const pinned = await loadReviewTemplateAssets({ key: registry.key, version: registry.version, content_sha256: registry.content_sha256, font_key: registry.font_key });
  assert.equal(Object.keys(pinned.font_hashes).length, 9);
});

test('1.4.0 snapshot: presentation context, photo portraits and manifest round-trip; earlier templates refuse photos', () => {
  const { snapshot } = referenceSnapshot(referenceReview([{ name: 'Lead', slots: [[{ position: 'main', portrait: 'photo' }, { position: 'backup' }]] }]));
  assert.ok(snapshot.asset_inventory.some(asset => asset.asset_kind === 'candidate_photo'));
  assert.doesNotThrow(() => parseRenderSnapshot(snapshot));
  const manifest = manifestFromSnapshot(snapshot); assert.deepEqual(manifest.presentation, snapshot.presentation);
  assert.doesNotThrow(() => parsePresentationManifest(manifest));
  const older = structuredClone(snapshot); older.template = { ...older.template, version: '1.3.0' }; delete older.presentation;
  assert.throws(() => parseRenderSnapshot(older), /fixed contract/u);
  const missing = structuredClone(snapshot); delete missing.presentation;
  assert.throws(() => parseRenderSnapshot(missing), /fixed contract/u);
});

test('1.4.0 PDF of the 35-page Floward structure renders and validates end to end', { timeout: 300000 }, async () => {
  const { snapshot, images } = referenceSnapshot(floward(), 3);
  const expected = editorialExpectations(reviewFromRenderSnapshot(snapshot));
  assert.equal(expected.page_count, 35); assert.equal(expected.candidate_field_count, 0); assert.equal(expected.video_link_count, 0);
  assert.equal(editorialPersonSlides(expected.deck), snapshot.slides.filter(slide => slide.kind === 'candidate').length);
  const result = await renderPresentationPdf(snapshot, images);
  assert.equal(result.proof.page_count, 35); assert.equal(result.proof.frame_draw_count, expected.frame_draw_count); assert.equal(result.proof.video_link_count, 0);
  const proof = await validatePresentationPdf(snapshot, images, result.bytes);
  assert.equal(proof.page_count, 35); assert.ok(Math.abs(proof.width_points - 1440) < 0.5);
  assert.equal(proof.text_regions_checked, expected.text_regions); assert.equal(proof.image_draws_checked, expected.image_draws);
});

test('1.4.0 never substitutes the silhouette for an unreadable picture: a corrupt image fails the render', { timeout: 180000 }, async () => {
  const { snapshot, images } = referenceSnapshot(referenceReview([{ name: 'Lead', slots: [[{ position: 'main', portrait: 'photo' }]] }]));
  const photo = snapshot.asset_inventory.find(asset => asset.asset_kind === 'candidate_photo')!;
  const broken = new Map(images); broken.set(photo.asset_id, new Uint8Array(images.get(photo.asset_id)!.length));
  await assert.rejects(renderPresentationPdf(snapshot, broken), (error: unknown) => error instanceof PresentationPdfError && error.code === 'PDF_ASSET_INVALID');
});

test('1.4.0 fit: a subtitle or note too long for one line is a measured overflow on that page, never smaller type', { timeout: 180000 }, async () => {
  const review = referenceReview([{ name: 'Trio', slots: [[{ position: 'option' }, { position: 'option' }, { position: 'option' }]] }, { name: 'X'.repeat(120), slots: [[{ position: 'option' }]], note: 'A very long note '.repeat(12) }]);
  review.slides.forEach(slide => { slide.review_status = 'reviewed'; });
  const measured = await measureReviewFit(review);
  assert.deepEqual(measured.overflows.map(item => [item.slide_index, item.field, item.axis]).sort(), [[4, 'layout', 'horizontal'], [4, 'presentation.note', 'horizontal'], [4, 'presentation.subtitle', 'horizontal']]);
  const clean = await measureReviewFit(referenceReview([{ name: 'Trio', slots: [[{ position: 'option' }, { position: 'option' }, { position: 'option' }]] }], { coverNote: 'Pending Availability.' }));
  assert.deepEqual(clean.overflows, []);
});
