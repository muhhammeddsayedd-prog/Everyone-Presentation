'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorMessage, mutation, type Project, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { Icon } from './Icon';
import { useRuntimeMode } from './RuntimeMode';

export function ProjectList() {
  const central = useRuntimeMode() === "supabase";
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      setLoading(true);
      api<Project[]>(`/api/v1/projects?q=${encodeURIComponent(query)}&limit=25`).then(result => {
        if (current) { setProjects(result.data); setCursor(result.page?.next_cursor ?? null); setError(''); }
      }).catch(reason => { if (current) setError(errorMessage(reason)); }).finally(() => { if (current) setLoading(false); });
    }, 180);
    return () => { current = false; clearTimeout(timer); };
  }, [query, refresh]);

  async function open(project: Project) {
    setOpening(project.id); setError('');
    try {
      const workspace = project.casting_workspace_id ? (await api<Workspace>(`/api/v1/workspaces/${project.casting_workspace_id}`)).data : (await api<Workspace>('/api/v1/workspaces', mutation('POST', { project_id: project.id, initial_output: 'selection' }))).data;
      router.push(`/projects/${project.id}/casting/${workspace.id}/project`);
    } catch (reason) { setError(errorMessage(reason)); setOpening(null); }
  }

  async function loadMore() {
    if (!cursor) return;
    try {
      const result = await api<Project[]>(`/api/v1/projects?q=${encodeURIComponent(query)}&limit=25&cursor=${encodeURIComponent(cursor)}`);
      setProjects(previous => [...previous, ...result.data]); setCursor(result.page?.next_cursor ?? null);
    } catch (reason) { setError(errorMessage(reason)); }
  }

  return <>
    <header className="page-heading"><div><h1>Projects</h1><p>Prepare casting presentations from your existing projects.</p></div><span className="badge">Casting workspace</span></header>
    <div className="search-line"><label className="search-field"><Icon name="search" /><span className="sr-only">Search projects or clients</span><input type="search" placeholder="Search projects or clients" value={query} onChange={event => setQuery(event.target.value)} /></label><span className="small muted">Your authorized projects</span></div>
    {error && <ErrorNotice message={error} retry={() => setRefresh(value => value + 1)} />}
    {loading ? <Loading label="Finding your projects…" /> : projects.length ? <div className="project-table"><div className="project-table-head"><span>Project / client</span><span>Presentation workspace</span><span>Action</span></div>{projects.map(project => <div className="project-row" key={project.id}><div className="project-identity"><div className="project-monogram" aria-hidden="true">{project.name.slice(0, 1)}</div><div><h2>{project.name}</h2><p>{project.client_name ?? 'Client not provided'}</p></div></div><div className="project-state"><span className="badge">{project.casting_workspace_id ? 'Draft workspace' : 'Ready to prepare'}</span><span className="small muted">Selection &amp; Shortlist</span></div><button className="button button-open" onClick={() => open(project)} disabled={opening !== null}>{opening === project.id ? 'Opening…' : project.casting_workspace_id ? 'Resume casting' : 'Open casting'}<Icon name="arrow" /></button></div>)}</div> : <div className="empty-state"><Icon name="projects" /><h2>{query ? 'No projects match your search.' : 'No accessible projects.'}</h2><p>{query ? 'Try another project or client name.' : 'A project must exist in the central business system and be shared with your acting user.'}</p></div>}
    {cursor && <div className="load-more"><button className="button" onClick={loadMore}>Load more projects</button></div>}
    <div className="section-note"><Icon name="lock" /><p>{central ? "Project access follows your account permissions in Everyone." : "Project access follows your acting user. This development environment contains synthetic projects only."}</p></div>
  </>;
}
