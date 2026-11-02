/** Bounded read-only normal-CLI collection. Importing never reads auth or logs. */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { TextDecoder } from 'node:util';
import { setTimeout, clearTimeout } from 'node:timers';
import { buildLogCommand, childEnvironment } from '../oauth-consent-fix/read-pilot-trace.mjs';

const ROOT=path.resolve(import.meta.dirname,'../../..');
const CLIENT='f2acafd5-d4b6-4176-b86c-067c57e45ecc',PROJECT='prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0';
const CENTRAL_PROJECT='6da14b82-8458-451f-aa21-28cb6c85bdc5';
const CLI=path.join(ROOT,'.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js');
const CLI_SHA='5724f20cc65bb0e13c7a0668af107770ddb101bb72dd3fd6160aca672ea2a493';
const MAX=2*1024*1024,UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const need=value=>{if(!value)throw Error('CLAUDE_LIFECYCLE_OBSERVATION_UNCONFIRMED');};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function timestamp(value){need(typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);return Date.parse(value);}

export function command(deployment,since,kind,id,now=Date.now()){
 need(UUID.test(id)&&['read','token'].includes(kind));
 const args=buildLogCommand(deployment,since,now);
 args[13]=kind==='read'?`"eps.mcp.project_read_succeeded" AND "${id}"`:`"eps.mcp.verified_token" AND "${id}"`;
 return args;
}
function projectEvent(value,kind,id){
 if(kind==='read'){
  need(exact(value,['event','entry_point','operation','success','request_id','principal_id','client_id','project_ids','trace_id']));
  need(value.event==='eps.mcp.project_read_succeeded'&&value.entry_point==='mcp_http'&&value.operation==='get_project'&&value.success===true&&value.request_id===id&&UUID.test(value.principal_id)&&value.client_id===CLIENT&&UUID.test(value.trace_id));
  need(Array.isArray(value.project_ids)&&value.project_ids.length===1&&value.project_ids[0]===CENTRAL_PROJECT);
  // Principal from the historical project event is validated, then discarded.
  return{event:value.event,request_id:value.request_id,trace_id:value.trace_id,client_id:CLIENT,project_id:CENTRAL_PROJECT};
 }
 need(exact(value,['event','trace_id','client_id','session_sha256','iat','exp']));
 need(value.event==='eps.mcp.verified_token'&&value.trace_id===id&&value.client_id===CLIENT&&typeof value.session_sha256==='string'&&/^[a-f0-9]{64}$/u.test(value.session_sha256));
 need(Number.isSafeInteger(value.iat)&&value.iat>=0&&Number.isSafeInteger(value.exp)&&value.exp>value.iat);
 return{event:value.event,trace_id:value.trace_id,client_id:CLIENT,session_sha256:value.session_sha256,iat:value.iat,exp:value.exp};
}
export function projectBatch(text,scope,kind,id){
 command(scope.deployment,scope.since,kind,id,timestamp(scope.observed_at));
 need(typeof text==='string'&&Buffer.byteLength(text)<=MAX);
 const rows=text.trim().split(/\r?\n/u);need(rows.length>=1&&rows.length<=102);let count=0,summary;const events=[];
 const prefix=kind==='read'?'EPS MCP read receipt ':'EPS MCP verified token ';
 for(const line of rows){need(line&&Buffer.byteLength(line)<=262144&&!summary);const row=JSON.parse(line);
  if(row.type==='summary'){summary=row;continue;}
  need(row.type==='log'&&row.data&&typeof row.data==='object'&&++count<=100);
  const data=row.data;need(data.deploymentId===undefined||data.deploymentId===scope.deployment);need(data.projectId===undefined||data.projectId===PROJECT);need(data.truncated!==true&&typeof data.message==='string'&&data.message.startsWith(prefix)&&Buffer.byteLength(data.message)<=8192);
  const logged=Number.isSafeInteger(data.timestamp)?data.timestamp:timestamp(data.timestamp);need(logged>=timestamp(scope.since)&&logged<=timestamp(scope.observed_at)+60000);
  events.push({logged_at:new Date(logged).toISOString(),...projectEvent(JSON.parse(data.message.slice(prefix.length)),kind,id)});
 }
 need(exact(summary,['type','recordsReturned','timeRange','pagination','excludedIntervals'])&&summary.recordsReturned===count);
 need(exact(summary.timeRange,['start','end'])&&timestamp(summary.timeRange.start)===timestamp(scope.since)&&timestamp(summary.timeRange.end)<=timestamp(scope.observed_at)+60000&&timestamp(summary.timeRange.end)>=timestamp(scope.since));
 need(events.every(event=>timestamp(event.logged_at)>=timestamp(summary.timeRange.start)&&timestamp(event.logged_at)<=timestamp(summary.timeRange.end)));
 need(exact(summary.pagination,['hasMore','next'])&&summary.pagination.hasMore===false&&summary.pagination.next===null&&Array.isArray(summary.excludedIntervals)&&summary.excludedIntervals.length===0);
 need(events.length===1);
 return events[0];
}
function observation(value){
 need(exact(value,['schema_version','scope','read_only','deployment_id','project_id','request_id_source','observed_at','since','project_read','verified_token','source_seals','maximum_provider_reads','automatic_retry','raw_cli_persisted']));
 need(value.schema_version==='1.0'&&value.scope==='actual_Claude_request_id_correlated_verified_token_observation'&&value.read_only===true&&value.project_id===PROJECT&&value.request_id_source==='owner_supplied_actual_Claude_get_project_result'&&value.maximum_provider_reads===2&&value.automatic_retry===false&&value.raw_cli_persisted===false);
 need(typeof value.deployment_id==='string'&&/^dpl_[A-Za-z0-9]{10,80}$/u.test(value.deployment_id));
 need(exact(value.source_seals,['development/m07/completion-oauth/collect.mjs','development/m07/oauth-consent-fix/read-pilot-trace.mjs','apps/web/lib/mcp-auth.ts','apps/web/app/mcp/route.ts'])&&Object.values(value.source_seals).every(hash=>typeof hash==='string'&&/^[a-f0-9]{64}$/u.test(hash)));
 timestamp(value.observed_at);timestamp(value.since);const read=value.project_read,token=value.verified_token;
 need(exact(read,['logged_at','event','request_id','trace_id','client_id','project_id'])&&read.event==='eps.mcp.project_read_succeeded'&&UUID.test(read.request_id)&&UUID.test(read.trace_id)&&read.client_id===CLIENT&&read.project_id===CENTRAL_PROJECT);timestamp(read.logged_at);
 need(exact(token,['logged_at','event','trace_id','client_id','session_sha256','iat','exp']));timestamp(token.logged_at);const {logged_at,...fields}=token;void logged_at;projectEvent(fields,'token',read.trace_id);
 const correlationGap=timestamp(read.logged_at)-timestamp(token.logged_at);
 need(read.trace_id===token.trace_id&&correlationGap>=-1000&&correlationGap<=30000);
 return value;
}
export function compare(beforeValue,afterValue){
 const before=observation(beforeValue),after=observation(afterValue),a=before.verified_token,b=after.verified_token;
 need(JSON.stringify(before.source_seals)===JSON.stringify(after.source_seals));
 need(before.deployment_id===after.deployment_id&&before.project_read.request_id!==after.project_read.request_id&&a.client_id===b.client_id&&a.session_sha256===b.session_sha256);
 need(timestamp(before.project_read.logged_at)<a.exp*1000&&timestamp(after.project_read.logged_at)>a.exp*1000&&b.iat>a.iat&&b.exp>a.exp);
 return{schema_version:'1.0',scope:'actual_Claude_same_session_renewed_operational_access_after_observed_token_natural_expiry',result:'passed',deployment_id:before.deployment_id,client_id:CLIENT,session_sha256:a.session_sha256,before_request_id:before.project_read.request_id,after_request_id:after.project_read.request_id,before_iat:a.iat,before_exp:a.exp,after_iat:b.iat,after_exp:b.exp,natural_expiry_deadline:new Date(a.exp*1000).toISOString(),after_read_logged_at:after.project_read.logged_at,same_session_verified:true,later_signed_token_verified:true,actual_owner_client_source:'owner_supplied_actual_Claude_result_request_ids; owner_attests_no_reenrollment',old_expired_bearer_denial_collected:false,refresh_HTTP_exchange_collected:false,refresh_token_rotation_storage_verified:false,targeted_session_revocation_verified:false,full_lifecycle_verified:false};
}
async function pinnedCli(){
 for(const file of[CLI,path.join(path.dirname(CLI),'../package.json')]){const stat=await lstat(file);need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=8*1024*1024&&path.resolve(await realpath(file)).toLowerCase()===path.resolve(file).toLowerCase());}
 need(sha(await readFile(CLI))===CLI_SHA&&JSON.parse(await readFile(path.join(path.dirname(CLI),'../package.json'),'utf8')).version==='65.8.0');
}
function runtimeLogs(args){return new Promise((resolve,reject)=>{
 let child,done=false,size=0;const chunks=[];const stop=()=>{if(done)return;done=true;clearTimeout(timer);child?.kill();reject(Error('CLAUDE_LIFECYCLE_LOG_READ_UNCONFIRMED'));};const timer=setTimeout(stop,30000);
 try{child=spawn(process.execPath,args,{cwd:ROOT,env:childEnvironment(),windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});}catch{stop();return;}
 child.once('error',stop);child.stdout.on('data',chunk=>{size+=chunk.length;if(size>MAX)stop();else if(!done)chunks.push(chunk);});child.stderr.on('data',chunk=>{size+=chunk.length;if(size>MAX)stop();});child.once('close',code=>{if(done)return;if(code!==0){stop();return;}done=true;clearTimeout(timer);try{resolve(new TextDecoder('utf8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{reject(Error('CLAUDE_LIFECYCLE_LOG_READ_UNCONFIRMED'));}});
});}
async function sourceSeals(){const result={};for(const file of['development/m07/completion-oauth/collect.mjs','development/m07/oauth-consent-fix/read-pilot-trace.mjs','apps/web/lib/mcp-auth.ts','apps/web/app/mcp/route.ts'])result[file]=sha(await readFile(path.join(ROOT,file)));return result;}
async function output(value,suffix){const directory=path.join(ROOT,'tracking/evidence/m07/completion-oauth');await mkdir(directory,{recursive:true});need((await lstat(directory)).isDirectory()&&!(await lstat(directory)).isSymbolicLink()&&await realpath(directory)===directory);const relative=`tracking/evidence/m07/completion-oauth/${new Date().toISOString().replaceAll(':','-')}-${randomUUID().slice(0,8)}-${suffix}.json`;await writeFile(path.join(ROOT,relative),JSON.stringify(value,null,2)+'\n',{flag:'wx'});return relative;}
async function safeReceipt(file){const full=path.resolve(file),base=path.join(ROOT,'tracking/evidence/m07/completion-oauth');need(full.startsWith(base+path.sep)&&await realpath(full)===full);const stat=await lstat(full);need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=65536);return observation(JSON.parse(await readFile(full,'utf8')));}
async function main(){
 const [mode,deployment,since,requestId,...extra]=process.argv.slice(2);need(!extra.length&&process.platform==='win32'&&/^v24\./u.test(process.version)&&!process.env.NODE_OPTIONS);
 if(mode==='compare'){need(requestId===undefined);const result=compare(await safeReceipt(deployment),await safeReceipt(since));const receipt=await output(result,'renewed-access');process.stdout.write(JSON.stringify({result:'passed',receipt,full_lifecycle_verified:false})+'\n');return;}
 need(mode==='preview'||mode==='collect');const args=command(deployment,since,'read',requestId);await pinnedCli();
 if(mode==='preview'){process.stdout.write(JSON.stringify({read_only:true,provider_reads:0,maximum_provider_reads:2,deployment_id:deployment,request_id:requestId})+'\n');return;}
 const before=await sourceSeals();const project_read=projectBatch(await runtimeLogs(args),{deployment,since,observed_at:new Date().toISOString()},'read',requestId);
 const verified_token=projectBatch(await runtimeLogs(command(deployment,since,'token',project_read.trace_id)),{deployment,since,observed_at:new Date().toISOString()},'token',project_read.trace_id);need(JSON.stringify(before)===JSON.stringify(await sourceSeals()));
 const report=observation({schema_version:'1.0',scope:'actual_Claude_request_id_correlated_verified_token_observation',read_only:true,deployment_id:deployment,project_id:PROJECT,request_id_source:'owner_supplied_actual_Claude_get_project_result',observed_at:new Date().toISOString(),since,project_read,verified_token,source_seals:before,maximum_provider_reads:2,automatic_retry:false,raw_cli_persisted:false});const receipt=await output(report,'request-observation');process.stdout.write(JSON.stringify({result:'passed',receipt,request_id:requestId,iat:verified_token.iat,exp:verified_token.exp,natural_expiry_deadline:new Date(verified_token.exp*1000).toISOString()})+'\n');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('CLAUDE_LIFECYCLE_OBSERVATION_UNCONFIRMED; raw diagnostics suppressed.\n');process.exitCode=1;});
