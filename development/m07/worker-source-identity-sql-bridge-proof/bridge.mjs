/** Bounded diagnostic custody only; same Python CLI, environment and State. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { clearTimeout, setTimeout } from 'node:timers';

const MAIN='D:/Everyone/Presentation/Everyone-Presentation-Studio';
const PYTHON=MAIN+'/.venv-skills/Scripts/python.exe';
const LOCAL=MAIN+'/development/m07/worker-source-identity-sql-proof/local.py';
export const LIMIT=32*1024**2;
export const DEADLINE=30000;
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
const hash=raw=>createHash('sha256').update(raw).digest('hex');

export async function privateWrite(ctx,name,raw){
 assert.equal(ctx.root,MAIN);assert(uuid.test(ctx.runId));assert.equal(ctx.report.private_acl_verified,true);
 assert.equal(ctx.privateRoot,path.join(MAIN,'.local/worker-source-identity-sql-bridge-proof',ctx.runId));
 assert(/^[a-z0-9-]+\.(?:json|bin)$/u.test(name));assert(Buffer.isBuffer(raw)&&raw.length<=LIMIT);
 const directory=await lstat(ctx.privateRoot);assert(directory.isDirectory()&&!directory.isSymbolicLink());assert.equal(await realpath(ctx.privateRoot),ctx.privateRoot);
 const file=path.join(ctx.privateRoot,name);assert.equal(path.dirname(file),ctx.privateRoot);
 // The sealed outer protect() verified Owner+SYSTEM with inheritable rules.
 // Exclusive files inherit that same protected root; no ACL or identity changes.
 const handle=await open(file,'wx',0o600);
 try{await handle.writeFile(raw);await handle.sync();const info=await handle.stat();assert(info.isFile()&&info.nlink===1&&info.size===raw.length);assert.equal(await realpath(file),file);}
 finally{await handle.close();}
 return{path:path.relative(MAIN,file).replaceAll('\\','/'),sha256:hash(raw),bytes:raw.length};
}

export async function diagnosticBridge(action,value,ctx,ports={}){
 assert(['check','render','diagnose','compare'].includes(action));
 assert.equal(ctx.root,MAIN);assert(uuid.test(ctx.runId));assert.equal(ctx.report.private_acl_verified,true);
 const input=Buffer.from(JSON.stringify(value));assert(input.length>0&&input.length<=LIMIT);
 const id=(ports.uuid??randomUUID)();assert(uuid.test(id));const stem='bridge-'+action+'-'+id;
 const write=(name,raw)=>(ports.write??privateWrite)(ctx,name,raw);
 const encode=value=>Buffer.from(JSON.stringify(value));
 const request=await write(stem+'-input.json',input);
 await write(stem+'-claim.json',encode({action,request,python:PYTHON,script:LOCAL,deadline_ms:DEADLINE,maximum_combined_output_bytes:LIMIT,automatic_retry:false}));
 const chunks={stdout:[],stderr:[]};let observed=0,retained=0,stdoutBytes=0,stderrBytes=0,overflow=false,timedOut=false,spawnFailed=false;
 let disposition='not_started',exitCode=null,signal=null,nativeError=null;
 const preserveError=error=>{nativeError=Buffer.from(JSON.stringify({name:typeof error?.name==='string'?error.name:null,message:typeof error?.message==='string'?error.message:null,code:typeof error?.code==='string'?error.code:null,stack:typeof error?.stack==='string'?error.stack:null})).subarray(0,LIMIT);};
 await new Promise(resolve=>{
  let child,finished=false;
  const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);resolve();};
  const timer=(ports.setTimeout??setTimeout)(()=>{timedOut=true;disposition='timeout_kill_requested';child?.kill();},DEADLINE);
  try{
   // Same inherited environment, Python arguments, cwd and non-shell port as before.
   child=(ports.spawn??spawn)(PYTHON,['-X','utf8','-B',LOCAL,action],{cwd:ctx.root,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
   disposition='spawned';
   for(const[stream,kind]of[[child.stdout,'stdout'],[child.stderr,'stderr']])stream.on('data',raw=>{
    const bytes=Buffer.from(raw);observed+=bytes.length;if(kind==='stdout')stdoutBytes+=bytes.length;else stderrBytes+=bytes.length;
    const keep=Math.min(bytes.length,LIMIT-retained);if(keep>0){chunks[kind].push(bytes.subarray(0,keep));retained+=keep;}
    if(observed>LIMIT){overflow=true;disposition='overflow_kill_requested';child.kill();}
   });
   child.stdin.on('error',()=>{});
   child.once('error',error=>{preserveError(error);spawnFailed=true;disposition='spawn_error';finish();});
   child.once('close',(code,endedSignal)=>{exitCode=code;signal=endedSignal??null;disposition='closed';finish();});
   child.stdin.end(input);
  }catch(error){preserveError(error);spawnFailed=true;disposition='spawn_error';finish();}
 });
 const stdout=Buffer.concat(chunks.stdout),stderr=Buffer.concat(chunks.stderr);
 const rawStdout=await write(stem+'-stdout.bin',stdout),rawStderr=await write(stem+'-stderr.bin',stderr);
 let result,parsed=false;
 if(!spawnFailed&&!timedOut&&!overflow&&exitCode===0&&stderrBytes===0){try{result=JSON.parse(stdout.toString('utf8'));parsed=true;}catch(error){preserveError(error);}}
 const rawError=nativeError?await write(stem+'-error.bin',nativeError):null;
 const stage=spawnFailed?'spawn':timedOut?'timeout':overflow?'overflow':exitCode!==0?'exit':stderrBytes>0?'stderr':!parsed?'json':'complete';
 const safe={action,request,raw_stdout:rawStdout,raw_stderr:rawStderr,raw_error:rawError,exit_code:exitCode,timed_out:timedOut,overflow,
  stdout_bytes:stdoutBytes,stderr_bytes:stderrBytes,retained_output_bytes:retained,json_parse_passed:parsed,stage,
  signal:signal==='SIGTERM'||signal==='SIGKILL'?signal:null,process_disposition:disposition,automatic_retry:false};
 await write(stem+'-outcome.json',encode(safe));
 (ctx.report.worker40_bridge_diagnostics??=[]).push(safe);
 if(stage!=='complete')throw Object.assign(Error('WORKER40_BRIDGE_DIAGNOSTIC_REFUSED'),{diagnostic:safe});
 return result;
}
