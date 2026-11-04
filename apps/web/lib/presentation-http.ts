import { DomainError, type Actor, type MutationContext } from '@eps/domain';
import type { PresentationOperations } from '../../../packages/domain/src/presentation-types';
import { parseGenerateVersion, parseVersionListOptions } from '../../../packages/domain/src/presentation';
import { parseCastingMutationContext } from '../../../packages/domain/src/casting';
import { json, NO_STORE, readBoundedBody, readJson } from './http';
import { validateContract } from './validation';
import { PPTX_MIME, versionPptx, versionPptxDownload } from './presentation-pptx';
import { readRuntimeConfig } from './config';
export function isPresentationRoute(s: string[]): boolean {
  return s[0] === 'presentation-series' && s.length === 3 && s[2] === 'versions'
    || s[0] === 'versions' && (s.length === 2 || s.length === 3 && (s[2] === 'pdf' || s[2] === 'pptx')
      || s.length === 4 && (s[2] === 'pdf' || s[2] === 'pptx') && s[3] === 'content'
      || s.length === 5 && s[2] === 'media' && ['playback', 'content'].includes(s[4]));
}
function invalid(): never { throw new DomainError('INVALID_REQUEST', 'Use a supported presentation route with bounded parameters.', 400); }
/** Storage finishes authorization and full integrity verification before this
 * downstream stream exists. Keep bounded delivery/backpressure without changing
 * the byte contract or exposing an unverified prefix or Storage capability. */
function verifiedPdfBody(bytes: Uint8Array, signal: AbortSignal): ReadableStream<Uint8Array> {
  signal.throwIfAborted();
  let offset = 0; let onAbort: () => void;
  const release = () => { bytes = new Uint8Array(); signal.removeEventListener('abort', onAbort); };
  return new ReadableStream<Uint8Array>({
    start(controller) {
      onAbort = () => { release(); controller.error(new DOMException('The PDF request was aborted.', 'AbortError')); };
      signal.addEventListener('abort', onAbort, { once: true });
    },
    pull(controller) {
      const end = Math.min(offset + 64 * 1024, bytes.byteLength);
      controller.enqueue(bytes.subarray(offset, end)); offset = end;
      if (offset === bytes.byteLength) { release(); controller.close(); }
    },
    cancel() { release(); },
  }, { highWaterMark: 0 });
}
export async function handlePresentationRequest(request: Request, s: string[], actor: Actor, service: PresentationOperations,
  metadata: MutationContext & { requestId: string }): Promise<Response> {
  if (!isPresentationRoute(s) || s.some(part => !part || part.length > 200 || /[\\/\p{C}?#%]/u.test(part))) invalid();
  const url = new URL(request.url); const list = s[0] === 'presentation-series';
  if (list && request.method === 'GET') {
    const options: Record<string, unknown> = {};
    for (const [key, value] of url.searchParams) {
      if (!['limit', 'cursor'].includes(key) || !value || url.searchParams.getAll(key).length !== 1) invalid();
      if (key === 'limit') { if (!/^[1-9][0-9]*$/u.test(value)) invalid(); options.limit = Number(value); } else options.cursor = value;
    }
    return Response.json({ request_id: metadata.requestId, ...await service.listVersions(actor, s[1], parseVersionListOptions(options)) }, { headers: NO_STORE });
  }
  if (url.search) invalid();
  if (request.method === 'GET' && s[0] === 'versions') {
    if (s.length === 2) return json(await service.getVersion(actor, s[1]), metadata.requestId);
    if (s.length === 4 && s[2] === 'pptx' && s[3] === 'content') {
      const pptx = await versionPptx(actor, s[1], service, url.origin);
      return new Response(new Uint8Array(pptx.bytes), { headers: { ...NO_STORE, 'Content-Type': PPTX_MIME, 'Content-Length': String(pptx.bytes.byteLength), 'Content-Disposition': `attachment; filename="${pptx.filename}"` } });
    }
    if (!(s.length === 4 && s[2] === 'pdf' && s[3] === 'content' || s.length === 5 && s[2] === 'media' && s[4] === 'content')) throw new DomainError('RESOURCE_NOT_FOUND', 'This presentation operation is unavailable.', 404);
    const content = s[2] === 'pdf' ? await service.getVersionPdfContent(actor, s[1]) : await service.getVersionMediaContent(actor, s[1], s[3]);
    return new Response(s[2] === 'pdf' ? verifiedPdfBody(content.bytes, request.signal) : new Uint8Array(content.bytes), { headers: { ...NO_STORE, 'Content-Type': content.mimeType, 'Content-Length': String(content.bytes.byteLength),
      ...(content.filename ? { 'Content-Disposition': `inline; filename="${content.filename.replace(/[^A-Za-z0-9._-]/gu, '_')}"` } : {}) } });
  }
  if (request.method === 'POST' && list) {
    if (typeof metadata.idempotencyKey !== 'string' || metadata.idempotencyKey.length < 16 || metadata.idempotencyKey.length > 200) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Provide an Idempotency-Key between 16 and 200 characters.', 400);
    const context = { ...parseCastingMutationContext(metadata), idempotencyKey: metadata.idempotencyKey };
    const input = parseGenerateVersion(validateContract('GenerateVersion', await readJson(request)));
    return json(await service.generateVersion(actor, s[1], input, context), metadata.requestId, 202);
  }
  if (request.method === 'POST' && s[0] === 'versions' && s.length === 3 && s[2] === 'pptx') {
    await readBoundedBody(request, 0);
    // MCP dispatches in-process, so the link uses the configured public app origin.
    return json(await versionPptxDownload(actor, s[1], service, readRuntimeConfig().baseUrl), metadata.requestId);
  }
  if (request.method === 'POST' && s[0] === 'versions' && (s.length === 3 && s[2] === 'pdf' || s.length === 5 && s[4] === 'playback')) {
    await readBoundedBody(request, 0);
    return json(s[2] === 'pdf' ? await service.downloadVersionPdf(actor, s[1]) : await service.playVersionMedia(actor, s[1], s[3]), metadata.requestId);
  }
  throw new DomainError('RESOURCE_NOT_FOUND', 'This presentation operation is unavailable.', 404);
}
