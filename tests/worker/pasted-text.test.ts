import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createRequire } from 'node:module';
import schema from '../../contracts/json-schema/document-preparation.schema.json' with { type: 'json' };
import { DOCUMENT_LIMITS, DocumentPreparationError, prepareDocument, prepareDocumentIsolated, preparePastedText,
  prepareAndStoreDocument, type DocumentStoragePort, type DocumentPreparationInput } from '../../apps/worker/src/index.ts';
import { validateSpecsExtraction } from '../../packages/integrations/src/specs-schema.ts';

const original = 'نحتاج ثلاثة أشخاص\r\n\r\nRole: Waiter / العربية\rScene1 and Scene3.';
const { Ajv2020 } = createRequire(new URL('../../packages/integrations/package.json', import.meta.url))('ajv/dist/2020.js');
const input = { sourceKind: 'pasted_text' as const, text: original, sourceAssetId: null };
const code = (expected: string) => (error: unknown) => error instanceof DocumentPreparationError && error.code === expected;

test('direct pasted text preserves exact original UTF8 hash and LF paragraph evidence without a manufactured asset', async () => {
  const direct = preparePastedText(original); const isolated = await prepareDocumentIsolated(input);
  assert.deepEqual(isolated, direct); assert.equal(direct.sourceAssetId, null);
  assert.equal(direct.sourceSha256, createHash('sha256').update(Buffer.from(original, 'utf8')).digest('hex'));
  assert.equal(direct.text, 'نحتاج ثلاثة أشخاص\n\nRole: Waiter / العربية\nScene1 and Scene3.');
  assert.deepEqual(direct.paragraphs.map(paragraph => [paragraph.index, paragraph.page]), [[0, null], [1, null]]);
  for (const paragraph of direct.paragraphs) assert.equal(direct.text.slice(paragraph.start, paragraph.end), paragraph.text);
  assert.notEqual(direct.sourceSha256, createHash('sha256').update(direct.text).digest('hex'));
  const bom = '\ufeffSupplied text\r\n';
  assert.deepEqual(await prepareDocumentIsolated({ ...input, text: bom }), preparePastedText(bom));
});

test('empty/whitespace, invalid Unicode, binary controls and paragraph overflow fail before successful preparation', async () => {
  for (const text of ['', ' \r\n\t', 'unpaired\ud800', 'control\0value']) {
    assert.throws(() => preparePastedText(text), code('SOURCE_UNREADABLE'));
    await assert.rejects(prepareDocumentIsolated({ ...input, text }), code('SOURCE_UNREADABLE'));
  }
  const text = Array.from({ length: DOCUMENT_LIMITS.maximumParagraphs + 1 }, () => 'Role').join('\n\n');
  assert.throws(() => preparePastedText(text), code('DOCUMENT_LIMIT_EXCEEDED'));
  await assert.rejects(prepareDocumentIsolated({ ...input, text }), code('DOCUMENT_LIMIT_EXCEEDED'));
  const oversized = 'ع'.repeat(DOCUMENT_LIMITS.maximumTextCharacters + 1);
  assert.throws(() => preparePastedText(oversized), code('DOCUMENT_LIMIT_EXCEEDED'));
  await assert.rejects(prepareDocumentIsolated({ ...input, text: oversized }), code('DOCUMENT_LIMIT_EXCEEDED'));
});

test('null references are allowed only for explicit pasted-text mode; real file identity validation remains strict', async () => {
  const missing = { bytes: Buffer.from('File text'), mimeType: 'text/plain', sourceAssetId: null } as unknown as DocumentPreparationInput;
  await assert.rejects(prepareDocumentIsolated(missing), code('INVALID_SOURCE_REFERENCE'));
  await assert.rejects(prepareDocument(missing as never), code('INVALID_SOURCE_REFERENCE'));
  await assert.rejects(prepareDocumentIsolated({ ...input, sourceAssetId: 'fake-asset' } as unknown as DocumentPreparationInput), code('INVALID_SOURCE_REFERENCE'));
  await assert.rejects(prepareDocumentIsolated({ ...input, bytes: Buffer.from('ambiguous') } as unknown as DocumentPreparationInput), code('SOURCE_UNREADABLE'));
  assert.equal((await prepareDocumentIsolated({ bytes: Buffer.from('Real file'), mimeType: 'text/plain', sourceAssetId: 'actual-file-reference' })).sourceAssetId, 'actual-file-reference');
});

test('pasted text derivative uses an explicit null parent, actual reserved output and schema-valid callback', async () => {
  let stored: Uint8Array | undefined;
  const storage: DocumentStoragePort = {
    async reserveOutput(value) { assert.equal(value.parent_asset_id, null); return { assetId: 'reserved-text-output' }; },
    async writeOutput(value) { stored = value.bytes; },
    async completeOutput(value) { assert.ok(stored); assert.equal(value.sha256, createHash('sha256').update(stored).digest('hex')); },
  };
  const result = await prepareAndStoreDocument(input, { jobId: 'job', attemptId: 'attempt', leaseToken: 'synthetic-lease' }, storage);
  assert.equal(result.source_asset_id, null); assert.equal(result.text_asset_id, 'reserved-text-output');
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert.equal(validate(result), true); assert.equal(result.paragraph_count, 2);
  const parsed = JSON.parse(Buffer.from(stored!).toString('utf8')); assert.equal(parsed.sourceAssetId, null); assert.equal(parsed.sourceSha256, preparePastedText(original).sourceSha256);
});

test('null-source prepared evidence feeds the existing extraction validator without inventing a source ID', () => {
  const prepared = preparePastedText(original);
  const requirements = { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null };
  const result = { schema_version: '1.0', source_asset_id: null, source_language_codes: ['ar', 'en'], general_instructions: null, clarifications: [],
    roles: [{ source_role_key: 'waiter', name: 'Waiter', headcount: 3, category: null, requirements,
      evidence: [{ asset_id: null, page: null, paragraph: 1, segment_index: null, start_ms: null, end_ms: null, quote: 'Role: Waiter' }], clarifications: [] }] };
  assert.deepEqual(validateSpecsExtraction(result, { sourceAssetId: null, paragraphs: prepared.paragraphs,
    inputHash: prepared.sourceSha256, correlationId: 'synthetic-pasted-source' }), result);
});
