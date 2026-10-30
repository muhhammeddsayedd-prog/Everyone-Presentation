/** Append only public MCP settings after independent canonical binding readback. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat,mkdir,open,readFile,realpath,rename,unlink,writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseEnv,TextDecoder } from 'node:util';
import { pathToFileURL } from 'node:url';
const ROOT=path.resolve(import.meta.dirname,'../../..');
const TARGET='pyibofyctwnqpvktepse';
const hash=b=>createHash('sha256').update(b).digest('hex');
const HOOK_CHECKS=['owner_and_body','auth_admin_execute','no_public_client_execute','auth_admin_schema','auth_admin_no_other_eps_execute','no_issuer_schema_create','registry_forced_rls','capability_forced_rls'];
export function privateAcl(file,action){
 assert.equal(process.platform,'win32');assert(['protect','verify'].includes(action));
 const command=String.raw`$ErrorActionPreference='Stop';$taskFile=$env:EPS_M07_MCP_ACL_FILE;$taskSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;if($env:EPS_M07_MCP_ACL_ACTION -eq 'protect'){$taskAcl=New-Object System.Security.AccessControl.FileSecurity;$taskAcl.SetAccessRuleProtection($true,$false);$taskAcl.SetOwner($taskSid);foreach($taskPrincipal in @($taskSid,[System.Security.Principal.SecurityIdentifier]'S-1-5-18')){$taskRule=New-Object System.Security.AccessControl.FileSystemAccessRule($taskPrincipal,'FullControl','Allow');$taskAcl.AddAccessRule($taskRule)};Set-Acl -LiteralPath $taskFile -AclObject $taskAcl};$taskActual=Get-Acl -LiteralPath $taskFile;if(-not $taskActual.AreAccessRulesProtected -or $taskActual.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $taskSid.Value){throw 'ACL_INVALID'};$taskRules=@($taskActual.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]));if($taskRules.Count -ne 2){throw 'ACL_INVALID'};foreach($taskRule in $taskRules){if($taskRule.IdentityReference.Value -notin @($taskSid.Value,'S-1-5-18') -or $taskRule.IsInherited -or $taskRule.AccessControlType -ne 'Allow' -or ($taskRule.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::FullControl) -ne [System.Security.AccessControl.FileSystemRights]::FullControl){throw 'ACL_INVALID'}};Write-Output 'VERIFIED'`;
 const result=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,env:{...process.env,EPS_M07_MCP_ACL_FILE:file,EPS_M07_MCP_ACL_ACTION:action},stdio:['ignore','pipe','pipe'],encoding:'utf8',timeout:15000,maxBuffer:4096});
 assert.equal(result.trim(),'VERIFIED');
}
async function main(){
 assert.equal(process.argv.length,4);const client=process.argv[2],relative=process.argv[3].replaceAll('\\','/');
 assert(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(client));
 assert(/^tracking\/evidence\/m07\/app-oauth\/[0-9TZ-]+-inspect-binding\.json$/u.test(relative));
 const receiptFile=path.join(ROOT,relative);assert.equal((await realpath(receiptFile)).toLowerCase(),receiptFile.toLowerCase());assert(!(await lstat(receiptFile)).isSymbolicLink());
 const receiptBytes=await readFile(receiptFile);assert(receiptBytes.length<128*1024);const receipt=JSON.parse(receiptBytes.toString('utf8'));
 assert.deepEqual(Object.keys(receipt).sort(),['observed_at','target','action','scope','result','sources','raw_diagnostics_suppressed','exit_code','inspection'].sort());
 assert.equal(receipt.result,'passed');assert.equal(receipt.action,'inspect');assert.equal(receipt.target,TARGET);assert.equal(receipt.inspection.hook_present,true);assert.equal(receipt.inspection.history.length,30);
 assert.deepEqual(Object.keys(receipt.inspection).sort(),['database','operator','history','bindings','hook_present','hook_security','settings'].sort());
 assert.equal(receipt.inspection.database,'postgres');assert.equal(receipt.inspection.operator,'postgres');
 assert.deepEqual(Object.keys(receipt.inspection.hook_security).sort(),HOOK_CHECKS.slice().sort());assert(Object.values(receipt.inspection.hook_security).every(x=>x===true));
 const {readdir}=await import('node:fs/promises');const versions=(await readdir(path.join(ROOT,'supabase/migrations'))).filter(x=>x.endsWith('.sql')).map(x=>x.slice(0,14)).sort();assert.equal(versions.length,30);assert(versions.every(x=>/^[0-9]{14}$/u.test(x)));assert.deepEqual(receipt.inspection.history,versions);
 assert.deepEqual(receipt.inspection.bindings,[{resource:'http://127.0.0.1:3000/mcp',client_id:client,enabled:true}]);
 for(const[p,h]of Object.entries(receipt.sources)){assert(['development/m07/app-oauth/bind-client.py','development/m07/app-oauth/bind-client.sql','development/m07/app-oauth/inspect-binding.sql'].includes(p));assert.equal(hash(await readFile(path.join(ROOT,p))),h);}
 assert.equal(Object.keys(receipt.sources).length,3);
 const file=path.join(ROOT,'apps/web/.env.local'),state=await lstat(file);assert(state.isFile()&&!state.isSymbolicLink()&&state.size<1024*1024);assert.equal((await realpath(file)).toLowerCase(),file.toLowerCase());
 const before=await readFile(file),text=new TextDecoder('utf8',{fatal:true}).decode(before),parsed=parseEnv(text);
 assert.equal(parsed.SUPABASE_URL,`https://${TARGET}.supabase.co`);
 const values={MCP_AUTH_MODE:'oauth',MCP_RESOURCE_URL:'http://127.0.0.1:3000/mcp',MCP_AUTH_ISSUER:`https://${TARGET}.supabase.co/auth/v1`,MCP_AUTH_CLIENT_IDS:client};
 const present=Object.keys(values).filter(k=>Object.hasOwn(parsed,k));
 if(present.length){assert.equal(present.length,4);assert(present.every(k=>parsed[k]===values[k]));process.stdout.write(JSON.stringify({result:'already_configured',public_settings:values,runtime_verified:false})+'\n');return;}
 const suffix=Buffer.from(`${text.endsWith('\n')?'':'\n'}\n# Local Studio OAuth/MCP; public identifiers, no client secret.\n${Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')}\n`);
 const after=Buffer.concat([before,suffix]),temporary=`${file}.mcp-${client}.tmp`;
 const temporaryHandle=await open(temporary,'wx',0o600);try{privateAcl(temporary,'protect');privateAcl(temporary,'verify');await temporaryHandle.writeFile(after);await temporaryHandle.sync();}finally{await temporaryHandle.close();}
 try{assert((await readFile(file)).equals(before));await rename(temporary,file);}finally{try{await unlink(temporary);}catch(error){if(error.code!=='ENOENT')throw error;}}
 const actual=await readFile(file);assert(actual.equals(after));const final=parseEnv(actual.toString('utf8'));assert(Object.entries(values).every(([k,v])=>final[k]===v));
 privateAcl(file,'verify');
 assert(Object.entries(parsed).every(([k,v])=>final[k]===v));
 const directory=path.join(ROOT,'.local/m07-app-oauth');await mkdir(directory,{recursive:true});
 const report={observed_at:new Date().toISOString(),result:'configured_file_not_runtime_verified',public_settings:values,other_configuration_bytes_preserved:true,windows_private_acl_verified_before_write_and_after_rename:true,binding_readback:relative,binding_readback_sha256:hash(receiptBytes),harness_sha256:hash(await readFile(import.meta.filename)),claude_code_modified:false,credentials_created:false};
 await writeFile(path.join(directory,`configured-${client}.json`),JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify(report)+'\n');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('Local MCP configuration unconfirmed; private diagnostics suppressed. Inspect before any repeat.\n');process.exitCode=1;});
