'use client';
import { Drawer } from './ui/Overlay';
import { PageFrame } from './shell/PageFrame';
import { Icon } from './Icon';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, type Actor, type Project, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { useRuntimeMode } from './RuntimeMode';
import { StudioDateTime } from './StudioTimeZone';
import {frameOutcomeSummary} from '../lib/frame-outcome-summary';
import { JOB_KINDS, JOB_STATUSES, STATUS_LABELS, STATUS_TONES, jobFailureMessage, processingActions, jobStageLabel, processingDelay, processingHref,
  readJobPage, readProcessingJob, readJobRetryAcknowledgement, retainJobIntent, validProcessingId, workspaceResultHref,
  type JobAction, type JobIntent, type JobPage, type ProcessingJob, type ProcessingStatus } from './processing-view';
import { stagger } from './motion/motion';

function readError(reason: unknown): string {
  if (reason instanceof ApiError) {
    if (reason.status === 401) return 'Your session expired. Sign in again to read processing jobs.';
    if (reason.status === 403) return 'Your account cannot access these processing jobs.';
    if (reason.status === 404) return 'This processing job is unavailable or is no longer shared with your account.';
  }
  return 'Processing could not be refreshed. Try again to read the saved state.';
}
const listDelay = (page: JobPage | null, failures: number) => processingDelay(page?.jobs.some(job => ['queued', 'running'].includes(job.status)) ? 'running' : null, failures, true);
const detailDelay = (job: ProcessingJob | null, failures: number) => processingDelay(job?.status ?? null, failures, false);
const newestJob = (current: ProcessingJob | null, next: ProcessingJob) => current && current.row_version >= next.row_version ? current : next;

/** One serial request per visible resource. Cleanup cancels both the deadline and
 * future polling; a timed-out HTTP request never implies a database rollback. */
function usePolling<T>(read: (signal: AbortSignal) => Promise<T>, delay: (data: T | null, failures: number) => number | null,
  paused = false, merge?: (current: T | null, next: T) => T) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null); const [refresh, setRefresh] = useState(0);
  const accept = useCallback((next: T) => setData(current => merge ? merge(current, next) : next), [merge]);
  const clear = useCallback(() => setData(null), []);
  const reload = useCallback(() => setRefresh(value => value + 1), []);
  useEffect(() => {
    if (paused) return;
    let current = true; let timer: ReturnType<typeof setTimeout> | undefined; let deadline: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined; let failures = 0;
    async function load() {
      controller = new AbortController(); setChecking(true); let next: T | null = null; let stop = false;
      deadline = setTimeout(() => controller?.abort(new DOMException('The request deadline elapsed.', 'TimeoutError')), 20_000);
      try {
        next = await read(controller.signal);
        if (!current) return;
        accept(next); setError(''); setCheckedAt(new Date().toISOString()); failures = 0;
      } catch (reason) {
        if (!current) return;
        failures++; setError(readError(reason));
        stop = reason instanceof ApiError && [400, 401, 403, 404].includes(reason.status);
        if (stop) setData(null);
      } finally {
        clearTimeout(deadline);
        if (current) { setLoading(false); setChecking(false); }
      }
      if (current && !stop) {
        const wait = delay(next, failures);
        if (wait !== null) timer = setTimeout(() => { void load(); }, wait);
      }
    }
    void load();
    return () => { current = false; controller?.abort(); clearTimeout(timer); clearTimeout(deadline); };
  }, [read, delay, paused, refresh, accept]);
  return { data, error, loading, checking, checkedAt, accept, clear, reload };
}

function JobProgress({ job }: { job: ProcessingJob }) {
  if (job.status === 'succeeded') return <p className="processing-progress">Processing complete.</p>;
  return <div className="processing-progress">
    {job.progress_total !== null && job.progress_total > 0
      ? <><progress aria-label={`${JOB_KINDS[job.kind]} progress`} value={job.progress_completed} max={job.progress_total} /><span>{job.progress_completed} of {job.progress_total} completed</span></>
      : <span>{job.progress_completed > 0 ? `${job.progress_completed} completed` : 'Progress not yet reported'}</span>}
  </div>;
}

function WorkspaceDestination({ job }: { job: ProcessingJob }) {
  const workspaceId = job.workspace_id; const kind = job.kind;
  const [resolved, setResolved] = useState<{ title: string; href: string } | null>(null); const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!workspaceId) return;
    const requestedId = workspaceId;
    let current = true; const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 20_000);
    async function resolve() {
      try {
        const workspace = (await api<Workspace>(`/api/v1/workspaces/${encodeURIComponent(requestedId)}`, { signal: controller.signal })).data;
        const href = workspaceResultHref({ workspace_id: workspaceId, kind }, workspace);
        if (workspace.module !== 'casting') throw new Error('Workspace unavailable.');
        let title = typeof workspace.title === 'string' && workspace.title ? workspace.title : 'Casting workspace';
        try {
          const project = (await api<Project>(`/api/v1/projects/${encodeURIComponent(workspace.project_id)}`, { signal: controller.signal })).data;
          if (project.id === workspace.project_id && typeof project.name === 'string' && project.name) title = project.name;
        } catch { /* The verified workspace remains usable if its optional project label is unavailable. */ }
        if (current) { setResolved({ title, href }); setError(''); }
      } catch { if (current) setError('The workspace could not be opened with your current access.'); }
      finally { clearTimeout(deadline); }
    }
    void resolve(); return () => { current = false; controller.abort(); clearTimeout(deadline); };
  }, [workspaceId, kind, refresh]);
  if (!job.workspace_id) return <p className="small muted">No casting workspace is attached to this job.</p>;
  if (error) return <ErrorNotice message={error} retry={() => setRefresh(value => value + 1)} />;
  if (!resolved) return <p className="small" role="status">Finding the shared project…</p>;
  return <div className="processing-destination"><span className="small muted">{resolved.title}</span><Link className="button button-small button-quiet" href={resolved.href}>{job.kind === 'specs_extract' ? 'Open requirements' : 'Open casting workspace'}</Link></div>;
}

function JobGroup({ jobs, status, cursor, partial, batch }: { jobs: ProcessingJob[]; status: ProcessingStatus | null; cursor: string | null; partial: boolean; batch: string | null }) {
  const [showWorkspace, setShowWorkspace] = useState(false);
  const batchId = jobs[0].batch_id;
  return <section className="processing-group"><div className="section-heading"><h2>{batchId ? 'Processing batch' : 'Individual jobs'}</h2><span className="small muted">{jobs.length} {partial ? 'loaded ' : ''}{jobs.length === 1 ? 'job' : 'jobs'}</span>{batchId && !batch && <Link className="button button-small button-quiet" href={processingHref({ batch: batchId, status })}>Open batch<Icon name="arrow" /></Link>}</div>
    {jobs[0].batch_id && <div className="batch-strip-wrap"><ol ref={stagger} className="batch-strip" aria-label={`${jobs.length} loaded ${jobs.length === 1 ? 'file' : 'files'} in this batch`}>{jobs.map((job, index) => <li key={job.id} className={`batch-cell batch-${job.status}`} title={`${JOB_KINDS[job.kind]} · ${STATUS_LABELS[job.status]}`}><span className="sr-only">File {index + 1}: {STATUS_LABELS[job.status]}</span></li>)}</ol>
      <p className="small muted">{JOB_STATUSES.filter(value => jobs.some(job => job.status === value)).map(value => `${jobs.filter(job => job.status === value).length} ${STATUS_LABELS[value].toLowerCase()}`).join(' · ')}{partial ? ' · counts include this page only' : ''}</p></div>}
    <details className="processing-project" onToggle={event => { if (event.currentTarget.open) setShowWorkspace(true); }}><summary>Project and workspace</summary>{showWorkspace && <WorkspaceDestination job={jobs[0]} />}</details>
    <ul ref={stagger} className="processing-jobs">{jobs.map(job => <li key={job.id}><div><Link className="processing-job-link" href={processingHref({ job: job.id, status, cursor, batch })}>{JOB_KINDS[job.kind]}</Link><p className="small muted">{jobStageLabel(job.stage)}</p><JobProgress job={job} /></div>
      <div className="processing-job-state"><span className={STATUS_TONES[job.status]}>{STATUS_LABELS[job.status]}</span><StudioDateTime className="small muted" value={job.created_at} prefix="Submitted " />{job.status === 'failed' && <p className="small">{jobFailureMessage(job.error)}</p>}</div></li>)}</ul>
  </section>;
}

function JobList({ status, cursor, batch }: { status: ProcessingStatus | null; cursor: string | null; batch: string | null }) {
  const router = useRouter();
  // batch_id narrows the same scoped list (docs/integrations/JOB_BATCH_FILTER.md); filters stay fixed across pages.
  const read = useCallback(async (signal: AbortSignal) => {
    const params = new URLSearchParams({ limit: '25' }); if (batch) params.set('batch_id', batch); if (status) params.set('status', status); if (cursor) params.set('cursor', cursor);
    return readJobPage(await api<unknown>(`/api/v1/jobs?${params}`, { signal }), status, cursor, batch);
  }, [status, cursor, batch]);
  const state = usePolling(read, listDelay);
  const groups = new Map<string, ProcessingJob[]>();
  for (const job of state.data?.jobs ?? []) { const key = JSON.stringify([job.workspace_id, job.batch_id]); groups.set(key, [...groups.get(key) ?? [], job]); }
  const panelBody = <>
    <div className="field"><label htmlFor="processing-status">Status</label><select id="processing-status" value={status ?? ''} onChange={event => router.replace(processingHref({ status: event.target.value as ProcessingStatus || null, batch }))}><option value="">All jobs</option>{JOB_STATUSES.map(value => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></div>
    <div className="panel-section"><h3 className="panel-eyebrow">Quick filters</h3><ul className="panel-links">{([null, ...JOB_STATUSES] as (ProcessingStatus | null)[]).map(value => <li key={value ?? 'all'}><Link href={processingHref({ status: value, batch })} aria-current={status === value ? 'page' : undefined}><span className={`status-swatch status-swatch-${value ?? 'all'}`} aria-hidden="true" /><span>{value ? STATUS_LABELS[value] : 'All jobs'}</span></Link></li>)}</ul></div>
    {batch && <div className="panel-section"><h3 className="panel-eyebrow">Batch</h3><p className="small muted">Showing one processing batch. Filters stay on this batch across pages.</p></div>}
    <p className="small muted" role="status">{state.checking ? 'Checking saved jobs…' : state.checkedAt ? <StudioDateTime value={state.checkedAt} prefix="Last checked " /> : 'Reading saved jobs…'}</p>
    <div className="section-note"><Icon name="info" /><p>Jobs keep their saved state across restarts. Retrying never creates a duplicate.</p></div>
  </>;
  return <PageFrame className="processing-page" panel={{ title: 'Filters', subtitle: batch ? 'Processing batch' : 'Processing jobs', label: 'Processing filters', body: panelBody }}>
    {batch && <Link className="back-link" href={processingHref({ status })}>← All processing jobs</Link>}
    <header className="page-heading"><div><h1>{batch ? 'Processing batch' : 'Processing'}</h1><p>{batch ? 'Every job in this batch that your account can access. Use Next jobs to read further pages.' : 'Saved processing state for the projects shared with your account.'}</p></div><button className="button button-small" disabled={state.checking} onClick={state.reload}><Icon name="refresh" />Refresh jobs</button></header>
    {state.error && <ErrorNotice message={state.error} retry={state.reload} />}
    {!state.data && state.loading ? <Loading label="Loading processing jobs…" /> : state.data?.jobs.length ? <div className="processing-groups">{[...groups].map(([key, jobs]) => <JobGroup key={key} jobs={jobs} status={status} cursor={cursor} batch={batch} partial={Boolean(cursor || state.data?.cursor)} />)}</div>
      : !state.error && <div className="processing-empty"><h2>{status ? 'No jobs with this status' : batch ? 'No accessible jobs in this batch' : 'No processing jobs'}</h2><p className="muted">{status ? 'Choose another status to see your other accessible jobs.' : batch ? 'This batch has no jobs that your account can read.' : 'Jobs will appear here after processing is requested.'}</p></div>}
    <nav className="button-row processing-pagination" aria-label="Processing pages">{cursor && <Link className="button button-small button-quiet" href={processingHref({ status, batch })}>First jobs</Link>}{state.data?.cursor && <Link className="button button-small" href={processingHref({ status, cursor: state.data.cursor, batch })}>Next jobs</Link>}</nav>
  </PageFrame>;
}

function JobDetail({ id, status, cursor, batch = null, canOperate, onDirtyChange, inDrawer = false }: { id: string; status: ProcessingStatus | null; cursor: string | null; batch?: string | null; canOperate: boolean; onDirtyChange: (dirty: boolean) => void ; inDrawer?: boolean }) {
  const [intent, setIntent] = useState<JobIntent | null>(null); const [busy, setBusy] = useState(false); const [stale, setStale] = useState(false);
  const [operationError, setOperationError] = useState(''); const [saved, setSaved] = useState(''); const [confirmCancel, setConfirmCancel] = useState(false);
  const mounted = useRef(true); const controller = useRef<AbortController | null>(null);
  const read = useCallback(async (signal: AbortSignal) => readProcessingJob((await api<unknown>(`/api/v1/jobs/${encodeURIComponent(id)}`, { signal })).data, id), [id]);
  const state = usePolling(read, detailDelay, Boolean(intent) || busy || stale, newestJob); const job = state.data;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { onDirtyChange(busy || Boolean(intent)); return () => onDirtyChange(false); }, [busy, intent, onDirtyChange]);
  function reload() { setIntent(null); setStale(false); setOperationError(''); setSaved(''); setConfirmCancel(false); state.reload(); }
  async function operate(action: JobAction) {
    if (!job || busy || !canOperate || stale) return;
    const confirmingUnknown = intent !== null;
    const request = retainJobIntent(intent, job, action, () => crypto.randomUUID()); setIntent(request); setBusy(true); setOperationError(''); setSaved(''); setConfirmCancel(false);
    const active = new AbortController(); controller.current = active;
    const deadline = setTimeout(() => active.abort(new DOMException('The request deadline elapsed.', 'TimeoutError')), 20_000);
    try {
      const result = await api<unknown>(`/api/v1/jobs/${encodeURIComponent(request.jobId)}/${request.action}`, { method: 'POST', body: JSON.stringify(request.body), headers: { 'Idempotency-Key': request.key }, signal: active.signal });
      let next: ProcessingJob | null = null;
      if (request.action === 'retry') readJobRetryAcknowledgement(result.data, request.jobId);
      else next = readProcessingJob(result.data, id);
      if (!mounted.current) return;
      // A valid retry acknowledgement settles the write. Read the actual saved
      // revision through polling; a later read failure must never resend it.
      if (next) state.accept(next);
      else { state.clear(); state.reload(); }
      setIntent(null); setSaved(action === 'retry' ? 'Retry request saved.' : 'Cancellation request saved. Any completed work is retained.');
    } catch (reason) {
      if (!mounted.current) return;
      if (confirmingUnknown) {
        setOperationError('The earlier request is still unconfirmed. Retry this same request when access is available to check its saved outcome.');
      } else if (reason instanceof ApiError && reason.status === 409) {
        setIntent(null); setStale(true); setOperationError('This job changed or this operation is no longer available. Reload its saved details before choosing another action.');
      } else if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
        setIntent(null); state.clear(); setOperationError(readError(reason)); state.reload();
      } else setOperationError('The request could not be confirmed. Retry this same request to check its saved outcome.');
    } finally { clearTimeout(deadline); if (mounted.current) setBusy(false); }
  }
  const retryable = job ? processingActions(job).retry : false;
  const cancellable = job ? processingActions(job).cancel : false;
  return <>
    {!inDrawer && <Link className="back-link" href={processingHref({ status, cursor, batch })}>← All processing jobs</Link>}
    {inDrawer ? <div className="job-drawer-head"><h3>{job ? JOB_KINDS[job.kind] : 'Processing job'}</h3><button className="button button-small button-quiet" disabled={busy || Boolean(intent)} onClick={reload}><Icon name="refresh" />Reload job details</button></div>
      : <header className="page-heading"><div><h1>{job ? JOB_KINDS[job.kind] : 'Processing job'}</h1><p>Saved state is retained when you refresh or leave this page.</p></div><button className="button button-small button-quiet" disabled={busy || Boolean(intent)} onClick={reload}>Reload job details</button></header>}
    {state.error && <ErrorNotice message={state.error} retry={state.reload} />}
    {!job && state.loading ? <Loading label="Loading processing job…" /> : job && <>
      <section className="editor-section processing-detail"><div className="section-heading"><h2>Processing status</h2><span className={STATUS_TONES[job.status]}>{STATUS_LABELS[job.status]}</span></div>
        <dl className="processing-facts"><div><dt>Stage</dt><dd>{jobStageLabel(job.stage)}</dd></div><div><dt>Submitted</dt><dd><StudioDateTime value={job.created_at} /></dd></div><div><dt>Last saved update</dt><dd><StudioDateTime value={job.updated_at} /></dd></div></dl>
        <JobProgress job={job} />{job.frame_extraction&&<p className="notice" role="status">{frameOutcomeSummary(job.frame_extraction)}</p>}{job.error && <div className="notice notice-error"><p>{jobFailureMessage(job.error)}</p></div>}
        {job.status === 'waiting_for_input' && <p className="small">This job needs input before it can continue. Open its workspace to review the available requirements.</p>}
        {job.status === 'cancelled' && <p className="small">Cancellation is recorded. Any work already completed is retained.</p>}
        <p className="small muted" role="status">{state.checking && !busy && !intent ? 'Checking saved status…' : state.checkedAt ? <StudioDateTime value={state.checkedAt} prefix="Last checked " /> : 'Reading saved status…'}</p>
      </section>
      <section className="editor-section"><div className="section-heading"><h2>Project and result</h2></div><WorkspaceDestination key={`${job.id}/${job.workspace_id}`} job={job} />{job.kind === 'presentation_render' && job.resource_id && <><Link className="button" href={`/presentations/versions/${encodeURIComponent(job.resource_id)}`}>Open saved version</Link><p className="small muted">Retrying uses this captured version, including its original words and media.</p></>}</section>
      {canOperate && <section className="editor-section processing-actions"><div className="section-heading"><h2>Recovery</h2><span className="save-state" role="status" aria-live="polite">{busy ? 'Saving…' : operationError ? 'Could not confirm' : saved || 'Up to date'}</span></div>
        <p className="small muted">Cancellation is best-effort. Completed work is retained; retrying resumes eligible failed work.</p>
        {!intent && !stale && <div className="button-row">{retryable && <button className="button" disabled={busy} onClick={() => { void operate('retry'); }}>Retry failed processing</button>}{cancellable && <button className="button button-quiet" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel processing</button>}{!retryable && !cancellable && <p className="small muted">No recovery action is available for this saved state.</p>}</div>}
        {confirmCancel && !intent && <div className="notice"><p>Stop remaining work? Any completed work will be retained.</p><div className="button-row"><button className="button" onClick={() => { void operate('cancel'); }}>Confirm cancellation</button><button className="button button-quiet" onClick={() => setConfirmCancel(false)}>Keep processing</button></div></div>}
        {operationError && <ErrorNotice message={operationError} />}
        {intent && !busy && <button className="button" onClick={() => { void operate(intent.action); }}>Retry this {intent.action === 'retry' ? 'retry' : 'cancellation'} request</button>}
        {stale && <button className="button" onClick={reload}>Reload saved job</button>}
      </section>}
    </>}
    {!job && operationError && <ErrorNotice message={operationError} />}
  </>;
}

function JobDrawer({ job, status, cursor, batch, canOperate, onDirtyChange }: { job: string; status: ProcessingStatus | null; cursor: string | null; batch: string | null; canOperate: boolean; onDirtyChange: (dirty: boolean) => void }) {
  const router = useRouter(); const [locked, setLocked] = useState(false);
  const changed = useCallback((value: boolean) => { setLocked(value); onDirtyChange(value); }, [onDirtyChange]);
  return <Drawer wide title="Processing details" description="Saved job state. It is retained when you refresh or leave this page." busy={locked} closeLabel="Close processing details" onClose={() => router.push(processingHref({ status, cursor, batch }))}>
    <JobDetail id={job} status={status} cursor={cursor} batch={batch} canOperate={canOperate} onDirtyChange={changed} inDrawer />
  </Drawer>;
}

function ProcessingRoute({ actor, onDirtyChange }: { actor: Actor; onDirtyChange: (dirty: boolean) => void }) {
  const params = useSearchParams(); const job = params.get('job'); const rawStatus = params.get('status'); const cursor = params.get('cursor'); const batch = params.get('batch');
  const status = rawStatus as ProcessingStatus | null;
  if (['job', 'status', 'cursor', 'batch'].some(key => params.getAll(key).length > 1) || job !== null && !validProcessingId(job) || cursor !== null && !validProcessingId(cursor) || batch !== null && !validProcessingId(batch)
    || status !== null && !JOB_STATUSES.includes(status)) return <><header className="page-heading"><h1>Processing</h1></header><ErrorNotice message="This processing link contains an unsupported job or filter." /><Link className="button" href="/processing">Show processing jobs</Link></>;
  return <><JobList key={`${actor.id}/${batch}/${status}/${cursor}`} status={status} cursor={cursor} batch={batch} />
    {job && <JobDrawer key={`${actor.id}/${job}`} job={job} status={status} cursor={cursor} batch={batch} canOperate={actor.capabilities?.includes('operations.retry') === true} onDirtyChange={onDirtyChange} />}</>;
}

export function ProcessingView({ actor, onDirtyChange }: { actor: Actor; onDirtyChange: (dirty: boolean) => void }) {
  const central = useRuntimeMode() === 'supabase';
  if (!central) return <><header className="page-heading"><h1>Processing</h1></header><div className="processing-empty"><h2>Processing is unavailable in this development fixture</h2><p className="muted">This fixture does not create or simulate processing jobs. Central jobs are available through an authorized Everyone account.</p></div></>;
  return <div className="processing-view"><Suspense fallback={<Loading label="Opening processing…" />}><ProcessingRoute actor={actor} onDirtyChange={onDirtyChange} /></Suspense></div>;
}
