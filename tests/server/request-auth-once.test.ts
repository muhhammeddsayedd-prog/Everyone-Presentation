import test from 'node:test';
import assert from 'node:assert/strict';
import { withSyntheticApiRoute } from '../fixtures/next-api-route.ts';

// One API request composes several services (the actor, the studio with its storage adapters, casting...). Each one
// used to ask Auth on its own; the request now asks once, and the next request asks again (no cross-request reuse).
test('an API request verifies the acting user with Auth once, and every request verifies again', async t => {
  const principal = '67000000-0000-4000-8000-000000000002';
  const workspace = { id: '67000000-0000-4000-8000-0000000000a1', project_id: '67000000-0000-4000-8000-0000000000b1', module: 'casting', title: 'Synthetic',
    logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: 1, draft_revision: 0, has_unpublished_changes: false,
    created_at: '2026-11-19T00:00:00Z', updated_at: '2026-11-19T00:00:00Z' };
  let auth = 0; let rejected = false; const rpcs: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init), uri = new URL(request.url);
    assert.equal(uri.origin, 'https://auth-once.synthetic.invalid');
    assert.equal(request.headers.get('authorization'), 'Bearer synthetic-auth-once-user');
    if (uri.pathname === '/auth/v1/user') {
      auth++;
      return rejected ? Response.json({ code: 'session_not_found', message: 'synthetic' }, { status: 403 })
        : Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    }
    rpcs.push(uri.pathname);
    assert.equal(uri.pathname, '/rest/v1/rpc/eps_get_workspace');
    return Response.json(workspace);
  });
  await withSyntheticApiRoute({ NODE_ENV: 'test', APP_ENV: 'test', APP_BASE_URL: 'http://127.0.0.1:3000',
    CENTRAL_ADAPTER_MODE: 'supabase', SUPABASE_URL: 'https://auth-once.synthetic.invalid',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_auth_once' }, async call => {
    const request = () => new Request(`http://127.0.0.1:3000/api/v1/workspaces/${workspace.id}`, { headers: { authorization: 'Bearer synthetic-auth-once-user' } });
    for (const expected of [1, 2]) {
      const response = await call(request(), ['workspaces', workspace.id]);
      assert.equal(response.status, 200); assert.equal((await response.json()).data.id, workspace.id);
      assert.equal(auth, expected);
    }
    // A signed-out (revoked) session is refused on the very next request even though the previous one passed.
    rejected = true;
    const response = await call(request(), ['workspaces', workspace.id]);
    assert.equal(response.status, 401); assert.equal((await response.json()).error.code, 'AUTH_REQUIRED');
    assert.equal(auth, 3); assert.equal(rpcs.length, 2);
  });
});
