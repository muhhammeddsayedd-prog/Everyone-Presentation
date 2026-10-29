import { randomUUID } from 'node:crypto';
import { handleServiceJobRequest, readJobServiceConfiguration } from '../../../../../../lib/job-service-http';
import { getJobServiceRuntime } from '../../../../../../lib/job-service-runtime';
import { failure } from '../../../../../../lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: Request, context: { params:Promise<{ segments:string[] }> }) {
  const requestId=randomUUID();
  try { return await handleServiceJobRequest(request,(await context.params).segments,readJobServiceConfiguration(process.env),getJobServiceRuntime,requestId); }
  catch(error) { return failure(error,requestId); }
}
export { handle as POST,handle as GET,handle as PATCH,handle as DELETE };
