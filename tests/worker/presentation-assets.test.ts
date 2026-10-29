import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createPresentationRuntimeAssets } from '../../packages/central/src/presentation-runtime-assets.ts';
import { createPresentationStageAssets, parsePresentationAssetAccess, PresentationAssetError } from '../../apps/worker/src/presentation-assets.ts';
import { nativePresentation } from './presentation-native-fixture.ts';
const origin = 'https://pyibofyctwnqpvktepse.supabase.co'; const key = 'sb_publishable_synthetic_offline_fixture';
const scope = { job_id: 'a5050000-0000-4000-8000-000000000901', attempt_id: 'a5050000-0000-4000-8000-000000000902', lease_token: 'a'.repeat(64) };
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function harness(loseCompleteAcknowledgement = false) {
  const assetId = 'a5050000-0000-4000-8000-000000000903'; const stored = new Map<string, Uint8Array>(); let saved: Record<string, unknown> | undefined; let calls = 0;
  const call = async (operation: string, input: Record<string, unknown>) => {
    calls++;
    if (operation === 'reserve') { saved ??= { id: assetId, purpose: input.asset_kind, filename: input.filename, mime_type: input.mime_type, size_bytes: input.expected_size_bytes, sha256: null, status: 'uploading', duration_ms: null, width: null, height: null, source_asset_id: null, source_timestamp_ms: null, created_at: new Date().toISOString() }; return { asset: { ...saved }, bucket: 'eps-presentation-outputs', object_key: `jobs/${scope.job_id}/attempts/${scope.attempt_id}/${assetId}.pdf` }; }
    if (operation === 'access') return { asset_id: assetId, bucket: 'eps-presentation-outputs', object_key: `jobs/${scope.job_id}/attempts/${scope.attempt_id}/${assetId}.pdf`, permission: input.access, grant_token: 's'.repeat(43), expires_at: new Date(Date.now() + 60000).toISOString(), mime_type: saved!.mime_type, size_bytes: saved!.size_bytes, sha256: saved!.sha256 };
    if (operation === 'complete') { saved!.status = 'ready'; saved!.sha256 = input.sha256; if (loseCompleteAcknowledgement) { loseCompleteAcknowledgement = false; throw Error('synthetic acknowledgement loss'); } return { ...saved }; } throw Error('unexpected');
  };
  const port = createPresentationRuntimeAssets({ storageOrigin: origin, publishableKey: key }, call);
  const requests: RequestInit[] = [];
  const transport: typeof fetch = async (url, init) => { requests.push(init!); assert.equal(init!.redirect, 'error'); const path = String(url).replace('/authenticated/', '/'); if (init!.method === 'POST') { assert.equal((init!.headers as Record<string, string>)['x-upsert'], 'false'); stored.set(path, new Uint8Array(Buffer.from(init!.body as Buffer))); return new Response('{}', { status: 201 }); } const bytes = stored.get(path)!; return new Response(Buffer.from(bytes), { status: 200, headers: { 'content-type': 'application/pdf', 'content-length': String(bytes.length) } }); };
  return { assets: createPresentationStageAssets(port, { publishableKey: key, fetch: transport }), requests, calls: () => calls };
}
test('two narrow adapters reserve/upload/download exact bytes/finalize and reuse ready outputs without overwrite', async () => {
  const h = harness(); const bytes = Buffer.from('%PDF-synthetic-offline-transfer'); const input = { purpose: 'presentation_pdf' as const, bytes, sha256: sha(bytes) }; const signal = new AbortController().signal;
  const first = await h.assets.write(scope, input, signal); const second = await h.assets.write(scope, input, signal); assert.deepEqual(second, first); assert.equal(h.requests.filter(request => request.method === 'POST').length, 1); assert.ok(h.calls() >= 6);
});
test('access capabilities cannot change origin/bucket/frozen path/headers/hash/expiry or add redirects', () => {
  const { snapshot } = nativePresentation([1]); const frame = snapshot.asset_inventory.find(asset => asset.asset_kind === 'candidate_frame')!;
  const expected = { asset_id: frame.asset_id, sha256: frame.sha256, size_bytes: frame.byte_size, mime_type: frame.mime_type, bucket: frame.bucket, object_key: frame.object_key };
  const value = { asset_id: expected.asset_id, url: `${origin}/storage/v1/object/authenticated/${frame.bucket}/${frame.object_key}`, method: 'GET', headers: { apikey: key, authorization: `Bearer ${key}`, 'x-eps-asset-grant': 's'.repeat(43) }, expires_at: new Date(Date.now() + 60000).toISOString(), mime_type: expected.mime_type, size_bytes: expected.size_bytes, sha256: expected.sha256 };
  assert.equal(parsePresentationAssetAccess(value, expected, { scope, method: 'GET' }, { publishableKey: key }).url, value.url);
  for (const patch of [{ url: value.url.replace(origin, 'https://untrusted.invalid') }, { url: value.url + '?token=private' }, { sha256: 'b'.repeat(64) }, { expires_at: new Date(0).toISOString() }, { headers: { ...value.headers, Cookie: 'private' } }, { headers: { ...value.headers, authorization: 'Bearer other' } }]) assert.throws(() => parsePresentationAssetAccess({ ...value, ...patch }, expected, { scope, method: 'GET' }, { publishableKey: key }), PresentationAssetError);
});
test('mismatched checksum and aborted transfers cannot finalize an output', async () => {
  const h = harness(); const bytes = Buffer.from('synthetic'); const signal = new AbortController().signal;
  await assert.rejects(h.assets.write(scope, { purpose: 'presentation_pdf', bytes, sha256: 'b'.repeat(64) }, signal), PresentationAssetError); assert.equal(h.calls(), 0);
  const controller = new AbortController(); controller.abort(); await assert.rejects(h.assets.write(scope, { purpose: 'presentation_pdf', bytes, sha256: sha(bytes) }, controller.signal), PresentationAssetError); assert.equal(h.calls(), 0);
});
test('a lost completion acknowledgement reuses verified ready bytes and never uploads over an output', async () => {
  const h = harness(true); const bytes = Buffer.from('%PDF-synthetic-offline-transfer'); const input = { purpose: 'presentation_pdf' as const, bytes, sha256: sha(bytes) }; const signal = new AbortController().signal;
  await assert.rejects(h.assets.write(scope, input, signal), (error: unknown) => error instanceof PresentationAssetError && error.code === 'PDF_ASSET_TRANSFER_FAILED');
  const recovered = await h.assets.write(scope, input, signal); assert.equal(recovered.sha256, input.sha256); assert.equal(h.requests.filter(request => request.method === 'POST').length, 1);
  const changed = Buffer.from(bytes); changed[changed.length - 1] ^= 1;
  await assert.rejects(h.assets.write(scope, { ...input, bytes: changed, sha256: sha(changed) }, signal), PresentationAssetError); assert.equal(h.requests.filter(request => request.method === 'POST').length, 1);
});
