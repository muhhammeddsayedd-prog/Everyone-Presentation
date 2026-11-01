import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { withSyntheticApiRoute } from '../fixtures/next-api-route.ts';

const principal = '68000000-0000-4000-8000-000000000001';
const origin = 'http://127.0.0.1:3000';
const provider = 'https://foundation-list.synthetic.invalid';
const token = 'synthetic-foundation-list-user';
const routes = ['projects', 'workspaces'] as const;
type Route = typeof routes[number];
type Call = { operation: string; input: Record<string, unknown> };

async function harness(t: TestContext, run: (state: {
  calls: Call[];
  request(route: Route, query?: string): Promise<Response>;
  mode(value: 'ready' | 'denied' | 'invalid_auth'): void;
}) => Promise<void>) {
  const calls: Call[] = [];
  let mode = 'ready';
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init), url = new URL(request.url);
    assert.equal(url.origin, provider);
    assert.equal(request.headers.get('authorization'), `Bearer ${token}`);
    if (url.pathname === '/auth/v1/user') return mode === 'invalid_auth'
      ? Response.json({ code: 'bad_jwt', message: 'PRIVATE_LIST_DIAGNOSTIC' }, { status: 401 })
      : Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    assert.ok(['/rest/v1/rpc/eps_list_projects', '/rest/v1/rpc/eps_list_workspaces'].includes(url.pathname));
    calls.push({ operation: url.pathname.split('/').at(-1)!, input: await request.json() });
    return mode === 'denied'
      ? Response.json({ code: 'P0001', message: 'CAPABILITY_REQUIRED', details: 'PRIVATE_LIST_DIAGNOSTIC' }, { status: 400 })
      : Response.json({ data: [], page: { next_cursor: 'synthetic-next-page' } });
  });
  await withSyntheticApiRoute({ NODE_ENV: 'test', APP_ENV: 'test', APP_BASE_URL: origin,
    CENTRAL_ADAPTER_MODE: 'supabase', SUPABASE_URL: provider,
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_foundation_list' }, async call => {
    await run({ calls, mode(value) { mode = value; },
      request: (route, query = '') => call(new Request(`${origin}/api/v1/${route}${query}`,
        { headers: { authorization: `Bearer ${token}` } }), [route]) });
  });
}

async function expectError(response: Response, status: number, code: string) {
  const body = await response.json();
  assert.equal(response.status, status);
  assert.equal(body.error.code, code);
  assert.deepEqual(Object.keys(body).sort(), ['error', 'request_id']);
  assert.match(body.request_id, /^[a-f0-9-]{36}$/u);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/u);
  assert.equal(JSON.stringify(body).includes('PRIVATE_LIST_DIAGNOSTIC'), false);
}

test('foundation list HTTP rejects unknown and duplicate filters before a list RPC', async t => {
  await harness(t, async state => {
    for (const route of routes) {
      for (const query of ['?principal_id=forged', '?project_id=not-published', '?q=first&q=second',
        '?q=first&%71=second', '?cursor=first&cursor=second', '?limit=2&limit=3']) {
        const before = state.calls.length;
        await expectError(await state.request(route, query), 400, 'INVALID_REQUEST');
        assert.equal(state.calls.length, before, `${route}${query} reached a list RPC`);
      }
    }
  });
});

test('foundation list HTTP rejects nondecimal and out-of-range page sizes before a list RPC', async t => {
  await harness(t, async state => {
    for (const route of routes) {
      for (const value of ['1e1', '0x10', '%2B1', '01', '%201%20', '', '0', '101', '-1', '1.5',
        'Infinity', 'NaN', '999999999999999999999999999999999999']) {
        const before = state.calls.length;
        await expectError(await state.request(route, `?limit=${value}`), 400, 'INVALID_REQUEST');
        assert.equal(state.calls.length, before, `${route}?limit=${value} reached a list RPC`);
      }
    }
  });
});

test('foundation list HTTP preserves valid search, opaque cursors, page bounds and omitted values', async t => {
  await harness(t, async state => {
    const cases = [
      { query: '', q: '', cursor: null, limit: 25 },
      { query: '?q=&cursor=', q: '', cursor: null, limit: 25 },
      { query: '?limit=1', q: '', cursor: null, limit: 1 },
      { query: '?q=%20Synthetic%20%26%20Arabic%20%D8%B9%D8%A8%D8%AF%20&cursor=opaque%2Bcursor%2F%3Dfuture&limit=100',
        q: 'Synthetic & Arabic عبد', cursor: 'opaque+cursor/=future', limit: 100 },
      { query: `?${new URLSearchParams({ q: 'a'.repeat(500), cursor: 'c'.repeat(2000), limit: '25' })}`,
        q: 'a'.repeat(500), cursor: 'c'.repeat(2000), limit: 25 },
    ];
    for (const route of routes) {
      for (const value of cases) {
        const before = state.calls.length;
        const response = await state.request(route, value.query), body = await response.json();
        assert.equal(response.status, 200);
        assert.deepEqual(Object.keys(body).sort(), ['data', 'page', 'request_id']);
        assert.deepEqual(body.data, []);
        assert.deepEqual(body.page, { next_cursor: 'synthetic-next-page' });
        assert.match(response.headers.get('cache-control') ?? '', /no-store/u);
        assert.equal(state.calls.length, before + 1);
        assert.deepEqual(state.calls.at(-1), { operation: `eps_list_${route}`, input: {
          p_q: value.q, p_cursor: value.cursor, p_limit: value.limit,
          ...(route === 'workspaces' ? { p_project_id: null } : {}),
        } });
      }
    }
  });
});

test('foundation list HTTP retains current authentication, capability denial and safe error envelopes', async t => {
  await harness(t, async state => {
    for (const route of routes) {
      state.mode('invalid_auth');
      const before = state.calls.length;
      await expectError(await state.request(route), 401, 'AUTH_REQUIRED');
      assert.equal(state.calls.length, before);
      state.mode('denied');
      await expectError(await state.request(route, '?q=allowed&limit=2'), 403, 'CAPABILITY_REQUIRED');
      assert.equal(state.calls.length, before + 1);
    }
  });
});
