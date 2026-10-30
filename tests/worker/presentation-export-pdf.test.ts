import assert from 'node:assert/strict';
import test from 'node:test';
import * as pdf from '../../apps/worker/src/presentation-pdf.ts';
import { presentationCanonicalHash } from '../../packages/domain/src/presentation.ts';
import { nativePresentation } from './presentation-native-fixture.ts';

const access = { version_id: 'a5050000-0000-4000-8000-000000000004', grant_token: 'g'.repeat(43) };

test('guest PDF links bind only the original frozen version and its retained video inventory', () => {
  const { snapshot } = nativePresentation([1], false);
  const value = { ...access, version_id: snapshot.version_id };
  const video = snapshot.slides.find(slide => slide.video_asset_id)!.video_asset_id!;
  assert.equal(pdf.presentationExportVideoHref(snapshot, video, value), `${snapshot.render_configuration.application_origin}/m/${value.grant_token}/versions/${snapshot.version_id}/media/${video}`);
  for (const changed of [{ ...value, version_id: access.version_id }, { ...value, grant_token: 'short' }, { ...value, grant_token: `${'x'.repeat(42)}/` }, { ...value, extra: true }]) {
    assert.throws(() => pdf.presentationExportVideoHref(snapshot, video, changed), pdf.PresentationPdfError);
  }
  assert.throws(() => pdf.presentationExportVideoHref(snapshot, snapshot.slides[0].id, value), pdf.PresentationPdfError);
});

test('real guest PDF keeps exact frozen text/images/layout and replaces only media access URLs', { timeout: 120000 }, async () => {
  const { snapshot, images } = nativePresentation([1], true);
  const before = await presentationCanonicalHash(snapshot);
  const value = { ...access, version_id: snapshot.version_id };
  const canonical = await pdf.renderPresentationPdf(snapshot, images);
  const variant = await pdf.renderPresentationExportPdf(snapshot, images, value);
  const checked = await pdf.validatePresentationExportPdf(snapshot, images, variant.bytes, value);
  assert.equal(checked.page_count, snapshot.slides.length);
  assert.equal(checked.video_links_checked, canonical.proof.video_link_count);
  assert.equal(checked.image_draws_checked, canonical.proof.frame_draw_count + canonical.proof.logo_draw_count);
  assert.equal(variant.proof.page_count, canonical.proof.page_count);
  assert.equal(variant.proof.candidate_field_count, canonical.proof.candidate_field_count);
  assert.equal(variant.proof.frame_draw_count, canonical.proof.frame_draw_count);
  assert.equal(variant.proof.template_content_sha256, canonical.proof.template_content_sha256);
  assert.deepEqual(variant.proof.font_hashes, canonical.proof.font_hashes);
  assert.notEqual(variant.proof.link_targets_sha256, canonical.proof.link_targets_sha256);
  assert.equal(await presentationCanonicalHash(snapshot), before);
  await assert.rejects(pdf.validatePresentationPdf(snapshot, images, variant.bytes), pdf.PresentationPdfError);
  await assert.rejects(pdf.validatePresentationExportPdf(snapshot, images, canonical.bytes, value), pdf.PresentationPdfError);
});

test('even a no-video export requires an explicit valid fixed-version grant', async () => {
  const { snapshot, images } = nativePresentation([], false, 'role');
  for (const value of [undefined, null, {}, { version_id: snapshot.version_id, grant_token: 'short' }]) {
    await assert.rejects(pdf.renderPresentationExportPdf(snapshot, images, value as never), pdf.PresentationPdfError);
  }
});
