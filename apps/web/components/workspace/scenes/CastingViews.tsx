'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { SegmentIndicator } from '../../motion/SegmentIndicator';
import { SceneBreakdown } from './SceneBreakdown';
import { useLeaveGuard } from './unsaved';

export type CastingView = 'standard' | 'scenes';
const storageKey = (workspaceId: string) => `eps.casting-view.${workspaceId}`;
/** The chosen view is a per-viewer convenience kept in this browser; it never changes project content. */
export function readCastingView(workspaceId: string): CastingView {
  try { return globalThis.localStorage?.getItem(storageKey(workspaceId)) === 'scenes' ? 'scenes' : 'standard'; } catch { return 'standard'; }
}
function storeCastingView(workspaceId: string, view: CastingView) {
  try { globalThis.localStorage?.setItem(storageKey(workspaceId), view); } catch { /* private mode: the toggle still works for this visit */ }
}

interface Props {
  workspaceId: string; canWrite: boolean;
  /** The existing casting board for the given role focus (Standard view); the scene breakdown never duplicates casting. */
  board: (focusRoleId: string | undefined, onDirtyChange: (dirty: boolean) => void) => ReactElement;
  onDirtyChange: (dirty: boolean) => void; onWorkspaceChanged: () => void;
}

/** "Standard view | Scene breakdown" over the same project records and casting operations. */
export function CastingViews({ workspaceId, canWrite, board, onDirtyChange, onWorkspaceChanged }: Props) {
  // Mounted only after the workspace loads in the browser, so the stored choice can be read on first render.
  const [view, setView] = useState<CastingView>(() => readCastingView(workspaceId)); const [focusRole, setFocusRole] = useState<string | undefined>();
  const [castingBefore, setCastingBefore] = useState<Record<string, string> | null>(null); const [boardKey, setBoardKey] = useState(0);
  const [boardDirty, setBoardDirty] = useState(false); const [scenesDirty, setScenesDirty] = useState(false);
  useEffect(() => { onDirtyChange(boardDirty || scenesDirty); }, [boardDirty, scenesDirty, onDirtyChange]);
  const guard = useLeaveGuard(boardDirty || scenesDirty);
  const boardChanged = useCallback((dirty: boolean) => setBoardDirty(dirty), []);
  const scenesChanged = useCallback((dirty: boolean) => setScenesDirty(dirty), []);
  function choose(next: CastingView) {
    if (next === view) return;
    void guard(() => {
      storeCastingView(workspaceId, next); setView(next); setBoardDirty(false); setScenesDirty(false);
      if (next === 'standard') { setFocusRole(undefined); setCastingBefore(null); setBoardKey(value => value + 1); }
    });
  }
  const castRole = useCallback((roleId: string, fingerprint: Record<string, string>) => {
    setFocusRole(roleId); setCastingBefore(fingerprint); setBoardKey(value => value + 1); setScenesDirty(false); setView('standard');
  }, []);
  return <div className="casting-views">
    <div className="casting-view-switch"><div className="segmented" role="group" aria-label="Casting view"><SegmentIndicator />
      <button type="button" aria-pressed={view === 'standard'} onClick={() => choose('standard')}>Standard view</button>
      <button type="button" aria-pressed={view === 'scenes'} onClick={() => choose('scenes')}>Scene breakdown</button></div>
      {view === 'standard' && focusRole && castingBefore && <button className="button button-small button-quiet" type="button" onClick={() => choose('scenes')}>Back to scenes</button>}
    </div>
    {view === 'standard' ? <div key={boardKey}>{board(focusRole, boardChanged)}</div>
      : <SceneBreakdown key={`scenes-${boardKey}`} workspaceId={workspaceId} canWrite={canWrite} castingBefore={castingBefore}
        onCastRole={castRole} onWorkspaceChanged={onWorkspaceChanged} onDirtyChange={scenesChanged} />}
  </div>;
}
