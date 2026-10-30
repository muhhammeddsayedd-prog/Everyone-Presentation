/** M06 offline expected-layout inspection, adapted additively from M05.
 * Existing M05 inspector is preserved byte-for-byte.
 * Offline expected-layout inspection. Source image bodies are deliberately
 * absent: structural divs measure fixed boxes; actual images come from PDF. */
import { spawn } from 'node:child_process';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';
import type { RenderSnapshot } from '../packages/domain/src/presentation-types.ts';
import { reviewFromRenderSnapshot } from '../packages/domain/src/presentation.ts';
import { renderRegisteredReviewDocument } from '../packages/templates/src/registered.ts';
import { loadReviewTemplateAssets } from '../apps/worker/src/review-fit.ts';
import { nativeBrowserEnvironment } from '../apps/worker/src/native-browser.ts';
import { presentationExportVideoHref, type PresentationExportMediaAccess, type PresentationValidationProof } from '../apps/worker/src/presentation-pdf.ts';

function check(value: unknown): asserts value { if (!value) throw Error('M06_LIVE_GEOMETRY_UNCONFIRMED'); }
export async function validateDownloadedGuestPdfWithoutImageBodies(snapshot: RenderSnapshot, bytes: Uint8Array, access: PresentationExportMediaAccess | null): Promise<PresentationValidationProof> {
  check(access !== null || snapshot.slides.every(slide => !slide.video_asset_id));
  const href = (asset: string) => { check(access); return presentationExportVideoHref(snapshot, asset, access); };
  const pinned = await loadReviewTemplateAssets(snapshot.template); const review = reviewFromRenderSnapshot(snapshot);
  check(JSON.stringify(Object.entries(pinned.font_hashes).sort()) === JSON.stringify(Object.entries(snapshot.template.font_hashes).sort()));
  const videoHrefs = Object.fromEntries(snapshot.slides.flatMap(slide => slide.video_asset_id ? [[slide.video_asset_id, href(slide.video_asset_id)]] : []));
  let browser: Browser | undefined; const timer = setTimeout(() => { void browser?.close().catch(() => undefined); }, 45000);
  let expected;
  try {
    browser = await chromium.launch({ headless: true, timeout: 30000, env: nativeBrowserEnvironment(), args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run', '--force-color-profile=srgb'] });
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, javaScriptEnabled: false, serviceWorkers: 'block', offline: true, reducedMotion: 'reduce' });
    let blocked = 0; await context.route('**/*', route => { blocked++; return route.abort('blockedbyclient'); }); const page = await context.newPage(); await page.emulateMedia({ media: 'print' });
    // No client/frame byte is fabricated or embedded. The registered renderer's
    // own missing-image cells retain its fixed grid geometry for measurement.
    await page.setContent(renderRegisteredReviewDocument(review, { ...pinned.assets, videoHrefs, versionLabel: `Version ${snapshot.version_no}` }), { waitUntil: 'load', timeout: 30000 });
    expected = await page.evaluate(async (logoPages: number[]) => {
      await Promise.all(['Latin', 'Arabic'].flatMap(family => [400, 500, 600].map(weight => document.fonts.load(`${weight} 23px ${family}`, family === 'Arabic' ? 'تجربة' : 'Example')))); await document.fonts.ready;
      const pages = [...document.querySelectorAll<HTMLElement>('.eps-page')]; let overflow = 0;
      for (const index of logoPages) { const element = document.createElement('div'); element.className = `eps-client-logo ${index === 0 ? 'eps-cover-logo' : 'eps-footer-logo'}`; pages[index].append(element); }
      const result = pages.map((page, index) => {
        const base = page.getBoundingClientRect(); if (Number(page.dataset.pageIndex) !== index || Math.abs(base.width - 1600) > 0.1 || Math.abs(base.height - 900) > 0.1 || page.scrollHeight > page.clientHeight + 1 || page.scrollWidth > page.clientWidth + 1) overflow++;
        const regions = [...page.querySelectorAll<HTMLElement>('[data-fit-field], .eps-field dt, .eps-requirement dt, .eps-position')].map((element, n) => {
          if (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) overflow++;
          const rect = element.getBoundingClientRect(); const text = element.textContent ?? ''; const lines: { start: number; end: number; top: number }[] = [];
          if (element.childNodes.length === 1 && element.firstChild?.nodeType === Node.TEXT_NODE) { let offset = 0; for (const character of text) { const range = document.createRange(); range.setStart(element.firstChild, offset); range.setEnd(element.firstChild, offset + character.length); const measured = range.getClientRects()[0];
            if (measured && character.trim()) { const top = measured.top - base.top; const line = lines.find(line => Math.abs(line.top - top) < 1); if (line) line.end = offset + character.length - 1; else lines.push({ start: offset, end: offset + character.length - 1, top }); } offset += character.length; } }
          lines.sort((left, right) => left.top - right.top); return { field: element.dataset.fitField ?? `label_${n}`, text: element.innerText, source_text: text, direction: getComputedStyle(element).direction, lines, rect: [rect.x - base.x, rect.y - base.y, rect.width, rect.height] };
        });
        const boxes = [...page.querySelectorAll<HTMLElement>('.eps-images > *')].map(element => { const rect = element.getBoundingClientRect(); return [rect.x - base.x, rect.y - base.y, rect.width, rect.height]; });
        const logo = page.querySelector<HTMLElement>('.eps-client-logo')?.getBoundingClientRect();
        return { regions, boxes, logo: logo ? [logo.x - base.x, logo.y - base.y, logo.width, logo.height] : null, links: [...page.querySelectorAll<HTMLAnchorElement>('a')].map(link => link.href) };
      });
      return { pages: result, overflow, fonts: document.fonts.status === 'loaded' && [...document.fonts].length === 6 && [...document.fonts].every(font => font.status === 'loaded') };
    }, snapshot.slides.flatMap((slide, index) => slide.logo_asset_id ? [index] : []));
    check(!blocked && expected.overflow === 0 && expected.fonts && expected.pages.length === snapshot.slides.length);
  } finally { clearTimeout(timer); await browser?.close().catch(() => undefined); }
  const pages = expected.pages.map((page, index) => {
    const slide = snapshot.slides[index]; check(page.boxes.length === slide.frames.length);
    const images = slide.frames.map((frame, n) => ({ width: frame.width, height: frame.height, rect: page.boxes[n] }));
    if (slide.logo_asset_id) { const asset = snapshot.asset_inventory.find(asset => asset.asset_id === slide.logo_asset_id); check(asset && asset.width && asset.height && page.logo); images.unshift({ width: asset.width, height: asset.height, rect: page.logo }); } else check(page.logo === null);
    check(JSON.stringify(page.links) === JSON.stringify(slide.video_asset_id ? [href(slide.video_asset_id)] : []));
    return { regions: page.regions, links: page.links, images };
  });
  const source = fileURLToPath(new URL('../apps/worker/src/', import.meta.url)); const dependencies = fileURLToPath(new URL('../node_modules/', import.meta.url)); const entry = fileURLToPath(new URL('../apps/worker/src/presentation-pdf-inspect-process.mjs', import.meta.url));
  const text = await new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, ['--max-old-space-size=512', '--permission', '--allow-addons', `--allow-fs-read=${source}`, `--allow-fs-read=${dependencies}`, entry], { shell: false, windowsHide: true, cwd: source, env: { ...nativeBrowserEnvironment(), NODE_ENV: 'production' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let diagnostic = 0; let failed = false; const stop = () => { failed = true; child.kill('SIGKILL'); }; const timer = setTimeout(stop, 60000); child.on('error', stop); child.stdin.on('error', () => {});
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); if (stdout.length > 65536) stop(); }); child.stderr.on('data', (chunk: Buffer) => { diagnostic += chunk.length; if (diagnostic > 65536) stop(); });
    child.on('close', code => { clearTimeout(timer); if (failed || code !== 0) reject(Error('M06_LIVE_PDF_INSPECTION_UNCONFIRMED')); else resolve(stdout); }); child.stdin.end(JSON.stringify({ bytes: Buffer.from(bytes).toString('base64'), expected: pages }));
  });
  const result = JSON.parse(text); check(result.ok === true); return result.proof;
}
