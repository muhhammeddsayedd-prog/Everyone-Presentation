import { createMcpHttpHandler, mcpProjectReadReceipt } from '../../lib/mcp-http';
import { createMcpCentralSessionCheck, readMcpServerEnvironment } from '../../lib/mcp-central-session';
import { currentActor } from '../../lib/session';
import type { createCentralStudio } from '@eps/central';
import { getSpecsService } from '../../lib/specs';
import { getJobs } from '../../lib/jobs';
import { failure } from '../../lib/http';
import { getStudio } from '../../lib/studio';
import { getCandidatesService } from '../../lib/candidates';
import { getCastingService } from '../../lib/casting';
import { getReviewService } from '../../lib/review';
import { getPresentationService } from '../../lib/presentation';
import { getReviewLinkService } from '../../lib/guest';
import { optionalSharing } from '../../lib/optional-sharing';
import { getSettingsService } from '../../lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  try {
    const { config, central, runtime: runtimeConfig } = readMcpServerEnvironment();
    async function services() {
      // All factories read the current Next request's same user bearer/session.
      // The transport verifies their central principal against its authenticated actor.
      const studio = await getStudio() as Awaited<ReturnType<typeof createCentralStudio>>;
      return { studio, specs: await getSpecsService(), jobs: await getJobs(), candidates: await getCandidatesService(),
        casting: await getCastingService(), review: await getReviewService(), presentation: await getPresentationService(),
        sharing: await optionalSharing(getReviewLinkService), settings: await getSettingsService() };
    }
    return createMcpHttpHandler({ config, runtime: runtimeConfig,
      ...(config.mode === 'oauth' && central ? { checkSession: createMcpCentralSessionCheck(central, config.resourceUrl) } : {}),
      localContext: async () => ({ actor: (await currentActor())!, services: await services() }),
      // OAuth never invokes currentActor or obtains identity through a browser fallback.
      oauthContext: async () => services(),
      onToolCompleted: (identity, event) => {
        const receipt = mcpProjectReadReceipt(identity, event);
        if (receipt) console.info('EPS MCP read receipt', JSON.stringify(receipt));
      },
    })(request);
  } catch (error) { return failure(error); }
}
export { handle as POST, handle as GET, handle as DELETE };
