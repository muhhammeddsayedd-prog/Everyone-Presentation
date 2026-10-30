import { handleMcpMetadata } from '../../../../lib/mcp-http';
import { readMcpServerEnvironment } from '../../../../lib/mcp-central-session';
import { failure } from '../../../../lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  try { return await handleMcpMetadata(request, { config: readMcpServerEnvironment().config }); }
  catch (error) { return failure(error); }
}
export { handle as GET, handle as OPTIONS };
