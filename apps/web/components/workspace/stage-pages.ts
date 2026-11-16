import type { PresentationScene, ReviewSlide, WorkspaceReview } from '../../../../packages/domain/src/review-types.ts';
import type { Deck } from '../../../../packages/templates/versions/1.2.0/deck.ts';
import { composeCastingDeck } from '../../../../packages/templates/versions/1.2.0/compose-casting.ts';
import { composeCastingDeck as composeSlotDeck } from '../../../../packages/templates/versions/1.3.0/compose-casting.ts';
import type { Deck as SlotDeck } from '../../../../packages/templates/versions/1.3.0/deck.ts';
import { composeCastingDeck as composeReferenceDeck } from '../../../../packages/templates/versions/1.4.0/compose-casting.ts';
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
  | { template: '1.3.0' | '1.4.0'; review: DraftResult['review']; deck: SlotDeck; pages: StagePage[] }
  | { template: '1.0.0' | '1.1.0'; review: DraftResult['review']; pages: StagePage[] };

const slideLabel = (slide: ReviewSlide) => slide.kind === 'pending' ? `${slide.slot_id ? slide.slot_label : slide.role_name} · Pending` : slide.fields.name_or_id;
const slideKey = (slide: ReviewSlide) => slide.assignment_id ? `a:${slide.assignment_id}` : `p:${slide.slot_id ?? slide.role_id ?? 'requirements'}`;

/** 1.2.0 composes extra pages (category dividers, slot overviews, closing); 1.0/1.1 print a cover plus one page per slide. */
export function stageDeck(review: DraftResult['review']): StageDeck {
  if (review.template.version === '1.3.0' || review.template.version === '1.4.0') return slotStageDeck(review);
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

/** 1.3.0: one page per slot, its people side by side; 1.4.0: portrait pages of one to three people. A page lists every
 * person it shows; a person a scene repeats keeps one key per page. */
function slotStageDeck(review: DraftResult['review']): StageDeck {
  const reference = review.template.version === '1.4.0';
  const deck = (reference ? composeReferenceDeck(review as WorkspaceReview) : composeSlotDeck(review as WorkspaceReview)) as SlotDeck; const used = new Set<string>();
  const pages = deck.pages.map((page): StagePage => {
    if (page.layout === 'cover_floward') return { index: page.index, key: 'cover', label: 'Cover', kind: 'cover', slide: null };
    if (page.layout === 'closing_thank_you') return { index: page.index, key: 'closing', label: 'Thank you', kind: 'closing', slide: null };
    const slides = (page.sources ?? [page.source_index]).map(source => review.slides[source - 1]).filter((slide): slide is ReviewSlide => !!slide);
    const slide = slides[0] ?? null;
    if (page.layout === 'section_divider') {
      const title = reference ? page.elements.find(element => element.kind === 'text')?.text ?? null : null;
      return { index: page.index, key: `d:${reference ? page.index : slide?.role_id ?? page.index}`, label: title ? `${title} · Divider` : slide?.role_category ? `${slide.role_category} · Divider` : 'Divider', kind: 'divider', slide, slides };
    }
    const label = slides.length > 1 ? `${reference ? slide!.role_name : slide!.slot_label} · ${slides.map(item => item.fields.name_or_id).join(', ')}` : slide ? slideLabel(slide) : `Page ${page.index + 1}`;
    let key = slides.length ? slides.map(slideKey).join('+') : `x:${page.index}`; if (used.has(key)) key = `${key}#${page.index}`; used.add(key);
    return { index: page.index, key, label, kind: slide?.kind === 'pending' ? 'pending' : 'detail', slide, slides };
  });
  return { template: reference ? '1.4.0' : '1.3.0', review, deck, pages };
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

const cleanText = (value: string | null | undefined) => typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
/** The first page of a scene, for the Scene breakdown's focus. A view hint only: it reads the composed deck and never
 * changes it. In 1.4.0 the scene flow is re-walked exactly as `composeCastingDeck` walks it (same divider groups, same
 * once-per-group `auto` rule, `repeat`, `hidden`): the first scene of a divider group opens on its divider, a later
 * scene of a group on the first cast page it prints (else the shared divider). Without that structure (1.3.0, a
 * deck with no scenes) it is the first page that shows a role the scene prints. `null` when the scene prints nothing
 * (a proposed scene, or every role printed earlier with no divider), so the stage stays where it is. */
export function pageForScene(deck: StageDeck, sceneId: string, draftScenes: readonly PresentationScene[] = []): number | null {
  // 1.4.0 prints the scenes it captured; earlier templates have none, so the draft's scenes say which roles to look for.
  const scenes = deck.template === '1.4.0' ? deck.review.presentation?.scenes ?? [] : draftScenes;
  const scene = scenes.find(item => item.scene_id === sceneId); if (!scene) return null;
  const roleOf = (page: StagePage) => page.slide?.role_id ?? null;
  const shown = new Set(scene.occurrences.filter(item => item.deck_placement !== 'hidden').map(item => item.role_id));
  const fallback = () => deck.pages.find(page => (page.kind === 'detail' || page.kind === 'pending') && (page.slides ?? [page.slide]).some(slide => slide?.role_id && shown.has(slide.role_id)))?.index ?? null;
  if (deck.template !== '1.4.0') return fallback();
  const printedRoles = new Set(deck.review.slides.map(slide => slide.role_id).filter((id): id is string => id !== null));
  const groups: { sequence: string | null; scenes: PresentationScene[] }[] = [];
  for (const item of scenes) { const sequence = cleanText(item.sequence_label); const last = groups.at(-1); if (sequence && last?.sequence === sequence) last.scenes.push(item); else groups.push({ sequence, scenes: [item] }); }
  // Items (one per printed role appearance) per group, in print order; every item prints at least one page.
  const printed = new Set<string>(); const items: { scene: string; role: string }[][] = []; const itemsOfRole = new Map<string, number>();
  const scened = new Set(scenes.flatMap(item => item.occurrences.filter(o => o.deck_placement !== 'hidden' && printedRoles.has(o.role_id)).map(o => o.role_id)));
  for (const role of printedRoles) if (!scened.has(role)) itemsOfRole.set(role, 1);
  for (const group of groups) {
    const list: { scene: string; role: string }[] = [];
    for (const item of group.scenes) for (const occurrence of item.occurrences) {
      if (!printedRoles.has(occurrence.role_id) || occurrence.deck_placement === 'hidden') continue;
      if (occurrence.deck_placement === 'auto') { if (printed.has(occurrence.role_id)) continue; printed.add(occurrence.role_id); }
      list.push({ scene: item.scene_id, role: occurrence.role_id }); itemsOfRole.set(occurrence.role_id, (itemsOfRole.get(occurrence.role_id) ?? 0) + 1);
    }
    items.push(list);
  }
  const dividers = deck.pages.filter(page => page.kind === 'divider');
  if (dividers.length !== items.filter(list => list.length).length) return fallback();
  // A role's pages do not depend on where it prints, so each appearance has the same page count.
  const pagesOfRole = new Map<string, number>();
  for (const page of deck.pages) if ((page.kind === 'detail' || page.kind === 'pending') && roleOf(page)) pagesOfRole.set(roleOf(page)!, (pagesOfRole.get(roleOf(page)!) ?? 0) + 1);
  let divider = 0;
  for (let g = 0; g < groups.length; g++) {
    const list = items[g]; if (!list.length) { if (groups[g].scenes.some(item => item.scene_id === sceneId)) return null; continue; }
    const start = dividers[divider++].index;
    if (!groups[g].scenes.some(item => item.scene_id === sceneId)) continue;
    if (groups[g].scenes[0].scene_id === sceneId) return start;
    let cursor = start + 1;
    for (const item of list) {
      if (item.scene === sceneId) return deck.pages[cursor] && roleOf(deck.pages[cursor]) === item.role ? cursor : start;
      const count = (pagesOfRole.get(item.role) ?? 0) / (itemsOfRole.get(item.role) ?? 1);
      if (!Number.isInteger(count) || count < 1) return start;
      cursor += count;
    }
    return start;
  }
  return null;
}
