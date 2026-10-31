import { randomUUID } from 'node:crypto';
import { readCentralConfig, verifyCentralUser } from '@eps/central';
import { getCentralClient } from '../../../../lib/central-client';
import { failure } from '../../../../lib/http';
import { readOAuthConsentConfig } from '../../../../lib/oauth-consent-config';
import { handleOAuthConsentRequest } from '../../../../lib/oauth-consent-http';
import { createOAuthConsentCoordinator } from '../../../../lib/oauth-consent-coordinator';
import { observeOAuthConsentFetch } from '../../../../lib/oauth-consent-observability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const traceId = randomUUID();
  function trace(value: unknown) {
    try { console.info('EPS OAuth trace', JSON.stringify(value)); } catch { /* Observation cannot change authorization behavior. */ }
  }
  let response: Response;
  try {
    const config = readOAuthConsentConfig();
    response = await handleOAuthConsentRequest(request, { config, getBrowserContext: async () => {
      const client = await getCentralClient(false, { fetch: observeOAuthConsentFetch({ centralOrigin: readCentralConfig(process.env).url, traceId }) });
      const identity = await verifyCentralUser(client);
      trace({ event: 'eps.oauth.browser_session_verified', trace_id: traceId });
      return { principalId: identity.principal_id, email: identity.email, provider: client.auth.oauth,
        coordinator: createOAuthConsentCoordinator(client, `${config.baseUrl}/mcp`, { traceId, approvedClientIds: config.approvedClientIds, log: trace }) };
    } });
  } catch (error) { response = failure(error); }
  response.headers.set('X-EPS-OAuth-Trace-ID', traceId);
  trace({ event: 'eps.oauth.consent_response', trace_id: traceId, status: response.status });
  return response;
}
