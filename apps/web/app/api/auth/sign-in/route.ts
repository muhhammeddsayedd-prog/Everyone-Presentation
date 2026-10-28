import { DomainError } from '@eps/domain';
import { getCentralClient } from '../../../../lib/central-client';
import { readRuntimeConfig } from '../../../../lib/config';
import { failure, json, readJson, requireSameOrigin } from '../../../../lib/http';
import { requestBusinessSignIn } from '../../../../lib/auth-sign-in';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const config = readRuntimeConfig();
    if (config.adapterMode !== 'supabase') throw new DomainError('ACCESS_DENIED', 'Business sign-in is disabled in fixture mode.', 403);
    return json(await requestBusinessSignIn(await readJson(request), config.baseUrl,
      async input => (await getCentralClient(false)).auth.signInWithOtp(input)));
  } catch (e) { return failure(e); }
}
