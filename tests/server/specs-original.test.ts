import assert from 'node:assert/strict';
import test from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import { docx, pdf } from '../worker/document-fixtures.ts';
import { verifySpecsOriginal } from '../../apps/web/lib/specs-original.ts';

const context = { sourceAssetId: '60000000-0000-4000-8000-000000000001' };
const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const rejected = (error: unknown) => error instanceof Error && 'code' in error && error.code === 'SOURCE_UNREADABLE' && !String(error).includes('private-sentinel');

test('structural original verification accepts actual PDF/DOCX containers and original Arabic/BOM UTF8 without extracting text', async () => {
  const text = Buffer.from('\ufeffعربي\r\nMixed text 😀');
  assert.deepEqual(await verifySpecsOriginal(text, 'text/plain', context), { mimeType: 'text/plain', format: 'utf8_text' });
  assert.deepEqual(await verifySpecsOriginal(pdf(['Synthetic brief']), 'application/pdf', context), { mimeType: 'application/pdf', format: 'pdf' });
  assert.deepEqual(await verifySpecsOriginal(docx(['Synthetic عربي']), docxMime, context), { mimeType: docxMime, format: 'docx' });
  // Format readiness is distinct from text extraction/OCR availability.
  assert.equal((await verifySpecsOriginal(pdf(['']), 'application/pdf', context)).format, 'pdf');
  assert.equal(text.toString('utf8'), '\ufeffعربي\r\nMixed text 😀');
});

test('empty/oversized originals, mismatched magic and invalid UTF8 never produce a verification result', async () => {
  for (const [bytes, mime] of [[Buffer.alloc(0), 'text/plain'], [Buffer.alloc(20 * 1024 * 1024 + 1), 'application/pdf'],
    [Buffer.from('%PDF private-sentinel'), 'application/pdf'], [pdf(['Synthetic']), docxMime], [docx(['Synthetic']), 'application/pdf'],
    [Buffer.from([0xc3, 0x28]), 'text/plain'], [Buffer.from('private-sentinel\0text'), 'text/plain'], [Buffer.from(' \r\n'), 'text/plain']] as const) {
    await assert.rejects(verifySpecsOriginal(bytes, mime, context), rejected);
  }
});

test('PDF envelope requires an in-bounds xref target and terminal EOF; structural checking makes no parseability claim', async () => {
  const valid = pdf(['Synthetic']);
  for (const corrupt of [valid.subarray(0, valid.length - 7), Buffer.from(valid.toString().replace(/startxref\n\d+/u, 'startxref\n99999999')),
    Buffer.concat([valid, Buffer.from('<html>private-sentinel</html>')])]) await assert.rejects(verifySpecsOriginal(corrupt, 'application/pdf', context), rejected);
});

test('DOCX metadata must declare the Word main part; macro, unsafe path and external/entity relationship inputs fail closed', async () => {
  const invalid = [zipSync({ '[Content_Types].xml': strToU8('<Types/>'), '_rels/.rels': strToU8('<Relationships/>'), 'word/document.xml': strToU8('<doc/>') }),
    docx(['Synthetic'], { 'word/vbaProject.bin': new Uint8Array([1]) }), docx(['Synthetic'], { '../private-sentinel': new Uint8Array([1]) }),
    docx(['Synthetic'], { '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/renamed.bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>'), 'word/renamed.bin': new Uint8Array([1]) }),
    docx(['Synthetic'], { 'word/_rels/document.xml.rels': strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><r:Relationship xmlns:r="http://schemas.openxmlformats.org/package/2006/relationships" Id="x" Type="template" TargetMode="Exter&#110;al" Target="https://private-sentinel.invalid"/></Relationships>') }),
    docx(['Synthetic'], { '_rels/.rels': strToU8('<!DOCTYPE r [<!ENTITY x "private-sentinel">]><Relationships>&x;</Relationships>') })];
  for (const bytes of invalid) await assert.rejects(verifySpecsOriginal(bytes, docxMime, context), rejected);
});

test('DOCX checksum corruption and excessive expansion are rejected before a signed receipt is possible', async () => {
  const corrupt = Buffer.from(docx(['Synthetic']));
  for (let offset = 0; offset <= corrupt.length - 20; offset++) if (corrupt.readUInt32LE(offset) === 0x02014b50) corrupt.writeUInt32LE(0, offset + 16);
  await assert.rejects(verifySpecsOriginal(corrupt, docxMime, context), rejected);
  const bomb = docx(['Synthetic'], { 'word/media/private-sentinel.bin': new Uint8Array(2 * 1024 * 1024) });
  await assert.rejects(verifySpecsOriginal(bomb, docxMime, context), rejected);
});
