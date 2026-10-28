import { cookies, headers } from 'next/headers';
import { createBearerUserClient, createRequestServerClient, readCentralConfig } from '@eps/central';
import { DomainError } from '@eps/domain';
import { readRuntimeConfig } from './config';

export async function getCentralClient(allowBearer = true) {
  const config = readCentralConfig(process.env);
  const authorization = allowBearer ? (await headers()).get('authorization') : null;
  if (authorization) {
    if (!/^Bearer [^\s]{1,16384}$/i.test(authorization)) throw new DomainError('AUTH_REQUIRED', 'Use an acting-user bearer token.', 401);
    return createBearerUserClient({ ...config, accessToken: authorization.slice(7) });
  }
  const jar = await cookies();
  return createRequestServerClient({ ...config, secureCookies: readRuntimeConfig().baseUrl.startsWith('https:'), cookies: {
    getAll() { return jar.getAll(); },
    setAll(values) {
      // Every API response already includes the SDK's private no-store/Expires/Pragma
      // headers (lib/http.ts), including responses which refresh these cookies.
      for (const { name, value, options } of values) jar.set(name, value, options);
    }
  } });
}
