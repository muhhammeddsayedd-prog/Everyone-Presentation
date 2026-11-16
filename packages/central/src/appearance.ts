import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, parseEnrichmentBatchStart, parseFacetFilters, parseObservationReview, APPEARANCE_ATTRIBUTES, FACET_KEYS, type Actor, type AppearanceObservation,
  type CandidateFacets, type CandidateObservations, type EnrichmentBatch, type MutationContext, type ObservationMedia } from '@eps/domain';
import { verifyCentralUser } from './client.ts';
import { centralRpcError } from './errors.ts';

/** User-JWT-only appearance operations (m20). The database derives capability, scope and every state rule; this adapter
 * validates inputs and the exact shape of what comes back. Search/facets count confirmed and overridden values only. */
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const invalid = (): never => { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central appearance data did not match its contract.', 503); };
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function exact(value: unknown, keys: string[]): Record<string, unknown> {
  if (!object(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) invalid();
  return value as Record<string, unknown>;
}
const id = (value: unknown) => typeof value === 'string' && UUID.test(value);
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const nullableString = (value: unknown) => value === null || typeof value === 'string';
export function observationDto(value: unknown): AppearanceObservation {
  const row = exact(value, ['id', 'media_id', 'person_index', 'position_note', 'attribute', 'suggested_value', 'confidence', 'evidence', 'status', 'override_value',
    'effective_value', 'reviewed_by', 'reviewed_at', 'row_version']);
  if (!id(row.id) || !id(row.media_id) || !count(row.person_index) || Number(row.person_index) > 9 || !APPEARANCE_ATTRIBUTES.includes(String(row.attribute))
    || typeof row.suggested_value !== 'string' || !['low', 'medium', 'high'].includes(String(row.confidence)) || !nullableString(row.evidence) || !nullableString(row.position_note)
    || !['suggested', 'confirmed', 'rejected', 'overridden'].includes(String(row.status)) || !nullableString(row.override_value) || !nullableString(row.effective_value)
    || (row.status === 'overridden') !== (row.override_value !== null) || (row.status === 'suggested') !== (row.reviewed_by === null) || row.reviewed_by !== null && !id(row.reviewed_by)
    || !Number.isSafeInteger(row.row_version) || Number(row.row_version) < 1) invalid();
  return structuredClone(row) as unknown as AppearanceObservation;
}
function mediaDto(value: unknown): ObservationMedia {
  const row = exact(value, ['id', 'asset_id', 'source_kind', 'thumb_asset_id', 'candidate_media_id', 'frame_timestamp_ms', 'media_category', 'recording_context', 'media_added_at',
    'people_count', 'ambiguous', 'target_person_index', 'quality_note', 'model', 'prompt_version', 'analyzed_at', 'row_version', 'observations']);
  if (!id(row.id) || !id(row.asset_id) || !['photo', 'frame'].includes(String(row.source_kind)) || row.thumb_asset_id !== null && !id(row.thumb_asset_id)
    || (row.source_kind === 'frame') !== (row.candidate_media_id !== null) || !['portfolio_photo', 'headshot', 'full_body', 'video_frame'].includes(String(row.media_category))
    || !count(row.people_count) || typeof row.ambiguous !== 'boolean' || !Array.isArray(row.observations) || row.observations.length > 200) invalid();
  return { ...structuredClone(row), observations: (row.observations as unknown[]).map(observationDto) } as unknown as ObservationMedia;
}
function batchDto(value: unknown): EnrichmentBatch {
  const row = exact(value, ['id', 'workspace_id', 'status', 'scope', 'item_limit', 'spend_cap_cents', 'spent_micro_usd', 'model', 'prompt_version', 'created_at', 'updated_at',
    'completed_at', 'row_version', 'counts', 'items']);
  if (!id(row.id) || !id(row.workspace_id) || !['running', 'completed', 'stopped_spend_cap', 'cancelled'].includes(String(row.status)) || !count(row.spent_micro_usd)
    || !Array.isArray(row.items) || row.items.length > 200) invalid();
  exact(row.counts, ['total', 'pending', 'queued', 'succeeded', 'failed', 'skipped', 'input_tokens', 'output_tokens']);
  for (const item of row.items as unknown[]) { const entry = exact(item, ['candidate_id', 'position', 'status', 'job_id', 'error_code', 'cost_micro_usd']); if (!id(entry.candidate_id)) invalid(); }
  return structuredClone(row) as unknown as EnrichmentBatch;
}
function facetsDto(value: unknown): CandidateFacets {
  const row = exact(value, ['total', 'filters', 'facets']);
  if (!count(row.total) || !Array.isArray(row.facets) || row.facets.length !== FACET_KEYS.length) invalid();
  for (const facet of row.facets as unknown[]) {
    const entry = exact(facet, ['key', 'matched', 'unknown', 'values', 'selected']);
    if (!FACET_KEYS.includes(String(entry.key)) || !count(entry.matched) || !count(entry.unknown) || Number(entry.unknown) > Number(entry.matched) || !Array.isArray(entry.values)) invalid();
    for (const item of entry.values as unknown[]) { const pair = exact(item, ['value', 'count']); if (typeof pair.value !== 'string' || !count(pair.count) || Number(pair.count) > Number(entry.matched)) invalid(); }
  }
  return structuredClone(row) as unknown as CandidateFacets;
}

export async function createCentralAppearance(client: SupabaseClient) {
  const identity = await verifyCentralUser(client);
  function actor(value: Actor) { if (value?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The appearance actor does not match this verified session.', 403); }
  function key(context?: MutationContext) {
    const value = context?.idempotencyKey; if (typeof value !== 'string' || value.trim().length < 16 || value.length > 200) throw new DomainError('INVALID_REQUEST', 'Provide a stable Idempotency-Key.', 400);
    return value;
  }
  async function rpc(name: string, args: Record<string, unknown>, context?: MutationContext) {
    try {
      let query = client.rpc(name, args);
      if (context?.requestId && /^[A-Za-z0-9._:-]{1,128}$/u.test(context.requestId)) query = query.setHeader('X-EPS-Request-ID', context.requestId);
      const result = await query; if (result.error) throw centralRpcError(result.error); return result.data as unknown;
    } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Appearance information is temporarily unavailable.', 503, {}, true); }
  }
  const candidate = (value: string) => { if (!UUID.test(value)) throw new DomainError('INVALID_REQUEST', 'Provide a bounded resource identifier.', 400); return value; };
  return {
    async listCandidateObservations(acting: Actor, candidateId: string): Promise<CandidateObservations> {
      actor(acting); const value = exact(await rpc('eps_list_candidate_observations', { p_candidate_id: candidate(candidateId) }), ['data']);
      const data = exact(value.data, ['candidate_id', 'supplied', 'media']);
      if (data.candidate_id !== candidateId || !Array.isArray(data.media) || data.media.length > 100) invalid();
      exact(data.supplied, ['archive', 'facts']);
      return { candidate_id: candidateId, supplied: structuredClone(data.supplied) as CandidateObservations['supplied'], media: (data.media as unknown[]).map(mediaDto) };
    },
    async reviewCandidateObservation(acting: Actor, observationId: string, input: unknown, context?: MutationContext): Promise<AppearanceObservation> {
      actor(acting); const body = parseObservationReview(input);
      const value = exact(await rpc('eps_review_candidate_observation', { p_observation_id: candidate(observationId), p_input: body, p_idempotency_key: key(context) }, context), ['data', 'changed']);
      return observationDto(value.data);
    },
    async startEnrichmentBatch(acting: Actor, input: unknown, context?: MutationContext): Promise<EnrichmentBatch> {
      actor(acting); const body = parseEnrichmentBatchStart(input);
      const value = exact(await rpc('eps_start_enrichment_batch', { p_input: body, p_idempotency_key: key(context) }, context), ['data', 'created']);
      return batchDto(value.data);
    },
    async getEnrichmentBatch(acting: Actor, batchId: string): Promise<EnrichmentBatch> {
      actor(acting); return batchDto(exact(await rpc('eps_get_enrichment_batch', { p_batch_id: candidate(batchId) }), ['data']).data);
    },
    async getCandidateFacets(acting: Actor, filters: unknown): Promise<CandidateFacets> {
      actor(acting); return facetsDto(exact(await rpc('eps_candidate_facets', { p_filters: parseFacetFilters(filters) }), ['data']).data);
    },
  };
}
export type CentralAppearance = Awaited<ReturnType<typeof createCentralAppearance>>;
export { batchDto as enrichmentBatchDto, facetsDto as candidateFacetsDto, mediaDto as observationMediaDto };
