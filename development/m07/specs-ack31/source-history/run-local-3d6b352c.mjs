/** NEW owned-local specs ACK31 proof. Root executes only after source review.
 * Historical controllers are source references, never imported or invoked.
 */
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import console from 'node:console';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,open,readFile,realpath,unlink,writeFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {verifyLocalTarget,runOwnedLocalSql} from '../../../tools/local-postgres.mjs';
import {loadOriginalProfile29,assertExactProfileAfter} from '../../../tools/m07-original-profile29-comparison.mjs';
import {normalizeDatabaseOid} from '../recovery29/identity.mjs';
import {cleanupObservation} from '../recovery29/ownership.mjs';
import {makeAdmissionSql,extractIssuerSuffix,ownedIdentityPredicate} from '../issuer-release30-executable/admission.mjs';
import {roleCleanupDecision,validateReleasePlan} from '../issuer-release30-executable/cleanup.mjs';
import {issuerOwnedRestoreProfile} from '../issuer-release30-executable/profile-adapter.mjs';
import {assertPhaseProof,assertProjectionOnlyDelta,assertCleanupComplete,assertAckReadbackResult,ACK_SOURCE_KEY} from './local-proof.mjs';
import {boundedCommand} from './local-command.mjs';
const {structuredClone}=globalThis;

const ROOT=path.resolve(import.meta.dirname,'..','..','..');
const DIR='development/m07/specs-ack31',ISSUER='development/m07/issuer-release30-executable',AREA='tracking/evidence/m07/specs-ack31';
const HOST=process.platform==='win32'?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock';
// Reuse the reviewed issuer30 identity grammar so its strict admission/cleanup
// helpers remain unchanged. The UUID, controller, artifact directory and purpose
// are NEW. No historical database or role is adopted.
const runId=randomUUID(),name='eps_m07_issuer30_'+runId.replaceAll('-',''),marker='eps-m07-issuer30:'+runId;
const folder=path.join(ROOT,'.local/m07-specs-ack31-local',runId),LOCK=path.join(ROOT,'.local/local-postgres/test-db.lock');
const VERSION31='20261031010000',MIGRATION31='supabase/migrations/20261031010000_m07_specs_submit_ack_projection.sql';
// Fail closed until the exact new SQL/plan and frozen helper inventory are reviewed.
const INPUT31={candidate_sha256:'c1c4cb41460df067d726e4058cc24eacbcf55e5cc73e6a18365394e2c2fbc5e5',tests_sha256:'10458a34ba2443e321888a2dd6e0ce8f052ec4c898167fc56d85acf20f9fd354',readback_sha256:'d459d03d48ed0a49892d4fc559f3e16815def1cbe179a5c644a744dd5a8e95bc',plan_sha256:'6ba6c962b3fd7cb990e52f126c5b71b170b594caf67e1d964ba4f84cae9636e3',new_body_sha256:'e0a7c7be311e6b2139faf08238121f4687d379844a26dd602ff8331b54231481',candidate_suffix_sha256:'fd8c387bfd068634a3ae882cb9a4183a81c6eafa010f870bd7aff57040fe2747'};
const REUSE_SEAL_SHA256='48db25b3c2164eb12fa673765eb8f40df49353d622fb8078abac201212b31217';
const RESTORED_SCHEMAS=['eps','public','auth','storage','supabase_migrations','extensions','eps_local_guard'];
const sha=b=>createHash('sha256').update(b).digest('hex'),q=s=>"'"+String(s).replaceAll("'","''")+"'";
const rows=s=>s.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
const requireSha=value=>assert(typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value));
let target,dbOid,dbAttempted=false,roleAttempted=false,roleOid,initialMemberships,locked=false,original,cloneOriginal,source,profile;
let cleanupMode=false,commands=0,processUnconfirmed=false;const started=Date.now();
const report={schema_version:'1.0',run_id:runId,started_at:new Date(started).toISOString(),result:'failed',checkpoint:'source-admission',
 scope:'Owned local29 dump clone upgraded to30/31; real-role synthetic fixtures roll back; no canonical/provider acceptance',
 cloud_called:false,provider_called:false,original_database_writes:false,existing_role_ddl:false,automatic_retry:false,
 historical_controllers_invoked:false,local31_only:true,planned_canonical_migration:MIGRATION31,
 owned_database:{name,marker},shared_lock_path:'.local/local-postgres/test-db.lock',unconfirmed_child_processes:[]};

async function command(exe,args,{input='',allowFailure=false,environment}={}){
 assert(commands++<(cleanupMode?200:150)&&Date.now()-started<(cleanupMode?18:15)*60_000,'ACK31_LOCAL_COMMAND_BUDGET');
 return boundedCommand(spawn,exe,args,{cwd:ROOT,input,allowFailure,environment,
  onUnconfirmed:observation=>{processUnconfirmed=true;report.unconfirmed_child_processes.push(observation);}});
}
const docker=(args,options)=>command('docker',['--host',HOST,...args],options);
const psql=db=>['exec','--user','postgres','-i',target.container.Id,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','supabase_admin','-d',db];
async function privateFile(name,value){assert(report.private_acl_verified===true);await writeFile(path.join(folder,name),value,{flag:'wx',mode:0o600});}
async function protect(){
 await mkdir(folder,{recursive:true,mode:0o700});
 assert.equal(await realpath(folder),folder);
 if(process.platform==='win32'){
  const script="$ErrorActionPreference='Stop';$p=$env:EPS_ACK31_PRIVATE_ROOT;$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=New-Object System.Security.AccessControl.DirectorySecurity;$acl.SetAccessRuleProtection($true,$false);foreach($s in @($sid,[System.Security.Principal.SecurityIdentifier]'S-1-5-18')){$r=New-Object System.Security.AccessControl.FileSystemAccessRule($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$acl.AddAccessRule($r)};Set-Acl -LiteralPath $p -AclObject $acl;$a=Get-Acl -LiteralPath $p;if(-not $a.AreAccessRulesProtected){throw 'ACL_INVALID'};foreach($r in $a.Access){if($r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin @($sid.Value,'S-1-5-18')){throw 'ACL_INVALID'}};Write-Output 'VERIFIED'";
  const result=await command('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{environment:{...process.env,EPS_ACK31_PRIVATE_ROOT:folder}});assert.equal(result.stdout.trim(),'VERIFIED');
 }else{const stat=await lstat(folder);assert.equal(stat.mode&0o777,0o700);}
 report.private_acl_verified=true;await privateFile('owner.json',JSON.stringify({workspace:ROOT,run_id:runId,purpose:'specs-ack31-local'}));
}
async function sourcesStable(){for(const[file,bytes]of source)assert.equal(sha(await readFile(path.join(ROOT,file))),sha(bytes),'ACK31_SOURCE_CHANGED');}
async function sameTarget(){await sourcesStable();const current=await verifyLocalTarget();assert.equal(current.container.Id,target.container.Id);assert.equal(current.observed.system_identifier,'7701520506262638626');}
async function dbIdentity(){
 const result=rows((await docker(psql('template1'),{input:`begin read only;select jsonb_build_object('database',(select jsonb_build_object('name',datname,'oid',oid,'owner',datdba::regrole::text,'comment',shobj_description(oid,'pg_database'),'clients',(select count(*)from pg_stat_activity where datname=${q(name)}))from pg_database where datname=${q(name)}));rollback;`})).stdout).at(-1);
 assert(result&&Object.hasOwn(result,'database'));const identity=result.database;
 if(identity!==null){assert.equal(identity.name,name);assert.equal(identity.owner,'postgres');assert.equal(identity.comment,marker);identity.oid=normalizeDatabaseOid(identity.oid);if(dbOid!==undefined)assert.equal(identity.oid,dbOid);}return identity;
}
async function tx(body,{commit=false,readOnly=false,allowFailure=false}={}){
 await sameTarget();const identity=await dbIdentity();assert(identity&&identity.oid===dbOid);
 const predicate=ownedIdentityPredicate({name,marker,oid:dbOid,owner:'postgres'});
 return docker(psql(name),{allowFailure,input:`set log_statement='none';set log_min_duration_statement=-1;begin${readOnly?' isolation level repeatable read read only':''};set local role postgres;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='45s';set local eps.local_fixture_tests='eps-presentation-canonical-pg17-local';do $owned$begin if ${predicate} then raise exception'ACK31_EXACT_OWNED_LOCAL_REQUIRED';end if;end$owned$;\n${body}\n${commit?'commit':'rollback'};`});
}
function restoredPrivilegeView(state){const view=structuredClone(state);for(const role of Object.values(view.context.effective_privileges))for(const category of['schemas','functions','tables','columns'])for(const key of Object.keys(role[category]))if(!RESTORED_SCHEMAS.includes(category==='schemas'?key:key.split('.')[0]))delete role[category][key];return view;}
function discoveryBody(){return source.get(ISSUER+'/discover.sql').toString('utf8').replace('begin isolation level repeatable read read only;','').replace(/rollback;\s*$/u,'');}
async function snapshot(which){const state=rows((which==='original'?await runOwnedLocalSql(source.get(ISSUER+'/discover.sql').toString('utf8')):await tx(discoveryBody(),{readOnly:true})).stdout).at(-1);assert(state&&state.context&&state.catalog&&state.protected_data);return which==='original'?state:restoredPrivilegeView(state);}
const roleSql=`select jsonb_build_object('role',(select jsonb_build_object('name',r.rolname,'oid',r.oid,'marker',shobj_description(r.oid,'pg_authid'),'login',r.rolcanlogin,'super',r.rolsuper,'inherit',r.rolinherit,'bypassrls',r.rolbypassrls,'create_role',r.rolcreaterole,'create_db',r.rolcreatedb,'replication',r.rolreplication,'connection_limit',r.rolconnlimit,'valid_until',r.rolvaliduntil,
 'memberships',(select coalesce(jsonb_agg(jsonb_build_object('role',roleid::regrole::text,'member',member::regrole::text,'grantor',grantor::regrole::text,'admin',admin_option,'inherit',inherit_option,'set',set_option)order by roleid,member,grantor),'[]')from pg_auth_members where roleid=r.oid or member=r.oid or grantor=r.oid),
 'dependencies',(select coalesce(jsonb_agg(jsonb_build_object('dbid',dbid,'classid',classid::regclass::text,'objid',objid,'objsubid',objsubid,'deptype',deptype)order by dbid,classid,objid,objsubid),'[]')from pg_shdepend where refclassid='pg_authid'::regclass and refobjid=r.oid),
 'active_clients',(select count(*)from pg_stat_activity where backend_type='client backend'and pid<>pg_backend_pid()))from pg_roles r where r.rolname='eps_mcp_issuer_owner'));`;
async function roleIdentity(){const result=rows((await docker(psql('template1'),{input:'begin read only;'+roleSql+'rollback;'})).stdout).at(-1);assert(result&&Object.hasOwn(result,'role'));return result.role;}
async function evidence(label,value){const file=AREA+'/'+report.started_at.replace(/[:.]/gu,'-')+'-'+runId.slice(0,8)+'-'+label+'.json';const bytes=JSON.stringify(value,null,2)+'\n';await writeFile(path.join(ROOT,file),bytes,{flag:'wx'});return{path:file,sha256:sha(bytes)};}
function history(version,file,hash,label){return`insert into supabase_migrations.schema_migrations(version,statements,name)values(${q(version)},array[]::text[],${q(label)});insert into eps_local_guard.migration_replay(path,sha256)values(${q(file)},${q(hash)});`;}
function checkPreexistingRoles(state){assert.deepEqual(state.context.all_roles.filter(r=>r.name!=='eps_mcp_issuer_owner'),original.context.all_roles);assert.deepEqual(state.context.all_memberships.filter(m=>m.role!=='eps_mcp_issuer_owner'&&m.member!=='eps_mcp_issuer_owner'&&m.grantor!=='eps_mcp_issuer_owner'),original.context.all_memberships);}
function local31Admission(baseline){
 const tail="select coalesce(jsonb_object_agg(key,value),'{}')catalog from flat;",catalog=source.get('development/m07/db/catalog29.sql').toString('utf8');
 assert.equal(catalog.split(tail).length,2);const into=catalog.replace(tail,"select coalesce(jsonb_object_agg(key,value),'{}')into actual_catalogue from flat;");
 const context=source.get(ISSUER+'/context.sql').toString('utf8').trim().replace(/;$/u,'');
 return source.get('development/m07/db/data29.sql').toString('utf8')+`\ndo $ack31_local_admission$declare actual_catalogue jsonb;actual_context jsonb;begin\n${into}\nselect context into actual_context from(${context})ack31_context;\nif actual_catalogue is distinct from ${q(JSON.stringify(baseline.catalog))}::jsonb or actual_context is distinct from ${q(JSON.stringify(baseline.context))}::jsonb or current_setting('eps.m07_readback.old_data')::jsonb is distinct from ${q(JSON.stringify(baseline.protected_data))}::jsonb then raise exception'ACK31_EXACT_OWNED30_PREIMAGE_REQUIRED';end if;end$ack31_local_admission$;\n`;
}
async function phase(phaseName,baseline){
 const result=await tx(`set local eps.specs_ack31_phase=${q(phaseName)};\n`+source.get(DIR+'/tests.sql').toString('utf8'));
 const payloads=rows(result.stdout);assert.equal(payloads.length,1);assert.deepEqual(Object.keys(payloads[0]),['specs_ack31_proof']);
 const proof=assertPhaseProof(payloads[0].specs_ack31_proof,phaseName);assert.deepEqual(await snapshot('clone'),baseline,'ACK31_FIXTURE_ROLLBACK_REQUIRED');return proof;
}
async function ackReadback(baseline,bodySha){
 const result=rows((await tx(source.get(DIR+'/readback.sql').toString('utf8'),{readOnly:true})).stdout);
 return assertAckReadbackResult(result,{database:name,operator:'postgres',history:baseline.context.migration_versions,owner:'eps_specs_submit_owner',acl:'{eps_specs_submit_owner=X/eps_specs_submit_owner}',private_invoker:true,language:'plpgsql',volatility:'v',search_path:['search_path=""'],body_sha256:bodySha,owner_ack_execute:true,public_callers_denied:true,existing_projection_columns_granted:true,whole_job_select_still_denied:true,generic_jobs_dto_sha256:baseline.catalog['functions|eps.jobs_dto(uuid)|source_sha256']});
}

try{
 assert.equal(process.argv.length,2);assert.equal(path.resolve(process.cwd()),ROOT);
 for(const key of['NODE_OPTIONS','NODE_DEBUG','NODE_DEBUG_NATIVE','NPM_CONFIG_NODE_OPTIONS'])assert(!Object.entries(process.env).some(([name,value])=>name.toUpperCase()===key&&value));
 for(const hash of Object.values(INPUT31))requireSha(hash);requireSha(REUSE_SEAL_SHA256);
 const reuseBytes=await readFile(path.join(ROOT,DIR,'reuse-source-seals.json'));assert.equal(sha(reuseBytes),REUSE_SEAL_SHA256);const reuse=JSON.parse(reuseBytes);
 assert(reuse&&typeof reuse==='object'&&!Array.isArray(reuse)&&Object.keys(reuse).length>=15);
 source=new Map();
 for(const[file,expected]of Object.entries(reuse)){requireSha(expected);assert(/^(?:tools|development|supabase\/migrations)\/[A-Za-z0-9_./-]+\.(?:mjs|sql|json)$/u.test(file)&&!file.includes('..'));assert.equal(await realpath(path.join(ROOT,file)),path.join(ROOT,file));const bytes=await readFile(path.join(ROOT,file));assert.equal(sha(bytes),expected);source.set(file,bytes);}
 for(const[file,expected]of Object.entries({'candidate.sql':INPUT31.candidate_sha256,'tests.sql':INPUT31.tests_sha256,'readback.sql':INPUT31.readback_sha256,'release-plan.json':INPUT31.plan_sha256})){
  const relative=DIR+'/'+file;assert.equal(await realpath(path.join(ROOT,relative)),path.join(ROOT,relative));const bytes=await readFile(path.join(ROOT,relative));assert.equal(sha(bytes),expected);source.set(relative,bytes);
 }
 assert.equal(await realpath(path.join(ROOT,MIGRATION31)),path.join(ROOT,MIGRATION31));const migration31=await readFile(path.join(ROOT,MIGRATION31));assert.equal(sha(migration31),INPUT31.candidate_sha256);assert(migration31.equals(source.get(DIR+'/candidate.sql')));source.set(MIGRATION31,migration31);
 for(const file of['run-local.mjs','local-proof.mjs','local-proof.test.mjs','local-command.mjs','local-command.test.mjs','reuse-source-seals.json'])source.set(DIR+'/'+file,await readFile(path.join(ROOT,DIR,file)));
 const plan31=JSON.parse(source.get(DIR+'/release-plan.json'));
 assert.deepEqual(plan31,{schema_version:'1.0',version:VERSION31,candidate_path:DIR+'/candidate.sql',candidate_sha256:INPUT31.candidate_sha256,migration_path:MIGRATION31,
  readback_path:DIR+'/readback.sql',readback_sha256:INPUT31.readback_sha256,tests_path:DIR+'/tests.sql',tests_sha256:INPUT31.tests_sha256,
  old_body_sha256:'3a164335af33462b20dff3e1dffdcd26bec1c57d39e9028ef999adbf29eb89a4',new_body_sha256:INPUT31.new_body_sha256,candidate_suffix_sha256:INPUT31.candidate_suffix_sha256});
 const candidate31=source.get(DIR+'/candidate.sql'),anchor=Buffer.from('create or replace function eps.specs_submit_ack('),at=candidate31.indexOf(anchor);assert(at>0&&candidate31.indexOf(anchor,at+1)===-1);
 const suffix31=candidate31.subarray(at);assert.equal(sha(suffix31),INPUT31.candidate_suffix_sha256);
 report.source_seals=Object.fromEntries([...source].map(([file,bytes])=>[file,sha(bytes)]));report.local31_adapter={canonical_prefix_executed:false,exact_candidate_suffix_sha256:sha(suffix31),admission:'Ownedname/marker/OID plus exact in-transaction fullclone30 catalogue/data/context preimage; frozen31function/postconditions suffix unchanged'};
 await protect();await mkdir(path.join(ROOT,AREA),{recursive:true});profile=await loadOriginalProfile29();
 const plan30=validateReleasePlan(JSON.parse(source.get(ISSUER+'/release-plan.json')));assert.equal(sha(source.get(ISSUER+'/candidate.sql')),plan30.migration_sha256);assert.equal(sha(source.get(plan30.migration_path)),plan30.migration_sha256);assert(source.get(plan30.migration_path).equals(source.get(ISSUER+'/candidate.sql')));
 const lock=await open(LOCK,'wx',0o600);locked=true;await lock.writeFile(JSON.stringify({run_id:runId,pid:process.pid,purpose:'specs-ack31-owned-local-proof'}));await lock.sync();await lock.close();
 target=await verifyLocalTarget();assert.equal(target.observed.system_identifier,'7701520506262638626');
 const oldPlan=JSON.parse(await readFile(path.join(ROOT,profile.plan),'utf8'));assertExactProfileAfter(rows((await runOwnedLocalSql(await readFile(path.join(ROOT,profile.readback_query),'utf8'))).stdout).at(-1),profile,oldPlan.version);
 original=await snapshot('original');cloneOriginal=restoredPrivilegeView(original);assert.equal(original.context.migration_versions.length,29);assert.equal(original.context.issuer_role_exists,false);assert.equal(await roleIdentity(),null);
 report.original_before=await evidence('original29-before',original);
 report.checkpoint='owned-dump-clone';assert.equal(await dbIdentity(),null);
 const dump=await docker(['exec','--user','postgres',target.container.Id,'pg_dump','-h','/var/run/postgresql','-U','supabase_admin','-d','postgres','--no-password','--no-security-labels','--clean','--if-exists','--strict-names','--no-large-objects',...RESTORED_SCHEMAS.flatMap(schema=>['--schema',schema]),...['pg_stat_statements','pgcrypto','uuid-ossp'].flatMap(extension=>['--extension',extension])]);assert(!/^\\connect\b/mu.test(dump.stdout));
 dbAttempted=true;report.owned_database.creation_attempted=true;await docker(psql('template1'),{input:`create database "${name}"with template template0 owner postgres;comment on database "${name}"is ${q(marker)};`});dbOid=(await dbIdentity()).oid;report.owned_database.oid=dbOid;await docker(psql(name),{input:dump.stdout});
 const observed=await snapshot('clone'),correction=issuerOwnedRestoreProfile(original.catalog,observed.catalog,{name,marker,oid:dbOid,owner:'postgres'});await tx(correction.sql,{commit:true});report.exact_known_owned_dump_corrections=correction.differences;
 const before29=await snapshot('clone'),expected29=structuredClone(cloneOriginal);expected29.context.database=name;expected29.admission.database=name;assert.deepEqual(before29,expected29);report.clone29_full_catalogue_data_exact=true;
 const suffix30=extractIssuerSuffix(source.get('development/m07/oauth-hook29/candidate.sql'));
 const local30=makeAdmissionSql(before29,{catalog:source.get('development/m07/db/catalog29.sql'),data:source.get('development/m07/db/data29.sql'),owned:{name,marker,oid:dbOid,owner:'postgres'}})+suffix30.toString('utf8');
 report.exact_issuer30_suffix_sha256=sha(suffix30);await privateFile('owned-local30.sql',local30);
 const history30=history(plan30.version,plan30.migration_path,plan30.migration_sha256,'m07_native_oauth_issuer');
 report.checkpoint='commit-owned30';roleAttempted=true;
 const applied30=await tx(local30+`set local role supabase_admin;comment on role eps_mcp_issuer_owner is ${q(marker)};set local role postgres;`+history30+roleSql,{commit:true});
 const recorded=rows(applied30.stdout).at(-1)?.role;assert(recorded&&recorded.name==='eps_mcp_issuer_owner'&&recorded.marker===marker);roleOid=normalizeDatabaseOid(recorded.oid);initialMemberships=recorded.memberships;
 assert(initialMemberships.length>0&&initialMemberships.length<=2&&initialMemberships.every(m=>m.role==='eps_mcp_issuer_owner'&&m.member==='postgres'&&['postgres','supabase_admin'].includes(m.grantor)));
 report.new_role_identity={name:recorded.name,oid:roleOid,marker,memberships:initialMemberships};const before30=await snapshot('clone');checkPreexistingRoles(before30);assert.deepEqual(before30.context.migration_versions,[...before29.context.migration_versions,plan30.version]);assert.equal(before30.catalog[ACK_SOURCE_KEY],before29.catalog[ACK_SOURCE_KEY]);
 report.owned30_baseline=await evidence('owned30-baseline',before30);report.owned30_ack_readback=await ackReadback(before30,plan31.old_body_sha256);
 report.checkpoint='red-old-ack';report.red=await phase('red',before30);
 const history31=history(VERSION31,MIGRATION31,INPUT31.candidate_sha256,'m07_specs_submit_ack_projection'),local31=local31Admission(before30)+suffix31.toString('utf8');
 // Admission is controller-side full structural equality immediately before the
 // exact owned tx guard. No canonical guard, target, history or OID is loosened.
 assert.deepEqual(await snapshot('clone'),before30);await privateFile('owned-local31-adapter.sql',local31);
 for(const point of['after-ddl','after-history']){
  report.checkpoint='rollback31-'+point;const failed=await tx(local31+(point==='after-history'?history31:'')+"do $$begin raise exception'ACK31_INJECTED_FAILURE';end$$;",{commit:true,allowFailure:true});
  assert.notEqual(failed.code,0);assert(failed.stderr.includes('ACK31_INJECTED_FAILURE'));assert.deepEqual(await snapshot('clone'),before30);report[point.replaceAll('-','_')+'_rollback_exact']=true;
 }
 report.checkpoint='commit-owned31';assert.deepEqual(await snapshot('clone'),before30);await tx(local31+history31,{commit:true});
 const after31=await snapshot('clone');assertProjectionOnlyDelta(before30,after31,{version:VERSION31,newSourceSha256:INPUT31.new_body_sha256});checkPreexistingRoles(after31);
 report.only_ack_source_and_history_changed=true;report.owned31_committed=await evidence('owned31-committed',after31);report.owned31_ack_readback=await ackReadback(after31,INPUT31.new_body_sha256);
 report.checkpoint='green-new-ack';report.green=await phase('green',after31);report.all_fixture_writes_rolled_back=true;
 report.checkpoint='issuer30-forward-fix';
 assert.equal(before29.context.effective_privileges.supabase_auth_admin.schemas.eps.usage,false);
 const fix=`drop policy mcp_issuer_resource_lookup on eps.mcp_oauth_resources;drop policy mcp_issuer_capability_lookup on public.app_capability_grants;set local role eps_mcp_issuer_owner;drop function eps.mcp_custom_access_token_hook(jsonb);set local role postgres;revoke select(resource,client_id,enabled)on eps.mcp_oauth_resources from eps_mcp_issuer_owner;revoke select(principal_id,capability,active)on public.app_capability_grants from eps_mcp_issuer_owner;revoke usage on schema eps,public from eps_mcp_issuer_owner;revoke usage on schema eps from supabase_auth_admin;revoke eps_mcp_issuer_owner from postgres;`;
 await privateFile('owned-issuer30-forward-fix.sql',fix);await tx(fix,{commit:true});
 const fixed=await snapshot('clone'),normalized=structuredClone(fixed),expectedFix=structuredClone(before29);
 expectedFix.context.migration_versions.push(plan30.version,VERSION31);expectedFix.protected_data.versions.push(plan30.version,VERSION31);expectedFix.catalog[ACK_SOURCE_KEY]=INPUT31.new_body_sha256;
 const roleKeys=Object.keys(normalized.catalog).filter(key=>key.startsWith('roles|eps_mcp_issuer_owner|'));assert.equal(roleKeys.length,9);for(const key of roleKeys)delete normalized.catalog[key];
 for(const key of Object.keys(normalized.catalog))if(key.startsWith('memberships|eps_mcp_issuer_owner>'))delete normalized.catalog[key];
 normalized.context.all_roles=normalized.context.all_roles.filter(r=>r.name!=='eps_mcp_issuer_owner');normalized.context.all_memberships=normalized.context.all_memberships.filter(m=>m.role!=='eps_mcp_issuer_owner'&&m.member!=='eps_mcp_issuer_owner'&&m.grantor!=='eps_mcp_issuer_owner');delete normalized.context.effective_privileges.eps_mcp_issuer_owner;normalized.context.issuer_role_exists=false;
 assert.deepEqual(normalized,expectedFix);report.issuer30_surface_restored_except_exact_ack31_and_history=true;
 await sourcesStable();report.sources_stable=true;report.result='passed';report.checkpoint='complete';
}catch(error){
 report.failure_code='ACK31_LOCAL_PROOF_UNCONFIRMED';if(report.private_acl_verified)await privateFile('failure-private.json',JSON.stringify({message:error.message,stack:error.stack,diagnostic:error.privateDiagnostic},null,2));
}finally{
 cleanupMode=true;
 try{
  if(target){
   // A killed Docker client is not proof that its SQL backend has returned.
   // Retain the exact lock and resources for bounded owner reconciliation.
   assert.equal(processUnconfirmed,false,'ACK31_COMMAND_PROCESS_UNCONFIRMED');
   await sameTarget();const identity=await dbIdentity(),decision=cleanupObservation({name,marker,attempted:dbAttempted,oid:dbOid},identity);
   if(decision.can_drop){dbOid=decision.oid;await dbIdentity();await docker(psql('template1'),{input:`drop database "${name}";`});}
   assert.equal(await dbIdentity(),null);report.actual_owned_database_absent=true;
   const role=await roleIdentity(),filtered=initialMemberships?.filter(m=>m.grantor!=='postgres');
   const ownership={name:'eps_mcp_issuer_owner',marker,attempted:roleAttempted,oid:roleOid,membership_states:initialMemberships?[initialMemberships,filtered,[]]:undefined};
   const roleDecision=roleCleanupDecision(ownership,role);
   if(roleDecision.can_drop){
    roleCleanupDecision(ownership,await roleIdentity());const members=JSON.stringify(role.memberships);
    await docker(psql('template1'),{input:`begin;set local lock_timeout='5s';set local statement_timeout='30s';lock table pg_catalog.pg_authid,pg_catalog.pg_auth_members,pg_catalog.pg_shdepend in share row exclusive mode;do $role_guard$begin if not exists(select 1 from pg_roles where rolname='eps_mcp_issuer_owner'and oid=${roleOid} and shobj_description(oid,'pg_authid')=${q(marker)} and not rolcanlogin and not rolsuper and not rolinherit and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication and rolconnlimit=-1 and rolvaliduntil is null)
 or exists(select 1 from pg_shdepend where refclassid='pg_authid'::regclass and refobjid=${roleOid})or exists(select 1 from pg_stat_activity where backend_type='client backend'and pid<>pg_backend_pid())
 or(select coalesce(jsonb_agg(jsonb_build_object('role',roleid::regrole::text,'member',member::regrole::text,'grantor',grantor::regrole::text,'admin',admin_option,'inherit',inherit_option,'set',set_option)order by roleid,member,grantor),'[]')from pg_auth_members where roleid=${roleOid} or member=${roleOid} or grantor=${roleOid})is distinct from ${q(members)}::jsonb then raise exception'ACK31_EXACT_NEW_ROLE_REQUIRED';end if;end$role_guard$;drop role eps_mcp_issuer_owner;commit;`});
   }
   assert.equal(await roleIdentity(),null);report.actual_new_role_absent=true;
   if(original){assert.deepEqual(await snapshot('original'),original);report.original29_full_catalogue_data_settings_roles_oids_memberships_exact=true;}
  }
  if(locked&&report.actual_owned_database_absent&&report.actual_new_role_absent&&report.original29_full_catalogue_data_settings_roles_oids_memberships_exact){
   assertCleanupComplete({dbAbsent:report.actual_owned_database_absent,roleAbsent:report.actual_new_role_absent,originalExact:report.original29_full_catalogue_data_settings_roles_oids_memberships_exact,processUnconfirmed});
   const value=JSON.parse(await readFile(LOCK,'utf8'));assert.equal(value.run_id,runId);assert.equal(value.pid,process.pid);assert.equal(value.purpose,'specs-ack31-owned-local-proof');await unlink(LOCK);assert.equal(await lstat(LOCK).then(()=>false,error=>{if(error.code==='ENOENT')return true;throw error;}),true);report.shared_lock_released=true;
   }else assert.equal(locked,false,'ACK31_CLEANUP_UNCONFIRMED');
 }catch(error){report.result='failed';report.cleanup_unconfirmed=true;if(report.private_acl_verified)await privateFile('cleanup-private.json',JSON.stringify({message:error.message,stack:error.stack,diagnostic:error.privateDiagnostic},null,2));}
 report.finished_at=new Date().toISOString();report.elapsed_ms=Date.now()-started;report.commands_attempted=commands;report.command_process_unconfirmed=processUnconfirmed;
 await mkdir(path.join(ROOT,AREA),{recursive:true});const receipt=await evidence('local-proof',report);
 console.log(JSON.stringify({result:report.result,checkpoint:report.checkpoint,evidence:receipt.path,db_absent:report.actual_owned_database_absent,role_absent:report.actual_new_role_absent,original29_exact:report.original29_full_catalogue_data_settings_roles_oids_memberships_exact,lock_released:report.shared_lock_released,automatic_retry:false}));
 if(report.result!=='passed')process.exitCode=1;
}
