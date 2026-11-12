import type { WorkspaceReview } from '../../../../packages/domain/src/review-types';
import editorialRegistry from '../../../../packages/templates/versions/1.2.0/registry.json';
import slotRegistry from '../../../../packages/templates/versions/1.3.0/registry.json';
import { composeCastingDeck as composeEditorial } from '../../../../packages/templates/versions/1.2.0/compose-casting';
import { composeCastingDeck as composeSlots } from '../../../../packages/templates/versions/1.3.0/compose-casting';
import type { Deck, EditorialTemplate } from '../EditorialSlide';

type DeckInput = Pick<WorkspaceReview, 'cover' | 'slides' | 'output_type'>;
type Options = Parameters<typeof composeEditorial>[1];
/** Registered Everyone Film editorial templates a saved version can carry, each with its own composer. */
const TEMPLATES: { registry: typeof editorialRegistry; version: EditorialTemplate; compose: (review: DeckInput, options?: Options) => Deck }[] = [
  { registry: editorialRegistry, version: '1.2.0', compose: composeEditorial },
  { registry: slotRegistry, version: '1.3.0', compose: composeSlots },
];
/** The editorial template matching a saved identity exactly (key, version and content hash), if any. */
export function editorialTemplateOf(identity: { key?: string; version?: string; content_sha256?: string } | null | undefined) {
  return TEMPLATES.find(item => identity?.key === item.registry.key && identity.version === item.registry.version && identity.content_sha256 === item.registry.content_sha256) ?? null;
}
/** Layouts that show a captured slide (the cover, a person or a Pending page), as opposed to dividers and the closing page. */
const SLIDE_LAYOUTS = ['cover_floward', 'cast_detail', 'cast_group_detail', 'cast_pending'];
/** Pages that show captured slide `order` (0 = cover). In 1.3.0 a slot page shows up to three slides. */
export function pagesForSlide(deck: Deck, order: number) {
  return (deck.pages as { index: number; layout: string; source_index: number; sources?: number[] }[])
    .filter(page => SLIDE_LAYOUTS.includes(page.layout) && (page.sources ?? [page.source_index]).includes(order)).map(page => page.index);
}
