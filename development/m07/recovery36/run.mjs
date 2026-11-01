/** New finite operator. Prepare is source-only; execution starts disabled. */
import assert from 'node:assert/strict';
import {mkdir,lstat,readFile,writeFile,realpath} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,loadSources,compileRecovery36,EXECUTION_ENABLED,sha} from './compiler.mjs';
const BASE=path.join(ROOT,'.local/m07-recovery36-prepared');
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
function environment(){const value={NODE_ENV:'test'};for(const k of ['PATH','SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG'])if(typeof process.env[k]==='string')value[k]=process.env[k];return value;}
async function protect(directory){
 await mkdir(directory,{mode:0o700});assert.equal(await realpath(directory),directory);
 if(process.platform!=='win32'){assert.equal((await lstat(directory)).mode&0o777,0o700);return;}
 const script="$ErrorActionPreference='Stop';$p=$env:EPS_RECOVERY36_PREPARED;$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=New-Object System.Security.AccessControl.DirectorySecurity;$acl.SetAccessRuleProtection($true,$false);foreach($s in @($sid,[System.Security.Principal.SecurityIdentifier]'S-1-5-18')){$r=New-Object System.Security.AccessControl.FileSystemAccessRule($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$acl.AddAccessRule($r)};Set-Acl -LiteralPath $p -AclObject $acl;$a=Get-Acl -LiteralPath $p;if(-not $a.AreAccessRulesProtected){throw 'ACL_INVALID'};foreach($r in $a.Access){if($r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin @($sid.Value,'S-1-5-18')){throw 'ACL_INVALID'}};Write-Output 'VERIFIED'";
 const result=await child('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{...environment(),EPS_RECOVERY36_PREPARED:directory},15000);assert.equal(result.code,0);assert.equal(result.stdout.trim(),'VERIFIED');
}
async function child(executable,args,env,timeout){return new Promise((resolve,reject)=>{
 let stdout='',stderr='',size=0,timedOut=false;const child=spawn(executable,args,{cwd:ROOT,shell:false,windowsHide:true,env,stdio:['ignore','pipe','pipe']});
 const timer=setTimeout(()=>{timedOut=true;child.kill();},timeout);
 for(const[stream,key]of[[child.stdout,'out'],[child.stderr,'err']])stream.on('data',b=>{size+=b.length;if(size>128*1024)child.kill();else if(key==='out')stdout+=b;else stderr+=b;});
 child.once('error',()=>{clearTimeout(timer);reject(Error('RECOVERY36_CHILD_UNCONFIRMED'));});child.once('close',code=>{clearTimeout(timer);if(timedOut||size>128*1024)reject(Error('RECOVERY36_CHILD_UNCONFIRMED'));else resolve({code,stdout,stderr});});
 });}
async function checked(file){const stat=await lstat(file);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<8*1024*1024&&await realpath(file)===file);return readFile(file);}
export async function prepare(){
 assert(!process.env.NODE_OPTIONS&&/^v24\./u.test(process.version));const sources=await loadSources(),runId=randomUUID();
 const compiled=compileRecovery36(sources,{root:ROOT,runId});await mkdir(BASE,{recursive:true});assert.equal(await realpath(BASE),BASE);
 const directory=path.join(BASE,runId);await protect(directory);
 await writeFile(path.join(directory,'controller.mjs'),compiled.source,{flag:'wx',mode:0o600});await writeFile(path.join(directory,'manifest.json'),JSON.stringify(compiled.manifest),{flag:'wx',mode:0o600});
 return{result:'prepared',run_id:runId,execution_enabled:EXECUTION_ENABLED,database_executed:false,controller_sha256:sha(compiled.source)};
}
export async function execute(runId){
 assert(EXECUTION_ENABLED,'RECOVERY36_EXECUTION_DISABLED');assert(uuid.test(runId)&&!process.env.NODE_OPTIONS&&/^v24\./u.test(process.version));
 const directory=path.join(BASE,runId);assert.equal(await realpath(BASE),BASE);assert.equal(await realpath(directory),directory);
 const sources=await loadSources(),compiled=compileRecovery36(sources,{root:ROOT,runId});
 assert.deepEqual(JSON.parse(await checked(path.join(directory,'manifest.json'))),compiled.manifest);
 assert.equal(sha(await checked(path.join(directory,'controller.mjs'))),compiled.manifest.source_sha256);
 await writeFile(path.join(directory,'execution-claim.json'),JSON.stringify({run_id:runId,controller_sha256:compiled.manifest.source_sha256,dispatch_may_have_occurred:true,automatic_retry:false}),{flag:'wx',mode:0o600});
 const returned=await child(process.execPath,['--import','tsx',path.join(directory,'controller.mjs')],environment(),300000);
 await writeFile(path.join(directory,'process-return.json'),JSON.stringify({normal_return_observed:typeof returned.code==='number',exit_code:returned.code,raw_output_retained:false}),{flag:'wx',mode:0o600});
 assert.equal(returned.code,0,'RECOVERY36_EXECUTION_UNCONFIRMED');return{result:'child_returned',run_id:runId,exit_code:returned.code,actual_receipt_required:true};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const[action,value,...extra]=process.argv.slice(2);const task=extra.length?Promise.reject(Error()):action==='prepare'&&value===undefined?prepare():action==='execute'&&typeof value==='string'?execute(value):Promise.reject(Error());
 task.then(v=>process.stdout.write(JSON.stringify(v)+'\n')).catch(()=>{process.stderr.write('RECOVERY36_RUN_UNCONFIRMED\n');process.exitCode=1;});
}
