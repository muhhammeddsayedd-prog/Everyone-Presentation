/** Public preparation only. No credential, provider, client, environment or database I/O. */
export const HOST = 'https://everyone-presentation-pilot.vercel.app';
export const RESOURCE = HOST + '/mcp';
export const CENTRAL = 'https://pyibofyctwnqpvktepse.supabase.co';
export const ISSUER = CENTRAL + '/auth/v1';
export const PRM = HOST + '/.well-known/oauth-protected-resource/mcp';
export const DISCOVERY = CENTRAL + '/.well-known/oauth-authorization-server/auth/v1';
export const CALLBACK = 'http://localhost:3118/callback';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const fail = () => { throw new Error('HOSTED_OAUTH_PUBLIC_PLAN_UNCONFIRMED'); };

/** Field names follow public Management API and pinned Auth v2.197.0 source.
 * This describes a desired patch; it does not authorize overwriting another hook
 * or constitute a current provider readback, binding or signed-in core proof. */
export function publicOAuthPlan() {
  return { host: HOST, resource: RESOURCE, issuer: ISSUER, protected_resource_metadata: PRM, provider_discovery: DISCOVERY,
    consent_url: HOST + '/oauth/consent', browser_auth_callback: HOST + '/api/auth/callback',
    oauth_business_sign_in_callback: HOST + '/api/oauth/callback',
    provider_patch: { site_url: HOST, oauth_server_enabled: true, oauth_server_authorization_path: '/oauth/consent',
      oauth_server_allow_dynamic_registration: false, hook_custom_access_token_enabled: true,
      hook_custom_access_token_uri: 'pg-functions://postgres/eps/mcp_custom_access_token_hook' },
    client_registration: { client_name: 'Everyone Presentation Studio Hosted Pilot — Claude Code', client_type: 'public',
      token_endpoint_auth_method: 'none', redirect_uris: [CALLBACK], grant_types: ['authorization_code', 'refresh_token'] },
    client_scope: 'openid', client_callback_port: 3118, client_id_source: 'Actual provider-issued UUID required; none invented here.',
    configuration_applied: false, delegated_client_login_or_model_call: false };
}

/** Four public web variables only. Binding/core acceptance remain independent
 * prerequisites owned by the eventual operator; UUID shape does not prove them. */
export function publicMcpEnvironment(clientId, resource = RESOURCE) {
  if (typeof clientId !== 'string' || !UUID.test(clientId) || clientId === '00000000-0000-0000-0000-000000000000' || resource !== RESOURCE) fail();
  return { MCP_AUTH_MODE: 'oauth', MCP_RESOURCE_URL: RESOURCE, MCP_AUTH_ISSUER: ISSUER, MCP_AUTH_CLIENT_IDS: clientId };
}

/** Accept an explicitly selected public projection, never a raw Auth config. */
export function validateProviderProjection(value) {
  const expected = publicOAuthPlan().provider_patch;
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== Object.keys(expected).sort().join(',')
    || Object.entries(expected).some(([key, item]) => value[key] !== item)) fail();
  return true;
}
