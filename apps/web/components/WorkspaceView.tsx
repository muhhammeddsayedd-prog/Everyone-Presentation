'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, errorMessage, mutation, type Actor, type Project, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { ProjectDetails } from './ProjectDetails';
import { LogoPanel } from './LogoPanel';
import { Icon, type IconName } from './Icon';
import { FramePortal } from './shell/Frame';
import { PageFrame } from './shell/PageFrame';
import { LiveStage } from './workspace/LiveStage';
import { WorkspaceDraftProvider } from './workspace/WorkspaceDraftProvider';
import { SpecsView } from './SpecsView';
import { useRuntimeMode } from './RuntimeMode';
import { WorkspaceCandidatesView } from './WorkspaceCandidatesView';
import { CastingBoard } from './CastingBoard';
import { WorkspaceReviewView } from './WorkspaceReviewView';
import { WorkspacePresentationView } from './WorkspacePresentationView';
import { ShareWorkspace } from './share/ShareWorkspace';
import { rememberWorkspace } from './recent-workspaces';
import { SegmentIndicator } from './motion/SegmentIndicator';
import { plural, stepStatus, useWorkspaceSummary, type WorkspaceSummary } from './workspace-summary';

// Steps edited beside the live draft stage. Review, Versions and Share & feedback lay out their own panel and stage.
const staged: Record<string, { title: string; subtitle: string }> = {
  project: { title: 'Project', subtitle: 'Shared details & presentation setup' }, specs: { title: 'Specs', subtitle: 'Brief, roles and individual slots' },
  cast: { title: 'Candidates', subtitle: 'People in this project' }, organize: { title: 'Casting', subtitle: 'Slots, positions and Shortlist' },
};
const steps: { path: string; label: string; icon: IconName }[] = [{ path: 'project', label: 'Project', icon: 'brief' }, { path: 'specs', label: 'Specs', icon: 'file' }, { path: 'cast', label: 'Candidates', icon: 'user-plus' }, { path: 'organize', label: 'Casting', icon: 'board' }, { path: 'review', label: 'Review', icon: 'checklist' }, { path: 'presentations', label: 'Presentation', icon: 'history' }, { path: 'share', label: 'Share & feedback', icon: 'share' }];
// Shown only without the central business connection (development fixture mode).
const connectionNeeded = 'This step uses the central business connection, which this development session does not have. Sign in to the connected Studio to use it.';
const pending: Record<string, { title: string; body: string }> = {
  specs: { title: 'Specs need the central connection', body: connectionNeeded },
  cast: { title: 'Candidates need the central connection', body: connectionNeeded },
  organize: { title: 'Casting needs the central connection', body: connectionNeeded },
  review: { title: 'Review needs the central connection', body: connectionNeeded },
  presentations: { title: 'Presentations need the central connection', body: connectionNeeded },
  share: { title: 'Sharing needs the central connection', body: connectionNeeded },
};

interface WorkspaceProps { projectId: string; workspaceId: string; step: string; actor: Actor; storageOrigin?: string; onDirtyChange: (dirty: boolean) => void }
export function WorkspaceView(props: WorkspaceProps) { return <Suspense fallback={<Loading />}><WorkspaceRoute {...props} /></Suspense>; }
function WorkspaceRoute(props: WorkspaceProps) {
  const params = useSearchParams(); const contextual = ['review', 'presentations', 'share'].includes(props.step);
  const seriesId = contextual ? params.get('series_id') : null;
  if (contextual && (params.getAll('series_id').length > 1 || seriesId !== null && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(seriesId))) return <ErrorNotice message="This presentation context link is invalid. Open the workspace again from Projects." />;
  return <WorkspaceScope key={`${props.actor.id}:${props.workspaceId}:${seriesId ?? ''}`} {...props} requestedSeriesId={seriesId} />;
}
function WorkspaceScope({ projectId, workspaceId, step, actor, storageOrigin, onDirtyChange, requestedSeriesId }: WorkspaceProps & { requestedSeriesId: string | null }) {
  const central = useRuntimeMode() === 'supabase';
  const [contextSeries, setContextSeries] = useState(requestedSeriesId ?? '');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [outputSaving, setOutputSaving] = useState(false);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [logoDirty, setLogoDirty] = useState(false);
  const [specsDirty, setSpecsDirty] = useState(false);
  const [castDirty, setCastDirty] = useState(false);
  const [castingDirty, setCastingDirty] = useState(false);
  const [reviewDirty, setReviewDirty] = useState(false);
  const [presentationDirty, setPresentationDirty] = useState(false);
  const [shareDirty, setShareDirty] = useState(false);
  const detailsChanged = useCallback((dirty: boolean) => setDetailsDirty(dirty), []);
  const logoChanged = useCallback((dirty: boolean) => setLogoDirty(dirty), []);
  const specsChanged = useCallback((dirty: boolean) => setSpecsDirty(dirty), []);
  const castChanged = useCallback((dirty: boolean) => setCastDirty(dirty), []);
  const castingChanged = useCallback((dirty: boolean) => setCastingDirty(dirty), []);
  const reviewChanged = useCallback((dirty: boolean) => setReviewDirty(dirty), []);
  const presentationChanged = useCallback((dirty: boolean) => setPresentationDirty(dirty), []);
  const shareChanged = useCallback((dirty: boolean) => setShareDirty(dirty), []);
  const workspaceRefresh = useRef(0);
  useEffect(() => () => { workspaceRefresh.current++; }, []);
  const draftRefresh = useRef<(() => void) | null>(null);
  const specsWorkspaceChanged = useCallback(() => {
    draftRefresh.current?.();
    const request = ++workspaceRefresh.current;
    void api<Workspace>(`/api/v1/workspaces/${workspaceId}`).then(result => { if (request !== workspaceRefresh.current) return; setWorkspace(current => current && current.id === result.data.id && current.row_version <= result.data.row_version
      ? { ...current, row_version: result.data.row_version, draft_revision: result.data.draft_revision, active_output: result.data.active_output, has_unpublished_changes: result.data.has_unpublished_changes, updated_at: result.data.updated_at } : current); })
      .catch(reason => { if (request === workspaceRefresh.current) setError(`The change was saved, but workspace status could not be refreshed. ${errorMessage(reason)}`); });
  }, [workspaceId]);
  function reloadData() { setLoading(true); setRefresh(value => value + 1); }
  useEffect(() => { onDirtyChange(detailsDirty || logoDirty || specsDirty || castDirty || castingDirty || reviewDirty || presentationDirty || shareDirty || outputSaving); return () => onDirtyChange(false); }, [detailsDirty, logoDirty, specsDirty, castDirty, castingDirty, reviewDirty, presentationDirty, shareDirty, outputSaving, onDirtyChange]);
  useEffect(() => {
    let current = true;
    Promise.all([api<Project>(`/api/v1/projects/${projectId}`), api<Workspace>(`/api/v1/workspaces/${workspaceId}`)]).then(([projectResult, workspaceResult]) => {
      if (workspaceResult.data.project_id !== projectId) throw new Error('This workspace does not belong to the requested project. Return to Projects.');
      if (current) { setProject(projectResult.data); setWorkspace(workspaceResult.data); setError(''); }
    }).catch(reason => { if (current) setError(errorMessage(reason)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [projectId, workspaceId, refresh]);
  const draftProject = useMemo(() => ({ name: project?.name ?? '', client_name: project?.client_name ?? null }), [project?.name, project?.client_name]);
  const summary = useWorkspaceSummary(workspaceId, central && !!workspace, workspace ? `${workspace.row_version}:${workspace.draft_revision}` : '');
  useEffect(() => { if (project && workspace) rememberWorkspace({ href: `/projects/${projectId}/casting/${workspaceId}/project`, projectId, workspaceId, name: project.name }); }, [project, workspace, projectId, workspaceId]);
  async function changeOutput(output: 'selection' | 'shortlist') {
    if (!workspace) return; workspaceRefresh.current++; setOutputSaving(true);
    try { setWorkspace((await api<Workspace>(`/api/v1/workspaces/${workspace.id}`, mutation('PATCH', { row_version: workspace.row_version, active_output: output }))).data); draftRefresh.current?.(); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setOutputSaving(false); }
  }
  async function projectSaved(next: Project) {
    setProject(next); draftRefresh.current?.();
    setWorkspace((await api<Workspace>(`/api/v1/workspaces/${workspaceId}`)).data);
  }
  if (loading) return <Loading />;
  if (!workspace || !project) return <ErrorNotice message={error || 'Workspace unavailable.'} retry={reloadData} />;
  const base = `/projects/${projectId}/casting/${workspaceId}`;
  const canWrite = actor.capabilities?.includes('workspaces.write') ?? project.can_edit;
  const canUpload = canWrite && (actor.upload_purposes?.includes('client_logo') ?? false);
  const selectedStep = steps.find(item => item.path === step);
  const meta = selectedStep && (central || step === 'project') ? staged[step] : undefined;
  const ownsOutput = ['organize', 'review', 'presentations', 'share'].includes(step) && central;
  const canChangeOutput = !outputSaving && Boolean(actor.capabilities?.includes('workspaces.write'));
  const seriesQuery = (path: string) => contextSeries && ['review', 'presentations', 'share'].includes(path) ? `?series_id=${contextSeries}` : '';
  const stepBody = step === 'project' ? <div className="project-step">
      <ProjectDetails key={project.id} project={project} onSaved={projectSaved} onDirtyChange={detailsChanged} />
      <LogoPanel key={workspace.id} actorId={actor.id} workspace={workspace} clientLogoAssetId={project.client_logo_asset_id} canWrite={canWrite} canUpload={canUpload} onSaved={next => { setWorkspace(next); draftRefresh.current?.(); }} onDirtyChange={logoChanged} projectName={project.name} clientName={project.client_name} />
      <NextSteps base={base} summary={summary} output={workspace.active_output} unpublished={workspace.has_unpublished_changes} />
    </div>
    : step === 'specs' && central ? <SpecsView workspaceId={workspaceId} projectId={projectId} canWrite={canWrite} uploadPurposes={actor.upload_purposes ?? []} storageOrigin={storageOrigin} onDirtyChange={specsChanged} onWorkspaceChanged={specsWorkspaceChanged} />
    : step === 'cast' && central ? <WorkspaceCandidatesView workspaceId={workspaceId} projectId={projectId} actor={actor} storageOrigin={storageOrigin} onDirtyChange={castChanged} onWorkspaceChanged={specsWorkspaceChanged} />
    : step === 'organize' && central ? <CastingBoard workspaceId={workspaceId} projectId={projectId} actor={actor} initialOutput={workspace.active_output} onDirtyChange={castingChanged} onWorkspaceChanged={specsWorkspaceChanged} />
    : step === 'review' && central ? <WorkspaceReviewView requestedSeriesId={requestedSeriesId} onSeriesChanged={setContextSeries} workspaceId={workspaceId} projectId={projectId} actor={actor} initialOutput={workspace.active_output} onDirtyChange={reviewChanged} onWorkspaceChanged={specsWorkspaceChanged} />
    : step === 'presentations' && central ? <WorkspacePresentationView requestedSeriesId={requestedSeriesId} onSeriesChanged={setContextSeries} workspaceId={workspaceId} projectId={projectId} actor={actor} initialOutput={workspace.active_output} onDirtyChange={presentationChanged} />
    : step === 'share' && central ? <ShareWorkspace workspaceId={workspaceId} requestedSeriesId={requestedSeriesId} onSeriesChanged={setContextSeries} actor={actor} onDirtyChange={shareChanged} />
    : selectedStep && pending[step] ? <div className="empty-state step-empty"><Icon name={step === 'cast' ? 'people' : step === 'presentations' ? 'slides' : 'projects'} /><h2>{pending[step].title}</h2><p>{pending[step].body}</p><span className="badge badge-pending">Implementation pending</span><Link className="button" href={`${base}/project`}>Return to Project</Link></div>
    : <ErrorNotice message="This workspace step does not exist. Use the navigation above." />;
  return <>
    <FramePortal slot="top"><div className="workspace-top">
      <div className="workspace-title"><h1>{project.name}</h1>{workspace.has_unpublished_changes && <span className="badge badge-dot badge-warn">Unpublished changes</span>}</div>
      <nav className="workspace-breadcrumb" aria-label="Breadcrumb"><Link href="/projects">Projects</Link><Icon name="chevron-right" /><span>{project.client_name ?? 'Client not provided'}</span><Icon name="chevron-right" /><span aria-current="page">Casting workspace</span></nav>
    </div>
    <div className="workspace-actions">
      {!ownsOutput && <div className="segmented" role="group" aria-label="Working output"><SegmentIndicator />{(['selection', 'shortlist'] as const).map(value => <button key={value} type="button" aria-pressed={workspace.active_output === value} disabled={!canChangeOutput} onClick={() => { if (workspace.active_output !== value) void changeOutput(value); }}>{value === 'selection' ? 'Cast Selection' : 'Cast Shortlist'}{summary && <span className="segment-count"><span className="sr-only">, </span>{summary.assignment_count[value]}<span className="sr-only"> {summary.assignment_count[value] === 1 ? 'assignment' : 'assignments'}</span></span>}</button>)}</div>}
      {central && step !== 'share' && <Link className="button" href={`${base}/share${seriesQuery('share')}`}><Icon name="share" />Share</Link>}
      {step === 'review' ? <Link className="button button-primary" href={`${base}/presentations${seriesQuery('presentations')}`}><Icon name="sparkle" />Generate version</Link>
        : !['presentations', 'share'].includes(step) && <Link className="button button-primary" href={`${base}/review${seriesQuery('review')}`}>Review &amp; generate<Icon name="arrow" /></Link>}
    </div></FramePortal>
    <FramePortal slot="rail"><nav className="rail-group rail-steps" aria-label="Casting workspace steps"><SegmentIndicator />{steps.map((item, index) => <Link className="rail-link" href={`${base}/${item.path}${seriesQuery(item.path)}`} key={item.path} aria-current={step === item.path ? 'step' : undefined}><Icon name={item.icon} /><span className="rail-label"><span className="step-number">{index + 1}</span>{item.label}{(() => { const status = stepStatus(summary, item.path, workspace.active_output); return status && <span className={`step-status step-status-${status.tone}`}>{status.text}</span>; })()}</span></Link>)}</nav></FramePortal>
    {meta ? <WorkspaceDraftProvider enabled={central} workspaceId={workspaceId} projectId={projectId} canReadProfiles={actor.capabilities?.includes('cast.read') === true} project={draftProject} workspace={workspace} refreshRef={draftRefresh}>
      <PageFrame inline className="workspace-frame" panel={{ title: meta.title, subtitle: meta.subtitle, label: `${meta.title} panel`, wide: true, body: <>{error && <ErrorNotice message={error} retry={reloadData} />}{stepBody}</> }}>
        <LiveStage />
      </PageFrame>
    </WorkspaceDraftProvider> : <>{error && <ErrorNotice message={error} retry={reloadData} />}{stepBody}</>}
  </>;
}

const nextSteps = [{ path: 'specs', tag: 'Specs', body: 'Add or correct roles, requirements and slots from the brief.', action: 'Review specs' }, { path: 'cast', tag: 'Candidates', body: 'Add people from the Cast Library or upload new material.', action: 'Open candidates' }, { path: 'organize', tag: 'Casting', body: 'Assign candidates to slots and choose Main, Option or Backup.', action: 'Open casting' }, { path: 'review', tag: 'Review', body: 'Check facts and slide fit, then generate a saved version.', action: 'Open review' }];
// Summary-backed wording replaces the generic hint only when its count is known.
function nextStepBody(path: string, summary: WorkspaceSummary | null, output: 'selection' | 'shortlist', unpublished: boolean): { body: string; tone?: 'warn' | 'ok' } | null {
  if (!summary) return null;
  if (path === 'specs' && summary.roles_needing_clarification) return { body: `${plural(summary.roles_needing_clarification, 'role needs', 'roles need')} clarification or a confirmed headcount.`, tone: 'warn' };
  if (path === 'cast' && summary.unreviewed_candidate_count) return { body: `${plural(summary.unreviewed_candidate_count, 'profile is', 'profiles are')} not yet Reviewed.`, tone: 'warn' };
  if (path === 'organize' && summary.open_slot_count) return { body: `${plural(summary.open_slot_count, 'slot has', 'slots have')} no candidate yet. Open slots stay Pending in a presentation.`, tone: 'warn' };
  if (path === 'review') {
    const ready = summary.latest_ready_versions.filter(item => item.output_type === output);
    const label = output === 'selection' ? 'Cast Selection' : 'Cast Shortlist';
    if (ready.length === 1) return { body: `${label} v${ready[0].version_no} is saved${unpublished ? ' · later changes are not in a saved version yet' : ''}.`, tone: unpublished ? 'warn' : 'ok' };
    if (!ready.length) return { body: `No ${label} version saved yet. Check facts and slide fit, then generate one.` };
  }
  return null;
}
function NextSteps({ base, summary, output, unpublished }: { base: string; summary: WorkspaceSummary | null; output: 'selection' | 'shortlist'; unpublished: boolean }) {
  // Whole-workspace counts only; an unknown count says so instead of showing zero.
  const tiles = [{ label: 'Candidates', value: summary?.project_candidate_count, unit: 'in project' }, { label: 'Assigned', value: summary?.assignment_count[output], unit: output === 'selection' ? 'in Cast Selection' : 'in Cast Shortlist' },
    { label: 'Open slots', value: summary?.open_slot_count, unit: 'Pending' }, { label: 'To clarify', value: summary?.roles_needing_clarification, unit: 'roles' }];
  return <section className="panel" aria-labelledby="next-steps-heading"><header className="panel-header"><h2 id="next-steps-heading">Next up</h2><span className="small muted">Nothing here blocks you — missing information stays visible as “Not provided”.</span></header>
    <dl className="next-up-tiles">{tiles.map(tile => <div key={tile.label}><dt>{tile.label}</dt><dd>{typeof tile.value === 'number' ? <><strong>{tile.value}</strong>{tile.unit}</> : 'Not available'}</dd></div>)}</dl>
    <ul className="next-steps">{nextSteps.map(item => { const known = nextStepBody(item.path, summary, output, unpublished); return <li key={item.path}><span className={`badge ${known?.tone === 'warn' ? 'badge-warn' : known?.tone === 'ok' ? 'badge-ok' : 'badge-outline'}`}>{item.tag}</span><span>{known?.body ?? item.body}</span><Link className="button button-quiet button-small" href={`${base}/${item.path}`}>{item.action}<Icon name="arrow" /></Link></li>; })}</ul></section>;
}
