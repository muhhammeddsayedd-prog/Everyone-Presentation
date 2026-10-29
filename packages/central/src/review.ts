import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, type Actor } from '../../domain/src/types.ts';
import { parseAiSuggestionCreate, parseCastingRetirementUndo, parseReviewFitRequest, parseReviewOptions, parseSeriesCreate, parseSeriesListOptions, parseSeriesPatch } from '../../domain/src/review.ts';
import { parseCastingMutationContext } from '../../domain/src/casting.ts';
import type { ReviewMutationContext, ReviewOperations } from '../../domain/src/review-types.ts';
import { verifyCentralUser } from './client.ts';
import { centralRpcError } from './errors.ts';
import { aiSuggestionDto, castingRetirementDto, presentationSeriesDto, retirementUndoDto, reviewJobDto, reviewRecord, workspaceReviewDto } from './review-dto.ts';

const invalid = (): never => { throw new DomainError('VALIDATION_FAILED', 'Provide valid review resource identifiers and operation metadata.', 400); };
const failed = (): never => { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central review data did not match its requested scope.', 503); };
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 200 || value.trim() !== value || /[\p{C}]/u.test(value)) invalid();
  return value as string;
}
function checked<T>(callback: () => T): T { try { return callback(); } catch { return failed(); } }
const privateErrors: Record<string, { code: string; status: number; message: string }> = {
  REVIEW_STATE_INVALID: { code: 'REVIEW_STATE_INVALID', status: 409, message: 'The review inputs changed unexpectedly. Reload the workspace.' },
  INPUT_FINGERPRINT_STALE: { code: 'INPUT_FINGERPRINT_STALE', status: 409, message: 'The reviewed input changed. Reload and measure the current review.' },
  RETIREMENT_UNDO_INVALID: { code: 'RETIREMENT_UNDO_INVALID', status: 409, message: 'This retirement cannot be restored from its current state.' },
  RETIREMENT_UNDO_ALREADY_USED: { code: 'RETIREMENT_UNDO_ALREADY_USED', status: 409, message: 'This retirement was already restored.' },
  RETIREMENT_UNDO_UNAVAILABLE: { code: 'RETIREMENT_UNDO_UNAVAILABLE', status: 409, message: 'This retirement is no longer available to restore. Reload current choices.' },
  TEMPLATE_UNAVAILABLE: { code: 'TEMPLATE_UNAVAILABLE', status: 503, message: 'The selected presentation template is unavailable.' },
};

/** Request-scoped verified-user facade. SQL owns scope, locks, fingerprinting,
 * stale revisions and idempotency; no elevated or fixture fallback exists. */
export async function createCentralReview(client: SupabaseClient): Promise<ReviewOperations> {
  const identity = await verifyCentralUser(client);
  function actorRequired(actor: Actor) { if (actor?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The review actor does not match the verified session.', 403); }
  function context(value: unknown): ReviewMutationContext {
    const key = value && typeof value === 'object' ? (value as Record<string, unknown>).idempotencyKey : null;
    if (typeof key !== 'string' || key.length < 16 || key.length > 200) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Provide a stable Idempotency-Key between 16 and 200 characters.', 400);
    const parsed = parseCastingMutationContext(value);
    if (parsed.requestId && !/^[A-Za-z0-9._:-]{1,128}$/u.test(parsed.requestId)) invalid();
    return parsed;
  }
  async function rpc(actor: Actor, name: string, args: Record<string, unknown>, metadata?: ReviewMutationContext): Promise<unknown> {
    actorRequired(actor);
    try {
      let request = client.rpc(name, args);
      if (metadata?.requestId) request = request.setHeader('X-EPS-Request-ID', metadata.requestId);
      if (metadata?.clientType) request = request.setHeader('X-EPS-Client-Type', metadata.clientType);
      const { data, error } = await request;
      if (error) {
        if (error.code === 'P0001' && typeof error.message === 'string' && Object.hasOwn(privateErrors, error.message)) { const safe = privateErrors[error.message]; throw new DomainError(safe.code, safe.message, safe.status); }
        throw centralRpcError(error);
      }
      return data;
    } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Central review is temporarily unavailable.', 503, {}, true); }
  }
  return {
    async listPresentationSeries(actor, options = {}) {
      actorRequired(actor); const input = parseSeriesListOptions(options);
      const response = await rpc(actor, 'eps_list_presentation_series', { p_options: input });
      const row = checked(() => reviewRecord(response, ['data', 'page']));
      const page = checked(() => reviewRecord(row.page, ['next_cursor']));
      if (!Array.isArray(row.data) || row.data.length > input.limit! || !(page.next_cursor === null || typeof page.next_cursor === 'string' && page.next_cursor.length > 0 && page.next_cursor.length <= 4000)) failed();
      const data = checked(() => (row.data as unknown[]).map(presentationSeriesDto));
      if (new Set(data.map(row => row.id)).size !== data.length || data.some(row => row.archived || input.workspace_id && row.workspace_id !== input.workspace_id || input.output_type && row.output_type !== input.output_type)) failed();
      return { data, page: { next_cursor: page.next_cursor as string | null } };
    },
    async createPresentationSeries(actor, value, metadata) {
      actorRequired(actor); const input = parseSeriesCreate(value); const trace = context(metadata);
      const response = await rpc(actor, 'eps_create_presentation_series', { p_input: input, p_idempotency_key: trace.idempotencyKey }, trace);
      const result = checked(() => presentationSeriesDto(response));
      if (result.workspace_id !== input.workspace_id || result.output_type !== input.output_type || result.audience_preset_id !== input.audience_preset_id) failed();
      return result;
    },
    async getPresentationSeries(actor, seriesId) {
      actorRequired(actor); const id = identifier(seriesId); const value = await rpc(actor, 'eps_get_presentation_series', { p_series_id: id });
      const row = checked(() => presentationSeriesDto(value)); if (row.id !== id) failed(); return row;
    },
    async updatePresentationSeries(actor, seriesId, value, metadata) {
      actorRequired(actor); const id = identifier(seriesId); const input = parseSeriesPatch(value); const trace = context(metadata);
      const result = await rpc(actor, 'eps_update_presentation_series', { p_series_id: id, p_input: input, p_idempotency_key: trace.idempotencyKey }, trace);
      const row = checked(() => presentationSeriesDto(result)); if (row.id !== id) failed(); return row;
    },
    async getWorkspaceReview(actor, workspaceId, value) {
      actorRequired(actor); const workspace = identifier(workspaceId); const input = parseReviewOptions(value);
      const result = await rpc(actor, 'eps_get_workspace_review', { p_workspace_id: workspace, p_series_id: input.series_id, p_output_type: input.output_type ?? null });
      const row = checked(() => workspaceReviewDto(result));
      if (row.workspace_id !== workspace || row.series_id !== input.series_id || input.output_type && row.output_type !== input.output_type) failed(); return row;
    },
    async requestWorkspaceReviewFit(actor, workspaceId, value, metadata) {
      actorRequired(actor); const workspace = identifier(workspaceId); const input = parseReviewFitRequest(value); const trace = context(metadata);
      const result = await rpc(actor, 'eps_request_workspace_review_fit', { p_workspace_id: workspace, p_series_id: input.series_id, p_input: { expected_input_fingerprint: input.expected_input_fingerprint }, p_idempotency_key: trace.idempotencyKey }, trace);
      return checked(() => reviewJobDto(result));
    },
    async createAiSuggestion(actor, value, metadata) {
      actorRequired(actor); const input = parseAiSuggestionCreate(value); const trace = context(metadata);
      const result = await rpc(actor, 'eps_create_ai_suggestion', { p_input: input, p_idempotency_key: trace.idempotencyKey }, trace);
      return checked(() => reviewJobDto(result));
    },
    async getAiSuggestion(actor, suggestionId) {
      actorRequired(actor); const id = identifier(suggestionId); const result = await rpc(actor, 'eps_get_ai_suggestion', { p_suggestion_id: id });
      const row = checked(() => aiSuggestionDto(result)); if (row.id !== id) failed(); return row;
    },
    async getCastingRetirement(actor, workspaceId, resourceId) {
      actorRequired(actor); const workspace = identifier(workspaceId); const resource = identifier(resourceId);
      const result = await rpc(actor, 'eps_get_casting_retirement', { p_workspace_id: workspace, p_resource_id: resource });
      const row = checked(() => castingRetirementDto(result)); if (row.workspace_id !== workspace || row.resource_id !== resource) failed(); return row;
    },
    async undoCastingRetirement(actor, workspaceId, eventId, value, metadata) {
      actorRequired(actor); const workspace = identifier(workspaceId); const event = identifier(eventId); const input = parseCastingRetirementUndo(value); const trace = context(metadata);
      const result = await rpc(actor, 'eps_undo_casting_retirement', { p_workspace_id: workspace, p_event_id: event, p_input: input, p_idempotency_key: trace.idempotencyKey }, trace);
      return checked(() => retirementUndoDto(result));
    },
  };
}
