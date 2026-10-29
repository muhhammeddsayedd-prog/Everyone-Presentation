import assert from 'node:assert/strict';
import test from 'node:test';
import { createSpecsRuntimeAssets, type SpecsAssetOperation } from '../src/specs-runtime-assets.ts';

const job = '7d9b0000-0000-4000-8000-000000000001';
const attempt = '7d9b0000-0000-4000-8000-000000000002';
const original = '7d9b0000-0000-4000-8000-000000000003';
const output = '7d9b0000-0000-4000-8000-000000000004';
const scope = { job_id: job, attempt_id: attempt, lease_token: 'a'.repeat(64) };
const config = { storageOrigin: 'https://pyibofyctwnqpvktepse.supabase.co', publishableKey: 'sb_publishable_synthetic_public_asset_key' };
const future = () => new Date(Date.now() + 55_000).toISOString();
const asset = (ready: boolean) => ({ id: output, purpose: 'document_text', filename: 'prepared-document.json', mime_type: 'application/json', size_bytes: 100,
  status: ready ? 'ready' : 'uploading', sha256: ready ? 'b'.repeat(64) : null, duration_ms: null, width: null, height: null,
  source_asset_id: original, source_timestamp_ms: null, created_at: '2026-10-29T00:00:00Z' });
function fixture(ready = false) {
  const calls: { operation: SpecsAssetOperation; input: Record<string, unknown> }[] = [];
  let badDestination = false;
  const port = createSpecsRuntimeAssets(config, async (operation, input) => {
    calls.push({ operation, input });
    if (operation === 'reserve') return { asset: asset(ready), bucket: 'eps-specs-outputs', object_key: `jobs/${job}/attempts/${attempt}/${output}.json` };
    if (operation === 'complete') return asset(true);
    if (operation === 'prepare') return { stored: true };
    return { asset_id: input.asset_id, bucket: input.asset_id === original ? 'eps-specs-assets' : 'eps-specs-outputs',
      object_key: badDestination ? '../escape' : input.asset_id === original ? `assets/${original}/original.pdf` : `jobs/${job}/attempts/${attempt}/${output}.json`,
      permission: input.access ?? 'read', grant_token: 'c'.repeat(43), expires_at: future(), mime_type: input.asset_id === original ? 'application/pdf' : 'application/json',
      size_bytes: 100, sha256: input.asset_id === original || ready ? 'b'.repeat(64) : null };
  });
  return { port, calls, setBadDestination() { badDestination = true; } };
}
const reservation = { ...scope, output_key: 'document_text' as const, asset_kind: 'document_text' as const, filename: 'prepared-document.json',
  mime_type: 'application/json' as const, expected_size_bytes: 100, parent_asset_id: original, time_offset_ms: null };

test('private grant maps only the fixed authenticated-object path and exact public-key headers', async () => {
  const f = fixture(); const result = await f.port.getAssetAccess({ ...scope, asset_id: original }, AbortSignal.timeout(1000));
  assert.deepEqual(result, { asset_id: original, method: 'GET', url: `${config.storageOrigin}/storage/v1/object/authenticated/eps-specs-assets/assets/${original}/original.pdf`,
    headers: { apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'x-eps-asset-grant': 'c'.repeat(43) },
    expires_at: (result as { expires_at: string }).expires_at, mime_type: 'application/pdf', size_bytes: 100, sha256: 'b'.repeat(64) });
  assert.equal(f.calls[0].operation, 'access');
  f.setBadDestination(); await assert.rejects(f.port.getAssetAccess({ ...scope, asset_id: original }, AbortSignal.timeout(1000)), { code: 'RUNTIME_RESPONSE_INVALID' });
});
test('immutable reservation chooses POST for uploading and GET for Ready replay without reminting write authority', async () => {
  for (const ready of [false, true]) {
    const f = fixture(ready); const value = await f.port.reserveOutput(reservation, AbortSignal.timeout(1000)) as { asset: unknown; access: { method: string; headers: Record<string, string> } };
    assert.equal(value.access.method, ready ? 'GET' : 'POST'); assert.deepEqual(value.asset, asset(ready));
    assert.equal(f.calls[1].input.access, ready ? 'read' : 'write');
    assert.equal(value.access.headers['x-upsert'], ready ? undefined : 'false');
    assert.equal(f.calls.filter(call => call.operation === 'reserve').length, 1);
  }
});
test('scope, key, destination and private Unicode validation fail before an operation or expose no raw source', async () => {
  for (const change of [{ storageOrigin: 'https://untrusted.example.invalid' }, { publishableKey: 'service_role_private' }, { extra: true }]) {
    assert.throws(() => createSpecsRuntimeAssets({ ...config, ...change } as never, async () => null), { code: 'RUNTIME_CONFIG_INVALID' });
  }
  const f = fixture();
  await assert.rejects(f.port.getAssetAccess({ ...scope, lease_token: 'bad', asset_id: original }, AbortSignal.timeout(1000)), { code: 'INVALID_REQUEST' });
  await assert.rejects(f.port.storePreparation({ ...scope, asset_id: output, payload_utf8: 'synthetic-private\u0000source' }, AbortSignal.timeout(1000)), error => {
    assert.equal((error as { code: string }).code, 'INVALID_REQUEST'); assert.ok(!String(error).includes('synthetic-private')); return true;
  });
  assert.equal(f.calls.length, 0);
});
