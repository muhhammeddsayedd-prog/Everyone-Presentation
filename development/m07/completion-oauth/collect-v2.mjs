/** New read-only entry. The original collector and its observation schema stay frozen. */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { TextDecoder } from 'node:util';
import { setTimeout, clearTimeout } from 'node:timers';
import { command as originalCommand, projectBatch, compare } from './collect.mjs';
import { childEnvironment } from '../oauth-consent-fix/read-pilot-trace.mjs';
export { projectBatch, compare };

const ROOT=path.resolve(import.meta.dirname,'../../..');
const ENTRY='development/m07/completion-oauth/collect-v2.mjs';
const SOURCES=['development/m07/completion-oauth/collect.mjs','development/m07/oauth-consent-fix/read-pilot-trace.mjs','apps/web/lib/mcp-auth.ts','apps/web/app/mcp/route.ts'];
const FROZEN_IMPORTS={'development/m07/completion-oauth/collect.mjs':'ae466c59167952b9cc0b5cda915b93d8b664d9009d22b7b8d4df2ee8453cc2c1','development/m07/oauth-consent-fix/read-pilot-trace.mjs':'0b998169cfcf4f4811398634ec4901a2074192830a5d1c5a84caeec36b81e179'};
const CLIENT='f2acafd5-d4b6-4176-b86c-067c57e45ecc',PROJECT='prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0';
const CENTRAL_PROJECT='6da14b82-8458-451f-aa21-28cb6c85bdc5';
const CLI=path.join(ROOT,'.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js');
const CLI_SHA='5724f20cc65bb0e13c7a0668af107770ddb101bb72dd3fd6160aca672ea2a493';
const HELP='chunks/chunk-2PYFJXKS.js',HELP_SHA='f19e025f07602444e832f4096c829928959f5a315ab09048c66f8505277d189b';
export const QUERY_SCHEMA='vercel65.8_runtime_unquoted_allowlisted_event_AND_uuid_v1';
const MAX=2*1024*1024,UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const need=value=>{if(!value)throw Error('CLAUDE_LIFECYCLE_OBSERVATION_V2_UNCONFIRMED');};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function timestamp(value){need(typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);return Date.parse(value);}

export function commandV2(deployment,since,kind,id,now=Date.now()){
 const args=originalCommand(deployment,since,kind,id,now);
 // Original command validates exact event kind, UUID, deployment and lookback.
 // CLI65.8 quotes are for field values; these two message terms are bare words.
 args[13]=`eps.mcp.${kind==='read'?'project_read_succeeded':'verified_token'} AND ${id}`;
 return args;
}
function observation(value){
 need(exact(value,['schema_version','scope','read_only','deployment_id','project_id','request_id_source','observed_at','since','project_read','verified_token','source_seals','maximum_provider_reads','automatic_retry','raw_cli_persisted']));
 need(value.schema_version==='1.0'&&value.scope==='actual_Claude_request_id_correlated_verified_token_observation'&&value.read_only===true&&value.project_id===PROJECT&&value.request_id_source==='owner_supplied_actual_Claude_get_project_result'&&value.maximum_provider_reads===2&&value.automatic_retry===false&&value.raw_cli_persisted===false);
 need(typeof value.deployment_id==='string'&&/^dpl_[A-Za-z0-9]{10,80}$/u.test(value.deployment_id));
 need(exact(value.source_seals,SOURCES)&&Object.values(value.source_seals).every(hash=>typeof hash==='string'&&/^[a-f0-9]{64}$/u.test(hash)));
 timestamp(value.observed_at);timestamp(value.since);const read=value.project_read,token=value.verified_token;
 need(exact(read,['logged_at','event','request_id','trace_id','client_id','project_id'])&&read.event==='eps.mcp.project_read_succeeded'&&UUID.test(read.request_id)&&UUID.test(read.trace_id)&&read.client_id===CLIENT&&read.project_id===CENTRAL_PROJECT);timestamp(read.logged_at);
 need(exact(token,['logged_at','event','trace_id','client_id','session_sha256','iat','exp']));timestamp(token.logged_at);
 need(token.event==='eps.mcp.verified_token'&&token.trace_id===read.trace_id&&token.client_id===CLIENT&&typeof token.session_sha256==='string'&&/^[a-f0-9]{64}$/u.test(token.session_sha256));
 need(Number.isSafeInteger(token.iat)&&token.iat>=0&&Number.isSafeInteger(token.exp)&&token.exp>token.iat);
 const gap=timestamp(read.logged_at)-timestamp(token.logged_at);need(gap>=-1000&&gap<=30000);
 return value;
}
export async function collectObservation({deployment,since,requestId},ports){
 const before=await ports.seals();
 const project_read=projectBatch(await ports.read(commandV2(deployment,since,'read',requestId,ports.now())),{deployment,since,observed_at:new Date(ports.now()).toISOString()},'read',requestId);
 const verified_token=projectBatch(await ports.read(commandV2(deployment,since,'token',project_read.trace_id,ports.now())),{deployment,since,observed_at:new Date(ports.now()).toISOString()},'token',project_read.trace_id);
 need(JSON.stringify(before)===JSON.stringify(await ports.seals()));
 return observation({schema_version:'1.0',scope:'actual_Claude_request_id_correlated_verified_token_observation',read_only:true,deployment_id:deployment,project_id:PROJECT,request_id_source:'owner_supplied_actual_Claude_get_project_result',observed_at:new Date(ports.now()).toISOString(),since,project_read,verified_token,source_seals:before,maximum_provider_reads:2,automatic_retry:false,raw_cli_persisted:false});
}
async function regular(file,maximum){const stat=await lstat(file);need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=maximum&&path.resolve(await realpath(file)).toLowerCase()===path.resolve(file).toLowerCase());}
async function pinnedCli(){
 for(const file of[CLI,path.join(path.dirname(CLI),'../package.json'),path.join(path.dirname(CLI),HELP)])await regular(file,8*1024*1024);
 need(sha(await readFile(CLI))===CLI_SHA&&JSON.parse(await readFile(path.join(path.dirname(CLI),'../package.json'),'utf8')).version==='65.8.0');
 need(sha(await readFile(path.join(path.dirname(CLI),HELP)))===HELP_SHA);
 for(const[file,hash]of Object.entries(FROZEN_IMPORTS)){await regular(path.join(ROOT,file),65536);need(sha(await readFile(path.join(ROOT,file)))===hash);}
}
function runtimeLogs(args){return new Promise((resolve,reject)=>{
 let child,done=false,size=0;const chunks=[];const stop=()=>{if(done)return;done=true;clearTimeout(timer);child?.kill();reject(Error('CLAUDE_LIFECYCLE_LOG_READ_V2_UNCONFIRMED'));};const timer=setTimeout(stop,30000);
 try{child=spawn(process.execPath,args,{cwd:ROOT,env:childEnvironment(),windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});}catch{stop();return;}
 child.once('error',stop);child.stdout.on('data',chunk=>{size+=chunk.length;if(size>MAX)stop();else if(!done)chunks.push(chunk);});child.stderr.on('data',chunk=>{size+=chunk.length;if(size>MAX)stop();});child.once('close',code=>{if(done)return;if(code!==0){stop();return;}done=true;clearTimeout(timer);try{resolve(new TextDecoder('utf8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{reject(Error('CLAUDE_LIFECYCLE_LOG_READ_V2_UNCONFIRMED'));}});
});}
async function sourceSeals(){const result={};for(const file of SOURCES)result[file]=sha(await readFile(path.join(ROOT,file)));return result;}
async function executionPins(){await regular(path.join(ROOT,ENTRY),65536);return{collector_sha256:sha(await readFile(path.join(ROOT,ENTRY))),cli_version:'65.8.0',cli_entry_sha256:CLI_SHA,cli_query_help_sha256:HELP_SHA,query_schema:QUERY_SCHEMA};}
async function output(value,suffix){
 const directory=path.join(ROOT,'tracking/evidence/m07/completion-oauth');await mkdir(directory,{recursive:true});need((await lstat(directory)).isDirectory()&&!(await lstat(directory)).isSymbolicLink()&&await realpath(directory)===directory);
 const relative=`tracking/evidence/m07/completion-oauth/${new Date().toISOString().replaceAll(':','-')}-${randomUUID().slice(0,8)}-${suffix}.json`,raw=JSON.stringify(value,null,2)+'\n';
 await writeFile(path.join(ROOT,relative),raw,{flag:'wx'});return{path:relative,sha256:sha(raw)};
}
export function executionReceipt({executionId,pins,observedAt,stage,reads,result,artifact=null,sourceSeals=null}){
 need(UUID.test(executionId)&&['passed','unconfirmed'].includes(result)&&['collect','observation_persisted','complete'].includes(stage)&&Number.isInteger(reads)&&reads>=0&&reads<=2);timestamp(observedAt);
 need(exact(pins,['collector_sha256','cli_version','cli_entry_sha256','cli_query_help_sha256','query_schema'])&&/^[a-f0-9]{64}$/u.test(pins.collector_sha256)&&pins.cli_version==='65.8.0'&&pins.cli_entry_sha256===CLI_SHA&&pins.cli_query_help_sha256===HELP_SHA&&pins.query_schema===QUERY_SCHEMA);
 need(sourceSeals===null||exact(sourceSeals,SOURCES)&&Object.values(sourceSeals).every(hash=>/^[a-f0-9]{64}$/u.test(hash)));
 need(artifact===null||exact(artifact,['path','sha256'])&&/^tracking\/evidence\/m07\/completion-oauth\/[A-Za-z0-9.-]+-request-observation\.json$/u.test(artifact.path)&&/^[a-f0-9]{64}$/u.test(artifact.sha256));
 need(result!=='passed'||stage==='complete'&&reads===2&&artifact!==null&&sourceSeals!==null);
 return{schema_version:'1.0',scope:'actual_Claude_observation_collector_v2_execution_provenance',execution_id:executionId,observed_at:observedAt,result,stage,read_only:true,source_file:ENTRY,...pins,original_entrypoint_executed:false,original_exports_imported:['command','projectBatch','compare'],observation_source_seals:sourceSeals,observation:artifact,provider_reads_initiated:reads,maximum_provider_reads:2,automatic_retry:false,raw_cli_persisted:false,raw_stderr_persisted:false};
}
async function safeReceipt(file){const full=path.resolve(file),base=path.join(ROOT,'tracking/evidence/m07/completion-oauth');need(full.startsWith(base+path.sep)&&await realpath(full)===full);await regular(full,65536);return observation(JSON.parse(await readFile(full,'utf8')));}
async function main(){
 const [mode,deployment,since,requestId,...extra]=process.argv.slice(2);need(!extra.length&&process.platform==='win32'&&/^v24\./u.test(process.version)&&!process.env.NODE_OPTIONS);
 if(mode==='compare'){need(requestId===undefined);const result=compare(await safeReceipt(deployment),await safeReceipt(since));const receipt=await output(result,'renewed-access-v2');process.stdout.write(JSON.stringify({result:'passed',receipt:receipt.path,full_lifecycle_verified:false})+'\n');return;}
 need(mode==='preview'||mode==='collect');commandV2(deployment,since,'read',requestId);await pinnedCli();const pins=await executionPins();
 if(mode==='preview'){process.stdout.write(JSON.stringify({read_only:true,provider_reads:0,maximum_provider_reads:2,deployment_id:deployment,request_id:requestId,...pins})+'\n');return;}
 let reads=0,stage='collect',artifact=null,seals=null;const executionId=randomUUID();
 try{
  const report=await collectObservation({deployment,since,requestId},{seals:sourceSeals,now:Date.now,read:args=>{need(reads<2);reads++;return runtimeLogs(args);}});
  need(JSON.stringify(pins)===JSON.stringify(await executionPins()));await pinnedCli();seals=report.source_seals;artifact=await output(report,'request-observation');stage='observation_persisted';
  const receipt=await output(executionReceipt({executionId,pins,observedAt:new Date().toISOString(),stage:'complete',reads,result:'passed',artifact,sourceSeals:seals}),'collector-v2-execution');
  process.stdout.write(JSON.stringify({result:'passed',receipt:artifact.path,execution_receipt:receipt.path,request_id:requestId,iat:report.verified_token.iat,exp:report.verified_token.exp,natural_expiry_deadline:new Date(report.verified_token.exp*1000).toISOString()})+'\n');
 }catch{
  const receipt=await output(executionReceipt({executionId,pins,observedAt:new Date().toISOString(),stage,reads,result:'unconfirmed',artifact,sourceSeals:seals}),'collector-v2-unconfirmed');
  process.stdout.write(JSON.stringify({result:'unconfirmed',execution_receipt:receipt.path})+'\n');process.exitCode=1;
 }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('CLAUDE_LIFECYCLE_OBSERVATION_V2_UNCONFIRMED; raw diagnostics suppressed.\n');process.exitCode=1;});
