'use client';
import { useConfirm } from './ui/Confirm';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { PresentationSeries, PresentationVersion } from '@eps/domain';
import { api, type Actor, type Envelope } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { ReviewLinksPanel } from './ReviewLinksPanel';
import { ReviewFeedbackPanel } from './ReviewFeedbackPanel';
import { reviewError } from './review-client';

export function ReviewSharingView({ seriesId, actor, onDirtyChange }: { seriesId: string; actor: Actor; onDirtyChange: (value: boolean) => void }) {
  return <SharingScope key={`${actor.id}:${seriesId}`} seriesId={seriesId} actor={actor} onDirtyChange={onDirtyChange} />;
}
function SharingScope({ seriesId, actor, onDirtyChange }: { seriesId: string; actor: Actor; onDirtyChange: (value: boolean) => void }) {
  const confirm = useConfirm();
  const [series, setSeries] = useState<PresentationSeries | null>(null), [versions, setVersions] = useState<PresentationVersion[]>([]);
  const [selected, setSelected] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0);
  const [linkPending, setLinkPending] = useState(false), [feedback, setFeedback] = useState({ locked: false, dirty: false });
  const feedbackChanged = useCallback((value: { locked: boolean; dirty: boolean }) => setFeedback(value), []);
  useEffect(() => { onDirtyChange(linkPending || feedback.locked || feedback.dirty); return () => onDirtyChange(false); }, [linkPending, feedback, onDirtyChange]);
  useEffect(() => {
    let current = true; const controller = new AbortController();
    const load = async () => {
      try {
        const saved = (await api<PresentationSeries>(`/api/v1/presentation-series/${seriesId}`, { signal: controller.signal })).data;
        if (saved.id !== seriesId) throw new Error('The presentation series response could not be confirmed.');
        const all: PresentationVersion[] = []; let cursor: string | null = null; const seen = new Set<string>();
        for (let n = 0; n < 100; n++) {
          const page: Envelope<PresentationVersion[]> = await api(`/api/v1/presentation-series/${seriesId}/versions?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
          if (page.data.some(row => row.series_id !== seriesId)) throw new Error('History scope could not be confirmed.');
          all.push(...page.data.filter(row => row.status === 'ready')); cursor = page.page?.next_cursor ?? null;
          if (!cursor) break; if (seen.has(cursor) || n === 99) throw new Error('History repeated a page. Refresh to continue.'); seen.add(cursor);
        }
        if (current) { setSeries(saved); setVersions(all); setSelected(value => value || saved.latest_ready_version_id || all[0]?.id || ''); setError(''); }
      } catch (reason) { if (current) setError(reviewError(reason)); } finally { if (current) setLoading(false); }
    }; void load(); return () => { current = false; controller.abort(); };
  }, [seriesId, refresh]);
  const version = versions.find(row => row.id === selected), locked = linkPending || feedback.locked;
  return <><header className="page-heading"><div><h1>Share and review</h1><p>Links and feedback stay within this presentation series.</p></div><Link className="button" href="/presentations">All presentations</Link></header>
    {error && <ErrorNotice message={error} retry={!locked ? () => { setLoading(true); setRefresh(value => value + 1); } : undefined} />}
    {loading && !series ? <Loading /> : series && <><h2 dir="auto">{series.title}</h2><p>Cast {series.output_type === 'selection' ? 'Selection' : 'Shortlist'} · {series.audience_snapshot.label} · {series.audience_snapshot.scope}</p>
      {series.audience_snapshot.scope === 'external' ? <ReviewLinksPanel seriesId={series.id} workspaceId={series.workspace_id} actor={actor} onDirtyChange={setLinkPending} /> : <p className="notice">This series has an internal audience. Use a separate external-audience series for guest sharing.</p>}
      <section className="review-links-panel"><h2>Feedback by saved version</h2>{!versions.length ? <p>No ready versions yet. Feedback will appear after the first version is ready.</p> : <><label className="field">Feedback version<select value={selected} disabled={locked} onChange={async event => { const next = event.target.value; if (!feedback.dirty || await confirm({ title: 'Discard your unsent comment?', description: 'Opening feedback on another version discards the comment you have not posted. Feedback stays with the version it was given on.', confirmLabel: 'Discard comment', cancelLabel: 'Keep writing', danger: true })) { setSelected(next); setFeedback({ locked: false, dirty: false }); } }}>{versions.map(row => <option key={row.id} value={row.id}>Version {row.version_no}{row.id === series.latest_ready_version_id ? ' · latest ready' : ''}</option>)}</select></label>{version && <><Link className="button" href={`/presentations/versions/${version.id}`}>Open saved version {version.version_no}</Link><ReviewFeedbackPanel versionId={version.id} versionNo={version.version_no} slides={version.slides} canWrite={actor.capabilities?.includes('workspaces.write')} onStateChange={feedbackChanged} /></>}</>}</section>
    </>}
  </>;
}
