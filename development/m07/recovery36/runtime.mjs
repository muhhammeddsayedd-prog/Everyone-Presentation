/** Owned metadata-only continuation. Import is inert; parent owns all IO/SQL. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {createRecovery33Context,exactPreimageAdmission} from '../recovery33/runtime.mjs';
import {ownedPredicate33,ownedIdentity33} from '../recovery33/ownership.mjs';
import {normalizeDatabaseOid} from '../recovery29/identity.mjs';
import {sha} from '../recovery33/compiler.mjs';
import {adapters36,PURPOSE} from './compiler.mjs';
const ROLE='eps_job_trace_owner';
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const json=x=>q(JSON.stringify(x))+'::jsonb';
export function dataSql36(){return `do $rows36$declare r record;n bigint;h text;v jsonb:='{}';begin
 for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'and n.nspname in('eps','public','auth','storage','supabase_migrations')order by 1,2 loop
 execute format('select count(*),encode(sha256(convert_to(coalesce(string_agg(h,E''\\n''order by h),''''),''UTF8'')),''hex'')from(select encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'')h from %I.%I t)s',r.nspname,r.relname)into n,h;
 v:=v||jsonb_build_object(r.nspname||'.'||r.relname,jsonb_build_object('count',n,'sha256',h));end loop;
 perform set_config('eps.recovery36.rows',v::text,true);end$rows36$;select current_setting('eps.recovery36.rows')::jsonb;`;}
export function validateData36(value,catalogue){
 assert(value&&typeof value==='object'&&!Array.isArray(value));assert(Object.keys(value).length<=512);
 for(const row of Object.values(value)){assert.deepEqual(Object.keys(row).sort(),['count','sha256']);assert(Number.isSafeInteger(row.count)&&row.count>=0&&/^[a-f0-9]{64}$/u.test(row.sha256));}
 for(const key of ['eps.candidate_media','eps.presentation_video_transcripts','eps.presentation_video_english_transcripts','eps.presentation_versions','eps.job_stage_attempts','eps.job_events','eps.media_assets'])assert(value[key]?.count>0,'RECOVERY36_POPULATED_GRAPH_REQUIRED');
 assert.equal(value['supabase_migrations.schema_migrations']?.count,36);
 if(catalogue){
  const tables=Object.keys(catalogue).map(k=>/^tables\|([^|]+)\|owner$/u.exec(k)?.[1]).filter(Boolean);assert(tables.length>=75);
  for(const table of tables)assert(Object.hasOwn(value,table),'RECOVERY36_TABLE_HASH_MISSING');
  for(const table of Object.keys(value))assert(tables.includes(table)||/^supabase_migrations\.[A-Za-z0-9_]+$/u.test(table));
 }
 return value;
}
export function checkedDump36(raw,expected){assert(raw instanceof Uint8Array&&raw.length>0&&raw.length<=96*1024*1024&&sha(raw)===expected,'RECOVERY36_METADATA_CHECKSUM_REQUIRED');return raw;}
export function traceRoleQuery36(){return `select jsonb_build_object('role',(select jsonb_build_object('name',r.rolname,'oid',r.oid,'marker',shobj_description(r.oid,'pg_authid'),
 'login',r.rolcanlogin,'super',r.rolsuper,'inherit',r.rolinherit,'bypassrls',r.rolbypassrls,'create_role',r.rolcreaterole,'create_db',r.rolcreatedb,'replication',r.rolreplication,'connection_limit',r.rolconnlimit,'valid_until',r.rolvaliduntil,
 'memberships',(select coalesce(jsonb_agg(jsonb_build_object('role',roleid::regrole::text,'member',member::regrole::text,'grantor',grantor::regrole::text,'admin',admin_option,'inherit',inherit_option,'set',set_option)order by roleid,member,grantor),'[]')from pg_auth_members where roleid=r.oid or member=r.oid or grantor=r.oid),
 'dependencies',(select coalesce(jsonb_agg(jsonb_build_object('dbid',dbid,'classid',classid::regclass::text,'objid',objid,'objsubid',objsubid,'deptype',deptype)order by dbid,classid,objid,objsubid),'[]')from pg_shdepend where refclassid='pg_authid'::regclass and refobjid=r.oid),
 'clients',(select count(*)from pg_stat_activity where backend_type='client backend'and pid<>pg_backend_pid()))from pg_roles r where r.rolname='${ROLE}'));`;}
function safeRole(row){
 assert(row&&row.name===ROLE);const oid=normalizeDatabaseOid(row.oid);
 assert(/^eps-m07-recovery36:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}:trace$/u.test(row.marker));
 for(const key of ['login','super','inherit','bypassrls','create_role','create_db','replication'])assert.equal(row[key],false);
 assert.equal(row.connection_limit,-1);assert.equal(row.valid_until,null);
 const explicit={role:ROLE,member:'postgres',grantor:'postgres',admin:false,inherit:true,set:true};
 const bootstrap={role:ROLE,member:'postgres',grantor:'supabase_admin',admin:true,inherit:false,set:false};
 assert(Array.isArray(row.memberships)&&row.memberships.length>=1&&row.memberships.length<=2);
 const memberships=row.memberships.map(member=>{
  assert(member&&typeof member==='object'&&!Array.isArray(member));
  assert.deepEqual(Object.keys(member).sort(),['admin','grantor','inherit','member','role','set']);
  const allowed=member.grantor==='postgres'?explicit:bootstrap;assert.deepEqual(member,allowed);
  return JSON.stringify(allowed);
 });
 assert.equal(new Set(memberships).size,memberships.length);assert(memberships.includes(JSON.stringify(explicit)));
 // Compare identities and the exact grant set without changing the native
 // OID representation or membership order used by the SQL preimage guard.
 return{oid,memberships:memberships.sort()};
}
export function assertTraceRole36(expected,observed,{databasesAbsent}){
 assert.equal(databasesAbsent,true);assert.deepEqual(safeRole(observed),safeRole(expected));assert.equal(observed.marker,expected.marker);
 assert.equal(observed.clients,0);assert.deepEqual(observed.dependencies,[]);return true;
}
export function traceCleanupSql36(expected,observed){
 assertTraceRole36(expected,observed,{databasesAbsent:true});
 const query=traceRoleQuery36().trim().replace(/;$/u,' into actual_role;');
 return `begin;set local lock_timeout='5s';set local statement_timeout='30s';lock table pg_authid,pg_auth_members,pg_shdepend in share row exclusive mode;
 do $$declare actual_role jsonb;begin ${query}if actual_role is distinct from ${json({role:observed})} then raise exception'RECOVERY36_OWNED_TRACE_ROLE_REQUIRED';end if;end$$;drop role ${ROLE};commit;`;
}
export function createRecovery36Context(ctx,{contextFactory=createRecovery33Context,io={readFile,writeFile}}={}){
 const inherited=contextFactory(ctx);let traceExpected=null,traceAttempted=false;
 const source=file=>{assert(ctx.sourceFiles.get(file)instanceof Uint8Array);return ctx.sourceFiles.get(file).toString('utf8');};
 const identity=async database=>({database,marker:ctx.marker(database),oid:(await ctx.databaseIdentity(database)).oid});
 const stable=async()=>{for(const[file,bytes]of ctx.sourceFiles)assert.equal(sha(await io.readFile(path.join(ctx.root,file))),sha(bytes),'RECOVERY36_SOURCE_CHANGED');};
 const save=async(file,value)=>{assert(ctx.report.private_artifact_acl);const raw=typeof value==='string'||value instanceof Uint8Array?value:JSON.stringify(value);await io.writeFile(path.join(ctx.privateRoot,file),raw,{flag:'wx',mode:0o600});return sha(raw);};
 const observeRole=async()=>{const result=await ctx.docker(ctx.psqlArgs('template1'),{input:'begin read only;'+traceRoleQuery36()+'rollback;'});return ctx.rows(result.stdout).at(-1).role;};
 async function upgrade(){
  assert.equal(await observeRole(),null,'RECOVERY36_EXISTING_ROLE_NOT_ADOPTED');await inherited.upgrade();
  const id=await identity(ctx.sourceDb),migrations=adapters36(ctx.sourceFiles,id);
  for(const item of migrations){
   await stable();const catalogue=await ctx.catalogue(ctx.sourceDb),dataQuery=source('development/m07/db/data29.sql');
   const data=await ctx.value(ctx.sourceDb,dataQuery+"select current_setting('eps.m07_readback.old_data')::jsonb;");
   const admission=exactPreimageAdmission({catalogueSql:inherited.catalogueSql,catalogue,dataSql:dataQuery,data,identity:id});
   const marker=`eps-m07-recovery36:${ctx.runId}:trace`;if(item.version==='20261101012057')traceAttempted=true;
   const tail=`\ninsert into supabase_migrations.schema_migrations(version,statements,name)values(${q(item.version)},array[]::text[],${q(path.basename(item.file,'.sql').slice(15))});`+(item.version==='20261101012057'?`comment on role ${ROLE} is ${q(marker)};`+traceRoleQuery36():'');
   await save(`migration-${item.version}-owned.sql`,admission+item.sql+tail);const result=await ctx.sql(ctx.sourceDb,admission+item.sql+tail);
   if(item.version==='20261101012057'){traceExpected=ctx.rows(result.stdout).find(v=>Object.hasOwn(v,'role'))?.role;safeRole(traceExpected);assert.equal(traceExpected.marker,marker);}
   ctx.report.actual_local_migrations_executed.push(item.version);
  }
  ctx.report.recovery36_migrations=migrations.map(({file,version,source_sha256,functional_sha256,adapted_sha256})=>({file,version,source_sha256,functional_sha256,adapted_sha256,admission_only:true}));
 }
 async function metadataRestore(){
  await stable();const id=await identity(ctx.sourceDb);ownedIdentity33(id);
  const guard=`do $$begin if current_user<>'postgres'or ${ownedPredicate33(id)}then raise exception'RECOVERY36_OWNED_FIXTURE_REQUIRED';end if;end$$;`;
  const fixture=guard+'\n'+source('tests/db/m04-assignments-fixture.sql')+'\nset local role postgres;\n'+inherited.seedSql()+'\n'+source('tests/db/m05-versions-fixture.sql')+'\n'+source(PURPOSE+'fixture.sql');
  const executed=await ctx.sql(ctx.sourceDb,fixture),scope=ctx.rows(executed.stdout).find(v=>Object.hasOwn(v,'fixture'))?.fixture;assert(scope?.ack?.resource_id&&scope?.lease?.attempt_id);await save('metadata36-fixture-private.json',scope);
  ctx.report.checkpoint='populated36-metadata-dump-restore';
  const expected=await ctx.catalogue(ctx.sourceDb),data=validateData36(await ctx.value(ctx.sourceDb,dataSql36()),expected);
  ctx.report.metadata36_data_sha256=await save('metadata36-source-row-hashes.json',data);
  ctx.report.metadata36_catalogue_sha256=await save('metadata36-source-catalogue.json',expected);
  const dump=await ctx.dump(ctx.sourceDb);ctx.report.metadata36_dump_sha256=await save('metadata36.sql',dump);
  const restoredBytes=checkedDump36(await io.readFile(path.join(ctx.privateRoot,'metadata36.sql')),ctx.report.metadata36_dump_sha256);
  assert.throws(()=>checkedDump36(Buffer.concat([restoredBytes,Buffer.from('corrupt')]),ctx.report.metadata36_dump_sha256));
  await ctx.createDatabase(ctx.restoreDb);await ctx.restoreOwnedDump(ctx.restoreDb,restoredBytes);
  const observed=await ctx.catalogue(ctx.restoreDb);
  const differences=[...new Set([...Object.keys(expected),...Object.keys(observed)])].sort()
   .filter(key=>!isDeepStrictEqual(expected[key],observed[key])).map(key=>({key,source:expected[key],restored:observed[key]}));
  ctx.report.metadata36_restored_before_profile_sha256=await save('metadata36-restored-before-profile.json',observed);
  ctx.report.metadata36_catalogue_differences_sha256=await save('metadata36-catalogue-differences-private.json',differences);
  ctx.report.metadata36_catalogue_difference_count=differences.length;
  ctx.report.metadata36_catalogue_difference_keys=differences.map(({key})=>key);
  ctx.report.metadata36_restore_profile=await ctx.preserveOriginalDumpProfile(ctx.restoreDb,expected);
  assert.deepEqual(await ctx.catalogue(ctx.restoreDb),expected,'RECOVERY36_PORTABLE_CATALOGUE_CHANGED');
  assert.deepEqual(validateData36(await ctx.value(ctx.restoreDb,dataSql36()),expected),data,'RECOVERY36_ALL_POPULATED_TABLE_ROWS_CHANGED');
  await inherited.authBoundary(ctx.sourceDb);await inherited.authBoundary(ctx.restoreDb);
  const summarySql="select set_config('request.jwt.claim.sub','8a1a0000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{\"sub\":\"8a1a0000-0000-4000-8000-000000000001\",\"role\":\"authenticated\",\"aud\":\"authenticated\",\"is_anonymous\":false,\"session_id\":\"33000000-0000-4000-8000-000000000002\"}',true);set local role authenticated;select public.eps_get_workspace_summary('8a2a0000-0000-4000-8000-000000000001');";
  assert.deepEqual(await ctx.value(ctx.sourceDb,summarySql),await ctx.value(ctx.restoreDb,summarySql));
  const englishSql="select coalesce(jsonb_agg(to_jsonb(t)order by version_id,video_asset_id),'[]')from eps.presentation_video_english_transcripts t;";
  const english=await ctx.value(ctx.restoreDb,englishSql);assert(Array.isArray(english)&&english.length===1&&english[0].status==='available');
  const oldTraceSql=`select jsonb_build_object('trace',(select to_jsonb(t)from eps.job_stage_attempts t where job_id=${q(scope.ack.job_id)}::uuid and attempt_id=${q(scope.lease.attempt_id)}::uuid),'events',(select coalesce(jsonb_agg(to_jsonb(e)order by sequence),'[]')from eps.job_events e where job_id=${q(scope.ack.job_id)}::uuid and attempt_id=${q(scope.lease.attempt_id)}::uuid));`;
  const oldTrace=await ctx.value(ctx.restoreDb,oldTraceSql);assert(oldTrace.trace&&oldTrace.events.length===1);
  const denied=await ctx.sql(ctx.restoreDb,'select *from eps.job_stage_attempts;','authenticated',undefined,true);assert.notEqual(denied.code,0);assert(denied.stderr.includes('permission denied'));
  await ctx.sql(ctx.restoreDb,`set local role eps_job_trace_owner;do $$begin begin
   insert into eps.job_stage_attempts(schema_version,job_id,attempt_id,kind,stage,attempt,stage_attempt,dispatch_generation,correlation_id,input_hash,workflow_execution_id,workflow_execution_ref_state,claimed_at,job_row_version)
   values('1.0',${q(scope.ack.job_id)}::uuid,gen_random_uuid(),'presentation_render','prepare_presentation',99,1,1,'synthetic-direct-denied',${q(scope.hash)},null,'not_provided',clock_timestamp(),1);
   raise exception'RECOVERY36_DIRECT_TRACE_INSERT_ACCEPTED';exception when insufficient_privilege then null;end;end$$;`);
  await ctx.sql(ctx.restoreDb,`do $$begin begin update eps.presentation_video_english_transcripts set english_text='Changed';raise exception'RECOVERY36_COMPANION_MUTABLE';exception when raise_exception then if sqlerrm<>'IMMUTABLE_VERSION'then raise;end if;end;end$$;`);
  await ctx.sql(ctx.restoreDb,`do $$begin begin delete from eps.presentation_video_english_transcripts;raise exception'RECOVERY36_COMPANION_DELETE_ACCEPTED';exception when raise_exception then if sqlerrm<>'IMMUTABLE_VERSION'then raise;end if;end;end$$;`);
  await ctx.sql(ctx.restoreDb,`do $$begin begin
   insert into eps.job_stage_attempts(schema_version,job_id,attempt_id,kind,stage,attempt,stage_attempt,dispatch_generation,correlation_id,input_hash,workflow_execution_id,workflow_execution_ref_state,claimed_at,job_row_version)
   values('1.0','00000000-0000-0000-0000-000000000000',gen_random_uuid(),'presentation_render','prepare_presentation',99,1,1,'synthetic-fk-denied',${q(scope.hash)},null,'not_provided',clock_timestamp(),1);
   raise exception'RECOVERY36_TRACE_FK_NOT_ENFORCED';exception when foreign_key_violation then null;end;end$$;`);
  await ctx.sql(ctx.restoreDb,"update eps.candidate_media set english_transcript='Later authored synthetic English.',row_version=row_version+1 where id='8a9f0000-0000-4000-8000-000000000002';");
  const savedEnglish=await ctx.value(ctx.restoreDb,`select jsonb_build_object('status',v->>'english_status','sha256',v->>'english_sha256')from(select eps.presentation_video_english_transcript(${q(scope.ack.resource_id)}::uuid,'8a9f0000-0000-4000-8000-000000000001')v)s;`);
  assert.deepEqual(savedEnglish,{status:'available',sha256:sha('Authored synthetic English.')});assert.deepEqual(await ctx.value(ctx.restoreDb,englishSql),english);
  assert(Array.isArray(scope.outbox?.leases)&&scope.outbox.leases.length===1);const oldOutbox=scope.outbox.leases[0];
  const outboxBefore=await ctx.value(ctx.restoreDb,`select jsonb_build_object('status',status,'digest_matches',lease_token_digest=encode(sha256(convert_to(${q(oldOutbox.lease_token)},'UTF8')),'hex'))from eps.outbox_events where id=${q(oldOutbox.id)}::uuid;`);assert.deepEqual(outboxBefore,{status:'leased',digest_matches:true});
  await ctx.sql(ctx.restoreDb,`update eps.outbox_events set lease_expires_at=clock_timestamp()-interval'1second'where id=${q(oldOutbox.id)}::uuid;`);
  const next=await ctx.value(ctx.restoreDb,'select eps.claim_job_outbox(25);','eps_jobs_dispatcher'),nextLease=next.leases.find(v=>v.id===oldOutbox.id);assert(nextLease&&nextLease.lease_token!==oldOutbox.lease_token);
  const deniedAck=await ctx.sql(ctx.restoreDb,`select eps.finish_job_outbox(${q(oldOutbox.id)}::uuid,${q(oldOutbox.lease_token)},true);`,'eps_jobs_dispatcher',undefined,true);assert.notEqual(deniedAck.code,0);assert(deniedAck.stderr.includes('INVALID_TRANSITION'));
  assert.deepEqual(await ctx.value(ctx.restoreDb,`select eps.finish_job_outbox(${q(nextLease.id)}::uuid,${q(nextLease.lease_token)},true);`,'eps_jobs_dispatcher'),{acknowledged:true,stale:false});
  await ctx.sql(ctx.restoreDb,`update eps.jobs set lease_expires_at=clock_timestamp()-interval'1second'where id=${q(scope.ack.job_id)}::uuid;`);
  const recovered=await ctx.value(ctx.restoreDb,'select eps.recover_job_stages(25);','eps_jobs_executor');assert.equal(recovered.recovered,1);
  const stale=await ctx.value(ctx.restoreDb,`select eps.record_job_event(${json({event_id:'recovery36-stale-heartbeat',job_id:scope.ack.job_id,attempt_id:scope.lease.attempt_id,lease_token:scope.lease.lease_token,stage:'prepare_presentation',input_hash:scope.hash,sequence:2,event_type:'heartbeat'})});`,'eps_jobs_executor');assert.equal(stale.stale,true);assert.equal(stale.applied,false);
  // Recovery intentionally schedules a two-second backoff. Advance only this
  // owned synthetic job's availability; this is not real-time retry evidence.
  await ctx.sql(ctx.restoreDb,`do $$declare changed integer;begin update eps.jobs set available_at=clock_timestamp()-interval'1second'where id=${q(scope.ack.job_id)}::uuid and status='queued'and error->>'code'='LEASE_EXPIRED';get diagnostics changed=row_count;if changed<>1 then raise exception'RECOVERY36_CONTROLLED_AVAILABILITY_REQUIRED';end if;end$$;`);
  const fresh=await ctx.value(ctx.restoreDb,`select eps.claim_job_stage_replay(${json({job_id:scope.ack.job_id,stage:'prepare_presentation',input_hash:scope.hash,workflow_execution_id:'synthetic-recovery36-restored-prepare'})},'recovery36-restored-claim','synthetic-key',${q('a'.repeat(64))});`,'eps_jobs_executor');assert.notEqual(fresh.attempt_id,scope.lease.attempt_id);
  const traces=await ctx.value(ctx.restoreDb,`select jsonb_build_object('count',count(*),'old',count(*)filter(where attempt_id=${q(scope.lease.attempt_id)}::uuid),'fresh',count(*)filter(where attempt_id=${q(fresh.attempt_id)}::uuid))from eps.job_stage_attempts where job_id=${q(scope.ack.job_id)}::uuid;`);assert.deepEqual(traces,{count:2,old:1,fresh:1});assert.deepEqual(await ctx.value(ctx.restoreDb,oldTraceSql),oldTrace);assert.deepEqual(await ctx.value(ctx.restoreDb,englishSql),english);
  await stable();ctx.report.recovery36_metadata={result:'passed',history_count:36,full_portable_catalogue_exact:true,all_populated_table_hashes_exact:true,english_companion_and_trace_restored:true,summary_and_synthetic_auth_boundary_preserved:true,controlled_job_expiry_and_fresh_trace:true,controlled_availability_advance:true,stale_callback_denied:true,outbox_lease_and_token_fencing_restored:true,metadata_checksum_negative_passed:true,source_fixture_synthetic:true,trace_references_synthetic:true,native_media_executed:false,object_bytes_restored:false,storage_http_tested:false,provider_auth_restored:false,deployed_restore_tested:false};
  ctx.report.native_media_executed=false;ctx.report.storage_http_tested=false;ctx.report.deployed_restore_tested=false;
  ctx.report.limitations=['Synthetic same-cluster populated metadata only; no video/PDF bytes, Storage HTTP, provider Auth/settings/secrets, deployed/independent restore, physical crash or RTO/RPO.'];
 }
 async function cleanupRoles(){
  const a=await ctx.databaseIdentity(ctx.sourceDb,true),b=await ctx.databaseIdentity(ctx.restoreDb,true);assert.equal(a,null);assert.equal(b,null);
  const observed=await observeRole();if(!traceAttempted){ctx.report.unattempted_trace_role_untouched=observed!==null;ctx.report.new36_trace_role_removed=observed===null;}
  else{if(observed!==null){assertTraceRole36(traceExpected,observed,{databasesAbsent:true});await ctx.docker(ctx.psqlArgs('template1'),{input:traceCleanupSql36(traceExpected,observed)});assert.equal(await observeRole(),null);}ctx.report.new36_trace_role_removed=true;}
  await inherited.cleanupRoles();
 }
 return{get active(){return inherited.active;},get catalogueSql(){return inherited.catalogueSql;},upgrade,metadataRestore,cleanupRoles,
  seedSql:inherited.seedSql,authBoundary:inherited.authBoundary,admitSourceFixtureCatalogue:inherited.admitSourceFixtureCatalogue,profileEvidence:inherited.profileEvidence};
}
