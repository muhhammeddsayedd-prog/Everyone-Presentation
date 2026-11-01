import type { VersionTranscriptCompanion } from '@eps/domain';
import { versionEnglishFields } from '../../../packages/domain/src/english-transcript.ts';
import { englishTranscript, spokenLanguageLabel } from './english-transcript';

/** Playback companion only; never part of a candidate slide or PDF. Shows the frozen English capture only. */
export function SourceTranscript({ versionId, assetId, transcript }: {
  versionId: string; assetId: string; transcript?: VersionTranscriptCompanion;
}) {
  if (transcript && (transcript.version_id !== versionId || transcript.asset_id !== assetId || transcript.source_kind !== 'source_transcript')) {
    return <p role="alert">The source transcript could not be confirmed for this video.</p>;
  }
  let fields;
  try { fields = transcript && versionEnglishFields(transcript as unknown as Record<string, unknown>); }
  catch { return <p role="alert">The English transcript could not be confirmed for this video.</p>; }
  const english = englishTranscript(fields?.english_status, fields?.english_text);
  if (!english.text) return <p className="small muted">{!fields || fields.english_status === 'not_captured' ? 'English transcript was not captured for this saved version.' : english.message}</p>;
  return <details className="playback-transcript" aria-label="Source transcript">
    <summary>Read English transcript</summary>
    <p className="small muted">English transcript saved with this original video. Transcription and translation may contain errors.</p>
    <p className="small">Spoken language: <span>{transcript?.languages.length ? transcript.languages.map(spokenLanguageLabel).join(' · ') : 'Not provided'}</span></p>
    <div className="source-transcript" role="region" aria-label="English transcript" tabIndex={0} dir="auto" lang="en">{english.text}</div>
  </details>;
}
