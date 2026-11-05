'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage, mutation, type Project } from './api';
import { ErrorNotice } from './Feedback';
import { Icon } from './Icon';
import { useRuntimeMode } from './RuntimeMode';
import { useConfirm } from './ui/Confirm';
import { useDraftValue } from './workspace/WorkspaceDraftProvider';
import { draftKey } from './workspace/draft-review';

export function ProjectDetails({ project, onSaved, onDirtyChange }: { project: Project; onSaved: (project: Project) => void | Promise<void>; onDirtyChange: (dirty: boolean) => void }) {
  const runtimeMode = useRuntimeMode();
  const confirm = useConfirm();
  const [name, setName] = useState(project.name);
  const [client, setClient] = useState(project.client_name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const dirty = name !== project.name || client !== (project.client_name ?? '');
  useEffect(() => { onDirtyChange(dirty || saving); return () => onDirtyChange(false); }, [dirty, saving, onDirtyChange]);
  // Inside a workspace the cover follows the name and client while they are typed.
  useDraftValue(draftKey.projectName, name.trim(), name.trim() !== project.name && !!name.trim());
  useDraftValue(draftKey.clientName, client.trim() || null, client !== (project.client_name ?? ''));

  async function save() {
    if (saving || !dirty || !name.trim()) return;
    const submittedName = name;
    const submittedClient = client;
    setSaving(true); setError('');
    try {
      const result = await api<Project>(`/api/v1/projects/${project.id}`, mutation('PATCH', { row_version: project.row_version,
        ...(name.trim() !== project.name ? { name: name.trim() } : {}),
        ...(project.client_id && client.trim() !== (project.client_name ?? '') ? { client_name: client.trim(), expected_client_row_version: project.client_row_version } : {}) }));
      await onSaved(result.data);
      setName(current => current === submittedName ? result.data.name : current);
      setClient(current => current === submittedClient ? result.data.client_name ?? '' : current);
      setSaved(true);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }
  useEffect(() => {
    if (!dirty || saving || error || !name.trim() || !project.can_edit) return;
    const timer = setTimeout(() => { void save(); }, 800);
    return () => clearTimeout(timer);
  });

  async function reload() {
    if (dirty && !await confirm({ title: 'Reload saved project details?', description: 'Your unsaved edits to the project name or client are discarded.', confirmLabel: 'Discard edits and reload', danger: true })) return;
    try { const result = await api<Project>(`/api/v1/projects/${project.id}`); await onSaved(result.data); setName(result.data.name); setClient(result.data.client_name ?? ''); setError(''); setSaved(false); }
    catch (reason) { setError(errorMessage(reason)); }
  }

  const state = saving ? 'saving' : error ? 'error' : saved && !dirty ? 'saved' : 'idle';
  return <section className="panel" aria-labelledby="project-details-heading" data-draft-focus="cover">
    <header className="panel-header"><h2 id="project-details-heading">Shared project details</h2>
      <span className="save-state" data-state={state} role="status" aria-live="polite">{state === 'saved' && <Icon name="check" />}{saving ? 'Saving…' : error ? 'Could not save' : dirty ? 'Unsaved changes' : saved ? 'Saved to the shared project' : 'Up to date'}</span></header>
    <div className="panel-body stack">
      <div className="form-grid">
        <div className="field" data-draft-field="project_name" data-invalid={!name.trim() || undefined}><label htmlFor="project-name">Project name</label><input id="project-name" value={name} maxLength={200} readOnly={!project.can_edit} aria-invalid={!name.trim() || undefined} aria-describedby={!name.trim() ? 'project-name-error' : undefined} onChange={event => { setName(event.target.value); setSaved(false); }} />{!name.trim() && <span id="project-name-error" className="field-error">Enter a project name to save.</span>}</div>
        <div className="field" data-draft-field="client_name"><label htmlFor="client-name">Client name</label><input id="client-name" value={client} maxLength={200} readOnly={!project.can_edit || !project.client_id} onChange={event => { setClient(event.target.value); setSaved(false); }} />{!project.client_id && <span className="field-hint">No client linked to this project.</span>}</div>
      </div>
      <p className="section-note"><Icon name="info" /><span>{runtimeMode === 'local_fixture' ? 'Changes save to the canonical development records.' : 'Edits update the central project and client used by every Everyone app.'}</span></p>
      {!project.can_edit && <p className="permission-note"><Icon name="lock" />Your acting user can view these shared details. Editing requires project write access.</p>}
      {error && <><ErrorNotice message={error} /><div className="button-row"><button className="button" disabled={saving} onClick={save}>Retry saving</button><button className="button button-quiet" onClick={reload}>Reload saved details</button></div></>}
      <details className="technical-details"><summary>Technical details for operators</summary><p className="small muted record-reference">Project reference <span>{project.id}</span></p></details>
    </div>
  </section>;
}
