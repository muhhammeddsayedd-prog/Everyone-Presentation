/** Private original-language transcript. Segment times are real chunk bounds,
 * not a claim of word/utterance alignment. Never log this payload. */
export interface TranscriptSegment { index: number; start_ms: number; end_ms: number; text: string }
export interface TranscriptSource { source_asset_id: string; segments: TranscriptSegment[] }
export type { CandidateFacts, CandidateExtraction } from '../../domain/src/candidate-types.ts';
export interface FrameSelection {
  schema_version: '1.0'; source_asset_id: string; selected_frames: { frame_asset_id: string; reason: string }[];
  insufficient_frames_reason: string | null;
}
export interface AudioChunk { index: number; start_ms: number; end_ms: number; mime_type: 'audio/mpeg'; sha256: string; bytes: Uint8Array }
export interface TranscriptionResult extends TranscriptSource { original_text: string; languages: string[]; timestamp_precision: 'chunk'; }
export interface MediaProviderMetadata {
  provider: 'openai'; sdk_version: '7.45.1'; requested_model: string; resolved_model: string | null;
  request_id: string | null; response_id: string | null; prompt_version: string; input_sha256: string;
  usage: Record<string, number | string> | null;
  prompt_sha256?: string; schema_sha256?: string; provider_schema_sha256?: string; audio_duration_ms?: number;
}
