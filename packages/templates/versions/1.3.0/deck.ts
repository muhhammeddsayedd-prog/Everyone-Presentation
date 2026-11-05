import type { TypeStyle } from './tokens.ts';

/** The twenty source-derived archetypes (design.md §10) plus documented application
 * extensions. 1.3.0: one page per slot — a single person (`cast_detail`) or two to three
 * people side by side with their facts under the portraits (`cast_group_detail`) — and
 * one page per pending slot/role. Only facts that were provided are drawn. */
export const SOURCE_LAYOUTS = ['cover_floward', 'cover_partners', 'agenda_slash', 'section_divider', 'closing_thank_you',
  'cast_main_backup', 'cast_group_strip', 'cast_single', 'cast_profile', 'cast_ensemble',
  'fitting_strip', 'wardrobe_look_row', 'wardrobe_technical_board', 'wardrobe_reference_actuals',
  'script_dialogue', 'storyboard_two', 'storyboard_one',
  'key_reference_16x9', 'single_location_reference', 'production_mosaic'] as const;
export const EXTENSION_LAYOUTS = ['cast_detail', 'cast_group_detail', 'cast_pending'] as const;
export type LayoutId = typeof SOURCE_LAYOUTS[number] | typeof EXTENSION_LAYOUTS[number];

/** [x, y, width, height] in native 1920×1080 units. */
export type Box = readonly [number, number, number, number];
export type ImageSource = { type: 'asset'; asset_id: string } | { type: 'static'; key: StaticImage };
export type StaticImage = 'everyone_wordmark' | 'casting_placeholder';
/** Runs share one line box; the first run's style sets the line height. */
export interface Run { text: string; style: TypeStyle }

export interface TextElement {
  kind: 'text'; box: Box; style: TypeStyle; text: string; align?: 'left' | 'center' | 'right';
  /** Single-line text never wraps; multi-line text wraps inside the fixed box. */
  wrap?: boolean; dir?: 'auto' | 'rtl'; lang?: string;
  /** Fit-measured region. Its key is reported with the page's source slide. */
  fit?: string; region?: boolean;
  /** `cap`: each ` | ` is drawn as the cover title's baseline-to-cap-height stem. */
  separator?: 'cap';
}
export interface RunsElement { kind: 'runs'; box: Box; runs: Run[]; highlight?: 'note' | 'fittingNote'; region?: boolean }
/** Top-anchored flowing column (cover title/date/note) so a wrapped title pushes the date down. */
export interface StackElement { kind: 'stack'; box: Box; items: (TextElement | RunsElement)[]; gaps: number[] }
export interface ImageElement {
  kind: 'image'; box: Box; source: ImageSource; alt: string;
  /** cover = crop to fill at the focal point; contain = whole image inside the box. */
  fit: 'cover' | 'contain'; focal?: readonly [number, number]; align?: 'left' | 'right' | 'center';
  /** Natural pixel size when known (frames); required for exact PowerPoint crops. */
  natural?: readonly [number, number]; role: 'frame' | 'logo' | 'brand' | 'placeholder' | 'media';
}
export interface LinkElement { kind: 'link'; box: Box; style: TypeStyle; text: string; target: { type: 'video'; asset_id: string } }
export type DeckElement = TextElement | RunsElement | StackElement | ImageElement | LinkElement;

export interface DeckPage {
  index: number; layout: LayoutId;
  /** Physical slide number, or null on the cover and closing page. */
  number: number | null;
  /** Fit/validation attribution: 0 = cover, n = n-th captured slide. */
  source_index: number;
  /** Every captured slide drawn on this page (a slot page shows up to three people). */
  sources?: number[];
  elements: DeckElement[];
}
export interface Deck { canvas: { width: 1920; height: 1080 }; title: string; pages: DeckPage[] }
