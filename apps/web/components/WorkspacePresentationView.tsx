'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PresentationSeries, PresentationVersion, ReviewJobAccepted, WorkspaceReview } from '@eps/domain';
import { summarizePresentationChanges } from '../../../packages/domain/src/presentation';
import { api, ApiError, errorMessage, mutation, type Actor, type Envelope, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { Icon } from './Icon';
import { ShareDrawer } from './ShareDrawer';
import { StudioDateTime } from './StudioTimeZone';
import { PageFrame } from './shell/PageFrame';
import { DeckStage } from './workspace/DeckStage';
import { useStageDeck } from './workspace/useStageDeck';
import { SavedStage, statusLabel, useSavedVersion, VersionActions } from './presentation/saved-version';

interface Props { projectId: string; workspaceId: string; actor: Actor; initialOutput: 'selection' | 'shortlist'; requestedSeriesId?: string | null; onSeriesChanged?: (value: string) => void; onDirtyChange: (dirty: boolean) => void }
interface GenerationIntent { path: string; init: RequestInit; seriesId: string }
interface Draft { workspace: Workspace; review: WorkspaceReview; series: PresentationSeries; lastReady: PresentationVersion | null }
const templateName = (version: string) => version === '1.2.0' ? 'Everyone Film Editorial 1.2.0' : `Everyone Casting ${version}`;

/** Versions, presentation-first: series, the working draft and saved history in the panel; on the stage either the
 * server-checked working draft (exactly what Generate captures) or the selected saved version's own snapshot. */
export function WorkspacePresentationView(props: Props) { return <PresentationScope key={`${props.actor.id}:${props.workspaceId}`} {...props} />; }
function PresentationScope({ projectId, workspaceId, actor, initialOutput, requestedSeriesId, onSeriesChanged, onDirtyChange }: Props) {
  const [series, setSeries] = useState<PresentationSeries[]>([]); const [seriesId, setSeriesId] = useState(''); const [sharing, setSharing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null); const [versions, setVersions] = useState<PresentationVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState(''); const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [refresh, setRefresh] = useState(0);
  const [readingMore, setReadingMore] = useState(false); const [stale, setStale] = useState(false);
  const [choicesLoading, setChoicesLoading] = useState(true);
  const [choicesRefresh, setChoicesRefresh] = useState(0); const alive = useRef(false); const sending = useRef(false); const intent = useRef<GenerationIntent | null>(null);
  const activeSeries = useRef(''); const contextRequest = useRef(0); const knownSeries = useRef(new Map<string, PresentationSeries>()); const historyCursors = useRef(new Set<string>());
  const canGenerate = actor.capabilities?.includes('presentations.generate') && actor.capabilities?.includes('workspaces.write') && actor.capabilities?.includes('cast.read');
  const locked = busy || uncertain || readingMore;
  useEffect(() => { if (seriesId) onSeriesChanged?.(seriesId); }, [seriesId, onSeriesChanged]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onDirtyChange(busy || uncertain); return () => onDirtyChange(false); }, [busy, uncertain, onDirtyChange]);
  const settled = useCallback(() => { if (!intent.current) { setLoading(true); setRefresh(value => value + 1); } }, []);
  useEffect(() => {
    let current = true; const controller = new AbortController(); const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]);
    const load = async () => {
      try {
        const all: PresentationSeries[] = []; let next: string | null = null; const seen = new Set<string>();
        for (let n = 0; n < 100; n++) {
          const page: Envelope<PresentationSeries[]> = await api(`/api/v1/presentation-series?workspace_id=${workspaceId}&limit=100${next ? `&cursor=${encodeURIComponent(next)}` : ''}`, { signal });
          if (!Array.isArray(page.data) || page.data.some(row => row.workspace_id !== workspaceId)) throw new Error('The saved series could not be read for this workspace.');
          all.push(...page.data.filter(row => !row.archived)); next = page.page?.next_cursor ?? null;
          if (!next) break; if (seen.has(next) || n === 99) throw new Error('Series changed while paging. Refresh the choices.'); seen.add(next);
        }
        if (!current || intent.current) return;
        if (requestedSeriesId && !all.some(row => row.id === requestedSeriesId)) throw new Error('The linked presentation series is unavailable in this workspace. Return to Final Review to choose its context.');
        all.forEach(row => knownSeries.current.set(row.id, row));
        const selected = activeSeries.current || requestedSeriesId || all.find(row => row.output_type === initialOutput && row.template_version === '1.2.0')?.id || all.find(row => row.output_type === initialOutput && row.template_version === '1.1.0')?.id || all.find(row => row.output_type === initialOutput)?.id || all[0]?.id || '';
        // An in-flight refresh never silently replaces an already chosen context.
        // Its previously read metadata stays visible until the actor chooses again.
        const prior = knownSeries.current.get(selected);
        setSeries(prior && !all.some(row => row.id === selected) ? [...all, prior] : all);
        activeSeries.current = selected; setSeriesId(selected);
        setError(''); if (!all.length) setLoading(false);
      } catch (reason) { if (current) { setError(errorMessage(reason)); setLoading(false); } } finally { if (current) setChoicesLoading(false); }
    }; void load(); return () => { current = false; controller.abort(); };
  }, [workspaceId, initialOutput, requestedSeriesId, choicesRefresh]);
  useEffect(() => {
    if (!seriesId || uncertain) return;
    const sequence = ++contextRequest.current;
    let current = true; const controller = new AbortController(); const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]);
    const load = async () => {
      try {
        const [workspaceResult, reviewResult, seriesResult, history] = await Promise.all([
          api<Workspace>(`/api/v1/workspaces/${workspaceId}`, { signal }),
          api<WorkspaceReview>(`/api/v1/workspaces/${workspaceId}/review?series_id=${seriesId}`, { signal }),
          api<PresentationSeries>(`/api/v1/presentation-series/${seriesId}`, { signal }),
          api<PresentationVersion[]>(`/api/v1/presentation-series/${seriesId}/versions?limit=20`, { signal }),
        ]);
        const ws = workspaceResult.data, review = reviewResult.data, saved = seriesResult.data;
        if (ws.id !== workspaceId || ws.project_id !== projectId || saved.id !== seriesId || saved.workspace_id !== workspaceId || review.workspace_id !== workspaceId || review.series_id !== seriesId
          || ws.draft_revision !== review.draft_revision || history.data.some(row => row.series_id !== seriesId)) throw new Error('The draft changed while opening this context. Refresh before generating.');
        const last = saved.latest_ready_version_id ? history.data.find(row => row.id === saved.latest_ready_version_id) ?? (await api<PresentationVersion>(`/api/v1/versions/${saved.latest_ready_version_id}`, { signal })).data : null;
        if (last && (last.id !== saved.latest_ready_version_id || last.series_id !== seriesId || last.status !== 'ready')) throw new Error('The latest ready version could not be read. Refresh the context.');
        if (!current || sequence !== contextRequest.current || activeSeries.current !== seriesId || intent.current) return;
        setDraft({ workspace: ws, review, series: saved, lastReady: last });
        setVersions(history.data.some(row => row.id === last?.id) || !last ? history.data : [...history.data, last]);
        setCursor(history.page?.next_cursor ?? null); historyCursors.current.clear(); setStale(false); knownSeries.current.set(saved.id, saved); setSeries(rows => rows.map(row => row.id === saved.id ? saved : row));
        setError('');
      } catch (reason) { if (current && !intent.current) { setDraft(null); setError(errorMessage(reason)); } } finally { if (current && !intent.current) setLoading(false); }
    }; void load(); return () => { current = false; controller.abort(); };
  }, [workspaceId, projectId, seriesId, refresh, uncertain]);
  async function generate(retry = false) {
    if (sending.current || !retry && (uncertain || !draft || choicesLoading || loading || draft.series.id !== activeSeries.current)) return;
    if (!retry) intent.current = { seriesId, path: `/api/v1/presentation-series/${seriesId}/versions`, init: mutation('POST', {
      expected_workspace_row_version: draft!.workspace.row_version, expected_draft_revision: draft!.review.draft_revision,
      expected_input_fingerprint: draft!.review.input_fingerprint,
    }) };
    const request = intent.current; if (!request) return;
    sending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const value = (await api<ReviewJobAccepted>(request.path, { ...request.init, signal: AbortSignal.timeout(30000) })).data;
      if (!alive.current) return;
      if (!/^[a-f0-9-]{36}$/u.test(value.resource_id) || request.seriesId !== activeSeries.current) throw new Error('The generation acknowledgement could not be confirmed.');
      intent.current = null; setUncertain(false); setSelectedVersion(value.resource_id); setNotice('The captured version is saved. Its processing status is shown on the stage.'); setRefresh(value => value + 1);
    } catch (reason) { if (alive.current) {
      const unknown = uncertain || !(reason instanceof ApiError) || reason.status >= 500 || [408, 429].includes(reason.status);
      setUncertain(unknown); if (!unknown) { intent.current = null; if (reason instanceof ApiError && reason.status === 409) setStale(true); }
      setError(`${unknown ? 'Generation may have been accepted. Confirm the same request before starting another. ' : ''}${errorMessage(reason)}`);
    } } finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  async function more() {
    if (!cursor || locked || loading || choicesLoading) return;
    const expectedSeries = seriesId, sequence = contextRequest.current, requestedCursor = cursor;
    setReadingMore(true); setError('');
    try { const page = await api<PresentationVersion[]>(`/api/v1/presentation-series/${seriesId}/versions?limit=20&cursor=${encodeURIComponent(cursor)}`, { signal: AbortSignal.timeout(30000) });
      if (expectedSeries !== activeSeries.current || sequence !== contextRequest.current || !alive.current) return;
      if (page.data.some(row => row.series_id !== expectedSeries)) throw new Error('Version history belongs to a different series.');
      const nextCursor = page.page?.next_cursor ?? null;
      if (nextCursor && (nextCursor === requestedCursor || historyCursors.current.has(nextCursor))) throw new Error('History repeated a page. Refresh the working draft to reload history.');
      historyCursors.current.add(requestedCursor);
      setVersions(rows => [...new Map([...rows, ...page.data].map(row => [row.id, row])).values()].sort((a, b) => b.version_no - a.version_no)); setCursor(nextCursor);
    } catch (reason) { setError(errorMessage(reason)); } finally { setReadingMore(false); }
  }
  function refreshAll() { setLoading(true); setChoicesLoading(true); setRefresh(value => value + 1); setChoicesRefresh(value => value + 1); }
  const base = `/projects/${projectId}/casting/${workspaceId}`;
  const changes = draft ? summarizePresentationChanges(draft.review, draft.lastReady) : null;
  const chosenSeries = series.find(row => row.id === seriesId) ?? null;
  const blocking = draft?.review.issues.filter(issue => issue.severity === 'blocking') ?? [];
  const notes = (draft?.review.issues.length ?? 0) - blocking.length;
  const reviewHref = `${base}/review${seriesId ? `?series_id=${seriesId}` : ''}`;

  const panelBody = <div className="versions-panel stack-lg">
    {error && <ErrorNotice message={error} />}{notice && <p className="review-notice" role="status">{notice}</p>}
    {uncertain && <div className="notice"><p>Keep this generation request until its acknowledgement is confirmed. Another request could create another version.</p><button className="button" disabled={busy} onClick={() => void generate(true)}>Confirm generation request</button></div>}
    {stale && <div className="notice notice-warning" role="status"><p>The presentation information changed since this draft was read. Refresh the working draft, check it, then generate.</p><button className="button" disabled={locked || loading || choicesLoading} onClick={refreshAll}>Refresh the changed draft</button></div>}
    <section className="panel-section series-choice" aria-labelledby="versions-series-heading">
      <h3 id="versions-series-heading" className="panel-eyebrow">Presentation series</h3>
      <label className="sr-only" htmlFor="versions-series">Presentation series</label>
      <select id="versions-series" aria-label="Presentation series" value={seriesId} disabled={locked || loading || choicesLoading} onChange={event => { activeSeries.current = event.target.value; contextRequest.current++; setSeriesId(event.target.value); setDraft(null); setVersions([]); setSelectedVersion(''); setLoading(true); setNotice(''); }}>
        {!series.length && <option value="">No saved series</option>}{series.map(row => <option key={row.id} value={row.id}>{row.title} · {row.audience_snapshot.label} · {templateName(row.template_version)}</option>)}</select>
      {chosenSeries && <p className="small muted">{chosenSeries.output_type === 'selection' ? 'Cast Selection' : 'Cast Shortlist'} · {chosenSeries.audience_snapshot.label} ({chosenSeries.audience_snapshot.scope}). Output, audience and template are fixed per series; change them in Review.</p>}
    </section>
    {loading && !draft && series.length > 0 ? <Loading label="Opening the working draft…" /> : !series.length ? !choicesLoading && <div className="empty-state compact"><Icon name="slides" /><h3>Choose a review context first</h3><p>Choose the output, audience and template in Review before generating.</p><Link className="button button-primary" href={reviewHref}>Open Final Review</Link></div>
      : draft && <section className="draft-card presentation-draft" data-current={!selectedVersion ? '' : undefined} aria-labelledby="working-draft-heading">
        <div className="draft-card-head"><h3 id="working-draft-heading" className="stage-chip stage-chip-ok"><span className="stage-chip-dot" aria-hidden="true" />Working draft</h3>
          {selectedVersion ? <button type="button" className="button button-small" onClick={() => setSelectedVersion('')}>Show on stage</button> : <span className="small muted">On the stage</span>}</div>
        <p className="small">{draft.review.cover.project_name} · {draft.series.audience_snapshot.label} · Cast {draft.review.output_type === 'selection' ? 'Selection' : 'Shortlist'}</p>
        <p className="small muted">{draft.review.candidate_slide_count} candidate pages · {draft.review.pending_slide_count} Pending pages · {draft.review.slides.length + 1} pages including the cover. Guests never see the draft.</p>
        <p className="small">Layout: {draft.review.can_generate ? 'Measured and ready for this exact draft' : 'Review checks need attention'}</p>
        {draft.review.issues.length > 0 && <div className={`draft-checks${blocking.length ? ' has-blocking' : ''}`}><p className="small"><strong>{blocking.length ? `${blocking.length} ${blocking.length === 1 ? 'check blocks' : 'checks block'} generation` : 'No blocking checks'}</strong>{notes > 0 && <span className="muted"> · {notes} allowed {notes === 1 ? 'note' : 'notes'} print as stated</span>}</p>{blocking.length > 0 && <ul>{blocking.slice(0, 3).map((issue, index) => <li key={`${issue.code}:${index}`}>{issue.message}</li>)}{blocking.length > 3 && <li>{blocking.length - 3} more in Final Review</li>}</ul>}</div>}
        {changes && <div className="draft-change-summary"><h4 className="small">{!draft.lastReady ? 'First saved version' : changes.has_changes ? `Changes since ready version ${draft.lastReady.version_no}` : `Matches ready version ${draft.lastReady.version_no}`}</h4>{!draft.lastReady ? <p className="small muted">The first version will capture the current reviewed content.</p> : changes.has_changes ? <ul>{changes.added_assignments > 0 && <li>{changes.added_assignments} assignment{changes.added_assignments === 1 ? '' : 's'} added</li>}{changes.removed_assignments > 0 && <li>{changes.removed_assignments} assignment{changes.removed_assignments === 1 ? '' : 's'} removed</li>}{changes.changed_fields > 0 && <li>{changes.changed_fields} display field{changes.changed_fields === 1 ? '' : 's'} changed</li>}{changes.changed_media > 0 && <li>Selected media changed</li>}{changes.changed_requirements > 0 && <li>Requirements or open slots changed</li>}{changes.changed_casting > 0 && <li>Casting position changed</li>}{changes.order_changed && <li>Page order changed</li>}{changes.branding_changed && <li>Project, client or branding changed</li>}{changes.template_changed && <li>Template changed</li>}{changes.shared_source_changed && <li>Shared source information changed</li>}</ul> : <p className="small muted">No content changes since that ready version.</p>}</div>}
        <button className="button button-primary" disabled={!canGenerate || locked || loading || choicesLoading || stale || !draft.review.can_generate} onClick={() => void generate()}><Icon name="sparkle" />Generate saved version</button>
        <Link className="button button-quiet" href={reviewHref}>Open Final Review</Link>
        {!canGenerate && <p className="small">Generating requires presentation and project preparation permissions.</p>}
      </section>}
    {series.length > 0 && <section className="panel-section presentation-history" aria-labelledby="history-heading">
      <div className="history-head"><h3 id="history-heading" className="panel-eyebrow">Saved history</h3><span className="small muted">{versions.length} {versions.length === 1 ? 'version' : 'versions'}{cursor ? '+' : ''}</span></div>
      {!versions.length && !selectedVersion ? <p className="small muted">No saved versions in this series yet. Generate one to capture the working draft.</p> : <ul className="version-list" aria-label="Saved versions">
        {selectedVersion && !versions.some(row => row.id === selectedVersion) && <li><button type="button" className="version-card" aria-current="true"><span className="version-card-no"><Icon name="lock" /></span><span className="version-card-text"><strong>Selected saved version</strong><span>Opening…</span></span></button></li>}
        {versions.map(row => <li key={row.id}><button type="button" className="version-card" disabled={locked} aria-current={row.id === selectedVersion ? 'true' : undefined} onClick={() => setSelectedVersion(row.id)}>
          <span className="version-card-no" aria-hidden="true">v{row.version_no}</span>
          <span className="version-card-text"><strong>Version {row.version_no}</strong><span>{statusLabel(row)} · <StudioDateTime value={row.created_at} /> · {row.slides.length} slides</span></span>
          <span className={`pill ${row.status === 'ready' ? 'pill-ok' : row.status === 'failed' ? 'pill-error' : 'pill-info'}`}>{row.id === draft?.series.latest_ready_version_id ? 'Latest ready' : statusLabel(row)}</span>
        </button></li>)}
      </ul>}
      {cursor && <button className="button button-small" disabled={locked || loading || choicesLoading || !!error} onClick={() => void more()}>Load older versions</button>}
    </section>}
  </div>;

  return <PageFrame inline className="workspace-frame presentation-frame versions-frame"
    panel={{ title: 'Versions', subtitle: 'Generate, view and share', label: 'Versions panel', wide: true, body: panelBody,
      actions: <button type="button" className="icon-button icon-button-small" aria-label="Refresh working draft" title="Refresh working draft" disabled={locked || loading || choicesLoading} onClick={refreshAll}><Icon name="refresh" /></button>,
      footer: seriesId ? <div className="panel-foot-actions">{selectedVersion && <Link className="button button-quiet" href={`/presentations/versions/${selectedVersion}`}><Icon name="external" />Open version page</Link>}<span className="grow" /><button type="button" className="button" aria-haspopup="dialog" onClick={() => setSharing(true)}><Icon name="share" />Share this series for review</button></div> : undefined }}>
    {selectedVersion ? <VersionStage key={selectedVersion} versionId={selectedVersion} seriesId={seriesId} onSettled={settled} latest={selectedVersion === draft?.series.latest_ready_version_id} />
      : <DraftStage review={draft?.review ?? null} loading={loading} empty={!series.length && !choicesLoading} />}
    {sharing && seriesId && <ShareDrawer seriesId={seriesId} actor={actor} onClose={() => setSharing(false)} />}
  </PageFrame>;
}

/** The working draft as the server checked it — the content Generate captures for this series. */
function DraftStage({ review, loading, empty }: { review: WorkspaceReview | null; loading: boolean; empty: boolean }) {
  const stage = useStageDeck(review);
  const [index, setIndex] = useState(0);
  if (!review || !stage.deck) return <section className="live-stage live-stage-empty" aria-label="Slide preview" aria-busy={loading || undefined}>
    {stage.error ? <ErrorNotice message={stage.error} /> : empty ? <div className="empty-state"><Icon name="slides" /><h2>No presentation series yet</h2><p>Create a series in Review; its working draft and saved versions appear here.</p></div>
      : <div className="stage-loading" role="status"><span className="stage-loading-slide" aria-hidden="true" /><p>Opening the working draft…</p></div>}
  </section>;
  const bounded = Math.min(index, stage.deck.pages.length - 1);
  return <DeckStage deck={stage.deck} rendered={stage.rendered} index={bounded} onIndex={setIndex} busy={loading}
    chip={{ tone: 'ok', text: `Working draft · revision ${review.draft_revision}` }} meta={<>Slide {bounded + 1} of {stage.deck.pages.length}</>}
    notices={stage.failed.length > 0 ? <p className="stage-note small"><Icon name="info" />{stage.failed.length} image{stage.failed.length === 1 ? '' : 's'} could not be opened for the preview.</p> : undefined}
    disclaimer={<>The server-checked working draft in {templateName(review.template.version)} — what Generate captures. The version number and date are added when it is saved; guests never see the draft.</>} />;
}

/** A saved version on the stage, from its own captured content; generation status is followed until it settles. */
function VersionStage({ versionId, seriesId, onSettled, latest }: { versionId: string; seriesId: string; onSettled: () => void; latest: boolean }) {
  const { version, error, loading, reload } = useSavedVersion(versionId, seriesId, onSettled);
  const [index, setIndex] = useState(0); const [layout, setLayout] = useState<'app' | 'pdf'>('app');
  if (loading && !version) return <section className="live-stage live-stage-empty" aria-label="Saved version"><Loading label="Opening saved version…" /></section>;
  if (!version) return <section className="live-stage live-stage-empty" aria-label="Saved version"><ErrorNotice message={error || 'Saved version unavailable.'} retry={reload} /></section>;
  return <SavedStage version={version} index={Math.min(index, version.slides.length - 1)} onIndex={setIndex} layout={layout} onLayout={setLayout}
    heading={<h2 className="stage-chip stage-chip-lock"><Icon name="lock" />Saved version {version.version_no}</h2>}
    meta={<>{statusLabel(version)}{latest ? ' · latest ready' : ''} · <StudioDateTime value={version.created_at} /> · saved snapshot</>}
    notices={error ? <div className="stage-notice"><ErrorNotice message={error} retry={reload} /></div> : undefined}
    tools={<><button type="button" className="icon-button icon-button-small" aria-label="Refresh saved version" title="Refresh saved version" disabled={loading} onClick={reload}><Icon name="refresh" /></button><VersionActions version={version} compact /></>} />;
}
