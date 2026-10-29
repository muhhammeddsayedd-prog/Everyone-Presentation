import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { JobEvent, StageLease } from '@eps/jobs';
import { executeCandidateStage, type CandidateStageAssets, type CandidateStageDiagnostic, type CandidateStageGateway, type CandidateStageOptions } from '../../apps/worker/src/candidate-stage-executor.ts';
import { IntegrationError } from '../../packages/integrations/src/errors.ts';
import { VideoPreparationError, type PreparedVideo } from '../../apps/worker/src/video-types.ts';
import { createCandidateStageAssets } from '../../apps/worker/src/candidate-assets.ts';
import { createJobService } from '../../packages/jobs/src/index.ts';
import { MemoryJobRepository, type MemoryTransaction } from '../jobs/memory-repository.ts';
import { SpecsRuntimeGatewayError } from '../../packages/central/src/specs-runtime-gateway.ts';
const bytes = new Uint8Array([1, 2, 3]); const hash = createHash('sha256').update(bytes).digest('hex');
const configuration = { media_preparation_version: 'video-preparation.v1', prompt_version: 'candidate_extract_v1', result_schema_version: '1.0', transcription_model_version: 'transcription-test', extraction_model_version: 'extraction-test' };
const lease = (stage = 'prepare_candidate'): StageLease => ({ job_id: 'job1', stage, attempt_id: 'attempt1', lease_token: 'private-test-token', lease_expires_at: new Date(Date.now() + 90_000).toISOString(), already_completed: false, input: { input_hash: 'a'.repeat(64), configuration } });
const source = { asset_id: 'source1', sha256: hash, size_bytes: bytes.length, mime_type: 'video/mp4' };
const prepared: PreparedVideo = { source_asset_id: 'source1', source_sha256: hash, probe: { duration_ms: 1000, width: 10, height: 10, rotation_degrees: 0, frame_rate: 25, video_codec: 'h264', audio_codec: null, has_audio: false, container: 'mov,mp4,m4a,3gp,3g2,mj2', source_start_ms: 0 }, audio_chunks: [], sampled_frames: [{ frame_asset_id: 'temporary-frame', source_asset_id: 'source1', timestamp_ms: 500, width: 10, height: 10, sha256: hash, bytes, quality_flags: [], quality: { luminance: 100, contrast: 20, sharpness: 20, difference_hash: '0000000000000000' } }], warnings: ['NO_AUDIO_STREAM'], implementation_version: 'video-preparation.v1', ffmpeg_version: 'ffmpeg version test' };
function setup(stage = 'prepare_candidate') {
  const events: JobEvent[] = []; const writes: unknown[] = []; const active = lease(stage);
  const input = { job_id: active.job_id, attempt_id: active.attempt_id, stage, input_hash: active.input.input_hash, configuration, source };
  const assets: CandidateStageAssets = { read: async () => bytes, write: async (_scope, output) => { writes.push(output); return { asset_id: 'saved-frame1', sha256: output.sha256, size_bytes: output.bytes.length, mime_type: output.mime_type }; } };
  const options: CandidateStageOptions = { assets, imageId: `sha256:${'a'.repeat(64)}`, transcription: { apiKey: 'synthetic', model: 'transcription-test' }, extraction: { apiKey: 'synthetic', model: 'extraction-test' }, prepare: async () => prepared };
  const gateway: CandidateStageGateway = { getInput: async () => input, recordEvent: async (event: JobEvent) => { events.push(event); return { event_id: event.event_id, applied: true, duplicate: false, stale: false, job_status: 'running' as const }; } };
  return { events, writes, active, input, assets, options, gateway };
}

test('frame selection inspects verified sampled bytes through the scoped port and records vision provenance', async () => {
  const state = setup('select_frames'); let reads = 0; let selected = 0;
  state.gateway.getInput = async () => ({ ...state.input, prepared });
  Object.assign(state.options.assets, { readFrame: async (_scope: unknown, reference: { asset_id: string; sha256: string }) => { reads++; assert.equal(reference.asset_id, 'temporary-frame'); assert.equal(reference.sha256, hash); return bytes; } });
  Object.assign(state.options, { selectFrames: async (input: { source_asset_id: string; frames: { bytes: Uint8Array }[] }) => {
    selected++; assert.equal(input.source_asset_id, source.asset_id); assert.deepEqual(input.frames[0].bytes, bytes);
    return { result: { schema_version: '1.0', source_asset_id: source.asset_id, selected_frames: [{ frame_asset_id: 'temporary-frame', reason: 'Clear real source frame.' }], insufficient_frames_reason: 'One verified sample available.' }, metadata: { provider: 'openai', sdk_version: '7.45.1', requested_model: 'extraction-test', resolved_model: 'extraction-test', response_id: 'resp_test', request_id: 'req_test', input_sha256: state.active.input.input_hash, prompt_version: 'frame_selection_vision_v1', usage: null } };
  } });
  await executeCandidateStage(state.active, state.gateway, state.options);
  assert.equal(reads, 1); assert.equal(selected, 1);
  const terminal = state.events.at(-1)!; assert.equal(terminal.event_type, 'succeeded'); assert.equal(terminal.result!.selection_method, 'openai_vision');
  assert.equal((terminal.result!.metadata as { provider: string }).provider, 'openai'); assert.doesNotMatch(JSON.stringify(terminal.result), /"bytes"|data:image|private-test-token/u);
});
test('frame provider failure explicitly requires manual picks instead of presenting deterministic picks as reviewed', async () => {
  const state = setup('select_frames');
  state.gateway.getInput = async () => ({ ...state.input, prepared });
  Object.assign(state.options.assets, { readFrame: async () => bytes });
  Object.assign(state.options, { selectFrames: async () => { throw new IntegrationError('OPENAI_ACCESS_DENIED', 'Private upstream payload'); } });
  await executeCandidateStage(state.active, state.gateway, state.options);
  const terminal = state.events.at(-1)!; assert.equal(terminal.event_type, 'succeeded');
  assert.deepEqual(terminal.result!.selected_frames, []); assert.equal(terminal.result!.selection_method, 'manual_required');
  assert.equal(terminal.result!.provider_error_code, 'OPENAI_ACCESS_DENIED'); assert.equal(terminal.result!.metadata, null);
  assert.match(String(terminal.result!.insufficient_frames_reason), /manual/i); assert.doesNotMatch(JSON.stringify(terminal), /Private upstream payload/u);
});
test('transient frame review retries before the explicit exhausted-budget manual partial', async () => {
  for (const partial of [false, true]) {
    const state = setup('select_frames'); let calls = 0;
    state.gateway.getInput = async () => ({ ...state.input, prepared, allow_partial_frame_selection: partial });
    state.options.assets.readFrame = async () => bytes;
    state.options.selectFrames = async () => { calls++; throw new IntegrationError('OPENAI_UNAVAILABLE', 'Safe transient failure.', true); };
    await executeCandidateStage(state.active, state.gateway, state.options); assert.equal(calls, 1);
    const terminal = state.events.at(-1)!; assert.equal(terminal.event_type, partial ? 'succeeded' : 'failed');
    if (partial) { assert.deepEqual(terminal.result!.selected_frames, []); assert.equal(terminal.result!.selection_method, 'manual_required'); }
    else { assert.equal(terminal.error!.retryable, true); assert.equal(terminal.result, undefined); }
  }
});
test('corrupt sampled frame bytes are rejected before vision and cannot become a manual provider fallback', async () => {
  const state = setup('select_frames'); let calls = 0;
  state.gateway.getInput = async () => ({ ...state.input, prepared, allow_partial_frame_selection: true });
  state.options.assets.readFrame = async () => new Uint8Array([9, 9, 9]);
  state.options.selectFrames = async () => { calls++; throw new Error('Unexpected provider call'); };
  await executeCandidateStage(state.active, state.gateway, state.options);
  assert.equal(calls, 0); assert.equal(state.events.at(-1)!.event_type, 'failed'); assert.equal(state.events.at(-1)!.result, undefined);
});
test('stale heartbeat aborts frame review without publishing selected images', async () => {
  const state = setup('select_frames'); state.options.heartbeatMs = 10; let calls = 0;
  state.gateway.getInput = async () => ({ ...state.input, prepared }); state.options.assets.readFrame = async () => bytes;
  state.options.selectFrames = async (_input, _config, signal) => { calls++; await new Promise<void>(resolve => { signal!.addEventListener('abort', () => resolve(), { once: true }); }); throw new IntegrationError('PROCESSING_CANCELLED', 'Cancelled.'); };
  state.gateway.recordEvent = async event => { state.events.push(event); return { event_id: event.event_id, applied: false, duplicate: false, stale: true, job_status: 'queued' }; };
  await assert.rejects(executeCandidateStage(state.active, state.gateway, state.options), { code: 'LEASE_STALE' });
  assert.equal(calls, 1); assert.equal(state.events.some(event => event.event_type === 'succeeded'), false);
});
test('prepare stage registers real derivatives and callback contains references, never bytes or tokens', async () => {
  const state = setup(); await executeCandidateStage(state.active, state.gateway, state.options);
  assert.equal(state.writes.length, 1); const event = state.events.at(-1)!; assert.equal(event.event_type, 'succeeded'); assert.equal(event.result_schema, 'media-preparation.v1');
  assert.equal((event.result!.sampled_frames as { frame_asset_id: string }[])[0].frame_asset_id, 'saved-frame1'); assert.equal(JSON.stringify(event.result).includes('"bytes"'), false); assert.equal(JSON.stringify(event.result).includes(state.active.lease_token), false);
});
test('completed stage replay returns without any input, asset or provider work', async () => {
  const state = setup(); state.active.already_completed = true; state.gateway.getInput = async () => { throw new Error('Unexpected read'); };
  assert.deepEqual(await executeCandidateStage(state.active, state.gateway, state.options), { already_completed: true, receipt: null }); assert.equal(state.events.length, 0);
});
test('lost candidate callback acknowledgement replays the same event without repeating preparation or domain effects', async () => {
  const state = setup(); const repository = new MemoryJobRepository(); let ids = 0; let nativeCalls = 0;
  const actor = { principal_id: 'synthetic-worker', client_type: 'service' as const };
  const service = createJobService<MemoryTransaction>({ repository, id: () => `synthetic-${++ids}`, clock: () => new Date(),
    authorizeJob: async () => {}, authorizeDispatcher: async () => {},
    definitions: [{ kind: 'candidate_scan', validateInput: input => input, stages: ['prepare_candidate', 'transcribe_candidate'].map(stage => ({ key: stage, result_schema: 'media-preparation.v1', validateResult: result => result, applyResult: async tx => { await tx.applyResource(stage); } })) }] });
  const job = await service.enqueue({ principal_id: 'synthetic-producer', client_type: 'browser' }, { kind: 'candidate_scan', workspace_id: 'synthetic-workspace', dedupe_key: 'callback-test', input: { configuration } }, 'synthetic-intent');
  const active = await service.claimStage(actor, { job_id: job.id, stage: job.stage, input_hash: job.input_hash });
  state.gateway.getInput = async () => ({ ...state.input, job_id: active.job_id, attempt_id: active.attempt_id, input_hash: active.input.input_hash });
  state.options.prepare = async () => { nativeCalls++; return { ...prepared, sampled_frames: [] }; };
  const sent: JobEvent[] = [];
  state.gateway.recordEvent = async event => {
    sent.push(structuredClone(event)); const receipt = await service.recordEvent(actor, event);
    if (sent.length === 1) { event.result!.warnings = ['MUTATED_BY_TRANSPORT']; throw { code: 'RUNTIME_UNAVAILABLE', outcome: 'unknown', gateway_phase: 'commit', transport_code: 'ECONNRESET', message: 'private transport details' }; }
    return receipt;
  };
  const result = await executeCandidateStage(active, state.gateway, state.options);
  assert.equal(result.receipt!.duplicate, true); assert.equal(result.receipt!.applied, false); assert.equal(nativeCalls, 1);
  assert.equal(sent.length, 2); assert.deepEqual(sent[1], sent[0]);
  const durable = repository.inspect(); assert.equal(durable.events.length, 1); assert.equal(durable.applied.length, 1); assert.equal(durable.outbox.length, 2);
  assert.equal(durable.jobs[0].stage, 'transcribe_candidate'); assert.equal(JSON.stringify(durable).includes(active.lease_token), false);
});
test('a lost heartbeat acknowledgement serializes its identical retry before one terminal callback', async () => {
  const state = setup(); state.options.heartbeatMs = 10; let nativeCalls = 0; let release!: () => void;
  state.options.prepare = async () => { nativeCalls++; await new Promise<void>(resolve => { release = resolve; }); return prepared; };
  const sent: JobEvent[] = []; let active = 0; let peak = 0;
  state.gateway.recordEvent = async event => {
    active++; peak = Math.max(peak, active); sent.push(structuredClone(event));
    try {
      if (sent.length === 1) { assert.equal(event.event_type, 'heartbeat'); release(); throw { code: 'RUNTIME_UNAVAILABLE', outcome: 'unknown', gateway_phase: 'commit', transport_code: 'ECONNRESET' }; }
      return { event_id: event.event_id, applied: event.event_type !== 'heartbeat', duplicate: event.event_type === 'heartbeat', stale: false, job_status: 'queued' as const };
    } finally { active--; }
  };
  const result = await executeCandidateStage(state.active, state.gateway, state.options);
  assert.equal(result.receipt!.applied, true); assert.equal(nativeCalls, 1); assert.equal(state.writes.length, 1); assert.equal(peak, 1);
  assert.equal(sent.length, 3); assert.deepEqual(sent[1], sent[0]); assert.equal(sent[2].sequence, 2); assert.equal(sent[2].event_type, 'succeeded'); assert.notEqual(sent[2].event_id, sent[0].event_id);
});
test('a lost transcription completion acknowledgement never repeats a provider call or transcript write', async () => {
  const state = setup('transcribe_candidate'); let providerCalls = 0; const sent: JobEvent[] = [];
  state.gateway.getInput = async () => ({ ...state.input, prepared: { ...prepared, sampled_frames: [], audio_chunks: [{ asset_id: 'audio1', index: 0, start_ms: 0, end_ms: 1000, mime_type: 'audio/mpeg', sha256: hash, size_bytes: bytes.length }] } });
  state.options.transcribe = async () => { providerCalls++; return { result: { source_asset_id: source.asset_id, segments: [{ index: 0, start_ms: 0, end_ms: 1000, text: 'Synthetic words.' }], original_text: 'Synthetic words.', languages: ['en'], timestamp_precision: 'chunk' }, metadata: [] }; };
  state.gateway.recordEvent = async event => { sent.push(structuredClone(event)); if (sent.length === 1) throw { code: 'RUNTIME_UNAVAILABLE', outcome: 'unknown', gateway_phase: 'commit', transport_code: 'ECONNRESET' };
    return { event_id: event.event_id, applied: false, duplicate: true, stale: false, job_status: 'queued' }; };
  const result = await executeCandidateStage(state.active, state.gateway, state.options);
  assert.equal(result.receipt!.duplicate, true); assert.equal(providerCalls, 1); assert.equal(state.writes.length, 1); assert.equal(sent.length, 2); assert.deepEqual(sent[1], sent[0]);
});
test('source checksum mismatch becomes safe terminal failure and preserves source', async () => {
  const state = setup(); state.assets.read = async () => new Uint8Array([9]); await executeCandidateStage(state.active, state.gateway, state.options);
  assert.equal(state.events.at(-1)!.event_type, 'failed'); assert.equal(state.writes.length, 0); assert.equal(JSON.stringify(state.events.at(-1)!.error).includes('private'), false);
});
test('stale heartbeat aborts in-flight computation without success or a second terminal callback', async () => {
  const state = setup(); state.options.heartbeatMs = 10;
  state.options.prepare = async (_input, options) => new Promise((_resolve, reject) => { options.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true }); });
  state.gateway.recordEvent = async event => { state.events.push(event); return { event_id: event.event_id, applied: false, duplicate: false, stale: true, job_status: 'running' }; };
  await assert.rejects(executeCandidateStage(state.active, state.gateway, state.options), { code: 'LEASE_STALE' }); assert.deepEqual(state.events.map(event => event.event_type), ['heartbeat']);
});
test('model configuration changed after claiming a lease is rejected before provider work', async () => {
  const state = setup(); state.active.input.configuration = { ...configuration, extraction_model_version: 'different-model' };
  await assert.rejects(executeCandidateStage(state.active, state.gateway, state.options), { code: 'STAGE_INPUT_INVALID' }); assert.equal(state.writes.length, 0); assert.equal(state.events.length, 0);
});
test('initial unready original may derive its true SHA only in native preparation', async () => {
  const state = setup(); state.gateway.getInput = async () => ({ ...state.input, source: { ...source, sha256: null } });
  await executeCandidateStage(state.active, state.gateway, state.options); assert.equal(state.events.at(-1)!.result!.source_sha256, hash);
});

test('leased preparation joins a declared source hash to a null verified capability and rejects mismatched bytes before native or Ready publication', async () => {
  for (const corrupt of [false, true]) {
    const state = setup(); const sourceId = '30000000-0000-4000-8000-000000000001';
    state.active.job_id = state.input.job_id = '10000000-0000-4000-8000-000000000001'; state.active.attempt_id = state.input.attempt_id = '20000000-0000-4000-8000-000000000001';
    state.gateway.getInput = async () => ({ ...state.input, source: { ...source, asset_id: sourceId } });
    const key = 'sb_publishable_synthetic_public_key'; let native = 0; let completions = 0;
    state.options.assets = createCandidateStageAssets({ getAssetAccess: async () => ({ asset_id: sourceId, url: `https://pyibofyctwnqpvktepse.supabase.co/storage/v1/object/authenticated/eps-candidate-assets/assets/${sourceId}/original.mp4`, method: 'GET', headers: { apikey: key, Authorization: `Bearer ${key}`, 'x-eps-asset-grant': 'synthetic-private-grant' }, expires_at: new Date(Date.now() + 60000).toISOString(), mime_type: 'video/mp4', size_bytes: bytes.length, sha256: null }),
      reserveOutput: async () => { completions++; throw new Error('No output expected'); }, completeOutput: async () => { completions++; throw new Error('No Ready completion expected'); } },
    { publishableKey: key, fetch: async () => new Response(corrupt ? new Uint8Array([9, 9, 9]) : bytes, { headers: { 'content-type': 'video/mp4', 'content-length': String(bytes.length) } }) });
    state.options.prepare = async () => { native++; return { ...prepared, source_asset_id: sourceId, sampled_frames: [] }; };
    await executeCandidateStage(state.active, state.gateway, state.options);
    assert.equal(native, corrupt ? 0 : 1); assert.equal(completions, 0);
    assert.equal(state.events.at(-1)!.event_type, corrupt ? 'failed' : 'succeeded');
    if (corrupt) assert.equal(state.events.some(event => event.event_type === 'succeeded'), false);
    else assert.equal(state.events.at(-1)!.result!.source_sha256, hash);
  }
});

test('native capability/configuration failures are technical and operator diagnostics retain only a fixed safe code', async () => {
  for (const [native, expected, retryable] of [['VIDEO_ASSET_CAPABILITY_INVALID','PROCESSING_FAILED',false],['VIDEO_CONTAINER_CONFIGURATION_INVALID','PROCESSING_FAILED',false],['VIDEO_PREPARATION_BUSY','DEPENDENCY_UNAVAILABLE',true],['VIDEO_DECODE_FAILED','SOURCE_UNREADABLE',false],['private-provider-token','PROCESSING_FAILED',false]] as const) {
    const state = setup(); const diagnostics: unknown[] = [];
    state.assets.read = async () => { throw new VideoPreparationError(native, 'private-error-body-do-not-log', retryable); };
    state.options.onDiagnostic = value => { diagnostics.push(value); throw new Error('private-sink-failure'); };
    await executeCandidateStage(state.active, state.gateway, state.options);
    const failure = state.events.at(-1)!; assert.equal(failure.event_type, 'failed'); assert.equal(failure.error!.code, expected); assert.equal(failure.error!.retryable, retryable); assert.deepEqual(failure.error!.details, {});
    assert.equal(diagnostics.length, 1); assert.equal(JSON.stringify(diagnostics).includes(state.active.lease_token), false); assert.doesNotMatch(JSON.stringify(diagnostics), /private-error-body|private-provider-token/u);
    assert.equal((diagnostics[0] as {code:string}).code, native.startsWith('VIDEO_') ? native : 'VIDEO_FAILURE_UNCONFIRMED');
    assert.equal(state.writes.length, 0);
  }
});
test('outer stage failures expose only allowlisted integration/gateway/JavaScript codes and the fixed failing operation', async () => {
  const cases = [
    { error: new IntegrationError('TRANSCRIPTION_SOURCE_INVALID', 'private-source-and-api-key', false, { body: 'private-provider-body' }), kind: 'integration', code: 'TRANSCRIPTION_SOURCE_INVALID' },
    { error: new IntegrationError('private-code-with-token', 'private-message'), kind: 'integration', code: 'INTEGRATION_FAILURE_UNCONFIRMED' },
    { error: new SpecsRuntimeGatewayError('RUNTIME_RESPONSE_INVALID', 503, 'known', { gateway_phase: 'operation', transport_code: 'ECONNRESET', elapsed_ms: 3 }), kind: 'gateway', code: 'RUNTIME_RESPONSE_INVALID' },
    { error: new SpecsRuntimeGatewayError('private-code-with-token', 503, 'unknown'), kind: 'gateway', code: 'GATEWAY_FAILURE_UNCONFIRMED' },
    { error: new TypeError('private-provider-body'), kind: 'javascript', code: 'JS_TYPE_ERROR' },
    { error: new RangeError('private-provider-body'), kind: 'javascript', code: 'JS_RANGE_ERROR' },
    { error: { name: 'SpecsRuntimeGatewayError', code: 'RUNTIME_RESPONSE_INVALID', message: 'private-error-object', lease_token: 'private-error-lease' }, kind: 'unknown', code: 'CANDIDATE_FAILURE_UNCONFIRMED' },
    { error: { get code() { throw new Error('private-error-getter'); } }, kind: 'unknown', code: 'CANDIDATE_FAILURE_UNCONFIRMED' },
  ];
  for (const item of cases) {
    const state = setup('transcribe_candidate'); const diagnostics: CandidateStageDiagnostic[] = [];
    state.gateway.getInput = async () => ({ ...state.input, prepared: { ...prepared, sampled_frames: [], audio_chunks: [{ asset_id: 'audio1', index: 0, start_ms: 0, end_ms: 1000, mime_type: 'audio/mpeg', sha256: hash, size_bytes: bytes.length }] } });
    let providerCalls = 0; state.options.transcribe = async () => { providerCalls++; throw item.error; };
    state.options.onDiagnostic = value => { diagnostics.push(value); throw new Error('private-observer-failure'); };
    await executeCandidateStage(state.active, state.gateway, state.options);
    assert.equal(providerCalls, 1); assert.equal(state.writes.length, 0); assert.equal(state.events.at(-1)!.event_type, 'failed'); assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].error_kind, item.kind); assert.equal(diagnostics[0].code, item.code); assert.equal(diagnostics[0].operation, 'transcribe_audio');
    assert.doesNotMatch(JSON.stringify(diagnostics), /private|body|message|lease_token|elapsed_ms/u); assert.equal(JSON.stringify(diagnostics).includes(state.active.lease_token), false);
    if (item.error instanceof SpecsRuntimeGatewayError) { assert.equal(diagnostics[0].gateway_outcome, item.error.outcome); if (item.error.code === 'RUNTIME_RESPONSE_INVALID') { assert.equal(diagnostics[0].gateway_phase, 'operation'); assert.equal(diagnostics[0].transport_code, 'ECONNRESET'); } }
  }
});
test('post-provider transcript storage failure identifies the write operation without repeating or claiming provider outcome', async () => {
  const state = setup('transcribe_candidate'); const diagnostics: CandidateStageDiagnostic[] = []; let providerCalls = 0; let writes = 0;
  state.gateway.getInput = async () => ({ ...state.input, prepared: { ...prepared, sampled_frames: [], audio_chunks: [{ asset_id: 'audio1', index: 0, start_ms: 0, end_ms: 1000, mime_type: 'audio/mpeg', sha256: hash, size_bytes: bytes.length }] } });
  state.options.transcribe = async () => { providerCalls++; return { result: { source_asset_id: source.asset_id, segments: [{ index: 0, start_ms: 0, end_ms: 1000, text: 'Synthetic words.' }], original_text: 'Synthetic words.', languages: ['en'], timestamp_precision: 'chunk' }, metadata: [] }; };
  state.assets.write = async () => { writes++; throw new SpecsRuntimeGatewayError('RUNTIME_UNAVAILABLE', 503, 'unknown', { gateway_phase: 'commit', transport_code: 'ECONNRESET' }); };
  state.options.onDiagnostic = value => diagnostics.push(value);
  await executeCandidateStage(state.active, state.gateway, state.options);
  assert.equal(providerCalls, 1); assert.equal(writes, 1); assert.equal(diagnostics.length, 1); assert.equal(diagnostics[0].operation, 'write_transcript'); assert.equal(diagnostics[0].gateway_outcome, 'unknown');
  assert.equal(state.events.at(-1)!.event_type, 'failed'); assert.equal(state.events.at(-1)!.error!.retryable, false); assert.doesNotMatch(JSON.stringify(diagnostics), /Synthetic words|provider_success|billed/u);
});
test('transcription reads prepared audio through the strict asset port and verifies its bytes before provider or transcript publication', async () => {
  for (const corrupt of [false, true]) {
    const state = setup('transcribe_candidate');
    const jobId = '10000000-0000-4000-8000-000000000001'; const attemptId = '20000000-0000-4000-8000-000000000001';
    const sourceId = '30000000-0000-4000-8000-000000000001'; const audioId = '40000000-0000-4000-8000-000000000001'; const transcriptId = '50000000-0000-4000-8000-000000000001';
    state.active.job_id = state.input.job_id = jobId; state.active.attempt_id = state.input.attempt_id = attemptId;
    const chunk = { asset_id: audioId, sha256: hash, size_bytes: bytes.length, mime_type: 'audio/mpeg', index: 0, start_ms: 0, end_ms: 1000 };
    state.gateway.getInput = async () => ({ ...state.input, source: { ...source, asset_id: sourceId }, prepared: { ...prepared, source_asset_id: sourceId, sampled_frames: [], audio_chunks: [chunk] } });
    const output = { source_asset_id: sourceId, segments: [{ index: 0, start_ms: 0, end_ms: 1000, text: 'Synthetic spoken words.' }], original_text: 'Synthetic spoken words.', languages: ['en'], timestamp_precision: 'chunk' as const };
    const transcriptBytes = Buffer.from(JSON.stringify(output)); const transcriptHash = createHash('sha256').update(transcriptBytes).digest('hex');
    const key = 'sb_publishable_synthetic_public_key'; let providerCalls = 0; let reservations = 0; let completions = 0;
    function access(id: string, method: 'GET' | 'POST') {
      const audio = id === audioId; const priorAttempt = '60000000-0000-4000-8000-000000000001';
      return { asset_id: id, url: `https://pyibofyctwnqpvktepse.supabase.co/storage/v1/object/${method === 'GET' ? 'authenticated/' : ''}eps-candidate-outputs/jobs/${jobId}/attempts/${audio ? priorAttempt : attemptId}/${id}.${audio ? 'mp3' : 'json'}`, method,
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'x-eps-asset-grant': 'synthetic-private-grant', ...(method === 'POST' ? { 'Content-Type': 'application/json', 'x-upsert': 'false' } : {}) },
        expires_at: new Date(Date.now() + 60_000).toISOString(), mime_type: audio ? 'audio/mpeg' : 'application/json', size_bytes: audio ? bytes.length : transcriptBytes.length, sha256: audio ? hash : null };
    }
    function transcriptAsset(ready: boolean) { return { id: transcriptId, purpose: 'transcript', filename: 'transcript.json', mime_type: 'application/json', size_bytes: transcriptBytes.length, sha256: ready ? transcriptHash : null, status: ready ? 'ready' : 'uploading', duration_ms: null, width: null, height: null, source_asset_id: sourceId, source_timestamp_ms: null, created_at: new Date().toISOString() }; }
    state.options.assets = createCandidateStageAssets({ getAssetAccess: async input => access(input.asset_id, 'GET'),
      reserveOutput: async () => { reservations++; return { asset: transcriptAsset(false), access: access(transcriptId, 'POST') }; },
      completeOutput: async () => { completions++; return transcriptAsset(true); } },
    { publishableKey: key, fetch: async (url, options) => {
      if (options?.method === 'POST') { assert.deepEqual(options.body, transcriptBytes); return new Response('{}'); }
      const audio = String(url).endsWith('.mp3'); return new Response(audio ? corrupt ? new Uint8Array([9, 9, 9]) : bytes : transcriptBytes, { headers: { 'content-type': audio ? 'audio/mpeg' : 'application/json' } });
    } });
    state.options.transcribe = async input => { providerCalls++; assert.deepEqual(input.chunks[0].bytes, Buffer.from(bytes)); assert.equal(input.chunks[0].start_ms, 0); assert.equal(input.chunks[0].end_ms, 1000); return { result: output, metadata: [] }; };
    await executeCandidateStage(state.active, state.gateway, state.options);
    assert.equal(providerCalls, corrupt ? 0 : 1); assert.equal(reservations, corrupt ? 0 : 1); assert.equal(completions, corrupt ? 0 : 1);
    const event = state.events.at(-1)!; assert.equal(event.event_type, corrupt ? 'failed' : 'succeeded');
    if (!corrupt) { assert.equal(event.result_schema, 'candidate-transcript-stage.v1'); assert.equal((event.result!.transcript_asset as { asset_id: string }).asset_id, transcriptId); assert.deepEqual(event.result!.original_transcript, output); }
    else assert.equal(state.events.some(event => event.event_type === 'succeeded'), false);
  }
});
test('retryable transcription failure retries first and becomes honest manual partial only after exhaustion', async () => {
  for (const exhausted of [false, true]) {
    const state = setup('transcribe_candidate');
    state.gateway.getInput = async () => ({ ...state.input, allow_partial_transcription: exhausted, prepared: { ...prepared, sampled_frames: [], audio_chunks: [{ asset_id: 'audio1', index: 0, start_ms: 0, end_ms: 1000, mime_type: 'audio/mpeg', sha256: hash, size_bytes: bytes.length }] } });
    state.options.transcribe = async () => { throw new IntegrationError('OPENAI_RATE_LIMITED', 'Rate limited.', true); };
    await executeCandidateStage(state.active, state.gateway, state.options); const event = state.events.at(-1)!;
    assert.equal(event.event_type, exhausted ? 'succeeded' : 'failed');
    if (exhausted) { assert.equal(event.result!.missing_transcript_reason, 'TRANSCRIPTION_FAILED'); assert.equal(event.result!.provider_error_code, 'OPENAI_RATE_LIMITED'); assert.equal(event.result!.original_transcript, null); }
    else assert.equal(event.error!.retryable, true);
  }
});
