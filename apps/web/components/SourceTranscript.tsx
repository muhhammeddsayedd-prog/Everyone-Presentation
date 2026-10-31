import { englishTranscript, type EnglishCompanion } from './english-transcript';

/** Playback companion only; never part of a candidate slide or PDF. Shows English only. */
export function SourceTranscript({ versionId, assetId, transcript }: {
  versionId: string; assetId: string; transcript?: EnglishCompanion;
}) {
  if (transcript && (transcript.version_id !== versionId || transcript.asset_id !== assetId || transcript.source_kind !== 'source_transcript')) {
    return <p role="alert">The source transcript could not be confirmed for this video.</p>;
  }
  // Older saved versions carry no English group: they state that English was not captured.
  const english = englishTranscript(transcript?.english_status, transcript?.english_text);
  if (english.invalid) return <p role="alert">The English transcript could not be confirmed for this video.</p>;
  if (!english.text) return <p className="small muted">{transcript?.english_status === undefined || transcript.english_status === 'not_captured' ? 'English transcript was not captured for this saved version.' : english.message}</p>;
  const languageLabels: Record<string, string> = { ar: 'Arabic', en: 'English' };
  return <details className="playback-transcript" aria-label="Source transcript">
    <summary>Read English transcript</summary>
    <p className="small muted">English transcript saved with this original video. Transcription and translation may contain errors.</p>
    <p className="small">Spoken language: <span dir="auto">{transcript?.languages.length ? transcript.languages.map(value => languageLabels[value.toLowerCase()] ?? value).join(' · ') : 'Not provided'}</span></p>
    <div className="source-transcript" role="region" aria-label="English transcript" tabIndex={0} dir="auto" lang="en">{english.text}</div>
  </details>;
}
