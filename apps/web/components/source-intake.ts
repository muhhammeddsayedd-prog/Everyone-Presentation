import type { Spec } from '@eps/domain';
import { parseSpecSubmit } from '@eps/domain/specs';
import type { CentralSpecs } from '@eps/central';
import { ApiError } from './api';
import { JOB_STATUSES, validProcessingId } from './processing-view';

export type SourceIntent = Readonly<{ workspaceId: string; specId: string; key: string;
  body: Readonly<{ source_text: string; row_version: number }>; serialized: string }>;
export type SourceAccepted = Awaited<ReturnType<CentralSpecs['submitSpecs']>>;
export function retainSourceIntent(previous: SourceIntent | null, spec: Pick<Spec, 'id' | 'workspace_id' | 'row_version'>,
  text: string, createKey: () => string): SourceIntent {
  if (previous) {
    if (previous.workspaceId !== spec.workspace_id || previous.specId !== spec.id) throw new Error('Resolve the previous source request before changing workspaces.');
    return previous;
  }
  parseSpecSubmit({ source_text: text, row_version: spec.row_version });
  const body = Object.freeze({ source_text: text, row_version: spec.row_version });
  const serialized = JSON.stringify(body);
  if (new TextEncoder().encode(serialized).length > 65_536) throw new Error('Paste a shorter brief. This text exceeds the supported submission size.');
  return Object.freeze({ workspaceId: spec.workspace_id, specId: spec.id, key: createKey(), body, serialized });
}
export function readSourceAccepted(value: unknown, specId: string): SourceAccepted {
  const fail = (): never => { throw new Error('The source request could not be confirmed. Retry the same request.'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).sort().join(',') !== 'job_id,poll_url,resource_id,status' || !validProcessingId(result.job_id)
    || result.resource_id !== specId || result.poll_url !== `/api/v1/jobs/${encodeURIComponent(result.job_id)}`
    || !JOB_STATUSES.includes(result.status as SourceAccepted['status'])) return fail();
  return structuredClone(result) as unknown as SourceAccepted;
}
export function sourceFailure(reason: unknown): { kind: 'unavailable' | 'stale' | 'rejected' | 'unknown'; message: string } {
  if (reason instanceof ApiError) {
    if (reason.status === 409) return { kind: 'stale', message: 'The saved requirements changed. Reload them before submitting again. Your pasted correction is retained.' };
    if (reason.status === 503 && reason.code === 'FEATURE_NOT_IMPLEMENTED') return { kind: 'unavailable', message: 'Source processing is not available yet. Your pasted text is retained, and you can edit requirements manually below.' };
    if (reason.status < 500) return { kind: 'rejected', message: reason.status === 401 ? 'Your session expired. Sign in again before submitting.'
      : reason.status === 403 || reason.status === 404 ? 'This source cannot be submitted with your current workspace access.'
        : 'The source was not accepted. Check the text and try again; your saved requirements are retained.' };
  }
  return { kind: 'unknown', message: 'The source request could not be confirmed. Retry this same request, or reload the saved requirements to check their current state.' };
}
