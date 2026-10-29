'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role, Spec } from '@eps/domain';
import { api } from './api';
import { ErrorNotice } from './Feedback';
import { processingHref } from './processing-view';
import { readSourceAccepted, retainSourceIntent, sourceFailure, type SourceAccepted, type SourceIntent } from './source-intake';
import { FileSourceIntake } from './FileSourceIntake';

export function SourceIntake({ spec, canWrite, uploadPurposes = [], storageOrigin, manualEditsPending, onPersisted, onDirtyChange, onLockChange }: {
  spec: Spec; canWrite: boolean; uploadPurposes?: readonly string[]; storageOrigin?: string; manualEditsPending: boolean;
  onPersisted: (spec: Spec, roles: Role[], cursor: string | null) => void;
  onDirtyChange: (id: string, dirty: boolean) => void; onLockChange: (locked: boolean) => void;
}) {
  const [text, setText] = useState(spec.source_text ?? ''); const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false); const [needsReload, setNeedsReload] = useState(false);
  const [error, setError] = useState(''); const [note, setNote] = useState('');
  const [accepted, setAccepted] = useState<SourceAccepted | null>(null);
  const [mode, setMode] = useState<'text' | 'file'>('text');
  const [fileDirty, setFileDirty] = useState(false); const [fileLocked, setFileLocked] = useState(false);
  const fileDirtyChanged = useCallback((value: boolean) => setFileDirty(value), []);
  const fileLockChanged = useCallback((value: boolean) => setFileLocked(value), []);
  const intent = useRef<SourceIntent | null>(null); const confirmed = useRef<SourceAccepted | null>(null);
  const active = useRef(false); const mounted = useRef(true); const controller = useRef<AbortController | null>(null);
  const fileAllowed = canWrite && uploadPurposes.includes('specs') && Boolean(storageOrigin);
  const dirty = text !== (spec.source_text ?? '') || pending || busy || needsReload || fileDirty;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { onDirtyChange('spec-source', dirty); return () => onDirtyChange('spec-source', false); }, [dirty, onDirtyChange]);
  useEffect(() => { onLockChange(busy || pending || fileLocked); return () => onLockChange(false); }, [busy, pending, fileLocked, onLockChange]);
  function chooseMode(next: 'text' | 'file') {
    if (next === mode || busy || pending || fileLocked || next === 'file' && !fileAllowed) return;
    if ((fileDirty || text !== (spec.source_text ?? '') || needsReload)
      && !window.confirm('Switch source input and discard the local selection or pasted edits? Any saved source and processing remain in the workspace.')) return;
    setText(spec.source_text ?? ''); setNeedsReload(false); intent.current = null; confirmed.current = null;
    setAccepted(null); setError(''); setNote(''); setMode(next);
  }
  async function readSaved(signal: AbortSignal, preserveText: boolean) {
    const [saved, rolePage] = await Promise.all([
      api<Spec>(`/api/v1/workspaces/${encodeURIComponent(spec.workspace_id)}/specs`, { signal }),
      api<Role[]>(`/api/v1/workspaces/${encodeURIComponent(spec.workspace_id)}/roles?limit=25`, { signal }),
    ]);
    if (saved.data.id !== spec.id || saved.data.workspace_id !== spec.workspace_id || !Number.isSafeInteger(saved.data.row_version)
      || saved.data.row_version < spec.row_version || !Array.isArray(rolePage.data) || rolePage.data.some(role => role.workspace_id !== spec.workspace_id)) {
      throw new Error('Saved requirements could not be confirmed.');
    }
    if (!mounted.current) return;
    onPersisted(saved.data, rolePage.data, rolePage.page?.next_cursor ?? null);
    if (!preserveText) setText(saved.data.source_text ?? '');
  }
  async function submit() {
    if (active.current || !canWrite || manualEditsPending || needsReload) return;
    let request: SourceIntent;
    try { request = retainSourceIntent(intent.current, spec, text, () => crypto.randomUUID()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Provide readable source text.'); return; }
    if (!intent.current) { confirmed.current = null; setAccepted(null); }
    intent.current = request; active.current = true; setPending(true); setBusy(true); onLockChange(true); setError(''); setNote('');
    const abort = new AbortController(); controller.current = abort;
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(20_000)]);
    try {
      if (!confirmed.current) {
        const response = await api<unknown>(`/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/specs`, {
          method: 'POST', body: request.serialized, headers: { 'Idempotency-Key': request.key }, signal,
        });
        confirmed.current = readSourceAccepted(response.data, request.specId);
        if (!mounted.current) return;
        setAccepted(confirmed.current);
      }
      await readSaved(signal, false);
      if (!mounted.current) return;
      intent.current = null; confirmed.current = null; setPending(false);
      setNote('Source request recorded. Saved source and requirements have been refreshed.');
    } catch (reason) {
      if (!mounted.current) return;
      if (confirmed.current) setError('The source request was accepted, but its saved details could not be refreshed. Reload the accepted source before editing.');
      else {
        const failure = sourceFailure(reason); setError(failure.message);
        if (failure.kind !== 'unknown') { intent.current = null; setPending(false); }
        if (failure.kind === 'stale') setNeedsReload(true);
      }
    } finally { active.current = false; if (mounted.current) setBusy(false); }
  }
  async function reloadSaved() {
    if (active.current || manualEditsPending) return;
    active.current = true; setBusy(true); onLockChange(true); setError('');
    const abort = new AbortController(); controller.current = abort;
    try {
      await readSaved(AbortSignal.any([abort.signal, AbortSignal.timeout(20_000)]), true);
      if (!mounted.current) return;
      intent.current = null; confirmed.current = null; setPending(false); setNeedsReload(false); setAccepted(null);
      setNote('Saved requirements reloaded. Your pasted text is retained; check it before submitting again.');
    } catch { if (mounted.current) setError('Saved requirements could not be refreshed. Your pasted text and previous request are retained.'); }
    finally { active.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="editor-section"><div className="section-heading"><div><h2>Source brief</h2><p>{canWrite ? 'Supply the brief to request requirements extraction. You can also enter requirements manually below.' : 'Read the original brief and saved requirements.'}</p></div></div>
    {spec.source_text !== null ? <details className="source-brief"><summary>Read the saved source</summary><pre dir="auto">{spec.source_text}</pre></details>
      : <p className="small muted">{spec.source_asset_id ? 'A source document is recorded.' : 'No source brief supplied.'}</p>}
    {spec.processing_job_id && <Link className="small" href={processingHref({ job: spec.processing_job_id })}>View source processing</Link>}
    {fileAllowed ? <div className="button-row" role="group" aria-label="Source input"><button className="button button-small button-quiet" type="button" aria-pressed={mode === 'text'} disabled={busy || pending || fileLocked} onClick={() => chooseMode('text')}>Paste text</button><button className="button button-small button-quiet" type="button" aria-pressed={mode === 'file'} disabled={busy || pending || fileLocked} onClick={() => chooseMode('file')}>Upload PDF, DOCX or text</button></div>
      : <div className="button-row"><button className="button button-small button-quiet" disabled>Upload PDF or Word</button><p className="small muted">File uploads are not available yet.{canWrite ? ' Paste the brief or edit requirements manually.' : ''}</p></div>}
    {mode === 'file' ? <FileSourceIntake spec={spec} canWrite={canWrite} uploadPurposes={uploadPurposes} storageOrigin={storageOrigin} manualEditsPending={manualEditsPending}
      onDirtyChange={fileDirtyChanged} onLockChange={fileLockChanged} onPersisted={(saved, roles, cursor) => { setText(saved.source_text ?? ''); onPersisted(saved, roles, cursor); }} /> : canWrite ? <form className="source-intake-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <div className="field"><label htmlFor="source-pasted-text">Pasted source text</label><textarea id="source-pasted-text" rows={7} dir="auto" value={text} readOnly={busy || pending} aria-describedby="source-text-help" onChange={event => { setText(event.target.value); setAccepted(null); setNote(''); setError(''); }} />
        <p id="source-text-help" className="small muted">The supplied wording is preserved. Correcting the source does not discard your manual requirements.</p></div>
      <p className="save-state" role="status" aria-live="polite">{busy ? 'Saving source request…' : pending ? 'Source request unconfirmed' : needsReload ? 'Reload required' : note}</p>
      {manualEditsPending && <p className="small muted">Save or resolve the other requirement edits before submitting or reloading a source.</p>}
      {error && <ErrorNotice message={error} />}
      <div className="button-row"><button className="button button-primary" type="submit" disabled={busy || manualEditsPending || needsReload || !text.trim()}>{busy ? 'Submitting…' : pending ? accepted ? 'Reload accepted source' : 'Retry this source request' : 'Process pasted text'}</button>
        {(needsReload || pending && !busy && !accepted) && <button className="button button-quiet" type="button" disabled={busy || manualEditsPending} onClick={() => { void reloadSaved(); }}>Reload saved source</button>}</div>
    </form> : <p className="small muted">You can read this source. Editing and submission require workspace write access.</p>}
    {mode === 'text' && accepted && <div className="notice" role="status"><div><p>Source request recorded.</p><p className="small muted">Open processing for the latest saved status.</p></div><Link className="button button-small" href={processingHref({ job: accepted.job_id })}>View accepted processing</Link></div>}
  </section>;
}
