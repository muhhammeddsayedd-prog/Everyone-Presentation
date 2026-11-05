import type { ReviewSlide, WorkspaceReview } from '../../../../packages/domain/src/review-types.ts';
import type { Deck } from '../../../../packages/templates/versions/1.2.0/deck.ts';
import { composeCastingDeck } from '../../../../packages/templates/versions/1.2.0/compose-casting.ts';
import { composeCastingDeck as composeSlotDeck } from '../../../../packages/templates/versions/1.3.0/compose-casting.ts';
import type { Deck as SlotDeck } from '../../../../packages/templates/versions/1.3.0/deck.ts';
import { focusMatches, type DraftFocus, type DraftResult } from './draft-review.ts';

/** One printed page of the draft, in print order, with the workspace record it shows (if any). */
export interface StagePage {
  index: number; key: string; label: string;
  kind: 'cover' | 'divider' | 'overview' | 'detail' | 'pending' | 'closing';
  slide: ReviewSlide | null;
  /** Every record drawn on the page (1.3.0 slot pages show up to three people). */
  slides?: ReviewSlide[];
}
export type StageDeck =
  | { template: '1.2.0'; review: DraftResult['review']; deck: Deck; pages: StagePage[] }
  | { template: '1.3.0'; review: DraftResult['review']; deck: SlotDeck; pages: StagePage[] }
  | { template: '1.0.0' | '1.1.0'; review: DraftResult['review']; pages: StagePage[] };

const slideLabel = (slide: ReviewSlide) => slide.kind === 'pending' ? `${slide.slot_id ? slide.slot_label : slide.role_name} · Pending` : slide.fields.name_or_id;
const slideKey = (slide: ReviewSlide) => slide.assignment_id ? `a:${slide.assignment_id}` : `p:${slide.slot_id ?? slide.role_id ?? 'requirements'}`;

/** 1.2.0 composes extra pages (category dividers, slot overviews, closing); 1.0/1.1 print a cover plus one page per slide. */
export function stageDeck(review: DraftResult['review']): StageDeck {
  if (review.template.version === '1.3.0') return slotStageDeck(review);
  if (review.template.version !== '1.2.0') {
    const pages: StagePage[] = [{ index: 0, key: 'cover', label: 'Cover', kind: 'cover', slide: null },
      ...review.slides.map((slide, n) => ({ index: n + 1, key: slideKey(slide), label: slideLabel(slide), kind: slide.kind === 'pending' ? 'pending' as const : 'detail' as const, slide }))];
    return { template: review.template.version as '1.0.0' | '1.1.0', review, pages };
  }
  const deck = composeCastingDeck(review as WorkspaceReview);
  const overviewCount = new Map<string, number>();
  const pages = deck.pages.map((page): StagePage => {
    const slide = page.layout === 'cover_floward' || page.layout === 'closing_thank_you' ? null : review.slides[page.source_index - 1] ?? null;
    if (page.layout === 'cover_floward') return { index: page.index, key: 'cover', label: 'Cover', kind: 'cover', slide: null };
    if (page.layout === 'closing_thank_you') return { index: page.index, key: 'closing', label: 'Thank you', kind: 'closing', slide: null };
    if (page.layout === 'section_divider') return { index: page.index, key: `d:${slide?.role_id ?? page.index}`, label: slide?.role_category ? `${slide.role_category} · Divider` : 'Divider', kind: 'divider', slide };
    if (page.layout === 'cast_main_backup' || page.layout === 'cast_group_strip') {
      const scope = slide?.slot_id ?? String(page.index); const n = (overviewCount.get(scope) ?? 0) + 1; overviewCount.set(scope, n);
      return { index: page.index, key: `o:${scope}:${n}`, label: slide ? `${slide.slot_label} · Overview` : 'Overview', kind: 'overview', slide };
    }
    return { index: page.index, key: slide ? slideKey(slide) : `x:${page.index}`, label: slide ? slideLabel(slide) : `Page ${page.index + 1}`, kind: slide?.kind === 'pending' ? 'pending' : 'detail', slide };
  });
  return { template: '1.2.0', review, deck, pages };
}

/** 1.3.0: one page per slot, its people side by side; a page lists every person it shows. */
function slotStageDeck(review: DraftResult['review']): StageDeck {
  const deck = composeSlotDeck(review as WorkspaceReview);
  const pages = deck.pages.map((page): StagePage => {
    if (page.layout === 'cover_floward') return { index: page.index, key: 'cover', label: 'Cover', kind: 'cover', slide: null };
    if (page.layout === 'closing_thank_you') return { index: page.index, key: 'closing', label: 'Thank you', kind: 'closing', slide: null };
    const slides = (page.sources ?? [page.source_index]).map(source => review.slides[source - 1]).filter((slide): slide is ReviewSlide => !!slide);
    const slide = slides[0] ?? null;
    if (page.layout === 'section_divider') return { index: page.index, key: `d:${slide?.role_id ?? page.index}`, label: slide?.role_category ? `${slide.role_category} · Divider` : 'Divider', kind: 'divider', slide, slides };
    const label = slides.length > 1 ? `${slide!.slot_label} · ${slides.map(item => item.fields.name_or_id).join(', ')}` : slide ? slideLabel(slide) : `Page ${page.index + 1}`;
    return { index: page.index, key: slides.length ? slides.map(slideKey).join('+') : `x:${page.index}`, label, kind: slide?.kind === 'pending' ? 'pending' : 'detail', slide, slides };
  });
  return { template: '1.3.0', review, deck, pages };
}

/** The page to show for a panel selection: the person's own page first, then the slot, then the first page of the role. */
export function pageForFocus(pages: StagePage[], focus: DraftFocus): number | null {
  const shows = (page: StagePage) => (page.slides ?? [page.slide]).some(slide => focusMatches(slide, focus));
  const own = pages.find(page => (page.kind === 'detail' || page.kind === 'pending' || page.kind === 'cover') && shows(page));
  if (own) return own.index;
  if (focus.kind === 'pool') return null;
  const any = pages.find(page => page.slide && shows(page));
  return any?.index ?? null;
}
