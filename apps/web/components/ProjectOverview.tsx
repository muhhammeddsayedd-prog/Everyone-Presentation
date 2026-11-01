'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, errorMessage, mutation, type Actor, type Project, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { ProjectDetails } from './ProjectDetails';
import { plannedPresentation, presentationTypeLabel } from './project-presentation';

export function ProjectOverview({ projectId, actor, onDirtyChange }: { projectId: string; actor: Actor; onDirtyChange: (dirty: boolean) => void }) {
  const router = useRouter(); const [project, setProject] = useState<Project | null>(null), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  const [opening, setOpening] = useState(false), [output, setOutput] = useState<'selection' | 'shortlist'>('selection');
  useEffect(() => { let current = true; api<Project>(`/api/v1/projects/${encodeURIComponent(projectId)}`).then(result => { if (current) { setProject(result.data); setError(''); } }).catch(reason => { if (current) setError(errorMessage(reason)); }); return () => { current = false; }; }, [projectId, refresh]);
  async function openCasting() {
    if (!project || opening) return; setOpening(true); setError('');
    try { const workspace = project.casting_workspace_id ? (await api<Workspace>(`/api/v1/workspaces/${project.casting_workspace_id}`)).data : (await api<Workspace>('/api/v1/workspaces', mutation('POST', { project_id: project.id, initial_output: output }))).data; router.push(`/projects/${project.id}/casting/${workspace.id}/project`); }
    catch (reason) { setError(errorMessage(reason)); setOpening(false); }
  }
  if (!project) return error ? <ErrorNotice message={error} retry={() => setRefresh(value => value + 1)} /> : <Loading label="Loading project…" />;
  const planned = plannedPresentation(project.presentation_type), label = presentationTypeLabel(project.presentation_type);
  const canStart = actor.capabilities?.includes('workspaces.write') === true;
  return <div className="stack-lg project-overview"><Link className="back-link" href="/projects">← Projects</Link>
    <header className="page-heading"><div><h1>{project.name}</h1><p>{project.client_name ?? 'Client not provided'}</p></div><span className={`badge ${planned ? 'badge-pending' : 'badge-outline'}`}>{label}{planned ? ' · Planned' : ''}</span></header>
    <ProjectDetails key={project.id} project={project} onSaved={setProject} onDirtyChange={onDirtyChange} />
    <section className="panel"><header className="panel-header"><h2>{label} presentation</h2></header><div className="panel-body stack">
      {planned ? <><p>This shared project is saved. {label} preparation and generation are Planned.</p><p className="small muted">You can update the shared project details and return from Projects. No presentation has been generated.</p></>
        : <><p>Prepare Cast Selection and Cast Shortlist in one connected Casting workspace.</p>{!project.casting_workspace_id && <div className="field"><label htmlFor="project-initial-output">Start with</label><select id="project-initial-output" value={output} disabled={opening || !canStart} onChange={event => setOutput(event.target.value as 'selection' | 'shortlist')}><option value="selection">Cast Selection</option><option value="shortlist">Cast Shortlist</option></select></div>}
          <div><button className="button button-primary" disabled={opening || !project.casting_workspace_id && !canStart} onClick={() => void openCasting()}>{opening ? 'Opening…' : project.casting_workspace_id ? 'Resume casting' : 'Start casting'}</button></div>{!project.casting_workspace_id && !canStart && <p className="permission-note">Starting Casting requires workspace write permission. Your shared project is saved.</p>}</>}
      {error && <ErrorNotice message={error} />}
    </div></section>
  </div>;
}
