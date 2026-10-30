import { DomainError, type Actor } from '@eps/domain';
import type { CentralCapabilities } from '@eps/central';

/** Explicit synthetic authority for deterministic protocol fixtures. This does
 * not stand in for the real central identity/RLS tests or provider acceptance. */
export function syntheticMcpStudio(principalId: string) {
  return {
    async getCapabilities(actor: Actor): Promise<CentralCapabilities> {
      if (actor.principal_id !== principalId) throw new DomainError('ACCESS_DENIED', 'The synthetic capability actor does not match its fixture.', 403);
      return { principal_id: principalId, capabilities: ['projects.read', 'projects.write', 'workspaces.read', 'workspaces.write',
        'cast.read', 'cast.upload', 'cast.write', 'cast.review', 'presentations.generate', 'review_links.manage', 'settings.manage', 'operations.read', 'operations.retry'],
      timezone: 'Africa/Cairo', enabled_modules: ['casting'], upload_policy: { allowed_mime_types: [], maximum_file_bytes: 5242880,
        recommended_batch_size: 200, available_purposes: [] } };
    },
  };
}
