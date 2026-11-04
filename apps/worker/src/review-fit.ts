import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import type { ReviewFit, TemplateIdentity, WorkspaceReview } from '../../../packages/domain/src/review-types.ts';
import { workspaceReviewDto } from '../../../packages/central/src/review-dto.ts';
import type { TemplateAssets } from '../../../packages/templates/src/render.ts';
import { renderRegisteredReviewDocument, type RegisteredTemplateAssets } from '../../../packages/templates/src/registered.ts';
import { editorialDeck, editorialStructureMatches, isEditorialTemplate, loadEditorialTemplateAssets, measureEditorialPage } from './editorial-template.ts';
import { nativeBrowserEnvironment } from './native-browser.ts';
import { nativeSandboxConfiguration, runConfiguredNative } from './native-sandbox.ts';
import { decodeNativeResult } from './native-sandbox-result.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const RENDERER = 'packages/templates/src/render.ts';
const REGISTRY = 'packages/templates/registry.json';
const BRAND = 'apps/web/public/brand/everyone-logotype.svg';
const COMPLETE_RENDERER = 'packages/templates/versions/1.1.0/render.ts';
const COMPLETE_REGISTRY = 'packages/templates/versions/1.1.0/registry.json';
const COMPLETE_BRAND = 'apps/web/public/brand/everyone-logotype-white.svg';
// Fit checks the registered logo box; factual/image verification is separate.
// This inert pixel creates the same fixed-size conditional element without
// loading any private client image or changing the frozen template.
const GEOMETRY_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
// Bind this loaded module to its renderer source. Updating a registered layout
// requires a fresh worker, rather than measuring with an older cached function.
const LOADED_RENDERER_SHA = sha(readFileSync(path.join(ROOT, RENDERER)));
const LOADED_COMPLETE_RENDERER_SHA = sha(readFileSync(path.join(ROOT, COMPLETE_RENDERER)));
export const REVIEW_FIT_RENDERER_VERSION = 'everyone-casting-fit-v1';
export interface ReviewFitMeasurement {
  schema_version: '1.0'; input_fingerprint: string; template_content_sha256: string; renderer_version: string; chromium_version: string;
  font_hashes: Record<string, string>; overflows: ReviewFit['overflows']; measured_at: string;
}
type FitCode = 'FIT_TEMPLATE_MISMATCH' | 'FIT_FONT_UNAVAILABLE' | 'FIT_EXTERNAL_RESOURCE' | 'FIT_BUDGET_EXCEEDED' | 'FIT_MEASUREMENT_FAILED' | 'FIT_ABORTED';
export class ReviewFitError extends Error {
  constructor(readonly code: FitCode) { super('The exact presentation layout could not be measured. Saved inputs remain unchanged.'); this.name = 'ReviewFitError'; }
}
function fail(code: FitCode): never { throw new ReviewFitError(code); }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
async function publicRead(relative: string): Promise<Uint8Array> {
  const file = path.join(ROOT, relative); const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024 || path.resolve(await realpath(file)).toLowerCase() !== file.toLowerCase()) fail('FIT_TEMPLATE_MISMATCH');
  return readFile(file);
}
/** Fixed registered public assets only. The injected reader is an offline
 * tamper-test seam; a job cannot supply a path, URL, browser or font override. */
export async function loadReviewTemplateAssets(expected: TemplateIdentity, options: { read?: (file: string) => Promise<Uint8Array> } = {}): Promise<{ assets: RegisteredTemplateAssets; font_hashes: Record<string, string> }> {
  try {
    const read = options.read ? (relative: string) => options.read!(path.join(ROOT, relative)) : publicRead;
    if (isEditorialTemplate(expected)) return await loadEditorialTemplateAssets(expected, read);
    const complete = expected.version === '1.1.0'; if (!complete && expected.version !== '1.0.0') fail('FIT_TEMPLATE_MISMATCH');
    const registryFile = complete ? COMPLETE_REGISTRY : REGISTRY; const rendererFile = complete ? COMPLETE_RENDERER : RENDERER; const brandFile = complete ? COMPLETE_BRAND : BRAND; const loadedSha = complete ? LOADED_COMPLETE_RENDERER_SHA : LOADED_RENDERER_SHA;
    const registry: unknown = JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(await read(registryFile)));
    if (!object(registry) || registry.key !== expected.key || registry.version !== expected.version || registry.font_key !== expected.font_key || registry.content_sha256 !== expected.content_sha256 || !digest(expected.content_sha256)) fail('FIT_TEMPLATE_MISMATCH');
    const body = { ...registry }; delete body.content_sha256;
    if (registry.renderer_path !== rendererFile || registry.brand_path !== brandFile) fail('FIT_TEMPLATE_MISMATCH');
    const renderer = await read(rendererFile); const brand = await read(brandFile);
    if (sha(canonical(body)) !== expected.content_sha256 || registry.width !== 1600 || registry.height !== 900 || registry.renderer_sha256 !== loadedSha || sha(renderer) !== loadedSha || sha(brand) !== registry.brand_sha256 || !Array.isArray(registry.fonts) || registry.fonts.length !== 6) fail('FIT_TEMPLATE_MISMATCH');
    const font_hashes: Record<string, string> = {}; const fontFaces: NonNullable<TemplateAssets['fontFaces']> = [];
    for (const font of registry.fonts) {
      if (!object(font) || typeof font.path !== 'string' || !digest(font.sha256)) fail('FIT_TEMPLATE_MISMATCH');
      const match = /^apps\/web\/public\/fonts\/IBMPlexSans(Arabic)?-(Regular|Medium|SemiBold)\.woff2$/u.exec(font.path);
      if (!match || Object.hasOwn(font_hashes, font.path)) fail('FIT_TEMPLATE_MISMATCH');
      const bytes = await read(font.path); if (sha(bytes) !== font.sha256 || bytes.byteLength !== font.bytes) fail('FIT_TEMPLATE_MISMATCH');
      font_hashes[font.path] = font.sha256;
      fontFaces.push({ family: match[1] ? 'Arabic' : 'Latin', weight: match[2] === 'Regular' ? 400 : match[2] === 'Medium' ? 500 : 600, source: 'data:font/woff2;base64,' + Buffer.from(bytes).toString('base64') });
    }
    if (new Set(fontFaces.map(font => font.family + ':' + font.weight)).size !== 6) fail('FIT_TEMPLATE_MISMATCH');
    return { font_hashes, assets: { fontFaces, brandLogo: 'data:image/svg+xml;base64,' + Buffer.from(brand).toString('base64') } };
  } catch (error) { if (error instanceof ReviewFitError) throw error; return fail('FIT_TEMPLATE_MISMATCH'); }
}
export interface ReviewFitOptions { signal?: AbortSignal; timeoutMs?: number }
/** Native worker browser measurement, without HTTP listeners, Next handlers,
 * external navigation, traces, screenshots or source-text diagnostics. */
export async function measureReviewFit(supplied: WorkspaceReview, options: ReviewFitOptions = {}): Promise<ReviewFitMeasurement> {
  if (options.signal?.aborted) fail('FIT_ABORTED');
  let review: WorkspaceReview; try { review = workspaceReviewDto(supplied); } catch { return fail('FIT_TEMPLATE_MISMATCH'); }
  if (review.slides.length > 1000 || Buffer.byteLength(JSON.stringify(review), 'utf8') > 8 * 1024 * 1024) fail('FIT_BUDGET_EXCEEDED');
  const timeout = options.timeoutMs ?? 60000; if (!Number.isSafeInteger(timeout) || timeout < 100 || timeout > 90000) fail('FIT_BUDGET_EXCEEDED');
  if (nativeSandboxConfiguration()) return decodeNativeResult(await runConfiguredNative('review_fit', JSON.stringify({ review, timeout_ms: timeout }), { signal: options.signal, timeoutMs: timeout })) as ReviewFitMeasurement;
  const pinned = await loadReviewTemplateAssets(review.template);
  if (options.signal?.aborted) fail('FIT_ABORTED');
  const controller = new AbortController(); const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  let browser: Browser | undefined; let abort!: () => void;
  const interrupted = new Promise<never>((_resolve, reject) => { abort = () => { void browser?.close().catch(() => undefined); reject(new ReviewFitError(options.signal?.aborted ? 'FIT_ABORTED' : 'FIT_MEASUREMENT_FAILED')); }; signal.addEventListener('abort', abort, { once: true }); });
  const timer = setTimeout(() => controller.abort(), timeout);
  const operation = async (): Promise<ReviewFitMeasurement> => {
    browser = await chromium.launch({ headless: true, timeout, env: nativeBrowserEnvironment(), args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run', '--force-color-profile=srgb'] });
    if (signal.aborted) { await browser.close(); fail('FIT_ABORTED'); }
    const version = browser.version(); if (!/^[0-9]+(?:\.[0-9]+){2,3}$/u.test(version)) fail('FIT_MEASUREMENT_FAILED');
    const editorial = isEditorialTemplate(review.template);
    const context = await browser.newContext({ viewport: editorial ? { width: 1920, height: 1080 } : { width: 1600, height: 900 }, serviceWorkers: 'block', javaScriptEnabled: false, offline: true, reducedMotion: 'reduce' });
    let blocked = 0; await context.route('**/*', route => { blocked++; return route.abort('blockedbyclient'); });
    // Editorial frame/logo boxes are fixed by the composer; an inert pixel fills each box.
    const imageSources = editorial ? Object.fromEntries([...review.cover.logo_asset_id ? [review.cover.logo_asset_id] : [], ...review.slides.flatMap(slide => slide.frames.map(frame => frame.asset_id))].map(id => [id, GEOMETRY_PIXEL]))
      : review.cover.logo_asset_id ? { [review.cover.logo_asset_id]: GEOMETRY_PIXEL } : undefined;
    // A non-navigated relative link preserves the registered footer text/DOM.
    // Fit does not mint or inspect original-video access credentials.
    const videoHrefs = Object.fromEntries(review.slides.flatMap(slide => slide.video_asset_id ? [[slide.video_asset_id, '/original-video']] : []));
    const page = await context.newPage(); await page.setContent(renderRegisteredReviewDocument(review, { ...pinned.assets, imageSources, videoHrefs }), { waitUntil: 'load', timeout });
    if (editorial) {
      const result = await measureEditorialPage(page);
      if (!result.fonts) fail('FIT_FONT_UNAVAILABLE'); if (blocked) fail('FIT_EXTERNAL_RESOURCE');
      if (!editorialStructureMatches(editorialDeck(review), result) || result.pages.filter(item => item.layout === 'cast_detail').length !== review.candidate_slide_count) fail('FIT_MEASUREMENT_FAILED');
      if (result.overflows.length > 10000) fail('FIT_BUDGET_EXCEEDED');
      return { schema_version: '1.0', input_fingerprint: review.input_fingerprint, template_content_sha256: review.template.content_sha256, renderer_version: REVIEW_FIT_RENDERER_VERSION, chromium_version: version, font_hashes: pinned.font_hashes, overflows: result.overflows, measured_at: new Date().toISOString() };
    }
    const loaded = await page.evaluate(async () => {
      await Promise.all(['Latin', 'Arabic'].flatMap(family => [400, 500, 600].map(weight => document.fonts.load(`${weight} 23px ${family}`, family === 'Arabic' ? 'تجربة' : 'Example'))));
      await document.fonts.ready;
      return document.fonts.status === 'loaded' && [...document.fonts].filter(font => ['Latin', 'Arabic'].includes(font.family.replaceAll('"', ''))).length === 6 && [...document.fonts].every(font => font.status === 'loaded');
    });
    if (!loaded) fail('FIT_FONT_UNAVAILABLE');
    const measured = await page.evaluate(() => {
      const result: { slide_index: number; field: string; axis: 'horizontal' | 'vertical'; overflow_px: number }[] = [];
      const pages = [...document.querySelectorAll<HTMLElement>('.eps-page')];
      for (const page of pages) {
        const index = Number(page.dataset.pageIndex);
        for (const element of page.querySelectorAll<HTMLElement>('[data-fit-field]')) {
          const field = element.dataset.fitField!;
          if (element.scrollHeight - element.clientHeight > 1) result.push({ slide_index: index, field, axis: 'vertical', overflow_px: element.scrollHeight - element.clientHeight });
          if (element.scrollWidth - element.clientWidth > 1) result.push({ slide_index: index, field, axis: 'horizontal', overflow_px: element.scrollWidth - element.clientWidth });
        }
        if (page.scrollWidth - page.clientWidth > 1) result.push({ slide_index: index, field: 'layout', axis: 'horizontal', overflow_px: page.scrollWidth - page.clientWidth });
        if (page.scrollHeight - page.clientHeight > 1) result.push({ slide_index: index, field: 'layout', axis: 'vertical', overflow_px: page.scrollHeight - page.clientHeight });
      }
      return { pages: pages.length, fields: document.querySelectorAll('[data-fit-field]').length, candidate_fields: [...document.querySelectorAll('.eps-main .eps-fields')].map(group => group.querySelectorAll('[data-fit-field]').length),
        logos: [...document.querySelectorAll<HTMLElement>('.eps-client-logo')].map(logo => ({ page: Number(logo.closest<HTMLElement>('.eps-page')?.dataset.pageIndex), cover: logo.classList.contains('eps-cover-logo'), width: logo.clientWidth, height: logo.clientHeight })),
        videoPages: [...document.querySelectorAll<HTMLAnchorElement>('.eps-footer a')].map(link => Number(link.closest<HTMLElement>('.eps-page')?.dataset.pageIndex)), overflows: result };
    });
    if (blocked) fail('FIT_EXTERNAL_RESOURCE');
    if (measured.pages !== review.slides.length + 1 || measured.fields < 3 || measured.candidate_fields.length !== review.candidate_slide_count || measured.candidate_fields.some(count => count !== 10)) fail('FIT_MEASUREMENT_FAILED');
    const logoPages = review.cover.logo_asset_id ? review.cover.logo_placement === 'every_slide' ? Array.from({ length: review.slides.length + 1 }, (_value, index) => index) : [0] : [];
    if (measured.logos.length !== logoPages.length || measured.logos.some((logo, index) => logo.page !== logoPages[index] || logo.cover !== (logo.page === 0) || logo.width !== (logo.cover ? 220 : 120) || logo.height !== (logo.cover ? 100 : 50))) fail('FIT_MEASUREMENT_FAILED');
    const videoPages = review.slides.flatMap((slide, index) => slide.video_asset_id ? [index + 1] : []);
    if (measured.videoPages.length !== videoPages.length || measured.videoPages.some((page, index) => page !== videoPages[index])) fail('FIT_MEASUREMENT_FAILED');
    if (measured.overflows.length > 10000) fail('FIT_BUDGET_EXCEEDED');
    return { schema_version: '1.0', input_fingerprint: review.input_fingerprint, template_content_sha256: review.template.content_sha256, renderer_version: REVIEW_FIT_RENDERER_VERSION, chromium_version: version, font_hashes: pinned.font_hashes, overflows: measured.overflows, measured_at: new Date().toISOString() };
  };
  try { return await Promise.race([operation(), interrupted]); }
  catch (error) { if (error instanceof ReviewFitError) throw error; return fail(options.signal?.aborted ? 'FIT_ABORTED' : 'FIT_MEASUREMENT_FAILED'); }
  finally { clearTimeout(timer); signal.removeEventListener('abort', abort); await browser?.close().catch(() => undefined); }
}
