import { DomainError, type Actor, type CandidateCreate, type CandidatePatch, type CandidateConfirmation,
  type CandidateSearch, type DuplicateResolution, type FrameSelection, type MutationContext,
  type WorkspaceCandidateCreate, type WorkspaceCandidatePatch } from '@eps/domain';
import type { getCandidatesService } from './candidates';
import { json, NO_STORE, readJson } from './http';
import { validateContract } from './validation';
import type { FrameExtractionInput,CandidateSupportArchive } from '@eps/domain';

export type CandidatesOperations = Awaited<ReturnType<typeof getCandidatesService>>;
export function isCandidatesRoute(s: string[]) {
  return s[0] === 'candidates' || s[0] === 'candidate-media' && s.length === 3 && s[2] === 'frames'
    || s[0] === 'workspace-candidates' || s[0] === 'workspaces' && s.length === 3 && s[2] === 'candidates'
    || s[0] === 'roles' && s.length === 3 && s[2] === 'candidate-filters'
    || s[0] === 'candidate-support' && s.length === 3 && s[2] === 'archive'
    || s[0] === 'candidate-media' && s.length === 4 && s[2] === 'frames' && s[3] === 'extract';
}
const invalid = (): never => { throw new DomainError('INVALID_REQUEST', 'Provide supported candidate filters and bounded resource identifiers.', 400); };
function search(url: URL, candidates: boolean): CandidateSearch {
  const result: Record<string, unknown> = {};
  const text = ['cursor', ...(candidates ? ['q','age_or_range','stated_gender','height_measurements','language','accent','skill','city','previous_project_role','classification'] : [])];
  for (const [key, value] of url.searchParams) {
    if (url.searchParams.getAll(key).length !== 1 || value.length > (key === 'cursor' ? 2000 : 500)) invalid();
    if (text.includes(key)) result[key] = value;
    else if (key === 'limit' && /^[1-9][0-9]*$/u.test(value) && Number(value) <= 100) result.limit = Number(value);
    else if (candidates && key === 'include_unknown' && ['true','false'].includes(value)) result.include_unknown = value === 'true';
    else if (candidates && key === 'review_status' && ['reviewed','unreviewed'].includes(value)) result.review_status = value;
    else invalid();
  }
  return result as CandidateSearch;
}
export async function handleCandidatesRequest(request: Request, s: string[], actor: Actor, service: CandidatesOperations, context: MutationContext & { requestId: string }) {
  if (!isCandidatesRoute(s) || s.some(part => !part || part.length > 200)) invalid();
  const method = request.method; const url = new URL(request.url);
  const body = async <T,>(schema: string) => validateContract<T>(schema, await readJson(request));
  const paged = (value: { data: unknown; page: unknown }) => Response.json({ request_id: context.requestId, ...value }, { headers: NO_STORE });
  if (s[0] === 'candidates' && s.length === 1 && method === 'GET') return paged(await service.searchCandidates(actor, search(url, true)));
  if (s[0] === 'workspaces' && method === 'GET') return paged(await service.listWorkspaceCandidates(actor, s[1], search(url, false)));
  if (s[0] === 'candidates' && s.length === 3 && s[2] === 'supporting-files' && method === 'GET') return paged(await service.listCandidateSupport(actor,s[1],search(url,false)));
  if (url.search) invalid();
  if (s[0] === 'roles' && method === 'GET') return json(await service.suggestCandidateFilters(actor, s[1]), context.requestId);
  if (s[0] === 'candidate-support' && method === 'POST') return json(await service.archiveCandidateSupport(actor,s[1],await body<CandidateSupportArchive>('CandidateSupportArchive'),context),context.requestId);
  if (s[0] === 'candidate-media' && s.length === 4 && method === 'POST') return json(await service.extractCandidateFrames(actor,s[1],await body<FrameExtractionInput>('FrameExtraction'),context),context.requestId,202);
  if (s[0] === 'candidates') {
    if (s.length === 1 && method === 'POST') return json(await service.createCandidate(actor, await body<CandidateCreate>('CandidateCreate'), context), context.requestId, 201);
    if (s.length === 2 && method === 'GET') return json(await service.getCandidate(actor, s[1]), context.requestId);
    if (s.length === 2 && method === 'PATCH') return json(await service.updateCandidate(actor, s[1], await body<CandidatePatch>('CandidatePatch'), context), context.requestId);
    if (s.length === 3 && s[2] === 'reviewed' && method === 'POST') return json(await service.confirmCandidateReviewed(actor, s[1], await body<CandidateConfirmation>('ConfirmReviewed'), context), context.requestId);
    if (s.length === 3 && s[2] === 'archive' && method === 'POST') return json(await service.archiveCandidate(actor, s[1], await body<{row_version:number}>('ArchiveRequest'), context), context.requestId);
    if (s.length === 3 && s[2] === 'media' && method === 'GET') return json(await service.getCandidateMedia(actor, s[1]), context.requestId);
    if (s.length === 3 && s[2] === 'duplicates' && method === 'GET') return json(await service.findCandidateDuplicates(actor, s[1]), context.requestId);
    if (s.length === 4 && s[2] === 'duplicates' && s[3] === 'resolve' && method === 'POST') return json(await service.resolveCandidateDuplicate(actor, s[1], await body<DuplicateResolution>('DuplicateResolution'), context), context.requestId);
  }
  if (s[0] === 'candidate-media' && s.length === 3 && method === 'PUT') return json(await service.updateCandidateFrames(actor, s[1], await body<FrameSelection>('FrameSelection'), context), context.requestId);
  if (s[0] === 'workspaces' && method === 'POST') return json(await service.addWorkspaceCandidate(actor, s[1], await body<WorkspaceCandidateCreate>('WorkspaceCandidateCreate'), context), context.requestId, 201);
  if (s[0] === 'workspace-candidates') {
    if (s.length === 2 && method === 'PATCH') return json(await service.updateWorkspaceCandidate(actor, s[1], await body<WorkspaceCandidatePatch>('WorkspaceCandidatePatch'), context), context.requestId);
    if (s.length === 3 && s[2] === 'remove' && method === 'POST') return json(await service.removeWorkspaceCandidate(actor, s[1], await body<{row_version:number}>('ArchiveRequest'), context), context.requestId);
  }
  throw new DomainError('RESOURCE_NOT_FOUND', 'This candidate operation is unavailable.', 404);
}
