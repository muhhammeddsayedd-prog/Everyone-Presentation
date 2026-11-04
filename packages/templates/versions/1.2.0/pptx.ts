import PptxGenJS from 'pptxgenjs';
import { COLORS, LINE_HEIGHT, PPTX, PPTX_FACES, TYPE, type TypeStyle } from './tokens.ts';
import type { Box, Deck, DeckElement, ImageElement, RunsElement, StaticImage, TextElement } from './deck.ts';

/** Editable PowerPoint from the same composed deck: native text boxes, native
 * image objects with exact crop rectangles, native highlight for notes and real
 * hyperlinks. Never a slide screenshot. 1 unit = 1/144 in; font N → N/2 pt. */
export interface PptxImage { data: string; natural: readonly [number, number] }
export interface PptxAssets { images: Record<string, PptxImage>; staticImages: Record<StaticImage, PptxImage>; videoHrefs?: Record<string, string> }

/** Pixel size from PNG, JPEG or WebP headers, so frozen images keep exact crops. */
export function imageSize(bytes: Uint8Array): readonly [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > 24 && view.getUint32(0) === 0x89504e47) return [view.getUint32(16), view.getUint32(20)];
  if (bytes.length > 30 && view.getUint32(0) === 0x52494646 && view.getUint32(8) === 0x57454250) {
    const chunk = String.fromCharCode(...bytes.subarray(12, 16));
    if (chunk === 'VP8X') return [1 + (bytes[24] | bytes[25] << 8 | bytes[26] << 16), 1 + (bytes[27] | bytes[28] << 8 | bytes[29] << 16)];
    if (chunk === 'VP8L') { const bits = view.getUint32(21, true); return [1 + (bits & 0x3fff), 1 + (bits >> 14 & 0x3fff)]; }
    if (chunk === 'VP8 ') return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff];
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let offset = 2; offset + 9 < bytes.length;) {
      if (bytes[offset] !== 0xff) break; const marker = bytes[offset + 1]; const length = view.getUint16(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [view.getUint16(offset + 7), view.getUint16(offset + 5)];
      offset += 2 + length;
    }
  }
  throw new Error('PPTX_IMAGE_UNSUPPORTED');
}
const inch = (value: number) => value / PPTX.unitsPerInch;
const point = (value: number) => value / PPTX.fontUnitsPerPoint;
const color = (value: string) => value.replace('#', '').toUpperCase();
const at = ([x, y, w, h]: Box) => ({ x: inch(x), y: inch(y), w: inch(w), h: inch(h) });
function font(style: TypeStyle) {
  const type = TYPE[style]; const face = PPTX_FACES[type.weight];
  const lineHeight = 'lineHeight' in type ? type.lineHeight as number : LINE_HEIGHT;
  const fontFace = style === 'dialogue' ? 'IBM Plex Sans Arabic SemiBold' : face.face;
  return { fontFace, bold: style === 'dialogue' ? false : face.bold, fontSize: point(type.size), color: color('color' in type ? COLORS[type.color as keyof typeof COLORS] : COLORS.ink),
    lineSpacing: point(type.size) * lineHeight, underline: 'underline' in type ? { style: 'sng' as const } : undefined };
}
const frame = { margin: 0, valign: 'top' as const, fit: 'none' as const, isTextBox: true, paraSpaceBefore: 0, paraSpaceAfter: 0 };

function textProps(element: TextElement) {
  return { ...at(element.box), ...frame, ...font(element.style), align: element.align ?? 'left', wrap: Boolean(element.wrap), rtlMode: element.dir === 'rtl', lang: element.lang === 'ar' ? 'ar-EG' : undefined };
}
function runsArray(element: RunsElement) {
  return element.runs.map(run => ({ text: run.text, options: { ...font(run.style), highlight: element.highlight ? color(element.highlight === 'fittingNote' ? COLORS.fittingNote : COLORS.note) : undefined } }));
}
/** Cover crop at the focal point → explicit source rectangle; contain → inner box. */
function imageProps(element: ImageElement, image: PptxImage) {
  const [x, y, w, h] = element.box; const [nw, nh] = image.natural; const data = image.data.replace(/^data:/u, '');
  if (element.fit === 'contain') {
    const scale = Math.min(w / nw, h / nh); const cw = nw * scale; const ch = nh * scale;
    const left = element.align === 'left' ? x : element.align === 'right' ? x + w - cw : x + (w - cw) / 2;
    return { data, ...at([left, y + (h - ch) / 2, cw, ch]), altText: element.alt };
  }
  const scale = Math.max(w / nw, h / nh); const sw = nw * scale; const sh = nh * scale; const [fx, fy] = element.focal ?? [0.5, 0.5];
  const cx = Math.min(Math.max(fx * sw - w / 2, 0), sw - w); const cy = Math.min(Math.max(fy * sh - h / 2, 0), sh - h);
  return { data, x: inch(x), y: inch(y), w: inch(sw), h: inch(sh), sizing: { type: 'crop' as const, x: inch(cx), y: inch(cy), w: inch(w), h: inch(h) }, altText: element.alt };
}

function addElement(slide: PptxGenJS.Slide, element: DeckElement, assets: PptxAssets) {
  // PowerPoint renders any baseline-offset run as reduced superscript, so the cover's
  // raised stem (HTML/PDF) stays the authored full-size `|` here.
  if (element.kind === 'text') { slide.addText(element.text, textProps(element)); return; }
  if (element.kind === 'runs') { slide.addText(runsArray(element), { ...at(element.box), ...frame, wrap: false, lineSpacing: point(element.box[3]) * 0.98 }); return; }
  if (element.kind === 'link') {
    const href = assets.videoHrefs?.[element.target.asset_id]; const style = font(element.style);
    slide.addText([{ text: element.text, options: { ...style, hyperlink: href ? { url: href, tooltip: 'Open the original introduction video' } : undefined } }], { ...at(element.box), ...frame, wrap: false });
    return;
  }
  if (element.kind === 'image') {
    const image = element.source.type === 'asset' ? assets.images[element.source.asset_id] : assets.staticImages[element.source.key];
    if (!image) throw new Error('PPTX_ASSET_MISSING'); slide.addImage(imageProps(element, image)); return;
  }
  // A stack flows as paragraphs of one text box, so a wrapped title still pushes the date down.
  const paragraphs = element.items.flatMap((item, index) => {
    const before = index ? point(element.gaps[index - 1]) : 0;
    const runs = item.kind === 'text' ? [{ text: item.text, options: font(item.style) }] : runsArray(item);
    return runs.map((run, n) => ({ text: run.text, options: { ...run.options, paraSpaceBefore: n === 0 ? before : undefined, breakLine: n === runs.length - 1 && index < element.items.length - 1 } }));
  });
  slide.addText(paragraphs, { ...at(element.box), ...frame, wrap: true });
}

export async function renderDeckPptx(deck: Deck, assets: PptxAssets, metadata: { author?: string; subject?: string } = {}): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'EVERYONE_FILM_16X9', width: PPTX.widthInches, height: PPTX.heightInches }); pptx.layout = 'EVERYONE_FILM_16X9';
  pptx.title = deck.title; pptx.company = 'everyone.'; pptx.author = metadata.author ?? 'Everyone Presentation Studio'; if (metadata.subject) pptx.subject = metadata.subject;
  pptx.theme = { headFontFace: 'General Sans Semibold', bodyFontFace: 'General Sans' };
  for (const page of deck.pages) {
    const slide = pptx.addSlide(); slide.background = { color: color(COLORS.background) };
    // Stable layering: media, then text, labels, notes and page number (design.md §13.1).
    const ordered = [...page.elements.filter(element => element.kind === 'image'), ...page.elements.filter(element => element.kind !== 'image')];
    for (const element of ordered) addElement(slide, element, assets);
  }
  const output = await pptx.write({ outputType: 'uint8array', compression: true });
  return output as Uint8Array;
}
