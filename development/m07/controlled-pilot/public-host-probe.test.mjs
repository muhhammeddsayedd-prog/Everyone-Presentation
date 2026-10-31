import assert from 'node:assert/strict';
import test from 'node:test';
import { URL } from 'node:url';
import { probePublicHost, validateConfiguredTarget, HOST_ORIGIN } from './public-host-probe.mjs';
const { Response, Headers } = globalThis;

// Synthetic responses exercise only the probe; no request reaches a provider.
const requestId = 'ab100000-0000-4000-8000-000000000001';
function configured() {
  return { project: { id: 'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0', account_id: 'team_gboXPxTevpCOZuaA8eY9PmR1',
    name: 'everyone-presentation-pilot', framework: 'nextjs', root_directory: 'apps/web', node_version: '24.x', outside_workspace_files: true },
  domains: [{ name: 'everyone-presentation-pilot.vercel.app', verified: true }] };
}
function response(path) {
  const headers = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' };
  if (path === '/') return new Response(null, { status:307, headers:{...headers,Location:'/projects'} });
  if (path === '/projects') return new Response('<!doctype html><title>Presentation Studio</title>', { headers: { ...headers, 'Content-Type': 'text/html' } });
  if (path === '/api/session') return Response.json({ request_id: requestId, data: { mode: 'supabase', actor: null, actors: [] } }, { headers });
  return Response.json({ request_id: requestId, error: { code: path === '/api/dev/session' ? 'ACCESS_DENIED' : 'AUTH_REQUIRED',
    message: 'Public safe error', details: {}, retryable: false } }, { status: path === '/api/dev/session' ? 403 : 401, headers });
}

test('fixed configured project, team and verified host are required without accepting another root or domain', () => {
  assert.doesNotThrow(() => validateConfiguredTarget(configured()));
  for (const mutate of [v => { v.project.id = 'another'; }, v => { v.project.account_id = 'another'; },
    v => { v.project.root_directory = '.'; }, v => { v.project.node_version = '26.x'; },
    v => { v.project.outside_workspace_files = false; }, v => { v.domains[0].verified = false; },
    v => { v.domains[0].name = 'another.example'; }]) {
    const value = configured(); mutate(value);
    assert.throws(() => validateConfiguredTarget(value));
  }
});

test('public readiness validates canonical root navigation then makes six fixed GETs without credentials or following redirects', async () => {
  const seen = [];
  const report = await probePublicHost(async (input, options) => {
    const url = new URL(input); seen.push(url.pathname);
    assert.equal(url.origin, HOST_ORIGIN); assert.equal(url.search, '');
    assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'manual');
    const headers = new Headers(options.headers);
    for (const key of ['authorization', 'cookie', 'origin']) assert.equal(headers.has(key), false);
    return response(url.pathname);
  });
  assert.deepEqual(seen, ['/', '/projects', '/api/session', '/api/v1/projects', '/api/v1/settings', '/api/dev/session']);
  assert.equal(report.result, 'passed'); assert.equal(report.checks.length, 6);
  assert.equal(report.full_core_or_oauth_acceptance, false);
});

test('redirect/protection response fails without following or retaining its private location', async () => {
  let requests = 0;
  const report = await probePublicHost(async () => { requests++; return new Response(null, { status: 302, headers: { Location: 'https://example.invalid/?ticket=private-sentinel' } }); });
  assert.equal(requests, 6); assert.equal(report.result, 'failed');
  assert.equal(report.checks.every(check => check.redirect_blocked), true);
  assert.doesNotMatch(JSON.stringify(report), /private-sentinel|ticket|example\.invalid/u);
});

test('fixture identity, unexpected private fields and set-cookie values cannot enter a readiness receipt', async () => {
  for (const data of [{ mode: 'local_fixture', actor: null, actors: [] },
    { mode: 'supabase', actor: { name: 'private-sentinel' }, actors: [] },
    { mode: 'supabase', actor: null, actors: [], token: 'private-sentinel' }]) {
    const report = await probePublicHost(async input => new URL(input).pathname === '/api/session'
      ? Response.json({ request_id: requestId, data }, { headers: { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Set-Cookie': 'private-sentinel' } })
      : response(new URL(input).pathname));
    assert.equal(report.result, 'failed'); assert.doesNotMatch(JSON.stringify(report), /private-sentinel|"token"/u);
  }
});

test('wrong authorization status, code or missing private response headers cannot count as admission proof', async () => {
  for (const changed of [() => Response.json({ request_id: requestId, data: [] }),
    () => Response.json({ request_id: requestId, error: { code: 'CAPABILITY_REQUIRED' } }, { status: 403 }),
    () => Response.json({ request_id: requestId, error: { code: 'AUTH_REQUIRED' } }, { status: 401 }),
    () => Response.json({ request_id: requestId, error: { code: 'AUTH_REQUIRED', message: 'Safe', details: {}, retryable: false, token: 'private-sentinel' } },
      { status: 401, headers: { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } })]) {
    const report = await probePublicHost(async input => new URL(input).pathname === '/api/v1/projects' ? changed() : response(new URL(input).pathname));
    assert.equal(report.result, 'failed');
  }
});

test('oversized bodies and transport exceptions stay bounded and never publish diagnostics', async () => {
  const oversized = await probePublicHost(async input => new URL(input).pathname === '/api/session'
    ? new Response('private-sentinel'.repeat(30_000), { headers: { 'Content-Type': 'application/json' } }) : response(new URL(input).pathname));
  assert.equal(oversized.result, 'failed'); assert.doesNotMatch(JSON.stringify(oversized), /private-sentinel/u);
  let calls = 0;
  const unavailable = await probePublicHost(async () => { calls++; throw new Error('private-sentinel'); });
  assert.equal(calls, 6); assert.equal(unavailable.result, 'failed');
  assert.doesNotMatch(JSON.stringify(unavailable), /private-sentinel/u);
});
test('root navigation accepts only the exact same-host projects destination',async()=>{
  for(const location of ['https://foreign.invalid/projects','/projects?ticket=private-sentinel','//foreign.invalid/projects','/projects/../api/session']){
    const report=await probePublicHost(async input=>new URL(input).pathname==='/'
      ?new Response(null,{status:307,headers:{Location:location,'X-Content-Type-Options':'nosniff'}})
      :response(new URL(input).pathname));
    assert.equal(report.result,'failed');assert.doesNotMatch(JSON.stringify(report),/foreign|private-sentinel/u);
  }
});
