import { DomainError, type Actor, type WorkspaceSummaryOperations, workspaceSummaryId } from '@eps/domain';
import { json } from './http';

export function isWorkspaceSummaryRoute(segments: string[]) {
  return segments.length === 3 && segments[0] === 'workspaces' && segments[2] === 'summary';
}
/** The same handler is used by the signed-in HTTP route and MCP dispatcher. */
export async function handleWorkspaceSummaryRequest(request: Request, segments: string[], actor: Actor,
  service: WorkspaceSummaryOperations, requestId: string) {
  if (!isWorkspaceSummaryRoute(segments) || request.method !== 'GET') throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'This workspace summary operation is unavailable.', 503);
  if ([...new URL(request.url).searchParams].length || request.body !== null) throw new DomainError('VALIDATION_FAILED', 'Workspace summary accepts only its workspace path identifier.', 400);
  return json(await service.getWorkspaceSummary(actor, workspaceSummaryId(segments[1])), requestId);
}
