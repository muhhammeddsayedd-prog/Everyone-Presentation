import assert from 'node:assert/strict';
import test from 'node:test';
import { renderReviewDocument, REVIEW_FIELD_LABELS } from '../../packages/templates/src/render.ts';
import { slideWordingFields } from '../../packages/domain/src/casting-types.ts';
import type { WorkspaceReview } from '../../packages/domain/src/review-types.ts';

const fields = Object.fromEntries(slideWordingFields.map(key => [key, key === 'name_or_id' ? '<script>unsafe</script>' : 'Not provided']));
const review = { cover: { project_name: 'Test', client_name: null, title: 'Cast Selection', output_type: 'selection', logo_asset_id: null, logo_placement: 'cover' },
  slides: [{ kind: 'candidate', role_name: 'Father', slot_label: 'Father 1', position: 'option', fields, frames: [] },
    { kind: 'pending', role_name: 'Manager', slot_label: 'Manager 1', requirements: { languages: ['Arabic'], skills: [], age_range: null, gender_requirement: null } }],
} as unknown as WorkspaceReview;
test('template retains all ten fields, missing-image honesty and one page per assignment or Pending slot', () => {
  const html = renderReviewDocument(review);
  assert.equal(Object.keys(REVIEW_FIELD_LABELS).length, 10);
  assert.equal((html.match(/data-page-index=/gu) ?? []).length, 3);
  for (const key of slideWordingFields) assert.match(html, new RegExp('data-fit-field="' + key + '"'));
  assert.match(html, /Image not provided/u); assert.match(html, /Pending/u); assert.match(html, /Not provided/u);
  assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/u); assert.doesNotMatch(html, /<script>/u);
});
test('template rejects an external font or image source and never hides overflow', () => {
  assert.throws(() => renderReviewDocument(review, { fontFaces: [{ family: 'Latin', weight: 400, source: 'https://untrusted.invalid/font' }] }));
  assert.throws(() => renderReviewDocument({ ...review, slides: [{ ...review.slides[0], frames: [{ asset_id: 'x' }] }] } as WorkspaceReview, { imageSources: { x: 'javascript:alert(1)' } }));
  const html = renderReviewDocument(review); assert.doesNotMatch(html, /text-overflow:ellipsis|overflow:hidden/u);
});
