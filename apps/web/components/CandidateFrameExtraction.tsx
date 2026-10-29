'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { api, errorMessage, mutation } from './api';
import { ErrorNotice } from './Feedback';
import { parseFrameSeconds } from '../lib/candidate-frame-times';
import type {FrameExtractionOutcome} from '@eps/central';

type Job = {id: string; status: string; row_version: number; frame_extraction?: FrameExtractionOutcome};
export function CandidateFrameExtraction({mediaId, sourceId, onFramesReady, onBusyChange}: {
  mediaId: string; sourceId: string; onFramesReady: (outcome?: FrameExtractionOutcome) => Promise<void>; onBusyChange: (busy: boolean) => void;
}) {
  const id = useId(); const [times, setTimes] = useState(''); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [job, setJob] = useState<Job | null>(null);
  const intent = useRef<{body: string; init: RequestInit} | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy,onBusyChange]);
  async function extract(event: React.FormEvent) {
    event.preventDefault(); setError('');
    let timestamps: number[];
    try {timestamps = parseFrameSeconds(times);} catch (reason) {setError(errorMessage(reason));return;}
    const body = {source_asset_id:sourceId,timestamps_ms:timestamps}; const serialized = JSON.stringify(body);
    if (intent.current?.body !== serialized) intent.current = {body:serialized,init:mutation('POST',body)};
    const controller = new AbortController(); request.current = controller; setBusy(true);
    try {
      const result = await api<{job_id:string;status:string}>(`/api/v1/candidate-media/${mediaId}/frames/extract`,{...intent.current.init,signal:controller.signal});
      if (!controller.signal.aborted) {
        setJob({id:result.data.job_id,status:result.data.status,row_version:0});
        if(['failed','cancelled'].includes(result.data.status))intent.current=null;
        if (result.data.status === 'succeeded') {
          const saved=await api<Job>(`/api/v1/jobs/${result.data.job_id}`,{signal:controller.signal});
          if(!controller.signal.aborted){setJob(saved.data);intent.current=null;await onFramesReady(saved.data.frame_extraction);}
        }
      }
    } catch (reason) { if (!controller.signal.aborted) setError(errorMessage(reason)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function check() {
    if (!job || busy) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    try {
      const result = await api<Job>(`/api/v1/jobs/${job.id}`,{signal:controller.signal});
      if (!controller.signal.aborted) {
        setJob(result.data);
        if(['failed','cancelled'].includes(result.data.status))intent.current=null;
        if (result.data.status === 'succeeded') {intent.current=null;await onFramesReady(result.data.frame_extraction);}
      }
    } catch (reason) {if (!controller.signal.aborted) setError(errorMessage(reason));}
    finally {if (!controller.signal.aborted) setBusy(false);}
  }
  const active = job && ['queued','running','waiting_for_input'].includes(job.status);
  return <section className="requirements-details"><h4>Extract frames at chosen times</h4>
    <p className="small muted">Enter seconds from the original video, separated by commas. New frames are added to the choices above; saved selections change only when you select and save them.</p>
    {error && <ErrorNotice message={error} />}
    <form onSubmit={extract}><div className="field"><label htmlFor={id}>Video times in seconds</label>
      <input id={id} value={times} maxLength={200} disabled={busy || !!active} placeholder="1.250, 5, 12.500" onChange={event => setTimes(event.target.value)} />
    </div><button className="button button-small" disabled={busy || !!active || !times.trim()}>{busy?'Submitting…':'Extract real frames'}</button></form>
    {job && <div role="status"><p>Frame extraction: {job.status.replaceAll('_',' ')}.</p><div className="button-row">
      <button type="button" className="button button-small" disabled={busy} onClick={() => void check()}>Check extraction and reload frames</button>
      <Link className="button button-small" href={`/processing?job=${encodeURIComponent(job.id)}`}>Open extraction job</Link>
    </div></div>}
  </section>;
}
