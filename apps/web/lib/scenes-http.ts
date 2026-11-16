import { DomainError, parseSceneConfirm, parseSceneCreate, parseSceneOccurrenceLink, parseSceneOccurrencePatch, parseScenePatch,
  parseSceneReorder, parseSceneVersion, type Actor, type MutationContext } from '@eps/domain';
import type { CentralScenes, ScenesListOptions } from '@eps/central';
import { json, NO_STORE, readJson } from './http';
import { validateContract } from './validation';

export type ScenesOperations = CentralScenes;
/** Scene routes under /api/v1. They do not overlap the specs, casting or candidate route families. */
export function isScenesRoute(s: string[]): boolean {
  return s[0] === 'workspaces' && (s.length === 3 && ['scenes', 'scene-order'].includes(s[2])
      || s.length === 4 && s[2] === 'scene-proposals' && ['confirm', 'reject'].includes(s[3]))
    || s[0] === 'scenes' && (s.length === 2 || s.length === 3 && ['archive', 'occurrences'].includes(s[2]))
    || s[0] === 'scene-occurrences' && (s.length === 2 || s.length === 3 && s[2] === 'unlink')
    || s[0] === 'roles' && s.length === 3 && s[2] === 'occurrences';
}
const invalid = (): never => { throw new DomainError('INVALID_REQUEST', 'Use bounded resource identifiers and supported cursor/limit parameters.', 400); };
const missing = (): never => { throw new DomainError('RESOURCE_NOT_FOUND', 'This scene operation is unavailable.', 404); };
function listOptions(url: URL): ScenesListOptions {
  const result: ScenesListOptions = {};
  for (const key of url.searchParams.keys()) {
    const value = url.searchParams.get(key)!;
    if (!['cursor', 'limit'].includes(key) || url.searchParams.getAll(key).length !== 1 || !value || value.length > 200) invalid();
    if (key === 'cursor') result.cursor = value;
    else {
      if (!/^[1-9][0-9]*$/u.test(value) || Number(value) > 100) invalid();
      result.limit = Number(value);
    }
  }
  return result;
}

/** Caller verifies the session and mutation origin; the RPCs recheck the current workspace scope and revisions. */
export async function handleScenesRequest(request: Request, s: string[], actor: Actor,
  scenes: ScenesOperations, context: MutationContext & { requestId: string }) {
  if (!isScenesRoute(s)) missing();
  if (s.some(part => !part || part.length > 200)) invalid();
  const url = new URL(request.url); const method = request.method; const id = s[1];
  const paged = (value: { data: unknown; page: unknown }) => Response.json({ request_id: context.requestId, ...value }, { headers: NO_STORE });
  const body = async (schema: string) => validateContract<unknown>(schema, await readJson(request));
  if (method === 'GET' && s[0] === 'workspaces' && s[2] === 'scenes') return paged(await scenes.listScenes(actor, id, listOptions(url)));
  if (url.search) invalid();
  if (method === 'GET' && s[0] === 'roles') return paged(await scenes.listRoleOccurrences(actor, id));
  if (s[0] === 'workspaces') {
    if (s[2] === 'scenes' && method === 'POST') {
      return json(await scenes.createScene(actor, id, parseSceneCreate(await body('SceneCreate')), context), context.requestId, 201);
    }
    if (s[2] === 'scene-order' && method === 'PUT') {
      return json(await scenes.reorderScenes(actor, id, parseSceneReorder(await body('SceneReorder')), context), context.requestId);
    }
    if (s[2] === 'scene-proposals' && s[3] === 'reject' && method === 'POST') {
      return json(await scenes.rejectSceneProposals(actor, id, parseSceneConfirm(await body('SceneProposalConfirm')), context), context.requestId);
    }
    if (s[2] === 'scene-proposals' && method === 'POST') {
      return json(await scenes.confirmSceneProposals(actor, id, parseSceneConfirm(await body('SceneProposalConfirm')), context), context.requestId);
    }
  }
  if (s[0] === 'scenes') {
    if (s.length === 2 && method === 'PATCH') return json(await scenes.updateScene(actor, id, parseScenePatch(await body('ScenePatch')), context), context.requestId);
    if (s[2] === 'archive' && method === 'POST') {
      return json(await scenes.archiveScene(actor, id, parseSceneVersion(await body('SceneVersionRequest')), context), context.requestId);
    }
    if (s[2] === 'occurrences' && method === 'POST') {
      return json(await scenes.linkSceneOccurrence(actor, id, parseSceneOccurrenceLink(await body('SceneOccurrenceLink')), context), context.requestId, 201);
    }
  }
  if (s[0] === 'scene-occurrences') {
    if (s.length === 2 && method === 'PATCH') {
      return json(await scenes.updateSceneOccurrence(actor, id, parseSceneOccurrencePatch(await body('SceneOccurrencePatch')), context), context.requestId);
    }
    if (s[2] === 'unlink' && method === 'POST') {
      return json(await scenes.unlinkSceneOccurrence(actor, id, parseSceneVersion(await body('SceneVersionRequest')), context), context.requestId);
    }
  }
  return missing();
}
