import { createBearerUserClient, readCentralConfig, type CentralConfig } from '@eps/central';
import { DomainError } from '@eps/domain';
import type { McpSessionCheck, McpSessionState } from './mcp-auth.ts';
import { readMcpAuthConfig } from './mcp-auth-config.ts';
import { MCP_ATOMIC_CAPABILITIES } from './mcp-capabilities.ts';
import { readRuntimeConfig } from './config.ts';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
function unavailable(): never {
  throw new DomainError('MCP_SESSION_VALIDATION_UNAVAILABLE', 'Studio delegated-session validation is unavailable. Check the reviewed migration and Auth configuration.', 503, {}, true);
}
function identifier(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }

/** Closed projection from a narrow own-session RPC. Never accept provider record payloads. */
export function parseMcpCentralSession(value: unknown): McpSessionState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unavailable();
  const object = value as Record<string, unknown>;
  if (Object.keys(object).sort().join(',') !== 'active,capabilities,client_id,principal_id,session_id'
    || typeof object.active !== 'boolean' || !Array.isArray(object.capabilities) || object.capabilities.length > 64
    || object.capabilities.some(item => typeof item !== 'string' || !MCP_ATOMIC_CAPABILITIES.has(item))
    || new Set(object.capabilities).size !== object.capabilities.length
    || !['principal_id', 'session_id', 'client_id'].every(key => identifier(object[key]) || !object.active && object[key] === null)
    || !object.active && object.capabilities.length !== 0) return unavailable();
  return Object.freeze({ active: object.active, principalId: object.principal_id as string | null,
    sessionId: object.session_id as string | null, clientId: object.client_id as string | null,
    capabilities: Object.freeze((object.capabilities as string[]).slice()) });
}

/** The bearer is already signature/resource validated; this RPC rechecks its actual central session. */
export function createMcpCentralSessionCheck(central: CentralConfig, resourceUrl: string, options: { fetch?: typeof fetch } = {}): McpSessionCheck {
  return async input => {
    if (input.resourceUrl !== resourceUrl || !identifier(input.principalId) || !identifier(input.sessionId) || !identifier(input.clientId)) return unavailable();
    try {
      const client = createBearerUserClient({ ...central, accessToken: input.accessToken }, options);
      const { data, error } = await client.rpc('eps_validate_own_oauth_session', { p_resource: resourceUrl }).abortSignal(AbortSignal.timeout(5000));
      if (error) return unavailable();
      return parseMcpCentralSession(data);
    } catch { return unavailable(); }
  };
}

/** Read configuration only. This does not enable OAuth or change the central provider. */
export function readMcpServerEnvironment(env: Record<string, string | undefined> = process.env) {
  const runtime = readRuntimeConfig(env);
  const central = runtime.adapterMode === 'supabase' ? readCentralConfig(env) : undefined;
  const config = readMcpAuthConfig(env, runtime, central?.url ?? '');
  return { runtime, central, config };
}
