'use client';
import { Icon } from './Icon';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ResizeSlots, Role, Slot } from '@eps/domain';
import { api, ApiError, errorMessage } from './api';
import { ErrorNotice } from './Feedback';
import { buildResizeRequest, readSlotPage, retainSlotIntent, type SlotIntent } from './role-slots-form';
import { CastingRetirementReview } from './CastingRetirementReview';

interface Props {
  role: Role;
  canWrite: boolean;
  onRoleSaved: (role: Role) => void;
  onWorkspaceChanged: () => void;
  onDirtyChange: (id: string, dirty: boolean) => void;
  onRetired?: (resourceId: string, label: string) => void;
}
type SaveState = 'idle' | 'saving' | 'saved' | 'failed';
interface PageState { slots: Slot[]; nextCursor: string | null; loaded: boolean; loading: boolean; stale: boolean; error: string }
interface CountReview { text: string; selected: string[]; rowVersion: number; headcount: number | null }

/** A new role/workspace unmounts the previous editor and its pending responses. */
export function RoleSlots(props: Props) {
  return <RoleSlotsDisclosure key={`${props.role.workspace_id}:${props.role.id}`} {...props} />;
}

function RoleSlotsDisclosure(props: Props) {
  const [opened, setOpened] = useState(false);
  return <details className="role-slots-disclosure" data-role-id={props.role.id} onToggle={event => {
    if (event.currentTarget.open) setOpened(true);
  }}><summary>Individual slots</summary>{opened && <RoleSlotsEditor {...props} />}</details>;
}

function RoleSlotsEditor({ role, canWrite, onRoleSaved, onWorkspaceChanged, onDirtyChange, onRetired }: Props) {
  const countId = useId();
  const helpId = useId();
  const [page, setPage] = useState<PageState>({ slots: [], nextCursor: null, loaded: false, loading: true, stale: true, error: '' });
  const pageRef = useRef(page);
  const [review, setReview] = useState<CountReview | null>(null);
  const [countState, setCountState] = useState<SaveState>('idle');
  const [countError, setCountError] = useState('');
  const [retirementInput, setRetirementInput] = useState<ResizeSlots | null>(null);
  const [dirtyLabels, setDirtyLabels] = useState<string[]>([]);
  const alive = useRef(true);
  const currentRole = useRef(role);
  const loading = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const countRequest = useRef<AbortController | null>(null);
  const countPending = useRef(false);
  const intent = useRef<SlotIntent<ResizeSlots> | null>(null);
  useEffect(() => { currentRole.current = role; }, [role]);
  const commitPage = useCallback((next: PageState) => { pageRef.current = next; setPage(next); }, []);
  const loadPage = useCallback(async (cursor: string | null, replace: boolean, initial = false) => {
    const request = ++sequence.current;
    loading.current?.abort();
    const controller = new AbortController(); loading.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    if (!initial) commitPage({ ...pageRef.current, loading: true, stale: replace || pageRef.current.stale, error: '' });
    try {
      const result = await api<Slot[]>(`/api/v1/roles/${encodeURIComponent(role.id)}/slots?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal: controller.signal });
      if (!alive.current || request !== sequence.current) return;
      const next = readSlotPage(role.id, result, replace ? [] : pageRef.current.slots, cursor);
      commitPage({ ...next, loaded: true, loading: false, stale: false, error: '' });
    } catch (error) {
      if (alive.current && request === sequence.current) commitPage({ ...pageRef.current, loading: false,
        error: controller.signal.aborted ? 'Loading slots timed out. Try again.' : errorMessage(error) });
    } finally { clearTimeout(timeout); }
  }, [role.id, commitPage]);
  useEffect(() => {
    alive.current = true;
    void loadPage(null, true, true);
    return () => { alive.current = false; loading.current?.abort(); countRequest.current?.abort(); };
  }, [loadPage]);
  const dirtyId = `${role.id}:slots`;
  useEffect(() => {
    onDirtyChange(dirtyId, review !== null || countState === 'saving');
    return () => onDirtyChange(dirtyId, false);
  }, [dirtyId, review, countState, onDirtyChange]);
  const labelDirtyChanged = useCallback((id: string, dirty: boolean) => {
    setDirtyLabels(current => dirty ? current.includes(id) ? current : [...current, id] : current.filter(value => value !== id));
    onDirtyChange(id, dirty);
  }, [onDirtyChange]);
  const labelSaved = useCallback((slot: Slot) => {
    if (!alive.current) return;
    commitPage({ ...pageRef.current, slots: pageRef.current.slots.map(current => current.id === slot.id && current.row_version <= slot.row_version ? slot : current) });
    onWorkspaceChanged();
  }, [commitPage, onWorkspaceChanged]);

  const text = review?.text ?? String(role.headcount ?? 1);
  const selected = review?.selected ?? [];
  const baseline = review ? review.headcount : role.headcount;
  const excess = /^[1-9][0-9]*$/u.test(text) && Number.isSafeInteger(Number(text)) ? Math.max(0, (baseline ?? 1) - Number(text)) : 0;
  const complete = page.loaded && !page.stale && page.nextCursor === null;
  let body: ResizeSlots | null = null;
  let reviewMessage = '';
  try { body = buildResizeRequest({ ...role, headcount: baseline, row_version: review?.rowVersion ?? role.row_version }, text, selected, page.slots, complete); }
  catch (error) { reviewMessage = errorMessage(error); }
  const changed = baseline === null || Number(text) !== baseline;
  const countDisabled = !canWrite || countState === 'saving' || retirementInput !== null || page.loading || page.stale || dirtyLabels.length > 0 || !body || !changed;
  function editCount(value: string) {
    setReview(current => ({ text: value, selected: [], rowVersion: current?.rowVersion ?? role.row_version, headcount: current ? current.headcount : role.headcount }));
    setCountState('idle'); setCountError('');
  }
  function chooseSlot(slotId: string, checked: boolean) {
    setReview(current => ({ text, rowVersion: current?.rowVersion ?? role.row_version, headcount: current ? current.headcount : role.headcount,
      selected: checked ? [...(current?.selected ?? []), slotId] : (current?.selected ?? []).filter(id => id !== slotId) }));
    setCountState('idle'); setCountError('');
  }
  function resetCount() { setReview(null); setCountState('idle'); setCountError(''); intent.current = null; }
  function countSaved(data: Role, submitted: ResizeSlots) {
    if (!data || typeof data !== 'object' || data.id !== role.id || data.workspace_id !== role.workspace_id || data.headcount !== submitted.desired_count
      || !Number.isSafeInteger(data.row_version) || data.row_version <= submitted.row_version || data.archived !== false) {
      throw new Error('The saved count response could not be verified. Retry the same change to confirm it.');
    }
    if (data.row_version < currentRole.current.row_version) throw new Error('This count was saved earlier, but the role changed again. Reset the count review to the latest saved details.');
    setReview(null); setRetirementInput(null); intent.current = null; setCountState('saved');
    onRoleSaved(data); if (submitted.retire_slot_ids?.length) onRetired?.(role.id, 'slot reduction'); onWorkspaceChanged(); void loadPage(null, true);
  }
  async function saveCount() {
    if (countDisabled || !body || countPending.current) return;
    if (excess > 0) { setRetirementInput(structuredClone(body)); return; }
    countPending.current = true;
    const submitted = retainSlotIntent(intent.current, body, () => crypto.randomUUID()); intent.current = submitted;
    const controller = new AbortController(); countRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    setCountState('saving'); setCountError('');
    try {
      const result = await api<Role>(`/api/v1/roles/${encodeURIComponent(role.id)}/slots/resize`, {
        method: 'POST', signal: controller.signal, headers: { 'Idempotency-Key': submitted.key }, body: JSON.stringify(submitted.body),
      });
      if (!alive.current) return;
      countSaved(result.data, submitted.body);
    } catch (error) {
      if (alive.current) {
        setCountState('failed');
        setCountError(error instanceof ApiError && error.code === 'ASSIGNMENT_RETIREMENT_UNAVAILABLE'
          ? 'Assignment records are present. Slot retirement is unavailable until assignment handling is connected.'
          : controller.signal.aborted ? 'The request timed out. Retry this same change to confirm the saved result.' : errorMessage(error));
      }
    } finally { clearTimeout(timeout); countPending.current = false; if (countRequest.current === controller) countRequest.current = null; }
  }

  return <section aria-label={`Slots for ${role.name || 'unnamed role'}`} className="role-slots" data-role-id={role.id}>
    <fieldset className="presentation-read-lock" disabled={retirementInput !== null}>
    <div className="section-heading"><div><h4>Individual slots</h4><p className="small muted">{role.headcount === null ? 'Count not provided. One provisional slot keeps this role open.' : `${role.headcount} required ${role.headcount === 1 ? 'person' : 'people'}.`}</p></div>
      <span className="save-state" role="status" aria-live="polite">{countState === 'saving' ? 'Saving count…' : countState === 'failed' ? 'Count save failed' : review ? 'Unsaved count review' : countState === 'saved' ? 'Count saved' : role.headcount === null ? 'Count not provided' : 'Count up to date'}</span></div>
    {role.headcount === null && <span className="badge">Needs clarification · provisional slot</span>}
    <div className="form-grid"><div className="field"><label htmlFor={countId}>Required people</label><div className="stepper headcount-stepper">
      <button type="button" aria-label="Decrease required people" disabled={!canWrite || countState === 'saving' || !page.loaded || page.stale || (Number.parseInt(text, 10) || 0) <= 1} onClick={() => editCount(String(Math.max(1, (Number.parseInt(text, 10) || 1) - 1)))}><Icon name="minus" /></button>
      <input id={countId} inputMode="numeric" pattern="[0-9]*" value={text}
      disabled={!canWrite || countState === 'saving' || !page.loaded || page.stale} aria-describedby={helpId} aria-invalid={Boolean(review && reviewMessage && excess === 0)}
      onChange={event => editCount(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void saveCount(); } if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); editCount(String(Math.max(1, (Number.parseInt(text, 10) || 0) + (event.key === 'ArrowUp' ? 1 : -1)))); } }} />
      <button type="button" aria-label="Increase required people" disabled={!canWrite || countState === 'saving' || !page.loaded || page.stale} onClick={() => editCount(String((Number.parseInt(text, 10) || 0) + 1))}><Icon name="plus" /></button></div>
      <p id={helpId} className="small muted">Enter a whole number above zero. Confirming a count keeps existing slot identities and labels.</p></div></div>
    {excess > 0 && <fieldset className="notice" disabled={!canWrite || countState === 'saving' || !complete || page.loading}>
      <legend>Choose slots to archive</legend><p>Choose exactly {excess} {excess === 1 ? 'slot' : 'slots'} for this reduction. Remaining slots keep their labels and order.</p>
      {!complete && <p className="small">Load all slots before reviewing the reduction.</p>}
      {complete && page.slots.map(slot => <label className="field" key={slot.id}><input type="checkbox" checked={selected.includes(slot.id)} onChange={event => chooseSlot(slot.id, event.target.checked)} />{slot.label || 'Unnamed slot'}</label>)}
      <p role="status" aria-live="polite">{selected.length} of {excess} selected</p>
    </fieldset>}
    {review && reviewMessage && <p className="field-error">{reviewMessage}</p>}
    {dirtyLabels.length > 0 && <p className="small muted">Save or discard pending label edits before changing the count.</p>}
    <div className="button-row"><button type="button" className="button button-small" disabled={countDisabled} onClick={() => void saveCount()}>{countState === 'saving' ? 'Saving…' : excess > 0 ? 'Review slot reduction' : role.headcount === null ? 'Confirm required count' : 'Update required count'}</button>
      {review && <button type="button" className="button button-quiet button-small" disabled={countState === 'saving'} onClick={resetCount}>Reset count review</button>}</div>
    {countError && <ErrorNotice message={`The count change could not be confirmed. ${countError}`} retry={!countDisabled ? () => void saveCount() : undefined} />}
    {page.loading && <p role="status" aria-live="polite">Loading slots…</p>}
    {page.stale && page.loaded && !page.loading && <p className="notice">These are the last loaded slots. Reload saved slots before editing.</p>}
    {page.error && <ErrorNotice message={page.error} retry={() => void loadPage(page.stale ? null : page.nextCursor, page.stale)} />}
    <div className="slot-labels">{page.slots.map(slot => <SlotLabelEditor key={slot.id} slot={slot} canWrite={canWrite && countState !== 'saving' && !page.stale}
      onSaved={labelSaved} onDirtyChange={labelDirtyChanged} />)}</div>
    {page.loaded && page.slots.length === 0 && !page.stale && <p className="notice" role="status">No active slots were returned. Reload the saved role before changing its count.</p>}
    <div className="button-row">{page.nextCursor !== null && <button type="button" className="button button-small" disabled={page.loading || page.stale} onClick={() => void loadPage(page.nextCursor, false)}>Load more slots (up to 100)</button>}
      <button type="button" className="button button-quiet button-small" disabled={page.loading || countState === 'saving' || dirtyLabels.length > 0 || review !== null} onClick={() => void loadPage(null, true)}>Reload saved slots</button></div>
    {!canWrite && <p className="small muted">Slot changes require a saved role and workspace write access.</p>}
    </fieldset>
    {retirementInput && <CastingRetirementReview<Role> key={JSON.stringify(retirementInput)} workspaceId={role.workspace_id}
      scope={{ kind: 'slots', id: role.id, row_version: retirementInput.row_version, slot_ids: retirementInput.retire_slot_ids ?? [] }}
      scopeLabel="the selected slots and all their casting assignments" confirmLabel="Confirm archive selected slots" cancelLabel="Keep selected slots"
      request={{ path: `/api/v1/roles/${encodeURIComponent(role.id)}/slots/resize`, body: retirementInput }}
      onSaved={data => countSaved(data, retirementInput)} onCancel={() => setRetirementInput(null)} />}
  </section>;
}

function SlotLabelEditor({ slot, canWrite, onSaved, onDirtyChange }: { slot: Slot; canWrite: boolean; onSaved: (slot: Slot) => void; onDirtyChange: Props['onDirtyChange'] }) {
  const inputId = useId();
  const [edit, setEdit] = useState<{ label: string; rowVersion: number } | null>(null);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState('');
  const alive = useRef(true); const pending = useRef(false); const controller = useRef<AbortController | null>(null);
  const currentSlot = useRef(slot);
  const intent = useRef<SlotIntent<{ row_version: number; label: string }> | null>(null);
  useEffect(() => { currentSlot.current = slot; }, [slot]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  const dirtyId = `${slot.id}:label`;
  useEffect(() => { onDirtyChange(dirtyId, edit !== null || state === 'saving'); return () => onDirtyChange(dirtyId, false); }, [dirtyId, edit, state, onDirtyChange]);
  async function save() {
    if (!canWrite || !edit || pending.current) return;
    pending.current = true;
    const submitted = retainSlotIntent(intent.current, { row_version: edit.rowVersion, label: edit.label }, () => crypto.randomUUID()); intent.current = submitted;
    const request = new AbortController(); controller.current = request; setState('saving'); setError('');
    const timeout = setTimeout(() => request.abort(), 20_000);
    try {
      const result = await api<Slot>(`/api/v1/slots/${encodeURIComponent(slot.id)}`, { method: 'PATCH', signal: request.signal,
        headers: { 'Idempotency-Key': submitted.key }, body: JSON.stringify(submitted.body) });
      if (!alive.current) return;
      const saved = readSlotPage(slot.role_id, { data: [result.data], page: { next_cursor: null } }, [], null).slots[0];
      if (saved.id !== slot.id || saved.label !== submitted.body.label || saved.row_version <= submitted.body.row_version) throw new Error('The saved label response could not be verified. Retry the same label to confirm it.');
      if (saved.row_version < currentSlot.current.row_version) throw new Error('This slot changed again after the save. Discard this edit and reload saved slots before trying again.');
      onSaved(saved);
      setEdit(current => current?.label === submitted.body.label ? null : current ? { ...current, rowVersion: saved.row_version } : null);
      intent.current = null; setState('saved');
    } catch (reason) { if (alive.current) { setError(request.signal.aborted ? 'The request timed out. Retry this same label to confirm the saved result.' : errorMessage(reason)); setState('failed'); } }
    finally { clearTimeout(timeout); pending.current = false; if (controller.current === request) controller.current = null; }
  }
  return <div className="field slot-label-editor" data-slot-id={slot.id}><label htmlFor={inputId}>Label for {slot.label || 'unnamed slot'}</label><input id={inputId} value={edit?.label ?? slot.label} disabled={!canWrite}
    onChange={event => { const label = event.target.value; setEdit(current => label === slot.label && !pending.current ? null : { label, rowVersion: current?.rowVersion ?? slot.row_version }); if (!pending.current) setState('idle'); setError(''); }}
    onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save(); } }} />
    <div className="button-row"><button type="button" className="button button-small" disabled={!canWrite || !edit || state === 'saving'} onClick={() => void save()}>Save label</button>
      {edit && <button type="button" className="button button-quiet button-small" disabled={state === 'saving'} onClick={() => { setEdit(null); setError(''); setState('idle'); intent.current = null; }}>Discard label edit</button>}
      <span className="save-state" role="status" aria-live="polite">{state === 'saving' ? 'Saving label…' : state === 'failed' ? 'Label save failed' : edit ? 'Unsaved label' : state === 'saved' ? 'Label saved' : 'Label up to date'}</span></div>
    {error && <ErrorNotice message={`The label save could not be confirmed. ${error}`} retry={canWrite && state !== 'saving' ? () => void save() : undefined} />}
  </div>;
}
