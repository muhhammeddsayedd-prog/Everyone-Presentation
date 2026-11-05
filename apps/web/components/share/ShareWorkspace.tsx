'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { PresentationSeries, PresentationVersion } from '@eps/domain';
import { api, type Actor, type Envelope } from '../api';
import { ErrorNotice, Loading } from '../Feedback';
import { Icon } from '../Icon';
import { useFeedbackCounts } from '../PresentationVersionView';
import { ReviewFeedbackPanel } from '../ReviewFeedbackPanel';
import { ReviewLinksPanel } from '../ReviewLinksPanel';
import { reviewError } from '../review-client';
import { StudioDateTime } from '../StudioTimeZone';
import { FramePortal } from '../shell/Frame';
import { PageFrame, RightPanel } from '../shell/PageFrame';
import { useConfirm } from '../ui/Confirm';
import { SavedStage, slideName, useSavedVersion } from '../presentation/saved-version';

interface Props {
  actor: Actor; onDirtyChange: (value: boolean) => void;
  /** A fixed series (the /presentations/series/{id}/sharing page) … */
  seriesId?: string;
  /** … or a workspace whose series the panel chooses from (the workspace step). */
  workspaceId?: string; requestedSeriesId?: string | null; onSeriesChanged?: (value: string) => void;
}

async function readAll<T>(path: string, signal: AbortSignal, check: (rows: T[]) => void) {
  const all: T[] = []; let cursor: string | null = null; const seen = new Set<string>();
  for (let n = 0; n < 100; n++) {
    const page: Envelope<T[]> = await api(`${path}${path.includes('?') ? '&' : '?'}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal });
    if (!Array.isArray(page.data)) throw new Error('The list could not be read.'); check(page.data);
    all.push(...page.data); cursor = page.page?.next_cursor ?? null;
    if (!cursor) return all; if (seen.has(cursor) || n === 99) throw new Error('History repeated a page. Refresh to continue.'); seen.add(cursor);
  }
  return all;
}

/** Share & feedback, presentation-first: review links and the versions with feedback in the panel, the version a guest
 * sees on the stage, and the feedback given on it — for the slide on the stage — beside it. Links and their tokens
 * are managed by the existing review-link service; nothing here widens who can see a version. */
export function ShareWorkspace(props: Props) { return <ShareScope key={`${props.actor.id}:${props.seriesId ?? props.workspaceId}`} {...props} />; }
function ShareScope({ actor, onDirtyChange, seriesId: fixedSeries, workspaceId, requestedSeriesId, onSeriesChanged }: Props) {
  const confirm = useConfirm();
  const [choices, setChoices] = useState<PresentationSeries[]>([]); const [chosen, setChosen] = useState(fixedSeries ?? '');
  const [series, setSeries] = useState<PresentationSeries | null>(null); const [versions, setVersions] = useState<PresentationVersion[]>([]);
  const [selected, setSelected] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0);
  const [linkPending, setLinkPending] = useState(false), [feedback, setFeedback] = useState({ locked: false, dirty: false });
  const [feedbackOpen, setFeedbackOpen] = useState(true);
  // The slide under discussion, shared by the stage and the feedback beside it; it belongs to one version.
  const [shown, setShown] = useState({ versionId: '', slideId: '' });
  const feedbackChanged = useCallback((value: { locked: boolean; dirty: boolean }) => setFeedback(value), []);
  const locked = linkPending || feedback.locked;
  useEffect(() => { onDirtyChange(linkPending || feedback.locked || feedback.dirty); return () => onDirtyChange(false); }, [linkPending, feedback, onDirtyChange]);
  useEffect(() => { if (chosen && !fixedSeries) onSeriesChanged?.(chosen); }, [chosen, fixedSeries, onSeriesChanged]);
  // The workspace step chooses among the workspace's series; external audiences first, as only they can be shared.
  useEffect(() => {
    if (fixedSeries || !workspaceId) return; let current = true; const controller = new AbortController();
    readAll<PresentationSeries>(`/api/v1/presentation-series?workspace_id=${encodeURIComponent(workspaceId)}`, AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]), rows => { if (rows.some(row => row.workspace_id !== workspaceId)) throw new Error('The saved series could not be read for this workspace.'); })
      .then(rows => { if (!current) return; const active = rows.filter(row => !row.archived);
        if (requestedSeriesId && !active.some(row => row.id === requestedSeriesId)) throw new Error('The linked presentation series is unavailable in this workspace. Choose a series here instead.');
        setChoices(active); setChosen(value => value || requestedSeriesId || active.find(row => row.audience_snapshot.scope === 'external' && row.latest_ready_version_id)?.id || active.find(row => row.audience_snapshot.scope === 'external')?.id || active[0]?.id || '');
        if (!active.length) setLoading(false);
      }).catch(reason => { if (current) { setError(reviewError(reason)); setLoading(false); } });
    return () => { current = false; controller.abort(); };
  }, [fixedSeries, workspaceId, requestedSeriesId, refresh]);
  useEffect(() => {
    if (!chosen) return; let current = true; const controller = new AbortController();
    const load = async () => {
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]);
        const saved = (await api<PresentationSeries>(`/api/v1/presentation-series/${chosen}`, { signal })).data;
        if (saved.id !== chosen) throw new Error('The presentation series response could not be confirmed.');
        const all = await readAll<PresentationVersion>(`/api/v1/presentation-series/${chosen}/versions`, signal, rows => { if (rows.some(row => row.series_id !== chosen)) throw new Error('History scope could not be confirmed.'); });
        const ready = all.filter(row => row.status === 'ready');
        if (current) { setSeries(saved); setVersions(ready); setSelected(value => ready.some(row => row.id === value) ? value : saved.latest_ready_version_id || ready[0]?.id || ''); setError(''); }
      } catch (reason) { if (current) setError(reviewError(reason)); } finally { if (current) setLoading(false); }
    }; void load(); return () => { current = false; controller.abort(); };
  }, [chosen, refresh]);
  async function discardFeedback() {
    return !feedback.dirty || await confirm({ title: 'Discard your unsent comment?', description: 'Opening feedback on another version discards the comment you have not posted. Feedback stays with the version it was given on.', confirmLabel: 'Discard comment', cancelLabel: 'Keep writing', danger: true });
  }
  const version = versions.find(row => row.id === selected) ?? null;
  const slideId = shown.versionId === selected ? shown.slideId : '';
  const showSlide = useCallback((id: string) => setShown({ versionId: selected, slideId: id }), [selected]);
  const external = series?.audience_snapshot.scope === 'external';
  const counts = useFeedbackCounts(selected || null, refresh);
  const panelBody = <div className="share-panel stack-lg">
    {error && <ErrorNotice message={error} retry={!locked ? () => { setLoading(true); setRefresh(value => value + 1); } : undefined} />}
    {!fixedSeries && <section className="panel-section series-choice" aria-labelledby="share-series-heading"><h3 id="share-series-heading" className="panel-eyebrow">Presentation series</h3>
      <select aria-label="Presentation series" value={chosen} disabled={locked || loading} onChange={async event => { const next = event.target.value; if (!await discardFeedback()) return; setChosen(next); setSeries(null); setVersions([]); setSelected(''); setLoading(true); setFeedback({ locked: false, dirty: false }); }}>
        {!choices.length && <option value="">No saved series</option>}{choices.map(row => <option key={row.id} value={row.id}>{row.title} · {row.audience_snapshot.label} ({row.audience_snapshot.scope})</option>)}</select></section>}
    {loading && !series ? <Loading label="Opening sharing…" /> : !series ? !error && <div className="empty-state compact"><Icon name="share" /><h3>No presentation series yet</h3><p>Create a series in Review and generate a version before sharing it.</p></div> : <>
      <p className="small muted">{series.title} · Cast {series.output_type === 'selection' ? 'Selection' : 'Shortlist'} · {series.audience_snapshot.label} · {series.audience_snapshot.scope === 'external' ? 'external audience' : 'internal audience'}</p>
      {external ? <ReviewLinksPanel seriesId={series.id} workspaceId={series.workspace_id} actor={actor} onDirtyChange={setLinkPending} />
        : <div className="notice notice-info"><p>This series has an internal audience. Use a separate external-audience series for guest sharing.</p></div>}
      <p className="share-info"><Icon name="info" />Links follow the newest ready version in this series only. Feedback stays on the version the guest viewed.</p>
      <section className="panel-section" aria-labelledby="feedback-versions-heading"><h3 id="feedback-versions-heading" className="panel-eyebrow">Feedback by version</h3>
        {!versions.length ? <p className="small muted">No ready versions yet. Feedback appears after the first version is ready.</p> : <ul className="feedback-versions">{versions.map(row => <li key={row.id}>
          <button type="button" className="feedback-version" disabled={locked} aria-current={row.id === selected ? 'true' : undefined} onClick={async () => { if (row.id === selected || !await discardFeedback()) return; setSelected(row.id); setFeedback({ locked: false, dirty: false }); }}>
            <span>Version {row.version_no}</span><span>{row.id === series.latest_ready_version_id ? 'Latest ready · ' : ''}<StudioDateTime value={row.created_at} /></span></button></li>)}</ul>}
      </section>
    </>}
  </div>;
  return <>
    {fixedSeries && series && <FramePortal slot="top"><div className="workspace-top"><div className="workspace-title"><h1 dir="auto">{series.title}</h1></div>
      <nav className="workspace-breadcrumb" aria-label="Breadcrumb"><Link href="/presentations">Presentations</Link><Icon name="chevron-right" /><span aria-current="page">Share &amp; feedback</span></nav></div></FramePortal>}
    <PageFrame inline className={`${fixedSeries ? '' : 'workspace-frame '}presentation-frame share-frame`}
      panel={{ title: 'Share & feedback', subtitle: series ? `${series.audience_snapshot.label} · ${series.output_type === 'selection' ? 'Selection' : 'Shortlist'}` : 'Review links and guest feedback', label: 'Share and feedback panel', wide: true, body: panelBody,
        footer: fixedSeries ? <div className="panel-foot-actions"><Link className="button button-quiet" href="/presentations">All presentations</Link>{version && <><span className="grow" /><Link className="button button-quiet" href={`/presentations/versions/${version.id}`}>Open saved version {version.version_no}</Link></>}</div> : version ? <div className="panel-foot-actions"><span className="grow" /><Link className="button button-quiet" href={`/presentations/versions/${version.id}`}>Open saved version {version.version_no}</Link></div> : undefined }}
      right={version ? <SharedFeedback key={version.id} version={version} slideId={slideId} onSlide={showSlide} actor={actor} open={feedbackOpen} onOpen={setFeedbackOpen} counts={counts} onStateChange={feedbackChanged} feedbackDirty={feedback.dirty || feedback.locked} /> : undefined}>
      {version ? <ShareStage key={version.id} versionId={version.id} slideId={slideId} onSlide={showSlide} seriesId={series!.id} latest={version.id === series!.latest_ready_version_id} external={external} counts={counts} feedbackDirty={feedback.dirty} feedbackLocked={feedback.locked} feedbackOpen={feedbackOpen} onOpenFeedback={() => setFeedbackOpen(true)} />
        : <section className="live-stage live-stage-empty" aria-label="Shared version">{loading ? <Loading /> : <div className="empty-state"><Icon name="slides" /><h2>No ready version to share yet</h2><p>Generate a version in this series. Guests always see its newest ready version.</p></div>}</section>}
    </PageFrame>
  </>;
}

function ShareStage({ versionId, slideId, onSlide, seriesId, latest, external, counts, feedbackDirty, feedbackLocked, feedbackOpen, onOpenFeedback }: { versionId: string; slideId: string; onSlide: (id: string) => void; seriesId: string; latest: boolean; external: boolean; counts?: Record<string, number>; feedbackDirty: boolean; feedbackLocked: boolean; feedbackOpen: boolean; onOpenFeedback: () => void }) {
  const { version, error, loading, reload } = useSavedVersion(versionId, seriesId);
  const confirm = useConfirm();
  const [layout, setLayout] = useState<'app' | 'pdf'>('app');
  if (loading && !version) return <section className="live-stage live-stage-empty" aria-label="Shared version"><Loading label="Opening saved version…" /></section>;
  if (!version) return <section className="live-stage live-stage-empty" aria-label="Shared version"><ErrorNotice message={error || 'Saved version unavailable.'} retry={reload} /></section>;
  const found = version.slides.findIndex(slide => slide.id === slideId); const index = found >= 0 ? found : 0;
  async function go(next: number) {
    if (!version || next === index || next < 0 || next >= version.slides.length || feedbackLocked) return;
    if (feedbackDirty && !await confirm({ title: 'Discard your unsent comment?', description: 'Moving to another slide discards the comment you have not posted.', confirmLabel: 'Discard comment', cancelLabel: 'Keep writing', danger: true })) return;
    onSlide(version.slides[next].id);
  }
  const chip = !external ? `Version ${version.version_no} · internal audience` : latest ? `Version ${version.version_no} · guests see this version` : `Version ${version.version_no} · guests see the newest version`;
  return <SavedStage version={version} index={index} onIndex={value => void go(value)} layout={layout} onLayout={setLayout} chip={chip} badges={counts}
    meta={<>Slide {index + 1} of {version.slides.length}</>}
    tools={!feedbackOpen ? <button type="button" className="button button-small" onClick={onOpenFeedback}><Icon name="comment" />Show feedback</button> : undefined} />;
}

function SharedFeedback({ version, slideId, onSlide, actor, open, onOpen, counts, onStateChange, feedbackDirty }: { version: PresentationVersion; slideId: string; onSlide: (id: string) => void; actor: Actor; open: boolean; onOpen: (value: boolean) => void; counts?: Record<string, number>; onStateChange: (value: { locked: boolean; dirty: boolean }) => void; feedbackDirty: boolean }) {
  if (!open) return null;
  const slide = version.slides.find(item => item.id === slideId) ?? version.slides[0];
  const candidate = slide.kind === 'candidate';
  const total = counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : null;
  return <RightPanel title="Feedback" subtitle={`${candidate ? slideName(slide) : 'Choose a candidate slide'} · Version ${version.version_no}${total !== null ? ` · ${total} ${total === 1 ? 'comment' : 'comments'} in this version` : ''}`} closeLabel="Close feedback" onClose={feedbackDirty ? undefined : () => onOpen(false)}>
    <ReviewFeedbackPanel versionId={version.id} versionNo={version.version_no} slides={version.slides} slideId={candidate ? slide.id : undefined} canWrite={actor.capabilities?.includes('workspaces.write')} onStateChange={onStateChange} onSlideChange={onSlide} />
  </RightPanel>;
}
