import type { WorkspaceReview } from '../../../domain/src/review-types.ts';
import { composeCastingDeck, type CastingDeckOptions } from './compose-casting.ts';
import { renderDeckDocument, type DeckAssets } from './html.ts';

export { FIELD_LABELS as REVIEW_FIELD_LABELS, PENDING_LABELS as PENDING_REQUIREMENT_LABELS } from './compose-casting.ts';
export type TemplateAssets = DeckAssets & CastingDeckOptions;
/** Registered 1.3.0 entry point with the same contract as earlier versions:
 * captured review data in, one complete print document out. */
export function renderReviewDocument(review: WorkspaceReview, assets: TemplateAssets = {}) {
  return renderDeckDocument(composeCastingDeck(review, assets), assets);
}
