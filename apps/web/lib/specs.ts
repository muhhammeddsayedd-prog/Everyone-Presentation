import { DomainError } from '@eps/domain';
import { createCentralSpecs } from '@eps/central';
import { readRuntimeConfig } from './config';
import { getCentralClient } from './central-client';

export async function getSpecsService() {
  if (readRuntimeConfig().adapterMode !== 'supabase') {
    throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Manual requirements are not available in the synthetic development adapter yet.', 503);
  }
  return createCentralSpecs(await getCentralClient());
}
