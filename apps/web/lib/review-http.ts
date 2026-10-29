import { DomainError, type Actor, type MutationContext } from '@eps/domain';
import { parseAiSuggestionCreate, parseCastingRetirementUndo, parseReviewFitRequest, parseReviewOptions, parseSeriesCreate, parseSeriesListOptions, parseSeriesPatch } from '../../../packages/domain/src/review';
import { parseCastingMutationContext } from '../../../packages/domain/src/casting';
import type { ReviewOperations } from '../../../packages/domain/src/review-types';
import { json, NO_STORE, readJson } from './http';
import { validateContract } from './validation';

export function isReviewRoute(s: string[]): boolean {
  return s[0] === 'presentation-series' && (s.length === 1 || s.length === 2)
    || s[0] === 'ai-suggestions' && (s.length === 1 || s.length === 2)
    || s[0] === 'workspaces' && (s.length === 3 && s[2] === 'review' || s.length === 4 && s[2] === 'review' && s[3] === 'fit'
      || s.length === 4 && s[2] === 'retirements' || s.length === 5 && s[2] === 'retirements' && s[4] === 'undo');
}
function invalid(): never { throw new DomainError('INVALID_REQUEST', 'Use the supported review route, method and bounded parameters.', 400); }
function options(url: URL, allowed: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams) {
    if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1 || !value) invalid();
    if (key === 'limit') { if (!/^[1-9][0-9]*$/u.test(value) || Number(value) > 100) invalid(); result.limit = Number(value); }
    else result[key] = value;
  }
  return result;
}
export async function handleReviewRequest(request: Request, s: string[], actor: Actor, service: ReviewOperations, metadata: MutationContext & { requestId: string }): Promise<Response> {
  if (!isReviewRoute(s) || s.some(part => !part || part.length > 200)) invalid();
  const method = request.method; const url = new URL(request.url);
  if (method === 'GET') {
    if (s[0] === 'presentation-series' && s.length === 1) {
      const result = await service.listPresentationSeries(actor, parseSeriesListOptions(options(url, ['workspace_id', 'output_type', 'cursor', 'limit'])));
      return Response.json({ request_id: metadata.requestId, ...result }, { headers: NO_STORE });
    }
    if (s[0] === 'workspaces' && s[2] === 'review' && s.length === 3) return json(await service.getWorkspaceReview(actor, s[1], parseReviewOptions(options(url, ['series_id', 'output_type']))), metadata.requestId);
    if (url.search) invalid();
    if (s[0] === 'presentation-series' && s.length === 2) return json(await service.getPresentationSeries(actor, s[1]), metadata.requestId);
    if (s[0] === 'ai-suggestions' && s.length === 2) return json(await service.getAiSuggestion(actor, s[1]), metadata.requestId);
    if (s[0] === 'workspaces' && s[2] === 'retirements' && s.length === 4) return json(await service.getCastingRetirement(actor, s[1], s[3]), metadata.requestId);
  }
  if (url.search) invalid();
  const operation = s[0] === 'presentation-series' && s.length === 1 && method === 'POST' ? 'series-create'
    : s[0] === 'presentation-series' && s.length === 2 && method === 'PATCH' ? 'series-update'
    : s[0] === 'ai-suggestions' && s.length === 1 && method === 'POST' ? 'suggestion'
    : s[0] === 'workspaces' && s[2] === 'review' && s[3] === 'fit' && method === 'POST' ? 'fit'
    : s[0] === 'workspaces' && s[2] === 'retirements' && s[4] === 'undo' && method === 'POST' ? 'undo' : null;
  if (!operation) throw new DomainError('RESOURCE_NOT_FOUND', 'This review operation is unavailable.', 404);
  if (typeof metadata.idempotencyKey !== 'string' || metadata.idempotencyKey.length < 16 || metadata.idempotencyKey.length > 200) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Provide an Idempotency-Key between 16 and 200 characters.', 400);
  const context = parseCastingMutationContext(metadata); const body = await readJson(request);
  const schema = operation === 'series-create' ? 'PresentationSeriesCreate' : operation === 'series-update' ? 'PresentationSeriesPatch' : operation === 'suggestion' ? 'AiSuggestionCreate' : operation === 'fit' ? 'ReviewFitRequest' : 'CastingRetirementUndo';
  const checked = validateContract(schema, body);
  switch (operation) {
    case 'series-create': return json(await service.createPresentationSeries(actor, parseSeriesCreate(checked), context), metadata.requestId, 201);
    case 'series-update': return json(await service.updatePresentationSeries(actor, s[1], parseSeriesPatch(checked), context), metadata.requestId);
    case 'suggestion': return json(await service.createAiSuggestion(actor, parseAiSuggestionCreate(checked), context), metadata.requestId, 202);
    case 'fit': return json(await service.requestWorkspaceReviewFit(actor, s[1], parseReviewFitRequest(checked), context), metadata.requestId, 202);
    case 'undo': return json(await service.undoCastingRetirement(actor, s[1], s[3], parseCastingRetirementUndo(checked), context), metadata.requestId);
  }
}
