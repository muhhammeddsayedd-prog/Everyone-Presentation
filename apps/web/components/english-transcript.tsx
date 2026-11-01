import type { CandidateMedia, EnglishTranscriptStatus } from '@eps/domain';
import { candidateEnglishFields } from '../../../packages/domain/src/english-transcript.ts';

/** Provider language metadata is a label, never a raw display fallback. */
export function spokenLanguageLabel(value: string): string {
  const name = value.trim();
  const aliases: Record<string, string> = { arabic: 'Arabic', english: 'English' };
  if (Object.hasOwn(aliases, name.toLowerCase())) return aliases[name.toLowerCase()];
  if (/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/iu.test(name)) {
    try { return new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' }).of(name) ?? 'Other spoken language'; }
    catch { return 'Other spoken language'; }
  }
  return 'Other spoken language';
}

// Adapted from frontend/redesign@8aed642. Shared contract and domain validation
// are now present; original-language text is never a display fallback.
const absence: Record<Exclude<EnglishTranscriptStatus, 'available'>, string> = {
  not_provided: 'English transcript not provided.',
  unavailable: 'English transcript unavailable. The source speech could not be converted to English.',
  not_captured: 'English transcript was not captured for this material.',
};

/** Displays an already validated English projection, including legacy absence. */
export function englishTranscript(status?: EnglishTranscriptStatus, text?: string | null): { text: string | null; message: string } {
  if (status === 'available') return text ? { text, message: '' } : { text: null, message: 'The English transcript could not be confirmed.' };
  return { text: null, message: absence[status ?? 'not_captured'] };
}

/** Candidate introduction transcript (library profile and internal review). */
export function CandidateEnglishTranscript({ media, className = 'candidate-transcript' }: { media: CandidateMedia; className?: string }) {
  let fields;
  try { fields = candidateEnglishFields(media as unknown as Record<string, unknown>); }
  catch { return <p className="field-error" role="alert">The English transcript could not be confirmed.</p>; }
  const result = englishTranscript(fields?.english_transcript_status, fields?.english_transcript);
  if (!result.text) return <p className="small muted">{result.message}</p>;
  return <p className={className} lang="en" dir="auto">{result.text}</p>;
}
