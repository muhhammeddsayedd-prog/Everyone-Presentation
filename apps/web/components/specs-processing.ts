import { jobFailureMessage, readProcessingJob, type ProcessingJob } from './processing-view';

export type SpecsProcessingScope = { workspaceId: string; specId: string; jobId: string };
export class SpecsProcessingScopeError extends Error {
  constructor() { super('The saved source processing details could not be confirmed.'); }
}
export function readSpecsProcessingJob(value: unknown, scope: SpecsProcessingScope): ProcessingJob {
  let job: ProcessingJob;
  try { job = readProcessingJob(value, scope.jobId); }
  catch { throw new SpecsProcessingScopeError(); }
  if (job.workspace_id !== scope.workspaceId || job.resource_id !== scope.specId || job.kind !== 'specs_extract') {
    throw new SpecsProcessingScopeError();
  }
  return job;
}
export function specsProcessingMessage(job: ProcessingJob): string {
  switch (job.status) {
    case 'queued': return 'The source request is queued. Existing requirements remain available.';
    case 'running': return 'Processing is in progress. Existing requirements remain available.';
    case 'succeeded': return 'Processing completed. Load the saved requirements to refresh this view.';
    case 'waiting_for_input': return job.error ? jobFailureMessage(job.error) : 'This source needs input. Open processing details to review its saved state.';
    case 'failed': return jobFailureMessage(job.error);
    case 'cancelled': return 'Cancellation is recorded. Existing requirements have been retained.';
  }
}
