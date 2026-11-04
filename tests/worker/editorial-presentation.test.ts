import assert from 'node:assert/strict';
import test from 'node:test';
import registry from '../../packages/templates/versions/1.2.0/registry.json';
import { reviewFromRenderSnapshot } from '../../packages/domain/src/presentation.ts';
import { renderPresentationPdf, validatePresentationPdf, PresentationPdfError } from '../../apps/worker/src/presentation-pdf.ts';
import { measureReviewFit, loadReviewTemplateAssets, ReviewFitError } from '../../apps/worker/src/review-fit.ts';
import { editorialExpectations } from '../../apps/worker/src/editorial-template.ts';
import { editorialPresentation } from '../fixtures/editorial-snapshot.ts';
import type { JobEvent, JsonObject, StageLease } from '@eps/jobs';
import { executeReviewFitStage } from '../../apps/worker/src/review-fit-stage-executor.ts';
import type { ReviewFitMeasurement } from '../../apps/worker/src/review-fit.ts';
import type { ReviewStageGateway } from '../../apps/worker/src/review-stage-executor.ts';
import { executePresentationStage } from '../../apps/worker/src/presentation-stage-executor.ts';
import type { PresentationArtifact, PresentationStageAssets } from '../../apps/worker/src/presentation-assets.ts';
import { presentationCanonicalHash, manifestFromSnapshot } from '../../packages/domain/src/presentation.ts';

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

test('1.2.0 fit through the real stage executor: nine-font measurement is published, a 1.1.0 font set is refused', { timeout: 180000 }, async () => {
  const { snapshot } = editorialPresentation(); const review = reviewFromRenderSnapshot(snapshot);
  review.slides.forEach((slide, n) => { if (slide.kind !== 'candidate') return; Object.assign(slide, { workspace_candidate_id: `pool-${n}`, candidate_media_id: slide.frames.length ? `media-${n}` : null, assignment_row_version: 1, workspace_candidate_row_version: 1, candidate_row_version: 1, review_status: 'reviewed' }); });
  review.unreviewed_candidate_ids = []; review.fit = { status: 'unmeasured', input_fingerprint: null, measured_at: null, overflows: [], error_code: 'FIT_MEASUREMENT_REQUIRED' };
  const draft = structuredClone(review) as Partial<typeof review>; delete draft.fit;
  const input = { schema_version: '1.0', workspace_id: review.workspace_id, series_id: review.series_id, expected_input_fingerprint: review.input_fingerprint,
    template: review.template, configuration: { renderer_version: 'everyone-casting-fit-v1' }, input_hash: 'b'.repeat(64) };
  const run = async (measure?: Parameters<typeof executeReviewFitStage>[2]['measure']) => {
    const lease: StageLease = { job_id: 'synthetic-job', attempt_id: 'synthetic-attempt', stage: 'measure_review_fit', lease_token: 'synthetic-lease',
      lease_expires_at: new Date(Date.now() + 90000).toISOString(), already_completed: false, input: structuredClone(input) as unknown as JsonObject };
    const events: JobEvent[] = [];
    const gateway: ReviewStageGateway = {
      async getInput() { return { ...structuredClone(input), job_id: lease.job_id, attempt_id: lease.attempt_id, stage: lease.stage, review: structuredClone(draft) }; },
      async recordEvent(event) { events.push(structuredClone(event)); return { event_id: event.event_id, applied: true, duplicate: false, stale: false, job_status: event.event_type === 'succeeded' ? 'succeeded' : 'running' }; },
    };
    return { result: await executeReviewFitStage(lease, gateway, measure ? { measure } : {}), events };
  };
  const { events } = await run();
  assert.equal(events.at(-1)?.event_type, 'succeeded'); assert.equal(Object.keys((events.at(-1)?.result as { font_hashes: object }).font_hashes).length, 9);
  const legacyFonts = Object.fromEntries(['IBMPlexSans-Regular', 'IBMPlexSans-Medium', 'IBMPlexSans-SemiBold', 'IBMPlexSansArabic-Regular', 'IBMPlexSansArabic-Medium', 'IBMPlexSansArabic-SemiBold'].map(name => [`apps/web/public/fonts/${name}.woff2`, 'a'.repeat(64)]));
  const real = (events.at(-1)?.result ?? {}) as unknown as ReviewFitMeasurement;
  await assert.rejects(run(async () => ({ ...real, font_hashes: legacyFonts })), { code: 'STAGE_INPUT_INVALID' });
});

test('1.2.0 presentation through the real stage executor: prepare, render, validate and publish all succeed', { timeout: 240000 }, async () => {
  const { snapshot, images } = editorialPresentation(); const expected = editorialExpectations(reviewFromRenderSnapshot(snapshot));
  const stages = ['prepare_presentation', 'render_presentation', 'validate_presentation', 'publish_presentation'];
  const small = { schema_version: '1.0', workspace_id: snapshot.workspace_id, series_id: snapshot.series_id, version_id: snapshot.version_id,
    snapshot_sha256: await presentationCanonicalHash(snapshot), manifest_sha256: await presentationCanonicalHash(manifestFromSnapshot(snapshot)), inventory_sha256: await presentationCanonicalHash(snapshot.asset_inventory), configuration: snapshot.render_configuration };
  const input = { ...small, input_hash: await presentationCanonicalHash(small) }; const outputs: Record<string, JsonObject | null> = { prepared: null, rendered: null, validated: null };
  const events: JobEvent[] = []; const files = new Map<string, Uint8Array>(); let writes = 0;
  const assets: PresentationStageAssets = {
    async read(_scope, asset) { const bytes = 'asset_kind' in asset ? images.get(asset.asset_id) : files.get(asset.asset_id); assert.ok(bytes); return bytes; },
    async write(_scope, value): Promise<PresentationArtifact> { const asset_id = `a5060000-0000-4000-8000-${String(950 + writes++).padStart(12, '0')}`; files.set(asset_id, new Uint8Array(value.bytes)); return { asset_id, sha256: value.sha256, size_bytes: value.bytes.length, mime_type: value.purpose === 'presentation_pdf' ? 'application/pdf' : 'application/json' }; },
  };
  for (let n = 0; n < 4; n++) {
    const lease: StageLease = { job_id: 'a5060000-0000-4000-8000-000000000900', attempt_id: `a5060000-0000-4000-8000-${String(910 + n).padStart(12, '0')}`, stage: stages[n], lease_token: 'b'.repeat(64), lease_expires_at: new Date(Date.now() + 90000).toISOString(), already_completed: false, input: structuredClone(input) as JsonObject };
    const gateway = { async getInput() { return { ...structuredClone(input), job_id: lease.job_id, attempt_id: lease.attempt_id, stage: lease.stage, snapshot: structuredClone(snapshot), ...structuredClone(outputs) }; },
      async recordEvent(event: JobEvent) { events.push(event); return { event_id: event.event_id, applied: true, duplicate: false, stale: false, job_status: event.stage === 'publish_presentation' ? 'succeeded' as const : 'running' as const }; } };
    const response = await executePresentationStage(lease, gateway, { assets }); assert.equal(response.receipt?.applied, true, stages[n]);
    assert.equal(events.at(-1)!.event_type, 'succeeded', stages[n]); if (n < 3) outputs[['prepared', 'rendered', 'validated'][n]] = structuredClone(events.at(-1)!.result!);
  }
  const result = events.at(-1)!.result!; assert.equal(result.validation_passed, true); assert.equal(result.page_count, expected.page_count); assert.equal(result.template_version, '1.2.0');
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
