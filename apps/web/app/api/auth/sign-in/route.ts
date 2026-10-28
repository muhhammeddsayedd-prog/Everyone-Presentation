import { DomainError } from '@eps/domain';
import { getCentralClient } from '../../../../lib/central-client';
import { readRuntimeConfig } from '../../../../lib/config';
import { failure, json, readJson, requireSameOrigin } from '../../../../lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const config = readRuntimeConfig();
    if (config.adapterMode !== 'supabase') throw new DomainError('ACCESS_DENIED', 'Business sign-in is disabled in fixture mode.', 403);
    const input = await readJson(request);
    if (!input || Object.keys(input).length !== 1 || typeof input.email !== 'string'
      || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      throw new DomainError('VALIDATION_FAILED', 'Enter a valid email address.', 400);
    }
    const { error } = await (await getCentralClient(false)).auth.signInWithOtp({ email: input.email.trim(),
      options: { emailRedirectTo: `${config.baseUrl}/api/auth/callback`, shouldCreateUser: true } });
    if (error) throw new DomainError(error.status === 429 ? 'RATE_LIMITED' : 'DEPENDENCY_UNAVAILABLE',
      error.status === 429 ? 'Please wait before requesting another sign-in link.' : 'The sign-in email could not be requested. Check the configured Supabase email service.', error.status === 429 ? 429 : 503);
    return json({ requested: true });
  } catch (e) { return failure(e); }
}
