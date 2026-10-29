import { DomainError } from '@eps/domain';
import { createCentralPresentations, readCentralConfig } from '@eps/central';
import { getCentralClient } from './central-client';
import { readRuntimeConfig } from './config';

export async function getPresentationService() {
  if (readRuntimeConfig().adapterMode !== 'supabase') throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Fixed presentations require the central business connection.', 503);
  return createCentralPresentations(await getCentralClient(), { storageOrigin: readCentralConfig().url });
}
