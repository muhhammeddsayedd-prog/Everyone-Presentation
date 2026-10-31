import test from 'node:test';
import assert from 'node:assert/strict';
import { observeOAuthConsentFetch } from '../../apps/web/lib/oauth-consent-observability.ts';

const centralOrigin = 'https://central.example.invalid';
const authorizationId = 'abcdefghijklmnopqrstuvwxyz234567';
const traceId = '40000000-0000-4000-8000-000000000001';
const detailsUrl = `${centralOrigin}/auth/v1/oauth/authorizations/${authorizationId}`;

test('OAuth observation reports safe details shape and preserves the response unchanged', async () => {
  const logs: unknown[] = [];
  const body = { authorization_id: authorizationId, client: { id: 'private-client-id', name: 'private-client-name', uri: 'https://private.invalid', logo_uri: null },
    user: { id: 'private-user-id', email: 'private-user@example.invalid' }, redirect_uri: 'http://localhost:3118/callback', scope: 'openid' };
  const fetcher = observeOAuthConsentFetch({ centralOrigin, traceId, log: value => logs.push(value),
    fetch: async () => Response.json(body, { headers: { 'set-cookie': 'private-cookie', 'x-private': 'private-header' } }) });
  const response = await fetcher(detailsUrl, { headers: { authorization: 'Bearer private-access-token', cookie: 'private-cookie' } });
  assert.deepEqual(await response.json(), body);
  assert.equal(response.headers.get('set-cookie'), 'private-cookie');
  assert.deepEqual(logs, [{ event: 'eps.oauth.provider_response', trace_id: traceId, operation: 'details', method: 'GET', status: 200,
    variant: 'authorization_details', fields: { authorization_id: 'string', redirect_uri: 'string', client: 'object', user: 'object', scope: 'string' },
    client_fields: { id: 'string', name: 'string', uri: 'string', logo_uri: 'null' }, user_fields: { id: 'string', email: 'string' } }]);
  const logged = JSON.stringify(logs);
  for (const secret of [authorizationId, 'private-', 'localhost', 'openid', detailsUrl, 'Bearer']) assert.ok(!logged.includes(secret));
});

test('redirect and consent errors expose their variant and allowlisted error code without private values', async () => {
  const logs: unknown[] = [];
  const bodies = [Response.json({ redirect_url: 'http://localhost:3118/callback?code=private-code&state=private-state' }),
    Response.json({ code: 'oauth_authorization_not_found', message: 'private-provider-message', details: 'private-diagnostics' }, { status: 400 }),
    Response.json({ error_code: 'private-secret-error', msg: 'private-provider-message' }, { status: 500 })];
  const fetcher = observeOAuthConsentFetch({ centralOrigin, traceId, log: value => logs.push(value), fetch: async () => bodies.shift()! });
  await fetcher(detailsUrl);
  await fetcher(`${detailsUrl}/consent`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) });
  await fetcher(detailsUrl);
  assert.equal((logs[0] as { variant: string }).variant, 'redirect');
  assert.deepEqual(logs[1], { event: 'eps.oauth.provider_response', trace_id: traceId, operation: 'decision', method: 'POST', status: 400,
    variant: 'provider_error', fields: { code: 'string', message: 'string' }, error_code: 'oauth_authorization_not_found' });
  assert.equal((logs[2] as { error_code: string }).error_code, 'other');
  assert.ok(!JSON.stringify(logs).includes('private-'));
});

test('observation ignores unrelated paths and origins and never logs raw transport exceptions', async () => {
  const logs: unknown[] = [];
  const error = new Error('private-provider-failure');
  const fetcher = observeOAuthConsentFetch({ centralOrigin, traceId, log: value => logs.push(value), fetch: async () => { throw error; } });
  for (const url of [`${centralOrigin}/auth/v1/user`, `${centralOrigin}/auth/v1/token`,
    `https://elsewhere.example.invalid/auth/v1/oauth/authorizations/${authorizationId}`, `${detailsUrl}/extra`]) {
    await assert.rejects(fetcher(url), value => value === error);
  }
  assert.equal(logs.length, 0);
  await assert.rejects(fetcher(detailsUrl), value => value === error);
  assert.deepEqual(logs, [{ event: 'eps.oauth.provider_response', trace_id: traceId, operation: 'details', method: 'GET', status: null, variant: 'transport_error' }]);
  assert.ok(!JSON.stringify(logs).includes('private-'));
});

test('bounded inspection handles oversized, malformed, non-object and unknown-key bodies without exposing content', async () => {
  const logs: unknown[] = [];
  const responses = [new Response('private-'.repeat(2000)), new Response('private-malformed-json'), Response.json(['private-array']),
    Response.json({ 'private-key': 'private-value', redirect_url: 'private-redirect' })];
  const fetcher = observeOAuthConsentFetch({ centralOrigin, traceId, log: value => logs.push(value), fetch: async () => responses.shift()! });
  for (let index = 0; index < 4; index++) { const response = await fetcher(detailsUrl); assert.ok((await response.text()).includes('private-')); }
  assert.deepEqual(logs.map(value => (value as { variant: string }).variant), ['oversized', 'invalid_json', 'non_object', 'unrecognized']);
  assert.ok(!JSON.stringify(logs).includes('private-'));
});

test('log sink failure cannot alter a successful OAuth response', async () => {
  const fetcher = observeOAuthConsentFetch({ centralOrigin, traceId, log: () => { throw new Error('private-log-failure'); },
    fetch: async () => Response.json({ redirect_url: 'http://localhost:3118/callback?code=private-code' }) });
  assert.equal((await fetcher(detailsUrl)).status, 200);
});
