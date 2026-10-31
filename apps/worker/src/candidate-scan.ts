import { createHash } from 'node:crypto';
import { IntegrationError } from '../../../packages/integrations/src/errors.ts';
import { extractCandidate, transcribeAudio, type OpenAIMediaConfig } from '../../../packages/integrations/src/openai-media.ts';
import { selectVisionFrames } from '../../../packages/integrations/src/openai-frames.ts';
import { validateFrameSelection } from '../../../packages/integrations/src/media-schema.ts';
import type { CandidateExtraction, EnglishTranscript, MediaProviderMetadata, TranscriptionResult } from '../../../packages/integrations/src/media-types.ts';
import { normalizeTranscriptEnglish } from '../../../packages/integrations/src/openai-transcript-english.ts';
import { candidateEnglishTranscript, candidateEnglishVersion } from './candidate-english.ts';
import { prepareVideoIsolated } from './video-container.ts';
import type { FrameSelection, PreparedVideo, VideoInput } from './video-types.ts';

export interface CandidateScanConfiguration { imageId: string; transcription: OpenAIMediaConfig; extraction: OpenAIMediaConfig; languages?: string[]; english_transcript_version?: '1.0' | null }
export interface CandidateScanResult {
  source_asset_id: string; source_sha256: string; prepared: PreparedVideo;
  transcript: TranscriptionResult | null; candidate_extraction: CandidateExtraction | null; frame_selection: FrameSelection;
  frame_selection_method: 'openai_vision' | 'manual_required' | 'no_frames';
  provider_metadata: MediaProviderMetadata[]; issues: { stage: 'transcribe' | 'extract_candidate' | 'select_frames'; code: string; retryable: boolean }[];
  status: 'succeeded' | 'partial'; input_hash: string;
  english_transcript?: EnglishTranscript;
}
/** Shared callable computation for stage executors and local integration proofs.
 * Does not publish assets, create profiles or claim durable job completion. The
 * caller persists each stage output through its active fenced job lease. */
export async function scanCandidateVideo(input: VideoInput, configuration: CandidateScanConfiguration, options: { signal?: AbortSignal;
  prepare?: typeof prepareVideoIsolated; transcribe?: typeof transcribeAudio; extract?: typeof extractCandidate; selectFrames?: typeof selectVisionFrames; normalizeEnglish?: typeof normalizeTranscriptEnglish } = {}): Promise<CandidateScanResult> {
  const englishVersion = candidateEnglishVersion(configuration.english_transcript_version);
  const prepared = await (options.prepare ?? prepareVideoIsolated)(input, { imageId: configuration.imageId, signal: options.signal });
  const input_hash = createHash('sha256').update(JSON.stringify({ source_sha256: prepared.source_sha256, implementation: prepared.implementation_version,
    transcription_model: configuration.transcription.model, extraction_model: configuration.extraction.model, prompt_version: 'candidate_extract_v1', schema_version: '1.0',
    ...(englishVersion ? { english_transcript_version: englishVersion, english_prompt_version: 'transcript-english.v1' } : {}) })).digest('hex');
  const issues: CandidateScanResult['issues'] = []; const metadata: MediaProviderMetadata[] = []; let transcript: TranscriptionResult | null = null; let candidate: CandidateExtraction | null = null;
  function issue(error: unknown, stage: CandidateScanResult['issues'][number]['stage']) {
    if (options.signal?.aborted || error instanceof IntegrationError && error.code === 'PROCESSING_CANCELLED') throw new IntegrationError('PROCESSING_CANCELLED', 'Candidate scanning was cancelled.');
    issues.push({ stage, code: error instanceof IntegrationError ? error.code : 'MEDIA_PROVIDER_UNCONFIRMED', retryable: error instanceof IntegrationError && error.retryable });
  }
  if (prepared.audio_chunks.length) {
    try { const result = await (options.transcribe ?? transcribeAudio)({ source_asset_id: input.source_asset_id, chunks: prepared.audio_chunks, languages: configuration.languages }, configuration.transcription, undefined, options.signal); transcript = result.result; metadata.push(...result.metadata); }
    catch (error) { issue(error, 'transcribe'); }
  } else issues.push({ stage: 'transcribe', code: prepared.probe.has_audio ? 'NO_INTELLIGIBLE_AUDIO' : 'NO_AUDIO_STREAM', retryable: false });
  if (transcript) {
    try { const result = await (options.extract ?? extractCandidate)({ source_asset_id: input.source_asset_id, segments: transcript.segments, input_hash }, configuration.extraction, undefined, options.signal); candidate = result.result; metadata.push(result.metadata); }
    catch (error) { issue(error, 'extract_candidate'); }
  }
  let english: EnglishTranscript | undefined;
  if (englishVersion) {
    english = await candidateEnglishTranscript(transcript ? { source_asset_id: input.source_asset_id, original_text: transcript.original_text } : null,
      { configuration: configuration.extraction, allowPartial: true, signal: options.signal, normalize: options.normalizeEnglish });
    metadata.push(...english.metadata);
    if (english.status === 'unavailable') issue(new IntegrationError('ENGLISH_TRANSCRIPT_UNAVAILABLE', 'English transcript normalization is unavailable.'), 'extract_candidate');
  }
  // An audio/provider failure never discards independent real source frames.
  let frame_selection: FrameSelection = { schema_version: '1.0', source_asset_id: input.source_asset_id, selected_frames: [], insufficient_frames_reason: 'No real source frames were prepared; manual selection remains available.' };
  let frame_selection_method: CandidateScanResult['frame_selection_method'] = 'no_frames';
  if (prepared.sampled_frames.length) {
    try {
      const output = await (options.selectFrames ?? selectVisionFrames)({ source_asset_id: input.source_asset_id, input_hash, frames: prepared.sampled_frames.map(frame => ({ frame_asset_id: frame.frame_asset_id, source_asset_id: frame.source_asset_id, timestamp_ms: frame.timestamp_ms, width: frame.width, height: frame.height, sha256: frame.sha256, bytes: frame.bytes })) }, configuration.extraction, options.signal);
      frame_selection = validateFrameSelection(output.result, input.source_asset_id, prepared.sampled_frames); metadata.push(output.metadata); frame_selection_method = 'openai_vision';
    } catch (error) { issue(error, 'select_frames'); frame_selection_method = 'manual_required'; frame_selection.insufficient_frames_reason = 'Automatic frame review was unavailable; choose real source frames manually.'; }
  }
  return { source_asset_id: input.source_asset_id, source_sha256: prepared.source_sha256, prepared, transcript, candidate_extraction: candidate, frame_selection,
    frame_selection_method, provider_metadata: metadata, issues, status: issues.length || prepared.warnings.length || frame_selection.selected_frames.length < 3 ? 'partial' : 'succeeded', input_hash,
    ...(english ? { english_transcript: english } : {}) };
}
