'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CastingRetirement } from '../../../packages/domain/src/review-types';
import { api, ApiError, errorMessage, mutation } from './api';
import { ErrorNotice } from './Feedback';
import { readRetirementChoice, readRetirementUndo, retirementUnavailable } from './retirement-undo';

interface Props {
  workspaceId: string; resourceId: string; label: string; canWrite: boolean; disabled?: boolean;
  onRestored: () => void; onDismiss: () => void; onDirtyChange: (dirty: boolean) => void;
}
export function RetirementUndo(props: Props) { return <RetirementUndoScope key={`${props.workspaceId}:${props.resourceId}`} {...props} />; }
function RetirementUndoScope({ workspaceId, resourceId, label, canWrite, disabled = false, onRestored, onDismiss, onDirtyChange }: Props) {
  const [choice, setChoice] = useState<CastingRetirement | null>(null); const [loading, setLoading] = useState(true); const [fresh, setFresh] = useState(false);
  const [busy, setBusy] = useState(false); const [uncertain, setUncertain] = useState(false); const [error, setError] = useState('');
  const mounted = useRef(false); const read = useRef<AbortController | null>(null); const sequence = useRef(0); const pending = useRef(false); const unresolved = useRef(false);
  const intent = useRef<{ path: string; init: RequestInit; expectedVersion: number } | null>(null);
  const load = useCallback(async () => {
    if (pending.current || unresolved.current) return; const generation = ++sequence.current;
    read.current?.abort(); const controller = new AbortController(); read.current = controller;
    setLoading(true); setFresh(false); setChoice(null); setError('');
    try {
      const result = await api<unknown>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/retirements/${encodeURIComponent(resourceId)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
      const loaded = readRetirementChoice(result.data, workspaceId, resourceId);
      if (mounted.current && generation === sequence.current && !controller.signal.aborted) { setChoice(loaded); setFresh(true); }
    } catch (reason) { if (mounted.current && generation === sequence.current && !controller.signal.aborted) setError(errorMessage(reason)); }
    finally { if (mounted.current && generation === sequence.current && !controller.signal.aborted) setLoading(false); }
  }, [workspaceId, resourceId]);
  useEffect(() => { mounted.current = true; void Promise.resolve().then(load); return () => { mounted.current = false; read.current?.abort(); }; }, [load]);
  useEffect(() => { onDirtyChange(busy || uncertain); return () => onDirtyChange(false); }, [busy, uncertain, onDirtyChange]);
  async function restore() {
    if (pending.current || !choice || !unresolved.current && (!choice.can_undo || !fresh || loading || !canWrite || disabled)) return;
    intent.current ??= { path: `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/retirements/${encodeURIComponent(choice.undo_event_id)}/undo`, init: mutation('POST', { expected_workspace_row_version: choice.expected_workspace_row_version }), expectedVersion: choice.expected_workspace_row_version };
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await api<unknown>(intent.current.path, { ...intent.current.init, signal: AbortSignal.timeout(20000) });
      readRetirementUndo(result.data, intent.current.expectedVersion);
      if (mounted.current) { unresolved.current = false; intent.current = null; setUncertain(false); onRestored(); }
    } catch (reason) {
      if (mounted.current) {
        const unknown = unresolved.current || !(reason instanceof ApiError) || reason.status >= 500 || [408, 429].includes(reason.status);
        unresolved.current = unknown; setUncertain(unknown); setFresh(false);
        if (!unknown) intent.current = null;
        setError(`${unknown ? 'This Undo may have saved. Retry the same request to confirm it. ' : ''}${errorMessage(reason)}`);
      }
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="notice" role="region" aria-label="Restore archived casting choices" aria-busy={loading || busy}>
    <h3>Undo {label}</h3><p>The original shared profiles and media remain. Restoration uses the recorded choices and current revision checks; newer casting changes are preserved.</p>
    {loading && <p role="status">Loading the saved restoration choice…</p>}
    {choice && <><p>{choice.assignment_ids.length} {choice.assignment_ids.length === 1 ? 'assignment' : 'assignments'}, {choice.main_count} Main, {choice.shortlist_count} shortlisted and {choice.slot_ids.length} {choice.slot_ids.length === 1 ? 'slot' : 'slots'} in this recorded removal.</p>
      {!choice.can_undo && <p role="status">{retirementUnavailable(choice.unavailable_reason)}</p>}</>}
    {error && <ErrorNotice message={error} />}
    {uncertain && <p role="status">Other edits stay locked until this same Undo request is acknowledged.</p>}
    <div className="button-row"><button type="button" className="button button-small" disabled={busy || loading || !choice || !uncertain && (!choice.can_undo || !fresh || !canWrite || disabled)} onClick={() => void restore()}>{busy ? 'Restoring…' : uncertain ? 'Retry same Undo' : 'Undo removal'}</button>
      <button type="button" className="button button-quiet button-small" disabled={busy || uncertain || loading} onClick={() => void load()}>Reload restoration choice</button>
      <button type="button" className="button button-quiet button-small" disabled={busy || uncertain} onClick={onDismiss}>Dismiss Undo</button></div>
  </section>;
}
