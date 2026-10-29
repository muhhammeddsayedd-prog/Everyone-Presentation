import assert from 'node:assert/strict';
import test from 'node:test';
import { videoDisplayGeometry } from '../../apps/worker/src/video-geometry.ts';
import type { VideoProbe } from '../../apps/worker/src/video-types.ts';
const probe: VideoProbe = { duration_ms: 1000, width: 800, height: 480, rotation_degrees: 0, frame_rate: 25, video_codec: 'h264', audio_codec: null, has_audio: false, container: 'mov,mp4,m4a,3gp,3g2,mj2', source_start_ms: 0 };
const envelope = (sar?: string, dar?: string) => ({ streams: [{ codec_type: 'video', sample_aspect_ratio: sar, display_aspect_ratio: dar }] });
test('anamorphic source becomes square-pixel display geometry with bounded rounding and autorotation', () => {
  const normal = videoDisplayGeometry(envelope('16:15', '16:9'), probe); assert.equal(normal.width, 853); assert.equal(normal.height, 480);
  assert.deepEqual(normal.sample_aspect_ratio, { numerator: 16, denominator: 15 });
  const rotated = videoDisplayGeometry(envelope('16:15', '16:9'), { ...probe, rotation_degrees: 90 }); assert.equal(rotated.width, 480); assert.equal(rotated.height, 853);
  const large = videoDisplayGeometry(envelope('16:15', '16:9'), { ...probe, width: 3200, height: 1920 }); assert.equal(large.width, 1280); assert.equal(large.height, 720);
});
test('unknown SAR uses supplied DAR or honest square pixels; invalid or inconsistent ratios fail closed', () => {
  assert.equal(videoDisplayGeometry(envelope(undefined, '16:9'), probe).width, 853);
  assert.equal(videoDisplayGeometry(envelope('0:1'), probe).width, 800);
  for (const sar of ['16:0', '-1:1', '1e9:1', '9999999:1', 'private-untrusted-text']) assert.throws(() => videoDisplayGeometry(envelope(sar), probe), { code: 'VIDEO_UNREADABLE' });
  assert.throws(() => videoDisplayGeometry(envelope('1:1', '16:9'), probe), { code: 'VIDEO_UNREADABLE' });
});
