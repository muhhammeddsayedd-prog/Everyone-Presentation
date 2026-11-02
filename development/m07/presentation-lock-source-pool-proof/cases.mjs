/** Finite isolated helper proof. Imports are inert; entry owns all admission. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { literal,json,sha,ACTOR } from '../presentation-lock-source-proof/proof.mjs';
import { nativeError } from './native.mjs';

export const RELATIONS=['public.projects','public.clients','eps.presentation_templates','eps.specs','eps.roles','eps.slots','eps.assignments','eps.workspace_candidates','eps.candidates','eps.candidate_media','eps.media_assets','eps.candidate_media_frames'];
const only=rows=>{assert.equal(rows.length,1);return rows[0];};
const SNAPSHOT='select locksource41_proof.row_hashes();';
const measure=workspace=>`select pg_temp.pool_proof_measure(${literal(workspace)}::uuid);`;
const begin=(ctx,mode='mcp',role='eps_review_owner',extra={})=>'begin;'+ctx.acting(mode,role,ACTOR,extra)+"set local statement_timeout='8s';set local lock_timeout='8s';";
const fence=workspace=>`select jsonb_build_object('workspace_fenced',id)from eps.workspaces where id=${literal(workspace)}::uuid for update;`;
const canon=value=>Array.isArray(value)?value.map(canon):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canon(value[key])])):value;

export async function firstAndWarm(ctx){
 const result=ctx.report.pool_helper_proof;
 result.cold=[];result.warm=[];
 const candidateBackends=[];const owned=[];
 // Every baseline and candidate first call precedes every warm sample. Baseline
 // warm calls are deliberately omitted. Candidate backends remain unmodified.
 for(const variant of['old','new']){
  await ctx.installHelper(variant);
  for(const mode of['api','mcp'])for(const fenced of[false,true]){
   const id=variant+'_'+mode+'_'+(fenced?'fenced':'standalone');
   const record={case_id:id,variant,mode,profile:'large',fenced,quiescent_standalone_only:!fenced,first_in_fresh_backend:true,helper_calls_before_dispatch:0,phase:'session_start',normal_return:false};
   result.cold.push(record);ctx.report.checkpoint='pool-proof-first-'+id;
   const s=await ctx.startPrepared((variant==='old'?'o':'n')+'_'+mode[0]+'_'+(fenced?'f':'s'));owned.push(s);record.pid=s.pid;
   let helperCalls=0;
   const call=async(target,kind,index)=>{
    target.phase='begin';await s.request(begin(ctx,mode));
    if(fenced){target.phase='workspace_fence';const locked=only(await s.request(fence(ctx.profiles.large.workspace)));assert.equal(locked.workspace_fenced,ctx.profiles.large.workspace);}
    target.phase='helper';target.helper_calls_before_dispatch=helperCalls;
    if(kind==='first')assert.equal(helperCalls,0);
    assert.equal(++helperCalls,index);target.helper_call_index=index;target.dispatched=true;
    try{
     const response=only(await s.request(measure(ctx.profiles.large.workspace)));target.response=response;target.normal_return=true;
     assert.equal(response.ok,true);assert(response.duration_ms<8000);target.phase='rollback';await s.request('rollback;reset role;');target.rollback_normal=true;
     return true;
    }catch(error){
     target.error=nativeError(error);target.private_error=await ctx.captureError(id+'_'+kind+'_'+index,error);
     try{await s.request('rollback;reset role;');target.rollback_normal=true;}catch{
      const exited=await Promise.race([s.done,setTimeout(5000).then(()=>null)]);target.backend_exit=exited;assert.equal(exited,3,'POOL_PROOF_FAILED_BACKEND_EXIT_UNCONFIRMED');
     }
     if(target.private_error.normal_return!==true)throw error;
     if(variant==='old'&&kind==='first'&&target.phase==='helper'&&target.error.sqlstate==='57014'){target.baseline_cancellation_retained=true;return false;}
     throw error;
    }
   };
   const ok=await call(record,'first',1);
   if(variant==='new'){assert.equal(ok,true,'POOL_PROOF_NEW_FIRST_CALL_FAILED');candidateBackends.push({id,s,call});}
  }
 }
 assert.equal(result.cold.length,8);assert.equal(candidateBackends.length,4);
 assert.equal(new Set(result.cold.map(item=>item.pid)).size,8);
 for(const item of candidateBackends)for(let index=0;index<2;index++){
  const record={case_id:item.id,variant:'new',sample:index,first_call_already_completed:true,phase:'begin',normal_return:false};result.warm.push(record);
  ctx.report.checkpoint='pool-proof-warm-'+item.id+'-'+index;
  await item.call(record,'warm',index+2);
 }
 assert.equal(result.warm.length,8);
 for(const s of owned)await s.finish();
}

async function tuples(ctx,s,workspace,mustInclude=null,mustContainFrame=null){
 const ids=only(await s.request(`select to_jsonb(pg_temp.pool_proof_capture_ids(${literal(workspace)}::uuid));`));
 assert(Array.isArray(ids));
 if(mustInclude!==null)assert(ids.includes(mustInclude),'POOL_PROOF_ARCHIVED_REFERENCE_MISSING');
 const array="array["+ids.map(value=>literal(value)+'::uuid').join(',')+"]::uuid[]";
 const responses=[];
 for(const variant of['old','new'])responses.push(only(await s.request(`select pg_temp.pool_proof_tuples(${literal(variant)},${literal(workspace)}::uuid,${array});`)));
 assert(responses.every(Array.isArray));
 const hashes=responses.map(value=>sha(JSON.stringify(canon(value))));
 if(mustContainFrame!==null)assert(responses[1].some(row=>row.selected_frame_asset_ids.includes(mustContainFrame)),'POOL_PROOF_SELECTED_FRAME_DROPPED');
 const evidence={captured_pool_count:ids.length,old_tuple_count:responses[0].length,new_tuple_count:responses[1].length,old_tuple_sha256:hashes[0],new_tuple_sha256:hashes[1]};
 assert.equal(hashes[0],hashes[1],'POOL_PROOF_SELECTED_TUPLES_DIFFER');return evidence;
}

async function probe(ctx,s,relation,key,share=false){
 await s.request(begin(ctx));
 try{return only(await s.request(share?`select pg_temp.locksource41_probe_pool_share(${literal(key.id)}::uuid);`:`select pg_temp.locksource41_probe(${literal(relation)},${json(key)});`));}
 finally{await s.request('rollback;reset role;');}
}

export async function heldCohorts(ctx,holder,record){
 const oracle=await ctx.startPrepared('oracle'),contender=await ctx.startPrepared('probe');
 record.relations=[];record.negatives=[];record.oracle_snapshot='repeatable_read_read_only';
 try{
  await oracle.request('begin isolation level repeatable read read only;'+ctx.acting('mcp')+"set local statement_timeout='8s';set local lock_timeout='8s';");
  for(const relation of RELATIONS){
   const row={relation,normal_return:false,selected_rows:null,held_rows:0};record.relations.push(row);
   let keys;
   try{keys=only(await oracle.request(`select pg_temp.pool_proof_cohort(${literal(relation)},${literal(ctx.profiles.large.workspace)}::uuid,${literal(ctx.profiles.large.series)}::uuid);`));}
   catch(error){row.error=nativeError(error);row.private_error=await ctx.captureError('oracle_'+relation.replace('.','_'),error);throw error;}
   assert(Array.isArray(keys));row.normal_return=true;row.selected_rows=keys.length;row.rowset_sha256=sha(JSON.stringify(canon(keys)));
   const expected={'public.projects':1,'public.clients':0,'eps.presentation_templates':1,'eps.roles':2,'eps.slots':16,'eps.assignments':19,'eps.workspace_candidates':11,'eps.candidates':11,'eps.candidate_media':11,'eps.media_assets':44,'eps.candidate_media_frames':33};
   if(Object.hasOwn(expected,relation))assert.equal(keys.length,expected[relation],'POOL_PROOF_ORIGINAL_SCOPE_COUNT_CHANGED');
   for(const key of keys){const result=await probe(ctx,contender,relation,key);assert.deepEqual(result,{found:true,locked:true,code:'55P03'},'POOL_PROOF_SELECTED_ROW_NOT_HELD');row.held_rows++;}
  }
  const negatives=[
   ['eps.roles',{id:ctx.id('role-2-3')},true],['eps.slots',{id:ctx.id('slot-2-17')},true],['eps.assignments',{id:ctx.id('assignment-2-20')},true],
   ['eps.workspace_candidates',{id:ctx.id('pool-2-12')},true],['eps.workspace_candidates',{id:ctx.id('pool-1-1')},true],
   ['eps.media_assets',{id:ctx.id('frame-80')},true],['eps.candidate_media_frames',{candidate_media_id:ctx.id('media-2'),asset_id:ctx.id('frame-80')},true],
   ['eps.candidate_media_frames',{candidate_media_id:ctx.id('media-2'),asset_id:ctx.id('frame-1')},false],
  ];
  for(let i=0;i<negatives.length;i++){
   const [relation,key,found]=negatives[i],item={index:i,relation,result:null};record.negatives.push(item);
   item.result=await probe(ctx,contender,relation,key);assert.deepEqual(item.result,{found,locked:false},'POOL_PROOF_UNSELECTED_ROW_CHANGED');
  }
  await oracle.request('rollback;reset role;');record.completed=true;record.independent_pids=[holder.pid,oracle.pid,contender.pid];assert.equal(new Set(record.independent_pids).size,3);
 }finally{await oracle.finish();await contender.finish();}
}

async function semanticCases(ctx){
 const result=ctx.report.pool_helper_proof;result.semantic=[];
 const holder=await ctx.startPrepared('semantic');
 for(const name of['baseline','empty_assignments','referenced_archived_pool','missing_selected_pair']){
  const record={name,rolled_back:false,old_ready_dml_issued:false};result.semantic.push(record);ctx.report.checkpoint='pool-proof-semantic-'+name;
  let primary,cleanupError;
  await holder.request('begin;'+ctx.acting('api')+'reset role;');
  try{
   if(name==='empty_assignments')await holder.request(`update eps.assignments set archived_at=clock_timestamp()where workspace_id=${literal(ctx.profiles.large.workspace)}::uuid and archived_at is null;`);
   if(name==='missing_selected_pair')await holder.request(`delete from eps.candidate_media_frames where candidate_media_id=${literal(ctx.id('media-2'))}::uuid and asset_id=${literal(ctx.id('frame-4'))}::uuid;`);
   if(name==='referenced_archived_pool'){
    await holder.request(`update eps.assignments set workspace_candidate_id=${literal(ctx.id('pool-2-12'))}::uuid where id=${literal(ctx.id('assignment-2-1'))}::uuid and workspace_id=${literal(ctx.profiles.large.workspace)}::uuid;`);
    const contender=await ctx.startPrepared('fkcontrol');record.fk_key_share_control=await probe(ctx,contender,'eps.workspace_candidates',{id:ctx.id('pool-2-12')},true);await contender.finish();
    assert.deepEqual(record.fk_key_share_control,{found:true,locked:false});
   }
   await holder.request(ctx.acting('mcp')+"set local statement_timeout='8s';set local lock_timeout='8s';");
   const locked=only(await holder.request(fence(ctx.profiles.large.workspace)));assert.equal(locked.workspace_fenced,ctx.profiles.large.workspace);
   record.helper=only(await holder.request(measure(ctx.profiles.large.workspace)));assert.equal(record.helper.ok,true);assert(record.helper.duration_ms<8000);
   record.tuples=await tuples(ctx,holder,ctx.profiles.large.workspace,name==='referenced_archived_pool'?ctx.id('pool-2-12'):null,name==='missing_selected_pair'?ctx.id('frame-4'):null);
   if(name==='baseline'){
    assert.equal(record.tuples.captured_pool_count,11);record.held={};await heldCohorts(ctx,holder,record.held);
   }
   if(name==='empty_assignments')assert.equal(record.tuples.captured_pool_count,0);
   if(name==='referenced_archived_pool'){
    const contender=await ctx.startPrepared('archived');record.archived_share_held=await probe(ctx,contender,'eps.workspace_candidates',{id:ctx.id('pool-2-12')},true);await contender.finish();
    assert.deepEqual(record.archived_share_held,{found:true,locked:true,code:'55P03'});
   }
   if(name==='missing_selected_pair'){
    const pair=only(await holder.request(`select jsonb_build_object('missing',not exists(select 1 from eps.candidate_media_frames where candidate_media_id=${literal(ctx.id('media-2'))}::uuid and asset_id=${literal(ctx.id('frame-4'))}::uuid));`));record.selected_pair_missing=pair.missing;assert.equal(pair.missing,true);
    const contender=await ctx.startPrepared('frameprobe');record.selected_asset_still_held=await probe(ctx,contender,'eps.media_assets',{id:ctx.id('frame-4')});await contender.finish();assert.deepEqual(record.selected_asset_still_held,{found:true,locked:true,code:'55P03'});
   }
  }catch(error){primary=error;record.error=nativeError(error);record.private_error=await ctx.captureError('semantic_'+name,error);}
  finally{
   try{await holder.request('rollback;reset role;');record.rolled_back=true;}
   catch(cleanup){
    record.cleanup_error=nativeError(cleanup);
    if(!primary){record.private_cleanup_error=await ctx.captureError('semantic_'+name+'_cleanup',cleanup);cleanupError=cleanup;}
    else{const exit=await Promise.race([holder.done,setTimeout(5000).then(()=>null)]);record.backend_exit=exit;record.rolled_back_by_backend_exit=exit===3;}
   }
  }
  if(primary)throw primary;if(cleanupError)throw cleanupError;
  assert.deepEqual(await ctx.value(SNAPSHOT),ctx.baseline,'POOL_PROOF_SEMANTIC_BASELINE_CHANGED');
 }
 await holder.finish();
}

async function crossWorkspaceKeys(ctx){
 const s=await ctx.startPrepared('cross_fk'),record=ctx.report.pool_helper_proof.cross_workspace={normal_return:false,rolled_back:false};
 await s.request('reset role;begin;');
 try{
  record.result=only(await s.request(`do $cross$declare a text;b text;begin
begin insert into eps.assignments(id,workspace_id,slot_id,workspace_candidate_id,position)values(${literal(ctx.id('poolproof-cross-slot'))}::uuid,${literal(ctx.profiles.large.workspace)}::uuid,${literal(ctx.id('slot-1-1'))}::uuid,${literal(ctx.id('pool-2-1'))}::uuid,'option');exception when foreign_key_violation then a:='23503';end;
begin insert into eps.assignments(id,workspace_id,slot_id,workspace_candidate_id,position)values(${literal(ctx.id('poolproof-cross-pool'))}::uuid,${literal(ctx.profiles.large.workspace)}::uuid,${literal(ctx.id('slot-2-1'))}::uuid,${literal(ctx.id('pool-1-1'))}::uuid,'option');exception when foreign_key_violation then b:='23503';end;
perform set_config('eps.poolproof.slot_fk',coalesce(a,'unexpected'),true);perform set_config('eps.poolproof.pool_fk',coalesce(b,'unexpected'),true);end$cross$;
select jsonb_build_object('slot',current_setting('eps.poolproof.slot_fk'),'pool',current_setting('eps.poolproof.pool_fk'));`));
  record.normal_return=true;assert.deepEqual(record.result,{slot:'23503',pool:'23503'});
 }finally{await s.request('rollback;reset role;');record.rolled_back=true;await s.finish();}
 assert.deepEqual(await ctx.value(SNAPSHOT),ctx.baseline,'POOL_PROOF_CROSS_FK_BASELINE_CHANGED');
}

async function workspaceFenceRace(ctx){
 const holder=await ctx.startPrepared('fence_h'),writer=await ctx.startPrepared('fence_w'),observer=await ctx.startPrepared('fence_o');
 const record=ctx.report.pool_helper_proof.workspace_fence={actual_distinct_pid_wait:false,normal_public_mutation_return:false,writer_rolled_back:false};
 const p=ctx.profiles.large;
 const pair=await ctx.value(`select jsonb_build_object('slot',s.id,'pool',c.id,'slot_revision',s.row_version)from eps.slots s cross join eps.workspace_candidates c where s.workspace_id=${literal(p.workspace)}::uuid and c.workspace_id=s.workspace_id and s.archived_at is null and c.archived_at is null and not exists(select 1 from eps.assignments a where a.slot_id=s.id and a.workspace_candidate_id=c.id and a.archived_at is null)order by s.id,c.id limit 1;`);
 let pending;
 try{
  await holder.request(begin(ctx));only(await holder.request(fence(p.workspace)));record.helper=only(await holder.request(measure(p.workspace)));assert.equal(record.helper.ok,true);
  await writer.request(begin(ctx,'mcp','authenticated'));
  const input={slot_id:pair.slot,workspace_candidate_id:pair.pool,expected_slot_row_version:Number(pair.slot_revision),shortlist_included:false};
  pending=writer.request(`select public.eps_create_assignment(${literal(p.workspace)}::uuid,${json(input)},${literal('poolproof-'+ctx.runId+'-fence')});`);
  for(let i=0;i<80;i++){
   const wait=only(await observer.request(`reset role;select jsonb_build_object('waiting',coalesce((select wait_event_type='Lock'and ${holder.pid}=any(pg_blocking_pids(pid))from pg_stat_activity where pid=${writer.pid}),false));`));
   if(wait.waiting){record.actual_distinct_pid_wait=true;break;}await setTimeout(20);
  }
  await holder.request('rollback;reset role;');
  const response=only(await pending);record.normal_public_mutation_return=typeof response.id==='string';record.assignment_id_sha256=sha(String(response.id));
  await writer.request('rollback;reset role;');record.writer_rolled_back=true;
  assert.equal(record.actual_distinct_pid_wait,true);assert.equal(record.normal_public_mutation_return,true);assert.notEqual(holder.pid,writer.pid);assert.notEqual(observer.pid,writer.pid);
 }finally{
  if(pending)await pending.catch(()=>{});
  await holder.finish();await writer.finish();await observer.finish();
 }
 assert.deepEqual(await ctx.value(SNAPSHOT),ctx.baseline,'POOL_PROOF_FENCE_BASELINE_CHANGED');
}

async function authorityCases(ctx){
 const records=ctx.report.pool_helper_proof.authority=[];
 for(const change of['membership','capability','expiry']){
  const holder=await ctx.startPrepared('auth_h'),blocker=await ctx.startPrepared('auth_b'),writer=await ctx.startPrepared('auth_w'),observer=await ctx.startPrepared('auth_o');
  const p=ctx.profiles.control,record={case:change,actual_relation_wait:false,authority_changed:false,authority_restored:false,expected_denial:false};records.push(record);
  let pre,table,predicate,pending,primary;
  const dbClock=async()=>Number(only(await observer.request("reset role;select jsonb_build_object('epoch',extract(epoch from clock_timestamp()));")).epoch);
  const expires=Math.floor(await dbClock())+4;
  try{
   await blocker.request('reset role;begin;lock table eps.candidate_media in access exclusive mode;');
   await holder.request(begin(ctx,'mcp','eps_review_owner',change==='expiry'?{exp:expires}:{}));only(await holder.request(fence(p.workspace)));
   pending=holder.request(measure(p.workspace));
   for(let i=0;i<80;i++){
    const wait=only(await observer.request(`reset role;select jsonb_build_object('waiting',exists(select 1 from pg_locks where pid=${holder.pid} and not granted and relation='eps.candidate_media'::regclass)and ${blocker.pid}=any(pg_blocking_pids(${holder.pid})));`));
    if(wait.waiting){record.actual_relation_wait=true;break;}await setTimeout(20);
   }
   if(record.actual_relation_wait&&change!=='expiry'){
    table=change==='membership'?'public.project_memberships':'public.app_capability_grants';
    predicate=change==='membership'?`project_id=${literal(p.project)}::uuid and principal_id=${literal(ACTOR)}::uuid`:`principal_id=${literal(ACTOR)}::uuid and capability='presentations.generate'`;
    pre=await ctx.value(`select to_jsonb(t)from ${table} t where ${predicate};`);record.preimage_sha256=sha(JSON.stringify(canon(pre)));
    await writer.request('reset role;'+(change==='membership'?`delete from ${table} where ${predicate};`:`update ${table} set active=false where ${predicate};`));record.authority_changed=true;
   }
   if(record.actual_relation_wait&&change==='expiry'){await setTimeout(Math.max(0,expires*1000+125-(await dbClock())*1000));record.database_clock_expired=(await dbClock())>expires;}
   await blocker.request('rollback;reset role;');
   try{const response=only(await pending);record.unexpected_response=response;}catch(error){primary=error;record.error=nativeError(error);record.private_error=await ctx.captureError('authority_'+change,error);}
   record.expected_denial=record.error?.sqlstate==='P0001'&&['RESOURCE_NOT_FOUND','CAPABILITY_REQUIRED','AUTH_REQUIRED'].includes(record.error.application_code);
  }finally{
   await blocker.request('rollback;').catch(()=>{});
   if(pending)await pending.catch(()=>{});
   if(pre){await writer.request('reset role;'+`delete from ${table} where ${predicate};insert into ${table} select(populated).*from jsonb_populate_record(null::${table},${json(pre)})populated;`);const restored=await ctx.value(`select to_jsonb(t)from ${table} t where ${predicate};`);record.authority_restored=sha(JSON.stringify(canon(restored)))===record.preimage_sha256;}
   await holder.finish();await blocker.finish();await writer.finish();await observer.finish();
  }
  assert.equal(record.actual_relation_wait,true,'POOL_PROOF_AUTHORITY_WAIT_REQUIRED');
  if(change==='expiry')assert.equal(record.database_clock_expired,true);else{assert.equal(record.authority_changed,true);assert.equal(record.authority_restored,true);}
  assert.equal(record.expected_denial,true,'POOL_PROOF_FRESH_AUTHORITY_DENIAL_REQUIRED');assert(primary);
  if(record.private_error?.normal_return!==true)throw primary;
  assert.deepEqual(await ctx.value(SNAPSHOT),ctx.baseline,'POOL_PROOF_AUTHORITY_BASELINE_CHANGED');
 }
}

export async function runPoolCases(ctx){
 const cohorts=await readFile(new URL('../presentation-lock-source-proof/cohorts.sql',import.meta.url),'utf8');assert.equal(sha(cohorts),'06d12e3c2b2ca36deb7831579a7ef55ec183cdd77b9e66515b18c3b0bbc953ef');
 ctx.startPrepared=async tag=>{const s=await ctx.start(tag);await s.request('reset role;'+cohorts+ctx.bindings.measureSql+ctx.bindings.oracleSql);return s;};
 const identity="select jsonb_build_object('source',encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex'),'authority',to_jsonb(p)-'prosrc')from pg_proc p where oid='eps.presentation_lock_sources(uuid,text,text)'::regprocedure;";
 ctx.installHelper=async variant=>{
  const source=variant==='old'?ctx.bindings.baseSource:ctx.bindings.candidateSource;
  await ctx.install(source);const actual=await ctx.value(identity);
  const record={variant,actual_source_sha256:actual.source,expected_source_sha256:variant==='old'?ctx.bindings.baseSha:ctx.bindings.candidateSha,authority_unchanged:JSON.stringify(actual.authority)===JSON.stringify(ctx.sourceBefore.authority)};
  (ctx.report.pool_helper_proof.installations??=[]).push(record);
  assert.equal(record.actual_source_sha256,record.expected_source_sha256);assert.equal(record.authority_unchanged,true);
 };
 const constraints=await ctx.value("select jsonb_build_object('valid_composite_pool_fk',exists(select 1 from pg_constraint where conrelid='eps.assignments'::regclass and conname='assignments_workspace_id_workspace_candidate_id_fkey'and contype='f'and convalidated and not condeferrable and confrelid='eps.workspace_candidates'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (workspace_id, workspace_candidate_id) REFERENCES eps.workspace_candidates(workspace_id, id) ON DELETE RESTRICT'),'valid_composite_slot_fk',exists(select 1 from pg_constraint where conrelid='eps.assignments'::regclass and conname='assignments_workspace_id_slot_id_fkey'and contype='f'and convalidated and not condeferrable and confrelid='eps.slots'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (workspace_id, slot_id) REFERENCES eps.slots(workspace_id, id) ON DELETE RESTRICT'));");
 ctx.report.pool_helper_proof.constraints=constraints;assert.equal(constraints.valid_composite_pool_fk,true);assert.equal(constraints.valid_composite_slot_fk,true);
 await firstAndWarm(ctx);
 await semanticCases(ctx);
 await crossWorkspaceKeys(ctx);
 await workspaceFenceRace(ctx);
 await authorityCases(ctx);
 assert.deepEqual(await ctx.value(SNAPSHOT),ctx.baseline,'POOL_PROOF_COMPLETE_BASELINE_CHANGED');
 ctx.report.pool_helper_proof.first_calls_and_planned_warm_completed=true;
}
