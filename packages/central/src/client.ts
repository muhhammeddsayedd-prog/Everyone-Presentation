import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, type CookieMethodsServer, type CookieOptions } from '@supabase/ssr';
import { DomainError } from '@eps/domain';
import { checkedCentralConfig, type CentralConfig } from './config.ts';

const requestClients = new WeakMap<SupabaseClient, { accessToken?: string }>();
export interface RequestCookies {
  getAll: CookieMethodsServer['getAll'];
  setAll: NonNullable<CookieMethodsServer['setAll']>;
}
export interface RequestServerConfig extends CentralConfig { cookies: RequestCookies; secureCookies?: boolean }
export interface CentralClientOptions { fetch?: typeof fetch }

function assertServer() {
  if (typeof window !== 'undefined') throw new DomainError('SERVER_CONTEXT_REQUIRED', 'The central user client must be created on the server.', 503);
}
function privateFetch(fetcher: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const deadline = AbortSignal.timeout(15_000);
    const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
    try { return await fetcher(input, { ...init, signal, cache: 'no-store', redirect: 'error' }); }
    catch { throw new TypeError('Central request failed.'); }
  };
}

/** Create once per incoming server request. The caller must apply both cookies and cache headers. */
export function createRequestServerClient(input: RequestServerConfig, options: CentralClientOptions = {}): SupabaseClient {
  assertServer();
  const config = checkedCentralConfig(input);
  if (!input.cookies || typeof input.cookies.getAll !== 'function' || typeof input.cookies.setAll !== 'function') throw new DomainError('CENTRAL_COOKIE_ADAPTER_REQUIRED', 'Provide request-scoped getAll and setAll cookie handlers, including response cache headers.', 503);
  const production = process.env.NODE_ENV === 'production';
  if (production && input.secureCookies === false) throw new DomainError('SECURE_COOKIES_REQUIRED', 'Production authentication requires secure cookies.', 503);
  const cookieOptions: CookieOptions = { path: '/', httpOnly: true, sameSite: 'lax', secure: input.secureCookies ?? production };
  const client = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => input.cookies.getAll(),
      setAll: (cookies, headers) => input.cookies.setAll(cookies, headers),
    }, cookieOptions,
    global: { fetch: privateFetch(options.fetch) },
  });
  requestClients.set(client, {});
  return client;
}

/** For authenticated HTTP/MCP bearer requests. Never persists or refreshes an access token. */
export function createBearerUserClient(input: CentralConfig & { accessToken: string }, options: CentralClientOptions = {}): SupabaseClient {
  assertServer();
  const config = checkedCentralConfig(input);
  if (typeof input.accessToken !== 'string' || !input.accessToken || input.accessToken.length > 16_384 || /\s/u.test(input.accessToken) || input.accessToken.startsWith('sb_')) throw new DomainError('AUTH_REQUIRED', 'Provide the acting user access token.', 401);
  try {
    const payload = JSON.parse(Buffer.from(input.accessToken.split('.')[1] ?? '', 'base64url').toString('utf8'));
    if (payload.role === 'service_role' || payload.role === 'supabase_admin') throw new DomainError('PRIVILEGED_TOKEN_FORBIDDEN', 'Privileged service tokens cannot act as application users.', 403);
  } catch (error) { if (error instanceof DomainError) throw error; /* Auth server validates opaque/malformed tokens below. */ }
  const client = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${input.accessToken}` }, fetch: privateFetch(options.fetch) },
  });
  requestClients.set(client, { accessToken: input.accessToken });
  return client;
}

export interface VerifiedCentralIdentity { principal_id: string; email: string | null }
export async function verifyCentralUser(client: SupabaseClient): Promise<VerifiedCentralIdentity> {
  const context = requestClients.get(client);
  if (!context) throw new DomainError('USER_SCOPED_CLIENT_REQUIRED', 'Create a fresh user-scoped central client for this request.', 503);
  try {
    const { data, error } = await client.auth.getUser(context.accessToken);
    if (error) {
      if (error.status === 429) throw new DomainError('AUTH_RATE_LIMITED', 'Central authentication is temporarily rate limited. Try again shortly.', 429, {}, true);
      if (error.status === undefined || error.status === 0 || error.status === 408 || error.status >= 500) throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Central authentication is temporarily unavailable.', 503, {}, true);
      throw new DomainError('AUTH_REQUIRED', 'Sign in with an authorized business account.', 401);
    }
    if (!data.user || !data.user.id || data.user.is_anonymous || data.user.role !== 'authenticated') throw new DomainError('AUTH_REQUIRED', 'Sign in with an authorized business account.', 401);
    return Object.freeze({ principal_id: data.user.id, email: data.user.email ?? null });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Central authentication is temporarily unavailable.', 503, {}, true);
  }
}
