import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError, type MediaAsset } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralStudio, type CentralStudioOptions } from '../src/studio.ts';

const principal = '10000000-0000-4000-8000-000000000001';
const assetId = '20000000-0000-4000-8000-000000000001';
const actor = { principal_id: principal };
const origin = 'https://synthetic-media.example.invalid';
const token = 'synthetic-acting-user';
const asset: MediaAsset = { id: assetId, purpose: 'presentation_pdf', filename: 'Selection.pdf', mime_type: 'application/pdf',
  size_bytes: 810902, sha256: 'a'.repeat(64), status: 'ready', duration_ms: null, width: null, height: null,
  source_asset_id: null, source_timestamp_ms: null, created_at: '2026-11-03T13:00:00Z' };
const envelope = (value: unknown) => ({ asset: value, bucket: 'private-synthetic-artifacts', object_key: 'private-synthetic-locator' });
const failure = (code: string) => Response.json({ code: 'P0001', message: code, details: 'private-diagnostic' }, { status: 400 });
const isCode = (code: string, status: number) => (error: unknown) => error instanceof DomainError && error.code === code && error.status === status;

async function service(reply: (name: string) => Response, options: CentralStudioOptions = {}) {
  const calls: string[] = [];
  const client = createBearerUserClient({ url: origin, publishableKey: 'sb_publishable_synthetic_key', accessToken: token }, { fetch: async (input, init) => {
    const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${token}`);
    if (path === '/auth/v1/user') return Response.json({ id: principal, aud: 'authenticated', role: 'authenticated', is_anonymous: false });
    assert.ok(path.startsWith('/rest/v1/rpc/'), 'Metadata must not sign, inspect or download Storage bytes.');
    const name = path.split('/').at(-1)!; calls.push(name);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    if (name !== 'eps_get_capabilities') assert.deepEqual(body, { p_asset_id: assetId });
    return reply(name);
  } });
  return { studio: await createCentralStudio(client, options), calls };
}

test('all advertised generated purposes return only public metadata without a Storage adapter or URL signing', async () => {
  for (const [purpose, mime] of [['presentation_pdf', 'application/pdf'], ['presentation_manifest', 'application/json'],
    ['presentation_preview', 'image/png'], ['preview_video', 'video/mp4'], ['document_text', 'text/plain'], ['document_page', 'image/png']] as const) {
    const expected = { ...asset, purpose, mime_type: mime, filename: 'Synthetic artifact', size_bytes: purpose === 'document_text' ? 0 : asset.size_bytes };
    const io = await service(name => { assert.equal(name, 'eps_get_logo_media'); return Response.json(envelope(expected)); },
      purpose === 'presentation_pdf' ? { logoRead: { storageOrigin: origin, brandBucket: 'eps-brand-assets' } } : {});
    const result = await io.studio.getMedia(actor, assetId);
    assert.deepEqual(result, expected); assert.deepEqual(Object.keys(result).sort(), Object.keys(asset).sort());
    assert.doesNotMatch(JSON.stringify(result), /private-synthetic|download_url|signed|token|object_key|bucket/u);
    assert.deepEqual(io.calls, ['eps_get_logo_media']);
  }
});

test('valid source metadata still goes through its purpose-specific current-user adapter', async () => {
  const expected = { ...asset, purpose: 'client_logo' as const, mime_type: 'image/png', filename: 'logo.png', width: 80, height: 40 };
  const io = await service(name => { assert.equal(name, 'eps_get_logo_media'); return Response.json({ asset: expected, bucket: 'eps-brand-assets', object_key: 'assets/logo.png' }); },
    { logoRead: { storageOrigin: origin, brandBucket: 'eps-brand-assets' } });
  assert.deepEqual(await io.studio.getMedia(actor, assetId), expected);
  assert.deepEqual(io.calls, ['eps_get_logo_media', 'eps_get_logo_media']);
});

test('not-found and permission denials remain typed and never become generated metadata', async () => {
  for (const [code, status] of [['RESOURCE_NOT_FOUND', 404], ['CAPABILITY_REQUIRED', 403], ['ACCESS_DENIED', 403]] as const) {
    const io = await service(() => failure(code));
    await assert.rejects(io.studio.getMedia(actor, assetId), isCode(code, status));
    assert.deepEqual(io.calls, ['eps_get_logo_media']);
  }
  const io = await service(() => Response.json(envelope(asset)));
  await assert.rejects(io.studio.getMedia({ principal_id: 'different-user' }, assetId), isCode('ACCESS_DENIED', 403));
  assert.deepEqual(io.calls, []);
});

test('malformed or unknown central records fail closed without public locator or diagnostic leakage', async () => {
  for (const value of [{ ...asset, purpose: 'unknown' }, { ...asset, id: 'unrelated' }, { ...asset, width: 1.5 },
    { ...asset, size_bytes: -1 }, { ...asset, sha256: 'private-diagnostic' }, { ...asset, download_url: 'private-synthetic-url' }]) {
    const io = await service(() => Response.json(envelope(value)));
    await assert.rejects(io.studio.getMedia(actor, assetId), error => {
      assert.ok(isCode('CENTRAL_RESPONSE_INVALID', 503)(error));
      assert.doesNotMatch(JSON.stringify(error), /private-synthetic|private-diagnostic/u); return true;
    });
    assert.deepEqual(io.calls, ['eps_get_logo_media']);
  }
});

test('generated metadata never broadens content reads or purpose-specific RPC scopes', async () => {
  const options = { logoRead: { storageOrigin: origin, brandBucket: 'eps-brand-assets' }, specsRead: { storageOrigin: origin } };
  const io = await service(() => Response.json(envelope(asset)), options);
  await assert.rejects(io.studio.getMediaContent(actor, assetId), isCode('CENTRAL_RESPONSE_INVALID', 503));
  assert.deepEqual(io.calls, ['eps_get_logo_media']);
  const wrongScope = await service(name => name === 'eps_get_logo_media' ? failure('RESOURCE_NOT_FOUND') : Response.json(envelope(asset)), options);
  await assert.rejects(wrongScope.studio.getMedia(actor, assetId), isCode('CENTRAL_RESPONSE_INVALID', 503));
  assert.deepEqual(wrongScope.calls, ['eps_get_logo_media', 'eps_get_specs_media']);
  const denied = await service(() => failure('CAPABILITY_REQUIRED'), options);
  await assert.rejects(denied.studio.getMedia(actor, assetId), isCode('CAPABILITY_REQUIRED', 403));
  assert.deepEqual(denied.calls, ['eps_get_logo_media']);
});

test('cast-only scope ordering and candidate purpose validation also apply to generated metadata reads', async () => {
  const capabilities = { principal_id: principal, capabilities: ['cast.read'], timezone: 'Africa/Cairo', enabled_modules: ['casting'],
    upload_policy: { allowed_mime_types: [], maximum_file_bytes: 268435456, recommended_batch_size: 200, available_purposes: [] } };
  const options = { candidateRead: { storageOrigin: origin } };
  const io = await service(name => name === 'eps_get_capabilities' ? Response.json(capabilities)
    : name === 'eps_get_candidate_asset' ? failure('RESOURCE_NOT_FOUND') : Response.json(envelope(asset)), options);
  assert.deepEqual(await io.studio.getMedia(actor, assetId), asset);
  assert.deepEqual(io.calls, ['eps_get_capabilities', 'eps_get_candidate_asset', 'eps_get_logo_media']);
  const denied = await service(name => name === 'eps_get_capabilities' ? Response.json(capabilities) : failure('CAPABILITY_REQUIRED'), options);
  await assert.rejects(denied.studio.getMedia(actor, assetId), isCode('CAPABILITY_REQUIRED', 403));
  assert.deepEqual(denied.calls, ['eps_get_capabilities', 'eps_get_candidate_asset']);
  const wrongScope = await service(name => name === 'eps_get_capabilities' ? Response.json(capabilities) : Response.json(envelope(asset)), options);
  await assert.rejects(wrongScope.studio.getMedia(actor, assetId), isCode('CENTRAL_RESPONSE_INVALID', 503));
  assert.deepEqual(wrongScope.calls, ['eps_get_capabilities', 'eps_get_candidate_asset']);
});
