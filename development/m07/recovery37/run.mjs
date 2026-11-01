/** NEW root-only preparation/one-claim runner. Importing is inert. */
import assert from 'node:assert/strict';
import {mkdir,lstat,realpath,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,EXECUTION_ENABLED,loadSources,compileRecovery37,sha} from './compiler.mjs';
import {executionEnvironment} from '../workspace-summary35-proof/run.mjs';
const BASE=path.join(ROOT,'.local/m07-recovery37-prepared');
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
function runtime(){assert.equal(process.version,'v24.18.0');assert(!process.env.NODE_OPTIONS&&!process.env.NPM_CONFIG_NODE_OPTIONS);}
async function child(exe,args,env,timeout){return new Promise((resolve,reject)=>{
 const p=spawn(exe,args,{cwd:ROOT,env,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});let bytes=0,stdout='',timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;p.kill();},timeout);
 p.stdout.on('data',b=>{bytes+=b.length;if(bytes>128*1024)p.kill();else stdout+=b;});p.stderr.on('data',b=>{bytes+=b.length;if(bytes>128*1024)p.kill();});
 p.once('error',()=>{clearTimeout(timer);reject(Error('RECOVERY37_CHILD_UNCONFIRMED'));});p.once('close',(code,signal)=>{clearTimeout(timer);if(timedOut||bytes>128*1024)reject(Error('RECOVERY37_CHILD_UNCONFIRMED'));else resolve({code,signal,stdout});});
});}
async function protect(directory){
 await mkdir(directory,{mode:0o700});assert.equal(await realpath(directory),directory);
 if(process.platform!=='win32'){assert.equal((await lstat(directory)).mode&0o777,0o700);return;}
 const script="$ErrorActionPreference='Stop';$p=$env:EPS_RECOVERY37_PREPARED;$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$a=New-Object System.Security.AccessControl.DirectorySecurity;$a.SetOwner($sid);$a.SetAccessRuleProtection($true,$false);foreach($s in @($sid,[System.Security.Principal.SecurityIdentifier]'S-1-5-18')){$r=New-Object System.Security.AccessControl.FileSystemAccessRule($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$a.AddAccessRule($r)};Set-Acl -LiteralPath $p -AclObject $a;$a=Get-Acl -LiteralPath $p;if(-not $a.AreAccessRulesProtected-or$a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value-ne$sid.Value){throw 'ACL_INVALID'};$seen=@();foreach($r in $a.Access){$id=$r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value;if($r.AccessControlType-ne'Allow'-or$id-notin@($sid.Value,'S-1-5-18')-or$r.FileSystemRights-ne'FullControl'){throw 'ACL_INVALID'};$seen+=$id};if($seen.Count-ne2-or$sid.Value-notin$seen-or'S-1-5-18'-notin$seen){throw 'ACL_INVALID'};Write-Output 'VERIFIED'";
 const result=await child(path.join(process.env.SystemRoot??'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',script],{...executionEnvironment(),EPS_RECOVERY37_PREPARED:directory},15000);
 assert.equal(result.code,0);assert.equal(result.stdout.trim(),'VERIFIED');
}
async function checked(file){const s=await lstat(file);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<8*1024*1024&&await realpath(file)===file);return readFile(file);}
export async function prepare(){
 assert(EXECUTION_ENABLED,'RECOVERY37_EXECUTION_DISABLED');runtime();const sources=await loadSources(),runId=randomUUID(),compiled=compileRecovery37(sources,{root:ROOT,runId});
 await mkdir(BASE,{recursive:true});assert.equal(await realpath(BASE),BASE);const directory=path.join(BASE,runId);await protect(directory);
 await writeFile(path.join(directory,'controller.mjs'),compiled.source,{flag:'wx',mode:0o600});await writeFile(path.join(directory,'manifest.json'),JSON.stringify(compiled.manifest),{flag:'wx',mode:0o600});
 return{result:'prepared',run_id:runId,execution_enabled:EXECUTION_ENABLED,controller_sha256:sha(compiled.source),database_executed:false,native_executed:false};
}
export async function execute(runId){
 assert(EXECUTION_ENABLED,'RECOVERY37_EXECUTION_DISABLED');runtime();assert(UUID.test(runId));const directory=path.join(BASE,runId);
 assert.equal(await realpath(BASE),BASE);assert.equal(await realpath(directory),directory);
 const sources=await loadSources(),compiled=compileRecovery37(sources,{root:ROOT,runId});assert.deepEqual(JSON.parse(await checked(path.join(directory,'manifest.json'))),compiled.manifest);
 assert.equal(sha(await checked(path.join(directory,'controller.mjs'))),compiled.manifest.source_sha256);
 await writeFile(path.join(directory,'execution-claim.json'),JSON.stringify({run_id:runId,source_sha256:compiled.manifest.source_sha256,source_pins:compiled.manifest.source_pins,dispatch_may_have_occurred:true,automatic_retry:false}),{flag:'wx',mode:0o600});
 const result=await child(process.execPath,['--import','tsx',path.join(directory,'controller.mjs')],executionEnvironment(),600000);
 await writeFile(path.join(directory,'process-return.json'),JSON.stringify({close_observed:true,normal_process_return_observed:typeof result.code==='number',exit_code:result.code,signal:result.signal,raw_output_retained:false}),{flag:'wx',mode:0o600});
 assert.equal(result.code,0,'RECOVERY37_EXECUTION_UNCONFIRMED');return{result:'child_returned',run_id:runId,actual_receipt_and_full_cleanup_required:true};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){const[action,value,...extra]=process.argv.slice(2);
 const task=extra.length?Promise.reject(Error()):action==='prepare'&&value===undefined?prepare():action==='execute'&&typeof value==='string'?execute(value):Promise.reject(Error());
 task.then(v=>process.stdout.write(JSON.stringify(v)+'\n')).catch(()=>{process.stderr.write('RECOVERY37_RUN_UNCONFIRMED\n');process.exitCode=1;});}
