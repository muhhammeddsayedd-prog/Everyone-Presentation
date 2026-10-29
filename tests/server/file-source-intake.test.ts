import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { ApiError } from '../../apps/web/components/api.ts';
import { captureFileSource, documentFileMetadata, runFileSource, specsTransferDestination, rebaseFileSource,
  type FileSourcePorts } from '../../apps/web/components/file-source-intake.ts';

const spec = { id: '84800000-0000-4000-8000-000000000001', workspace_id: '83800000-0000-4000-8000-000000000001', row_version: 7 };
const uploadId = '85800000-0000-4000-8000-000000000001'; const assetId = '86800000-0000-4000-8000-000000000001';
const storage = 'https://synthetic.supabase.co'; const file = () => new File(['\ufeffArabic عربي\r\nOriginal source'], 'synthetic-brief.txt', { type: 'text/plain' });
function ports(options: { lose?: 'put' | 'complete' | 'submit'; stale?: boolean } = {}) {
  const calls: { path: string; method: string; body: unknown; key: string | null }[] = []; let putCalls = 0; let lost = false; let stored = false;
  let sha = ''; let size = 0; let filename = ''; let accepted = false;
  const io: FileSourcePorts = {
    storageOrigin: storage,
    async json(path, init = {}) {
      const body = init.body ? JSON.parse(String(init.body)) : null;
      calls.push({ path, method: init.method ?? 'GET', body, key: new Headers(init.headers).get('idempotency-key') });
      const session = { id: uploadId, asset_id: assetId, protocol: 'signed_put', status: 'open', maximum_bytes: 20 * 1024 * 1024,
        expires_at: new Date(Date.now() + 3600_000).toISOString(), upload_headers: { 'Content-Type': 'text/plain', 'x-upsert': 'false' },
        upload_url: `${storage}/storage/v1/object/upload/sign/eps-specs-assets/assets/${assetId}/original.txt?token=synthetic-capability` };
      if (path === '/api/v1/uploads') { sha = body.sha256; size = body.size_bytes; filename = body.filename; return { data: session }; }
      if (path === `/api/v1/uploads/${uploadId}`) return { data: session };
      if (path.endsWith('/complete')) {
        if (!stored) throw new ApiError(409, 'UPLOAD_INCOMPLETE', 'Not yet stored.');
        if (options.lose === 'complete' && !lost) { lost = true; throw new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'private-detail'); }
        return { data: { status: 'ready', processing_job_id: null, asset: { id: assetId, purpose: 'specs', filename, mime_type: 'text/plain',
          size_bytes: size, sha256: sha, status: 'ready', width: null, height: null, duration_ms: null, source_asset_id: null,
          source_timestamp_ms: null, created_at: '2026-10-28T00:00:00Z' } } };
      }
      if (path.endsWith('/specs')) {
        if (options.stale && !accepted) { accepted = true; throw new ApiError(409, 'STALE_RESOURCE_VERSION', 'private-detail'); }
        accepted = true;
        if (options.lose === 'submit' && !lost) { lost = true; throw new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'private-detail'); }
        return { data: { job_id: '87800000-0000-4000-8000-000000000001', resource_id: spec.id, poll_url: '/api/v1/jobs/87800000-0000-4000-8000-000000000001', status: 'queued' } };
      }
      throw new Error('Unexpected controlled endpoint.');
    },
    async put(_url, init) {
      putCalls++; assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error'); assert.equal(init.referrerPolicy, 'no-referrer');
      assert.equal(new Headers(init.headers).get('authorization'), null); stored = true;
      if (options.lose === 'put' && !lost) { lost = true; throw new TypeError('private-transfer-error'); }
      return new Response(null, { status: 200 });
    },
  };
  return { io, calls, putCalls: () => putCalls };
}
test('file capture preserves original byte hash and Spec version with exact supported file bounds', async () => {
  const original = file(); const intent = await captureFileSource(spec, original, () => crypto.randomUUID());
  assert.equal(intent.sha256, createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex'));
  assert.equal(intent.specVersion, 7);
  for (const invalid of [{ name: 'brief.doc', type: 'application/msword', size: 4 }, { name: 'brief.pdf', type: 'application/pdf', size: 0 },
    { name: 'brief.docx', type: '', size: 20 * 1024 * 1024 + 1 }]) assert.throws(() => documentFileMetadata(invalid));
  assert.equal(documentFileMetadata({ name: 'brief.DOCX', type: '', size: 8 }).mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});
test('only exact configured HTTPS origin, asset path and immutable noncredential headers can receive file bytes', () => {
  const session = { asset_id: assetId, upload_url: `${storage}/storage/v1/object/upload/sign/eps-specs-assets/assets/${assetId}/original.txt?token=synthetic-capability`,
    upload_headers: { 'Content-Type': 'text/plain', 'x-upsert': 'false' } };
  assert.equal(specsTransferDestination(session, storage, 'text/plain').credentials, 'omit');
  for (const changed of [{ ...session, upload_url: session.upload_url.replace(storage, 'https://foreign.example.invalid') },
    { ...session, upload_url: session.upload_url + '&token=duplicate' }, { ...session, upload_url: session.upload_url.replace(assetId, uploadId) },
    { ...session, upload_headers: { ...session.upload_headers, Authorization: 'private-header' } }]) assert.throws(() => specsTransferDestination(changed, storage, 'text/plain'));
});
test('unknown PUT is checked by completion before retrying bytes, with no new reservation or manufactured source asset', async () => {
  const state = ports({ lose: 'put' }); const intent = await captureFileSource(spec, file(), () => crypto.randomUUID());
  await assert.rejects(runFileSource(intent, state.io));
  const accepted = await runFileSource(intent, state.io); assert.equal(accepted.resource_id, spec.id);
  assert.equal(state.putCalls(), 1); assert.equal(state.calls.filter(call => call.path === '/api/v1/uploads').length, 1);
  assert.deepEqual(state.calls.find(call => call.path.endsWith('/specs'))!.body, { source_asset_id: assetId, row_version: 7 });
  assert.equal((state.calls.find(call => call.path.endsWith('/complete'))!.body as { start_processing: boolean }).start_processing, false);
});
test('unknown completion and submission retries retain identical bodies and keys without another byte upload', async () => {
  for (const lose of ['complete', 'submit'] as const) {
    const state = ports({ lose }); const intent = await captureFileSource(spec, file(), () => crypto.randomUUID());
    await assert.rejects(runFileSource(intent, state.io)); await runFileSource(intent, state.io);
    const repeated = state.calls.filter(call => call.path.endsWith(lose === 'complete' ? '/complete' : '/specs'));
    assert.equal(repeated.length, 2); assert.deepEqual(repeated[0], repeated[1]); assert.equal(state.putCalls(), 1);
  }
});
test('known stale submission reuses the verified asset only after an explicit fresh Spec rebase and new submit key', async () => {
  const state = ports({ stale: true }); const intent = await captureFileSource(spec, file(), () => crypto.randomUUID());
  await assert.rejects(runFileSource(intent, state.io));
  rebaseFileSource(intent, { ...spec, row_version: 9 }, () => crypto.randomUUID()); await runFileSource(intent, state.io);
  const submissions = state.calls.filter(call => call.path.endsWith('/specs'));
  assert.deepEqual(submissions.map(call => call.body), [{ source_asset_id: assetId, row_version: 7 }, { source_asset_id: assetId, row_version: 9 }]);
  assert.notEqual(submissions[0].key, submissions[1].key); assert.equal(state.putCalls(), 1);
  assert.throws(() => rebaseFileSource(intent, { ...spec, row_version: 10 }, () => crypto.randomUUID()));
});
