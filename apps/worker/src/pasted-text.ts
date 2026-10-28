import { createHash } from 'node:crypto';
import { DOCUMENT_LIMITS, limitExceeded, mapParagraphs, normalizeSourceText, unreadable, type PreparedDocument } from './types.ts';

/** Original UTF8 encoding, never a normalized-text hash or a fabricated asset. */
export function pastedTextBytes(text: string): Buffer {
  if (typeof text !== 'string') throw unreadable('Paste readable source requirements.');
  if (text.length > DOCUMENT_LIMITS.maximumTextCharacters || Buffer.byteLength(text, 'utf8') > DOCUMENT_LIMITS.maximumBytes) throw limitExceeded();
  if (!text.trim()) throw unreadable('Paste readable source requirements.');
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.toString('utf8') !== text) throw unreadable('The pasted source contains invalid Unicode. Paste valid text.');
  return bytes;
}
export function preparePastedText(source: string): PreparedDocument {
  const bytes = pastedTextBytes(source); const text = normalizeSourceText(source);
  return { sourceAssetId: null, sourceSha256: createHash('sha256').update(bytes).digest('hex'), text,
    paragraphs: mapParagraphs(text, null), extractionMethod: 'plain_text', warnings: [] };
}
