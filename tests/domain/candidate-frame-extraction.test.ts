import assert from 'node:assert/strict';
import test from 'node:test';
import { appendExtractedCandidateFrames, parseFrameExtraction } from '../../packages/domain/src/candidate-frame-extraction.ts';
import type { CandidateMedia } from '@eps/domain';
const before: CandidateMedia = { id: 'media1', candidate_id: 'candidate1', source_asset_id: 'source1', preview_asset_id: null, transcript_asset_id: null, original_transcript: null, languages: [], available_frames: [{ asset_id: 'old1', source_asset_id: 'source1', timestamp_ms: 0, width: 800, height: 480, quality_flags: [] }], selected_frame_asset_ids: ['old1'], processing_issues: [], row_version: 3 };
const frame = { asset_id: 'new1', source_asset_id: 'source1', timestamp_ms: 1000, width: 853, height: 480, quality_flags: [] };
test('chosen timestamps are bounded and canonical without accepting source URLs, duplicates or extra action fields', () => {
  assert.deepEqual(parseFrameExtraction({ source_asset_id: 'source1', timestamps_ms: [1000, 0] }), { source_asset_id: 'source1', timestamps_ms: [0, 1000] });
  for (const timestamps_ms of [[], [0, 0], [-1], [0.5], [1_800_000], Array.from({ length: 11 }, (_, i) => i)]) assert.throws(() => parseFrameExtraction({ source_asset_id: 'source1', timestamps_ms }));
  assert.throws(() => parseFrameExtraction({ source_asset_id: 'source1', timestamps_ms: [0], url: 'https://private.example' }));
});
test('frame append preserves original bytes/selection context and stale or foreign-source results cannot commit', () => {
  const copy = structuredClone(before); const after = appendExtractedCandidateFrames(before, 3, [frame]);
  assert.deepEqual(before, copy); assert.deepEqual(after.available_frames[0], before.available_frames[0]); assert.deepEqual(after.selected_frame_asset_ids, ['old1']); assert.equal(after.row_version, 4);
  assert.throws(() => appendExtractedCandidateFrames(before, 2, [frame]), { code: 'STALE_RESOURCE_VERSION' });
  assert.throws(() => appendExtractedCandidateFrames(before, 3, [{ ...frame, source_asset_id: 'other-source' }]));
  assert.throws(() => appendExtractedCandidateFrames(before, 3, [{ ...frame, asset_id: 'old1' }]));
  assert.deepEqual(appendExtractedCandidateFrames(before, 3, []), before);
  assert.throws(() => appendExtractedCandidateFrames({ ...before, available_frames: Array.from({ length: 100 }, (_, i) => ({ ...frame, asset_id: `frame${i}` })) }, 3, [frame]), { code: 'MEDIA_REFERENCE_INVALID' });
});
