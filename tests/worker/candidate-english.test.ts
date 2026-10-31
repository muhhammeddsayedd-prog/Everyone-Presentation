import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { JobEvent, StageLease } from '@eps/jobs';
import { executeCandidateStage, type CandidateStageGateway, type CandidateStageOptions } from '../../apps/worker/src/candidate-stage-executor.ts';
import { scanCandidateVideo } from '../../apps/worker/src/candidate-scan.ts';
import { IntegrationError } from '../../packages/integrations/src/errors.ts';
import { EnglishTranscriptNormalizationError } from '../../packages/integrations/src/openai-transcript-english.ts';
import type { CandidateExtraction, EnglishTranscript, MediaProviderMetadata } from '../../packages/integrations/src/media-types.ts';
import type { PreparedVideo } from '../../apps/worker/src/video-types.ts';

const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const originalText = 'نص تجريبي أصلي. I have not acted in commercials.';
const transcript = { source_asset_id: 'source1', original_text: originalText, languages: ['ar', 'en'], timestamp_precision: 'chunk' as const,
  segments: [{ index: 0, start_ms: 0, end_ms: 1000, text: originalText }] };
const transcriptBytes = Buffer.from(JSON.stringify(transcript));
const source = { asset_id: 'source1', sha256: 'a'.repeat(64), size_bytes: 3, mime_type: 'video/mp4' };
const configuration = { media_preparation_version: 'video-preparation.v1', prompt_version: 'candidate_extract_v1', result_schema_version: '1.0', transcription_model_version: 'transcription-test', extraction_model_version: 'extraction-test' };
const facts: CandidateExtraction = { schema_version: '1.0', source_asset_id: source.asset_id,
  facts: { name: null, casting_id: null, age_or_range: null, stated_gender: null, height_measurements: null, languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null }, project_availability_statement: null, evidence: [], uncertainties: [] };
const metadata = (): MediaProviderMetadata => ({ provider: 'openai', task: 'transcript_english', sdk_version: '7.45.1', requested_model: 'extraction-test', resolved_model: 'extraction-test', request_id: 'req_english', response_id: 'resp_english', input_sha256: 'b'.repeat(64), prompt_version: 'transcript-english.v1', usage: null });
const english = (): EnglishTranscript => ({ status: 'available', text: 'Synthetic original text. I have not acted in commercials.', source_sha256: sha(originalText), metadata: [metadata()], failure_code: null });

function setup(version: string | null | undefined = '1.0', partial = false) {
  const config = { ...configuration, ...(version === undefined ? {} : { english_transcript_version: version }) };
  const active: StageLease = { job_id: 'job1', attempt_id: 'attempt1', stage: 'extract_candidate', lease_token: 'private-lease', lease_expires_at: new Date(Date.now() + 90000).toISOString(), already_completed: false,
    input: { input_hash: 'c'.repeat(64), configuration: config } };
  const input = { job_id: active.job_id, attempt_id: active.attempt_id, stage: active.stage, input_hash: active.input.input_hash, configuration: config, source,
    transcript_asset: { asset_id: 'transcript1', sha256: sha(transcriptBytes), size_bytes: transcriptBytes.length, mime_type: 'application/json' }, allow_partial_extraction: partial };
  const events: JobEvent[] = []; const factsInputs: unknown[] = []; let englishCalls = 0;
  const options: CandidateStageOptions = { assets: { read: async () => transcriptBytes, write: async () => { throw new Error('No new original asset should be written.'); } },
    imageId: 'sha256:' + 'd'.repeat(64), transcription: { model: 'transcription-test', apiKey: 'synthetic' }, extraction: { model: 'extraction-test', apiKey: 'synthetic' },
    extract: async value => { factsInputs.push(value); return { result: facts, metadata: { ...metadata(), task: undefined, prompt_version: 'candidate_extract_v1' } }; },
    normalizeEnglish: async value => { englishCalls++; assert.equal(value.original_text, originalText); return english(); } };
  const gateway: CandidateStageGateway = { getInput: async () => input, recordEvent: async event => { events.push(event); return { event_id: event.event_id, applied: true, duplicate: false, stale: false, job_status: 'running' }; } };
  return { active, input, events, options, gateway, factsInputs, englishCalls: () => englishCalls };
}

test('new frozen English jobs emit v2 while extracting facts only from original source segments', async () => {
  const state = setup(); await executeCandidateStage(state.active, state.gateway, state.options);
  const terminal = state.events.at(-1)!; assert.equal(terminal.event_type, 'succeeded'); assert.equal(terminal.result_schema, 'candidate-extraction-stage.v2');
  assert.deepEqual(terminal.result!.english_transcript, english()); assert.equal(state.englishCalls(), 1);
  assert.deepEqual((state.factsInputs[0] as { segments: unknown }).segments, transcript.segments); assert.deepEqual(terminal.result!.result, facts);
  assert.equal(transcript.original_text, originalText); assert.equal(JSON.stringify(terminal.result).includes(originalText), false);
});

test('absent or null frozen flags preserve the old v1 payload and never call normalization', async () => {
  for (const version of [undefined, null]) {
    const state = setup(version); if (version === undefined) { delete state.input.configuration.english_transcript_version; delete (state.active.input.configuration as Record<string, unknown>).english_transcript_version; }
    state.options.normalizeEnglish = async () => { throw new Error('Old job must not invoke English processing.'); };
    await executeCandidateStage(state.active, state.gateway, state.options);
    const terminal = state.events.at(-1)!; assert.equal(terminal.result_schema, 'candidate-extraction-stage.v1'); assert.equal(Object.hasOwn(terminal.result!, 'english_transcript'), false);
  }
});

test('gateway and frozen English version mismatch is rejected before fact or English calls', async () => {
  const state = setup(); state.input.configuration.english_transcript_version = null;
  state.active.input.configuration = { ...configuration, english_transcript_version: '1.0' };
  await assert.rejects(executeCandidateStage(state.active, state.gateway, state.options), { code: 'STAGE_INPUT_INVALID' });
  assert.equal(state.englishCalls(), 0); assert.equal(state.factsInputs.length, 0); assert.equal(state.events.length, 0);
});

test('transient English errors use the existing retry budget, then preserve facts and actual completed metadata without raw fallback', async () => {
  for (const partial of [false, true]) {
    const state = setup('1.0', partial); state.options.normalizeEnglish = async () => { throw new EnglishTranscriptNormalizationError('OPENAI_RATE_LIMITED', true, [metadata()], 1000); };
    await executeCandidateStage(state.active, state.gateway, state.options); const terminal = state.events.at(-1)!;
    assert.equal(terminal.event_type, partial ? 'succeeded' : 'failed');
    if (partial) { assert.deepEqual(terminal.result!.result, facts); assert.deepEqual(terminal.result!.english_transcript, { status: 'unavailable', text: null, source_sha256: sha(originalText), metadata: [metadata()], failure_code: 'ENGLISH_TRANSCRIPT_UNAVAILABLE' }); }
    else { assert.equal(terminal.error!.retryable, true); assert.equal(terminal.result, undefined); }
    assert.doesNotMatch(JSON.stringify({ result: terminal.result, error: terminal.error }), /نص تجريبي|private-lease/u);
  }
});

test('English remains usable when fact extraction has a terminal partial failure', async () => {
  const state = setup(); state.options.extract = async () => { throw new IntegrationError('AI_REFUSAL', 'private-provider-refusal'); };
  await executeCandidateStage(state.active, state.gateway, state.options); const terminal = state.events.at(-1)!;
  assert.equal(terminal.event_type, 'succeeded'); assert.equal(terminal.result!.result, null); assert.deepEqual(terminal.result!.english_transcript, english());
  assert.equal(terminal.result!.manual_profile_required, true); assert.doesNotMatch(JSON.stringify(terminal), /private-provider-refusal/u);
});

test('no raw transcript yields explicit not_provided without fact or English calls', async () => {
  const state = setup(); state.gateway.getInput = async () => ({ ...state.input, transcript_asset: null });
  await executeCandidateStage(state.active, state.gateway, state.options); const terminal = state.events.at(-1)!;
  assert.equal(terminal.result_schema, 'candidate-extraction-stage.v2');
  assert.deepEqual(terminal.result!.english_transcript, { status: 'not_provided', text: null, source_sha256: null, metadata: [], failure_code: null });
  assert.equal(state.englishCalls(), 0); assert.equal(state.factsInputs.length, 0);
});

test('mismatched source English output is unavailable and never displayed or used as fact evidence', async () => {
  const state = setup(); state.options.normalizeEnglish = async () => ({ ...english(), source_sha256: 'f'.repeat(64) });
  await executeCandidateStage(state.active, state.gateway, state.options); const terminal = state.events.at(-1)!;
  assert.equal(terminal.event_type, 'succeeded'); const value = terminal.result!.english_transcript as unknown as EnglishTranscript;
  assert.equal(value.status, 'unavailable'); assert.equal(value.text, null); assert.equal(value.source_sha256, sha(originalText));
});

test('a mislabeled non-Latin provider projection cannot bypass the English display guard', async () => {
  const state = setup(); state.options.normalizeEnglish = async () => ({ ...english(), text: 'نص خاص' });
  await executeCandidateStage(state.active, state.gateway, state.options); const value = state.events.at(-1)!.result!.english_transcript as unknown as EnglishTranscript;
  assert.equal(value.status, 'unavailable'); assert.equal(value.text, null); assert.equal(value.failure_code, 'ENGLISH_TRANSCRIPT_UNAVAILABLE');
});

test('callable scan opt-in adds English without changing old/null configuration fingerprints or results', async () => {
  const prepared: PreparedVideo = { source_asset_id: source.asset_id, source_sha256: source.sha256, probe: { duration_ms: 1000, width: 10, height: 10, rotation_degrees: 0, frame_rate: 25, video_codec: 'h264', audio_codec: 'aac', has_audio: true, container: 'mp4', source_start_ms: 0 },
    audio_chunks: [{ index: 0, start_ms: 0, end_ms: 1000, mime_type: 'audio/mpeg', bytes: new Uint8Array([1]), sha256: 'a'.repeat(64) }], sampled_frames: [], warnings: [], implementation_version: 'video-preparation.v1', ffmpeg_version: 'synthetic' };
  const config = { imageId: 'sha256:' + 'd'.repeat(64), transcription: { model: 'transcription-test', apiKey: 'synthetic' }, extraction: { model: 'extraction-test', apiKey: 'synthetic' } };
  let calls = 0;
  const options = { prepare: async () => prepared, transcribe: async () => ({ result: transcript, metadata: [] }), extract: async () => ({ result: facts, metadata: { ...metadata(), task: undefined } }), normalizeEnglish: async () => { calls++; return english(); } };
  const video = { source_asset_id: source.asset_id, bytes: new Uint8Array([1]), mime_type: 'video/mp4' as const };
  const old = await scanCandidateVideo(video, config, options), absent = await scanCandidateVideo(video, { ...config, english_transcript_version: null }, options);
  assert.equal(old.input_hash, absent.input_hash); assert.equal(Object.hasOwn(old, 'english_transcript'), false); assert.equal(calls, 0);
  const current = await scanCandidateVideo(video, { ...config, english_transcript_version: '1.0' }, options);
  assert.notEqual(current.input_hash, old.input_hash); assert.deepEqual(current.english_transcript, english()); assert.equal(calls, 1);
});
