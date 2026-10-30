import { DomainError } from '@eps/domain';
import { createCentralGuestReviews, createCentralReviewLinks, readCentralConfig } from '@eps/central';
import { reviewKey } from '../../../packages/central/src/review-credentials';
import { getCentralClient } from './central-client';
import { readRuntimeConfig } from './config';

function options() {
  const config = readRuntimeConfig();
  if (config.adapterMode !== 'supabase') throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Guest review requires the central business connection.', 503);
  return { central: readCentralConfig(), applicationOrigin: config.baseUrl,
    gatewayKey: reviewKey(process.env.EPS_REVIEW_GATEWAY_KEY), replayKey: reviewKey(process.env.EPS_REVIEW_REPLAY_KEY) };
}
export function getGuestReviewService() { return createCentralGuestReviews(options()); }
export async function getReviewLinkService() { return createCentralReviewLinks(await getCentralClient(), options()); }
