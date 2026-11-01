/** Two fixed metadata-only fallback GETs; imports perform no private IO. */
import {createHash} from 'node:crypto';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectExecution} from './operator-trace-live34/execution-metadata.mjs';
import {loadWorkerPrivateEnvironment} from '../../tools/worker-private-env.mjs';

const ROOT=path.resolve(import.meta.dirname,'../..');
const AUDIT='tracking/evidence/m07/job-attempt-observability36-live-sidecar/2026-11-01T02-50-02-687228Z-8829fa59-3c1c-46dc-b20b-32649645c275.json';
const PINS={
 [AUDIT]:'0997addf653c8ccd754221c42f1c35096bf596a20a0be8b697f43c765eaf1a15',
 'development/m07/operator-trace-live34/execution-metadata.mjs':'fcb77909e2c2d1ed7ece452f305b619f55ca4de9baea8be63bc9de30ccac656b',
 'tools/worker-private-env.mjs':'ef935580876c9150b8150947c3796dd4760d1ad2910bc3bf322dd5015eea4d79',
};
const sha=value=>createHash('sha256').update(value).digest('hex');
const need=value=>{if(!value)throw Error('TRACE36_PROVIDER_METADATA_UNCONFIRMED');};
export function selectedReferences(receipt){
 need(receipt.result==='passed'&&receipt.audited_job_count===2&&receipt.read_only===true&&receipt.jobs?.length===2);
 const cases=[{case:'success',job:'6763e5fa-dc53-4956-8d9b-17bbc437609e',status:'succeeded',stage:'apply_candidate',execution:'31697'},
  {case:'failure',job:'3fde2ab3-d18e-4087-93c2-0ad2585cf66c',status:'failed',stage:'prepare_candidate',execution:'31703'}];
 return cases.map(expected=>{
  const row=receipt.jobs.find(item=>item.case===expected.case);
  need(row?.job_id===expected.job&&row.status===expected.status&&Array.isArray(row.attempts));
  const refs=row.attempts.filter(item=>item.attempt?.stage===expected.stage);
  need(refs.length===1&&refs[0].attempt.workflow_execution_id===expected.execution&&refs[0].attempt.workflow_execution_ref_state==='recorded');
  return{case_alias:expected.case,job_id:expected.job,execution_id:expected.execution,workflow_id:'gfhxzvSkprS2CI4o'};
 });
}
async function main(){
 need(process.argv.length===2&&!['NODE_OPTIONS','NODE_DEBUG','NODE_TLS_REJECT_UNAUTHORIZED','NODE_EXTRA_CA_CERTS'].some(key=>process.env[key]));
 for(const[file,digest]of Object.entries(PINS)){
  const target=path.join(ROOT,file),stat=await lstat(target);
  need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<1048576&&sha(await readFile(target))===digest);
 }
 const refs=selectedReferences(JSON.parse(await readFile(path.join(ROOT,AUDIT),'utf8'))),started=new Date().toISOString();
 await writeFile(path.join(ROOT,'.local/m07-attempt36-live-audit/n8n-terminal-metadata.claim.json'),JSON.stringify({started_at:started,maximum_direct_get_requests:2,automatic_retry:false,source_pins:PINS}),{flag:'wx'});
 const loaded=await loadWorkerPrivateEnvironment({environment:{}});need(loaded.N8N_API_KEY&&loaded.N8N_BASE_URL);
 const config={N8N_BASE_URL:loaded.N8N_BASE_URL,N8N_API_KEY:loaded.N8N_API_KEY},observations=[];
 for(const ref of refs)observations.push(await inspectExecution(config,ref));
 const report={schema_version:'1.0',evidence_kind:'actual_trace36_terminal_execution_metadata_fallback',started_at:started,finished_at:new Date().toISOString(),
  source_pins:{...PINS,'development/m07/trace36-provider-metadata.mjs':sha(await readFile(new URL(import.meta.url)))},
  prior_connector_attempts:2,prior_connector_result:'isError_without_structured_metadata',maximum_direct_get_requests:2,automatic_retry:false,
  configured_origin_sha256:sha(config.N8N_BASE_URL),ambient_overrides_used:false,observations,node_payloads_requested:false,
  raw_provider_bodies_or_credentials_or_private_urls_persisted:false,workflow_edits_or_execution_or_retry_performed:false,
  historical_execution_31686_queried:false,execution_absence_cause_proven:false};
 const relative='tracking/evidence/m07/job-attempt-observability36-live-sidecar/'+started.replaceAll(':','-')+'-provider-metadata.json';
 await writeFile(path.join(ROOT,relative),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 process.stdout.write(JSON.stringify({receipt:relative,http_statuses:observations.map(row=>row.http_status),metadata_returned:observations.filter(row=>row.metadata_returned).length})+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(()=>{process.stdout.write('TRACE36_PROVIDER_METADATA_UNCONFIRMED\n');process.exitCode=1;});
