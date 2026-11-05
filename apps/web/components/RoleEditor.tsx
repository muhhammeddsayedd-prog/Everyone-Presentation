'use client';

import { useEffect, useRef, useState } from 'react';
import type { Role, SpecsClarification } from '@eps/domain';
import { api, errorMessage, mutation } from './api';
import { ErrorNotice } from './Feedback';
import { rebaseRoleForm, requirementFields, roleForm, rolePatch, type RoleForm } from './specs-form';
import { RoleSlots } from './RoleSlots';
import { CastingRetirementReview } from './CastingRetirementReview';
import { Icon } from './Icon';
import { useDraftValue } from './workspace/WorkspaceDraftProvider';
import { draftKey } from './workspace/draft-review';

export function Clarifications({ entries, disabled, onChange, level = 4 }: { entries: SpecsClarification[]; disabled: boolean; onChange: (entries: SpecsClarification[]) => void; level?: 3 | 4 }) {
  if (!entries.length) return null;
  const Heading = level === 3 ? 'h3' : 'h4';
  return <div className="clarification-list"><Heading>Clarifications</Heading>{entries.map((entry, index) => <div className="clarification-entry" key={`${entry.field_path}/${entry.reason}/${index}`}>
    <label className="radio-line"><input type="checkbox" checked={entry.resolved} disabled={disabled} onChange={event => onChange(entries.map((item, position) => position === index ? { ...item, resolved: event.target.checked } : item))} />
      <span>{entry.resolved ? 'Clarified' : 'Needs clarification'}: {entry.reason}</span></label>
    {entry.source?.quote && <blockquote dir="auto">{entry.source.quote}</blockquote>}
    {entry.source?.page !== null && entry.source?.page !== undefined && <p className="small muted">Source page {entry.source.page}</p>}
  </div>)}</div>;
}

export function RoleEditor({ role, canWrite, onSaved, onArchived, onWorkspaceChanged, onDirtyChange, onReload, onRetired }: {
  role: Role; canWrite: boolean; onSaved: (role: Role) => void; onArchived: (id: string) => void;
  onWorkspaceChanged: () => void; onDirtyChange: (id: string, dirty: boolean) => void; onReload: () => void;
  onRetired?: (resourceId: string, label: string) => void;
}) {
  const [form, setForm] = useState<RoleForm>(() => roleForm(role));
  const [previousRole, setPreviousRole] = useState(role);
  // Count confirmation can update clarification markers outside this editor.
  // Rebase before committing the render so pristine fields never autosave back.
  if (role !== previousRole) {
    setPreviousRole(role);
    setForm(current => rebaseRoleForm(current, roleForm(previousRole), role));
  }
  const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  const [archiveReview, setArchiveReview] = useState(false); const archiving = archiveReview;
  const archiveButton = useRef<HTMLButtonElement>(null); const archiveCancelFocus = useRef(false);
  const intent = useRef<{ key: string; input: string } | null>(null);
  const dirty = JSON.stringify(rolePatch(form, role.row_version)) !== JSON.stringify(rolePatch(roleForm(role), role.row_version));
  useEffect(() => {
    onDirtyChange(role.id, dirty || saving || archiving);
    return () => onDirtyChange(role.id, false);
  }, [role.id, dirty, saving, archiving, onDirtyChange]);
  // The role's slides (headings and Pending requirement pages) follow unsaved edits.
  const draft = rolePatch(form, role.row_version);
  useDraftValue(draftKey.roleName(role.id), draft.name ?? role.name, dirty && draft.name !== role.name);
  useDraftValue(draftKey.roleCategory(role.id), draft.category ?? null, dirty && (draft.category ?? null) !== role.category);
  useDraftValue(draftKey.roleRequirements(role.id), draft.requirements ?? role.requirements, dirty && JSON.stringify(draft.requirements) !== JSON.stringify(role.requirements));
  useEffect(() => {
    if (archiveReview || !archiveCancelFocus.current) return;
    archiveCancelFocus.current = false;
    archiveButton.current?.focus();
  }, [archiveReview]);
  async function save() {
    if (!canWrite || saving || archiving || !dirty) return;
    const submitted = form; const input = rolePatch(submitted, role.row_version); const serialized = JSON.stringify(input);
    if (intent.current?.input !== serialized) intent.current = { key: crypto.randomUUID(), input: serialized };
    setSaving(true); setError('');
    try {
      const result = await api<Role>(`/api/v1/roles/${encodeURIComponent(role.id)}`, { ...mutation('PATCH', input), signal: AbortSignal.timeout(20_000), headers: { 'Idempotency-Key': intent.current.key } });
      onSaved(result.data); onWorkspaceChanged();
      setForm(current => rebaseRoleForm(current, submitted, result.data));
      setSaved(true); intent.current = null;
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }
  useEffect(() => {
    if (!dirty || saving || archiving || error || !canWrite) return;
    const timer = setTimeout(() => { void save(); }, 800);
    return () => clearTimeout(timer);
  });
  function change(patch: Partial<RoleForm>) { setForm(current => ({ ...current, ...patch })); setSaved(false); }
  function archiveSaved(value: unknown) {
    const result = value as { success?: unknown; affected_ids?: unknown } | null;
    if (!result || result.success !== true || !Array.isArray(result.affected_ids) || !result.affected_ids.includes(role.id)) throw new Error('The role archive response could not be confirmed. Retry the same removal.');
    onRetired?.(role.id, 'role removal'); onArchived(role.id); onWorkspaceChanged();
  }
  function cancelArchive() { archiveCancelFocus.current = true; setArchiveReview(false); }
  const label = role.name || 'Unnamed role';
  const summary = [role.category, role.requirements.age_range, role.requirements.gender_requirement, ...role.requirements.languages].filter(value => typeof value === 'string' && value.trim()).join(' · ');
  const openMarkers = form.clarifications.filter(marker => !marker.resolved).length;
  return <article className="role-editor" aria-label={`${label} requirements`} data-draft-focus={`role:${role.id}`}>
    <div className="role-heading"><div className="role-title"><h3 dir="auto">{label}</h3><span className="role-count">{role.headcount === null ? 'Count needs clarification · one provisional slot' : `${role.headcount} ${role.headcount === 1 ? 'slot' : 'slots'}`}</span>
        <p className="small muted role-summary" dir="auto">{summary || 'Requirements not provided'}</p></div>
      <div className="role-flags">{openMarkers > 0 && <span className="badge badge-warn">{openMarkers} to clarify</span>}<span className="save-state" data-state={error ? 'error' : saved && !dirty ? 'saved' : undefined} role="status" aria-live="polite">{saving ? 'Saving…' : error ? 'Could not save' : dirty ? 'Unsaved changes' : saved ? 'Saved' : 'Up to date'}</span></div></div>
    <details className="requirements-details"><summary>Edit requirements</summary><div className="form-grid-3">
      <div className="field" data-draft-field="role_name"><label htmlFor={`role-${role.id}-name`}>Role name</label><input id={`role-${role.id}-name`} value={form.name} readOnly={!canWrite || archiving} placeholder="Not provided" onChange={event => change({ name: event.target.value })} /></div>
      <div className="field" data-draft-field="role_category"><label htmlFor={`role-${role.id}-category`}>Classification</label><input id={`role-${role.id}-category`} value={form.category} readOnly={!canWrite || archiving} placeholder="Not provided" onChange={event => change({ category: event.target.value })} /></div>
      {requirementFields.map(([field, fieldLabel, multiple]) => <div className="field" key={field} data-draft-field={`requirements.${field}`}><label htmlFor={`role-${role.id}-${field}`}>{fieldLabel}</label>
        <textarea id={`role-${role.id}-${field}`} rows={2} value={form.requirements[field]} readOnly={!canWrite || archiving} placeholder="Not provided" dir="auto" onChange={event => {
          const value = event.target.value; setForm(current => ({ ...current, requirements: { ...current.requirements, [field]: value } })); setSaved(false);
        }} />{multiple && <span className="small muted">One entry per line.</span>}</div>)}
    </div><Clarifications entries={form.clarifications} disabled={!canWrite || archiving} onChange={clarifications => change({ clarifications })} />
      {canWrite && <div className="button-row role-actions"><button className="button button-small" disabled={!dirty || saving || archiving} onClick={save}>{saving ? 'Saving…' : 'Save requirements'}</button>
        <button ref={archiveButton} className="button button-small button-danger-quiet" disabled={saving || dirty || archiveReview} onClick={() => setArchiveReview(true)}><Icon name="trash" />Remove role</button></div>}
    </details>
    {error && <><ErrorNotice message={error} /><div className="button-row"><button className="button button-small" disabled={saving || archiving || !dirty} onClick={save}>Retry saving</button><button className="button button-small button-quiet" onClick={onReload}>Reload saved requirements</button></div></>}
    {archiveReview && <CastingRetirementReview key={`${role.id}:${role.row_version}`} workspaceId={role.workspace_id} scope={{ kind: 'role', id: role.id, row_version: role.row_version }}
      scopeLabel={`the role ${label}, its active slots and all their casting assignments`} confirmLabel="Confirm archive" cancelLabel="Keep role"
      request={{ path: `/api/v1/roles/${encodeURIComponent(role.id)}/archive`, body: { row_version: role.row_version, reason: null } }} onSaved={archiveSaved} onCancel={cancelArchive} />}
    <RoleSlots role={role} canWrite={canWrite && !dirty && !saving && !archiving} onRoleSaved={onSaved} onWorkspaceChanged={onWorkspaceChanged} onDirtyChange={onDirtyChange} onRetired={onRetired} />
  </article>;
}
