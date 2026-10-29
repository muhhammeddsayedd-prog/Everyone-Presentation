import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { DomainError, type MediaAsset } from '@eps/domain';
import { centralRpcError, createBearerUserClient, createCentralStudio, type CentralStudioOptions } from '../src/index.ts';
import { signSpecsReceipt, verifySpecsReceipt } from '../src/specs-receipt.ts';
import type { SpecsReservation } from '../src/specs-storage.ts';

// Installed SDK at an injected HTTP boundary. No hosted SQL, Storage or parser.
const principal = '10000000-0000-4000-8000-000000000001';
const workspace = '30000000-0000-4000-8000-000000000001';
const config = { url: 'https://synthetic.supabase.example.invalid', publishableKey: 'sb_publishable_synthetic-public-test-value' };
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: principal, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.synthetic-test-signature`;
const actor = { principal_id: principal };
const bytes = Buffer.from('\ufeffOriginal synthetic brief\r\nثلاثة ممثلين 😀');
const digest = createHash('sha256').update(bytes).digest('hex');
const proofKey = Buffer.alloc(32, 71);
const scopeError = (message: string, status = 404) => Response.json({ code: 'P0001', message, details: '{"private":"never-expose"}' }, { status });
const isCode = (code: string, status: number) => (value: unknown) => value instanceof DomainError && value.code === code && value.status === status;

function service() {
  const calls: { path: string; body: Record<string, unknown>; headers: Headers }[] = [];
  const reservations = new Map<string, SpecsReservation>(); const stored = new Map<string, Uint8Array>();
  let advertised: string[] = ['client_logo', 'specs', 'candidate_video']; let allowed = true;
  let logoFailure: 'RESOURCE_NOT_FOUND' | 'CAPABILITY_REQUIRED' | 'unknown' | 'malformed' = 'RESOURCE_NOT_FOUND';
  let minted = 0; let downloaded = 0; let finalized = 0; let verified = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input)); const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {};
    calls.push({ path: url.pathname, body, headers });
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, aud: 'authenticated', role: 'authenticated',
      email: 'synthetic@example.invalid', email_confirmed_at: '2026-10-28T00:00:00Z', created_at: '2026-10-28T00:00:00Z',
      app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], is_anonymous: false });
    const uploadPrefix = '/storage/v1/object/upload/sign/eps-specs-assets/';
    if (url.pathname.startsWith(uploadPrefix)) {
      const key = url.pathname.slice(uploadPrefix.length);
      if (init?.method === 'PUT') { assert.ok(init.body instanceof Uint8Array); stored.set(key, new Uint8Array(init.body)); return Response.json({ Key: key }); }
      minted++; assert.equal(headers.get('x-upsert'), 'false'); return Response.json({ url: `/object/upload/sign/eps-specs-assets/${key}?token=synthetic-transfer` });
    }
    const readPrefix = '/storage/v1/object/eps-specs-assets/';
    if (url.pathname.startsWith(readPrefix)) {
      downloaded++; const content = stored.get(url.pathname.slice(readPrefix.length));
      return content ? new Response(new ReadableStream({ start(controller) { controller.enqueue(content); controller.close(); } }))
        : Response.json({ statusCode: '404', message: 'not stored' }, { status: 404 });
    }
    const name = url.pathname.split('/').at(-1)!;
    if (name === 'eps_get_capabilities') return Response.json({ principal_id: principal, capabilities: ['workspaces.read', 'workspaces.write'],
      timezone: 'Africa/Cairo', enabled_modules: ['casting'], upload_policy: { allowed_mime_types: ['text/plain'], maximum_file_bytes: 20 * 1024 * 1024,
        recommended_batch_size: 200, available_purposes: advertised } });
    if (name.startsWith('eps_get_logo_')) {
      if (logoFailure === 'malformed') return Response.json({ unexpected: true });
      if (logoFailure === 'unknown') return Response.json({ code: 'XX000', message: 'private-provider-diagnostic' }, { status: 500 });
      return scopeError(logoFailure, 400);
    }
    if (!allowed) return scopeError('RESOURCE_NOT_FOUND', 400);
    if (name === 'eps_reserve_specs_upload') {
      const input = body.p_input as Record<string, unknown>; const ordinal = reservations.size + 1;
      const assetId = `60000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`;
      const uploadId = `50000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`;
      const asset: MediaAsset = { id: assetId, purpose: 'specs', filename: String(input.filename), mime_type: 'text/plain', size_bytes: bytes.length,
        sha256: null, status: 'uploading', width: null, height: null, duration_ms: null, source_asset_id: null, source_timestamp_ms: null, created_at: new Date().toISOString() };
      const item: SpecsReservation = { upload_id: uploadId, asset, principal_id: principal, workspace_id: workspace, spec_row_version: 7,
        reservation_revision: 1, verification_id: '70000000-0000-4000-8000-000000000001', bucket: 'eps-specs-assets', object_key: `assets/${assetId}/original.txt`,
        expected_size_bytes: bytes.length, expected_mime_type: 'text/plain', expected_sha256: digest, expires_at: new Date(Date.now() + 3600_000).toISOString(), status: 'open' };
      reservations.set(uploadId, item); return Response.json(item);
    }
    if (name === 'eps_get_specs_media') {
      const item = [...reservations.values()].find(value => value.asset.id === body.p_asset_id);
      return item ? Response.json({ asset: item.asset, bucket: item.bucket, object_key: item.object_key }) : scopeError('RESOURCE_NOT_FOUND', 400);
    }
    const item = reservations.get(String(body.p_upload_id)); if (!item) return scopeError('RESOURCE_NOT_FOUND', 400);
    const result = () => ({ asset: item.asset, processing_job_id: null, status: 'ready' });
    if (name === 'eps_get_specs_upload') return Response.json(item);
    if (name === 'eps_prepare_specs_completion') return Response.json({ reservation: item, replay: item.status === 'completed' ? result() : null });
    if (name === 'eps_finalize_specs_completion') {
      const claims = verifySpecsReceipt({ payload: String(body.p_payload), mac: String(body.p_mac) }, proofKey,
        { key_id: 'synthetic-specs-key', verification_id: item.verification_id, upload_id: item.upload_id, asset_id: item.asset.id,
          principal_id: principal, workspace_id: workspace, reservation_revision: 1, bucket: item.bucket, object_key: item.object_key,
          size_bytes: bytes.length, mime_type: 'text/plain', verified_format: 'utf8_text', sha256: digest });
      finalized++; item.asset = { ...item.asset, status: 'ready', sha256: claims.sha256 }; item.status = 'completed'; return Response.json(result());
    }
    if (name === 'eps_cancel_specs_upload') { item.status = 'cancelled'; return Response.json({ success: true, affected_ids: [item.upload_id, item.asset.id] }); }
    throw new Error('Unexpected controlled SDK request.');
  };
  const options: CentralStudioOptions = { specs: { storageOrigin: config.url,
    async verifyDocument(actual, mime, context) { verified++; assert.deepEqual(Buffer.from(actual), bytes); assert.equal(context.sourceAssetId, [...reservations.values()].at(-1)!.asset.id); return { mimeType: mime, format: 'utf8_text' }; },
    signReceipt(facts) { const now = Math.floor(Date.now() / 1000); return signSpecsReceipt({ ...facts, schema_version: 'specs-original-verification.v1',
      audience: 'eps.specs-original-verification', purpose: 'specs', key_id: 'synthetic-specs-key', issued_at: now, expires_at: now + 90 }, proofKey); } } };
  return { fetcher, calls, options, setAdvertised(value: string[]) { advertised = value; }, revoke() { allowed = false; },
    failLogo(value: typeof logoFailure) { logoFailure = value; }, counters: () => ({ minted, downloaded, finalized, verified }) };
}
const input = { purpose: 'specs' as const, workspace_id: workspace, filename: 'synthetic.txt', mime_type: 'text/plain', size_bytes: bytes.length, sha256: digest };

test('purpose-aware installed SDK journey verifies document bytes, scopes replay/Ready reads and leaves raw private proof off DTOs', async () => {
  const io = service(); const client = createBearerUserClient({ ...config, accessToken: token }, { fetch: io.fetcher });
  const studio = await createCentralStudio(client, io.options);
  assert.deepEqual((await studio.getCapabilities(actor)).upload_policy.available_purposes, ['specs']);
  io.setAdvertised([]); assert.deepEqual((await studio.getCapabilities(actor)).upload_policy.available_purposes, []);
  const context = { idempotencyKey: 'synthetic-specs-journey', requestId: 'synthetic.specs:journey', clientType: 'mcp' as const };
  const session = await studio.createUploadSession(actor, input, context);
  await io.fetcher(session.upload_url!, { method: 'PUT', body: new Uint8Array(bytes), headers: session.upload_headers });
  const completeInput = { actual_size_bytes: bytes.length, start_processing: false, sha256: digest };
  const completed = await studio.completeUpload(actor, session.id, completeInput, context);
  assert.equal(completed.asset.purpose, 'specs'); assert.equal(completed.asset.sha256, digest); assert.equal(completed.processing_job_id, null);
  assert.equal((await studio.getUploadSession(actor, session.id)).upload_url, null);
  assert.deepEqual(await studio.getMedia(actor, completed.asset.id), completed.asset);
  assert.deepEqual((await studio.getMediaContent(actor, completed.asset.id)).bytes, bytes);
  const readOnly = await createCentralStudio(client, { specsRead: { storageOrigin: config.url } });
  assert.deepEqual((await readOnly.getCapabilities(actor)).upload_policy.available_purposes, []);
  assert.deepEqual(await readOnly.completeUpload(actor, session.id, completeInput, context), completed);
  assert.deepEqual((await readOnly.getMediaContent(actor, completed.asset.id)).bytes, bytes);
  assert.deepEqual(io.counters(), { minted: 1, downloaded: 3, finalized: 1, verified: 1 });
  io.revoke(); await assert.rejects(readOnly.completeUpload(actor, session.id, completeInput, context), isCode('RESOURCE_NOT_FOUND', 404));
  assert.equal(io.counters().downloaded, 3);
  for (const call of io.calls.filter(value => value.path.startsWith('/rest/v1/rpc/'))) {
    assert.equal(call.headers.get('authorization'), `Bearer ${token}`); assert.ok(!Object.hasOwn(call.body, 'principal_id'));
    if (/eps_(reserve_specs_upload|prepare_specs_completion|finalize_specs_completion)$/u.test(call.path)) {
      assert.equal(call.headers.get('x-eps-client-type'), 'mcp'); assert.equal(call.headers.get('x-eps-request-id'), context.requestId);
    }
  }
  assert.doesNotMatch(JSON.stringify(completed), /synthetic-transfer|synthetic-specs-key|payload|\bmac\b/);
});

test('only scoped logo RESOURCE_NOT_FOUND404 permits purpose fallback; denial/unknown errors never reach specs', async () => {
  for (const [failure, code, status] of [['CAPABILITY_REQUIRED', 'CAPABILITY_REQUIRED', 403], ['unknown', 'DEPENDENCY_UNAVAILABLE', 503]] as const) {
    const io = service(); io.failLogo(failure);
    const studio = await createCentralStudio(createBearerUserClient({ ...config, accessToken: token }, { fetch: io.fetcher }), io.options);
    await assert.rejects(studio.getUploadSession(actor, '50000000-0000-4000-8000-000000000099'), isCode(code, status));
    assert.equal(io.calls.filter(value => value.path.includes('/eps_get_specs_')).length, 0);
  }
  const io = service(); const studio = await createCentralStudio(createBearerUserClient({ ...config, accessToken: token }, { fetch: io.fetcher }), io.options);
  await assert.rejects(studio.getMedia({ principal_id: 'different-user' }, 'asset'), isCode('ACCESS_DENIED', 403));
  assert.equal(io.calls.filter(value => value.path.startsWith('/rest/')).length, 0);
  const malformed = service(); malformed.failLogo('malformed');
  const mixed = await createCentralStudio(createBearerUserClient({ ...config, accessToken: token }, { fetch: malformed.fetcher }),
    { ...malformed.options, logoRead: { storageOrigin: config.url, brandBucket: 'eps-brand-assets' } });
  await assert.rejects(mixed.getMedia(actor, 'asset'), isCode('CENTRAL_RESPONSE_INVALID', 503));
  assert.equal(malformed.calls.filter(value => value.path.includes('/eps_get_specs_')).length, 0);
});

test('read-only document configuration cannot mint, reserve or verify new bytes but can cancel its scoped open reservation', async () => {
  const io = service(); const client = createBearerUserClient({ ...config, accessToken: token }, { fetch: io.fetcher });
  const writer = await createCentralStudio(client, io.options); const context = { idempotencyKey: 'synthetic-specs-cancel' };
  const session = await writer.createUploadSession(actor, input, context);
  const reader = await createCentralStudio(client, { specsRead: { storageOrigin: config.url } });
  await assert.rejects(reader.createUploadSession(actor, input, context), isCode('SPECS_STORAGE_CONFIGURATION_REQUIRED', 503));
  await assert.rejects(reader.getUploadSession(actor, session.id), isCode('SPECS_STORAGE_CONFIGURATION_REQUIRED', 503));
  assert.equal((await reader.cancelUpload(actor, session.id, context)).success, true);
  const cancelled = await reader.getUploadSession(actor, session.id); assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.upload_url, null);
  assert.deepEqual(io.counters(), { minted: 1, downloaded: 0, finalized: 0, verified: 0 });
});

test('known upload readiness/state errors keep safe typed status without copying SQL details', () => {
  for (const [code, status] of [['FEATURE_NOT_IMPLEMENTED', 503], ['UPLOAD_EXPIRED', 409], ['SPECS_STATE_INVALID', 409]] as const) {
    const error = centralRpcError({ code: 'P0001', message: code, details: '{"message":"private-document-source","token":"private-transfer","status":200}' });
    assert.equal(error.code, code); assert.equal(error.status, status); assert.doesNotMatch(JSON.stringify(error), /private-document-source|private-transfer/);
  }
  assert.equal(centralRpcError({ code: 'P0001', message: 'unrecognized-file-status', details: '{}' }).code, 'DEPENDENCY_UNAVAILABLE');
});

test('unknown purposes and short mutation keys fail before any private reservation RPC', async () => {
  const io = service(); const studio = await createCentralStudio(createBearerUserClient({ ...config, accessToken: token }, { fetch: io.fetcher }), io.options);
  await assert.rejects(studio.createUploadSession(actor, { ...input, purpose: 'invented-purpose' as never }, { idempotencyKey: 'synthetic-specs-request' }), isCode('VALIDATION_FAILED', 400));
  await assert.rejects(studio.createUploadSession(actor, input, { idempotencyKey: 'short' }), isCode('VALIDATION_FAILED', 400));
  assert.equal(io.calls.filter(value => value.path.startsWith('/rest/')).length, 0);
});
