import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { DomainError, type MediaAsset, type UploadCompletion } from '@eps/domain';
import { pdf } from '../../../tests/worker/document-fixtures.ts';
import { createBearerUserClient } from '../src/client.ts';
import { createCandidateSupportStorageAdapter, type SupportReservation, type SupportStorageRpcPort } from '../src/candidate-support-storage.ts';
import { signSupportReceipt, verifySupportReceipt } from '../src/support-receipt.ts';

// Installed SDK + injected fetch/RPC/verifier only. No cloud upload or production key.
const principal = '10000000-0000-4000-8000-000000000001'; const actor = { principal_id: principal };
const uploadId = '20000000-0000-4000-8000-000000000001'; const assetId = '30000000-0000-4000-8000-000000000001';
const workspaceId = '40000000-0000-4000-8000-000000000001'; const verificationId = '50000000-0000-4000-8000-000000000001';
const origin = 'https://synthetic-specs.example.invalid'; const bucket = 'eps-candidate-support'; const objectKey = `assets/${assetId}/original.pdf`;
const now = Date.parse('2026-10-28T12:00:00Z'); const key = new Uint8Array(32).fill(31);
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;
async function harness(options: { stream?: () => ReadableStream<Uint8Array>; signedPath?: string; timeout?: number; badVerifier?: boolean } = {}) {
  const bytes = Buffer.from(pdf(['Synthetic requirements.'])); const hash = createHash('sha256').update(bytes).digest('hex');
  const calls: { path: string; headers: Headers }[] = []; let verifies = 0; let signs = 0; let finalizes = 0; let blobCalls = 0; let allowed = true;
  let saved: UploadCompletion | null = null;
  const asset: MediaAsset = { id: assetId, purpose: 'candidate_support', filename: 'synthetic-specs.pdf', mime_type: 'application/pdf', size_bytes: bytes.length,
    sha256: null, status: 'uploading', duration_ms: null, width: null, height: null, source_asset_id: null, source_timestamp_ms: null, created_at: new Date(now).toISOString() };
  const reservation: SupportReservation = { upload_id: uploadId, asset, principal_id: principal, workspace_id: workspaceId,
    reservation_revision: 1, verification_id: verificationId, bucket, object_key: objectKey, candidate_id: verificationId,
    expected_size_bytes: bytes.length, expected_mime_type: 'application/pdf', expected_sha256: hash, expires_at: new Date(now + 3_600_000).toISOString(), status: 'open' };
  const scope = () => { if (!allowed) throw new DomainError('ACCESS_DENIED', 'Scope removed.', 403); };
  const rpc: SupportStorageRpcPort = {
    async reserveUpload() { scope(); return structuredClone(reservation); }, async getUpload() { scope(); return structuredClone(reservation); },
    async prepareCompletion() { scope(); return { reservation: structuredClone(reservation), replay: structuredClone(saved) }; },
    async finalizeCompletion(_actor, _id, input, proof) {
      scope(); finalizes++;
      const claims = verifySupportReceipt(proof, key, { key_id: 'synthetic-specs-key', verification_id: verificationId, upload_id: uploadId,
        asset_id: assetId, principal_id: principal, workspace_id: workspaceId,candidate_id: verificationId,width:null,height:null, reservation_revision: 1, bucket, object_key: objectKey,
        size_bytes: bytes.length, mime_type: 'application/pdf', verified_format: 'pdf', sha256: hash }, { now: now / 1000 });
      reservation.status = 'completed'; reservation.asset = { ...asset, status: 'ready', sha256: claims.sha256 };
      saved = { asset: structuredClone(reservation.asset), processing_job_id: input.start_processing ? '60000000-0000-4000-8000-000000000001' : null,
        status: input.start_processing ? 'queued' : 'ready' }; return structuredClone(saved);
    },
    async cancelUpload() { scope(); reservation.status = 'cancelled'; return { success: true, affected_ids: [uploadId, assetId] }; },
    async getMedia() { scope(); return { asset: structuredClone(reservation.asset), bucket, object_key: objectKey }; },
  };
  const client = createBearerUserClient({ url: origin, publishableKey: 'sb_publishable_synthetic-specs',
    accessToken: `synthetic.${Buffer.from(JSON.stringify({ sub: principal, role: 'authenticated' })).toString('base64url')}.signature` }, {
    fetch: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input)); calls.push({ path: url.pathname, headers: new Headers(init?.headers) });
      assert.equal(init?.redirect, 'error'); assert.equal(init?.cache, 'no-store');
      if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
      if (url.pathname.startsWith('/storage/v1/object/upload/sign/')) return Response.json({ url: options.signedPath ?? `/object/upload/sign/${bucket}/${objectKey}?token=synthetic-capability` });
      if (url.pathname === `/storage/v1/object/${bucket}/${objectKey}`) {
        const response = new Response(options.stream?.() ?? new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }));
        response.blob = async () => { blobCalls++; throw new Error('Blob must not be called.'); }; return response;
      }
      throw new Error('Unexpected controlled SDK request.');
    },
  });
  const adapterOptions = { client, storageOrigin: origin, rpc, now: () => now, downloadTimeoutMs: options.timeout,
    async verifyDocument(actual: Uint8Array, mime: string, context: { sourceAssetId: string }) { verifies++; assert.deepEqual(Buffer.from(actual), bytes); assert.equal(mime, 'application/pdf');
      assert.deepEqual(context, { sourceAssetId: assetId,purpose:'candidate_support' });
      return { mimeType: 'application/pdf' as const, format: options.badVerifier ? 'docx' as const : 'pdf' as const,width:null,height:null }; },
    signReceipt(facts: Parameters<NonNullable<Parameters<typeof createCandidateSupportStorageAdapter>[0]['signReceipt']>>[0]) {
      signs++; return signSupportReceipt({ ...facts, schema_version: 'candidate-support-verification.v1', audience: 'eps.candidate-support-verification',
        purpose: 'candidate_support', key_id: 'synthetic-specs-key', issued_at: now / 1000, expires_at: now / 1000 + 90 }, key, { now: now / 1000 });
    },
  };
  return { adapter: await createCandidateSupportStorageAdapter(adapterOptions), adapterOptions, reservation, rpc, bytes, hash, calls,
    revoke: () => { allowed = false; }, counts: () => ({ verifies, signs, finalizes, blobCalls }) };
}
test('user-JWT supporting-file TUS session verifies streamed bytes before candidate-bound proof; no processing job', async () => {
  const state = await harness();
  const upload = await state.adapter.createUploadSession(actor, { purpose: 'candidate_support', workspace_id: workspaceId,candidate_id: verificationId, filename: 'synthetic-specs.pdf',
    mime_type: 'application/pdf', size_bytes: state.bytes.length });
  assert.equal(upload.maximum_bytes, 20 * 1024 * 1024); assert.equal(upload.status, 'open');
  assert.equal(state.calls.find(call => call.path.includes('/upload/sign/'))!.headers.get('x-upsert'), 'false');
  const completed = await state.adapter.completeUpload(actor, uploadId, { actual_size_bytes: state.bytes.length, start_processing: false, sha256: state.hash });
  assert.equal(completed.status, 'ready'); assert.equal(completed.asset.status, 'ready'); assert.equal(completed.processing_job_id,null);
  assert.equal(completed.asset.sha256, state.hash); assert.equal(completed.asset.width, null);
  assert.deepEqual(state.counts(), { verifies: 1, signs: 1, finalizes: 1, blobCalls: 0 });
  assert.equal(state.calls.find(call => call.path === `/storage/v1/object/${bucket}/${objectKey}`)!.headers.get('x-upsert'), null);
  assert.doesNotMatch(JSON.stringify(completed), /synthetic-capability|payload|\bmac\b|key_id/);
});
test('completed replay rechecks current scope without another transfer or verification, even when new verification is disabled', async () => {
  const state = await harness(); const input = { actual_size_bytes: state.bytes.length, start_processing: false };
  const first = await state.adapter.completeUpload(actor, uploadId, input);
  const readonly = await createCandidateSupportStorageAdapter({ client: state.adapterOptions.client, storageOrigin: origin, rpc: state.rpc, now: () => now });
  assert.deepEqual(await readonly.completeUpload(actor, uploadId, input), first);
  assert.equal((await readonly.getUploadSession(actor, uploadId)).upload_url, null);
  assert.deepEqual(state.counts(), { verifies: 1, signs: 1, finalizes: 1, blobCalls: 0 });
  state.revoke(); await assert.rejects(readonly.completeUpload(actor, uploadId, input), code('ACCESS_DENIED'));
});
test('foreign destinations, mismatched formats, checksums and malformed private responses never finalize', async () => {
  const foreign = await harness({ signedPath: 'https://untrusted.example.invalid/object/upload/sign/anything?token=private-value' });
  await assert.rejects(foreign.adapter.getUploadSession(actor, uploadId), code('CENTRAL_RESPONSE_INVALID'));
  const mismatched = await harness({ badVerifier: true });
  await assert.rejects(mismatched.adapter.completeUpload(actor, uploadId, { actual_size_bytes: mismatched.bytes.length, start_processing: false }), code('VALIDATION_FAILED'));
  assert.equal(mismatched.counts().finalizes, 0);
  const state = await harness();
  await assert.rejects(state.adapter.completeUpload(actor, uploadId, { actual_size_bytes: state.bytes.length, start_processing: false, sha256: 'b'.repeat(64) }), code('VALIDATION_FAILED'));
  state.reservation.object_key = `assets/${assetId}/other.pdf`;
  await assert.rejects(state.adapter.getUploadSession(actor, uploadId), code('CENTRAL_RESPONSE_INVALID')); assert.equal(state.counts().finalizes, 0);
});
test('download streams enforce the hard20MiB and30second maximum with no Blob or receipt on failure', async () => {
  const oversized = await harness({ stream: () => new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(20 * 1024 * 1024 + 1)); controller.close(); } }) });
  await assert.rejects(oversized.adapter.completeUpload(actor, uploadId, { actual_size_bytes: oversized.bytes.length, start_processing: false }), code('SOURCE_UNREADABLE'));
  assert.equal(oversized.counts().signs, 0); assert.equal(oversized.counts().blobCalls, 0);
  const stalled = await harness({ timeout: 10, stream: () => new ReadableStream({ start() {} }) });
  await assert.rejects(stalled.adapter.completeUpload(actor, uploadId, { actual_size_bytes: stalled.bytes.length, start_processing: false }), code('STORAGE_TIMEOUT'));
  assert.equal(stalled.counts().signs, 0);
});
test('missing verification disables new uploads, while cancelled and expired sessions return no new capability', async () => {
  const state = await harness();
  const readonly = await createCandidateSupportStorageAdapter({ client: state.adapterOptions.client, storageOrigin: origin, rpc: state.rpc, now: () => now });
  assert.equal(readonly.uploadReady, false);
  await assert.rejects(readonly.createUploadSession(actor, { purpose: 'candidate_support', workspace_id: workspaceId,candidate_id: verificationId, filename: 'synthetic-specs.pdf',
    mime_type: 'application/pdf', size_bytes: state.bytes.length }), code('SUPPORT_STORAGE_CONFIGURATION_REQUIRED'));
  await assert.rejects(readonly.completeUpload(actor, uploadId, { actual_size_bytes: state.bytes.length, start_processing: false }), code('SUPPORT_STORAGE_CONFIGURATION_REQUIRED'));
  await state.adapter.cancelUpload(actor, uploadId);
  const signedBefore = state.calls.filter(call => call.path.includes('/upload/sign/')).length;
  const cancelled = await state.adapter.getUploadSession(actor, uploadId);
  assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.upload_url, null); assert.deepEqual(cancelled.upload_headers, {});
  state.reservation.status = 'open'; state.reservation.expires_at = new Date(now - 1).toISOString();
  const expired = await state.adapter.getUploadSession(actor, uploadId); assert.equal(expired.status, 'expired'); assert.equal(expired.upload_url, null);
  assert.equal(state.calls.filter(call => call.path.includes('/upload/sign/')).length, signedBefore);
});
test('Ready document reads remain integrity checked and public inputs cannot set authority or storage destinations', async () => {
  const state = await harness(); await state.adapter.completeUpload(actor, uploadId, { actual_size_bytes: state.bytes.length, start_processing: false });
  const content = await state.adapter.getMediaContent(actor, assetId); assert.deepEqual(content.bytes, state.bytes);
  assert.equal(content.mimeType, 'application/pdf'); assert.equal(state.counts().blobCalls, 0);
  await assert.rejects(state.adapter.getMediaContent({ principal_id: 'different-principal' }, assetId), code('ACCESS_DENIED'));
  await assert.rejects(state.adapter.createUploadSession(actor, { purpose: 'candidate_support', workspace_id: workspaceId,candidate_id: verificationId, filename: 'synthetic-specs.pdf',
    mime_type: 'application/pdf', size_bytes: state.bytes.length, bucket: 'foreign' } as never), code('VALIDATION_FAILED'));
  await assert.rejects(createCandidateSupportStorageAdapter({ ...state.adapterOptions, storageOrigin: 'not-a-url private-value' }), code('SUPPORT_STORAGE_CONFIGURATION_REQUIRED'));
  const corrupt = await harness({ stream: () => new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(state.bytes.length).fill(1)); controller.close(); } }) });
  corrupt.reservation.status = 'completed'; corrupt.reservation.asset = { ...corrupt.reservation.asset, status: 'ready', sha256: state.hash };
  await assert.rejects(corrupt.adapter.getMediaContent(actor, assetId), code('SOURCE_UNREADABLE'));
});

test('malformed status arrays/objects are rejected as strict private responses before capability or byte access',async()=>{
 for(const value of [['ready'],{toString:'ready'}]){
  const state=await harness();state.reservation.asset.status=value as never;const before=state.calls.length;
  await assert.rejects(state.adapter.getMedia(actor,assetId),code('CENTRAL_RESPONSE_INVALID'));assert.equal(state.calls.length,before);
 }
 for(const value of [['open'],{toString:'open'}]){
  const state=await harness();state.reservation.status=value as never;const before=state.calls.length;
  await assert.rejects(state.adapter.getUploadSession(actor,uploadId),code('CENTRAL_RESPONSE_INVALID'));assert.equal(state.calls.length,before);
 }
});
