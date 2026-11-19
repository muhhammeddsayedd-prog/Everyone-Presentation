import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import registry from '../../packages/templates/versions/1.4.1/registry.json';
import { manifestFromSnapshot, parsePresentationManifest, parseRenderSnapshot, reviewFromRenderSnapshot } from '../../packages/domain/src/presentation.ts';
import { renderPresentationPdf, validatePresentationPdf } from '../../apps/worker/src/presentation-pdf.ts';
import { loadReviewTemplateAssets, measureReviewFit } from '../../apps/worker/src/review-fit.ts';
import { editorialExpectations, editorialPdfLinksFollowSlides, editorialPersonSlides, isEditorialTemplate } from '../../apps/worker/src/editorial-template.ts';
import { captionedTemplate, referenceReview } from '../fixtures/reference-review.ts';
import { referenceSnapshot } from '../fixtures/reference-snapshot.ts';
import { captionedShowcase, LONG_NAME } from '../fixtures/captioned-review.ts';

/** Template 1.4.1 through the worker's actual Chromium PDF path, on synthetic people only. */
test('1.4.1 is an editorial template with its own pinned registry, renderer files and the nine fonts; no PDF video links', async () => {
  assert.equal(isEditorialTemplate({ key: 'everyone-casting', version: '1.4.1' }), true);
  assert.equal(editorialPdfLinksFollowSlides({ version: '1.4.1' }), false);
  const pinned = await loadReviewTemplateAssets({ key: registry.key, version: registry.version, content_sha256: registry.content_sha256, font_key: registry.font_key });
  assert.equal(Object.keys(pinned.font_hashes).length, 9);
  await assert.rejects(loadReviewTemplateAssets({ key: registry.key, version: '1.4.1', content_sha256: 'b4fbd16ff5038c8a97583d1225294fbe0c26b71439f850e7fb888ff4320b9ac8', font_key: registry.font_key }));
});

test('1.4.1 snapshot: presentation context, photo portraits and manifest round-trip', () => {
  const { snapshot } = referenceSnapshot(referenceReview([{ name: 'Lead', slots: [[{ position: 'main', portrait: 'photo', age: '34', height: '180 cm' }, { position: 'backup' }]] }], { template: captionedTemplate }));
  assert.equal(snapshot.template.version, '1.4.1');
  assert.ok(snapshot.asset_inventory.some(asset => asset.asset_kind === 'candidate_photo'));
  assert.doesNotThrow(() => parseRenderSnapshot(snapshot));
  const manifest = manifestFromSnapshot(snapshot); assert.deepEqual(manifest.presentation, snapshot.presentation);
  assert.doesNotThrow(() => parsePresentationManifest(manifest));
  const missing = structuredClone(snapshot); delete missing.presentation;
  assert.throws(() => parseRenderSnapshot(missing), /fixed contract/u);
});

test('1.4.1 PDF of every caption case renders and validates end to end (captions are checked text regions)', { timeout: 300000 }, async () => {
  const { snapshot, images } = referenceSnapshot(captionedShowcase(), 3);
  const expected = editorialExpectations(reviewFromRenderSnapshot(snapshot));
  const plain = editorialExpectations({ ...reviewFromRenderSnapshot(snapshot), template: { version: '1.4.0' } });
  assert.equal(expected.page_count, 19); assert.equal(expected.page_count, plain.page_count);
  assert.equal(expected.candidate_field_count, 0); assert.equal(expected.video_link_count, 0);
  assert.ok(expected.text_regions > plain.text_regions);
  assert.equal(editorialPersonSlides(expected.deck), snapshot.slides.filter(slide => slide.kind === 'candidate').length);
  const result = await renderPresentationPdf(snapshot, images);
  assert.equal(result.proof.page_count, 19); assert.equal(result.proof.frame_draw_count, expected.frame_draw_count); assert.equal(result.proof.video_link_count, 0);
  const proof = await validatePresentationPdf(snapshot, images, result.bytes);
  assert.equal(proof.page_count, 19); assert.ok(Math.abs(proof.width_points - 1440) < 0.5);
  assert.equal(proof.text_regions_checked, expected.text_regions); assert.equal(proof.image_draws_checked, expected.image_draws);
  if (process.env.EPS_TEMPLATE_EVIDENCE_DIR) { mkdirSync(process.env.EPS_TEMPLATE_EVIDENCE_DIR, { recursive: true }); writeFileSync(`${process.env.EPS_TEMPLATE_EVIDENCE_DIR}/deck-1.4.1.pdf`, result.bytes); }
});

test('1.4.1 fit: a two-line name and a one-line age | height fit; a third name line or a wider age line is a measured overflow of that person', { timeout: 180000 }, async () => {
  const people = [{ position: 'option' as const, name: LONG_NAME, age: '34', height: 'Height: 173; weight: 77. Units not stated.' }, { position: 'option' as const, name: 'Omar Haddad', age: '40-50', height: '182 cm' }, { position: 'option' as const, name: 'Nadia Kamal' }];
  const clean = await measureReviewFit(referenceReview([{ name: 'Trio', slots: [people] }], { coverNote: 'Pending Availability.', template: captionedTemplate }));
  assert.deepEqual(clean.overflows, []);
  const long = `${LONG_NAME} Al-Mansour`;
  const measured = await measureReviewFit(referenceReview([{ name: 'Trio', slots: [[{ ...people[0], name: long }, { ...people[1], age: 'Between forty-five and fifty-five years old, possibly older' }, people[2]]] }], { template: captionedTemplate }));
  assert.deepEqual(measured.overflows.map(item => [item.slide_index, item.field, item.axis]).sort(), [[1, 'presentation.caption_name', 'vertical'], [2, 'presentation.caption_details', 'horizontal']]);
});
