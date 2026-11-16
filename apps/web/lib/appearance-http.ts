import { DomainError, type Actor, type MutationContext } from '@eps/domain';
import type { AppearanceOperations } from './appearance';
import { json, readJson } from './http';
import { validateContract } from './validation';

/** HTTP mapping for m20 appearance operations; the same shared service backs UI, HTTP and MCP. Dispatch before the
 * generic /candidates routes so /candidates/{id}/observations is never treated as an unknown candidate path. */
export function isAppearanceRoute(s: string[]) {
  return s[0] === 'candidates' && s.length === 3 && s[2] === 'observations' || s[0] === 'candidate-observations' && s.length === 3 && s[2] === 'review'
    || s[0] === 'enrichment-batches' && s.length <= 2 || s[0] === 'candidate-facets' && s.length === 2 && s[1] === 'query';
}
export async function handleAppearanceRequest(request: Request, s: string[], actor: Actor, service: AppearanceOperations, context: MutationContext & { requestId: string }) {
  if (!isAppearanceRoute(s) || s.some(part => !part || part.length > 200)) throw new DomainError('INVALID_REQUEST', 'Provide bounded resource identifiers.', 400);
  if (new URL(request.url).search) throw new DomainError('INVALID_REQUEST', 'This operation does not accept query parameters.', 400);
  const method = request.method; const body = async (schema: string) => validateContract<unknown>(schema, await readJson(request));
  if (s[0] === 'candidates' && method === 'GET') return json(await service.listCandidateObservations(actor, s[1]), context.requestId);
  if (s[0] === 'candidate-observations' && method === 'POST') return json(await service.reviewCandidateObservation(actor, s[1], await body('ObservationReview'), context), context.requestId);
  if (s[0] === 'enrichment-batches' && s.length === 1 && method === 'POST') return json(await service.startEnrichmentBatch(actor, await body('EnrichmentBatchStart'), context), context.requestId);
  if (s[0] === 'enrichment-batches' && s.length === 2 && method === 'GET') return json(await service.getEnrichmentBatch(actor, s[1]), context.requestId);
  if (s[0] === 'candidate-facets' && method === 'POST') return json(await service.getCandidateFacets(actor, await body('FacetFilters')), context.requestId);
  throw new DomainError('RESOURCE_NOT_FOUND', 'This appearance operation is unavailable.', 404);
}
