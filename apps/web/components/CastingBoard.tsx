'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import type { Candidate, WorkspaceCandidate } from '../../../packages/domain/src/candidate-types.ts';
import type { Role, Slot } from '../../../packages/domain/src/specs-types.ts';
import type { Assignment, CastingOutput, MainUndo, SetSlotMainResult } from '../../../packages/domain/src/casting-types.ts';
import { api, ApiError, errorMessage, mutation, type Actor, type Envelope, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { CandidateFrameImage } from './CandidateFrameImage';

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
  const [previewOutput, setPreviewOutput] = useState<CastingOutput | null>(null); const [selectedRole, setSelectedRole] = useState('');
  const output = previewOutput ?? data?.workspace.active_output ?? initialOutput;
  const [loading, setLoading] = useState(true); const [fresh, setFresh] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [status, setStatus] = useState(''); const [profileWarning, setProfileWarning] = useState(false);
  const [uncertain, setUncertain] = useState(false); const [editing, setEditing] = useState<string | null>(null); const [notesDirty, setNotesDirty] = useState(false);
  const [picks, setPicks] = useState<Record<string, string>>({}); const [undos, setUndos] = useState<Record<string, UndoChoice>>({});
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
  function reload() {
    if (busy || uncertain) return;
    if (notesDirty && !window.confirm('Discard unfinished assignment notes and reload the saved board?')) return;
    setEditing(null); setNotesDirty(false); void load();
  }
  function changeOutput(next: CastingOutput) {
    if (loading || busy || uncertain || !fresh || editing !== null || !data) return;
    if (!canWrite) { setPreviewOutput(next); return; }
    void run({ label: 'Working output', run: async () => {
      await send<Workspace>('output', '/api/v1/workspaces/' + encode(workspaceId), 'PATCH', { row_version: data.workspace.row_version, active_output: next });
    } });
  }
  function main(slot: Slot, assignment: Assignment | null) {
    void run({ label: assignment ? 'Main choice' : 'Cleared Main', focus: slot.id, run: async () => {
      const result = await send<SetSlotMainResult>(`main:${slot.id}`, `/api/v1/slots/${encode(slot.id)}/main`, 'PUT', { assignment_id: assignment?.id ?? null, expected_slot_row_version: slot.row_version, replacement_behavior: 'move_previous_to_backup' });
      if (mounted.current) setUndos(values => { const next = { ...values }; if (result.undo) next[slot.id] = { payload: result.undo, revisions: Object.fromEntries(result.affected_assignments.map(item => [item.id, item.row_version])) }; else delete next[slot.id]; return next; });
    } });
  }
  function add(slot: Slot) {
    const poolId = picks[slot.id]; if (!data || !poolId) return;
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
  function remove(item: Assignment) {
    if (!window.confirm('Remove this assignment from this slot? Other assignments, the project candidate and their shared profile remain.')) return;
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
    return <button type="button" className="button button-small" disabled={disabled} draggable={!disabled}
      aria-label={'Drag ' + kind + ' ' + label + ' to reorder'} onDragEnd={() => { dragging.current = null; }}
      onDragStart={event => {
        if (disabled || !data) { event.preventDefault(); return; }
        event.stopPropagation(); event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-eps-casting-order', '1');
        dragging.current = { kind, id, scope, rowVersion: data.workspace.row_version, draftRevision: data.workspace.draft_revision };
      }}>Drag to reorder</button>;
  }

  if (!data) return <section aria-busy={loading}>{error && <ErrorNotice message={error} retry={reload} />}{loading ? <Loading label="Opening saved casting choices…" /> : <p className="muted">The casting board could not be loaded.</p>}</section>;
  const locked = loading || busy || uncertain || !fresh; const actionsLocked = locked || !canWrite || editing !== null;
  const roles = ordered(data.roles); const role = roles.find(item => item.id === selectedRole) ?? roles[0];
  const visible = data.assignments.filter(row => output === 'selection' || row.shortlist_included);
  const pending = data.slots.filter(slot => !visible.some(row => row.slot_id === slot.id)).length;
  return <section className="casting-board" aria-busy={loading || busy}>
    <header className="section-heading"><div><h2>Casting choices</h2><p>Selection includes every active assignment. Shortlist is your explicit choice; positions stay independent.</p></div><button type="button" className="button" disabled={busy || uncertain} onClick={reload}>Reload saved board</button></header>
    {error && <ErrorNotice message={error} />}{uncertain && <div className="notice" role="status"><p>The outcome is unconfirmed. Other changes are locked until this request is resolved.</p><button className="button" disabled={busy} onClick={() => { if (write.current) void run(write.current, true); }}>Retry same change</button></div>}
    <p role="status" aria-live="polite">{busy ? 'Saving casting choices…' : status}</p>
    <div className="section-heading"><div className="button-row" role="group" aria-label="Casting output view"><button className="button" aria-pressed={output === 'selection'} disabled={locked || editing !== null} onClick={() => changeOutput('selection')}>Selection</button><button className="button" aria-pressed={output === 'shortlist'} disabled={locked || editing !== null} onClick={() => changeOutput('shortlist')}>Shortlist</button></div><p aria-live="polite">{visible.length} assigned {visible.length === 1 ? 'entry' : 'entries'} · {pending} Pending {pending === 1 ? 'slot' : 'slots'}</p></div>
    {profileWarning && <p className="small muted">Some profile labels could not be refreshed. Candidate record IDs remain visible; reusable facts have not been changed.</p>}
    {!roles.length ? <div className="empty-state"><h3>No roles or slots yet</h3><p>Add or correct your requirements in Specs. Unassigned project candidates do not create casting pages.</p><Link className="button" href={`/projects/${encode(projectId)}/casting/${encode(workspaceId)}/specs`}>Open Specs</Link></div> : <div className="casting-board-layout">
      <aside className="role-editor"><h3>Roles</h3><nav aria-label="Casting role"><div className="role-list">{roles.map((item, index) => <div key={item.id} onDragOver={event => allowDrop(event, 'role')} onDrop={event => drop(event, 'role', item.id)}><button className="button" ref={node => register(`role-tab:${item.id}`, node)} aria-controls="casting-role-panel" aria-current={role?.id === item.id ? 'true' : undefined} disabled={locked || editing !== null} onClick={() => setSelectedRole(item.id)}>{item.name}</button><p className="small muted">{visible.filter(row => data.slots.some(slot => slot.role_id === item.id && slot.id === row.slot_id)).length} assigned entries</p>{dragHandle('role', item.id, item.name)}<MoveButtons label={`role ${item.name}`} disabled={actionsLocked} first={index === 0} last={index === roles.length - 1} move={direction => reorder('role', item.id, direction)} /></div>)}</div></nav></aside>
      {role && <div className="role-list" id="casting-role-panel" aria-labelledby={`role-heading-${role.id}`}><header className="section-heading"><div><h3 id={`role-heading-${role.id}`}>{role.name}</h3><p>{role.headcount === null ? 'Headcount needs clarification. Current slots are a working allocation.' : `${data.slots.filter(slot => slot.role_id === role.id).length} individual slots`}</p><p className="small muted">{[role.requirements.age_range, role.requirements.gender_requirement, ...role.requirements.languages, ...role.requirements.skills].filter(Boolean).join(' · ') || 'Role requirements not provided.'}</p></div></header>
        {ordered(data.slots.filter(slot => slot.role_id === role.id)).map((slot, slotIndex, slots) => {
          const all = ordered(data.assignments.filter(row => row.slot_id === slot.id)); const shown = all.filter(row => output === 'selection' || row.shortlist_included);
          return <section className="role-editor" key={slot.id} onDragOver={event => allowDrop(event, 'slot', role.id)} onDrop={event => drop(event, 'slot', slot.id, role.id)} aria-labelledby={`slot-${slot.id}`}><header className="section-heading"><div><h4 id={`slot-${slot.id}`} tabIndex={-1} ref={node => register(slot.id, node)}>{slot.label}</h4><p>{shown.length ? `${shown.length} assigned ${shown.length === 1 ? 'entry' : 'entries'}` : `Pending in ${output === 'selection' ? 'Selection' : 'Shortlist'}`}{!all.some(row => row.position === 'main') ? ' · No Main selected' : ''}</p></div>{dragHandle('slot', slot.id, slot.label, role.id)}<MoveButtons label={`slot ${slot.label}`} disabled={actionsLocked} first={slotIndex === 0} last={slotIndex === slots.length - 1} move={direction => reorder('slot', slot.id, direction, role.id)} /></header>
            {undos[slot.id] && <button className="button button-small" disabled={actionsLocked} onClick={() => void run({ label: 'Main undo', focus: slot.id, run: async () => { await send(`undo:${slot.id}`, `/api/v1/slots/${encode(slot.id)}/main/undo`, 'POST', undos[slot.id].payload); if (mounted.current) setUndos(values => { const next = { ...values }; delete next[slot.id]; return next; }); } })}>Undo Main change</button>}
            <div className="role-list">{shown.map(item => { const pool = data.pool.find(row => row.id === item.workspace_candidate_id)!; const profile = profiles[pool.candidate_id]; const index = all.findIndex(row => row.id === item.id);
              return <article className="role-editor" key={item.id} onDragOver={event => allowDrop(event, 'assignment', slot.id)} onDrop={event => drop(event, 'assignment', item.id, slot.id)}><header className="section-heading"><div><h5 dir="auto">{name(profile, pool.candidate_id)}</h5><p>{profile ? `${profile.review_status === 'reviewed' ? 'Reviewed facts' : 'Unreviewed facts'}${profile.archived ? ' · Archived library profile retained for this project' : ''}` : 'Profile status not loaded'}</p><span className="badge">{item.position === 'main' ? 'Main' : item.position === 'backup' ? 'Backup' : 'Option'}</span></div>{canReadLibrary && <Link className="button button-small" href={`/library/cast/${encode(pool.candidate_id)}`}>Inspect profile</Link>}</header>
                <p className="small">Project availability: <span dir="auto">{pool.availability || 'Pending'}</span>{pool.fresh_material_required ? ' · Fresh material required' : ''}</p>
                {pool.selected_frame_asset_ids.length ? <div className="candidate-frames">{pool.selected_frame_asset_ids.map((asset, index) => <div className="candidate-frame" key={asset}><CandidateFrameImage assetId={asset} alt={`Selected project frame ${index + 1} for ${name(profile, pool.candidate_id)}`} /></div>)}</div> : <p className="small muted">No project frames selected.</p>}
                <fieldset disabled={actionsLocked} aria-label={`Casting choices for ${name(profile, pool.candidate_id)}`}><div className="button-row">{item.position === 'main' ? <button className="button button-small" onClick={() => main(slot, null)}>Clear Main to Backup</button> : <><label className="field">Position<select value={item.position} onChange={event => patch(item, { position: event.target.value }, 'Assignment position')}><option value="option">Option</option><option value="backup">Backup</option></select></label><button className="button button-small" onClick={() => main(slot, item)}>Set as Main</button></>}</div><label className="radio-line"><input type="checkbox" checked={item.shortlist_included} onChange={event => patch(item, { shortlist_included: event.target.checked }, 'Shortlist choice')} />Include in Shortlist</label>
                  {dragHandle('assignment', item.id, name(profile, pool.candidate_id), slot.id)}<MoveButtons label={`assignment ${name(profile, pool.candidate_id)}`} disabled={output !== 'selection'} first={index === 0} last={index === all.length - 1} move={direction => reorder('assignment', item.id, direction, slot.id)} />
                  <div className="button-row"><button className="button button-small" onClick={() => setEditing(item.id)}>Edit assignment notes</button><button className="button button-quiet button-small" onClick={() => remove(item)}>Remove assignment</button></div></fieldset>
                {editing === item.id ? <AssignmentNotes key={`${item.id}:${item.row_version}`} item={item} disabled={loading || busy || uncertain} canSave={fresh} onDirty={setNotesDirty} onDiscard={() => { setEditing(null); setNotesDirty(false); }} onSave={(presentation_notes, internal_notes) => patch(item, { presentation_notes, internal_notes }, 'Assignment notes')} /> : <><p className="small" dir="auto">Presentation notes: {item.presentation_notes || 'Not provided'}</p>{item.internal_notes && <details><summary>Internal assignment notes</summary><p dir="auto">{item.internal_notes}</p></details>}</>}
              </article>;
            })}</div>
            {output === 'shortlist' && <p className="small muted">Shortlist follows the assignment order in Selection.</p>}
            <fieldset disabled={actionsLocked} aria-label={`Add candidate to ${slot.label}`}><label className="field" htmlFor={`add-${slot.id}`}>Project candidate<select id={`add-${slot.id}`} value={picks[slot.id] ?? ''} onChange={event => setPicks(values => ({ ...values, [slot.id]: event.target.value }))}><option value="">Choose an existing project candidate</option>{data.pool.map(item => { const existing = all.find(row => row.workspace_candidate_id === item.id); const present = !!existing && (output === 'selection' || existing.shortlist_included); return <option key={item.id} value={item.id} disabled={present}>{name(profiles[item.candidate_id], item.candidate_id)}{present ? ' · already included' : existing ? ' · add existing assignment to Shortlist' : ''}</option>; })}</select></label><button className="button button-small" disabled={!picks[slot.id] || all.some(row => row.workspace_candidate_id === picks[slot.id] && (output === 'selection' || row.shortlist_included))} onClick={() => add(slot)}>{output === 'shortlist' ? 'Add to Shortlist' : 'Assign as Option'}</button></fieldset>
          </section>;
        })}
      </div>}
    </div>}
    <footer className="workspace-footer"><Link className="button" href={`/projects/${encode(projectId)}/casting/${encode(workspaceId)}/cast`}>Back to Candidates</Link><Link className="button button-primary" href={`/projects/${encode(projectId)}/casting/${encode(workspaceId)}/review`}>Continue to Review</Link></footer>
  </section>;
}
function MoveButtons({ label, disabled, first, last, move }: { label: string; disabled: boolean; first: boolean; last: boolean; move: (direction: -1 | 1) => void }) {
  return <div className="button-row"><button type="button" className="button button-small" disabled={disabled || first} aria-label={`Move ${label} earlier`} onClick={() => move(-1)}>Move earlier</button><button type="button" className="button button-small" disabled={disabled || last} aria-label={`Move ${label} later`} onClick={() => move(1)}>Move later</button></div>;
}
function AssignmentNotes({ item, disabled, canSave, onDirty, onDiscard, onSave }: { item: Assignment; disabled: boolean; canSave: boolean; onDirty: (value: boolean) => void; onDiscard: () => void; onSave: (presentation: string | null, internal: string | null) => void }) {
  const [presentation, setPresentation] = useState(item.presentation_notes ?? ''); const [internal, setInternal] = useState(item.internal_notes ?? '');
  const dirty = presentation !== (item.presentation_notes ?? '') || internal !== (item.internal_notes ?? '');
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  return <form onSubmit={event => { event.preventDefault(); if (canSave && dirty) onSave(presentation || null, internal || null); }}><fieldset disabled={disabled}><legend>Notes for this assignment</legend><div className="field"><label htmlFor={`presentation-${item.id}`}>Presentation notes</label><textarea id={`presentation-${item.id}`} dir="auto" rows={3} value={presentation} onChange={event => setPresentation(event.target.value)} /></div><div className="field"><label htmlFor={`internal-${item.id}`}>Internal notes · never printed</label><textarea id={`internal-${item.id}`} dir="auto" rows={3} value={internal} onChange={event => setInternal(event.target.value)} /></div>{!canSave && <p className="small muted">Your note text is retained. Copy it or discard it before reloading the saved board.</p>}<div className="button-row"><button className="button button-primary" disabled={!dirty || !canSave}>Save assignment notes</button><button type="button" className="button" onClick={onDiscard}>Discard note edits</button></div></fieldset></form>;
}
