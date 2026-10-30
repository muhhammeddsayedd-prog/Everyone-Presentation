import { createHash } from 'node:crypto';
import { DomainError } from '@eps/domain';
import type { GuestContent } from '../../domain/src/guest-types.ts';
import { guestRecord, guestResponseInvalid, guestTimestamp } from '../../domain/src/guest.ts';
import { checkedCentralConfig, type CentralConfig } from './config.ts';
import { presentationAssetRead, type PresentationAssetRead } from './presentation-storage.ts';
import { reviewToken } from './review-credentials.ts';

export interface GuestAssetRead extends PresentationAssetRead { grant_token: string; expires_at: string; parent_expires_at?: string }
export function guestAssetRead(value: unknown, now = Date.now()): GuestAssetRead {
  try {
    const row = guestRecord(value, ['asset', 'bucket', 'object_key', 'grant_token', 'expires_at', 'parent_expires_at', 'transcript'], ['asset', 'bucket', 'object_key', 'grant_token', 'expires_at']);
    const item = presentationAssetRead({ asset: row.asset, bucket: row.bucket, object_key: row.object_key, ...(Object.hasOwn(row, 'transcript') ? { transcript: row.transcript } : {}) });
    const expires = guestTimestamp(row.expires_at); const expiry = Date.parse(expires);
    if (expiry <= now || expiry > now + 65000) guestResponseInvalid();
    const parent = Object.hasOwn(row, 'parent_expires_at') ? guestTimestamp(row.parent_expires_at) : undefined;
    if (parent && Date.parse(parent) <= now) guestResponseInvalid();
    return { ...item, grant_token: reviewToken(row.grant_token), expires_at: expires, ...(parent ? { parent_expires_at: parent } : {}) };
  } catch { return guestResponseInvalid(); }
}
export function guestByteRange(value: string | null | undefined, size: number): { start: number; end: number; length: number } | null {
  if (!value) return null;
  const match = /^bytes=(\d{0,16})-(\d{0,16})$/u.exec(value);
  function invalid(): never { throw new DomainError('RANGE_NOT_SATISFIABLE', 'Request a single supported byte range.', 416, { size_bytes: size }); }
  if (!match || !match[1] && !match[2]) invalid();
  const first = match[1] ? Number(match[1]) : null; const last = match[2] ? Number(match[2]) : null;
  if (first !== null && !Number.isSafeInteger(first) || last !== null && (!Number.isSafeInteger(last) || last < 0) || size < 1) invalid();
  const start = first ?? Math.max(0, size - (last ?? 0)); const end = first === null ? size - 1 : last === null ? size - 1 : Math.min(last, size - 1);
  if (start >= size || start > end || first === null && last === 0) invalid(); return { start, end, length: end - start + 1 };
}
function unavailable(status?: number): never {
  if (status === 401 || status === 403) throw new DomainError('REVIEW_ACCESS_DENIED', 'This review access is no longer available.', 403);
  if (status === 404) throw new DomainError('RESOURCE_NOT_FOUND', 'This saved review asset is unavailable.', 404);
  throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Private review media is temporarily unavailable.', 503, {}, true);
}
/** A private scoped capability is sent only to the configured Storage origin.
 * No signed Storage URL or capability is returned to a guest. Parent/session
 * authorization is repeated by Storage policy for each proxied range request. */
export function createGuestAssetProxy(configValue: CentralConfig, options: { fetch?: typeof fetch; now?: () => number; timeoutMs?: number } = {}) {
  const config = checkedCentralConfig(configValue); const fetcher = options.fetch ?? fetch; const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 120000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new DomainError('REVIEW_CONFIGURATION_REQUIRED', 'Configure a bounded review media timeout.', 503);
  return {
    async read(value: unknown, rangeValue?: string | null, filename?: string): Promise<GuestContent> {
      const item = guestAssetRead(value, now()); const range = guestByteRange(rangeValue, item.asset.size_bytes); const expected = range?.length ?? item.asset.size_bytes;
      const target = new URL(`/storage/v1/object/${item.bucket}/${item.object_key.split('/').map(encodeURIComponent).join('/')}`, config.url);
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); timer.unref?.();
      let response: Response;
      try {
        response = await fetcher(target, { method: 'GET', redirect: 'error', cache: 'no-store', signal: controller.signal,
          headers: { apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'X-EPS-Review-Asset-Grant': item.grant_token,
            ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}) } });
        const contentType = response.headers.get('content-type')?.split(';')[0].trim();
        const advertised = response.headers.get('content-length'); const contentRange = response.headers.get('content-range');
        if (response.status !== (range ? 206 : 200)) unavailable(response.status);
        if (!response.body || contentType !== item.asset.mime_type || advertised !== String(expected)
          || range && contentRange !== `bytes ${range.start}-${range.end}/${item.asset.size_bytes}` || !range && contentRange !== null) {
          await response.body?.cancel(); throw new DomainError('SOURCE_UNREADABLE', 'The saved review media does not match its verified byte boundaries.', 422);
        }
      } catch (error) { clearTimeout(timer); controller.abort(); if (error instanceof DomainError) throw error; return unavailable(); }
      const reader = response.body!.getReader(); let bytes = 0; let closed = false; const sha = range ? null : createHash('sha256');
      const close = () => { if (!closed) { closed = true; clearTimeout(timer); controller.abort(); } };
      const body = new ReadableStream<Uint8Array>({
        async pull(output) {
          try {
            const result = await reader.read();
            if (result.done) {
              if (bytes !== expected || sha && sha.digest('hex') !== item.asset.sha256) throw new DomainError('SOURCE_UNREADABLE', 'The saved review media failed its byte-integrity check.', 422);
              close(); output.close(); reader.releaseLock(); return;
            }
            bytes += result.value.byteLength; if (bytes > expected) throw new DomainError('SOURCE_UNREADABLE', 'The saved review media exceeded its verified byte size.', 422);
            sha?.update(result.value); output.enqueue(result.value);
          } catch { close(); await reader.cancel().catch(() => {}); output.error(new DomainError('SOURCE_UNREADABLE', 'The saved review media stream could not be completed.', 422)); }
        },
        async cancel() { close(); await reader.cancel().catch(() => {}); }
      });
      return { body, mimeType: item.asset.mime_type, size: expected, status: range ? 206 : 200,
        ...(range ? { contentRange: `bytes ${range.start}-${range.end}/${item.asset.size_bytes}` } : {}), ...(filename ? { filename } : {}) };
    }
  };
}
