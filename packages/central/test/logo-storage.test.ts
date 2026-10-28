import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { DomainError, type MediaAsset, type UploadCompletion } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createLogoStorageAdapter, type LogoReservation, type LogoStorageRpcPort, type LogoVerificationFacts } from '../src/logo-storage.ts';
import { signLogoReceipt, verifyLogoReceipt, type LogoReceiptClaims } from '../src/logo-receipt.ts';

const principal = '10000000-0000-4000-8000-000000000001';
const uploadId = '20000000-0000-4000-8000-000000000001';
const assetId = '30000000-0000-4000-8000-000000000001';
const workspaceId = '40000000-0000-4000-8000-000000000001';
const verificationId = '50000000-0000-4000-8000-000000000001';
const actor = { principal_id: principal };
const storageOrigin = 'https://synthetic-logo-storage.example.invalid';
const bucket = 'eps-brand-assets';
const objectKey = `logos/${assetId}.png`;
const now = Date.parse('2026-10-28T12:00:00Z');
const key = Buffer.alloc(32, 19);
const token = `synthetic.${Buffer.from(JSON.stringify({ sub: principal, role: 'authenticated' })).toString('base64url')}.test-signature`;
type Call = { path: string; headers: Headers; signal: AbortSignal | null | undefined };
function code(expected: string, status: number) { return (error: unknown) => error instanceof DomainError && error.code === expected && error.status === status; }

async function harness(settings: { signedPath?: string; downloadStatus?: number; stream?: () => ReadableStream<Uint8Array>; timeout?: number } = {}) {
  const png = await sharp({ create: { width: 32, height: 16, channels: 4, background: { r: 10, g: 80, b: 30, alpha: .5 } } }).png().toBuffer();
  const digest = createHash('sha256').update(png).digest('hex');
  const calls: Call[] = [];
  let blobCalls = 0; let decodedCount = 0; let signedCount = 0; let preparedCount = 0; let finalizedCount = 0; let cancelledCount = 0; let scopeAllowed = true;
  let proofFacts: LogoVerificationFacts | undefined;
  let saved: UploadCompletion | null = null;
  const asset: MediaAsset = { id: assetId, purpose: 'client_logo', filename: 'synthetic-logo.png', mime_type: 'image/png', size_bytes: png.length, sha256: null, status: 'uploading', duration_ms: null, width: null, height: null, source_asset_id: null, source_timestamp_ms: null, created_at: '2026-10-28T12:00:00Z' };
  const reservation: LogoReservation = { upload_id: uploadId, asset, principal_id: principal, workspace_id: workspaceId, reservation_revision: 1, verification_id: verificationId, bucket, object_key: objectKey,
    expected_size_bytes: png.length, expected_mime_type: 'image/png', expected_sha256: digest, expires_at: '2026-10-28T14:00:00Z', status: 'open' };
  function scope() { if (!scopeAllowed) throw new DomainError('ACCESS_DENIED', 'Current project access was removed.', 403); }
  const rpc: LogoStorageRpcPort = {
    async reserveUpload() { scope(); return structuredClone(reservation); },
    async getUpload() { scope(); return structuredClone(reservation); },
    async prepareCompletion() { preparedCount++; scope(); return { reservation: structuredClone(reservation), replay: structuredClone(saved) }; },
    async finalizeCompletion(_actor, _upload, _input, proof) {
      scope(); finalizedCount++;
      const claims = verifyLogoReceipt(proof, key, { key_id: 'test-logo-key', verification_id: verificationId, upload_id: uploadId, asset_id: assetId, principal_id: principal, workspace_id: workspaceId, reservation_revision: 1, bucket, object_key: objectKey, size_bytes: png.length, mime_type: 'image/png', sha256: digest }, { now: now / 1000 });
      reservation.status = 'completed'; reservation.asset = { ...asset, sha256: claims.sha256, width: claims.width, height: claims.height, status: 'ready' };
      saved = { asset: structuredClone(reservation.asset), processing_job_id: null, status: 'ready' };
      return structuredClone(saved);
    },
    async cancelUpload() { scope(); cancelledCount++; reservation.status = 'cancelled'; return { success: true, affected_ids: [uploadId, assetId] }; },
    async getMedia() { scope(); return { asset: structuredClone(reservation.asset), bucket, object_key: objectKey }; },
  };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push({ path: url.pathname, headers: new Headers(init?.headers), signal: init?.signal });
    assert.equal(init?.cache, 'no-store'); assert.equal(init?.redirect, 'error');
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-10-28T00:00:00Z', is_anonymous: false });
    if (url.pathname.startsWith('/storage/v1/object/upload/sign/')) return Response.json({ url: settings.signedPath ?? `/object/upload/sign/${bucket}/${objectKey}?token=synthetic-signed-capability` });
    if (url.pathname === `/storage/v1/object/${bucket}/${objectKey}`) {
      if (settings.downloadStatus) return Response.json({ message: 'Private provider detail synthetic-signed-capability', statusCode: String(settings.downloadStatus), error: 'Storage failure' }, { status: settings.downloadStatus });
      const stream = settings.stream?.() ?? new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(png.subarray(0, 35)); controller.enqueue(png.subarray(35)); controller.close(); } });
      const response = new Response(stream, { headers: { 'Content-Type': 'image/png', 'Content-Length': '1' } });
      response.blob = async () => { blobCalls++; throw new Error('Unbounded Blob path must not run.'); };
      return response;
    }
    throw new Error('Unexpected synthetic SDK request.');
  };
  const client = createBearerUserClient({ url: storageOrigin, publishableKey: 'sb_publishable_synthetic-logo-test', accessToken: token }, { fetch: fetcher });
  const adapter = await createLogoStorageAdapter({ client, storageOrigin, brandBucket: bucket, rpc, now: () => now, downloadTimeoutMs: settings.timeout,
    async decodeLogo(bytes) { decodedCount++; const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'warning' }); const meta = await image.metadata(); await image.raw().toBuffer(); return { mimeType: `image/${meta.format}`, width: meta.width!, height: meta.height! }; },
    signReceipt(facts) { signedCount++; proofFacts = structuredClone(facts); const claims: LogoReceiptClaims = { ...facts, schema_version: '1.0', audience: 'eps.logo-verification.v1', purpose: 'client_logo', key_id: 'test-logo-key', issued_at: now / 1000, expires_at: now / 1000 + 90 }; return signLogoReceipt(claims, key, { now: now / 1000 }); },
  });
  return { adapter, client, rpc, png, digest, reservation, calls, revoke: () => { scopeAllowed = false; }, counters: () => ({ blobCalls, decodedCount, signedCount, preparedCount, finalizedCount, cancelledCount }), facts: () => proofFacts };
}

test('user-scoped SDK mint sets explicit false without mutating shared headers; streamed bytes produce a bound verified receipt', async () => {
  const state = await harness();
  const session = await state.adapter.createUploadSession(actor, { workspace_id: workspaceId, purpose: 'client_logo', filename: 'synthetic-logo.png', mime_type: 'image/png', size_bytes: state.png.length, sha256: state.digest }, { idempotencyKey: 'synthetic-reservation' });
  assert.equal(session.status, 'open'); assert.match(session.upload_url!, /^https:\/\/synthetic-logo-storage\.example\.invalid\/storage\/v1\/object\/upload\/sign\//);
  assert.equal(state.calls.find(call => call.path.includes('/upload/sign/'))!.headers.get('x-upsert'), 'false');
  const complete = await state.adapter.completeUpload(actor, uploadId, { actual_size_bytes: state.png.length, start_processing: false, sha256: state.digest }, { idempotencyKey: 'synthetic-completion' });
  assert.equal(complete.asset.sha256, state.digest); assert.equal(complete.asset.width, 32); assert.equal(complete.asset.height, 16); assert.equal(complete.processing_job_id, null);
  assert.deepEqual(state.counters(), { blobCalls: 0, decodedCount: 1, signedCount: 1, preparedCount: 1, finalizedCount: 1, cancelledCount: 0 });
  assert.equal(state.facts()!.principal_id, principal); assert.equal(state.facts()!.object_key, objectKey); assert.equal(state.facts()!.size_bytes, state.png.length);
  const download = state.calls.find(call => call.path === `/storage/v1/object/${bucket}/${objectKey}`)!;
  assert.equal(download.headers.get('x-upsert'), null);
  assert.equal(download.headers.get('Authorization'), `Bearer ${token}`);
  assert.ok(download.signal);
  assert.doesNotMatch(JSON.stringify(complete), /synthetic-signed-capability|test-logo-key|payload|\bmac\b/);
});

test('completed replay rechecks scope before returning cached results and does not download, decode or sign again', async () => {
  const state = await harness();
  const input = { actual_size_bytes: state.png.length, start_processing: false, sha256: state.digest };
  const first = await state.adapter.completeUpload(actor, uploadId, input, { idempotencyKey: 'same-logical-completion' });
  assert.deepEqual(await state.adapter.completeUpload(actor, uploadId, input, { idempotencyKey: 'same-logical-completion' }), first);
  assert.equal(state.counters().preparedCount, 2); assert.equal(state.counters().decodedCount, 1); assert.equal(state.counters().signedCount, 1);
  state.revoke();
  await assert.rejects(state.adapter.completeUpload(actor, uploadId, input, { idempotencyKey: 'same-logical-completion' }), code('ACCESS_DENIED', 403));
  assert.equal(state.counters().preparedCount, 3); assert.equal(state.counters().finalizedCount, 1);
});

test('closed or expired upload sessions return no upload capability or transfer headers', async () => {
  const state = await harness();
  for (const status of ['completed', 'cancelled', 'expired'] as const) {
    state.reservation.status = status;
    const session = await state.adapter.getUploadSession(actor, uploadId);
    assert.equal(session.upload_url, null); assert.deepEqual(session.upload_headers, {}); assert.equal(session.status, status);
  }
  state.reservation.status = 'open'; state.reservation.expires_at = '2026-10-27T12:00:00Z';
  assert.equal((await state.adapter.getUploadSession(actor, uploadId)).status, 'expired');
  assert.equal(state.calls.length, 1);
});

test('wrong actor, bucket/key mismatch and unexpected signed destination never reach a writable transfer', async () => {
  const state = await harness();
  await assert.rejects(state.adapter.getUploadSession({ principal_id: workspaceId }, uploadId), code('ACCESS_DENIED', 403));
  state.reservation.bucket = 'other-private-bucket';
  await assert.rejects(state.adapter.getUploadSession(actor, uploadId), code('CENTRAL_RESPONSE_INVALID', 503));
  assert.equal(state.calls.length, 1);
  const wrong = await harness({ signedPath: '/object/upload/sign/eps-brand-assets/other.png?token=synthetic-signed-capability' });
  await assert.rejects(wrong.adapter.getUploadSession(actor, uploadId), error => code('CENTRAL_RESPONSE_INVALID', 503)(error) && !String(error).includes('synthetic-signed-capability'));
});

test('invalid configuration and unexpected input or private columns fail without exposing provider capabilities', async () => {
  const state = await harness();
  await assert.rejects(createLogoStorageAdapter({ client: state.client, storageOrigin: 'not a URL synthetic-signed-capability', brandBucket: bucket, rpc: state.rpc,
    async decodeLogo() { throw new Error('Must not decode.'); }, signReceipt() { throw new Error('Must not sign.'); },
  }), error => code('LOGO_STORAGE_CONFIGURATION_REQUIRED', 503)(error) && !String(error).includes('synthetic-signed-capability'));
  const input = { workspace_id: workspaceId, purpose: 'client_logo' as const, filename: 'synthetic-logo.png', mime_type: 'image/png', size_bytes: state.png.length };
  await assert.rejects(state.adapter.createUploadSession(actor, { ...input, principal_id: workspaceId } as typeof input), code('VALIDATION_FAILED', 422));
  await assert.rejects(state.adapter.createUploadSession(actor, { ...input, filename: '../synthetic-logo.png' }), code('VALIDATION_FAILED', 422));
  Object.assign(state.reservation, { private_provider_token: 'synthetic-signed-capability' });
  await assert.rejects(state.adapter.getUploadSession(actor, uploadId), error => code('CENTRAL_RESPONSE_INVALID', 503)(error) && !String(error).includes('synthetic-signed-capability'));
  assert.equal(state.calls.length, 1);
});

test('stream overflow and stalled storage are bounded before decode or Ready publication', async () => {
  let cancelled = false;
  const overflow = await harness({ stream: () => new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(5 * 1024 * 1024)); controller.enqueue(new Uint8Array(1)); }, cancel() { cancelled = true; } }) });
  await assert.rejects(overflow.adapter.completeUpload(actor, uploadId, { actual_size_bytes: overflow.png.length, start_processing: false }), code('SOURCE_UNREADABLE', 422));
  assert.equal(cancelled, true); assert.equal(overflow.counters().decodedCount, 0); assert.equal(overflow.counters().finalizedCount, 0);
  const stalled = await harness({ timeout: 10, stream: () => new ReadableStream({ pull() { return new Promise(() => undefined); } }) });
  await assert.rejects(stalled.adapter.completeUpload(actor, uploadId, { actual_size_bytes: stalled.png.length, start_processing: false }), code('STORAGE_TIMEOUT', 503));
  assert.equal(stalled.counters().finalizedCount, 0);
});

test('missing bytes, mismatched checksum and undecodable content never receive a receipt', async () => {
  const missing = await harness({ downloadStatus: 404 });
  await assert.rejects(missing.adapter.completeUpload(actor, uploadId, { actual_size_bytes: missing.png.length, start_processing: false }), error => code('UPLOAD_INCOMPLETE', 409)(error) && !String(error).includes('synthetic-signed-capability'));
  const mismatch = await harness();
  await assert.rejects(mismatch.adapter.completeUpload(actor, uploadId, { actual_size_bytes: mismatch.png.length, start_processing: false, sha256: '0'.repeat(64) }), code('VALIDATION_FAILED', 422));
  assert.equal(mismatch.counters().signedCount, 0);
  const corrupt = await harness({ stream: () => new ReadableStream({ start(controller) { controller.enqueue(Buffer.from('not a raster image')); controller.close(); } }) });
  corrupt.reservation.expected_size_bytes = 'not a raster image'.length; corrupt.reservation.asset.size_bytes = 'not a raster image'.length; corrupt.reservation.expected_sha256 = null;
  await assert.rejects(corrupt.adapter.completeUpload(actor, uploadId, { actual_size_bytes: 'not a raster image'.length, start_processing: false }), code('SOURCE_UNREADABLE', 422));
  assert.equal(corrupt.counters().signedCount, 0); assert.equal(corrupt.counters().finalizedCount, 0);
});

test('media reads recheck scope and exact immutable bytes; cancellation does not delete Storage objects', async () => {
  const state = await harness();
  await state.adapter.completeUpload(actor, uploadId, { actual_size_bytes: state.png.length, start_processing: false });
  const media = await state.adapter.getMedia(actor, assetId);
  const content = await state.adapter.getMediaContent(actor, assetId);
  assert.equal(media.id, assetId); assert.deepEqual(content.bytes, state.png); assert.equal(content.mimeType, 'image/png');
  state.revoke();
  await assert.rejects(state.adapter.getMediaContent(actor, assetId), code('ACCESS_DENIED', 403));
  const other = await harness();
  assert.equal((await other.adapter.cancelUpload(actor, uploadId, { idempotencyKey: 'synthetic-cancel' })).success, true);
  assert.equal(other.counters().cancelledCount, 1); assert.equal(other.calls.length, 1);
});
