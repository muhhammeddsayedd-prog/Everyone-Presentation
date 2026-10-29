import { DomainError } from '@eps/domain';
import { createCentralReview } from '@eps/central';
import { getCentralClient } from './central-client';
import { readRuntimeConfig } from './config';

export async function getReviewService() {
  if (readRuntimeConfig().adapterMode !== 'supabase') throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Presentation review requires the central business connection.', 503);
  return createCentralReview(await getCentralClient());
}
