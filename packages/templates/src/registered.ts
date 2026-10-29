import type { WorkspaceReview } from '../../domain/src/review-types.ts';
import { renderReviewDocument as legacyRender, type TemplateAssets } from './render.ts';
import { renderReviewDocument as completeRender } from '../versions/1.1.0/render.ts';
import legacyRegistry from '../registry.json';
import completeRegistry from '../versions/1.1.0/registry.json';

/** Retain historical implementations. New registrations never rewrite an old
 * version's CSS, brand color, page fields or saved content. */
export function renderRegisteredReviewDocument(review: WorkspaceReview, assets: TemplateAssets = {}) {
  const registry = review.template.version === '1.0.0' ? legacyRegistry : review.template.version === '1.1.0' ? completeRegistry : null;
  if (!registry || review.template.key !== registry.key || review.template.content_sha256 !== registry.content_sha256 || review.template.font_key !== registry.font_key) throw new Error('TEMPLATE_VERSION_UNAVAILABLE');
  return (registry.version === '1.0.0' ? legacyRender : completeRender)(review, assets);
}
