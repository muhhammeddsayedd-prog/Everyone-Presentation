/** Direct legacy raw-helper cases on new rollback-only synthetic queued clones. */
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {ACTOR,OTHER,json,literal,sha} from '../presentation-lock-source-proof/proof.mjs';
import {nativeError} from '../presentation-lock-source-pool-proof/native.mjs';
import {observePending} from '../presentation-lock-source-pool-proof/cases.mjs';

const only=rows=>{assert.equal(rows.length,1);return rows[0];};
const bounds="set local statement_timeout='8s';set local lock_timeout='8s';";
const snapshot='select locksource41_proof.row_hashes();';
const authCodes=new Set(['42501','CAPABILITY_REQUIRED','RESOURCE_NOT_FOUND','AUTH_REQUIRED','IMMUTABLE_VERSION']);
const canon=value=>Array.isArray(value)?value.map(canon):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canon(value[key])])):value;
const digest=value=>sha(JSON.stringify(canon(value)));

export function legacyCloneSQL(ctx,name,empty){
 assert(['old','candidate'].includes(ctx.variant)&&typeof empty==='boolean');
 assert(/^[a-z_]{1,30}$/u.test(name));
 const p=ctx.profiles.control,source=ctx.id('background-version-1');
 const version=ctx.id('rawauth-version-'+ctx.variant+'-'+name),job=ctx.id('rawauth-job-'+ctx.variant+'-'+name);
 const tag='rawauth-'+ctx.runId+'-'+ctx.variant+'-'+name;
 // Background source is declared owned synthetic Ready metadata, read only.
 // The zero clone deliberately issues no pin/slide query before its barrier.
 return `reset role;begin isolation level read committed;${bounds}
do $raw_owned$begin
 if current_user<>'postgres'or not exists(select 1 from eps.presentation_versions where id=${literal(source)}::uuid and status='ready'and generated_by=${literal(OTHER)}::uuid)
 then raise exception'RAW_AUTHORITY_DECLARED_SOURCE_REQUIRED';end if;
end$raw_owned$;
insert into eps.jobs select(populated).*from eps.presentation_versions v join eps.jobs j on j.id=v.generation_job_id
 cross join lateral jsonb_populate_record(null::eps.jobs,to_jsonb(j)||jsonb_build_object('id',${literal(job)},'workspace_id',${literal(p.workspace)},'requested_by',${literal(ACTOR)},'resource_id',${literal(version)},'dedupe_key',encode(sha256(convert_to(${literal(tag)},'UTF8')),'hex'),'correlation_id',${literal(tag)}))populated where v.id=${literal(source)}::uuid;
insert into eps.presentation_versions select(populated).*from eps.presentation_versions v
 cross join lateral jsonb_populate_record(null::eps.presentation_versions,to_jsonb(v)||jsonb_build_object('id',${literal(version)},'series_id',${literal(p.series)},'workspace_id',${literal(p.workspace)},'project_id',${literal(p.project)},'generated_by',${literal(ACTOR)},'generation_job_id',${literal(job)},'version_number',v.version_number+100000,'status','queued','english_transcript_version',null,'manifest_asset_id',null,'pdf_asset_id',null,'ready_at',null,'failure_code',null))populated where v.id=${literal(source)}::uuid;
${empty?'':`insert into eps.version_slides(id,version_id,ordinal,kind,source_assignment_id,source_slot_id,snapshot,content_sha256)
 select md5(d.id::text||${literal(tag)})::uuid,${literal(version)}::uuid,d.ordinal,d.kind,d.source_assignment_id,d.source_slot_id,d.snapshot,d.content_sha256 from eps.version_slides d where d.version_id=${literal(source)}::uuid;
insert into eps.presentation_version_assets select(populated).*from eps.presentation_version_assets p
 cross join lateral jsonb_populate_record(null::eps.presentation_version_assets,to_jsonb(p)||jsonb_build_object('version_id',${literal(version)}))populated where p.version_id=${literal(source)}::uuid;`}
select jsonb_build_object('version',id,'queued',status='queued','legacy_null_English',english_transcript_version is null,'controlled_owner',generated_by=${literal(ACTOR)}::uuid,'control_scope',workspace_id=${literal(p.workspace)}::uuid and project_id=${literal(p.project)}::uuid and series_id=${literal(p.series)}::uuid,'source_ready_sha256',(select encode(sha256(convert_to(to_jsonb(v)::text,'UTF8')),'hex')from eps.presentation_versions v where v.id=${literal(source)}::uuid))from eps.presentation_versions where id=${literal(version)}::uuid;`;
}

async function runCase(ctx,evidence,name,change,empty){
 const {holder,writer,observer}=ctx,p=ctx.profiles.control;
 const row={name,change,empty,declared_direct_helper_fixture:true,normal_generation_acceptance:false,
  Ready_source_DML_issued:false,fixture_committed:false,actual_relation_wait:false,
  authority_changed:false,authority_restored:false,rolled_back:false,completed:false};
 evidence.cases.push(row);
 let sender,pending,barrier=false,started=false,pre,table,predicate,primary,cleanupError;
 const capture=async(label,error)=>ctx.captureError('raw_'+ctx.variant+'_'+name+'_'+label,error);
 const cleanup=async(label,operation)=>{try{await operation();}catch(error){(row.cleanup_errors??=[]).push({phase:label,error:nativeError(error),private_error:await capture(label,error)});cleanupError??=error;}};
 const clock=async()=>Number(only(await observer.request("reset role;select jsonb_build_object('epoch',extract(epoch from clock_timestamp()));")).epoch);
 const locks=async()=>{
  const value=only(await observer.request(`reset role;select jsonb_build_object('raw_insert_lock',exists(select 1 from pg_locks where pid=${sender.pid} and relation='eps.presentation_video_transcripts'::regclass and mode='RowExclusiveLock'),'pin_lock_count',(select count(*)from pg_locks where pid=${sender.pid} and relation='eps.presentation_version_assets'::regclass));`));
  assert.equal(typeof value.raw_insert_lock,'boolean');assert(Number.isSafeInteger(value.pin_lock_count)&&value.pin_lock_count>=0);
  return{raw_insert_lock:value.raw_insert_lock,pin_lock_count:value.pin_lock_count};
 };
 try{
  sender=await ctx.startFreshGeneration('ra_'+ctx.variant[0]+name.slice(0,8));started=true;
  assert.equal(new Set([sender.pid,holder.pid,writer.pid,observer.pid]).size,4);
  const clone=only(await sender.request(legacyCloneSQL(ctx,name,empty)));
  assert.deepEqual({queued:clone.queued,legacy_null_English:clone.legacy_null_English,controlled_owner:clone.controlled_owner,control_scope:clone.control_scope},{queued:true,legacy_null_English:true,controlled_owner:true,control_scope:true});
  assert.equal(clone.version,ctx.id('rawauth-version-'+ctx.variant+'-'+name));assert(/^[a-f0-9]{64}$/u.test(clone.source_ready_sha256));
  assert.deepEqual(Object.keys(clone).sort(),['control_scope','controlled_owner','legacy_null_English','queued','source_ready_sha256','version']);
  row.clone=clone;row.sender_pid=sender.pid;row.blocker_pid=holder.pid;
  if(empty){row.before_barrier=await locks();assert.equal(row.before_barrier.pin_lock_count,0);assert.equal(row.before_barrier.raw_insert_lock,false);}
  const relation=empty?'eps.presentation_version_assets':'eps.presentation_video_transcripts';
  const mode=empty?'access exclusive':'share',waitingMode=empty?'AccessShareLock':'RowExclusiveLock';
  await holder.request('reset role;begin;'+bounds+`lock table ${relation} in ${mode} mode;`);barrier=true;
  const expiry=change==='expiry'?Math.floor(await clock())+4:null;if(expiry!==null)row.expiry_epoch=expiry;
  await sender.request(ctx.acting('mcp','eps_review_owner',ACTOR,expiry===null?{}:{exp:expiry})+bounds);
  row.dispatched=true;pending=observePending(sender.request(`select jsonb_build_object('captured',eps.capture_presentation_video_transcripts(${literal(clone.version)}::uuid));`));
  let settled=false;pending.then(()=>{settled=true;},()=>{settled=true;});
  for(let i=0;i<150;i++){
   const found=only(await observer.request(`reset role;select jsonb_build_object('waiting',exists(select 1 from pg_locks where pid=${sender.pid} and not granted and relation='${relation}'::regclass and mode='${waitingMode}')and ${holder.pid}=any(pg_blocking_pids(${sender.pid})));`));
   if(found.waiting===true){row.actual_relation_wait=true;break;}if(settled)break;await delay(20);
  }
  assert.equal(row.actual_relation_wait,true,'RAW_AUTHORITY_ACTUAL_WAIT_REQUIRED');row.wait_mode=waitingMode;
  if(empty){row.during_wait=await locks();assert.equal(row.during_wait.raw_insert_lock,false,'RAW_AUTHORITY_EMPTY_INSERT_LOCK_FORBIDDEN');}
  if(change==='expiry'){
   await delay(Math.max(0,expiry*1000+125-(await clock())*1000));row.database_clock_expired=(await clock())>expiry;assert.equal(row.database_clock_expired,true);
  }else if(change!==null){
   table=change==='membership'?'public.project_memberships':'public.app_capability_grants';
   predicate=change==='membership'?`project_id=${literal(p.project)}::uuid and principal_id=${literal(ACTOR)}::uuid`:`principal_id=${literal(ACTOR)}::uuid and capability='presentations.generate'`;
   pre=await ctx.value(`select to_jsonb(t)from ${table} t where ${predicate};`);assert(pre&&pre.principal_id===ACTOR);if(change==='membership')assert.equal(pre.project_id,p.project);else assert.equal(pre.active,true);
   row.preimage_sha256=digest(pre);
   const mutation=change==='membership'?`delete from ${table} where ${predicate}`:`update ${table} set active=false where ${predicate}`;
   const changed=only(await writer.request('reset role;with affected as('+mutation+" returning 1)select jsonb_build_object('changed_rows',count(*))from affected;"));row.authority_changed=changed.changed_rows===1;assert.equal(row.authority_changed,true);
  }
  await holder.request('rollback;reset role;');barrier=false;row.barrier_released=true;
  let failure;
  try{
   const result=only(await pending);row.normal_SQL_return=true;
   row.result={captured:Number.isSafeInteger(result?.captured)&&result.captured>=0?result.captured:null};
   assert.deepEqual(Object.keys(result),['captured'],'RAW_AUTHORITY_CLOSED_RESULT_REQUIRED');
  }catch(error){failure=error;row.native_error=nativeError(error);row.private_error=await capture('native',error);}
  const expectNormal=change===null||(empty&&ctx.variant==='old');
  if(expectNormal){
   if(failure)throw failure;assert.deepEqual(row.result,{captured:empty?0:1});
   if(empty){row.after_return=await locks();assert.equal(row.after_return.raw_insert_lock,false,'RAW_AUTHORITY_EMPTY_INSERT_LOCK_FORBIDDEN');}
   const observed=only(await sender.request(`reset role;select jsonb_build_object('raw_count',(select count(*)from eps.presentation_video_transcripts where version_id=${literal(clone.version)}::uuid),'english_count',(select count(*)from eps.presentation_video_english_transcripts where version_id=${literal(clone.version)}::uuid),'capture_context_empty',coalesce(current_setting('eps.presentation.transcript_capture_version',true),'')='');`));
   assert.deepEqual(observed,{raw_count:empty?0:1,english_count:0,capture_context_empty:true});row.stored_counts=observed;
   if(change==='expiry'){row.old_empty_expiry_return_retained=true;row.authorization_acceptance_claimed=false;}
   else row.valid_direct_control_passed=true;
  }else{
   assert(failure,'RAW_AUTHORITY_FRESH_DENIAL_REQUIRED');const e=row.native_error;
   const code=e.sqlstate==='42501'?'42501':e.sqlstate==='P0001'?e.application_code:null;
   assert(e.provenance==='first_verbose_psql_ERROR_line'&&authCodes.has(code)&&row.private_error?.normal_return===true,'RAW_AUTHORITY_NATIVE_DENIAL_UNCONFIRMED');
   if(empty)assert.equal(code,'IMMUTABLE_VERSION','RAW_AUTHORITY_EMPTY_FRESH_FENCE_REQUIRED');
   row.denial_code=code;row.denial_provenance=e.provenance;
   row.backend_exit=await Promise.race([sender.done,delay(5000,null,{ref:false})]);assert.equal(row.backend_exit,3,'RAW_AUTHORITY_BACKEND_ROLLBACK_UNCONFIRMED');row.rollback_by_backend_exit=true;row.rolled_back=true;
   row.fresh_authority_denial_observed=true;
  }
 }catch(error){primary=error;row.error=nativeError(error);row.private_failure=await capture('failure',error);}
 finally{
  if(barrier)await cleanup('barrier_release',async()=>{await holder.request('rollback;reset role;');barrier=false;row.barrier_released=true;});
  if(pending)await pending.catch(()=>{});
  if(sender&&started&&!row.rollback_by_backend_exit)await cleanup('sender_rollback',async()=>{await sender.request('rollback;reset role;');row.rolled_back=true;});
  if(pre)await cleanup('authority_restore',async()=>{
   await writer.request('reset role;begin;'+`delete from ${table} where ${predicate};insert into ${table} select(populated).*from jsonb_populate_record(null::${table},${json(pre)})populated;commit;`);
   row.authority_restored=digest(await ctx.value(`select to_jsonb(t)from ${table} t where ${predicate};`))===row.preimage_sha256;assert.equal(row.authority_restored,true);
  });
  if(sender)await cleanup('sender_finish',()=>sender.finish());
 }
 if(primary)throw primary;if(cleanupError)throw cleanupError;
 assert.equal(row.rolled_back,true);assert.deepEqual(await ctx.value(snapshot),ctx.baseline,'RAW_AUTHORITY_BASELINE_CHANGED');row.full_baseline_restored=true;row.completed=true;
}

export async function verifyRawAuthorityCases(ctx){
 assert(['old','candidate'].includes(ctx.variant));
 assert.equal(ctx.report.combined_generation.actual_first_whole_generation_matrix_completed,true);
 assert.equal(ctx.report.combined_generation.review_and_snapshot_contract_equalities_completed,true);
 assert.equal(typeof ctx.startFreshGeneration,'function');
 ctx.report.raw_authority_cases??={};assert(!Object.hasOwn(ctx.report.raw_authority_cases,ctx.variant),'RAW_AUTHORITY_ONCE_PER_VARIANT_REQUIRED');
 const evidence=ctx.report.raw_authority_cases[ctx.variant]={cases:[],declared_queued_fixture_only:true,
  original_Ready_rows_read_only:true,no_grants_origins_or_source_media_rewritten:true,
  old_null_English_empty_expiry_return_intentionally_tightened:true,code_parity_claimed:false,completed:false};
 await runCase(ctx,evidence,'valid_one',null,false);await runCase(ctx,evidence,'valid_zero',null,true);
 assert(evidence.cases.every(row=>row.valid_direct_control_passed),'RAW_AUTHORITY_VALID_CONTROLS_REQUIRED');
 for(const change of ['membership','capability','expiry'])await runCase(ctx,evidence,change,change,false);
 await runCase(ctx,evidence,'empty_expiry','expiry',true);evidence.completed=true;
}
