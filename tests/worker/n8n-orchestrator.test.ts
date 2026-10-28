import assert from 'node:assert/strict';
import test from 'node:test';
import { N8nSpecsOrchestrator, validateSpecsWorkOrder } from '../../apps/worker/src/n8n-orchestrator.ts';

const scope = { event_id: 'event-synthetic', event_type: 'job.stage_ready' as const, contract_version: '1.0' as const,
  job_id: 'job-synthetic', kind: 'specs_extract' as const, stage: 'extract_specs' as const, input_hash: 'a'.repeat(64), correlation_id: 'correlation-synthetic' };
const order = { schema_version: '1.0' as const, event_id: scope.event_id, job_id: scope.job_id, kind: scope.kind,
  stage: scope.stage, input_hash: scope.input_hash, correlation_id: scope.correlation_id, workflow_execution_id: 'actual-workflow-execution', handler: 'openai.extract_specs' as const };
const config = { url: 'https://synthetic.app.n8n.cloud/webhook/studio-specs', secret: 'synthetic-runtime-only-secret-123456789' };

test('strict work orders bind every stage scope field and allow no arbitrary handler, URL, or payload', () => {
  assert.deepEqual(validateSpecsWorkOrder(order, scope), order);
  for (const change of [{ job_id: 'other' }, { event_id: 'other' }, { stage: 'apply_specs' }, { handler: 'run_shell' },
    { input_hash: 'b'.repeat(64) }, { correlation_id: 'other' }, { schema_version: '2.0' }, { workflow_execution_id: '' }, { url: 'https://attacker.test' }]) {
    assert.throws(() => validateSpecsWorkOrder({ ...order, ...change }, scope));
  }
});
test('authenticated n8n request carries metadata only and requires a real structured workflow result', async () => {
  const router = new N8nSpecsOrchestrator(config, async (url, init) => {
    assert.equal(url, config.url); assert.equal(init?.redirect, 'error');
    assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${config.secret}`);
    assert.deepEqual(JSON.parse(init?.body as string), scope);
    return Response.json(order);
  });
  assert.deepEqual(await router.route(scope), order);
  for (const response of [new Response('Workflow got started'), Response.json({ accepted: true }), Response.json({ ...order, source_text: 'private' }),
    new Response('private server diagnostics', { status: 503 })]) {
    await assert.rejects(new N8nSpecsOrchestrator(config, async () => response).route(scope), error => {
      assert.ok(!(error as Error).message.includes('private')); return true;
    });
  }
});
test('an unresponsive fetch cannot defeat deadline or caller abort', async () => {
  let passedSignal: AbortSignal | undefined;
  const router = new N8nSpecsOrchestrator({ ...config, timeoutMs: 10 }, async (_url, init) => {
    passedSignal = init?.signal as AbortSignal; return await new Promise(() => undefined);
  });
  await assert.rejects(router.route(scope)); assert.equal(passedSignal?.aborted, true);
  const controller = new AbortController(); const pending = new N8nSpecsOrchestrator(config, async () => await new Promise(() => undefined)).route(scope, controller.signal);
  controller.abort(); await assert.rejects(pending);
});
test('unsafe or missing runtime configuration cannot create an orchestration bypass', () => {
  for (const change of [{ url: 'http://localhost:3000' }, { url: 'https://host/webhook-test/abc' }, { url: 'https://host/webhook/x?token=value' }, { secret: '' }]) {
    assert.throws(() => new N8nSpecsOrchestrator({ ...config, ...change }));
  }
});
