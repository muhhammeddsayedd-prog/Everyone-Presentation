import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { DomainError, type MediaAsset, type UploadCompletion, type Workspace } from '@eps/domain';
import { createBearerUserClient, createRequestServerClient, createCentralStudio, readCentralConfig, centralRpcError, signLogoReceipt, verifyLogoReceipt, type CentralStudioOptions } from '../src/index.ts';
import type { LogoReservation } from '../src/logo-storage.ts';

const principal = '10000000-0000-4000-8000-000000000001';
const projectId = '20000000-0000-4000-8000-000000000001';
const workspaceId = '30000000-0000-4000-8000-000000000001';
const presetId = '40000000-0000-4000-8000-000000000001';
const config = { url: 'https://synthetic-supabase.example.invalid', publishableKey: 'sb_publishable_synthetic-test-public-key' };
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: principal, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.synthetic-test-signature`;
const actor = { principal_id: principal };
const user = { id: principal, aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', email_confirmed_at: '2026-10-28T00:00:00Z', created_at: '2026-10-28T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { role: 'admin', projects: ['forged-universal-access'] }, identities: [], is_anonymous: false };
const project = { id: projectId, name: 'Synthetic central project', client_id: null, client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: workspaceId, can_edit: false };
const workspace = { id: workspaceId, project_id: projectId, module: 'casting', title: project.name, logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: 1, draft_revision: 0, has_unpublished_changes: false, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' };
const preset = { id: presetId, key: 'synthetic-audience', label: 'Synthetic audience', scope: 'external', settings: {}, archived: false, row_version: 1 };
const capabilities = { principal_id: principal, capabilities: ['projects.read', 'workspaces.read'], timezone: 'Africa/Cairo', enabled_modules: ['casting'], upload_policy: { allowed_mime_types: [], maximum_file_bytes: 5 * 1024 * 1024, recommended_batch_size: 200, available_purposes: [] } };
type RecordedRequest = { path: string; body: Record<string, unknown>; headers: Headers; init?: RequestInit };

function fakeService(overrides: { authStatus?: number; user?: typeof user; rpc?: (name: string, input: Record<string, unknown>) => unknown } = {}) {
  const calls: RecordedRequest[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    calls.push({ path, body, headers, init });
    if (path === '/auth/v1/user') return Response.json(overrides.authStatus ? { code: 'bad_jwt', message: 'A private provider diagnostic must not escape.' } : overrides.user ?? user, { status: overrides.authStatus ?? 200 });
    if (path === '/auth/v1/token') return Response.json({ access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'synthetic-test-refresh-token', user });
    if (!path.startsWith('/rest/v1/rpc/eps_')) throw new Error('Unexpected synthetic transport request.');
    const name = path.split('/').at(-1)!;
    if (overrides.rpc) return Response.json(overrides.rpc(name, body));
    const data = name === 'eps_get_capabilities' ? capabilities : name === 'eps_list_projects' ? { data: [project], page: { next_cursor: null } }
      : name === 'eps_list_workspaces' ? { data: [workspace], page: { next_cursor: null } } : name === 'eps_list_audience_presets' ? { data: [preset], page: { next_cursor: null } }
        : name.includes('workspace') ? workspace : name === 'eps_archive_audience_preset' ? { success: true, affected_ids: [presetId] } : name.includes('audience_preset') ? preset : project;
    return Response.json(data);
  };
  return { fetcher, calls };
}
function isCode(code: string, status: number) { return (error: unknown) => error instanceof DomainError && error.code === code && error.status === status; }

test('capabilities report the effective candidate environment bound for HTTP/MCP and browser sessions', async () => {
  const maximumBytes = 50 * 1024 * 1024;
  const service = fakeService({ rpc: () => ({ ...capabilities, capabilities: [...capabilities.capabilities, 'cast.read','cast.upload', 'workspaces.write'], upload_policy: { ...capabilities.upload_policy,
    maximum_file_bytes: 256 * 1024 * 1024, available_purposes: ['candidate_video'] } }) });
  const studio = await createCentralStudio(createBearerUserClient({ ...config, accessToken: token }, { fetch: service.fetcher }),
    { candidate: { storageOrigin: config.url, maximumBytes } });
  const policy = (await studio.getCapabilities(actor)).upload_policy;
  assert.equal(policy.maximum_file_bytes, maximumBytes);
  assert.deepEqual(policy.available_purposes, ['candidate_video']);
});

test('public configuration rejects missing/privileged keys and credential-bearing URLs without exposing values', () => {
  assert.throws(() => readCentralConfig({ SUPABASE_URL: config.url, SUPABASE_SERVER_KEY: 'not-an-accepted-fallback' }), isCode('CENTRAL_CONFIGURATION_REQUIRED', 503));
  for (const publishableKey of ['sb_secret_synthetic-sensitive', 'legacy-service-role-jwt', '']) assert.throws(() => readCentralConfig({ SUPABASE_URL: config.url, SUPABASE_PUBLISHABLE_KEY: publishableKey }), error => isCode('CENTRAL_CONFIGURATION_REQUIRED', 503)(error) && !String(error).includes(publishableKey || 'never-match'));
  assert.throws(() => readCentralConfig({ SUPABASE_URL: 'https://user:private@synthetic.example.invalid', SUPABASE_PUBLISHABLE_KEY: config.publishableKey }), isCode('CENTRAL_CONFIGURATION_REQUIRED', 503));
  assert.equal(readCentralConfig({ SUPABASE_URL: config.url, SUPABASE_PUBLISHABLE_KEY: config.publishableKey }).url, config.url);
});

test('fresh auth verification binds the actor and every curated RPC to the same user token', async () => {
  const service = fakeService();
  const studio = await createCentralStudio(createBearerUserClient({ ...config, accessToken: token }, { fetch: service.fetcher }));
  assert.equal(service.calls[0].path, '/auth/v1/user');
  assert.equal(studio.verifiedIdentity.principal_id, principal);
  assert.deepEqual((await studio.getCapabilities(actor)).capabilities, ['projects.read', 'workspaces.read']);
  assert.equal((await studio.listProjects(actor, { q: ' Synthetic ', limit: 4 })).data[0].can_edit, false);
  await studio.getProject(actor, projectId);
  await studio.updateProject(actor, projectId, { row_version: 1, name: 'Synthetic edit' }, { idempotencyKey: 'synthetic-project-edit', requestId: 'synthetic-correlation', clientType: 'mcp' });
  await studio.listWorkspaces(actor, { project_id: projectId });
  await studio.createWorkspace(actor, { project_id: projectId, initial_output: 'selection' }, { idempotencyKey: 'synthetic-workspace' });
  await studio.getWorkspace(actor, workspaceId);
  await studio.updateWorkspace(actor, workspaceId, { row_version: 1, active_output: 'shortlist' });
  await studio.listAudiencePresets(actor);
  await studio.createAudiencePreset(actor, { label: preset.label, scope: 'external', settings: {} }, { idempotencyKey: 'synthetic-preset' });
  await studio.updateAudiencePreset(actor, presetId, { row_version: 1, label: 'Synthetic edit' });
  await studio.archiveAudiencePreset(actor, presetId, { row_version: 1 }, { idempotencyKey: 'synthetic-archive' });
  const rpcCalls = service.calls.filter(call => call.path.includes('/rpc/'));
  assert.equal(rpcCalls.length, 12);
  for (const call of service.calls) {
    assert.equal(call.headers.get('Authorization'), `Bearer ${token}`);
    assert.equal(call.headers.get('apikey'), config.publishableKey);
    assert.equal(call.init?.cache, 'no-store');
    assert.equal(call.init?.redirect, 'error');
    assert.ok(call.init?.signal);
    assert.ok(!Object.hasOwn(call.body, 'principal_id'));
  }
  assert.deepEqual(rpcCalls.find(call => call.path.endsWith('eps_list_workspaces'))!.body, { p_q: '', p_cursor: null, p_limit: 25, p_project_id: projectId });
  const edit = rpcCalls.find(call => call.path.endsWith('eps_update_project'))!;
  assert.equal(edit.body.p_idempotency_key, 'synthetic-project-edit');
  assert.equal(edit.headers.get('X-EPS-Request-ID'), 'synthetic-correlation');
  assert.equal(edit.headers.get('X-EPS-Client-Type'), 'mcp');
  const count = service.calls.length;
  await assert.rejects(studio.getProject({ principal_id: 'other-principal' }, projectId), isCode('ACCESS_DENIED', 403));
  assert.equal(service.calls.length, count);
  // User-editable metadata claiming admin did not become authority or can_edit.
  assert.equal((await studio.getProject(actor, projectId)).can_edit, false);
});

test('auth rejection and anonymous users cannot produce a central operation client', async () => {
  const rejected = fakeService({ authStatus: 401 });
  await assert.rejects(createCentralStudio(createBearerUserClient({ ...config, accessToken: token }, { fetch: rejected.fetcher })), isCode('AUTH_REQUIRED', 401));
  assert.equal(rejected.calls.length, 1);
  const anonymous = fakeService({ user: { ...user, is_anonymous: true } });
  await assert.rejects(createCentralStudio(createBearerUserClient({ ...config, accessToken: token }, { fetch: anonymous.fetcher })), isCode('AUTH_REQUIRED', 401));
  const privilegedToken = `synthetic.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  assert.throws(() => createBearerUserClient({ ...config, accessToken: privilegedToken }), isCode('PRIVILEGED_TOKEN_FORBIDDEN', 403));
});

test('temporary auth service failure and throttling remain retryable instead of becoming invalid-login errors', async () => {
  for (const [authStatus, expectedStatus, expectedCode] of [[503, 503, 'DEPENDENCY_UNAVAILABLE'], [429, 429, 'AUTH_RATE_LIMITED']] as const) {
    const service = fakeService({ authStatus });
    await assert.rejects(createCentralStudio(createBearerUserClient({ ...config, accessToken: token }, { fetch: service.fetcher })), error => isCode(expectedCode, expectedStatus)(error) && (error as DomainError).retryable);
  }
});

test('strict inputs, malformed/private responses and unwired storage fail before claiming success', async () => {
  const service = fakeService();
  const studio = await createCentralStudio(createBearerUserClient({ ...config, accessToken: token }, { fetch: service.fetcher }));
  await assert.rejects(studio.createWorkspace(actor, { project_id: projectId, initial_output: 'selection' }), isCode('VALIDATION_FAILED', 400));
  await assert.rejects(studio.updateProject(actor, projectId, { row_version: 1, principal_id: 'forged' } as never), isCode('VALIDATION_FAILED', 400));
  await assert.rejects(studio.createUploadSession(actor, { workspace_id: workspaceId, purpose: 'client_logo', filename: 'logo.png', mime_type: 'image/png', size_bytes: 10 }), isCode('FEATURE_NOT_IMPLEMENTED', 503));
  assert.equal(service.calls.length, 1);
  const malformed = fakeService({ rpc: () => ({ ...project, unrelated_private_column: 'must-not-leak' }) });
  const other = await createCentralStudio(createBearerUserClient({ ...config, accessToken: token }, { fetch: malformed.fetcher }));
  await assert.rejects(other.getProject(actor, projectId), error => isCode('CENTRAL_RESPONSE_INVALID', 503)(error) && !String(error).includes('must-not-leak'));
});

test('configured central logo journey verifies actual streamed bytes, updates workspace, replays safely and intersects capabilities', async () => {
  // The real pinned SDK runs against this synthetic HTTP boundary; no hosted calls or SQL proof.
  const png = await sharp({ create: { width: 24, height: 12, channels: 4, background: { r: 30, g: 90, b: 50, alpha: .6 } } }).png().toBuffer();
  const digest = createHash('sha256').update(png).digest('hex');
  const receiptKey = Buffer.alloc(32, 23);
  const bucket = 'eps-brand-assets';
  const calls: RecordedRequest[] = [];
  const reservations = new Map<string, LogoReservation>();
  const uploads = new Map<string, Uint8Array>();
  let advertised: string[] = [];
  let scopeAllowed = true;
  let finalized = 0;
  let downloads = 0;
  let decoded = 0;
  const currentWorkspace: Workspace = { ...workspace, module: 'casting', logo_placement: 'cover', active_output: 'selection' };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {};
    calls.push({ path: url.pathname, body, headers, init });
    if (url.pathname === '/auth/v1/user') return Response.json(user);
    if (url.pathname.startsWith('/storage/v1/object/upload/sign/')) {
      const objectKey = url.pathname.split(`/storage/v1/object/upload/sign/${bucket}/`)[1];
      if (init?.method === 'PUT') { assert.ok(init.body instanceof Uint8Array); uploads.set(objectKey, new Uint8Array(init.body)); return Response.json({ Key: `${bucket}/${objectKey}` }); }
      assert.equal(headers.get('x-upsert'), 'false');
      return Response.json({ url: `/object/upload/sign/${bucket}/${objectKey}?token=synthetic-upload-capability` });
    }
    if (url.pathname.startsWith(`/storage/v1/object/${bucket}/`)) {
      downloads++;
      const bytes = uploads.get(url.pathname.split(`/storage/v1/object/${bucket}/`)[1]);
      return bytes ? new Response(new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } })) : Response.json({ statusCode: '404', message: 'Not uploaded' }, { status: 404 });
    }
    const name = url.pathname.split('/').at(-1);
    if (name === 'eps_get_capabilities') return Response.json({ ...capabilities, upload_policy: { ...capabilities.upload_policy, available_purposes: advertised } });
    if (!scopeAllowed) return Response.json({ code: 'P0001', message: 'CAPABILITY_REQUIRED', details: '{"status":403,"private":"must-not-leak"}' }, { status: 400 });
    if (name === 'eps_reserve_logo_upload') {
      const ordinal = reservations.size + 1;
      const id = `50000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`;
      const assetId = `60000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`;
      const asset: MediaAsset = { id: assetId, purpose: 'client_logo', filename: 'synthetic-logo.png', mime_type: 'image/png', size_bytes: png.length, sha256: null, status: 'uploading', duration_ms: null, width: null, height: null, source_asset_id: null, source_timestamp_ms: null, created_at: new Date().toISOString() };
      const reserved: LogoReservation = { upload_id: id, asset, principal_id: principal, workspace_id: workspaceId, reservation_revision: 1, verification_id: '70000000-0000-4000-8000-000000000001', bucket, object_key: `assets/${assetId}/original.png`, expected_size_bytes: png.length, expected_mime_type: 'image/png', expected_sha256: digest, expires_at: new Date(Date.now() + 7_200_000).toISOString(), status: 'open' };
      reservations.set(id, reserved); return Response.json(reserved);
    }
    if (name === 'eps_update_workspace') {
      const patch = body.p_input as { row_version: number; logo_asset_id: string | null };
      if (patch.logo_asset_id !== null) assert.ok([...reservations.values()].some(item => item.asset.id === patch.logo_asset_id && item.asset.status === 'ready'));
      currentWorkspace.logo_asset_id = patch.logo_asset_id; currentWorkspace.row_version++;
      return Response.json(currentWorkspace);
    }
    if (name === 'eps_get_logo_media') {
      const item = [...reservations.values()].find(item => item.asset.id === body.p_asset_id)!;
      return Response.json({ asset: item.asset, bucket: item.bucket, object_key: item.object_key });
    }
    const reserved = reservations.get(String(body.p_upload_id))!;
    if (name === 'eps_get_logo_upload') return Response.json(reserved);
    const complete = (): UploadCompletion => ({ asset: reserved.asset, processing_job_id: null, status: 'ready' });
    if (name === 'eps_prepare_logo_completion') return Response.json({ reservation: reserved, replay: reserved.status === 'completed' ? complete() : null });
    if (name === 'eps_finalize_logo_completion') {
      const claims = verifyLogoReceipt({ payload: String(body.p_payload), mac: String(body.p_mac) }, receiptKey, { key_id: 'synthetic-logo-key', verification_id: reserved.verification_id, upload_id: reserved.upload_id, asset_id: reserved.asset.id, principal_id: principal, workspace_id: workspaceId, reservation_revision: 1, bucket, object_key: reserved.object_key, size_bytes: png.length, mime_type: 'image/png', sha256: digest });
      finalized++; reserved.status = 'completed'; reserved.asset = { ...reserved.asset, status: 'ready', sha256: claims.sha256, width: claims.width, height: claims.height };
      return Response.json(complete());
    }
    if (name === 'eps_cancel_logo_upload') { reserved.status = 'cancelled'; return Response.json({ success: true, affected_ids: [reserved.upload_id, reserved.asset.id] }); }
    throw new Error('Unexpected synthetic central logo request.');
  };
  const client = createBearerUserClient({ ...config, accessToken: token }, { fetch: fetcher });
  const logo: NonNullable<CentralStudioOptions['logo']> = { storageOrigin: config.url, brandBucket: bucket,
    async decodeLogo(bytes) { decoded++; const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'warning' }); const meta = await image.metadata(); await image.raw().toBuffer(); return { mimeType: 'image/png', width: meta.width!, height: meta.height! }; },
    signReceipt(facts) { const now = Math.floor(Date.now() / 1000); return signLogoReceipt({ ...facts, schema_version: '1.0', audience: 'eps.logo-verification.v1', purpose: 'client_logo', key_id: 'synthetic-logo-key', issued_at: now, expires_at: now + 90 }, receiptKey); },
  };
  const studio = await createCentralStudio(client, { logo });
  assert.deepEqual((await studio.getCapabilities(actor)).upload_policy.available_purposes, []);
  advertised = ['client_logo', 'specs'];
  assert.deepEqual((await studio.getCapabilities(actor)).upload_policy.available_purposes, ['client_logo']);
  const unavailable = await createCentralStudio(client);
  assert.deepEqual((await unavailable.getCapabilities(actor)).upload_policy.available_purposes, []);
  const context = { idempotencyKey: 'synthetic-logo-journey', requestId: 'synthetic.logo:integration', clientType: 'mcp' as const };
  const session = await studio.createUploadSession(actor, { workspace_id: workspaceId, purpose: 'client_logo', filename: 'synthetic-logo.png', mime_type: 'image/png', size_bytes: png.length, sha256: digest }, context);
  assert.equal((await studio.getUploadSession(actor, session.id)).status, 'open');
  await fetcher(session.upload_url!, { method: 'PUT', headers: session.upload_headers, body: new Uint8Array(png) });
  const completeInput = { actual_size_bytes: png.length, start_processing: false, sha256: digest };
  const completed = await studio.completeUpload(actor, session.id, completeInput, context);
  assert.equal(completed.asset.sha256, digest); assert.equal(completed.asset.width, 24); assert.equal(completed.asset.height, 12);
  const attached = await studio.updateWorkspace(actor, workspaceId, { row_version: 1, logo_asset_id: completed.asset.id }, { ...context, idempotencyKey: 'synthetic-attach-logo' });
  assert.equal(attached.logo_asset_id, completed.asset.id);
  assert.deepEqual(await studio.getMedia(actor, completed.asset.id), completed.asset);
  assert.deepEqual((await studio.getMediaContent(actor, completed.asset.id)).bytes, png);
  assert.deepEqual(await studio.completeUpload(actor, session.id, completeInput, context), completed);
  assert.equal(finalized, 1); assert.equal(decoded, 1); assert.equal(downloads, 2);
  const closed = await studio.getUploadSession(actor, session.id);
  assert.equal(closed.upload_url, null); assert.deepEqual(closed.upload_headers, {});
  const removed = await studio.updateWorkspace(actor, workspaceId, { row_version: attached.row_version, logo_asset_id: null }, { ...context, idempotencyKey: 'synthetic-remove-logo' });
  assert.equal(removed.logo_asset_id, null);
  const second = await studio.createUploadSession(actor, { workspace_id: workspaceId, purpose: 'client_logo', filename: 'synthetic-logo.png', mime_type: 'image/png', size_bytes: png.length }, { ...context, idempotencyKey: 'synthetic-logo-cancel' });
  assert.equal((await studio.cancelUpload(actor, second.id, context)).success, true);
  assert.equal((await studio.getUploadSession(actor, second.id)).upload_url, null);
  await assert.rejects(studio.storeUploadedLogo(actor, session.id, png), isCode('FEATURE_NOT_IMPLEMENTED', 503));
  scopeAllowed = false;
  await assert.rejects(studio.completeUpload(actor, session.id, completeInput, context), error => isCode('CAPABILITY_REQUIRED', 403)(error) && !String(error).includes('must-not-leak'));
  assert.equal(downloads, 2);
  const mutations = calls.filter(call => /eps_(reserve_logo_upload|prepare_logo_completion|finalize_logo_completion|cancel_logo_upload)$/u.test(call.path));
  for (const call of mutations) {
    assert.equal(call.headers.get('Authorization'), `Bearer ${token}`); assert.equal(call.headers.get('X-EPS-Client-Type'), 'mcp'); assert.equal(call.headers.get('X-EPS-Request-ID'), context.requestId);
    assert.ok(!Object.hasOwn(call.body, 'principal_id'));
  }
  assert.doesNotMatch(JSON.stringify(completed), /synthetic-upload-capability|synthetic-logo-key|payload|\bmac\b/);
});

test('read-only logo configuration preserves Ready reads, reuse, cancel and completed replay without enabling uploads', async () => {
  // Actual SDK with a synthetic HTTP boundary; no hosted Storage or SQL claim.
  const png = await sharp({ create: { width: 8, height: 4, channels: 4, background: { r: 50, g: 80, b: 20, alpha: .5 } } }).png().toBuffer();
  const digest = createHash('sha256').update(png).digest('hex');
  const assetId = '60000000-0000-4000-8000-000000000011';
  const openAssetId = '60000000-0000-4000-8000-000000000012';
  const uploadId = '50000000-0000-4000-8000-000000000011';
  const openUploadId = '50000000-0000-4000-8000-000000000012';
  const bucket = 'eps-brand-assets';
  const asset: MediaAsset = { id: assetId, purpose: 'client_logo', filename: 'synthetic-ready.png', mime_type: 'image/png', size_bytes: png.length,
    sha256: digest, status: 'ready', duration_ms: null, width: 8, height: 4, source_asset_id: null, source_timestamp_ms: null, created_at: new Date().toISOString() };
  const completed: LogoReservation = { upload_id: uploadId, asset, principal_id: principal, workspace_id: workspaceId, reservation_revision: 1,
    verification_id: '70000000-0000-4000-8000-000000000011', bucket, object_key: `assets/${assetId}/original.png`, expected_size_bytes: png.length,
    expected_mime_type: 'image/png', expected_sha256: digest, expires_at: new Date(Date.now() + 7_200_000).toISOString(), status: 'completed' };
  const open: LogoReservation = { ...completed, upload_id: openUploadId, asset: { ...asset, id: openAssetId, status: 'uploading', sha256: null, width: null, height: null },
    verification_id: '70000000-0000-4000-8000-000000000012', object_key: `assets/${openAssetId}/original.png`, status: 'open' };
  const calls: RecordedRequest[] = [];
  const currentWorkspace: Workspace = { ...workspace, module: 'casting', logo_placement: 'cover', active_output: 'selection' };
  let storageBytes = png; let scopeAllowed = true; let downloads = 0; let minted = 0; let reserved = 0; let finalized = 0; let decoded = 0; let signed = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {};
    calls.push({ path: url.pathname, body, headers, init });
    if (url.pathname === '/auth/v1/user') return Response.json(user);
    if (url.pathname.startsWith('/storage/v1/object/upload/sign/')) { minted++; throw new Error('Read-only configuration must not mint transfer authority.'); }
    if (url.pathname.startsWith(`/storage/v1/object/${bucket}/`)) {
      downloads++; return new Response(new ReadableStream({ start(controller) { controller.enqueue(storageBytes); controller.close(); } }));
    }
    const name = url.pathname.split('/').at(-1);
    if (name === 'eps_get_capabilities') return Response.json({ ...capabilities, upload_policy: { ...capabilities.upload_policy, available_purposes: ['client_logo'] } });
    if (!scopeAllowed) return Response.json({ code: 'P0001', message: 'RESOURCE_NOT_FOUND', details: '{"status":404}' }, { status: 400 });
    if (name === 'eps_reserve_logo_upload') { reserved++; throw new Error('Read-only configuration must fail before reserving an upload.'); }
    if (name === 'eps_finalize_logo_completion') { finalized++; throw new Error('Read-only configuration must not finalize unverified bytes.'); }
    if (name === 'eps_get_logo_media') return Response.json({ asset, bucket, object_key: completed.object_key });
    if (name === 'eps_update_workspace') {
      assert.equal((body.p_input as { logo_asset_id: string }).logo_asset_id, assetId);
      currentWorkspace.logo_asset_id = assetId; currentWorkspace.row_version++; return Response.json(currentWorkspace);
    }
    const item = body.p_upload_id === uploadId ? completed : open;
    if (name === 'eps_get_logo_upload') return Response.json(item);
    if (name === 'eps_prepare_logo_completion') return Response.json({ reservation: item, replay: item.status === 'completed' ? { asset, processing_job_id: null, status: 'ready' } : null });
    if (name === 'eps_cancel_logo_upload') { item.status = 'cancelled'; return Response.json({ success: true, affected_ids: [item.upload_id, item.asset.id] }); }
    throw new Error('Unexpected read-only logo request.');
  };
  const read = { storageOrigin: config.url, brandBucket: bucket };
  const modes: CentralStudioOptions[] = [
    { logoRead: read },
    { logo: { ...read, async decodeLogo() { decoded++; throw new Error('No signer configured.'); } } },
    { logo: { ...read, signReceipt() { signed++; throw new Error('No decoder configured.'); } } },
  ];
  const completeInput = { actual_size_bytes: png.length, start_processing: false, sha256: digest };
  let lastStudio: Awaited<ReturnType<typeof createCentralStudio>> | undefined;
  for (const options of modes) {
    open.status = 'open';
    const studio = await createCentralStudio(createBearerUserClient({ ...config, accessToken: token }, { fetch: fetcher }), options);
    lastStudio = studio;
    assert.deepEqual((await studio.getCapabilities(actor)).upload_policy.available_purposes, []);
    assert.deepEqual(await studio.getMedia(actor, assetId), asset);
    assert.deepEqual((await studio.getMediaContent(actor, assetId)).bytes, png);
    const changed = Buffer.from(png); changed[0] ^= 1; storageBytes = changed;
    await assert.rejects(studio.getMediaContent(actor, assetId), isCode('SOURCE_UNREADABLE', 422));
    storageBytes = png;
    assert.equal((await studio.updateWorkspace(actor, workspaceId, { row_version: currentWorkspace.row_version, logo_asset_id: assetId })).logo_asset_id, assetId);
    assert.deepEqual(await studio.completeUpload(actor, uploadId, completeInput, { idempotencyKey: 'synthetic-readonly-replay' }), { asset, processing_job_id: null, status: 'ready' });
    const closed = await studio.getUploadSession(actor, uploadId);
    assert.equal(closed.upload_url, null); assert.deepEqual(closed.upload_headers, {});
    await assert.rejects(studio.createUploadSession(actor, { workspace_id: workspaceId, purpose: 'client_logo', filename: 'new.png', mime_type: 'image/png', size_bytes: png.length }, { idempotencyKey: 'synthetic-readonly-create' }), isCode('LOGO_STORAGE_CONFIGURATION_REQUIRED', 503));
    await assert.rejects(studio.getUploadSession(actor, openUploadId), isCode('LOGO_STORAGE_CONFIGURATION_REQUIRED', 503));
    const beforeCompletion = downloads;
    await assert.rejects(studio.completeUpload(actor, openUploadId, completeInput, { idempotencyKey: 'synthetic-readonly-open' }), isCode('LOGO_STORAGE_CONFIGURATION_REQUIRED', 503));
    assert.equal(downloads, beforeCompletion);
    assert.equal((await studio.cancelUpload(actor, openUploadId, { idempotencyKey: 'synthetic-readonly-cancel' })).success, true);
    assert.equal((await studio.getUploadSession(actor, openUploadId)).upload_url, null);
  }
  assert.equal(minted, 0); assert.equal(reserved, 0); assert.equal(finalized, 0); assert.equal(decoded, 0); assert.equal(signed, 0);
  scopeAllowed = false;
  await assert.rejects(lastStudio!.getMedia(actor, assetId), isCode('RESOURCE_NOT_FOUND', 404));
  await assert.rejects(lastStudio!.completeUpload(actor, uploadId, completeInput, { idempotencyKey: 'synthetic-readonly-revoked' }), isCode('RESOURCE_NOT_FOUND', 404));
  assert.equal(downloads, 6);
  for (const call of calls) assert.equal(call.headers.get('Authorization'), `Bearer ${token}`);
});

test('known database errors keep typed status and safe revision while raw SQL diagnostics stay private', () => {
  const stale = centralRpcError({ code: 'P0001', message: 'STALE_RESOURCE_VERSION', details: JSON.stringify({ status: 409, message: 'private raw detail', current_row_version: 4, token: 'must-not-leak' }) });
  assert.equal(stale.status, 409); assert.equal(stale.code, 'STALE_RESOURCE_VERSION');
  assert.deepEqual(stale.details, { current_row_version: 4 });
  assert.doesNotMatch(JSON.stringify(stale), /private raw|must-not-leak/);
  for (const code of ['INVALID_REQUEST', 'IDEMPOTENCY_WINDOW_EXPIRED', 'CAPABILITY_REQUIRED']) assert.notEqual(centralRpcError({ code: 'P0001', message: code, details: '{}' }).status, 503);
  const unknown = centralRpcError({ code: 'P0001', message: 'private-function-name', details: 'private db path' });
  assert.equal(unknown.status, 503); assert.doesNotMatch(JSON.stringify(unknown), /private-function|private db/);
  for (const prototypeName of ['toString', 'constructor', '__proto__']) {
    const result = centralRpcError({ code: 'P0001', message: prototypeName, details: '{}' });
    assert.equal(result.status, 503);
    assert.equal(result.code, 'DEPENDENCY_UNAVAILABLE');
  }
});

test('SSR request factory forwards auth cookies together with required private cache headers', async () => {
  const service = fakeService();
  const cookieNames: string[] = [];
  const responseHeaders: Record<string, string> = {};
  const client = createRequestServerClient({ ...config, cookies: { getAll: () => [], setAll: (cookies, headers) => {
    cookieNames.push(...cookies.map(cookie => cookie.name)); Object.assign(responseHeaders, headers);
    for (const cookie of cookies) { assert.equal(cookie.options.httpOnly, true); assert.equal(cookie.options.sameSite, 'lax'); }
  } } }, { fetch: service.fetcher });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: 'synthetic-test-password' });
  assert.equal(error, null);
  assert.ok(cookieNames.length > 0);
  assert.match(responseHeaders['Cache-Control'], /private/);
  assert.match(responseHeaders['Cache-Control'], /no-store/);
  assert.equal(responseHeaders.Expires, '0');
  assert.equal(responseHeaders.Pragma, 'no-cache');
});
