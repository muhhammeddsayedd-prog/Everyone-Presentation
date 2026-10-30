import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, type Actor } from '@eps/domain';
import type { PresentationOperations } from '../../domain/src/presentation-types.ts';
import { parseGenerateVersion, parseVersionListOptions } from '../../domain/src/presentation.ts';
import { parseCastingMutationContext } from '../../domain/src/casting.ts';
import { verifyCentralUser } from './client.ts';
import { centralRpcError } from './errors.ts';
import { reviewJobDto } from './review-dto.ts';
import { presentationRecord, presentationResponseInvalid, presentationVersionDto } from './presentation-dto.ts';
import { createPresentationStorage, presentationAssetRead } from './presentation-storage.ts';
import { versionTranscript } from './presentation-transcript.ts';
export interface CentralPresentationOptions { storageOrigin: string; now?: () => number; downloadTimeoutMs?: number }
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 200 || /[\\/\p{C}?#%]/u.test(value)) throw new DomainError('INVALID_REQUEST', 'Provide a bounded presentation identifier.', 400);
  return value;
}
const errors: Record<string, { status: number; message: string }> = {
  INPUT_CHANGED: { status: 409, message: 'Presentation inputs changed. Refresh and measure the current review before generating.' },
  FIT_MEASUREMENT_REQUIRED: { status: 409, message: 'Measure the current registered layout before generating.' },
  LAYOUT_OVERFLOW: { status: 422, message: 'Resolve the reported layout overflow before generating.' },
  TEMPLATE_UNAVAILABLE: { status: 503, message: 'The captured presentation template is unavailable.' },
  TEMPLATE_UPGRADE_REQUIRED: { status: 409, message: 'Create or select the current registered template series, refresh its review and measure it before generating.' },
  MEDIA_REFERENCE_INVALID: { status: 422, message: 'A selected presentation asset is unavailable or invalid.' },
  VERSION_NOT_READY: { status: 409, message: 'This fixed version is not ready to download.' },
  PRESENTATION_STATE_INVALID: { status: 409, message: 'The presentation state changed. Reload its saved status.' },
  PRESENTATION_LIMIT_EXCEEDED: { status: 422, message: 'This presentation exceeds the supported processing budget.' },
};
/** Verified-user facade only. Canonical transactions capture inputs and own
 * version allocation, idempotency, current permissions and ready publication. */
export async function createCentralPresentations(client: SupabaseClient, options: CentralPresentationOptions): Promise<PresentationOperations> {
  const storage = createPresentationStorage({ ...options, client });
  const identity = await verifyCentralUser(client);
  function acting(actor: Actor) { if (actor?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The presentation actor does not match the verified session.', 403); }
  async function rpc(actor: Actor, name: string, args: Record<string, unknown>, trace?: ReturnType<typeof parseCastingMutationContext>): Promise<unknown> {
    acting(actor);
    try {
      let call = client.rpc(name, args);
      if (trace?.requestId) call = call.setHeader('X-EPS-Request-ID', trace.requestId);
      if (trace?.clientType) call = call.setHeader('X-EPS-Client-Type', trace.clientType);
      const result = await call;
      if (result.error) {
        const known = result.error.code === 'P0001' && Object.hasOwn(errors, result.error.message) ? errors[result.error.message] : null;
        if (known) throw new DomainError(result.error.message, known.message, known.status);
        throw centralRpcError(result.error);
      }
      return result.data;
    } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Central presentation processing is temporarily unavailable.', 503, {}, true); }
  }
  async function getVersion(actor: Actor, versionId: string) {
    acting(actor); const id = identifier(versionId); const version = presentationVersionDto(await rpc(actor, 'eps_get_version', { p_version_id: id }));
    if (version.id !== id) presentationResponseInvalid(); return version;
  }
  async function asset(actor: Actor, versionId: string, assetId: string, purpose: 'pdf' | 'video' | 'frame' | 'logo') {
    const id = identifier(assetId); const result = presentationAssetRead(await rpc(actor, 'eps_get_version_asset', { p_version_id: versionId, p_asset_id: id, p_purpose: purpose }));
    const expected = { pdf: 'presentation_pdf', video: 'candidate_video', frame: 'candidate_frame', logo: 'client_logo' }[purpose];
    if (result.asset.id !== id || result.asset.purpose !== expected) presentationResponseInvalid(); return result;
  }
  async function pdfAsset(actor: Actor, versionId: string) {
    const version = await getVersion(actor, versionId);
    if (version.status !== 'ready' || !version.pdf_asset_id) throw new DomainError('VERSION_NOT_READY', 'This fixed version is not ready to download.', 409);
    return { version, source: await asset(actor, version.id, version.pdf_asset_id, 'pdf'), filename: `everyone-${version.render_context.cover.output_type}-v${version.version_no}.pdf` };
  }
  return {
    getVersion,
    async listVersions(actor, seriesId, value = {}) {
      acting(actor); const id = identifier(seriesId); const input = parseVersionListOptions(value);
      const result = presentationRecord(await rpc(actor, 'eps_list_versions', { p_series_id: id, p_options: input }), ['data', 'page']);
      const page = presentationRecord(result.page, ['next_cursor']);
      if (!Array.isArray(result.data) || result.data.length > input.limit! || !(page.next_cursor === null || typeof page.next_cursor === 'string' && page.next_cursor.length > 0 && page.next_cursor.length <= 4000)) presentationResponseInvalid();
      const data = result.data.map(presentationVersionDto);
      if (new Set(data.map(row => row.id)).size !== data.length || data.some(row => row.series_id !== id)) presentationResponseInvalid();
      return { data, page: { next_cursor: page.next_cursor as string | null } };
    },
    async generateVersion(actor, seriesId, value, metadata) {
      acting(actor); const id = identifier(seriesId); const input = parseGenerateVersion(value);
      if (typeof metadata?.idempotencyKey !== 'string' || metadata.idempotencyKey.length < 16 || metadata.idempotencyKey.length > 200) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Provide a stable Idempotency-Key between 16 and 200 characters.', 400);
      const trace = parseCastingMutationContext(metadata);
      const response = await rpc(actor, 'eps_generate_version', { p_series_id: id, p_input: input, p_idempotency_key: trace.idempotencyKey }, trace);
      try { return reviewJobDto(response); } catch { return presentationResponseInvalid(); }
    },
    async downloadVersionPdf(actor, versionId) {
      const { version, source, filename } = await pdfAsset(actor, versionId); const access = await storage.sign(source, filename);
      return { version_id: version.id, download_url: access.url, expires_at: access.expires_at, filename, size_bytes: source.asset.size_bytes };
    },
    async playVersionMedia(actor, versionId, assetId) {
      const version = await getVersion(actor, versionId); const id = identifier(assetId);
      if (!version.slides.some(slide => slide.video_asset_id === id)) throw new DomainError('RESOURCE_NOT_FOUND', 'This original video does not belong to the fixed version.', 404);
      const source = await asset(actor, version.id, id, 'video'); const transcript = versionTranscript(source.transcript, version.id, id); const access = await storage.sign(source);
      return { asset_id: id, ...access, mime_type: source.asset.mime_type, source_version_id: version.id, transcript };
    },
    async getVersionMediaContent(actor, versionId, assetId) {
      const version = await getVersion(actor, versionId); const id = identifier(assetId);
      const purpose = version.slides.some(slide => slide.frame_asset_ids.includes(id)) ? 'frame' : version.slides.some(slide => slide.logo_asset_id === id) ? 'logo' : null;
      if (!purpose) {
        if (version.slides.some(slide => slide.video_asset_id === id)) throw new DomainError('USE_PLAYBACK', 'Use fixed-version playback for this original video.', 409);
        throw new DomainError('RESOURCE_NOT_FOUND', 'This image does not belong to the fixed version.', 404);
      }
      return storage.read(await asset(actor, version.id, id, purpose));
    },
    async getVersionPdfContent(actor, versionId) {
      const { source, filename } = await pdfAsset(actor, versionId); return { ...await storage.read(source), filename };
    },
  };
}
