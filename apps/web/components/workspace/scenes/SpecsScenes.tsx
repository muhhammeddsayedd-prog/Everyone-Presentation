'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage, type Workspace } from '../../api';
import { ErrorNotice } from '../../Feedback';
import { confirmSceneProposals, listScenes, rejectSceneProposals, type Scene } from './scenes-api';
import { sceneName } from './scene-model';

/** Scenes inside the Specs review: scene requirements next to the roles, and the scene proposals the specs import made,
 * to confirm or reject here (the same operations as the scene breakdown, API and MCP). The whole project stays in view. */
export function SpecsScenes({ workspaceId, projectId, canWrite, refreshKey, onWorkspaceChanged }: { workspaceId: string; projectId: string; canWrite: boolean; refreshKey: string; onWorkspaceChanged: () => void }) {
  const [scenes, setScenes] = useState<Scene[] | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [status, setStatus] = useState('');
  const run = useRef(0);
  const load = useCallback(async () => {
    const current = ++run.current;
    try { const next = await listScenes(workspaceId); if (current === run.current) { setScenes(next); setError(''); } }
    catch (reason) { if (current === run.current) setError(errorMessage(reason)); }
  }, [workspaceId]);
  useEffect(() => { void Promise.resolve().then(load); }, [load, refreshKey]);
  async function review(decision: 'confirm' | 'reject', sceneIds?: string[], occurrenceIds?: string[]) {
    if (busy) return; setBusy(true); setStatus(''); setError('');
    try {
      const workspace = (await api<Workspace>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}`)).data;
      const input = { row_version: workspace.row_version, ...(sceneIds ? { scene_ids: sceneIds } : {}), ...(occurrenceIds ? { occurrence_ids: occurrenceIds } : {}) };
      if (decision === 'reject') { const result = await rejectSceneProposals(workspaceId, input); setStatus(`${result.rejected_scene_ids.length + result.rejected_occurrence_ids.length} rejected. They will not be proposed again.`); }
      else {
        const result = await confirmSceneProposals(workspaceId, input);
        setStatus(`${result.confirmed_scene_ids.length + result.confirmed_occurrence_ids.length} confirmed.${result.skipped_occurrence_ids.length ? ` ${result.skipped_occurrence_ids.length} left for review because the role changed after the import.` : ''}`);
      }
      onWorkspaceChanged();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); await load(); }
  }
  // Scenes are optional: when they cannot be read, the rest of the specs stays fully usable.
  if (!scenes) return error ? <p className="small muted specs-scenes-unavailable" role="note">Scenes could not be loaded. {error} <button className="button button-small button-quiet" type="button" onClick={() => void load()}>Retry</button></p> : null;
  const proposedScenes = scenes.filter(scene => scene.status === 'proposed');
  const proposedLinks = scenes.flatMap(scene => scene.occurrences.filter(item => item.status === 'proposed').map(item => ({ scene, item })));
  const withRequirements = scenes.filter(scene => scene.requirements.items.length > 0);
  return <section className="panel specs-anchor specs-scenes" id="specs-scenes" aria-labelledby="specs-scenes-heading">
    <header className="panel-header"><div><h2 id="specs-scenes-heading">Scenes</h2><p className="small muted">{scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'} · Roles stay the characters; a scene only lists which roles appear in it.</p></div>
      <Link className="button button-small button-quiet" href={`/projects/${projectId}/casting/${workspaceId}/organize`}>Open scene breakdown</Link></header>
    <div className="panel-body stack">
      {error && <ErrorNotice message={error} />}
      <p className="save-state" role="status" aria-live="polite">{busy ? 'Saving…' : status}</p>
      {(proposedScenes.length > 0 || proposedLinks.length > 0) && <div className="scene-proposals" role="group" aria-label="Scene proposals from the specs">
        <div className="section-heading"><div><h3>Proposed from the specs</h3><p className="small muted">Check each against the quoted source. Nothing is linked to casting until confirmed; identical names are never linked automatically.</p></div>
          {canWrite && <div className="button-row"><button className="button button-small" type="button" disabled={busy} onClick={() => void review('confirm')}>Confirm all</button>
            <button className="button button-small button-quiet" type="button" disabled={busy} onClick={() => void review('reject')}>Reject all</button></div>}</div>
        <ul className="scene-proposal-list">
          {proposedScenes.map(scene => <li key={scene.id}><span className="badge badge-warn">Scene</span> <strong dir="auto">{sceneName(scene)}</strong>{scene.setting && <span className="small muted" dir="auto"> · {scene.setting}</span>}
            {scene.source_refs[0]?.quote && <blockquote className="small" dir="auto">“{scene.source_refs[0].quote}”</blockquote>}
            {canWrite && <span className="button-row"><button className="button button-small" type="button" disabled={busy} onClick={() => void review('confirm', [scene.id], [])}>Confirm</button>
              <button className="button button-small button-quiet" type="button" disabled={busy} onClick={() => void review('reject', [scene.id], [])}>Reject</button></span>}</li>)}
          {proposedLinks.map(({ scene, item }) => <li key={item.id}><span className="badge badge-warn">Role in scene</span> <strong dir="auto">{item.display_title || item.role_name || 'Unnamed role'}</strong> in <span dir="auto">{sceneName(scene)}</span>
            {item.source_refs[0]?.quote && <blockquote className="small" dir="auto">“{item.source_refs[0].quote}”</blockquote>}
            {item.proposal_stale && <p className="small notice notice-warning">The role changed after the import (renamed or new requirements). Check it before confirming.</p>}
            {canWrite && <span className="button-row"><button className="button button-small" type="button" disabled={busy || item.proposal_stale} onClick={() => void review('confirm', scene.status === 'proposed' ? [scene.id] : [], [item.id])}>Confirm</button>
              <button className="button button-small button-quiet" type="button" disabled={busy} onClick={() => void review('reject', [], [item.id])}>Reject</button></span>}</li>)}
        </ul></div>}
      {withRequirements.length > 0 ? <dl className="scene-requirement-list">{withRequirements.map(scene => <div key={scene.id}><dt dir="auto">{sceneName(scene)}</dt>
        <dd><ul>{scene.requirements.items.map((item, index) => <li key={index} dir="auto">{item}</li>)}</ul></dd></div>)}</dl>
        : <p className="small muted">{scenes.length ? 'No scene-specific requirements.' : 'No scenes yet. Scenes are optional; the whole project can be cast without them.'}</p>}
    </div>
  </section>;
}
