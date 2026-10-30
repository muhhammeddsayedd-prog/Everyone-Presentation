import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, type Actor, type MutationContext } from '../../domain/src/types.ts';
import { parseCastingMutationContext } from '../../domain/src/casting.ts';
import { parseSettingsPatch, settingsDto } from '../../domain/src/settings.ts';
import type { Settings, SettingsOperations } from '../../domain/src/settings-types.ts';
import { verifyCentralUser } from './client.ts';
import { centralRpcError } from './errors.ts';

/** A request-scoped acting-user facade. Central SQL owns permission/concurrency/replay. */
export async function createCentralSettings(client: SupabaseClient): Promise<SettingsOperations> {
  const identity = await verifyCentralUser(client);
  function actorRequired(actor: Actor) { if (actor?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The settings actor does not match this verified session.', 403); }
  async function rpc(actor: Actor, name: string, input: Record<string, unknown>, context?: MutationContext): Promise<Settings> {
    actorRequired(actor);
    try {
      let query = client.rpc(name, input);
      if (context?.requestId) query = query.setHeader('X-EPS-Request-ID', context.requestId);
      if (context?.clientType) query = query.setHeader('X-EPS-Client-Type', context.clientType);
      const { data, error } = await query;
      if (error) throw centralRpcError(error);
      try { return settingsDto(data); }
      catch { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central settings did not match their published contract.', 503); }
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Central settings are temporarily unavailable.', 503, {}, true);
    }
  }
  return {
    getSettings: actor => rpc(actor, 'eps_get_settings', {}),
    async updateSettings(actor, input, context) {
      actorRequired(actor);
      const patch = parseSettingsPatch(input);
      if (typeof context?.idempotencyKey !== 'string' || context.idempotencyKey.length < 16 || context.idempotencyKey.length > 200) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Provide a stable Idempotency-Key between 16 and 200 characters.', 400);
      const trace = parseCastingMutationContext(context);
      if (trace.requestId && !/^[A-Za-z0-9._:-]{1,128}$/u.test(trace.requestId)) throw new DomainError('INVALID_REQUEST', 'Provide a bounded request identifier.', 400);
      const saved = await rpc(actor, 'eps_update_settings', { p_input: patch, p_idempotency_key: trace.idempotencyKey }, trace);
      if (saved.row_version !== patch.row_version + 1 || patch.default_timezone !== undefined && saved.default_timezone !== patch.default_timezone || patch.template_version !== undefined && saved.template_version !== patch.template_version) throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central settings did not acknowledge the requested revision and changes.', 503);
      return saved;
    },
  };
}
