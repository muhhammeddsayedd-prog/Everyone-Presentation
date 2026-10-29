export const DOCUMENT_LIMITS = Object.freeze({
  maximumBytes: 20 * 1024 * 1024,
  maximumPages: 200,
  maximumTextCharacters: 2_000_000,
  maximumParagraphs: 10_000,
  maximumZipEntries: 1_000,
  maximumZipEntryBytes: 16 * 1024 * 1024,
  maximumZipExpandedBytes: 40 * 1024 * 1024,
  maximumCompressionRatio: 200,
});

export class DocumentPreparationError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, message: string, retryable = false) {
    super(message); this.name = 'DocumentPreparationError'; this.code = code; this.retryable = retryable;
  }
}

/** Asset mode remains compatible with existing callers and always requires an asset. */
export interface PrepareDocumentInput { sourceKind?: 'asset'; bytes: Uint8Array; mimeType: string; sourceAssetId: string }
export interface PreparePastedTextInput { sourceKind: 'pasted_text'; text: string; sourceAssetId: null }
export type DocumentPreparationInput = PrepareDocumentInput | PreparePastedTextInput;
export interface SourceParagraph { index: number; page: number | null; start: number; end: number; text: string }
export type ExtractionMethod = 'plain_text' | 'pdf_text' | 'pdf_vision' | 'docx_text';
export interface PreparedDocument {
  sourceAssetId: string | null;
  sourceSha256: string;
  text: string;
  paragraphs: SourceParagraph[];
  extractionMethod: ExtractionMethod;
  warnings: string[];
}

export function unreadable(message = 'This source could not be read. Replace it with an unencrypted PDF or DOCX, or paste its text.') {
  return new DocumentPreparationError('SOURCE_UNREADABLE', message);
}
export function limitExceeded(message = 'The document exceeds a supported preparation limit. Split it into a smaller file or paste the relevant text.') {
  return new DocumentPreparationError('DOCUMENT_LIMIT_EXCEEDED', message);
}
export function normalizeSourceText(text: string) {
  const normalized = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  if (normalized.length > DOCUMENT_LIMITS.maximumTextCharacters) throw limitExceeded('Extracted text exceeds 2,000,000 characters. Split the source or paste the relevant requirements.');
  for (const character of normalized) {
    const value = character.charCodeAt(0);
    if (value < 32 && value !== 9 && value !== 10) throw unreadable('The source contains unsupported binary control characters. Save it as UTF-8 text or paste the requirements.');
  }
  return normalized;
}
export function mapParagraphs(text: string, page: number | null, baseOffset = 0, firstIndex = 0): SourceParagraph[] {
  const result: SourceParagraph[] = [];
  let offset = 0; let start: number | null = null; let end = 0;
  function flush() {
    if (start !== null) {
      if (firstIndex + result.length >= DOCUMENT_LIMITS.maximumParagraphs) throw limitExceeded('The source exceeds 10,000 paragraphs. Split it or paste the relevant requirements.');
      result.push({ index: firstIndex + result.length, page, start: baseOffset + start, end: baseOffset + end, text: text.slice(start, end) });
    }
    start = null;
  }
  for (const line of text.split('\n')) {
    if (line.trim()) { start ??= offset; end = offset + line.length; } else flush();
    offset += line.length + 1;
  }
  flush(); return result;
}
