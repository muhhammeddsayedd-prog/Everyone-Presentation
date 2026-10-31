import type { CandidateMedia, EnglishTranscriptStatus, VersionTranscriptCompanion } from '@eps/domain';

// English-only display contract (docs/integrations/ENGLISH_TRANSCRIPT.md, canonical types in
// packages/domain/src/english-transcript.ts). The client mirrors the shared group rules:
// a group is all-or-nothing, a missing legacy group means not captured, and original-language
// text is never a display fallback.
export type { EnglishTranscriptStatus };
const statuses = new Set<unknown>(['available', 'not_provided', 'unavailable', 'not_captured']);
const absence: Record<Exclude<EnglishTranscriptStatus, 'available'>, string> = {
  not_provided: 'English transcript not provided.',
  unavailable: 'English transcript unavailable. The source speech could not be converted to English.',
  not_captured: 'English transcript was not captured for this material.',
};
const invalidMessage = 'The English transcript could not be confirmed.';
export type EnglishResult = { text: string | null; status: EnglishTranscriptStatus | 'absent' | 'invalid'; message: string };

function englishText(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200000) return false;
  for (const char of value) {
    const point = char.codePointAt(0)!;
    if (point >= 0xd800 && point <= 0xdfff || point === 127 || point < 32 && ![9, 10, 13].includes(point)
      || /\p{Letter}/u.test(char) && !/\p{Script=Latin}/u.test(char)) return false;
  }
  return true;
}
function groupState(row: object, keys: string[]): 'absent' | 'complete' | 'partial' {
  const found = keys.filter(key => Object.hasOwn(row, key)).length;
  return found === 0 ? 'absent' : found === keys.length ? 'complete' : 'partial';
}
function resolve(status: unknown, text: unknown, hashOk: boolean): EnglishResult {
  if (!statuses.has(status)) return { text: null, status: 'invalid', message: invalidMessage };
  if (status === 'available') return englishText(text) && hashOk ? { text, status: 'available', message: '' } : { text: null, status: 'invalid', message: invalidMessage };
  if (text !== null) return { text: null, status: 'invalid', message: invalidMessage };
  const known = status as Exclude<EnglishTranscriptStatus, 'available'>;
  return { text: null, status: known, message: absence[known] };
}

/** Candidate media group: english_transcript + english_transcript_status. */
export function candidateEnglish(media: CandidateMedia): EnglishResult {
  const state = groupState(media, ['english_transcript', 'english_transcript_status']);
  if (state === 'absent') return { text: null, status: 'absent', message: absence.not_captured };
  if (state === 'partial') return { text: null, status: 'invalid', message: invalidMessage };
  return resolve(media.english_transcript_status, media.english_transcript, true);
}

/** Frozen saved-version companion group: english_text + english_status + english_sha256. */
export function versionEnglish(companion: VersionTranscriptCompanion): EnglishResult {
  const state = groupState(companion, ['english_text', 'english_status', 'english_sha256']);
  if (state === 'absent') return { text: null, status: 'absent', message: 'English transcript was not captured for this saved version.' };
  if (state === 'partial') return { text: null, status: 'invalid', message: invalidMessage };
  const available = companion.english_status === 'available';
  const hashOk = available ? typeof companion.english_sha256 === 'string' && /^[a-f0-9]{64}$/u.test(companion.english_sha256) : companion.english_sha256 === null;
  if (!available && !hashOk) return { text: null, status: 'invalid', message: invalidMessage };
  const result = resolve(companion.english_status, companion.english_text, hashOk);
  return result.status === 'not_captured' ? { ...result, message: 'English transcript was not captured for this saved version.' } : result;
}

/** Candidate introduction transcript (library profile and internal review). */
export function CandidateEnglishTranscript({ media, className = 'candidate-transcript' }: { media: CandidateMedia; className?: string }) {
  const result = candidateEnglish(media);
  if (!result.text) return <p className={result.status === 'invalid' ? 'field-error' : 'small muted'} role={result.status === 'invalid' ? 'alert' : undefined}>{result.message}</p>;
  return <p className={className} lang="en" dir="auto">{result.text}</p>;
}
