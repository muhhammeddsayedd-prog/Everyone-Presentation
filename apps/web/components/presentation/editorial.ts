import type { WorkspaceReview } from '../../../../packages/domain/src/review-types';
import editorialRegistry from '../../../../packages/templates/versions/1.2.0/registry.json';
import slotRegistry from '../../../../packages/templates/versions/1.3.0/registry.json';
import referenceRegistry from '../../../../packages/templates/versions/1.4.0/registry.json';
import { composeCastingDeck as composeEditorial } from '../../../../packages/templates/versions/1.2.0/compose-casting';
import { composeCastingDeck as composeSlots } from '../../../../packages/templates/versions/1.3.0/compose-casting';
import { composeCastingDeck as composeReference } from '../../../../packages/templates/versions/1.4.0/compose-casting';
import type { Deck, EditorialTemplate } from '../EditorialSlide';

type DeckInput = Pick<WorkspaceReview, 'cover' | 'slides' | 'output_type' | 'presentation'>;
/** Each composer ignores options it does not use (1.4.0 adds the version number to its cover title). */
type Options = Parameters<typeof composeEditorial>[1] & { versionNumber?: number };
/** Registered Everyone Film editorial templates a saved version can carry, each with its own composer. */
const TEMPLATES: { registry: typeof editorialRegistry; version: EditorialTemplate; compose: (review: DeckInput, options?: Options) => Deck }[] = [
  { registry: editorialRegistry, version: '1.2.0', compose: composeEditorial },
  { registry: slotRegistry, version: '1.3.0', compose: composeSlots },
  { registry: referenceRegistry, version: '1.4.0', compose: (review, options) => composeReference(review, options) as unknown as Deck },
];
/** The editorial template matching a saved identity exactly (key, version and content hash), if any. */
export function editorialTemplateOf(identity: { key?: string; version?: string; content_sha256?: string } | null | undefined) {
  return TEMPLATES.find(item => identity?.key === item.registry.key && identity.version === item.registry.version && identity.content_sha256 === item.registry.content_sha256) ?? null;
}
/** Layouts that show a captured slide (the cover, a person or a Pending page), as opposed to dividers and the closing page. */
const SLIDE_LAYOUTS = ['cover_floward', 'cast_detail', 'cast_group_detail', 'cast_pending'];
/** 1.4.0 portrait pages (they always name their sources; 1.2.0 overview pages of the same layout names do not). */
const PORTRAIT_LAYOUTS = ['cast_main_backup', 'cast_group_strip', 'cast_single'];
/** Pages that show captured slide `order` (0 = cover). In 1.3.0 a slot page shows up to three slides. */
export function pagesForSlide(deck: Deck, order: number) {
  return (deck.pages as { index: number; layout: string; source_index: number; sources?: number[] }[])
    .filter(page => (SLIDE_LAYOUTS.includes(page.layout) || PORTRAIT_LAYOUTS.includes(page.layout) && page.sources !== undefined) && (page.sources ?? [page.source_index]).includes(order)).map(page => page.index);
}
