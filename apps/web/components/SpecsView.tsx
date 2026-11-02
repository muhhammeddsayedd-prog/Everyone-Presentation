'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role, Spec, Workspace, ReorderWorkspace } from '@eps/domain';
import { api, ApiError, errorMessage, mutation } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { Clarifications, RoleEditor } from './RoleEditor';
import { roleCreate } from './specs-form';
import { Icon } from './Icon';
import { prepareRoleMove, readRoleOrder, type RoleOrderReader } from './role-order-form';
import { SourceIntake } from './SourceIntake';
import { SpecsProcessing } from './SpecsProcessing';
import { RetirementUndo } from './RetirementUndo';
import { useConfirm } from './ui/Confirm';

function Instructions({ spec, canWrite, onSaved, onDirtyChange }: { spec: Spec; canWrite: boolean; onSaved: (spec: Spec) => void; onDirtyChange: (id: string, dirty: boolean) => void }) {
  const [text, setText] = useState(spec.normalized_instructions ?? '');
  const [clarifications, setClarifications] = useState(() => structuredClone(spec.clarifications));
  const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  const intent = useRef<{ input: string; key: string } | null>(null);
  const dirty = text !== (spec.normalized_instructions ?? '') || JSON.stringify(clarifications) !== JSON.stringify(spec.clarifications);
  useEffect(() => { onDirtyChange('spec-instructions', dirty || saving); return () => onDirtyChange('spec-instructions', false); }, [dirty, saving, onDirtyChange]);
  async function save() {
    if (!dirty || saving || !canWrite) return;
    const submittedText = text; const submittedMarkers = clarifications;
    const input = { row_version: spec.row_version, normalized_instructions: text.trim() ? text : null, clarifications };
    const serialized = JSON.stringify(input);
    if (intent.current?.input !== serialized) intent.current = { input: serialized, key: crypto.randomUUID() };
    setSaving(true); setError('');
    try {
      const result = await api<Spec>(`/api/v1/workspaces/${encodeURIComponent(spec.workspace_id)}/specs`, { ...mutation('PATCH', input), signal: AbortSignal.timeout(20_000), headers: { 'Idempotency-Key': intent.current.key } });
      onSaved(result.data);
      setText(current => current === submittedText ? result.data.normalized_instructions ?? '' : current);
      setClarifications(current => JSON.stringify(current) === JSON.stringify(submittedMarkers) ? structuredClone(result.data.clarifications) : current);
      intent.current = null; setSaved(true);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }
  useEffect(() => {
    if (!dirty || saving || error || !canWrite) return;
    const timer = setTimeout(() => { void save(); }, 800); return () => clearTimeout(timer);
  });
  return <section className="editor-section"><div className="section-heading"><div><h2>General requirements</h2><p>Keep project-wide instructions separate from each role.</p></div>
    <span className="save-state" role="status" aria-live="polite">{saving ? 'Saving…' : error ? 'Could not save' : dirty ? 'Unsaved changes' : saved ? 'Saved' : 'Up to date'}</span></div>
    <div className="field"><label htmlFor="spec-instructions">General instructions</label><textarea id="spec-instructions" rows={4} dir="auto" placeholder="Not provided" value={text} readOnly={!canWrite} onChange={event => { setText(event.target.value); setSaved(false); }} /></div>
    <Clarifications level={3} entries={clarifications} disabled={!canWrite} onChange={value => { setClarifications(value); setSaved(false); }} />
    {error && <ErrorNotice message={error} retry={save} />}
    {canWrite && dirty && <button className="button button-small" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save instructions'}</button>}
  </section>;
}

function AddRole({ workspaceId, onCreated, onDirtyChange }: { workspaceId: string; onCreated: (role: Role) => void; onDirtyChange: (id: string, dirty: boolean) => void }) {
  const [name, setName] = useState(''); const [count, setCount] = useState(''); const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [uncertain, setUncertain] = useState(false);
  const intent = useRef<{ input: string; key: string } | null>(null);
  useEffect(() => { onDirtyChange('new-role', Boolean(name || count || category || saving || uncertain)); return () => onDirtyChange('new-role', false); }, [name, count, category, saving, uncertain, onDirtyChange]);
  async function create() {
    if (saving) return;
    let input;
    try { input = roleCreate(name, count, category); }
    catch (reason) { setError(errorMessage(reason)); return; }
    try {
      const serialized = JSON.stringify(input);
      if (intent.current?.input !== serialized) intent.current = { input: serialized, key: crypto.randomUUID() };
      setSaving(true); setError('');
      const result = await api<Role>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/roles`, { ...mutation('POST', input), signal: AbortSignal.timeout(20_000), headers: { 'Idempotency-Key': intent.current.key } });
      onCreated(result.data); setName(''); setCount(''); setCategory(''); setUncertain(false); intent.current = null;
    } catch (reason) {
      setError(errorMessage(reason));
      // A transport failure may follow a committed insert. Keep its exact intent
      // for Retry; do not turn an uncertain outcome into a second create.
      setUncertain(!(reason instanceof ApiError) || reason.status >= 500);
    } finally { setSaving(false); }
  }
  return <form className="editor-section add-role" onSubmit={event => { event.preventDefault(); void create(); }}><div className="section-heading"><div><h2>Add a role</h2><p>Leave the count blank when it is unknown. One provisional slot will keep preparation moving.</p></div></div>
    <div className="form-grid"><div className="field"><label htmlFor="new-role-name">New role name</label><input id="new-role-name" value={name} disabled={saving || uncertain} placeholder="Not provided" onChange={event => setName(event.target.value)} /></div>
      <div className="field"><label htmlFor="new-role-count">Headcount</label><input id="new-role-count" type="number" min="1" step="1" value={count} disabled={saving || uncertain} placeholder="Needs clarification" onChange={event => setCount(event.target.value)} /></div>
      <div className="field"><label htmlFor="new-role-category">Classification</label><input id="new-role-category" value={category} disabled={saving || uncertain} placeholder="Not provided" onChange={event => setCategory(event.target.value)} /></div></div>
    {error && <ErrorNotice message={error} />}{uncertain && <p className="small muted">The save could not be confirmed. Retry this request or reload the saved requirements before adding another role.</p>}
    <button className="button button-small" type="submit" disabled={saving}>{saving ? 'Adding…' : uncertain ? 'Retry adding this role' : 'Add role'}</button>
  </form>;
}

export function SpecsView({ workspaceId, projectId, canWrite, uploadPurposes = [], storageOrigin, onDirtyChange, onWorkspaceChanged }: {
  workspaceId: string; projectId: string; canWrite: boolean; uploadPurposes?: readonly string[]; storageOrigin?: string; onDirtyChange: (dirty: boolean) => void; onWorkspaceChanged: () => void;
}) {
  const confirm = useConfirm();
  const [spec, setSpec] = useState<Spec | null>(null); const [roles, setRoles] = useState<Role[]>([]);
  const [ordering, setOrdering] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(''); const [refresh, setRefresh] = useState(0);
  const [reordering, setReordering] = useState(false); const [orderPending, setOrderPending] = useState(false);
  const [orderError, setOrderError] = useState(''); const [orderStatus, setOrderStatus] = useState('');
  const [orderNeedsReload, setOrderNeedsReload] = useState(false);
  const [sourceLocked, setSourceLocked] = useState(false); const [sourceEpoch, setSourceEpoch] = useState(0);
  const [retirement, setRetirement] = useState<{ resourceId: string; label: string } | null>(null); const [undoLocked, setUndoLocked] = useState(false);
  const sourceLockChanged = useCallback((locked: boolean) => setSourceLocked(locked), []);
  const rolesHeading = useRef<HTMLHeadingElement>(null); const archiveFocusPending = useRef(false);
  const orderIntent = useRef<{ input: ReorderWorkspace; key: string } | null>(null);
  const orderActive = useRef(false); const orderSequence = useRef(0); const orderAbort = useRef<AbortController | null>(null);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const dirtyChanged = useCallback((id: string, value: boolean) => setDirty(current => current[id] === value ? current : { ...current, [id]: value }), []);
  const retirementDirty = useCallback((value: boolean) => { setUndoLocked(value); dirtyChanged('retirement-undo', value); }, [dirtyChanged]);
  const retired = useCallback((resourceId: string, label: string) => setRetirement({ resourceId, label }), []);
  const otherEdits = Object.entries(dirty).some(([id, value]) => id !== 'retirement-undo' && value) || orderPending || reordering || sourceLocked;
  const hasUnsaved = Object.values(dirty).some(Boolean) || orderPending || reordering;
  const manualEditsPending = Object.entries(dirty).some(([id, value]) => id !== 'spec-source' && value) || orderPending || reordering;
  useEffect(() => () => { orderSequence.current++; orderAbort.current?.abort(); }, [workspaceId]);
  useEffect(() => { onDirtyChange(hasUnsaved); return () => onDirtyChange(false); }, [hasUnsaved, onDirtyChange]);
  useEffect(() => {
    if (!archiveFocusPending.current) return;
    archiveFocusPending.current = false;
    rolesHeading.current?.focus();
  }, [roles]);
  useEffect(() => {
    let current = true; const abort = new AbortController(); const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(20_000)]);
    Promise.all([api<Spec>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/specs`, { signal }),
      api<Role[]>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/roles?limit=25`, { signal })]).then(([specResult, roleResult]) => {
      if (current) { setSpec(specResult.data); setRoles(roleResult.data); setCursor(roleResult.page?.next_cursor ?? null); setError(''); }
    }).catch(reason => { if (current) setError(errorMessage(reason)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; abort.abort(); };
  }, [workspaceId, refresh]);
  async function reload() {
    if (reordering || sourceLocked) return;
    if (hasUnsaved && !await confirm({ title: 'Reload saved requirements?', description: 'Local edits are discarded. An unconfirmed save may already be stored.', confirmLabel: 'Discard edits and reload', danger: true })) return;
    orderIntent.current = null; setOrderPending(false); setOrderError(''); setOrderStatus(''); setOrderNeedsReload(false);
    setLoading(true); setRefresh(value => value + 1);
  }
  function orderReader(signal: AbortSignal): RoleOrderReader {
    return { getWorkspace: async () => (await api<Workspace>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}`, { signal })).data,
      listRoles: async cursor => api<Role[]>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/roles?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal }) };
  }
  async function reorder(roleId?: string, direction?: -1 | 1) {
    if (orderActive.current || !canWrite || (!orderIntent.current && (hasUnsaved || cursor || orderNeedsReload || loadingMore))) return;
    orderActive.current = true; setReordering(true); setOrderError(''); setOrderStatus('');
    const sequence = ++orderSequence.current; const abort = new AbortController(); orderAbort.current = abort;
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(20_000)]);
    let writeConfirmed = false;
    try {
      if (!orderIntent.current) {
        if (!roleId || !direction) return;
        const prepared = await prepareRoleMove(orderReader(signal), workspaceId, roles, roleId, direction);
        if (sequence !== orderSequence.current) return;
        orderIntent.current = { input: prepared.input, key: crypto.randomUUID() }; setOrderPending(true);
      }
      const intent = orderIntent.current;
      const result = await api<Workspace>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/order`, {
        ...mutation('PUT', intent.input), signal, headers: { 'Idempotency-Key': intent.key },
      });
      writeConfirmed = true;
      if (result.data.id !== workspaceId || result.data.project_id !== projectId) throw new Error('The saved workspace could not be confirmed. Reload saved requirements.');
      const snapshot = await readRoleOrder(orderReader(signal), workspaceId);
      if (sequence !== orderSequence.current) return;
      setRoles(snapshot.roles); setCursor(null); orderIntent.current = null; setOrderPending(false);
      setOrderStatus(JSON.stringify(snapshot.roles.map(role => role.id)) === JSON.stringify(intent.input.role_ids)
        ? 'Role order saved.' : 'Role order was saved. Newer role changes are shown.');
      onWorkspaceChanged();
    } catch (reason) {
      if (sequence !== orderSequence.current) return;
      setOrderError(errorMessage(reason));
      if (!orderIntent.current) setOrderNeedsReload(true);
      else if (!writeConfirmed && reason instanceof ApiError && (reason.status < 500 || reason.code === 'FEATURE_NOT_IMPLEMENTED')) {
        orderIntent.current = null; setOrderPending(false); setOrderNeedsReload(reason.status === 409);
      }
    } finally {
      if (sequence === orderSequence.current) { orderActive.current = false; setReordering(false); }
    }
  }
  function roleSaved(next: Role) {
    setRoles(current => {
      const old = current.find(role => role.id === next.id);
      if (old && old.row_version > next.row_version) return current;
      return [...current.filter(role => role.id !== next.id), next].sort((left, right) => left.sort_order - right.sort_order || left.id.localeCompare(right.id));
    });
  }
  function roleArchived(id: string) {
    const label = roles.find(role => role.id === id)?.name || 'Unnamed role';
    // The editor and its modal opener disappear together. Focus after that
    // commit, once the modal's ordinary opener restoration has cleaned up.
    archiveFocusPending.current = true;
    setRoles(current => current.filter(role => role.id !== id));
    setOrderStatus(`Role "${label}" archived.`);
  }
  async function loadMore() {
    if (!cursor || loadingMore) return;
    const requestedCursor = cursor; setLoadingMore(true);
    try {
      const result = await api<Role[]>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/roles?limit=25&cursor=${encodeURIComponent(requestedCursor)}`, { signal: AbortSignal.timeout(20_000) });
      setRoles(current => [...new Map([...current, ...result.data].map(role => [role.id, role])).values()].sort((left, right) => left.sort_order - right.sort_order || left.id.localeCompare(right.id)));
      setCursor(result.page?.next_cursor ?? null);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoadingMore(false); }
  }
  if (loading) return <Loading label="Opening saved requirements…" />;
  if (!spec) return <ErrorNotice message={error || 'Requirements are unavailable.'} retry={reload} />;
  const orderBlocked = hasUnsaved || Boolean(cursor) || loadingMore || orderNeedsReload;
  return <div className="specs-view">{retirement && <RetirementUndo workspaceId={workspaceId} resourceId={retirement.resourceId} label={retirement.label} canWrite={canWrite} disabled={otherEdits} onDirtyChange={retirementDirty} onDismiss={() => setRetirement(null)} onRestored={() => { setRetirement(null); setUndoLocked(false); setLoading(true); setRefresh(value => value + 1); onWorkspaceChanged(); }} />}
    <fieldset className="presentation-read-lock" disabled={undoLocked}>{error && <ErrorNotice message={error} retry={() => void reload()} />}
    <div className="specs-layout">
      <div className="specs-source stack-lg">
        <SourceIntake key={`${workspaceId}/${spec.id}/${refresh}`} spec={spec} canWrite={canWrite} uploadPurposes={uploadPurposes} storageOrigin={storageOrigin} manualEditsPending={manualEditsPending} onDirtyChange={dirtyChanged} onLockChange={sourceLockChanged}
          onPersisted={(saved, savedRoles, nextCursor) => { setSpec(saved); setRoles(savedRoles); setCursor(nextCursor); setSourceEpoch(value => value + 1); onWorkspaceChanged(); }} />
        {spec.processing_job_id && <SpecsProcessing key={`${workspaceId}/${spec.id}/${spec.processing_job_id}`} workspaceId={workspaceId} specId={spec.id} jobId={spec.processing_job_id}
          loadBlocked={hasUnsaved || sourceLocked || loadingMore} onReload={() => void reload()} />}
      </div>
      <div className="specs-editor stack-lg">
        <Instructions key={`${spec.id}/${refresh}/${sourceEpoch}`} spec={spec} canWrite={canWrite && !reordering && !orderPending && !sourceLocked} onSaved={next => { setSpec(current => current && current.row_version > next.row_version ? current : next); onWorkspaceChanged(); }} onDirtyChange={dirtyChanged} />
        <section className="panel roles-panel" aria-labelledby="roles-heading">
          <header className="panel-header"><div><h2 id="roles-heading" ref={rolesHeading} tabIndex={-1}>Roles and individual slots</h2><p className="small muted">{roles.length} {roles.length === 1 ? 'role' : 'roles'}{cursor ? ' loaded' : ''} · A role may cover several scenes. Its headcount determines the number of slots.</p></div>
            <div className="button-row"><button className="button button-small button-quiet" disabled={reordering || sourceLocked} onClick={() => void reload()}><Icon name="refresh" />Reload saved requirements</button>
              {canWrite && roles.length > 1 && <button className="button button-small" aria-expanded={ordering} aria-controls="role-order-panel" onClick={() => setOrdering(value => !value)}><Icon name="order" />{ordering ? 'Done ordering' : 'Change role order'}</button>}</div></header>
          <div className="panel-body stack">
            {ordering && canWrite && roles.length > 1 && <div id="role-order-panel" className="role-order-panel" role="group" aria-label="Role order">
              <p className="small muted">Roles appear in this order in Casting and in presentations. Save any edits and load all roles before changing their order.</p>
              <ol className="order-list">{roles.map((role, index) => <li key={role.id}><span className="order-index" aria-hidden="true">{index + 1}</span><span className="order-name" dir="auto">{role.name || 'Unnamed role'}</span>
                <span className="button-row"><button className="button button-small button-quiet" aria-label={`Move ${role.name} up`} disabled={index === 0 || orderBlocked} onClick={() => { void reorder(role.id, -1); }}><Icon name="chevron-up" />Move up</button>
                  <button className="button button-small button-quiet" aria-label={`Move ${role.name} down`} disabled={index === roles.length - 1 || orderBlocked} onClick={() => { void reorder(role.id, 1); }}><Icon name="chevron-down" />Move down</button></span></li>)}</ol>
            </div>}
            <p className="save-state" role="status" aria-live="polite">{reordering ? 'Saving role order…' : orderStatus}</p>
            {orderError && <ErrorNotice message={orderError} retry={orderPending ? () => { void reorder(); } : undefined} />}
            {orderPending && !reordering && <p className="small muted">The order could not be confirmed. Retry this same change or reload the saved requirements before editing.</p>}
            {roles.length ? <div className="role-list">{roles.map(role => <RoleEditor key={`${role.id}/${refresh}/${sourceEpoch}`} role={role} canWrite={canWrite && !reordering && !orderPending && !sourceLocked && !undoLocked} onSaved={roleSaved} onArchived={roleArchived} onWorkspaceChanged={onWorkspaceChanged} onDirtyChange={dirtyChanged} onReload={() => void reload()} onRetired={retired} />)}</div>
              : <div className="requirements-empty"><h3>No casting requirements yet</h3><p className="muted">Add a role when its requirements are available. You can continue while information is missing.</p></div>}
            {cursor && <div className="load-more"><button className="button button-small" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'Loading…' : 'Load more roles'}</button></div>}
          </div>
        </section>
        {canWrite && !reordering && !orderPending && !sourceLocked && <AddRole workspaceId={workspaceId} onCreated={role => { roleSaved(role); onWorkspaceChanged(); }} onDirtyChange={dirtyChanged} />}
      </div>
    </div>
    <footer className="sticky-bar workspace-continue"><p className="small muted">Missing requirements do not block preparation.</p><Link className="button button-primary" href={`/projects/${projectId}/casting/${workspaceId}/cast`}>Continue to Candidates<Icon name="arrow" /></Link></footer>
    </fieldset></div>;
}
