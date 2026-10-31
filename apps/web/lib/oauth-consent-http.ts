import { DomainError } from '@eps/domain';
import { NO_STORE, failure, json, readBoundedBody } from './http.ts';
import { OAUTH_AUTHORIZATION_ID, OAUTH_UUID, object, closed } from './oauth-consent-contract.ts';
import { decideOAuthAuthorization, inspectOAuthAuthorization, parseOAuthConsentInput, requestOAuthBusinessSignIn,
  type OAuthBrowserIdentity, type OAuthConsentConfig, type OAuthConsentProvider, type OAuthConsentCoordinator, type OAuthSignInLink } from './oauth-consent.ts';

function browserOnly(request: Request, config: OAuthConsentConfig) {
  if (request.method !== 'POST' || request.headers.has('authorization') || request.headers.get('host') !== new URL(config.baseUrl).host
    || request.headers.get('origin') !== config.baseUrl) throw new DomainError('ACCESS_DENIED', 'Use your signed-in browser on the configured Studio origin.', 403);
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new DomainError('VALIDATION_FAILED', 'Use a bounded JSON authorization request.', 400);
}
async function readInput(request: Request) {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBoundedBody(request, 4096))) as unknown; }
  catch { throw new DomainError('VALIDATION_FAILED', 'Use a bounded JSON authorization request.', 400); }
}
export async function handleOAuthConsentRequest(request: Request, dependencies: { config: OAuthConsentConfig;
  getBrowserContext(request: Request): Promise<OAuthBrowserIdentity & { provider: OAuthConsentProvider; coordinator: OAuthConsentCoordinator }> }): Promise<Response> {
  try {
    browserOnly(request, dependencies.config);
    const input = parseOAuthConsentInput(await readInput(request));
    const identity = await dependencies.getBrowserContext(request);
    const value = input.action === 'details' ? await inspectOAuthAuthorization(identity.provider, input.authorization_id, identity, dependencies.config, identity.coordinator, input.request_id)
      : await decideOAuthAuthorization(identity.provider, input.authorization_id, input.action, identity, dependencies.config, identity.coordinator, input.request_id);
    return json(value, input.request_id, value.state === 'uncertain' ? 202 : 200);
  } catch (error) { return failure(error); }
}
export async function handleOAuthConsentSignIn(request: Request, dependencies: { config: OAuthConsentConfig;
  requestLink(input: OAuthSignInLink): Promise<{ error: unknown }> }): Promise<Response> {
  try {
    browserOnly(request, dependencies.config); const input = await readInput(request);
    const value = await requestOAuthBusinessSignIn(input, dependencies.config.baseUrl, dependencies.requestLink);
    if (!object(input) || !closed(input, ['authorization_id', 'request_id', 'email']) || typeof input.request_id !== 'string' || !OAUTH_UUID.test(input.request_id)) throw new Error('Invalid sign-in correlation.');
    return json(value, input.request_id);
  } catch (error) { return failure(error); }
}
export async function handleOAuthConsentCallback(request: Request, dependencies: { baseUrl: string; exchangeCode(code: string): Promise<{ error: unknown }> }): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const authorizationId = query.get('authorization_id');
  const validId = authorizationId !== null && OAUTH_AUTHORIZATION_ID.test(authorizationId) && query.getAll('authorization_id').length === 1;
  const destination = validId ? `/oauth/consent?authorization_id=${authorizationId}` : '/oauth/consent';
  let succeeded = false;
  const code = query.get('code');
  if (validId && code && code.length <= 2048 && !/[\p{Cc}\s]/u.test(code) && query.getAll('code').length === 1
    && [...query.keys()].every(key => ['authorization_id', 'code'].includes(key))) {
    try { succeeded = !(await dependencies.exchangeCode(code)).error; } catch { /* Do not expose callback codes/provider diagnostics. */ }
  }
  return new Response(null, { status: 303, headers: { ...NO_STORE,
    Location: `${dependencies.baseUrl}${destination}${succeeded ? '' : validId ? '&auth=failed' : '?auth=failed'}` } });
}
