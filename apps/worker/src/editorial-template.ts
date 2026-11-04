import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright';
import type { TemplateIdentity, WorkspaceReview } from '../../../packages/domain/src/review-types.ts';
import type { RenderSnapshot } from '../../../packages/domain/src/presentation-types.ts';
import { composeCastingDeck, deckCounts, editorialDateLabel } from '../../../packages/templates/versions/1.2.0/compose-casting.ts';
import type { Deck } from '../../../packages/templates/versions/1.2.0/deck.ts';
import type { TemplateAssets as EditorialAssets } from '../../../packages/templates/versions/1.2.0/render.ts';
import { slideWordingFields } from '../../../packages/domain/src/casting-types.ts';

/** Everyone Film editorial template 1.2.0 support for the worker. All template-
 * specific expectations come from the shared composer, never from constants
 * repeated here, so fit, render, validation and the stage checks cannot drift. */
const ROOT = path.resolve(import.meta.dirname, '../../..');
const REGISTRY = 'packages/templates/versions/1.2.0/registry.json';
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
const RENDERER_FILES = ['tokens.ts', 'deck.ts', 'layouts.ts', 'compose-casting.ts', 'html.ts', 'render.ts', 'pptx.ts', 'static-images.ts'].map(file => `packages/templates/versions/1.2.0/${file}`);
// Bound to the module bytes loaded by this process; a changed layout needs a fresh worker.
const LOADED_RENDERER = Object.fromEntries(RENDERER_FILES.map(file => [file, sha(readFileSync(path.join(ROOT, file)))]));
export const EDITORIAL_VERSION = '1.2.0';
export const EDITORIAL_CANVAS = Object.freeze({ width: 1920, height: 1080, width_points: 1440, height_points: 810 });
export const isEditorialTemplate = (template: Pick<TemplateIdentity, 'key' | 'version'>) => template.key === 'everyone-casting' && template.version === EDITORIAL_VERSION;

export class EditorialTemplateError extends Error { constructor() { super('TEMPLATE_MISMATCH'); this.name = 'EditorialTemplateError'; } }
const mismatch = (): never => { throw new EditorialTemplateError(); };

/** Verifies the registry, every renderer file, both static images and all nine
 * licensed font files against the exact snapshot identity, then inlines them. */
export async function loadEditorialTemplateAssets(expected: TemplateIdentity, read: (relative: string) => Promise<Uint8Array>): Promise<{ assets: EditorialAssets; font_hashes: Record<string, string> }> {
  const registry: unknown = JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(await read(REGISTRY)));
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
  return { versionLabel: `Version ${snapshot.version_no}`, dateLabel: editorialDateLabel(snapshot.created_at), logoNatural: logo?.width && logo.height ? [logo.width, logo.height] as const : undefined };
}
export function editorialDeck(review: Pick<WorkspaceReview, 'cover' | 'slides' | 'output_type'>, options: Parameters<typeof composeCastingDeck>[1] = {}): Deck { return composeCastingDeck(review, options); }

/** Proof expectations derived from the captured review. The database applies the
 * same rule (eps.editorial_deck_counts) to the frozen snapshot independently. */
export function editorialExpectations(review: Pick<WorkspaceReview, 'cover' | 'slides' | 'output_type'>) {
  const deck = composeCastingDeck(review); const counts = deckCounts(deck);
  const placeholders = deck.pages.flatMap(page => page.elements).filter(element => element.kind === 'image' && element.source.type === 'static' && element.source.key === 'casting_placeholder').length;
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
        if (element.scrollHeight - element.clientHeight > 1) overflows.push({ slide_index: source, field, axis: 'vertical', overflow_px: element.scrollHeight - element.clientHeight });
        if (element.scrollWidth - element.clientWidth > 1) overflows.push({ slide_index: source, field, axis: 'horizontal', overflow_px: element.scrollWidth - element.clientWidth });
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
  return deck.pages.every((page, n) => {
    const actual = measured.pages[n]; const elements = page.elements.flatMap(element => element.kind === 'stack' ? element.items : [element]);
    const assets = elements.filter(element => element.kind === 'image' && element.source.type === 'asset').map(element => (element as { source: { asset_id: string } }).source.asset_id);
    const statics = elements.filter(element => element.kind === 'image' && element.source.type === 'static').map(element => (element as { source: { key: string } }).source.key);
    if (actual.index !== n || actual.source_index !== page.source_index || actual.layout !== page.layout || Math.abs(actual.width - 1920) > 0.1 || Math.abs(actual.height - 1080) > 0.1 || actual.missing !== 0) return false;
    // Overview portraits carry a name_or_id fit too; the ten-field contract is per detail page.
    if (page.layout === 'cast_detail' && actual.candidate_fields !== 10) return false;
    if (JSON.stringify(actual.assets.map(item => item.asset_id)) !== JSON.stringify(assets) || JSON.stringify(actual.statics) !== JSON.stringify(statics)) return false;
    if (naturalSize && actual.assets.some(item => { const expected = naturalSize(item.asset_id); return !expected || expected[0] !== item.natural[0] || expected[1] !== item.natural[1]; })) return false;
    return actual.links.length === elements.filter(element => element.kind === 'link').length;
  });
}
