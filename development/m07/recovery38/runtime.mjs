/** Full38 hooks; SQL/IO occurs only when a new owner-run controller invokes them. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createRecovery33Context,exactPreimageAdmission} from '../recovery33/runtime.mjs';
import {ownedIdentity33,ownedPredicate33} from '../recovery33/ownership.mjs';
import {normalizeDatabaseOid} from '../recovery29/identity.mjs';
import {traceRoleQuery36,dataSql36} from '../recovery36/runtime.mjs';
import {snapshotSql,COLUMNS} from '../recovery36-trace-acl-native/runtime.mjs';
import {admitPair} from '../recovery36-trace-profile/runtime.mjs';
import {adapters38,text,sha,validateSources,RECEIPTS} from './compiler.mjs';
const ROLE='eps_job_trace_owner',KEY='tables|eps.job_stage_attempts|acl',ACL='{postgres=arwdDxtm/postgres}';
const q=x=>"'"+String(x).replaceAll("'","''")+"'",j=x=>q(JSON.stringify(x))+'::jsonb';
const exact=(v,keys)=>{assert(v&&typeof v==='object'&&!Array.isArray(v));assert.deepEqual(Reflect.ownKeys(v).sort(),[...keys].sort());};
const VIDEO='8a9f0000-0000-4000-8000-000000000001',MEDIA='8a9f0000-0000-4000-8000-000000000002';
const ACTOR='8a1a0000-0000-4000-8000-000000000001',EMPTY_BATCH='8a380000-0000-4000-8000-000000000038';
const uuid=v=>assert(typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(v));
export const ENGLISH='Authored synthetic English for full history37 recovery.';
export function safeRole38(row,runId){
 exact(row,['name','oid','marker','login','super','inherit','bypassrls','create_role','create_db','replication','connection_limit','valid_until','memberships','dependencies','clients']);
 assert.equal(row.name,ROLE);normalizeDatabaseOid(row.oid);assert.equal(row.marker,`eps-m07-recovery38:${runId}:trace`);
 for(const k of ['login','super','inherit','bypassrls','create_role','create_db','replication'])assert.equal(row[k],false);
 assert.equal(row.connection_limit,-1);assert.equal(row.valid_until,null);assert(Number.isSafeInteger(row.clients)&&row.clients>=0);assert(Array.isArray(row.dependencies));
 const grant={role:ROLE,member:'postgres',grantor:'postgres',admin:false,inherit:true,set:true},bootstrap={...grant,grantor:'supabase_admin',admin:true,inherit:false,set:false};
 assert(Array.isArray(row.memberships)&&row.memberships.length>=1&&row.memberships.length<=2);
 const keys=row.memberships.map(v=>{exact(v,Object.keys(grant));const expected=v.grantor==='postgres'?grant:bootstrap;assert.deepEqual(v,expected);return JSON.stringify(expected);});
 assert.equal(new Set(keys).size,keys.length);assert(keys.includes(JSON.stringify(grant)));
 return{oid:normalizeDatabaseOid(row.oid),memberships:keys.sort()};
}
export function traceCleanup38(expected,observed,runId){
 assert.deepEqual(safeRole38(observed,runId),safeRole38(expected,runId));assert.equal(observed.clients,0);assert.deepEqual(observed.dependencies,[]);
 const query=traceRoleQuery36().trim().replace(/;$/u,' into current_role_metadata;');
 return `begin;set local lock_timeout='5s';set local statement_timeout='30s';lock table pg_authid,pg_auth_members,pg_shdepend in share row exclusive mode;
 do $$declare current_role_metadata jsonb;begin ${query}if current_role_metadata is distinct from ${j({role:observed})} then raise exception'RECOVERY38_EXACT_TRACE_CLEANUP_REQUIRED';end if;end$$;drop role ${ROLE};commit;`;
}
export function admitNative38(snapshot,receipt){
 assert.equal(receipt.result,'passed');assert.equal(receipt.checkpoint,'complete');const native=receipt.trace_acl_native;assert.equal(native.result,'passed');
 assert.equal(snapshot.table_acl,null);assert.equal(normalizeDatabaseOid(snapshot.identity.owner_oid),16384);assert.equal(snapshot.identity.owner,'postgres');
 assert.equal(snapshot.identity.rls,true);assert.equal(snapshot.identity.force_rls,true);assert.equal(snapshot.identity.kind,'r');assert.equal(snapshot.identity.persistence,'p');
 normalizeDatabaseOid(snapshot.identity.table_oid);normalizeDatabaseOid(snapshot.identity.schema_oid);assert.deepEqual(snapshot.columns.map(v=>v.name),COLUMNS);
 for(const c of snapshot.columns)assert.equal(c.acl,'{eps_job_trace_owner=a/postgres}');
 assert.equal(snapshot.roles.length,61);assert.equal(new Set(snapshot.roles.map(r=>r.name)).size,61);
 for(const[field,hash]of [['table_matrix','table_matrix_sha256'],['column_matrix','column_matrix_sha256'],['schema_matrix','schema_matrix_sha256'],['expanded_acl','expanded_acl_sha256']])assert.equal(sha(JSON.stringify(snapshot[field])),native[hash],'RECOVERY38_NATIVE508_PRIVILEGES_CHANGED');
 return true;
}
export function correctionSql38(identity,before,versions,runId){
 assert.equal(ownedIdentity33(identity).kind,'restore');assert.equal(versions.length,38);assert.deepEqual([...new Set(versions)].sort(),versions);assert.equal(versions.at(-1),'20261101110939');assert(versions.every(v=>/^[0-9]{14}$/u.test(v)));
 const snap=snapshotSql(),owned=ownedPredicate33(identity),mark=`eps-m07-recovery38:${runId}:trace`;
 return `do $recovery38_acl$declare v jsonb;r oid;begin
 if current_user<>'postgres'or ${owned} or(select system_identifier::text from pg_control_system())<>'7701520506262638626'
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array[${versions.map(q).join(',')}]::text[]
 or not exists(select 1 from pg_roles where rolname='postgres'and oid=16384)
 or not exists(select 1 from pg_roles where rolname='${ROLE}'and shobj_description(oid,'pg_authid')=${q(mark)}and not rolcanlogin and not rolsuper and not rolinherit and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication and rolconnlimit=-1 and rolvaliduntil is null)
 or not exists(select 1 from pg_proc p where p.oid=to_regprocedure('eps.capture_job_stage_attempt()')and p.proowner=(select oid from pg_roles where rolname='${ROLE}')and p.prosecdef and p.provolatile='v'and p.proconfig=array['search_path=""']::text[]and encode(sha256(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex')='a1de1739a8c0005e5b8a09e2e87bfb1094c38839631a813f06635e339afb9228')
 then raise exception'RECOVERY38_EXACT_OWNED38_REQUIRED';end if;
 select oid into r from pg_roles where rolname='${ROLE}';
 if not exists(select 1 from pg_auth_members where roleid=r and member=16384 and grantor=16384 and not admin_option and inherit_option and set_option)
 or exists(select 1 from pg_auth_members where(roleid=r or member=r or grantor=r)and not(roleid=r and member=16384 and((grantor=16384 and not admin_option and inherit_option and set_option)or(grantor=(select oid from pg_roles where rolname='supabase_admin')and admin_option and not inherit_option and not set_option))))
 then raise exception'RECOVERY38_EXACT_TRACE_MEMBERSHIP_REQUIRED';end if;
 ${snap} into v;if v is distinct from ${j(before)} then raise exception'RECOVERY38_CURRENT_NATIVE_PREIMAGE_REQUIRED';end if;
 perform set_config('eps.recovery38.acl_before',v::text,true);end$recovery38_acl$;
 grant all privileges on table eps.job_stage_attempts to postgres;
 do $recovery38_acl$declare v jsonb;b jsonb:=current_setting('eps.recovery38.acl_before')::jsonb;begin ${snap} into v;
 if v->>'table_acl'is distinct from ${q(ACL)}or(v-'table_acl')is distinct from(b-'table_acl')then raise exception'RECOVERY38_ONLY_OWNER_ACL_MAY_CHANGE';end if;end$recovery38_acl$;`;
}
export const englishSql38=()=>`select jsonb_build_object('rows',(select coalesce(jsonb_agg(to_jsonb(t)order by version_id,video_asset_id),'[]')from eps.presentation_video_english_transcripts t));`;
export function validateExtra38(value){
 exact(value,['data','english']);assert(value.data&&typeof value.data==='object'&&!Array.isArray(value.data));
 for(const[k,v]of Object.entries(value.data)){assert(/^(eps|public|auth|storage|supabase_migrations)\.[a-z_]+$/u.test(k));exact(v,['count','sha256']);assert(Number.isSafeInteger(v.count)&&v.count>=0);assert(/^[a-f0-9]{64}$/u.test(v.sha256));}
 assert.equal(value.data['supabase_migrations.schema_migrations'].count,38);
 for(const k of ['eps.candidate_media','eps.presentation_video_transcripts','eps.presentation_video_english_transcripts','eps.presentation_versions','eps.job_stage_attempts','eps.job_events'])assert(value.data[k]?.count>0);
 assert(value.data['eps.job_stage_attempts'].count>=6);exact(value.english,['rows']);assert(Array.isArray(value.english.rows)&&value.english.rows.length===2);
 assert.equal(new Set(value.english.rows.map(v=>v.version_id)).size,2);
 for(const row of value.english.rows){assert.equal(row.status,'available');assert.equal(row.english_text,ENGLISH);assert.equal(row.english_sha256,sha(ENGLISH));assert.equal(row.video_asset_id,VIDEO);assert.equal(row.candidate_media_id,MEDIA);}return value;
}
export function createRecovery38Context(ctx,{contextFactory=createRecovery33Context,io={readFile,writeFile}}={}){
 const inherited=contextFactory(ctx);let traceExpected=null,traceAttempted=false,extra;
 const source=f=>text(ctx.sourceFiles,f),identity=async d=>({database:d,marker:ctx.marker(d),oid:(await ctx.databaseIdentity(d)).oid});
 const stable=async()=>{for(const[f,b]of ctx.sourceFiles)assert.equal(sha(await io.readFile(path.join(ctx.root,f))),sha(b),'RECOVERY38_SOURCE_CHANGED');};
 const save=async(f,v)=>{assert(ctx.report.private_artifact_acl);const b=Buffer.from(typeof v==='string'?v:JSON.stringify(v));await io.writeFile(path.join(ctx.privateRoot,f),b,{flag:'wx',mode:0o600});return sha(b);};
 const observeRole=async()=>ctx.rows((await ctx.docker(ctx.psqlArgs('template1'),{input:'begin read only;'+traceRoleQuery36()+'rollback;'})).stdout).at(-1).role;
 const readExtra=async d=>validateExtra38({data:await ctx.value(d,dataSql36()),english:await ctx.value(d,englishSql38())});
 function bundleSources(files){
  assert.equal(files,ctx.sourceFiles);const{manifest}=validateSources(files),excluded=[],bundled=new Map();
  for(const[file,bytes]of files){
   if(file.startsWith('node_modules/')){assert.equal(sha(bytes),manifest.pins[file]);excluded.push({path:file,sha256:manifest.pins[file]});continue;}
   assert(file.length<=512&&file.split('/').every(part=>/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(part)&&part!=='.'&&part!=='..'));bundled.set(file,bytes);
  }
  assert.deepEqual(excluded.map(v=>v.path).sort(),Object.keys(manifest.pins).filter(f=>f.startsWith('node_modules/')).sort());
  assert.equal(excluded.length,12,'RECOVERY38_ONLY_TWELVE_PINNED_EXTERNAL_DESCRIPTORS');
  for(const file of manifest.internal_graph.files)assert(bundled.has(file));
  ctx.report.source_bundle_projection={bundled_source_count:bundled.size,bundled_source_paths:[...bundled.keys()],excluded_pinned_external_count:excluded.length,excluded_pinned_external:excluded,exclusion_reason:'Pinned third-party installation inputs; external installation remains required and is not restored',external_installation_required:true};return bundled;
 }
 async function upgrade(){
  assert.equal(await observeRole(),null,'RECOVERY38_EXISTING_TRACE_ROLE_NOT_ADOPTED');await inherited.upgrade();const id=await identity(ctx.sourceDb);
  for(const item of adapters38(ctx.sourceFiles,id)){
   ctx.report.checkpoint='recovery38-prepare-owned-migration-'+item.version;
   const step={version:item.version,file:item.file,source_sha256:item.source_sha256,adapted_sha256:item.adapted_sha256,phase:'preparing-owned-admission',committed_in_disposable_owned_source:false};
   (ctx.report.recovery38_owned_migration_steps??=[]).push(step);
   await stable();const catalogue=await ctx.catalogue(ctx.sourceDb),dataQuery=source('development/m07/db/data29.sql');
   const data=await ctx.value(ctx.sourceDb,dataQuery+"select current_setting('eps.m07_readback.old_data')::jsonb;");
   const admission=exactPreimageAdmission({catalogueSql:inherited.catalogueSql,catalogue,dataSql:dataQuery,data,identity:id});
   if(item.version==='20261101012057')traceAttempted=true;
   const tail=`\ninsert into supabase_migrations.schema_migrations(version,statements,name)values(${q(item.version)},array[]::text[],${q(path.basename(item.file,'.sql').slice(15))});`+(item.version==='20261101012057'?`comment on role ${ROLE} is ${q(`eps-m07-recovery38:${ctx.runId}:trace`)};${traceRoleQuery36()}`:'');
   const body=admission+item.sql+tail;step.owned_sql_sha256=await save('migration-'+item.version+'-owned.sql',body);
   ctx.report.checkpoint='recovery38-execute-owned-migration-'+item.version;step.phase='dispatching-owned-transaction';
   const result=await ctx.sql(ctx.sourceDb,body);step.phase='normal-owned-transaction-return';step.committed_in_disposable_owned_source=true;
   if(item.version==='20261101012057'){traceExpected=ctx.rows(result.stdout).find(v=>Object.hasOwn(v,'role'))?.role;ctx.report.recovery38_trace_role_observation_sha256=await save('trace38-role-created.json',{role:traceExpected??null});safeRole38(traceExpected,ctx.runId);}
   ctx.report.actual_local_migrations_executed.push(item.version);
  }
  ctx.report.recovery38_functional_upgrades_34_to38=true;
 }
 async function beforeBackup(scope,pending){
  await stable();extra=await readExtra(ctx.sourceDb);assert.notEqual(scope.version_id,pending.resource_id);
  assert.deepEqual(extra.english.rows.map(v=>v.version_id).sort(),[scope.version_id,pending.resource_id].sort());
  ctx.report.full38_populated_hashes_sha256=await save('source38-populated-row-hashes.json',extra.data);
  ctx.report.full38_English_companions_sha256=await save('source38-English-private.json',extra.english);
  ctx.report.full38_backup_trace_count=extra.data['eps.job_stage_attempts'].count;
 }
 async function beforeFullRestoreProfile(expected){
  assert.equal(ctx.report.checkpoint,'backup-and-filesystem-restore');assert(extra);const d=ctx.restoreDb;
  const observed=await ctx.catalogue(d);await save('restore38-before-profile.json',observed);
  if(expected[KEY]===observed[KEY])return;
  admitPair(expected,observed);const id=await identity(d);assert.equal(ownedIdentity33(id).kind,'restore');
  const before=await ctx.value(d,snapshotSql()+';');const prior=JSON.parse(source(RECEIPTS.native508[0]));admitNative38(before,prior);
  const versions=[...ctx.sourceFiles.keys()].filter(f=>/^supabase\/migrations\/[0-9]{14}_[^/]+\.sql$/u.test(f)).map(f=>path.basename(f).slice(0,14)).sort();
  await ctx.sql(d,correctionSql38(id,before,versions,ctx.runId));assert.deepEqual(await ctx.catalogue(d),{...observed,[KEY]:ACL});
  ctx.report.trace38_profile_correction={native508_sha256:RECEIPTS.native508[1],history38_owned_guard:true,only_owner_acl_changed:true,actual_current_native_privilege_hashes_match:true};
 }
 async function afterRestore(scope){
  assert(extra);await stable();assert.deepEqual(await readExtra(ctx.restoreDb),extra,'RECOVERY38_ALL_POPULATED_ROWS_ENGLISH_TRACE_CHANGED');
  await inherited.authBoundary(ctx.sourceDb);await inherited.authBoundary(ctx.restoreDb);
  const summary=`select public.eps_get_feedback_summary(${q(scope.version_id)}::uuid);`;
  assert.deepEqual(await ctx.value(ctx.sourceDb,summary,'authenticated',ACTOR),await ctx.value(ctx.restoreDb,summary,'authenticated',ACTOR));
  for(const key of ['job_id','version_id','series_id'])uuid(scope[key]);
  const workspaceSql=`select jsonb_build_object('workspace_id',j.workspace_id,'version_workspace_id',v.workspace_id,'resource_id',j.resource_id,'version_id',v.id,'series_id',v.series_id,'job_id',j.id,'generation_job_id',v.generation_job_id,'empty_batch_count',(select count(*)from eps.jobs where batch_id=${q(EMPTY_BATCH)}::uuid))from eps.jobs j join eps.presentation_versions v on v.id=${q(scope.version_id)}::uuid where j.id=${q(scope.job_id)}::uuid;`;
  const workspace=await ctx.value(ctx.sourceDb,workspaceSql);exact(workspace,['workspace_id','version_workspace_id','resource_id','version_id','series_id','job_id','generation_job_id','empty_batch_count']);
  uuid(workspace.workspace_id);assert.equal(workspace.workspace_id,workspace.version_workspace_id);assert.equal(workspace.resource_id,scope.version_id);assert.equal(workspace.version_id,scope.version_id);assert.equal(workspace.series_id,scope.series_id);assert.equal(workspace.job_id,scope.job_id);assert.equal(workspace.generation_job_id,scope.job_id);assert.equal(workspace.empty_batch_count,0);
  assert.deepEqual(await ctx.value(ctx.restoreDb,workspaceSql),workspace,'RECOVERY38_RESTORED_BATCH_SCOPE_CHANGED');
  const batchSql=`do $recovery38_batch$begin begin perform public.eps_list_jobs_by_batch(${q(workspace.workspace_id)}::uuid,null,null,25,null);raise exception'RECOVERY38_NULL_BATCH_ACCEPTED';exception when raise_exception then if sqlerrm<>'INVALID_REQUEST'then raise;end if;perform set_config('eps.recovery38.null_batch_error',sqlerrm,true);end;end$recovery38_batch$;select jsonb_build_object('null_batch_error',current_setting('eps.recovery38.null_batch_error'),'empty_batch',public.eps_list_jobs_by_batch(${q(workspace.workspace_id)}::uuid,null,null,25,${q(EMPTY_BATCH)}::uuid));`;
  const batch=await ctx.value(ctx.sourceDb,batchSql,'authenticated',ACTOR);assert.deepEqual(batch,{null_batch_error:'INVALID_REQUEST',empty_batch:{data:[],page:{next_cursor:null}}});
  assert.deepEqual(await ctx.value(ctx.restoreDb,batchSql,'authenticated',ACTOR),batch,'RECOVERY38_RESTORED_BATCH_READ_CHANGED');
  await ctx.sql(ctx.restoreDb,`do $$begin begin update eps.presentation_video_english_transcripts set english_text='Changed';raise exception'RECOVERY38_COMPANION_MUTABLE';exception when raise_exception then if sqlerrm<>'IMMUTABLE_VERSION'then raise;end if;end;end$$;`);
  await ctx.sql(ctx.restoreDb,`do $$begin begin delete from eps.presentation_video_english_transcripts;raise exception'RECOVERY38_COMPANION_DELETE_ACCEPTED';exception when raise_exception then if sqlerrm<>'IMMUTABLE_VERSION'then raise;end if;end;end$$;`);
  await ctx.sql(ctx.restoreDb,`do $$declare n integer;begin update eps.candidate_media set english_transcript='Later authored synthetic English.',row_version=row_version+1 where id='${MEDIA}';get diagnostics n=row_count;if n<>1 then raise exception'RECOVERY38_ONE_LIBRARY_EDIT_REQUIRED';end if;end$$;`);
  const frozen=await ctx.value(ctx.restoreDb,englishSql38());assert.deepEqual(frozen,extra.english);
  const saved=await ctx.value(ctx.restoreDb,`select eps.presentation_video_english_transcript(${q(scope.version_id)}::uuid,'${VIDEO}');`);
  assert.deepEqual(saved,{english_text:ENGLISH,english_status:'available',english_sha256:sha(ENGLISH)});
  ctx.report.full38_restore={result:'passed_before_recovery',all_populated_table_hashes_exact:true,English_companion_exact:true,attempts_and_events_exact:true,immutable_companion_denial:true,library_edit_preserves_frozen_English:true,feedback_summary_and_Auth_preserved:true,batch38_authenticated_null_batch_INVALID_REQUEST_parity:true,batch38_authenticated_empty_batch_parity:true,batch38_nonempty_pagination_proven:false,provider_executed:false};
 }
 async function freshRestoredLease(pending,oldLease,inputHash){
  await ctx.sql(ctx.restoreDb,`do $$declare n integer;begin update eps.jobs set available_at=clock_timestamp()-interval'1second'where id=${q(pending.job_id)}::uuid and status='queued'and error->>'code'='LEASE_EXPIRED';get diagnostics n=row_count;if n<>1 then raise exception'RECOVERY38_EXACT_RECOVERED_JOB_REQUIRED';end if;end$$;`);
  const lease=await ctx.value(ctx.restoreDb,`select eps.claim_job_stage_replay(${j({job_id:pending.job_id,stage:'prepare_presentation',input_hash:inputHash,workflow_execution_id:'synthetic-recovery38-restored'})},'recovery38-fresh-restored','synthetic-key',${q('7'.repeat(64))});`,'eps_jobs_executor');
  assert(lease.attempt_id&&lease.attempt_id!==oldLease.attempt_id);assert.equal(lease.job_id,pending.job_id);
  const traces=await ctx.value(ctx.restoreDb,`select jsonb_build_object('all_count',count(*),'old',count(*)filter(where attempt_id=${q(oldLease.attempt_id)}::uuid),'fresh',count(*)filter(where attempt_id=${q(lease.attempt_id)}::uuid))from eps.job_stage_attempts;`);
  assert.deepEqual(traces,{all_count:extra.data['eps.job_stage_attempts'].count+1,old:1,fresh:1});assert.deepEqual(await ctx.value(ctx.restoreDb,englishSql38()),extra.english);
  ctx.report.full38_restore.fresh_restored_lease_and_trace=true;ctx.report.full38_restore.controlled_availability_advance=true;ctx.report.full38_restore.result='passed';await stable();
 }
 async function cleanupRoles(){
  assert.equal(await ctx.databaseIdentity(ctx.sourceDb,true),null);assert.equal(await ctx.databaseIdentity(ctx.restoreDb,true),null);
  let error;try{const observed=await observeRole();if(traceAttempted){if(observed!==null){assert(traceExpected);await ctx.docker(ctx.psqlArgs('template1'),{input:traceCleanup38(traceExpected,observed,ctx.runId)});assert.equal(await observeRole(),null);}ctx.report.new38_trace_role_removed=true;}else ctx.report.new38_unattempted_foreign_role_untouched=observed!==null;}catch(e){error=e;}
  try{await inherited.cleanupRoles();}catch(e){error??=e;}if(error)throw error;
 }
 return{get active(){return inherited.active;},get catalogueSql(){return inherited.catalogueSql;},upgrade,cleanupRoles,bundleSources,fixtureSql:()=>source('development/m07/recovery37/fixture.sql'),beforeBackup,beforeFullRestoreProfile,afterRestore,freshRestoredLease,
  seedSql:inherited.seedSql,authBoundary:inherited.authBoundary,admitSourceFixtureCatalogue:inherited.admitSourceFixtureCatalogue,profileEvidence:inherited.profileEvidence};
}
