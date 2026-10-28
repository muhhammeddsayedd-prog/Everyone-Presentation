'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage, mutation, type Project } from './api';
import { ErrorNotice } from './Feedback';
import { useRuntimeMode } from './RuntimeMode';

export function ProjectDetails({ project, onSaved, onDirtyChange }: { project: Project; onSaved: (project: Project) => void | Promise<void>; onDirtyChange: (dirty: boolean) => void }) {
  const runtimeMode = useRuntimeMode();
  const [name, setName] = useState(project.name);
  const [client, setClient] = useState(project.client_name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const dirty = name !== project.name || client !== (project.client_name ?? '');
  useEffect(() => { onDirtyChange(dirty || saving); return () => onDirtyChange(false); }, [dirty, saving, onDirtyChange]);

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
    if (dirty && !window.confirm('Reload saved project details and discard your unsaved edits?')) return;
    try { const result = await api<Project>(`/api/v1/projects/${project.id}`); await onSaved(result.data); setName(result.data.name); setClient(result.data.client_name ?? ''); setError(''); setSaved(false); }
    catch (reason) { setError(errorMessage(reason)); }
  }

  return <section className="editor-section"><div className="section-heading"><div><h2>Shared project details</h2><p>{runtimeMode === "local_fixture" ? "Changes save to the canonical development records." : "Changes save to shared project and client records."}</p></div><span className="save-state" role="status" aria-live="polite">{saving ? 'Saving…' : error ? 'Could not save' : dirty ? 'Unsaved changes' : saved ? 'Saved to the shared project' : 'Up to date'}</span></div><div className="form-grid"><div className="field"><label htmlFor="project-name">Project name</label><input id="project-name" value={name} maxLength={200} readOnly={!project.can_edit} onChange={event => { setName(event.target.value); setSaved(false); }} />{!name.trim() && <span className="field-error">Enter a project name to save.</span>}</div><div className="field"><label htmlFor="client-name">Client name</label><input id="client-name" value={client} maxLength={200} readOnly={!project.can_edit || !project.client_id} onChange={event => { setClient(event.target.value); setSaved(false); }} />{!project.client_id && <span className="small muted">No client linked to this project.</span>}</div></div>{!project.can_edit && <p className="small muted">Your acting user can view these shared details. Editing requires project write access.</p>}{error && <><ErrorNotice message={error} /><div className="button-row"><button className="button" disabled={saving} onClick={save}>Retry saving</button><button className="button button-quiet" onClick={reload}>Reload saved details</button></div></>}<p className="small muted record-reference">Project reference <span>{project.id}</span></p></section>;
}
