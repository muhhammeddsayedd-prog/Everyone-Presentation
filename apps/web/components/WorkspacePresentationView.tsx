'use client';

import Link from 'next/link';
import { StepFooter } from './workspace/StepFlow';
import { isGenerationTemplate, isPortraitTemplate, templateName } from './workspace/template-names';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import type { PresentationSeries, PresentationVersion, ReviewJobAccepted, WorkspaceReview } from '@eps/domain';
import { summarizePresentationChanges } from '../../../packages/domain/src/presentation';
import { api, ApiError, errorMessage, mutation, type Actor, type Envelope, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { Icon } from './Icon';
import { StudioDateTime } from './StudioTimeZone';
import { PageFrame } from './shell/PageFrame';
import { DeckStage } from './workspace/DeckStage';
import { useStageDeck } from './workspace/useStageDeck';
import { SavedStage, statusLabel, useSavedVersion, VersionActions } from './presentation/saved-version';
import { checkLink, checkTitle, fitFieldLabel, LAYOUT_CHECK_CODES } from './presentation/checks';
import { m as motion } from 'motion/react';
import { RevealItem, RevealList } from './motion/Reveal';
import { glide } from './motion/presets';

interface Props { projectId: string; workspaceId: string; actor: Actor; initialOutput: 'selection' | 'shortlist'; requestedSeriesId?: string | null; onSeriesChanged?: (value: string) => void; onDirtyChange: (dirty: boolean) => void }
interface GenerationIntent { path: string; init: RequestInit; seriesId: string }
interface Draft { workspace: Workspace; review: WorkspaceReview; series: PresentationSeries; lastReady: PresentationVersion | null }

const outputName = (value: 'selection' | 'shortlist') => value === 'selection' ? 'Cast Selection' : 'Cast Shortlist';
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const FIT_POLL_MS = 2000, FIT_WAIT_MS = 5 * 60 * 1000;

/** The Presentation step: choose or create the series, then generate. Generate runs the server's layout measurement
 * first when this exact draft has not been measured, then captures the version — there is no separate Review step.
 * On the stage: the server-checked working draft (exactly what Generate captures) or the selected saved version. */
export function WorkspacePresentationView(props: Props) { return <PresentationScope key={`${props.actor.id}:${props.workspaceId}`} {...props} />; }
function PresentationScope({ projectId, workspaceId, actor, initialOutput, requestedSeriesId, onSeriesChanged, onDirtyChange }: Props) {
  const [series, setSeries] = useState<PresentationSeries[]>([]); const [seriesId, setSeriesId] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null); const [versions, setVersions] = useState<PresentationVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState(''); const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [refresh, setRefresh] = useState(0);
  const [readingMore, setReadingMore] = useState(false); const [stale, setStale] = useState(false);
  const [choicesLoading, setChoicesLoading] = useState(true);
  const [output, setOutput] = useState(initialOutput); const [audienceMissing, setAudienceMissing] = useState(false);
  const [coverNote, setCoverNote] = useState<string | null>(null);
  // The layout measurement job started by Generate; while it runs nothing else can change the draft from here.
  const [fitJob, setFitJob] = useState<string | null>(null); const generateAfterFit = useRef(false);
  const [choicesRefresh, setChoicesRefresh] = useState(0); const alive = useRef(false); const sending = useRef(false); const intent = useRef<GenerationIntent | null>(null);
  const activeSeries = useRef(''); const contextRequest = useRef(0); const knownSeries = useRef(new Map<string, PresentationSeries>()); const historyCursors = useRef(new Set<string>());
  const canGenerate = actor.capabilities?.includes('presentations.generate') && actor.capabilities?.includes('workspaces.write') && actor.capabilities?.includes('cast.read');
  const canCreate = actor.capabilities?.includes('presentations.generate') === true;
  const locked = busy || uncertain || readingMore || !!fitJob;
  useEffect(() => { if (seriesId) onSeriesChanged?.(seriesId); }, [seriesId, onSeriesChanged]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onDirtyChange(busy || uncertain || !!fitJob || coverNote !== null); return () => onDirtyChange(false); }, [busy, uncertain, fitJob, coverNote, onDirtyChange]);
  const settled = useCallback(() => { if (!intent.current) { setLoading(true); setRefresh(value => value + 1); } }, []);
  useEffect(() => {
    let current = true; const controller = new AbortController(); const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]);
    const load = async () => {
      try {
        const all: PresentationSeries[] = []; let next: string | null = null; const seen = new Set<string>();
        for (let n = 0; n < 100; n++) {
          const page: Envelope<PresentationSeries[]> = await api(`/api/v1/presentation-series?workspace_id=${workspaceId}&limit=100${next ? `&cursor=${encodeURIComponent(next)}` : ''}`, { signal });
          if (!Array.isArray(page.data) || page.data.some(row => row.workspace_id !== workspaceId)) throw new Error('The saved series could not be read for this workspace.');
          // 1.4.0 and frame-based 1.3.0 series generate here; earlier-template series stay readable in Presentations.
          all.push(...page.data.filter(row => !row.archived && (isGenerationTemplate(row.template_version) || row.id === requestedSeriesId))); next = page.page?.next_cursor ?? null;
          if (!next) break; if (seen.has(next) || n === 99) throw new Error('Series changed while paging. Refresh the choices.'); seen.add(next);
        }
        if (!current || intent.current) return;
        if (requestedSeriesId && !all.some(row => row.id === requestedSeriesId)) throw new Error('The linked presentation series is unavailable in this workspace. Choose another series or create one.');
        all.forEach(row => knownSeries.current.set(row.id, row));
        const selected = activeSeries.current || requestedSeriesId || all.find(row => row.output_type === initialOutput)?.id || all[0]?.id || '';
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
      } catch (reason) { if (current && !intent.current) { setDraft(null); setError(errorMessage(reason)); generateAfterFit.current = false; } } finally { if (current && !intent.current) setLoading(false); }
    }; void load(); return () => { current = false; controller.abort(); };
  }, [workspaceId, projectId, seriesId, refresh, uncertain]);
  // Follow the layout measurement Generate started; when it settles, re-read the checked draft.
  useEffect(() => {
    if (!fitJob) return; let current = true; let timer: ReturnType<typeof setTimeout> | undefined; const controller = new AbortController(); const started = Date.now();
    const poll = async () => {
      try {
        const job = (await api<{ id: string; status: string }>(`/api/v1/jobs/${encodeURIComponent(fitJob)}`, { signal: controller.signal })).data;
        if (!current) return; if (job.id !== fitJob) throw new Error('Layout job identity changed.');
        if (['succeeded', 'failed', 'cancelled', 'waiting_for_input'].includes(job.status)) {
          if (job.status !== 'succeeded') { generateAfterFit.current = false; setNotice(''); setError('The layout check could not complete. Nothing was generated and saved work is unchanged. Generate again to retry.'); }
          setFitJob(null); setLoading(true); setRefresh(value => value + 1); return;
        }
        if (Date.now() - started > FIT_WAIT_MS) { generateAfterFit.current = false; setFitJob(null); setNotice('The layout check is still running. Follow it in Processing, then refresh this draft.'); return; }
        timer = setTimeout(() => void poll(), FIT_POLL_MS);
      } catch (reason) { if (current) { generateAfterFit.current = false; setFitJob(null); setError(errorMessage(reason)); } }
    };
    void poll(); return () => { current = false; controller.abort(); clearTimeout(timer); };
  }, [fitJob]);
  // After a measurement Generate asked for, continue to generation once the re-read draft allows it.
  const continueAfterFit = useEffectEvent((value: Draft) => {
    generateAfterFit.current = false;
    if (value.review.can_generate) void generate();
    else { setNotice(''); setError(value.review.fit.overflows.length ? `The layout check found ${plural(value.review.fit.overflows.length, 'field')} that ${value.review.fit.overflows.length === 1 ? 'does' : 'do'} not fit. Shorten ${value.review.fit.overflows.length === 1 ? 'it' : 'them'}, then generate again.` : 'Checks still block generation. Fix the items listed below, then generate again.'); }
  });
  useEffect(() => { if (draft && !fitJob && !loading && generateAfterFit.current) continueAfterFit(draft); }, [draft, fitJob, loading]);
  async function measureThenGenerate() {
    if (sending.current || !draft || uncertain || fitJob) return;
    sending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const accepted = (await api<ReviewJobAccepted>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/review/fit`, { ...mutation('POST', { series_id: draft.series.id, expected_input_fingerprint: draft.review.input_fingerprint }), signal: AbortSignal.timeout(30000) })).data;
      if (!alive.current) return;
      if (!accepted.job_id) throw new Error('The layout check could not be started.');
      generateAfterFit.current = true; setFitJob(accepted.job_id); setNotice('Checking the layout with the registered template, then generating…');
    } catch (reason) { if (alive.current) { generateAfterFit.current = false; if (reason instanceof ApiError && reason.status === 409) setStale(true); setError(errorMessage(reason)); } }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  }
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
      intent.current = null; setUncertain(false); setSelectedVersion(value.resource_id); setNotice('The captured version is saved. Its processing status and PDF are shown on the stage.'); setRefresh(value => value + 1);
    } catch (reason) { if (alive.current) {
      const unknown = uncertain || !(reason instanceof ApiError) || reason.status >= 500 || [408, 429].includes(reason.status);
      setUncertain(unknown); if (!unknown) { intent.current = null; if (reason instanceof ApiError && reason.status === 409) setStale(true); }
      setError(`${unknown ? 'Generation may have been accepted. Confirm the same request before starting another. ' : ''}${errorMessage(reason)}`);
    } } finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  /** A new series for the chosen output. The server applies the Studio's default review audience and template and
   * reuses an existing matching series. Another audience (for example Agency) is chosen in Share. */
  async function createSeries() {
    if (sending.current || uncertain) return; sending.current = true; setBusy(true); setError(''); setNotice(''); setAudienceMissing(false);
    try {
      const value = (await api<PresentationSeries>('/api/v1/presentation-series', { ...mutation('POST', { workspace_id: workspaceId, output_type: output }), signal: AbortSignal.timeout(30000) })).data;
      if (!alive.current) return;
      if (value.workspace_id !== workspaceId) throw new Error('The new series belongs to a different workspace.');
      knownSeries.current.set(value.id, value); setSeries(rows => [...rows.filter(row => row.id !== value.id), value]);
      activeSeries.current = value.id; contextRequest.current++; setSeriesId(value.id); setDraft(null); setVersions([]); setSelectedVersion(''); setLoading(true);
      setNotice(`${outputName(value.output_type)} series ready. Generate when the working draft looks right.`);
    } catch (reason) { if (!alive.current) return;
      if (reason instanceof ApiError && reason.code === 'AUDIENCE_DEFAULT_REQUIRED') setAudienceMissing(true); else setError(errorMessage(reason));
    } finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  async function saveCoverNote(value: string | null) {
    const target = draft?.series; if (!target || sending.current) return;
    sending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const saved = (await api<PresentationSeries>(`/api/v1/presentation-series/${encodeURIComponent(target.id)}`, { ...mutation('PATCH', { row_version: target.row_version, cover_note: value }), signal: AbortSignal.timeout(30000) })).data;
      if (!alive.current) return;
      knownSeries.current.set(saved.id, saved); setSeries(rows => rows.map(row => row.id === saved.id ? saved : row)); setCoverNote(null); setNotice('Cover note saved.');
      setLoading(true); setRefresh(n => n + 1);
    } catch (reason) { if (alive.current) { if (reason instanceof ApiError && reason.status === 409) setStale(true); setError(errorMessage(reason)); } }
    finally { sending.current = false; if (alive.current) setBusy(false); }
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
  // Only "not measured yet / measurement failed" stands between this draft and Generate: Generate measures first.
  const layoutOnly = !!draft && !draft.review.can_generate && blocking.length > 0 && blocking.every(issue => LAYOUT_CHECK_CODES.includes(issue.code));
  const fixable = blocking.filter(issue => !LAYOUT_CHECK_CODES.includes(issue.code) && issue.code !== 'LAYOUT_OVERFLOW');
  const overflows = draft?.review.fit.overflows ?? [];
  const notes = (draft?.review.issues.length ?? 0) - blocking.length;
  const ready = !!draft && (draft.review.can_generate || layoutOnly);
  // Generate is the one filled action while the draft holds unsaved changes; Continue steps back to a quiet button.
  const generateLeads = !!(draft && canGenerate && ready && (!draft.lastReady || changes?.has_changes));
  const layout = !draft ? null : fitJob ? { tone: 'info', text: 'Checking layout…' } : draft.review.fit.status === 'measured' ? overflows.length ? { tone: 'error', text: `${plural(overflows.length, 'field')} too long` } : { tone: 'ok', text: 'Fits the template' }
    : draft.review.fit.status === 'failed' ? { tone: 'warn', text: 'Check failed · retried on Generate' } : { tone: 'muted', text: 'Checked when you generate' };
  const shownCoverNote = coverNote ?? draft?.series.cover_note ?? '';

  const createForm = <div className="series-create">
    <label>Output for a new series<select value={output} disabled={locked || !canCreate} onChange={event => setOutput(event.target.value as typeof output)}><option value="selection">Cast Selection</option><option value="shortlist">Cast Shortlist</option></select></label>
    <button className={`button${series.length ? '' : ' button-primary'}`} type="button" disabled={!canCreate || locked || choicesLoading} onClick={() => void createSeries()}><Icon name="plus" />Create presentation series</button>
    {!canCreate && <p className="small">Creating a series requires presentation generation permission.</p>}
    {audienceMissing && <div className="notice notice-warning" role="status" data-testid="audience-default-recovery"><p>No default review audience is set yet. Choose the Client audience as the default in Settings, then create the series here. To present to a different audience, choose a review context in Share.</p>
      <span className="button-row"><Link className="button button-small" href="/settings#studio-defaults">Choose default audience in Settings</Link><Link className="button button-small button-quiet" href={`${base}/share`}>Open Share</Link></span></div>}
  </div>;

  const panelBody = <div className="versions-panel stack-lg">
    {error && <ErrorNotice message={error} />}{notice && <p className="review-notice" role="status">{notice}</p>}
    {uncertain && <div className="notice"><p>Keep this generation request until its acknowledgement is confirmed. Another request could create another version.</p><button className="button" disabled={busy} onClick={() => void generate(true)}>Confirm generation request</button></div>}
    {stale && <div className="notice notice-warning" role="status"><p>The presentation information changed since this draft was read. Refresh the working draft, check it, then generate.</p><button className="button" disabled={locked || loading || choicesLoading} onClick={refreshAll}>Refresh the changed draft</button></div>}
    <section className="panel-section series-choice" aria-labelledby="versions-series-heading">
      <h3 id="versions-series-heading" className="panel-eyebrow">Presentation series</h3>
      {series.length > 0 && <>
        <label className="sr-only" htmlFor="versions-series">Presentation series</label>
        <select id="versions-series" aria-label="Presentation series" title={chosenSeries ? `${chosenSeries.title} · ${chosenSeries.audience_snapshot.label} · ${templateName(chosenSeries.template_version)}` : undefined} value={seriesId} disabled={locked || loading || choicesLoading} onChange={event => { activeSeries.current = event.target.value; contextRequest.current++; setSeriesId(event.target.value); setDraft(null); setVersions([]); setSelectedVersion(''); setLoading(true); setNotice(''); setCoverNote(null); }}>
          {series.map(row => <option key={row.id} value={row.id}>{row.title} · {row.audience_snapshot.label} · {templateName(row.template_version)}</option>)}</select>
        {chosenSeries && <p className="small muted">{outputName(chosenSeries.output_type)} · {chosenSeries.audience_snapshot.label} ({chosenSeries.audience_snapshot.scope}) · {templateName(chosenSeries.template_version)}. Output, audience and template are fixed per series.</p>}
        <details className="series-new"><summary>New series</summary>{createForm}</details>
      </>}
      {!series.length && !choicesLoading && <div className="series-empty"><span className="series-empty-icon" aria-hidden="true"><Icon name="slides" /></span><h4>Start a presentation series</h4><p className="small muted">A series keeps every saved version of one output for one audience. Choose the output, then generate.</p>{createForm}</div>}
    </section>
    {loading && !draft && series.length > 0 ? <Loading label="Opening the working draft…" />
      : draft && <section className="draft-card presentation-draft" data-current={!selectedVersion ? '' : undefined} aria-labelledby="working-draft-heading">
        <div className="draft-card-head"><h3 id="working-draft-heading" className="stage-chip stage-chip-ok"><span className="stage-chip-dot" aria-hidden="true" />Working draft</h3>
          {selectedVersion ? <button type="button" className="button button-small" onClick={() => setSelectedVersion('')}>Show on stage</button> : <span className="small muted">On the stage</span>}</div>
        <p className="small">{draft.review.cover.project_name} · {draft.series.audience_snapshot.label} · {outputName(draft.review.output_type)}</p>
        <dl className="draft-facts">
          <div><dt>Candidates</dt><dd>{draft.review.candidate_slide_count}</dd></div>
          <div><dt>Pending</dt><dd>{draft.review.pending_slide_count}</dd></div>
          <div><dt>Total pages</dt><dd>{draft.review.slides.length + 1}</dd></div>
        </dl>
        <ul className="draft-readiness" aria-label="Before generating">
          <li data-tone={layout!.tone}><Icon name={layout!.tone === 'ok' ? 'check' : layout!.tone === 'error' ? 'alert' : fitJob ? 'refresh' : 'info'} /><span><strong>Layout</strong> {layout!.text}</span></li>
          <li data-tone={fixable.length ? 'error' : 'ok'}><Icon name={fixable.length ? 'alert' : 'check'} /><span><strong>Checks</strong> {fixable.length ? `${plural(fixable.length, 'item blocks', 'items block')} generation` : 'Nothing else blocks generation'}</span></li>
          {notes > 0 && <li data-tone="muted"><Icon name="info" /><span><strong>Notes</strong> {plural(notes, 'allowed note')} {notes === 1 ? 'prints' : 'print'} as stated (missing facts, open slots, fewer frames)</span></li>}
        </ul>
        {(fixable.length > 0 || overflows.length > 0) && <ul className="draft-fixes" aria-label="Fix before generating">
          {fixable.map((issue, index) => { const link = checkLink(issue, draft.review, base); return <li key={`${issue.code}:${index}`}>
            <span className="draft-fix-text"><strong dir="auto">{checkTitle(draft.review, issue.entity_id)}</strong><span>{issue.message}{issue.field && <> · {fitFieldLabel(issue.field)}</>}</span></span>
            {link && <Link className="button button-small button-quiet" href={link.href}>{link.label}</Link>}</li>; })}
          {overflows.map((overflow, index) => { const slide = overflow.slide_index > 0 ? draft.review.slides[overflow.slide_index - 1] : null; return <li key={`overflow:${index}`}>
            <span className="draft-fix-text"><strong dir="auto">Slide {overflow.slide_index + 1} · {checkTitle(draft.review, null, overflow.slide_index)}</strong><span>{fitFieldLabel(overflow.field)} is {Math.ceil(overflow.overflow_px)} px too {overflow.axis === 'vertical' ? 'tall' : 'wide'}. Shorten the supplied wording.</span></span>
            {slide?.candidate_id ? <Link className="button button-small button-quiet" href={`/library/cast/${slide.candidate_id}`}>Open profile</Link> : overflow.slide_index === 0 ? <Link className="button button-small button-quiet" href={`${base}/project`}>Open Project</Link> : null}</li>; })}
        </ul>}
        {isPortraitTemplate(draft.series.template_version) && <form className="draft-cover-note" onSubmit={event => { event.preventDefault(); void saveCoverNote(shownCoverNote.trim() || null); }}>
          <label>Cover note<input type="text" maxLength={500} value={shownCoverNote} placeholder="e.g. Pending Availability." disabled={!canCreate || locked} onChange={event => setCoverNote(event.target.value)} /></label>
          <span className="button-row"><button className="button button-small" type="submit" disabled={!canCreate || locked || coverNote === null}>Save cover note</button>
            {draft.series.cover_note && <button className="button button-small button-quiet" type="button" disabled={!canCreate || locked} onClick={() => void saveCoverNote(null)}>Remove cover note</button>}</span>
        </form>}
        {changes && <div className="draft-change-summary"><h4 className="small">{!draft.lastReady ? 'First saved version' : changes.has_changes ? `Changes since ready version ${draft.lastReady.version_no}` : `Matches ready version ${draft.lastReady.version_no}`}</h4>{!draft.lastReady ? <p className="small muted">The first version will capture the current content.</p> : changes.has_changes ? <ul>{changes.added_assignments > 0 && <li>{changes.added_assignments} assignment{changes.added_assignments === 1 ? '' : 's'} added</li>}{changes.removed_assignments > 0 && <li>{changes.removed_assignments} assignment{changes.removed_assignments === 1 ? '' : 's'} removed</li>}{changes.changed_fields > 0 && <li>{changes.changed_fields} display field{changes.changed_fields === 1 ? '' : 's'} changed</li>}{changes.changed_media > 0 && <li>Selected media changed</li>}{changes.changed_requirements > 0 && <li>Requirements or open slots changed</li>}{changes.changed_casting > 0 && <li>Casting position changed</li>}{changes.order_changed && <li>Page order changed</li>}{changes.branding_changed && <li>Project, client or branding changed</li>}{changes.template_changed && <li>Template changed</li>}{changes.shared_source_changed && <li>Shared source information changed</li>}</ul> : <p className="small muted">No content changes since that ready version.</p>}</div>}
        <button className="button button-primary draft-generate" aria-busy={fitJob || busy ? true : undefined} disabled={!canGenerate || locked || loading || choicesLoading || stale || !ready} onClick={() => void (layoutOnly ? measureThenGenerate() : generate())}><Icon name="sparkle" />Generate saved version</button>
        {fitJob && <p className="draft-progress small" role="status"><span className="draft-progress-bar" aria-hidden="true" />Checking the layout, then generating. This usually takes under a minute.</p>}
        {!canGenerate && <p className="small">Generating requires presentation and project preparation permissions.</p>}
        <p className="small muted">The saved version and its PDF appear on the stage. Guests never see the working draft.</p>
      </section>}
    {series.length > 0 && <section className="panel-section presentation-history" aria-labelledby="history-heading">
      <div className="history-head"><h3 id="history-heading" className="panel-eyebrow">Saved history</h3><span className="small muted">{versions.length} {versions.length === 1 ? 'version' : 'versions'}{cursor ? '+' : ''}</span></div>
      {!versions.length && !selectedVersion ? <p className="small muted">No saved versions in this series yet. Generate one to capture the working draft.</p> : <RevealList className="version-list" label="Saved versions">
        {selectedVersion && !versions.some(row => row.id === selectedVersion) && <RevealItem><button type="button" className="version-card" aria-current="true"><VersionHighlight /><span className="version-card-no"><Icon name="lock" /></span><span className="version-card-text"><strong>Selected saved version</strong><span>Opening…</span></span></button></RevealItem>}
        {versions.map(row => <RevealItem key={row.id}><button type="button" className={`version-card${row.id === draft?.series.latest_ready_version_id ? ' card-newest' : ''}`} data-status={row.status} disabled={locked} aria-current={row.id === selectedVersion ? 'true' : undefined} onClick={() => setSelectedVersion(row.id)}>
          {row.id === selectedVersion && <VersionHighlight />}<span className="version-card-no" aria-hidden="true">v{row.version_no}</span>
          <span className="version-card-text"><strong>Version {row.version_no}</strong><span>{statusLabel(row)} · <StudioDateTime value={row.created_at} /> · {row.slides.length} slides</span></span>
          <span className={`pill ${row.status === 'ready' ? 'pill-ok' : row.status === 'failed' ? 'pill-error' : 'pill-info'}`}>{row.id === draft?.series.latest_ready_version_id ? 'Latest ready' : statusLabel(row)}</span>
        </button></RevealItem>)}
      </RevealList>}
      {cursor && <button className="button button-small" disabled={locked || loading || choicesLoading || !!error} onClick={() => void more()}>Load older versions</button>}
    </section>}
  </div>;

  return <PageFrame inline className="workspace-frame presentation-frame versions-frame"
    panel={{ title: 'Presentation', subtitle: 'Generate, download and share', label: 'Versions panel', wide: true, body: panelBody,
      actions: <button type="button" className="icon-button icon-button-small" aria-label="Refresh working draft" title="Refresh working draft" disabled={locked || loading || choicesLoading} onClick={refreshAll}><Icon name="refresh" /></button>,
      footer: <StepFooter placement="panel" back={{ href: `${base}/organize`, label: 'Casting' }} next={{ href: `${base}/share${seriesId ? `?series_id=${seriesId}` : ''}`, label: 'Share & feedback', quiet: generateLeads }}>{selectedVersion && <Link className="button button-quiet button-small step-footer-aside" href={`/presentations/versions/${selectedVersion}`}><Icon name="external" />Open version page</Link>}</StepFooter> }}>
    {selectedVersion ? <VersionStage key={selectedVersion} versionId={selectedVersion} seriesId={seriesId} onSettled={settled} latest={selectedVersion === draft?.series.latest_ready_version_id} />
      : <DraftStage review={draft?.review ?? null} loading={loading} empty={!series.length && !choicesLoading} />}
  </PageFrame>;
}

/** The selected saved version's ring: one shared element that glides between version cards. */
function VersionHighlight() { return <motion.span layoutId="version-card-current" className="version-card-highlight" transition={glide} aria-hidden="true" />; }

/** The working draft as the server checked it — the content Generate captures for this series. */
function DraftStage({ review, loading, empty }: { review: WorkspaceReview | null; loading: boolean; empty: boolean }) {
  const stage = useStageDeck(review);
  const [index, setIndex] = useState(0);
  if (!review || !stage.deck) return <section className="live-stage live-stage-empty" aria-label="Slide preview" aria-busy={loading || undefined}>
    {stage.error ? <ErrorNotice message={stage.error} /> : empty ? <div className="empty-state"><Icon name="slides" /><h2>No presentation series yet</h2><p>Create a series in the panel; its working draft and saved versions appear here.</p></div>
      : <div className="stage-loading" role="status"><span className="stage-loading-slide" aria-hidden="true" /><p>Opening the working draft…</p></div>}
  </section>;
  const bounded = Math.min(index, stage.deck.pages.length - 1);
  return <DeckStage deck={stage.deck} rendered={stage.rendered} index={bounded} onIndex={setIndex} busy={loading}
    chip={{ tone: 'ok', text: `Working draft · revision ${review.draft_revision}` }} meta={<>Slide {bounded + 1} of {stage.deck.pages.length}</>}
    notices={stage.failed.length > 0 ? <p className="stage-note small"><Icon name="info" />{stage.failed.length} image{stage.failed.length === 1 ? '' : 's'} could not be opened for the preview.</p> : undefined}
    disclaimer={<>The working draft Generate will save, in {templateName(review.template.version)}. Guests never see the draft.</>} />;
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
