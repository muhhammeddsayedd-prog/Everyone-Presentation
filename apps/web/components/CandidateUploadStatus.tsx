'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CandidateUploadRow } from '@eps/domain';
import { api, errorMessage } from './api';
import { Icon } from './Icon';

const ACTIVE = new Set(['uploading', 'processing']);
const LABEL: Record<CandidateUploadRow['state'], string> = { uploading: 'Uploading', processing: 'Processing', ready: 'Ready', needs_attention: 'Needs attention', failed: 'Failed', cancelled: 'Cancelled', expired: 'Expired' };
type JobView = { id: string; status: NonNullable<CandidateUploadRow['job']>['status']; stage: string; row_version: number; updated_at: string;
  error: { code: string; retryable: boolean } | null; candidate_result?: { candidate_id: string; workspace_candidate_id: string | null } };
function withJob(row: CandidateUploadRow, job: JobView): CandidateUploadRow {
  const state: CandidateUploadRow['state'] = job.status === 'succeeded' ? 'ready' : job.status === 'waiting_for_input' ? 'needs_attention' : job.status === 'failed' ? 'failed' : job.status === 'cancelled' ? 'cancelled' : 'processing';
  return { ...row, state, job: { id: job.id, status: job.status, stage: job.stage, error_code: job.error?.code ?? null, retryable: false, row_version: job.row_version, updated_at: job.updated_at },
    candidate_id: job.candidate_result?.candidate_id ?? row.candidate_id, workspace_candidate_id: job.candidate_result?.workspace_candidate_id ?? row.workspace_candidate_id };
}
const TONE: Record<CandidateUploadRow['state'], string> = { uploading: 'info', processing: 'info', ready: 'ok', needs_attention: 'warn', failed: 'bad', cancelled: 'outline', expired: 'outline' };

type Props = {
  workspaceId: string; refreshToken: number; canRetry: boolean;
  /** Project rows already shown; a finished upload says "Added to this project" only once its row is present. */
  presentIds: ReadonlySet<string>;
  /** Whether a person is a project member now (null = unknown). Read while a new tape for an existing person is
   * still processing, so a finished job that also added them to the project can say so. */
  isMember?: (candidateId: string) => boolean | null;
  /** A finished upload produced this project row: insert it (the person is newest, so page 1 has them). */
  onResolved: (row: CandidateUploadRow) => void;
  onProcessingChange?: (candidateIds: ReadonlySet<string>) => void;
  pollMs?: number;
};

/** Server-backed upload rows: restored after a refresh, polled until each job finishes. Leaving the screen
 * never cancels a server job; this only reads and, when permitted, retries a failed job. */
export function CandidateUploadStatus({ workspaceId, refreshToken, canRetry, presentIds, isMember, onResolved, onProcessingChange, pollMs = 3000 }: Props) {
  const [rows, setRows] = useState<CandidateUploadRow[]>([]);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState<Record<string, string>>({});
  const resolved = useRef(new Set<string>());
  const retryKeys = useRef(new Map<string, string>()); const [pollToken, setPollToken] = useState(0);
  const rowsRef = useRef<CandidateUploadRow[]>([]);
  // Membership of a new tape's existing person, captured before its job finished (known values only).
  const memberCheck = useRef(isMember); useEffect(() => { memberCheck.current = isMember; }, [isMember]);
  const [memberBefore, setMemberBefore] = useState<Record<string, boolean>>({}); const memberSeen = useRef(new Set<string>());
  const publish = useCallback((next: CandidateUploadRow[]) => {
    rowsRef.current = next; setRows(next); setError('');
    const seen: Record<string, boolean> = {};
    for (const row of next) if (row.target_candidate_id && row.state !== 'ready' && !memberSeen.current.has(row.upload_id)) {
      const known = memberCheck.current?.(row.target_candidate_id) ?? null; if (known === null) continue;
      memberSeen.current.add(row.upload_id); seen[row.upload_id] = known;
    }
    if (Object.keys(seen).length) setMemberBefore(current => ({ ...current, ...seen }));
    for (const row of next) if (row.state === 'ready' && row.workspace_candidate_id && !resolved.current.has(row.upload_id)) { resolved.current.add(row.upload_id); onResolved(row); }
  }, [onResolved]);
  // Rows are restored from the server (they survive a refresh); in-flight transfers appear once reserved.
  const read = useCallback(async (signal?: AbortSignal) => {
    const result = await api<CandidateUploadRow[]>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/candidate-uploads?limit=25`, { signal });
    publish(result.data.filter(row => row.state !== 'cancelled' && row.state !== 'expired'));
  }, [workspaceId, publish]);
  // Processing rows follow their job (GET /jobs/{id}); a finished job names the project row to insert.
  const followJobs = useCallback(async (signal: AbortSignal) => {
    const processing = rowsRef.current.filter(row => row.state === 'processing' && row.job);
    if (!processing.length) return;
    const jobs = await Promise.all(processing.map(row => api<JobView>(`/api/v1/jobs/${encodeURIComponent(row.job!.id)}`, { signal }).then(result => result.data)));
    const byId = new Map(jobs.map(job => [job.id, job]));
    publish(rowsRef.current.map(row => { const job = row.job && byId.get(row.job.id); return job ? withJob(row, job) : row; }));
    // A failed job is re-read from the uploads list: only the server knows whether a retry is still allowed.
    if (jobs.some(job => job.status === 'failed')) await read(signal);
  }, [publish, read]);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined; let stopped = false; let first = true;
    async function tick() {
      try {
        if (first || rowsRef.current.some(row => row.state === 'uploading')) await read(controller.signal);
        first = false;
        await followJobs(controller.signal);
        if (!stopped && rowsRef.current.some(row => ACTIVE.has(row.state))) timer = setTimeout(() => void tick(), pollMs);
      } catch (reason) { if (!controller.signal.aborted) { setError(errorMessage(reason)); timer = setTimeout(() => void tick(), pollMs * 3); } }
    }
    void tick();
    return () => { stopped = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, [read, followJobs, refreshToken, pollToken, pollMs]);
  useEffect(() => { onProcessingChange?.(new Set(rows.filter(row => ACTIVE.has(row.state) && row.target_candidate_id).map(row => row.target_candidate_id!))); }, [rows, onProcessingChange]);
  async function retry(row: CandidateUploadRow) {
    if (!row.job) return;
    const intent = `${row.job.id}:${row.job.row_version}`; const key = retryKeys.current.get(intent) ?? crypto.randomUUID(); retryKeys.current.set(intent, key);
    setRetrying(current => ({ ...current, [row.upload_id]: '' }));
    try {
      await api(`/api/v1/jobs/${encodeURIComponent(row.job.id)}/retry`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ row_version: row.job.row_version }) });
      retryKeys.current.delete(intent); setRetrying(current => { const next = { ...current }; delete next[row.upload_id]; return next; });
      await read(); setPollToken(value => value + 1);
    } catch (reason) { setRetrying(current => ({ ...current, [row.upload_id]: errorMessage(reason) })); }
  }
  if (!rows.length && !error) return null;
  return <section className="upload-status panel" aria-labelledby="upload-status-heading">
    <header className="panel-header"><div><h3 id="upload-status-heading">Your uploads in this project</h3><p className="small muted">Processing continues on the server if you leave this page.</p></div></header>
    {error && <div className="notice notice-error" role="alert"><p>Upload status could not be read: {error}</p></div>}
    <ul className="upload-status-list">{rows.map(row => {
      const present = row.workspace_candidate_id !== null && presentIds.has(row.workspace_candidate_id);
      // A new tape for someone who was not yet in this project, whose job also added them; unknown stays the plain wording.
      const joined = row.target_candidate_id !== null && row.workspace_candidate_id !== null && memberBefore[row.upload_id] === false;
      const outcome = row.state !== 'ready' ? null : row.target_candidate_id ? joined ? present ? 'Added to this project · New tape saved in Library' : 'New tape saved in Library · adding to this project…' : 'New tape saved in Library' : present ? 'Added to this project · Saved in Library' : row.workspace_candidate_id ? 'Saved in Library · adding to this project…' : 'Saved in Library';
      const busy = Object.hasOwn(retrying, row.upload_id) && retrying[row.upload_id] === '';
      return <li key={row.upload_id} className="upload-status-row" aria-busy={ACTIVE.has(row.state) || undefined}>
        <span className="upload-status-name" dir="auto">{row.filename ?? 'Introduction video'}</span>
        <span className={`badge badge-${TONE[row.state]}`}>{row.state === 'ready' ? <Icon name="check" /> : null}{LABEL[row.state]}</span>
        {outcome && <span className="small" role="status">{outcome}</span>}
        {row.state === 'needs_attention' && <span className="small">The source changed while processing. <Link href={`/processing?job=${row.job?.id ?? ''}`}>Open Processing</Link></span>}
        {row.state === 'failed' && <span className="small">Processing failed.{row.job?.error_code ? ` (${row.job.error_code})` : ''}</span>}
        {row.state === 'failed' && row.job?.retryable && canRetry && <button type="button" className="button button-small" disabled={busy} onClick={() => void retry(row)}>{busy ? 'Retrying…' : 'Retry'}</button>}
        {retrying[row.upload_id] && <span className="small text-bad" role="alert">{retrying[row.upload_id]}</span>}
      </li>;
    })}</ul>
  </section>;
}
