/** Source preparation and once-only execution, closed until root enables it. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { ROOT, loadSources } from './sources.mjs';

export function executionEnvironment(environment=process.env){
 const value={NODE_ENV:'test'};
 for(const key of ['PATH','SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG'])
  if(typeof environment[key]==='string')value[key]=environment[key];
 return value;
}
export function verifyPrepared(compiled,manifest,controller,runId){
 assert.equal(manifest.run_id,runId);assert.equal(manifest.execution_enabled,true,'SUMMARY35_EXECUTION_NOT_ENABLED');
 assert.deepEqual(manifest,compiled.manifest,'SUMMARY35_PREPARED_MANIFEST_CHANGED');
 assert(Buffer.from(controller).equals(Buffer.from(compiled.source)),'SUMMARY35_PREPARED_CONTROLLER_CHANGED');
}
async function prepare(){
 const sources=await loadSources(),{compileSummary35}=await import('./controller.mjs'),runId=randomUUID();
 const compiled=compileSummary35(sources,{root:ROOT,runId});
 const parent=path.join(ROOT,'.local/m07-workspace-summary35-prepared');await mkdir(parent,{recursive:true});assert.equal(await realpath(parent),parent);
 const directory=path.join(parent,runId);await mkdir(directory,{mode:0o700});assert.equal(await realpath(directory),directory);
 for(const[name,value]of [['controller.mjs',compiled.source],['manifest.json',JSON.stringify(compiled.manifest,null,2)+'\n']])
  await writeFile(path.join(directory,name),value,{flag:'wx',mode:0o600});
 process.stdout.write(JSON.stringify({prepared:true,execution_enabled:compiled.manifest.execution_enabled,database_executed:false,run_id:runId,
  generated_source_sha256:compiled.manifest.generated_source_sha256,prepared_directory:path.relative(ROOT,directory).replaceAll('\\','/')})+'\n');
}
async function execute(runId){
 const {EXECUTION_ENABLED,compileSummary35}=await import('./controller.mjs');
 assert(EXECUTION_ENABLED,'SUMMARY35_ROOT_REVIEW_REQUIRED');
 assert(typeof runId==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(runId),'SUMMARY35_RUN_ID_REQUIRED');
 const directory=path.join(ROOT,'.local/m07-workspace-summary35-prepared',runId);assert.equal(await realpath(directory),directory);
 async function read(name){const file=path.join(directory,name),info=await lstat(file);
  assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.size<8*1024*1024);assert.equal(await realpath(file),file);return readFile(file);}
 const manifest=JSON.parse((await read('manifest.json')).toString('utf8'));
 const sources=await loadSources(),compiled=compileSummary35(sources,{root:ROOT,runId});
 verifyPrepared(compiled,manifest,await read('controller.mjs'),runId);
 await writeFile(path.join(directory,'execution-claim.json'),JSON.stringify({run_id:runId,claimed_at:new Date().toISOString(),
  dispatch_may_have_occurred:true,source_sha256:compiled.manifest.generated_source_sha256,source_pins:compiled.manifest.source_sha256,
  automatic_retry:false})+'\n',{flag:'wx',mode:0o600});
 const code=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--import','tsx',path.join(directory,'controller.mjs')],
   {cwd:ROOT,shell:false,windowsHide:true,env:executionEnvironment(),stdio:'inherit'});
  child.once('error',()=>reject(Error('SUMMARY35_EXECUTION_UNCONFIRMED')));child.once('close',resolve);
 });
 await writeFile(path.join(directory,'execution-returned.json'),JSON.stringify({run_id:runId,observed_at:new Date().toISOString(),
  close_event_observed:true,normal_process_return_observed:typeof code==='number',exit_code:typeof code==='number'?code:null,source_sha256:compiled.manifest.generated_source_sha256,
  acceptance_requires_controller_receipt_and_cleanup:true})+'\n',{flag:'wx',mode:0o600});
 process.exitCode=typeof code==='number'?code:1;
}
async function main(){
 assert(!process.env.NODE_OPTIONS&&/^v24\./u.test(process.version));
 const[action,runId,...extra]=process.argv.slice(2);assert.equal(extra.length,0);
 if(action==='prepare'){assert.equal(runId,undefined);await prepare();}
 else if(action==='execute')await execute(runId);
 else throw Error('SUMMARY35_ARGUMENTS_INVALID');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{
 process.stderr.write('SUMMARY35_PREPARATION_UNCONFIRMED\n');process.exitCode=1;
});
