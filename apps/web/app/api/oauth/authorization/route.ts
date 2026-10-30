import { verifyCentralUser } from '@eps/central';
import { getCentralClient } from '../../../../lib/central-client';
import { failure } from '../../../../lib/http';
import { readOAuthConsentConfig } from '../../../../lib/oauth-consent-config';
import { handleOAuthConsentRequest } from '../../../../lib/oauth-consent-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    return await handleOAuthConsentRequest(request, { config: readOAuthConsentConfig(), getBrowserContext: async () => {
      const client = await getCentralClient(false);
      const identity = await verifyCentralUser(client);
      return { principalId: identity.principal_id, email: identity.email, provider: client.auth.oauth };
    } });
  } catch (error) { return failure(error); }
}
