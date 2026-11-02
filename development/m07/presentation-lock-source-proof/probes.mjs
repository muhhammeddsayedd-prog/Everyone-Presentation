/** Inert source module. Only caller-owned sessions can execute these probes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
const RELATIONS=['public.projects','public.clients','eps.presentation_templates','eps.specs','eps.roles','eps.slots','eps.assignments','eps.workspace_candidates','eps.candidates','eps.candidate_media','eps.media_assets','eps.candidate_media_frames'];
const literal=value=>"'"+value.replaceAll("'","''")+"'";
const only=rows=>{assert.equal(rows.length,1);return rows[0];};
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
function admission(ctx){
 assert(['old','new'].includes(ctx.variant));assert(UUID.test(ctx.workspace)&&UUID.test(ctx.series));
 assert(ctx.holder!==ctx.contender&&Number.isSafeInteger(ctx.holder.pid)&&Number.isSafeInteger(ctx.contender.pid)&&ctx.holder.pid!==ctx.contender.pid);
 assert.equal(typeof ctx.acting,'function');assert.equal(typeof ctx.id,'function');
}
function cohorts(value){
 assert(Array.isArray(value)&&value.length===12);
 value.forEach((item,index)=>{
  assert.deepEqual(Object.keys(item).sort(),['keys','relation']);assert.equal(item.relation,RELATIONS[index]);assert(Array.isArray(item.keys));
  const columns=item.relation==='eps.presentation_templates'?['key','version']:item.relation==='eps.candidate_media_frames'?['asset_id','candidate_media_id']:['id'];const seen=new Set();
  for(const key of item.keys){assert.deepEqual(Object.keys(key).sort(),columns);assert(Object.values(key).every(value=>typeof value==='string'&&(item.relation==='eps.presentation_templates'||UUID.test(value))));const text=JSON.stringify(canonical(key));assert(!seen.has(text));seen.add(text);}
 });return value;
}
async function cleanup(ctx){
 const results=await Promise.allSettled([ctx.contender.request('rollback;'),ctx.holder.request('rollback;')]);
 assert(results.every(result=>result.status==='fulfilled'),'LOCKSOURCE41_PROBE_ROLLBACK_UNCONFIRMED');
}
async function probe(ctx,relation,key){
 await ctx.contender.request('begin;'+ctx.acting('mcp','eps_review_owner')+"set local statement_timeout='8s';set local lock_timeout='8s';");
 try{return only(await ctx.contender.request(`select pg_temp.locksource41_probe(${literal(relation)},${literal(JSON.stringify(key))}::jsonb);`));}
 finally{await ctx.contender.request('rollback;');}
}
function negativeSamples(ctx){
 const id=label=>{const value=ctx.id(label);assert(UUID.test(value));return value;};
 return[
  {label:'archived_role',relation:'eps.roles',key:{id:id('role-2-3')},found:true},
  {label:'archived_slot',relation:'eps.slots',key:{id:id('slot-2-17')},found:true},
  {label:'archived_assignment',relation:'eps.assignments',key:{id:id('assignment-2-20')},found:true},
  {label:'unreferenced_archived_pool',relation:'eps.workspace_candidates',key:{id:id('pool-2-12')},found:true},
  {label:'unselected_active_other_workspace_pool',relation:'eps.workspace_candidates',key:{id:id('pool-1-1')},found:true},
  {label:'unselected_frame_asset',relation:'eps.media_assets',key:{id:id('frame-80')},found:true},
  {label:'unselected_same_media_frame',relation:'eps.candidate_media_frames',key:{candidate_media_id:id('media-2'),asset_id:id('frame-80')},found:true},
  {label:'absent_cross_media_frame_pair',relation:'eps.candidate_media_frames',key:{candidate_media_id:id('media-2'),asset_id:id('frame-1')},found:false}
 ];
}
export async function verifyHeld(ctx){
 admission(ctx);let measure;
 try{
  await ctx.holder.request('begin;'+ctx.acting('mcp','eps_review_owner')+"set local statement_timeout='8s';set local lock_timeout='8s';");
  const value=only(await ctx.holder.request(`select pg_temp.locksource41_measure('locks',${literal(ctx.workspace)}::uuid,${literal(ctx.series)}::uuid,null,null);`));
  assert(typeof value.ok==='boolean'&&typeof value.duration_ms==='number'&&Number.isFinite(value.duration_ms)&&value.duration_ms>=0);
  measure={ok:value.ok,duration_ms:value.duration_ms};if(value.code!==undefined){assert(typeof value.code==='string'&&/^[A-Z0-9_]{1,64}$/u.test(value.code));measure.code=value.code;}
  if(!measure.ok||measure.duration_ms>=8000)return{result:'unconfirmed',variant:ctx.variant,measure,selected_rows:null,held_rows:null};
  const rows=cohorts(only(await ctx.holder.request(`select pg_temp.locksource41_cohorts(${literal(ctx.workspace)}::uuid,${literal(ctx.series)}::uuid);`)));
  let selected=0,held=0;const counts={};
  for(const item of rows){counts[item.relation]=item.keys.length;for(const key of item.keys){selected++;const result=await probe(ctx,item.relation,key);assert.deepEqual(result,{found:true,locked:true,code:'55P03'},'LOCKSOURCE41_SELECTED_ROW_NOT_HELD');held++;}}
  const negatives={};
  for(const sample of negativeSamples(ctx)){
   const result=await probe(ctx,sample.relation,sample.key);assert.deepEqual(result,{found:sample.found,locked:false},'LOCKSOURCE41_UNSELECTED_ROW_CHANGED');negatives[sample.label]=true;
  }
  return{result:'passed',variant:ctx.variant,measure,selected_rows:selected,held_rows:held,rowset_sha256:createHash('sha256').update(JSON.stringify(canonical(rows))).digest('hex'),probe_counts:counts,negative_samples:negatives,independent_backend_pids_verified:true,selected_permission_denial_counted_as_lock:false,all_probe_transactions_rolled_back:true};
 }finally{await cleanup(ctx);}
}

export async function verifyEdges(ctx){
 admission(ctx);assert(Number.isSafeInteger(ctx.observer.pid)&&ctx.observer.pid!==ctx.holder.pid&&ctx.observer.pid!==ctx.contender.pid);
 const id=label=>{const value=ctx.id(label);assert(UUID.test(value));return literal(value)+'::uuid';};
 const workspace=literal(ctx.workspace)+'::uuid',series=literal(ctx.series)+'::uuid';
 const observe=async()=>only(await ctx.observer.request(`reset role;select jsonb_build_object('workspace',workspace_id,'pool',workspace_candidate_id,'row_version',row_version,'updated_at',updated_at,'row_sha256',encode(sha256(convert_to(to_jsonb(a)::text,'UTF8')),'hex'))from eps.assignments a where id=${id('assignment-2-1')};`));
 const before=await observe();assert.equal(before.workspace,ctx.workspace);assert.equal(before.pool,ctx.id('pool-2-1'));assert(typeof before.row_sha256==='string'&&/^[a-f0-9]{64}$/u.test(before.row_sha256));
 let fk,measure,control,held;
 try{
  // Each rejected insert has its own PL/pgSQL subtransaction. No constraint or
  // trigger is disabled; neither attempt can escape the outer ROLLBACK.
  fk=only(await ctx.observer.request(`begin;reset role;set local statement_timeout='8s';set local lock_timeout='8s';
do $cross_workspace$declare v_slot text;v_pool text;begin
 begin insert into eps.assignments(id,workspace_id,slot_id,workspace_candidate_id,position)values(${id('cross-workspace-slot-assignment')},${workspace},${id('slot-1-1')},${id('pool-2-1')},'option');
 exception when foreign_key_violation then v_slot:='23503';end;
 begin insert into eps.assignments(id,workspace_id,slot_id,workspace_candidate_id,position)values(${id('cross-workspace-pool-assignment')},${workspace},${id('slot-2-1')},${id('pool-1-1')},'option');
 exception when foreign_key_violation then v_pool:='23503';end;
 perform set_config('eps.locksource41.slot_fk',coalesce(v_slot,'unexpectedly_accepted'),true);
 perform set_config('eps.locksource41.pool_fk',coalesce(v_pool,'unexpectedly_accepted'),true);
end$cross_workspace$;
select jsonb_build_object('slot_code',current_setting('eps.locksource41.slot_fk'),'pool_code',current_setting('eps.locksource41.pool_fk'));
rollback;`));
  assert.deepEqual(fk,{slot_code:'23503',pool_code:'23503'},'LOCKSOURCE41_CROSS_WORKSPACE_REFERENCE_ACCEPTED');
  // Only the disposable assignment is changed. The existing archived pool is
  // not updated. Its FK KEY SHARE cannot make the NO KEY UPDATE probe fail.
  await ctx.holder.request(`begin;reset role;set local statement_timeout='8s';set local lock_timeout='8s';
update eps.assignments set workspace_candidate_id=${id('pool-2-12')}where id=${id('assignment-2-1')}and workspace_id=${workspace};`);
  const poolState=only(await ctx.holder.request(`select jsonb_build_object('archived_pool',p.archived_at is not null,'active_reference',a.archived_at is null)from eps.assignments a join eps.workspace_candidates p on p.id=a.workspace_candidate_id where a.id=${id('assignment-2-1')}and p.id=${id('pool-2-12')};`));
  assert.deepEqual(poolState,{archived_pool:true,active_reference:true});
  const poolProbe=async()=>{
   await ctx.contender.request('begin;'+ctx.acting('mcp','eps_review_owner')+"set local statement_timeout='8s';set local lock_timeout='8s';");
   try{return only(await ctx.contender.request(`select pg_temp.locksource41_probe_pool_share(${id('pool-2-12')});`));}
   finally{await ctx.contender.request('rollback;');}
  };
  control=await poolProbe();assert.deepEqual(control,{found:true,locked:false},'LOCKSOURCE41_FK_LOCK_CONTROL_FAILED');
  await ctx.holder.request(ctx.acting('mcp','eps_review_owner')+"set local statement_timeout='8s';set local lock_timeout='8s';");
  const value=only(await ctx.holder.request(`select pg_temp.locksource41_measure('locks',${workspace},${series},null,null);`));
  assert(typeof value.ok==='boolean'&&typeof value.duration_ms==='number'&&Number.isFinite(value.duration_ms)&&value.duration_ms>=0);
  measure={ok:value.ok,duration_ms:value.duration_ms};if(value.code!==undefined){assert(typeof value.code==='string'&&/^[A-Z0-9_]{1,64}$/u.test(value.code));measure.code=value.code;}
  if(measure.ok&&measure.duration_ms<8000){held=await poolProbe();assert.deepEqual(held,{found:true,locked:true,code:'55P03'},'LOCKSOURCE41_ARCHIVED_REFERENCED_POOL_NOT_HELD');}
 }finally{
  const results=await Promise.allSettled([cleanup(ctx),ctx.observer.request('rollback;')]);assert(results.every(result=>result.status==='fulfilled'),'LOCKSOURCE41_EDGE_ROLLBACK_UNCONFIRMED');
 }
 assert.deepEqual(await observe(),before,'LOCKSOURCE41_EDGE_ASSIGNMENT_NOT_RESTORED');
 if(!held)return{result:'unconfirmed',variant:ctx.variant,measure,cross_workspace_foreign_keys_rejected:true,edge_assignment_exactly_restored:true};
 return{result:'passed',variant:ctx.variant,measure,cross_workspace_foreign_keys_rejected:true,archived_pool_active_reference:true,fk_key_share_control_was_unblocked:true,helper_share_lock_verified:true,edge_assignment_exactly_restored:true,all_edge_transactions_rolled_back:true,ready_dml_issued:false};
}
