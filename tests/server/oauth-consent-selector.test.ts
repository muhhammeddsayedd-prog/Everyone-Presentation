import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOAuthConsentEnvelope, parseOAuthConsentQuery } from '../../apps/web/lib/oauth-consent-contract.ts';
import { handleOAuthConsentCallback } from '../../apps/web/lib/oauth-consent-http.ts';

const authorizationId = 'abcdefghijklmnopqrstuvwxyz234567';
const requestId = '40000000-0000-4000-8000-000000000001';
const origin = 'https://studio.example.invalid';

test('browser consent envelopes accept the provider opaque authorization selector', () => {
  const view = { state: 'uncertain', authorization_id: authorizationId };
  assert.deepEqual(parseOAuthConsentEnvelope({ request_id: requestId, data: view }, requestId), view);
});

test('business sign-in callback preserves the opaque authorization selector and exchanges its code once', async () => {
  let exchanges = 0;
  const result = await handleOAuthConsentCallback(new Request(`${origin}/api/oauth/callback?authorization_id=${authorizationId}&code=synthetic-private-code`), {
    baseUrl: origin,
    exchangeCode: async code => { assert.equal(code, 'synthetic-private-code'); exchanges++; return { error: null }; },
  });
  assert.equal(exchanges, 1);
  assert.equal(result.status, 303);
  assert.equal(result.headers.get('location'), `${origin}/oauth/consent?authorization_id=${authorizationId}`);
});

test('opaque selectors do not replace UUID request correlation or client identifiers', () => {
  assert.throws(() => parseOAuthConsentEnvelope({ request_id: authorizationId,
    data: { state: 'uncertain', authorization_id: authorizationId } }, authorizationId));
  assert.throws(() => parseOAuthConsentEnvelope({ request_id: requestId, data: { state: 'consent', authorization_id: authorizationId,
    client: { id: authorizationId, name: 'Synthetic client', website: null }, account_email: null, scopes: ['openid'] } }, requestId));
});

test('authorization envelopes reject malformed selectors', () => {
  for (const value of ['', requestId, authorizationId.slice(1), `${authorizationId}a`, authorizationId.toUpperCase(),
    `${authorizationId.slice(0, -1)}1`, `${authorizationId.slice(0, -1)}8`, `${authorizationId.slice(0, -1)}/`, `${authorizationId}\n`]) {
    assert.throws(() => parseOAuthConsentEnvelope({ request_id: requestId, data: { state: 'uncertain', authorization_id: value } }, requestId));
  }
});

test('consent page accepts an opaque selector and rejects duplicate, malformed or extra query authority', () => {
  assert.deepEqual(parseOAuthConsentQuery({ authorization_id: authorizationId }), { authorizationId, callbackFailed: false });
  assert.deepEqual(parseOAuthConsentQuery({ authorization_id: authorizationId, auth: 'failed' }), { authorizationId, callbackFailed: true });
  for (const query of [{}, { authorization_id: requestId }, { authorization_id: [authorizationId] },
    { authorization_id: [authorizationId, authorizationId] }, { authorization_id: `${authorizationId}/` },
    { authorization_id: authorizationId, auth: ['failed'] }, { authorization_id: authorizationId, auth: 'success' },
    { authorization_id: authorizationId, redirect_uri: 'https://attacker.invalid/callback' }]) {
    assert.equal(parseOAuthConsentQuery(query).authorizationId, null);
  }
});

test('callback rejects duplicate selectors and malformed or extra query authority before exchanging a code', async () => {
  let exchanges = 0;
  for (const query of [`authorization_id=${authorizationId}&authorization_id=${authorizationId}&code=synthetic`,
    `authorization_id=${requestId}&code=synthetic`, `authorization_id=${authorizationId}%2F&code=synthetic`,
    `authorization_id=${authorizationId}&code=synthetic&code=synthetic`,
    `authorization_id=${authorizationId}&code=synthetic&redirect_uri=https://attacker.invalid/callback`]) {
    const result = await handleOAuthConsentCallback(new Request(`${origin}/api/oauth/callback?${query}`), {
      baseUrl: origin, exchangeCode: async () => { exchanges++; return { error: null }; },
    });
    assert.equal(result.status, 303);
    const destination = new URL(result.headers.get('location')!);
    assert.equal(destination.origin, origin);
    assert.equal(destination.pathname, '/oauth/consent');
    assert.equal(destination.searchParams.get('auth'), 'failed');
    assert.ok(!result.headers.get('location')!.includes('synthetic'));
    assert.ok(!result.headers.get('location')!.includes('attacker'));
  }
  assert.equal(exchanges, 0);
});
