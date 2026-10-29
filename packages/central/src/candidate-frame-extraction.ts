import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, type Actor, type MutationContext } from '@eps/domain';
import { parseFrameExtraction, type FrameExtractionAccepted, type FrameExtractionInput } from '../../domain/src/candidate-frame-extraction.ts';
import { verifyCentralUser } from './client.ts';
import { centralRpcError } from './errors.ts';

const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\p{C}]/u.test(value);
function invalid(): never { throw new DomainError('VALIDATION_FAILED', 'Provide the introduction ID and a stable Idempotency-Key.', 400); }
export async function createCentralFrameExtraction(client: SupabaseClient) {
  const identity = await verifyCentralUser(client);
  return {
    async extractCandidateFrames(actor: Actor, mediaId: string, supplied: FrameExtractionInput, context?: MutationContext): Promise<FrameExtractionAccepted> {
      if (actor?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The frame extraction actor does not match this verified session.', 403);
      if (!id(mediaId) || !id(context?.idempotencyKey) || context.idempotencyKey.length < 16) invalid();
      const input = parseFrameExtraction(supplied);
      try {
        let request = client.rpc('eps_extract_candidate_frames', { p_candidate_media_id: mediaId, p_input: input, p_idempotency_key: context.idempotencyKey });
        if (context.requestId && /^[A-Za-z0-9._:-]{1,128}$/u.test(context.requestId)) request = request.setHeader('X-EPS-Request-ID', context.requestId);
        if (context.clientType) { if (!['browser', 'api', 'mcp'].includes(context.clientType)) invalid(); request = request.setHeader('X-EPS-Client-Type', context.clientType); }
        const { data, error } = await request;
        if (error) {
          if (error.code === 'P0001' && error.message === 'MEDIA_REFERENCE_INVALID') throw new DomainError('MEDIA_REFERENCE_INVALID', 'Choose timestamps from this Ready source recording within the available-frame limit.', 422);
          if (error.code === 'P0001' && error.message === 'INPUT_CHANGED') throw new DomainError('INPUT_CHANGED', 'The introduction changed. Reload it before requesting frames.', 409);
          throw centralRpcError(error);
        }
        if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== 4 || !id(data.job_id) || data.resource_id !== mediaId
          || data.poll_url !== `/api/v1/jobs/${data.job_id}` || !['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled'].includes(data.status))
          throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Frame extraction did not return a valid durable job acknowledgement.', 503);
        return { job_id: data.job_id, resource_id: data.resource_id, poll_url: data.poll_url, status: data.status };
      } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Frame extraction is temporarily unavailable.', 503, {}, true); }
    },
  };
}
