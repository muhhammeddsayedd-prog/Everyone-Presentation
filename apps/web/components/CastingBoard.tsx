'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import type { Candidate, WorkspaceCandidate } from '../../../packages/domain/src/candidate-types.ts';
import type { Role, Slot } from '../../../packages/domain/src/specs-types.ts';
import type { Assignment, CastingOutput, MainUndo, SetSlotMainResult } from '../../../packages/domain/src/casting-types.ts';
import { api, ApiError, errorMessage, mutation, type Actor, type Envelope, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { CandidateFrameImage } from './CandidateFrameImage';
import { useRouter } from 'next/navigation';
import { Icon } from './Icon';
import { ActionMenu, type MenuItem } from './ui/Menu';
import { Drawer } from './ui/Overlay';
import { useConfirm } from './ui/Confirm';
import { useToast } from './ui/Toast';
import { SegmentIndicator } from './motion/SegmentIndicator';
import { AnimatedNumber } from './motion/AnimatedNumber';

interface Props {
  workspaceId: string; projectId: string; actor: Actor; initialOutput?: CastingOutput;
  onDirtyChange: (dirty: boolean) => void; onWorkspaceChanged: () => void;
}
interface BoardData { workspace: Workspace; roles: Role[]; slots: Slot[]; pool: WorkspaceCandidate[]; assignments: Assignment[] }
interface UndoChoice { payload: MainUndo; revisions: Record<string, number> }
type OrderKind = 'role' | 'slot' | 'assignment';
interface DragChoice { kind: OrderKind; id: string; scope?: string; rowVersion: number; draftRevision: number }
interface Write { label: string; run: () => Promise<void>; focus?: string }
const encode = encodeURIComponent;
const ordered = <T extends { id: string; sort_order: number }>(items: readonly T[]) => [...items].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
function name(candidate: Candidate | undefined, id: string) { return candidate?.facts.name || candidate?.facts.casting_id || `Candidate record ${id}`; }
function message(reason: unknown): string {
  if (reason instanceof ApiError && ['MAIN_UNDO_INVALID', 'MAIN_UNDO_ALREADY_USED'].includes(reason.code)) return 'This Main change can no longer be undone. Reload the current choices.';
  if (reason instanceof ApiError && reason.code === 'MAIN_OPERATION_REQUIRED') return 'Clear the Main to Backup before changing it to Option.';
  return errorMessage(reason);
}
async function pages<T extends { id: string }>(path: string, signal: AbortSignal): Promise<T[]> {
  const result: T[] = []; const seen = new Set<string>(); const cursors = new Set<string>(); let cursor: string | null = null;
  for (let page = 0; page < 100; page++) {
    const query: string = `${path}${path.includes('?') ? '&' : '?'}limit=100${cursor ? `&cursor=${encode(cursor)}` : ''}`;
    const response: Envelope<T[]> = await api<T[]>(query, { signal });
    if (!Array.isArray(response.data) || response.data.some(row => !row || seen.has(row.id))) throw new Error('The saved board changed while loading. Reload it.');
    for (const row of response.data) { seen.add(row.id); result.push(row); }
    cursor = response.page?.next_cursor ?? null; if (cursor === null) return result;
    if (!cursor || cursors.has(cursor)) throw new Error('The saved board could not be paged safely. Reload it.'); cursors.add(cursor);
  }
  throw new Error('This board is too large to open at once. Its saved data has been kept.');
}

/** Scope changes remount the editor, preventing late reads/writes from another project or actor. */
export function CastingBoard(props: Props) { return <CastingBoardScope key={`${props.actor.id}:${props.workspaceId}`} {...props} />; }
function CastingBoardScope({ workspaceId, projectId, actor, initialOutput = 'selection', onDirtyChange, onWorkspaceChanged }: Props) {
  const [data, setData] = useState<BoardData | null>(null); const [profiles, setProfiles] = useState<Record<string, Candidate>>({});
  const [previewOutput, setPreviewOutput] = useState<CastingOutput | null>(null); const [selectedRole, setSelectedRole] = useState(''); const [view, setView] = useState<'all' | 'one'>('all');
  const output = previewOutput ?? data?.workspace.active_output ?? initialOutput;
  const [loading, setLoading] = useState(true); const [fresh, setFresh] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [status, setStatus] = useState(''); const [profileWarning, setProfileWarning] = useState(false);
  const [uncertain, setUncertain] = useState(false); const [editing, setEditing] = useState<string | null>(null); const [notesDirty, setNotesDirty] = useState(false);
  const [picks, setPicks] = useState<Record<string, string>>({}); const [undos, setUndos] = useState<Record<string, UndoChoice>>({});
  const confirm = useConfirm(); const toast = useToast(); const router = useRouter(); const undoRef = useRef<((slotId: string) => void) | null>(null);
  const mounted = useRef(false); const read = useRef<{ controller: AbortController; sequence: number } | null>(null);
  const dragging = useRef<DragChoice | null>(null);
  const write = useRef<Write | null>(null); const writeBusy = useRef(false); const intents = useRef(new Map<string, { signature: string; init: RequestInit }>());
  const focusAfter = useRef<string | null>(null); const headings = useRef(new Map<string, HTMLElement>());
  const register = useCallback((id: string, node: HTMLElement | null) => { if (node) headings.current.set(id, node); else headings.current.delete(id); }, []);
  const canWrite = actor.capabilities?.includes('workspaces.write') === true; const canReadLibrary = actor.capabilities?.includes('cast.read') === true;
  const dirty = notesDirty || busy || uncertain;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; read.current?.controller.abort(); }; }, []);
  useEffect(() => { if (!loading && data && focusAfter.current) { headings.current.get(focusAfter.current)?.focus(); focusAfter.current = null; } }, [data, loading]);

  const load = useCallback(async () => {
    read.current?.controller.abort(); const request = { controller: new AbortController(), sequence: (read.current?.sequence ?? 0) + 1 }; read.current = request;
    const current = () => mounted.current && read.current === request && !request.controller.signal.aborted;
    setLoading(true); setFresh(false);
    try {
      const base = `/api/v1/workspaces/${encode(workspaceId)}`; const deadline = AbortSignal.timeout(30000);
      const signal = AbortSignal.any([request.controller.signal, deadline]);
      const before = await api<Workspace>(base, { signal });
      const [roles, pool, assignments] = await Promise.all([pages<Role>(`${base}/roles`, signal),
        pages<WorkspaceCandidate>(`${base}/candidates`, signal), pages<Assignment>(`${base}/assignments?output_type=selection`, signal)]);
      if (before.data.id !== workspaceId || before.data.project_id !== projectId) throw new Error('This casting workspace does not belong to the requested project.');
      const slots: Slot[] = [];
      for (let index = 0; index < roles.length; index += 4) slots.push(...(await Promise.all(roles.slice(index, index + 4).map(role => pages<Slot>(`/api/v1/roles/${encode(role.id)}/slots`, signal)))).flat());
      const after = await api<Workspace>(base, { signal });
      if (after.data.id !== workspaceId || after.data.project_id !== projectId || before.data.draft_revision !== after.data.draft_revision
        || roles.some(role => role.workspace_id !== workspaceId || role.archived) || pool.some(row => row.workspace_id !== workspaceId)
        || slots.some(slot => slot.archived || !roles.some(role => role.id === slot.role_id))
        || assignments.some(row => row.archived || row.workspace_id !== workspaceId || !slots.some(slot => slot.id === row.slot_id) || !pool.some(item => item.id === row.workspace_candidate_id))) throw new Error('The workspace changed while loading. Reload the saved board.');
      if (!current()) return;
      setData({ workspace: after.data, roles: ordered(roles), slots, pool, assignments }); setFresh(true); setError(''); setLoading(false);
      const poolIds = new Set(pool.map(item => item.candidate_id));
      setProfiles(old => canReadLibrary ? Object.fromEntries(Object.entries(old).filter(([id]) => poolIds.has(id))) : {});
      setSelectedRole(value => roles.some(role => role.id === value) ? value : ordered(roles)[0]?.id ?? '');
      setUndos(values => Object.fromEntries(Object.entries(values).filter(([, item]) => slots.some(slot => slot.id === item.payload.slot_id && slot.row_version === item.payload.expected_slot_row_version)
        && Object.entries(item.revisions).every(([id, revision]) => assignments.some(row => row.id === id && row.row_version === revision)))));
      if (canReadLibrary) {
        const ids = [...new Set(pool.map(item => item.candidate_id))]; let unavailable = false;
        for (let index = 0; index < ids.length && current() && !deadline.aborted; index += 8) {
          const batch = ids.slice(index, index + 8); const values = await Promise.allSettled(batch.map(id => api<Candidate>(`/api/v1/candidates/${encode(id)}`, { signal })));
          if (!current()) return;
          const found: Record<string, Candidate> = {};
          values.forEach((result, position) => { if (result.status === 'fulfilled' && result.value.data.id === batch[position]) found[batch[position]] = result.value.data; else unavailable = true; });
          setProfiles(old => { const next = { ...old }; for (const id of batch) delete next[id]; return { ...next, ...found }; });
        }
        if (current()) setProfileWarning(unavailable || deadline.aborted);
      }
    } catch (reason) {
      if (current()) { setError(message(reason)); if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) setData(null); }
    } finally { if (current()) setLoading(false); }
  }, [workspaceId, projectId, canReadLibrary]);
  useEffect(() => { void Promise.resolve().then(load); return () => read.current?.controller.abort(); }, [load]);

  async function send<T>(key: string, path: string, method: string, body: unknown): Promise<T> {
    const signature = JSON.stringify([path, method, body]); let saved = intents.current.get(key);
    if (!saved || saved.signature !== signature) { saved = { signature, init: mutation(method, body) }; intents.current.set(key, saved); }
    return (await api<T>(path, { ...saved.init, signal: AbortSignal.timeout(30000) })).data;
  }
  async function run(change: Write, retry = false) {
    if (writeBusy.current || !canWrite || !retry && (!fresh || loading || uncertain)) return;
    if (!retry) { write.current = change; intents.current.clear(); }
    writeBusy.current = true; setBusy(true); setError(''); setStatus('');
    try { await change.run(); }
    catch (reason) {
      if (mounted.current) { const unknown = uncertain || !(reason instanceof ApiError) || reason.status >= 500 || [408, 429].includes(reason.status);
        setUncertain(unknown); setError(`${unknown ? 'This change may have saved. Retry the same request to confirm it. ' : ''}${message(reason)}`);
        setFresh(false); if (!unknown) { write.current = null; intents.current.clear(); } }
      return;
    } finally { writeBusy.current = false; if (mounted.current) setBusy(false); }
    if (!mounted.current) return;
    write.current = null; intents.current.clear(); setUncertain(false); setEditing(null); setNotesDirty(false);
    setStatus(`${change.label} saved.`); focusAfter.current = change.focus ?? null; onWorkspaceChanged(); await load();
  }
  async function reload() {
    if (busy || uncertain) return;
    if (notesDirty && !await confirm({ title: 'Reload the saved board?', description: 'Your unfinished assignment notes are discarded.', confirmLabel: 'Discard notes and reload', danger: true })) return;
    setEditing(null); setNotesDirty(false); void load();
  }
  async function closeNotes() {
    if (busy) return;
    if (notesDirty && !await confirm({ title: 'Discard note edits?', description: 'Your unsaved assignment notes are discarded.', confirmLabel: 'Discard note edits', danger: true })) return;
    setEditing(null); setNotesDirty(false);
  }
  function undoMain(slotId: string) {
    const choice = undos[slotId]; if (!choice || editing !== null) return;
    void run({ label: 'Main undo', focus: slotId, run: async () => { await send(`undo:${slotId}`, `/api/v1/slots/${encode(slotId)}/main/undo`, 'POST', choice.payload); if (mounted.current) setUndos(values => { const next = { ...values }; delete next[slotId]; return next; }); } });
  }
  useEffect(() => { undoRef.current = undoMain; });
  function changeOutput(next: CastingOutput) {
    if (loading || busy || uncertain || !fresh || editing !== null || !data) return;
    if (!canWrite) { setPreviewOutput(next); return; }
    void run({ label: 'Working output', run: async () => {
      await send<Workspace>('output', '/api/v1/workspaces/' + encode(workspaceId), 'PATCH', { row_version: data.workspace.row_version, active_output: next });
    } });
  }
  function main(slot: Slot, assignment: Assignment | null, label?: string) {
    void run({ label: assignment ? 'Main choice' : 'Cleared Main', focus: slot.id, run: async () => {
      const result = await send<SetSlotMainResult>(`main:${slot.id}`, `/api/v1/slots/${encode(slot.id)}/main`, 'PUT', { assignment_id: assignment?.id ?? null, expected_slot_row_version: slot.row_version, replacement_behavior: 'move_previous_to_backup' });
      if (mounted.current) setUndos(values => { const next = { ...values }; if (result.undo) next[slot.id] = { payload: result.undo, revisions: Object.fromEntries(result.affected_assignments.map(item => [item.id, item.row_version])) }; else delete next[slot.id]; return next; });
      if (mounted.current && assignment) toast({ message: `${label ?? 'This candidate'} is now Main in ${slot.label}. Any previous Main moved to Backup.`, action: result.undo ? { label: 'Undo', onSelect: () => undoRef.current?.(slot.id) } : undefined });
    } });
  }
  function add(slot: Slot, chosen?: string) {
    const poolId = chosen ?? picks[slot.id]; if (!data || !poolId) return;
    const previous = data.assignments.find(row => row.slot_id === slot.id && row.workspace_candidate_id === poolId);
    const shortlist = output === 'shortlist'; if (previous && (!shortlist || previous.shortlist_included)) return;
    void run({ label: shortlist ? 'Shortlist assignment' : 'Assignment', focus: slot.id, run: async () => {
      const row = previous ?? await send<Assignment>(`create:${slot.id}:${poolId}`, `/api/v1/workspaces/${encode(workspaceId)}/assignments`, 'POST', { slot_id: slot.id, workspace_candidate_id: poolId, expected_slot_row_version: slot.row_version, shortlist_included: shortlist });
      if (shortlist && !row.shortlist_included) { try { await send<Assignment>(`include:${row.id}`, `/api/v1/assignments/${encode(row.id)}`, 'PATCH', { row_version: row.row_version, shortlist_included: true }); }
        catch (reason) { if (mounted.current) setStatus('The assignment step completed. Reload to check its current Shortlist choice.'); throw reason; } }
      if (mounted.current) setPicks(values => ({ ...values, [slot.id]: '' }));
    } });
  }
  function patch(item: Assignment, body: Record<string, unknown>, label: string) {
    void run({ label, focus: item.slot_id, run: async () => { await send(`patch:${item.id}`, `/api/v1/assignments/${encode(item.id)}`, 'PATCH', { row_version: item.row_version, ...body }); } });
  }
  async function remove(item: Assignment) {
    if (!await confirm({ title: 'Remove this assignment?', description: 'It is removed from this slot only. Other assignments, the project candidate and their shared profile remain.', confirmLabel: 'Remove assignment', danger: true })) return;
    void run({ label: 'Assignment removal', focus: item.slot_id, run: async () => { await send(`remove:${item.id}`, `/api/v1/assignments/${encode(item.id)}/remove`, 'POST', { row_version: item.row_version }); } });
  }
  function reorder(kind: OrderKind, id: string, direction: -1 | 1, scope?: string, targetId?: string) {
    if (!data) return; const sourceRows: { id: string; sort_order: number }[] = kind === 'role' ? data.roles : kind === 'slot' ? data.slots.filter(row => row.role_id === scope) : data.assignments.filter(row => row.slot_id === scope);
    const rows = ordered(sourceRows);
    const index = rows.findIndex(row => row.id === id); const target = targetId === undefined ? index + direction : rows.findIndex(row => row.id === targetId); if (index < 0 || target < 0 || target >= rows.length || index === target) return;
    const [moved] = rows.splice(index, 1); rows.splice(target, 0, moved); const ids = rows.map(row => row.id);
    const body = { row_version: data.workspace.row_version, ...(kind === 'role' ? { role_ids: ids } : kind === 'slot' ? { slot_ids_by_role: { [scope!]: ids } } : { assignment_ids_by_slot: { [scope!]: ids } }) };
    void run({ label: 'Casting order', focus: kind === 'role' ? `role-tab:${id}` : kind === 'slot' ? id : scope, run: async () => { await send(`order:${kind}:${scope ?? workspaceId}`, `/api/v1/workspaces/${encode(workspaceId)}/order`, 'PUT', body); } });
  }

  function acceptsDrag(kind: OrderKind, scope?: string) {
    const item = dragging.current;
    return !!item && !!data && canWrite && fresh && !loading && !busy && !uncertain && editing === null
      && item.kind === kind && item.scope === scope && item.rowVersion === data.workspace.row_version
      && item.draftRevision === data.workspace.draft_revision && (kind !== 'assignment' || output === 'selection');
  }
  function allowDrop(event: DragEvent, kind: OrderKind, scope?: string) {
    if (acceptsDrag(kind, scope)) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; }
  }
  function drop(event: DragEvent, kind: OrderKind, targetId: string, scope?: string) {
    event.preventDefault(); event.stopPropagation();
    const item = dragging.current; const accepted = acceptsDrag(kind, scope); dragging.current = null;
    if (accepted && item) reorder(kind, item.id, 1, scope, targetId);
  }
  function dragHandle(kind: OrderKind, id: string, label: string, scope?: string) {
    const disabled = !data || !canWrite || !fresh || loading || busy || uncertain || editing !== null || kind === 'assignment' && output !== 'selection';
    return <button type="button" className="icon-button icon-button-small drag-handle" disabled={disabled} draggable={!disabled} title="Drag to reorder"
      aria-label={'Drag ' + kind + ' ' + label + ' to reorder'} onDragEnd={() => { dragging.current = null; }}
      onDragStart={event => {
        if (disabled || !data) { event.preventDefault(); return; }
        event.stopPropagation(); event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-eps-casting-order', '1');
        dragging.current = { kind, id, scope, rowVersion: data.workspace.row_version, draftRevision: data.workspace.draft_revision };
      }}><Icon name="drag" /></button>;
  }

  if (!data) return <section aria-busy={loading}>{error && <ErrorNotice message={error} retry={() => void reload()} />}{loading ? <Loading label="Opening saved casting choices…" /> : <p className="muted">The casting board could not be loaded.</p>}</section>;
  const locked = loading || busy || uncertain || !fresh; const actionsLocked = locked || !canWrite || editing !== null;
  const roles = ordered(data.roles); const role = roles.find(item => item.id === selectedRole) ?? roles[0];
  const visible = data.assignments.filter(row => output === 'selection' || row.shortlist_included);
  const pending = data.slots.filter(slot => !visible.some(row => row.slot_id === slot.id)).length;
  const base = `/projects/${encode(projectId)}/casting/${encode(workspaceId)}`;
  const editingItem = editing ? data.assignments.find(row => row.id === editing) ?? null : null;
  return <section className="casting-board" aria-busy={loading || busy}>
    <header className="section-heading casting-heading"><div><h2>Casting choices</h2><p>Selection includes every active assignment. Shortlist is your explicit choice; positions stay independent.</p></div>
      <div className="button-row"><div className="segmented" role="group" aria-label="Casting output view"><SegmentIndicator /><button type="button" aria-pressed={output === 'selection'} disabled={locked || editing !== null} onClick={() => changeOutput('selection')}>Selection</button><button type="button" aria-pressed={output === 'shortlist'} disabled={locked || editing !== null} onClick={() => changeOutput('shortlist')}>Shortlist</button></div>
        <div className="segmented" role="group" aria-label="Casting layout"><SegmentIndicator /><button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')}>All roles</button><button type="button" aria-pressed={view === 'one'} onClick={() => setView('one')}>One role</button></div>
        <button type="button" className="button button-small button-quiet" disabled={busy || uncertain} onClick={() => void reload()}><Icon name="refresh" />Reload saved board</button></div></header>
    {error && <ErrorNotice message={error} />}{uncertain && <div className="notice notice-warning" role="status"><p>The outcome is unconfirmed. Other changes are locked until this request is resolved.</p><button className="button" disabled={busy} onClick={() => { if (write.current) void run(write.current, true); }}>Retry same change</button></div>}
    <div className="casting-summary"><p aria-live="polite">{visible.length} assigned {visible.length === 1 ? 'entry' : 'entries'} · {pending} Pending {pending === 1 ? 'slot' : 'slots'}</p><p className="save-state" role="status" aria-live="polite">{busy ? 'Saving casting choices…' : status}</p></div>
    {profileWarning && <p className="small muted">Some profile labels could not be refreshed. Candidate record IDs remain visible; reusable facts have not been changed.</p>}
    {!roles.length ? <div className="empty-state"><Icon name="people" /><h3>No roles or slots yet</h3><p>Add or correct your requirements in Specs. Unassigned project candidates do not create casting pages.</p><Link className="button" href={`${base}/specs`}>Open Specs</Link></div> : <div className="board-tray">
      <div className="stack-lg">
        <nav className="role-strip" aria-label="Casting role"><ul>{roles.map((item, index) => { const count = visible.filter(row => data.slots.some(slot => slot.role_id === item.id && slot.id === row.slot_id)).length; const slotCount = data.slots.filter(slot => slot.role_id === item.id).length;
          return <li key={item.id} className={role?.id === item.id ? 'is-current' : undefined} onDragOver={event => allowDrop(event, 'role')} onDrop={event => drop(event, 'role', item.id)}>
            <button type="button" className="role-chip" ref={node => register(`role-tab:${item.id}`, node)} aria-controls="casting-role-panel" aria-current={role?.id === item.id ? 'true' : undefined} disabled={locked || editing !== null} onClick={() => { setSelectedRole(item.id); if (view === 'all') requestAnimationFrame(() => { const heading = document.getElementById(`role-heading-${item.id}`); heading?.scrollIntoView({ block: 'start', behavior: 'smooth' }); heading?.focus({ preventScroll: true }); }); }}>{item.name}</button>
            <span className="role-chip-meta">{count} assigned entries · {slotCount} {slotCount === 1 ? 'slot' : 'slots'}</span>
            <span className="role-chip-order">{dragHandle('role', item.id, item.name)}<MoveButtons label={`role ${item.name}`} disabled={actionsLocked} first={index === 0} last={index === roles.length - 1} move={direction => reorder('role', item.id, direction)} /></span>
          </li>; })}</ul></nav>
        {role && <div className="role-groups" id="casting-role-panel">{(view === 'all' ? roles : [role]).map(group => { const groupSlots = ordered(data.slots.filter(slot => slot.role_id === group.id)); const filled = groupSlots.filter(slot => visible.some(row => row.slot_id === slot.id)).length; const mains = groupSlots.filter(slot => data.assignments.some(row => row.slot_id === slot.id && row.position === 'main')).length;
          return <section className="slot-lanes role-group" key={group.id} aria-labelledby={`role-heading-${group.id}`}><header className="role-panel-head"><div className="role-panel-title"><h3 id={`role-heading-${group.id}`} tabIndex={-1}>{group.name}</h3><p className="role-coverage"><span className={filled === groupSlots.length ? 'text-ok' : 'text-warn'}><AnimatedNumber value={filled} /> of {groupSlots.length} {groupSlots.length === 1 ? 'slot' : 'slots'} filled</span><span><AnimatedNumber value={mains} /> Main chosen</span>{groupSlots.length - filled > 0 && <span>{groupSlots.length - filled} Pending</span>}</p></div><p className="small muted">{group.headcount === null ? 'Headcount needs clarification. Current slots are a working allocation.' : `${groupSlots.length} individual slots`} · {[group.requirements.age_range, group.requirements.gender_requirement, ...group.requirements.languages, ...group.requirements.skills].filter(Boolean).join(' · ') || 'Role requirements not provided.'}</p></header>
          {groupSlots.map((slot, slotIndex, slots) => { const role = group;
            const all = ordered(data.assignments.filter(row => row.slot_id === slot.id)); const shown = all.filter(row => output === 'selection' || row.shortlist_included);
            const hasMain = all.some(row => row.position === 'main');
            return <section className="slot-lane" key={slot.id} onDragOver={event => allowDrop(event, 'slot', role.id)} onDrop={event => drop(event, 'slot', slot.id, role.id)} aria-labelledby={`slot-${slot.id}`}>
              <header className="slot-lane-head"><div><h4 id={`slot-${slot.id}`} tabIndex={-1} ref={node => register(slot.id, node)}>{slot.label}</h4><p className={shown.length ? 'small muted' : 'small text-warn'}>{shown.length ? `${shown.length} assigned ${shown.length === 1 ? 'entry' : 'entries'}` : `Pending in ${output === 'selection' ? 'Selection' : 'Shortlist'}`}{!hasMain ? ' · No Main selected' : ''}</p></div>
                <div className="button-row">{undos[slot.id] && <button className="button button-small" disabled={actionsLocked} onClick={() => undoMain(slot.id)}>Undo Main change</button>}{dragHandle('slot', slot.id, slot.label, role.id)}<MoveButtons label={`slot ${slot.label}`} disabled={actionsLocked} first={slotIndex === 0} last={slotIndex === slots.length - 1} move={direction => reorder('slot', slot.id, direction, role.id)} /></div></header>
              <div className="slot-cards">{shown.map(item => { const pool = data.pool.find(row => row.id === item.workspace_candidate_id)!; const profile = profiles[pool.candidate_id]; const index = all.findIndex(row => row.id === item.id); const label = name(profile, pool.candidate_id);
                const positionLabel = item.position === 'main' ? 'Main' : item.position === 'backup' ? 'Backup' : 'Option';
                const menu: MenuItem[] = [
                  ...(item.position === 'main' ? [{ label: 'Clear Main to Backup', onSelect: () => main(slot, null) }] : [{ label: 'Set as Main', onSelect: () => main(slot, item, label) }, { label: 'Option', checked: item.position === 'option', onSelect: () => { if (item.position !== 'option') patch(item, { position: 'option' }, 'Assignment position'); } }, { label: 'Backup', checked: item.position === 'backup', onSelect: () => { if (item.position !== 'backup') patch(item, { position: 'backup' }, 'Assignment position'); } }]),
                  { kind: 'separator' },
                  { label: 'Edit assignment notes', onSelect: () => setEditing(item.id) },
                  { label: 'Move earlier', disabled: output !== 'selection' || index === 0, onSelect: () => reorder('assignment', item.id, -1, slot.id) },
                  { label: 'Move later', disabled: output !== 'selection' || index === all.length - 1, onSelect: () => reorder('assignment', item.id, 1, slot.id) },
                  ...(canReadLibrary ? [{ label: 'Inspect profile', onSelect: () => router.push(`/library/cast/${encode(pool.candidate_id)}`) }] : []),
                  { kind: 'separator' },
                  { label: 'Remove assignment', danger: true, onSelect: () => void remove(item) },
                ];
                return <article className={`assignment-card${item.position === 'main' ? ' is-main' : ''}`} key={item.id} onDragOver={event => allowDrop(event, 'assignment', slot.id)} onDrop={event => drop(event, 'assignment', item.id, slot.id)} aria-label={`${label}, ${positionLabel}`}>
                  <div className="assignment-frame">{pool.selected_frame_asset_ids[0] ? <CandidateFrameImage assetId={pool.selected_frame_asset_ids[0]} alt={`Selected project frame 1 for ${label}`} /> : <span className="assignment-frame-empty"><Icon name="image" /><span className="sr-only">No project frames selected.</span></span>}</div>
                  <div className="assignment-body">
                    <h5 dir="auto">{label}{profile?.review_status === 'reviewed' && <span className="reviewed-mark" title="Reviewed facts"><Icon name="check" /><span className="sr-only"> · Reviewed facts</span></span>}</h5>
                    <p className="small muted" dir="auto">{pool.availability || 'Availability pending'}{pool.fresh_material_required ? ' · Fresh material required' : ''}</p>
                    {!profile && <p className="small muted">Profile status not loaded</p>}{profile?.archived && <p className="small muted">Archived library profile retained for this project</p>}
                    <div className="assignment-controls"><span className={`position-chip position-${item.position}`}>{positionLabel}</span>{(item.presentation_notes || item.internal_notes) && <span className="assignment-note-mark" title="Has assignment notes"><Icon name="comment" /><span className="sr-only">Has assignment notes</span></span>}
                      <label className="shortlist-toggle" title="Include in Shortlist"><input type="checkbox" checked={item.shortlist_included} disabled={actionsLocked} onChange={event => patch(item, { shortlist_included: event.target.checked }, 'Shortlist choice')} /><Icon name={item.shortlist_included ? 'star-filled' : 'star'} /><span className="sr-only">Include {label} in Shortlist for {slot.label}</span></label>
                      <ActionMenu label={`Assignment actions for ${label} in ${slot.label}`} disabled={actionsLocked} items={menu} /></div>
                    <span className="drag-assignment">{dragHandle('assignment', item.id, label, slot.id)}</span>
                  </div>
                </article>;
              })}
                <fieldset className="assignment-add" disabled={actionsLocked} aria-label={`Add candidate to ${slot.label}`}><label className="field" htmlFor={`add-${slot.id}`}><span>Project candidate<span className="sr-only"> for {slot.label}</span></span><select id={`add-${slot.id}`} value={picks[slot.id] ?? ''} onChange={event => setPicks(values => ({ ...values, [slot.id]: event.target.value }))}><option value="">Choose an existing project candidate</option>{data.pool.map(item => { const existing = all.find(row => row.workspace_candidate_id === item.id); const present = !!existing && (output === 'selection' || existing.shortlist_included); return <option key={item.id} value={item.id} disabled={present}>{name(profiles[item.candidate_id], item.candidate_id)}{present ? ' · already included' : existing ? ' · add existing assignment to Shortlist' : ''}</option>; })}</select></label><button className="button button-small" disabled={!picks[slot.id] || all.some(row => row.workspace_candidate_id === picks[slot.id] && (output === 'selection' || row.shortlist_included))} onClick={() => add(slot)} aria-label={`${output === 'shortlist' ? 'Add to Shortlist in' : 'Assign as Option to'} ${slot.label}`}><Icon name="plus" />{output === 'shortlist' ? 'Add to Shortlist' : 'Assign as Option'}</button></fieldset>
              </div>
              {output === 'shortlist' && <p className="small muted">Shortlist follows the assignment order in Selection.</p>}
            </section>;
          })}
        </section>; })}</div>}
      </div>
      <aside className="panel candidate-tray" aria-labelledby="candidate-tray-heading"><header className="panel-header"><h3 id="candidate-tray-heading">Project candidates</h3><span className="small muted">{data.pool.length}</span></header>
        <ul className="tray-list">{data.pool.map(item => { const count = data.assignments.filter(row => row.workspace_candidate_id === item.id).length; const person = name(profiles[item.candidate_id], item.candidate_id);
          const items: MenuItem[] = roles.flatMap(group => [{ kind: 'label' as const, label: group.name }, ...ordered(data.slots.filter(slot => slot.role_id === group.id)).map(slot => { const existing = data.assignments.find(row => row.slot_id === slot.id && row.workspace_candidate_id === item.id); const present = !!existing && (output === 'selection' || existing.shortlist_included);
            return { label: present ? `${slot.label} · already included` : `${slot.label}${existing ? ' · add to Shortlist' : ''}`, disabled: present, onSelect: () => add(slot, item.id) }; })]);
          return <li key={item.id}>{item.selected_frame_asset_ids[0] ? <span className="tray-thumb"><CandidateFrameImage assetId={item.selected_frame_asset_ids[0]} alt="" /></span> : <span className="tray-thumb" aria-hidden="true" />}<span className="tray-person"><strong dir="auto">{person}</strong><span className="small muted">{count ? `${count} ${count === 1 ? 'assignment' : 'assignments'}` : 'Not assigned'}</span></span>
            {canWrite && <ActionMenu label={`Assign ${person} to a slot ${output === 'shortlist' ? 'in Shortlist' : 'as Option'}`} disabled={actionsLocked || !data.slots.length} items={items} trigger={<><Icon name="plus" /><span className="sr-only">Assign {person}</span></>} />}</li>; })}</ul>
        <div className="panel-footer stack"><p className="small muted">Use + beside a person, or a slot’s Project candidate list, to assign. Each slot keeps its own Option, Main and Backup choices.</p><Link className="button button-small button-quiet" href={`${base}/cast`}><Icon name="plus" />Add from Cast Library</Link></div></aside>
    </div>}
    {editingItem && <Drawer inline title="Assignment notes" description={`${name(profiles[data.pool.find(row => row.id === editingItem.workspace_candidate_id)?.candidate_id ?? ''], data.pool.find(row => row.id === editingItem.workspace_candidate_id)?.candidate_id ?? editingItem.workspace_candidate_id)} · ${data.slots.find(slot => slot.id === editingItem.slot_id)?.label ?? 'Slot'}`} onClose={() => void closeNotes()} busy={busy}>
      <AssignmentNotes key={`${editingItem.id}:${editingItem.row_version}`} item={editingItem} disabled={loading || busy || uncertain} canSave={fresh} onDirty={setNotesDirty} onDiscard={() => { setEditing(null); setNotesDirty(false); }} onSave={(presentation_notes, internal_notes) => patch(editingItem, { presentation_notes, internal_notes }, 'Assignment notes')} />
    </Drawer>}
    <footer className="sticky-bar workspace-continue"><Link className="button" href={`${base}/cast`}>Back to Candidates</Link><Link className="button button-primary" href={`${base}/review`}>Continue to Review<Icon name="arrow" /></Link></footer>
  </section>;
}
function MoveButtons({ label, disabled, first, last, move }: { label: string; disabled: boolean; first: boolean; last: boolean; move: (direction: -1 | 1) => void }) {
  return <span className="move-buttons"><button type="button" className="icon-button icon-button-small" disabled={disabled || first} aria-label={`Move ${label} earlier`} title="Move earlier" onClick={() => move(-1)}><Icon name="chevron-left" /></button><button type="button" className="icon-button icon-button-small" disabled={disabled || last} aria-label={`Move ${label} later`} title="Move later" onClick={() => move(1)}><Icon name="chevron-right" /></button></span>;
}
function AssignmentNotes({ item, disabled, canSave, onDirty, onDiscard, onSave }: { item: Assignment; disabled: boolean; canSave: boolean; onDirty: (value: boolean) => void; onDiscard: () => void; onSave: (presentation: string | null, internal: string | null) => void }) {
  const [presentation, setPresentation] = useState(item.presentation_notes ?? ''); const [internal, setInternal] = useState(item.internal_notes ?? '');
  const dirty = presentation !== (item.presentation_notes ?? '') || internal !== (item.internal_notes ?? '');
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  return <form onSubmit={event => { event.preventDefault(); if (canSave && dirty) onSave(presentation || null, internal || null); }}><fieldset disabled={disabled}><legend>Notes for this assignment</legend><div className="field"><label htmlFor={`presentation-${item.id}`}>Presentation notes</label><textarea id={`presentation-${item.id}`} dir="auto" rows={3} value={presentation} onChange={event => setPresentation(event.target.value)} /></div><div className="field"><label htmlFor={`internal-${item.id}`}>Internal notes · never printed</label><textarea id={`internal-${item.id}`} dir="auto" rows={3} value={internal} onChange={event => setInternal(event.target.value)} /></div>{!canSave && <p className="small muted">Your note text is retained. Copy it or discard it before reloading the saved board.</p>}<div className="button-row"><button className="button button-primary" disabled={!dirty || !canSave}>Save assignment notes</button><button type="button" className="button" onClick={onDiscard}>Discard note edits</button></div></fieldset></form>;
}
