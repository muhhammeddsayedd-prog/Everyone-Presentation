import { DomainError, type Actor, type MutationContext } from '@eps/domain';
import type { createCentralJobs, JobListOptions, JobMutationInput } from '@eps/central';
import { json, NO_STORE, readJson } from './http';
import { validateContract } from './validation';

export type JobOperations = Awaited<ReturnType<typeof createCentralJobs>>;
const statuses = new Set(['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled']);
function invalid(): never { throw new DomainError('INVALID_REQUEST', 'Provide supported job filters and a bounded page size.', 400); }
function listOptions(url: URL): JobListOptions {
  const options: JobListOptions = {};
  for (const key of url.searchParams.keys()) {
    if (!['workspace_id', 'status', 'cursor', 'limit'].includes(key) || url.searchParams.getAll(key).length !== 1) invalid();
    const value = url.searchParams.get(key)!;
    if (!value || value.length > 200) invalid();
    if (key === 'limit') {
      if (!/^[1-9][0-9]*$/u.test(value) || Number(value) > 100) invalid();
      options.limit = Number(value);
    } else if (key === 'status') {
      if (!statuses.has(value)) invalid();
      options.status = value as JobListOptions['status'];
    } else if (key === 'workspace_id') options.workspace_id = value;
    else if (key === 'cursor') options.cursor = value;
  }
  return options;
}

/** Thin HTTP mapping. The caller verifies session/origin; operations enforce current actor scope. */
export async function handleJobRequest(request: Request, segments: string[], actor: Actor, jobs: JobOperations, context: MutationContext & { requestId: string }) {
  if (segments[0] !== 'jobs') invalid();
  if (segments.length === 1 && request.method === 'GET') {
    const result = await jobs.listJobs(actor, listOptions(new URL(request.url)));
    return Response.json({ request_id: context.requestId, ...result }, { headers: NO_STORE });
  }
  if (new URL(request.url).search) invalid();
  if (segments.length === 2 && request.method === 'GET') return json(await jobs.getJob(actor, segments[1]), context.requestId);
  if (segments.length === 3 && request.method === 'POST' && ['retry', 'cancel'].includes(segments[2])) {
    const input = validateContract<JobMutationInput>('JobMutation', await readJson(request));
    const result = segments[2] === 'retry'
      ? await jobs.retryJob(actor, segments[1], input, context)
      : await jobs.cancelJob(actor, segments[1], input, context);
    if (segments[2] === 'retry') return json({ job_id: result.id, resource_id: result.resource_id,
      poll_url: `/api/v1/jobs/${encodeURIComponent(result.id)}`, status: result.status }, context.requestId, 202);
    return json(result, context.requestId);
  }
  throw new DomainError('RESOURCE_NOT_FOUND', 'This job operation is unavailable.', 404);
}
