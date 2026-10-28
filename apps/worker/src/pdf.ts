import { DOCUMENT_LIMITS, DocumentPreparationError, limitExceeded, unreadable, normalizeSourceText, mapParagraphs, type SourceParagraph } from './types.ts';

class NoExternalBinaryDataFactory {
  async fetch() { throw new DocumentPreparationError('DOCUMENT_EXTERNAL_RESOURCE_REQUIRED', 'This PDF requires an unavailable external font resource. Embed its fonts, convert it to a text-rich PDF, or paste the requirements.'); }
}

export async function preparePdf(bytes: Buffer) {
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
    let text = '';
    const paragraphs: SourceParagraph[] = [];
    const emptyPages: number[] = [];
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
          if (text.length + pageText.length > DOCUMENT_LIMITS.maximumTextCharacters) throw limitExceeded();
        }
        pageText = normalizeSourceText(pageText).trim();
        if (!pageText) emptyPages.push(pageNumber);
        if (text && pageText) text += '\n\n';
        paragraphs.push(...mapParagraphs(pageText, pageNumber, text.length, paragraphs.length));
        text += pageText;
      } finally { page.cleanup(); }
    }
    if (!text.trim()) throw new DocumentPreparationError('DOCUMENT_VISION_REQUIRED', 'This PDF has no extractable text. Scanned-page vision preparation is not configured yet. Upload a text-rich PDF or paste the requirements.');
    const warnings = emptyPages.length ? [`Pages without extractable text: ${emptyPages.join(', ')}. Check whether these pages contain requirements; scanned-page vision is not configured.`] : [];
    return { text, paragraphs, warnings };
  } catch (error) {
    if (error instanceof DocumentPreparationError) throw error;
    if (error instanceof Error && error.name === 'PasswordException') throw new DocumentPreparationError('DOCUMENT_ENCRYPTED', 'Password-protected PDFs are not supported. Upload an unencrypted PDF or paste its text.');
    throw unreadable();
  } finally { await task.destroy().catch(() => undefined); }
}
