import { createAppearanceFixture, type Actor, type MutationContext } from '@eps/domain';
import { createCentralAppearance } from '@eps/central';
import { getCentralClient } from './central-client';
import { readRuntimeConfig } from './config';

export interface AppearanceOperations {
  listCandidateObservations(actor: Actor, candidateId: string): Promise<unknown>;
  reviewCandidateObservation(actor: Actor, observationId: string, input: unknown, context?: MutationContext): Promise<unknown>;
  startEnrichmentBatch(actor: Actor, input: unknown, context?: MutationContext): Promise<unknown>;
  getEnrichmentBatch(actor: Actor, batchId: string): Promise<unknown>;
  getCandidateFacets(actor: Actor, filters: unknown): Promise<unknown>;
}
// local_fixture keeps one synthetic in-memory store per server process (never a provider or database).
let fixture: ReturnType<typeof createAppearanceFixture> | undefined;
export async function getAppearanceService(): Promise<AppearanceOperations> {
  if (readRuntimeConfig().adapterMode !== 'supabase') return fixture ??= createAppearanceFixture();
  return createCentralAppearance(await getCentralClient());
}
