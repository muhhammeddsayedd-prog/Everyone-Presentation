import assert from 'node:assert/strict';
import test from 'node:test';
import registry from '../../packages/templates/versions/1.3.0/registry.json';
import { reviewFromRenderSnapshot } from '../../packages/domain/src/presentation.ts';
import { renderPresentationPdf, validatePresentationPdf } from '../../apps/worker/src/presentation-pdf.ts';
import { measureReviewFit, loadReviewTemplateAssets, ReviewFitError } from '../../apps/worker/src/review-fit.ts';
import { editorialExpectations, editorialPersonSlides, isEditorialTemplate } from '../../apps/worker/src/editorial-template.ts';
import { editorialPresentation } from '../fixtures/editorial-snapshot.ts';

/** Template 1.3.0: one page per slot (Main + Backup side by side), only provided facts. */
const presentation = (logo: 'cover' | 'every_slide' = 'cover') => editorialPresentation(logo, '1.3.0');

test('1.3.0 is an editorial template with its own pinned registry, renderer files and the nine fonts', async () => {
  assert.equal(isEditorialTemplate({ key: 'everyone-casting', version: '1.3.0' }), true);
  const pinned = await loadReviewTemplateAssets({ key: registry.key, version: registry.version, content_sha256: registry.content_sha256, font_key: registry.font_key });
  assert.equal(Object.keys(pinned.font_hashes).length, 9);
  await assert.rejects(loadReviewTemplateAssets({ key: registry.key, version: registry.version, content_sha256: 'f'.repeat(64), font_key: registry.font_key }), ReviewFitError);
});

test('1.3.0 PDF: slot page for Main + Backup, single-person pages, provided-fact count, validated end to end', { timeout: 180000 }, async () => {
  const { snapshot, images } = presentation();
  const expected = editorialExpectations(reviewFromRenderSnapshot(snapshot));
  assert.deepEqual(expected.deck.pages.map(page => page.layout), ['cover_floward', 'section_divider', 'cast_group_detail', 'cast_detail', 'cast_detail', 'section_divider', 'cast_pending', 'closing_thank_you']);
  assert.deepEqual(expected.deck.pages[2].sources, [1, 2]);
  assert.equal(editorialPersonSlides(expected.deck), 4);
  // Only provided facts: name + skills on single pages (2 each), name caption + skills on the slot page (2 each).
  assert.equal(expected.candidate_field_count, 8);
  const result = await renderPresentationPdf(snapshot, images);
  assert.equal(result.proof.page_count, expected.page_count); assert.equal(result.proof.candidate_field_count, 8);
  assert.equal(result.proof.frame_draw_count, expected.frame_draw_count); assert.equal(result.proof.video_link_count, 4);
  const proof = await validatePresentationPdf(snapshot, images, result.bytes);
  assert.equal(proof.page_count, expected.page_count); assert.ok(Math.abs(proof.width_points - 1440) < 0.5);
  assert.equal(proof.text_regions_checked, expected.text_regions); assert.equal(proof.image_draws_checked, expected.image_draws); assert.equal(proof.video_links_checked, 4);
});

test('1.3.0 every-slide logo is drawn on every numbered page', { timeout: 180000 }, async () => {
  const { snapshot, images } = presentation('every_slide'); const expected = editorialExpectations(reviewFromRenderSnapshot(snapshot));
  const result = await renderPresentationPdf(snapshot, images); assert.equal(result.proof.logo_draw_count, expected.logo_draw_count); assert.equal(expected.logo_draw_count, expected.page_count - 1);
});

test('1.3.0 fit attributes an overflow on a shared slot page to the person whose fact overflows', { timeout: 180000 }, async () => {
  const { snapshot } = presentation(); const review = reviewFromRenderSnapshot(snapshot);
  review.slides.forEach((slide, n) => { if (slide.kind !== 'candidate') return; Object.assign(slide, { workspace_candidate_id: `pool-${n}`, candidate_media_id: slide.frames.length ? `media-${n}` : null, assignment_row_version: 1, workspace_candidate_row_version: 1, candidate_row_version: 1, review_status: 'reviewed' }); });
  review.unreviewed_candidate_ids = [];
  const clean = await measureReviewFit(review); assert.deepEqual(clean.overflows, []);
  // The Backup (second person on the slot page): wording far beyond its four planned lines overflows.
  review.slides[1].fields.city = 'Long synthetic wording '.repeat(20);
  const measured = await measureReviewFit(review);
  assert.ok(measured.overflows.length > 0, JSON.stringify(measured.overflows));
  // Field overflows name the person; a page-level layout overflow is reported with the page's first source.
  assert.ok(measured.overflows.filter(item => item.field !== 'layout').every(item => item.slide_index === 2), JSON.stringify(measured.overflows));
  assert.ok(measured.overflows.some(item => item.field === 'city' && item.slide_index === 2));
});
