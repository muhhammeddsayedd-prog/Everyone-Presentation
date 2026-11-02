/** Pure admission/comparison only: no filesystem, provider, subprocess or collector imports. */
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { APPROVED, BEFORE_OBSERVATION, BEFORE_EXECUTION, AFTER_OBSERVATION, AFTER_EXECUTION, OWNER_STATEMENTS, CLIENT, PROJECT, CENTRAL_PROJECT, TEAM, SEALS, V2, REVIEWED_DELTA } from './approved-pair.mjs';

export const need=value=>{if(!value)throw Error('CLAUDE_J3_B5_OBSERVATION_UNCONFIRMED');};
export const sha=raw=>createHash('sha256').update(raw).digest('hex');
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
const HASH=/^[a-f0-9]{64}$/u;
const bridges=new WeakSet();
function json(raw){need(Buffer.isBuffer(raw)&&raw.length>0&&raw.length<=1024*1024);try{return JSON.parse(raw.toString('utf8'));}catch{need(false);}}
function timestamp(v){need(typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v);return Date.parse(v);}
function seals(v){need(exact(v,Object.keys(SEALS))&&Object.entries(SEALS).every(([file,hash])=>v[file]===hash));}
function canonicalRows(rows){return JSON.stringify(rows.map(({bytes,path,sha256})=>({bytes,path,sha256})));}
// Only exact SHA-pinned Git archives are admitted. No extraction or path writes.
function archiveRows(raw){
 need(Buffer.isBuffer(raw)&&raw.length<=8*1024*1024&&raw.length%512===0);const rows=[];const seen=new Set();
 for(let offset=0;offset+512<=raw.length;){
  const header=raw.subarray(offset,offset+512);if(header.every(byte=>byte===0))break;
  const string=(start,end)=>header.subarray(start,end).toString('utf8').replace(/\0.*$/su,'');
  const name=string(0,100),prefix=string(345,500),file=prefix?`${prefix}/${name}`:name,type=string(156,157);
  const sizeText=string(124,136).trim();need(/^[0-7]+$/u.test(sizeText));const bytes=Number.parseInt(sizeText,8);
  need(Number.isSafeInteger(bytes)&&bytes>=0&&offset+512+bytes<=raw.length);
  need(['0','5','g',''].includes(type));
  if(type==='0'||type===''){
   need(file.length>0&&!file.startsWith('/')&&!file.includes('\\')&&!file.split('/').some(p=>p==='.'||p==='..'||p==='')&&!seen.has(file));seen.add(file);
   rows.push({bytes,path:file,sha256:sha(raw.subarray(offset+512,offset+512+bytes))});
  }
  offset+=512+Math.ceil(bytes/512)*512;
 }
 return rows.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
function release(value,approved){
 need(sha(value.readbackRaw)===approved.readback.sha256&&sha(value.sourceRaw)===approved.source.sha256&&sha(value.archiveRaw)===approved.archive.sha256);
 const readback=json(value.readbackRaw),source=json(value.sourceRaw),deployment=readback.deployment;
 need(readback.result==='passed'&&readback.action==='readback'&&readback.normal_process_return_observed===true&&readback.normal_return_not_inferred===true&&readback.two_independent_reads_equal===true&&readback.stable_alias_matches===true&&readback.automatic_retry===false&&readback.credentials_or_raw_cli_persisted===false);
 need(deployment.id===approved.deployment&&deployment.state==='READY'&&deployment.project_id===PROJECT&&deployment.team_id===TEAM&&deployment.meta.epsSourceCommit===approved.commit&&deployment.meta.epsSourceManifest===approved.manifest);
 need(source.result==='passed'&&source.source_commit===approved.commit&&source.source_sha256===approved.manifest&&source.archive_sha256===approved.archive.sha256&&source.entries===approved.entries&&source.source_stable===true&&source.archive_source===true&&source.cloud_mutation===false&&source.project_id===PROJECT&&source.team_id===TEAM);
 const rows=archiveRows(value.archiveRaw);need(rows.length===approved.entries&&equal(rows,source.files)&&sha(canonicalRows(rows))===approved.manifest);
 for(const file of ['apps/web/lib/mcp-auth.ts','apps/web/app/mcp/route.ts'])need(rows.find(row=>row.path===file)?.sha256===SEALS[file]);
 return{rows,ready_at:Date.parse(readback.observed_at)};
}
export function admitReleasePair(value){
 const before=release(value.before,APPROVED.before),after=release(value.after,APPROVED.after);
 need(value.sourceFiles instanceof Map&&value.sourceFiles.size===5);
 for(const [file,hash]of Object.entries({...SEALS,[V2.path]:V2.sha256}))need(Buffer.isBuffer(value.sourceFiles.get(file))&&sha(value.sourceFiles.get(file))===hash);
 const first=new Map(before.rows.map(row=>[row.path,row])),second=new Map(after.rows.map(row=>[row.path,row]));
 const delta=[...new Set([...first.keys(),...second.keys()])].filter(file=>!equal(first.get(file),second.get(file))).sort();
 need(equal(delta,Object.keys(REVIEWED_DELTA).sort()));
 for(const [file,[oldHash,newHash]]of Object.entries(REVIEWED_DELTA))need((first.get(file)?.sha256??null)===oldHash&&second.get(file)?.sha256===newHash);
 const bridge=Object.freeze({before_ready_at:before.ready_at,after_ready_at:after.ready_at});bridges.add(bridge);return bridge;
}
function observation(value,approved,readyAt){
 need(exact(value,['schema_version','scope','read_only','deployment_id','project_id','request_id_source','observed_at','since','project_read','verified_token','source_seals','maximum_provider_reads','automatic_retry','raw_cli_persisted']));
 need(value.schema_version==='1.0'&&value.scope==='actual_Claude_request_id_correlated_verified_token_observation'&&value.read_only===true&&value.deployment_id===approved.deployment&&value.project_id===PROJECT&&value.request_id_source==='owner_supplied_actual_Claude_get_project_result'&&value.maximum_provider_reads===2&&value.automatic_retry===false&&value.raw_cli_persisted===false);seals(value.source_seals);
 const observed=timestamp(value.observed_at),since=timestamp(value.since),read=value.project_read,token=value.verified_token;
 need(exact(read,['logged_at','event','request_id','trace_id','client_id','project_id'])&&read.event==='eps.mcp.project_read_succeeded'&&UUID.test(read.request_id)&&UUID.test(read.trace_id)&&read.client_id===CLIENT&&read.project_id===CENTRAL_PROJECT);
 need(exact(token,['logged_at','event','trace_id','client_id','session_sha256','iat','exp'])&&token.event==='eps.mcp.verified_token'&&token.trace_id===read.trace_id&&token.client_id===CLIENT&&typeof token.session_sha256==='string'&&HASH.test(token.session_sha256));
 need(Number.isSafeInteger(token.iat)&&token.iat>=0&&Number.isSafeInteger(token.exp)&&token.exp>token.iat);
 const readAt=timestamp(read.logged_at),tokenAt=timestamp(token.logged_at),gap=readAt-tokenAt;
 need(gap>=-1000&&gap<=30000&&since<=readAt&&since<=tokenAt&&readAt<=observed+60000&&tokenAt<=observed+60000&&since<=observed&&readAt>=readyAt&&readAt<token.exp*1000&&token.iat*1000<=tokenAt+60000);
 return value;
}
function packet(value,approved,readyAt){
 need(exact(value,['path','raw','executionPath','executionRaw']));
 need(typeof value.path==='string'&&/^tracking\/evidence\/m07\/completion-oauth\/[A-Za-z0-9.-]+-request-observation\.json$/u.test(value.path)&&typeof value.executionPath==='string'&&/^tracking\/evidence\/m07\/completion-oauth\/[A-Za-z0-9.-]+-collector-v2-execution\.json$/u.test(value.executionPath));
 const obs=observation(json(value.raw),approved,readyAt),p=json(value.executionRaw);
 need(exact(p,['schema_version','scope','execution_id','observed_at','result','stage','read_only','source_file','collector_sha256','cli_version','cli_entry_sha256','cli_query_help_sha256','query_schema','original_entrypoint_executed','original_exports_imported','observation_source_seals','observation','provider_reads_initiated','maximum_provider_reads','automatic_retry','raw_cli_persisted','raw_stderr_persisted']));
 need(p.schema_version==='1.0'&&p.scope==='actual_Claude_observation_collector_v2_execution_provenance'&&UUID.test(p.execution_id)&&p.result==='passed'&&p.stage==='complete'&&p.read_only===true&&p.source_file===V2.path&&p.collector_sha256===V2.sha256&&p.cli_version==='65.8.0'&&p.cli_entry_sha256===V2.cli&&p.cli_query_help_sha256===V2.help&&p.query_schema===V2.query&&p.original_entrypoint_executed===false&&equal(p.original_exports_imported,['command','projectBatch','compare'])&&p.provider_reads_initiated===2&&p.maximum_provider_reads===2&&p.automatic_retry===false&&p.raw_cli_persisted===false&&p.raw_stderr_persisted===false);
 seals(p.observation_source_seals);need(equal(p.observation_source_seals,obs.source_seals)&&exact(p.observation,['path','sha256'])&&p.observation.path===value.path&&p.observation.sha256===sha(value.raw)&&timestamp(p.observed_at)>=timestamp(obs.observed_at));
 return{obs,execution_id:p.execution_id,ref:{path:value.path,sha256:sha(value.raw)},execution_ref:{path:value.executionPath,sha256:sha(value.executionRaw)}};
}
export function compareAcrossRelease({bridge,before:beforeValue,after:afterValue,attestationRaw}){
 need(bridges.has(bridge));
 need(beforeValue.path===BEFORE_OBSERVATION.path&&sha(beforeValue.raw)===BEFORE_OBSERVATION.sha256);
 need(beforeValue.executionPath===BEFORE_EXECUTION.path&&sha(beforeValue.executionRaw)===BEFORE_EXECUTION.sha256);
 need(afterValue.path===AFTER_OBSERVATION.path&&sha(afterValue.raw)===AFTER_OBSERVATION.sha256);
 need(afterValue.executionPath===AFTER_EXECUTION.path&&sha(afterValue.executionRaw)===AFTER_EXECUTION.sha256);
 const first=packet(beforeValue,APPROVED.before,bridge.before_ready_at),second=packet(afterValue,APPROVED.after,bridge.after_ready_at),before=first.obs,after=second.obs,a=before.verified_token,b=after.verified_token;
 need(equal(before.source_seals,after.source_seals)&&first.execution_id!==second.execution_id&&before.project_read.request_id!==after.project_read.request_id&&before.project_read.trace_id!==after.project_read.trace_id&&a.client_id===b.client_id&&a.session_sha256===b.session_sha256);
 need(timestamp(before.project_read.logged_at)<a.exp*1000&&timestamp(after.project_read.logged_at)>a.exp*1000&&b.iat>a.iat&&b.exp>a.exp);
 const attestation=json(attestationRaw);
 need(exact(attestation,['schema_version','scope','statement_source','client_id','project_id','before_request_id','after_request_id','before_deployment_id','after_deployment_id','recorded_at','statements','no_reconnect','no_sign_in']));
 need(attestation.schema_version==='1.0'&&attestation.scope==='actual_Claude_owner_no_reconnect_or_signin_statement'&&attestation.statement_source==='owner_explicit_statement'&&attestation.client_id===CLIENT&&attestation.project_id===PROJECT&&attestation.before_request_id===before.project_read.request_id&&attestation.after_request_id===after.project_read.request_id&&attestation.before_deployment_id===APPROVED.before.deployment&&attestation.after_deployment_id===APPROVED.after.deployment&&equal(attestation.statements,OWNER_STATEMENTS)&&attestation.no_reconnect===true&&attestation.no_sign_in===true&&timestamp(attestation.recorded_at)>=timestamp(after.project_read.logged_at));
 return{schema_version:'1.0',scope:'actual_Claude_same_session_renewed_operational_access_across_compatible_release',result:'passed',before_deployment_id:before.deployment_id,after_deployment_id:after.deployment_id,client_id:CLIENT,before_request_id:before.project_read.request_id,after_request_id:after.project_read.request_id,before_iat:a.iat,before_exp:a.exp,after_iat:b.iat,after_exp:b.exp,same_session_verified:true,later_signed_token_verified:true,owner_no_reconnect_and_no_signin_attested:true,reviewed_diagnostics_and_focus_delta_verified:true,auth_collector_seals_unchanged:true,before_observation:first.ref,after_observation:second.ref,before_execution:first.execution_ref,after_execution:second.execution_ref,owner_attestation_sha256:sha(attestationRaw),approved_pair:APPROVED,old_expired_bearer_denial_collected:false,refresh_HTTP_exchange_collected:false,refresh_token_rotation_storage_verified:false,targeted_session_revocation_verified:false,full_lifecycle_verified:false};
}
