import assert from 'node:assert/strict';
import test from 'node:test';
import { frameQuality, selectRealFrames } from '../../apps/worker/src/video-quality.ts';
import type { RealFrame } from '../../apps/worker/src/video-types.ts';
const frame = (id: string, bits: string, timestamp: number, luminance = 100): RealFrame => ({ frame_asset_id: id, source_asset_id: 'video1', timestamp_ms: timestamp, width: 16, height: 9,
  sha256: id, bytes: new Uint8Array([1]), quality_flags: [], quality: { difference_hash: bits, luminance, contrast: 20, sharpness: 10 } });
test('technical selection excludes blank frames and duplicates, retaining source order', () => {
  const value = selectRealFrames('video1', [frame('late', 'ffffffffffffffff', 5000), frame('early', '0000000000000000', 0), frame('near-copy', '0000000000000001', 1000), frame('black', 'aaaaaaaaaaaaaaaa', 2000, 0)]);
  assert.deepEqual(value.selected_frames.map(frame => frame.frame_asset_id), ['early', 'late']);
  assert.match(value.insufficient_frames_reason!, /Only 2/);
  assert.equal(selectRealFrames('video1', []).selected_frames.length, 0);
});
test('fixed luminance metrics detect blank samples without a face/identity model', () => {
  const value = frameQuality(new Uint8Array(1024)); assert.equal(value.luminance, 0); assert.equal(value.contrast, 0); assert.equal(value.sharpness, 0);
  assert.throws(() => frameQuality(new Uint8Array(1)));
});
