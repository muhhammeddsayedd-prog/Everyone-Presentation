import { createHash } from 'node:crypto';
import type { VersionTranscriptCompanion } from '../../domain/src/presentation-types.ts';
import { parseVersionTranscript } from '../../domain/src/presentation-transcript.ts';
import { presentationResponseInvalid } from './presentation-dto.ts';

/** Called only after the exact version/video access operation succeeds. Missing
 * pre-companion responses are explicit legacy absence, never a live-source read. */
export function versionTranscript(value: unknown, versionId: string, assetId: string): VersionTranscriptCompanion {
  try {
    const result = value === undefined ? { version_id: versionId, asset_id: assetId, status: 'not_captured' as const,
      original_text: null, languages: [], source_kind: 'source_transcript' as const, source_sha256: null } : parseVersionTranscript(value);
    if (result.version_id !== versionId || result.asset_id !== assetId
      || result.status === 'available' && createHash('sha256').update(result.original_text!, 'utf8').digest('hex') !== result.source_sha256) presentationResponseInvalid();
    return result;
  } catch { return presentationResponseInvalid(); }
}
