// Local visual QA for the Everyone Film editorial template.
//   npx tsx tools/editorial-visual-qa.ts [--out .local/editorial-qa] [--references everyone_template_design_kit/references]
// Renders every synthetic fixture page at 1920×1080 (device scale 1, pinned fonts),
// a print PDF, and — when the design-kit screenshots exist locally — side-by-side and
// 50% overlay comparisons plus measured ink bounds. Reference screenshots contain real
// people and stay out of source control; outputs go to the gitignored .local folder.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { archetypeFixtureDeck, castingFixtureDeck, fixtureImages } from '../tests/fixtures/editorial-decks.ts';
import { renderDeckDocument, PUBLIC_FONT_FACES, STATIC_IMAGE_PATHS, type DeckAssets } from '../packages/templates/versions/1.2.0/html.ts';
import type { Deck } from '../packages/templates/versions/1.2.0/deck.ts';
import { renderDeckPptx, type PptxImage } from '../packages/templates/versions/1.2.0/pptx.ts';

const ROOT = path.resolve(__dirname, '..');
const arg = (name: string, fallback: string) => { const index = process.argv.indexOf(name); return path.resolve(ROOT, index > 0 ? process.argv[index + 1] : fallback); };
const OUT = arg('--out', '.local/editorial-qa'); const REFERENCES = arg('--references', 'everyone_template_design_kit/references');
const exists = (file: string) => access(file).then(() => true, () => false);

/** Synthetic art: tone field, soft figure silhouette and a frame outline that makes crops visible. */
async function syntheticImage(width: number, height: number, tone: string) {
  const s = Math.min(width, height);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${tone}"/>
    <circle cx="${width / 2}" cy="${height * 0.34}" r="${s * 0.13}" fill="#f1e6da" opacity="0.92"/><ellipse cx="${width / 2}" cy="${height * 0.78}" rx="${s * 0.28}" ry="${height * 0.3}" fill="#f1e6da" opacity="0.75"/>
    <rect x="3" y="3" width="${width - 6}" height="${height - 6}" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.5"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
async function assets(): Promise<DeckAssets> {
  const fontFaces = await Promise.all(PUBLIC_FONT_FACES.map(async face => ({ ...face, source: `data:font/${face.source.endsWith('.ttf') ? 'ttf' : 'woff2'};base64,` + (await readFile(path.join(ROOT, 'apps/web/public', face.source))).toString('base64') })));
  const staticImages = Object.fromEntries(await Promise.all(Object.entries(STATIC_IMAGE_PATHS).map(async ([key, file]) => [key, `data:${file.endsWith('.svg') ? 'image/svg+xml' : 'image/png'};base64,${(await readFile(path.join(ROOT, 'apps/web/public', file))).toString('base64')}`])));
  const imageSources = Object.fromEntries(await Promise.all(fixtureImages().map(async image => [image.key, 'data:image/png;base64,' + (await syntheticImage(image.width, image.height, image.tone)).toString('base64')])));
  const videoHrefs = new Proxy({}, { get: () => 'https://studio.example.invalid/original-video' }) as Record<string, string>;
  return { fontFaces, staticImages, imageSources, videoHrefs };
}
/** Bounding box of dark ink (luma < 110) in a region, in 1920-unit coordinates. */
async function inkBounds(png: Buffer, region: [number, number, number, number], scale: number) {
  const [x, y, w, h] = region.map(value => Math.round(value / scale)) as [number, number, number, number];
  const { data, info } = await sharp(png).extract({ left: x, top: y, width: w, height: h }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let row = 0; row < info.height; row++) for (let col = 0; col < info.width; col++) if (data[row * info.width + col] < 110) { minX = Math.min(minX, col); maxX = Math.max(maxX, col); minY = Math.min(minY, row); maxY = Math.max(maxY, row); }
  return Number.isFinite(minX) ? [(x + minX) * scale, (y + minY) * scale, (x + maxX + 1) * scale, (y + maxY + 1) * scale].map(value => Math.round(value * 10) / 10) : null;
}
const REGIONS: Record<string, [number, number, number, number]> = { heading: [0, 30, 1500, 112], subtitle: [0, 150, 1880, 60], page_number: [1780, 1030, 140, 50] };

async function renderDeck(name: string, deck: Deck, references: Partial<Record<number, string>>, deckAssets: DeckAssets, browser: import('playwright').Browser) {
  const dir = path.join(OUT, name); await mkdir(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, javaScriptEnabled: false, offline: true });
  const page = await context.newPage(); await page.setContent(renderDeckDocument(deck, deckAssets), { waitUntil: 'load' });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
  const overflow = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-fit-field]')].filter(element => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1).map(element => `${element.closest<HTMLElement>('.ef-slide')!.dataset.pageIndex}:${element.dataset.fitField}`));
  const report: Record<string, unknown>[] = [];
  for (const slide of deck.pages) {
    const png = await page.locator(`.ef-slide[data-page-index="${slide.index}"]`).screenshot({ type: 'png' });
    const file = path.join(dir, `page-${String(slide.index + 1).padStart(2, '0')}-${slide.layout}.png`); await writeFile(file, png);
    const reference = references[slide.index]; const entry: Record<string, unknown> = { page: slide.index + 1, layout: slide.layout, file: path.relative(ROOT, file) };
    if (reference && await exists(path.join(REFERENCES, reference))) {
      const ref = await sharp(path.join(REFERENCES, reference)).resize(1920, 1080).png().toBuffer();
      await writeFile(path.join(dir, `compare-${String(slide.index + 1).padStart(2, '0')}.png`), await sharp({ create: { width: 1920 * 2 + 20, height: 1080, channels: 3, background: '#ff00ff' } }).composite([{ input: ref, left: 0, top: 0 }, { input: png, left: 1940, top: 0 }]).png().toBuffer());
      await writeFile(path.join(dir, `overlay-${String(slide.index + 1).padStart(2, '0')}.png`), await sharp(ref).composite([{ input: await sharp(png).ensureAlpha(0.5).png().toBuffer(), blend: 'over' }]).png().toBuffer());
      entry.reference = reference; entry.ink = {};
      for (const [key, region] of Object.entries(REGIONS)) (entry.ink as Record<string, unknown>)[key] = { generated: await inkBounds(png, region, 1), reference: await inkBounds(ref, region, 1) };
    }
    report.push(entry);
  }
  await writeFile(path.join(dir, `${name}.pdf`), await page.pdf({ preferCSSPageSize: true, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } }));
  const pptxImage = async (url: string): Promise<PptxImage> => { const bytes = Buffer.from(url.split(',')[1], 'base64'); const meta = await sharp(bytes).metadata(); return { data: url.slice(5), natural: [meta.width!, meta.height!] }; };
  const raster = 'data:image/png;base64,' + (await readFile(path.join(ROOT, 'apps/web/public/templates/everyone-film/everyone-wordmark.png'))).toString('base64');
  const pptxImages = Object.fromEntries(await Promise.all(Object.entries(deckAssets.imageSources ?? {}).map(async ([key, url]) => [key, await pptxImage(url)])));
  await writeFile(path.join(dir, `${name}.pptx`), await renderDeckPptx(deck, { images: pptxImages, staticImages: { everyone_wordmark: await pptxImage(raster), casting_placeholder: await pptxImage(deckAssets.staticImages!.casting_placeholder!) }, videoHrefs: deckAssets.videoHrefs }));
  await writeFile(path.join(dir, 'report.json'), JSON.stringify({ deck: name, pages: deck.pages.length, overflow, report }, null, 2));
  await context.close(); return { pages: deck.pages.length, overflow };
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  try {
    const archetypes = archetypeFixtureDeck(); const decks = { casting: castingFixtureDeck({ logo: true }), 'casting-every-slide-logo': castingFixtureDeck({ logo: true, everySlide: true, output: 'shortlist' }), archetypes: archetypes.deck };
    const deckAssets = await assets(); const summary: Record<string, unknown> = {};
    for (const [name, deck] of Object.entries(decks)) summary[name] = await renderDeck(name, deck, name === 'archetypes' ? archetypes.references : {}, deckAssets, browser);
    console.log(JSON.stringify(summary, null, 2));
  } finally { await browser.close(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
