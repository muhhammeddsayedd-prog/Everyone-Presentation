import type { WorkspaceReview } from '../../../domain/src/review-types.ts';
import { composeCastingDeck, type CastingDeckOptions } from './compose-casting.ts';
import { renderDeckDocument, type DeckAssets } from './html.ts';

export type TemplateAssets = DeckAssets & CastingDeckOptions;
/** Registered 1.4.1 entry point with the same contract as earlier versions:
 * captured review data in, one complete print document out. */
export function renderReviewDocument(review: WorkspaceReview, assets: TemplateAssets = {}) {
  return renderDeckDocument(composeCastingDeck(review, assets), assets);
}
