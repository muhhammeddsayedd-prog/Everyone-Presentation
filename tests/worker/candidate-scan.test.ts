import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCandidateVideo } from '../../apps/worker/src/candidate-scan.ts';
import { IntegrationError } from '../../packages/integrations/src/errors.ts';
import type { PreparedVideo } from '../../apps/worker/src/video-types.ts';
const config = { imageId: `sha256:${'a'.repeat(64)}`, transcription: { model: 'synthetic', apiKey: 'synthetic' }, extraction: { model: 'synthetic', apiKey: 'synthetic' } };
const prepared: PreparedVideo = { source_asset_id: 'video1', source_sha256: 'a'.repeat(64), probe: { duration_ms: 1000, width: 10, height: 10, rotation_degrees: 0, frame_rate: 25, video_codec: 'h264', audio_codec: null, has_audio: false, container: 'mov,mp4,m4a,3gp,3g2,mj2', source_start_ms: 0 }, audio_chunks: [], sampled_frames: [], warnings: ['NO_AUDIO_STREAM'], implementation_version: 'video-preparation.v1', ffmpeg_version: 'ffmpeg version synthetic' };
test('silent source yields explicit partial/manual state without any provider call', async () => {
  const value = await scanCandidateVideo({ source_asset_id: 'video1', mime_type: 'video/mp4', bytes: new Uint8Array([1]) }, config, { prepare: async () => prepared,
    transcribe: async () => { throw new Error('A silent file must not reach the provider.'); } });
  assert.equal(value.status, 'partial'); assert.equal(value.transcript, null); assert.equal(value.candidate_extraction, null); assert.equal(value.issues[0].code, 'NO_AUDIO_STREAM'); assert.equal(value.frame_selection.selected_frames.length, 0);
});
test('provider outage retains independent source/frame result and retryable stage issue', async () => {
  const value = await scanCandidateVideo({ source_asset_id: 'video1', mime_type: 'video/mp4', bytes: new Uint8Array([1]) }, config, { prepare: async () => ({ ...prepared, probe: { ...prepared.probe, has_audio: true }, audio_chunks: [{ index: 0, start_ms: 0, end_ms: 1000, mime_type: 'audio/mpeg', bytes: new Uint8Array([1]), sha256: 'b'.repeat(64) }] }),
    transcribe: async () => { throw new IntegrationError('OPENAI_RATE_LIMITED', 'Retry later.', true); } });
  assert.equal(value.source_sha256, prepared.source_sha256); assert.deepEqual(value.issues, [{ stage: 'transcribe', code: 'OPENAI_RATE_LIMITED', retryable: true }]);
});
