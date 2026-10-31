import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@eps/domain';
import type { OAuthConsentCoordinator } from './oauth-consent.ts';
import { closed, object, OAUTH_UUID } from './oauth-consent-contract.ts';

const STATES = ['claimed', 'consent_ready', 'in_progress', 'already_processed'] as const;
const ACTIONS = ['details', 'approve', 'deny'] as const;
const OUTCOMES = ['consent_ready', 'redirect', 'uncertain', 'rejected'] as const;
const CODES = ['22023', '23505', '28000', '42501', '42702', '42703', '42883', '42P01', '57014', 'P0001',
  'PGRST000', 'PGRST001', 'PGRST002', 'PGRST202', 'PGRST204', 'PGRST205', 'PGRST301', 'PGRST302', 'PGRST303'] as const;
const MESSAGES = ['BROWSER_SESSION_REQUIRED', 'AUTHORIZATION_UNAVAILABLE', 'INPUT_INVALID', 'OUTCOME_INVALID', 'NATIVE_OUTCOME_UNCONFIRMED'] as const;
type CoordinationContext = { operation: 'claim'; action: typeof ACTIONS[number] } | { operation: 'finish'; outcome: typeof OUTCOMES[number] };
export interface OAuthConsentCoordinationTrace {
  event: 'eps.oauth.coordination_response'; trace_id: string; operation: 'claim' | 'finish';
  action?: typeof ACTIONS[number]; outcome?: typeof OUTCOMES[number]; status: number | null;
  phase: 'success' | 'provider_error' | 'transport_error' | 'response_unrecognized';
  code?: typeof CODES[number]; message?: typeof MESSAGES[number]; state?: typeof STATES[number];
  client_id?: string; callback?: 'localhost_3118' | 'claude_ai' | 'other';
}
interface TraceOptions { traceId: string; approvedClientIds?: readonly string[]; log?: (value: OAuthConsentCoordinationTrace) => void }
function member<T extends string>(value: unknown, values: readonly T[]): value is T { return typeof value === 'string' && values.includes(value as T); }
function status(value: unknown): number | null { return Number.isInteger(value) && typeof value === 'number' && value >= 100 && value <= 599 ? value : null; }
function unavailable(): never {
  throw new DomainError('OAUTH_AUTHORIZATION_UNAVAILABLE', 'The authorization request could not be coordinated. Restart the connection from your client.', 503, {}, true);
}

/** Only fixed metadata is projected; trace failures never affect the verified SDK client or domain validation. */
function trace(options: TraceOptions | undefined, context: CoordinationContext, phase: OAuthConsentCoordinationTrace['phase'],
  httpStatus: number | null, data?: unknown, error?: unknown) {
  if (!options?.log || !OAUTH_UUID.test(options.traceId)) return;
  try {
    const value: OAuthConsentCoordinationTrace = { event: 'eps.oauth.coordination_response', trace_id: options.traceId,
      operation: context.operation, status: httpStatus, phase };
    if (context.operation === 'claim' && member(context.action, ACTIONS)) value.action = context.action;
    if (context.operation === 'finish' && member(context.outcome, OUTCOMES)) value.outcome = context.outcome;
    if (phase === 'provider_error' && object(error)) {
      if (member(error.code, CODES)) value.code = error.code;
      const message = MESSAGES.find(candidate => error.message === `OAUTH_CONSENT_${candidate}`);
      if (message) value.message = message;
    }
    if (phase === 'success' && object(data) && member(data.state, STATES)) {
      value.state = data.state;
      const binding = data.binding;
      if (object(binding) && closed(binding, ['authorization_id', 'client', 'redirect_uri', 'scope', 'user_id', 'status', 'expires_at'])
        && object(binding.client) && typeof binding.client.id === 'string' && OAUTH_UUID.test(binding.client.id)
        && options.approvedClientIds?.includes(binding.client.id)) {
        value.client_id = binding.client.id;
        value.callback = binding.redirect_uri === 'http://localhost:3118/callback' ? 'localhost_3118'
          : binding.redirect_uri === 'https://claude.ai/api/mcp/auth_callback' ? 'claude_ai' : 'other';
      }
    }
    options.log(value);
  } catch { /* A trace must not change consent or reveal the thrown error. */ }
}

/** Uses the same verified browser client as the provider; no privileged credential. */
export function createOAuthConsentCoordinator(client: Pick<SupabaseClient, 'rpc'>, resource: string, options?: TraceOptions): OAuthConsentCoordinator {
  async function invoke(name: string, input: Record<string, string>, context: CoordinationContext): Promise<unknown> {
    let result;
    try {
      result = await client.rpc(name, input).abortSignal(AbortSignal.timeout(15_000));
    } catch {
      trace(options, context, 'transport_error', null);
      return unavailable();
    }
    if (!object(result)) { trace(options, context, 'response_unrecognized', null); return unavailable(); }
    if (result.error) { trace(options, context, 'provider_error', status(result.status), undefined, result.error); return unavailable(); }
    const recognized = object(result.data) && closed(result.data, ['claim_id', 'state', 'binding']) && member(result.data.state, STATES);
    trace(options, context, recognized ? 'success' : 'response_unrecognized', status(result.status), result.data);
    // The domain still validates the closed envelope and authoritative binding.
    return result.data;
  }
  return {
    claim: input => invoke('eps_oauth_consent_claim', { p_authorization_id: input.authorizationId, p_resource: resource,
      p_action: input.action, p_request_id: input.requestId }, { operation: 'claim', action: input.action }),
    finish: input => invoke('eps_oauth_consent_finish', { p_authorization_id: input.authorizationId, p_resource: resource,
      p_claim_id: input.claimId, p_outcome: input.outcome }, { operation: 'finish', outcome: input.outcome }),
  };
}
