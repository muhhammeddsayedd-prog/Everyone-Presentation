/** Fresh owned purpose. No execution until root finalizes/reviews/enables it. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat,mkdir,readFile,realpath,writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { ROOT,loadSources } from './sources.mjs';
import { executionEnvironment,verifyPrepared } from '../job-attempt-observability36-proof/run.mjs';
import { verifyPython,PYTHON_SHA } from './python.mjs';
export { executionEnvironment,verifyPrepared };
async function prepare(){
 await verifyPython(ROOT);const sources=await loadSources(),{compileGate36}=await import('./controller.mjs'),runId=randomUUID();
 const compiled=compileGate36(sources,{root:ROOT,runId});
 const parent=path.join(ROOT,'.local/m07-attempt36-gate-prepared');await mkdir(parent,{recursive:true});assert.equal(await realpath(parent),parent);
 const directory=path.join(parent,runId);await mkdir(directory,{mode:0o700});assert.equal(await realpath(directory),directory);
 for(const[name,value]of [['controller.mjs',compiled.source],['manifest.json',JSON.stringify(compiled.manifest,null,2)+'\n']])
  await writeFile(path.join(directory,name),value,{flag:'wx',mode:0o600});
 process.stdout.write(JSON.stringify({prepared:true,execution_enabled:compiled.manifest.execution_enabled,database_executed:false,run_id:runId,
  generated_source_sha256:compiled.manifest.generated_source_sha256,python_sha256:PYTHON_SHA,
  prepared_directory:path.relative(ROOT,directory).replaceAll('\\','/')})+'\n');
}
async function execute(runId){
 const {EXECUTION_ENABLED,compileGate36}=await import('./controller.mjs');assert(EXECUTION_ENABLED,'ATTEMPT36_GATE_ROOT_REVIEW_REQUIRED');
 assert(typeof runId==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(runId));await verifyPython(ROOT);
 const directory=path.join(ROOT,'.local/m07-attempt36-gate-prepared',runId);assert.equal(await realpath(directory),directory);
 async function read(name){const file=path.join(directory,name),info=await lstat(file);assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.size<8*1024*1024);assert.equal(await realpath(file),file);return readFile(file);}
 const manifest=JSON.parse((await read('manifest.json')).toString('utf8')),sources=await loadSources(),compiled=compileGate36(sources,{root:ROOT,runId});
 verifyPrepared(compiled,manifest,await read('controller.mjs'),runId);
 await writeFile(path.join(directory,'execution-claim.json'),JSON.stringify({run_id:runId,claimed_at:new Date().toISOString(),dispatch_may_have_occurred:true,
  source_sha256:compiled.manifest.generated_source_sha256,source_pins:compiled.manifest.source_sha256,python_sha256:PYTHON_SHA,automatic_retry:false})+'\n',{flag:'wx',mode:0o600});
 const code=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--import','tsx',path.join(directory,'controller.mjs')],{cwd:ROOT,shell:false,windowsHide:true,env:executionEnvironment(),stdio:'inherit'});
  child.once('error',()=>reject(Error('ATTEMPT36_GATE_EXECUTION_UNCONFIRMED')));child.once('close',resolve);
 });
 await writeFile(path.join(directory,'execution-returned.json'),JSON.stringify({run_id:runId,observed_at:new Date().toISOString(),close_event_observed:true,
  normal_process_return_observed:typeof code==='number',exit_code:typeof code==='number'?code:null,source_sha256:compiled.manifest.generated_source_sha256,
  acceptance_requires_controller_receipt_and_cleanup:true})+'\n',{flag:'wx',mode:0o600});process.exitCode=typeof code==='number'?code:1;
}
async function main(){
 assert(!process.env.NODE_OPTIONS&&/^v24\./u.test(process.version));const[action,runId,...extra]=process.argv.slice(2);assert.equal(extra.length,0);
 if(action==='prepare'){assert.equal(runId,undefined);await prepare();}else if(action==='execute')await execute(runId);else throw Error('ATTEMPT36_GATE_ARGUMENTS_INVALID');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('ATTEMPT36_GATE_OPERATION_UNCONFIRMED\n');process.exitCode=1;});
