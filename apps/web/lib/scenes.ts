import { DomainError } from '@eps/domain';
import { createCentralScenes } from '@eps/central';
import { readRuntimeConfig } from './config';
import { getCentralClient } from './central-client';

/** Scenes exist only in the central business database; there is no synthetic fixture adapter (same as specs). */
export async function getScenesService() {
  if (readRuntimeConfig().adapterMode !== 'supabase') {
    throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Scenes are not available in the synthetic development adapter yet.', 503);
  }
  return createCentralScenes(await getCentralClient());
}
