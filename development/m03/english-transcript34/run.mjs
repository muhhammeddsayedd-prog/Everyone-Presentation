/** Preparation compiles source only. Root owns actual once-only SQL dispatch. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat,mkdir,readFile,realpath,writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL,URL } from 'node:url';

const ROOT=path.resolve(import.meta.dirname,'../../..');
async function inputs(){
 const pins=JSON.parse(await readFile(new URL('./recovery-source-pins.json',import.meta.url),'utf8'));
 const sha=bytes=>import('node:crypto').then(({createHash})=>createHash('sha256').update(bytes).digest('hex'));
 for(const[file,expected]of Object.entries(pins))assert.equal(await sha(await readFile(path.join(ROOT,file))),expected,'ENGLISH34_RECOVERY_SOURCE_CHANGED');
 const cleanupFile='tracking/evidence/m07/recovery33/2026-10-31T15-01-22.518Z-533-guarded-cleanup.json';
 assert(Object.hasOwn(pins,cleanupFile),'ENGLISH34_ACTUAL_CLEANUP_PROOF_REQUIRED');
 const cleanup=JSON.parse(await readFile(path.join(ROOT,cleanupFile),'utf8'));
 assert.equal(cleanup.run_id,'5332c86b-b1f9-410e-8702-647031182b17');
 for(const key of ['original_baseline_exact','original_full_catalogue_exact','all_preexisting_global_roles_exact','both_task_databases_absent','no_other_clients','independent_read_only_postcheck','lock_released'])assert.equal(cleanup[key],true,'ENGLISH34_ACTUAL_CLEANUP_PROOF_REQUIRED');
 assert.deepEqual(cleanup.role_oids_removed,['185012','185052']);
 const {SOURCE_PINS}=await import('../../m07/recovery33/compiler.mjs');
 const {FILES33}=await import('../../m07/recovery33/run.mjs');
 const {FILES34,FIXTURES34,MIGRATION34}=await import('./controller.mjs');
 const files=[...Object.keys(pins),...Object.keys(SOURCE_PINS),...FILES33,...FILES34,...FIXTURES34,MIGRATION34,'development/m03/english-transcript34/recovery-source-pins.json'];
 return new Map(await Promise.all([...new Set(files)].map(async file=>{
  const target=path.join(ROOT,file),info=await lstat(target);assert(info.isFile()&&!info.isSymbolicLink()&&info.size<8*1024*1024);
  assert.equal(path.resolve(await realpath(target)),target);const bytes=await readFile(target),historical=/\/source-history\/([a-f0-9]{64})-/u.exec(file);
  if(historical)assert.equal(await sha(bytes),historical[1],'ENGLISH34_HISTORICAL_SOURCE_CHANGED');return[file,bytes];
 })));
}
async function prepare(){
 const sources=await inputs();const {compileEnglish34}=await import('./controller.mjs');const runId=randomUUID();
 const compiled=compileEnglish34(sources,{root:ROOT,runId});
 const parent=path.join(ROOT,'.local/m03-english34-prepared');await mkdir(parent,{recursive:true});assert.equal(await realpath(parent),parent);
 const directory=path.join(parent,runId);await mkdir(directory,{mode:0o700});assert.equal(await realpath(directory),directory);
 // Prepared sources contain no payload or credentials. Runtime artifacts use the
 // existing parent controller's protected ACL helper before any dump/SQL proof.
 for(const[name,value]of [['controller.mjs',compiled.source],['manifest.json',JSON.stringify(compiled.manifest,null,2)+'\n']])
  await writeFile(path.join(directory,name),value,{flag:'wx',mode:0o600});
 process.stdout.write(JSON.stringify({prepared:true,database_executed:false,execution_enabled:compiled.manifest.execution_enabled,run_id:runId,
  generated_source_sha256:compiled.manifest.generated_source_sha256,private_prepared_directory:path.relative(ROOT,directory).replaceAll('\\','/')})+'\n');
}
async function execute(runId){
 const {EXECUTION_ENABLED,compileEnglish34}=await import('./controller.mjs');
 assert(EXECUTION_ENABLED,'ENGLISH34_RECOVERY_DEPENDENCY_NOT_RELEASED');
 assert(typeof runId==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(runId));
 const directory=path.join(ROOT,'.local/m03-english34-prepared',runId);assert.equal(await realpath(directory),directory);
 const read=async name=>{const file=path.join(directory,name),info=await lstat(file);assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.size<8*1024*1024);assert.equal(await realpath(file),file);return readFile(file);};
 const manifest=JSON.parse((await read('manifest.json')).toString('utf8'));assert.equal(manifest.run_id,runId);assert.equal(manifest.execution_enabled,true);
 const sources=await inputs(),compiled=compileEnglish34(sources,{root:ROOT,runId});assert.deepEqual(manifest,compiled.manifest);
 assert((await read('controller.mjs')).equals(Buffer.from(compiled.source)));
 await writeFile(path.join(directory,'execution-claim.json'),JSON.stringify({run_id:runId,claimed_at:new Date().toISOString(),dispatch_may_have_occurred:true,source_sha256:compiled.manifest.generated_source_sha256})+'\n',{flag:'wx',mode:0o600});
 const env={NODE_ENV:'test'};for(const key of ['PATH','SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG'])if(typeof process.env[key]==='string')env[key]=process.env[key];
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',path.join(directory,'controller.mjs')],{cwd:ROOT,shell:false,windowsHide:true,env,stdio:'inherit'});child.on('error',()=>reject(Error('ENGLISH34_EXECUTION_UNCONFIRMED')));child.on('close',resolve);});
 process.exitCode=typeof code==='number'?code:1;
}
async function main(){
 assert(!process.env.NODE_OPTIONS&&/^v24\./u.test(process.version));
 const[action,value,...extra]=process.argv.slice(2);assert.equal(extra.length,0);
 if(action==='prepare'){assert.equal(value,undefined);await prepare();}
 else if(action==='execute')await execute(value);
 else throw Error('ENGLISH34_ARGUMENTS_INVALID');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)
 main().catch(()=>{process.stderr.write('ENGLISH34_PREPARATION_UNCONFIRMED\n');process.exitCode=1;});
