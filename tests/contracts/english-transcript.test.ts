import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateContract } from '../../apps/web/lib/validation.ts';
import schemas from '../../apps/web/lib/generated-contracts.json';

const media = { id: 'media', candidate_id: 'candidate', source_asset_id: 'source', preview_asset_id: null,
  transcript_asset_id: null, original_transcript: null, languages: [], available_frames: [],
  selected_frame_asset_ids: [], processing_issues: [], row_version: 1 };
const transcript = { version_id: 'version', asset_id: 'asset', status: 'not_captured', original_text: null,
  languages: [], source_kind: 'source_transcript', source_sha256: null };
test('English display groups remain legacy compatible and enforce complete coherent projections', () => {
  for (const [schema, legacy, textKey, statusKey, extra] of [
    ['CandidateMedia', media, 'english_transcript', 'english_transcript_status', {}],
    ['VersionTranscriptCompanion', transcript, 'english_text', 'english_status', { english_sha256: 'a'.repeat(64) }],
  ] as const) {
    validateContract(schema, legacy);
    validateContract(schema, { ...legacy, [textKey]: 'An English introduction.', [statusKey]: 'available', ...extra });
    assert.throws(() => validateContract(schema, { ...legacy, [statusKey]: 'available' }));
    assert.throws(() => validateContract(schema, { ...legacy, [textKey]: null, [statusKey]: 'available', ...extra }));
    assert.throws(() => validateContract(schema, { ...legacy, [textKey]: 'Unexpected fallback.', [statusKey]: 'not_captured', ...extra }));
    validateContract(schema, { ...legacy, [textKey]: null, [statusKey]: 'unavailable',
      ...(schema === 'VersionTranscriptCompanion' ? { english_sha256: null } : {}) });
  }
});
test('every embedded MCP English projection exactly matches its HTTP runtime definition', async () => {
  const catalog = JSON.parse(await readFile('contracts/mcp-tool-catalog.json', 'utf8'));
  const counts = { CandidateMedia: 0, VersionTranscriptCompanion: 0 };
  for (const tool of catalog.tools) for (const name of Object.keys(counts) as (keyof typeof counts)[]) {
    if (tool.outputSchema.$defs?.[name]) {
      assert.deepEqual(tool.outputSchema.$defs[name], schemas.$defs[name]);
      counts[name]++;
    }
  }
  assert.deepEqual(counts, { CandidateMedia: 2, VersionTranscriptCompanion: 1 });
});
