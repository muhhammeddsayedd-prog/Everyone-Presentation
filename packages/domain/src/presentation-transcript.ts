import { DomainError } from './types.ts';
import type { VersionTranscriptCompanion } from './presentation-types.ts';
import { versionEnglishFields } from './english-transcript.ts';

const keys = ['version_id', 'asset_id', 'status', 'original_text', 'languages', 'source_kind', 'source_sha256'];
const englishKeys = ['english_text', 'english_status', 'english_sha256'];
function invalid(): never { throw new DomainError('VALIDATION_FAILED', 'Saved transcript does not match its fixed contract.', 400); }
function text(value: unknown, maximum: number, multiline = false): value is string {
  if (typeof value !== 'string') return false;
  let length = 0;
  for (const char of value) {
    const point = char.codePointAt(0)!;
    if (++length > maximum || point >= 0xd800 && point <= 0xdfff || point === 127 || point < 32 && !(multiline && [9, 10, 13].includes(point))) return false;
  }
  return true;
}
export function parseVersionTranscript(value: unknown): VersionTranscriptCompanion {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![null, Object.prototype].includes(Object.getPrototypeOf(value))) invalid();
  const row = value as Record<string, unknown>;
  if (keys.some(key => !Object.hasOwn(row, key)) || Object.keys(row).some(key => !keys.includes(key) && !englishKeys.includes(key))
    || !text(row.version_id, 200) || !row.version_id || !text(row.asset_id, 200) || !row.asset_id
    || !['available', 'not_provided', 'not_captured'].includes(row.status as string) || row.source_kind !== 'source_transcript'
    || !Array.isArray(row.languages) || row.languages.length > 100
    || row.languages.some(item => !text(item, 1000) || !item.trim())) invalid();
  if (row.status === 'available') {
    if (!text(row.original_text, 200000, true) || !row.original_text.trim() || typeof row.source_sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(row.source_sha256)) invalid();
  } else if (row.original_text !== null || row.source_sha256 !== null || row.languages.length !== 0) invalid();
  versionEnglishFields(row);
  return structuredClone(row) as unknown as VersionTranscriptCompanion;
}
