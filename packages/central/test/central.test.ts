import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '@eps/domain';
import { createBearerUserClient, createRequestServerClient, createCentralStudio, readCentralConfig, centralRpcError } from '../src/index.ts';

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
