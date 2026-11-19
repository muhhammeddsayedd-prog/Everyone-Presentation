import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright';
import type { TemplateIdentity, WorkspaceReview } from '../../../packages/domain/src/review-types.ts';
import type { RenderSnapshot } from '../../../packages/domain/src/presentation-types.ts';
import { composeCastingDeck as composeEditorial, deckCounts as countsEditorial, editorialDateLabel } from '../../../packages/templates/versions/1.2.0/compose-casting.ts';
import { composeCastingDeck as composeSlots, deckCounts as countsSlots } from '../../../packages/templates/versions/1.3.0/compose-casting.ts';
import { composeCastingDeck as composeReference, deckCounts as countsReference } from '../../../packages/templates/versions/1.4.0/compose-casting.ts';
import type { Deck as ReferenceDeck } from '../../../packages/templates/versions/1.4.0/deck.ts';
import { composeCastingDeck as composeCaptioned, deckCounts as countsCaptioned } from '../../../packages/templates/versions/1.4.1/compose-casting.ts';
import type { Deck as CaptionedDeck } from '../../../packages/templates/versions/1.4.1/deck.ts';
import type { Deck as EditorialDeck } from '../../../packages/templates/versions/1.2.0/deck.ts';
import type { Deck as SlotDeck } from '../../../packages/templates/versions/1.3.0/deck.ts';
import type { TemplateAssets as EditorialAssets } from '../../../packages/templates/versions/1.2.0/render.ts';
import { slideWordingFields } from '../../../packages/domain/src/casting-types.ts';

/** Everyone Film editorial templates (1.2.0, 1.3.0 with one page per slot, 1.4.0 reproducing the
 * Floward cast shortlist, 1.4.1 adding name, age and height under each portrait) for the worker. All template-specific expectations come from each version's own composer,
 * never from constants repeated here, so fit, render, validation and the stage
 * checks cannot drift. Both versions share the canvas and the nine pinned fonts. */
const ROOT = path.resolve(import.meta.dirname, '../../..');
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
/** 1.3.0's deck model is a superset of 1.2.0's (same elements, two more layouts and styles); 1.4.0 and 1.4.1 add
 * optional owner/fit attributes only. */
export type Deck = SlotDeck;
type DeckReview = Pick<WorkspaceReview, 'cover' | 'slides' | 'output_type' | 'presentation'> & { template: Pick<TemplateIdentity, 'version'> };
type DeckOptions = Parameters<typeof composeEditorial>[1];
export const EDITORIAL_VERSIONS = ['1.2.0', '1.3.0', '1.4.0', '1.4.1'] as const;
export type EditorialVersion = typeof EDITORIAL_VERSIONS[number];
const COMPOSERS: Record<EditorialVersion, { compose: (review: Omit<DeckReview, 'template'>, options?: DeckOptions) => Deck; counts: (deck: Deck) => ReturnType<typeof countsEditorial> }> = {
  '1.2.0': { compose: (review, options) => composeEditorial(review, options) as unknown as Deck, counts: deck => countsEditorial(deck as unknown as EditorialDeck) },
  '1.3.0': { compose: composeSlots, counts: countsSlots },
  '1.4.0': { compose: (review, options) => composeReference(review, options) as unknown as Deck, counts: deck => countsReference(deck as unknown as ReferenceDeck) },
  '1.4.1': { compose: (review, options) => composeCaptioned(review, options) as unknown as Deck, counts: deck => countsCaptioned(deck as unknown as CaptionedDeck) },
};
/** 1.4.0 and 1.4.1 (like the reference) draw no original-video links in the PDF; the videos stay linked in the app and
 * guest view. Earlier editorial versions draw one link per captured slide with a video. */
export const editorialPdfLinksFollowSlides = (template: Pick<TemplateIdentity, 'version'>) => template.version !== '1.4.0' && template.version !== '1.4.1';
const rendererFiles = (version: EditorialVersion) => ['tokens.ts', 'deck.ts', 'layouts.ts', 'compose-casting.ts', 'html.ts', 'render.ts', 'pptx.ts', 'static-images.ts'].map(file => `packages/templates/versions/${version}/${file}`);
// Bound to the module bytes loaded by this process; a changed layout needs a fresh worker.
const LOADED_RENDERER = Object.fromEntries(EDITORIAL_VERSIONS.flatMap(version => rendererFiles(version)).map(file => [file, sha(readFileSync(path.join(ROOT, file)))]));
export const EDITORIAL_CANVAS = Object.freeze({ width: 1920, height: 1080, width_points: 1440, height_points: 810 });
export const isEditorialTemplate = (template: Pick<TemplateIdentity, 'key' | 'version'>): boolean => template.key === 'everyone-casting' && (EDITORIAL_VERSIONS as readonly string[]).includes(template.version);
function composer(template: Pick<TemplateIdentity, 'version'>) {
  if (!(EDITORIAL_VERSIONS as readonly string[]).includes(template.version)) throw new EditorialTemplateError();
  return COMPOSERS[template.version as EditorialVersion];
}

export class EditorialTemplateError extends Error { constructor() { super('TEMPLATE_MISMATCH'); this.name = 'EditorialTemplateError'; } }
const mismatch = (): never => { throw new EditorialTemplateError(); };

/** Verifies the registry, every renderer file, both static images and all nine
 * licensed font files against the exact snapshot identity, then inlines them. */
export async function loadEditorialTemplateAssets(expected: TemplateIdentity, read: (relative: string) => Promise<Uint8Array>): Promise<{ assets: EditorialAssets; font_hashes: Record<string, string> }> {
  if (!isEditorialTemplate(expected)) mismatch();
  const version = expected.version as EditorialVersion; const RENDERER_FILES = rendererFiles(version);
  const registry: unknown = JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(await read(`packages/templates/versions/${version}/registry.json`)));
  if (!object(registry) || registry.key !== expected.key || registry.version !== expected.version || registry.font_key !== expected.font_key || registry.content_sha256 !== expected.content_sha256 || !digest(expected.content_sha256)) mismatch();
  const record = registry as Record<string, unknown>; const body = { ...record }; delete body.content_sha256;
  if (sha(canonical(body)) !== expected.content_sha256 || record.width !== 1920 || record.height !== 1080 || !Array.isArray(record.renderer_files) || record.renderer_files.length !== RENDERER_FILES.length) mismatch();
  for (const [index, file] of (record.renderer_files as unknown[]).entries()) {
    if (!object(file) || file.path !== RENDERER_FILES[index] || file.sha256 !== LOADED_RENDERER[RENDERER_FILES[index]] || sha(await read(RENDERER_FILES[index])) !== file.sha256) mismatch();
  }
  const statics = record.static_images; if (!object(statics)) return mismatch();
  const staticImages: NonNullable<EditorialAssets['staticImages']> = {};
  for (const [key, mime] of [['everyone_wordmark', 'image/svg+xml'], ['casting_placeholder', 'image/png']] as const) {
    const entry = statics[key]; if (!object(entry) || typeof entry.path !== 'string' || !digest(entry.sha256)) return mismatch();
    const bytes = await read(entry.path); if (sha(bytes) !== entry.sha256 || bytes.byteLength !== entry.bytes) mismatch();
    staticImages[key] = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
  }
  if (!Array.isArray(record.fonts) || record.fonts.length !== 9) mismatch();
  const font_hashes: Record<string, string> = {}; const fontFaces: NonNullable<EditorialAssets['fontFaces']> = [];
  for (const font of record.fonts as unknown[]) {
    if (!object(font) || typeof font.path !== 'string' || !digest(font.sha256) || !/^apps\/web\/public\/fonts\/(?:GeneralSans-(?:Extralight|Light|Regular|Medium|Semibold|Bold)\.ttf|IBMPlexSansArabic-(?:Regular|Medium|SemiBold)\.woff2)$/u.test(font.path)
      || (font.family !== 'Latin' && font.family !== 'Arabic') || ![200, 300, 400, 500, 600, 700].includes(font.weight as number) || Object.hasOwn(font_hashes, font.path)) mismatch();
    const typed = font as { path: string; sha256: string; bytes: number; family: 'Latin' | 'Arabic'; weight: 200 | 300 | 400 | 500 | 600 | 700 };
    const bytes = await read(typed.path); if (sha(bytes) !== typed.sha256 || bytes.byteLength !== typed.bytes) mismatch();
    font_hashes[typed.path] = typed.sha256; fontFaces.push({ family: typed.family, weight: typed.weight, source: `data:font/${typed.path.endsWith('.ttf') ? 'ttf' : 'woff2'};base64,` + Buffer.from(bytes).toString('base64') });
  }
  if (new Set(fontFaces.map(face => face.family + ':' + face.weight)).size !== 9) mismatch();
  return { font_hashes, assets: { fontFaces, staticImages } };
}

export { editorialDateLabel };
export function editorialSnapshotOptions(snapshot: RenderSnapshot) {
  const logo = snapshot.cover.logo_asset_id ? snapshot.asset_inventory.find(asset => asset.asset_id === snapshot.cover.logo_asset_id) : undefined;
  return { versionLabel: `Version ${snapshot.version_no}`, versionNumber: snapshot.version_no, dateLabel: editorialDateLabel(snapshot.created_at), logoNatural: logo?.width && logo.height ? [logo.width, logo.height] as const : undefined };
}
export function editorialDeck(review: DeckReview, options: DeckOptions = {}): Deck { return composer(review.template).compose(review, options); }
/** Captured candidate slides drawn on person pages (1.2.0: one per page; 1.3.0: up to three per slot page;
 * 1.4.0/1.4.1: each assignment at least once on a portrait page, counted once). */
export function editorialPersonSlides(deck: Deck) {
  // 1.4.0/1.4.1 portrait pages always name their sources; 1.2.0 overview pages of the same layout names do not.
  const portraits = (deck.pages as Deck['pages']).filter(page => ['cast_main_backup', 'cast_group_strip', 'cast_single'].includes(page.layout) && (page as { sources?: number[] }).sources !== undefined);
  if (portraits.length) return new Set(portraits.flatMap(page => (page as { sources?: number[] }).sources ?? [])).size;
  return (deck.pages as Deck['pages']).filter(page => page.layout === 'cast_detail' || page.layout === 'cast_group_detail').reduce((sum, page) => sum + ((page as { sources?: number[] }).sources?.length ?? 1), 0);
}

/** Proof expectations derived from the captured review. The database applies the
 * same rule (eps.editorial_deck_counts) to the frozen snapshot independently. */
export function editorialExpectations(review: DeckReview) {
  const { compose, counts: count } = composer(review.template); const deck = compose(review); const counts = count(deck);
  const placeholders = (deck.pages as Deck['pages']).flatMap(page => page.elements).filter(element => element.kind === 'image' && element.source.type === 'static' && element.source.key === 'casting_placeholder').length;
  return { deck, page_count: counts.pages, candidate_field_count: counts.candidate_fields, frame_draw_count: counts.frame_draws, logo_draw_count: counts.logo_draws,
    video_link_count: counts.video_links, text_regions: counts.text_regions, image_draws: counts.frame_draws + counts.logo_draws + placeholders, ...EDITORIAL_CANVAS };
}

export interface EditorialMeasurement {
  pages: { index: number; source_index: number; layout: string; width: number; height: number; candidate_fields: number; missing: number;
    assets: { asset_id: string; natural: [number, number] }[]; statics: string[]; links: string[]; overflow: boolean }[];
  overflows: { slide_index: number; field: string; axis: 'horizontal' | 'vertical'; overflow_px: number }[];
  fonts: boolean; images: boolean;
  expected: { regions: { field: string; text: string; source_text: string; direction: string; lines: { start: number; end: number; top: number }[]; rect: number[] }[]; images: { width: number; height: number; rect: number[]; fit: string; focal: number[] }[]; links: string[] }[];
}
/** Single in-browser pass shared by fit and PDF rendering. JavaScript is disabled
 * in the page; this runs only as Playwright's isolated evaluation. */
export async function measureEditorialPage(page: Page, candidateFields: readonly string[] = slideWordingFields): Promise<EditorialMeasurement> {
  return page.evaluate(async (fieldKeys: readonly string[]) => {
    const faces = [['EF General Sans', [200, 300, 400, 500, 600, 700]], ['EF Arabic', [400, 500, 600]]] as const;
    await Promise.all(faces.flatMap(([family, weights]) => weights.map(weight => document.fonts.load(`${weight} 30px "${family}"`, family === 'EF Arabic' ? 'تجربة' : 'Example'))));
    await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode().catch(() => undefined)));
    const loaded = [...document.fonts].filter(font => ['EF General Sans', 'EF Arabic'].includes(font.family.replaceAll('"', '')));
    const fonts = document.fonts.status === 'loaded' && loaded.length === 9 && loaded.every(font => font.status === 'loaded');
    const images = [...document.images].every(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
    const overflows: { slide_index: number; field: string; axis: 'horizontal' | 'vertical'; overflow_px: number }[] = [];
    const slides = [...document.querySelectorAll<HTMLElement>('.ef-slide')];
    const pages = slides.map(slide => {
      const index = Number(slide.dataset.pageIndex); const source = Number(slide.dataset.sourceIndex); const rect = slide.getBoundingClientRect();
      for (const element of slide.querySelectorAll<HTMLElement>('[data-fit-field]')) {
        const field = element.dataset.fitField!;
        // A slot page shows several people; each fit region names its own captured slide.
        const owner = element.dataset.fitSource === undefined ? source : Number(element.dataset.fitSource);
        if (element.scrollHeight - element.clientHeight > 1) overflows.push({ slide_index: owner, field, axis: 'vertical', overflow_px: element.scrollHeight - element.clientHeight });
        if (element.scrollWidth - element.clientWidth > 1) overflows.push({ slide_index: owner, field, axis: 'horizontal', overflow_px: element.scrollWidth - element.clientWidth });
      }
      const overflow = slide.scrollWidth > slide.clientWidth + 1 || slide.scrollHeight > slide.clientHeight + 1;
      if (overflow) overflows.push({ slide_index: source, field: 'layout', axis: slide.scrollWidth > slide.clientWidth + 1 ? 'horizontal' : 'vertical', overflow_px: Math.max(slide.scrollWidth - slide.clientWidth, slide.scrollHeight - slide.clientHeight) });
      return { index, source_index: source, layout: slide.dataset.layout ?? '', width: rect.width, height: rect.height,
        candidate_fields: [...slide.querySelectorAll<HTMLElement>('[data-fit-field]')].filter(element => fieldKeys.includes(element.dataset.fitField!)).length,
        missing: slide.querySelectorAll('.ef-missing, [data-link-pending]').length,
        assets: [...slide.querySelectorAll<HTMLElement>('.ef-media[data-asset-id]')].map(media => { const image = media.querySelector('img'); return { asset_id: media.dataset.assetId!, natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0] as [number, number] }; }),
        statics: [...slide.querySelectorAll<HTMLElement>('.ef-media[data-static]')].map(media => media.dataset.static!), links: [...slide.querySelectorAll<HTMLAnchorElement>('a')].map(link => link.href), overflow };
    });
    const expected = slides.map(slide => {
      const base = slide.getBoundingClientRect();
      const regions = [...slide.querySelectorAll<HTMLElement>('[data-region]')].map((element, n) => {
        const rect = element.getBoundingClientRect(); const text = element.textContent ?? ''; const lines: { start: number; end: number; top: number }[] = [];
        if (element.childNodes.length === 1 && element.firstChild?.nodeType === Node.TEXT_NODE) {
          let offset = 0; for (const character of text) {
            const range = document.createRange(); range.setStart(element.firstChild, offset); range.setEnd(element.firstChild, offset + character.length);
            const box = range.getClientRects()[0];
            if (box && character.trim()) { const top = box.top - base.top; const line = lines.find(item => Math.abs(item.top - top) < 1); if (line) line.end = offset + character.length - 1; else lines.push({ start: offset, end: offset + character.length - 1, top }); }
            offset += character.length;
          }
        }
        lines.sort((left, right) => left.top - right.top);
        return { field: element.dataset.fitField ?? `region_${n}`, text: element.innerText, source_text: text, direction: getComputedStyle(element).direction, lines, rect: [rect.x - base.x, rect.y - base.y, rect.width, rect.height] };
      });
      // The SVG wordmark is drawn as vector paths, not an image object, so it is excluded.
      const drawn = [...slide.querySelectorAll<HTMLElement>('.ef-media:not([data-static="everyone_wordmark"])')].map(media => {
        const image = media.querySelector('img')!; const rect = media.getBoundingClientRect(); const style = getComputedStyle(image);
        const position = style.objectPosition.split(' ').map(value => value.endsWith('%') ? Number.parseFloat(value) / 100 : value === 'left' || value === 'top' ? 0 : value === 'right' || value === 'bottom' ? 1 : 0.5);
        return { width: image.naturalWidth, height: image.naturalHeight, rect: [rect.x - base.x, rect.y - base.y, rect.width, rect.height], fit: style.objectFit, focal: position };
      });
      return { regions, images: drawn, links: [...slide.querySelectorAll<HTMLAnchorElement>('a')].map(link => link.href) };
    });
    return { pages, overflows, fonts, images, expected };
  }, candidateFields);
}

/** Structural agreement between the composed deck and the rendered DOM. */
export function editorialStructureMatches(deck: Deck, measured: EditorialMeasurement, naturalSize?: (assetId: string) => readonly [number, number] | undefined) {
  if (measured.pages.length !== deck.pages.length) return false;
  return (deck.pages as Deck['pages']).every((page, n) => {
    const actual = measured.pages[n]; const elements = page.elements.flatMap(element => element.kind === 'stack' ? element.items : [element]);
    const assets = elements.filter(element => element.kind === 'image' && element.source.type === 'asset').map(element => (element as { source: { asset_id: string } }).source.asset_id);
    const statics = elements.filter(element => element.kind === 'image' && element.source.type === 'static').map(element => (element as { source: { key: string } }).source.key);
    if (actual.index !== n || actual.source_index !== page.source_index || actual.layout !== page.layout || Math.abs(actual.width - 1920) > 0.1 || Math.abs(actual.height - 1080) > 0.1 || actual.missing !== 0) return false;
    // Every candidate fact the composer drew must be in the DOM (1.2.0: ten per detail page; 1.3.0: only the provided ones).
    if (actual.candidate_fields !== elements.filter(element => element.kind === 'text' && element.fit !== undefined && (slideWordingFields as readonly string[]).includes(element.fit)).length) return false;
    if (JSON.stringify(actual.assets.map(item => item.asset_id)) !== JSON.stringify(assets) || JSON.stringify(actual.statics) !== JSON.stringify(statics)) return false;
    if (naturalSize && actual.assets.some(item => { const expected = naturalSize(item.asset_id); return !expected || expected[0] !== item.natural[0] || expected[1] !== item.natural[1]; })) return false;
    return actual.links.length === elements.filter(element => element.kind === 'link').length;
  });
}
