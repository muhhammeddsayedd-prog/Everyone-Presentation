import assert from 'node:assert/strict';
import test from 'node:test';
import type { JobEvent, JobEventReceipt, JsonObject, StageLease } from '@eps/jobs';
import { IntegrationError } from '../../packages/integrations/src/errors.ts';
import { proposeWording, type WordingInput } from '../../packages/integrations/src/openai-wording.ts';
import { executeReviewStage, type ReviewStageGateway } from '../../apps/worker/src/review-stage-executor.ts';

const config = { apiKey: 'synthetic-wording-key', model: 'gpt-6.1-sol' };
const context = { schema_version: '1.0', workspace_id: 'synthetic-workspace', target_type: 'assignment', target_id: 'synthetic-assignment', target_row_version: 3,
  field: 'skills_experience', source_text: 'I worked in 2 student films, but no television commercials.', instruction: 'Shorten supplied facts only.', capability: 'slide_shorten',
  budget: { max_characters: 100, max_lines: 2 }, template: { key: 'everyone-casting', version: '1.0', content_sha256: 'b'.repeat(64), font_key: 'everyone-default' },
  configuration: { model: config.model, prompt_version: 'contextual_suggestion_v1' }, input_hash: 'a'.repeat(64) };
const input = (): WordingInput => Object.fromEntries(['input_hash', 'target_type', 'target_id', 'target_row_version', 'field', 'source_text', 'instruction', 'capability', 'budget', 'template'].map(key => [key, context[key as keyof typeof context]])) as unknown as WordingInput;
async function proposal() {
  return proposeWording(input(), config, undefined, async () => ({ id: 'resp_synthetic', model: config.model, status: 'completed', error: null,
    output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({ schema_version: '1.0', assignment_id: context.target_id, field: context.field, suggested_text: '2 student films; no TV commercials.', facts_preserved: ['2 student films'], warnings: [] }) }] }],
    usage: { input_tokens: 50, output_tokens: 20, total_tokens: 70 } }));
}
function harness(stage: string) {
  const lease: StageLease = { job_id: 'synthetic-job', attempt_id: 'synthetic-attempt', stage, lease_token: 'synthetic-lease', lease_expires_at: new Date(Date.now() + 90000).toISOString(), already_completed: false, input: structuredClone(context) as JsonObject };
  const events: JobEvent[] = []; let generated: unknown = null; let reads = 0; let writes = 0;
  const gateway: ReviewStageGateway = {
    async getInput(scope) { reads++; assert.deepEqual(scope, { job_id: lease.job_id, attempt_id: lease.attempt_id, lease_token: lease.lease_token }); return { ...structuredClone(context), job_id: lease.job_id, attempt_id: lease.attempt_id, stage, generated }; },
    async recordEvent(event) { writes++; events.push(structuredClone(event)); return { event_id: event.event_id, applied: true, duplicate: false, stale: false, job_status: stage === 'validate_suggestion' && event.event_type === 'succeeded' ? 'succeeded' : 'running' }; },
  };
  return { lease, gateway, events, counts: () => ({ reads, writes }), generated: (value: unknown) => { generated = value; } };
}

test('prepare/generate/validate each publish one fenced stage result and never apply business fields', async () => {
  const supplied = await proposal(); let providerCalls = 0;
  for (const [stage, schema] of [['prepare_suggestion', 'suggestion-preparation.v1'], ['generate_suggestion', 'contextual-suggestion.v1'], ['validate_suggestion', 'suggestion-validation.v1']]) {
    const h = harness(stage); if (stage === 'validate_suggestion') h.generated(supplied);
    const output = await executeReviewStage(h.lease, h.gateway, { openAI: config, generate: async current => { providerCalls++; assert.deepEqual(current, input()); return supplied; } });
    assert.equal(output.already_completed, false); assert.equal(h.events.length, 1); assert.equal(h.events[0].event_type, 'succeeded'); assert.equal(h.events[0].result_schema, schema);
    assert.equal(h.events[0].input_hash, context.input_hash); assert.equal(h.events[0].sequence, 1);
    if (stage === 'prepare_suggestion') assert.deepEqual(h.events[0].result, { schema_version: '1.0', target_id: context.target_id, target_row_version: context.target_row_version, field: context.field, source_text: context.source_text });
    else assert.deepEqual(h.events[0].result, supplied);
  }
  assert.equal(providerCalls, 1);
});

test('completed-stage replay and invalid scope perform no provider or gateway operation', async () => {
  const h = harness('generate_suggestion'); h.lease.already_completed = true; let providerCalls = 0;
  assert.deepEqual(await executeReviewStage(h.lease, h.gateway, { openAI: config, generate: async () => { providerCalls++; return proposal(); } }), { already_completed: true, receipt: null });
  assert.deepEqual(h.counts(), { reads: 0, writes: 0 }); assert.equal(providerCalls, 0);
  for (const change of [{ stage: 'apply_specs' }, { lease_expires_at: '2000-01-01T00:00:00Z' }, { lease_token: 'bad token' }, { input: { ...context, input_hash: 'invalid' } }]) {
    await assert.rejects(executeReviewStage({ ...h.lease, already_completed: false, ...change } as StageLease, h.gateway, { openAI: config }));
  }
  assert.deepEqual(h.counts(), { reads: 0, writes: 0 });
});

test('canonical field, model, template or frozen-source mismatch prevents provider work', async () => {
  for (const patch of [{ source_text: 'unrelated changed facts' }, { target_row_version: 4 }, { input_hash: 'c'.repeat(64) },
    { template: { ...context.template, content_sha256: 'c'.repeat(64) } }, { configuration: { ...context.configuration, model: 'different-model' } }, { arbitrary_url: 'https://untrusted.invalid' }]) {
    const h = harness('generate_suggestion'); const original = h.gateway.getInput; h.gateway.getInput = async (...args) => ({ ...await original(...args) as object, ...patch }); let calls = 0;
    await assert.rejects(executeReviewStage(h.lease, h.gateway, { openAI: config, generate: async () => { calls++; return proposal(); } }));
    assert.equal(calls, 0); assert.equal(h.events.length, 0);
  }
});

test('validate rechecks immutable proposal metadata/diff and never calls a model', async () => {
  const value = await proposal();
  for (const bad of [{ ...value, proposed_changes: [{ field: 'position', old_value: 'option', new_value: 'main' }] }, { ...value, metadata: { ...value.metadata, input_sha256: 'c'.repeat(64) } }, null]) {
    const h = harness('validate_suggestion'); h.generated(bad); let calls = 0;
    const result = await executeReviewStage(h.lease, h.gateway, { openAI: config, generate: async () => { calls++; return value; } });
    assert.equal(result.already_completed, false); assert.equal(calls, 0); assert.equal(h.events.at(-1)?.event_type, 'failed'); assert.equal(h.events.at(-1)?.error?.code, 'RESULT_INVALID');
  }
});

test('a lost final callback retries its exact event without recomputing the proposal', async () => {
  const value = await proposal(); const h = harness('generate_suggestion'); let requests = 0; let calls = 0; const sent: JobEvent[] = [];
  h.gateway.recordEvent = async event => { sent.push(structuredClone(event)); requests++; if (requests === 1) throw Object.assign(new Error('synthetic transport'), { code: 'RUNTIME_UNAVAILABLE', outcome: 'unknown', gateway_phase: 'commit', transport_code: 'ECONNRESET' });
    return { event_id: event.event_id, applied: false, duplicate: true, stale: false, job_status: 'running' }; };
  const output = await executeReviewStage(h.lease, h.gateway, { openAI: config, gatewayTimeoutMs: 2000, generate: async () => { calls++; return value; } });
  assert.equal(output.receipt?.duplicate, true); assert.equal(calls, 1); assert.equal(requests, 2); assert.deepEqual(sent[0], sent[1]);
});

test('provider failure is redacted and classified; cancellation never commits a proposal', async () => {
  const h = harness('generate_suggestion');
  await executeReviewStage(h.lease, h.gateway, { openAI: config, generate: async () => { throw new IntegrationError('OPENAI_UNAVAILABLE', 'private-provider-body', true); } });
  assert.equal(h.events.at(-1)?.error?.retryable, true); assert.equal(JSON.stringify(h.events).includes('private-provider'), false);
  const canceled = harness('generate_suggestion'); const controller = new AbortController();
  await assert.rejects(executeReviewStage(canceled.lease, canceled.gateway, { openAI: config, signal: controller.signal, generate: async () => { controller.abort(); return proposal(); } }), { code: 'PROCESSING_CANCELLED' });
  assert.equal(canceled.events.length, 0);
});

test('heartbeats serialize before completion and stale ownership suppresses late output', async () => {
  const value = await proposal(); const h = harness('generate_suggestion');
  await executeReviewStage(h.lease, h.gateway, { openAI: config, heartbeatMs: 10, generate: async () => { await new Promise(resolve => setTimeout(resolve, 35)); return value; } });
  assert.ok(h.events.filter(event => event.event_type === 'heartbeat').length >= 1); assert.equal(h.events.at(-1)?.event_type, 'succeeded');
  assert.deepEqual(h.events.map(event => event.sequence), h.events.map((_event, index) => index + 1));
  const stale = harness('generate_suggestion'); stale.gateway.recordEvent = async (event): Promise<JobEventReceipt> => ({ event_id: event.event_id, applied: false, duplicate: false, stale: true, job_status: 'running' });
  await assert.rejects(executeReviewStage(stale.lease, stale.gateway, { openAI: config, heartbeatMs: 10, generate: async () => { await new Promise(resolve => setTimeout(resolve, 35)); return value; } }), { code: 'LEASE_STALE' });
});
