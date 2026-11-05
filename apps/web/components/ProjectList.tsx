'use client';

import Link from 'next/link';
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import type { PresentationSeries } from '@eps/domain';
import { api, errorMessage, mutation, type Actor, type Project, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { Icon, type IconName } from './Icon';
import { PageFrame, RightPanel } from './shell/PageFrame';
import { CoverThumb } from './shell/Cover';
import { useRecentWorkspaces } from './recent-workspaces';
import { useRuntimeMode } from './RuntimeMode';
import { StudioDateTime } from './StudioTimeZone';
import { SegmentIndicator } from './motion/SegmentIndicator';
import { stagger } from './motion/motion';
import { NewProject } from './NewProject';
import { plannedPresentation, presentationTypeLabel } from './project-presentation';
import { parseProjectCreateIntent, projectCreateIntentSnapshot, subscribeProjectCreateIntent } from '../lib/project-create-intent';

type Filter = 'all' | 'started' | 'not_started';
const filters: { value: Filter; label: string; icon: IconName }[] = [{ value: 'all', label: 'All', icon: 'projects' }, { value: 'started', label: 'Casting in progress', icon: 'board' }, { value: 'not_started', label: 'Not started', icon: 'clock' }];

export function ProjectList({ actor, onDirtyChange }: { actor: Actor; onDirtyChange: (dirty: boolean) => void }) {
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
  const [creating, setCreating] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const recent = useRecentWorkspaces();
  const countId = useId();
  const pending = useSyncExternalStore(subscribeProjectCreateIntent, () => projectCreateIntentSnapshot(actor.id), () => null);
  const pendingIntent = parseProjectCreateIntent(pending);
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
    if (plannedPresentation(project.presentation_type)) { router.push(`/projects/${project.id}`); return; }
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
  const selected = detailsOpen ? visible.find(project => project.id === selectedId) ?? visible[0] ?? null : null;
  const canCreate = actor.capabilities?.includes('workspaces.write') ?? true;
  const canCreateProject = actor.capabilities?.includes('projects.read') === true && actor.capabilities.includes('projects.write');
  const counts: Record<Filter, number> = { all: projects.length, started: projects.filter(project => project.casting_workspace_id).length, not_started: projects.filter(project => !project.casting_workspace_id).length };
  const openLabel = (project: Project) => plannedPresentation(project.presentation_type) ? 'Open project' : project.casting_workspace_id ? 'Resume casting' : 'Open casting';
  const blocked = (project: Project) => opening !== null || (!plannedPresentation(project.presentation_type) && !project.casting_workspace_id && !canCreate);
  const lastWorkspace = recent[0];
  const filtersPanel = <>
    <label className="search-field"><Icon name="search" /><span className="sr-only">Search projects or clients</span><input type="search" placeholder="Search projects or clients" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="panel-section"><h3 className="panel-eyebrow">Show</h3>
      <div className="segmented segmented-vertical" role="group" aria-label="Filter loaded projects"><SegmentIndicator />{filters.map(item => <button key={item.value} type="button" aria-pressed={filter === item.value} aria-describedby={loading ? undefined : `${countId}-${item.value}`} onClick={() => setFilter(item.value)}><Icon name={item.icon} /><span className="segment-label">{item.label}</span>{!loading && <><span className="segment-count" aria-hidden="true">{counts[item.value]}</span><span id={`${countId}-${item.value}`} hidden>{counts[item.value]} loaded</span></>}</button>)}</div>
      {cursor && <p className="small muted">Counts cover the projects loaded so far.</p>}
    </div>
    {recent.length > 0 && <div className="panel-section"><h3 className="panel-eyebrow">Recently opened</h3><ul className="panel-links">{recent.map(item => <li key={item.workspaceId}><Link href={item.href}><Icon name="history" /><span dir="auto">{item.name}</span></Link></li>)}</ul></div>}
    <div className="section-note"><Icon name="lock" /><p>{central ? 'Access follows your Everyone account permissions. New projects save to the shared central records.' : 'Project access follows your acting user. This development environment contains synthetic projects only.'}</p></div>
  </>;
  return <PageFrame className="projects-page" panel={{ title: 'Filters', subtitle: central ? 'Shared central project records' : 'Development project records', label: 'Project filters', body: filtersPanel }}
    right={selected && !loading ? <ProjectPanel key={selected.id} project={selected} central={central} opening={opening === selected.id} disabled={blocked(selected)} onOpen={() => open(selected)} onClose={() => setDetailsOpen(false)} /> : undefined}>
    <header className="page-heading"><div><h1>Projects</h1><p>{central ? 'Shared Everyone projects and their presentations.' : 'Prepare presentations from your development projects.'}</p></div>{canCreateProject && <button type="button" className="button button-primary" onClick={() => setCreating(true)}>{pendingIntent ? 'Resume project creation' : 'New project'}<Icon name="plus" /></button>}</header>
    <div className="quick-actions">
      {lastWorkspace && <Link className="quick-action" href={lastWorkspace.href}><span className="quick-action-icon"><Icon name="board" /></span><span><strong>Resume last workspace</strong><span dir="auto">{lastWorkspace.name}</span></span></Link>}
      <Link className="quick-action" href="/library/cast"><span className="quick-action-icon"><Icon name="people" /></span><span><strong>Cast Library</strong><span>Reusable talent across projects</span></span></Link>
      <Link className="quick-action" href="/presentations"><span className="quick-action-icon"><Icon name="slides" /></span><span><strong>Presentations</strong><span>Saved versions and review links</span></span></Link>
    </div>
    <section aria-label="Project list" className="stack">
      {error && <ErrorNotice message={error} retry={() => setRefresh(value => value + 1)} />}
      {loading ? <Loading label="Finding your projects…" /> : visible.length ? <ul ref={stagger} className="project-grid">{visible.map(project => { const current = selected?.id === project.id; const planned = plannedPresentation(project.presentation_type);
        return <li key={project.id} className={`project-card${current ? ' is-selected' : ''}`}>
          <button type="button" className="project-card-cover" aria-pressed={current} onClick={() => { setSelectedId(project.id); setDetailsOpen(true); }}>
            <span className="sr-only">Show details for {project.name}</span><CoverThumb title={project.name} subtitle={planned ? 'Planned module' : project.casting_workspace_id ? 'Casting in progress' : 'Casting not started'} client={project.client_name} tone={planned ? 'muted' : 'default'} />
          </button>
          <div className="project-card-body">
            <div className="project-card-text"><h2 dir="auto">{project.name}</h2><p dir="auto">{project.client_name ?? 'Client not provided'}</p></div>
            {planned ? <span className="badge badge-pending">{presentationTypeLabel(project.presentation_type)} · Planned</span> : project.casting_workspace_id ? <span className="badge badge-dot badge-ok">Casting in progress</span> : <span className="badge badge-pending">Not started</span>}
          </div>
          <button className={`button button-small project-card-action${current ? ' button-primary' : ''}`} onClick={() => open(project)} disabled={blocked(project)}>{opening === project.id ? 'Opening…' : openLabel(project)}<Icon name="arrow" /></button>
        </li>; })}</ul>
        : <div className="empty-state"><Icon name="projects" /><h2>{query ? 'No projects match your search.' : projects.length ? 'No projects in this view.' : 'No accessible projects.'}</h2><p>{query ? 'Try another project or client name.' : projects.length ? 'Choose All to show every loaded project.' : canCreateProject ? 'Create a shared project to start preparing a presentation.' : 'Projects appear here when they are shared with your acting user.'}</p></div>}
      {cursor && <div className="load-more"><button className="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more projects'}</button></div>}
    </section>
    {creating && <NewProject key={actor.id} actorId={actor.id} pendingIntent={pendingIntent} onClose={() => setCreating(false)} onCreated={project => { setCreating(false); router.push(`/projects/${encodeURIComponent(project.id)}`); }} onDirtyChange={onDirtyChange} />}
  </PageFrame>;
}

function ProjectPanel({ project, central, opening, disabled, onOpen, onClose }: { project: Project; central: boolean; opening: boolean; disabled: boolean; onOpen: () => void; onClose: () => void }) {
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
  const planned = plannedPresentation(project.presentation_type);
  const status = planned ? 'Planned module' : project.casting_workspace_id ? 'Casting in progress' : 'Casting not started';
  return <RightPanel title={<span dir="auto">{project.name}</span>} subtitle={<span dir="auto">{project.client_name ?? 'Client not provided'}</span>} onClose={onClose} closeLabel="Close project details"
    footer={<button type="button" className="button button-primary button-block" onClick={onOpen} disabled={disabled} aria-label={`${planned ? 'Open project' : project.casting_workspace_id ? 'Resume casting' : 'Open casting'} for ${project.name}`}>{opening ? 'Opening…' : planned ? 'Open project' : project.casting_workspace_id ? 'Resume casting' : 'Start casting'}<Icon name="arrow" /></button>}>
    <div className="project-panel-cover"><CoverThumb title={project.name} subtitle={status} client={project.client_name} tone={planned ? 'muted' : 'default'} /></div>
    {planned ? <p className="muted small">{presentationTypeLabel(project.presentation_type)} preparation and generation are Planned. Open this saved project to manage its shared details.</p> : !project.casting_workspace_id ? <p className="muted small">No casting workspace yet. Opening casting creates one for this central project; project and client details stay in the central record.</p>
      : loading ? <Loading label="Loading workspace status…" /> : error ? <ErrorNotice message={error} /> : workspace && <>
        <div className="cluster"><span className="badge badge-outline">Casting</span>{workspace.has_unpublished_changes ? <span className="badge badge-dot badge-warn">Unpublished changes</span> : <span className="badge">No unpublished changes</span>}</div>
        <dl className="kv"><dt>Working output</dt><dd>{workspace.active_output === 'shortlist' ? 'Cast Shortlist' : 'Cast Selection'}</dd><dt>Last updated</dt><dd><StudioDateTime value={workspace.updated_at} /></dd><dt>Logo on slides</dt><dd>{workspace.logo_asset_id ? (workspace.logo_placement === 'every_slide' ? 'Every slide' : 'Cover only') : 'No logo selected'}</dd></dl>
        {central && <div className="stack"><h3 className="panel-eyebrow">Presentations</h3>{series === null ? <p className="small muted">Presentation status is unavailable right now.</p> : ready.length ? <ul className="project-panel-series">{ready.map(item => <li key={item.id}><span className="badge badge-dot badge-ok">Ready</span><span>{item.title} v{item.latest_ready_version_no}</span>{item.latest_ready_version_id && <Link className="text-button small" href={`/presentations/versions/${item.latest_ready_version_id}`}>Open</Link>}</li>)}</ul> : <p className="small muted">No ready presentation versions yet.</p>}</div>}
      </>}
    {!planned && <Link className="text-button small" href={`/projects/${project.id}`}>Shared project overview</Link>}
    <div className="stack"><h3 className="panel-eyebrow">Other presentation modules</h3><div className="cluster"><span className="badge badge-pending">Wardrobe · Planned</span><span className="badge badge-pending">Art direction · Planned</span><span className="badge badge-pending">Storyboard · Planned</span></div></div>
  </RightPanel>;
}
