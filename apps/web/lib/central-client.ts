import { cookies, headers } from 'next/headers';
import { createBearerUserClient, createRequestServerClient, readCentralConfig } from '@eps/central';
import { DomainError } from '@eps/domain';
import { readRuntimeConfig } from './config';

type CentralClient = ReturnType<typeof createRequestServerClient>;
/** One user-scoped client per incoming request (keyed by Next's per-request headers object), so the session check
 * in `verifyCentralUser` runs once however many services the request composes. Auth flows (`allowBearer = false`)
 * and callers with their own fetch keep a fresh client. */
const requestClients = new WeakMap<object, Promise<CentralClient>>();

export async function getCentralClient(allowBearer = true, options: { fetch?: typeof fetch } = {}): Promise<CentralClient> {
  if (!allowBearer || options.fetch) return createCentralClient(allowBearer, options);
  const scope = await headers();
  let client = requestClients.get(scope);
  if (!client) {
    client = createCentralClient(allowBearer, options);
    requestClients.set(scope, client);
    // A failed creation (e.g. a malformed bearer) is not kept: the request fails with it and nothing reuses it.
    client.catch(() => { if (requestClients.get(scope) === client) requestClients.delete(scope); });
  }
  return client;
}

async function createCentralClient(allowBearer: boolean, options: { fetch?: typeof fetch }) {
  const config = readCentralConfig(process.env);
  const authorization = allowBearer ? (await headers()).get('authorization') : null;
  if (authorization) {
    if (!/^Bearer [^\s]{1,16384}$/i.test(authorization)) throw new DomainError('AUTH_REQUIRED', 'Use an acting-user bearer token.', 401);
    return createBearerUserClient({ ...config, accessToken: authorization.slice(7) }, options);
  }
  const jar = await cookies();
  return createRequestServerClient({ ...config, secureCookies: readRuntimeConfig().baseUrl.startsWith('https:'), cookies: {
    getAll() { return jar.getAll(); },
    setAll(values) {
      // Every API response already includes the SDK's private no-store/Expires/Pragma
      // headers (lib/http.ts), including responses which refresh these cookies.
      for (const { name, value, options } of values) jar.set(name, value, options);
    }
  } }, options);
}
