import { createCentralSettings } from '@eps/central';
import { DomainError } from '@eps/domain';
import { getCentralClient } from './central-client';
import { readRuntimeConfig } from './config';

export async function getSettingsService() {
  if (readRuntimeConfig().adapterMode !== 'supabase') {
    throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Studio defaults require the central business workspace.', 503);
  }
  return createCentralSettings(await getCentralClient());
}
