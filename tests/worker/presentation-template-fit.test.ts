import assert from 'node:assert/strict';
import test from 'node:test';
import { measureReviewFit, loadReviewTemplateAssets } from '../../apps/worker/src/review-fit.ts';
import { reviewFromRenderSnapshot } from '../../packages/domain/src/presentation.ts';
import { nativePresentation } from './presentation-native-fixture.ts';
import legacyRegistry from '../../packages/templates/registry.json';
import { renderReviewDocument } from '../../packages/templates/versions/1.1.0/render.ts';
test('new1.1 default public brand path renders without a native data-URI override', () => {
  const { snapshot } = nativePresentation([], false, 'role'); const review = reviewFromRenderSnapshot(snapshot);
  const html = renderReviewDocument(review); assert.ok(html.includes('src="/brand/everyone-logotype-white.svg"')); assert.ok(html.includes('data-fit-field="role_category"')); assert.ok(html.includes('data-fit-field="requirements.other_instructions"'));
});
test('multi-version loader retains 1.0.0 and loads separately registered 1.1.0 white brand', async () => {
  const old = await loadReviewTemplateAssets({ key: legacyRegistry.key, version: legacyRegistry.version, content_sha256: legacyRegistry.content_sha256, font_key: legacyRegistry.font_key });
  const { snapshot } = nativePresentation([], true, 'role'); const current = await loadReviewTemplateAssets(snapshot.template);
  assert.notEqual(current.assets.brandLogo, old.assets.brandLogo); assert.deepEqual(current.font_hashes, old.font_hashes);
});
test('actual1.1 font/geometry fit checks all Pending values and reports the specific overflowing requirement', { timeout: 120000 }, async () => {
  const { snapshot } = nativePresentation([], true, 'role'); const review = reviewFromRenderSnapshot(snapshot); const fit = await measureReviewFit(review); assert.deepEqual(fit.overflows, []);
  review.slides[0].requirements.other_instructions = 'Long instructions requiring a wording correction. '.repeat(50);
  const overflow = await measureReviewFit(review); assert.ok(overflow.overflows.some(row => row.field === 'requirements.other_instructions' && row.axis === 'vertical' && row.overflow_px > 0));
});
