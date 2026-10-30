import { DomainError } from '@eps/domain';
import { readMcpServerEnvironment } from './mcp-central-session.ts';
import type { OAuthConsentConfig } from './oauth-consent.ts';

/** Reads the same approved issuer/client configuration as the resource adapter; creates no grant. */
export function readOAuthConsentConfig(): OAuthConsentConfig {
  const { config, runtime } = readMcpServerEnvironment();
  if (config.mode !== 'oauth') throw new DomainError('OAUTH_AUTHORIZATION_UNAVAILABLE', 'Studio OAuth sign-in has not been configured in this environment.', 503);
  return { baseUrl: runtime.baseUrl, approvedClientIds: config.approvedClientIds };
}
