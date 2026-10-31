import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@eps/domain';
import type { OAuthConsentCoordinator } from './oauth-consent.ts';

/** Uses the same verified browser client as the provider; no privileged credential. */
export function createOAuthConsentCoordinator(client: Pick<SupabaseClient, 'rpc'>, resource: string): OAuthConsentCoordinator {
  async function invoke(name: string, input: Record<string, string>): Promise<unknown> {
    try {
      const result = await client.rpc(name, input).abortSignal(AbortSignal.timeout(15_000));
      if (result.error) throw new Error('Coordination failed.');
      // The domain validates the closed envelope and authoritative binding.
      return result.data;
    } catch {
      throw new DomainError('OAUTH_AUTHORIZATION_UNAVAILABLE', 'The authorization request could not be coordinated. Restart the connection from your client.', 503, {}, true);
    }
  }
  return {
    claim: input => invoke('eps_oauth_consent_claim', { p_authorization_id: input.authorizationId, p_resource: resource,
      p_action: input.action, p_request_id: input.requestId }),
    finish: input => invoke('eps_oauth_consent_finish', { p_authorization_id: input.authorizationId, p_resource: resource,
      p_claim_id: input.claimId, p_outcome: input.outcome }),
  };
}
