/** Prepared root-reviewed fallback: exactly two metadata-only GETs, no retries.
 * Importing is inert; it never reads credentials or calls a provider. */
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { loadWorkerPrivateEnvironment } from '../../../tools/worker-private-env.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../..');
export const CASES = Object.freeze([
  Object.freeze({ case_alias:'prior_failed_nonprotected_render',job_id:'7ca22801-2040-40df-87fc-84a82fffb6c7',execution_id:'31520',workflow_id:'kE4qSEcugaKhIoJU' }),
  Object.freeze({ case_alias:'prior_successful_candidate_scan',job_id:'fa8593ca-80c2-4cb3-8bcc-0e357ffbf7f2',execution_id:'31515',workflow_id:'gfhxzvSkprS2CI4o' }),
]);
const PINS = Object.freeze({
  'tools/worker-private-env.mjs':'ef935580876c9150b8150947c3796dd4760d1ad2910bc3bf322dd5015eea4d79',
  'tracking/evidence/m07/controlled-pilot/2026-10-31-hosted-selection-failure.json':'3954163631c679339bc0c8debc3baa41867eef63660a9e677ae342eb0c98ef24',
  'tracking/evidence/m07/operator-trace/2026-10-31T14-25-58-545789Z-f91a4e59-job-trace.json':'1ce8b161d3edea78e8c3eed1df8ddbc0f646cd858921d381303678ce6f50e8c6',
});
const need = value => { if (!value) throw new Error('N8N_EXECUTION_METADATA_UNCONFIRMED'); };
const sha = value => createHash('sha256').update(value).digest('hex');
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const statuses = new Set(['canceled','crashed','error','new','running','success','unknown','waiting']);
const modes = new Set(['cli','error','integrated','internal','manual','retry','trigger','webhook','evaluation','chat','agent']);
const time = value => value === null || typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/u.test(value) && Number.isFinite(Date.parse(value));
const executionId = value => value === null || typeof value === 'string' && /^[1-9][0-9]{0,15}$/u.test(value);

export function metadataProjection(value, expected) {
  need(record(value) && !['data','workflowData','customData'].some(key => Object.hasOwn(value,key)));
  need(value.id === expected.execution_id && value.workflowId === expected.workflow_id && statuses.has(value.status) && modes.has(value.mode));
  need(['startedAt','stoppedAt','waitTill'].every(key => time(value[key])) && executionId(value.retryOf) && executionId(value.retrySuccessId));
  const result = { id:value.id,workflow_id:value.workflowId,status:value.status,mode:value.mode,started_at:value.startedAt,stopped_at:value.stoppedAt,
    wait_till:value.waitTill,retry_of:value.retryOf,retry_success_id:value.retrySuccessId };
  // Never return arbitrary top-level metadata, tracing headers or error text.
  if (typeof value.workflowVersionId === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u.test(value.workflowVersionId)) result.workflow_version_id=value.workflowVersionId;
  return result;
}

export async function inspectExecution(config, expected, fetchImpl=globalThis.fetch) {
  const out = { ...expected,method:'GET',includeData:false,automatic_retry:false,metadata_returned:false,http_status:null };
  try {
    const response = await fetchImpl(config.N8N_BASE_URL + '/api/v1/executions/' + expected.execution_id + '?includeData=false',
      {method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal:globalThis.AbortSignal.timeout(15000),
        headers:{'X-N8N-API-KEY':config.N8N_API_KEY,Accept:'application/json'}});
    out.http_status=response.status;
    if (!response.ok) {
      await response.body?.cancel().catch(()=>undefined);
      out.safe_error_class=response.status===404?'EXECUTION_NOT_FOUND':response.status===401||response.status===403?'N8N_ACCESS_DENIED':response.status===429?'N8N_RATE_LIMITED':response.status>=500?'N8N_UNAVAILABLE':'N8N_REQUEST_REFUSED';
      return out;
    }
    need(response.status===200 && response.body);
    const reader=response.body.getReader(),chunks=[];let bytes=0;
    try { for (;;) { const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;need(bytes<=65536);chunks.push(part.value); } }
    catch(error) { await reader.cancel().catch(()=>undefined);throw error; }
    finally { reader.releaseLock(); }
    const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    out.metadata=metadataProjection(value,expected);out.metadata_returned=true;
  } catch { out.safe_error_class='N8N_METADATA_UNCONFIRMED'; }
  return out;
}

async function pinned(relative,digest) {
  const target=path.join(ROOT,relative),info=await lstat(target);
  need(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&path.resolve(await realpath(target)).toLowerCase()===target.toLowerCase());
  need(sha(await readFile(target))===digest);
}

async function main() {
  need(process.argv.length===2 && !['NODE_OPTIONS','NODE_DEBUG','NODE_TLS_REJECT_UNAUTHORIZED','NODE_EXTRA_CA_CERTS'].some(key=>process.env[key]));
  for(const [relative,digest]of Object.entries(PINS))await pinned(relative,digest);
  const privateDirectory=path.join(ROOT,'.local/m03-english-component');need(path.resolve(await realpath(privateDirectory)).toLowerCase()===privateDirectory.toLowerCase());
  const observed=new Date().toISOString();
  await writeFile(path.join(privateDirectory,'at074-execution-metadata.claim.json'),JSON.stringify({observed_at:observed,purpose:'read-two-retained-executions-metadata-only',maximum_get_requests:2,automatic_retry:false,source_pins:PINS}),{flag:'wx',mode:0o600});
  // Existing fixed local file only; no ambient credential or base-URL override.
  const loaded=await loadWorkerPrivateEnvironment({environment:{}});
  need(loaded.N8N_API_KEY && loaded.N8N_BASE_URL);
  const config={N8N_API_KEY:loaded.N8N_API_KEY,N8N_BASE_URL:loaded.N8N_BASE_URL};
  const observations=[];for(const expected of CASES)observations.push(await inspectExecution(config,expected));
  const report={schema_version:'1.0',evidence_kind:'actual_direct_n8n_metadata_only_retained_execution_read',observed_at:observed,
    source_pins:PINS,configured_origin_sha256:sha(config.N8N_BASE_URL),ambient_overrides_used:false,maximum_get_requests:2,automatic_retry:false,
    observations,node_payloads_requested:false,raw_provider_bodies_persisted:false,credentials_or_private_urls_recorded:false,
    workflow_edits_or_execution_or_retry_performed:false,AT074_status:'partial_no_complete_end_to_end_acceptance',
    note:'Historical failed render was later recovered; no current failed state or detailed cause is inferred from execution metadata. New English job correlation is separate.'};
  const folder=path.join(ROOT,'tracking/evidence/m07/operator-trace-live34');await mkdir(folder,{recursive:true});
  const file=path.join(folder,observed.replaceAll(':','-')+'-direct-metadata.json');await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify({receipt:path.relative(ROOT,file).replaceAll('\\','/'),metadata_returned:observations.filter(value=>value.metadata_returned).length,http_statuses:observations.map(value=>value.http_status),AT074_status:report.AT074_status})+'\n');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stdout.write('N8N_EXECUTION_METADATA_UNCONFIRMED\n');process.exitCode=1;});
