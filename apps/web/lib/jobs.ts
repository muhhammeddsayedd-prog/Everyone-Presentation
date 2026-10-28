import { DomainError } from '@eps/domain';
import { createCentralJobs } from '@eps/central';
import { readRuntimeConfig } from './config';
import { getCentralClient } from './central-client';

export async function getJobs() {
  if (readRuntimeConfig().adapterMode !== 'supabase') {
    throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Durable processing requires the central jobs database. The development fixture has no processing jobs.', 503);
  }
  return createCentralJobs(await getCentralClient());
}
