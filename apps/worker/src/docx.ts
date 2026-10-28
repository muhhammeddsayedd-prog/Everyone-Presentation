import mammoth from 'mammoth';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import { DOMParser } from '@xmldom/xmldom';
import { crc32 } from 'node:zlib';
import { DOCUMENT_LIMITS, DocumentPreparationError, limitExceeded, unreadable, normalizeSourceText } from './types.ts';

function unsafe(message = 'The DOCX archive contains unsupported paths or active XML declarations. Re-save it as a standard DOCX, or paste its text.') {
  return new DocumentPreparationError('DOCUMENT_ARCHIVE_UNSAFE', message);
}
function safeEntry(entry: Entry, seen: Set<string>) {
  const path = entry.fileName;
  if (!path || path.includes('\\') || path.includes('\u0000') || path.startsWith('/') || /^[a-z]:/iu.test(path) || path.split('/').some(part => part === '.' || part === '..') || seen.has(path)) throw unsafe();
  seen.add(path);
  if (((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000) throw unsafe();
  if (entry.isEncrypted()) throw new DocumentPreparationError('DOCUMENT_ENCRYPTED', 'Password-protected Word files are not supported. Upload an unencrypted DOCX or paste its text.');
  if (![0, 8].includes(entry.compressionMethod)) throw unreadable('The DOCX compression method is unsupported. Re-save it as a standard DOCX or paste its text.');
  if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0 || entry.uncompressedSize > DOCUMENT_LIMITS.maximumZipEntryBytes) throw limitExceeded('A DOCX part exceeds the supported expanded size. Remove embedded media or paste the relevant text.');
  if (entry.uncompressedSize / Math.max(1, entry.compressedSize) > DOCUMENT_LIMITS.maximumCompressionRatio) throw limitExceeded('The DOCX archive expands beyond the supported compression ratio. Re-save a smaller source or paste its text.');
  if (/(^|\/)vbaProject\.bin$/iu.test(path)) throw unsafe('Macro-enabled Word documents are not supported. Save a macro-free DOCX or paste its text.');
}

async function readEntry(zip: ZipFile, entry: Entry, addBytes: (size: number) => void) {
  if (entry.fileName.endsWith('/')) {
    if (entry.uncompressedSize !== 0 || entry.crc32 !== 0) throw unsafe();
    return;
  }
  const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => zip.openReadStream(entry, (error, value) => error || !value ? reject(error ?? unreadable()) : resolve(value)));
  let length = 0;
  let checksum = 0;
  const chunks: Buffer[] = [];
  const isXml = /\.(xml|rels)$/iu.test(entry.fileName);
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk as Uint8Array);
    length += bytes.length; addBytes(bytes.length);
    checksum = crc32(bytes, checksum);
    if (length > DOCUMENT_LIMITS.maximumZipEntryBytes || length > entry.uncompressedSize) throw limitExceeded();
    if (isXml) chunks.push(bytes);
  }
  if (length !== entry.uncompressedSize || checksum !== entry.crc32) throw unreadable('A DOCX part failed its size or checksum check. Replace the damaged file or paste its text.');
  if (isXml) {
    let xml: string;
    try { xml = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); } catch { throw unreadable('DOCX XML encoding is unsupported or damaged. Re-save it as a standard DOCX or paste its text.'); }
    if (xml.includes('\u0000') || /<!\s*(DOCTYPE|ENTITY)\b/iu.test(xml)) throw unsafe();
    // Raw text extraction never needs external images, templates or other files.
    if (entry.fileName.endsWith('.rels')) {
      const rejectInvalidXml = () => { throw unsafe('A Word relationship part is malformed. Re-save the DOCX or paste its text.'); };
      const document = new DOMParser({ errorHandler: { warning: rejectInvalidXml, error: rejectInvalidXml, fatalError: rejectInvalidXml } }).parseFromString(xml, 'application/xml');
      if (document.doctype) throw unsafe();
      const relationships = document.getElementsByTagName('*');
      for (let index = 0; index < relationships.length; index++) {
        const relationship = relationships.item(index)!;
        if (relationship.localName !== 'Relationship') continue;
        const mode = (relationship.getAttribute('TargetMode') ?? '').trim().toLowerCase();
        const type = relationship.getAttribute('Type') ?? '';
        if (mode === 'external' && !type.endsWith('/hyperlink')) throw unsafe('External document parts are unsupported. Embed the required content in a standard DOCX or paste its text.');
      }
    }
  }
}

export async function preflightDocx(bytes: Buffer) {
  return new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(bytes, { lazyEntries: true, autoClose: true, validateEntrySizes: true, strictFileNames: true }, (openError, zip) => {
      if (openError || !zip) { reject(unreadable()); return; }
      let finished = false; let entryCount = 0; let expandedBytes = 0;
      const seen = new Set<string>();
      function fail(error: unknown) {
        if (finished) return; finished = true; zip!.close();
        const known = error instanceof DocumentPreparationError ? error : /invalid (relative )?path|absolute path|invalid characters in fileName/iu.test(error instanceof Error ? error.message : '') ? unsafe() : unreadable();
        reject(known);
      }
      zip.on('error', fail);
      zip.on('end', () => {
        if (finished) return;
        if (!seen.has('word/document.xml') || !seen.has('[Content_Types].xml') || !seen.has('_rels/.rels')) { fail(unreadable('This archive is not a supported Word DOCX. Re-save the document or paste its text.')); return; }
        finished = true; resolve();
      });
      zip.on('entry', (entry: Entry) => {
        try {
          if (++entryCount > DOCUMENT_LIMITS.maximumZipEntries) throw limitExceeded('The DOCX contains too many archive entries. Simplify the source or paste the requirements.');
          safeEntry(entry, seen);
          if (expandedBytes + entry.uncompressedSize > DOCUMENT_LIMITS.maximumZipExpandedBytes) throw limitExceeded();
        } catch (error) { fail(error); return; }
        void readEntry(zip!, entry, size => { expandedBytes += size; if (expandedBytes > DOCUMENT_LIMITS.maximumZipExpandedBytes) throw limitExceeded(); }).then(() => { if (!finished) zip!.readEntry(); }).catch(fail);
      });
      if (zip.entryCount > DOCUMENT_LIMITS.maximumZipEntries) { fail(limitExceeded()); return; }
      zip.readEntry();
    });
  });
}

export async function prepareDocx(bytes: Buffer) {
  await preflightDocx(bytes);
  try {
    // v1.13 extractRawText takes only `input`. Its reader defaults external access off.
    // A second options argument would be ignored; preflight also blocks external parts.
    const result = await mammoth.extractRawText({ buffer: bytes });
    if (result.messages.some(message => message.type === 'error')) throw unreadable();
    return { text: normalizeSourceText(result.value), warnings: result.messages.length ? ['The Word parser reported formatting warnings. Verify the extracted source text.'] : [] };
  } catch (error) { if (error instanceof DocumentPreparationError) throw error; throw unreadable(); }
}
