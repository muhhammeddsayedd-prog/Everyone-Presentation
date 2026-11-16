import { api, mutation } from '../../api';
import type {
  RoleOccurrence, Scene, SceneArchiveResult, SceneConfirm, SceneConfirmResult, SceneCreate, SceneOccurrenceLink, SceneOccurrencePatch,
  SceneOrder, ScenePatch, SceneRejectResult,
} from '../../../../../packages/domain/src/scenes-types.ts';

export type {
  RoleOccurrence, Scene, SceneArchiveResult, SceneConfirm, SceneConfirmResult, SceneCreate, SceneDeckPlacement, SceneOccurrence,
  SceneOccurrenceLink, SceneOccurrencePatch, SceneOrder, ScenePatch, SceneRejectResult, SceneReorder, SceneRequirements, SceneStatus,
} from '../../../../../packages/domain/src/scenes-types.ts';
export { formatSceneAppearance, SCENE_LIMITS } from '../../../../../packages/domain/src/scenes.ts';

/** Browser helpers for the structured-scene operations (same HTTP routes as the MCP tools). Every mutation sends a fresh
 * Idempotency-Key; to retry an interrupted request with the same intent, pass the same `idempotencyKey`. */
const at = (...parts: string[]) => `/api/v1/${parts.map(encodeURIComponent).join('/')}`;
function keyed(method: string, body: unknown, idempotencyKey?: string): RequestInit {
  const init = mutation(method, body);
  return idempotencyKey ? { ...init, headers: { 'Idempotency-Key': idempotencyKey } } : init;
}
const MAX_PAGES = 50;

/** Every active scene of the workspace in order, following cursors (100 per page). */
export async function listScenes(workspaceId: string, signal?: AbortSignal): Promise<Scene[]> {
  const scenes: Scene[] = []; let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query: string = `?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const result = await api<Scene[]>(at('workspaces', workspaceId, 'scenes') + query, { signal });
    scenes.push(...result.data);
    cursor = result.page?.next_cursor ?? null;
    if (!cursor) return scenes;
  }
  throw new Error('The scene list is longer than this view can load.');
}
export async function createScene(workspaceId: string, input: SceneCreate, idempotencyKey?: string): Promise<Scene> {
  return (await api<Scene>(at('workspaces', workspaceId, 'scenes'), keyed('POST', input, idempotencyKey))).data;
}
export async function updateScene(sceneId: string, input: ScenePatch, idempotencyKey?: string): Promise<Scene> {
  return (await api<Scene>(at('scenes', sceneId), keyed('PATCH', input, idempotencyKey))).data;
}
/** `workspaceRowVersion` is the workspace row_version; `sceneIds` must be exactly the full active scene set. */
export async function reorderScenes(workspaceId: string, workspaceRowVersion: number, sceneIds: string[], idempotencyKey?: string): Promise<SceneOrder> {
  return (await api<SceneOrder>(at('workspaces', workspaceId, 'scene-order'),
    keyed('PUT', { row_version: workspaceRowVersion, scene_ids: sceneIds }, idempotencyKey))).data;
}
/** Archives the scene and its occurrences only; roles, slots, assignments and candidates are unchanged. */
export async function archiveScene(sceneId: string, rowVersion: number, idempotencyKey?: string): Promise<SceneArchiveResult> {
  return (await api<SceneArchiveResult>(at('scenes', sceneId, 'archive'), keyed('POST', { row_version: rowVersion }, idempotencyKey))).data;
}
/** Links a role by id; returns the parent scene with its occurrences. */
export async function linkSceneOccurrence(sceneId: string, input: SceneOccurrenceLink, idempotencyKey?: string): Promise<Scene> {
  return (await api<Scene>(at('scenes', sceneId, 'occurrences'), keyed('POST', input, idempotencyKey))).data;
}
export async function updateSceneOccurrence(occurrenceId: string, input: SceneOccurrencePatch, idempotencyKey?: string): Promise<Scene> {
  return (await api<Scene>(at('scene-occurrences', occurrenceId), keyed('PATCH', input, idempotencyKey))).data;
}
export async function unlinkSceneOccurrence(occurrenceId: string, rowVersion: number, idempotencyKey?: string): Promise<Scene> {
  return (await api<Scene>(at('scene-occurrences', occurrenceId, 'unlink'), keyed('POST', { row_version: rowVersion }, idempotencyKey))).data;
}
/** The scenes a role appears in, in active scene order. */
export async function listRoleOccurrences(roleId: string, signal?: AbortSignal): Promise<RoleOccurrence[]> {
  return (await api<RoleOccurrence[]>(at('roles', roleId, 'occurrences'), { signal })).data;
}
/** `input.row_version` is the workspace row_version; omit both id lists to confirm every proposal. */
export async function confirmSceneProposals(workspaceId: string, input: SceneConfirm, idempotencyKey?: string): Promise<SceneConfirmResult> {
  return (await api<SceneConfirmResult>(at('workspaces', workspaceId, 'scene-proposals', 'confirm'), keyed('POST', input, idempotencyKey))).data;
}
/** Rejects proposals (kept as reviewed history; a later import does not propose them again). Confirmed rows are untouched. */
export async function rejectSceneProposals(workspaceId: string, input: SceneConfirm, idempotencyKey?: string): Promise<SceneRejectResult> {
  return (await api<SceneRejectResult>(at('workspaces', workspaceId, 'scene-proposals', 'reject'), keyed('POST', input, idempotencyKey))).data;
}
