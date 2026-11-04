import assert from 'node:assert/strict';
import test from 'node:test';
import registry from '../../packages/templates/versions/1.2.0/registry.json';
import { reviewFromRenderSnapshot } from '../../packages/domain/src/presentation.ts';
import { renderPresentationPdf, validatePresentationPdf, PresentationPdfError } from '../../apps/worker/src/presentation-pdf.ts';
import { measureReviewFit, loadReviewTemplateAssets, ReviewFitError } from '../../apps/worker/src/review-fit.ts';
import { editorialExpectations } from '../../apps/worker/src/editorial-template.ts';
import { editorialPresentation } from '../fixtures/editorial-snapshot.ts';

test('1.2.0 registry pins General Sans, the placeholder and every renderer file', async () => {
  const pinned = await loadReviewTemplateAssets({ key: registry.key, version: registry.version, content_sha256: registry.content_sha256, font_key: registry.font_key });
  assert.equal(Object.keys(pinned.font_hashes).filter(file => file.includes('GeneralSans-')).length, 6);
  assert.equal(Object.keys(pinned.font_hashes).length, 9);
  await assert.rejects(loadReviewTemplateAssets({ key: registry.key, version: registry.version, content_sha256: 'f'.repeat(64), font_key: registry.font_key }), ReviewFitError);
  await assert.rejects(loadReviewTemplateAssets({ key: registry.key, version: registry.version, content_sha256: registry.content_sha256, font_key: registry.font_key },
    { read: async file => { const { readFile } = await import('node:fs/promises'); const bytes = await readFile(file); return file.endsWith('GeneralSans-Semibold.ttf') ? bytes.subarray(1) : bytes; } }), ReviewFitError);
});

test('1.2.0 PDF: 1440×810 pt pages, composed page count, every frame, placeholder, logo and fixed-version link validated', { timeout: 180000 }, async () => {
  const { snapshot, images } = editorialPresentation();
  const expected = editorialExpectations(reviewFromRenderSnapshot(snapshot));
  const result = await renderPresentationPdf(snapshot, images);
  assert.equal(result.proof.page_count, expected.page_count); assert.equal(result.proof.width_css_px, 1920); assert.equal(result.proof.height_css_px, 1080);
  assert.equal(result.proof.candidate_field_count, 40); assert.equal(result.proof.frame_draw_count, expected.frame_draw_count); assert.equal(result.proof.logo_draw_count, 1);
  assert.equal(result.proof.video_link_count, 4);
  // cover, divider, overview (Main+Backup), 4 candidate pages, divider, pending, closing
  assert.deepEqual(expected.deck.pages.map(page => page.layout), ['cover_floward', 'section_divider', 'cast_main_backup', 'cast_detail', 'cast_detail', 'cast_detail', 'cast_detail', 'section_divider', 'cast_pending', 'closing_thank_you']);
  const proof = await validatePresentationPdf(snapshot, images, result.bytes);
  assert.equal(proof.page_count, expected.page_count); assert.ok(Math.abs(proof.width_points - 1440) < 0.5); assert.ok(Math.abs(proof.height_points - 810) < 0.5);
  assert.equal(proof.text_regions_checked, expected.text_regions); assert.equal(proof.image_draws_checked, expected.image_draws); assert.equal(proof.video_links_checked, 4);
  assert.ok(proof.embedded_font_count > 0);
});

test('1.2.0 every-slide logo is an explicit deviation drawn on numbered pages only', { timeout: 180000 }, async () => {
  const { snapshot, images } = editorialPresentation('every_slide'); const expected = editorialExpectations(reviewFromRenderSnapshot(snapshot));
  assert.equal(expected.logo_draw_count, expected.page_count - 1);
  const result = await renderPresentationPdf(snapshot, images); assert.equal(result.proof.logo_draw_count, expected.page_count - 1);
});

test('1.2.0 swapped, missing or mislabelled image bytes never become a PDF', { timeout: 180000 }, async () => {
  for (const mode of ['missing', 'swapped'] as const) {
    const { snapshot, images } = editorialPresentation(); const frame = snapshot.slides[1].frames[0];
    if (mode === 'missing') images.delete(frame.asset_id); else images.set(frame.asset_id, images.get(snapshot.slides[4].frames[1].asset_id)!);
    await assert.rejects(renderPresentationPdf(snapshot, images), PresentationPdfError);
  }
});

test('1.2.0 fit measures the editorial layout and attributes overflow to the captured slide', { timeout: 180000 }, async () => {
  const { snapshot } = editorialPresentation(); const review = reviewFromRenderSnapshot(snapshot);
  // A draft review carries live row versions and pool IDs that a frozen review omits.
  review.slides.forEach((slide, n) => { if (slide.kind !== 'candidate') return; Object.assign(slide, { workspace_candidate_id: `pool-${n}`, candidate_media_id: slide.frames.length ? `media-${n}` : null, assignment_row_version: 1, workspace_candidate_row_version: 1, candidate_row_version: 1, review_status: 'reviewed' }); });
  review.unreviewed_candidate_ids = [];
  const clean = await measureReviewFit(review); assert.deepEqual(clean.overflows, []);
  review.slides[3].fields.skills_experience = 'Long synthetic wording '.repeat(20);
  const measured = await measureReviewFit(review);
  assert.ok(measured.overflows.some(item => item.slide_index === 4 && item.field === 'skills_experience' && item.axis === 'vertical'));
});
