import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralSpecs } from '../src/specs.ts';

const principal = '81700000-0000-4000-8000-000000000002';
const workspace = '82700000-0000-4000-8000-000000000002';
const jobId = '83700000-0000-4000-8000-000000000002';
const specId = '84700000-0000-4000-8000-000000000002';
const actor = { principal_id: principal };
const context = { idempotencyKey: 'synthetic-source-intent', requestId: 'synthetic-source-request', clientType: 'mcp' as const };
const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: principal, role: 'authenticated' })).toString('base64url')}.synthetic`;
const acknowledgement = (status = 'queued') => ({ job_id: jobId, resource_id: specId, poll_url: `/api/v1/jobs/${jobId}`, status });
async function fixture(response: unknown = acknowledgement()) {
  const calls: { name: string; args: unknown; headers: Headers }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
    if (path === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', aud: 'authenticated',
      is_anonymous: false, app_metadata: {}, user_metadata: {}, identities: [], created_at: '2026-10-28T00:00:00Z' });
    calls.push({ name: path.split('/').at(-1)!, args: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    return response instanceof Response ? response : Response.json(response);
  };
  const client = createBearerUserClient({ url: 'https://synthetic-submit.example.invalid', publishableKey: 'sb_publishable_synthetic-submit', accessToken: token }, { fetch: fetcher });
  return { specs: await createCentralSpecs(client), calls };
}

test('submission uses only the verified user RPC, exact original text, optimistic version and fixed trace headers', async () => {
  const { specs, calls } = await fixture();
  const input = { source_text: '\ufeffنحتاج ثلاثة أشخاص\r\nRole: Waiter', row_version: 7 };
  assert.deepEqual(await specs.submitSpecs(actor, workspace, input, context), acknowledgement());
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'eps_submit_specs');
  assert.deepEqual(calls[0].args, { p_workspace_id: workspace, p_input: input, p_idempotency_key: context.idempotencyKey });
  assert.equal(calls[0].headers.get('x-eps-client-type'), 'mcp');
  assert.equal(calls[0].headers.get('x-eps-request-id'), context.requestId);
  assert.equal(calls[0].headers.get('authorization'), `Bearer ${token}`);
});

test('reused durable jobs preserve every real acknowledgement status', async () => {
  for (const status of ['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled']) {
    const { specs } = await fixture(acknowledgement(status));
    assert.equal((await specs.submitSpecs(actor, workspace, { source_text: 'Synthetic source' }, context)).status, status);
  }
});

test('forged actor, missing intent, invalid source and injected configuration never reach a submit RPC', async () => {
  const { specs, calls } = await fixture();
  await assert.rejects(specs.submitSpecs({ principal_id: 'other' }, workspace, { source_text: 'Source' }, context));
  await assert.rejects(specs.submitSpecs(actor, workspace, { source_text: 'Source' }));
  await assert.rejects(specs.submitSpecs(actor, workspace, { source_text: 'Source' }, { ...context, idempotencyKey: 'short' }));
  for (const input of [{ source_text: 'Source', source_asset_id: 'asset' }, { source_text: '\ud800' },
    { source_text: 'Source', model: 'injected' }, { source_text: 'Source', row_version: 0 }]) {
    await assert.rejects(specs.submitSpecs(actor, workspace, input as never, context));
  }
  assert.equal(calls.length, 0);
});

test('submission rejects private fields, unrelated polling destinations and malformed durable receipts', async () => {
  for (const value of [{ ...acknowledgement(), lease_token: 'synthetic-private' },
    { ...acknowledgement(), poll_url: 'https://untrusted.example.invalid/jobs' },
    { ...acknowledgement(), poll_url: '/api/v1/jobs/another' },
    { ...acknowledgement(), status: 'accepted' }, { ...acknowledgement(), resource_id: null }]) {
    const { specs } = await fixture(value);
    await assert.rejects(specs.submitSpecs(actor, workspace, { source_text: 'Synthetic source' }, context),
      (error: unknown) => error instanceof DomainError && error.code === 'CENTRAL_RESPONSE_INVALID');
  }
});

test('unready source processing and protected source changes remain safe actionable failures', async () => {
  for (const [code, status] of [['FEATURE_NOT_IMPLEMENTED', 503], ['STALE_RESOURCE_VERSION', 409], ['CAPABILITY_REQUIRED', 403]] as const) {
    const { specs } = await fixture(Response.json({ code: 'P0001', message: code, details: 'synthetic private provider body' }, { status: 400 }));
    await assert.rejects(specs.submitSpecs(actor, workspace, { source_text: 'Synthetic source' }, context),
      (error: unknown) => error instanceof DomainError && error.code === code && error.status === status
        && !error.message.includes('private provider'));
  }
  const { specs } = await fixture(Response.json({ code: 'PGRST202', message: 'synthetic private SQL body' }, { status: 404 }));
  await assert.rejects(specs.submitSpecs(actor, workspace, { source_text: 'Synthetic source' }, context),
    (error: unknown) => error instanceof DomainError && error.code === 'FEATURE_NOT_IMPLEMENTED' && error.status === 503);
});
