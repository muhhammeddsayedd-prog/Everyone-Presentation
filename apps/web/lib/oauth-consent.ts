import { DomainError } from '@eps/domain';
import { mapSignInError } from './auth-sign-in.ts';
import { closed, object, OAUTH_UUID, OAUTH_AUTHORIZATION_ID, safeOAuthRedirect, type OAuthConsentView } from './oauth-consent-contract.ts';
export { safeOAuthRedirect } from './oauth-consent-contract.ts';

export interface OAuthConsentConfig { baseUrl: string; approvedClientIds: readonly string[] }
export interface OAuthBrowserIdentity { principalId: string; email: string | null }
interface ProviderResult { data: unknown; error: unknown }
export interface OAuthConsentProvider {
  getAuthorizationDetails(id: string): Promise<ProviderResult>;
  approveAuthorization(id: string, options: { skipBrowserRedirect: true }): Promise<ProviderResult>;
  denyAuthorization(id: string, options: { skipBrowserRedirect: true }): Promise<ProviderResult>;
}
export interface OAuthConsentCoordinator {
  claim(input: { authorizationId: string; action: 'details' | 'approve' | 'deny'; requestId: string }): Promise<unknown>;
  finish(input: { authorizationId: string; claimId: string; outcome: 'consent_ready' | 'redirect' | 'uncertain' | 'rejected' }): Promise<unknown>;
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
  if (!object(value) || !closed(value, ['authorization_id', 'request_id', 'action']) || typeof value.authorization_id !== 'string' || !OAUTH_AUTHORIZATION_ID.test(value.authorization_id)
    || typeof value.request_id !== 'string' || !OAUTH_UUID.test(value.request_id) || typeof value.action !== 'string' || !['details', 'approve', 'deny'].includes(value.action)) return invalidInput();
  return value as unknown as OAuthConsentInput;
}
function signInInput(value: unknown): OAuthSignInInput {
  if (!object(value) || !closed(value, ['authorization_id', 'request_id', 'email']) || typeof value.authorization_id !== 'string' || !OAUTH_AUTHORIZATION_ID.test(value.authorization_id)
    || typeof value.request_id !== 'string' || !OAUTH_UUID.test(value.request_id) || typeof value.email !== 'string') return invalidInput();
  const email = value.email.trim();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return invalidInput();
  return { authorization_id: value.authorization_id, request_id: value.request_id, email };
}
function redirect(value: unknown, authorizationId: string, expectedBase: string, action: 'approve' | 'deny' = 'approve'): OAuthConsentView {
  if (!object(value) || !closed(value, ['redirect_url'])) return providerInvalid();
  try {
    const url = new URL(safeOAuthRedirect(value.redirect_url, expectedBase));
    if (action === 'approve' ? !url.searchParams.has('code') : url.searchParams.get('error') !== 'access_denied') return providerInvalid();
    return { state: 'redirect', authorization_id: authorizationId, redirect_url: url.href };
  }
  catch { return providerInvalid(); }
}
interface Binding {
  authorization_id: string; client: Record<string, unknown>; redirect_uri: string; scope: 'openid';
  user_id: string | null; status: string; expires_at: string;
}
function binding(value: unknown, authorizationId: string, identity: OAuthBrowserIdentity, config: OAuthConsentConfig): Binding {
  if (!object(value) || !closed(value, ['authorization_id', 'client', 'redirect_uri', 'scope', 'user_id', 'status', 'expires_at'])
    || value.authorization_id !== authorizationId || !clientDetails(value.client) || typeof value.client.id !== 'string'
    || !OAUTH_UUID.test(value.client.id) || !config.approvedClientIds.includes(value.client.id)
    || !text(value.client.name, 200) || !value.client.name.trim() || value.scope !== 'openid'
    || !(value.user_id === null || value.user_id === identity.principalId) || typeof value.status !== 'string'
    || typeof value.expires_at !== 'string' || !Number.isFinite(Date.parse(value.expires_at)) || Date.parse(value.expires_at) <= Date.now()) return providerInvalid();
  try { safeOAuthRedirect(value.redirect_uri); } catch { return providerInvalid(); }
  return value as unknown as Binding;
}
function envelope(value: unknown) {
  if (!object(value) || !closed(value, ['claim_id', 'state', 'binding'])
    || !(value.claim_id === null || typeof value.claim_id === 'string' && OAUTH_UUID.test(value.claim_id))
    || !['claimed', 'consent_ready', 'in_progress', 'already_processed'].includes(value.state as string)) return providerInvalid();
  return value;
}
async function claim(coordinator: OAuthConsentCoordinator, authorizationId: string, action: 'details' | 'approve' | 'deny',
  requestId: string, identity: OAuthBrowserIdentity, config: OAuthConsentConfig) {
  if (!OAUTH_AUTHORIZATION_ID.test(authorizationId) || !OAUTH_UUID.test(identity.principalId) || !OAUTH_UUID.test(requestId)) return invalidInput();
  const value = envelope(await coordinator.claim({ authorizationId, action, requestId }));
  if (value.state === 'in_progress') throw new DomainError('OAUTH_AUTHORIZATION_IN_PROGRESS', 'This request is already being checked. Wait briefly, then check its status.', 409);
  if (value.state === 'already_processed') throw new DomainError('OAUTH_AUTHORIZATION_PROCESSED', 'This authorization request has already been processed. Restart the connection from your client.', 409);
  if (!(value.state === 'claimed' && value.claim_id || action === 'details' && value.state === 'consent_ready' && value.claim_id === null)) return providerInvalid();
  const context = binding(value.binding, authorizationId, identity, config);
  if (context.status !== 'pending' || (value.state === 'consent_ready' || action !== 'details') && context.user_id !== identity.principalId) return providerInvalid();
  return { claimId: value.claim_id as string | null, context };
}
function consent(value: Record<string, unknown>, authorizationId: string, identity: OAuthBrowserIdentity, context: Binding): OAuthConsentView {
  if (!closed(value, ['authorization_id', 'redirect_uri', 'client', 'user', 'scope']) || value.authorization_id !== authorizationId
    || !clientDetails(value.client) || typeof value.client.id !== 'string'
    || value.client.id !== context.client.id || value.client.name !== context.client.name || !text(value.client.name, 200) || !value.client.name.trim()
    || !object(value.user) || !closed(value.user, ['id', 'email']) || value.user.id !== identity.principalId
    || typeof value.user.email !== 'string' || value.user.email.length > 254 || /\p{Cc}/u.test(value.user.email)
    || value.scope !== 'openid') return providerInvalid();
  let callback: string, website: string | null = null;
  const uri = Object.hasOwn(value.client, 'uri') ? value.client.uri : null;
  const logoUri = Object.hasOwn(value.client, 'logo_uri') ? value.client.logo_uri : null;
  try {
    callback = safeOAuthRedirect(value.redirect_uri);
    if (callback !== context.redirect_uri) return providerInvalid();
    if (typeof uri === 'string' && uri) website = new URL(safeOAuthRedirect(uri)).origin;
    else if (uri !== '' && uri !== null) return providerInvalid();
    if (!(typeof logoUri === 'string' || logoUri === null) || typeof logoUri === 'string' && logoUri.length > 2048) return providerInvalid();
  } catch { return providerInvalid(); }
  const view: OAuthConsentView = { state: 'consent', authorization_id: authorizationId,
    client: { id: value.client.id, name: value.client.name, website }, account_email: identity.email, scopes: ['openid'] };
  return view;
}
async function finish(coordinator: OAuthConsentCoordinator, authorizationId: string, claimId: string, outcome: 'consent_ready' | 'redirect',
  identity: OAuthBrowserIdentity, config: OAuthConsentConfig, before: Binding, expectedStatus: string) {
  const value = envelope(await coordinator.finish({ authorizationId, claimId, outcome }));
  if (value.state !== (outcome === 'consent_ready' ? 'consent_ready' : 'already_processed') || value.claim_id !== null) return providerInvalid();
  const after = binding(value.binding, authorizationId, identity, config);
  if (after.user_id !== identity.principalId || after.status !== expectedStatus || after.client.id !== before.client.id
    || after.redirect_uri !== before.redirect_uri || after.scope !== before.scope || after.expires_at !== before.expires_at) return providerInvalid();
}
async function abandon(coordinator: OAuthConsentCoordinator, authorizationId: string, claimId: string, outcome: 'uncertain' | 'rejected') {
  // No lease takeover or second consuming GET. An unknown upstream result needs a fresh client authorization.
  try { await coordinator.finish({ authorizationId, claimId, outcome }); } catch { /* A durable outstanding claim also prevents replay. */ }
}
export async function inspectOAuthAuthorization(provider: OAuthConsentProvider, authorizationId: string, identity: OAuthBrowserIdentity,
  config: OAuthConsentConfig, coordinator: OAuthConsentCoordinator, requestId: string): Promise<OAuthConsentView> {
  const { claimId, context } = await claim(coordinator, authorizationId, 'details', requestId, identity, config);
  if (!claimId) return consent({ authorization_id: authorizationId, redirect_uri: context.redirect_uri, client: context.client,
    scope: context.scope, user: { id: identity.principalId, email: identity.email ?? '' } }, authorizationId, identity, context);
  let result: ProviderResult;
  try { result = await provider.getAuthorizationDetails(authorizationId); }
  catch { await abandon(coordinator, authorizationId, claimId, 'uncertain'); return unavailable(); }
  if (!result || result.error || !object(result.data)) { await abandon(coordinator, authorizationId, claimId, 'uncertain'); return unavailable(); }
  try {
    if (closed(result.data, ['redirect_url'])) {
      const view = redirect(result.data, authorizationId, context.redirect_uri);
      await finish(coordinator, authorizationId, claimId, 'redirect', identity, config, context, 'approved');
      return view;
    }
    const view = consent(result.data, authorizationId, identity, context);
    await finish(coordinator, authorizationId, claimId, 'consent_ready', identity, config, context, 'pending');
    return view;
  } catch (error) { await abandon(coordinator, authorizationId, claimId, 'rejected'); throw error; }
}
export async function decideOAuthAuthorization(provider: OAuthConsentProvider, authorizationId: string, action: 'approve' | 'deny', identity: OAuthBrowserIdentity,
  config: OAuthConsentConfig, coordinator: OAuthConsentCoordinator, requestId: string): Promise<OAuthConsentView> {
  const { claimId, context } = await claim(coordinator, authorizationId, action, requestId, identity, config);
  if (!claimId) return providerInvalid();
  try {
    const result = action === 'approve' ? await provider.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await provider.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (!result || result.error) throw new Error('Decision result is uncertain.');
    const view = redirect(result.data, authorizationId, context.redirect_uri, action);
    await finish(coordinator, authorizationId, claimId, 'redirect', identity, config, context, action === 'approve' ? 'approved' : 'denied');
    return view;
  } catch {
    await abandon(coordinator, authorizationId, claimId, 'uncertain');
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
