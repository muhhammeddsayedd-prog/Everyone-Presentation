'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, errorMessage, mutation, type Actor, type Project, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { ProjectDetails } from './ProjectDetails';
import { plannedPresentation, presentationTypeLabel } from './project-presentation';
import { Icon } from './Icon';
import { PageFrame } from './shell/PageFrame';
import { CoverThumb } from './shell/Cover';

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
  const status = planned ? 'Planned module' : project.casting_workspace_id ? 'Casting in progress' : 'Casting not started';
  return <PageFrame className="project-overview" panel={{ title: 'Project details', subtitle: 'Shared central record', wide: true, body: <ProjectDetails key={project.id} project={project} onSaved={setProject} onDirtyChange={onDirtyChange} /> }}>
    <Link className="back-link" href="/projects">← Projects</Link>
    <div className="overview-hero">
      <div className="overview-cover"><CoverThumb title={project.name} subtitle={status} client={project.client_name} tone={planned ? 'muted' : 'default'} size="hero" /></div>
      <header className="overview-identity"><span className={`badge ${planned ? 'badge-pending' : project.casting_workspace_id ? 'badge-dot badge-ok' : 'badge-outline'}`}>{label}{planned ? ' · Planned' : project.casting_workspace_id ? ' · In progress' : ''}</span><h1 dir="auto">{project.name}</h1><p dir="auto">{project.client_name ?? 'Client not provided'}</p></header>
    </div>
    <section className="overview-modules" aria-labelledby="overview-modules-heading"><h2 id="overview-modules-heading" className="panel-eyebrow">Presentation modules</h2>
      <div className="module-grid">
        <article className={`module-card${planned ? '' : ' module-card-active'}`} aria-labelledby="overview-presentation-heading">
          <header><span className="quick-action-icon"><Icon name={planned ? 'layers' : 'board'} /></span><div><h3 id="overview-presentation-heading">{label} presentation</h3><p>{planned ? 'Planned module' : 'Cast Selection and Cast Shortlist'}</p></div></header>
          {planned ? <><p>This shared project is saved. {label} preparation and generation are Planned.</p><p className="small muted">You can update the shared project details and return from Projects. No presentation has been generated.</p></>
            : <><p>Prepare Cast Selection and Cast Shortlist in one connected Casting workspace.</p>{!project.casting_workspace_id && <div className="field"><label htmlFor="project-initial-output">Start with</label><select id="project-initial-output" value={output} disabled={opening || !canStart} onChange={event => setOutput(event.target.value as 'selection' | 'shortlist')}><option value="selection">Cast Selection</option><option value="shortlist">Cast Shortlist</option></select></div>}
              <div><button className="button button-primary" disabled={opening || !project.casting_workspace_id && !canStart} onClick={() => void openCasting()}>{opening ? 'Opening…' : project.casting_workspace_id ? 'Resume casting' : 'Start casting'}<Icon name="arrow" /></button></div>{!project.casting_workspace_id && !canStart && <p className="permission-note">Starting Casting requires workspace write permission. Your shared project is saved.</p>}</>}
          {error && <ErrorNotice message={error} />}
        </article>
        {(['Wardrobe', 'Art direction', 'Storyboard'] as const).filter(name => name !== label).map(name => <article key={name} className="module-card module-card-planned" aria-label={`${name} · Planned`}><header><span className="quick-action-icon"><Icon name="layers" /></span><div><h3>{name}</h3><p>Planned module</p></div></header><p className="small muted">Not available yet. Nothing is generated for this module.</p></article>)}
      </div>
    </section>
  </PageFrame>;
}
