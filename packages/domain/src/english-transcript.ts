import { DomainError } from './types.ts';

export type EnglishTranscriptStatus = 'available' | 'not_provided' | 'unavailable' | 'not_captured';
export interface CandidateEnglishFields { english_transcript: string | null; english_transcript_status: EnglishTranscriptStatus }
export interface VersionEnglishFields { english_text: string | null; english_status: EnglishTranscriptStatus; english_sha256: string | null }
const states = new Set<unknown>(['available', 'not_provided', 'unavailable', 'not_captured']);
function invalid(): never { throw new DomainError('VALIDATION_FAILED', 'English transcript does not match its saved contract.', 400); }
function present(row: Record<string, unknown>, keys: string[]): boolean {
  const found = keys.filter(key => Object.hasOwn(row, key)).length;
  if (found !== 0 && found !== keys.length) invalid();
  return found !== 0;
}
function englishText(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  let length = 0;
  for (const char of value) {
    const point = char.codePointAt(0)!;
    if (++length > 200000 || point >= 0xd800 && point <= 0xdfff || point === 127
      || point < 32 && ![9, 10, 13].includes(point)
      || /\p{Letter}/u.test(char) && !/\p{Script=Latin}/u.test(char)) return false;
  }
  return true;
}
/** Legacy original-language fields never supply the display projection. */
export function candidateEnglishFields(row: Record<string, unknown>): CandidateEnglishFields | undefined {
  if (!present(row, ['english_transcript', 'english_transcript_status'])) return undefined;
  if (!states.has(row.english_transcript_status)
    || (row.english_transcript_status === 'available' ? !englishText(row.english_transcript) : row.english_transcript !== null)) invalid();
  return { english_transcript: row.english_transcript as string | null,
    english_transcript_status: row.english_transcript_status as EnglishTranscriptStatus };
}
export function versionEnglishFields(row: Record<string, unknown>): VersionEnglishFields | undefined {
  if (!present(row, ['english_text', 'english_status', 'english_sha256'])) return undefined;
  if (!states.has(row.english_status) || (row.english_status === 'available'
    ? !englishText(row.english_text) || typeof row.english_sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(row.english_sha256)
    : row.english_text !== null || row.english_sha256 !== null)) invalid();
  return { english_text: row.english_text as string | null, english_status: row.english_status as EnglishTranscriptStatus,
    english_sha256: row.english_sha256 as string | null };
}
