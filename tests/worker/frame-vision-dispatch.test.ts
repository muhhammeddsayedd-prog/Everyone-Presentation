import assert from 'node:assert/strict';
import test from 'node:test';
import type { StageReadyEnvelope } from '@eps/integrations';
import { N8nSpecsOrchestrator, validateSpecsWorkOrder } from '../../apps/worker/src/n8n-orchestrator.ts';
// @ts-expect-error reviewed Node ESM builder has no generated TS declaration
import { mapCandidateStageEnvelope } from '../../tools/build-candidate-wf02.mjs';

const pairs = [
  ['candidate_scan', 'prepare_candidate', 'native.prepare_candidate'],
  ['candidate_scan', 'transcribe_candidate', 'openai.transcribe_candidate'],
  ['candidate_scan', 'extract_candidate', 'openai.extract_candidate'],
  ['candidate_scan', 'select_frames', 'openai.select_frames'],
  ['candidate_scan', 'apply_candidate', 'domain.apply_candidate'],
  ['frame_extract', 'extract_frames', 'native.extract_frames'],
  ['frame_extract', 'apply_frames', 'domain.apply_frames'],
] as const;
const base = { event_id: 'synthetic-vision-event', event_type: 'job.stage_ready' as const, contract_version: '1.0' as const,
  job_id: 'synthetic-vision-job', input_hash: 'a'.repeat(64), correlation_id: 'synthetic-vision-correlation' };
const selectScope: StageReadyEnvelope = { ...base, kind: 'candidate_scan', stage: 'select_frames' };
const config = { url: 'https://synthetic.app.n8n.cloud/webhook/eps-wf02-candidate-stage-v1', secret: 'synthetic-runtime-only-secret-123456789' };
const errorCode = (error: unknown) => { assert.equal((error as { code?: string }).code, 'N8N_WORK_ORDER_INVALID'); return true; };

function expected(scope: StageReadyEnvelope, handler: string, executionId = 'synthetic-execution') {
  return { schema_version: '1.0', event_id: scope.event_id, job_id: scope.job_id, kind: scope.kind, stage: scope.stage,
    input_hash: scope.input_hash, correlation_id: scope.correlation_id, workflow_execution_id: executionId, handler };
}
test('all seven candidate/frame envelopes cross the WF02 mapper and worker validator with exact handlers', () => {
  for (const [kind, stage, handler] of pairs) {
    const scope: StageReadyEnvelope = { ...base, kind, stage };
    const result = mapCandidateStageEnvelope(scope, 'synthetic-execution');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, expected(scope, handler));
    assert.deepEqual(validateSpecsWorkOrder(result.body, scope), result.body);
    assert.equal(Object.keys(result.body).length, 9);
  }
});

test('new frame-selection work orders reject the legacy native handler and every scope or payload mutation', () => {
  const order = expected(selectScope, 'openai.select_frames');
  assert.deepEqual(validateSpecsWorkOrder(order, selectScope), order);
  for (const patch of [{ handler: 'native.select_frames' }, { handler: 'native.extract_frames' }, { kind: 'frame_extract' },
    { stage: 'extract_frames' }, { job_id: 'foreign-job' }, { event_id: 'foreign-event' }, { input_hash: 'b'.repeat(64) },
    { correlation_id: 'foreign-correlation' }, { schema_version: '2.0' }, { workflow_execution_id: '' },
    { source_text: 'synthetic-untrusted-text' }, { image_url: 'https://attacker.test/frame.jpg' }, { metadata: {} }]) {
    assert.throws(() => validateSpecsWorkOrder({ ...order, ...patch }, selectScope), errorCode);
  }
  const copy = validateSpecsWorkOrder(order, selectScope); copy.handler = 'native.prepare_candidate';
  assert.equal(order.handler, 'openai.select_frames');
});

test('authenticated routing sends only the eight metadata fields for every stage and requires bound JSON responses', async () => {
  for (const [kind, stage, handler] of pairs) {
    const scope: StageReadyEnvelope = { ...base, kind, stage };
    const router = new N8nSpecsOrchestrator(config, async (url, init) => {
      assert.equal(url, config.url); assert.equal(init?.method, 'POST'); assert.equal(init?.redirect, 'error');
      assert.deepEqual(init?.headers, { Authorization: `Bearer ${config.secret}`, 'Content-Type': 'application/json',
        Accept: 'application/json', 'Idempotency-Key': base.event_id, 'X-Request-ID': base.correlation_id });
      assert.deepEqual(JSON.parse(init?.body as string), scope);
      assert.equal(Object.keys(JSON.parse(init?.body as string)).length, 8);
      return Response.json(mapCandidateStageEnvelope(scope, 'synthetic-execution').body);
    });
    assert.deepEqual(await router.route(scope), expected(scope, handler));
  }
  await assert.rejects(new N8nSpecsOrchestrator(config, async () => Response.json(expected(selectScope, 'native.select_frames'))).route(selectScope), errorCode);
  for (const response of [new Response('synthetic private diagnostics', { status: 401 }),
    new Response('synthetic private diagnostics', { status: 500 }), Response.json({ accepted: true }),
    new Response('synthetic private diagnostics', { headers: { 'Content-Type': 'text/plain' } })]) {
    await assert.rejects(new N8nSpecsOrchestrator(config, async () => response).route(selectScope), error => {
      assert.ok(!(error as Error).message.includes('private')); return true;
    });
  }
});

