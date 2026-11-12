import { DomainError } from '@eps/domain';
import { readCentralConfig } from '../../../../../../packages/central/src/config';
import { getCentralClient } from '../../../../lib/central-client';
import { readRuntimeConfig } from '../../../../lib/config';
import { NO_STORE, requireSameOrigin } from '../../../../lib/http';
import { startGoogleSignIn } from '../../../../lib/auth-sign-in';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Form POST from the sign-in page: starts Google sign-in and sends the browser to Supabase Auth. */
export async function POST(request: Request) {
  const config = readRuntimeConfig();
  try {
    requireSameOrigin(request);
    if (config.adapterMode !== 'supabase') throw new DomainError('ACCESS_DENIED', 'Business sign-in is disabled in fixture mode.', 403);
    const client = await getCentralClient(false);
    const location = await startGoogleSignIn(config.baseUrl, readCentralConfig(process.env).url, input => client.auth.signInWithOAuth(input));
    return new Response(null, { status: 303, headers: { ...NO_STORE, Location: location } });
  } catch {
    return new Response(null, { status: 303, headers: { ...NO_STORE, Location: `${config.baseUrl}/projects?auth=google_failed` } });
  }
}
