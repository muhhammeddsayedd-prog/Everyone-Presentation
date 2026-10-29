import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, parseSuggestedCandidateFilters, type Actor, type SuggestedCandidateFilters } from '@eps/domain';
import { verifyCentralUser } from './client.ts';
import { centralRpcError } from './errors.ts';

/** Current-role suggestions are authorized and projected in one database read. No local permission cache. */
export async function createCentralCandidateFilters(client: SupabaseClient) {
  const identity = await verifyCentralUser(client);
  return {
    async suggestCandidateFilters(actor: Actor, roleId: string): Promise<SuggestedCandidateFilters> {
      if (actor?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The filter actor does not match this verified session.', 403);
      if (typeof roleId !== 'string' || roleId.length < 1 || roleId.length > 200) throw new DomainError('INVALID_REQUEST', 'Provide a bounded role identifier.', 400);
      try {
        const { data, error } = await client.rpc('eps_suggest_candidate_filters', { p_role_id: roleId });
        if (error) throw centralRpcError(error);
        let result: SuggestedCandidateFilters;
        try {
          result = parseSuggestedCandidateFilters(data);
          if (result.role_id !== roleId) throw new Error('Role scope changed.');
        } catch { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central role filters did not match their published contract.', 503); }
        return result;
      } catch (error) {
        if (error instanceof DomainError) throw error;
        throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Role filter suggestions are temporarily unavailable.', 503, {}, true);
      }
    },
  };
}
export type CentralCandidateFilters = Awaited<ReturnType<typeof createCentralCandidateFilters>>;
