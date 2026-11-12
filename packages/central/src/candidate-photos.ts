import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, type Actor } from '@eps/domain';
import { verifyCentralUser } from './client.ts';
import { centralRpcError } from './errors.ts';

/** A cast archive photo (m09), read through m14. `thumb_asset_id` is the small version used on cards. */
export interface CandidatePhoto { id: string; position: number; cover: boolean; width: number; height: number; asset_id: string; thumb_asset_id: string }

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const BUCKET = 'eps-candidate-photos';
const MAXIMUM = 5242880;
const TIMEOUT = 15000;
const invalid = (): never => { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central candidate photos did not match their contract.', 503); };
function exact(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) invalid();
  return value as Record<string, unknown>;
}
const positive = (value: unknown, maximum: number) => Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= maximum;
function photo(value: unknown): CandidatePhoto {
  const row = exact(value, ['id', 'position', 'cover', 'width', 'height', 'asset_id', 'thumb_asset_id']);
  if (typeof row.id !== 'string' || !UUID.test(row.id) || !positive(row.position, 10000) || typeof row.cover !== 'boolean' || !positive(row.width, 4096) || !positive(row.height, 4096)
    || typeof row.asset_id !== 'string' || !UUID.test(row.asset_id) || typeof row.thumb_asset_id !== 'string' || !UUID.test(row.thumb_asset_id) || row.asset_id === row.thumb_asset_id) invalid();
  return structuredClone(row) as unknown as CandidatePhoto;
}

export async function createCentralCandidatePhotos(client: SupabaseClient) {
  const identity = await verifyCentralUser(client);
  function actor(value: Actor) { if (value?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The candidate photo actor does not match this verified session.', 403); }
  async function rpc(name: string, args: Record<string, unknown>) {
    try { const result = await client.rpc(name, args); if (result.error) throw centralRpcError(result.error); return result.data as unknown; }
    catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Candidate photos are temporarily unavailable.', 503, {}, true); }
  }
  return {
    /** The person's photos, cover first (at most 50). */
    async listCandidatePhotos(acting: Actor, candidateId: string): Promise<{ data: CandidatePhoto[]; page: { next_cursor: null } }> {
      actor(acting); if (!UUID.test(candidateId)) throw new DomainError('INVALID_REQUEST', 'Provide a candidate identifier.', 400);
      const value = exact(await rpc('eps_list_candidate_photos', { p_candidate_id: candidateId }), ['data']);
      if (!Array.isArray(value.data) || value.data.length > 50) invalid();
      const data = (value.data as unknown[]).map(photo);
      if (data.filter(item => item.cover).length > 1 || new Set(data.map(item => item.id)).size !== data.length) invalid();
      return { data, page: { next_cursor: null } };
    },
    /** One photo or thumbnail, read with the caller's own session and checked against its verified metadata. */
    async getCandidatePhotoContent(acting: Actor, assetId: string): Promise<{ bytes: Buffer; mimeType: 'image/jpeg' }> {
      actor(acting); if (!UUID.test(assetId)) throw new DomainError('INVALID_REQUEST', 'Provide a photo identifier.', 400);
      const value = exact(await rpc('eps_get_candidate_photo_asset', { p_asset_id: assetId }), ['asset', 'bucket', 'object_key']);
      const asset = exact(value.asset, ['id', 'purpose', 'mime_type', 'size_bytes', 'sha256', 'width', 'height', 'status']);
      if (asset.id !== assetId || asset.purpose !== 'candidate_photo' || asset.status !== 'ready' || asset.mime_type !== 'image/jpeg' || !positive(asset.size_bytes, MAXIMUM)
        || asset.sha256 !== null && (typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(asset.sha256)) || value.bucket !== BUCKET
        || typeof value.object_key !== 'string' || !value.object_key || value.object_key.length > 1024) invalid();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const deadline = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new DomainError('STORAGE_TIMEOUT', 'The private photo read timed out.', 503, {}, true)), TIMEOUT); });
        const result = await Promise.race([client.storage.from(BUCKET).download(value.object_key as string), deadline]);
        if (result.error || !result.data) throw new DomainError('DEPENDENCY_UNAVAILABLE', 'The stored photo is unavailable.', 503, {}, true);
        const bytes = Buffer.from(await result.data.arrayBuffer());
        if (bytes.length !== asset.size_bytes || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff
          || typeof asset.sha256 === 'string' && createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new DomainError('SOURCE_UNREADABLE', 'The stored photo failed its integrity check.', 422);
        return { bytes, mimeType: 'image/jpeg' };
      } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('DEPENDENCY_UNAVAILABLE', 'The stored photo is unavailable.', 503, {}, true); }
      finally { clearTimeout(timer); }
    },
  };
}
export type CentralCandidatePhotos = Awaited<ReturnType<typeof createCentralCandidatePhotos>>;
