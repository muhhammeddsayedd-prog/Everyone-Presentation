import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { DIAGNOSTIC_SCOPE as scope, parseDiagnosticInput, runGuestStorageDiagnostic } from '../../tools/diagnose-m06-guest-storage.mts';

const now = Date.parse('2026-10-30T02:00:00Z'), gatewayKey = Buffer.alloc(32, 7), token = Buffer.alloc(32, 9).toString('base64url');
const config = { url: 'https://canonical.invalid', publishableKey: 'sb_publishable_synthetic_diagnostic' };
const input = { schema_version: '1.0', frame_session_digest: 'a'.repeat(64), pdf_session_digest: 'b'.repeat(64) };
const frame = Buffer.from('synthetic-private-frame'), pdf = Buffer.from('%PDF-private-synthetic-artifact'), marker = 'PRIVATE_PROVIDER_PAYLOAD_MUST_NOT_BE_LOGGED';
const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex');
function metadata(kind: 'frame' | 'pdf') { const bytes = kind === 'frame' ? frame : pdf; return { asset: { id: kind === 'frame' ? scope.frame : 'a6060000-0000-4000-8000-000000000099', purpose: kind === 'frame' ? 'candidate_frame' : 'presentation_pdf', filename: kind === 'frame' ? 'frame.jpg' : 'export.pdf', mime_type: kind === 'frame' ? 'image/jpeg' : 'application/pdf', size_bytes: bytes.length, sha256: sha(bytes), status: 'ready', duration_ms: null, width: null, height: null, source_asset_id: null, source_timestamp_ms: null, created_at: new Date(now).toISOString() }, bucket: 'private-test', object_key: `${kind}/fixed.bin`, grant_token: token, expires_at: new Date(now + 60000).toISOString() }; }
function exportDto() { return { id: scope.pdf_export, version_id: scope.version, review_link_id: scope.pdf_link, template_version: '1.1.0', export_revision: 1, status: 'ready', pdf_asset_id: metadata('pdf').asset.id, job_id: 'a6060000-0000-4000-8000-000000000098', created_at: new Date(now).toISOString(), ready_at: new Date(now).toISOString(), failure_code: null }; }
test('diagnostic compares exact same scoped grant/target with only Authorization omitted and publishes no private payload', async () => {
  const storage: { target: string; authorization: string | null; grant: string | null }[] = []; const operations: string[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    const target = new URL(String(url)), headers = new Headers(init?.headers);
    if (target.pathname === '/rest/v1/rpc/eps_guest_operation') {
      const body = JSON.parse(String(init?.body)); operations.push(body.p_operation); assert.equal(body.p_proof.signature.length, 64);
      if (body.p_operation === 'get_export') return Response.json(exportDto());
      if (body.p_operation === 'get_asset') { assert.deepEqual(body.p_input, { session_digest: input.frame_session_digest, version_id: scope.version, asset_id: scope.frame, purpose: 'frame' }); return Response.json(metadata('frame')); }
      assert.equal(body.p_operation, 'get_export_asset'); assert.deepEqual(body.p_input, { session_digest: input.pdf_session_digest, export_id: scope.pdf_export }); return Response.json(metadata('pdf'));
    }
    storage.push({ target: target.href, authorization: headers.get('authorization'), grant: headers.get('x-eps-review-asset-grant') });
    assert.equal(headers.get('apikey'), config.publishableKey); assert.equal(headers.get('x-eps-review-asset-grant'), token);
    if (headers.has('authorization')) return new Response(JSON.stringify({ error: marker }), { status: 401 });
    const kind = target.pathname.includes('/frame/') ? 'frame' : 'pdf', bytes = kind === 'frame' ? frame : pdf;
    return new Response(bytes, { headers: { 'content-type': metadata(kind).asset.mime_type, 'content-length': String(bytes.length) } });
  };
  const report = await runGuestStorageDiagnostic(input, { config, gatewayKey, fetch: fetcher, now: () => now });
  assert.deepEqual(operations, ['get_asset', 'get_export', 'get_export_asset']); assert.equal(storage.length, 8);
  for (const offset of [0, 4]) { assert.equal(storage[offset].target, storage[offset + 1].target); assert.equal(storage[offset + 2].target, storage[offset + 3].target); assert.equal(storage[offset].target.replace('/storage/v1/object/', '/storage/v1/object/authenticated/'), storage[offset + 2].target);
    assert.equal(storage[offset].authorization, `Bearer ${config.publishableKey}`); assert.equal(storage[offset + 2].authorization, `Bearer ${config.publishableKey}`); assert.equal(storage[offset + 1].authorization, null); assert.equal(storage[offset + 3].authorization, null); assert.ok(storage.slice(offset, offset + 4).every(row => row.grant === token)); }
  assert.equal(report.observations.filter(row => row.phase === 'storage_body' && ['apikey_only', 'apikey_only_authenticated_path'].includes(row.transport!) && row.result === 'passed').length, 4);
  assert.equal(report.observations.filter(row => row.phase === 'storage_headers' && row.transport === 'current' && row.http_status === 401).length, 2);
  const serialized = JSON.stringify(report); for (const value of [marker, token, input.frame_session_digest, input.pdf_session_digest, config.url, config.publishableKey]) assert.ok(!serialized.includes(value));
});
test('diagnostic rejects caller targets or extra credentials and never logs thrown provider messages', async () => {
  assert.throws(() => parseDiagnosticInput({ ...input, target: 'https://untrusted.invalid' })); assert.throws(() => parseDiagnosticInput({ ...input, frame_session_digest: token }));
  const report = await runGuestStorageDiagnostic(input, { config, gatewayKey, now: () => now, fetch: async () => { throw Error(`${marker}/${token}`); } });
  assert.equal(report.observations.length, 2); assert.ok(report.observations.every(row => row.result === 'failed' && row.code === 'DEPENDENCY_UNAVAILABLE'));
  assert.ok(!JSON.stringify(report).includes(marker));
});
test('foreign scoped metadata is rejected before Storage and altered content cannot report a passing body', async () => {
  let storageCalls = 0;
  const report = await runGuestStorageDiagnostic(input, { config, gatewayKey, now: () => now, fetch: async (url, init) => {
    if (new URL(String(url)).pathname.startsWith('/rest/')) {
      const op = JSON.parse(String(init?.body)).p_operation;
      if (op === 'get_export') return Response.json(exportDto());
      return Response.json(op === 'get_asset' ? { ...metadata('frame'), asset: { ...metadata('frame').asset, id: 'foreign' } } : metadata('pdf'));
    }
    storageCalls++; const bytes = Buffer.from(pdf); bytes[bytes.length - 1] ^= 1; return new Response(bytes, { headers: { 'content-type': 'application/pdf', 'content-length': String(bytes.length) } });
  } });
  assert.equal(storageCalls, 4); assert.ok(!report.observations.some(row => row.asset === 'frame' && row.phase.startsWith('storage'))); assert.ok(!report.observations.some(row => row.phase === 'storage_body' && row.result === 'passed'));
  assert.equal(report.observations.filter(row => row.asset === 'pdf' && row.phase === 'proxy' && row.code === 'SOURCE_UNREADABLE').length, 4);
});
test('provider classification is a closed code/SQLSTATE allowlist while freeform messages remain private', async () => {
  const report = await runGuestStorageDiagnostic(input, { config, gatewayKey, now: () => now, fetch: async (url, init) => {
    if (new URL(String(url)).pathname.startsWith('/rest/')) { const op = JSON.parse(String(init?.body)).p_operation; return Response.json(op === 'get_export' ? exportDto() : metadata(op === 'get_asset' ? 'frame' : 'pdf')); }
    return Response.json({ error: 'DatabaseError', code: '42501', message: `${marker} (SQLSTATE 42501)`, arbitrary_secret: token }, { status: 500 });
  } });
  const failures = report.observations.filter(row => row.phase === 'storage_headers'); assert.equal(failures.length, 8); assert.ok(failures.every(row => row.provider_code === 'DatabaseError' && row.sqlstate === '42501'));
  assert.ok(!JSON.stringify(report).includes(marker)); assert.ok(!JSON.stringify(report).includes(token));
});
