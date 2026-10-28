import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { strToU8 } from 'fflate';
import { docx, pdf } from './document-fixtures.ts';
import { prepareDocument, prepareAndStoreDocument, DocumentPreparationError, DOCUMENT_LIMITS, type DocumentStoragePort } from '../../apps/worker/src/index.ts';
import { validateSpecsExtraction } from '../../packages/integrations/src/specs-schema.ts';
import type { SpecsExtractionInput } from '../../packages/integrations/src/specs-types.ts';

const sourceAssetId = 'synthetic-source-document';
const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
function rejectsCode(operation: Promise<unknown>, code: string) {
  return assert.rejects(operation, (error: unknown) => error instanceof DocumentPreparationError && error.code === code);
}

test('UTF-8 preparation preserves Arabic/mixed source and exact paragraph evidence offsets', async () => {
  const bytes = Buffer.from('نحتاج ثلاثة ممثلين\r\n\r\nRole: Waiter — English / العربية\r\nTwo scenes, one role.');
  const result = await prepareDocument({ bytes, mimeType: 'text/plain', sourceAssetId });
  assert.equal(result.extractionMethod, 'plain_text');
  assert.equal(result.sourceSha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(result.paragraphs.length, 2);
  assert.match(result.text, /العربية/);
  for (const paragraph of result.paragraphs) assert.equal(result.text.slice(paragraph.start, paragraph.end), paragraph.text);
});

test('genuine DOCX extracts supplied English and Arabic paragraph text without HTML execution', async () => {
  const result = await prepareDocument({ bytes: docx(['Role: Waiter', 'مطلوب ثلاثة أشخاص', '<script>supplied literal text</script>']), mimeType: docxMime, sourceAssetId });
  assert.equal(result.extractionMethod, 'docx_text');
  assert.equal(result.paragraphs.length, 3);
  assert.match(result.text, /مطلوب ثلاثة أشخاص/);
  assert.match(result.text, /<script>supplied literal text<\/script>/);
});

test('genuine two-page PDF retains page references; scanned/no-text PDF requests vision or manual text', async () => {
  const result = await prepareDocument({ bytes: pdf(['Three waiters required.', 'Father appears in three scenes.']), mimeType: 'application/pdf', sourceAssetId });
  assert.equal(result.extractionMethod, 'pdf_text');
  assert.match(result.text, /Three waiters required/);
  assert.deepEqual(result.paragraphs.map(paragraph => paragraph.page), [1, 2]);
  for (const paragraph of result.paragraphs) assert.equal(result.text.slice(paragraph.start, paragraph.end), paragraph.text);
  await rejectsCode(prepareDocument({ bytes: pdf(['']), mimeType: 'application/pdf', sourceAssetId }), 'DOCUMENT_VISION_REQUIRED');
});

test('real prepared paragraph indices resolve exact source/page/text in the extraction evidence validator', async () => {
  const prepared = await prepareDocument({ bytes: pdf(['Casting brief.', 'Three waiters required.']), mimeType: 'application/pdf', sourceAssetId });
  const input: SpecsExtractionInput = { sourceAssetId: prepared.sourceAssetId, paragraphs: prepared.paragraphs, correlationId: 'synthetic-paragraph-seam', inputHash: prepared.sourceSha256 };
  assert.deepEqual(input.paragraphs.map(paragraph => paragraph.index), [0, 1]);
  const evidence = { asset_id: prepared.sourceAssetId, page: 2, paragraph: prepared.paragraphs[1].index, segment_index: null, start_ms: null, end_ms: null, quote: 'Three waiters required.' };
  const extraction = { schema_version: '1.0', source_asset_id: prepared.sourceAssetId, source_language_codes: ['en'], roles: [{ source_role_key: 'waiter', name: 'Waiter', headcount: 3, category: null, requirements: { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null }, evidence: [evidence], clarifications: [] }], general_instructions: null, clarifications: [] };
  assert.equal(validateSpecsExtraction(extraction, input).roles[0].evidence[0].quote, prepared.paragraphs[1].text);
  assert.throws(() => validateSpecsExtraction({ ...extraction, source_asset_id: 'other-source' }, input), /source identity/);
  assert.throws(() => validateSpecsExtraction({ ...extraction, roles: [{ ...extraction.roles[0], evidence: [{ ...evidence, page: 1 }] }] }, input), /paragraph, page or source quote/);
});

test('malformed input, unsupported legacy Word and unsafe archive paths fail with actionable typed errors', async () => {
  await rejectsCode(prepareDocument({ bytes: new Uint8Array([255, 254, 255]), mimeType: 'text/plain', sourceAssetId }), 'SOURCE_UNREADABLE');
  await rejectsCode(prepareDocument({ bytes: Buffer.from('%PDF-1.7\nbroken'), mimeType: 'application/pdf', sourceAssetId }), 'SOURCE_UNREADABLE');
  await rejectsCode(prepareDocument({ bytes: Buffer.from('legacy Word'), mimeType: 'application/msword', sourceAssetId }), 'DOCUMENT_CONVERSION_REQUIRED');
  await rejectsCode(prepareDocument({ bytes: docx(['safe'], { '../outside.xml': strToU8('unsafe') }), mimeType: docxMime, sourceAssetId }), 'DOCUMENT_ARCHIVE_UNSAFE');
  await rejectsCode(prepareDocument({ bytes: Buffer.from('not a zip'), mimeType: docxMime, sourceAssetId }), 'SOURCE_UNREADABLE');
});

test('byte, text, page and DOCX expansion limits reject bounded denial-of-service inputs', async () => {
  await rejectsCode(prepareDocument({ bytes: new Uint8Array(DOCUMENT_LIMITS.maximumBytes + 1), mimeType: 'text/plain', sourceAssetId }), 'DOCUMENT_LIMIT_EXCEEDED');
  await rejectsCode(prepareDocument({ bytes: Buffer.from('x'.repeat(DOCUMENT_LIMITS.maximumTextCharacters + 1)), mimeType: 'text/plain', sourceAssetId }), 'DOCUMENT_LIMIT_EXCEEDED');
  await rejectsCode(prepareDocument({ bytes: pdf(Array.from({ length: DOCUMENT_LIMITS.maximumPages + 1 }, () => 'text')), mimeType: 'application/pdf', sourceAssetId }), 'DOCUMENT_LIMIT_EXCEEDED');
  await rejectsCode(prepareDocument({ bytes: docx(['x'.repeat(400_000)]), mimeType: docxMime, sourceAssetId }), 'DOCUMENT_LIMIT_EXCEEDED');
});

test('DOCX rejects entity declarations and encrypted entries before text parsing', async () => {
  const entities = docx(['safe'], { 'word/entity.xml': strToU8('<!DOCTYPE x [<!ENTITY bomb "unsafe">]><x>&bomb;</x>') });
  await rejectsCode(prepareDocument({ bytes: entities, mimeType: docxMime, sourceAssetId }), 'DOCUMENT_ARCHIVE_UNSAFE');
  const encrypted = Buffer.from(docx(['private']));
  for (let offset = 0; offset < encrypted.length - 10; offset++) {
    const signature = encrypted.readUInt32LE(offset);
    if (signature === 0x04034b50) encrypted.writeUInt16LE(encrypted.readUInt16LE(offset + 6) | 1, offset + 6);
    if (signature === 0x02014b50) encrypted.writeUInt16LE(encrypted.readUInt16LE(offset + 8) | 1, offset + 8);
  }
  await rejectsCode(prepareDocument({ bytes: encrypted, mimeType: docxMime, sourceAssetId }), 'DOCUMENT_ENCRYPTED');
});

test('DOCX relationship policy checks decoded XML attributes regardless of namespace prefix', async () => {
  const namespaced = '<r:Relationships xmlns:r="http://schemas.openxmlformats.org/package/2006/relationships"><r:Relationship Id="external" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="file:///private/source" TargetMode="External"/></r:Relationships>';
  const encoded = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="external" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="file:///private/source" TargetMode="Exter&#110;al"/></Relationships>';
  for (const relationship of [namespaced, encoded]) {
    await rejectsCode(prepareDocument({ bytes: docx(['safe'], { 'word/_rels/unused.xml.rels': strToU8(relationship) }), mimeType: docxMime, sourceAssetId }), 'DOCUMENT_ARCHIVE_UNSAFE');
  }
});

test('DOCX rejects corrupt entry checksums even when expanded byte counts still match', async () => {
  const corrupt = Buffer.from(docx(['Source bytes must pass integrity checks.']));
  for (let offset = 0; offset < corrupt.length - 20; offset++) {
    if (corrupt.readUInt32LE(offset) === 0x02014b50) corrupt.writeUInt32LE(0, offset + 16);
  }
  await rejectsCode(prepareDocument({ bytes: corrupt, mimeType: docxMime, sourceAssetId }), 'SOURCE_UNREADABLE');
});

test('prepared output is reserved, written and verified before returning the exact callback projection', async () => {
  let stored: Uint8Array | undefined;
  const scope = { jobId: 'synthetic-job', attemptId: 'synthetic-attempt', leaseToken: 'synthetic-test-lease' };
  const storage: DocumentStoragePort = {
    async reserveOutput(input) { assert.equal(input.parent_asset_id, sourceAssetId); assert.equal(input.asset_kind, 'document_text'); return { assetId: 'reserved-text-asset' }; },
    async writeOutput(input) { assert.equal(input.assetId, 'reserved-text-asset'); stored = input.bytes; },
    async completeOutput(input) { assert.ok(stored); assert.equal(input.actual_size_bytes, stored.length); assert.equal(input.sha256, createHash('sha256').update(stored).digest('hex')); },
  };
  const result = await prepareAndStoreDocument({ bytes: Buffer.from('Supplied role requirements.'), mimeType: 'text/plain', sourceAssetId }, scope, storage);
  assert.deepEqual(result, { source_asset_id: sourceAssetId, text_asset_id: 'reserved-text-asset', page_assets: [], paragraph_count: 1, extraction_method: 'plain_text', warnings: [] });
  assert.match(Buffer.from(stored!).toString(), /Supplied role requirements/);
  await assert.rejects(prepareAndStoreDocument({ bytes: Buffer.from('source'), mimeType: 'text/plain', sourceAssetId }, scope, { ...storage, async completeOutput() { throw new Error('Output not verified'); } }), /Output not verified/);
});
