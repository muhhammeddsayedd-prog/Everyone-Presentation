/** Root-only, ONE read-only query of the already observed daemon/window.
 * Importing is inert. Closed shape/pattern counts never grant startup credit. */
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import { pathToFileURL } from 'node:url';
import { daemonCommands, PROJECT, TEAM } from './daemon-runtime.mjs';
const ROOT=path.resolve(import.meta.dirname,'../../..');
const DIST=path.join(ROOT,'.local/m07-pilot/tooling/node_modules/vercel/dist');
const RECEIPT='tracking/evidence/m07/controlled-pilot/2026-10-31T00-30-00.995Z-ad0b0a88-daemon-runtime.json';
export const DEPLOYMENT='dpl_9HXjceZRJm93Cy2jPTRrLy8JkKVw';
export const INSTANCE='dmni_01m67nrvv4nxhbz5yxc8c4r3x1';
const RECEIPT_SHA='665dfa9ee99fddf399371f434947c59e08008c2221dfab893e175731403608fa';
const OBSERVER_SHA='528072b8e21ee0dfe79911a42ceeffeaf43b631688f16c0c6ddf5ce025b86263';
const KEYS=['timestamp','_time','time','source','daemonName','daemonInstanceId','deploymentId','environment','projectId','attributes','message','stream','truncated','level','region','requestId'];
const ATTRS=['source','daemonName','daemonInstanceId','deploymentId','projectId','environment','scope.type','scope.value','daemon.name','daemon.instanceId','daemon_name','daemon_instance_id'];
const TYPES=['missing','null','string','number','boolean','object','array','other'];
const CODES=['ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND','ERR_PACKAGE_PATH_NOT_EXPORTED','ERR_IMPORT_ATTRIBUTE_MISSING','ERR_UNKNOWN_FILE_EXTENSION','ERR_UNSUPPORTED_DIR_IMPORT','ERR_REQUIRE_ESM','ERR_DLOPEN_FAILED','EACCES','EPERM','ENOENT','ECONNREFUSED','ENOTFOUND','UNABLE_TO_VERIFY_LEAF_SIGNATURE','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_OSSL_PEM_NO_START_LINE'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const need=v=>{if(!v)throw new Error('DAEMON_LOG_SHAPE_UNCONFIRMED');};
const sha=v=>createHash('sha256').update(v).digest('hex');
const kind=v=>v===undefined?'missing':v===null?'null':Array.isArray(v)?'array':['string','number','boolean','object'].includes(typeof v)?typeof v:'other';
const inventory=keys=>Object.fromEntries(keys.map(key=>[key,Object.fromEntries(TYPES.map(type=>[type,0]))]));
function fixedEvent(value){
  if(!object(value))return null;
  if(Object.keys(value).sort().join(',')==='authentication,event,orchestration'&&value.event==='specs_worker_started'&&value.authentication==='narrow_database_login'&&value.orchestration==='n8n_required')return'worker_started';
  if(Object.keys(value).length===1&&value.event==='hosted_worker_unconfirmed')return'worker_unconfirmed';
  if(Object.keys(value).length===1&&value.event==='hosted_worker_pilot_expired')return'pilot_expired';
  if(Object.keys(value).sort().join(',')==='code,event'&&value.event==='hosted_worker_paused'&&value.code==='NATIVE_CLEANUP_UNCONFIRMED')return'worker_paused';
  return null;
}
export function diagnoseLogShape(text,window){
  need(typeof text==='string'&&Buffer.byteLength(text)<=1048576&&Number.isSafeInteger(window.start)&&Number.isSafeInteger(window.end)&&window.end-window.start===600000);
  const result={records:0,warnings:0,unknown_data_keys:0,unknown_attribute_keys:0,oversized_messages:0,fields:inventory(KEYS),attribute_fields:inventory(ATTRS),
    bindings:Object.fromEntries(['source','daemon','instance','deployment','project','environment'].map(key=>[key,{top_match:0,top_missing:0,top_other:0,attribute_match:0,attribute_missing:0,attribute_other:0}])),
    timestamp_shapes:{epoch_millis_in_window:0,epoch_seconds_in_window:0,string_in_window:0,other:0},node_codes:Object.fromEntries(CODES.map(key=>[key,0])),
    patterns:{named_export_missing:0,syntax_error:0,reference_error:0,type_error:0,permission_denied:0},
    fixed_events_unbound:{worker_started:0,worker_unconfirmed:0,pilot_expired:0,worker_paused:0},has_more:false,excluded_interval_count:0,startup_verified:false};
  const lines=text.trim().split(/\r?\n/u);need(lines.length>0&&lines.length<=202);let summary=null;
  for(const line of lines){
    need(Buffer.byteLength(line)<=262144&&!summary);const row=JSON.parse(line);need(object(row));
    if(row.type==='warning'){result.warnings++;continue;}
    if(row.type==='summary'){summary=row;continue;}
    need(row.type==='log'&&object(row.data)&&++result.records<=100);const event=row.data;
    for(const key of KEYS)result.fields[key][kind(event[key])]++;
    result.unknown_data_keys+=Object.keys(event).filter(key=>!KEYS.includes(key)).length;
    const attrs=object(event.attributes)?event.attributes:{};
    for(const key of ATTRS)result.attribute_fields[key][kind(attrs[key])]++;
    result.unknown_attribute_keys+=Object.keys(attrs).filter(key=>!ATTRS.includes(key)).length;
    for(const [label,key,expected]of[['source','source','daemon'],['daemon','daemonName','worker'],['instance','daemonInstanceId',INSTANCE],['deployment','deploymentId',DEPLOYMENT],['project','projectId',PROJECT],['environment','environment','production']]){
      for(const [side,value]of[['top',event[key]],['attribute',attrs[key]]])result.bindings[label][`${side}_${value===undefined?'missing':value===expected?'match':'other'}`]++;
    }
    const time=event.timestamp;const inWindow=v=>Number.isFinite(v)&&v>=window.start&&v<=window.end;
    if(typeof time==='number'&&inWindow(time))result.timestamp_shapes.epoch_millis_in_window++;
    else if(typeof time==='number'&&inWindow(time*1000))result.timestamp_shapes.epoch_seconds_in_window++;
    else if(typeof time==='string'&&time.length<=100&&inWindow(Date.parse(time)))result.timestamp_shapes.string_in_window++;
    else result.timestamp_shapes.other++;
    if(typeof event.message==='string'&&Buffer.byteLength(event.message)<=65536){
      const message=event.message;
      for(const code of CODES)if(new RegExp(`\\b${code}\\b`,'u').test(message))result.node_codes[code]++;
      for(const [key,regex]of[['named_export_missing',/does not provide an export named|named export .+ not found/iu],['syntax_error',/\bSyntaxError\b/u],['reference_error',/\bReferenceError\b/u],['type_error',/\bTypeError\b/u],['permission_denied',/permission denied|operation not permitted/iu]])if(regex.test(message))result.patterns[key]++;
      let parsed;try{parsed=JSON.parse(message);}catch{parsed=null;}const code=fixedEvent(parsed);if(code)result.fixed_events_unbound[code]++;
    }else if(typeof event.message==='string')result.oversized_messages++;
  }
  need(summary&&Number.isSafeInteger(summary.recordsReturned)&&summary.recordsReturned===result.records&&object(summary.pagination)&&typeof summary.pagination.hasMore==='boolean'
    &&Array.isArray(summary.excludedIntervals)&&summary.excludedIntervals.length<=100&&object(summary.timeRange)
    &&Date.parse(summary.timeRange.start)===window.start&&Date.parse(summary.timeRange.end)===window.end);
  result.has_more=summary.pagination.hasMore;result.excluded_interval_count=summary.excludedIntervals.length;return result;
}
async function safe(file){const info=await lstat(file);need(info.isFile()&&!info.isSymbolicLink()&&info.size>0&&info.size<=8*1024**2&&(await realpath(file)).toLowerCase()===file.toLowerCase());return readFile(file);}
function environment(){const env={NODE_ENV:'production',PATH:'',CI:'1',VERCEL_TELEMETRY_DISABLED:'1',VERCEL_CLI_USE_NATIVE_BINARY:'0'};for(const key of['SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG'])if(process.env[key])env[key]=process.env[key];return env;}
async function main(){
  need(process.argv.length===2&&process.platform==='win32'&&/^v24\./u.test(process.version)&&!process.env.NODE_OPTIONS);
  const bytes=await safe(path.join(ROOT,RECEIPT));need(sha(bytes)===RECEIPT_SHA);const prior=JSON.parse(bytes);
  need(prior.project_id===PROJECT&&prior.team_id===TEAM&&prior.deployment_id===DEPLOYMENT&&prior.before.instances.length===1&&prior.before.instances[0].id===INSTANCE);
  need(sha(await safe(path.join(ROOT,'development/m07/controlled-pilot/daemon-runtime.mjs')))===OBSERVER_SHA);
  const pkg=JSON.parse(await safe(path.join(DIST,'../package.json')));need(pkg.version==='65.8.0');
  const keys=['vc.js','commands-routing.js','commands-deployments.js','chunks/chunk-CJHVHB2F.js','chunks/chunk-OLAG7Y3P.js','chunks/chunk-2PYFJXKS.js'];
  need(object(prior.cli_source_pins)&&Object.keys(prior.cli_source_pins).sort().join(',')===keys.sort().join(','));
  for(const key of keys)need(sha(await safe(path.join(DIST,key)))===prior.cli_source_pins[key]);
  const window={start:Date.parse(prior.window_start),end:Date.parse(prior.window_end)};need(Number.isSafeInteger(window.start)&&window.end-window.start===600000);
  const report={schema_version:'1.0',observed_at:new Date().toISOString(),result:'unconfirmed',project_id:PROJECT,team_id:TEAM,deployment_id:DEPLOYMENT,instance_id:INSTANCE,
    prior_receipt:RECEIPT,prior_receipt_sha256:RECEIPT_SHA,helper_sha256:sha(await safe(import.meta.filename)),window_start:prior.window_start,window_end:prior.window_end,
    cli_commands_attempted:1,maximum_cli_commands:1,raw_logs_keys_values_or_hashes_persisted:false,provider_mutations:false,startup_verified:false,cli_internal_http_retries_possible:true};
  try{
    const raw=await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[path.join(DIST,'vc.js'),...daemonCommands(DEPLOYMENT,INSTANCE,window).logs],{cwd:ROOT,env:environment(),shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
      const chunks=[];let bytes=0,stderr=0,bad=false;const stop=()=>{bad=true;child.kill('SIGKILL');};const timer=setTimeout(stop,30000);
      child.once('error',stop);child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>1048576)stop();else chunks.push(chunk);});child.stderr.on('data',chunk=>{stderr+=chunk.length;if(stderr>32768)stop();});
      child.once('close',code=>{clearTimeout(timer);if(bad||code!==0){reject(new Error('DAEMON_LOG_SHAPE_UNCONFIRMED'));return;}resolve(Buffer.concat(chunks).toString('utf8'));});
    });
    report.diagnostic=diagnoseLogShape(raw,window);report.result='diagnostic_observed';
  }catch{report.code='DAEMON_LOG_SHAPE_UNCONFIRMED';process.exitCode=1;}
  report.finished_at=new Date().toISOString();const file=path.join(ROOT,'tracking/evidence/m07/controlled-pilot',`${report.finished_at.replaceAll(':','-')}-${randomUUID().slice(0,8)}-daemon-log-shape.json`);
  await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({receipt:path.relative(ROOT,file),result:report.result,startup_verified:false})+'\n');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('DAEMON_LOG_SHAPE_UNCONFIRMED\n');process.exitCode=1;});
