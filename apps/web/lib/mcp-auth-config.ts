import { DomainError } from '@eps/domain';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
export interface McpOAuthConfig {
  readonly mode: 'oauth';
  readonly resourceUrl: string;
  readonly issuer: string;
  readonly jwksUrl: string;
  readonly discoveryUrl: string;
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly approvedClientIds: readonly string[];
  /** Supabase's OIDC scope establishes identity. Business permissions remain separate. */
  readonly scopesSupported: readonly ['openid'];
}
export type McpAuthConfig = McpOAuthConfig | { readonly mode: 'local'; readonly baseUrl: string } | { readonly mode: 'disabled' };
interface Runtime { adapterMode: string; environment: string; baseUrl: string }
function invalid(): never {
  throw new DomainError('MCP_AUTH_CONFIGURATION_REQUIRED', 'MCP authorization requires a complete resource, central issuer and approved-client configuration.', 503);
}
function canonicalUrl(value: string | undefined, allowHttpLoopback = false): URL {
  if (!value || value.length > 2048) return invalid();
  let url: URL;
  try { url = new URL(value); } catch { return invalid(); }
  const protocolAllowed = url.protocol === 'https:' || allowHttpLoopback && url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.href !== value || !protocolAllowed) return invalid();
  return url;
}

/** No implicit remote enablement. Issuer/JWKS/discovery are bound to the existing central project. */
export function readMcpAuthConfig(env: Record<string, string | undefined>, runtime: Runtime, centralUrl: string): McpAuthConfig {
  const mode = env.MCP_AUTH_MODE ?? 'local';
  if (mode === 'disabled') return Object.freeze({ mode: 'disabled' });
  if (mode === 'local') {
    const local = new URL(runtime.baseUrl);
    return runtime.adapterMode === 'supabase' && ['development', 'test'].includes(runtime.environment)
      && env.NODE_ENV !== 'production' && local.protocol === 'http:' && LOCAL_HOSTS.has(local.hostname)
      && !local.username && !local.password && !local.search && !local.hash && local.pathname === '/'
      ? Object.freeze({ mode: 'local', baseUrl: local.origin }) : Object.freeze({ mode: 'disabled' });
  }
  if (mode !== 'oauth' || runtime.adapterMode !== 'supabase') return invalid();
  const app = new URL(runtime.baseUrl);
  const allowHttpLoopback = ['development', 'test'].includes(runtime.environment) && env.NODE_ENV !== 'production';
  const resource = canonicalUrl(env.MCP_RESOURCE_URL, allowHttpLoopback);
  // The app contract exposes a single /mcp resource. Ignore forwarded/request-selected hosts.
  if (resource.href !== `${app.origin}/mcp`) return invalid();
  const central = canonicalUrl(`${centralUrl.replace(/\/$/u, '')}/`);
  if (central.pathname !== '/' || LOCAL_HOSTS.has(central.hostname)) return invalid();
  const issuer = canonicalUrl(env.MCP_AUTH_ISSUER);
  if (issuer.href !== `${central.origin}/auth/v1`) return invalid();
  const clientIds = env.MCP_AUTH_CLIENT_IDS?.split(',').map(value => value.trim());
  if (!clientIds?.length || clientIds.length > 32 || clientIds.some(value => !UUID.test(value)) || new Set(clientIds).size !== clientIds.length) return invalid();
  return Object.freeze({ mode: 'oauth', resourceUrl: resource.href, issuer: issuer.href,
    jwksUrl: `${issuer.href}/.well-known/jwks.json`, discoveryUrl: `${central.origin}/.well-known/oauth-authorization-server/auth/v1`,
    authorizationEndpoint: `${issuer.href}/oauth/authorize`, tokenEndpoint: `${issuer.href}/oauth/token`,
    approvedClientIds: Object.freeze(clientIds), scopesSupported: Object.freeze(['openid'] as const) });
}
