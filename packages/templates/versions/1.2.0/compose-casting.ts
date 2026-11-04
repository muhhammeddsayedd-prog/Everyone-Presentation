import type { ReviewSlide, WorkspaceReview } from '../../../domain/src/review-types.ts';
import { slideWordingFields, type SlideWordingField } from '../../../domain/src/casting-types.ts';
import type { Deck, DeckElement, DeckPage, ImageSource, LayoutId } from './deck.ts';
import { arrangeFrames, box, castPortraits, closing, coverFloward, DETAIL_MEDIA_ZONE, EVERY_SLIDE_LOGO, fieldGrid, header, image, lineBox, note, pageNumber, sectionDivider, text, type Portrait } from './layouts.ts';

export const FIELD_LABELS: Record<SlideWordingField, string> = {
  name_or_id: 'Name / Casting ID', age_or_range: 'Age / Age range', height_measurements: 'Height / Measurements',
  languages_accents: 'Languages / Accents', skills_experience: 'Skills / Experience', city: 'City / Location',
  previous_projects_roles: 'Previous projects / Roles', classification: 'Cast category', availability: 'Project availability', presentation_notes: 'Presentation notes',
};
export const PENDING_LABELS = {
  role_category: 'Cast category', age_range: 'Age / Age range', gender_requirement: 'Gender requirement', appearance_performance: 'Appearance / Performance',
  languages: 'Languages', accents: 'Accents', skills: 'Skills', scene_references: 'Scene references', shoot_dates: 'Shoot dates',
  location: 'Location', availability_requirements: 'Availability requirements', other_instructions: 'Other instructions',
} as const;
export const POSITION_LABELS = { main: 'Main', backup: 'Backup', option: 'Option' } as const;
/** Slot overview pages hold up to three portraits, the largest source pattern. */
export const OVERVIEW_PORTRAITS = 3;

export interface CastingDeckOptions { versionLabel?: string; dateLabel?: string | null; logoNatural?: readonly [number, number] }

/** Frozen, timezone-independent cover date (UTC calendar day of capture). */
export function editorialDateLabel(iso: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: '2-digit' }).format(new Date(iso));
}
/** Trailing full stop is a deliberate style feature (design.md §5.3). */
export function sentence(value: string) { const trimmed = value.trim(); return /[.!?…:]$/u.test(trimmed) ? trimmed : `${trimmed}.`; }
const asset = (asset_id: string): ImageSource => ({ type: 'asset', asset_id });
const category = (slide: ReviewSlide) => slide.role_category?.trim() || null;
/** Split n portraits into ceil(n/3) pages whose sizes differ by at most one. */
export function overviewChunks<T>(items: T[]): T[][] {
  const pages = Math.ceil(items.length / OVERVIEW_PORTRAITS); const result: T[][] = []; let start = 0;
  for (let n = 0; n < pages; n++) { const size = Math.ceil((items.length - start) / (pages - n)); result.push(items.slice(start, start + size)); start += size; }
  return result;
}

/** Deterministic Everyone Film casting deck from captured review data only:
 * cover → (category divider) → per slot: overview of 2+ candidates → one page per
 * candidate (all ten fields) or pending slot → THANK YOU!. No data is invented;
 * empty facts stay "Not provided" and missing images use the source silhouette. */
export function composeCastingDeck(review: Pick<WorkspaceReview, 'cover' | 'slides' | 'output_type'>, options: CastingDeckOptions = {}): Deck {
  const heading = review.output_type === 'shortlist' ? 'Cast Shortlist.' : 'Cast Selection.';
  const logo = review.cover.logo_asset_id; const everySlideLogo = Boolean(logo) && review.cover.logo_placement === 'every_slide';
  const pages: Omit<DeckPage, 'index' | 'number'>[] = [];
  const dateLine = [options.dateLabel, options.versionLabel ?? 'Draft preview'].filter(Boolean).join(' | ');
  pages.push({ layout: 'cover_floward', source_index: 0, elements: coverFloward({
    title: sentence(`${review.cover.project_name} | ${review.cover.title}`), date: dateLine, titleFit: 'project_name',
    client: logo ? asset(logo) : null, clientName: logo ? null : review.cover.client_name }) });
  const content = (layout: LayoutId, source_index: number, subtitle: string | null, elements: DeckElement[]) =>
    pages.push({ layout, source_index, elements: [...header(heading, subtitle, { width: everySlideLogo ? 1580 : undefined, subtitleFit: 'role_name' }), ...elements] });
  const path = (slide: ReviewSlide) => sentence(slide.slot_id ? `${slide.role_name} | ${slide.slot_label}` : slide.role_name);

  let previousCategory: string | null = null; let previousRole: string | null | undefined;
  for (let n = 0; n < review.slides.length; n++) {
    const slide = review.slides[n]; const source = n + 1;
    if (slide.role_id !== previousRole || previousRole === null) {
      const current = category(slide);
      if (current && current !== previousCategory) pages.push({ layout: 'section_divider', source_index: source, elements: sectionDivider(sentence(current), 'role_category') });
      previousCategory = current; previousRole = slide.role_id;
    }
    const slotStart = slide.slot_id && (n === 0 || review.slides[n - 1].slot_id !== slide.slot_id);
    if (slotStart) {
      const group: { slide: ReviewSlide; source: number }[] = [];
      for (let m = n; m < review.slides.length && review.slides[m].slot_id === slide.slot_id && review.slides[m].kind === 'candidate'; m++) group.push({ slide: review.slides[m], source: m + 1 });
      // Status labels are decided per slot so every overview page of a slot reads alike.
      const labels = group.some(item => item.slide.position === 'main' || item.slide.position === 'backup');
      if (group.length >= 2) for (const chunk of overviewChunks(group)) {
        const portraits: Portrait[] = chunk.map(({ slide: item }) => ({ source: item.frames[0] ? asset(item.frames[0].asset_id) : null, natural: item.frames[0] ? [item.frames[0].width, item.frames[0].height] : undefined,
          alt: item.frames[0] ? `${item.fields.name_or_id}, selected source frame` : `${item.fields.name_or_id}, image not provided`, label: item.position ? POSITION_LABELS[item.position] : null, name: item.fields.name_or_id, nameFit: 'name_or_id' }));
        content(labels ? 'cast_main_backup' : 'cast_group_strip', chunk[0].source, path(slide), castPortraits(portraits, { labels }));
      }
    }
    if (slide.kind === 'candidate') content('cast_detail', source, path(slide), candidateDetail(slide));
    else content('cast_pending', source, path(slide), pendingDetail(slide));
  }
  pages.push({ layout: 'closing_thank_you', source_index: review.slides.length, elements: closing() });

  const last = pages.length - 1;
  return { canvas: { width: 1920, height: 1080 }, title: sentence(`${review.cover.project_name} | ${review.cover.title}`), pages: pages.map((page, index) => {
    const numbered = index !== 0 && index !== last; const number = numbered ? index + 1 : null;
    const elements = [...page.elements];
    if (numbered && everySlideLogo) elements.push(image(EVERY_SLIDE_LOGO, asset(logo!), 'Client logo', 'logo', { fit: 'contain', align: 'right', natural: options.logoNatural }));
    if (number !== null) elements.push(pageNumber(number));
    if (index === 0 && logo) for (const element of elements) if (element.kind === 'image' && element.role === 'logo' && options.logoNatural) element.natural = options.logoNatural;
    return { ...page, index, number, elements };
  }) };
}

function candidateDetail(slide: ReviewSlide): DeckElement[] {
  const elements: DeckElement[] = [];
  const frames = arrangeFrames(slide.frames.map(frame => [frame.width, frame.height] as const));
  const span = frames.length ? [Math.min(...frames.map(f => f[0])), Math.max(...frames.map(f => f[0] + f[2]))] : [DETAIL_MEDIA_ZONE[0] + 253, DETAIL_MEDIA_ZONE[0] + 717];
  const top = frames.length ? Math.min(...frames.map(f => f[1])) : 367;
  if (slide.position) elements.push(text(box(span[0], top - 62, span[1] - span[0], lineBox('castStatus')), 'castStatus', POSITION_LABELS[slide.position], { align: 'center' }));
  if (frames.length) slide.frames.forEach((frame, n) => elements.push(image(frames[n], asset(frame.asset_id), `Selected source frame ${n + 1} of ${slide.frames.length}`, 'frame', { natural: [frame.width, frame.height] })));
  else elements.push(image(box(span[0], 367, 464, 498), { type: 'static', key: 'casting_placeholder' }, 'Image not provided', 'placeholder'),
    text(box(span[0] - 100, 883, 664, lineBox('caption')), 'caption', 'Image not provided', { align: 'center' }));
  elements.push(...fieldGrid(slideWordingFields.map(key => ({ label: FIELD_LABELS[key], value: slide.fields[key] || 'Not provided', fit: key })), 5, 3));
  elements.push(slide.video_asset_id ? { kind: 'link', box: box(34.1, 1040.3, 700, lineBox('link')), style: 'link', text: 'Watch original introduction', target: { type: 'video', asset_id: slide.video_asset_id } }
    : text(box(34.1, 1040.3, 700, lineBox('linkMissing')), 'linkMissing', 'Video not provided'));
  return elements;
}

function pendingDetail(slide: ReviewSlide): DeckElement[] {
  const value = (key: keyof typeof PENDING_LABELS) => {
    const raw = key === 'role_category' ? slide.role_category : slide.requirements?.[key]; const joined = Array.isArray(raw) ? raw.join('; ') : raw;
    return joined?.trim() ? joined : 'Not provided';
  };
  const slot = box(DETAIL_MEDIA_ZONE[0] + 253, 367, 464, 498);
  return [text(box(slot[0], 305, slot[2], lineBox('castStatus')), 'castStatus', 'Pending', { align: 'center' }),
    image(slot, { type: 'static', key: 'casting_placeholder' }, 'Casting pending', 'placeholder'),
    ...fieldGrid((Object.keys(PENDING_LABELS) as (keyof typeof PENDING_LABELS)[]).map(key => ({ label: PENDING_LABELS[key], value: value(key), fit: key === 'role_category' ? key : `requirements.${key}` })), 6, 2),
    note('small', slide.slot_id ? 'Pending.' : 'Casting requirements pending.')];
}

/** Counts the worker proves and the database re-derives from the frozen slides. */
export interface DeckCounts { pages: number; candidate_fields: number; frame_draws: number; logo_draws: number; video_links: number; text_regions: number; static_images: number }
export function deckCounts(deck: Deck): DeckCounts {
  const all = deck.pages.flatMap(page => page.elements.flatMap(element => element.kind === 'stack' ? element.items : [element]));
  return {
    pages: deck.pages.length,
    candidate_fields: deck.pages.filter(page => page.layout === 'cast_detail').length * 10,
    frame_draws: all.filter(element => element.kind === 'image' && element.role === 'frame').length,
    logo_draws: all.filter(element => element.kind === 'image' && element.role === 'logo').length,
    video_links: all.filter(element => element.kind === 'link').length,
    // Video links are validated text too (their visible label is checked in the PDF).
    text_regions: all.filter(element => (element.kind === 'text' || element.kind === 'runs') && element.region || element.kind === 'link').length,
    static_images: all.filter(element => element.kind === 'image' && element.source.type === 'static').length,
  };
}
