import { DomainError } from '@eps/domain';
import { createCentralCandidates } from '@eps/central';
import { getCentralClient } from './central-client';
import { readRuntimeConfig } from './config';

export async function getCandidatesService() {
  if (readRuntimeConfig().adapterMode !== 'supabase') throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Cast Library requires the central business connection.', 503);
  return createCentralCandidates(await getCentralClient());
}
