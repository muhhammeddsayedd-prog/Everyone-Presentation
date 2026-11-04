import { ANATOMY, CANVAS, LINE_HEIGHT, TYPE, type TypeStyle } from './tokens.ts';
import type { Box, DeckElement, ImageElement, ImageSource, LayoutId, RunsElement, TextElement } from './deck.ts';

/** Pure geometry for every archetype. Coordinates come from design.md; adaptive
 * rules (counts the source never shows) are marked and kept inside the grammar. */
const round = (value: number) => Math.round(value * 10) / 10;
export const lineBox = (style: TypeStyle, lines = 1) => round(TYPE[style].size * ('lineHeight' in TYPE[style] ? TYPE[style].lineHeight as number : LINE_HEIGHT) * lines);
export const box = (x: number, y: number, width: number, height: number): Box => [round(x), round(y), round(width), round(height)];
const right = CANVAS.width - ANATOMY.heading.x;

export function text(boxValue: Box, style: TypeStyle, value: string, options: Omit<TextElement, 'kind' | 'box' | 'style' | 'text'> = {}): TextElement {
  return { kind: 'text', box: boxValue, style, text: value, region: true, ...options };
}
export function image(boxValue: Box, source: ImageSource, alt: string, role: ImageElement['role'], options: Partial<Pick<ImageElement, 'fit' | 'focal' | 'natural' | 'align'>> = {}): ImageElement {
  return { kind: 'image', box: boxValue, source, alt, role, fit: options.fit ?? 'cover', ...options };
}

// ---- Universal anatomy -----------------------------------------------------
/** Content header: 74 Semibold title and 50 Light path on two rows (§6.1). */
export function header(title: string, subtitle: string | null, options: { width?: number; subtitleFit?: string } = {}): TextElement[] {
  const width = options.width ?? right - ANATOMY.heading.x;
  const result = [text(box(ANATOMY.heading.x, ANATOMY.heading.top, width, lineBox('heading')), 'heading', title)];
  if (subtitle !== null) result.push(text(box(ANATOMY.subtitle.x, ANATOMY.subtitle.top, width, lineBox('subtitle')), 'subtitle', subtitle, { dir: 'auto', fit: options.subtitleFit }));
  return result;
}
export function pageNumber(value: number): TextElement {
  return text(box(ANATOMY.pageNumber.right - 200, ANATOMY.pageNumber.top, 200, lineBox('pageNumber')), 'pageNumber', String(value), { align: 'right' });
}
/** Yellow note that hugs its text, bottom-left outside the image band (§9). */
export function note(kind: 'small' | 'fitting' | 'ppm', message: string, prefix: string | null = 'Note:'): RunsElement {
  const anatomy = ANATOMY.notes[kind];
  const runs = kind === 'ppm' ? [{ text: prefix ? `${prefix} ${message}` : message, style: 'notePpm' as const }]
    : [...prefix ? [{ text: `${prefix} `, style: kind === 'small' ? 'noteSmallPrefix' as const : 'noteFittingPrefix' as const }] : [], { text: message, style: kind === 'small' ? 'noteSmall' as const : 'noteFitting' as const }];
  return { kind: 'runs', box: box(anatomy.x, anatomy.top, CANVAS.width * 0.75, anatomy.height), runs, highlight: kind === 'fitting' ? 'fittingNote' : 'note', region: true };
}
/** Object-attached caption note (BP-39/BP-99): highlighted text under an object. */
export function localNote(anchor: Box, message: string): RunsElement {
  return { kind: 'runs', box: box(anchor[0], anchor[1] + anchor[3] + 8, Math.max(anchor[2], 400), 32), runs: [{ text: message, style: 'noteSmall' }], highlight: 'note', region: true };
}

// ---- Foundation ---------------------------------------------------------------
export interface CoverContent { title: string; date: string | null; note?: string | null; client?: ImageSource | null; clientName?: string | null; partner?: ImageSource | null; titleFit?: string }
function coverStack(origin: { x: number; top: number }, gap: number, content: CoverContent) {
  const width = 1360; const items: (TextElement | RunsElement)[] = [text(box(origin.x, origin.top, width, lineBox('coverTitle', 2)), 'coverTitle', content.title, { wrap: true, dir: 'auto', fit: content.titleFit, separator: 'cap' })];
  const gaps: number[] = [];
  if (content.date) { items.push(text(box(origin.x, 0, width, lineBox('coverDate')), 'coverDate', content.date)); gaps.push(gap); }
  if (content.note) { const n = note('small', content.note); items.push({ ...n, box: box(origin.x, 0, width, ANATOMY.notes.small.height) }); gaps.push(ANATOMY.coverFloward.noteGap); }
  return { kind: 'stack' as const, box: box(origin.x, origin.top, width, 420), items, gaps };
}
/** Floward-family cover: Everyone upper right, title/date upper-middle left, one client mark lower right. */
export function coverFloward(content: CoverContent): DeckElement[] {
  const a = ANATOMY.coverFloward; const elements: DeckElement[] = [image(box(...a.everyone), { type: 'static', key: 'everyone_wordmark' }, 'everyone.', 'brand', { fit: 'contain', align: 'right' }), coverStack(a.title, a.dateGap, content)];
  if (content.client) elements.push(image(box(...a.client), content.client, 'Client logo', 'logo', { fit: 'contain', align: 'right' }));
  else if (content.clientName) elements.push(text(box(a.client[0] - 600, a.client[1] + a.client[3] / 2 - lineBox('coverClient') / 2, a.client[2] + 600, lineBox('coverClient')), 'coverClient', content.clientName, { align: 'right', dir: 'auto', fit: 'client_name' }));
  return elements;
}
/** Multi-partner cover (BP-1): Everyone 26 units higher, client lower left, partner lower right. */
export function coverPartners(content: CoverContent): DeckElement[] {
  const a = ANATOMY.coverPartners; const elements: DeckElement[] = [image(box(...a.everyone), { type: 'static', key: 'everyone_wordmark' }, 'everyone.', 'brand', { fit: 'contain', align: 'right' }), coverStack(a.title, a.dateGap, content)];
  if (content.client) elements.push(image(box(...a.client), content.client, 'Client logo', 'logo', { fit: 'contain', align: 'left' }));
  if (content.partner) elements.push(image(box(...a.partner), content.partner, 'Partner logo', 'logo', { fit: 'contain', align: 'right' }));
  return elements;
}
export function sectionDivider(title: string, fit?: string): DeckElement[] {
  return [text(box(ANATOMY.section.x, ANATOMY.section.top, right - ANATOMY.section.x, lineBox('section')), 'section', title, { dir: 'auto', fit })];
}
export function closing(): DeckElement[] { return [text(box(0, ANATOMY.closing.top, CANVAS.width, lineBox('closing')), 'closing', 'THANK YOU!', { align: 'center' })]; }
/** BP-2: header slightly lower than content titles; rows advance 100 units. More
 * than seven rows continue on another agenda slide rather than shrinking. */
export function agenda(items: string[]): DeckElement[] {
  if (items.length > 7) throw new Error('AGENDA_ROWS_EXCEEDED');
  return [text(box(ANATOMY.heading.x, 73, 1400, lineBox('heading')), 'heading', 'Agenda.'),
    ...items.map((item, n): RunsElement => ({ kind: 'runs', box: box(ANATOMY.heading.x, 357 + n * 100, 1600, lineBox('agenda')), runs: [{ text: '//', style: 'agendaSlash' }, { text: ` ${item}`, style: 'agenda' }], region: true }))];
}

// ---- Casting -------------------------------------------------------------------
/** Visible portrait crop slots (FC-4/FC-8/FC-12/BP-46). */
export const CAST_SLOTS: Record<1 | 2 | 3, Box[]> = {
  1: [[728, 367, 464, 498]], 2: [[493, 367, 464, 500], [963, 367, 464, 500]],
  3: [[258, 367, 464, 498], [728, 367, 464, 498], [1198, 367, 464, 498]],
};
export const PORTRAIT_FOCAL = [0.5, 0.4] as const;
export interface Portrait { source: ImageSource | null; alt: string; natural?: readonly [number, number]; label?: string | null; name?: string | null; nameFit?: string }
/** Main/Backup (labels) or an unranked group (no labels), one to three portraits.
 * Missing choices use the source silhouette in the exact slot. */
export function castPortraits(portraits: Portrait[], options: { labels: boolean }): DeckElement[] {
  const count = portraits.length as 1 | 2 | 3; if (!CAST_SLOTS[count]) throw new Error('CAST_PORTRAIT_COUNT');
  return CAST_SLOTS[count].flatMap((slot, n) => {
    const portrait = portraits[n]; const elements: DeckElement[] = [];
    if (options.labels && portrait.label) elements.push(text(box(slot[0], 305, slot[2], lineBox('castStatus')), 'castStatus', portrait.label, { align: 'center' }));
    elements.push(portrait.source ? image(slot, portrait.source, portrait.alt, 'frame', { focal: PORTRAIT_FOCAL, natural: portrait.natural })
      : image(slot, { type: 'static', key: 'casting_placeholder' }, portrait.alt, 'placeholder'));
    if (portrait.name) elements.push(text(box(slot[0], 883, slot[2], lineBox('castName', 2)), 'castName', portrait.name, { align: 'center', wrap: true, dir: 'auto', fit: portrait.nameFit }));
    return elements;
  });
}
/** BP-47: one wide audition still with the name below. */
export function castAuditionWide(source: ImageSource, alt: string, name: string, natural?: readonly [number, number]): DeckElement[] {
  const slot = box(338, 231, 1244, 700);
  return [image(slot, source, alt, 'frame', { focal: [0.5, 0.4], natural }), text(box(338, 951, 1244, lineBox('castName')), 'castName', name, { align: 'center', dir: 'auto' })];
}
/** BP-57: two-row headshot ensemble, rows of up to six 306×329 tiles, no captions. */
export function castEnsemble(portraits: Portrait[]): DeckElement[] {
  if (!portraits.length || portraits.length > 12) throw new Error('ENSEMBLE_COUNT');
  const [width, height, gap] = [306, 329, 5]; const rows = [portraits.slice(0, 6), portraits.slice(6)].filter(row => row.length);
  return rows.flatMap((row, r) => row.map((portrait, n) => {
    const start = (CANVAS.width - (row.length * width + (row.length - 1) * gap)) / 2;
    const slot = box(start + n * (width + gap), 279 + r * 380, width, height);
    return portrait.source ? image(slot, portrait.source, portrait.alt, 'frame', { focal: PORTRAIT_FOCAL, natural: portrait.natural }) : image(slot, { type: 'static', key: 'casting_placeholder' }, portrait.alt, 'placeholder');
  }));
}

// ---- Fitting and wardrobe ---------------------------------------------------------
/** FF fitting strips: one centered row, identical height y244–990. */
export const FITTING_SLOTS: Record<1 | 2 | 3 | 4 | 5, Box[]> = {
  1: [[780, 244, 360, 746]], 2: [[600, 244, 358, 746], [962, 244, 358, 746]],
  3: [[418, 244, 360, 746], [782, 244, 358, 746], [1144, 244, 358, 746]],
  4: [[236, 244, 360, 746], [600, 244, 358, 746], [962, 244, 358, 746], [1324, 244, 360, 746]],
  5: [[62, 244, 360, 746], [426, 244, 358, 746], [788, 244, 360, 746], [1152, 244, 358, 746], [1514, 244, 360, 746]],
};
export interface Media { source: ImageSource; alt: string; natural: readonly [number, number]; focal?: readonly [number, number]; caption?: string | null; label?: string | null }
/** Full height is never cropped: an image narrower than its strip narrows the strip
 * (centered) instead of losing head or shoes (design.md §7.8). */
export function fittingStrip(items: Media[]): DeckElement[] {
  const slots = FITTING_SLOTS[items.length as 1 | 2 | 3 | 4 | 5]; if (!slots) throw new Error('FITTING_COUNT');
  return items.map((item, n) => {
    const [x, y, w, h] = slots[n]; const width = Math.min(w, h * item.natural[0] / item.natural[1]);
    return image(box(x + (w - width) / 2, y, width, h), item.source, item.alt, 'media', { focal: item.focal ?? [0.5, 0.5], natural: item.natural });
  });
}
/** FW look rows: one aligned band; heights from the source examples per count. */
const LOOK_BANDS: Record<2 | 3 | 4 | 5, [number, number]> = { 2: [200, 816], 3: [216, 800], 4: [300, 632], 5: [289, 656] };
export function wardrobeLookRow(items: Media[]): DeckElement[] {
  const band = LOOK_BANDS[items.length as 2 | 3 | 4 | 5]; if (!band) throw new Error('LOOK_COUNT');
  const gap = 4; const maxWidth = 1872; const aspects = items.map(item => item.natural[0] / item.natural[1]);
  const height = Math.min(band[1], (maxWidth - gap * (items.length - 1)) / aspects.reduce((sum, value) => sum + value, 0));
  const total = aspects.reduce((sum, value) => sum + value * height, 0) + gap * (items.length - 1);
  let x = (CANVAS.width - total) / 2; const y = band[0] + (band[1] - height) / 2;
  return items.map((item, n) => { const element = image(box(x, y, aspects[n] * height, height), item.source, item.alt, 'media', { focal: item.focal, natural: item.natural }); x += aspects[n] * height + gap; return element; });
}
/** Stable rectangular collage: each row fills the zone width at a shared height,
 * then the whole block scales to fit and centers. No masonry staircases. */
export function justifiedRows(rows: (readonly [number, number])[][], zone: Box, gap = 8, rowGap = 14): Box[][] {
  const [zx, zy, zw, zh] = zone; const aspects = rows.map(row => row.map(([w, h]) => w / h));
  const natural = aspects.map(row => (zw - gap * (row.length - 1)) / row.reduce((sum, value) => sum + value, 0));
  const scale = Math.min(1, (zh - rowGap * (rows.length - 1)) / natural.reduce((sum, value) => sum + value, 0));
  const heights = natural.map(value => value * scale);
  let y = zy + (zh - (heights.reduce((sum, value) => sum + value, 0) + rowGap * (rows.length - 1))) / 2;
  return aspects.map((row, r) => {
    const width = row.reduce((sum, value) => sum + value * heights[r], 0) + gap * (row.length - 1); let x = zx + (zw - width) / 2;
    const boxes = row.map(aspect => { const result = box(x, y, aspect * heights[r], heights[r]); x += aspect * heights[r] + gap; return result; });
    y += heights[r] + rowGap; return boxes;
  });
}
export const MOSAIC_ZONE = box(ANATOMY.mediaZone.x, ANATOMY.mediaZone.y, ANATOMY.mediaZone.width, ANATOMY.mediaZone.height);
/** FW-8/FW-18 technical boards and BP-37/39/42 production mosaics. */
export function mosaic(rows: Media[][], options: { zone?: Box; captions?: boolean } = {}): DeckElement[] {
  const captionSpace = options.captions ? 48 : 0; const zone = options.zone ?? MOSAIC_ZONE;
  const boxes = justifiedRows(rows.map(row => row.map(item => item.natural)), box(zone[0], zone[1], zone[2], zone[3] - captionSpace * rows.length), 8, 14 + captionSpace);
  return rows.flatMap((row, r) => row.flatMap((item, n) => {
    const slot = boxes[r][n]; const elements: DeckElement[] = [image(slot, item.source, item.alt, 'media', { focal: item.focal, natural: item.natural })];
    if (item.caption) elements.push(text(box(slot[0] - 40, slot[1] + slot[3] + 8, slot[2] + 80, lineBox('caption')), 'caption', item.caption, { align: 'center', dir: 'auto' }));
    return elements;
  }));
}
/** BP-71/72/88: each inspiration (with a small `Mood Board` label) stays beside
 * the actual garments that implement it, one comparison group per row. */
export function referenceActuals(groups: { references: Media[]; actuals: Media[] }[]): DeckElement[] {
  if (!groups.length || groups.length > 3) throw new Error('REFERENCE_GROUP_COUNT');
  const top = 240; const bottom = 1018; const rowGap = 24; const label = lineBox('microLabel') + 4;
  const rowHeight = (bottom - top - rowGap * (groups.length - 1)) / groups.length;
  return groups.flatMap((group, g) => {
    const zone = box(ANATOMY.mediaZone.x, top + g * (rowHeight + rowGap) + label, ANATOMY.mediaZone.width, rowHeight - label);
    const items = [...group.references, ...group.actuals]; const [row] = justifiedRows([items.map(item => item.natural)], zone, 8, 0);
    // A wider seam separates inspiration from actuals so the pairing reads as a group.
    const shift = 24; const refs = group.references.length;
    return items.flatMap((item, n) => {
      const slot = box(row[n][0] + (n < refs ? -shift / 2 : shift / 2), row[n][1], row[n][2], row[n][3]);
      const elements: DeckElement[] = [image(slot, item.source, item.alt, 'media', { focal: item.focal, natural: item.natural })];
      if (n === 0) elements.push(text(box(slot[0], slot[1] - label, Math.max(slot[2], 200), lineBox('microLabel')), 'microLabel', 'Mood Board'));
      return elements;
    });
  });
}

// ---- Scripts and storyboards -------------------------------------------------------
export interface DialogueUnit { speaker: string; lines: string[]; lang?: string }
/** BP-4/BP-5: centered speaker/dialogue clusters, optically centered in y300–960. */
export function scriptDialogue(units: DialogueUnit[]): DeckElement[] {
  const width = 1310; const x = (CANVAS.width - width) / 2; const unitGap = 44;
  const heights = units.map(unit => lineBox('scriptSpeaker') + 6 + unit.lines.length * lineBox('dialogue'));
  const total = heights.reduce((sum, value) => sum + value, 0) + unitGap * (units.length - 1);
  if (total > 660) throw new Error('SCRIPT_OVERFLOW_SPLIT_SLIDE');
  let y = 300 + (660 - total) / 2;
  return units.flatMap((unit, n) => {
    const elements = [text(box(x, y, width, lineBox('scriptSpeaker')), 'scriptSpeaker', unit.speaker, { align: 'center', dir: 'auto' }),
      text(box(x, y + lineBox('scriptSpeaker') + 6, width, unit.lines.length * lineBox('dialogue')), 'dialogue', unit.lines.join('\n'), { align: 'center', wrap: true, dir: unit.lang === 'ar' ? 'rtl' : 'auto', lang: unit.lang })];
    y += heights[n] + unitGap; return elements;
  });
}
export interface StoryboardFrame { number: string; media: Media; action?: string | null; dialogue?: string[] }
export const STORYBOARD_TWO: Box[] = [[46.3, 307.3, 901.7, 507.3], [972, 307.3, 901.7, 507.3]];
export const STORYBOARD_ONE: Box = [509.1, 198.1, 901.8, 507.3];
function storyboardFrame(frame: StoryboardFrame, slot: Box, numberAt: readonly [number, number], textTop: number): DeckElement[] {
  const elements: DeckElement[] = [text(box(numberAt[0], numberAt[1], 200, lineBox('stbNumber')), 'stbNumber', frame.number),
    image(slot, frame.media.source, frame.media.alt, 'media', { focal: frame.media.focal, natural: frame.media.natural })];
  let y = textTop;
  if (frame.action) { elements.push(text(box(slot[0], y, slot[2], lineBox('stbAction', 2)), 'stbAction', frame.action, { align: 'center', wrap: true, dir: 'auto' })); y += lineBox('stbAction', 2) + 8; }
  if (frame.dialogue?.length) elements.push(text(box(slot[0], y, slot[2], frame.dialogue.length * lineBox('dialogue')), 'dialogue', frame.dialogue.join('\n'), { align: 'center', wrap: true, dir: 'rtl', lang: 'ar' }));
  return elements;
}
/** BP-14: two 16:9 frames, numbers above, action then blue dialogue below.
 * A shared caption (BP-25) spans both frames. Overflow splits slides upstream. */
export function storyboardTwo(frames: [StoryboardFrame, StoryboardFrame], shared?: string): DeckElement[] {
  const elements = frames.flatMap((frame, n) => storyboardFrame(shared ? { ...frame, action: null } : frame, STORYBOARD_TWO[n], [STORYBOARD_TWO[n][0] + 6.7, 263], 832));
  if (shared) elements.push(text(box(46.3, 832, 1827.4, lineBox('stbAction', 2)), 'stbAction', shared, { align: 'center', wrap: true, dir: 'auto' }));
  return elements;
}
export function storyboardOne(frame: StoryboardFrame): DeckElement[] { return storyboardFrame(frame, STORYBOARD_ONE, [517, 154], 717); }

// ---- Art direction and production ------------------------------------------------------
export function keyReference(media: Media): DeckElement[] { return [image(box(320, 256.2, 1280, 720), media.source, media.alt, 'media', { focal: media.focal, natural: media.natural })]; }
/** BP-35: one location image, whole, centered below the header. */
export function singleLocation(media: Media): DeckElement[] {
  const [maxWidth, maxHeight, top] = [1600, 790, 214]; const aspect = media.natural[0] / media.natural[1];
  const width = Math.min(maxWidth, maxHeight * aspect); const height = width / aspect;
  return [image(box((CANVAS.width - width) / 2, top + (maxHeight - height) / 2, width, height), media.source, media.alt, 'media', { natural: media.natural })];
}

// ---- Application extension: candidate detail ---------------------------------------------
/** Candidate frames keep their whole actual aspect ratio (no crop). One row or one
 * column, whichever gives the smaller frame more area; centered in the media zone. */
export const DETAIL_MEDIA_ZONE = box(34, 306, 970, 684);
export const DETAIL_FIELD_ZONE = box(1074, 244, 812, 756);
export function arrangeFrames(naturals: (readonly [number, number])[], zone: Box = DETAIL_MEDIA_ZONE, gap = 6): Box[] {
  if (!naturals.length) return [];
  const [zx, zy, zw, zh] = zone; const aspects = naturals.map(([w, h]) => w / h);
  const rowHeight = Math.min(zh, (zw - gap * (aspects.length - 1)) / aspects.reduce((sum, value) => sum + value, 0));
  const columnWidth = Math.min(zw, (zh - gap * (aspects.length - 1)) / aspects.reduce((sum, value) => sum + 1 / value, 0));
  const rowArea = Math.min(...aspects.map(aspect => rowHeight * rowHeight * aspect));
  const columnArea = Math.min(...aspects.map(aspect => columnWidth * columnWidth / aspect));
  if (rowArea >= columnArea) {
    const total = aspects.reduce((sum, value) => sum + value * rowHeight, 0) + gap * (aspects.length - 1);
    let x = zx + (zw - total) / 2; const y = zy + (zh - rowHeight) / 2;
    return aspects.map(aspect => { const result = box(x, y, aspect * rowHeight, rowHeight); x += aspect * rowHeight + gap; return result; });
  }
  const total = aspects.reduce((sum, value) => sum + columnWidth / value, 0) + gap * (aspects.length - 1);
  let y = zy + (zh - total) / 2; const x = zx + (zw - columnWidth) / 2;
  return aspects.map(aspect => { const result = box(x, y, columnWidth, columnWidth / aspect); y += columnWidth / aspect + gap; return result; });
}
/** Two columns of labelled values in the right field zone. Values wrap inside a
 * fixed number of lines; measured overflow blocks generation instead of clipping. */
export function fieldGrid(entries: { label: string; value: string; fit: string }[], rows: number, valueLines: number): DeckElement[] {
  const [zx, zy, zw, zh] = DETAIL_FIELD_ZONE; const gap = 30; const width = (zw - gap) / 2; const pitch = zh / rows;
  return entries.flatMap((entry, n) => {
    const x = zx + Math.floor(n / rows) * (width + gap); const y = zy + (n % rows) * pitch;
    return [text(box(x, y, width, lineBox('fieldLabel')), 'fieldLabel', entry.label),
      text(box(x, y + lineBox('fieldLabel') + 4, width, lineBox('fieldValue', valueLines)), 'fieldValue', entry.value, { wrap: true, dir: 'auto', fit: entry.fit })];
  });
}
export const EVERY_SLIDE_LOGO = box(1654, 47.3, 232, 92.5);

export type PageBuilder = { layout: LayoutId; elements: DeckElement[] };
