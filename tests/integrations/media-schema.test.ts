import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCandidateExtraction, validateFrameSelection } from '../../packages/integrations/src/media-schema.ts';

const input = { source_asset_id: 'source-1', segments: [{ index: 0, start_ms: 0, end_ms: 5000, text: 'My name is Lina. I am 31 and live in Cairo.' }] };
const result = () => ({ schema_version: '1.0', source_asset_id: 'source-1', facts: {
  name: 'Lina', casting_id: null, age_or_range: '31', stated_gender: null, height_measurements: null,
  languages: [], accents: [], skills_experience: null, city: 'Cairo', previous_projects_roles: null, classification: null,
}, project_availability_statement: null, evidence: ['name', 'age_or_range', 'city'].map(field => ({ field_path: `facts.${field}`, source: {
  asset_id: 'source-1', page: null, paragraph: null, segment_index: 0, start_ms: 0, end_ms: 5000, quote: input.segments[0].text,
} })), uncertainties: [] });

test('candidate facts preserve nulls and require exact bounded transcript evidence', () => {
  assert.deepEqual(validateCandidateExtraction(result(), input), result());
  const missing = result(); missing.evidence.pop();
  assert.throws(() => validateCandidateExtraction(missing, input), { code: 'AI_EVIDENCE_MISSING' });
  const invented = result(); invented.evidence[0].source.quote = 'Not in source';
  assert.throws(() => validateCandidateExtraction(invented, input), { code: 'AI_EVIDENCE_INVALID' });
  const timestamp = result(); timestamp.evidence[0].source.end_ms = 6000;
  assert.throws(() => validateCandidateExtraction(timestamp, input), { code: 'AI_EVIDENCE_INVALID' });
});
test('candidate extraction rejects unrelated sources, extra fields and unsupported text', () => {
  assert.throws(() => validateCandidateExtraction({ ...result(), source_asset_id: 'other' }, input), { code: 'AI_SOURCE_MISMATCH' });
  assert.throws(() => validateCandidateExtraction({ ...result(), role_age: '40-50' }, input), { code: 'AI_RESULT_INVALID' });
  const bad = result(); bad.facts.name = '\u0000';
  assert.throws(() => validateCandidateExtraction(bad, input), { code: 'AI_RESULT_INVALID' });
});
test('frames must be unique members of the exact source pool with honest insufficiency', () => {
  const pool = [{ frame_asset_id: 'frame-1', source_asset_id: 'source-1' }];
  const value = { schema_version: '1.0', source_asset_id: 'source-1', selected_frames: [{ frame_asset_id: 'frame-1', reason: 'Clear source frame' }], insufficient_frames_reason: 'Only one distinct view.' };
  assert.deepEqual(validateFrameSelection(value, 'source-1', pool), value);
  assert.throws(() => validateFrameSelection({ ...value, selected_frames: [...value.selected_frames, ...value.selected_frames] }, 'source-1', pool), { code: 'AI_FRAME_REFERENCE_INVALID' });
  assert.throws(() => validateFrameSelection({ ...value, insufficient_frames_reason: null }, 'source-1', pool), { code: 'AI_FRAME_RESULT_INVALID' });
  assert.throws(() => validateFrameSelection(value, 'source-1', [{ ...pool[0], source_asset_id: 'other' }]), { code: 'AI_FRAME_REFERENCE_INVALID' });
});
