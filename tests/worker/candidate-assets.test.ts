import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createCandidateStageAssets, parseCandidateAssetAccess, type CandidateFilesPort } from '../../apps/worker/src/candidate-assets.ts';
const job = '10000000-0000-4000-8000-000000000001'; const attempt = '20000000-0000-4000-8000-000000000001';
const original = '30000000-0000-4000-8000-000000000001'; const output = '40000000-0000-4000-8000-000000000001';
const scope = { job_id: job, attempt_id: attempt, lease_token: 'synthetic-lease-token' };
const key = 'sb_publishable_synthetic_public_key'; const now = 1000; const configuration = { publishableKey: key, now: () => now };
const bytes = new Uint8Array([0xff, 0xd8, 1, 2]); const digest = createHash('sha256').update(bytes).digest('hex');
const input = { asset_id: original, sha256: digest, size_bytes: bytes.length, mime_type: 'video/mp4' };
function access(id = original, method: 'GET' | 'POST' = 'GET', mime = 'video/mp4', checksum: string | null = digest) {
  const originalSource = mime.startsWith('video/'); const extension = originalSource ? 'mp4' : mime === 'image/jpeg' ? 'jpg' : 'json';
  return { asset_id: id, url: `https://pyibofyctwnqpvktepse.supabase.co/storage/v1/object/${method === 'GET' ? 'authenticated/' : ''}${originalSource ? `eps-candidate-assets/assets/${id}/original.${extension}` : `eps-candidate-outputs/jobs/${job}/attempts/${attempt}/${id}.${extension}`}`,
    method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'x-eps-asset-grant': 'synthetic-private-grant', ...(method === 'POST' ? { 'Content-Type': mime, 'x-upsert': 'false' } : {}) }, expires_at: new Date(now + 60_000).toISOString(), mime_type: mime, size_bytes: bytes.length, sha256: checksum };
}
test('candidate capability parser rejects foreign hosts, wrong paths, expired grants and ambient credentials', () => {
  assert.equal(parseCandidateAssetAccess(access(), input, { scope, method: 'GET' }, configuration).asset_id, original);
  const mutations: ((value: ReturnType<typeof access>) => void)[] = [value => { value.url = value.url.replace('https://pyibofyctwnqpvktepse.supabase.co', 'https://example.test'); }, value => { value.url = value.url.replace(original, output); }, value => { value.expires_at = new Date(now).toISOString(); }, value => { value.headers.Authorization = 'Bearer unrelated-token'; }, value => { Object.assign(value.headers, { cookie: 'secret' }); }];
  for (const mutate of mutations) { const value = access(); mutate(value); assert.throws(() => parseCandidateAssetAccess(value, input, { scope, method: 'GET' }, configuration), { code: 'VIDEO_ASSET_CAPABILITY_INVALID' }); }
});
test('prior-stage derivative reads allow only the same job and exact asset, while writes stay in the active attempt', () => {
  const reference = { asset_id: output, sha256: digest, size_bytes: bytes.length, mime_type: 'image/jpeg' };
  const prior = access(output, 'GET', 'image/jpeg'); prior.url = prior.url.replace(attempt, '50000000-0000-4000-8000-000000000001');
  assert.equal(parseCandidateAssetAccess(prior, reference, { scope, method: 'GET' }, configuration).url, prior.url);
  const foreign = { ...prior, url: prior.url.replace(job, '60000000-0000-4000-8000-000000000001') };
  assert.throws(() => parseCandidateAssetAccess(foreign, reference, { scope, method: 'GET' }, configuration), { code: 'VIDEO_ASSET_CAPABILITY_INVALID' });
  const write = access(output, 'POST', 'image/jpeg', null); write.url = write.url.replace(attempt, '50000000-0000-4000-8000-000000000001');
  assert.throws(() => parseCandidateAssetAccess(write, reference, { scope, method: 'POST' }, configuration), { code: 'VIDEO_ASSET_CAPABILITY_INVALID' });
});
test('original reads verify actual MIME, bounded size and SHA before native work', async () => {
  let count = 0; const port = { getAssetAccess: async () => access(), reserveOutput: async () => { throw new Error('unused'); }, completeOutput: async () => { throw new Error('unused'); } };
  const assets = createCandidateStageAssets(port, { ...configuration, fetch: async (_url, options) => { count++; assert.equal(options?.redirect, 'error'); return new Response(bytes, { headers: { 'content-type': 'video/mp4', 'content-length': String(bytes.length) } }); } });
  assert.deepEqual(await assets.read(scope, input, new AbortController().signal), Buffer.from(bytes)); assert.equal(count, 1);
  const bad = createCandidateStageAssets(port, { ...configuration, fetch: async () => new Response(new Uint8Array([9, 9, 9, 9]), { headers: { 'content-type': 'video/mp4' } }) });
  await assert.rejects(bad.read(scope, input, new AbortController().signal), { code: 'VIDEO_ASSET_CAPABILITY_INVALID' });
  const wrongMime = createCandidateStageAssets(port, { ...configuration, fetch: async () => new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } }) });
  await assert.rejects(wrongMime.read(scope, input, new AbortController().signal), { code: 'VIDEO_ASSET_TRANSFER_FAILED' });
});
test('prepared frame reads bind exact ID/hash and canonical bounded size before requesting bytes', async () => {
  let reads = 0; const frameAccess = access(output, 'GET', 'image/jpeg');
  const port = { getAssetAccess: async () => frameAccess, reserveOutput: async () => { throw new Error('unused'); }, completeOutput: async () => { throw new Error('unused'); } };
  const assets = createCandidateStageAssets(port, { ...configuration, fetch: async () => { reads++; return new Response(bytes, { headers: { 'content-type': 'image/jpeg' } }); } });
  assert.deepEqual(await assets.readFrame!(scope, { asset_id: output, sha256: digest }, new AbortController().signal), Buffer.from(bytes)); assert.equal(reads, 1);
  for (const patch of [{ size_bytes: 2 * 1024 * 1024 + 1 }, { sha256: null }, { mime_type: 'image/svg+xml' }, { asset_id: original }, { url: frameAccess.url.replace(job, original) }]) {
    Object.assign(frameAccess, access(output, 'GET', 'image/jpeg'), patch);
    await assert.rejects(assets.readFrame!(scope, { asset_id: output, sha256: digest }, new AbortController().signal), { code: 'VIDEO_ASSET_CAPABILITY_INVALID' });
  }
  assert.equal(reads, 1);
});
test('only initial video preparation may read an unverified capability with a known declaration, and actual bytes must match it', async () => {
  let reads = 0; let writes = 0;
  const port = { getAssetAccess: async () => access(original, 'GET', 'video/mp4', null), reserveOutput: async () => { writes++; throw new Error('Unexpected reservation'); }, completeOutput: async () => { writes++; throw new Error('Unexpected Ready transition'); } };
  const assets = createCandidateStageAssets(port, { ...configuration, fetch: async () => { reads++; return new Response(bytes, { headers: { 'content-type': 'video/mp4', 'content-length': String(bytes.length) } }); } });
  await assert.rejects(assets.read(scope, input, new AbortController().signal), { code: 'VIDEO_ASSET_CAPABILITY_INVALID' });
  assert.equal(reads, 0);
  assert.deepEqual(await assets.read(scope, input, new AbortController().signal, { preparingOriginal: true }), Buffer.from(bytes));
  assert.equal(reads, 1); assert.equal(writes, 0);
  const corrupt = createCandidateStageAssets(port, { ...configuration, fetch: async () => new Response(new Uint8Array([9, 9, 9, 9]), { headers: { 'content-type': 'video/mp4' } }) });
  await assert.rejects(corrupt.read(scope, input, new AbortController().signal, { preparingOriginal: true }), { code: 'VIDEO_ASSET_CAPABILITY_INVALID' });
  assert.equal(writes, 0);
  const derivative = { asset_id: output, sha256: digest, size_bytes: bytes.length, mime_type: 'image/jpeg' };
  assert.throws(() => parseCandidateAssetAccess(access(output, 'GET', 'image/jpeg', null), derivative, { scope, method: 'GET', preparingOriginal: true }, configuration), { code: 'VIDEO_ASSET_CAPABILITY_INVALID' });
});
function setupWrite(corrupt = false) {
  const requests: string[] = []; let completed = false;
  const write = { purpose: 'candidate_frame' as const, output_key: 'frame_0', source_asset_id: original, mime_type: 'image/jpeg', sha256: digest, bytes, timestamp_ms: 500, width: 16, height: 9, duration_ms: null };
  const asset = (ready: boolean) => ({ id: output, purpose: 'candidate_frame', filename: 'frame-0.jpg', mime_type: 'image/jpeg', size_bytes: bytes.length, sha256: ready ? digest : null, status: ready ? 'ready' : 'uploading', duration_ms: null, width: ready ? 16 : null, height: ready ? 9 : null, source_asset_id: original, source_timestamp_ms: 500, created_at: new Date(now).toISOString() });
  const port: CandidateFilesPort = { reserveOutput: async input => { assert.equal(input.output_key, 'frame_0'); assert.equal(input.time_offset_ms, 500); return { asset: asset(false), access: access(output, 'POST', 'image/jpeg', null) }; },
    getAssetAccess: async () => access(output, 'GET', 'image/jpeg', null), completeOutput: async input => { assert.equal(input.sha256, digest); assert.equal(input.width, 16); completed = true; return asset(true); } };
  const assets = createCandidateStageAssets(port, { ...configuration, fetch: async (_url, options) => { requests.push(options?.method ?? 'GET'); assert.equal(options?.redirect, 'error'); if (options?.method === 'POST') { assert.equal((options.headers as Record<string, string>)['x-upsert'], 'false'); return new Response('{}', { status: 200 }); }
    return new Response(corrupt ? new Uint8Array([9, 9, 9, 9]) : bytes, { headers: { 'content-type': 'image/jpeg', 'content-length': String(bytes.length) } }); } });
  return { assets, write, requests, completed: () => completed };
}
test('derivative write must read back matching private bytes before completion', async () => { const state = setupWrite(); const result = await state.assets.write(scope, state.write, new AbortController().signal); assert.equal(result.asset_id, output); assert.deepEqual(state.requests, ['POST', 'GET']); assert(state.completed()); });
test('corrupt readback never marks derivative Ready', async () => { const state = setupWrite(true); await assert.rejects(state.assets.write(scope, state.write, new AbortController().signal), { code: 'VIDEO_ASSET_CAPABILITY_INVALID' }); assert.equal(state.completed(), false); });
test('arbitrary output keys and frame timestamps are rejected before reservation', async () => { const state = setupWrite(); for (const patch of [{ output_key: '../file' }, { timestamp_ms: -1 }, { width: 9000 }, { mime_type: 'image/png' }]) await assert.rejects(state.assets.write(scope, { ...state.write, ...patch }, new AbortController().signal), { code: 'VIDEO_ASSET_CAPABILITY_INVALID' }); assert.equal(state.requests.length, 0); });
