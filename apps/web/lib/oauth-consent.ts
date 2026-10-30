import { DomainError } from '@eps/domain';
import { mapSignInError } from './auth-sign-in.ts';
import { closed, object, OAUTH_UUID, safeOAuthRedirect, type OAuthConsentView } from './oauth-consent-contract.ts';
export { safeOAuthRedirect } from './oauth-consent-contract.ts';

export interface OAuthConsentConfig { baseUrl: string; approvedClientIds: readonly string[] }
export interface OAuthBrowserIdentity { principalId: string; email: string | null }
interface ProviderResult { data: unknown; error: unknown }
export interface OAuthConsentProvider {
  getAuthorizationDetails(id: string): Promise<ProviderResult>;
  approveAuthorization(id: string, options: { skipBrowserRedirect: true }): Promise<ProviderResult>;
  denyAuthorization(id: string, options: { skipBrowserRedirect: true }): Promise<ProviderResult>;
}
export interface OAuthConsentInput { authorization_id: string; request_id: string; action: 'details' | 'approve' | 'deny' }
export interface OAuthSignInInput { authorization_id: string; request_id: string; email: string }
export interface OAuthSignInLink { email: string; options: { shouldCreateUser: false; emailRedirectTo: string } }
function invalidInput(): never { throw new DomainError('VALIDATION_FAILED', 'Use a valid authorization request from your connected client.', 400); }
function providerInvalid(): never { throw new DomainError('OAUTH_PROVIDER_RESPONSE_INVALID', 'The authorization service response could not be verified. Restart the connection from your client.', 503); }
function unavailable(): never { throw new DomainError('OAUTH_AUTHORIZATION_UNAVAILABLE', 'The authorization request is unavailable. Check its status or restart the connection from your client.', 503, {}, true); }
function text(value: unknown, maximum: number): value is string { return typeof value === 'string' && value.length > 0 && value.length <= maximum && !/\p{Cc}/u.test(value); }
function clientDetails(value: unknown): value is Record<string, unknown> {
  // Auth v2.197.0 ClientDetailsResponse uses omitempty for optional metadata.
  // Studio still requires an explicitly named, approved client before consent.
  return object(value) && Object.hasOwn(value, 'id') && Object.hasOwn(value, 'name')
    && Object.keys(value).every(key => ['id', 'name', 'uri', 'logo_uri'].includes(key));
}
export function parseOAuthConsentInput(value: unknown): OAuthConsentInput {
  if (!object(value) || !closed(value, ['authorization_id', 'request_id', 'action']) || typeof value.authorization_id !== 'string' || !OAUTH_UUID.test(value.authorization_id)
    || typeof value.request_id !== 'string' || !OAUTH_UUID.test(value.request_id) || typeof value.action !== 'string' || !['details', 'approve', 'deny'].includes(value.action)) return invalidInput();
  return value as unknown as OAuthConsentInput;
}
function signInInput(value: unknown): OAuthSignInInput {
  if (!object(value) || !closed(value, ['authorization_id', 'request_id', 'email']) || typeof value.authorization_id !== 'string' || !OAUTH_UUID.test(value.authorization_id)
    || typeof value.request_id !== 'string' || !OAUTH_UUID.test(value.request_id) || typeof value.email !== 'string') return invalidInput();
  const email = value.email.trim();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return invalidInput();
  return { authorization_id: value.authorization_id, request_id: value.request_id, email };
}
function redirect(value: unknown, authorizationId: string, expectedBase?: string): OAuthConsentView {
  if (!object(value) || !closed(value, ['redirect_url'])) return providerInvalid();
  try { return { state: 'redirect', authorization_id: authorizationId, redirect_url: safeOAuthRedirect(value.redirect_url, expectedBase) }; }
  catch { return providerInvalid(); }
}
async function details(provider: OAuthConsentProvider, authorizationId: string, identity: OAuthBrowserIdentity, config: OAuthConsentConfig, verifiedCallback?: string) {
  if (!OAUTH_UUID.test(authorizationId) || !OAUTH_UUID.test(identity.principalId)) return invalidInput();
  let result: ProviderResult;
  try { result = await provider.getAuthorizationDetails(authorizationId); } catch { return unavailable(); }
  if (!result || result.error || !object(result.data)) return unavailable();
  const value = result.data;
  // Existing-consent responses omit the client/user/scope. They cannot establish
  // Studio authority on an initial read. Recovery is bound to details verified
  // earlier within this same decision request, never caller-supplied metadata.
  if (closed(value, ['redirect_url'])) {
    if (!verifiedCallback) return providerInvalid();
    return { view: redirect(value, authorizationId, verifiedCallback), callback: verifiedCallback };
  }
  if (!closed(value, ['authorization_id', 'redirect_uri', 'client', 'user', 'scope']) || value.authorization_id !== authorizationId
    || !clientDetails(value.client) || typeof value.client.id !== 'string'
    || !config.approvedClientIds.includes(value.client.id) || !text(value.client.name, 200) || !value.client.name.trim()
    || !object(value.user) || !closed(value.user, ['id', 'email']) || value.user.id !== identity.principalId
    || typeof value.user.email !== 'string' || value.user.email.length > 254 || /\p{Cc}/u.test(value.user.email)
    || value.scope !== 'openid') return providerInvalid();
  let callback: string, website: string | null = null;
  const uri = Object.hasOwn(value.client, 'uri') ? value.client.uri : null;
  const logoUri = Object.hasOwn(value.client, 'logo_uri') ? value.client.logo_uri : null;
  try {
    callback = safeOAuthRedirect(value.redirect_uri);
    if (typeof uri === 'string' && uri) website = new URL(safeOAuthRedirect(uri)).origin;
    else if (uri !== '' && uri !== null) return providerInvalid();
    if (!(typeof logoUri === 'string' || logoUri === null) || typeof logoUri === 'string' && logoUri.length > 2048) return providerInvalid();
  } catch { return providerInvalid(); }
  const view: OAuthConsentView = { state: 'consent', authorization_id: authorizationId,
    client: { id: value.client.id, name: value.client.name, website }, account_email: identity.email, scopes: ['openid'] };
  return { view, callback };
}
export async function inspectOAuthAuthorization(provider: OAuthConsentProvider, authorizationId: string, identity: OAuthBrowserIdentity, config: OAuthConsentConfig): Promise<OAuthConsentView> {
  return (await details(provider, authorizationId, identity, config)).view;
}
export async function decideOAuthAuthorization(provider: OAuthConsentProvider, authorizationId: string, action: 'approve' | 'deny', identity: OAuthBrowserIdentity, config: OAuthConsentConfig): Promise<OAuthConsentView> {
  const before = await details(provider, authorizationId, identity, config);
  if (before.view.state !== 'consent' || !before.callback) return providerInvalid();
  try {
    const result = action === 'approve' ? await provider.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await provider.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (!result || result.error) throw new Error('Decision result is uncertain.');
    return redirect(result.data, authorizationId, before.callback);
  } catch {
    // A transport failure does not mean consent failed. Re-read this same authorization once; never repeat its decision.
    try {
      const after = await details(provider, authorizationId, identity, config, before.callback);
      if (after.view.state === 'redirect') return redirect({ redirect_url: after.view.redirect_url }, authorizationId, before.callback);
    } catch { /* Preserve the unknown outcome without serializing provider errors. */ }
    return { state: 'uncertain', authorization_id: authorizationId };
  }
}
export async function requestOAuthBusinessSignIn(value: unknown, baseUrl: string,
  requestLink: (input: OAuthSignInLink) => Promise<{ error: unknown }>): Promise<OAuthConsentView> {
  const input = signInInput(value);
  try {
    const result = await requestLink({ email: input.email, options: { shouldCreateUser: false,
      emailRedirectTo: `${baseUrl}/api/oauth/callback?authorization_id=${input.authorization_id}` } });
    if (result.error) throw mapSignInError(result.error);
  } catch (error) { if (error instanceof DomainError) throw error; throw mapSignInError(error); }
  return { state: 'sign_in_sent', authorization_id: input.authorization_id };
}
