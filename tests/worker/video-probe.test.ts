import assert from 'node:assert/strict';
import test from 'node:test';
import { parseVideoProbe, validateVideoInput } from '../../apps/worker/src/video-native.ts';
import { nativeDockerEnvironment } from '../../apps/worker/src/video-container.ts';
const probe = () => ({ format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '3.2', start_time: '0' }, streams: [{ codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, avg_frame_rate: '25/1', side_data_list: [{ rotation: -90 }] }] });
test('probe retains real duration/rotation and missing audio without inventing transcript success', () => { assert.deepEqual(parseVideoProbe(probe()), { duration_ms: 3200, width: 1080, height: 1920, frame_rate: 25, rotation_degrees: 270, video_codec: 'h264', audio_codec: null, has_audio: false, container: 'mov,mp4,m4a,3gp,3g2,mj2', source_start_ms: 0 }); });
test('probe rejects corrupt, multi-video, excessive dimensions/duration and frame-rate input', () => {
  assert.throws(() => parseVideoProbe({}), { code: 'VIDEO_UNREADABLE' });
  const multi = probe(); multi.streams.push(multi.streams[0]); assert.throws(() => parseVideoProbe(multi), { code: 'VIDEO_UNREADABLE' });
  for (const modification of [value => { value.format.duration = '9999999'; }, value => { value.streams[0].width = 9000; }, value => { value.streams[0].avg_frame_rate = '1/0'; }] as ((value: ReturnType<typeof probe>) => void)[]) { const value = probe(); modification(value); assert.throws(() => parseVideoProbe(value), { code: 'VIDEO_LIMIT_EXCEEDED' }); }
});
test('container input never accepts filenames, remote URLs or extension-only type assertions', () => {
  assert.throws(() => validateVideoInput({ source_asset_id: 'source', bytes: new Uint8Array([1]), mime_type: 'video/mp4' }), { code: 'VIDEO_TYPE_UNSUPPORTED' });
  assert.throws(() => validateVideoInput({ source_asset_id: '../file', bytes: new Uint8Array([1]), mime_type: 'video/mp4' }), { code: 'VIDEO_SOURCE_INVALID' });
});
test('native CLI receives system fields and an explicitly empty PATH, without contexts or worker credentials', () => {
  assert.deepEqual(nativeDockerEnvironment({ SystemRoot: 'synthetic-system', PATH: 'untrusted-search-path', OPENAI_API_KEY: 'private-key', EPS_SPECS_PG_PASSWORD: 'private-database', N8N_DISPATCH_SECRET: 'private-webhook', DOCKER_HOST: 'tcp://remote.invalid:2375', DOCKER_CONFIG: 'unrelated-config' }), { NODE_ENV: 'production', PATH: '', SystemRoot: 'synthetic-system' });
});
