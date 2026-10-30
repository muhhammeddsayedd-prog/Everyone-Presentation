import { getCentralClient } from '../../../../lib/central-client';
import { failure } from '../../../../lib/http';
import { readOAuthConsentConfig } from '../../../../lib/oauth-consent-config';
import { handleOAuthConsentSignIn } from '../../../../lib/oauth-consent-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try { return await handleOAuthConsentSignIn(request, { config: readOAuthConsentConfig(),
    requestLink: async input => (await getCentralClient(false)).auth.signInWithOtp(input) }); }
  catch (error) { return failure(error); }
}
