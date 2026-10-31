import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createOAuthConsentCoordinator } from '../../apps/web/lib/oauth-consent-coordinator.ts';

const authorizationId = 'abcdefghijklmnopqrstuvwxyz234567';
const requestId = '40000000-0000-4000-8000-000000000001';
const claimId = '50000000-0000-4000-8000-000000000001';
const clientId = '60000000-0000-4000-8000-000000000001';
const resource = 'https://studio.example.invalid/mcp';
const traceId = '70000000-0000-4000-8000-000000000001';
const generic = { code: 'OAUTH_AUTHORIZATION_UNAVAILABLE', message: 'The authorization request could not be coordinated. Restart the connection from your client.' };

function clientFor(value: unknown, throws = false): SupabaseClient {
  return { rpc() { return { abortSignal(signal: AbortSignal) {
    assert.ok(signal instanceof AbortSignal);
    if (throws) return Promise.reject(value);
    return Promise.resolve(value);
  } }; } } as unknown as SupabaseClient;
}
function envelope(callback = 'http://localhost:3118/callback', actualClientId = clientId) {
  return { claim_id: claimId, state: 'claimed', binding: { authorization_id: authorizationId,
    client: { id: actualClientId, name: 'private-client-name', uri: 'https://private-client.invalid', logo_uri: null },
    redirect_uri: callback, scope: 'openid', user_id: null, status: 'pending', expires_at: '2099-01-01T00:00:00Z' } };
}
function rejection(error: unknown) {
  assert.ok(error instanceof Error);
  assert.equal((error as { code?: string }).code, generic.code);
  assert.equal(error.message, generic.message);
  assert.ok(!JSON.stringify(error).includes('private-'));
  return true;
}

test('coordination tracing identifies RPC permission, native guard and schema-cache failures without provider details', async () => {
  for (const failure of [
    { status: 403, error: { code: '42501', message: 'permission denied for table private-record', details: 'private-details', hint: 'private-hint' }, code: '42501' },
    { status: 400, error: { code: '22023', message: 'OAUTH_CONSENT_AUTHORIZATION_UNAVAILABLE', details: 'private-details' }, code: '22023', message: 'AUTHORIZATION_UNAVAILABLE' },
    { status: 401, error: { code: '28000', message: 'OAUTH_CONSENT_BROWSER_SESSION_REQUIRED' }, code: '28000', message: 'BROWSER_SESSION_REQUIRED' },
    { status: 400, error: { code: '22023', message: 'OAUTH_CONSENT_NATIVE_OUTCOME_UNCONFIRMED' }, code: '22023', message: 'NATIVE_OUTCOME_UNCONFIRMED' },
    { status: 404, error: { code: 'PGRST202', message: 'private-function missing from schema cache' }, code: 'PGRST202' },
    { status: 400, error: { code: '42702', message: 'private-ambiguous-column' }, code: '42702' },
    { status: 400, error: { code: 'P0001', message: 'private-guard-exception' }, code: 'P0001' },
  ]) {
    const logs: unknown[] = [];
    const coordinator = createOAuthConsentCoordinator(clientFor({ status: failure.status, data: null, error: failure.error }), resource,
      { traceId, approvedClientIds: [clientId], log: value => logs.push(value) });
    await assert.rejects(coordinator.claim({ authorizationId, action: 'details', requestId }), rejection);
    assert.deepEqual(logs, [{ event: 'eps.oauth.coordination_response', trace_id: traceId, operation: 'claim', action: 'details',
      status: failure.status, phase: 'provider_error', code: failure.code, ...(failure.message ? { message: failure.message } : {}) }]);
    assert.ok(!JSON.stringify(logs).includes('private-'));
  }
});

test('coordination success traces only an approved public client and known callback classification', async () => {
  for (const [callback, callbackKind] of [['http://localhost:3118/callback', 'localhost_3118'],
    ['https://claude.ai/api/mcp/auth_callback', 'claude_ai'], ['https://private-callback.invalid/?token=private-token', 'other']]) {
    const data = envelope(callback);
    const logs: unknown[] = [];
    const coordinator = createOAuthConsentCoordinator(clientFor({ status: 200, data, error: null }), resource,
      { traceId, approvedClientIds: [clientId], log: value => logs.push(value) });
    assert.equal(await coordinator.claim({ authorizationId, action: 'approve', requestId }), data);
    assert.deepEqual(logs, [{ event: 'eps.oauth.coordination_response', trace_id: traceId, operation: 'claim', action: 'approve',
      status: 200, phase: 'success', state: 'claimed', client_id: clientId, callback: callbackKind }]);
    for (const secret of [authorizationId, requestId, claimId, resource, 'private-']) assert.ok(!JSON.stringify(logs).includes(secret));
  }
});

test('coordination finish tracing separates safe outcomes and records only closed response states', async () => {
  for (const outcome of ['consent_ready', 'redirect', 'uncertain', 'rejected'] as const) {
    const logs: unknown[] = [];
    const data = { claim_id: null, state: 'already_processed', binding: null };
    const coordinator = createOAuthConsentCoordinator(clientFor({ status: 200, data, error: null }), resource,
      { traceId, log: value => logs.push(value) });
    assert.equal(await coordinator.finish({ authorizationId, claimId, outcome }), data);
    assert.deepEqual(logs, [{ event: 'eps.oauth.coordination_response', trace_id: traceId, operation: 'finish', outcome,
      status: 200, phase: 'success', state: 'already_processed' }]);
  }
});

test('unknown error codes, messages, response keys and invalid HTTP statuses cannot enter coordination traces', async () => {
  for (const [data, error, phase] of [
    [null, { code: 'private-code', message: 'OAUTH_CONSENT_AUTHORIZATION_UNAVAILABLE private-suffix', details: 'private-details' }, 'provider_error'],
    [{ ...envelope(), 'private-key': 'private-value' }, null, 'response_unrecognized'],
    [{ claim_id: claimId, state: 'private-state', binding: null }, null, 'response_unrecognized'],
  ] as const) {
    const logs: unknown[] = [];
    const coordinator = createOAuthConsentCoordinator(clientFor({ status: 700, data, error }), resource,
      { traceId, approvedClientIds: [clientId], log: value => logs.push(value) });
    if (error) await assert.rejects(coordinator.claim({ authorizationId, action: 'deny', requestId }), rejection);
    else assert.equal(await coordinator.claim({ authorizationId, action: 'deny', requestId }), data);
    assert.deepEqual(logs, [{ event: 'eps.oauth.coordination_response', trace_id: traceId, operation: 'claim', action: 'deny', status: null, phase }]);
  }
});

test('unapproved or malformed client identifiers are omitted while callback classification remains bounded', async () => {
  for (const actualClientId of ['80000000-0000-4000-8000-000000000001', 'private-client-id']) {
    const logs: unknown[] = [];
    const coordinator = createOAuthConsentCoordinator(clientFor({ status: 200, data: envelope('https://claude.ai/api/mcp/auth_callback', actualClientId), error: null }), resource,
      { traceId, approvedClientIds: [clientId], log: value => logs.push(value) });
    await coordinator.claim({ authorizationId, action: 'details', requestId });
    assert.deepEqual(logs, [{ event: 'eps.oauth.coordination_response', trace_id: traceId, operation: 'claim', action: 'details', status: 200, phase: 'success', state: 'claimed' }]);
  }
});

test('transport errors stay generic and logging failure cannot alter coordination success or failure', async () => {
  const logs: unknown[] = [];
  const coordinator = createOAuthConsentCoordinator(clientFor(new Error('private-transport-token'), true), resource,
    { traceId, log: value => logs.push(value) });
  await assert.rejects(coordinator.finish({ authorizationId, claimId, outcome: 'uncertain' }), rejection);
  assert.deepEqual(logs, [{ event: 'eps.oauth.coordination_response', trace_id: traceId, operation: 'finish', outcome: 'uncertain', status: null, phase: 'transport_error' }]);
  for (const error of [null, { code: '42501', message: 'private-error' }]) {
    const data = envelope();
    const sinkFailure = createOAuthConsentCoordinator(clientFor({ status: error ? 403 : 200, data, error }), resource,
      { traceId, log: () => { throw new Error('private-sink-failure'); } });
    if (error) await assert.rejects(sinkFailure.claim({ authorizationId, action: 'details', requestId }), rejection);
    else assert.equal(await sinkFailure.claim({ authorizationId, action: 'details', requestId }), data);
  }
});
