import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { DomainError, type MediaAsset } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createCandidateStorageAdapter, type CandidateStorageRpcPort } from '../src/candidate-storage.ts';
const principal = '10000000-0000-4000-8000-000000000001'; const actor = { principal_id: principal };
const upload = '20000000-0000-4000-8000-000000000001'; const video = '30000000-0000-4000-8000-000000000001'; const workspace = '40000000-0000-4000-8000-000000000001';
const frame = '50000000-0000-4000-8000-000000000001'; const job = '60000000-0000-4000-8000-000000000001'; const attempt = '70000000-0000-4000-8000-000000000001';
const origin = 'https://synthetic-candidate.example.invalid'; const now = Date.parse('2026-10-29T09:00:00Z'); const originalKey = `assets/${video}/original.mp4`;
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]); const digest = createHash('sha256').update(jpeg).digest('hex'); const code = (value: string) => (error: unknown) => error instanceof DomainError && error.code === value;
async function harness(options: { foreignSign?: boolean; frameStream?: () => ReadableStream<Uint8Array>; mime?: string; timeout?: number; maximumBytes?: number; uploadsEnabled?: boolean;originalInfo?:{size:number;mime:string}|null } = {}) {
  const requests: { method: string; path: string; headers: Headers; body: unknown }[] = []; let allowed = true; let completes = 0;
  const original: MediaAsset = { id: video, purpose: 'candidate_video', filename: 'synthetic-intro.mp4', mime_type: 'video/mp4', size_bytes: 12345, sha256: null, status: 'uploading', duration_ms: null, width: null, height: null, source_asset_id: null, source_timestamp_ms: null, created_at: new Date(now).toISOString() };
  const frameAsset: MediaAsset = { id: frame, purpose: 'candidate_frame', filename: 'frame-0.jpg', mime_type: 'image/jpeg', size_bytes: jpeg.length, sha256: digest, status: 'ready', duration_ms: null, width: 160, height: 90, source_asset_id: video, source_timestamp_ms: 500, created_at: new Date(now).toISOString() };
  const reservation = { upload_id: upload, asset: original, principal_id: principal, workspace_id: workspace, bucket: 'eps-candidate-assets', object_key: originalKey, expected_size_bytes: original.size_bytes, expected_mime_type: original.mime_type, expected_sha256: 'a'.repeat(64), expires_at: new Date(now + 24 * 60 * 60 * 1000).toISOString(), status: 'open' };
  const authorize = () => { if (!allowed) throw new DomainError('ACCESS_DENIED', 'Current scope was removed.', 403); };
  const frameKey = `jobs/${job}/attempts/${attempt}/${frame}.jpg`;
  const rpc: CandidateStorageRpcPort = { reserveUpload: async () => { authorize(); return structuredClone(reservation); }, getUpload: async () => { authorize(); return structuredClone(reservation); },
    completeUpload: async () => { authorize(); completes++; reservation.status = 'completed'; return { asset: structuredClone(original), processing_job_id: job, status: 'queued' }; },
    cancelUpload: async () => { authorize(); reservation.status = 'cancelled'; return { success: true, affected_ids: [upload] }; },
    getMedia: async (_actor, id) => { authorize(); return id === frame ? { asset: frameAsset, bucket: 'eps-candidate-outputs', object_key: frameKey } : { asset: { ...original, status: 'ready', sha256: 'a'.repeat(64), duration_ms: 22000, width: 800, height: 480 }, bucket: 'eps-candidate-assets', object_key: originalKey }; } };
  const client = createBearerUserClient({ url: origin, publishableKey: 'sb_publishable_synthetic_key', accessToken: 'synthetic-user-token' }, { fetch: async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input)); requests.push({ method: init?.method ?? 'GET', path: url.pathname, headers: new Headers(init?.headers), body: init?.body }); assert.equal(init?.redirect, 'error');
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    if (url.pathname.startsWith('/storage/v1/object/upload/sign/')) return Response.json({ url: options.foreignSign ? 'https://untrusted.invalid/object?token=private-value' : `/object/upload/sign/eps-candidate-assets/${originalKey}?token=synthetic-upload-token` });
    if (url.pathname.startsWith('/storage/v1/object/sign/')) return Response.json({ signedURL: options.foreignSign ? 'https://untrusted.invalid/object?token=private-value' : `/object/sign/eps-candidate-assets/${originalKey}?token=synthetic-playback-token` });
    if(url.pathname===`/storage/v1/object/info/eps-candidate-assets/${originalKey}`)return options.originalInfo===null?Response.json({message:'Not found',statusCode:'404'},{status:404}):Response.json({id:video,name:originalKey,bucket_id:'eps-candidate-assets',version:'synthetic',size:options.originalInfo?.size??original.size_bytes,content_type:options.originalInfo?.mime??original.mime_type});
    if (url.pathname === `/storage/v1/object/info/eps-candidate-outputs/${frameKey}`) return Response.json({ id: frame, name: frameKey, bucket_id: 'eps-candidate-outputs', version: 'synthetic', size: jpeg.length, content_type: options.mime ?? 'image/jpeg' });
    if (url.pathname === `/storage/v1/object/eps-candidate-outputs/${frameKey}`) { const result = new Response(options.frameStream?.() ?? new ReadableStream({ start(controller) { controller.enqueue(jpeg); controller.close(); } })); result.blob = async () => { throw new Error('Blob must not be used'); }; return result; }
    throw new Error('Unexpected SDK route');
  } });
  const adapter = await createCandidateStorageAdapter({ client, storageOrigin: origin, rpc, now: () => now, downloadTimeoutMs: options.timeout, maximumBytes: options.maximumBytes, uploadsEnabled: options.uploadsEnabled });
  return { adapter, requests, reservation, frameAsset, rpc, original, completes: () => completes, revoke: () => { allowed = false; } };
}
test('SDK signed immutable upload advertises at most two hours; completion only queues native verification', async () => {
  const state = await harness(); const session = await state.adapter.createUploadSession(actor, { purpose: 'candidate_video', workspace_id: workspace, filename: state.original.filename, mime_type: 'video/mp4', size_bytes: state.original.size_bytes, sha256: 'a'.repeat(64) });
  assert.equal(session.status, 'open'); assert.equal(session.maximum_bytes, 268435456); assert.equal(Date.parse(session.expires_at), now + 7200000); assert.equal(state.requests.find(request => request.path.includes('/upload/sign/'))!.headers.get('x-upsert'), 'false');
  assert.equal(session.protocol,'tus');assert.equal(session.upload_url,`${origin}/storage/v1/upload/resumable/sign`);assert.deepEqual(session.upload_headers,{'x-signature':'synthetic-upload-token','x-upsert':'false'});assert.equal(session.chunk_size,6291456);assert.equal(session.upload_metadata?.objectName,originalKey);
  const signedBefore = state.requests.length; const completed = await state.adapter.completeUpload(actor, upload, { actual_size_bytes: state.original.size_bytes, sha256: 'a'.repeat(64), start_processing: true });
  assert.equal(completed.asset.status, 'uploading'); assert.equal(completed.asset.sha256, null); assert.equal(completed.status, 'queued'); assert.equal(completed.processing_job_id, job); assert.equal(state.requests.length, signedBefore+1);assert.match(state.requests.at(-1)!.path,/object\/info/u);
  assert.equal((await state.adapter.getUploadSession(actor, upload)).upload_url, null); assert.equal(state.completes(), 1);
});

test('effective environment limit rejects oversize before RPC or signing and leaves larger ready media readable', async () => {
  const maximum = 50 * 1024 * 1024; const state = await harness({ maximumBytes: maximum });
  let reserves = 0; const reserve = state.rpc.reserveUpload;
  state.rpc.reserveUpload = async (...args) => { reserves++; return reserve(...args); };
  const input = { purpose: 'candidate_video' as const, workspace_id: workspace, filename: state.original.filename, mime_type: 'video/mp4', size_bytes: maximum + 1 };
  const requests = state.requests.length;
  await assert.rejects(state.adapter.createUploadSession(actor, input), code('UPLOAD_TOO_LARGE'));
  assert.equal(reserves, 0); assert.equal(state.requests.length, requests);
  const session = await state.adapter.createUploadSession(actor, { ...input, size_bytes: state.original.size_bytes });
  assert.equal(session.maximum_bytes, maximum); assert.equal(reserves, 1);
  state.original.size_bytes = maximum + 1; state.reservation.expected_size_bytes = maximum + 1;
  const before = state.requests.length;
  await assert.rejects(state.adapter.getUploadSession(actor, upload), code('UPLOAD_TOO_LARGE'));
  assert.equal(state.requests.length, before);
  assert.equal((await state.adapter.getMedia(actor, video)).size_bytes, maximum + 1);
  assert.equal((await state.adapter.playMedia(actor, video)).asset_id, video);
});

test('read-only candidate storage retains verified Ready media but cannot mint or mutate an upload', async () => {
  const state = await harness({ uploadsEnabled: false });
  assert.equal(state.adapter.uploadReady, false);
  state.original.size_bytes = 50 * 1024 * 1024 + 1; state.reservation.expected_size_bytes = state.original.size_bytes;
  assert.equal((await state.adapter.getMedia(actor, video)).size_bytes, state.original.size_bytes);
  assert.equal((await state.adapter.playMedia(actor, video)).asset_id, video);
  assert.deepEqual(await state.adapter.getMediaContent(actor, frame), { bytes: jpeg, mimeType: 'image/jpeg' });
  const transfer = await state.adapter.getUploadSession(actor, upload);
  assert.equal(transfer.status, 'open'); assert.equal(transfer.upload_url, null); assert.deepEqual(transfer.upload_headers, {});
  assert.equal(state.requests.some(request => request.path.includes('/upload/sign/')), false);
  let mutations = 0;
  state.rpc.reserveUpload = state.rpc.completeUpload = state.rpc.cancelUpload = async () => { mutations++; throw new Error('Must not reach a mutation RPC'); };
  await assert.rejects(state.adapter.createUploadSession(actor, { purpose: 'candidate_video', workspace_id: workspace, filename: state.original.filename, mime_type: 'video/mp4', size_bytes: state.original.size_bytes }), code('CANDIDATE_STORAGE_CONFIGURATION_REQUIRED'));
  await assert.rejects(state.adapter.completeUpload(actor, upload, { actual_size_bytes: state.original.size_bytes, start_processing: true }), code('CANDIDATE_STORAGE_CONFIGURATION_REQUIRED'));
  await assert.rejects(state.adapter.cancelUpload(actor, upload), code('CANDIDATE_STORAGE_CONFIGURATION_REQUIRED'));
  assert.equal(mutations, 0);
  state.revoke(); const before = state.requests.length;
  await assert.rejects(state.adapter.playMedia(actor, video), code('ACCESS_DENIED')); assert.equal(state.requests.length, before);
});
test('signed playback uses current actor and exact source with a ninety-second lifetime', async () => {
  const state = await harness(); const value = await state.adapter.playMedia(actor, video); assert.equal(value.asset_id, video); assert.equal(value.mime_type, 'video/mp4'); assert.equal(value.source_version_id, null); assert.equal(Date.parse(value.expires_at), now + 90000);
  const signed = state.requests.find(request => request.path.startsWith('/storage/v1/object/sign/'))!; assert.equal(JSON.parse(signed.body as string).expiresIn, 90);
  state.revoke(); const previous = state.requests.length; await assert.rejects(state.adapter.playMedia(actor, video), code('ACCESS_DENIED')); assert.equal(state.requests.length, previous);
});
test('frame preview uses streamed SHA and actual Storage MIME/size; original never downloads in handler', async () => {
  const state = await harness(); assert.deepEqual(await state.adapter.getMediaContent(actor, frame), { bytes: jpeg, mimeType: 'image/jpeg' });
  const previous = state.requests.length; await assert.rejects(state.adapter.getMediaContent(actor, video), code('USE_PLAYBACK')); assert.equal(state.requests.length, previous);
  const badMime = await harness({ mime: 'text/html' }); await assert.rejects(badMime.adapter.getMediaContent(actor, frame), code('SOURCE_UNREADABLE'));
  assert.equal(badMime.requests.some(request => request.path === `/storage/v1/object/eps-candidate-outputs/jobs/${job}/attempts/${attempt}/${frame}.jpg`), false);
  const corrupt = await harness({ frameStream: () => new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(jpeg.length)); controller.close(); } }) }); await assert.rejects(corrupt.adapter.getMediaContent(actor, frame), code('SOURCE_UNREADABLE'));
});
test('invalid source/actor/destination and cancelled/expired uploads cannot mint capabilities', async () => {
  const state = await harness(); await assert.rejects(state.adapter.getMedia({ principal_id: workspace }, video), code('ACCESS_DENIED'));
  await assert.rejects(state.adapter.createUploadSession(actor, { purpose: 'candidate_video', workspace_id: workspace, filename: '../source.mp4', mime_type: 'video/mp4', size_bytes: 10 }), code('VALIDATION_FAILED'));
  await assert.rejects(state.adapter.completeUpload(actor, upload, { actual_size_bytes: state.original.size_bytes, start_processing: false }), code('VALIDATION_FAILED'));
  const foreign = await harness({ foreignSign: true }); await assert.rejects(foreign.adapter.getUploadSession(actor, upload), code('CENTRAL_RESPONSE_INVALID')); await assert.rejects(foreign.adapter.playMedia(actor, video), code('CENTRAL_RESPONSE_INVALID'));
  await state.adapter.cancelUpload(actor, upload); const previous = state.requests.length; assert.equal((await state.adapter.getUploadSession(actor, upload)).upload_url, null); assert.equal(state.requests.length, previous);
  state.reservation.status = 'open'; state.reservation.expires_at = new Date(now - 1).toISOString(); assert.equal((await state.adapter.getUploadSession(actor, upload)).status, 'expired'); assert.equal(state.requests.length, previous);
});
test('oversized and stalled frame bodies are bounded without Blob allocation', async () => {
  const huge = await harness({ frameStream: () => new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1)); controller.close(); } }) }); await assert.rejects(huge.adapter.getMediaContent(actor, frame), code('SOURCE_UNREADABLE'));
  const stalled = await harness({ timeout: 10, frameStream: () => new ReadableStream({ start() {} }) }); await assert.rejects(stalled.adapter.getMediaContent(actor, frame), code('STORAGE_TIMEOUT'));
});

test('unfinished or mismatched stored video is never queued after an uncertain final transfer response',async()=>{
 for(const options of [{originalInfo:null},{originalInfo:{size:1,mime:'video/mp4'}},{originalInfo:{size:12345,mime:'text/html'}}]){
  const state=await harness(options);await assert.rejects(state.adapter.completeUpload(actor,upload,{actual_size_bytes:12345,start_processing:true}),code(options.originalInfo===null?'UPLOAD_INCOMPLETE':'SOURCE_UNREADABLE'));assert.equal(state.completes(),0);assert.equal(state.requests.some(r=>r.path===`/storage/v1/object/eps-candidate-assets/${originalKey}`),false);
 }
});
