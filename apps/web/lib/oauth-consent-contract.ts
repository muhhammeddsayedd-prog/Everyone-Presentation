export const OAUTH_UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
// Supabase Auth authorization selectors are opaque 32-character base32 strings,
// distinct from its UUID client/user IDs and Studio request correlation IDs.
export const OAUTH_AUTHORIZATION_ID = /^[a-z2-7]{32}$/u;
export function parseOAuthConsentQuery(query: Record<string, string | string[] | undefined>): { authorizationId: string | null; callbackFailed: boolean } {
  const valid = Object.keys(query).every(key => ['authorization_id', 'auth'].includes(key))
    && typeof query.authorization_id === 'string' && OAUTH_AUTHORIZATION_ID.test(query.authorization_id)
    && (query.auth === undefined || query.auth === 'failed');
  return { authorizationId: valid ? query.authorization_id as string : null, callbackFailed: query.auth === 'failed' };
}
export type OAuthConsentView =
  | { state: 'consent'; authorization_id: string; client: { id: string; name: string; website: string | null }; account_email: string | null; scopes: ['openid'] }
  | { state: 'redirect'; authorization_id: string; redirect_url: string }
  | { state: 'uncertain'; authorization_id: string }
  | { state: 'sign_in_sent'; authorization_id: string };
export function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
export function closed(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).sort().join(',') === keys.slice().sort().join(',');
}
function invalid(): never { throw new Error('The authorization response could not be verified.'); }
export function safeOAuthRedirect(value: unknown, expectedBase?: string): string {
  if (typeof value !== 'string' || value.length > 4096 || /[\p{Cc}\s]/u.test(value)) return invalid();
  let url: URL;
  try { url = new URL(value); } catch { return invalid(); }
  if (url.username || url.password || url.hash || url.href !== value || !(url.protocol === 'https:'
    || url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) return invalid();
  if (expectedBase) {
    const base = new URL(safeOAuthRedirect(expectedBase));
    if (url.origin !== base.origin || url.pathname !== base.pathname || [...base.searchParams].some(([key, entry]) => url.searchParams.getAll(key).length !== 1 || url.searchParams.get(key) !== entry)) return invalid();
    const allowed = new Set([...base.searchParams.keys(), 'code', 'state', 'error', 'error_description']);
    if ([...url.searchParams].some(([key, entry]) => !allowed.has(key) || url.searchParams.getAll(key).length !== 1 || /\p{Cc}/u.test(entry))
      || url.searchParams.has('code') === url.searchParams.has('error')
      || url.searchParams.has('code') && !url.searchParams.get('code') || url.searchParams.has('error') && !url.searchParams.get('error')) return invalid();
  }
  return url.href;
}
/** Browser-side success projection is closed and bound to its own request correlation ID. */
export function parseOAuthConsentEnvelope(value: unknown, requestId: string): OAuthConsentView {
  if (!object(value) || !closed(value, ['request_id', 'data']) || value.request_id !== requestId || !OAUTH_UUID.test(requestId) || !object(value.data)) return invalid();
  const data = value.data;
  if (typeof data.authorization_id !== 'string' || !OAUTH_AUTHORIZATION_ID.test(data.authorization_id)) return invalid();
  if ((data.state === 'uncertain' || data.state === 'sign_in_sent') && closed(data, ['state', 'authorization_id'])) return data as OAuthConsentView;
  if (data.state === 'redirect' && closed(data, ['state', 'authorization_id', 'redirect_url'])) return { state: 'redirect', authorization_id: data.authorization_id, redirect_url: safeOAuthRedirect(data.redirect_url) };
  if (data.state === 'consent' && closed(data, ['state', 'authorization_id', 'client', 'account_email', 'scopes']) && object(data.client)
    && closed(data.client, ['id', 'name', 'website']) && typeof data.client.id === 'string' && OAUTH_UUID.test(data.client.id)
    && typeof data.client.name === 'string' && data.client.name.length > 0 && data.client.name.length <= 200
    && (data.client.website === null || typeof data.client.website === 'string' && new URL(safeOAuthRedirect(data.client.website + '/')).origin === data.client.website)
    && (data.account_email === null || typeof data.account_email === 'string' && data.account_email.length <= 254)
    && Array.isArray(data.scopes) && data.scopes.length === 1 && data.scopes[0] === 'openid') return data as OAuthConsentView;
  return invalid();
}
