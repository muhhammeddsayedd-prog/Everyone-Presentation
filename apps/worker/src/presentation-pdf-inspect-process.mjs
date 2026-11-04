import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { getDocument, OPS, Util } from 'pdfjs-dist/legacy/build/pdf.mjs';
import bidiFactory from 'bidi-js';

// Input and extracted text stay in memory. Only fixed boolean/count/hash proof
// reaches stdout; no untrusted PDF diagnostics or document strings are logged.
class NoExternalData { async fetch() { throw new Error('external'); } }
const normalize = value => value.normalize('NFKC').replace(/[\s\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, '');
const check = condition => { if (!condition) throw new Error('invalid'); };
const bidi = bidiFactory();
let task; let checkpoint = 'input';
try {
  const chunks = []; let count = 0; for await (const chunk of process.stdin) { count += chunk.length; check(count <= 100 * 1024 * 1024); chunks.push(chunk); }
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8')); // Legacy callers omit page_points (1.0/1.1 fixed 1200×675 pt); editorial 1.2.0 sends 1440×810.
  check(input && ['bytes,expected', 'bytes,expected,page_points'].includes(Object.keys(input).sort().join(',')) && (input.page_points ??= [1200, 675]) && Array.isArray(input.page_points) && ['1200,675', '1440,810'].includes(input.page_points.join(',')) && typeof input.bytes === 'string' && Array.isArray(input.expected) && input.expected.length >= 1 && input.expected.length <= 1000);
  const bytes = Buffer.from(input.bytes, 'base64'); check(bytes.length <= 64 * 1024 * 1024 && bytes.toString('base64') === input.bytes);
  task = getDocument({ data: new Uint8Array(bytes), verbosity: 0, stopAtErrors: true, useWorkerFetch: false, useWasm: false, useSystemFonts: false, disableFontFace: true, fontExtraProperties: true, enableXfa: false, isOffscreenCanvasSupported: false, isImageDecoderSupported: false, maxImageSize: 40000000, disableRange: true, disableStream: true, disableAutoFetch: true, BinaryDataFactory: NoExternalData });
  const pdf = await task.promise; checkpoint = 'document_security';
  check(pdf.numPages === input.expected.length && await pdf.getPermissions() === null && !await pdf.getJSActions() && !await pdf.getAttachments());
  let regions = 0; let images = 0; let links = 0; const fonts = new Set(); let width; let height;
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n); const expected = input.expected[n - 1]; checkpoint = 'page_geometry';
    const pageWidth = page.view[2] - page.view[0]; const pageHeight = page.view[3] - page.view[1]; width ??= pageWidth; height ??= pageHeight;
    check(page.rotate === 0 && page.userUnit === 1 && Math.abs(pageWidth - input.page_points[0]) < 0.5 && Math.abs(pageHeight - input.page_points[1]) < 0.5 && pageWidth === width && pageHeight === height && !await page.getJSActions());
    const viewport = page.getViewport({ scale: 4 / 3 }); const text = await page.getTextContent({ disableNormalization: true });
    const items = text.items.filter(item => 'str' in item).map(item => { const transform = Util.transform(viewport.transform, item.transform); const height = Math.hypot(transform[2], transform[3]); return { str: item.str, dir: item.dir, x: transform[4], y: transform[5] - height, w: item.width * 4 / 3, h: height, font: item.fontName }; });
    checkpoint = 'text_regions'; for (const region of expected.regions) {
      checkpoint = /^[a-z_0-9]{1,30}$/u.test(region.field) ? `region_${region.field}` : 'text_regions';
      const [x, y, w, h] = region.rect; check([x, y, w, h].every(Number.isFinite) && w > 0 && h > 0);
      const selected = items.filter(item => item.x + item.w / 2 >= x - 2 && item.x + item.w / 2 <= x + w + 2 && item.y + item.h / 2 >= y - 2 && item.y + item.h / 2 <= y + h + 2);
      if (normalize(selected.map(item => item.str).join('')) !== normalize(region.text)) {
        check(/\p{Script=Arabic}/u.test(region.source_text) && region.lines.length > 0);
        const lines = []; for (const item of selected.filter(item => normalize(item.str))) { const top = item.y + item.h; let line = lines.find(line => Math.abs(line.top - top) < 2); if (!line) { line = { top, items: [] }; lines.push(line); } line.items.push(item); }
        lines.sort((left, right) => left.top - right.top); check(lines.length === region.lines.length);
        const source = region.source_text.normalize('NFKC'); const levels = bidi.getEmbeddingLevels(source, region.direction === 'rtl' ? 'rtl' : 'ltr');
        for (let i = 0; i < lines.length; i++) {
          const range = region.lines[i]; const start = region.source_text.slice(0, range.start).normalize('NFKC').length; const end = region.source_text.slice(0, range.end + 1).normalize('NFKC').length - 1;
          const expectedVisual = bidi.getReorderedString(source, levels, start, end).slice(start, end + 1);
          const actualVisual = lines[i].items.sort((left, right) => left.x - right.x).map(item => { const str = item.str.normalize('NFKC'); return bidi.getReorderedString(str, bidi.getEmbeddingLevels(str, item.dir === 'rtl' ? 'rtl' : 'ltr')); }).join('');
          check(normalize(actualVisual) === normalize(expectedVisual));
        }
      }
      regions++;
    }
    checkpoint = 'video_links'; const annotations = await page.getAnnotations(); check(annotations.length === expected.links.length);
    for (const [index, annotation] of annotations.entries()) { check(annotation.subtype === 'Link' && annotation.url === expected.links[index] && !annotation.dest && !annotation.action && !annotation.hasAppearance); links++; }
    checkpoint = 'pdf_operators'; const operators = await page.getOperatorList(); const actualImages = []; let matrix = [1, 0, 0, 1, 0, 0]; const stack = [];
    for (let i = 0; i < operators.fnArray.length; i++) {
      const fn = operators.fnArray[i]; const args = operators.argsArray[i];
      if (fn === OPS.save) stack.push([...matrix]);
      if (fn === OPS.restore) { check(stack.length > 0); matrix = stack.pop(); }
      if (fn === OPS.transform) matrix = Util.transform(matrix, args);
      if (fn === OPS.paintFormXObjectBegin) { stack.push([...matrix]); if (args[0]) matrix = Util.transform(matrix, args[0]); }
      if (fn === OPS.paintFormXObjectEnd) { check(stack.length > 0); matrix = stack.pop(); }
      if (fn === OPS.setFont) { checkpoint = 'font_embedding'; const key = args[0]; const font = page.commonObjs.get(key); check(font && !font.missingFile && !font.isInvalidPDFjsFont && font.data?.length > 0); fonts.add(key); }
      if (fn === OPS.showText) { checkpoint = 'font_glyphs'; for (const glyph of args[0]) if (glyph && typeof glyph === 'object' && !glyph.isSpace && !/^\s*$/u.test(glyph.unicode)) check(glyph.isInFont !== false && glyph.unicode !== '\ufffd'); }
      if (fn === OPS.paintImageXObject) { checkpoint = 'image_operators'; const key = args[0]; const image = await new Promise(resolve => (key.startsWith('g_') ? page.commonObjs : page.objs).get(key, resolve)); check(image && image.width > 0 && image.height > 0); const transform = Util.transform(viewport.transform, matrix); const points = [[0, 0], [0, 1], [1, 0], [1, 1]].map(point => { Util.applyTransform(point, transform); return point; }); const xs = points.map(point => point[0]); const ys = points.map(point => point[1]); actualImages.push({ width: image.width, height: image.height, rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)] }); }
      if ([OPS.paintImageXObjectRepeat, OPS.paintInlineImageXObject, OPS.paintInlineImageXObjectGroup, OPS.paintImageMaskXObject, OPS.paintImageMaskXObjectGroup, OPS.paintImageMaskXObjectRepeat].includes(fn)) { checkpoint = 'unsupported_image_operator'; throw new Error('unsupported-image'); }
    }
    checkpoint = 'image_dimensions'; check(actualImages.length === expected.images.length);
    const remaining = [...expected.images];
    for (const image of actualImages) {
      const match = remaining.findIndex(target => {
        // contain: whole image at its object-position (legacy: centered). cover:
        // Skia either paints the full scaled image under the clip, or embeds only the
        // visible source crop drawn at the box, rounded outward to whole source pixels.
        const [x, y, w, h] = target.rect; const cover = target.fit === 'cover'; const [fx, fy] = Array.isArray(target.focal) ? target.focal : [0.5, 0.5];
        const scale = cover ? Math.max(w / target.width, h / target.height) : Math.min(w / target.width, h / target.height); const width = target.width * scale; const height = target.height * scale;
        const placed = [x + (w - width) * fx, y + (h - height) * fy, width, height];
        if (image.width === target.width && image.height === target.height && placed.every((value, index) => Math.abs(value - image.rect[index]) < 1)) return true;
        if (!cover || image.width > target.width || image.height > target.height) return false;
        const slack = scale + 1; const [ix, iy, iw, ih] = image.rect;
        return Math.abs(image.width - w / scale) <= 2 && Math.abs(image.height - h / scale) <= 2 && ix <= x + 0.5 && iy <= y + 0.5 && ix >= x - slack && iy >= y - slack
          && ix + iw >= x + w - 0.5 && iy + ih >= y + h - 0.5 && ix + iw <= x + w + slack && iy + ih <= y + h + slack;
      });
      check(match >= 0); remaining.splice(match, 1);
    }
    images += actualImages.length; page.cleanup();
  }
  process.stdout.write(JSON.stringify({ ok: true, proof: { pdf_sha256: createHash('sha256').update(bytes).digest('hex'), page_count: pdf.numPages, width_points: width, height_points: height, text_regions_checked: regions, image_draws_checked: images, video_links_checked: links, embedded_font_count: fonts.size, validated_at: new Date().toISOString() } }));
} catch { process.stdout.write(JSON.stringify({ ok: false, code: 'PDF_VALIDATION_FAILED', checkpoint })); }
finally { await task?.destroy().catch(() => undefined); }
