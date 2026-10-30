import type { CandidateMedia, DuplicateMatch } from '@eps/domain';
import { api, type Envelope } from './api';

const changed = () => new Error('The candidate list could not be read completely. Refresh it before making changes.');

async function readPages<T>(candidateId: string, kind: 'media' | 'duplicates', identity: (row: T) => string, init: RequestInit): Promise<Envelope<T[]>> {
  const data: T[] = []; const cursors = new Set<string>(); const ids = new Set<string>();
  let cursor: string | null = null;
  for (let index = 0; index < 100; index++) {
    init.signal?.throwIfAborted();
    const query: URLSearchParams = new URLSearchParams({ limit: '100', ...(cursor ? { cursor } : {}) });
    const page: Envelope<T[]> = await api<T[]>(`/api/v1/candidates/${encodeURIComponent(candidateId)}/${kind}?${query}`, init);
    if (!Array.isArray(page.data) || !page.page || !(page.page.next_cursor === null
      || typeof page.page.next_cursor === 'string' && page.page.next_cursor.length > 0 && page.page.next_cursor.length <= 2000)) throw changed();
    for (const row of page.data) {
      if (!row || typeof row !== 'object') throw changed();
      const id = identity(row);
      if (typeof id !== 'string' || !id || ids.has(id)) throw changed();
      ids.add(id); data.push(row);
    }
    cursor = page.page.next_cursor;
    if (cursor === null) return { request_id: page.request_id, data, page: { next_cursor: null } };
    if (cursors.has(cursor) || !page.data.length) throw changed();
    cursors.add(cursor);
  }
  throw changed();
}

export function readCandidateMedia(candidateId: string, init: RequestInit = {}) {
  return readPages<CandidateMedia>(candidateId, 'media', row => row.id, init);
}
export function readDuplicateMatches(candidateId: string, init: RequestInit = {}) {
  return readPages<DuplicateMatch>(candidateId, 'duplicates', row => row.candidate_id, init);
}
