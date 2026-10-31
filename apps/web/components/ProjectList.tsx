'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PresentationSeries } from '@eps/domain';
import { api, errorMessage, mutation, type Actor, type Project, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { Icon } from './Icon';
import { useRuntimeMode } from './RuntimeMode';
import { StudioDateTime } from './StudioTimeZone';

type Filter = 'all' | 'started' | 'not_started';
const filters: { value: Filter; label: string }[] = [{ value: 'all', label: 'All' }, { value: 'started', label: 'Casting in progress' }, { value: 'not_started', label: 'Not started' }];

export function ProjectList({ actor }: { actor: Actor }) {
  const central = useRuntimeMode() === 'supabase';
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    setLoadingMore(true);
    try {
      const result = await api<Project[]>(`/api/v1/projects?q=${encodeURIComponent(query)}&limit=25&cursor=${encodeURIComponent(cursor)}`);
      setProjects(previous => [...previous, ...result.data]); setCursor(result.page?.next_cursor ?? null);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoadingMore(false); }
  }

  const visible = projects.filter(project => filter === 'all' || (filter === 'started') === Boolean(project.casting_workspace_id));
  const selected = visible.find(project => project.id === selectedId) ?? visible[0] ?? null;
  const canCreate = actor.capabilities?.includes('workspaces.write') ?? true;
  return <div className="projects-page">
    <header className="page-heading"><div><h1>Projects</h1><p>{central ? 'Central projects shared with your account. Open one to prepare its casting presentation.' : 'Prepare casting presentations from your existing projects.'}</p></div></header>
    <div className="split-rail">
      <section aria-label="Project list" className="stack">
        <div className="projects-toolbar">
          <label className="search-field"><Icon name="search" /><span className="sr-only">Search projects or clients</span><input type="search" placeholder="Search projects or clients" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <div className="segmented" role="group" aria-label="Filter loaded projects">{filters.map(item => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div>
        </div>
        {error && <ErrorNotice message={error} retry={() => setRefresh(value => value + 1)} />}
        {loading ? <Loading label="Finding your projects…" /> : visible.length ? <div className="table-scroll"><table className="data-table project-table-redesign">
          <thead><tr><th scope="col">Project</th><th scope="col">Casting</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
          <tbody>{visible.map(project => <tr key={project.id} aria-selected={selected?.id === project.id} className={selected?.id === project.id ? 'is-selected' : undefined}>
            <td><button type="button" className="row-select identity" aria-pressed={selected?.id === project.id} aria-label={`Show details for ${project.name}`} onClick={() => setSelectedId(project.id)}>
              <span className="monogram" aria-hidden="true">{project.name.slice(0, 1)}</span><span><strong>{project.name}</strong><span>{project.client_name ?? 'Client not provided'}</span></span></button></td>
            <td>{project.casting_workspace_id ? <span className="badge badge-dot badge-ok">Workspace started</span> : <span className="badge badge-pending">Not started</span>}</td>
            <td className="num"><button className={`button button-small${selected?.id === project.id ? ' button-primary' : ''}`} onClick={() => open(project)} disabled={opening !== null || (!project.casting_workspace_id && !canCreate)}>{opening === project.id ? 'Opening…' : project.casting_workspace_id ? 'Resume casting' : 'Open casting'}<Icon name="arrow" /></button></td>
          </tr>)}</tbody></table></div>
          : <div className="empty-state"><Icon name="projects" /><h2>{query ? 'No projects match your search.' : projects.length ? 'No projects in this view.' : 'No accessible projects.'}</h2><p>{query ? 'Try another project or client name.' : projects.length ? 'Choose All to show every loaded project.' : 'A project must exist in the central business system and be shared with your acting user.'}</p></div>}
        {cursor && <div className="load-more"><button className="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more projects'}</button></div>}
        <div className="section-note"><Icon name="lock" /><p>{central ? 'Access follows your Everyone account permissions. Projects are created in the central business system.' : 'Project access follows your acting user. This development environment contains synthetic projects only.'}</p></div>
      </section>
      <aside aria-label="Project overview">{selected && !loading ? <ProjectPanel key={selected.id} project={selected} central={central} opening={opening === selected.id} disabled={opening !== null || (!selected.casting_workspace_id && !canCreate)} onOpen={() => open(selected)} /> : null}</aside>
    </div>
  </div>;
}

function ProjectPanel({ project, central, opening, disabled, onOpen }: { project: Project; central: boolean; opening: boolean; disabled: boolean; onOpen: () => void }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [series, setSeries] = useState<PresentationSeries[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(project.casting_workspace_id));
  useEffect(() => {
    if (!project.casting_workspace_id) return;
    const controller = new AbortController();
    const workspaceId = project.casting_workspace_id;
    Promise.all([api<Workspace>(`/api/v1/workspaces/${workspaceId}`, { signal: controller.signal }), central ? api<PresentationSeries[]>(`/api/v1/presentation-series?workspace_id=${workspaceId}&limit=20`, { signal: controller.signal }).then(result => result.data).catch(() => null) : Promise.resolve(null)])
      .then(([saved, list]) => { setWorkspace(saved.data); setSeries(list); setError(''); })
      .catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [project.casting_workspace_id, central]);
  const ready = (series ?? []).filter(item => item.latest_ready_version_no !== null && !item.archived);
  return <div className="panel project-panel">
    <div className="panel-body stack-lg">
      <div className="identity project-panel-identity"><span className="monogram monogram-lg" aria-hidden="true">{project.name.slice(0, 1)}</span><div><h2>{project.name}</h2><span>{project.client_name ?? 'Client not provided'}</span></div></div>
      {!project.casting_workspace_id ? <p className="muted small">No casting workspace yet. Opening casting creates one for this central project; project and client details stay in the central record.</p>
        : loading ? <Loading label="Loading workspace status…" /> : error ? <ErrorNotice message={error} /> : workspace && <>
          <div className="cluster"><span className="badge badge-outline">Casting</span>{workspace.has_unpublished_changes ? <span className="badge badge-dot badge-warn">Unpublished changes</span> : <span className="badge">No unpublished changes</span>}</div>
          <dl className="kv"><dt>Working output</dt><dd>{workspace.active_output === 'shortlist' ? 'Cast Shortlist' : 'Cast Selection'}</dd><dt>Last updated</dt><dd><StudioDateTime value={workspace.updated_at} /></dd><dt>Logo on slides</dt><dd>{workspace.logo_asset_id ? (workspace.logo_placement === 'every_slide' ? 'Every slide' : 'Cover only') : 'No logo selected'}</dd></dl>
          {central && <div className="stack"><h3 className="eyebrow">Presentations</h3>{series === null ? <p className="small muted">Presentation status is unavailable right now.</p> : ready.length ? <ul className="project-panel-series">{ready.map(item => <li key={item.id}><span className="badge badge-dot badge-ok">Ready</span><span>{item.title} v{item.latest_ready_version_no}</span>{item.latest_ready_version_id && <Link className="text-button small" href={`/presentations/versions/${item.latest_ready_version_id}`}>Open</Link>}</li>)}</ul> : <p className="small muted">No ready presentation versions yet.</p>}</div>}
        </>}
      <button type="button" className="button button-primary button-block" onClick={onOpen} disabled={disabled} aria-label={`${project.casting_workspace_id ? 'Resume casting' : 'Open casting'} for ${project.name}`}>{opening ? 'Opening…' : project.casting_workspace_id ? 'Resume casting' : 'Start casting'}<Icon name="arrow" /></button>
      <div className="stack"><h3 className="eyebrow">Other presentation modules</h3><div className="cluster"><span className="badge badge-pending">Wardrobe · Planned</span><span className="badge badge-pending">Art direction · Planned</span><span className="badge badge-pending">Storyboard · Planned</span></div></div>
    </div>
  </div>;
}
