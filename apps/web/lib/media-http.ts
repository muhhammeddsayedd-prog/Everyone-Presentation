import { DomainError, type Actor } from '@eps/domain';
import { json, readBoundedBody } from './http';

export interface MediaPlaybackOperations {
  playMedia(actor: Actor, assetId: string): Promise<unknown>;
}

export function isMediaPlaybackRoute(segments: string[]) {
  return segments.length === 3 && segments[0] === 'media' && segments[2] === 'playback';
}

/** The caller supplies its verified actor. Playback accepts only the resource ID;
 * neither a fetch destination nor an alternative principal is client input. */
export async function handleMediaPlaybackRequest(request: Request, segments: string[], actor: Actor,
  service: MediaPlaybackOperations, requestId: string) {
  if (!isMediaPlaybackRoute(segments) || request.method !== 'POST') {
    throw new DomainError('RESOURCE_NOT_FOUND', 'No matching media playback operation.', 404);
  }
  const assetId = segments[1];
  if (!assetId || assetId.length > 200 || /[\\/\p{C}?#%]/u.test(assetId) || ['.', '..'].includes(assetId)) {
    throw new DomainError('INVALID_REQUEST', 'Provide a bounded resource identifier.', 400);
  }
  if (new URL(request.url).searchParams.size) {
    throw new DomainError('INVALID_REQUEST', 'Media playback does not accept query parameters.', 400);
  }
  // The published operation has no requestBody. A zero-byte bound also rejects
  // an unadvertised or misleading Content-Length without buffering its payload.
  await readBoundedBody(request, 0);
  return json(await service.playMedia(actor, assetId), requestId);
}
