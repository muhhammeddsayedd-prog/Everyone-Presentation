/** Finite isolated helper proof. Imports are inert; entry owns all admission. */
import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { literal,json,sha,ACTOR } from "../presentation-lock-source-proof/proof.mjs";
import { nativeError } from "../presentation-lock-source-pool-proof/native.mjs";
import {prepareOracle,readOracle}from "../presentation-lock-source-complete-oracle-proof/oracle.mjs";

export const RELATIONS=['public.projects','public.clients','eps.presentation_templates','eps.specs','eps.roles','eps.slots','eps.assignments','eps.workspace_candidates','eps.candidates','eps.candidate_media','eps.media_assets','eps.candidate_media_frames'];
const only=rows=>{assert.equal(rows.length,1);return rows[0];};
const SNAPSHOT='select locksource41_proof.row_hashes();';
const measure=workspace=>`select pg_temp.pool_proof_measure(${literal(workspace)}::uuid);`;
const begin=(ctx,mode='mcp',role='eps_review_owner',extra={})=>'begin;'+ctx.acting(mode,role,ACTOR,extra)+"set local statement_timeout='8s';set local lock_timeout='8s';";
const fence=workspace=>`select jsonb_build_object('workspace_fenced',id)from eps.workspaces where id=${literal(workspace)}::uuid for update;`;
const canon=value=>Array.isArray(value)?value.map(canon):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canon(value[key])])):value;
// Polling/barrier awaits must not leave a native rejection temporarily unhandled.
// Keep the original Promise so its later await still observes the identical error.
export function observePending(pending){pending.catch(()=>{});return pending;}

async function probe(ctx,s,relation,key,share=false){
 await s.request(begin(ctx));
 try{return only(await s.request(share?`select pg_temp.locksource41_probe_pool_share(${literal(key.id)}::uuid);`:`select pg_temp.locksource41_probe(${literal(relation)},${json(key)});`));}
 finally{await s.request('rollback;reset role;');}
}


export async function heldCohorts(ctx,holder,record){
 const oracle=await ctx.startPrepared('oracle'),contender=await ctx.startPrepared('probe');
 record.relations=[];record.negatives=[];record.oracle_snapshot='repeatable_read_read_only';
 try{
  await prepareOracle(ctx,oracle,record);
  for(const relation of RELATIONS){
   const row={relation,normal_return:false,selected_rows:null,held_rows:0};record.relations.push(row);
   let keys;
   try{keys=await readOracle(ctx,oracle,relation,record);}
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


export async function crossWorkspaceKeys(ctx){
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


export async function workspaceFenceRace(ctx){
 const holder=await ctx.startPrepared('fence_h'),writer=await ctx.startPrepared('fence_w'),observer=await ctx.startPrepared('fence_o');
 const record=ctx.report.pool_helper_proof.workspace_fence={actual_distinct_pid_wait:false,normal_public_mutation_return:false,writer_rolled_back:false};
 const p=ctx.profiles.large;
 const pair=await ctx.value(`select jsonb_build_object('slot',s.id,'pool',c.id,'slot_revision',s.row_version)from eps.slots s cross join eps.workspace_candidates c where s.workspace_id=${literal(p.workspace)}::uuid and c.workspace_id=s.workspace_id and s.archived_at is null and c.archived_at is null and not exists(select 1 from eps.assignments a where a.slot_id=s.id and a.workspace_candidate_id=c.id and a.archived_at is null)order by s.id,c.id limit 1;`);
 let pending;
 try{
  await holder.request(begin(ctx));only(await holder.request(fence(p.workspace)));record.helper=only(await holder.request(measure(p.workspace)));assert.equal(record.helper.ok,true);
  await writer.request(begin(ctx,'mcp','authenticated'));
  const input={slot_id:pair.slot,workspace_candidate_id:pair.pool,expected_slot_row_version:Number(pair.slot_revision),shortlist_included:false};
  pending=observePending(writer.request(`select public.eps_create_assignment(${literal(p.workspace)}::uuid,${json(input)},${literal('poolproof-'+ctx.runId+'-fence')});`));
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


export async function authorityCases(ctx){
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
   pending=observePending(holder.request(measure(p.workspace)));
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
