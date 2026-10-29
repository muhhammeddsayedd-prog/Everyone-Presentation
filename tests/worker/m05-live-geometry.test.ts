import assert from 'node:assert/strict';
import test from 'node:test';
import { nativePresentation } from './presentation-native-fixture.ts';
import { renderPresentationPdf } from '../../apps/worker/src/presentation-pdf.ts';
import { validateDownloadedPdfWithoutImageBodies } from '../../tools/m05-live-geometry.mts';

test('offline live-inspection geometry mode validates exact text/links and actual image operators without receiving source image bodies', { timeout: 120000 }, async () => {
  const { snapshot, images } = nativePresentation([1, 2, 3], true, 'role');
  const rendered = await renderPresentationPdf(snapshot, images);
  // The separate inspector receives only the frozen snapshot and actual PDF.
  const proof = await validateDownloadedPdfWithoutImageBodies(snapshot, rendered.bytes);
  assert.equal(proof.page_count, 5); assert.equal(proof.video_links_checked, 3); assert.equal(proof.image_draws_checked, 11);
  const wrong = structuredClone(snapshot); wrong.render_configuration.application_origin = 'https://untrusted.invalid';
  await assert.rejects(validateDownloadedPdfWithoutImageBodies(wrong, rendered.bytes));
});
