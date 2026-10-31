import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeJwt, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createBearerUserClient, createCentralStudio } from '@eps/central';
import { createCentralJobs } from '../../packages/central/src/jobs.ts';
import { createMcpHttpHandler } from '../../apps/web/lib/mcp-http.ts';
import { createMcpCentralSessionCheck } from '../../apps/web/lib/mcp-central-session.ts';
import { readMcpAuthConfig, type McpOAuthConfig } from '../../apps/web/lib/mcp-auth-config.ts';
import { handleJobRequest } from '../../apps/web/lib/job-http.ts';
import type { McpServices } from '../../apps/web/lib/mcp.ts';

/** All remote boundaries below are synthetic. The real JWT/session/HTTP/MCP and
 * Central adapters execute; the RPC ledger models its documented contract and
 * is not evidence that SQL idempotency, provider refresh or live jobs passed. */
const origin = 'https://studio.lifecycle.synthetic.invalid', resource = `${origin}/mcp`;
const central = { url: 'https://central.lifecycle.synthetic.invalid', publishableKey: 'sb_publishable_synthetic_lifecycle' };
const issuer = `${central.url}/auth/v1`, runtime = { baseUrl: origin, adapterMode: 'supabase', environment: 'test' };
const first = 'a7100000-0000-4000-8000-000000000001', second = 'a7100000-0000-4000-8000-000000000002';
const clientId = 'a7200000-0000-4000-8000-000000000001';
const projectIds: Record<string, string> = { [first]: 'a7300000-0000-4000-8000-000000000001', [second]: 'a7300000-0000-4000-8000-000000000002' };
const sessionIds: Record<string, string> = { [first]: 'a7400000-0000-4000-8000-000000000001', [second]: 'a7400000-0000-4000-8000-000000000002' };
const jobId = 'a7500000-0000-4000-8000-000000000001', exportId = 'a7600000-0000-4000-8000-000000000001';
const fullCapabilities = ['projects.read', 'projects.write', 'workspaces.read', 'operations.read', 'operations.retry'];
const config = readMcpAuthConfig({ MCP_AUTH_MODE: 'oauth', MCP_RESOURCE_URL: resource, MCP_AUTH_ISSUER: issuer,
  MCP_AUTH_CLIENT_IDS: clientId }, runtime, central.url) as McpOAuthConfig;
const signing = generateKeyPair('ES256').then(async pair => ({ ...pair, jwk: { ...await exportJWK(pair.publicKey), kid: 'lifecycle-synthetic', alg: 'ES256', use: 'sig' } }));
async function credential(principal: string, capabilities = fullCapabilities) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: principal, iss: issuer, aud: resource, role: 'authenticated', is_anonymous: false,
    exp: now + 300, iat: now, scope: 'openid', session_id: sessionIds[principal], client_id: clientId,
    eps_delegation: { v: 1, resource, client_id: clientId, capabilities } })
    .setProtectedHeader({ alg: 'ES256', kid: 'lifecycle-synthetic' }).sign((await signing).privateKey);
}
const project = (principal: string) => ({ id: projectIds[principal], name: 'Synthetic lifecycle project', client_id: null, client_name: null,
  client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: null, can_edit: true });
type Project = ReturnType<typeof project>;
type RpcCall = { operation: string; principal: string; session: string; body: Record<string, unknown>; clientType: string | null; requestId: string | null };
const rpcFailure = (code: string) => Response.json({ code: 'P0001', message: code,
  details: JSON.stringify({ private: 'synthetic-private-rpc-detail' }) }, { status: code === 'ACCESS_DENIED' ? 403 : 409 });
function errorCode(result: unknown) { return (result as { structuredContent: { error: { code: string } } }).structuredContent.error.code; }
function data<T>(result: unknown) { return (result as { structuredContent: { data: T } }).structuredContent.data; }

async function harness() {
  const projects = new Map([first, second].map(id => [id, project(id)]));
  const grants = new Map([first, second].map(id => [id, [...fullCapabilities]]));
  const active = new Map([[first, true], [second, true]]), resourceAllowed = new Map([[first, true], [second, true]]);
  const ledger = new Map<string, { input: string; result: Project | null }>();
  const calls: RpcCall[] = [], contexts: { principal: string; session: string }[] = [];
  let projectTransitions = 0, retryTransitions = 0;
  let job = { id: jobId, workspace_id: 'synthetic-workspace', kind: 'presentation_export', status: 'queued', stage: 'render_export', attempt: 2,
    progress_completed: 0, progress_total: null as number | null, batch_id: null, input_asset_id: null, resource_id: exportId, error: null,
    created_at: '2026-10-31T00:00:00Z', updated_at: '2026-10-31T01:00:00Z', row_version: 10, can_retry: false, can_cancel: true };
  const capabilities = (principal: string) => ({ principal_id: principal, capabilities: grants.get(principal)!, timezone: 'Africa/Cairo', enabled_modules: ['casting'],
    upload_policy: { allowed_mime_types: [], maximum_file_bytes: 5242880, recommended_batch_size: 200, available_purposes: [] } });
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input)), headers = new Headers(init?.headers);
    if (url.href === config.jwksUrl) { assert.equal(headers.has('authorization'), false); return Response.json({ keys: [(await signing).jwk] }); }
    assert.equal(url.origin, central.url, 'Every synthetic Central request stays inside the intercepted origin.');
    const authorization = headers.get('authorization'); assert(authorization !== null && authorization.startsWith('Bearer '));
    const jwt = decodeJwt(authorization.slice(7)), principal = jwt.sub!;
    assert(projects.has(principal)); assert.equal(jwt.session_id, sessionIds[principal]); assert.equal(jwt.client_id, clientId);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, aud: resource, role: 'authenticated', is_anonymous: false });
    const operation = url.pathname.replace('/rest/v1/rpc/', ''), body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({ operation, principal, session: jwt.session_id as string, body, clientType: headers.get('x-eps-client-type'), requestId: headers.get('x-eps-request-id') });
    if (operation === 'eps_validate_own_oauth_session') {
      assert.deepEqual(body, { p_resource: resource }); assert(init?.signal);
      return Response.json({ active: active.get(principal), principal_id: active.get(principal) ? principal : null,
        session_id: active.get(principal) ? sessionIds[principal] : null, client_id: active.get(principal) ? clientId : null,
        capabilities: active.get(principal) ? grants.get(principal) : [] });
    }
    if (operation === 'eps_get_capabilities') return Response.json(capabilities(principal));
    if (operation === 'eps_get_project') {
      if (!resourceAllowed.get(principal) || body.p_project_id !== projectIds[principal]) return rpcFailure('ACCESS_DENIED');
      return Response.json(projects.get(principal));
    }
    assert(['eps_update_project', 'eps_retry_job'].includes(operation), 'No unimplemented synthetic RPC is silently accepted.');
    const required = operation === 'eps_update_project' ? 'projects.write' : 'operations.retry';
    if (!grants.get(principal)!.includes(required) || !resourceAllowed.get(principal)) return rpcFailure('ACCESS_DENIED');
    const key = `${principal}/${operation}/${String(body.p_idempotency_key)}`, serialized = JSON.stringify(body), prior = ledger.get(key);
    if (prior && prior.input !== serialized) return rpcFailure('IDEMPOTENCY_KEY_REUSED');
    if (operation === 'eps_update_project') {
      assert.equal(body.p_project_id, projectIds[principal]);
      if (prior) return Response.json(prior.result);
      const mutation = body.p_input as { row_version: number; name: string }, current = projects.get(principal)!;
      if (mutation.row_version !== current.row_version) return rpcFailure('STALE_RESOURCE_VERSION');
      const saved = { ...current, name: mutation.name, row_version: current.row_version + 1 };
      projects.set(principal, saved); projectTransitions++; ledger.set(key, { input: serialized, result: saved }); return Response.json(saved);
    }
    assert.equal(body.p_job_id, jobId);
    if (!prior) { retryTransitions++; ledger.set(key, { input: serialized, result: null }); }
    return Response.json(job);
  };
  const checkSession = createMcpCentralSessionCheck(central, resource, { fetch: fetcher });
  const services = async (token: string) => {
    const client = createBearerUserClient({ ...central, accessToken: token }, { fetch: fetcher });
    return { studio: await createCentralStudio(client), jobs: await createCentralJobs(client) } as unknown as McpServices;
  };
  const handle = createMcpHttpHandler({ config, runtime, fetch: fetcher, checkSession,
    localContext: async () => { throw new Error('Signed OAuth cannot fall back to a browser or fixture actor.'); },
    oauthContext: async (request, identity) => { contexts.push({ principal: identity.principalId, session: identity.sessionId });
      return services(request.headers.get('authorization')!.slice(7)); } });
  const connect = async (principal = first, modern = true) => {
    let bearer = await credential(principal), loseNextMutationAck = false;
    const http: { status: number; request: unknown; protocolVersion: string | null }[] = [];
    const client = new Client({ name: 'synthetic-delegated-lifecycle', version: '1.0.0' }, { supportedProtocolVersions: [modern ? '2026-07-28' : '2025-11-25'],
      versionNegotiation: { mode: modern ? { pin: '2026-07-28' } : 'legacy' } });
    const transport = new StreamableHTTPClientTransport(new URL(resource), { fetch: async (input, init) => {
      const incoming = new Request(input, init), headers = new Headers(incoming.headers); headers.set('host', new URL(origin).host); headers.set('authorization', `Bearer ${bearer}`);
      let body: unknown; try { body = await incoming.clone().json(); } catch { /* Discovery may have no JSON body. */ }
      const response = await handle(new Request(incoming, { headers }));
      assert.equal(response.headers.has('mcp-session-id'), false); assert.match(response.headers.get('cache-control')!, /no-store/u);
      http.push({ status: response.status, request: body, protocolVersion: headers.get('mcp-protocol-version') });
      if (loseNextMutationAck && (body as { params?: { name?: string } })?.params?.name === 'update_project') {
        loseNextMutationAck = false; await response.text(); throw new TypeError('Synthetic acknowledgement loss after completed mutation.');
      }
      return response;
    } });
    await client.connect(transport);
    return { client, http, dropNextMutationAck() { loseNextMutationAck = true; }, async narrow(capabilities: string[]) { bearer = await credential(principal, capabilities); },
      async close() { await client.close(); } };
  };
  return { connect, calls, contexts, projects, grants, active, resourceAllowed, services,
    projectTransitions: () => projectTransitions, retryTransitions: () => retryTransitions,
    finishRetry() { job = { ...job, status: 'succeeded', progress_completed: 1, progress_total: 1, row_version: 11, can_cancel: false }; } };
}

test('signed HTTP lost mutation acknowledgement replays the same principal/intent through actual Central adapters', async () => {
  const h = await harness(), c = await h.connect();
  const args = { project_id: projectIds[first], body: { row_version: 1, name: 'Synthetic saved revision' }, idempotency_key: 'lifecycle-project-intent' };
  try {
    c.dropNextMutationAck(); await assert.rejects(c.client.callTool({ name: 'update_project', arguments: args }));
    assert.equal(h.projectTransitions(), 1);
    const result = await c.client.callTool({ name: 'update_project', arguments: args });
    assert.equal(result.isError, undefined); assert.equal(data<Project>(result).row_version, 2); assert.equal(h.projectTransitions(), 1);
    const mutations = h.calls.filter(call => call.operation === 'eps_update_project'); assert.equal(mutations.length, 2);
    assert.deepEqual(mutations[0].body, mutations[1].body); assert(mutations.every(call => call.principal === first && call.session === sessionIds[first] && call.clientType === 'mcp'));
    assert(mutations.every(call => /^[a-f0-9-]{36}$/u.test(call.requestId!))); assert.notEqual(mutations[0].requestId, mutations[1].requestId);
    const changed = await c.client.callTool({ name: 'update_project', arguments: { ...args, body: { ...args.body, name: 'Changed intent' } } });
    assert.equal(changed.isError, true); assert.equal(errorCode(changed), 'IDEMPOTENCY_KEY_REUSED'); assert.equal(h.projectTransitions(), 1);
    assert.doesNotMatch(JSON.stringify(changed), /synthetic-private-rpc-detail/u);
  } finally { await c.close(); }
});

test('saved mutation replay never bypasses freshly removed capability, current resource denial or revoked session', async () => {
  const h = await harness(), c = await h.connect();
  const args = { project_id: projectIds[first], body: { row_version: 1, name: 'Saved before revocation' }, idempotency_key: 'lifecycle-revoked-intent' };
  try {
    assert.equal((await c.client.callTool({ name: 'update_project', arguments: args })).isError, undefined);
    h.grants.set(first, fullCapabilities.filter(value => value !== 'projects.write'));
    assert(!(await c.client.listTools()).tools.some(tool => tool.name === 'update_project'));
    const denied = await c.client.callTool({ name: 'update_project', arguments: args });
    assert.equal(errorCode(denied), 'CAPABILITY_REQUIRED'); assert.equal(h.calls.filter(call => call.operation === 'eps_update_project').length, 1);
    h.grants.set(first, [...fullCapabilities]); h.resourceAllowed.set(first, false);
    const resourceDenied = await c.client.callTool({ name: 'update_project', arguments: args });
    assert.equal(errorCode(resourceDenied), 'ACCESS_DENIED'); assert.doesNotMatch(JSON.stringify(resourceDenied), /synthetic-private-rpc-detail/u);
    assert.equal(h.projectTransitions(), 1);
    const contextsBefore = h.contexts.length; h.active.set(first, false);
    await assert.rejects(c.client.callTool({ name: 'update_project', arguments: args }));
    assert.equal(c.http.at(-1)!.status, 401); assert.equal(h.contexts.length, contextsBefore); assert.equal(h.projectTransitions(), 1);
  } finally { await c.close(); }
});

test('new narrower signed credentials reduce tools and reject replay without treating them as provider refresh evidence', async () => {
  const h = await harness(), c = await h.connect();
  const args = { project_id: projectIds[first], body: { row_version: 1, name: 'Saved under original delegation' }, idempotency_key: 'lifecycle-narrow-intent' };
  try {
    assert.equal((await c.client.callTool({ name: 'update_project', arguments: args })).isError, undefined);
    await c.narrow(fullCapabilities.filter(value => value !== 'projects.write'));
    assert(!(await c.client.listTools()).tools.some(tool => tool.name === 'update_project'));
    assert.equal(errorCode(await c.client.callTool({ name: 'update_project', arguments: args })), 'CAPABILITY_REQUIRED');
    assert.equal(h.calls.filter(call => call.operation === 'eps_update_project').length, 1); assert.equal(h.projectTransitions(), 1);
    assert(h.grants.get(first)!.includes('projects.write'));
  } finally { await c.close(); }
});

test('signed MCP retry and the actual HTTP mapping preserve 202 acknowledgements and one synthetic retry transition across finished replay', async () => {
  const h = await harness(), c = await h.connect();
  const args = { job_id: jobId, body: { row_version: 9 }, idempotency_key: 'lifecycle-retry-intent' };
  const expected = (status: string) => ({ job_id: jobId, resource_id: exportId, poll_url: `/api/v1/jobs/${jobId}`, status });
  try {
    const initial = await c.client.callTool({ name: 'retry_job', arguments: args }); assert.equal(initial.isError, undefined); assert.deepEqual(data(initial), expected('queued'));
    h.finishRetry();
    const repeated = await c.client.callTool({ name: 'retry_job', arguments: args }); assert.equal(repeated.isError, undefined); assert.deepEqual(data(repeated), expected('succeeded'));
    // This verifies the real thin HTTP mapping, not an additional API auth flow.
    const services = await h.services(await credential(first));
    const request = new Request(`${origin}/api/v1/jobs/${jobId}/retry`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args.body) });
    const response = await handleJobRequest(request, ['jobs', jobId, 'retry'], { principal_id: first }, services.jobs,
      { requestId: 'synthetic-http-retry', clientType: 'api', idempotencyKey: args.idempotency_key });
    assert.equal(response.status, 202); assert.match(response.headers.get('cache-control')!, /no-store/u);
    assert.deepEqual((await response.json()).data, expected('succeeded')); assert.equal(h.retryTransitions(), 1);
    const retries = h.calls.filter(call => call.operation === 'eps_retry_job'); assert.equal(retries.length, 3);
    assert(retries.every(call => call.principal === first && call.body.p_idempotency_key === args.idempotency_key));
    assert.deepEqual(retries.map(call => call.clientType), ['mcp', 'mcp', 'api']);
    h.grants.set(first, fullCapabilities.filter(value => value !== 'operations.retry'));
    assert.equal(errorCode(await c.client.callTool({ name: 'retry_job', arguments: args })), 'CAPABILITY_REQUIRED');
    assert.equal(h.calls.filter(call => call.operation === 'eps_retry_job').length, 3); assert.equal(h.retryTransitions(), 1);
  } finally { await c.close(); }
});

test('concurrent modern and legacy signed clients retain distinct identities, sessions and mutations even with the same intent key', async () => {
  const h = await harness(), [a, b] = await Promise.all([h.connect(first, true), h.connect(second, false)]);
  try {
    const connections = [[first, a], [second, b]] as const;
    const results = await Promise.all(connections.map(async ([id, c]) => {
      const result = await c.client.callTool({ name: 'update_project', arguments: { project_id: projectIds[id], body: { row_version: 1, name: `Synthetic ${id}` }, idempotency_key: 'same-cross-principal-intent' } });
      assert.equal(result.isError, undefined); return data<Project>(result);
    }));
    assert.deepEqual(results.map(value => value.id), [projectIds[first], projectIds[second]]); assert.equal(h.projectTransitions(), 2);
    const reads = await Promise.all(connections.map(async ([id, c]) => data<Project>(await c.client.callTool({ name: 'get_project', arguments: { project_id: projectIds[id] } }))));
    assert.deepEqual(reads, results);
    assert(a.http.some(exchange => exchange.protocolVersion === '2026-07-28'));
    assert(b.http.some(exchange => exchange.protocolVersion === '2025-11-25'));
    for (const principal of [first, second]) {
      assert(h.contexts.some(value => value.principal === principal && value.session === sessionIds[principal]));
      const writes = h.calls.filter(call => call.operation === 'eps_update_project' && call.principal === principal);
      assert.equal(writes.length, 1); assert.equal(writes[0].session, sessionIds[principal]); assert.equal(writes[0].body.p_project_id, projectIds[principal]);
    }
  } finally { await Promise.all([a.close(), b.close()]); }
});
