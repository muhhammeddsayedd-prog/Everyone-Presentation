import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { prepareSpecsFileStage, parseServiceAssetAccess, serializeSpecsPreparation, type SpecsAssetPort, type SpecsAssetScope, type SpecsFileInput } from '../../apps/worker/src/specs-assets.ts';
import { prepareDocumentIsolated } from '../../apps/worker/src/process.ts';
import { DocumentPreparationError } from '../../apps/worker/src/types.ts';
import { docx, pdf } from './document-fixtures.ts';

const sourceId = '11111111-1111-4111-8111-111111111111';
const outputId = '22222222-2222-4222-8222-222222222222';
const scope: SpecsAssetScope = { job_id: '33333333-3333-4333-8333-333333333333', attempt_id: '44444444-4444-4444-8444-444444444444', lease_token: 'synthetic-private-lease' };
const key = 'sb_publishable_synthetic_public_test_key';
const source = Buffer.from('\ufeffSynthetic document 😀\r\n\r\nمتطلبات الدور', 'utf8');
const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const input: SpecsFileInput = { source_asset_id: sourceId, source_sha256: sha(source), mime_type: 'text/plain', size_bytes: source.length };
function capability(assetId: string, method: 'GET' | 'POST', size: number, hash: string | null, original = false, mime = input.mime_type) {
  const bucket = original ? 'eps-specs-assets' : 'eps-specs-outputs';
  const extension = mime === 'application/pdf' ? 'pdf' : mime === 'text/plain' ? 'txt' : 'docx';
  const path = original ? `assets/${sourceId}/original.${extension}` : `jobs/${scope.job_id}/attempts/${scope.attempt_id}/${outputId}.json`;
  return { asset_id: assetId, url: `https://pyibofyctwnqpvktepse.supabase.co/storage/v1/object/${method === 'GET' ? 'authenticated/' : ''}${bucket}/${path}`,
    method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'x-eps-asset-grant': 'synthetic-private-capability',
      ...(method === 'POST' ? { 'Content-Type': 'application/json', 'x-upsert': 'false' } : {}) },
    expires_at: new Date(Date.now() + 60_000).toISOString(), mime_type: original ? mime : 'application/json', size_bytes: size, sha256: hash };
}
async function fixture(ready = false, originalBytes: Uint8Array = source, mime = input.mime_type) {
  const fileInput: SpecsFileInput = { ...input, source_sha256: sha(originalBytes), size_bytes: originalBytes.length, mime_type: mime };
  const prepared = await prepareDocumentIsolated({ sourceKind: 'asset', bytes: originalBytes, mimeType: mime, sourceAssetId: sourceId });
  let bytes = Buffer.from(JSON.stringify({ schema_version: 'document-text-v1', ...prepared }), 'utf8');
  const expected = Buffer.from(bytes); const calls: string[] = [];
  const asset = (status: 'uploading' | 'ready') => ({ id: outputId, purpose: 'document_text', filename: 'prepared-document.json', mime_type: 'application/json',
    size_bytes: expected.length, sha256: status === 'ready' ? sha(expected) : null, status, duration_ms: null, width: null, height: null,
    source_asset_id: sourceId, source_timestamp_ms: null, created_at: '2026-10-29T00:00:00Z' });
  const port: SpecsAssetPort = {
    async getAssetAccess(value) { assert.equal(value.job_id, scope.job_id); assert.equal(value.lease_token, scope.lease_token);
      return value.asset_id === sourceId ? capability(sourceId, 'GET', originalBytes.length, sha(originalBytes), true, mime)
        : capability(outputId, 'GET', expected.length, ready ? sha(expected) : null); },
    async reserveOutput(value) { calls.push('reserve'); assert.equal(value.output_key, 'document_text'); assert.equal(value.parent_asset_id, sourceId);
      assert.equal(value.expected_size_bytes, expected.length);
      return { asset: asset(ready ? 'ready' : 'uploading'), access: capability(outputId, ready ? 'GET' : 'POST', expected.length, ready ? sha(expected) : null) }; },
    async completeOutput(value) { calls.push('complete'); assert.equal(value.sha256, sha(expected)); assert.equal(value.actual_size_bytes, expected.length); return asset('ready'); },
    async storePreparation(value) { calls.push('store'); assert.equal(value.payload_utf8, expected.toString('utf8')); return { stored: true }; },
  };
  const fetch: typeof globalThis.fetch = async (url, init) => {
    assert.equal(init?.redirect, 'error');
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers['x-eps-asset-grant'], 'synthetic-private-capability');
    if (/\/original\.(?:txt|pdf|docx)$/u.test(String(url))) { calls.push('original_get'); return new Response(Buffer.from(originalBytes), { headers: { 'content-type': mime, 'content-length': String(originalBytes.length) } }); }
    if (init?.method === 'POST') { calls.push('post'); assert.equal(headers['x-upsert'], 'false'); bytes = Buffer.from(init.body as Uint8Array); return new Response('{}', { status: 201 }); }
    calls.push('output_get'); return new Response(bytes, { headers: { 'content-type': 'application/json' } });
  };
  return { port, fetch, calls, expected, fileInput, corrupt: () => { bytes[0] ^= 1; } };
}
test('real isolated UTF8 preparation verifies immutable source/output and stores exact private payload before returning refs', async () => {
  const f = await fixture(); const result = await prepareSpecsFileStage(input, scope, f.port, { publishableKey: key, fetch: f.fetch });
  assert.deepEqual(f.calls, ['original_get', 'reserve', 'post', 'output_get', 'complete', 'store']);
  assert.equal(result.source_asset_id, sourceId); assert.equal(result.text_asset_id, outputId); assert.equal(result.paragraph_count, 2);
  assert.ok(!JSON.stringify(result).includes('synthetic-private') && !JSON.stringify(result).includes('متطلبات'));
  const saved = JSON.parse(f.expected.toString('utf8')); assert.equal(saved.sourceSha256, input.source_sha256);
  assert.equal(saved.sourceAssetId, sourceId); assert.equal(saved.schema_version, 'document-text-v1');
});
test('ready reservation replay verifies existing bytes and never remints an overwrite', async () => {
  const f = await fixture(true); await prepareSpecsFileStage(input, scope, f.port, { publishableKey: key, fetch: f.fetch });
  assert.deepEqual(f.calls, ['original_get', 'reserve', 'output_get', 'complete', 'store']);
});
test('a Ready replay still requires non-null trusted metadata hash', async () => {
  const f = await fixture(true); const reserve = f.port.reserveOutput;
  f.port.reserveOutput = async (...args) => { const value = await reserve(...args) as { asset: unknown; access: Record<string, unknown> };
    return { ...value, access: { ...value.access, sha256: null } }; };
  await assert.rejects(prepareSpecsFileStage(input, scope, f.port, { publishableKey: key, fetch: f.fetch }), DocumentPreparationError);
  assert.ok(!f.calls.includes('post') && !f.calls.includes('complete') && !f.calls.includes('store'));
});
test('corrupt uploaded readback prevents Ready completion and private preparation storage', async () => {
  const f = await fixture(true); f.corrupt();
  await assert.rejects(prepareSpecsFileStage(input, scope, f.port, { publishableKey: key, fetch: f.fetch }), DocumentPreparationError);
  assert.ok(!f.calls.includes('complete') && !f.calls.includes('store'));
});
test('misbound destinations, methods, credential headers and token URLs fail closed without private diagnostics', () => {
  const good = capability(sourceId, 'GET', source.length, sha(source), true);
  const expected = { scope, assetId: sourceId, mode: 'original' as const, method: 'GET' as const, mime: input.mime_type, size: source.length, hash: sha(source) };
  assert.equal(parseServiceAssetAccess(good, expected, { publishableKey: key }).asset_id, sourceId);
  for (const change of [{ url: good.url + '?token=synthetic-private-capability' }, { url: good.url.replace('.supabase.co', '.attacker.test') },
    { method: 'POST' }, { asset_id: outputId }, { size_bytes: 0 }, { sha256: null }, { headers: { ...good.headers, Authorization: 'Bearer user-or-service-role' } },
    { headers: { ...good.headers, authorization: `Bearer ${key}` } }, { headers: { ...good.headers, 'x-unexpected-secret': 'private' } }]) {
    assert.throws(() => parseServiceAssetAccess({ ...good, ...change }, expected, { publishableKey: key }), error => {
      assert.ok(!(error as Error).message.includes('private-capability')); return true;
    });
  }
});
test('source MIME/hash/size mismatch or an unresponsive GET cannot reach reservation/parser output', async () => {
  const f = await fixture(); let reservations = 0; f.port.reserveOutput = async () => { reservations++; throw new Error('never'); };
  for (const fetch of [async () => new Response(source, { headers: { 'content-type': 'application/pdf' } }),
    async () => new Response(Buffer.from('wrong bytes'), { headers: { 'content-type': 'text/plain' } }),
    async () => await new Promise<Response>(() => undefined)]) {
    await assert.rejects(prepareSpecsFileStage(input, scope, f.port, { publishableKey: key, fetch, timeoutMs: 10 }), DocumentPreparationError);
  }
  assert.equal(reservations, 0);
});
test('private prepared JSON rejects invalid PostgreSQL Unicode scalars before storage while preserving valid Arabic/astral text', async () => {
  const prepared = await prepareDocumentIsolated({ sourceKind: 'asset', bytes: source, mimeType: 'text/plain', sourceAssetId: sourceId });
  assert.equal(JSON.parse(serializeSpecsPreparation(prepared)).text, prepared.text);
  for (const text of ['synthetic\0private', 'synthetic\ud800private']) {
    assert.throws(() => serializeSpecsPreparation({ ...prepared, text }), DocumentPreparationError);
    assert.throws(() => serializeSpecsPreparation({ ...prepared, warnings: [text] }), DocumentPreparationError);
  }
});
test('genuine PDF and DOCX each follow their bound object path and retain native source/page evidence through the verified output', async () => {
  for (const [bytes, mime, method] of [
    [pdf(['Three waiters required.', 'Father in scene three.']), 'application/pdf', 'pdf_text'],
    [docx(['Waiter', 'مطلوب ثلاثة أشخاص']), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx_text'],
  ] as const) {
    const f = await fixture(false, bytes, mime);
    const result = await prepareSpecsFileStage(f.fileInput, scope, f.port, { publishableKey: key, fetch: f.fetch });
    assert.equal(result.extraction_method, method); assert.equal(result.paragraph_count, 2);
    const payload = JSON.parse(f.expected.toString('utf8'));
    assert.equal(payload.sourceSha256, sha(bytes)); assert.equal(payload.sourceAssetId, sourceId);
    if (mime === 'application/pdf') assert.deepEqual(payload.paragraphs.map((row: { page: number }) => row.page), [1, 2]);
    else assert.match(payload.text, /مطلوب ثلاثة أشخاص/u);
    assert.deepEqual(f.calls, ['original_get', 'reserve', 'post', 'output_get', 'complete', 'store']);
  }
});
