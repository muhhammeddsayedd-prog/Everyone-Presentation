'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Assignment } from '../../../../../packages/domain/src/casting-types.ts';
import type { Role, RoleRequirements, Slot } from '../../../../../packages/domain/src/specs-types.ts';
import { api, errorMessage, mutation, type Envelope, type Workspace } from '../../api';
import { ErrorNotice, Loading } from '../../Feedback';
import { Icon } from '../../Icon';
import { useConfirm } from '../../ui/Confirm';
import { useSceneFocus } from '../WorkspaceDraftProvider';
import { archiveScene, confirmSceneProposals, createScene, linkSceneOccurrence, listScenes, rejectSceneProposals, reorderScenes, unlinkSceneOccurrence,
  updateScene, updateSceneOccurrence, type Scene, type SceneDeckPlacement, type SceneOccurrence } from './scenes-api';
import { affectedScenes, affectedText, appearanceText, castingFingerprint, moved, progressText, requirementLines, roleChoices, roleProgress,
  sceneName, sceneProgress } from './scene-model';
import { useLeaveGuard } from './unsaved';

const encode = encodeURIComponent;
async function pages<T extends { id: string }>(path: string, signal: AbortSignal): Promise<T[]> {
  const result: T[] = []; let cursor: string | null = null;
  for (let page = 0; page < 100; page++) {
    const response: Envelope<T[]> = await api<T[]>(`${path}${path.includes('?') ? '&' : '?'}limit=100${cursor ? `&cursor=${encode(cursor)}` : ''}`, { signal });
    result.push(...response.data); cursor = response.page?.next_cursor ?? null; if (!cursor) return result;
  }
  throw new Error('This project is too large to show as scenes at once.');
}
export interface SceneData { workspace: Workspace; scenes: Scene[]; roles: Role[]; slots: Slot[]; assignments: Assignment[] }
export async function loadSceneData(workspaceId: string, signal: AbortSignal): Promise<SceneData> {
  const base = `/api/v1/workspaces/${encode(workspaceId)}`;
  const [workspace, scenes, roles, assignments] = await Promise.all([api<Workspace>(base, { signal }), listScenes(workspaceId, signal),
    pages<Role>(`${base}/roles`, signal), pages<Assignment>(`${base}/assignments?output_type=selection`, signal)]);
  const active = roles.filter(role => !role.archived); const slots: Slot[] = [];
  for (let index = 0; index < active.length; index += 4) slots.push(...(await Promise.all(active.slice(index, index + 4).map(role => pages<Slot>(`/api/v1/roles/${encode(role.id)}/slots`, signal)))).flat());
  return { workspace: workspace.data, scenes, roles: active, slots: slots.filter(slot => !slot.archived), assignments: assignments.filter(row => !row.archived) };
}

const emptyRequirements = (scene: string | null): RoleRequirements => ({ age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [],
  skills: [], scene_references: scene ? [scene] : [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null });
const placementLabel: Record<SceneDeckPlacement, string> = { auto: 'Automatic — shown once, with a combined scene caption', repeat: 'Repeat — also shown in this scene', hidden: 'Hidden in this scene' };

interface Props {
  workspaceId: string; canWrite: boolean;
  /** Casting fingerprint taken when the person left for Standard view; used to report which scenes a casting change affected. */
  castingBefore?: Record<string, string> | null;
  onCastRole: (roleId: string, fingerprint: Record<string, string>) => void;
  onWorkspaceChanged: () => void; onDirtyChange: (dirty: boolean) => void;
}

/** Scene breakdown: an ordered scene navigator and the selected scene's roles. Casting is never edited here; it is read
 * from the role's slots and assignments and opened in the existing casting board ("Cast this role"). */
export function SceneBreakdown({ workspaceId, canWrite, castingBefore, onCastRole, onWorkspaceChanged, onDirtyChange }: Props) {
  const [data, setData] = useState<SceneData | null>(null); const [error, setError] = useState(''); const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<'scene' | 'new' | null>(null); const [dirty, setDirty] = useState(false);
  const confirm = useConfirm(); const guard = useLeaveGuard(dirty); const reported = useRef(false); const load = useRef(0);
  useEffect(() => { onDirtyChange(dirty || busy); }, [dirty, busy, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const reload = useCallback(async () => {
    const run = ++load.current; const controller = new AbortController();
    try {
      const next = await loadSceneData(workspaceId, AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]));
      if (run !== load.current) return;
      setData(next); setError('');
      setSelectedId(current => current && next.scenes.some(scene => scene.id === current) ? current : next.scenes[0]?.id ?? null);
      if (castingBefore && !reported.current) {
        reported.current = true;
        const items = affectedScenes(castingBefore, castingFingerprint(next.roles, next.slots, next.assignments), next.roles, next.scenes);
        if (items.length) setStatus(`Casting saved. ${affectedText(items, next.scenes)}`);
      }
    } catch (reason) { if (run === load.current) setError(errorMessage(reason)); }
  }, [workspaceId, castingBefore]);
  useEffect(() => { void Promise.resolve().then(reload); }, [reload]);

  const scene = data?.scenes.find(item => item.id === selectedId) ?? null;
  useSceneFocus(scene?.id ?? null);

  async function write(label: string, run: () => Promise<unknown>, done?: string) {
    if (busy) return; setBusy(true); setStatus(''); setError('');
    try { await run(); onWorkspaceChanged(); await reload(); if (done) setStatus(done); }
    catch (reason) { setError(`${label} ${errorMessage(reason)}`); await reload(); }
    finally { setBusy(false); }
  }
  const select = (id: string) => { if (id !== selectedId) void guard(() => { setSelectedId(id); setEditing(null); setDirty(false); }); };
  function navigatorKey(event: KeyboardEvent<HTMLOListElement>) {
    if (!data || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); const ids = data.scenes.map(item => item.id); const index = Math.max(0, ids.indexOf(selectedId ?? ''));
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? ids.length - 1 : Math.min(ids.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)));
    select(ids[next]); event.currentTarget.querySelectorAll<HTMLButtonElement>('button.scene-nav-item')[next]?.focus();
  }
  async function move(id: string, delta: -1 | 1) {
    if (!data) return; const order = moved(data.scenes.map(item => item.id), id, delta); if (!order) return;
    await write('The scene order was not saved.', () => reorderScenes(workspaceId, data.workspace.row_version, order), 'Scene order saved. Casting is unchanged.');
  }
  async function remove(target: Scene) {
    const accepted = await confirm({ title: `Remove ${sceneName(target)}?`, danger: true, confirmLabel: 'Remove scene', cancelLabel: 'Keep scene',
      description: 'The scene and its role links are removed. Roles, slots, candidates and every casting choice stay exactly as they are, including in other scenes.' });
    if (!accepted) return;
    await write('The scene was not removed.', () => archiveScene(target.id, target.row_version), `${sceneName(target)} removed. Roles and casting are unchanged.`);
  }

  if (!data) return error ? <ErrorNotice message={error} retry={() => void reload()} /> : <Loading label="Loading scenes…" />;
  const proposals = data.scenes.filter(item => item.status === 'proposed').length + data.scenes.reduce((sum, item) => sum + item.occurrences.filter(o => o.status === 'proposed').length, 0);
  return <section className="scene-breakdown" aria-label="Scene breakdown">
    {error && <ErrorNotice message={error} />}
    <p className="sr-only" role="status" aria-live="polite">{status}</p>
    {status && <div className="notice scene-status" role="note"><p>{status}</p><button className="button button-small button-quiet" type="button" onClick={() => setStatus('')}>Dismiss</button></div>}
    {proposals > 0 && <div className="notice notice-info scene-proposal-note"><p><strong>{proposals} {proposals === 1 ? 'proposal' : 'proposals'} from the specs</strong> to confirm or reject. Proposals are not part of the casting until confirmed.</p></div>}
    <div className="scene-layout">
      <nav className="scene-nav" aria-label="Scenes">
        <div className="scene-nav-head"><h3>Scenes <span className="muted small">{data.scenes.length}</span></h3>
          {canWrite && <button className="button button-small" type="button" disabled={busy} onClick={() => void guard(() => { setEditing('new'); setDirty(false); })}><Icon name="plus" />Add scene</button>}</div>
        {data.scenes.length === 0 ? <p className="small muted">No scenes yet. Add the scenes of the script; each role can appear in several scenes and keeps one shared casting.</p>
          : <ol className="scene-nav-list" onKeyDown={navigatorKey}>{data.scenes.map((item, index) => { const progress = sceneProgress(item, data.slots, data.assignments); const current = item.id === selectedId;
            return <li key={item.id}><button type="button" className="scene-nav-item" aria-current={current ? 'true' : undefined} tabIndex={current || (!selectedId && index === 0) ? 0 : -1} onClick={() => select(item.id)}>
              <span className="scene-nav-number">{item.scene_number ?? index + 1}</span>
              <span className="scene-nav-text"><span className="scene-nav-title" dir="auto">{item.title}</span>
                <span className="scene-nav-meta small">{item.setting && <span dir="auto">{item.setting}</span>}<span>{progressText(progress)}</span>{item.status === 'proposed' && <span className="badge badge-warn">Proposed</span>}</span></span>
            </button></li>; })}</ol>}
      </nav>
      <div className="scene-detail">
        {editing === 'new' ? <SceneForm key="new" title="New scene" busy={busy} onDirty={setDirty} onCancel={() => void guard(() => { setEditing(null); setDirty(false); })}
          onSave={input => write('The scene was not created.', async () => { const created = await createScene(workspaceId, input); setSelectedId(created.id); setEditing(null); setDirty(false); }, 'Scene added.')} />
          : scene ? <SceneDetail key={scene.id} scene={scene} data={data} canWrite={canWrite} busy={busy} editing={editing === 'scene'} index={data.scenes.indexOf(scene)}
            onEdit={() => setEditing('scene')} onDirty={setDirty}
            onCancelEdit={() => void guard(() => { setEditing(null); setDirty(false); })}
            onSave={input => write('The scene was not saved.', async () => { await updateScene(scene.id, { row_version: scene.row_version, ...input }); setEditing(null); setDirty(false); }, 'Scene saved. Casting is unchanged.')}
            onMove={delta => void move(scene.id, delta)} onRemove={() => void remove(scene)}
            onReview={(decision, sceneIds, occurrenceIds) => write(`The ${decision === 'confirm' ? 'confirmation' : 'rejection'} was not saved.`, async () => {
              const input = { row_version: data.workspace.row_version, scene_ids: sceneIds, occurrence_ids: occurrenceIds };
              if (decision === 'reject') { await rejectSceneProposals(workspaceId, input); return; }
              const result = await confirmSceneProposals(workspaceId, input);
              if (result.skipped_occurrence_ids.length) throw new Error(`${result.skipped_occurrence_ids.length} proposed ${result.skipped_occurrence_ids.length === 1 ? 'link was' : 'links were'} not confirmed because the role changed after the import. Review the role, then link it again or reject the proposal.`);
            }, decision === 'confirm' ? 'Confirmed.' : 'Rejected. It will not be proposed again.')}
            onLink={(input, label) => write('The role was not added to the scene.', () => linkSceneOccurrence(scene.id, input), `${label} added to ${sceneName(scene)}.`)}
            onCreateRole={(name, headcount) => write('The new role was not created.', async () => {
              const role = await api<Role>(`/api/v1/workspaces/${encode(workspaceId)}/roles`, mutation('POST', { name, headcount, requirements: emptyRequirements(scene.scene_number ?? scene.title) }));
              await linkSceneOccurrence(scene.id, { role_id: role.data.id });
            }, `${name} created as a separately cast role and added to ${sceneName(scene)}.`)}
            onUpdateOccurrence={(occurrence, input) => write('The scene link was not saved.', () => updateSceneOccurrence(occurrence.id, { row_version: occurrence.row_version, ...input }), 'Saved for this scene. Casting is unchanged.')}
            onUnlink={occurrence => write('The role was not removed from the scene.', () => unlinkSceneOccurrence(occurrence.id, occurrence.row_version), `${occurrence.role_name || 'Role'} removed from ${sceneName(scene)}. The role and its casting are unchanged.`)}
            onCastRole={roleId => void guard(() => onCastRole(roleId, castingFingerprint(data.roles, data.slots, data.assignments)))} />
          : <div className="empty-state"><p>Select or add a scene.</p></div>}
      </div>
    </div>
  </section>;
}

interface SceneInput { title: string; scene_number: string | null; setting: string | null; sequence_label: string | null; notes: string | null; requirements: { items: string[] } }
function SceneForm({ scene, title, busy, onSave, onCancel, onDirty }: { scene?: Scene; title: string; busy: boolean; onSave: (input: SceneInput) => Promise<void>; onCancel: () => void; onDirty: (dirty: boolean) => void }) {
  const initial = useMemo(() => ({ title: scene?.title ?? '', scene_number: scene?.scene_number ?? '', setting: scene?.setting ?? '', sequence_label: scene?.sequence_label ?? '',
    notes: scene?.notes ?? '', requirements: scene?.requirements.items.join('\n') ?? '' }), [scene]);
  const [form, setForm] = useState(initial);
  const changed = JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => { onDirty(changed); }, [changed, onDirty]);
  const field = (key: keyof typeof form, label: string, options: { multiline?: boolean; max: number; hint?: string }) => <div className="field">
    <label htmlFor={`scene-${scene?.id ?? 'new'}-${key}`}>{label}</label>
    {options.multiline ? <textarea id={`scene-${scene?.id ?? 'new'}-${key}`} rows={3} maxLength={options.max} value={form[key]} dir="auto" onChange={event => setForm({ ...form, [key]: event.target.value })} />
      : <input id={`scene-${scene?.id ?? 'new'}-${key}`} maxLength={options.max} value={form[key]} dir="auto" onChange={event => setForm({ ...form, [key]: event.target.value })} />}
    {options.hint && <span className="small muted">{options.hint}</span>}</div>;
  const blank = (value: string) => value.trim() ? value.trim() : null;
  return <form className="scene-form" aria-label={title} onSubmit={event => { event.preventDefault(); if (!form.title.trim() || busy) return;
    void onSave({ title: form.title.trim(), scene_number: blank(form.scene_number), setting: blank(form.setting), sequence_label: blank(form.sequence_label), notes: blank(form.notes), requirements: { items: requirementLines(form.requirements) } }); }}>
    <h3>{title}</h3>
    <div className="form-grid-2">{field('scene_number', 'Scene number', { max: 40, hint: 'For example 3 or 3A. Renumbering never changes casting.' })}{field('title', 'Title', { max: 300 })}
      {field('setting', 'Setting', { max: 300, hint: 'For example INT. KITCHEN – NIGHT.' })}{field('sequence_label', 'Sequence', { max: 300 })}</div>
    {field('requirements', 'Scene requirements', { multiline: true, max: 26000, hint: 'One per line. Shown with the specs; role requirements stay on each role.' })}
    {field('notes', 'Notes', { multiline: true, max: 4000 })}
    <div className="button-row"><button className="button button-primary button-small" type="submit" disabled={busy || !form.title.trim() || (!!scene && !changed)}>{busy ? 'Saving…' : 'Save scene'}</button>
      <button className="button button-small button-quiet" type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}

interface DetailProps {
  scene: Scene; data: SceneData; canWrite: boolean; busy: boolean; editing: boolean; index: number;
  onEdit: () => void; onCancelEdit: () => void; onDirty: (dirty: boolean) => void; onSave: (input: SceneInput) => Promise<void>;
  onMove: (delta: -1 | 1) => void; onRemove: () => void;
  onReview: (decision: 'confirm' | 'reject', sceneIds: string[], occurrenceIds: string[]) => Promise<void>;
  onLink: (input: { role_id: string }, label: string) => Promise<void>; onCreateRole: (name: string, headcount: number | null) => Promise<void>;
  onUpdateOccurrence: (occurrence: SceneOccurrence, input: { deck_placement?: SceneDeckPlacement; display_title?: string | null; setting_override?: string | null; presentation_note?: string | null; slot_ids?: string[] }) => Promise<void>;
  onUnlink: (occurrence: SceneOccurrence) => Promise<void>; onCastRole: (roleId: string) => void;
}
function SceneDetail(props: DetailProps) {
  const { scene, data, canWrite, busy, editing, index } = props;
  const proposed = scene.occurrences.filter(item => item.status === 'proposed');
  return <article className="scene-card" aria-labelledby={`scene-${scene.id}-title`}>
    {editing ? <SceneForm scene={scene} title={`Edit ${sceneName(scene)}`} busy={busy} onSave={props.onSave} onCancel={props.onCancelEdit} onDirty={props.onDirty} />
      : <header className="scene-card-head">
        <div><p className="eyebrow small">{scene.scene_number ? `Scene ${scene.scene_number}` : `Scene ${index + 1} in order`}{scene.sequence_label && ` · ${scene.sequence_label}`}</p>
          <h3 id={`scene-${scene.id}-title`} dir="auto">{scene.title}</h3>{scene.setting && <p className="small muted" dir="auto">{scene.setting}</p>}</div>
        {canWrite && <div className="button-row scene-actions">
          <button className="button button-small button-quiet" type="button" disabled={busy || index === 0} aria-label={`Move ${sceneName(scene)} earlier`} onClick={() => props.onMove(-1)}><Icon name="chevron-up" /></button>
          <button className="button button-small button-quiet" type="button" disabled={busy || index === data.scenes.length - 1} aria-label={`Move ${sceneName(scene)} later`} onClick={() => props.onMove(1)}><Icon name="chevron-down" /></button>
          <button className="button button-small" type="button" disabled={busy} onClick={props.onEdit}>Edit scene</button>
          <button className="button button-small button-danger-quiet" type="button" disabled={busy} onClick={props.onRemove}><Icon name="trash" />Remove scene</button></div>}
      </header>}
    {scene.status === 'proposed' && <ProposalBar label="This scene was proposed from the specs." refs={scene.source_refs} canWrite={canWrite} busy={busy}
      onConfirm={() => props.onReview('confirm', [scene.id], proposed.filter(item => !item.proposal_stale).map(item => item.id))}
      onReject={() => props.onReview('reject', [scene.id], [])} confirmLabel={proposed.length ? 'Confirm scene and its links' : 'Confirm scene'} />}
    {scene.requirements.items.length > 0 && <section aria-label="Scene requirements"><h4 className="small">Scene requirements</h4><ul className="scene-requirements">{scene.requirements.items.map((item, n) => <li key={n} dir="auto">{item}</li>)}</ul></section>}
    {scene.notes && <p className="small" dir="auto">{scene.notes}</p>}
    <section className="scene-roles" aria-label={`Roles in ${sceneName(scene)}`}>
      <h4>Roles in this scene</h4>
      {scene.occurrences.length === 0 && <p className="small muted">No roles linked yet.</p>}
      <ul className="scene-role-list">{scene.occurrences.map(occurrence => <li key={occurrence.id}><OccurrenceCard occurrence={occurrence} scene={scene} data={data} canWrite={canWrite} busy={busy}
        onReview={props.onReview} onUpdate={input => props.onUpdateOccurrence(occurrence, input)} onUnlink={() => props.onUnlink(occurrence)} onCastRole={() => props.onCastRole(occurrence.role_id)} /></li>)}</ul>
      {canWrite && <AddRole scene={scene} data={data} busy={busy} onLink={props.onLink} onCreateRole={props.onCreateRole} />}
    </section>
  </article>;
}

function ProposalBar({ label, refs, canWrite, busy, onConfirm, onReject, confirmLabel = 'Confirm', stale }: { label: string; refs: Scene['source_refs']; canWrite: boolean; busy: boolean; onConfirm: () => void; onReject: () => void; confirmLabel?: string; stale?: boolean }) {
  const quotes = refs.map(ref => ref.quote).filter((quote): quote is string => !!quote);
  return <div className={`notice ${stale ? 'notice-warning' : 'notice-info'} scene-proposal`} role="group" aria-label="Proposal from the specs">
    <p><span className="badge badge-warn">Proposed</span> {label}</p>
    {quotes.length > 0 && <blockquote className="small" dir="auto">“{quotes.slice(0, 2).join('” … “')}”</blockquote>}
    {stale && <p className="small">The role was renamed or its requirements changed after this proposal. Check it before confirming.</p>}
    {canWrite && <div className="button-row"><button className="button button-small" type="button" disabled={busy || stale} onClick={onConfirm}>{confirmLabel}</button>
      <button className="button button-small button-quiet" type="button" disabled={busy} onClick={onReject}>Reject</button></div>}
  </div>;
}

function OccurrenceCard({ occurrence, scene, data, canWrite, busy, onReview, onUpdate, onUnlink, onCastRole }: { occurrence: SceneOccurrence; scene: Scene; data: SceneData; canWrite: boolean; busy: boolean;
  onReview: DetailProps['onReview']; onUpdate: (input: Parameters<DetailProps['onUpdateOccurrence']>[1]) => Promise<void>; onUnlink: () => Promise<void>; onCastRole: () => void }) {
  const progress = roleProgress(occurrence, data.slots, data.assignments);
  const appearance = appearanceText(occurrence.role_id, data.scenes);
  const recurring = data.scenes.filter(item => item.occurrences.some(o => o.role_id === occurrence.role_id)).length > 1;
  const roleSlots = data.slots.filter(slot => slot.role_id === occurrence.role_id).sort((a, b) => a.sort_order - b.sort_order);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ display_title: occurrence.display_title ?? '', setting_override: occurrence.setting_override ?? '', presentation_note: occurrence.presentation_note ?? '',
    deck_placement: occurrence.deck_placement, slot_ids: occurrence.slot_ids });
  const name = occurrence.display_title || occurrence.role_name || 'Unnamed role';
  return <article className="scene-role-card" aria-label={name} data-draft-focus={`role:${occurrence.role_id}`}>
    <div className="scene-role-head"><div><h5 dir="auto">{name}</h5>{occurrence.display_title && occurrence.display_title !== occurrence.role_name && <p className="small muted" dir="auto">Role: {occurrence.role_name}</p>}
      {appearance && <p className={`small ${recurring ? 'scene-recurring' : 'muted'}`}>{appearance}{recurring && ' · one shared casting'}</p>}</div>
      {occurrence.status === 'confirmed' && <span className={`badge ${progress.cast ? 'badge-ok' : 'badge-outline'}`}>{progress.slots === 0 ? 'No slots' : progress.cast ? 'Main chosen' : `Main ${progress.mainChosen}/${progress.slots}`}</span>}</div>
    {occurrence.status === 'proposed' ? <ProposalBar label={`${occurrence.role_name || 'This role'} was proposed for this scene.`} refs={occurrence.source_refs} canWrite={canWrite} busy={busy} stale={occurrence.proposal_stale}
      onConfirm={() => void onReview('confirm', scene.status === 'proposed' ? [scene.id] : [], [occurrence.id])} onReject={() => void onReview('reject', [], [occurrence.id])} />
      : <>
        <p className="small scene-role-progress">{progress.options} {progress.options === 1 ? 'option' : 'options'} · {progress.backups} backup · {progress.shortlisted} shortlisted
          {occurrence.slot_ids.length > 0 && ` · ${progress.slots} of ${roleSlots.length} slots shown here`}</p>
        <p className="small muted">{placementLabel[occurrence.deck_placement]}{occurrence.setting_override && ` · Setting here: ${occurrence.setting_override}`}</p>
        <div className="button-row">
          <button className="button button-small" type="button" onClick={onCastRole} aria-describedby={appearance ? `appear-${occurrence.id}` : undefined}>Cast this role<Icon name="arrow" /></button>
          {appearance && <span id={`appear-${occurrence.id}`} className="sr-only">{`${appearance}. Casting changes apply to every scene of this role.`}</span>}
          {canWrite && <button className="button button-small button-quiet" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>Presentation in this scene</button>}
          {canWrite && <button className="button button-small button-danger-quiet" type="button" disabled={busy} onClick={() => void onUnlink()}>Remove from scene</button>}
        </div>
        {open && canWrite && <form className="scene-occurrence-form" aria-label={`Presentation of ${name} in this scene`} onSubmit={event => { event.preventDefault();
          void onUpdate({ display_title: form.display_title.trim() || null, setting_override: form.setting_override.trim() || null, presentation_note: form.presentation_note.trim() || null,
            deck_placement: form.deck_placement, slot_ids: form.slot_ids }).then(() => setOpen(false)); }}>
          <p className="small muted">These settings only change how this scene is presented. Casting stays shared by every scene of the role.</p>
          <div className="form-grid-2">
            <div className="field"><label htmlFor={`occ-${occurrence.id}-title`}>Title in this scene</label><input id={`occ-${occurrence.id}-title`} maxLength={300} value={form.display_title} placeholder={occurrence.role_name} onChange={event => setForm({ ...form, display_title: event.target.value })} /></div>
            <div className="field"><label htmlFor={`occ-${occurrence.id}-setting`}>Setting in this scene</label><input id={`occ-${occurrence.id}-setting`} maxLength={300} value={form.setting_override} placeholder={scene.setting ?? 'Not provided'} onChange={event => setForm({ ...form, setting_override: event.target.value })} /></div>
          </div>
          <div className="field"><label htmlFor={`occ-${occurrence.id}-note`}>Presentation note</label><input id={`occ-${occurrence.id}-note`} maxLength={500} value={form.presentation_note} onChange={event => setForm({ ...form, presentation_note: event.target.value })} /></div>
          <fieldset className="field"><legend>In the presentation</legend>{(Object.keys(placementLabel) as SceneDeckPlacement[]).map(value => <label key={value} className="choice">
            <input type="radio" name={`occ-${occurrence.id}-placement`} checked={form.deck_placement === value} onChange={() => setForm({ ...form, deck_placement: value })} />{placementLabel[value]}</label>)}</fieldset>
          {roleSlots.length > 1 && <fieldset className="field"><legend>Slots shown in this scene</legend><span className="small muted">None selected = every slot of the role.</span>
            {roleSlots.map(slot => <label key={slot.id} className="choice"><input type="checkbox" checked={form.slot_ids.includes(slot.id)}
              onChange={event => setForm({ ...form, slot_ids: event.target.checked ? [...form.slot_ids, slot.id] : form.slot_ids.filter(id => id !== slot.id) })} />{slot.label}</label>)}</fieldset>}
          <div className="button-row"><button className="button button-small button-primary" type="submit" disabled={busy}>Save for this scene</button><button className="button button-small button-quiet" type="button" onClick={() => setOpen(false)}>Cancel</button></div>
        </form>}
      </>}
  </article>;
}

function AddRole({ scene, data, busy, onLink, onCreateRole }: { scene: Scene; data: SceneData; busy: boolean; onLink: DetailProps['onLink']; onCreateRole: DetailProps['onCreateRole'] }) {
  const [mode, setMode] = useState<'closed' | 'existing' | 'new'>('closed'); const [roleId, setRoleId] = useState(''); const [name, setName] = useState(''); const [count, setCount] = useState('1');
  const linked = useMemo(() => new Set(scene.occurrences.map(item => item.role_id)), [scene.occurrences]);
  const choices = roleChoices(data.roles, data.scenes, data.slots, linked); const chosen = choices.find(item => item.id === roleId);
  const sameName = name.trim() ? data.roles.filter(role => role.name.trim().toLowerCase() === name.trim().toLowerCase()) : [];
  if (mode === 'closed') return <div className="button-row scene-add-role"><button className="button button-small" type="button" disabled={busy} onClick={() => setMode('existing')}><Icon name="plus" />Add a role to this scene</button></div>;
  return <fieldset className="scene-add-role-form"><legend>Add a role to {sceneName(scene)}</legend>
    <div className="segmented" role="radiogroup" aria-label="Which role">
      <label><input type="radio" name={`add-${scene.id}`} checked={mode === 'existing'} onChange={() => setMode('existing')} />Same character as an existing role</label>
      <label><input type="radio" name={`add-${scene.id}`} checked={mode === 'new'} onChange={() => setMode('new')} />A new, separately cast role</label></div>
    {mode === 'existing' ? <>
      <p className="small muted">The scene shares this role’s slots, Main, Options, Backups and shortlist. Roles are never matched by name — pick the exact role.</p>
      <div className="field"><label htmlFor={`add-${scene.id}-role`}>Existing role</label><select id={`add-${scene.id}-role`} value={roleId} onChange={event => setRoleId(event.target.value)}>
        <option value="">Choose a role…</option>{choices.map(item => <option key={item.id} value={item.id}>{item.name} — {item.detail}</option>)}</select></div>
      {chosen && <p className="small scene-recurring" role="note">{chosen.detail.startsWith('Appears') ? `${chosen.detail.split(' · ')[0]}. Its casting will also show in this scene.` : 'This role is not in any scene yet.'}{chosen.duplicateName && ' Another role has the same name; check this is the right one.'}</p>}
      <div className="button-row"><button className="button button-small button-primary" type="button" disabled={busy || !chosen} onClick={() => chosen && void onLink({ role_id: chosen.id }, chosen.name).then(() => { setMode('closed'); setRoleId(''); })}>Add to scene</button>
        <button className="button button-small button-quiet" type="button" onClick={() => setMode('closed')}>Cancel</button></div>
    </> : <>
      <p className="small muted">Creates a new role with its own slots and casting (for example a younger version of a character played by someone else).</p>
      <div className="form-grid-2"><div className="field"><label htmlFor={`add-${scene.id}-name`}>Role name</label><input id={`add-${scene.id}-name`} maxLength={300} value={name} onChange={event => setName(event.target.value)} /></div>
        <div className="field"><label htmlFor={`add-${scene.id}-count`}>People needed</label><input id={`add-${scene.id}-count`} inputMode="numeric" value={count} onChange={event => setCount(event.target.value.replace(/[^0-9]/gu, ''))} /></div></div>
      {sameName.length > 0 && <p className="small notice notice-warning" role="note">A role named “{sameName[0].name}” already exists. This creates a separate role that is cast separately. To share casting, choose “Same character as an existing role”.</p>}
      <div className="button-row"><button className="button button-small button-primary" type="button" disabled={busy || !name.trim()} onClick={() => void onCreateRole(name.trim(), Number(count) > 0 ? Number(count) : null).then(() => { setMode('closed'); setName(''); })}>Create role and add</button>
        <button className="button button-small button-quiet" type="button" onClick={() => setMode('closed')}>Cancel</button></div>
    </>}
  </fieldset>;
}
