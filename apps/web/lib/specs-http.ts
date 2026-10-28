import { DomainError, parseReorderWorkspace, parseSpecSubmit, type Actor, type MutationContext, type ResizeSlots, type ReorderWorkspace,
  type RoleCreate, type RolePatch, type SlotPatch, type SpecPatch, type SpecSubmit } from '@eps/domain';
import type { CentralSpecs, SpecsArchiveInput, SpecsListOptions } from '@eps/central';
import { json, NO_STORE, readJson } from './http';
import { validateContract } from './validation';

export type SpecsOperations = CentralSpecs;
export function isManualSpecsRoute(segments: string[]): boolean {
  return segments[0] === 'workspaces' && segments.length === 3 && ['specs', 'roles', 'order'].includes(segments[2])
    || segments[0] === 'roles' && (segments.length === 2 || segments.length === 3 && ['archive', 'slots'].includes(segments[2])
      || segments.length === 4 && segments[2] === 'slots' && segments[3] === 'resize')
    || segments[0] === 'slots' && segments.length === 2;
}
const invalid = (): never => { throw new DomainError('INVALID_REQUEST', 'Use bounded resource identifiers and supported cursor/limit parameters.', 400); };
function listOptions(url: URL): SpecsListOptions {
  const result: SpecsListOptions = {};
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

/** Caller verifies the session and mutation origin; RPCs recheck current resource scope. */
export async function handleSpecsRequest(request: Request, segments: string[], actor: Actor,
  specs: SpecsOperations, context: MutationContext & { requestId: string }) {
  if (!isManualSpecsRoute(segments)) throw new DomainError('RESOURCE_NOT_FOUND', 'This requirements operation is unavailable.', 404);
  if (!segments[1] || segments[1].length > 200) invalid();
  const url = new URL(request.url); const method = request.method;
  const paged = (value: { data: unknown; page: unknown }) => Response.json({ request_id: context.requestId, ...value }, { headers: NO_STORE });
  const body = async <T,>(schema: string) => validateContract<T>(schema, await readJson(request));
  if (method === 'GET' && segments[0] === 'workspaces' && segments[2] === 'roles') {
    return paged(await specs.listRoles(actor, segments[1], listOptions(url)));
  }
  if (method === 'GET' && segments[0] === 'roles' && segments.length === 3 && segments[2] === 'slots') {
    return paged(await specs.listSlots(actor, segments[1], listOptions(url)));
  }
  if (url.search) invalid();
  if (segments[0] === 'workspaces' && segments[2] === 'order' && method === 'PUT') {
    const input = parseReorderWorkspace(await body<ReorderWorkspace>('ReorderWorkspace'));
    return json(await specs.reorderWorkspace(actor, segments[1], input, context), context.requestId);
  }
  if (segments[0] === 'workspaces' && segments[2] === 'specs') {
    if (method === 'GET') return json(await specs.getSpecs(actor, segments[1]), context.requestId);
    if (method === 'PATCH') return json(await specs.updateSpecs(actor, segments[1], await body<SpecPatch>('SpecPatch'), context), context.requestId);
    if (method === 'POST') {
      parseSpecSubmit(await body<SpecSubmit>('SpecSubmit'));
      throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Specs processing is not available yet. You can enter and edit requirements manually.', 503);
    }
  }
  if (segments[0] === 'workspaces' && segments[2] === 'roles' && method === 'POST') {
    return json(await specs.createRole(actor, segments[1], await body<RoleCreate>('RoleCreate'), context), context.requestId, 201);
  }
  if (segments[0] === 'roles') {
    if (segments.length === 2 && method === 'PATCH') return json(await specs.updateRole(actor, segments[1], await body<RolePatch>('RolePatch'), context), context.requestId);
    if (segments.length === 3 && segments[2] === 'archive' && method === 'POST') {
      return json(await specs.archiveRole(actor, segments[1], await body<SpecsArchiveInput>('ArchiveRequest'), context), context.requestId);
    }
    if (segments.length === 4 && segments[3] === 'resize' && method === 'POST') {
      return json(await specs.resizeRoleSlots(actor, segments[1], await body<ResizeSlots>('ResizeSlots'), context), context.requestId);
    }
  }
  if (segments[0] === 'slots' && method === 'PATCH') return json(await specs.updateSlot(actor, segments[1], await body<SlotPatch>('SlotPatch'), context), context.requestId);
  throw new DomainError('RESOURCE_NOT_FOUND', 'This requirements operation is unavailable.', 404);
}
