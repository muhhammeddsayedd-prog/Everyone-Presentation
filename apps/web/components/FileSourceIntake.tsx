'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { Role, Spec } from '@eps/domain';
import { ApiError, api } from './api';
import { ErrorNotice } from './Feedback';
import { captureFileSource, documentFileMetadata, FileSourceError, rebaseFileSource, runFileSource, type FileSourceRequest } from './file-source-intake';
import { processingHref } from './processing-view';
import type { SourceAccepted } from './source-intake';

const phaseLabels = { reserving: 'Creating a private upload…', uploading: 'Uploading the original document…', verifying: 'Checking the stored document…',
  submitting: 'Requesting source processing…', accepted: 'Source request recorded.' };
export function FileSourceIntake({ spec, canWrite, uploadPurposes, storageOrigin, manualEditsPending, onPersisted, onDirtyChange, onLockChange }: {
  spec: Spec; canWrite: boolean; uploadPurposes: readonly string[]; storageOrigin?: string; manualEditsPending: boolean;
  onPersisted: (spec: Spec, roles: Role[], cursor: string | null) => void;
  onDirtyChange: (dirty: boolean) => void; onLockChange: (locked: boolean) => void;
}) {
  const inputId = useId(); const helpId = useId(); const input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [pending, setPending] = useState(false);
  const [needsReload, setNeedsReload] = useState(false); const [error, setError] = useState(''); const [status, setStatus] = useState('');
  const [accepted, setAccepted] = useState<SourceAccepted | null>(null);
  const [hasRequest, setHasRequest] = useState(false);
  const request = useRef<FileSourceRequest | null>(null); const active = useRef(false); const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const allowed = canWrite && uploadPurposes.includes('specs') && Boolean(storageOrigin);
  const dirty = Boolean(selected) || pending || busy || needsReload;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => { onLockChange(busy || pending); return () => onLockChange(false); }, [busy, pending, onLockChange]);
  function choose(file: File) {
    if (!allowed || active.current || request.current) return;
    try { documentFileMetadata(file); setSelected(file); setAccepted(null); setStatus('Document selected. Its original bytes will be preserved.'); setError(''); }
    catch (reason) { setError(reason instanceof FileSourceError ? reason.message : 'Choose a supported document.'); setSelected(null); if (input.current) input.current.value = ''; }
  }
  function clearLocal() {
    request.current = null; setHasRequest(false); setSelected(null); setPending(false); setNeedsReload(false); if (input.current) input.current.value = '';
  }
  async function readSaved(signal: AbortSignal) {
    const [saved, roles] = await Promise.all([
      api<Spec>(`/api/v1/workspaces/${encodeURIComponent(spec.workspace_id)}/specs`, { signal }),
      api<Role[]>(`/api/v1/workspaces/${encodeURIComponent(spec.workspace_id)}/roles?limit=25`, { signal }),
    ]);
    if (saved.data.id !== spec.id || saved.data.workspace_id !== spec.workspace_id || !Number.isSafeInteger(saved.data.row_version)
      || saved.data.row_version < spec.row_version || !Array.isArray(roles.data) || roles.data.some(role => role.workspace_id !== spec.workspace_id)) {
      throw new Error('Saved requirements could not be confirmed.');
    }
    if (mounted.current) onPersisted(saved.data, roles.data, roles.page?.next_cursor ?? null);
    return saved.data;
  }
  async function process() {
    if (active.current || !allowed || !selected || manualEditsPending || needsReload) return;
    active.current = true; setBusy(true); setPending(true); setError(''); onLockChange(true);
    const abort = new AbortController(); controller.current = abort;
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(120_000)]);
    try {
      if (!request.current) { setStatus('Checking the original file…'); request.current = await captureFileSource(spec, selected, () => crypto.randomUUID()); setHasRequest(true); }
      const receipt = await runFileSource(request.current, { storageOrigin: storageOrigin!, json: api<unknown>, put: (url, init) => fetch(url, init) }, signal,
        phase => { if (mounted.current) setStatus(phaseLabels[phase]); });
      if (!mounted.current) return;
      setAccepted(receipt); await readSaved(signal);
      if (!mounted.current) return;
      clearLocal(); setStatus('Document source recorded. Saved requirements have been refreshed.');
    } catch (reason) {
      if (!mounted.current) return;
      if (request.current?.accepted) setError('The source was accepted, but its saved details could not be refreshed. Retry to reload the saved details without submitting another request.');
      else if (request.current?.sourceConflict) {
        setPending(false); setNeedsReload(true); setError('The saved requirements changed. Reload them before using this verified file. The original does not need another upload.');
      } else if (reason instanceof FileSourceError && reason.code === 'FILE_INVALID') { clearLocal(); setError(reason.message); }
      else if (reason instanceof ApiError && (reason.status < 500 || reason.code === 'FEATURE_NOT_IMPLEMENTED')) {
        setPending(false); setStatus('File request not accepted.');
        setError(reason.code === 'DOCUMENT_VISION_REQUIRED' ? 'This PDF has no readable text. Paste its brief or use a text-rich PDF.'
          : reason.code === 'FEATURE_NOT_IMPLEMENTED' ? 'Document processing is not available yet. Your selected file is retained.'
            : reason.status === 401 ? 'Sign in again before continuing this file request.'
              : [403, 404].includes(reason.status) ? 'This file is unavailable with your current workspace access.'
                : 'The document could not be accepted. Choose a valid text-rich PDF, DOCX or UTF-8 text file.');
      } else setError(reason instanceof FileSourceError ? reason.message : 'The file request could not be confirmed. Retry this same request to check its saved outcome.');
    } finally { active.current = false; if (mounted.current) setBusy(false); }
  }
  async function reload() {
    if (active.current || manualEditsPending) return;
    active.current = true; setBusy(true); setError('');
    const abort = new AbortController(); controller.current = abort;
    try {
      const saved = await readSaved(AbortSignal.any([abort.signal, AbortSignal.timeout(20_000)])); if (!mounted.current) return;
      if (request.current?.sourceConflict) {
        rebaseFileSource(request.current, saved, () => crypto.randomUUID()); setPending(false); setNeedsReload(false);
        setStatus('Saved requirements reloaded. Choose Process document to use the verified file with this saved version.');
      } else if (request.current?.accepted || request.current?.ready && saved.source_asset_id === request.current.ready.id && saved.processing_job_id) {
        clearLocal(); setStatus('Saved source and requirements loaded.');
      } else setStatus('Saved requirements reloaded. Retry the same file request to confirm its outcome.');
    } catch { if (mounted.current) setError('Saved requirements could not be refreshed. The selected file and previous request are retained.'); }
    finally { active.current = false; if (mounted.current) setBusy(false); }
  }
  function discard() {
    if (active.current) return;
    if (pending && !window.confirm('This request may already be saved. Discard this local request? Any saved original and processing remain in the workspace.')) return;
    clearLocal(); setAccepted(null); setError(''); setStatus('Local file selection discarded. Any saved original remains private.');
  }
  return <div className="source-intake-form source-file-intake">
    <div className="field"><label htmlFor={inputId}>Document source</label><input ref={input} id={inputId} className="file-input" type="file" tabIndex={-1}
      accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
      disabled={!allowed || busy || hasRequest} aria-describedby={helpId} onChange={event => { const file = event.target.files?.[0]; if (file) choose(file); }} />
      <p id={helpId} className="small muted">PDF, DOCX or UTF-8 text · up to 20 MiB. Save legacy .doc as DOCX. Scanned pages need vision processing; review the transcribed wording. If vision processing is unavailable, paste the brief.</p>
      <div className="button-row"><button className="button button-small button-quiet" type="button" disabled={!allowed || busy || hasRequest} onClick={() => input.current?.click()}>Choose document</button>
        {selected && <span className="small" dir="auto">{selected.name}</span>}</div></div>
    {!allowed && <p className="small muted">Document uploads are not available with the current workspace access. Paste text or edit requirements manually.</p>}
    <p className="save-state" role="status" aria-live="polite">{busy ? status || 'Saving file request…' : pending ? 'File request unconfirmed' : status}</p>
    {manualEditsPending && <p className="small muted">Save or resolve the other requirement edits before submitting or reloading a source.</p>}
    {error && <ErrorNotice message={error} />}
    <div className="button-row"><button className="button button-primary" type="button" disabled={!allowed || !selected || busy || manualEditsPending || needsReload} onClick={() => { void process(); }}>{busy ? 'Saving document…' : accepted && pending ? 'Reload accepted document' : pending ? 'Retry this file request' : 'Process document'}</button>
      {(needsReload || pending) && <button className="button button-quiet" type="button" disabled={busy || manualEditsPending} onClick={() => { void reload(); }}>Reload saved requirements</button>}
      {selected && <button className="button button-quiet" type="button" disabled={busy} onClick={discard}>Discard local file selection</button>}</div>
    {selected && <p className="small muted">Discarding the selection does not delete an uploaded original or cancel saved processing.</p>}
    {accepted && <div className="notice" role="status"><p>Source request recorded.</p><Link className="button button-small" href={processingHref({ job: accepted.job_id })}>View accepted processing</Link></div>}
  </div>;
}
