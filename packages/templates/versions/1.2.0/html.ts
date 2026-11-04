import { CANVAS, COLORS, COVER_SEPARATOR, LINE_HEIGHT, TYPE, type TypeStyle, type Weight } from './tokens.ts';
import type { Box, Deck, DeckElement, ImageElement, RunsElement, StaticImage, TextElement } from './deck.ts';

/** One markup/CSS renderer for the worker's print document and the in-app
 * preview. Both consume the same composed deck, so they cannot drift. */
export interface DeckAssets {
  fontFaces?: { family: 'Latin' | 'Arabic'; weight: Weight; source: string }[];
  imageSources?: Record<string, string>; staticImages?: Partial<Record<StaticImage, string>>; videoHrefs?: Record<string, string>;
}
export const LATIN_FACE = 'EF General Sans'; export const ARABIC_FACE = 'EF Arabic';
export const STATIC_IMAGE_PATHS: Record<StaticImage, string> = { everyone_wordmark: '/brand/everyone-logotype.svg', casting_placeholder: '/templates/everyone-film/casting-placeholder.png' };

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/gu, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const FONT_SOURCE = /^(?:data:font\/(?:woff2|ttf);base64,[A-Za-z0-9+/=]+|\/fonts\/(?:GeneralSans-(?:Extralight|Light|Regular|Medium|Semibold|Bold)\.ttf|IBMPlexSansArabic-(?:Regular|Medium|SemiBold)\.woff2))$/u;
const IMAGE_SOURCE = /^(?:data:image\/(?:png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+|blob:https?:\/\/[A-Za-z0-9.:[\]-]+\/[a-f0-9-]{36}|\/brand\/everyone-logotype\.svg|\/templates\/everyone-film\/casting-placeholder\.png)$/u;
function source(value: string, kind: 'font' | 'image') { if (!(kind === 'font' ? FONT_SOURCE : IMAGE_SOURCE).test(value)) throw new Error('TEMPLATE_ASSET_SOURCE_INVALID'); return escape(value); }
function hyperlink(value: string) {
  if (!value.startsWith('/') && !/^https?:\/\//u.test(value) || /[\p{C}\s]/u.test(value) || value.startsWith('//')) throw new Error('TEMPLATE_LINK_INVALID');
  return escape(value);
}
const n = (value: number) => `${Math.round(value * 100) / 100}px`;
const place = ([x, y, width, height]: Box, fixedHeight = true) => `left:${n(x)};top:${n(y)};width:${n(width)};${fixedHeight ? `height:${n(height)}` : `max-height:${n(height)}`}`;

const styleRules = (Object.entries(TYPE) as [TypeStyle, typeof TYPE[TypeStyle]][]).map(([name, style]) =>
  `.ef-deck .ef-s-${name}{font-weight:${style.weight};font-size:${style.size}px;line-height:${'lineHeight' in style ? style.lineHeight : LINE_HEIGHT}${'color' in style ? `;color:${COLORS[style.color as keyof typeof COLORS]}` : ''}${'underline' in style ? ';text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1px' : ''}}`).join('');
/** Scoped stylesheet: no rule escapes `.ef-deck`, and app styles cannot reach inside it. */
export const EDITORIAL_CSS = `
.ef-deck{margin:0;padding:0;background:${COLORS.background}}
.ef-deck .ef-slide{position:relative;display:block;box-sizing:border-box;width:${CANVAS.width}px;height:${CANVAS.height}px;margin:0;padding:0;overflow:hidden;background:${COLORS.background};color:${COLORS.ink};font-family:"${LATIN_FACE}","${ARABIC_FACE}",sans-serif;font-synthesis:none;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;break-after:page;page-break-after:always;isolation:isolate}
.ef-deck .ef-slide:last-child{break-after:auto;page-break-after:auto}
.ef-deck .ef-t,.ef-deck .ef-runs,.ef-deck .ef-stack{position:absolute;box-sizing:border-box;margin:0;padding:0;border:0;white-space:pre;overflow:visible;letter-spacing:0;font-style:normal;text-transform:none;color:inherit;background:none}
.ef-deck .ef-stack>.ef-t,.ef-deck .ef-stack>.ef-runs{position:relative;left:auto!important;top:auto!important}
.ef-deck .ef-wrap{white-space:pre-wrap;overflow-wrap:anywhere}
.ef-deck .ef-sep{font-size:${Math.round(COVER_SEPARATOR.scale * 10000) / 100}%;vertical-align:${COVER_SEPARATOR.raiseEm}em}
.ef-deck [dir=auto]{unicode-bidi:plaintext}
.ef-deck .ef-media{position:absolute;box-sizing:border-box;margin:0;padding:0;border:0;border-radius:0;box-shadow:none;overflow:hidden}
.ef-deck .ef-media img{display:block;width:100%;height:100%;max-width:none;margin:0;padding:0;border:0;border-radius:0}
.ef-deck .ef-hl{background:${COLORS.note};padding:1px 0;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.ef-deck .ef-hl-fitting{background:${COLORS.fittingNote};padding:1.25px 0}
.ef-deck a.ef-t{color:${COLORS.ink}}
.ef-deck .ef-s-dialogue{font-family:"${ARABIC_FACE}","${LATIN_FACE}",sans-serif}
${styleRules}`;
export const PRINT_CSS = `@page{size:${CANVAS.width}px ${CANVAS.height}px;margin:0}html,body{margin:0;padding:0;background:${COLORS.background}}`;

export function fontFaceCss(faces: NonNullable<DeckAssets['fontFaces']>) {
  return faces.map(face => `@font-face{font-family:"${face.family === 'Latin' ? LATIN_FACE : ARABIC_FACE}";font-style:normal;font-weight:${face.family === 'Arabic' && face.weight === 600 ? '600 700' : face.family === 'Arabic' && face.weight === 400 ? '200 400' : face.weight};font-display:block;src:url("${source(face.source, 'font')}") format("${face.family === 'Latin' ? 'truetype' : 'woff2'}")}`).join('');
}
/** Public font files for the in-app preview; the worker inlines pinned bytes instead.
 * General Sans uses the official TrueType files so Chromium embeds real font
 * programs in PDFs (its CFF builds would become Type3 glyph procedures). */
export const PUBLIC_FONT_FACES: NonNullable<DeckAssets['fontFaces']> = [
  ...([[200, 'Extralight'], [300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold']] as const).map(([weight, name]) => ({ family: 'Latin' as const, weight, source: `/fonts/GeneralSans-${name}.ttf` })),
  ...([[400, 'Regular'], [500, 'Medium'], [600, 'SemiBold']] as const).map(([weight, name]) => ({ family: 'Arabic' as const, weight, source: `/fonts/IBMPlexSansArabic-${name}.woff2` })),
];

function textMarkup(element: TextElement, inStack = false) {
  const attributes = [`class="ef-t ef-s-${element.style}${element.wrap ? ' ef-wrap' : ''}"`, `style="${place(element.box, !inStack)}${element.align && element.align !== 'left' ? `;text-align:${element.align}` : ''}"`];
  if (element.dir) attributes.push(`dir="${element.dir}"`); if (element.lang) attributes.push(`lang="${escape(element.lang)}"`);
  if (element.fit) attributes.push(`data-fit-field="${escape(element.fit)}"`); if (element.region) attributes.push('data-region=""');
  const body = element.separator === 'cap' ? element.text.split(COVER_SEPARATOR.token).map(escape).join(' <span class="ef-sep">|</span> ') : escape(element.text);
  return `<div ${attributes.join(' ')}>${body}</div>`;
}
function runsMarkup(element: RunsElement, inStack = false) {
  const first = TYPE[element.runs[0].style]; const highlight = element.highlight ? ` class="ef-hl${element.highlight === 'fittingNote' ? ' ef-hl-fitting' : ''}"` : '';
  const runs = element.runs.map(run => `<span class="ef-s-${run.style}">${escape(run.text)}</span>`).join('');
  return `<div class="ef-runs" style="${place(element.box, !inStack)};font-size:${first.size}px;line-height:${n(element.box[3])}"${element.region ? ' data-region=""' : ''}><span${highlight}>${runs}</span></div>`;
}
function imageMarkup(element: ImageElement, assets: DeckAssets) {
  const url = element.source.type === 'asset' ? assets.imageSources?.[element.source.asset_id] : assets.staticImages?.[element.source.key] ?? STATIC_IMAGE_PATHS[element.source.key];
  const [fx, fy] = element.focal ?? [0.5, 0.5];
  const position = element.fit === 'contain' ? `${element.align === 'left' ? 'left' : element.align === 'right' ? 'right' : 'center'} center` : `${fx * 100}% ${fy * 100}%`;
  const classes = `ef-media ef-role-${element.role}${element.source.type === 'static' ? ' ef-static' : ''}`;
  const data = element.source.type === 'asset' ? ` data-asset-id="${escape(element.source.asset_id)}"` : ` data-static="${element.source.key}"`;
  // A missing asset URL is a render failure upstream; never draw a stand-in silently.
  if (!url) return `<div class="${classes} ef-missing" style="${place(element.box)}"${data}></div>`;
  return `<div class="${classes}" style="${place(element.box)}"${data}><img src="${source(url, 'image')}" alt="${escape(element.alt)}" style="object-fit:${element.fit};object-position:${position}"></div>`;
}
function elementMarkup(element: DeckElement, assets: DeckAssets): string {
  if (element.kind === 'text') return textMarkup(element);
  if (element.kind === 'runs') return runsMarkup(element);
  if (element.kind === 'image') return imageMarkup(element, assets);
  if (element.kind === 'link') {
    const href = assets.videoHrefs?.[element.target.asset_id];
    return href ? `<a class="ef-t ef-s-${element.style}" style="${place(element.box)}" href="${hyperlink(href)}" data-region="">${escape(element.text)}</a>`
      : `<div class="ef-t ef-s-${element.style}" style="${place(element.box)}" data-region="" data-link-pending="">${escape(element.text)}</div>`;
  }
  const items = element.items.map((item, index) => {
    const markup = item.kind === 'text' ? textMarkup(item, true) : runsMarkup(item, true);
    return index ? markup.replace('style="', `style="margin-top:${n(element.gaps[index - 1])};`) : markup;
  }).join('');
  return `<div class="ef-stack" style="left:${n(element.box[0])};top:${n(element.box[1])};width:${n(element.box[2])}">${items}</div>`;
}
export function renderPageMarkup(deck: Deck, index: number, assets: DeckAssets = {}) {
  const page = deck.pages[index];
  return `<section class="ef-slide" data-page-index="${page.index}" data-source-index="${page.source_index}" data-layout="${page.layout}" aria-label="Slide ${page.index + 1}">${page.elements.map(element => elementMarkup(element, assets)).join('')}</section>`;
}
export function renderDeckMarkup(deck: Deck, assets: DeckAssets = {}) { return deck.pages.map((_page, index) => renderPageMarkup(deck, index, assets)).join(''); }
export function renderDeckDocument(deck: Deck, assets: DeckAssets = {}) {
  const fonts = fontFaceCss(assets.fontFaces ?? []);
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=${CANVAS.width}"><title>${escape(deck.title)}</title><style>${fonts}${PRINT_CSS}${EDITORIAL_CSS}</style></head><body class="ef-deck">${renderDeckMarkup(deck, assets)}</body></html>`;
}
