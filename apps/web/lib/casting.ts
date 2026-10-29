import { DomainError } from '@eps/domain';
import { createCentralCasting } from '@eps/central';
import { getCentralClient } from './central-client';
import { readRuntimeConfig } from './config';

/** Request-scoped acting-user adapter. No fixture casting or elevated fallback. */
export async function getCastingService() {
  if (readRuntimeConfig().adapterMode !== 'supabase') {
    throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Casting assignments require the central business connection.', 503);
  }
  return createCentralCasting(await getCentralClient());
}
