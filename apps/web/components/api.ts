export type Actor = { id: string; name: string; description?: string; capabilities?: string[]; upload_purposes?: string[] };
export type Session = { mode?: 'local_fixture' | 'supabase'; actor: Actor | null; actors: Actor[]; storage_origin?: string };
export type Project = { id: string; name: string; client_id: string | null; client_name: string | null; client_logo_asset_id: string | null; row_version: number; client_row_version: number | null; casting_workspace_id: string | null; can_edit: boolean };
export type Workspace = { id: string; project_id: string; title: string; module: 'casting'; logo_asset_id: string | null; logo_placement: 'cover' | 'every_slide'; active_output: 'selection' | 'shortlist'; row_version: number; draft_revision: number; has_unpublished_changes: boolean; created_at: string; updated_at: string };
export type AudiencePreset = { id: string; key: string; label: string; scope: 'internal' | 'external'; settings: Record<string, never>; archived: boolean; row_version: number };
export type Envelope<T> = { request_id: string; data: T; page?: { next_cursor: string | null } };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public requestId?: string) { super(message); }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<Envelope<T>> {
  const response = await fetch(path, { ...init, cache: 'no-store', headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  const result = await response.json();
  if (!response.ok) throw new ApiError(response.status, result.error?.code ?? 'request_failed', result.error?.message ?? 'The request could not be completed. Please try again.', result.request_id);
  return result as Envelope<T>;
}

export function mutation(method: string, body?: unknown): RequestInit {
  return { method, headers: { 'Idempotency-Key': crypto.randomUUID() }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return 'The request was interrupted. Retry the same change to confirm whether it was saved.';
  if (error instanceof ApiError && error.status === 409) return 'This record changed since you opened it. Reload the saved details, then reapply your changes.';
  if (error instanceof ApiError && error.status === 401) return 'Your session expired. Sign in again.';
  return error instanceof Error ? error.message : 'The request could not be completed. Please try again.';
}
