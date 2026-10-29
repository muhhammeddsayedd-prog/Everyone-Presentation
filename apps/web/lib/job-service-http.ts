import { createHash, timingSafeEqual } from 'node:crypto';
import { DomainError } from '@eps/domain';
import type { JobEvent, StageClaim } from '@eps/jobs';
import { SpecsRuntimeGatewayError, type SpecsRuntimeGateway } from '@eps/central/specs-runtime';
import { failure, json, readBoundedBody } from './http';
import { validateContract } from './validation';

export interface JobServiceConfiguration { bearer: string; keyId: string; encryptionKey: string; baseUrl: string }
export function readJobServiceConfiguration(env: Readonly<Record<string,string | undefined>>): JobServiceConfiguration {
  const baseUrl = env.APP_BASE_URL ?? '';
  let url: URL; try { url = new URL(baseUrl); } catch { throw new DomainError('DEPENDENCY_UNAVAILABLE','Local job service is not configured.',503); }
  if (env.CENTRAL_ADAPTER_MODE !== 'supabase' || !['development','test'].includes(env.APP_ENV ?? 'development')
    || env.NODE_ENV === 'production' || url.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname)
    || !/^[A-Za-z0-9_-]{43}$/u.test(env.EPS_JOB_SERVICE_BEARER ?? '')
    || !/^[A-Za-z0-9._-]{1,64}$/u.test(env.EPS_JOB_CLAIM_KEY_ID ?? '') || !/^[a-f0-9]{64}$/u.test(env.EPS_JOB_CLAIM_KEY_HEX ?? '')
    || env.EPS_JOB_SERVICE_BEARER === env.N8N_DISPATCH_SECRET) {
    throw new DomainError('DEPENDENCY_UNAVAILABLE','Local job service is not configured.',503);
  }
  return { bearer: env.EPS_JOB_SERVICE_BEARER!, keyId: env.EPS_JOB_CLAIM_KEY_ID!, encryptionKey: env.EPS_JOB_CLAIM_KEY_HEX!, baseUrl: url.origin };
}
function authenticate(request: Request, config: JobServiceConfiguration) {
  const authorization = request.headers.get('authorization') ?? '';
  if (request.headers.get('host') !== new URL(config.baseUrl).host || request.headers.has('origin') || request.headers.has('cookie')
    || !/^Bearer [A-Za-z0-9_-]{43}$/u.test(authorization)
    || !timingSafeEqual(createHash('sha256').update(authorization.slice(7)).digest(),createHash('sha256').update(config.bearer).digest())) {
    throw new DomainError('AUTH_REQUIRED','Use the dedicated job-service credential.',401);
  }
}
export type JobServicePort = Pick<SpecsRuntimeGateway,'claimWithReplay'|'recordEvent'|'files'|'candidateFiles'|'getInput'>;
export async function handleServiceJobRequest(request: Request, segments: string[], config: JobServiceConfiguration,
  gatewayFactory: () => Promise<JobServicePort>, requestId: string) {
  try {
    authenticate(request,config);
    if (request.method !== 'POST' || new URL(request.url).search || segments.length < 1 || segments.length > 2) {
      throw new DomainError('RESOURCE_NOT_FOUND','This service operation is unavailable.',404);
    }
    const operation = segments.join('/');
    if (!['claim','events','complete','fail','outputs','outputs/complete','assets/access'].includes(operation)) {
      throw new DomainError('RESOURCE_NOT_FOUND','This service operation is unavailable.',404);
    }
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new DomainError('INVALID_REQUEST','Use application/json.',400);
    let body: unknown;
    try { body = JSON.parse(new TextDecoder('utf-8',{ fatal:true }).decode(await readBoundedBody(request,384*1024))); }
    catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('INVALID_REQUEST','Malformed service JSON.',400); }
    const key = request.headers.get('Idempotency-Key');
    if (!key || !/^[A-Za-z0-9._:-]{16,200}$/u.test(key)) throw new DomainError('INVALID_REQUEST','Use a stable Idempotency-Key for this service intent.',400);
    if (operation === 'claim') {
      const input = validateContract<StageClaim>('ServiceStageClaim',body);
      return json(await (await gatewayFactory()).claimWithReplay(input,key,request.signal),requestId);
    }
    if (['events','complete','fail'].includes(operation)) {
      const event = validateContract<JobEvent>('JobEvent',body);
      // Event IDs already have a database-backed exact-payload replay/fence.
      if (key !== event.event_id || operation === 'complete' && event.event_type !== 'succeeded'
        || operation === 'fail' && event.event_type !== 'failed'
        || operation === 'events' && !['heartbeat','progress'].includes(event.event_type)) {
        throw new DomainError('INVALID_REQUEST','Match the event type to its callback and reuse event_id as Idempotency-Key.',400);
      }
      return json(await (await gatewayFactory()).recordEvent(event,request.signal),requestId);
    }
    const schema = operation === 'outputs' ? 'JobOutputReservation' : operation === 'outputs/complete' ? 'JobOutputComplete' : 'JobAssetAccess';
    const input = validateContract(schema,body);
    const gateway = await gatewayFactory();
    const scope=input as { job_id:string;attempt_id:string;lease_token:string };
    const scopedInput=await gateway.getInput({job_id:scope.job_id,attempt_id:scope.attempt_id,lease_token:scope.lease_token},request.signal);
    const stage=scopedInput!==null&&typeof scopedInput==='object'&&'stage' in scopedInput?String(scopedInput.stage):'';
    const candidate=['prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate'].includes(stage);
    if(candidate){
      if(!gateway.candidateFiles)throw new DomainError('DEPENDENCY_UNAVAILABLE','Private candidate assets are not configured.',503);
      if(operation==='outputs')return json(await gateway.candidateFiles.reserveOutput(input as Parameters<NonNullable<JobServicePort['candidateFiles']>['reserveOutput']>[0],request.signal),requestId,201);
      if(operation==='outputs/complete')return json(await gateway.candidateFiles.completeOutput(input as Parameters<NonNullable<JobServicePort['candidateFiles']>['completeOutput']>[0],request.signal),requestId);
      return json(await gateway.candidateFiles.getAssetAccess(input as Parameters<NonNullable<JobServicePort['candidateFiles']>['getAssetAccess']>[0],request.signal),requestId);
    }
    if (!gateway.files) throw new DomainError('DEPENDENCY_UNAVAILABLE','Private job assets are not configured.',503);
    if (operation === 'outputs') return json(await gateway.files.reserveOutput(input as Parameters<NonNullable<JobServicePort['files']>['reserveOutput']>[0],request.signal),requestId,201);
    if (operation === 'outputs/complete') return json(await gateway.files.completeOutput(input as Parameters<NonNullable<JobServicePort['files']>['completeOutput']>[0],request.signal),requestId);
    return json(await gateway.files.getAssetAccess(input as Parameters<NonNullable<JobServicePort['files']>['getAssetAccess']>[0],request.signal),requestId);
  } catch (error) {
    if (error instanceof SpecsRuntimeGatewayError) return failure(new DomainError(error.code,'The scoped job-service operation could not be completed.',error.status,{},false),requestId);
    return failure(error,requestId);
  }
}
