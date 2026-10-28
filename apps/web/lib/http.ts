import { randomUUID } from 'node:crypto';
import { DomainError } from '@eps/domain';
import { readRuntimeConfig } from './config';

export const NO_STORE = { 'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0', Pragma: 'no-cache', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' };
export function json(data: unknown, requestId: string = randomUUID(), status = 200) {
  return Response.json({ request_id: requestId, data }, { status, headers: NO_STORE });
}
export function failure(error: unknown, requestId: string = randomUUID()) {
  if (error instanceof DomainError) return Response.json({ request_id: requestId, error: {
    code: error.code, message: error.message, details: error.details ?? {}, retryable: error.retryable ?? false
  } }, { status: error.status, headers: NO_STORE });
  // Internal exceptions can contain paths or credentials; never serialize them.
  return Response.json({ request_id: requestId, error: { code: 'DEPENDENCY_UNAVAILABLE',
    message: 'Presentation Studio is temporarily unavailable. Try again or contact your workspace administrator.', details: {}, retryable: false
  } }, { status: 503, headers: NO_STORE });
}
export function requireSameOrigin(request: Request, allowUserBearer = false) {
  const config = readRuntimeConfig();
  const expected = config.baseUrl;
  // Explicit user bearer authentication is verified before each central operation.
  // Cookie-based browser mutations still require Origin; fixtures never accept bearer auth.
  if (allowUserBearer && config.adapterMode === 'supabase' && /^Bearer [^\s]{1,16384}$/i.test(request.headers.get('authorization') ?? '')
    && request.headers.get('host') === new URL(expected).host) return;
  // Next normalizes Request.url to localhost internally; validate the actual Host and Origin.
  if (request.headers.get('host') !== new URL(expected).host || request.headers.get('origin') !== expected) {
    throw new DomainError('ACCESS_DENIED', 'Use the configured local app origin for mutations.', 403);
  }
}
export async function readBoundedBody(request: Request, maximum: number) {
  const advertised = request.headers.get('content-length');
  if (advertised && (!/^\d+$/.test(advertised) || Number(advertised) > maximum)) {
    throw new DomainError('VALIDATION_ERROR', 'Request exceeds the allowed byte limit.', 400);
  }
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      length += result.value.byteLength;
      if (length > maximum) { await reader.cancel(); throw new DomainError('VALIDATION_ERROR', 'Request exceeds the allowed byte limit.', 400); }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export async function readJson(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new DomainError('VALIDATION_ERROR', 'Use application/json.', 400);
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBoundedBody(request, 64 * 1024))); }
  catch (e) { if (e instanceof DomainError) throw e; throw new DomainError('VALIDATION_ERROR', 'Malformed JSON body.', 400); }
}
