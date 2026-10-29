'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, mutation, type Actor, type Project, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { ProjectDetails } from './ProjectDetails';
import { LogoPanel } from './LogoPanel';
import { Icon } from './Icon';
import { SpecsView } from './SpecsView';
import { useRuntimeMode } from './RuntimeMode';

const steps = [{ path: 'project', label: 'Project' }, { path: 'specs', label: 'Specs' }, { path: 'cast', label: 'Candidates' }, { path: 'organize', label: 'Casting' }, { path: 'review', label: 'Review' }, { path: 'presentations', label: 'Presentation' }];
const pending: Record<string, { title: string; body: string }> = {
  specs: { title: 'No casting requirements yet', body: 'PDF, Word and pasted-text ingestion will be available with the durable specs pipeline in M02.' },
  cast: { title: 'No candidates in this project', body: 'Direct video uploads, real transcription, frame extraction and library reuse are pending M03 implementation.' },
  organize: { title: 'No casting assignments yet', body: 'Selection will include every active assignment. Shortlist membership will be your explicit choice. Casting operations are pending M04.' },
  review: { title: 'Final review is not available yet', body: 'Fact review, presentation wording and preflight checks are pending M04. Missing facts and open slots will remain permitted.' },
  presentations: { title: 'No presentations generated', body: 'Immutable versions, approved templates and real PDF rendering are pending M05. No generation has been performed.' },
};

export function WorkspaceView({ projectId, workspaceId, step, actor, storageOrigin, onDirtyChange }: { projectId: string; workspaceId: string; step: string; actor: Actor; storageOrigin?: string; onDirtyChange: (dirty: boolean) => void }) {
  const central = useRuntimeMode() === 'supabase';
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [outputSaving, setOutputSaving] = useState(false);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [logoDirty, setLogoDirty] = useState(false);
  const [specsDirty, setSpecsDirty] = useState(false);
  const detailsChanged = useCallback((dirty: boolean) => setDetailsDirty(dirty), []);
  const logoChanged = useCallback((dirty: boolean) => setLogoDirty(dirty), []);
  const specsChanged = useCallback((dirty: boolean) => setSpecsDirty(dirty), []);
  const specsWorkspaceChanged = useCallback(() => {
    void api<Workspace>(`/api/v1/workspaces/${workspaceId}`).then(result => setWorkspace(current => current && current.id === result.data.id && current.row_version <= result.data.row_version
      ? { ...current, row_version: result.data.row_version, draft_revision: result.data.draft_revision, has_unpublished_changes: result.data.has_unpublished_changes, updated_at: result.data.updated_at } : current))
      .catch(reason => setError(`Requirements were saved, but workspace status could not be refreshed. ${errorMessage(reason)}`));
  }, [workspaceId]);
  function reloadData() { setLoading(true); setRefresh(value => value + 1); }
  useEffect(() => { onDirtyChange(detailsDirty || logoDirty || specsDirty || outputSaving); return () => onDirtyChange(false); }, [detailsDirty, logoDirty, specsDirty, outputSaving, onDirtyChange]);
  useEffect(() => {
    let current = true;
    Promise.all([api<Project>(`/api/v1/projects/${projectId}`), api<Workspace>(`/api/v1/workspaces/${workspaceId}`)]).then(([projectResult, workspaceResult]) => {
      if (workspaceResult.data.project_id !== projectId) throw new Error('This workspace does not belong to the requested project. Return to Projects.');
      if (current) { setProject(projectResult.data); setWorkspace(workspaceResult.data); setError(''); }
    }).catch(reason => { if (current) setError(errorMessage(reason)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [projectId, workspaceId, refresh]);
  async function changeOutput(output: 'selection' | 'shortlist') {
    if (!workspace) return; setOutputSaving(true);
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
  return <><div className="workspace-breadcrumb"><Link href="/projects">Projects</Link><span>/</span><span>{project.name}</span><span>/</span><span>Casting</span></div><header className="page-heading workspace-heading"><div><h1>{project.name}</h1><p>{project.client_name ?? 'Client not provided'}<span className="inline-divider">·</span>Casting workspace</p></div><div className="output-control"><label htmlFor="active-output">Working output</label><select id="active-output" value={workspace.active_output} disabled={outputSaving || !actor.capabilities?.includes('workspaces.write')} onChange={event => changeOutput(event.target.value as 'selection' | 'shortlist')}><option value="selection">Cast Selection</option><option value="shortlist">Cast Shortlist</option></select></div></header><nav className="workspace-steps" aria-label="Casting workspace steps">{steps.map((item, index) => <Link href={`${base}/${item.path}`} key={item.path} aria-current={step === item.path ? 'step' : undefined}><span className="step-number">{index + 1}</span>{item.label}</Link>)}</nav>{error && <ErrorNotice message={error} retry={reloadData} />}{step === 'project' ? <><ProjectDetails key={project.id} project={project} onSaved={projectSaved} onDirtyChange={detailsChanged} /><LogoPanel key={workspace.id} workspace={workspace} clientLogoAssetId={project.client_logo_asset_id} canWrite={canWrite} canUpload={canUpload} onSaved={setWorkspace} onDirtyChange={logoChanged} /><footer className="workspace-footer"><p className="small muted">Your workspace is saved.</p><Link className="button button-primary" href={`${base}/specs`}>Continue to Specs<Icon name="arrow" /></Link></footer></> : step === 'specs' && central ? <SpecsView workspaceId={workspaceId} projectId={projectId} canWrite={canWrite} uploadPurposes={actor.upload_purposes ?? []} storageOrigin={storageOrigin} onDirtyChange={specsChanged} onWorkspaceChanged={specsWorkspaceChanged} /> : selectedStep && pending[step] ? <div className="empty-state step-empty"><Icon name={step === 'cast' ? 'people' : step === 'presentations' ? 'slides' : 'projects'} /><h2>{pending[step].title}</h2><p>{pending[step].body}</p><span className="badge">Implementation pending</span><Link className="button" href={`${base}/project`}>Return to Project</Link></div> : <ErrorNotice message="This workspace step does not exist. Use the navigation above." />}</>;
}
