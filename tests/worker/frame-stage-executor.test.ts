import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import type { JobEvent, StageLease } from '@eps/jobs';
import { executeFrameStage, type FrameStageOptions } from '../../apps/worker/src/frame-stage-executor.ts';
import type { CandidateStageGateway } from '../../apps/worker/src/candidate-stage-executor.ts';
import { VideoPreparationError, type PreparedVideo } from '../../apps/worker/src/video-types.ts';
const bytes = new Uint8Array([1, 2, 3]); const sourceHash = createHash('sha256').update(bytes).digest('hex');
const jpeg = new Uint8Array([255, 216, 1, 2]); const frameHash = createHash('sha256').update(jpeg).digest('hex');
const image = `sha256:${'e'.repeat(64)}`; const configuration = { implementation_version: 'frame-extraction.v1', native_image_id: image };
function fixture(stage = 'extract_frames') {
  const events: JobEvent[] = []; let reads = 0; let writes = 0; let native = 0;
  const frozen = { candidate_media_id: 'media1', source_asset_id: 'source1', source_sha256: sourceHash, source_size_bytes: bytes.length, source_mime_type: 'video/mp4', source_duration_ms: 1000, timestamps_ms: [0, 1, 999], configuration, input_hash: 'a'.repeat(64) };
  const lease: StageLease = { job_id: 'job1', attempt_id: 'attempt1', lease_token: 'synthetic-private-lease', stage, already_completed: false, lease_expires_at: new Date(Date.now() + 90_000).toISOString(), input: frozen };
  const input = { job_id: lease.job_id, attempt_id: lease.attempt_id, stage, input_hash: frozen.input_hash, configuration, candidate_media_id: 'media1', timestamps_ms: frozen.timestamps_ms, source_duration_ms: 1000,
    source: { asset_id: 'source1', sha256: sourceHash, size_bytes: bytes.length, mime_type: 'video/mp4' } };
  const prepared: PreparedVideo = { source_asset_id: 'source1', source_sha256: sourceHash, probe: { duration_ms: 1000, width: 10, height: 10, rotation_degrees: 0, frame_rate: 25, video_codec: 'h264', audio_codec: null, has_audio: false, container: 'mp4', source_start_ms: 0 },
    display_geometry: { sample_aspect_ratio: { numerator: 1, denominator: 1 }, display_aspect_ratio: { numerator: 1, denominator: 1 }, width: 10, height: 10 },
    audio_chunks: [], sampled_frames: [0, 1].map(requested_timestamp_ms => ({ frame_asset_id: `frame-${frameHash}`, source_asset_id: 'source1', timestamp_ms: 40, requested_timestamp_ms, width: 10, height: 10, sha256: frameHash, bytes: jpeg, quality_flags: [], quality: { luminance: 100, contrast: 20, sharpness: 20, difference_hash: '0000000000000000' } })),
    warnings: ['FRAME_TIMESTAMP_SHARED', 'FRAME_TIMESTAMP_UNAVAILABLE'], implementation_version: 'video-preparation.v1', ffmpeg_version: 'ffmpeg version synthetic' };
  const gateway: CandidateStageGateway = { getInput: async () => input, recordEvent: async event => { events.push(structuredClone(event)); return { event_id: event.event_id, applied: true, duplicate: false, stale: false, job_status: 'queued' }; } };
  const options: FrameStageOptions = { imageId: image, assets: { read: async () => { reads++; return bytes; }, write: async (_scope, output) => { writes++; assert.equal(output.timestamp_ms, 40); return { asset_id: 'saved1', sha256: output.sha256, size_bytes: output.bytes.length, mime_type: output.mime_type }; } },
    prepare: async (_source, supplied) => { native++; assert.deepEqual(supplied.timestampsMs, [0, 1, 999]); return prepared; } };
  return { lease, input, prepared, gateway, options, events, counts: () => ({ reads, writes, native }) };
}
test('chosen requests share one actual immutable asset and unavailable tail stays explicit without bytes in callback', async () => {
  const state = fixture(); await executeFrameStage(state.lease, state.gateway, state.options);
  assert.deepEqual(state.counts(), { reads: 1, writes: 1, native: 1 }); const event = state.events.at(-1)!; assert.equal(event.result_schema, 'frame-extraction-stage.v1');
  assert.equal((event.result!.frames as unknown[]).length, 1); assert.deepEqual((event.result!.requests as { frame_asset_id: string | null }[]).map(value => value.frame_asset_id), ['saved1', 'saved1', null]);
  assert.doesNotMatch(JSON.stringify(event.result), /"bytes"|synthetic-private-lease|original_transcript/u);
});
test('apply and completed replay never read source, run native work or rewrite an asset', async () => {
  const state = fixture('apply_frames'); await executeFrameStage(state.lease, state.gateway, state.options); assert.deepEqual(state.counts(), { reads: 0, writes: 0, native: 0 });
  assert.deepEqual(state.events[0].result, { source_asset_id: 'source1' });
  state.lease.already_completed = true; await executeFrameStage(state.lease, state.gateway, state.options); assert.equal(state.events.length, 1);
});
test('changed source/configuration/time envelope is refused before native or transfer work', async () => {
  for (const patch of [{ source: { ...fixture().input.source, asset_id: 'other' } }, { timestamps_ms: [1, 0] }, { source_duration_ms: 900 }, { configuration: { ...configuration, native_image_id: `sha256:${'f'.repeat(64)}` } }, { url: 'https://untrusted.example' }]) {
    const state = fixture(); state.gateway.getInput = async () => ({ ...state.input, ...patch });
    await assert.rejects(executeFrameStage(state.lease, state.gateway, state.options), { code: 'STAGE_INPUT_INVALID' }); assert.deepEqual(state.counts(), { reads: 0, writes: 0, native: 0 }); assert.equal(state.events.length, 0);
  }
});
test('corrupt source never reaches native or Ready output and partial missing frames never fabricate an image', async () => {
  const state = fixture(); state.options.assets.read = async () => new Uint8Array([9, 9, 9]); await executeFrameStage(state.lease, state.gateway, state.options);
  assert.equal(state.counts().native, 0); assert.equal(state.counts().writes, 0); assert.equal(state.events.at(-1)!.event_type, 'failed');
  const empty = fixture(); empty.prepared.sampled_frames = []; await executeFrameStage(empty.lease, empty.gateway, empty.options); assert.equal(empty.counts().writes, 0); assert.equal((empty.events.at(-1)!.result!.frames as unknown[]).length, 0);
});
test('cancelled native work cannot publish a frame and stale heartbeat cannot send a competing completion', async () => {
  for (const stale of [false, true]) {
    const state = fixture(); const controller = new AbortController(); state.options.signal = controller.signal; state.options.heartbeatMs = 10;
    state.options.prepare = async (_source, supplied) => new Promise((_resolve, reject) => { supplied.signal!.addEventListener('abort', () => reject(new VideoPreparationError('VIDEO_PREPARATION_CANCELLED')), { once: true }); if (!stale) controller.abort(); });
    state.gateway.recordEvent = async event => { state.events.push(structuredClone(event)); return { event_id: event.event_id, applied: false, duplicate: false, stale: true, job_status: 'running' }; };
    await assert.rejects(executeFrameStage(state.lease, state.gateway, state.options), { code: stale ? 'LEASE_STALE' : 'PROCESSING_CANCELLED' }); assert.equal(state.counts().writes, 0);
    assert.deepEqual(state.events.map(event => event.event_type), stale ? ['heartbeat'] : []);
  }
});
test('lost frame completion acknowledgement replays one identical event without native or asset recomputation', async () => {
  const state = fixture(); state.gateway.recordEvent = async event => { state.events.push(structuredClone(event)); if (state.events.length === 1) throw { code: 'RUNTIME_UNAVAILABLE', outcome: 'unknown', gateway_phase: 'commit', transport_code: 'ECONNRESET' };
    return { event_id: event.event_id, applied: false, duplicate: true, stale: false, job_status: 'queued' }; };
  const result = await executeFrameStage(state.lease, state.gateway, state.options); assert.equal(result.receipt!.duplicate, true); assert.deepEqual(state.counts(), { reads: 1, writes: 1, native: 1 }); assert.deepEqual(state.events[0], state.events[1]);
});
