import { parseProjectCreate, type ProjectCreate } from '../../../packages/domain/src/projects.ts';

export interface ProjectCreateIntent { key: string; body: ProjectCreate }
const CHANGED = 'eps-project-create-intent-changed';
const MAXIMUM = 4096;
function storageKey(actorId: string): string {
  if (!actorId || actorId.length > 200 || /[\p{Cc}]/u.test(actorId)) throw new Error('The acting user could not be confirmed for tab recovery.');
  return `eps-project-create-v1:${encodeURIComponent(actorId)}`;
}

/** Closed tab-storage boundary: input and a stable idempotency key, never credentials. */
export function parseProjectCreateIntent(serialized: string | null): ProjectCreateIntent | null {
  if (!serialized || serialized.length > MAXIMUM) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    if (Object.keys(row).sort().join(',') !== 'body,key' || typeof row.key !== 'string'
      || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(row.key)) return null;
    const body = parseProjectCreate(row.body);
    if ((row.body as Record<string, unknown>).name !== body.name) return null;
    return { key: row.key, body };
  } catch { return null; }
}

/** A primitive snapshot keeps useSyncExternalStore stable, including hydration. */
export function projectCreateIntentSnapshot(actorId: string): string | null {
  try { const value = sessionStorage.getItem(storageKey(actorId)); return value && value.length <= MAXIMUM ? value : null; }
  catch { return null; }
}
export function subscribeProjectCreateIntent(changed: () => void): () => void {
  window.addEventListener(CHANGED, changed); window.addEventListener('storage', changed);
  return () => { window.removeEventListener(CHANGED, changed); window.removeEventListener('storage', changed); };
}
function announce() { window.dispatchEvent(new Event(CHANGED)); }

/** Persist before the first HTTP attempt. Storage failure must not send a request. */
export function persistProjectCreateIntent(actorId: string, value: unknown): ProjectCreateIntent {
  const intent = parseProjectCreateIntent(JSON.stringify(value));
  if (!intent) throw new Error('The create request could not be prepared for tab recovery.');
  const key = storageKey(actorId), previous = parseProjectCreateIntent(sessionStorage.getItem(key));
  if (previous && previous.key !== intent.key) throw new Error('Another create request is pending in this tab. Reload Projects to resume it.');
  const serialized = JSON.stringify(intent);
  sessionStorage.setItem(key, serialized);
  if (sessionStorage.getItem(key) !== serialized) throw new Error('Tab recovery could not be saved. The create request was not sent.');
  announce(); return intent;
}

/** Clear only this request; a response cannot erase a different pending intent. */
export function clearProjectCreateIntent(actorId: string, requestKey: string): boolean {
  try {
    const key = storageKey(actorId), serialized = sessionStorage.getItem(key);
    if (serialized === null) return true;
    if (parseProjectCreateIntent(serialized)?.key !== requestKey) return false;
    sessionStorage.removeItem(key);
    if (sessionStorage.getItem(key) !== null) return false;
    announce(); return true;
  } catch { return false; }
}
