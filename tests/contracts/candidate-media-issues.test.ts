import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { validateContract } from '../../apps/web/lib/validation.ts';

test('CandidateMedia technical outcomes are required fixed codes across HTTP and self-contained MCP outputs', async () => {
  const item = { id: 'media', candidate_id: 'candidate', source_asset_id: 'source', preview_asset_id: null, transcript_asset_id: null,
    original_transcript: null, languages: [], available_frames: [], selected_frame_asset_ids: [], processing_issues: ['TRANSCRIPTION_FAILED','INSUFFICIENT_FRAMES','FRAME_SELECTION_UNAVAILABLE'], row_version: 1 };
  validateContract('CandidateMedia', item);
  const { processing_issues: ignored, ...missing } = item; void ignored;
  assert.throws(() => validateContract('CandidateMedia', missing));
  assert.throws(() => validateContract('CandidateMedia', { ...item, processing_issues: ['raw-provider-error-secret'] }));
  assert.throws(() => validateContract('CandidateMedia', { ...item, processing_issues: ['NO_AUDIO','NO_AUDIO'] }));
  const catalog = JSON.parse(await readFile('contracts/mcp-tool-catalog.json', 'utf8')) as { tools: { name: string; outputSchema: { $defs?: Record<string, { required: string[]; properties: Record<string, { items?: { enum?: string[] } }> }> } }[] };
  const definitions = catalog.tools.filter(tool => tool.outputSchema.$defs?.CandidateMedia);
  assert.deepEqual(definitions.map(tool => tool.name), ['get_candidate_media','update_candidate_frames']);
  for (const tool of definitions) {
    const schema = tool.outputSchema.$defs!.CandidateMedia;
    assert(schema.required.includes('processing_issues'));
    assert.deepEqual(schema.properties.processing_issues.items?.enum, ['NO_AUDIO','TRANSCRIPTION_FAILED','EXTRACTION_FAILED','INSUFFICIENT_FRAMES','FRAME_SELECTION_UNAVAILABLE']);
  }
});
