'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role, Spec } from '@eps/domain';
import { api, ApiError, errorMessage, mutation } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { Clarifications, RoleEditor } from './RoleEditor';
import { roleCreate } from './specs-form';
import { Icon } from './Icon';

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

export function SpecsView({ workspaceId, projectId, canWrite, onDirtyChange, onWorkspaceChanged }: {
  workspaceId: string; projectId: string; canWrite: boolean; onDirtyChange: (dirty: boolean) => void; onWorkspaceChanged: () => void;
}) {
  const [spec, setSpec] = useState<Spec | null>(null); const [roles, setRoles] = useState<Role[]>([]);
  const [cursor, setCursor] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(''); const [refresh, setRefresh] = useState(0);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const dirtyChanged = useCallback((id: string, value: boolean) => setDirty(current => current[id] === value ? current : { ...current, [id]: value }), []);
  const hasUnsaved = Object.values(dirty).some(Boolean);
  useEffect(() => { onDirtyChange(hasUnsaved); return () => onDirtyChange(false); }, [hasUnsaved, onDirtyChange]);
  useEffect(() => {
    let current = true; const abort = new AbortController(); const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(20_000)]);
    Promise.all([api<Spec>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/specs`, { signal }),
      api<Role[]>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/roles?limit=25`, { signal })]).then(([specResult, roleResult]) => {
      if (current) { setSpec(specResult.data); setRoles(roleResult.data); setCursor(roleResult.page?.next_cursor ?? null); setError(''); }
    }).catch(reason => { if (current) setError(errorMessage(reason)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; abort.abort(); };
  }, [workspaceId, refresh]);
  function reload() {
    if (hasUnsaved && !window.confirm('Discard unsaved requirement changes and reload the saved details?')) return;
    setLoading(true); setRefresh(value => value + 1);
  }
  function roleSaved(next: Role) {
    setRoles(current => {
      const old = current.find(role => role.id === next.id);
      if (old && old.row_version > next.row_version) return current;
      return [...current.filter(role => role.id !== next.id), next].sort((left, right) => left.sort_order - right.sort_order || left.id.localeCompare(right.id));
    });
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
  return <div className="specs-view">{error && <ErrorNotice message={error} retry={reload} />}
    <section className="editor-section"><div className="section-heading"><div><h2>Source brief</h2><p>Automatic document and text extraction is not available yet. {canWrite ? 'Enter requirements manually below.' : 'Saved requirements are shown below.'}</p></div><span className="badge">{canWrite ? 'Manual entry available' : 'Read-only requirements'}</span></div>
      {spec.source_text ? <details className="source-brief"><summary>Read the supplied source</summary><pre dir="auto">{spec.source_text}</pre></details> : <p className="small muted">{spec.source_asset_id ? 'A source document is recorded.' : 'No source brief supplied.'}</p>}
      {spec.processing_job_id && <Link className="small" href={`/processing?job=${encodeURIComponent(spec.processing_job_id)}`}>View source processing</Link>}
    </section>
    <Instructions key={`${spec.id}/${refresh}`} spec={spec} canWrite={canWrite} onSaved={next => { setSpec(current => current && current.row_version > next.row_version ? current : next); onWorkspaceChanged(); }} onDirtyChange={dirtyChanged} />
    <section className="editor-section"><div className="section-heading"><div><h2>Roles and individual slots</h2><p>A role may cover several scenes. Its headcount determines the number of slots.</p></div><button className="button button-small button-quiet" onClick={reload}>Reload saved requirements</button></div>
      {roles.length ? <div className="role-list">{roles.map(role => <RoleEditor key={`${role.id}/${refresh}`} role={role} canWrite={canWrite} onSaved={roleSaved} onArchived={id => setRoles(current => current.filter(role => role.id !== id))} onWorkspaceChanged={onWorkspaceChanged} onDirtyChange={dirtyChanged} onReload={reload} />)}</div>
        : <div className="requirements-empty"><h3>No casting requirements yet</h3><p className="muted">Add a role when its requirements are available. You can continue while information is missing.</p></div>}
      {cursor && <div className="load-more"><button className="button button-small" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'Loading…' : 'Load more roles'}</button></div>}
    </section>
    {canWrite && <AddRole workspaceId={workspaceId} onCreated={role => { roleSaved(role); onWorkspaceChanged(); }} onDirtyChange={dirtyChanged} />}
    <footer className="workspace-footer"><p className="small muted">Missing requirements do not block preparation.</p><Link className="button button-primary" href={`/projects/${projectId}/casting/${workspaceId}/cast`}>Continue to Candidates<Icon name="arrow" /></Link></footer>
  </div>;
}
