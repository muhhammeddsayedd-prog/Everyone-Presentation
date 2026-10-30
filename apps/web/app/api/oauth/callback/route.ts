import { DomainError } from '@eps/domain';
import { getCentralClient } from '../../../../lib/central-client';
import { readRuntimeConfig } from '../../../../lib/config';
import { failure } from '../../../../lib/http';
import { handleOAuthConsentCallback } from '../../../../lib/oauth-consent-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const config = readRuntimeConfig();
    if (config.adapterMode !== 'supabase' || request.headers.has('authorization') || request.headers.get('host') !== new URL(config.baseUrl).host) {
      throw new DomainError('ACCESS_DENIED', 'Use the configured Studio browser sign-in callback.', 403);
    }
    return await handleOAuthConsentCallback(request, { baseUrl: config.baseUrl,
      exchangeCode: async code => (await getCentralClient(false)).auth.exchangeCodeForSession(code) });
  } catch (error) { return failure(error); }
}
