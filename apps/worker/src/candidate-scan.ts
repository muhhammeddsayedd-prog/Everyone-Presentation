import { createHash } from 'node:crypto';
import { IntegrationError } from '../../../packages/integrations/src/errors.ts';
import { extractCandidate, transcribeAudio, type OpenAIMediaConfig } from '../../../packages/integrations/src/openai-media.ts';
import { validateFrameSelection } from '../../../packages/integrations/src/media-schema.ts';
import type { CandidateExtraction, MediaProviderMetadata, TranscriptionResult } from '../../../packages/integrations/src/media-types.ts';
import { prepareVideoIsolated } from './video-container.ts';
import { selectRealFrames } from './video-quality.ts';
import type { FrameSelection, PreparedVideo, VideoInput } from './video-types.ts';

export interface CandidateScanConfiguration { imageId: string; transcription: OpenAIMediaConfig; extraction: OpenAIMediaConfig; languages?: string[] }
export interface CandidateScanResult {
  source_asset_id: string; source_sha256: string; prepared: PreparedVideo;
  transcript: TranscriptionResult | null; candidate_extraction: CandidateExtraction | null; frame_selection: FrameSelection;
  provider_metadata: MediaProviderMetadata[]; issues: { stage: 'transcribe' | 'extract_candidate'; code: string; retryable: boolean }[];
  status: 'succeeded' | 'partial'; input_hash: string;
}
/** Shared callable computation for stage executors and local integration proofs.
 * Does not publish assets, create profiles or claim durable job completion. The
 * caller persists each stage output through its active fenced job lease. */
export async function scanCandidateVideo(input: VideoInput, configuration: CandidateScanConfiguration, options: { signal?: AbortSignal;
  prepare?: typeof prepareVideoIsolated; transcribe?: typeof transcribeAudio; extract?: typeof extractCandidate } = {}): Promise<CandidateScanResult> {
  const prepared = await (options.prepare ?? prepareVideoIsolated)(input, { imageId: configuration.imageId, signal: options.signal });
  const input_hash = createHash('sha256').update(JSON.stringify({ source_sha256: prepared.source_sha256, implementation: prepared.implementation_version,
    transcription_model: configuration.transcription.model, extraction_model: configuration.extraction.model, prompt_version: 'candidate_extract_v1', schema_version: '1.0' })).digest('hex');
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
  // An audio/provider failure never discards independent real source frames.
  const frame_selection = validateFrameSelection(selectRealFrames(input.source_asset_id, prepared.sampled_frames), input.source_asset_id, prepared.sampled_frames);
  return { source_asset_id: input.source_asset_id, source_sha256: prepared.source_sha256, prepared, transcript, candidate_extraction: candidate, frame_selection,
    provider_metadata: metadata, issues, status: issues.length || prepared.warnings.length ? 'partial' : 'succeeded', input_hash };
}
