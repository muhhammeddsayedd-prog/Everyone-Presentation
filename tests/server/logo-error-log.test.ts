import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '@eps/domain';
import { withSyntheticApiRoute } from '../fixtures/next-api-route.ts';
import { logLogoRequestFailure } from '../../apps/web/lib/logo-error-log.ts';

const principal = '98000000-0000-4000-8000-000000000001';
const uploadId = '98000000-0000-4000-8000-000000000002';
const assetId = '98000000-0000-4000-8000-000000000003';
const workspaceId = '98000000-0000-4000-8000-000000000004';
const provider = 'https://logo-trace.synthetic.invalid';
const marker = 'PRIVATE_LOGO_TOKEN_HEADER_BODY_OBJECT_PATH_MUST_NOT_APPEAR';

test('logo log projects closed details only, ignoring arbitrary private properties and toJSON', () => {
  const lines: string[] = [];
  const details = { logo_phase: 'sign_verification', storage_http_status: 400, storage_body_status: 403, storage_code: 'AccessDenied',
    token: marker, message: marker, url: marker, headers: marker, toJSON() { throw Error(marker); } };
  logLogoRequestFailure(new DomainError('DEPENDENCY_UNAVAILABLE', marker, 503, details), principal, value => { lines.push(value); });
  assert.deepEqual(JSON.parse(lines[0]), { event: 'logo_request_failed', request_id: principal, code: 'DEPENDENCY_UNAVAILABLE',
    logo_phase: 'sign_verification', storage_http_status: 400, storage_body_status: 403, storage_code: 'AccessDenied' });
  assert(!lines[0].includes(marker));
});

test('invalid diagnostic codes and statuses cannot leak and unmarked failures emit nothing', () => {
  const lines: string[] = [], write = (value: string) => { lines.push(value); };
  logLogoRequestFailure(new DomainError(marker, marker, 503, { logo_phase: 'stream', storage_http_status: marker,
    storage_body_status: 999, storage_code: marker }), marker, write);
  assert.deepEqual(JSON.parse(lines[0]), { event: 'logo_request_failed', request_id: 'unavailable', code: 'DEPENDENCY_UNAVAILABLE',
    logo_phase: 'stream', storage_http_status: null, storage_body_status: null, storage_code: null });
  for (const error of [new Error(marker), new DomainError('ACCESS_DENIED', marker, 403),
    new DomainError('DEPENDENCY_UNAVAILABLE', marker, 503, { logo_phase: marker })]) logLogoRequestFailure(error, principal, write);
  assert.equal(lines.length, 1); assert(!lines[0].includes(marker));
});

test('throwing getters, synchronous sinks and rejected asynchronous sinks cannot replace a failure', async () => {
  const getter = new DomainError('DEPENDENCY_UNAVAILABLE', marker, 503, { get logo_phase() { throw Error(marker); } });
  assert.doesNotThrow(() => logLogoRequestFailure(getter, principal));
  const error = new DomainError('SOURCE_UNREADABLE', marker, 422, { logo_phase: 'decode' });
  assert.doesNotThrow(() => logLogoRequestFailure(error, principal, () => { throw Error(marker); }));
  logLogoRequestFailure(error, principal, async () => { throw Error(marker); });
  await new Promise(resolve => setImmediate(resolve));
});

for (const phase of ['sign_upload', 'download'] as const) test(`actual HTTP ${phase} failure logs only safe fields with the response request ID`, async t => {
  const lines: unknown[][] = [], paths: string[] = [];
  t.mock.method(console, 'error', (...values: unknown[]) => { lines.push(values); });
  const reservation = { upload_id: uploadId, asset: { id: assetId, purpose: 'client_logo', filename: `${marker}.png`,
    mime_type: 'image/png', size_bytes: 8, sha256: null, status: 'uploading', duration_ms: null,
    width: null, height: null, source_asset_id: null, source_timestamp_ms: null, created_at: '2026-11-02T00:00:00Z' },
  principal_id: principal, workspace_id: workspaceId, reservation_revision: 1,
  verification_id: '98000000-0000-4000-8000-000000000005', bucket: 'eps-brand-assets', object_key: `logos/${assetId}.png`,
  expected_size_bytes: 8, expected_mime_type: 'image/png', expected_sha256: null, expires_at: '2099-01-01T00:00:00Z', status: 'open' };
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init), url = new URL(request.url); assert.equal(url.origin, provider);
    paths.push(url.pathname);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    if (url.pathname === '/rest/v1/rpc/eps_reserve_logo_upload') return Response.json(reservation);
    if (url.pathname === '/rest/v1/rpc/eps_get_logo_upload') return Response.json(reservation);
    if (url.pathname === '/rest/v1/rpc/eps_prepare_logo_completion') return Response.json({ reservation, replay: null });
    assert.equal(url.pathname, phase === 'sign_upload'
      ? `/storage/v1/object/upload/sign/eps-brand-assets/logos/${assetId}.png`
      : `/storage/v1/object/eps-brand-assets/logos/${assetId}.png`);
    return Response.json({ statusCode: phase === 'sign_upload' ? '403' : '404', code: phase === 'sign_upload' ? 'AccessDenied' : 'NoSuchKey',
      message: marker, headers: marker, body: marker }, { status: 400 });
  });
  await withSyntheticApiRoute({ NODE_ENV: 'test', APP_ENV: 'test', APP_BASE_URL: 'http://127.0.0.1:3000',
    CENTRAL_ADAPTER_MODE: 'supabase', SUPABASE_URL: provider, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_logo_trace',
    CENTRAL_LOGO_UPLOADS_ENABLED: 'true', LOGO_VERIFICATION_KEY_ID: 'synthetic-trace',
    LOGO_VERIFICATION_KEY_BASE64URL: Buffer.alloc(32, 4).toString('base64url') }, async call => {
    const segments = phase === 'sign_upload' ? ['uploads'] : ['uploads', uploadId, 'complete'];
    const body = phase === 'sign_upload' ? { workspace_id: workspaceId, purpose: 'client_logo', filename: `${marker}.png`, mime_type: 'image/png', size_bytes: 8 }
      : { actual_size_bytes: 8, start_processing: false };
    const response = await call(new Request(`http://127.0.0.1:3000/api/v1/${segments.join('/')}`, { method: 'POST',
      headers: { host: '127.0.0.1:3000', authorization: `Bearer ${marker}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'synthetic-logo-trace-once' }, body: JSON.stringify(body) }), segments);
    const result = await response.json(); assert.equal(response.status, phase === 'sign_upload' ? 403 : 409);
    assert.equal(result.error.code, phase === 'sign_upload' ? 'ACCESS_DENIED' : 'UPLOAD_INCOMPLETE');
    assert.equal(lines.length, 1); assert.equal(lines[0].length, 1); assert.equal(typeof lines[0][0], 'string');
    assert.deepEqual(JSON.parse(lines[0][0] as string), { event: 'logo_request_failed', request_id: result.request_id,
      code: result.error.code, logo_phase: phase, storage_http_status: 400, storage_body_status: phase === 'sign_upload' ? 403 : 404,
      storage_code: phase === 'sign_upload' ? 'AccessDenied' : 'NoSuchKey' });
    assert(!JSON.stringify(lines).includes(marker)); assert(!JSON.stringify(lines).includes(assetId));
    assert(!JSON.stringify(lines).includes(provider)); assert(!paths.some(value => value.includes('cancel')));
  });
});
