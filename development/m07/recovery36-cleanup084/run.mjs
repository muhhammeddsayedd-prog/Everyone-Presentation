/** Fixed cleanup purpose; both operational entries start disabled. */
import assert from 'node:assert/strict';
import {readFile,lstat,realpath,writeFile,unlink} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {RUN,SYSTEM,LOCK_SHA,sha,scopeSql,validateScope,withoutOwnedCatalogue,withoutOwnedGlobals,dropSql,profileSqlBefore} from './cleanup.mjs';
export const OBSERVATION_ENABLED=true;
export const CLEANUP_ENABLED=true;
export function assertEntryEnabled(name,enabled){assert.equal(typeof enabled,'boolean');assert(enabled,`CLEANUP084_${name}_DISABLED`);}
export const ROOT=path.resolve(import.meta.dirname,'../../..');
const PRIVATE=`.local/m07-recovery/${RUN}/`,PREPARED=`.local/m07-recovery36-prepared/${RUN}/`;
const ARCHIVE='development/m07/recovery36/source-history/0843096a/source-archive.json';
const FAILED='tracking/evidence/m07/recovery36/2026-11-01T03-01-28-673Z-0843096a.json';
const LOCK='.local/local-postgres/test-db.lock';
const ownFiles=['cleanup.mjs','run.mjs','cleanup.test.mjs','README.md'].map(f=>'development/m07/recovery36-cleanup084/'+f);
const pin={
 [ARCHIVE]:'c53c097fa64c049f74faf43fbabf279c45fc041f89321c55f44dc50f6a4edada',
 [FAILED]:'a8afd078f84532515336828583be33f4a80cff46111a2aa717aeabf8ea933a72',
 [PRIVATE+'owner.json']:'24dde0ee251f8a151647b9d7299d4445986e17c5e48bd683e244e017364a7406',
 [PRIVATE+'original29-full-auth-storage-catalogue.json']:'7bfeb27ac544ee245e487ce646fac7db6d2826372f179480145f81fcdc738dc4',
 [PREPARED+'process-return.json']:'6426483d8533cb1afd7909707b19dd666ba0370d6bf153ddb36e2938da17c0f9',
 [PREPARED+'controller.mjs']:'c2ccbd784704ed03b65432ec3b8fe71aa3f834f23833f6e1d9d37ebdf123db6c',
};
async function checked(relative,digest){
 assert(typeof relative==='string'&&!path.isAbsolute(relative)&&!relative.split(/[\\/]/u).includes('..'));
 const target=path.join(ROOT,relative);let part=ROOT;for(const segment of relative.split('/')){part=path.join(part,segment);assert(!(await lstat(part)).isSymbolicLink());assert.equal(await realpath(part),part);}
 const s=await lstat(target);assert(s.isFile()&&s.nlink===1&&s.size<=8*1024*1024);const bytes=await readFile(target);assert.equal(bytes.length,s.size);if(digest)assert.equal(sha(bytes),digest,'CLEANUP084_SOURCE_CHANGED');return bytes;
}
async function privateAcl(){
 const directory=path.join(ROOT,PRIVATE);assert.equal(process.platform,'win32','CLEANUP084_REVIEWED_WINDOWS_ONLY');
 const script="$ErrorActionPreference='Stop';$p=$env:EPS_CLEANUP084_DIRECTORY;$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$a=Get-Acl -LiteralPath $p;if(-not $a.AreAccessRulesProtected){throw 'ACL_INVALID'};foreach($r in $a.Access){if($r.AccessControlType -ne 'Allow' -or $r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin @($sid.Value,'S-1-5-18')){throw 'ACL_INVALID'}};Write-Output 'VERIFIED'";
 const env={EPS_CLEANUP084_DIRECTORY:directory};for(const k of ['SystemRoot','WINDIR','PATH'])if(process.env[k])env[k]=process.env[k];
 await new Promise((resolve,reject)=>{const c=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{cwd:ROOT,shell:false,windowsHide:true,env,stdio:['ignore','pipe','pipe']});let out='',size=0;const timer=setTimeout(()=>{c.kill();reject(Error('CLEANUP084_ACL_UNCONFIRMED'));},15000);c.stdout.on('data',b=>{size+=b.length;if(size>1024)c.kill();else out+=b;});c.stderr.resume();c.once('error',()=>{clearTimeout(timer);reject(Error('CLEANUP084_ACL_UNCONFIRMED'));});c.once('close',code=>{clearTimeout(timer);if(code===0&&out.trim()==='VERIFIED')resolve();else reject(Error('CLEANUP084_ACL_UNCONFIRMED'));});});
}
async function sourceContext(){
 assert(!process.env.NODE_OPTIONS&&/^v24\./u.test(process.version));
 for(const[f,h]of Object.entries(pin))await checked(f,h);
 const archive=JSON.parse(await checked(ARCHIVE,pin[ARCHIVE]));assert.equal(archive.failed_run_id,RUN);assert.equal(archive.all129_source_pins_matched_at_archive,true);assert.equal(Object.keys(archive.source_pins).length,129);assert.equal(archive.replay_allowed,false);
 const sources=new Map();for(const[f,h]of Object.entries(archive.source_pins))sources.set(f,await checked(f,h));
 const ownPins={};for(const f of ownFiles)ownPins[f]=sha(await checked(f));
 const report=JSON.parse(await checked(FAILED,pin[FAILED]));assert.equal(report.result,'failed');assert.equal(report.cleanup_unconfirmed,true);assert.equal(report.disposable_databases_removed,true);assert.equal(report.existing_global_roles_before.roles.length,58);assert.equal(report.existing_global_roles_before.memberships.length,94);
 assert.deepEqual(JSON.parse(await checked(PREPARED+'process-return.json',pin[PREPARED+'process-return.json'])),{normal_return_observed:true,exit_code:1,raw_output_retained:false});
 assert.deepEqual(JSON.parse(await checked(PRIVATE+'owner.json',pin[PRIVATE+'owner.json'])),{run_id:RUN,purpose:'m07-synthetic-local-recovery',workspace:ROOT});
 const compiler=await import('../recovery33/compiler.mjs');
 const sql=compiler.staticControllerSql33(compiler.compileController33(sources,{root:ROOT,runId:RUN,mode:'metadata'}).source);
 const catalogueSql=compiler.fullCatalogue33Sql(sources).sql;
 const profileModule=await import('../../../tools/m07-original-profile29-comparison.mjs');
 const profile=await profileModule.loadOriginalProfile29();const plan=JSON.parse(await checked(profile.plan,profile.plan_sha256));
 const local=await import('../../../tools/local-postgres.mjs');
 const target=await local.verifyLocalTarget();assert.equal(target.observed.system_identifier,SYSTEM);
 return{report,sources,ownPins,sql,catalogueSql,profile,profileModule,version:plan.version,local,containerId:target.container.Id,originalCatalogue:JSON.parse(await checked(PRIVATE+'original29-full-auth-storage-catalogue.json',pin[PRIVATE+'original29-full-auth-storage-catalogue.json']))};
}
// Exact frozen controller connection: owned container Unix socket, local managed
// administrator only for system-catalogue locks/DROP. No environment credentials.
async function adminDrop(ctx,sql){
 const target=await ctx.local.verifyLocalTarget();assert.equal(target.observed.system_identifier,SYSTEM);assert(/^[a-f0-9]{64}$/u.test(target.container.Id));
 assert.equal(target.container.Id,ctx.containerId);assert(Buffer.byteLength(sql)<=512*1024);
 const identity=`do $identity084$begin if current_database()<>'postgres' or current_user<>'supabase_admin' or session_user<>'supabase_admin' or not(select rolsuper from pg_roles where rolname=current_user) or (pg_control_system()).system_identifier::text<>'${SYSTEM}' then raise exception 'CLEANUP084_LOCAL_ADMIN_REQUIRED';end if;end$identity084$;`;
 const args=['--host','npipe:////./pipe/dockerDesktopLinuxEngine','exec','--user','postgres','-i',target.container.Id,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','supabase_admin','-d','postgres'];
 const env={};for(const k of ['PATH','SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];
 await new Promise((resolve,reject)=>{const c=spawn('docker',args,{cwd:ROOT,shell:false,windowsHide:true,env,stdio:['pipe','pipe','pipe']});let size=0;const timer=setTimeout(()=>{c.kill();reject(Error('CLEANUP084_DROP_UNCONFIRMED'));},45000);for(const stream of [c.stdout,c.stderr])stream.on('data',b=>{size+=b.length;if(size>64*1024)c.kill();});c.stdin.on('error',()=>{});c.once('error',()=>{clearTimeout(timer);reject(Error('CLEANUP084_DROP_UNCONFIRMED'));});c.once('close',code=>{clearTimeout(timer);if(code===0&&size<=64*1024)resolve();else reject(Error('CLEANUP084_DROP_UNCONFIRMED'));});c.stdin.end("set log_statement='none';set log_min_duration_statement=-1;"+identity+sql);});
 return{system_identifier:SYSTEM};
}
export function parseRows(text){assert(typeof text==='string'&&Buffer.byteLength(text)<=8*1024*1024);return text.split(/\r?\n/u).filter(x=>x.startsWith('{')).map(x=>JSON.parse(x));}
async function value(ctx,sql){const result=await ctx.local.runOwnedLocalSql(sql);assert.equal(result.system_identifier,SYSTEM);const rows=parseRows(result.stdout);assert.equal(rows.length,1,'CLEANUP084_ONE_METADATA_ROW_REQUIRED');return rows[0];}
async function lock(){const raw=await checked(LOCK,LOCK_SHA);assert.deepEqual(JSON.parse(raw),{run_id:RUN,pid:11392});return raw;}
async function readState(ctx,{before}){
 const baseline=await value(ctx,ctx.sql.baselineSql);
 const catalogue=await value(ctx,"begin read only;set local search_path='';set local timezone='UTC';"+ctx.catalogueSql+'rollback;');
 const rawProfile=await checked(ctx.profile.readback_query,ctx.profile.readback_sha256).then(x=>x.toString('utf8'));
 const profile=await value(ctx,before?profileSqlBefore(rawProfile):rawProfile);
 const globals=await value(ctx,ctx.sql.rolesSql);
 const scope=await value(ctx,'begin read only;'+scopeSql()+';rollback;');
 return{baseline,catalogue,profile,globals,scope};
}
export function assertPreserved(state,ctx,{before}){
 assert.equal(sha(JSON.stringify(state.baseline)),ctx.report.original_baseline_sha256,'CLEANUP084_ROWS_OR_FUNCTIONS_CHANGED');
 ctx.profileModule.assertExactProfileAfter(state.profile,ctx.profile,ctx.version);
 assert.deepEqual(before?withoutOwnedGlobals(state.globals,state.scope):state.globals,ctx.report.existing_global_roles_before,'CLEANUP084_ORIGINAL_GLOBALS_CHANGED');
 assert.deepEqual(before?withoutOwnedCatalogue(state.catalogue,state.scope):state.catalogue,ctx.originalCatalogue,'CLEANUP084_FULL_ORIGINAL_CATALOGUE_CHANGED');
 assert.deepEqual(state.scope.databases,[]);if(!before)assert.deepEqual(state.scope.roles,[null,null,null]);
 return true;
}
async function privateWrite(name,value){await writeFile(path.join(ROOT,PRIVATE+name),JSON.stringify(value),{flag:'wx',mode:0o600});}
function publicResult(phase,ctx,state){return{schema_version:'1.0',failed_run_id:RUN,phase,result:'passed',observed_at:new Date().toISOString(),system_identifier:SYSTEM,
 original_rows_functions_profile_exact:true,original29_full_auth_storage_catalogue_exact:true,existing58_roles94_memberships_exact:true,
 owned_role_metadata:state.scope.roles.filter(Boolean),both_disposable_databases_absent:true,
 original_baseline_sha256:sha(JSON.stringify(state.baseline)),observed_full_catalogue_sha256:sha(JSON.stringify(state.catalogue)),observed_profile_sha256:sha(JSON.stringify(state.profile)),observed_global_roles_sha256:sha(JSON.stringify(state.globals)),observed_global_role_count:state.globals.roles.length,observed_global_membership_count:state.globals.memberships.length,source_archive_sha256:pin[ARCHIVE],failed_receipt_sha256:pin[FAILED],source_pins:ctx.ownPins,
 cloud_called:false,provider_called:false,original_database_writes:false,recovery36_acceptance:false,original_failed_controller_replayed:false};}
export async function observe(){
 assertEntryEnabled('OBSERVATION',OBSERVATION_ENABLED);const ctx=await sourceContext();await privateAcl();await lock();
 await privateWrite('cleanup084-observation-claim.json',{failed_run_id:RUN,read_only:true,automatic_retry:false,source_pins:ctx.ownPins});
 const state=await readState(ctx,{before:true});validateScope(state.scope);assertPreserved(state,ctx,{before:true});
 const proof={failed_run_id:RUN,source_pins:ctx.ownPins,baseline_sha256:sha(JSON.stringify(state.baseline)),catalogue_sha256:sha(JSON.stringify(state.catalogue)),profile_sha256:sha(JSON.stringify(state.profile)),globals:state.globals,scope:state.scope,lock_sha256:LOCK_SHA};
 await privateWrite('cleanup084-before-private.json',proof);const result={...publicResult('before',ctx,state),role_cleanup_dispatched:false,shared_test_lock_released:false,before_private_sha256:sha(JSON.stringify(proof))};await privateWrite('cleanup084-before-public.json',result);return result;
}
export async function cleanup(){
 assertEntryEnabled('CLEANUP',CLEANUP_ENABLED);const ctx=await sourceContext();await privateAcl();await lock();
 const proof=JSON.parse(await checked(PRIVATE+'cleanup084-before-private.json'));const admission=JSON.parse(await checked(PRIVATE+'cleanup084-before-public.json'));
 assert.equal(admission.before_private_sha256,sha(JSON.stringify(proof)));assert.equal(admission.result,'passed');assert.equal(proof.failed_run_id,RUN);assert.deepEqual(proof.source_pins,ctx.ownPins);assert.equal(proof.lock_sha256,LOCK_SHA);
 const state=await readState(ctx,{before:true});validateScope(state.scope);assertPreserved(state,ctx,{before:true});assert.deepEqual(state.scope,proof.scope);assert.deepEqual(state.globals,proof.globals);
 for(const[k,v]of[['baseline',state.baseline],['catalogue',state.catalogue],['profile',state.profile]])assert.equal(sha(JSON.stringify(v)),proof[k+'_sha256']);
 const sql=dropSql(state.scope,state.globals,ctx.report.existing_global_roles_before,ctx.sql.rolesSql);
 await privateWrite('cleanup084-execution-claim.json',{failed_run_id:RUN,dispatch_may_have_occurred:true,automatic_retry:false,sql_sha256:sha(sql),before_private_sha256:admission.before_private_sha256,source_pins:ctx.ownPins});
 const executed=await adminDrop(ctx,sql);assert.equal(executed.system_identifier,SYSTEM);
 await privateWrite('cleanup084-drop-return.json',{normal_return_observed:true,raw_output_retained:false,sql_sha256:sha(sql)});
 const after=await readState(ctx,{before:false});assertPreserved(after,ctx,{before:false});
 // All preservation checks must pass before examining and releasing the exact failed lock.
 await lock();await unlink(path.join(ROOT,LOCK));const result={...publicResult('after',ctx,after),three_exact_owned_roles_removed:true,shared_test_lock_released:true,drop_dispatched_once:true};await privateWrite('cleanup084-after-public.json',result);return result;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const[action,...extra]=process.argv.slice(2);const task=extra.length?Promise.reject(Error()):action==='observe'?observe():action==='cleanup'?cleanup():Promise.reject(Error());
 task.then(x=>process.stdout.write(JSON.stringify(x)+'\n')).catch(()=>{process.stderr.write('CLEANUP084_UNCONFIRMED\n');process.exitCode=1;});
}
