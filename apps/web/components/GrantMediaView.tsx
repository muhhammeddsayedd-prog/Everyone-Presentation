'use client';

import { useEffect, useState } from 'react';
import type { VersionMediaPlayback, VersionTranscriptCompanion } from '@eps/domain';
import { GuestShell } from './GuestReviewView';
import { ErrorNotice, Loading } from './Feedback';
import { reviewRequest, reviewError, sameOriginReviewUrl } from './review-client';
import { SourceTranscript } from './SourceTranscript';

export function GrantMediaView({ grant, versionId, assetId }: { grant?: string; versionId: string; assetId: string }) {
  const [url, setUrl] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(true), [refresh, setRefresh] = useState(0);
  const [transcript, setTranscript] = useState<VersionTranscriptCompanion>();
  useEffect(() => {
    let current = true; const controller = new AbortController();
    const open = async () => {
      try {
        const validId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
        if (!validId.test(versionId) || !validId.test(assetId) || grant && !/^[A-Za-z0-9_-]{43}$/u.test(grant)) throw new Error('This original video is no longer available.');
        const result = (await reviewRequest<VersionMediaPlayback>(`/api/v1/review-media/versions/${versionId}/media/${assetId}/playback`, undefined,
          { method: 'POST', headers: { 'X-EPS-Review-Browser': '1', ...(grant ? { 'X-Media-Grant': grant } : {}) }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) })).data;
        if (result.source_version_id !== versionId || result.asset_id !== assetId) throw new Error('Original video identity could not be confirmed.');
        const safe = sameOriginReviewUrl(result.url, `/api/v1/review-media/versions/${versionId}/media/${assetId}/content`);
        if (!current) return; window.history.replaceState(null, '', `/m/playback?version=${versionId}&asset=${assetId}`); setUrl(safe); setTranscript(result.transcript); setError('');
      } catch (reason) { if (current) { setUrl(''); setTranscript(undefined); setError(reviewError(reason)); } }
      finally { if (current) setBusy(false); }
    }; void open(); return () => { current = false; controller.abort(); };
  }, [grant, versionId, assetId, refresh]);
  return <GuestShell><section className="guest-media-destination"><h1>Original introduction</h1><p>This video belongs to the saved PDF’s original presentation version.</p>{busy ? <Loading label="Checking video access…" /> : error ? <><h2>This original video is no longer available.</h2><ErrorNotice message={error} /><p>Please ask the producer to check the review link.</p><button className="button" onClick={() => { setBusy(true); setRefresh(value => value + 1); }}>Retry video access</button></> : <><video src={url} className="candidate-video" controls preload="metadata" onError={() => { setUrl(''); setError('Video access is no longer available. Retry to check the review link.'); }} /><SourceTranscript versionId={versionId} assetId={assetId} transcript={transcript} /></>}</section></GuestShell>;
}
