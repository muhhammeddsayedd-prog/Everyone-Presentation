import test from 'node:test';
import assert from 'node:assert/strict';
import { withSyntheticApiRoute } from '../fixtures/next-api-route.ts';

test('exported Settings route already contains denied and asynchronously rejected reads in safe envelopes', async t => {
  const principal = '67000000-0000-4000-8000-000000000001';
  const marker = 'PRIVATE_SETTINGS_PROVIDER_DIAGNOSTIC';
  let mode: 'denied' | 'rejected' | 'invalid_auth' = 'denied', calls = 0;
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init), uri = new URL(request.url);
    assert.equal(uri.origin, 'https://settings-route.synthetic.invalid');
    assert.equal(request.headers.get('authorization'), 'Bearer synthetic-settings-user');
    if (uri.pathname === '/auth/v1/user') return mode === 'invalid_auth'
      ? Response.json({ code: 'bad_jwt', message: marker }, { status: 401 })
      : Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    assert.equal(uri.pathname, '/rest/v1/rpc/eps_get_settings'); calls++;
    if (mode === 'rejected') { await Promise.resolve(); throw new TypeError(marker); }
    return Response.json({ code: 'P0001', message: 'CAPABILITY_REQUIRED', details: marker }, { status: 400 });
  });
  await withSyntheticApiRoute({ NODE_ENV: 'test', APP_ENV: 'test', APP_BASE_URL: 'http://127.0.0.1:3000',
    CENTRAL_ADAPTER_MODE: 'supabase', SUPABASE_URL: 'https://settings-route.synthetic.invalid',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_settings' }, async call => {
    const makeRequest = (query = '') => new Request(`http://127.0.0.1:3000/api/v1/settings${query}`, { headers: { authorization: 'Bearer synthetic-settings-user' } });
    for (const scenario of [{ mode: 'denied', status: 403, code: 'CAPABILITY_REQUIRED' },
      { mode: 'rejected', status: 503, code: 'DEPENDENCY_UNAVAILABLE' },
      { mode: 'invalid_auth', status: 401, code: 'AUTH_REQUIRED' }] as const) {
      mode = scenario.mode;
      const response = await call(makeRequest(), ['settings']), body = await response.json();
      assert.equal(response.status, scenario.status); assert.equal(body.error.code, scenario.code);
      assert.match(body.request_id, /^[a-f0-9-]{36}$/u);
      assert.equal(response.headers.get('cache-control')?.includes('no-store'), true);
      assert.equal(JSON.stringify(body).includes(marker), false);
    }
    mode = 'denied';
    const response = await call(makeRequest('?forged=true'), ['settings']);
    assert.equal(response.status, 400); assert.equal((await response.json()).error.code, 'INVALID_REQUEST');
    assert.equal(calls, 2);
  });
});
