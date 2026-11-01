'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, errorMessage, mutation } from './api';
import { ErrorNotice } from './Feedback';
import { Modal } from './ui/Overlay';
import { readCastingRetirementPreview, type CastingRetirementPreview, type RetirementScope } from './casting-retirement';

interface Props<T> {
  workspaceId: string; scope: RetirementScope; scopeLabel: string; confirmLabel: string; cancelLabel: string;
  request: { path: string; body: unknown }; onSaved: (data: T) => void; onCancel: () => void;
}

/** One explicit scope confirmation shared by project, role and slot retirement.
 * Mount with a scope/body key so a changed proposal receives a fresh preview. */
export function CastingRetirementReview<T>({ workspaceId, scope, scopeLabel, confirmLabel, cancelLabel, request, onSaved, onCancel }: Props<T>) {
  const [preview, setPreview] = useState<CastingRetirementPreview | null>(null); const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); const [uncertain, setUncertain] = useState(false); const [error, setError] = useState('');
  const alive = useRef(false); const controller = useRef<AbortController | null>(null); const sequence = useRef(0);
  const intent = useRef<{ path: string; init: RequestInit } | null>(null); const pending = useRef(false);
  const signature = JSON.stringify(scope);
  const load = useCallback(async () => {
    const generation = ++sequence.current; controller.current?.abort(); const cancel = new AbortController(); controller.current = cancel;
    setLoading(true); setPreview(null); setError('');
    try {
      const result = await readCastingRetirementPreview(workspaceId, JSON.parse(signature) as RetirementScope,
        AbortSignal.any([cancel.signal, AbortSignal.timeout(30000)]));
      if (alive.current && generation === sequence.current && !cancel.signal.aborted) setPreview(result);
    } catch (reason) { if (alive.current && generation === sequence.current && !cancel.signal.aborted) setError(errorMessage(reason)); }
    finally { if (alive.current && generation === sequence.current && !cancel.signal.aborted) setLoading(false); }
  }, [workspaceId, signature]);
  useEffect(() => { alive.current = true; void Promise.resolve().then(load); return () => { alive.current = false; controller.current?.abort(); }; }, [load]);
  async function confirm() {
    if (!preview || loading || pending.current) return;
    pending.current = true; setSaving(true); setError('');
    intent.current ??= { path: request.path, init: mutation('POST', request.body) };
    try {
      const result = await api<T>(intent.current.path, { ...intent.current.init, signal: AbortSignal.timeout(20000) });
      if (alive.current) onSaved(result.data);
    } catch (reason) {
      if (alive.current) {
        // A later denial does not prove an earlier interrupted attempt failed.
        const unknown = uncertain || !(reason instanceof ApiError) || reason.status >= 500 || [408, 429].includes(reason.status);
        setUncertain(unknown); setError(`${unknown ? 'This removal may have saved. Retry the same request to confirm it. ' : ''}${errorMessage(reason)}`);
      }
    } finally { pending.current = false; if (alive.current) setSaving(false); }
  }
  const busy = saving || uncertain;
  return <Modal inline wide title="Review affected casting choices" description={`Confirmation archives ${scopeLabel} from Selection and Shortlist, including their Main, Backup or Option choices and assignment notes.`} onClose={onCancel} busy={busy}>
    <section className="retirement-review" aria-label="Review casting removal" aria-busy={loading || saving}>
      <p className="small soft">The list below shows current choices. Confirmation applies to all active choices in this scope, including choices added after this preview.</p>
      <p className="small soft">Shared profiles, introductions and saved presentation versions remain. Archived assignment notes and history are retained.</p>
      {loading && <p role="status">Loading current casting choices…</p>}
      {error && <ErrorNotice message={error} retry={!preview && !loading ? () => void load() : undefined} />}
      {preview && <><p role="status" className="retirement-summary">Currently shown: {preview.choices.length} casting {preview.choices.length === 1 ? 'assignment' : 'assignments'}, {preview.choices.filter(row => row.position === 'main').length} Main, {preview.choices.filter(row => row.shortlisted).length} shortlisted.</p>
        {preview.choices.length > 0 ? <ul className="retirement-list">{preview.choices.map(row => <li key={row.assignment_id}><span className={`position-chip position-${row.position}`}>{row.position === 'main' ? 'Main' : row.position === 'backup' ? 'Backup' : 'Option'}</span><span><span dir="auto">{row.role} / {row.slot}</span><span className="small muted"> · Candidate record <span dir="auto">{row.candidate_id}</span>{row.shortlisted ? ' · in Shortlist' : ''}{row.has_presentation_notes || row.has_internal_notes ? ' · assignment notes retained in history' : ''}</span></span></li>)}</ul> : <p>No active casting assignments were returned for this scope.</p>}</>}
      {uncertain && <p role="status">The result is unconfirmed. Keep this request open and retry it before making another removal.</p>}
      <div className="button-row button-row-end modal-actions"><button type="button" className="button" disabled={saving || uncertain} onClick={onCancel}>{cancelLabel}</button><button type="button" className="button button-danger" disabled={!preview || loading || saving} onClick={() => void confirm()}>{saving ? 'Saving removal…' : uncertain ? 'Retry same removal' : confirmLabel}</button></div>
    </section>
  </Modal>;
}
