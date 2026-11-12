import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { DomainError } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralCandidatePhotos } from '../src/candidate-photos.ts';

const principal = '10000000-0000-4000-8000-000000000001', candidate = '20000000-0000-4000-8000-000000000001';
const photoA = '30000000-0000-4000-8000-000000000001', photoB = '30000000-0000-4000-8000-000000000002';
const large = '40000000-0000-4000-8000-000000000001', thumb = '40000000-0000-4000-8000-000000000002';
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const cover = { id: photoB, position: 2, cover: true, width: 400, height: 500, asset_id: large, thumb_asset_id: thumb };
const other = { id: photoA, position: 1, cover: false, width: 400, height: 500, asset_id: '40000000-0000-4000-8000-000000000003', thumb_asset_id: '40000000-0000-4000-8000-000000000004' };
const located = (bytes = jpeg) => ({ asset: { id: thumb, purpose: 'candidate_photo', mime_type: 'image/jpeg', size_bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), width: 120, height: 150, status: 'ready' }, bucket: 'eps-candidate-photos', object_key: `archive/${thumb}.jpg` });

async function harness(options: { rpc?: unknown; object?: Buffer; storageStatus?: number } = {}) {
  const calls: { path: string; body: unknown }[] = [];
  const client = createBearerUserClient({ url: 'https://synthetic-photos.example.invalid', publishableKey: 'sb_publishable_synthetic', accessToken: 'synthetic-acting-token' }, { fetch: async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    calls.push({ path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.pathname.startsWith('/storage/v1/object/')) return options.storageStatus ? Response.json({ error: 'not found' }, { status: options.storageStatus }) : new Response(new Uint8Array(options.object ?? jpeg), { headers: { 'Content-Type': 'image/jpeg' } });
    return Response.json(options.rpc ?? { data: [cover, other] });
  } });
  return { api: await createCentralCandidatePhotos(client), calls };
}
const code = (value: string) => (error: unknown) => error instanceof DomainError && error.code === value;
const acting = { principal_id: principal } as never;

test('photos list exactly as returned, cover first, through the caller\'s own session', async () => {
  const h = await harness();
  assert.deepEqual(await h.api.listCandidatePhotos(acting, candidate), { data: [cover, other], page: { next_cursor: null } });
  assert.deepEqual(h.calls, [{ path: '/rest/v1/rpc/eps_list_candidate_photos', body: { p_candidate_id: candidate } }]);
  assert.deepEqual((await (await harness({ rpc: { data: [] } })).api.listCandidatePhotos(acting, candidate)).data, []);
});

test('photo rows that do not match the contract are refused, never shown', async () => {
  for (const rpc of [{ data: [{ ...cover, extra: 1 }] }, { data: [{ ...cover, asset_id: 'x' }] }, { data: [cover, { ...other, cover: true }] }, { data: [cover, cover] },
    { data: [{ ...cover, thumb_asset_id: large }] }, { data: Array.from({ length: 51 }, () => cover) }, [cover]]) {
    await assert.rejects((await harness({ rpc })).api.listCandidatePhotos(acting, candidate), code('CENTRAL_RESPONSE_INVALID'));
  }
  await assert.rejects((await harness()).api.listCandidatePhotos(acting, 'not-a-uuid'), code('INVALID_REQUEST'));
  await assert.rejects((await harness()).api.listCandidatePhotos({ principal_id: candidate } as never, candidate), code('ACCESS_DENIED'));
});

test('photo bytes are read from the photo bucket and must match their verified size, type and hash', async () => {
  const h = await harness({ rpc: located() });
  const read = await h.api.getCandidatePhotoContent(acting, thumb);
  assert.equal(read.mimeType, 'image/jpeg'); assert.deepEqual(read.bytes, jpeg);
  assert.equal(h.calls[1].path, `/storage/v1/object/eps-candidate-photos/archive/${thumb}.jpg`);
  const tampered = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9, 9]);
  await assert.rejects((await harness({ rpc: located(), object: tampered })).api.getCandidatePhotoContent(acting, thumb), code('SOURCE_UNREADABLE'));
  await assert.rejects((await harness({ rpc: located(), object: Buffer.from('not a jpeg') })).api.getCandidatePhotoContent(acting, thumb), code('SOURCE_UNREADABLE'));
  await assert.rejects((await harness({ rpc: { ...located(), bucket: 'eps-candidate-support' } })).api.getCandidatePhotoContent(acting, thumb), code('CENTRAL_RESPONSE_INVALID'));
  await assert.rejects((await harness({ rpc: { ...located(), asset: { ...located().asset, purpose: 'candidate_support' } } })).api.getCandidatePhotoContent(acting, thumb), code('CENTRAL_RESPONSE_INVALID'));
  await assert.rejects((await harness({ rpc: located(), storageStatus: 404 })).api.getCandidatePhotoContent(acting, thumb), code('DEPENDENCY_UNAVAILABLE'));
});
