'use client';

import { useMemo } from 'react';
import type { WorkspaceReview } from '../../../../packages/domain/src/review-types';
import { deckAssetIds, useEditorialAssets, type AssetFetch, type LoadedAsset } from '../EditorialSlide';
import { stageDeck, type StageDeck } from './stage-pages';
import { renderDeck, type RenderedDeck } from './StageSlide';

const NO_ASSETS: Record<string, LoadedAsset> = {};
export const fetchWorkspaceMedia: AssetFetch = (id, signal) => fetch(`/api/v1/media/${encodeURIComponent(id)}/content`, { cache: 'no-store', signal, headers: { Accept: 'image/*' } });
const EMPTY: RenderedDeck = { css: '', count: 0, page: () => '' };

/** A server review (or a preview of one) on the stage, with the registered template's own markup.
 * 1.2.0 images are read once into object URLs; 1.0/1.1 pages reference the private media route directly. */
export function useStageDeck(review: WorkspaceReview | null) {
  const built = useMemo(() => {
    if (!review) return { deck: null, error: '' };
    try { return { deck: stageDeck(review), error: '' }; }
    catch { return { deck: null, error: 'This template cannot be shown in the Studio. The server review and saved PDFs are unaffected.' }; }
  }, [review]);
  const deck: StageDeck | null = built.deck;
  const ids = useMemo(() => deck?.template === '1.2.0' ? [...new Set(deckAssetIds(deck.deck))].sort() : [], [deck]);
  const { assets, failed } = useEditorialAssets(ids, fetchWorkspaceMedia);
  const rendered = useMemo(() => {
    if (!deck) return { rendered: EMPTY, error: '' };
    try { return { rendered: renderDeck(deck, deck.template === '1.2.0' ? assets : NO_ASSETS), error: '' }; }
    catch { return { rendered: EMPTY, error: 'This template cannot be shown in the Studio. The server review and saved PDFs are unaffected.' }; }
  }, [deck, assets]);
  return { deck: rendered.error ? null : deck, rendered: rendered.rendered, failed, error: built.error || rendered.error };
}
