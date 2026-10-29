import { DOCUMENT_LIMITS, DocumentPreparationError, limitExceeded, unreadable, normalizeSourceText, mapParagraphs, type SourceParagraph } from './types.ts';

class NoExternalBinaryDataFactory {
  async fetch() { throw new DocumentPreparationError('DOCUMENT_EXTERNAL_RESOURCE_REQUIRED', 'This PDF requires an unavailable external font resource. Embed its fonts, convert it to a text-rich PDF, or paste the requirements.'); }
}

export async function inspectPdfText(bytes: Buffer): Promise<{ pages: { page: number; text: string }[] }> {
  if (bytes.subarray(0, 5).toString() !== '%PDF-') throw unreadable();
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({
    data: new Uint8Array(bytes), verbosity: 0, stopAtErrors: true,
    useWorkerFetch: false, useWasm: false, useSystemFonts: false,
    disableFontFace: true, enableXfa: false, isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false, maxImageSize: 0,
    disableRange: true, disableStream: true, disableAutoFetch: true,
    BinaryDataFactory: NoExternalBinaryDataFactory,
  });
  try {
    const document = await task.promise;
    if (await document.getPermissions() !== null) throw new DocumentPreparationError('DOCUMENT_ENCRYPTED', 'Encrypted PDFs are not supported. Upload an unencrypted text-rich PDF or paste its text.');
    if (document.numPages > DOCUMENT_LIMITS.maximumPages) throw limitExceeded('PDF preparation supports at most 200 pages. Split the source or paste the relevant requirements.');
    const pages: { page: number; text: string }[] = []; let characters = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent({ includeMarkedContent: false, disableNormalization: true });
        let pageText = '';
        for (const item of content.items) {
          if (!('str' in item)) continue;
          if (pageText && !/\s$/u.test(pageText) && item.str && !/^\s/u.test(item.str)) pageText += ' ';
          pageText += item.str;
          if (item.hasEOL) pageText += '\n';
          if (characters + pageText.length > DOCUMENT_LIMITS.maximumTextCharacters) throw limitExceeded();
        }
        pageText = normalizeSourceText(pageText).trim();
        pages.push({ page: pageNumber, text: pageText }); characters += pageText.length;
      } finally { page.cleanup(); }
    }
    return { pages };
  } catch (error) {
    if (error instanceof DocumentPreparationError) throw error;
    if (error instanceof Error && error.name === 'PasswordException') throw new DocumentPreparationError('DOCUMENT_ENCRYPTED', 'Password-protected PDFs are not supported. Upload an unencrypted PDF or paste its text.');
    throw unreadable();
  } finally { await task.destroy().catch(() => undefined); }
}
export async function preparePdf(bytes: Buffer) {
  const { pages } = await inspectPdfText(bytes); let text = ''; const paragraphs: SourceParagraph[] = [];
  for (const page of pages) { if (text && page.text) text += '\n\n'; paragraphs.push(...mapParagraphs(page.text, page.page, text.length, paragraphs.length)); text += page.text; }
  if (!text.trim()) throw new DocumentPreparationError('DOCUMENT_VISION_REQUIRED', 'This PDF needs scanned-page vision preparation.');
  const empty = pages.filter(page => !page.text).map(page => page.page);
  return { text, paragraphs, warnings: empty.length ? [`Pages without extractable text: ${empty.join(', ')}. Check whether these pages contain requirements; scanned-page vision is required.`] : [] };
}
