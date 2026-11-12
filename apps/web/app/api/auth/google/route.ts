import { DomainError } from '@eps/domain';
import { readCentralConfig } from '../../../../../../packages/central/src/config';
import { getCentralClient } from '../../../../lib/central-client';
import { readRuntimeConfig } from '../../../../lib/config';
import { failure, json, requireSameOrigin } from '../../../../lib/http';
import { startGoogleSignIn } from '../../../../lib/auth-sign-in';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Starts Google sign-in. Called with fetch (not a form post): under the app's no-referrer policy a form
 * post sends `Origin: null`, which the same-origin check rightly refuses. The browser then follows the
 * returned central Supabase authorize URL; the PKCE verifier cookie is set on this response. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const config = readRuntimeConfig();
    if (config.adapterMode !== 'supabase') throw new DomainError('ACCESS_DENIED', 'Business sign-in is disabled in fixture mode.', 403);
    const client = await getCentralClient(false);
    return json({ url: await startGoogleSignIn(config.baseUrl, readCentralConfig(process.env).url, input => client.auth.signInWithOAuth(input)) });
  } catch (e) { return failure(e); }
}
