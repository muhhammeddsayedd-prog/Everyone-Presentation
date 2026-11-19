export type Actor = { id: string; name: string; description?: string; capabilities?: string[]; upload_purposes?: string[]; upload_maximum_bytes?: number };
export type Session = { mode?: 'local_fixture' | 'supabase'; actor: Actor | null; actors: Actor[]; storage_origin?: string; timezone?: string };
export type Project = { id: string; name: string; client_id: string | null; client_name: string | null; client_logo_asset_id: string | null; row_version: number; client_row_version: number | null; casting_workspace_id: string | null; can_edit: boolean; presentation_type?: string };
export type Workspace = { id: string; project_id: string; title: string; module: 'casting'; logo_asset_id: string | null; logo_placement: 'cover' | 'every_slide'; active_output: 'selection' | 'shortlist'; row_version: number; draft_revision: number; has_unpublished_changes: boolean; created_at: string; updated_at: string };
export type AudiencePreset = { id: string; key: string; label: string; scope: 'internal' | 'external'; settings: Record<string, never>; archived: boolean; row_version: number };
export type Envelope<T> = { request_id: string; data: T; page?: { next_cursor: string | null } };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public requestId?: string) { super(message); }
}

/** Person reads that several panels ask for at once (a project card, the live slide, a portrait): one network read
 * serves every caller that asks while it is in flight or within a moment after it. Any change sent through `api`
 * drops them, so a read made after a save always goes to the server. */
const SHARED_READ = /^\/api\/v1\/candidates\/[0-9a-f-]{36}(?:\/(?:media|photos)(?:\?[^#]*)?)?$/u;
const SHARED_READ_MS = 2000;
type Read = { status: number; ok: boolean; body: unknown };
const sharedReads = new Map<string, { settledAt: number | null; read: Promise<Read> }>();

function waitFor<T>(promise: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function sharedRead(path: string, init: RequestInit): Promise<Read> {
  const now = Date.now(); const existing = sharedReads.get(path);
  if (existing && (existing.settledAt === null || now - existing.settledAt < SHARED_READ_MS)) return waitFor(existing.read, init.signal);
  const entry: { settledAt: number | null; read: Promise<Read> } = { settledAt: null, read: Promise.resolve(null as unknown as Read) };
  // The shared read is not tied to one caller's signal: a caller that gives up stops waiting, the others still get it.
  entry.read = fetch(path, { headers: init.headers, cache: 'no-store', signal: AbortSignal.timeout(30000) })
    .then(async response => ({ status: response.status, ok: response.ok, body: await response.json() }))
    .then(read => { entry.settledAt = Date.now(); if (!read.ok && sharedReads.get(path) === entry) sharedReads.delete(path); return read; },
      error => { if (sharedReads.get(path) === entry) sharedReads.delete(path); throw error; });
  sharedReads.set(path, entry);
  return waitFor(entry.read, init.signal);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<Envelope<T>> {
  const reading = (init.method ?? 'GET').toUpperCase() === 'GET' && init.body == null;
  if (!reading) sharedReads.clear();
  let result: { error?: { code?: string; message?: string }; request_id?: string }; let status: number; let ok: boolean;
  if (reading && SHARED_READ.test(path)) {
    const read = await sharedRead(path, init); status = read.status; ok = read.ok; result = structuredClone(read.body) as typeof result;
  } else {
    try {
      const response = await fetch(path, { ...init, cache: 'no-store', headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
      status = response.status; ok = response.ok; result = await response.json();
    } finally { if (!reading) sharedReads.clear(); }
  }
  if (!ok) throw new ApiError(status, result.error?.code ?? 'request_failed', result.error?.message ?? 'The request could not be completed. Please try again.', result.request_id);
  return result as Envelope<T>;
}

export function mutation(method: string, body?: unknown): RequestInit {
  return { method, headers: { 'Idempotency-Key': crypto.randomUUID() }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return 'The request was interrupted. Retry the same change to confirm whether it was saved.';
  if (error instanceof ApiError && error.status === 409 && error.code === 'STALE_RESOURCE_VERSION') return 'This record changed since you opened it. Reload the saved details, then reapply your changes.';
  if (error instanceof ApiError && error.status === 401) return 'Your session expired. Sign in again.';
  return error instanceof Error ? error.message : 'The request could not be completed. Please try again.';
}
