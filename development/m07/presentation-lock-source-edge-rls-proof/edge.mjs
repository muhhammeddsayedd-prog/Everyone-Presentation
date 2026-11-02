/** Focused same-holder RLS counterfactual; never changes policy or helper. */
import assert from 'node:assert/strict';
import {setTimeout}from 'node:timers/promises';
import {literal,json}from '../presentation-lock-source-proof/proof.mjs';
import {nativeError}from '../presentation-lock-source-pool-proof/native.mjs';
const only=rows=>{assert.equal(rows.length,1);return rows[0];};
const bounds="set local statement_timeout='8s';set local lock_timeout='8s';";
const SNAPSHOT='select locksource41_proof.row_hashes();';

export async function edgeCounterfactual(ctx){
 const records=ctx.report.pool_helper_proof.edge_rls=[];
 const workspace=ctx.profiles.large.workspace,asset=ctx.id('frame-4'),media=ctx.id('media-2');
 for(const variant of['old','new'])for(const state of['visible','own_pair_deleted']){
  const record={variant,state,normal_return:false,rolled_back:false,old_ready_dml_issued:false,actual_helper_changed:false,only_isolated_edge_RR:true};
  records.push(record);ctx.report.checkpoint='edge-rls-'+variant+'-'+state;
  const holder=await ctx.startPrepared('edge_h'),contender=await ctx.startPrepared('edge_c');
  let primary,cleanupError;
  const committed=async()=>{
   await contender.request('begin;'+ctx.acting('mcp')+bounds);
   try{
    const visibility=only(await contender.request(`select jsonb_build_object('asset_visible',exists(select 1 from eps.media_assets where id=${literal(asset)}::uuid),'pair_visible',exists(select 1 from eps.candidate_media_frames where candidate_media_id=${literal(media)}::uuid and asset_id=${literal(asset)}::uuid),'role',current_user);`));
    const probe=only(await contender.request(`select pg_temp.locksource41_probe('eps.media_assets',${json({id:asset})});`));
    return{visibility,probe};
   }finally{await contender.request('rollback;reset role;');}
  };
  try{
   assert.notEqual(holder.pid,contender.pid);record.distinct_pids=true;
   await holder.request('begin isolation level repeatable read;'+ctx.acting('api')+'reset role;'+bounds);
   const fenced=only(await holder.request(`select jsonb_build_object('fenced',id)from eps.workspaces where id=${literal(workspace)}::uuid for update;`));
   assert.equal(fenced.fenced,workspace);record.workspace_fenced=true;
   if(state==='own_pair_deleted'){
    const deleted=await holder.request(`delete from eps.candidate_media_frames where candidate_media_id=${literal(media)}::uuid and asset_id=${literal(asset)}::uuid returning jsonb_build_object('deleted',true);`);
    record.own_pair_deleted=deleted.length===1;assert.equal(record.own_pair_deleted,true);
   }
   record.physical=only(await holder.request(`select jsonb_build_object('asset_exists',exists(select 1 from eps.media_assets where id=${literal(asset)}::uuid),'selected_frame_unchanged',exists(select 1 from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id where a.workspace_id=${literal(workspace)}::uuid and a.archived_at is null and p.selected_candidate_media_id=${literal(media)}::uuid and ${literal(asset)}::uuid=any(p.selected_frame_asset_ids)),'pair_exists',exists(select 1 from eps.candidate_media_frames where candidate_media_id=${literal(media)}::uuid and asset_id=${literal(asset)}::uuid));`));
   assert.deepEqual(record.physical,{asset_exists:true,selected_frame_unchanged:true,pair_exists:state==='visible'});
   await holder.request(ctx.acting('mcp')+bounds);
   record.holder_visibility=only(await holder.request(`select jsonb_build_object('asset_visible',exists(select 1 from eps.media_assets where id=${literal(asset)}::uuid),'pair_visible',exists(select 1 from eps.candidate_media_frames where candidate_media_id=${literal(media)}::uuid and asset_id=${literal(asset)}::uuid),'role',current_user);`));
   record.before=await committed();
   assert.deepEqual(record.before.visibility,{asset_visible:true,pair_visible:true,role:'eps_review_owner'});
   assert.deepEqual(record.before.probe,{found:true,locked:false});
   record.branch_dispatch_started=true;
   record.branch=only(await holder.request(`select pg_temp.edge41_${variant}(${literal(workspace)}::uuid,${literal(asset)}::uuid);`));
   record.branch_normal_return=true;
   record.after=await committed();
   // Record both complete controls before assessing the disputed edge oracle.
   const visible=state==='visible';
   assert.deepEqual(record.holder_visibility,{asset_visible:visible,pair_visible:visible,role:'eps_review_owner'});
   assert.equal(record.branch.found,visible);assert.equal(record.branch.role,'eps_review_owner');
   assert.equal(record.branch.statement_timeout,'8s');assert.equal(record.branch.lock_timeout,'8s');
   assert.equal(record.branch.source_ids_include_target,variant==='new'?true:null);
   assert.deepEqual(record.after.visibility,{asset_visible:true,pair_visible:true,role:'eps_review_owner'});
   assert.deepEqual(record.after.probe,visible?{found:true,locked:true,code:'55P03'}:{found:true,locked:false});
   record.normal_return=true;
  }catch(error){primary=error;record.error=nativeError(error);record.private_error=await ctx.captureError('edge_'+variant+'_'+state,error);}
  finally{
   try{await holder.request('rollback;reset role;');record.rolled_back=true;}
   catch(error){
    record.cleanup_error=nativeError(error);
    if(!primary){cleanupError=error;record.private_cleanup_error=await ctx.captureError('edge_cleanup_'+variant+'_'+state,error);}
    else{record.backend_exit=await Promise.race([holder.done,setTimeout(5000).then(()=>null)]);record.rolled_back_by_backend_exit=record.backend_exit===3;}
   }
   await holder.finish();await contender.finish();
  }
  if(primary)throw primary;if(cleanupError)throw cleanupError;
  assert.deepEqual(await ctx.value(SNAPSHOT),ctx.baseline,'EDGE_RLS_ROLLBACK_BASELINE_CHANGED');record.full_baseline_restored=true;
 }
 assert.equal(records.length,4);
 ctx.report.pool_helper_proof.edge_rls_counterfactual_completed=true;
}
