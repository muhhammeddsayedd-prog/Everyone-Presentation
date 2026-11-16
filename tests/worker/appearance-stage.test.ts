import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { JobEvent } from '@eps/jobs';
import { executeAppearanceStage, type AppearanceFilesPort } from '../../apps/worker/src/appearance-stage-executor.ts';
import { analyzeAppearance, APPEARANCE_ATTRIBUTE_KEYS } from '../../packages/integrations/src/openai-appearance.ts';
import { validateSpecsWorkOrder } from '../../apps/worker/src/n8n-orchestrator.ts';
import { appearanceAccessFromGrant } from '../../packages/central/src/appearance-runtime-assets.ts';

// Synthetic bytes, recorded provider answers and an in-memory gateway: no network, storage, database or provider.
const job = '7a000000-0000-4000-8000-000000000001', attempt = '7a000000-0000-4000-8000-000000000002', candidate = '7a000000-0000-4000-8000-000000000003';
const photo = '7a000000-0000-4000-8000-000000000011', frame = '7a000000-0000-4000-8000-000000000012';
const bytes = { [photo]: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 1]), [frame]: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 2, 2]) };
const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const inputHash = 'c'.repeat(64);
const media = [
  { media_ref: 'm1', asset_id: photo, source_kind: 'photo', candidate_media_id: null, frame_timestamp_ms: null, mime_type: 'image/jpeg', size_bytes: 6, sha256: sha(bytes[photo]), width: 400, height: 500 },
  { media_ref: 'm2', asset_id: frame, source_kind: 'frame', candidate_media_id: '7a000000-0000-4000-8000-000000000021', frame_timestamp_ms: 1500, mime_type: 'image/jpeg', size_bytes: 6, sha256: sha(bytes[frame]), width: 640, height: 360 }];
const stageInput = (model = 'configured-model') => ({ schema_version: '1.0', batch_id: '7a000000-0000-4000-8000-000000000031', item_id: '7a000000-0000-4000-8000-000000000032', candidate_id: candidate,
  configuration: { model, prompt_version: 'appearance-v1', schema_version: '1.0', taxonomy_version: 'appearance-taxonomy.v1', max_images: 6 }, media, input_hash: inputHash, job_id: job, attempt_id: attempt, stage: 'analyze_appearance' });
const lease = () => ({ job_id: job, stage: 'analyze_appearance', attempt_id: attempt, lease_token: 'd'.repeat(64), lease_expires_at: new Date(Date.now() + 60_000).toISOString(), already_completed: false, input: { input_hash: inputHash } });
function harness(options: { model?: string; tamper?: boolean; providerUsage?: boolean; badOutput?: boolean } = {}) {
  const events: JobEvent[] = []; const fetched: string[] = []; const sent: unknown[] = [];
  const gateway = { async getInput() { return stageInput(options.model); },
    async recordEvent(event: JobEvent) { events.push(event); return { event_id: event.event_id, applied: true, duplicate: false, stale: false, job_status: event.event_type === 'succeeded' ? 'succeeded' as const : event.event_type === 'failed' ? 'failed' as const : 'running' as const }; } };
  const files: AppearanceFilesPort = { async getAssetAccess(input) {
    const item = media.find(entry => entry.asset_id === input.asset_id)!;
    return appearanceAccessFromGrant({ asset_id: item.asset_id, bucket: item.source_kind === 'photo' ? 'eps-candidate-photos' : 'eps-candidate-outputs',
      object_key: item.source_kind === 'photo' ? `archive/${item.asset_id}.jpg` : `jobs/${job}/attempts/${attempt}/${item.asset_id}.jpg`, permission: 'read', grant_token: 'g'.repeat(43),
      expires_at: new Date(Date.now() + 30_000).toISOString(), mime_type: 'image/jpeg', size_bytes: 6, sha256: item.sha256 }, input, 'sb_publishable_synthetic'); } };
  const fetcher = (async (url: string, init: RequestInit) => { fetched.push(url); assert.equal((init.headers as Record<string, string>)['x-eps-asset-grant'], 'g'.repeat(43));
    const id = url.match(/([a-f0-9-]{36})\.jpg$/u)![1]; const body = options.tamper && id === frame ? Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 9, 9]) : bytes[id];
    return new Response(new Uint8Array(body), { headers: { 'Content-Type': 'image/jpeg' } }); }) as typeof fetch;
  const analyze: typeof analyzeAppearance = (input, configuration, signal) => analyzeAppearance(input, configuration, signal, async request => {
    sent.push(request);
    const people = [{ person_index: 0, position_note: null, attributes: Object.fromEntries(APPEARANCE_ATTRIBUTE_KEYS.map(key => [key, { value: key === 'hair_length' ? 'long' : 'unknown', confidence: 'medium', evidence: null }])) }];
    const payload = { schema_version: '1.0', media: options.badOutput ? [] : ['m1', 'm2'].map(ref => ({ media_ref: ref, media_category: 'headshot', people_count: 1, ambiguous: false, quality_note: null, people })) };
    return { id: 'resp_synthetic', model: 'configured-model-snapshot', status: 'completed', usage: { input_tokens: 1200, output_tokens: 300, total_tokens: 1500 },
      output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(payload) }] }] };
  });
  return { events, fetched, sent, run: () => executeAppearanceStage(lease(), gateway, { openAI: { apiKey: 'synthetic-key', model: 'configured-model' }, files, fetch: fetcher, analyze, heartbeatMs: 10_000 }) };
}

test('reads frozen photo and frame through scoped grants and posts the validated result once', async () => {
  const h = harness(); const outcome = await h.run();
  assert.equal(outcome.receipt?.applied, true); assert.equal(h.events.length, 1);
  const [event] = h.events; assert.equal(event.event_type, 'succeeded'); assert.equal(event.result_schema, 'candidate-appearance-result.v1');
  const result = event.result as unknown as { model: string; usage: unknown; media: { asset_id: string; media_category: string }[] };
  assert.equal(result.model, 'configured-model-snapshot'); assert.deepEqual(result.usage, { input_tokens: 1200, output_tokens: 300 });
  assert.deepEqual(result.media.map(item => [item.asset_id, item.media_category]), [[photo, 'headshot'], [frame, 'video_frame']]);
  assert.deepEqual(h.fetched, [`https://pyibofyctwnqpvktepse.supabase.co/storage/v1/object/authenticated/eps-candidate-photos/archive/${photo}.jpg`,
    `https://pyibofyctwnqpvktepse.supabase.co/storage/v1/object/authenticated/eps-candidate-outputs/jobs/${job}/attempts/${attempt}/${frame}.jpg`]);
  assert.equal(JSON.stringify(event).includes('base64'), false, 'no image bytes in the event');
});
test('a tampered image never reaches the provider and fails retryably', async () => {
  const h = harness({ tamper: true }); await h.run();
  assert.equal(h.sent.length, 0); assert.equal(h.events[0].event_type, 'failed'); assert.equal(h.events[0].error?.code, 'DEPENDENCY_UNAVAILABLE'); assert.equal(h.events[0].error?.retryable, true);
});
test('a worker configured with another model refuses the frozen job without calling the provider', async () => {
  const h = harness({ model: 'other-model' }); await h.run();
  assert.equal(h.sent.length, 0); assert.equal(h.events[0].event_type, 'failed'); assert.equal(h.events[0].error?.retryable, false);
});
test('an invalid provider result fails non-retryably and still reports usage for the spend cap', async () => {
  const h = harness({ badOutput: true }); await h.run();
  assert.equal(h.events[0].error?.code, 'RESULT_INVALID'); assert.deepEqual(h.events[0].error?.details, { usage: { input_tokens: 1200, output_tokens: 300 } });
});
test('n8n work orders route analyze_appearance to the OpenAI handler', () => {
  const envelope = { event_id: '7a000000-0000-4000-8000-000000000041', event_type: 'job.stage_ready', contract_version: '1.0', job_id: job, kind: 'candidate_appearance', stage: 'analyze_appearance', input_hash: inputHash, correlation_id: job } as const;
  const order = validateSpecsWorkOrder({ schema_version: '1.0', event_id: envelope.event_id, job_id: job, kind: 'candidate_appearance', stage: 'analyze_appearance', input_hash: inputHash,
    correlation_id: job, workflow_execution_id: 'n8n-1', handler: 'openai.analyze_appearance' }, envelope);
  assert.equal(order.handler, 'openai.analyze_appearance');
  assert.throws(() => validateSpecsWorkOrder({ ...order, handler: 'domain.apply_candidate' }, envelope));
  assert.throws(() => appearanceAccessFromGrant({ asset_id: photo, bucket: 'eps-candidate-assets', object_key: 'assets/x/original.mp4', permission: 'read', grant_token: 'g'.repeat(43),
    expires_at: new Date(Date.now() + 30_000).toISOString(), mime_type: 'image/jpeg', size_bytes: 6, sha256: 'a'.repeat(64) }, { job_id: job, attempt_id: attempt, lease_token: 'd'.repeat(64), asset_id: photo }, 'sb_publishable_synthetic'));
});
