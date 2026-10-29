import { DomainError } from './types.ts';
import type { CandidateFrame, CandidateMedia } from './candidate-types.ts';

export interface FrameExtractionInput { source_asset_id: string; timestamps_ms: number[] }
export interface FrameExtractionAccepted { job_id: string; resource_id: string | null; poll_url: string; status: 'queued' | 'running' | 'waiting_for_input' | 'succeeded' | 'failed' | 'cancelled' }
function invalid(): never { throw new DomainError('VALIDATION_FAILED', 'Choose one to ten distinct timestamps from this source recording.', 400); }
function id(value: unknown): value is string { return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 200 && !/[\p{C}]/u.test(value); }
export function parseFrameExtraction(value: unknown): FrameExtractionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![null, Object.prototype].includes(Object.getPrototypeOf(value))) invalid();
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== 2 || !id(item.source_asset_id) || !Array.isArray(item.timestamps_ms) || item.timestamps_ms.length < 1 || item.timestamps_ms.length > 10
    || item.timestamps_ms.some(timestamp => typeof timestamp !== 'number' || !Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp >= 1_800_000)
    || new Set(item.timestamps_ms).size !== item.timestamps_ms.length) invalid();
  return { source_asset_id: item.source_asset_id, timestamps_ms: [...item.timestamps_ms].sort((a, b) => a - b) };
}
/** Pure commit rule. Extraction appends immutable available material; selecting
 * replacements and updating any project's pins remain explicit operations. */
export function appendExtractedCandidateFrames(before: CandidateMedia, expectedRowVersion: number, frames: CandidateFrame[]): CandidateMedia {
  if (!Number.isSafeInteger(expectedRowVersion) || expectedRowVersion < 1) invalid();
  if (before.row_version !== expectedRowVersion) throw new DomainError('STALE_RESOURCE_VERSION', 'The media changed. Existing frame selections were preserved.', 409, { current_row_version: before.row_version });
  if (!Array.isArray(frames) || frames.length > 10 || new Set(frames.map(frame => frame.asset_id)).size !== frames.length) invalid();
  for (const frame of frames) if (!id(frame.asset_id) || frame.source_asset_id !== before.source_asset_id || !Number.isSafeInteger(frame.timestamp_ms) || frame.timestamp_ms < 0 || frame.timestamp_ms >= 1_800_000
    || !Number.isSafeInteger(frame.width) || frame.width < 1 || frame.width > 1280 || !Number.isSafeInteger(frame.height) || frame.height < 1 || frame.height > 1280
    || !Array.isArray(frame.quality_flags) || frame.quality_flags.some(flag => !['EXPOSURE_LIMIT', 'LOW_DETAIL'].includes(flag)) || before.available_frames.some(existing => existing.asset_id === frame.asset_id)) invalid();
  if (before.available_frames.length + frames.length > 100) throw new DomainError('MEDIA_REFERENCE_INVALID', 'This introduction already has the maximum number of available frames.', 422);
  return { ...structuredClone(before), available_frames: [...structuredClone(before.available_frames), ...structuredClone(frames)], row_version: before.row_version + (frames.length ? 1 : 0) };
}
