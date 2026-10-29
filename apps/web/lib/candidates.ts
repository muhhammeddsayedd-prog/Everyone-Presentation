import { DomainError } from '@eps/domain';
import { createCentralCandidates, createCentralCandidateFilters, createCentralFrameExtraction, createCentralCandidateSupport } from '@eps/central';
import { getCentralClient } from './central-client';
import { readRuntimeConfig } from './config';

export async function getCandidatesService() {
  if (readRuntimeConfig().adapterMode !== 'supabase') throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Cast Library requires the central business connection.', 503);
  const client = await getCentralClient();
  const candidates = await createCentralCandidates(client);
  return { ...candidates, async suggestCandidateFilters(...args: Parameters<Awaited<ReturnType<typeof createCentralCandidateFilters>>['suggestCandidateFilters']>) {
    return (await createCentralCandidateFilters(client)).suggestCandidateFilters(...args);
  }, async extractCandidateFrames(...args: Parameters<Awaited<ReturnType<typeof createCentralFrameExtraction>>['extractCandidateFrames']>) {
    return (await createCentralFrameExtraction(client)).extractCandidateFrames(...args);
  }, async listCandidateSupport(...args: Parameters<Awaited<ReturnType<typeof createCentralCandidateSupport>>['listCandidateSupport']>) {
    return (await createCentralCandidateSupport(client)).listCandidateSupport(...args);
  }, async archiveCandidateSupport(...args: Parameters<Awaited<ReturnType<typeof createCentralCandidateSupport>>['archiveCandidateSupport']>) {
    return (await createCentralCandidateSupport(client)).archiveCandidateSupport(...args);
  } };
}
