'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage, mutation, type Actor, type Project, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { ProjectDetails } from './ProjectDetails';
import { LogoPanel } from './LogoPanel';
import { Icon } from './Icon';
import { SpecsView } from './SpecsView';
import { useRuntimeMode } from './RuntimeMode';
import { WorkspaceCandidatesView } from './WorkspaceCandidatesView';
import { CastingBoard } from './CastingBoard';
import { WorkspaceReviewView } from './WorkspaceReviewView';
import { WorkspacePresentationView } from './WorkspacePresentationView';
import { rememberWorkspace } from './recent-workspaces';
import { SegmentIndicator } from './motion/SegmentIndicator';

const steps = [{ path: 'project', label: 'Project' }, { path: 'specs', label: 'Specs' }, { path: 'cast', label: 'Candidates' }, { path: 'organize', label: 'Casting' }, { path: 'review', label: 'Review' }, { path: 'presentations', label: 'Presentation' }];
const pending: Record<string, { title: string; body: string }> = {
  specs: { title: 'No casting requirements yet', body: 'PDF, Word and pasted-text ingestion will be available with the durable specs pipeline in M02.' },
  cast: { title: 'No candidates in this project', body: 'Direct video uploads, real transcription, frame extraction and library reuse are pending M03 implementation.' },
  organize: { title: 'No casting assignments yet', body: 'Selection will include every active assignment. Shortlist membership will be your explicit choice. Casting operations are pending M04.' },
  review: { title: 'Final review is not available yet', body: 'Fact review, presentation wording and preflight checks are pending M04. Missing facts and open slots will remain permitted.' },
  presentations: { title: 'No presentations generated', body: 'Immutable versions, approved templates and real PDF rendering are pending M05. No generation has been performed.' },
};

interface WorkspaceProps { projectId: string; workspaceId: string; step: string; actor: Actor; storageOrigin?: string; onDirtyChange: (dirty: boolean) => void }
export function WorkspaceView(props: WorkspaceProps) { return <Suspense fallback={<Loading />}><WorkspaceRoute {...props} /></Suspense>; }
function WorkspaceRoute(props: WorkspaceProps) {
  const params = useSearchParams(); const contextual = ['review', 'presentations'].includes(props.step);
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
  const detailsChanged = useCallback((dirty: boolean) => setDetailsDirty(dirty), []);
  const logoChanged = useCallback((dirty: boolean) => setLogoDirty(dirty), []);
  const specsChanged = useCallback((dirty: boolean) => setSpecsDirty(dirty), []);
  const castChanged = useCallback((dirty: boolean) => setCastDirty(dirty), []);
  const castingChanged = useCallback((dirty: boolean) => setCastingDirty(dirty), []);
  const reviewChanged = useCallback((dirty: boolean) => setReviewDirty(dirty), []);
  const presentationChanged = useCallback((dirty: boolean) => setPresentationDirty(dirty), []);
  const workspaceRefresh = useRef(0);
  useEffect(() => () => { workspaceRefresh.current++; }, []);
  const specsWorkspaceChanged = useCallback(() => {
    const request = ++workspaceRefresh.current;
    void api<Workspace>(`/api/v1/workspaces/${workspaceId}`).then(result => { if (request !== workspaceRefresh.current) return; setWorkspace(current => current && current.id === result.data.id && current.row_version <= result.data.row_version
      ? { ...current, row_version: result.data.row_version, draft_revision: result.data.draft_revision, active_output: result.data.active_output, has_unpublished_changes: result.data.has_unpublished_changes, updated_at: result.data.updated_at } : current); })
      .catch(reason => { if (request === workspaceRefresh.current) setError(`The change was saved, but workspace status could not be refreshed. ${errorMessage(reason)}`); });
  }, [workspaceId]);
  function reloadData() { setLoading(true); setRefresh(value => value + 1); }
  useEffect(() => { onDirtyChange(detailsDirty || logoDirty || specsDirty || castDirty || castingDirty || reviewDirty || presentationDirty || outputSaving); return () => onDirtyChange(false); }, [detailsDirty, logoDirty, specsDirty, castDirty, castingDirty, reviewDirty, presentationDirty, outputSaving, onDirtyChange]);
  useEffect(() => {
    let current = true;
    Promise.all([api<Project>(`/api/v1/projects/${projectId}`), api<Workspace>(`/api/v1/workspaces/${workspaceId}`)]).then(([projectResult, workspaceResult]) => {
      if (workspaceResult.data.project_id !== projectId) throw new Error('This workspace does not belong to the requested project. Return to Projects.');
      if (current) { setProject(projectResult.data); setWorkspace(workspaceResult.data); setError(''); }
    }).catch(reason => { if (current) setError(errorMessage(reason)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [projectId, workspaceId, refresh]);
  useEffect(() => { if (project && workspace) rememberWorkspace({ href: `/projects/${projectId}/casting/${workspaceId}/project`, projectId, workspaceId, name: project.name }); }, [project, workspace, projectId, workspaceId]);
  async function changeOutput(output: 'selection' | 'shortlist') {
    if (!workspace) return; workspaceRefresh.current++; setOutputSaving(true);
    try { setWorkspace((await api<Workspace>(`/api/v1/workspaces/${workspace.id}`, mutation('PATCH', { row_version: workspace.row_version, active_output: output }))).data); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setOutputSaving(false); }
  }
  async function projectSaved(next: Project) {
    setProject(next);
    setWorkspace((await api<Workspace>(`/api/v1/workspaces/${workspaceId}`)).data);
  }
  if (loading) return <Loading />;
  if (!workspace || !project) return <ErrorNotice message={error || 'Workspace unavailable.'} retry={reloadData} />;
  const base = `/projects/${projectId}/casting/${workspaceId}`;
  const canWrite = actor.capabilities?.includes('workspaces.write') ?? project.can_edit;
  const canUpload = canWrite && (actor.upload_purposes?.includes('client_logo') ?? false);
  const selectedStep = steps.find(item => item.path === step);
  const ownsOutput = ['organize', 'review', 'presentations'].includes(step) && central;
  const canChangeOutput = !outputSaving && Boolean(actor.capabilities?.includes('workspaces.write'));
  const seriesQuery = (path: string) => contextSeries && ['review', 'presentations'].includes(path) ? `?series_id=${contextSeries}` : '';
  const stepBody = step === 'project' ? <div className="project-step">
      <div className="stack-lg"><ProjectDetails key={project.id} project={project} onSaved={projectSaved} onDirtyChange={detailsChanged} /><NextSteps base={base} /></div>
      <LogoPanel key={workspace.id} workspace={workspace} clientLogoAssetId={project.client_logo_asset_id} canWrite={canWrite} canUpload={canUpload} onSaved={setWorkspace} onDirtyChange={logoChanged} projectName={project.name} clientName={project.client_name} />
    </div>
    : step === 'specs' && central ? <SpecsView workspaceId={workspaceId} projectId={projectId} canWrite={canWrite} uploadPurposes={actor.upload_purposes ?? []} storageOrigin={storageOrigin} onDirtyChange={specsChanged} onWorkspaceChanged={specsWorkspaceChanged} />
    : step === 'cast' && central ? <WorkspaceCandidatesView workspaceId={workspaceId} projectId={projectId} actor={actor} storageOrigin={storageOrigin} onDirtyChange={castChanged} onWorkspaceChanged={specsWorkspaceChanged} />
    : step === 'organize' && central ? <CastingBoard workspaceId={workspaceId} projectId={projectId} actor={actor} initialOutput={workspace.active_output} onDirtyChange={castingChanged} onWorkspaceChanged={specsWorkspaceChanged} />
    : step === 'review' && central ? <WorkspaceReviewView requestedSeriesId={requestedSeriesId} onSeriesChanged={setContextSeries} workspaceId={workspaceId} projectId={projectId} actor={actor} initialOutput={workspace.active_output} onDirtyChange={reviewChanged} onWorkspaceChanged={specsWorkspaceChanged} />
    : step === 'presentations' && central ? <WorkspacePresentationView requestedSeriesId={requestedSeriesId} onSeriesChanged={setContextSeries} workspaceId={workspaceId} projectId={projectId} actor={actor} initialOutput={workspace.active_output} onDirtyChange={presentationChanged} />
    : selectedStep && pending[step] ? <div className="empty-state step-empty"><Icon name={step === 'cast' ? 'people' : step === 'presentations' ? 'slides' : 'projects'} /><h2>{pending[step].title}</h2><p>{pending[step].body}</p><span className="badge badge-pending">Implementation pending</span><Link className="button" href={`${base}/project`}>Return to Project</Link></div>
    : <ErrorNotice message="This workspace step does not exist. Use the navigation above." />;
  return <>
    <nav className="workspace-breadcrumb" aria-label="Breadcrumb"><Link href="/projects">Projects</Link><Icon name="chevron-right" /><span>{project.client_name ?? project.name}</span><Icon name="chevron-right" /><span aria-current="page">Casting</span></nav>
    <header className="workspace-heading">
      <div><h1>{project.name}</h1><p><span>{project.client_name ?? 'Client not provided'}</span><span aria-hidden="true">·</span><span>Casting workspace</span>{workspace.has_unpublished_changes && <><span aria-hidden="true">·</span><span className="badge badge-dot badge-warn">Unpublished changes</span></>}</p></div>
      <div className="workspace-actions">
        {!ownsOutput && <div className="segmented" role="group" aria-label="Working output"><SegmentIndicator />{(['selection', 'shortlist'] as const).map(value => <button key={value} type="button" aria-pressed={workspace.active_output === value} disabled={!canChangeOutput} onClick={() => { if (workspace.active_output !== value) void changeOutput(value); }}>{value === 'selection' ? 'Cast Selection' : 'Cast Shortlist'}</button>)}</div>}
        {step !== 'review' && <Link className="button button-primary" href={`${base}/review${seriesQuery('review')}`}>Review &amp; generate<Icon name="arrow" /></Link>}
      </div>
    </header>
    <nav className="workspace-steps" aria-label="Casting workspace steps"><SegmentIndicator />{steps.map((item, index) => <Link href={`${base}/${item.path}${seriesQuery(item.path)}`} key={item.path} aria-current={step === item.path ? 'step' : undefined}><span className="step-number">{index + 1}</span>{item.label}</Link>)}</nav>
    {error && <ErrorNotice message={error} retry={reloadData} />}
    {stepBody}
  </>;
}

const nextSteps = [{ path: 'specs', tag: 'Specs', body: 'Add or correct roles, requirements and slots from the brief.', action: 'Review specs' }, { path: 'cast', tag: 'Candidates', body: 'Add people from the Cast Library or upload new material.', action: 'Open candidates' }, { path: 'organize', tag: 'Casting', body: 'Assign candidates to slots and choose Main, Option or Backup.', action: 'Open casting' }, { path: 'review', tag: 'Review', body: 'Check facts and slide fit, then generate a saved version.', action: 'Open review' }];
function NextSteps({ base }: { base: string }) {
  return <section className="panel" aria-labelledby="next-steps-heading"><header className="panel-header"><h2 id="next-steps-heading">Next up</h2><span className="small muted">Nothing here blocks you — missing information stays visible as “Not provided”.</span></header>
    <ul className="next-steps">{nextSteps.map(item => <li key={item.path}><span className="badge badge-outline">{item.tag}</span><span>{item.body}</span><Link className="button button-quiet button-small" href={`${base}/${item.path}`}>{item.action}<Icon name="arrow" /></Link></li>)}</ul></section>;
}
