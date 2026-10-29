import { createMcpHandler } from '@modelcontextprotocol/server';
import { createStudioMcpServer, requireLocalMcpRequest } from '../../lib/mcp';
import { currentActor } from '../../lib/session';
import type { createCentralStudio } from '@eps/central';
import { getSpecsService } from '../../lib/specs';
import { getJobs } from '../../lib/jobs';
import { failure, NO_STORE } from '../../lib/http';
import { readRuntimeConfig } from '../../lib/config';
import { getStudio } from '../../lib/studio';
import { getCandidatesService } from '../../lib/candidates';
import { getCastingService } from '../../lib/casting';
import { getReviewService } from '../../lib/review';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  try {
    requireLocalMcpRequest(request, readRuntimeConfig());
    const actor = (await currentActor())!;
    // getStudio returns the same centrally verified adapter and upload options
    // as the UI. The type fallback is unreachable in this central-only route.
    const studio = await getStudio() as Awaited<ReturnType<typeof createCentralStudio>>;
    const services = { studio, specs: await getSpecsService(), jobs: await getJobs(), candidates: await getCandidatesService(), casting: await getCastingService(), review: await getReviewService() };
    const handler = createMcpHandler(() => createStudioMcpServer(actor, services), {
      legacy: 'stateless', responseMode: 'json', maxRequestBodySize: 96 * 1024, onerror: () => { /* Private errors never enter generic logs. */ },
    });
    const response = await handler.fetch(request);
    const headers = new Headers(response.headers);
    for (const [name,value] of Object.entries(NO_STORE)) headers.set(name,value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch (error) { return failure(error); }
}
export { handle as POST, handle as GET, handle as DELETE };
