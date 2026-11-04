import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';
import type { RenderSnapshot } from '../../../packages/domain/src/presentation-types.ts';
import { parseRenderSnapshot, reviewFromRenderSnapshot, presentationCanonicalHash } from '../../../packages/domain/src/presentation.ts';
import { renderRegisteredReviewDocument } from '../../../packages/templates/src/registered.ts';
import { loadReviewTemplateAssets } from './review-fit.ts';
import { nativeBrowserEnvironment } from './native-browser.ts';
import { nativeSandboxConfiguration } from './native-sandbox.ts';
import { sandboxPresentation } from './native-sandbox-result.ts';
import { EDITORIAL_CANVAS, editorialDeck, editorialSnapshotOptions, editorialStructureMatches, isEditorialTemplate, measureEditorialPage } from './editorial-template.ts';

export const PRESENTATION_RENDERER = 'everyone-casting-pdf-v1';
export const PRESENTATION_PDF_LIMITS = Object.freeze({ pdfBytes: 64 * 1024 * 1024, imageBytes: 128 * 1024 * 1024 });
export class PresentationPdfError extends Error {
  constructor(readonly code: 'PDF_TEMPLATE_MISMATCH' | 'PDF_ASSET_INVALID' | 'PDF_OVERFLOW' | 'PDF_RENDER_FAILED' | 'PDF_VALIDATION_FAILED' | 'PDF_ABORTED' | 'PDF_BUDGET_EXCEEDED', readonly checkpoint?: string) {
    super('The fixed presentation artifact could not be verified. Saved versions remain unchanged.'); this.name = 'PresentationPdfError';
  }
}
const fail = (code: PresentationPdfError['code']): never => { throw new PresentationPdfError(code); };
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export interface PresentationRenderProof {
  renderer_version: typeof PRESENTATION_RENDERER; chromium_version: string; template_content_sha256: string; font_hashes: Record<string, string>;
  page_count: number; width_css_px: number; height_css_px: number; overflow_count: 0; candidate_field_count: number;
  frame_draw_count: number; logo_draw_count: number; video_link_count: number; fonts_ready: true; images_ready: true; link_targets_sha256: string; rendered_at: string;
}
export interface PresentationValidationProof {
  pdf_sha256: string; page_count: number; width_points: number; height_points: number; text_regions_checked: number;
  image_draws_checked: number; video_links_checked: number; embedded_font_count: number; validated_at: string;
}
export interface PresentationPdfOptions { signal?: AbortSignal; timeoutMs?: number }
/** Secret-bearing response from the export grant port. Never serialize this
 * access object into a snapshot, job, outbox, diagnostic or callback. */
export interface PresentationExportMediaAccess { version_id: string; grant_token: string }
interface ExpectedPage { regions: { field: string; text: string; source_text: string; direction: string; lines: { start: number; end: number; top: number }[]; rect: number[] }[]; images: { width: number; height: number; rect: number[]; fit?: string; focal?: number[] }[]; links: string[] }

/** No temporary object URL or guest token is allowed into canonical PDF bytes. */
export function presentationVideoHref(snapshot: RenderSnapshot, assetId: string): string {
  return `${snapshot.render_configuration.application_origin}/presentations/versions/${encodeURIComponent(snapshot.version_id)}/media/${encodeURIComponent(assetId)}`;
}
function checkedExportAccess(snapshot: RenderSnapshot, access: PresentationExportMediaAccess) {
  if (!access || typeof access !== 'object' || Array.isArray(access) || Object.keys(access).length !== 2
    || !Object.hasOwn(access, 'version_id') || !Object.hasOwn(access, 'grant_token') || access.version_id !== snapshot.version_id
    || typeof access.grant_token !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(access.grant_token)) fail('PDF_ASSET_INVALID');
  return access;
}
export function presentationExportVideoHref(snapshot: RenderSnapshot, assetId: string, access: PresentationExportMediaAccess): string {
  checkedExportAccess(snapshot, access);
  if (!snapshot.asset_inventory.some(asset => asset.asset_id === assetId && asset.asset_kind === 'candidate_video')
    || !snapshot.slides.some(slide => slide.video_asset_id === assetId)) fail('PDF_ASSET_INVALID');
  return `${snapshot.render_configuration.application_origin}/m/${access.grant_token}/versions/${snapshot.version_id}/media/${assetId}`;
}
function checkedSnapshot(supplied: RenderSnapshot, signal?: AbortSignal): RenderSnapshot {
  if (signal?.aborted) fail('PDF_ABORTED');
  try { return parseRenderSnapshot(supplied); } catch { return fail('PDF_TEMPLATE_MISMATCH'); }
}
function imageSources(snapshot: RenderSnapshot, images: ReadonlyMap<string, Uint8Array>): Record<string, string> {
  let total = 0; const result: Record<string, string> = {};
  const expected = snapshot.asset_inventory.filter(asset => asset.asset_kind !== 'candidate_video');
  if (images.size !== expected.length) fail('PDF_ASSET_INVALID');
  for (const asset of expected) {
    const bytes = images.get(asset.asset_id);
    if (!(bytes instanceof Uint8Array) || bytes.length !== asset.byte_size || hash(bytes) !== asset.sha256) return fail('PDF_ASSET_INVALID');
    const signature = asset.mime_type === 'image/png' ? Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : asset.mime_type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : asset.mime_type === 'image/webp' && Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' && Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP';
    if (!signature) fail('PDF_ASSET_INVALID'); total += bytes.length; if (total > PRESENTATION_PDF_LIMITS.imageBytes) fail('PDF_BUDGET_EXCEEDED');
    result[asset.asset_id] = `data:${asset.mime_type};base64,${Buffer.from(bytes).toString('base64')}`;
  }
  return result;
}
/** Preparation checks real frozen image bytes and the retained template/font
 * identities. Browser readiness/geometry is measured again at render/validate. */
export async function preparePresentationAssets(supplied: RenderSnapshot, images: ReadonlyMap<string, Uint8Array>, options: PresentationPdfOptions = {}) {
  const snapshot = checkedSnapshot(supplied, options.signal); let pinned: Awaited<ReturnType<typeof loadReviewTemplateAssets>>;
  try { pinned = await loadReviewTemplateAssets(snapshot.template); } catch { return fail('PDF_TEMPLATE_MISMATCH'); }
  if (options.signal?.aborted) fail('PDF_ABORTED');
  if (JSON.stringify(Object.entries(pinned.font_hashes).sort()) !== JSON.stringify(Object.entries(snapshot.template.font_hashes).sort())) fail('PDF_TEMPLATE_MISMATCH');
  imageSources(snapshot, images); return pinned;
}
async function documentOperation<T>(snapshot: RenderSnapshot, images: ReadonlyMap<string, Uint8Array>, options: PresentationPdfOptions,
  operation: (page: import('playwright').Page, expected: ExpectedPage[], proof: PresentationRenderProof) => Promise<T>, exportAccess?: PresentationExportMediaAccess): Promise<T> {
  const timeout = options.timeoutMs ?? 90000; if (!Number.isSafeInteger(timeout) || timeout < 100 || timeout > 120000) fail('PDF_BUDGET_EXCEEDED');
  const pinned = await preparePresentationAssets(snapshot, images, options); const sources = imageSources(snapshot, images);
  const review = reviewFromRenderSnapshot(snapshot);
  if (exportAccess && (exportAccess.version_id !== snapshot.version_id || Object.keys(exportAccess).length !== 2 || !/^[A-Za-z0-9_-]{43}$/u.test(exportAccess.grant_token))) fail('PDF_ASSET_INVALID');
  const videoHrefs = Object.fromEntries(snapshot.asset_inventory.filter(asset => asset.asset_kind === 'candidate_video').map(asset => [asset.asset_id, exportAccess ? presentationExportVideoHref(snapshot, asset.asset_id, exportAccess) : presentationVideoHref(snapshot, asset.asset_id)]));
  const controller = new AbortController(); const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  let browser: Browser | undefined; let abort!: () => void;
  const stopped = new Promise<never>((_resolve, reject) => { abort = () => { void browser?.close().catch(() => undefined); reject(new PresentationPdfError(options.signal?.aborted ? 'PDF_ABORTED' : 'PDF_RENDER_FAILED')); }; signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort(); });
  const timer = setTimeout(() => controller.abort(), timeout);
  const run = async () => {
    browser = await chromium.launch({ headless: true, timeout, env: nativeBrowserEnvironment(), args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run', '--force-color-profile=srgb'] });
    if (signal.aborted) { await browser.close(); fail('PDF_ABORTED'); }
    const editorial = isEditorialTemplate(snapshot.template);
    const context = await browser.newContext({ viewport: editorial ? { width: EDITORIAL_CANVAS.width, height: EDITORIAL_CANVAS.height } : { width: 1600, height: 900 }, javaScriptEnabled: false, serviceWorkers: 'block', offline: true, reducedMotion: 'reduce' });
    let blocked = 0; await context.route('**/*', route => { blocked++; return route.abort('blockedbyclient'); });
    const page = await context.newPage(); await page.emulateMedia({ media: 'print' });
    if (editorial) {
      // Everyone Film editorial 1.2.0: one composed deck drives markup, checks and proof.
      const deckOptions = editorialSnapshotOptions(snapshot); const deck = editorialDeck(review, deckOptions);
      await page.setContent(renderRegisteredReviewDocument(review, { ...pinned.assets, imageSources: sources, videoHrefs, ...deckOptions }), { waitUntil: 'load', timeout });
      const measured = await measureEditorialPage(page);
      if (signal.aborted) fail('PDF_ABORTED'); if (blocked || !measured.fonts || !measured.images) fail('PDF_ASSET_INVALID'); if (measured.overflows.length) fail('PDF_OVERFLOW');
      const inventory = new Map(snapshot.asset_inventory.map(asset => [asset.asset_id, asset]));
      // Decoded pixels must equal the frozen inventory size for every drawn asset.
      const natural = (id: string) => { const asset = inventory.get(id); return asset?.width && asset.height ? [asset.width, asset.height] as const : undefined; };
      if (!editorialStructureMatches(deck, measured, natural)) fail('PDF_RENDER_FAILED');
      const links = deck.pages.flatMap(item => item.elements.flatMap(element => element.kind === 'link' ? [videoHrefs[element.target.asset_id]] : []));
      if (JSON.stringify(measured.pages.flatMap(item => item.links)) !== JSON.stringify(links)) fail('PDF_RENDER_FAILED');
      const draws = (role: string) => deck.pages.flatMap(item => item.elements).filter(element => element.kind === 'image' && element.role === role).length;
      const proof: PresentationRenderProof = { renderer_version: PRESENTATION_RENDERER, chromium_version: browser.version(), template_content_sha256: snapshot.template.content_sha256, font_hashes: pinned.font_hashes,
        page_count: deck.pages.length, width_css_px: EDITORIAL_CANVAS.width, height_css_px: EDITORIAL_CANVAS.height, overflow_count: 0, candidate_field_count: deck.pages.filter(item => item.layout === 'cast_detail').length * 10,
        frame_draw_count: draws('frame'), logo_draw_count: draws('logo'), video_link_count: links.length, fonts_ready: true, images_ready: true,
        link_targets_sha256: await presentationCanonicalHash(links), rendered_at: new Date().toISOString() };
      return operation(page, measured.expected, proof);
    }
    await page.setContent(renderRegisteredReviewDocument(review, { ...pinned.assets, imageSources: sources, videoHrefs, versionLabel: `Version ${snapshot.version_no}` }), { waitUntil: 'load', timeout });
    const measured = await page.evaluate(async () => {
      await Promise.all(['Latin', 'Arabic'].flatMap(family => [400, 500, 600].map(weight => document.fonts.load(`${weight} 23px ${family}`, family === 'Arabic' ? 'تجربة' : 'Example'))));
      await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode()));
      const pages = [...document.querySelectorAll<HTMLElement>('.eps-page')]; let overflow = 0;
      const expected = pages.map((page, index) => {
        const base = page.getBoundingClientRect();
        if (Number(page.dataset.pageIndex) !== index || Math.abs(base.width - 1600) > 0.1 || Math.abs(base.height - 900) > 0.1 || page.scrollWidth > page.clientWidth + 1 || page.scrollHeight > page.clientHeight + 1) overflow++;
        const fields = [...page.querySelectorAll<HTMLElement>('[data-fit-field]')];
        for (const field of fields) if (field.scrollWidth > field.clientWidth + 1 || field.scrollHeight > field.clientHeight + 1) overflow++;
        const regions = [...page.querySelectorAll<HTMLElement>('[data-fit-field], .eps-field dt, .eps-requirement dt, .eps-position')].map((element, n) => {
          const rect = element.getBoundingClientRect(); const text = element.textContent ?? ''; const lines: { start: number; end: number; top: number }[] = [];
          if (element.childNodes.length === 1 && element.firstChild?.nodeType === Node.TEXT_NODE) {
            let offset = 0; for (const character of text) {
              const range = document.createRange(); range.setStart(element.firstChild, offset); range.setEnd(element.firstChild, offset + character.length);
              const measured = range.getClientRects()[0];
              if (measured && character.trim()) {
                const top = measured.top - base.top; const line = lines.find(line => Math.abs(line.top - top) < 1);
                if (line) line.end = offset + character.length - 1; else lines.push({ start: offset, end: offset + character.length - 1, top });
              }
              offset += character.length;
            }
          }
          lines.sort((left, right) => left.top - right.top);
          return { field: element.dataset.fitField ?? `label_${n}`, text: element.innerText, source_text: text, direction: getComputedStyle(element).direction, lines, rect: [rect.x - base.x, rect.y - base.y, rect.width, rect.height] };
        });
        const images = [...page.querySelectorAll<HTMLImageElement>('img:not(.eps-brand)')].map(image => { const rect = image.getBoundingClientRect(); return { width: image.naturalWidth, height: image.naturalHeight, rect: [rect.x - base.x, rect.y - base.y, rect.width, rect.height] }; });
        return { regions, images, links: [...page.querySelectorAll<HTMLAnchorElement>('a')].map(link => link.href) };
      });
      return { expected, overflow, fonts: document.fonts.status === 'loaded' && [...document.fonts].length === 6 && [...document.fonts].every(font => font.status === 'loaded'),
        images: [...document.images].every(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
        sources: [...document.querySelectorAll<HTMLImageElement>('img:not(.eps-brand)')].map(image => image.getAttribute('src')),
        fields: [...document.querySelectorAll('.eps-main .eps-fields')].map(group => group.querySelectorAll('[data-fit-field]').length),
        logos: document.querySelectorAll('.eps-client-logo').length, frames: document.querySelectorAll('.eps-images img').length };
    });
    if (signal.aborted) fail('PDF_ABORTED'); if (blocked || !measured.fonts || !measured.images) fail('PDF_ASSET_INVALID'); if (measured.overflow) fail('PDF_OVERFLOW');
    if (measured.expected.length !== snapshot.slides.length || measured.fields.length !== snapshot.slides.filter(slide => slide.kind === 'candidate').length || measured.fields.some(count => count !== 10)) fail('PDF_RENDER_FAILED');
    let sourceIndex = 0;
    for (const [index, slide] of snapshot.slides.entries()) {
      const logo = slide.logo_asset_id ? [snapshot.asset_inventory.find(asset => asset.asset_id === slide.logo_asset_id)!] : [];
      const assets = [...logo, ...slide.frames.map(frame => snapshot.asset_inventory.find(asset => asset.asset_id === frame.asset_id)!)];
      if (measured.expected[index].images.length !== assets.length) fail('PDF_ASSET_INVALID');
      for (const [n, asset] of assets.entries()) {
        const actual = measured.expected[index].images[n]; const [x, y, width, height] = actual.rect;
        if (measured.sources[sourceIndex++] !== sources[asset.asset_id] || actual.width !== asset.width || actual.height !== asset.height || width <= 0 || height <= 0 || x < 0 || y < 0 || x + width > 1601 || y + height > 901) fail('PDF_ASSET_INVALID');
      }
      const links = slide.video_asset_id ? [videoHrefs[slide.video_asset_id]] : [];
      if (JSON.stringify(measured.expected[index].links) !== JSON.stringify(links)) fail('PDF_RENDER_FAILED');
    }
    const proof: PresentationRenderProof = { renderer_version: PRESENTATION_RENDERER, chromium_version: browser.version(), template_content_sha256: snapshot.template.content_sha256, font_hashes: pinned.font_hashes,
      page_count: measured.expected.length, width_css_px: 1600, height_css_px: 900, overflow_count: 0, candidate_field_count: measured.fields.length * 10,
      frame_draw_count: measured.frames, logo_draw_count: measured.logos, video_link_count: measured.expected.reduce((sum, expected) => sum + expected.links.length, 0), fonts_ready: true, images_ready: true,
      link_targets_sha256: await presentationCanonicalHash(measured.expected.flatMap(expected => expected.links)), rendered_at: new Date().toISOString() };
    return operation(page, measured.expected, proof);
  };
  try { return await Promise.race([run(), stopped]); } catch (error) { if (error instanceof PresentationPdfError) throw error; return fail(options.signal?.aborted ? 'PDF_ABORTED' : 'PDF_RENDER_FAILED'); }
  finally { clearTimeout(timer); signal.removeEventListener('abort', abort); await browser?.close().catch(() => undefined); }
}
export async function renderPresentationPdf(supplied: RenderSnapshot, images: ReadonlyMap<string, Uint8Array>, options: PresentationPdfOptions = {}) {
  const snapshot = checkedSnapshot(supplied, options.signal);
  return renderDocumentPdf(snapshot, images, options);
}
async function renderDocumentPdf(snapshot: RenderSnapshot, images: ReadonlyMap<string, Uint8Array>, options: PresentationPdfOptions, exportAccess?: PresentationExportMediaAccess) {
  if (nativeSandboxConfiguration()) {
    await preparePresentationAssets(snapshot, images, options);
    return await sandboxPresentation(exportAccess ? 'presentation_export_render' : 'presentation_render', snapshot, images, options, undefined, exportAccess) as unknown as { bytes: Uint8Array; proof: PresentationRenderProof };
  }
  return documentOperation(snapshot, images, options, async (page, _expected, proof) => {
    const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true, scale: 1, displayHeaderFooter: false, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    if (options.signal?.aborted) fail('PDF_ABORTED'); if (!bytes.length || bytes.length > PRESENTATION_PDF_LIMITS.pdfBytes || bytes.subarray(0, 5).toString() !== '%PDF-') fail('PDF_BUDGET_EXCEEDED');
    return { bytes: new Uint8Array(bytes), proof };
  }, exportAccess);
}
export async function renderPresentationExportPdf(supplied: RenderSnapshot, images: ReadonlyMap<string, Uint8Array>, access: PresentationExportMediaAccess, options: PresentationPdfOptions = {}) {
  const snapshot = checkedSnapshot(supplied, options.signal);
  return renderDocumentPdf(snapshot, images, options, checkedExportAccess(snapshot, access));
}
async function inspect(bytes: Uint8Array, expected: ExpectedPage[], signal?: AbortSignal, pagePoints: [number, number] = [1200, 675]): Promise<PresentationValidationProof> {
  const source = fileURLToPath(new URL('./', import.meta.url)); const dependencies = fileURLToPath(new URL('../../../node_modules/', import.meta.url));
  const entry = fileURLToPath(new URL('./presentation-pdf-inspect-process.mjs', import.meta.url));
  const text = await new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, ['--max-old-space-size=512', '--permission', '--allow-addons', `--allow-fs-read=${source}`, `--allow-fs-read=${dependencies}`, entry], { shell: false, windowsHide: true, cwd: source, env: { ...nativeBrowserEnvironment(), NODE_ENV: 'production' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let diagnostic = 0; let problem = false;
    const stop = () => { problem = true; child.kill('SIGKILL'); }; const timer = setTimeout(stop, 60000); signal?.addEventListener('abort', stop, { once: true });
    child.on('error', stop); child.stdin.on('error', () => {}); child.stdout.on('data', chunk => { output += chunk.toString('utf8'); if (output.length > 65536) stop(); });
    child.stderr.on('data', chunk => { diagnostic += chunk.length; if (diagnostic > 65536) stop(); });
    child.on('close', code => { clearTimeout(timer); signal?.removeEventListener('abort', stop); if (problem || code !== 0) reject(new PresentationPdfError(signal?.aborted ? 'PDF_ABORTED' : 'PDF_VALIDATION_FAILED')); else resolve(output); });
    if (signal?.aborted) stop(); child.stdin.end(JSON.stringify({ bytes: Buffer.from(bytes).toString('base64'), expected, page_points: pagePoints }));
  });
  let value; try { value = JSON.parse(text); } catch { return fail('PDF_VALIDATION_FAILED'); }
  if (value.ok !== true || value.proof.pdf_sha256 !== hash(bytes)) throw new PresentationPdfError('PDF_VALIDATION_FAILED', typeof value.checkpoint === 'string' && /^[a-z_0-9]{1,40}$/u.test(value.checkpoint) ? value.checkpoint : undefined);
  return value.proof;
}
export async function validatePresentationPdf(supplied: RenderSnapshot, images: ReadonlyMap<string, Uint8Array>, bytes: Uint8Array, options: PresentationPdfOptions = {}): Promise<PresentationValidationProof> {
  const snapshot = checkedSnapshot(supplied, options.signal);
  if (!(bytes instanceof Uint8Array) || bytes.length < 100 || bytes.length > PRESENTATION_PDF_LIMITS.pdfBytes || Buffer.from(bytes.subarray(0, 5)).toString() !== '%PDF-') fail('PDF_VALIDATION_FAILED');
  if (nativeSandboxConfiguration()) { await preparePresentationAssets(snapshot, images, options); return await sandboxPresentation('presentation_validate', snapshot, images, options, bytes) as unknown as PresentationValidationProof; }
  const expected = await documentOperation(snapshot, images, options, async (_page, pages) => pages);
  return inspect(bytes, expected, options.signal, isEditorialTemplate(snapshot.template) ? [EDITORIAL_CANVAS.width_points, EDITORIAL_CANVAS.height_points] : [1200, 675]);
}
export async function validatePresentationExportPdf(supplied: RenderSnapshot, images: ReadonlyMap<string, Uint8Array>, bytes: Uint8Array, access: PresentationExportMediaAccess, options: PresentationPdfOptions = {}): Promise<PresentationValidationProof> {
  const snapshot = checkedSnapshot(supplied, options.signal);
  checkedExportAccess(snapshot, access);
  if (!(bytes instanceof Uint8Array) || bytes.length < 100 || bytes.length > PRESENTATION_PDF_LIMITS.pdfBytes || Buffer.from(bytes.subarray(0, 5)).toString() !== '%PDF-') fail('PDF_VALIDATION_FAILED');
  if (nativeSandboxConfiguration()) { await preparePresentationAssets(snapshot, images, options); return await sandboxPresentation('presentation_export_validate', snapshot, images, options, bytes, access) as unknown as PresentationValidationProof; }
  const expected = await documentOperation(snapshot, images, options, async (_page, pages) => pages, access);
  return inspect(bytes, expected, options.signal, isEditorialTemplate(snapshot.template) ? [EDITORIAL_CANVAS.width_points, EDITORIAL_CANVAS.height_points] : [1200, 675]);
}
