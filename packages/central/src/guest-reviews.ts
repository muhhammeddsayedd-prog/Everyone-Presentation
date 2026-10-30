import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DomainError, type Actor } from '@eps/domain';
import type { GuestMutationContext, GuestReviewOperations, ReviewLinkOperations } from '../../domain/src/guest-types.ts';
import { exportPreparationDto, externalVersionDto, feedbackCommentDto, guestAccessDto, guestFeedbackDto, guestIdentifier,
  guestRecord, guestResponseInvalid, parseCommentCreate, parseCommentPatch, parseExportPrepare, parseGuestCommentCreate,
  parseGuestCommentPatch, parseGuestIdentity, parseGuestListOptions, parseGuestRowVersion, parsePreferenceSet,
  parseReviewLinkCreate, parseReviewLinkListOptions, parseReviewLinkPatch, preferenceResultDto, presentationExportDto, reviewLinkDto } from '../../domain/src/guest.ts';
import { presentationApplicationOrigin } from '../../domain/src/presentation.ts';
import { parseCastingMutationContext } from '../../domain/src/casting.ts';
import { verifyCentralUser } from './client.ts';
import { checkedCentralConfig, type CentralConfig } from './config.ts';
import { centralRpcError } from './errors.ts';
import { createPresentationStorage, presentationAssetRead } from './presentation-storage.ts';
import { createGuestAssetProxy, guestAssetRead, guestByteRange } from './guest-storage.ts';
import { decryptReviewReplay, encryptReviewReplay, newReviewToken, reviewToken, reviewTokenDigest, signReviewGateway } from './review-credentials.ts';
import { versionTranscript } from './presentation-transcript.ts';

export interface ReviewServiceOptions { central: CentralConfig; applicationOrigin: string; replayKey: Uint8Array; gatewayKey: Uint8Array; now?: () => number; fetch?: typeof fetch }
const known: Record<string, { status: number; message: string; retryable?: boolean; code?: string }> = {
  REVIEW_ACCESS_DENIED: { status: 403, message: 'This review link or session is unavailable, expired or revoked.' },
  REVIEW_LINK_EXPIRED: { status: 403, message: 'This review link has expired.' },
  REVIEW_LINK_REVOKED: { status: 403, message: 'This review link was revoked.' },
  REVIEW_LINK_ROTATED: { status: 403, message: 'This review link was replaced. Request the current link.' },
  REVIEW_UNAVAILABLE: { status: 404, message: 'This review access is unavailable, expired or revoked.' },
  GUEST_IDENTITY_REQUIRED: { status: 422, message: 'Enter your name before adding feedback.' },
  EXTERNAL_SERIES_REQUIRED: { status: 422, message: 'Choose an external-audience presentation series before sharing.' },
  LINK_REVOKED: { status: 409, message: 'This link was revoked. Create a separate link to share again.' },
  TOKEN_REPLAY_EXPIRED: { status: 409, message: 'The creation-response replay expired. Refresh link management before rotating or creating another link.' },
  ASSET_UNAVAILABLE: { status: 503, message: 'This saved review asset is temporarily unavailable.', retryable: true },
  PERMISSION_CHANGED: { status: 403, message: 'The current account can no longer perform this review operation.' },
  JOB_ALREADY_RUNNING: { status: 409, message: 'This review PDF is already being prepared.' },
  JOB_CANCELLED: { status: 409, message: 'This review PDF job was cancelled.' },
  PRESENTATION_PROCESSING_UNAVAILABLE: { status: 503, message: 'PDF processing is temporarily unavailable.', retryable: true },
  DOWNLOAD_DISABLED: { status: 403, message: 'PDF downloads are disabled for this review link.' },
  EXPORT_NOT_READY: { status: 409, message: 'The review PDF is still being prepared or needs retry.' },
  EXPORT_STALE: { status: 409, message: 'This link changed. Prepare a current PDF export.' },
  VERSION_NOT_READY: { status: 409, message: 'This saved presentation is not ready.' },
  RATE_LIMITED: { status: 429, message: 'Too many review requests. Wait a moment and try again.', retryable: true },
  REVIEW_GATEWAY_UNAVAILABLE: { status: 503, message: 'Guest review is not enabled for this workspace.', retryable: true },
};
function rpcError(error: { code?: string; message?: string; details?: string | null }): DomainError {
  const entry = error.code === 'P0001' && typeof error.message === 'string' ? known[error.message] : null;
  if (!entry) return centralRpcError(error);
  let status = entry.status;
  if (error.message === 'REVIEW_UNAVAILABLE') {
    try { if (error.details && JSON.parse(error.details)?.status === 503) status = 503; } catch { /* SQL details are never serialized. */ }
  }
  return new DomainError(entry.code ?? error.message!, entry.message, status, {}, entry.retryable ?? status === 503);
}
function mutation(context: GuestMutationContext): GuestMutationContext {
  if (typeof context?.idempotencyKey !== 'string' || context.idempotencyKey.length < 16 || context.idempotencyKey.length > 200) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Provide a stable Idempotency-Key between 16 and 200 characters.', 400);
  return { ...parseCastingMutationContext(context), idempotencyKey: context.idempotencyKey };
}
function checkedOptions(options: ReviewServiceOptions) {
  if (options.replayKey.byteLength !== 32 || options.gatewayKey.byteLength !== 32 || Buffer.from(options.replayKey).equals(Buffer.from(options.gatewayKey))) throw new DomainError('REVIEW_CONFIGURATION_REQUIRED', 'Configure distinct private review service keys.', 503);
  return { central: checkedCentralConfig(options.central), origin: presentationApplicationOrigin(options.applicationOrigin), now: options.now ?? Date.now };
}
function filename(versionId: string) { return `everyone-review-${versionId}.pdf`; }
function responseRecord(value: unknown, keys: readonly string[]) { try { return guestRecord(value, keys); } catch { return guestResponseInvalid(); } }
function contentPath(origin: string, id: string, sessionId?: string) { const url = new URL(`/api/v1/${sessionId ? 'review/' : ''}pdf-exports/${encodeURIComponent(id)}/content`, origin); if (sessionId) url.searchParams.set('review_context', sessionId); return url.href; }

/** Acting user only; every RPC repeats current project/capability authorization. */
export async function createCentralReviewLinks(client: SupabaseClient, options: ReviewServiceOptions): Promise<ReviewLinkOperations> {
  const config = checkedOptions(options); const identity = await verifyCentralUser(client);
  const storage = createPresentationStorage({ client, storageOrigin: config.central.url, now: config.now });
  function acting(actor: Actor) { if (actor?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The review actor does not match the verified session.', 403); }
  async function rpc(actor: Actor, name: string, args: Record<string, unknown>, context?: GuestMutationContext): Promise<unknown> {
    acting(actor); try {
      let call = client.rpc(name, args);
      if (context?.requestId) call = call.setHeader('X-EPS-Request-ID', context.requestId);
      if (context?.clientType) call = call.setHeader('X-EPS-Client-Type', context.clientType);
      const result = await call; if (result.error) throw rpcError(result.error); return result.data;
    } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Central review management is temporarily unavailable.', 503, {}, true); }
  }
  async function tokenMutation(actor: Actor, operation: 'create' | 'rotate', id: string, input: Record<string, unknown>, context: GuestMutationContext) {
    const trace = mutation(context); acting(actor);
    const aad = { protocol: 'eps-review-replay-v1', actor: actor.principal_id, operation, subject: id, idempotency_key: trace.idempotencyKey };
    const token = newReviewToken(); const protectedCredential = { token_digest: reviewTokenDigest(token), response_encrypted: encryptReviewReplay(token, options.replayKey, aad) };
    // Acting-user authorization alone cannot attest token entropy or encrypted
    // replay provenance. Admission26 verifies this fresh backend MAC before
    // either a mutation or an existing acknowledgement can be returned.
    const credential = { ...protectedCredential, proof: signReviewGateway(`${operation}_review_link`, {
      actor_id: actor.principal_id, subject_id: id, input, idempotency_key: trace.idempotencyKey, ...protectedCredential,
    }, options.gatewayKey, config.now()) };
    const result = responseRecord(await rpc(actor, operation === 'create' ? 'eps_create_review_link' : 'eps_rotate_review_link', {
      [operation === 'create' ? 'p_series_id' : 'p_review_link_id']: id, p_input: input, p_credential: credential, p_idempotency_key: trace.idempotencyKey }, trace), ['link', 'response_encrypted']);
    const link = reviewLinkDto(result.link); const raw = decryptReviewReplay(result.response_encrypted, options.replayKey, aad);
    if (operation === 'create' ? link.series_id !== id : link.id !== id) guestResponseInvalid();
    return { link, token: raw, url: new URL(`/r/${raw}`, config.origin).href };
  }
  async function exportAsset(actor: Actor, id: string) { return presentationAssetRead(await rpc(actor, 'eps_get_pdf_export_asset', { p_export_id: guestIdentifier(id) })); }
  return {
    async listReviewLinks(actor, value = {}) {
      const input = parseReviewLinkListOptions(value); const result = responseRecord(await rpc(actor, 'eps_list_review_links', { p_options: input }), ['data', 'page']); const page = responseRecord(result.page, ['next_cursor']);
      if (!Array.isArray(result.data) || result.data.length > (input.limit ?? 25) || !(page.next_cursor === null || typeof page.next_cursor === 'string' && page.next_cursor.length > 0 && page.next_cursor.length <= 4000)) guestResponseInvalid();
      if (page.next_cursor !== null) { try { parseGuestListOptions({ cursor: page.next_cursor }); } catch { guestResponseInvalid(); } }
      const data = result.data.map(reviewLinkDto); if (new Set(data.map(item => item.id)).size !== data.length) guestResponseInvalid(); return { data, page: { next_cursor: page.next_cursor as string | null } };
    },
    async createReviewLink(actor, value, context) { const { series_id, ...input } = parseReviewLinkCreate(value); return tokenMutation(actor, 'create', series_id, input, context); },
    async updateReviewLink(actor, id, value, context) { const trace = context ? mutation(context) : undefined; const result = reviewLinkDto(await rpc(actor, 'eps_update_review_link', { p_review_link_id: guestIdentifier(id), p_input: parseReviewLinkPatch(value), ...(trace ? { p_idempotency_key: trace.idempotencyKey } : {}) }, trace)); if (result.id !== id) guestResponseInvalid(); return result; },
    async revokeReviewLink(actor, id, value, context) { const trace = mutation(context); const result = reviewLinkDto(await rpc(actor, 'eps_revoke_review_link', { p_review_link_id: guestIdentifier(id), p_input: parseGuestRowVersion(value), p_idempotency_key: trace.idempotencyKey }, trace)); if (result.id !== id) guestResponseInvalid(); return result; },
    async rotateReviewLink(actor, id, value, context) { return tokenMutation(actor, 'rotate', guestIdentifier(id), parseGuestRowVersion(value), context); },
    async listFeedback(actor, versionId, value = {}) { const id = guestIdentifier(versionId); const input = parseGuestListOptions(value); const result = guestFeedbackDto(await rpc(actor, 'eps_list_feedback', { p_version_id: id, p_options: input })); if (result.version_id !== id || result.comments.length + result.preferences.length > (input.limit ?? 25)) guestResponseInvalid(); return result; },
    async createComment(actor, versionId, value, context) { const trace = mutation(context); const id = guestIdentifier(versionId); const input = parseCommentCreate(value); const result = feedbackCommentDto(await rpc(actor, 'eps_create_comment', { p_version_id: id, p_input: input, p_idempotency_key: trace.idempotencyKey }, trace)); if (result.version_id !== id || result.version_slide_id !== input.version_slide_id || result.visibility !== input.visibility) guestResponseInvalid(); return result; },
    async updateComment(actor, id, value, context) { const trace = context ? mutation(context) : undefined; const result = feedbackCommentDto(await rpc(actor, 'eps_update_comment', { p_comment_id: guestIdentifier(id), p_input: parseCommentPatch(value), ...(trace ? { p_idempotency_key: trace.idempotencyKey } : {}) }, trace)); if (result.id !== id) guestResponseInvalid(); return result; },
    async setPreference(actor, versionId, value, context) { const trace = mutation(context); const input = parsePreferenceSet(value); const result = preferenceResultDto(await rpc(actor, 'eps_set_preference', { p_version_id: guestIdentifier(versionId), p_input: input, p_idempotency_key: trace.idempotencyKey }, trace)); if (result.preference && result.preference.version_slide_id !== input.version_slide_id) guestResponseInvalid(); return result; },
    async preparePdfExport(actor, value, context) { const trace = mutation(context); const input = parseExportPrepare(value); const result = exportPreparationDto(await rpc(actor, 'eps_prepare_pdf_export', { p_input: input, p_idempotency_key: trace.idempotencyKey }, trace)); if (result.export.version_id !== input.version_id || result.export.review_link_id !== input.review_link_id) guestResponseInvalid(); return result; },
    async getPdfExport(actor, id) { const result = presentationExportDto(await rpc(actor, 'eps_get_pdf_export', { p_export_id: guestIdentifier(id) })); if (result.id !== id) guestResponseInvalid(); return result; },
    async downloadPdfExport(actor, id) { const result = presentationExportDto(await rpc(actor, 'eps_get_pdf_export', { p_export_id: guestIdentifier(id) })); const asset = await exportAsset(actor, id); if (result.status !== 'ready' || result.pdf_asset_id !== asset.asset.id) guestResponseInvalid(); return { version_id: result.version_id, download_url: contentPath(config.origin, result.id), expires_at: new Date(config.now() + 60000).toISOString(), filename: filename(result.version_id), size_bytes: asset.asset.size_bytes }; },
    async getPdfExportContent(actor, id, rangeValue) { const asset = await exportAsset(actor, id); const result = await storage.read(asset); const range = guestByteRange(rangeValue, result.bytes.byteLength); const selected = range ? result.bytes.subarray(range.start, range.end + 1) : result.bytes; return { body: new Response(new Uint8Array(selected)).body!, mimeType: result.mimeType, size: selected.byteLength, status: range ? 206 : 200, ...(range ? { contentRange: `bytes ${range.start}-${range.end}/${result.bytes.byteLength}` } : {}), filename: `everyone-review-${guestIdentifier(id)}.pdf` }; },
  };
}

/** Anonymous Supabase client can invoke only the fixed gateway. The independent
 * backend MAC prevents stored token digests being replayed as bearer values. */
export function createCentralGuestReviews(options: ReviewServiceOptions): GuestReviewOperations {
  const config = checkedOptions(options); const fetcher = options.fetch ?? fetch;
  const client = createClient(config.central.url, config.central.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, init) => fetcher(url, { ...init, cache: 'no-store', redirect: 'error', signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }) } });
  const storage = createGuestAssetProxy(config.central, { fetch: options.fetch, now: config.now });
  async function rpc(operation: string, input: Record<string, unknown>): Promise<unknown> {
    const proof = signReviewGateway(operation, input, options.gatewayKey, config.now());
    try { const result = await client.rpc('eps_guest_operation', { p_operation: operation, p_input: input, p_proof: proof }); if (result.error) throw rpcError(result.error); return result.data; }
    catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Guest review is temporarily unavailable.', 503, {}, true); }
  }
  const sessionInput = (session: string) => ({ session_digest: reviewTokenDigest(session) });
  async function sessionData(session: string) { return guestAccessDto(await rpc('session', sessionInput(session)), reviewToken(session)); }
  async function asset(session: string, versionId: string, assetId: string, purpose: 'frame' | 'logo' | 'video') {
    const id = guestIdentifier(assetId); const result = guestAssetRead(await rpc('get_asset', { ...sessionInput(session), version_id: guestIdentifier(versionId), asset_id: id, purpose }), config.now());
    if (result.asset.id !== id || result.asset.purpose !== { frame: 'candidate_frame', logo: 'client_logo', video: 'candidate_video' }[purpose]) guestResponseInvalid(); return result;
  }
  async function grantAsset(grant: string, versionId: string, assetId: string) { const id = guestIdentifier(assetId); const result = guestAssetRead(await rpc('grant_asset', { media_grant_digest: reviewTokenDigest(grant), version_id: guestIdentifier(versionId), asset_id: id }), config.now()); if (result.asset.id !== id || result.asset.purpose !== 'candidate_video') guestResponseInvalid(); return result; }
  async function pdfAsset(session: string, id: string) { const result = guestAssetRead(await rpc('get_export_asset', { ...sessionInput(session), export_id: guestIdentifier(id) }), config.now()); if (result.asset.purpose !== 'presentation_pdf') guestResponseInvalid(); return result; }
  return {
    async openReview(value) { const token = reviewToken(value); const session = newReviewToken(); return guestAccessDto(await rpc('open', { token_digest: reviewTokenDigest(token), session_digest: reviewTokenDigest(session) }), session); },
    getSession: sessionData,
    async identify(session, value, context) { const trace = context ? mutation(context) : undefined; return guestAccessDto(await rpc('identify', { ...sessionInput(session), ...parseGuestIdentity(value), ...(trace ? { idempotency_key: trace.idempotencyKey } : {}) }), reviewToken(session)); },
    async getCurrentVersion(session) { const result = await rpc('get_current_version', sessionInput(session)); return result === null ? null : externalVersionDto(result); },
    async getVersion(session, id) { const result = externalVersionDto(await rpc('get_version', { ...sessionInput(session), version_id: guestIdentifier(id) })); if (result.id !== id) guestResponseInvalid(); return result; },
    async listFeedback(session, versionId, value = {}) { const id = guestIdentifier(versionId); const input = parseGuestListOptions(value); const result = guestFeedbackDto(await rpc('list_feedback', { ...sessionInput(session), version_id: id, options: input }), true); if (result.version_id !== id || result.comments.length + result.preferences.length > (input.limit ?? 25)) guestResponseInvalid(); return result; },
    async createComment(session, versionId, value, context) { const trace = mutation(context); const id = guestIdentifier(versionId); const input = parseGuestCommentCreate(value); const result = feedbackCommentDto(await rpc('create_comment', { ...sessionInput(session), version_id: id, input, idempotency_key: trace.idempotencyKey }), true); if (result.version_id !== id || result.version_slide_id !== input.version_slide_id) guestResponseInvalid(); return result; },
    async updateComment(session, id, value, context) { const trace = context ? mutation(context) : undefined; const result = feedbackCommentDto(await rpc('update_comment', { ...sessionInput(session), comment_id: guestIdentifier(id), input: parseGuestCommentPatch(value), ...(trace ? { idempotency_key: trace.idempotencyKey } : {}) }), true); if (result.id !== id) guestResponseInvalid(); return result; },
    async setPreference(session, versionId, value, context) { const trace = mutation(context); const input = parsePreferenceSet(value); const result = preferenceResultDto(await rpc('set_preference', { ...sessionInput(session), version_id: guestIdentifier(versionId), input, idempotency_key: trace.idempotencyKey })); if (result.preference && result.preference.version_slide_id !== input.version_slide_id) guestResponseInvalid(); return result; },
    async preparePdfExport(session, versionId, context) { const trace = mutation(context); const id = guestIdentifier(versionId); const result = exportPreparationDto(await rpc('prepare_export', { ...sessionInput(session), version_id: id, idempotency_key: trace.idempotencyKey })); if (result.export.version_id !== id) guestResponseInvalid(); return result; },
    async getPdfExport(session, id) { const result = presentationExportDto(await rpc('get_export', { ...sessionInput(session), export_id: guestIdentifier(id) })); if (result.id !== id) guestResponseInvalid(); return result; },
    async downloadPdfExport(session, id) { const access = await sessionData(session); const result = presentationExportDto(await rpc('get_export', { ...sessionInput(session), export_id: guestIdentifier(id) })); const source = await pdfAsset(session, id); if (result.status !== 'ready' || result.pdf_asset_id !== source.asset.id) guestResponseInvalid(); return { version_id: result.version_id, download_url: contentPath(config.origin, result.id, access.guest_session_id), expires_at: access.expires_at, filename: filename(result.version_id), size_bytes: source.asset.size_bytes }; },
    async playMedia(session, versionId, assetId) { const access = await sessionData(session); const source = await asset(session, versionId, assetId, 'video'); const url = new URL(`/api/v1/review/versions/${encodeURIComponent(versionId)}/media/${encodeURIComponent(assetId)}/content`, config.origin); url.searchParams.set('review_context', access.guest_session_id); return { asset_id: assetId, source_version_id: versionId, mime_type: source.asset.mime_type, url: url.href, expires_at: access.expires_at, transcript: versionTranscript(source.transcript, versionId, assetId) }; },
    async playGrantMedia(grant, versionId, assetId) { const source = await grantAsset(grant, versionId, assetId); if (!source.parent_expires_at) guestResponseInvalid(); return { asset_id: assetId, source_version_id: versionId, mime_type: source.asset.mime_type, url: new URL(`/api/v1/review-media/versions/${encodeURIComponent(versionId)}/media/${encodeURIComponent(assetId)}/content`, config.origin).href, expires_at: source.parent_expires_at, transcript: versionTranscript(source.transcript, versionId, assetId) }; },
    async getMediaContent(session, versionId, assetId, range) { const version = externalVersionDto(await rpc('get_version', { ...sessionInput(session), version_id: guestIdentifier(versionId) })); const purpose = version.slides.some(slide => slide.frame_asset_ids.includes(assetId)) ? 'frame' : version.slides.some(slide => slide.logo_asset_id === assetId) ? 'logo' : version.slides.some(slide => slide.video_asset_id === assetId) ? 'video' : null; if (!purpose) throw new DomainError('RESOURCE_NOT_FOUND', 'This media does not belong to the viewed version.', 404); return storage.read(await asset(session, versionId, assetId, purpose), range); },
    async getPdfExportContent(session, id, range) { return storage.read(await pdfAsset(session, id), range, `everyone-review-${guestIdentifier(id)}.pdf`); },
    async getGrantMediaContent(grant, versionId, assetId, range) { return storage.read(await grantAsset(grant, versionId, assetId), range); },
  };
}
