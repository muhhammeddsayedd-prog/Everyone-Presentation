import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IntegrationError, N8nDispatcher, n8nDispatchConfigFromEnv } from '../../packages/integrations/src/index.ts';
import type { StageReadyEnvelope } from '../../packages/integrations/src/index.ts';

// Injected HTTP fixtures only. No n8n workflow is executed by these tests.
const config = { url: 'https://fixture.invalid/webhook/stage-ready', secret: 'synthetic-unit-dispatch-secret-32-characters' };
const envelope: StageReadyEnvelope = {
  event_id: 'event-1', event_type: 'job.stage_ready', contract_version: '1.0', job_id: 'job-1',
  kind: 'specs_extract', stage: 'prepare_document', input_hash: 'b'.repeat(64), correlation_id: 'request-1',
};
const code = (expected: string) => (error: unknown) => error instanceof IntegrationError && error.code === expected;

test('dispatch sends a bounded IDs-only envelope with header auth, idempotency and no redirects', async () => {
  let calls = 0;
  const dispatcher = new N8nDispatcher(config, async (url, init) => {
    calls++;
    assert.equal(url, config.url);
    assert.equal(init.redirect, 'error');
    const headers = new Headers(init.headers);
    assert.equal(headers.get('authorization'), `Bearer ${config.secret}`);
    assert.equal(headers.get('idempotency-key'), envelope.event_id);
    assert.equal(headers.get('x-request-id'), envelope.correlation_id);
    assert.deepEqual(JSON.parse(String(init.body)), envelope);
    assert.ok(!String(init.body).includes(config.secret));
    return new Response(null, { status: 202 });
  });
  assert.deepEqual(await dispatcher.dispatch(envelope), { accepted: true, event_id: 'event-1', http_status: 202 });
  assert.equal(calls, 1);
});

test('untrusted envelope fields and invalid destinations fail before HTTP', async () => {
  let called = false;
  const dispatcher = new N8nDispatcher(config, async () => { called = true; return new Response(null, { status: 200 }); });
  await assert.rejects(dispatcher.dispatch({ ...envelope, transcript: 'private data' } as StageReadyEnvelope), code('DISPATCH_ENVELOPE_INVALID'));
  await assert.rejects(dispatcher.dispatch({ ...envelope, stage: 'arbitrary-shell' } as unknown as StageReadyEnvelope), code('DISPATCH_ENVELOPE_INVALID'));
  assert.equal(called, false);
  for (const url of ['http://fixture.invalid/webhook/x', 'https://user:password@fixture.invalid/webhook/x',
    'https://fixture.invalid/webhook/x?token=secret', 'https://fixture.invalid/webhook-test/x']) {
    assert.throws(() => new N8nDispatcher({ ...config, url }), code('N8N_CONFIGURATION_INVALID'));
  }
  assert.throws(() => n8nDispatchConfigFromEnv({}), code('N8N_CONFIGURATION_REQUIRED'));
});

test('dispatch response errors expose status/retry hint only and do not retry internally', async () => {
  let calls = 0;
  const dispatcher = new N8nDispatcher(config, async () => {
    calls++; return new Response(`private-body-${config.secret}`, { status: 429, headers: { 'Retry-After': '2' } });
  });
  await assert.rejects(dispatcher.dispatch(envelope), (error: unknown) => {
    assert.ok(error instanceof IntegrationError);
    assert.equal(error.retryable, true); assert.equal(error.details.retry_after_ms, 2000);
    assert.ok(!JSON.stringify(error).includes(config.secret)); return true;
  });
  assert.equal(calls, 1);
  await assert.rejects(new N8nDispatcher(config, async () => new Response(null, { status: 403 })).dispatch(envelope), code('N8N_DISPATCH_ACCESS_DENIED'));
  await assert.rejects(new N8nDispatcher(config, async () => new Response(null, { status: 404 })).dispatch(envelope), code('N8N_DISPATCH_REJECTED'));
});

test('timeout and caller cancellation are distinct bounded outcomes', async () => {
  const dispatcher = new N8nDispatcher({ ...config, timeoutMs: 1 }, async () =>
    new Promise<Response>((_resolve, reject) => setTimeout(() => reject(new Error('private timeout')), 10)));
  await assert.rejects(dispatcher.dispatch(envelope), code('N8N_DISPATCH_TIMEOUT'));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(new N8nDispatcher(config, async () => new Response(null, { status: 200 })).dispatch(envelope, controller.signal), code('PROCESSING_CANCELLED'));
});
