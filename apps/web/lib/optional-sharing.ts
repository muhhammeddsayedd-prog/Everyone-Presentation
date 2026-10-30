import { DomainError } from '@eps/domain';
import type { ReviewLinkOperations } from '../../../packages/domain/src/guest-types';

/** A guest-only configuration outage must not remove unrelated MCP operations. */
export async function optionalSharing(loader: () => Promise<ReviewLinkOperations>): Promise<ReviewLinkOperations | undefined> {
  try { return await loader(); }
  catch (error) {
    if (error instanceof DomainError && error.code === 'REVIEW_CONFIGURATION_REQUIRED') return undefined;
    throw error;
  }
}
