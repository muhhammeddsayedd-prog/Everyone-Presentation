import { OAUTH_UUID, closed, object } from './oauth-consent-contract.ts';

const MAXIMUM_BYTES = 8192;
const FIELDS = ['authorization_id', 'redirect_uri', 'client', 'user', 'scope', 'redirect_url', 'error', 'error_code', 'code', 'message', 'msg'];
const KNOWN_ERRORS = new Set(['oauth_authorization_not_found', 'oauth_authorization_expired', 'oauth_client_not_found', 'invalid_request', 'invalid_scope',
  'access_denied', 'flow_state_not_found', 'flow_state_expired', 'session_not_found', 'session_expired', 'bad_jwt', 'unexpected_failure']);
type Observation = { variant: string; fields?: Record<string, string>; client_fields?: Record<string, string>;
  user_fields?: Record<string, string>; error_code?: string };
export interface OAuthConsentTrace { event: 'eps.oauth.provider_response'; trace_id: string; operation: 'details' | 'decision';
  method: 'GET' | 'POST' | 'other'; status: number | null; variant: string; fields?: Record<string, string>;
  client_fields?: Record<string, string>; user_fields?: Record<string, string>; error_code?: string }
function fieldTypes(value: Record<string, unknown>, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.filter(name => Object.hasOwn(value, name)).map(name => [name,
    value[name] === null ? 'null' : Array.isArray(value[name]) ? 'array' : typeof value[name]]));
}
function shape(value: unknown, ok: boolean): Observation {
  if (!object(value)) return { variant: 'non_object' };
  const result: Observation = { variant: !ok ? 'provider_error' : closed(value, ['redirect_url']) ? 'redirect'
    : closed(value, ['authorization_id', 'redirect_uri', 'client', 'user', 'scope']) ? 'authorization_details' : 'unrecognized',
  fields: fieldTypes(value, FIELDS) };
  if (object(value.client)) result.client_fields = fieldTypes(value.client, ['id', 'name', 'uri', 'logo_uri']);
  if (object(value.user)) result.user_fields = fieldTypes(value.user, ['id', 'email']);
  if (!ok) {
    const error = value.error_code ?? value.code ?? value.error;
    if (typeof error === 'string') result.error_code = KNOWN_ERRORS.has(error) ? error : 'other';
  }
  return result;
}
/** A bounded clone is inspected; the SDK always receives the original response. */
async function inspect(response: Response): Promise<Observation> {
  const size = response.headers.get('content-length');
  if (size && /^\d+$/u.test(size) && Number(size) > MAXIMUM_BYTES) return { variant: 'oversized' };
  const reader = response.clone().body?.getReader();
  if (!reader) return { variant: 'invalid_json' };
  const expired = Symbol('inspection_timeout');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof expired>(resolve => { timer = setTimeout(() => resolve(expired), 1000); });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await Promise.race([reader.read(), deadline]);
      if (next === expired) return { variant: 'inspection_timeout' };
      if (next.done) break;
      length += next.value.byteLength;
      if (length > MAXIMUM_BYTES) return { variant: 'oversized' };
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return shape(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown, response.ok);
  } catch { return { variant: 'invalid_json' }; }
  finally {
    clearTimeout(timer);
    // A cloned fetch stream can wait for its original branch when cancelled.
    // Cancellation must not delay delivery of the original response to the SDK.
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Logs only fixed keys/types/status. Never logs selectors, URLs, values or credentials. */
export function observeOAuthConsentFetch(options: { centralOrigin: string; traceId: string; fetch?: typeof fetch;
  log?: (value: OAuthConsentTrace) => void }): typeof fetch {
  const central = new URL(options.centralOrigin);
  if (central.origin !== options.centralOrigin || central.username || central.password || !OAUTH_UUID.test(options.traceId)) throw new Error('Invalid OAuth trace configuration.');
  const fetcher = options.fetch ?? fetch;
  const log = options.log ?? (value => console.info('EPS OAuth trace', JSON.stringify(value)));
  function emit(value: OAuthConsentTrace) { try { log(value); } catch { /* Observation cannot change authorization behavior. */ } }
  return async (input, init) => {
    let operation: 'details' | 'decision' | undefined;
    try {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const path = /^\/auth\/v1\/oauth\/authorizations\/[a-z2-7]{32}(\/consent)?$/u.exec(url.pathname);
      if (url.origin === central.origin && !url.username && !url.password && path) operation = path[1] ? 'decision' : 'details';
    } catch { /* An unrelated or malformed URL is left to the underlying fetch. */ }
    if (!operation) return fetcher(input, init);
    const rawMethod = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const method: OAuthConsentTrace['method'] = rawMethod === 'GET' || rawMethod === 'POST' ? rawMethod : 'other';
    const base = { event: 'eps.oauth.provider_response' as const, trace_id: options.traceId, operation, method };
    let response: Response;
    try { response = await fetcher(input, init); }
    catch (error) { emit({ ...base, status: null, variant: 'transport_error' }); throw error; }
    let observation: Observation;
    try { observation = await inspect(response); } catch { observation = { variant: 'inspection_unavailable' }; }
    emit({ ...base, status: response.status, ...observation });
    return response;
  };
}
