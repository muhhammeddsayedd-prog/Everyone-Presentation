import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { JobEvent, JobEventReceipt, JsonObject, StageLease } from '@eps/jobs';
import { parseRenderSnapshot, manifestFromSnapshot, presentationCanonicalHash } from '../../../packages/domain/src/presentation.ts';
import type { RenderSnapshot } from '../../../packages/domain/src/presentation-types.ts';
import { deliverCandidateCallback, CandidateCallbackError } from './candidate-callback.ts';
import { PresentationExecutionError } from './presentation-stage-executor.ts';
import { PresentationAssetError, type PresentationStageAssets } from './presentation-assets.ts';
import type { ReviewStageGateway, ReviewStageScope } from './review-stage-executor.ts';
import { PRESENTATION_PDF_LIMITS, PresentationPdfError, renderPresentationExportPdf, validatePresentationExportPdf } from './presentation-pdf.ts';

const keys = ['schema_version','workspace_id','series_id','version_id','export_id','review_link_id','export_revision','token_generation','snapshot_sha256','manifest_sha256','inventory_sha256','configuration','input_hash'];
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, fields: readonly string[]): v is Record<string, unknown> => object(v) && Object.keys(v).length === fields.length && fields.every(k => Object.hasOwn(v,k));
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(v);
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const positive = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
const sha = (v: Uint8Array) => createHash('sha256').update(v).digest('hex');
function fail(code: PresentationExecutionError['code']): never { throw new PresentationExecutionError(code); }
export interface PresentationExportGateway extends ReviewStageGateway { mintReviewMediaGrant?(scope: ReviewStageScope, signal: AbortSignal): Promise<unknown> }
export interface PresentationExportOptions {
  assets: PresentationStageAssets; signal?: AbortSignal; heartbeatMs?: number; gatewayTimeoutMs?: number;
  render?: typeof renderPresentationExportPdf; validate?: typeof validatePresentationExportPdf;
}
/** One fenced stage renders and validates the fixed snapshot. The sole bearer
 * response stays in this invocation; only private PDF bytes carry its URL. */
export async function executePresentationExportStage(supplied: StageLease, gateway: PresentationExportGateway, options: PresentationExportOptions) {
  let lease: StageLease; try { lease = structuredClone(supplied); } catch { return fail('INVALID_STAGE_SCOPE'); }
  if (!lease || !id(lease.job_id) || lease.stage !== 'render_export' || typeof lease.already_completed !== 'boolean') fail('INVALID_STAGE_SCOPE');
  if (lease.already_completed) return { already_completed: true as const, receipt: null };
  if (!id(lease.attempt_id) || !digest(lease.lease_token) || !Number.isFinite(Date.parse(lease.lease_expires_at)) || Date.parse(lease.lease_expires_at) <= Date.now()
    || !exact(lease.input,keys) || !digest(lease.input.input_hash) || !gateway.mintReviewMediaGrant) fail('INVALID_STAGE_SCOPE');
  const timeout = options.gatewayTimeoutMs ?? 15000; const heartbeat = options.heartbeatMs ?? 20000;
  if (!Number.isSafeInteger(timeout) || timeout < 10 || timeout > 15000 || !Number.isSafeInteger(heartbeat) || heartbeat < 10 || heartbeat > 20000) fail('INVALID_STAGE_SCOPE');
  const controller = new AbortController(); const signal = options.signal ? AbortSignal.any([options.signal,controller.signal]) : controller.signal;
  if (signal.aborted) fail('PROCESSING_CANCELLED');
  const scope = { job_id: lease.job_id, attempt_id: lease.attempt_id, lease_token: lease.lease_token };
  async function request<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const bounded = AbortSignal.any([signal,AbortSignal.timeout(timeout)]); let abort!: () => void;
    const stopped = new Promise<never>((_resolve,reject) => { abort=()=>reject(new PresentationExecutionError(options.signal?.aborted?'PROCESSING_CANCELLED':'STAGE_INPUT_INVALID')); bounded.addEventListener('abort',abort,{once:true}); if (bounded.aborted) abort(); });
    try { return await Promise.race([stopped,Promise.resolve().then(()=>bounded.aborted?stopped:work(bounded))]); } finally { bounded.removeEventListener('abort',abort); }
  }
  const input = await request(s => gateway.getInput(scope,s));
  if (!exact(input,[...keys,'job_id','attempt_id','stage','snapshot']) || input.job_id!==lease.job_id || input.attempt_id!==lease.attempt_id || input.stage!==lease.stage
    || keys.some(k=>!isDeepStrictEqual(input[k],lease.input[k])) || input.schema_version!=='1.0' || !['workspace_id','series_id','version_id','export_id','review_link_id'].every(k=>id(input[k]))
    || !positive(input.export_revision) || !positive(input.token_generation)) fail('STAGE_INPUT_INVALID');
  let snapshot: RenderSnapshot; try { snapshot=parseRenderSnapshot(input.snapshot); } catch { return fail('STAGE_INPUT_INVALID'); }
  if (snapshot.workspace_id!==input.workspace_id || snapshot.series_id!==input.series_id || snapshot.version_id!==input.version_id || !isDeepStrictEqual(input.configuration,snapshot.render_configuration)
    || input.snapshot_sha256!==await presentationCanonicalHash(snapshot) || input.manifest_sha256!==await presentationCanonicalHash(manifestFromSnapshot(snapshot))
    || input.inventory_sha256!==await presentationCanonicalHash(snapshot.asset_inventory) || input.input_hash!==await presentationCanonicalHash(Object.fromEntries(keys.filter(k=>k!=='input_hash').map(k=>[k,input[k]])))) fail('STAGE_INPUT_INVALID');
  let sequence=0; let deadline=Date.parse(lease.lease_expires_at); let timer: ReturnType<typeof setTimeout>|undefined; let stopping=false; let pending:Promise<void>=Promise.resolve(); let heartbeatFailure:unknown;
  async function publish(fields: Pick<JobEvent,'event_type'> & Partial<Pick<JobEvent,'result'|'result_schema'|'error'>>):Promise<JobEventReceipt> {
    const event:JobEvent={event_id:randomUUID(),...scope,stage:'render_export',input_hash:lease.input.input_hash as string,sequence:++sequence,...fields};
    try {const sent=await deliverCandidateCallback(event,gateway,{signal,timeoutMs:timeout,leaseDeadlineMs:deadline}); if(event.event_type==='heartbeat')deadline=Math.max(deadline,sent.firstSentAt+90000);return sent.receipt;} catch(error){return fail(error instanceof CandidateCallbackError?error.code:'CALLBACK_UNCONFIRMED');}
  }
  function beat(){if(stopping)return;timer=setTimeout(()=>{pending=publish({event_type:'heartbeat'}).then(()=>beat()).catch(error=>{heartbeatFailure=error;controller.abort();});},heartbeat);}
  async function stop(){stopping=true;clearTimeout(timer);await pending;if(heartbeatFailure)throw heartbeatFailure;}
  if(deadline-1000<=Date.now())fail('LEASE_STALE');beat();let result:JsonObject;
  try {
    const grant=await request(s=>gateway.mintReviewMediaGrant!(scope,s));
    if(!exact(grant,['grant_id','grant_token','version_id','review_link_id','export_id','export_revision','expires_at']) || !id(grant.grant_id) || typeof grant.grant_token!=='string' || !/^[A-Za-z0-9_-]{43}$/u.test(grant.grant_token)
      || grant.version_id!==input.version_id || grant.review_link_id!==input.review_link_id || grant.export_id!==input.export_id || grant.export_revision!==input.export_revision || typeof grant.expires_at!=='string' || !Number.isFinite(Date.parse(grant.expires_at)) || Date.parse(grant.expires_at)<=Date.now()) fail('STAGE_INPUT_INVALID');
    const images=new Map<string,Uint8Array>();let total=0;
    for(const asset of snapshot.asset_inventory.filter(a=>a.asset_kind!=='candidate_video')){total+=asset.byte_size;if(total>PRESENTATION_PDF_LIMITS.imageBytes)throw new PresentationPdfError('PDF_BUDGET_EXCEEDED');images.set(asset.asset_id,await options.assets.read(scope,asset,signal));}
    const access={version_id:snapshot.version_id,grant_token:grant.grant_token};
    const rendered=await(options.render??renderPresentationExportPdf)(snapshot,images,access,{signal});
    const validation=await(options.validate??validatePresentationExportPdf)(snapshot,images,rendered.bytes,access,{signal});
    const pdf=await options.assets.write(scope,{purpose:'presentation_pdf',bytes:rendered.bytes,sha256:sha(rendered.bytes)},signal);
    if(!exact(pdf,['asset_id','sha256','size_bytes','mime_type']) || !id(pdf.asset_id) || pdf.sha256!==sha(rendered.bytes) || pdf.size_bytes!==rendered.bytes.length || pdf.mime_type!=='application/pdf' || validation.pdf_sha256!==pdf.sha256) fail('STAGE_INPUT_INVALID');
    result={schema_version:'1.0',version_id:snapshot.version_id,export_id:input.export_id,review_link_id:input.review_link_id,export_revision:input.export_revision,grant_id:grant.grant_id,
      snapshot_sha256:input.snapshot_sha256,manifest_sha256:input.manifest_sha256,inventory_sha256:input.inventory_sha256,pdf_asset:{...pdf},render_proof:{...rendered.proof},validation_proof:{...validation}} as JsonObject;
  } catch(error) {
    await stop();if(signal.aborted)return fail(options.signal?.aborted?'PROCESSING_CANCELLED':'LEASE_STALE');
    const retryable=error instanceof PresentationAssetError?error.retryable:!(error instanceof PresentationPdfError)&&!(error instanceof PresentationExecutionError)||error instanceof PresentationPdfError&&error.code==='PDF_RENDER_FAILED';
    return {already_completed:false as const,receipt:await publish({event_type:'failed',error:{code:retryable?'DEPENDENCY_UNAVAILABLE':error instanceof PresentationPdfError&&error.code==='PDF_OVERFLOW'?'PDF_LAYOUT_OVERFLOW':'PDF_INVALID',message:'The fixed guest PDF could not be verified. Saved presentation content remains unchanged.',details:{},retryable}})};
  }
  await stop();if(signal.aborted)return fail(options.signal?.aborted?'PROCESSING_CANCELLED':'LEASE_STALE');
  return {already_completed:false as const,receipt:await publish({event_type:'succeeded',result_schema:'presentation-export-result.v1',result})};
}
