import { randomUUID, createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { JobEvent, JobEventReceipt, JsonObject, StageLease } from '@eps/jobs';
import type { RenderSnapshot } from '../../../packages/domain/src/presentation-types.ts';
import { parseRenderSnapshot, manifestFromSnapshot, presentationCanonicalHash, presentationCanonicalJson, reviewFromRenderSnapshot } from '../../../packages/domain/src/presentation.ts';
import { editorialExpectations, isEditorialTemplate } from './editorial-template.ts';
import { CandidateCallbackError, deliverCandidateCallback } from './candidate-callback.ts';
import type { ReviewStageGateway, ReviewStageScope } from './review-stage-executor.ts';
import { PresentationAssetError, type PresentationArtifact, type PresentationStageAssets } from './presentation-assets.ts';
import { PRESENTATION_RENDERER, PRESENTATION_PDF_LIMITS, PresentationPdfError, preparePresentationAssets, renderPresentationPdf, validatePresentationPdf, presentationVideoHref, type PresentationRenderProof, type PresentationValidationProof } from './presentation-pdf.ts';

const stages = ['prepare_presentation', 'render_presentation', 'validate_presentation', 'publish_presentation'];
const keys = ['schema_version', 'workspace_id', 'series_id', 'version_id', 'snapshot_sha256', 'manifest_sha256', 'inventory_sha256', 'configuration', 'input_hash'];
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, fields: readonly string[]): value is Record<string, unknown> => object(value) && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key));
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(value);
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const integer = (value: unknown, minimum = 0, maximum = 100000) => Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
const time = (value: unknown) => typeof value === 'string' && value.length <= 50 && Number.isFinite(Date.parse(value));
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export class PresentationExecutionError extends Error { constructor(readonly code: 'INVALID_STAGE_SCOPE' | 'STAGE_INPUT_INVALID' | 'CALLBACK_UNCONFIRMED' | 'LEASE_STALE' | 'PROCESSING_CANCELLED') { super('The fixed presentation attempt could not be confirmed. Durable state determines recovery.'); this.name = 'PresentationExecutionError'; } }
function fail(code: PresentationExecutionError['code']): never { throw new PresentationExecutionError(code); }
export interface PresentationPrepared { schema_version: '1.0'; version_id: string; snapshot_sha256: string; manifest_sha256: string; inventory_sha256: string; template_content_sha256: string; font_hashes: Record<string, string>; renderer_version: typeof PRESENTATION_RENDERER; prepared_at: string }
export interface PresentationRendered { schema_version: '1.0'; version_id: string; snapshot_sha256: string; manifest_sha256: string; inventory_sha256: string; manifest_asset: PresentationArtifact; pdf_asset: PresentationArtifact; proof: PresentationRenderProof }
export interface PresentationValidated { schema_version: '1.0'; version_id: string; snapshot_sha256: string; manifest_sha256: string; inventory_sha256: string; manifest_asset: PresentationArtifact; pdf_asset: PresentationArtifact; proof: PresentationValidationProof }
export interface PresentationStageOptions { assets: PresentationStageAssets; signal?: AbortSignal; heartbeatMs?: number; gatewayTimeoutMs?: number; prepare?: typeof preparePresentationAssets; render?: typeof renderPresentationPdf; validate?: typeof validatePresentationPdf }
function artifact(value: unknown, mime: 'application/json' | 'application/pdf'): PresentationArtifact {
  if (!exact(value, ['asset_id', 'sha256', 'size_bytes', 'mime_type']) || !id(value.asset_id) || !digest(value.sha256) || value.mime_type !== mime || !integer(value.size_bytes, 1, mime === 'application/pdf' ? 67108864 : 8388608)) fail('STAGE_INPUT_INVALID');
  return value as unknown as PresentationArtifact;
}
/** Template-specific proof expectations: 1.0/1.1 fixed rules, 1.2.0 from the shared composer. */
function expectedLayout(snapshot: RenderSnapshot) {
  if (isEditorialTemplate(snapshot.template)) return editorialExpectations(reviewFromRenderSnapshot(snapshot));
  const frames = snapshot.slides.reduce((sum, slide) => sum + slide.frames.length, 0); const logos = snapshot.slides.filter(slide => slide.logo_asset_id).length;
  return { page_count: snapshot.slides.length, width: 1600, height: 900, width_points: 1200, height_points: 675, frame_draw_count: frames, logo_draw_count: logos, image_draws: frames + logos,
    text_regions: 3 + snapshot.slides.filter(slide => slide.kind === 'candidate').length * 23 + snapshot.slides.filter(slide => slide.kind === 'pending').length * (snapshot.template.version === '1.1.0' ? 27 : 4) };
}
function bound(value: Record<string, unknown>, input: Record<string, unknown>) { if (value.schema_version !== '1.0' || ['version_id', 'snapshot_sha256', 'manifest_sha256', 'inventory_sha256'].some(key => value[key] !== input[key])) fail('STAGE_INPUT_INVALID'); }
function prepared(value: unknown, input: Record<string, unknown>, snapshot: RenderSnapshot): PresentationPrepared {
  if (!exact(value, ['schema_version', 'version_id', 'snapshot_sha256', 'manifest_sha256', 'inventory_sha256', 'template_content_sha256', 'font_hashes', 'renderer_version', 'prepared_at'])) fail('STAGE_INPUT_INVALID');
  bound(value, input); if (value.template_content_sha256 !== snapshot.template.content_sha256 || value.renderer_version !== PRESENTATION_RENDERER || !isDeepStrictEqual(value.font_hashes, snapshot.template.font_hashes) || !time(value.prepared_at)) fail('STAGE_INPUT_INVALID'); return value as unknown as PresentationPrepared;
}
async function rendered(value: unknown, input: Record<string, unknown>, snapshot: RenderSnapshot): Promise<PresentationRendered> {
  if (!exact(value, ['schema_version', 'version_id', 'snapshot_sha256', 'manifest_sha256', 'inventory_sha256', 'manifest_asset', 'pdf_asset', 'proof'])) fail('STAGE_INPUT_INVALID'); bound(value, input);
  const manifest = artifact(value.manifest_asset, 'application/json'); const pdf = artifact(value.pdf_asset, 'application/pdf'); if (manifest.asset_id === pdf.asset_id || manifest.sha256 !== input.manifest_sha256) fail('STAGE_INPUT_INVALID');
  const proof = value.proof; const editorial = expectedLayout(snapshot);
  if (!exact(proof, ['renderer_version', 'chromium_version', 'template_content_sha256', 'font_hashes', 'page_count', 'width_css_px', 'height_css_px', 'overflow_count', 'candidate_field_count', 'frame_draw_count', 'logo_draw_count', 'video_link_count', 'fonts_ready', 'images_ready', 'link_targets_sha256', 'rendered_at'])
    || proof.renderer_version !== PRESENTATION_RENDERER || typeof proof.chromium_version !== 'string' || !/^[0-9]+(?:\.[0-9]+){2,3}$/u.test(proof.chromium_version) || proof.template_content_sha256 !== snapshot.template.content_sha256 || !isDeepStrictEqual(proof.font_hashes, snapshot.template.font_hashes)
    || proof.page_count !== editorial.page_count || proof.width_css_px !== editorial.width || proof.height_css_px !== editorial.height || proof.overflow_count !== 0 || proof.candidate_field_count !== snapshot.slides.filter(slide => slide.kind === 'candidate').length * 10
    || proof.frame_draw_count !== editorial.frame_draw_count || proof.logo_draw_count !== editorial.logo_draw_count || proof.video_link_count !== snapshot.slides.filter(slide => slide.video_asset_id).length || proof.fonts_ready !== true || proof.images_ready !== true
    || proof.link_targets_sha256 !== await presentationCanonicalHash(snapshot.slides.flatMap(slide => slide.video_asset_id ? [presentationVideoHref(snapshot, slide.video_asset_id)] : [])) || !time(proof.rendered_at)) fail('STAGE_INPUT_INVALID');
  return value as unknown as PresentationRendered;
}
function validated(value: unknown, input: Record<string, unknown>, snapshot: RenderSnapshot, source: PresentationRendered): PresentationValidated {
  if (!exact(value, ['schema_version', 'version_id', 'snapshot_sha256', 'manifest_sha256', 'inventory_sha256', 'manifest_asset', 'pdf_asset', 'proof'])) fail('STAGE_INPUT_INVALID'); bound(value, input);
  if (!isDeepStrictEqual(value.manifest_asset, source.manifest_asset) || !isDeepStrictEqual(value.pdf_asset, source.pdf_asset)) fail('STAGE_INPUT_INVALID');
  const proof = value.proof; const layout = expectedLayout(snapshot);
  if (!exact(proof, ['pdf_sha256', 'page_count', 'width_points', 'height_points', 'text_regions_checked', 'image_draws_checked', 'video_links_checked', 'embedded_font_count', 'validated_at']) || proof.pdf_sha256 !== source.pdf_asset.sha256 || proof.page_count !== layout.page_count
    || typeof proof.width_points !== 'number' || !Number.isFinite(proof.width_points) || Math.abs(proof.width_points - layout.width_points) > 0.5 || typeof proof.height_points !== 'number' || !Number.isFinite(proof.height_points) || Math.abs(proof.height_points - layout.height_points) > 0.5
    || proof.text_regions_checked !== layout.text_regions || proof.image_draws_checked !== layout.image_draws || proof.video_links_checked !== source.proof.video_link_count || !integer(proof.embedded_font_count, 1, 6000) || !time(proof.validated_at)) fail('STAGE_INPUT_INVALID');
  return value as unknown as PresentationValidated;
}
export async function executePresentationStage(supplied: StageLease, gateway: ReviewStageGateway, options: PresentationStageOptions) {
  let lease: StageLease; try { lease = structuredClone(supplied); } catch { return fail('INVALID_STAGE_SCOPE'); }
  if (!lease || !id(lease.job_id) || !stages.includes(lease.stage) || typeof lease.already_completed !== 'boolean') fail('INVALID_STAGE_SCOPE');
  if (lease.already_completed) return { already_completed: true as const, receipt: null };
  if (!id(lease.attempt_id) || !digest(lease.lease_token) || !time(lease.lease_expires_at) || Date.parse(lease.lease_expires_at) <= Date.now() || !exact(lease.input, keys) || !digest(lease.input.input_hash)) fail('INVALID_STAGE_SCOPE');
  const timeoutMs = options.gatewayTimeoutMs ?? 15000; const heartbeatMs = options.heartbeatMs ?? 20000;
  if (!integer(timeoutMs, 10, 15000) || !integer(heartbeatMs, 10, 20000)) fail('INVALID_STAGE_SCOPE');
  const controller = new AbortController(); const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  if (signal.aborted) fail('PROCESSING_CANCELLED'); const scope: ReviewStageScope = { job_id: lease.job_id, attempt_id: lease.attempt_id, lease_token: lease.lease_token };
  const request = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]); let abort!: () => void; const stopped = new Promise<never>((_resolve, reject) => { abort = () => reject(new PresentationExecutionError(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'STAGE_INPUT_INVALID')); request.addEventListener('abort', abort, { once: true }); if (request.aborted) abort(); });
  let input: unknown; try { input = await Promise.race([stopped, Promise.resolve().then(() => request.aborted ? stopped : gateway.getInput(scope, request))]); } catch { return fail(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'STAGE_INPUT_INVALID'); } finally { request.removeEventListener('abort', abort); }
  if (!exact(input, [...keys, 'job_id', 'attempt_id', 'stage', 'snapshot', 'prepared', 'rendered', 'validated']) || input.job_id !== lease.job_id || input.attempt_id !== lease.attempt_id || input.stage !== lease.stage || keys.some(key => !isDeepStrictEqual(input[key], lease.input[key])) || input.schema_version !== '1.0' || !id(input.workspace_id) || !id(input.series_id) || !id(input.version_id)) fail('STAGE_INPUT_INVALID');
  let snapshot: RenderSnapshot; try { snapshot = parseRenderSnapshot(input.snapshot); } catch { return fail('STAGE_INPUT_INVALID'); }
  const manifestBytes = new TextEncoder().encode(presentationCanonicalJson(manifestFromSnapshot(snapshot)));
  if (snapshot.version_id !== input.version_id || snapshot.series_id !== input.series_id || snapshot.workspace_id !== input.workspace_id || !isDeepStrictEqual(input.configuration, snapshot.render_configuration)
    || input.snapshot_sha256 !== await presentationCanonicalHash(snapshot) || input.manifest_sha256 !== sha(manifestBytes) || input.inventory_sha256 !== await presentationCanonicalHash(snapshot.asset_inventory)
    || input.input_hash !== await presentationCanonicalHash(Object.fromEntries(keys.filter(key => key !== 'input_hash').map(key => [key, input[key]])))) fail('STAGE_INPUT_INVALID');
  const index = stages.indexOf(lease.stage);
  if (index < 1 ? input.prepared !== null : !prepared(input.prepared, input, snapshot)) fail('STAGE_INPUT_INVALID');
  let source: PresentationRendered | undefined; if (index < 2 ? input.rendered !== null : !(source = await rendered(input.rendered, input, snapshot))) fail('STAGE_INPUT_INVALID');
  if (index < 3 ? input.validated !== null : !validated(input.validated, input, snapshot, source!)) fail('STAGE_INPUT_INVALID');
  let sequence = 0; let deadline = Date.parse(lease.lease_expires_at); let stopping = false; let timer: ReturnType<typeof setTimeout> | undefined; let pending: Promise<void> = Promise.resolve(); let heartbeatError: unknown;
  async function publish(fields: Pick<JobEvent, 'event_type'> & Partial<Pick<JobEvent, 'result_schema' | 'result' | 'error'>>): Promise<JobEventReceipt> {
    const event: JobEvent = { event_id: randomUUID(), ...scope, stage: lease.stage, input_hash: lease.input.input_hash as string, sequence: ++sequence, ...fields };
    try { const sent = await deliverCandidateCallback(event, gateway, { signal, timeoutMs, leaseDeadlineMs: deadline }); if (event.event_type === 'heartbeat') deadline = Math.max(deadline, sent.firstSentAt + 90000); return sent.receipt; } catch (error) { if (error instanceof CandidateCallbackError) return fail(error.code); return fail('CALLBACK_UNCONFIRMED'); }
  }
  function beat() { if (stopping) return; timer = setTimeout(() => { pending = publish({ event_type: 'heartbeat' }).then(() => { beat(); }).catch(error => { heartbeatError = error; controller.abort(); }); }, heartbeatMs); }
  async function stop() { stopping = true; clearTimeout(timer); await pending; if (heartbeatError) throw heartbeatError; }
  async function images() { const result = new Map<string, Uint8Array>(); let total = 0; for (const asset of snapshot.asset_inventory.filter(asset => asset.asset_kind !== 'candidate_video')) { total += asset.byte_size; if (total > PRESENTATION_PDF_LIMITS.imageBytes) throw new PresentationPdfError('PDF_BUDGET_EXCEEDED'); result.set(asset.asset_id, await options.assets.read(scope, asset, signal)); } return result; }
  if (deadline - 1000 <= Date.now()) fail('LEASE_STALE'); beat(); let result: unknown;
  try {
    const binding = { schema_version: '1.0' as const, version_id: snapshot.version_id, snapshot_sha256: input.snapshot_sha256 as string, manifest_sha256: input.manifest_sha256 as string, inventory_sha256: input.inventory_sha256 as string };
    if (index === 0) { await (options.prepare ?? preparePresentationAssets)(snapshot, await images(), { signal }); result = prepared({ ...binding, template_content_sha256: snapshot.template.content_sha256, font_hashes: snapshot.template.font_hashes, renderer_version: PRESENTATION_RENDERER, prepared_at: new Date().toISOString() }, input, snapshot); }
    else if (index === 1) {
      const output = await (options.render ?? renderPresentationPdf)(snapshot, await images(), { signal });
      const manifest_asset = await options.assets.write(scope, { purpose: 'presentation_manifest', bytes: manifestBytes, sha256: sha(manifestBytes) }, signal);
      const pdf_asset = await options.assets.write(scope, { purpose: 'presentation_pdf', bytes: output.bytes, sha256: sha(output.bytes) }, signal);
      result = await rendered({ ...binding, manifest_asset, pdf_asset, proof: output.proof }, input, snapshot);
    } else if (index === 2) {
      const manifest = await options.assets.read(scope, source!.manifest_asset, signal); const pdf = await options.assets.read(scope, source!.pdf_asset, signal);
      if (!Buffer.from(manifest).equals(Buffer.from(manifestBytes)) || sha(pdf) !== source!.pdf_asset.sha256 || pdf.byteLength !== source!.pdf_asset.size_bytes) fail('STAGE_INPUT_INVALID');
      const proof = await (options.validate ?? validatePresentationPdf)(snapshot, await images(), pdf, { signal }); result = validated({ ...binding, manifest_asset: source!.manifest_asset, pdf_asset: source!.pdf_asset, proof }, input, snapshot, source!);
    } else result = { version_id: snapshot.version_id, manifest_asset_id: source!.manifest_asset.asset_id, pdf_asset_id: source!.pdf_asset.asset_id, pdf_sha256: source!.pdf_asset.sha256, page_count: expectedLayout(snapshot).page_count, template_version: snapshot.template.version, validation_passed: true, overflow_count: 0, renderer_build: PRESENTATION_RENDERER };
  } catch (error) {
    await stop(); if (signal.aborted) return fail(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'LEASE_STALE'); if (error instanceof PresentationExecutionError) throw error;
    const retryable = error instanceof PresentationAssetError ? error.retryable : !(error instanceof PresentationPdfError) || error.code === 'PDF_RENDER_FAILED';
    const code = retryable ? 'DEPENDENCY_UNAVAILABLE' : error instanceof PresentationAssetError ? 'PDF_SOURCE_UNAVAILABLE' : error instanceof PresentationPdfError
      ? ({ PDF_OVERFLOW: 'PDF_LAYOUT_OVERFLOW', PDF_TEMPLATE_MISMATCH: 'PDF_TEMPLATE_UNAVAILABLE', PDF_ASSET_INVALID: 'PDF_SOURCE_UNAVAILABLE', PDF_VALIDATION_FAILED: 'PDF_INVALID', PDF_BUDGET_EXCEEDED: 'PDF_BUDGET_EXCEEDED' } as Partial<Record<PresentationPdfError['code'], string>>)[error.code] ?? 'PROCESSING_FAILED' : 'PROCESSING_FAILED';
    return { already_completed: false as const, receipt: await publish({ event_type: 'failed', error: { code, message: 'The fixed presentation could not be rendered and verified. Previous ready versions remain available.', details: {}, retryable } }) };
  }
  await stop(); if (signal.aborted) return fail(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'LEASE_STALE');
  return { already_completed: false as const, receipt: await publish({ event_type: 'succeeded', result_schema: ['presentation-preparation.v1', 'presentation-rendering.v1', 'presentation-validation.v1', 'presentation-render-result.v1'][index], result: result as JsonObject }) };
}
