/** Owned synthetic authority races at the real pin INSERT relation lock. */
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {ACTOR,json,literal,sha} from '../presentation-lock-source-proof/proof.mjs';
import {nativeError} from '../presentation-lock-source-pool-proof/native.mjs';
import {observePending} from '../presentation-lock-source-pool-proof/cases.mjs';

const only=rows=>{assert.equal(rows.length,1);return rows[0];};
const bounds="set local statement_timeout='8s';set local lock_timeout='8s';";
const snapshot='select locksource41_proof.row_hashes();';
const denials=new Set(['42501','CAPABILITY_REQUIRED','RESOURCE_NOT_FOUND','AUTH_REQUIRED','IMMUTABLE_VERSION']);
const canon=value=>Array.isArray(value)?value.map(canon):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canon(value[key])])):value;
const fingerprint=value=>sha(JSON.stringify(canon(value)));
const safeResult=value=>({ok:value?.ok===true?true:value?.ok===false?false:null,
 code:denials.has(value?.code)||value?.code==='57014'?value.code:null,
 duration_ms:typeof value?.duration_ms==='number'&&Number.isFinite(value.duration_ms)&&value.duration_ms>=0?value.duration_ms:null});

async function oneCase(ctx,evidence,change){
 const {holder,writer,observer}=ctx,p=ctx.profiles.control;
 const record={case:change,normal_SQL_return:false,actual_pin_INSERT_wait:false,
  barrier_released:false,authority_changed:false,authority_restored:false,
  sender_rolled_back:false,rollback_by_backend_exit:false,completed:false};
 evidence.cases.push(record);
 let sender,pending,barrier=false,started=false,pre,table,predicate,primary,cleanupError;
 const clock=async()=>{
  const value=only(await observer.request("reset role;select jsonb_build_object('epoch',extract(epoch from clock_timestamp()));"));
  assert(Number.isFinite(Number(value.epoch)));return Number(value.epoch);
 };
 const capture=async(label,error)=>ctx.captureError('pin_'+ctx.variant+'_'+change+'_'+label,error);
 const cleanup=async(label,operation)=>{
  try{await operation();}catch(error){
   (record.cleanup_errors??=[]).push({phase:label,error:nativeError(error),private_error:await capture(label,error)});
   cleanupError??=error;
  }
 };
 try{
  sender=await ctx.startFreshGeneration('pa_'+ctx.variant[0]+change[0]);
  record.sender_pid=sender.pid;record.blocker_pid=holder.pid;
  assert.equal(new Set([sender.pid,holder.pid,writer.pid,observer.pid]).size,4,'PIN_AUTHORITY_DISTINCT_PIDS_REQUIRED');
  const expiry=change==='expiry'?Math.floor(await clock())+4:null;
  if(expiry!==null)record.expiry_epoch=expiry;
  await holder.request('reset role;begin;'+bounds+'lock table eps.presentation_version_assets in share mode;');barrier=true;
  await sender.request('begin isolation level read committed;'+ctx.acting('mcp','authenticated',ACTOR,expiry===null?{}:{exp:expiry})+bounds);started=true;
  const key='pinbatch-'+ctx.runId+'-'+ctx.variant+'-'+change;
  record.dispatched=true;
  pending=observePending(sender.request(`select pg_temp.locksource41_measure('generate',${literal(p.workspace)}::uuid,${literal(p.series)}::uuid,${json(p.meta.input)},${literal(key)});`));
  let settled=false;pending.then(()=>{settled=true;},()=>{settled=true;});
  for(let i=0;i<150;i++){
   const wait=only(await observer.request(`reset role;select jsonb_build_object('waiting',exists(select 1 from pg_locks where pid=${sender.pid} and not granted and relation='eps.presentation_version_assets'::regclass and mode='RowExclusiveLock')and ${holder.pid}=any(pg_blocking_pids(${sender.pid})));`));
   if(wait.waiting===true){record.actual_pin_INSERT_wait=true;break;}
   if(settled)break;
   await delay(20);
  }
  assert.equal(record.actual_pin_INSERT_wait,true,'PIN_AUTHORITY_ACTUAL_INSERT_WAIT_REQUIRED');
  if(change==='expiry'){
   await delay(Math.max(0,expiry*1000+125-(await clock())*1000));
   record.database_clock_expired=(await clock())>expiry;assert.equal(record.database_clock_expired,true);
  }else{
   table=change==='membership'?'public.project_memberships':'public.app_capability_grants';
   predicate=change==='membership'?`project_id=${literal(p.project)}::uuid and principal_id=${literal(ACTOR)}::uuid`:`principal_id=${literal(ACTOR)}::uuid and capability='presentations.generate'`;
   pre=await ctx.value(`select to_jsonb(t)from ${table} t where ${predicate};`);
   assert(pre&&pre.principal_id===ACTOR,'PIN_AUTHORITY_EXACT_PREIMAGE_REQUIRED');
   if(change==='membership')assert.equal(pre.project_id,p.project);else assert.equal(pre.active,true);
   record.preimage_sha256=fingerprint(pre);
   const mutation=change==='membership'?`delete from ${table} where ${predicate}`:`update ${table} set active=false where ${predicate}`;
   const changed=only(await writer.request('reset role;with affected as('+mutation+" returning 1)select jsonb_build_object('changed_rows',count(*))from affected;"));
   record.authority_changed=changed.changed_rows===1;assert.equal(record.authority_changed,true);
  }
  await holder.request('rollback;reset role;');barrier=false;record.barrier_released=true;
  try{
   const result=only(await pending);record.normal_SQL_return=true;record.result=safeResult(result);
   record.denial_provenance='normal_measure_SQL_result';
   assert.equal(result.ok,false,'PIN_AUTHORITY_UNAUTHORIZED_GENERATION_SUCCEEDED');
   assert(denials.has(result.code),'PIN_AUTHORITY_FRESH_DENIAL_REQUIRED');
   assert(record.result.duration_ms!==null&&record.result.duration_ms<8000,'PIN_AUTHORITY_DENIAL_EIGHT_SECOND_BOUND_REQUIRED');
  }catch(error){
   // Only the frozen verbose psql projector can establish a native denial.
   // A normal-result acceptance assertion must never be reclassified as one.
   if(record.normal_SQL_return)throw error;
   const projected=nativeError(error);record.native_error=projected;record.private_error=await capture('native',error);
   const code=projected.sqlstate==='42501'?'42501':projected.sqlstate==='P0001'?projected.application_code:null;
   assert(projected.provenance==='first_verbose_psql_ERROR_line'&&denials.has(code)&&record.private_error?.normal_return===true,'PIN_AUTHORITY_NATIVE_DENIAL_UNCONFIRMED');
   const exit=await Promise.race([sender.done,delay(5000,null,{ref:false})]);record.backend_exit=exit??null;
   assert.equal(exit,3,'PIN_AUTHORITY_NATIVE_ROLLBACK_UNCONFIRMED');
   record.rollback_by_backend_exit=true;record.sender_rolled_back=true;
   record.result={ok:false,code,duration_ms:null};record.denial_provenance='first_verbose_psql_ERROR_line_and_backend_exit3';
  }
  record.fresh_authority_denial_observed=true;
 }catch(error){primary=error;record.error=nativeError(error);record.private_failure=await capture('failure',error);}
 finally{
  if(barrier)await cleanup('barrier_release',async()=>{await holder.request('rollback;reset role;');barrier=false;record.barrier_released=true;});
  if(pending)await pending.catch(()=>{});
  if(sender&&started&&!record.rollback_by_backend_exit)await cleanup('sender_rollback',async()=>{await sender.request('rollback;reset role;');record.sender_rolled_back=true;});
  // Restore the exact synthetic preimage even if mutation response was unknown.
  if(pre)await cleanup('authority_restore',async()=>{
   await writer.request('reset role;begin;'+`delete from ${table} where ${predicate};insert into ${table} select(populated).*from jsonb_populate_record(null::${table},${json(pre)})populated;commit;`);
   const actual=await ctx.value(`select to_jsonb(t)from ${table} t where ${predicate};`);
   record.authority_restored=fingerprint(actual)===record.preimage_sha256;assert.equal(record.authority_restored,true);
  });
  if(sender)await cleanup('sender_finish',()=>sender.finish());
 }
 if(primary)throw primary;if(cleanupError)throw cleanupError;
 assert.equal(record.sender_rolled_back,true);
 assert.deepEqual(await ctx.value(snapshot),ctx.baseline,'PIN_AUTHORITY_FULL_BASELINE_CHANGED');record.full_baseline_restored=true;
 record.completed=true;
}

export async function verifyPinAuthorityCases(ctx){
 assert(['old','candidate'].includes(ctx.variant));
 assert.equal(ctx.report.combined_generation.actual_first_whole_generation_matrix_completed,true,'PIN_AUTHORITY_FIRST_MATRIX_REQUIRED');
 assert.equal(ctx.report.combined_generation.review_and_snapshot_contract_equalities_completed,true,'PIN_AUTHORITY_COMPONENTS_REQUIRED');
 assert.equal(typeof ctx.startFreshGeneration,'function','PIN_AUTHORITY_PREPARED_FRESH_SESSION_REQUIRED');
 assert(ctx.report.pin_batch_cases&&!Object.hasOwn(ctx.report.pin_batch_cases,ctx.variant),'PIN_AUTHORITY_ONCE_PER_VARIANT_REQUIRED');
 const evidence=ctx.report.pin_batch_cases[ctx.variant]={cases:[],requested_isolation:'read committed',
  same_original_measurement_SQL:true,authority_or_clock_cache:false,codes_must_match_other_variant:false,completed:false};
 for(const change of ['membership','capability','expiry'])await oneCase(ctx,evidence,change);
 evidence.completed=true;
}
