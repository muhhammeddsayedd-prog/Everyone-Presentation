import yauzl, { type Entry, type ZipFile } from 'yauzl';
import { DOMParser } from '@xmldom/xmldom';
import { crc32 } from 'node:zlib';
import type { SpecsMime, SpecsVerifiedDocument } from '@eps/central';

const MAXIMUM_BYTES = 20 * 1024 * 1024;
const XML_METADATA_BYTES = 256 * 1024;
const PACKAGE_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const MAIN_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
export class SpecsOriginalError extends Error {
  readonly code = 'SOURCE_UNREADABLE';
  constructor() { super('Use an intact PDF, macro-free DOCX or UTF-8 text document up to 20 MiB.'); }
}
function invalid(): never { throw new SpecsOriginalError(); }
function xml(bytes: Buffer) {
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return invalid(); }
  if (text.includes('\0') || /<!\s*(DOCTYPE|ENTITY)\b/iu.test(text)) invalid();
  return text;
}
function parseMetadata(bytes: Buffer) {
  if (bytes.length > XML_METADATA_BYTES) invalid();
  const fail = () => invalid();
  const result = new DOMParser({ errorHandler: { warning: fail, error: fail, fatalError: fail } }).parseFromString(xml(bytes), 'application/xml');
  if (result.doctype || !result.documentElement) invalid();
  return result;
}
function checkMetadata(name: string, bytes: Buffer) {
  const document = parseMetadata(bytes); const root = document.documentElement;
  if (name === '[Content_Types].xml') {
    if (root.localName !== 'Types' || root.namespaceURI !== TYPES_NS) invalid();
    const declarations = document.getElementsByTagNameNS(TYPES_NS, '*');
    for (let index = 0; index < declarations.length; index++) {
      if (/macroEnabled|vbaProject/iu.test(declarations.item(index)!.getAttribute('ContentType') ?? '')) invalid();
    }
    const overrides = document.getElementsByTagNameNS(TYPES_NS, 'Override'); let main = 0;
    for (let index = 0; index < overrides.length; index++) {
      const item = overrides.item(index)!;
      if (item.getAttribute('PartName') === '/word/document.xml') {
        if (item.getAttribute('ContentType') !== MAIN_TYPE) invalid(); main++;
      }
    }
    if (main !== 1) invalid();
  } else {
    if (root.localName !== 'Relationships' || root.namespaceURI !== PACKAGE_NS) invalid();
    const relationships = document.getElementsByTagName('*'); let main = 0;
    for (let index = 0; index < relationships.length; index++) {
      const item = relationships.item(index)!; if (item.localName !== 'Relationship') continue;
      if (item.namespaceURI !== PACKAGE_NS) invalid();
      const type = item.getAttribute('Type') ?? ''; const mode = (item.getAttribute('TargetMode') ?? '').trim().toLowerCase();
      if (mode && !['internal', 'external'].includes(mode) || mode === 'external' && !type.endsWith('/hyperlink')) invalid();
      if (name === '_rels/.rels' && type.endsWith('/officeDocument')) {
        if (mode === 'external' || !['word/document.xml', '/word/document.xml'].includes(item.getAttribute('Target') ?? '')) invalid(); main++;
      }
    }
    if (name === '_rels/.rels' && main !== 1) invalid();
  }
}
async function verifyDocx(bytes: Buffer) {
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(bytes, { lazyEntries: true, autoClose: true, strictFileNames: true, validateEntrySizes: true }, (error, archive) => {
      if (error || !archive) { reject(new SpecsOriginalError()); return; }
      const zip: ZipFile = archive; const seen = new Set<string>();
      let settled = false; let entries = 0; let total = 0; let stream: NodeJS.ReadableStream & { destroy?: () => void } | undefined;
      const timer = setTimeout(() => fail(), 10_000);
      function fail() { if (settled) return; settled = true; clearTimeout(timer); stream?.destroy?.(); zip.close(); reject(new SpecsOriginalError()); }
      zip.on('error', fail);
      zip.on('end', () => {
        if (settled) return;
        if (!['[Content_Types].xml', '_rels/.rels', 'word/document.xml'].every(name => seen.has(name))) { fail(); return; }
        settled = true; clearTimeout(timer); resolve();
      });
      zip.on('entry', (entry: Entry) => {
        const name = entry.fileName;
        if (++entries > 1000 || !name || name.length > 1024 || seen.has(name) || /[\\\0]/u.test(name) || name.startsWith('/') || /^[a-z]:/iu.test(name)
          || name.split('/').some(part => part === '.' || part === '..') || /(^|\/)vbaProject\.bin$/iu.test(name)
          || ((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000 || entry.isEncrypted() || ![0, 8].includes(entry.compressionMethod)
          || !Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0 || entry.uncompressedSize > 16 * 1024 * 1024
          || entry.uncompressedSize / Math.max(1, entry.compressedSize) > 200 || total + entry.uncompressedSize > 40 * 1024 * 1024) { fail(); return; }
        seen.add(name);
        if (name.endsWith('/')) { if (entry.uncompressedSize || entry.crc32) fail(); else zip.readEntry(); return; }
        zip.openReadStream(entry, (readError, opened) => {
          if (readError || !opened || settled) { opened?.destroy(); fail(); return; }
          stream = opened;
          void (async () => {
            let size = 0; let checksum = 0; const chunks: Buffer[] = [];
            const isXml = /\.(xml|rels)$/iu.test(name); const metadata = name === '[Content_Types].xml' || /\.rels$/iu.test(name);
            for await (const chunk of opened) {
              const part = Buffer.from(chunk as Uint8Array); size += part.length; total += part.length; checksum = crc32(part, checksum);
              if (settled || size > entry.uncompressedSize || total > 40 * 1024 * 1024 || metadata && size > XML_METADATA_BYTES) invalid();
              if (isXml) chunks.push(part);
            }
            if (size !== entry.uncompressedSize || checksum !== entry.crc32) invalid();
            if (isXml) { const content = Buffer.concat(chunks); if (metadata) checkMetadata(name, content); else xml(content); }
            if (!settled) zip.readEntry();
          })().catch(fail);
        });
      });
      if (zip.entryCount > 1000) fail(); else zip.readEntry();
    });
  });
}
function verifyPdf(bytes: Buffer) {
  if (!/^%PDF-(1\.[0-7]|2\.0)[\r\n]/u.test(bytes.subarray(0, 10).toString('latin1'))) invalid();
  const tail = bytes.subarray(Math.max(0, bytes.length - 65536)).toString('latin1');
  const trailer = /startxref\s+([0-9]{1,10})\s+%%EOF[\t\r\n\f ]*$/u.exec(tail);
  if (!trailer) invalid();
  const offset = Number(trailer[1]); if (!Number.isSafeInteger(offset) || offset < 8 || offset >= bytes.length) invalid();
  const section = bytes.subarray(offset, Math.min(bytes.length, offset + 4096)).toString('latin1');
  if (!/^xref\b/u.test(section) && !/^\d+\s+\d+\s+obj\b/u.test(section)) invalid();
  if (!/^xref\b/u.test(section) && !/\/Type\s*\/XRef\b/u.test(section)) invalid();
}
/** Admission checks only: private immutable original format, ZIP integrity and
 * UTF8 validity. Actual PDF/DOCX parsing, page/text limits and scanned-document
 * detection remain in the isolated worker, after source submission. */
export async function verifySpecsOriginal(input: Uint8Array, mimeType: SpecsMime, context: { sourceAssetId: string }): Promise<SpecsVerifiedDocument> {
  if (!(input instanceof Uint8Array) || input.byteLength < 1 || input.byteLength > MAXIMUM_BYTES
    || !context || typeof context.sourceAssetId !== 'string' || !context.sourceAssetId || context.sourceAssetId.length > 200) invalid();
  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  try {
    if (mimeType === 'application/pdf') { verifyPdf(bytes); return { mimeType, format: 'pdf' }; }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      if (bytes.readUInt32LE(0) !== 0x04034b50) invalid(); await verifyDocx(bytes); return { mimeType, format: 'docx' };
    }
    if (mimeType !== 'text/plain') invalid();
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    if (!text.trim()) invalid();
    for (const character of text) {
      const code = character.charCodeAt(0); if (code < 32 && ![9, 10, 13].includes(code) || code === 127) invalid();
    }
    return { mimeType, format: 'utf8_text' };
  } catch { return invalid(); }
}
