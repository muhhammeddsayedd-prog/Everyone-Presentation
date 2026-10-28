import { createHash } from 'node:crypto';
import { prepareDocx } from './docx.ts';
import { preparePdf } from './pdf.ts';
import { DOCUMENT_LIMITS, DocumentPreparationError, limitExceeded, unreadable, normalizeSourceText, mapParagraphs, type PrepareDocumentInput, type PreparedDocument } from './types.ts';

export async function prepareDocument(input: PrepareDocumentInput): Promise<PreparedDocument> {
  if (!(input.bytes instanceof Uint8Array) || input.bytes.length === 0) throw unreadable('The source is empty or invalid. Upload a supported document or paste its text.');
  if (input.bytes.length > DOCUMENT_LIMITS.maximumBytes) throw limitExceeded('Document preparation supports files up to 20 MiB. Split the source or paste the relevant requirements.');
  if (typeof input.sourceAssetId !== 'string' || !input.sourceAssetId.trim() || input.sourceAssetId.length > 200) throw new DocumentPreparationError('INVALID_SOURCE_REFERENCE', 'A verified source asset reference is required.');
  const bytes = Buffer.from(input.bytes);
  const common = { sourceAssetId: input.sourceAssetId, sourceSha256: createHash('sha256').update(bytes).digest('hex') };
  if (input.mimeType === 'text/plain') {
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw unreadable('The text file is not valid UTF-8. Save it as UTF-8 or paste the requirements.'); }
    text = normalizeSourceText(text);
    return { ...common, text, paragraphs: mapParagraphs(text, null), extractionMethod: 'plain_text', warnings: [] };
  }
  if (input.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await prepareDocx(bytes);
    return { ...common, ...result, paragraphs: mapParagraphs(result.text, null), extractionMethod: 'docx_text' };
  }
  if (input.mimeType === 'application/pdf') return { ...common, ...await preparePdf(bytes), extractionMethod: 'pdf_text' };
  if (input.mimeType === 'application/msword') throw new DocumentPreparationError('DOCUMENT_CONVERSION_REQUIRED', 'Legacy .doc conversion is not configured. Save the source as DOCX or a text-rich PDF, or paste its text.');
  throw new DocumentPreparationError('DOCUMENT_TYPE_UNSUPPORTED', 'Use UTF-8 text, a text-rich PDF or a standard DOCX. Other source formats are not supported.');
}
