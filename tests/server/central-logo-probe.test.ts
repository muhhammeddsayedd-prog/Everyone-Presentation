import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createBearerUserClient, createCentralStudio, signLogoReceipt, verifyLogoReceipt } from '@eps/central';
import { DomainError, type MediaAsset, type UploadCompletion } from '@eps/domain';
import { LOGO_PROBE_PROJECT, probeWorkspaceInput, readApprovedProbeLogo, requireCentralLogoProbe, runCentralLogoProbe } from '../../apps/web/lib/central-logo-probe.ts';
import { POST } from '../../apps/web/app/api/dev/central-logo-probe/route.ts';

const origin = 'https://pyibofyctwnqpvktepse.supabase.co';
const principal = 'a1111111-1111-4111-8111-111111111111';
const workspaceId = 'a2222222-2222-4222-8222-222222222222';
const environment = { NODE_ENV: 'development', APP_ENV: 'development', CENTRAL_ADAPTER_MODE: 'supabase',
  EPS_CENTRAL_LOGO_PROBE_ENABLED: 'true', SUPABASE_URL: origin } as const;
const bucket = 'eps-brand-assets';
const privateSentinel = 'synthetic-signed-capability-private-provider-detail';
const token = `synthetic.${Buffer.from(JSON.stringify({ sub: principal, role: 'authenticated' })).toString('base64url')}.signature`;
const key = Buffer.alloc(32, 27);

test('probe requires every explicit development guard; production denial occurs before session or cloud access', async () => {
  requireCentralLogoProbe(environment);
  for (const change of [{ NODE_ENV: 'production' }, { NODE_ENV: 'test' }, { APP_ENV: 'production' }, { APP_ENV: undefined },
    { EPS_CENTRAL_LOGO_PROBE_ENABLED: 'false' }, { CENTRAL_ADAPTER_MODE: 'local_fixture' }, { SUPABASE_URL: 'https://other.example.invalid' }]) {
    assert.throws(() => requireCentralLogoProbe({ ...environment, ...change }), error => error instanceof DomainError && error.status === 404);
  }
  const before = process.env;
  try {
    process.env = { ...process.env, ...environment, NODE_ENV: 'production' };
    const response = await POST(new Request('http://127.0.0.1:3000/api/dev/central-logo-probe', { method: 'POST' }));
    assert.equal(response.status, 404); assert.equal((await response.json()).error.code, 'RESOURCE_NOT_FOUND');
  } finally { process.env = before; }
});

test('probe route rejects bearer substitution and foreign origins without invoking cookie session APIs', async () => {
  const before = process.env;
  try {
    process.env = { ...process.env, ...environment, APP_BASE_URL: 'http://127.0.0.1:3000', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic-probe-test' };
    const scenarios: Record<string, string>[] = [{ Host: '127.0.0.1:3000', Origin: 'https://other.example.invalid' },
      { Host: '127.0.0.1:3000', Origin: 'http://127.0.0.1:3000', Authorization: `Bearer ${privateSentinel}` }];
    for (const headers of scenarios) {
      const response = await POST(new Request('http://127.0.0.1:3000/api/dev/central-logo-probe', { method: 'POST', headers }));
      assert.equal(response.status, 403); assert.doesNotMatch(JSON.stringify(await response.json()), /synthetic-signed/);
    }
  } finally { process.env = before; }
  assert.equal(probeWorkspaceInput({ workspace_id: workspaceId }), workspaceId);
  for (const value of [{ workspace_id: workspaceId, bucket: 'other' }, { workspace_id: workspaceId, actor_id: principal }, { workspace_id: 'bad' }, null]) {
    assert.throws(() => probeWorkspaceInput(value), error => error instanceof DomainError && error.status === 400);
  }
});

async function harness(settings: { unsafeMint?: boolean; unsafeReplay?: boolean; wrongProject?: boolean; transportFailure?: boolean; removeNoop?: boolean;
  deniedAfterWrite?: 'replay' | 'upsert' | 'update'; readyMutationStatus?: 400 | 404 | 500; readyProviderStatus?: number;
  mintDenialStatus?: 404; deleteBeforeMoveDenial?: boolean; freshRead500?: boolean; replay500?: boolean } = {}) {
  const bytes = await readApprovedProbeLogo();
  const calls: { path: string; method: string; headers: Headers }[] = [];
  const objects = new Map<string, Uint8Array>();
  const reservations = new Map<string, { upload_id: string; asset: MediaAsset; principal_id: string; workspace_id: string;
    reservation_revision: number; verification_id: string; bucket: string; object_key: string; expected_size_bytes: number;
    expected_mime_type: string; expected_sha256: string | null; expires_at: string; status: string }>();
  let completions = 0;
  const forbidden = () => Response.json({ statusCode: '403', message: privateSentinel, error: 'AccessDenied' }, { status: 400 });
  const readyDenied = () => settings.readyMutationStatus ? Response.json({ statusCode: String(settings.readyProviderStatus ?? settings.readyMutationStatus),
    message: privateSentinel }, { status: settings.readyMutationStatus }) : forbidden();
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? 'GET'; const headers = new Headers(init?.headers);
    calls.push({ path: url.pathname, method, headers });
    assert.equal(init?.cache, 'no-store'); assert.equal(init?.redirect, 'error');
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, aud: 'authenticated', role: 'authenticated',
      email: 'synthetic-probe@example.invalid', is_anonymous: false, user_metadata: {}, app_metadata: {}, created_at: new Date().toISOString() });
    if (url.pathname.startsWith('/storage/v1/object/upload/sign/')) {
      const objectKey = url.pathname.split(`/storage/v1/object/upload/sign/${bucket}/`)[1];
      const reserved = [...reservations.values()].find(item => item.object_key === objectKey)!;
      if (reserved.status === 'cancelled') return forbidden();
      if (headers.get('x-upsert') !== 'false' && !(settings.unsafeMint && headers.get('x-upsert') === 'true')) {
        return settings.mintDenialStatus ? Response.json({ statusCode: '404', message: privateSentinel }, { status: 404 }) : forbidden();
      }
      return Response.json({ url: `/object/upload/sign/${bucket}/${objectKey}?token=${privateSentinel}` });
    }
    if (url.pathname.startsWith(`/storage/v1/object/${bucket}/`)) {
      const objectKey = url.pathname.split(`/storage/v1/object/${bucket}/`)[1]; const stored = objects.get(objectKey);
      if (method !== 'GET') {
        assert.ok(init?.body instanceof Uint8Array); assert.notDeepEqual(Buffer.from(init.body), bytes);
        const metadata = await sharp(init.body).metadata(); assert.equal(metadata.width, 20); assert.equal(metadata.height, 20);
        if (settings.deniedAfterWrite === 'upsert' && method === 'POST' || settings.deniedAfterWrite === 'update' && method === 'PUT') {
          objects.set(objectKey, new Uint8Array(init.body));
        }
        return readyDenied();
      }
      if (!stored) return Response.json({ statusCode: '404', message: privateSentinel }, { status: settings.freshRead500 ? 500 : 404 });
      const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(stored); controller.close(); } }));
      response.blob = async () => { throw new Error('Unbounded Blob read must never run.'); }; return response;
    }
    if (settings.removeNoop && url.pathname === `/storage/v1/object/${bucket}` && method === 'DELETE') return Response.json([]);
    if (url.pathname === '/storage/v1/object/move' && settings.deleteBeforeMoveDenial) {
      const body = JSON.parse(String(init?.body)); objects.delete(body.sourceKey);
    }
    if (url.pathname.startsWith('/storage/')) return readyDenied();
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const name = url.pathname.split('/').at(-1);
    if (name === 'eps_get_workspace') return Response.json({ id: workspaceId, project_id: settings.wrongProject ? principal : LOGO_PROBE_PROJECT,
      module: 'casting', title: 'Synthetic probe workspace', logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: 1,
      draft_revision: 0, has_unpublished_changes: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    if (name === 'eps_get_project') return Response.json({ id: LOGO_PROBE_PROJECT, name: 'Synthetic fixed test project', client_id: null, client_name: null,
      client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: workspaceId, can_edit: true });
    if (name === 'eps_get_capabilities') return Response.json({ principal_id: principal, capabilities: ['projects.read', 'workspaces.read', 'workspaces.write'],
      timezone: 'Africa/Cairo', enabled_modules: ['casting'], upload_policy: { allowed_mime_types: ['image/png'], maximum_file_bytes: 5242880,
        recommended_batch_size: 200, available_purposes: ['client_logo'] } });
    if (name === 'eps_reserve_logo_upload') {
      const ordinal = String(reservations.size + 1).padStart(12, '0');
      const id = `a3333333-3333-4333-8333-${ordinal}`; const assetId = `a4444444-4444-4444-8444-${ordinal}`;
      const asset: MediaAsset = { id: assetId, purpose: 'client_logo', filename: body.p_input.filename, mime_type: 'image/png', size_bytes: bytes.length,
        sha256: null, status: 'uploading', duration_ms: null, width: null, height: null, source_asset_id: null, source_timestamp_ms: null, created_at: new Date().toISOString() };
      const reserved = { upload_id: id, asset, principal_id: principal, workspace_id: workspaceId, reservation_revision: 1,
        verification_id: 'a5555555-5555-4555-8555-555555555555', bucket, object_key: `assets/${assetId}/original.png`, expected_size_bytes: bytes.length,
        expected_mime_type: 'image/png', expected_sha256: body.p_input.sha256 ?? null, expires_at: new Date(Date.now() + 7_200_000).toISOString(), status: 'open' };
      reservations.set(id, reserved); return Response.json(reserved);
    }
    if (name === 'eps_get_logo_media') {
      const reserved = [...reservations.values()].find(item => item.asset.id === body.p_asset_id)!;
      return Response.json({ asset: reserved.asset, bucket, object_key: reserved.object_key });
    }
    const reserved = reservations.get(body.p_upload_id)!;
    if (name === 'eps_get_logo_upload') return Response.json(reserved);
    if (name === 'eps_cancel_logo_upload') { reserved.status = 'cancelled'; return Response.json({ success: true, affected_ids: [reserved.upload_id, reserved.asset.id] }); }
    if (name === 'eps_prepare_logo_completion') {
      if (reserved.status === 'cancelled') return Response.json({ code: 'P0001', message: 'INVALID_TRANSITION', details: '{}' }, { status: 400 });
      return Response.json({ reservation: reserved, replay: null });
    }
    if (name === 'eps_finalize_logo_completion') {
      const verified = verifyLogoReceipt({ payload: body.p_payload, mac: body.p_mac }, key, { key_id: 'synthetic-probe-key', verification_id: reserved.verification_id,
        upload_id: reserved.upload_id, asset_id: reserved.asset.id, principal_id: principal, workspace_id: workspaceId, reservation_revision: 1,
        bucket, object_key: reserved.object_key, size_bytes: bytes.length, mime_type: 'image/png' });
      completions++; reserved.status = 'completed'; reserved.asset = { ...reserved.asset, status: 'ready', sha256: verified.sha256, width: verified.width, height: verified.height };
      const completed: UploadCompletion = { asset: reserved.asset, processing_job_id: null, status: 'ready' }; return Response.json(completed);
    }
    throw new Error('Unexpected synthetic probe transport request.');
  };
  const client = createBearerUserClient({ url: origin, publishableKey: 'sb_publishable_synthetic-probe-test', accessToken: token }, { fetch: fetcher });
  const studio = await createCentralStudio(client, { logo: { storageOrigin: origin, brandBucket: bucket,
    async decodeLogo(imageBytes) { const image = sharp(imageBytes, { limitInputPixels: 40_000_000, failOn: 'warning' }); const meta = await image.metadata(); await image.raw().toBuffer(); return { mimeType: 'image/png', width: meta.width!, height: meta.height! }; },
    signReceipt(facts) { const now = Math.floor(Date.now() / 1000); return signLogoReceipt({ ...facts, schema_version: '1.0', audience: 'eps.logo-verification.v1', purpose: 'client_logo', key_id: 'synthetic-probe-key', issued_at: now, expires_at: now + 90 }, key); },
  } });
  const transferFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); const objectKey = url.pathname.split(`/storage/v1/object/upload/sign/${bucket}/`)[1];
    assert.equal(url.origin, origin); assert.equal(url.searchParams.get('token'), privateSentinel);
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.referrerPolicy, 'no-referrer'); assert.equal(init?.redirect, 'error');
    assert.equal(new Headers(init?.headers).get('Authorization'), null);
    if (settings.transportFailure) throw new Error(privateSentinel);
    assert.ok(init?.body instanceof Uint8Array);
    if (objects.has(objectKey)) {
      assert.equal(new Headers(init?.headers).get('x-upsert'), 'true');
      assert.notDeepEqual(Buffer.from(init.body), bytes);
      const metadata = await sharp(init.body).metadata(); assert.equal(metadata.width, 20); assert.equal(metadata.height, 20);
      if (settings.unsafeReplay || settings.deniedAfterWrite === 'replay') objects.set(objectKey, new Uint8Array(init.body));
      if (!settings.unsafeReplay) return Response.json({ statusCode: '409', message: privateSentinel }, { status: settings.replay500 ? 500 : 400 });
    } else {
      assert.deepEqual(Buffer.from(init.body), bytes); objects.set(objectKey, new Uint8Array(init.body));
    }
    return Response.json({ Key: objectKey });
  };
  return { client, studio, bytes, calls, reservations, completions: () => completions,
    run: () => runCentralLogoProbe({ client, studio, workspaceId, logoBytes: bytes, requestId: 'synthetic-probe-request', env: environment, transferFetch }) };
}

test('installed SDK probe verifies approved bytes through real Sharp/receipt and exposes only sanitized outcomes', async () => {
  const state = await harness(); const report = await state.run();
  assert.equal(report.result, 'passed'); assert.equal(report.stop_code, null); assert.equal(report.ready_bytes_unchanged, true);
  assert.deepEqual(report.image && { width: report.image.width, height: report.image.height, bytes: report.image.size_bytes }, { width: 447, height: 447, bytes: 31749 });
  assert.equal(state.completions(), 1); assert.equal(state.reservations.size, 2);
  assert.ok(report.checks.every(check => check.passed && !check.unsafe_response));
  assert.equal(report.shared_record_mutations_requested, false); assert.equal(report.existing_assets_targeted, false);
  assert.ok(report.cancellation_upload_id); assert.ok(report.cancellation_asset_id);
  assert.ok(!state.calls.some(call => /eps_update_|eps_list_/u.test(call.path)));
  assert.doesNotMatch(JSON.stringify(report), /synthetic-signed|synthetic-probe-key|Bearer|upload_url|object_key|payload|\bmac\b|example\.invalid/);
});

test('unexpected upsert capability aborts before any object transfer or Ready publication', async () => {
  const state = await harness({ unsafeMint: true }); const report = await state.run();
  assert.equal(report.result, 'failed'); assert.equal(report.stop_code, 'UNSAFE_STORAGE_RESPONSE');
  assert.equal(report.checks.at(-1)?.case, 'mint_upsert_true_before_object'); assert.equal(report.checks.at(-1)?.unsafe_response, true);
  assert.equal(state.completions(), 0); assert.equal(report.reservation_cancelled, true);
  assert.doesNotMatch(JSON.stringify(report), /synthetic-signed|Bearer|upload_url/);
});

test('unexpected signed replay success stops later mutations and retains verified byte evidence', async () => {
  const state = await harness({ unsafeReplay: true }); const report = await state.run();
  assert.equal(report.result, 'failed'); assert.equal(report.stop_code, 'UNSAFE_STORAGE_RESPONSE');
  assert.equal(report.checks.at(-1)?.case, 'signed_false_token_cannot_promote_or_replace');
  assert.equal(report.ready_bytes_unchanged, false); assert.equal(state.reservations.size, 1);
  assert.ok(!state.calls.some(call => call.path === '/storage/v1/object/move'));
});

test('filtered empty delete is reported as no effect only after Ready bytes remain verified', async () => {
  const state = await harness({ removeNoop: true }); const report = await state.run();
  assert.equal(report.result, 'passed'); assert.equal(report.ready_bytes_unchanged, true);
  const remove = report.checks.find(check => check.case === 'ready_remove');
  assert.equal(remove?.accepted, true); assert.equal(remove?.no_effect, true); assert.equal(remove?.unsafe_response, false);
});

test('RLS-hidden Ready mutation404 is no effect only while authenticated original bytes remain readable', async () => {
  const state = await harness({ readyMutationStatus: 404 }); const report = await state.run();
  assert.equal(report.result, 'passed'); assert.equal(report.ready_bytes_unchanged, true);
  const mutations = report.checks.filter(check => ['ready_direct_upsert', 'ready_update', 'ready_move', 'ready_remove'].includes(check.case));
  assert.equal(mutations.length, 4);
  for (const check of mutations) {
    assert.equal(check.http_status, 404); assert.equal(check.accepted, false); assert.equal(check.no_effect, true); assert.equal(check.passed, true);
  }
  const missing = await harness({ readyMutationStatus: 404, deleteBeforeMoveDenial: true }); const failed = await missing.run();
  assert.equal(failed.result, 'failed'); assert.equal(failed.stop_code, 'READY_BYTES_CHANGED'); assert.equal(failed.ready_bytes_unchanged, false);
  assert.ok(!failed.checks.some(check => check.case === 'ready_move' && check.passed));
});

test('mint404, generic400 and transport5xx cannot masquerade as expected Storage outcomes', async () => {
  for (const settings of [{ mintDenialStatus: 404 as const }, { readyMutationStatus: 400 as const },
    { readyMutationStatus: 500 as const, readyProviderStatus: 403 }, { freshRead500: true }, { replay500: true }]) {
    const state = await harness(settings); const report = await state.run();
    assert.equal(report.result, 'failed'); assert.equal(report.stop_code, 'CHECK_NOT_ESTABLISHED');
    assert.equal(report.checks.at(-1)?.passed, false); assert.equal(report.checks.at(-1)?.no_effect, false);
    if ('freshRead500' in settings) {
      assert.equal(report.checks.at(-1)?.case, 'fresh_object_absent'); assert.equal(state.completions(), 0);
      assert.equal(report.checks.at(-1)?.http_status, 500); assert.equal(report.checks.at(-1)?.provider_status, 404);
    }
    if ('replay500' in settings) {
      assert.equal(report.checks.at(-1)?.case, 'signed_false_token_cannot_promote_or_replace'); assert.equal(state.completions(), 1);
      assert.equal(report.checks.at(-1)?.http_status, 500); assert.equal(report.checks.at(-1)?.provider_status, 409);
      assert.equal(report.ready_bytes_unchanged, true);
    }
    assert.doesNotMatch(JSON.stringify(report), /synthetic-signed|Bearer|upload_url/);
  }
});

test('denied responses cannot hide byte changes from replay, direct upsert or update attempts', async () => {
  for (const deniedAfterWrite of ['replay', 'upsert', 'update'] as const) {
    const state = await harness({ deniedAfterWrite }); const report = await state.run();
    assert.equal(report.result, 'failed', deniedAfterWrite);
    assert.equal(report.stop_code, 'READY_BYTES_CHANGED', deniedAfterWrite);
    assert.equal(report.ready_bytes_unchanged, false, deniedAfterWrite);
    assert.equal(state.reservations.size, 1, deniedAfterWrite);
    assert.ok(!state.calls.some(call => call.path === '/storage/v1/object/move'));
    assert.doesNotMatch(JSON.stringify(report), /synthetic-signed|Bearer|upload_url/);
  }
});

test('wrong project stops before reserve and private transport failures are redacted', async () => {
  const wrong = await harness({ wrongProject: true });
  await assert.rejects(wrong.run(), error => error instanceof DomainError && error.status === 404);
  assert.equal(wrong.reservations.size, 0);
  const failed = await harness({ transportFailure: true }); const report = await failed.run();
  assert.equal(report.result, 'failed'); assert.equal(report.stop_code, 'PROBE_OPERATION_FAILED');
  assert.equal(report.reservation_cancelled, true); assert.equal(failed.completions(), 0);
  assert.doesNotMatch(JSON.stringify(report), /synthetic-signed|example\.invalid/);
});
