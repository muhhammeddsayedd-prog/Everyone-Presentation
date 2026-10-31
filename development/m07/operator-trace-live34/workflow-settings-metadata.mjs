/** Fixed WF02 configuration metadata fallback; import/tests perform no private IO. */
import {createHash} from 'node:crypto';
import {lstat,readFile,realpath,writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {pathToFileURL} from 'node:url';
import {loadWorkerPrivateEnvironment} from '../../../tools/worker-private-env.mjs';

const ROOT=path.resolve(import.meta.dirname,'../../..');
export const WORKFLOW_ID='gfhxzvSkprS2CI4o';
export const PINS=Object.freeze({
 'tools/worker-private-env.mjs':'ef935580876c9150b8150947c3796dd4760d1ad2910bc3bf322dd5015eea4d79',
 'tracking/evidence/m07/operator-trace-live34/2026-10-31T18-27-47.200Z-fresh-execution-metadata.json':'df0f05a8227102ce7583c6fe9f544fc1c6cb8ef07e4347839a4608284f289d62',
});
const need=v=>{if(!v)throw Error('WF02_SETTINGS_METADATA_UNCONFIRMED');};
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const sha=v=>createHash('sha256').update(v).digest('hex');
const version=v=>v===undefined||v===null?null:(need(typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u.test(v)),v);
const saved=v=>v===undefined?null:(need(v==='none'||v==='all'),v);
const flag=v=>v===undefined?null:(need(typeof v==='boolean'),v);

/** Select only closed privacy-setting metadata; never return graph or arbitrary settings. */
export function workflowProjection(value){
 need(record(value)&&value.id===WORKFLOW_ID&&typeof value.active==='boolean');
 const settings=value.settings===undefined?{}:value.settings;need(record(settings));
 return {id:WORKFLOW_ID,active:value.active,version_id:version(value.versionId),active_version_id:version(value.activeVersionId),
  settings:{saveDataSuccessExecution:saved(settings.saveDataSuccessExecution),saveDataErrorExecution:saved(settings.saveDataErrorExecution),
   saveManualExecutions:flag(settings.saveManualExecutions),saveExecutionProgress:flag(settings.saveExecutionProgress)}};
}
export async function inspectWorkflow(config,fetchImpl=globalThis.fetch){
 const out={workflow_id:WORKFLOW_ID,method:'GET',automatic_retry:false,http_status:null,metadata_returned:false};
 try{
  const response=await fetchImpl(config.N8N_BASE_URL+'/api/v1/workflows/'+WORKFLOW_ID,
   {method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal:globalThis.AbortSignal.timeout(15000),
    headers:{'X-N8N-API-KEY':config.N8N_API_KEY,Accept:'application/json'}});
  out.http_status=response.status;
  if(!response.ok){await response.body?.cancel().catch(()=>undefined);out.safe_error_class=response.status===404?'WORKFLOW_NOT_FOUND':
   response.status===401||response.status===403?'N8N_ACCESS_DENIED':response.status===429?'N8N_RATE_LIMITED':response.status>=500?'N8N_UNAVAILABLE':'N8N_REQUEST_REFUSED';return out;}
  need(response.status===200&&response.body);
  const reader=response.body.getReader(),chunks=[];let total=0;
  try{for(;;){const item=await reader.read();if(item.done)break;total+=item.value.byteLength;need(total<=131072);chunks.push(item.value);}}
  catch(error){await reader.cancel().catch(()=>undefined);throw error;}finally{reader.releaseLock();}
  // Raw response/graph exists only in RAM and is never included in the receipt.
  out.metadata=workflowProjection(JSON.parse(Buffer.concat(chunks).toString('utf8')));out.metadata_returned=true;
 }catch{out.safe_error_class='WF02_SETTINGS_METADATA_UNCONFIRMED';}
 return out;
}
async function pinned(file,digest){
 const target=path.join(ROOT,file),info=await lstat(target);
 need(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.size<=131072&&path.resolve(await realpath(target)).toLowerCase()===target.toLowerCase());
 need(sha(await readFile(target))===digest);
}
async function main(){
 need(process.argv.length===2&&!['NODE_OPTIONS','NODE_DEBUG','NODE_TLS_REJECT_UNAUTHORIZED','NODE_EXTRA_CA_CERTS'].some(k=>process.env[k]));
 for(const [file,digest]of Object.entries(PINS))await pinned(file,digest);
 const privateDir=path.join(ROOT,'.local/m03-english-component');need(path.resolve(await realpath(privateDir)).toLowerCase()===privateDir.toLowerCase());
 const started=new Date().toISOString();
 await writeFile(path.join(privateDir,'at074-workflow-gfh-settings-read.claim.json'),JSON.stringify({started_at:started,
  workflow_id:WORKFLOW_ID,maximum_get_requests:1,automatic_retry:false,source_pins:PINS}),{flag:'wx',mode:0o600});
 const loaded=await loadWorkerPrivateEnvironment({environment:{}});need(loaded.N8N_API_KEY&&loaded.N8N_BASE_URL);
 const observation=await inspectWorkflow({N8N_BASE_URL:loaded.N8N_BASE_URL,N8N_API_KEY:loaded.N8N_API_KEY});
 const report={schema_version:'1.0',evidence_kind:'actual_current_WF02_closed_settings_metadata_read',started_at:started,finished_at:new Date().toISOString(),
  source_pins:PINS,maximum_get_requests:1,automatic_retry:false,ambient_overrides_used:false,configured_origin_sha256:sha(loaded.N8N_BASE_URL),
  previous_connector_result:'root_reported_isError_no_structured_response',previous_connector_observed_at:null,observation,
  raw_graph_or_node_names_or_credentials_or_urls_persisted:false,workflow_edits_or_execution_or_retry_performed:false,
  execution_payload_retention_changed:false,execution_404_cause_proven:false,AT074_status:'partial_metadata_retention_configuration_separate_from_execution_availability'};
 const file=path.join(ROOT,'tracking/evidence/m07/operator-trace-live34',started.replaceAll(':','-')+'-workflow-settings.json');
 await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 process.stdout.write(JSON.stringify({receipt:path.relative(ROOT,file).replaceAll('\\','/'),metadata_returned:observation.metadata_returned,
  http_status:observation.http_status,AT074_status:report.AT074_status})+'\n');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{
 process.stdout.write('WF02_SETTINGS_METADATA_UNCONFIRMED\n');process.exitCode=1;
});
