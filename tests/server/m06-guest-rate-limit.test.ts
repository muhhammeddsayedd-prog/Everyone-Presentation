import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../../apps/web/app/api/v1/[...segments]/route.ts';

const origin = 'http://127.0.0.1:3000';
const marker = 'PRIVATE_RATE_LIMIT_UPSTREAM_DETAILS';
const sessionId = '06000000-0000-4000-8000-000000000001';
const seriesId = '06000000-0000-4000-8000-000000000002';
const credential = Buffer.alloc(32, 61).toString('base64url');
const access = { expires_at: '2026-11-29T00:00:00Z', series_id: seriesId, version_id: null,
  download_enabled: true, display_name: null, guest_session_id: sessionId };
const names = ['CENTRAL_ADAPTER_MODE', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'APP_ENV', 'APP_BASE_URL', 'EPS_REVIEW_GATEWAY_KEY', 'EPS_REVIEW_REPLAY_KEY'] as const;
function configure() {
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, { CENTRAL_ADAPTER_MODE: 'supabase', SUPABASE_URL: 'https://synthetic.invalid',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_rate_limit_12345', APP_ENV: 'test', APP_BASE_URL: origin,
    EPS_REVIEW_GATEWAY_KEY: '17'.repeat(32), EPS_REVIEW_REPLAY_KEY: '29'.repeat(32) });
  return () => { for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; } };
}
function open(raw = credential) {
  return POST(new Request(origin + '/api/v1/review/open', { method: 'POST', headers: {
    host: '127.0.0.1:3000', Origin: origin, 'X-Review-Token': raw, 'X-EPS-Review-Browser': '1',
  } }), { params: Promise.resolve({ segments: ['review', 'open'] }) });
}

test('actual guest route returns a private retryable 429 before a throttled exchange reaches the backend', async t => {
  const restore = configure(); const logs: string[] = []; let backendCalls = 0;
  t.mock.method(console, 'error', (line: string) => { logs.push(line); });
  t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL) => {
    assert.equal(String(url), 'https://synthetic.invalid/rest/v1/rpc/eps_guest_operation'); backendCalls++;
    return Response.json(access);
  });
  try {
    for (let index = 0; index < 20; index++) assert.equal((await open()).status, 200);
    const limited = await open(), body = await limited.json();
    assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '60');
    assert.match(limited.headers.get('Cache-Control')!, /private.*no-store/u);
    assert.equal(limited.headers.get('set-cookie'), null); assert.equal(body.error.code, 'RATE_LIMITED');
    assert.equal(body.error.retryable, true); assert.equal(body.error.details.retry_after_seconds, 60);
    assert.match(body.error.message, /Too many review requests.*Try again/u); assert.equal(backendCalls, 20);
    assert.deepEqual(JSON.parse(logs.at(-1)!), { event: 'guest_request_failed', operation_class: 'guest_exchange',
      status: 429, code: 'RATE_LIMITED', request_id: body.request_id });
    assert.ok(!JSON.stringify({ body, logs }).includes(credential));
    assert.equal((await open(Buffer.alloc(32, 62).toString('base64url'))).status, 200);
    assert.equal(backendCalls, 21);
  } finally { restore(); }
});

test('backend RATE_LIMITED uses the actual route catch with safe copy and a subsequent exchange can succeed', async t => {
  const restore = configure(); const logs: string[] = []; let backendCalls = 0;
  t.mock.method(console, 'error', (line: string) => { logs.push(line); });
  t.mock.method(globalThis, 'fetch', async () => {
    backendCalls++;
    return backendCalls === 1 ? Response.json({ code: 'P0001', message: 'RATE_LIMITED', details: marker, hint: marker }, { status: 400 }) : Response.json(access);
  });
  try {
    const raw = Buffer.alloc(32, 63).toString('base64url');
    const limited = await open(raw), body = await limited.json();
    assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '60');
    assert.match(limited.headers.get('Cache-Control')!, /no-store/u); assert.equal(body.error.code, 'RATE_LIMITED');
    assert.equal(body.error.retryable, true); assert.match(body.error.message, /Wait a moment and try again/u);
    assert.ok(!JSON.stringify({ body, logs }).includes(marker)); assert.ok(!JSON.stringify({ body, logs }).includes(raw));
    const resumed = await open(raw); assert.equal(resumed.status, 200); assert.equal((await resumed.json()).data.guest_session_id, sessionId);
    assert.equal(backendCalls, 2);
  } finally { restore(); }
});
