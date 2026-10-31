import type { CandidateMedia, VersionTranscriptCompanion } from '@eps/domain';

// English-only display contract (docs/integrations/ENGLISH_TRANSCRIPT.md). The fields are
// optional until the shared contract types land; a missing group means not captured.
// Original-language text is never a display fallback.
export type EnglishTranscriptStatus = 'available' | 'not_provided' | 'unavailable' | 'not_captured';
export type EnglishCandidateMedia = CandidateMedia & { english_transcript?: string | null; english_transcript_status?: EnglishTranscriptStatus };
export type EnglishCompanion = VersionTranscriptCompanion & { english_text?: string | null; english_status?: EnglishTranscriptStatus; english_sha256?: string | null };

const statuses: readonly EnglishTranscriptStatus[] = ['available', 'not_provided', 'unavailable', 'not_captured'];
const absence: Record<Exclude<EnglishTranscriptStatus, 'available'>, string> = {
  not_provided: 'English transcript not provided.',
  unavailable: 'English transcript unavailable. The source speech could not be converted to English.',
  not_captured: 'English transcript was not captured for this material.',
};

/** Returns the English text to show, or the absence message for its status. `invalid` marks an inconsistent group. */
export function englishTranscript(status: unknown, text: unknown): { text: string | null; message: string; invalid: boolean } {
  if (status === undefined && (text === undefined || text === null)) return { text: null, message: absence.not_captured, invalid: false };
  if (typeof status !== 'string' || !statuses.includes(status as EnglishTranscriptStatus)) return { text: null, message: 'The English transcript could not be confirmed.', invalid: true };
  if (status === 'available') return typeof text === 'string' && text.trim() ? { text, message: '', invalid: false } : { text: null, message: 'The English transcript could not be confirmed.', invalid: true };
  if (text !== null && text !== undefined) return { text: null, message: 'The English transcript could not be confirmed.', invalid: true };
  return { text: null, message: absence[status as Exclude<EnglishTranscriptStatus, 'available'>], invalid: false };
}

/** Candidate introduction transcript (library profile and internal review). */
export function CandidateEnglishTranscript({ media, className = 'candidate-transcript' }: { media: CandidateMedia; className?: string }) {
  const value = media as EnglishCandidateMedia;
  const result = englishTranscript(value.english_transcript_status, value.english_transcript);
  if (!result.text) return <p className={result.invalid ? 'field-error' : 'small muted'} role={result.invalid ? 'alert' : undefined}>{result.message}</p>;
  return <p className={className} lang="en" dir="auto">{result.text}</p>;
}
