'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError, api } from './api';
import { ErrorNotice } from './Feedback';
import { STATUS_LABELS, STATUS_TONES, jobStageLabel, processingDelay, processingHref, type ProcessingJob } from './processing-view';
import { readSpecsProcessingJob, SpecsProcessingScopeError, specsProcessingMessage, type SpecsProcessingScope } from './specs-processing';

/** Reads the current source job only. Results never replace a producer's form. */
export function SpecsProcessing({ workspaceId, specId, jobId, loadBlocked, onReload }: SpecsProcessingScope & {
  loadBlocked: boolean; onReload: () => void;
}) {
  const [job, setJob] = useState<ProcessingJob | null>(null); const [error, setError] = useState('');
  const [checking, setChecking] = useState(true); const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true; let timer: ReturnType<typeof setTimeout> | undefined; let deadline: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined; let failures = 0;
    async function read() {
      controller = new AbortController(); setChecking(true); let next: ProcessingJob | null = null; let stop = false;
      deadline = setTimeout(() => controller?.abort(), 20_000);
      try {
        const response = await api<unknown>(`/api/v1/jobs/${encodeURIComponent(jobId)}`, { signal: controller.signal });
        const observed = readSpecsProcessingJob(response.data, { workspaceId, specId, jobId }); next = observed;
        if (!current) return;
        setJob(previous => previous && previous.id === observed.id && previous.row_version >= observed.row_version ? previous : observed);
        setError(''); failures = 0;
      } catch (reason) {
        if (!current) return;
        failures++; stop = reason instanceof SpecsProcessingScopeError || reason instanceof ApiError && [400, 401, 403, 404].includes(reason.status);
        if (stop) setJob(null);
        setError('Source processing could not be refreshed. Open processing details or try again to read the saved state.');
      } finally { clearTimeout(deadline); if (current) setChecking(false); }
      const wait = processingDelay(next?.status ?? null, failures, false);
      if (current && !stop && wait !== null) timer = setTimeout(() => { void read(); }, wait);
    }
    void read();
    return () => { current = false; controller?.abort(); clearTimeout(timer); clearTimeout(deadline); };
  }, [workspaceId, specId, jobId, refresh]);
  return <section className="editor-section specs-processing" aria-labelledby="source-processing-heading">
    <div className="section-heading"><h2 id="source-processing-heading">Source processing</h2>{job && <span className={STATUS_TONES[job.status]}>{STATUS_LABELS[job.status]}</span>}</div>
    <p className="small" role="status" aria-live="polite">{job ? specsProcessingMessage(job) : checking ? 'Reading saved source processing…' : 'Source processing status is unavailable.'}</p>
    {job && <p className="small muted">{jobStageLabel(job.stage)}</p>}
    {error && <ErrorNotice message={error} retry={() => setRefresh(value => value + 1)} />}
    <div className="button-row"><Link className="button button-small button-quiet" href={processingHref({ job: jobId })}>Processing details</Link>
      {job?.status === 'succeeded' && <button className="button button-small" disabled={loadBlocked || checking || Boolean(error)} onClick={onReload}>Load saved requirements</button>}</div>
    {job?.status === 'succeeded' && loadBlocked && <p className="small muted">Save or resolve local changes before loading saved requirements.</p>}
  </section>;
}
