import type { AudioChunk, FrameSelection } from '../../../packages/integrations/src/media-types.ts';
export const VIDEO_LIMITS = Object.freeze({ maximumBytes: 256 * 1024 * 1024, maximumDurationMs: 30 * 60 * 1000,
  maximumDimension: 4096, maximumFrameRate: 120, maximumSamples: 12, maximumFrameBytes: 2 * 1024 * 1024,
  maximumAudioChunkBytes: 1024 * 1024, audioChunkMs: 120_000, audioOverlapMs: 2000, maximumChunks: 16,
  maximumProcessMs: 180_000, maximumConcurrent: 2 });
export class VideoPreparationError extends Error {
  readonly code: string; readonly retryable: boolean;
  constructor(code: string, message = 'This video could not be prepared. The original was retained.', retryable = false) { super(message); this.name = 'VideoPreparationError'; this.code = code; this.retryable = retryable; }
}
export interface VideoInput { source_asset_id: string; bytes: Uint8Array; mime_type: 'video/mp4' | 'video/quicktime' | 'video/webm' | 'video/x-matroska' }
export interface VideoProbe { duration_ms: number; width: number; height: number; rotation_degrees: number; frame_rate: number;
  video_codec: string; audio_codec: string | null; has_audio: boolean; container: string; source_start_ms: number; }
export interface VideoDisplayGeometry { sample_aspect_ratio: { numerator: number; denominator: number }; display_aspect_ratio: { numerator: number; denominator: number }; width: number; height: number }
export interface RealFrame {
  frame_asset_id: string; source_asset_id: string; timestamp_ms: number; width: number; height: number;
  requested_timestamp_ms?: number;
  sha256: string; bytes: Uint8Array; quality_flags: string[];
  quality: { luminance: number; contrast: number; sharpness: number; difference_hash: string };
}
export interface PreparedVideo { source_asset_id: string; source_sha256: string; probe: VideoProbe; audio_chunks: AudioChunk[];
  sampled_frames: RealFrame[]; warnings: string[]; implementation_version: 'video-preparation.v1'; ffmpeg_version: string; display_geometry?: VideoDisplayGeometry }
export type { AudioChunk, FrameSelection };
