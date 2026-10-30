import type { VersionTranscriptCompanion } from '@eps/domain';

/** Playback companion only; never part of a candidate slide or PDF. */
export function SourceTranscript({ versionId, assetId, transcript }: {
  versionId: string; assetId: string; transcript?: VersionTranscriptCompanion;
}) {
  if (transcript && (transcript.version_id !== versionId || transcript.asset_id !== assetId
    || transcript.source_kind !== 'source_transcript' || transcript.status === 'available' && !transcript.original_text?.trim())) {
    return <p role="alert">The source transcript could not be confirmed for this video.</p>;
  }
  if (!transcript || transcript.status === 'not_captured') return <p className="small muted">Transcript was not captured for this saved version.</p>;
  if (transcript.status === 'not_provided') return <p className="small muted">Transcript not provided.</p>;
  const providedLanguage = transcript.languages.length === 1 ? transcript.languages[0] : '';
  const languageNames: Record<string, string> = { arabic: 'ar', english: 'en' };
  const language = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/iu.test(providedLanguage) ? providedLanguage : languageNames[providedLanguage.toLowerCase()];
  const languageLabels: Record<string, string> = { ar: 'Arabic', en: 'English' };
  return <details className="playback-transcript" aria-label="Source transcript">
    <summary>Read source transcript</summary>
    <p className="small muted">Source transcript saved with this original video. Transcription may contain errors.</p>
    <p className="small">Source language: <span dir="auto">{transcript.languages.length ? transcript.languages.map(value => languageLabels[value.toLowerCase()] ?? value).join(' · ') : 'Not provided'}</span></p>
    <div className="source-transcript" role="region" aria-label="Original-language transcript" tabIndex={0} dir="auto" lang={language}>{transcript.original_text}</div>
  </details>;
}
