import assert from 'node:assert/strict';
import test from 'node:test';
import { nativePresentation } from './presentation-native-fixture.ts';
import { renderPresentationExportPdf, renderPresentationPdf } from '../../apps/worker/src/presentation-pdf.ts';
import { validateDownloadedGuestPdfWithoutImageBodies } from '../../tools/m06-live-geometry.mts';

test('actual offline guest PDF inspection verifies frozen text, image geometry and grant URLs without source image bodies', { timeout: 120000 }, async () => {
  const { snapshot, images } = nativePresentation([1, 2, 3], true, 'role');
  const access = { version_id: snapshot.version_id, grant_token: 'q'.repeat(43) };
  const rendered = await renderPresentationExportPdf(snapshot, images, access);
  const proof = await validateDownloadedGuestPdfWithoutImageBodies(snapshot, rendered.bytes, access);
  assert.equal(proof.page_count, 5); assert.equal(proof.video_links_checked, 3); assert.equal(proof.image_draws_checked, 11);
  const canonical = await renderPresentationPdf(snapshot, images);
  await assert.rejects(validateDownloadedGuestPdfWithoutImageBodies(snapshot, canonical.bytes, access));
  await assert.rejects(validateDownloadedGuestPdfWithoutImageBodies(snapshot, rendered.bytes, { ...access, grant_token: 'x'.repeat(43) }));
  const changed = structuredClone(snapshot); changed.slides[1].fields!.name_or_id = 'Changed frozen fact';
  await assert.rejects(validateDownloadedGuestPdfWithoutImageBodies(changed, rendered.bytes, access));
});
