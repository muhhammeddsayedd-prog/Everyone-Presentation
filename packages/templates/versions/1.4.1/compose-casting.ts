import type { PresentationContext, PresentationScene, ReviewSlide, WorkspaceReview } from '../../../domain/src/review-types.ts';
import type { Deck, DeckElement, DeckPage, ImageSource, LayoutId } from './deck.ts';
import { castPortraits, closing, coverFloward, header, note, pageNumber, PORTRAIT_FOCAL, sectionDivider, type Portrait, type PortraitCaption } from './layouts.ts';

export const POSITION_LABELS = { main: 'Main', backup: 'Backup', option: 'Option' } as const;
/** Default highlighted note on the page of a role that has nobody cast yet. */
export const PENDING_NOTE = 'Pending.';

export interface CastingDeckOptions { versionLabel?: string; versionNumber?: number; dateLabel?: string | null; logoNatural?: readonly [number, number] }
export type DeckReview = Pick<WorkspaceReview, 'cover' | 'slides' | 'output_type'> & { presentation?: PresentationContext };

/** Frozen, timezone-independent cover date (UTC calendar day of capture). */
export function editorialDateLabel(iso: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: '2-digit' }).format(new Date(iso));
}
/** Trailing full stop is a deliberate style feature (design.md §5.3). */
export function sentence(value: string) { const trimmed = value.trim(); return /[.!?…:]$/u.test(trimmed) ? trimmed : `${trimmed}.`; }
const clean = (value: string | null | undefined) => typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
const asset = (asset_id: string): ImageSource => ({ type: 'asset', asset_id });

/** Unlabelled option pages: threes, ending with a pair or a three; never a lone person unless there is only one
 * (1 → 1, 2 → 2, 3 → 3, 4 → 2+2, 5 → 3+2, 6 → 3+3, 7 → 3+2+2, 8 → 3+3+2, 9 → 3+3+3 …). Order is kept. */
export function optionChunks<T>(items: readonly T[]): T[][] {
  const sizes: number[] = []; let left = items.length;
  while (left > 0) { if (left === 4) { sizes.push(2, 2); break; } if (left <= 3) { sizes.push(left); break; } sizes.push(3); left -= 3; }
  let start = 0; return sizes.map(size => { const chunk = items.slice(start, start + size); start += size; return chunk; });
}

interface Person { slide: ReviewSlide; source: number }
interface Slot { id: string | null; people: Person[]; note: string | null }
interface Role { id: string | null; name: string; slots: Slot[]; note: string | null; sources: number[] }
/** Roles in captured order, each with its slots in captured order (the review lists slots role by role). */
function rolesOf(review: DeckReview): Role[] {
  const roles = new Map<string, Role>();
  review.slides.forEach((slide, n) => {
    const context = review.presentation?.slides[n]; const key = slide.role_id ?? `workspace:${n}`;
    let role = roles.get(key);
    if (!role) { role = { id: slide.role_id, name: slide.role_name, slots: [], note: clean(context?.role_note), sources: [] }; roles.set(key, role); }
    role.sources.push(n + 1);
    let slot = role.slots.find(item => item.id !== null && item.id === slide.slot_id);
    if (!slot) { slot = { id: slide.slot_id, people: [], note: clean(context?.slot_note) }; role.slots.push(slot); }
    if (slide.kind === 'candidate') slot.people.push({ slide, source: n + 1 });
  });
  return [...roles.values()];
}

// ---- 1.4.1 portrait captions: name, age, height ------------------------------------------------------------------
/** A captured slide value that was actually provided: not blank and not the review's "Not provided"/"Pending" text. */
export function providedValue(value: string | null | undefined): string | null {
  const trimmed = clean(value); return trimmed === null || /^(?:not provided|pending)$/i.test(trimmed) ? null : trimmed;
}
// Height grammar, mirrored by eps.editorial141_has_height (m23): ASCII classes, explicit ASCII word boundaries and
// spaces only, so JavaScript and PostgreSQL agree on whether a height is present.
const HEIGHT_UNIT = String.raw`centimet(?:er|re)s?|millimet(?:er|re)s?|met(?:er|re)s?|cm|mm|m|feet|foot|ft|inch(?:es)?|in(?! +[A-Za-z])`;
const HEIGHT_FEET = String.raw`[0-9] ?(?:'|′|ft|feet|foot) ?[0-9]{1,2}(?: ?(?:"|″|''|inch(?:es)?|in))?`;
const HEIGHT_NUMBER = String.raw`[0-9]{1,3}(?:[.,][0-9]{1,2})?`;
const HEIGHT_VALUE = String.raw`(?:(${HEIGHT_FEET})|(${HEIGHT_NUMBER})(?: ?(${HEIGHT_UNIT}))?)(?![A-Za-z0-9])`;
/** "Height: 173; weight: 77" / "height 180 cm" / "Height is 5'11"": the value after the word height. */
export const LABELLED_HEIGHT = new RegExp(String.raw`(?<![A-Za-z0-9_])height(?![A-Za-z0-9_]) *(?:[-:=]|is(?![A-Za-z0-9_]))? *${HEIGHT_VALUE}`, 'i');
/** A field that starts with a length: "180 cm", "1.80 m", "5'11"", "180 cm, 75 kg", or is only a number: "180". */
export const LEADING_HEIGHT = new RegExp(String.raw`^(?:${HEIGHT_FEET}(?![A-Za-z0-9])|${HEIGHT_NUMBER} ?(?:${HEIGHT_UNIT})(?![A-Za-z0-9])|${HEIGHT_NUMBER} *\.? *$)`, 'i');
const LEADING_VALUE = new RegExp(String.raw`^${HEIGHT_VALUE}`, 'i');
/** Only the height from free-text measurements ("Height: 173; weight: 77. Units not stated." → "173"): never the
 * weight or another measurement; the unit only when one is stated ("180 cm"), never an invented one. Null when no
 * height can be identified. */
export function captionHeight(measurements: string | null | undefined): string | null {
  const text = providedValue(measurements); if (text === null) return null;
  const match = LABELLED_HEIGHT.exec(text) ?? (LEADING_HEIGHT.test(text) ? LEADING_VALUE.exec(text) : null);
  if (!match) return null;
  if (match[1]) return match[1].replace(/[ ]+/gu, ' ');
  return match[3] ? `${match[2]} ${match[3]}` : match[2];
}
/** The 1.4.1 caption of one person: the name, then age and height on one line (each only when provided). */
export function portraitCaption(fields: Pick<ReviewSlide['fields'], 'name_or_id' | 'age_or_range' | 'height_measurements'>): PortraitCaption | null {
  const name = providedValue(fields.name_or_id); const details = [providedValue(fields.age_or_range), captionHeight(fields.height_measurements)].filter((value): value is string => value !== null);
  return name === null && !details.length ? null : { name, details: details.length ? details.join(CAPTION_SEPARATOR) : null };
}
export const CAPTION_SEPARATOR = ' | ';

/** One portrait per person: the pinned project portrait (frame or photo, with its crop focus), else the first
 * selected frame; a deliberately empty picture or no picture at all draws the reference silhouette. Every person
 * is captioned with their name, age and height (1.4.1). */
function portrait(review: DeckReview, person: Person, label: string | null): Portrait {
  // Alt text names the person when a name was provided (never "Not provided").
  const context = review.presentation?.slides[person.source - 1]; const name = providedValue(person.slide.fields.name_or_id) ?? 'Unnamed person';
  const caption = portraitCaption(person.slide.fields);
  if (context?.picture_state !== 'intentionally_empty') {
    if (context?.portrait) return { source: asset(context.portrait.asset_id), natural: [context.portrait.width, context.portrait.height], focal: [context.portrait.focal[0] / 1000, context.portrait.focal[1] / 1000], alt: `${name}, presentation picture`, label, owner: person.source, caption };
    const frame = person.slide.frames[0];
    if (frame) return { source: asset(frame.asset_id), natural: [frame.width, frame.height], focal: PORTRAIT_FOCAL, alt: `${name}, selected source frame`, label, owner: person.source, caption };
  }
  return { source: null, alt: `${name}, no picture`, label, owner: person.source, caption };
}
const silhouette = (label: string | null): Portrait => ({ source: null, alt: label ? `${label} not chosen` : 'Casting pending', label });

interface Body { layout: LayoutId; sources: number[]; portraits: Portrait[]; labels: boolean; note: string | null }
const join = (notes: (string | null)[]) => { const kept = notes.filter((value): value is string => Boolean(value)); return kept.length ? kept.join(' ') : null; };
/** Pages of one role. A slot with a Main or a Backup gives a labelled Main | Backup page (a missing Main or Backup is
 * the silhouette) and labelled Backup continuation pages for further Backups (two per page; nobody is drawn twice). Everyone else in the role
 * (Options) is shown unlabelled in option pages. A role with nobody cast is one silhouette page. A slot note goes on
 * the page with that slot's last person; the role or scene note on the role's last page. */
function rolePages(review: DeckReview, role: Role, roleNote: string | null): Body[] {
  const bodies: Body[] = []; let pool: { person: Person; slot: Slot }[] = [];
  const flush = () => {
    const last = new Map<Slot, number>(); for (const item of pool) last.set(item.slot, item.person.source);
    for (const chunk of optionChunks(pool)) bodies.push({ layout: chunk.length === 1 ? 'cast_single' : 'cast_group_strip', sources: chunk.map(item => item.person.source),
      portraits: chunk.map(item => portrait(review, item.person, null)), labels: false,
      note: join([...new Set(chunk.map(item => item.slot))].filter(slot => chunk.some(item => item.person.source === last.get(slot))).map(slot => slot.note)) });
    pool = [];
  };
  for (const slot of role.slots) {
    const main = slot.people.find(item => item.slide.position === 'main'); const backups = slot.people.filter(item => item.slide.position === 'backup');
    const others = slot.people.filter(item => item !== main && !backups.includes(item));
    if (main || backups.length) {
      flush();
      // Main | first Backup (a missing one is the silhouette, as in the reference); further Backups follow on
      // labelled continuation pages, two per page. No person is drawn twice.
      const rest: Person[][] = []; for (let n = 1; n < backups.length; n += 2) rest.push(backups.slice(n, n + 2));
      bodies.push({ layout: 'cast_main_backup', sources: [main?.source, backups[0]?.source].filter((value): value is number => value !== undefined),
        portraits: [main ? portrait(review, main, POSITION_LABELS.main) : silhouette(POSITION_LABELS.main), backups[0] ? portrait(review, backups[0], POSITION_LABELS.backup) : silhouette(POSITION_LABELS.backup)],
        labels: true, note: !others.length && !rest.length ? slot.note : null });
      rest.forEach((pair, n) => bodies.push({ layout: 'cast_main_backup', sources: pair.map(item => item.source), portraits: pair.map(item => portrait(review, item, POSITION_LABELS.backup)),
        labels: true, note: !others.length && n === rest.length - 1 ? slot.note : null }));
    }
    pool.push(...others.map(person => ({ person, slot })));
  }
  flush();
  if (!bodies.length) bodies.push({ layout: 'cast_pending', sources: [role.sources[0]], portraits: [silhouette(null)], labels: false, note: join(role.slots.map(slot => slot.note)) });
  const last = bodies[bodies.length - 1];
  last.note = join([last.note, roleNote ?? (last.layout === 'cast_pending' && !last.note ? PENDING_NOTE : null)]);
  return bodies;
}

interface Section { divider: string | null; items: { role: Role; subtitle: string; note: string | null }[] }
/** Scene flow. heading = sequence label, else scene title; place = occurrence setting, else scene setting (or the
 * scene title inside a sequence). Consecutive scenes of one sequence share one divider ("Heading." for several
 * scenes, "Heading | Place." for one scene with a place). A role prints once at its first `auto` occurrence,
 * captioned with every `auto` place of that role in the same divider group ("Front Door & Home Gathering");
 * `repeat` prints it again; `hidden` skips it. Roles that no scene prints come first, in role order, without a
 * divider. Without scenes every role follows in role order and there are no dividers. */
function sections(review: DeckReview, roles: Role[]): Section[] {
  const scenes = review.presentation?.scenes ?? [];
  if (!scenes.length) return [{ divider: null, items: roles.map(role => ({ role, subtitle: sentence(role.name), note: role.note })) }];
  const byId = new Map(roles.filter(role => role.id).map(role => [role.id!, role]));
  const groups: { sequence: string | null; scenes: PresentationScene[] }[] = [];
  for (const scene of scenes) {
    const sequence = clean(scene.sequence_label); const last = groups.at(-1);
    if (sequence && last?.sequence === sequence) last.scenes.push(scene); else groups.push({ sequence, scenes: [scene] });
  }
  const heading = (scene: PresentationScene) => clean(scene.sequence_label) ?? scene.title.trim();
  const scenePlace = (scene: PresentationScene) => clean(scene.setting) ?? (clean(scene.sequence_label) ? scene.title.trim() : null);
  const place = (scene: PresentationScene, occurrence: PresentationScene['occurrences'][number]) => clean(occurrence.setting_override) ?? scenePlace(scene);
  const scened = new Set(scenes.flatMap(scene => scene.occurrences.filter(item => item.deck_placement !== 'hidden' && byId.has(item.role_id)).map(item => item.role_id)));
  const result: Section[] = [{ divider: null, items: roles.filter(role => !role.id || !scened.has(role.id)).map(role => ({ role, subtitle: sentence(role.name), note: role.note })) }];
  const printed = new Set<string>();
  for (const group of groups) {
    const first = group.scenes[0]; const only = group.scenes.length === 1 ? scenePlace(first) : null;
    const section: Section = { divider: sentence(only ? `${heading(first)} | ${only}` : heading(first)), items: [] };
    for (const scene of group.scenes) for (const occurrence of scene.occurrences) {
      const role = byId.get(occurrence.role_id); if (!role || occurrence.deck_placement === 'hidden') continue;
      let places: (string | null)[];
      if (occurrence.deck_placement === 'auto') {
        if (printed.has(occurrence.role_id)) continue; printed.add(occurrence.role_id);
        places = group.scenes.flatMap(item => item.occurrences.filter(other => other.role_id === occurrence.role_id && other.deck_placement === 'auto').map(other => place(item, other)));
      } else places = [place(scene, occurrence)];
      const caption = [...new Set(places.filter((value): value is string => value !== null))].join(' & ');
      section.items.push({ role, subtitle: sentence([heading(scene), caption || null, clean(occurrence.display_title) ?? role.name].filter(Boolean).join(' | ')), note: clean(occurrence.presentation_note) ?? role.note });
    }
    result.push(section);
  }
  return result;
}

/** Deterministic Everyone Film casting deck (1.4.1): the 1.4.0 Floward cast shortlist layout from captured review
 * data only: cover → (scene divider → cast pages)… → THANK YOU!. Cast pages show portraits with, under each person,
 * only their name, age and height (whichever were provided; other facts stay in the app): "Cast Shortlist." /
 * "Cast Selection.", a "Scene | Setting | Role." path and an optional note. Captions never change the pages. */
export function composeCastingDeck(review: DeckReview, options: CastingDeckOptions = {}): Deck {
  const heading = review.output_type === 'shortlist' ? 'Cast Shortlist.' : 'Cast Selection.';
  const logo = review.cover.logo_asset_id;
  const title = sentence(`${review.cover.project_name} | ${heading.slice(0, -1)}${options.versionNumber ? ` - V${options.versionNumber}` : ''}`);
  const pages: Omit<DeckPage, 'index' | 'number'>[] = [];
  pages.push({ layout: 'cover_floward', source_index: 0, elements: coverFloward({ title, date: options.dateLabel ?? options.versionLabel ?? 'Draft preview', titleFit: 'project_name',
    note: clean(review.presentation?.cover_note), noteFit: 'cover_note', client: logo ? asset(logo) : null, clientName: logo ? null : review.cover.client_name }) });
  for (const section of sections(review, rolesOf(review))) {
    const bodies = section.items.flatMap(item => rolePages(review, item.role, item.note).map(body => ({ ...body, subtitle: item.subtitle })));
    if (!bodies.length) continue;
    if (section.divider) pages.push({ layout: 'section_divider', source_index: bodies[0].sources[0], sources: [bodies[0].sources[0]], elements: sectionDivider(section.divider, 'scene_title') });
    for (const body of bodies) {
      const elements: DeckElement[] = [...header(heading, body.subtitle, { subtitleFit: 'presentation.subtitle' }), ...castPortraits(body.portraits, { labels: body.labels })];
      if (body.note) elements.push({ ...note('small', body.note), fit: 'presentation.note' });
      pages.push({ layout: body.layout, source_index: body.sources[0], sources: body.sources, elements });
    }
  }
  pages.push({ layout: 'closing_thank_you', source_index: review.slides.length, elements: closing() });

  const last = pages.length - 1;
  return { canvas: { width: 1920, height: 1080 }, title, pages: pages.map((page, index) => {
    const numbered = index !== 0 && index !== last; const number = numbered ? index + 1 : null;
    const elements = [...page.elements];
    if (number !== null) elements.push(pageNumber(number));
    if (index === 0 && logo && options.logoNatural) for (const element of elements) if (element.kind === 'image' && element.role === 'logo') element.natural = options.logoNatural;
    return { ...page, index, number, elements };
  }) };
}

/** Counts the worker proves and the database re-derives (eps.editorial_deck_counts_1_4_1) from the frozen snapshot. */
export interface DeckCounts { pages: number; candidate_fields: number; frame_draws: number; logo_draws: number; video_links: number; text_regions: number; static_images: number; placeholder_draws: number }
export function deckCounts(deck: Deck): DeckCounts {
  const all = deck.pages.flatMap(page => page.elements.flatMap(element => element.kind === 'stack' ? element.items : [element]));
  return {
    pages: deck.pages.length,
    // Captions are presentation regions (name, age | height), not the ten candidate fields, which stay in the app.
    candidate_fields: 0,
    frame_draws: all.filter(element => element.kind === 'image' && element.role === 'frame').length,
    logo_draws: all.filter(element => element.kind === 'image' && element.role === 'logo').length,
    video_links: all.filter(element => element.kind === 'link').length,
    text_regions: all.filter(element => (element.kind === 'text' || element.kind === 'runs') && element.region || element.kind === 'link').length,
    static_images: all.filter(element => element.kind === 'image' && element.source.type === 'static').length,
    placeholder_draws: all.filter(element => element.kind === 'image' && element.role === 'placeholder').length,
  };
}
