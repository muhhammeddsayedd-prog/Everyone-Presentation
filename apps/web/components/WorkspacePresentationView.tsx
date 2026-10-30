'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PresentationSeries, PresentationVersion, ReviewJobAccepted, WorkspaceReview } from '@eps/domain';
import { summarizePresentationChanges } from '../../../packages/domain/src/presentation';
import { api, ApiError, errorMessage, mutation, type Actor, type Envelope, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { PresentationVersionView } from './PresentationVersionView';

interface Props { projectId: string; workspaceId: string; actor: Actor; initialOutput: 'selection' | 'shortlist'; requestedSeriesId?: string | null; onSeriesChanged?: (value: string) => void; onDirtyChange: (dirty: boolean) => void }
interface GenerationIntent { path: string; init: RequestInit; seriesId: string }
interface Draft { workspace: Workspace; review: WorkspaceReview; series: PresentationSeries; lastReady: PresentationVersion | null }

export function WorkspacePresentationView(props: Props) { return <PresentationScope key={`${props.actor.id}:${props.workspaceId}`} {...props} />; }
function PresentationScope({ projectId, workspaceId, actor, initialOutput, requestedSeriesId, onSeriesChanged, onDirtyChange }: Props) {
  const [series, setSeries] = useState<PresentationSeries[]>([]); const [seriesId, setSeriesId] = useState('');
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
        const selected = activeSeries.current || requestedSeriesId || all.find(row => row.output_type === initialOutput && row.template_version === '1.1.0')?.id || all.find(row => row.output_type === initialOutput)?.id || all[0]?.id || '';
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
        setSelectedVersion(value => value || saved.latest_ready_version_id || history.data[0]?.id || ''); setError('');
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
      intent.current = null; setUncertain(false); setSelectedVersion(value.resource_id); setNotice('The captured version is saved. Its processing status appears below.'); setRefresh(value => value + 1);
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
  const base = `/projects/${projectId}/casting/${workspaceId}`;
  const changes = draft ? summarizePresentationChanges(draft.review, draft.lastReady) : null;
  return <section className="workspace-presentations"><header className="section-heading"><div><h2>Presentation versions</h2><p>Generate from the exact reviewed series. Each saved version keeps its captured content.</p></div><button className="button" disabled={locked || loading || choicesLoading} onClick={() => { setLoading(true); setChoicesLoading(true); setRefresh(value => value + 1); setChoicesRefresh(value => value + 1); }}>Refresh working draft</button></header>
    {error && <ErrorNotice message={error} />}{notice && <p role="status">{notice}</p>}
    {uncertain && <div className="notice"><p>Keep this generation request until its acknowledgement is confirmed. Another request could create another version.</p><button className="button" disabled={busy} onClick={() => void generate(true)}>Confirm generation request</button></div>}
    <label className="presentation-series-choice">Presentation series<select aria-label="Presentation series" value={seriesId} disabled={locked || loading || choicesLoading} onChange={event => { activeSeries.current = event.target.value; contextRequest.current++; setSeriesId(event.target.value); setDraft(null); setVersions([]); setSelectedVersion(''); setLoading(true); setNotice(''); }}>{!series.length && <option value="">No saved series</option>}{series.map(row => <option key={row.id} value={row.id}>{row.title} · {row.output_type} · {row.audience_snapshot.label} / template {row.template_version}</option>)}</select></label>
    {loading && !draft ? <Loading /> : !series.length ? <div className="empty-state"><h3>Choose a review context first</h3><p>Choose the output, audience and template in Review before generating.</p><Link className="button button-primary" href={`${base}/review${seriesId ? `?series_id=${seriesId}` : ''}`}>Open Final Review</Link></div> : draft && <section className="presentation-draft"><h3>Working draft</h3><p>{draft.review.cover.project_name} · {draft.series.audience_snapshot.label} · Cast {draft.review.output_type === 'selection' ? 'Selection' : 'Shortlist'}</p><p>{draft.review.candidate_slide_count} candidate pages · {draft.review.pending_slide_count} Pending pages · {draft.review.slides.length + 1} pages including the cover</p>
      <p>Layout: {draft.review.can_generate ? 'Measured and ready for this exact draft' : 'Review checks need attention'}</p>
      {changes && <div className="draft-change-summary"><h4>{!draft.lastReady ? 'First saved version' : changes.has_changes ? `Changes since ready version ${draft.lastReady.version_no}` : `Matches ready version ${draft.lastReady.version_no}`}</h4>{!draft.lastReady ? <p>The first version will capture the current reviewed content.</p> : changes.has_changes ? <ul>{changes.added_assignments > 0 && <li>{changes.added_assignments} assignment{changes.added_assignments === 1 ? '' : 's'} added</li>}{changes.removed_assignments > 0 && <li>{changes.removed_assignments} assignment{changes.removed_assignments === 1 ? '' : 's'} removed</li>}{changes.changed_fields > 0 && <li>{changes.changed_fields} display field{changes.changed_fields === 1 ? '' : 's'} changed</li>}{changes.changed_media > 0 && <li>Selected media changed</li>}{changes.changed_requirements > 0 && <li>Requirements or open slots changed</li>}{changes.changed_casting > 0 && <li>Casting position changed</li>}{changes.order_changed && <li>Page order changed</li>}{changes.branding_changed && <li>Project, client or branding changed</li>}{changes.template_changed && <li>Template changed</li>}{changes.shared_source_changed && <li>Shared source information changed</li>}</ul> : <p>No content changes since that ready version.</p>}</div>}
      <div className="button-row"><button className="button button-primary" disabled={!canGenerate || locked || loading || choicesLoading || stale || !draft.review.can_generate} onClick={() => void generate()}>Generate saved version</button><Link className="button" href={`${base}/review${seriesId ? `?series_id=${seriesId}` : ''}`}>Open Final Review</Link></div>{!canGenerate && <p className="small">Generating requires presentation and project preparation permissions.</p>}
    </section>}
    {seriesId && <Link className="button" href={`/presentations/series/${seriesId}/sharing`}>Share and review this series</Link>}
    <section className="presentation-history"><h3>Saved history</h3>{!versions.length && !selectedVersion ? <p>No saved versions in this series yet.</p> : <><label>Saved version<select aria-label="Saved version" value={selectedVersion} disabled={locked} onChange={event => setSelectedVersion(event.target.value)}>{selectedVersion && !versions.some(row => row.id === selectedVersion) && <option value={selectedVersion}>Selected saved version</option>}{versions.map(row => <option key={row.id} value={row.id}>Version {row.version_no} · {row.status}{row.id === draft?.series.latest_ready_version_id ? ' · latest ready' : ''}</option>)}</select></label>{cursor && <button className="button" disabled={locked || loading || choicesLoading || !!error} onClick={() => void more()}>Load older versions</button>}</>}
      {selectedVersion && <PresentationVersionView actor={actor} versionId={selectedVersion} expectedSeriesId={seriesId} embedded onSettled={settled} />}
    </section>
  </section>;
}
