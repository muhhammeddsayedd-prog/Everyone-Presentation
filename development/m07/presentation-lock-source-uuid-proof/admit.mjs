/** Dated278/393 partial admission. No private input or old execution is reused. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {admitCarry as admit393,freshCarry as fresh393,readBounded}from '../presentation-lock-source-edge-rls-proof/admit.mjs';
import {firstPair,qualifies}from './fixture.mjs';
export const CARRY278_PATH='tracking/evidence/m07/presentation-lock-source-edge-rls-proof/2026-11-02T21-26-58.893Z-278a260d.json';
export const CARRY278_SHA='338cb6dd81a9572d9d5811367a3ffe6b6dd49f73d64617d83297bcbc3c07a75b';
const ENTRY='development/m07/presentation-lock-source-edge-rls-proof/entry.mjs';
const CLOSED='3a372cbdb8f38b87bb86e11ba5d24194de8bb39c5aa08a20fd8b585d0acc1a47';
export function validate278(r){
 assert.equal(r.run_id,'278a260d-9070-4896-b565-95c860411a26');assert.equal(r.result,'failed');assert.equal(r.failure_code,'LOCKSOURCE41_COMMAND_FAILED');
 assert.equal(r.cloud_called,false);assert.equal(r.provider_called,false);
 for(const key of['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','independent_successful_daemon_label_inventories_empty'])assert.equal(r[key],true);
 const p=r.pool_helper_proof;assert.equal(p.edge_rls_counterfactual_completed,true);assert.equal(p.candidate_four_bodies_executed,false);
 assert.equal(p.carried_evidence.receipt_sha256,'f5de1993783c8c3f4e618189091291ea905bd34839effd088af59e403d477cac');
 assert.deepEqual(p.edge_rls.map(x=>[x.variant,x.state]),[['old','visible'],['old','own_pair_deleted'],['new','visible'],['new','own_pair_deleted']]);
 for(const row of p.edge_rls){
  const visible=row.state==='visible';assert.equal(row.normal_return,true);assert.equal(row.rolled_back,true);assert.equal(row.full_baseline_restored,true);assert.equal(row.actual_helper_changed,false);assert.equal(row.old_ready_dml_issued,false);
  assert.deepEqual(row.physical,{asset_exists:true,selected_frame_unchanged:true,pair_exists:visible});
  assert.deepEqual(row.holder_visibility,{asset_visible:visible,pair_visible:visible,role:'eps_review_owner'});
  assert.deepEqual(row.before.probe,{found:true,locked:false});assert.deepEqual(row.after.probe,visible?{found:true,locked:true,code:'55P03'}:{found:true,locked:false});
  for(const side of['before','after'])assert.deepEqual(row[side].visibility,{asset_visible:true,pair_visible:true,role:'eps_review_owner'});
  assert.equal(row.branch.found,visible);assert.equal(row.branch.source_ids_include_target,row.variant==='new'?true:null);assert.equal(row.branch.statement_timeout,'8s');assert.equal(row.branch.lock_timeout,'8s');
 }
 assert.deepEqual(p.cross_workspace,{normal_return:true,rolled_back:true,result:{slot:'23503',pool:'23503'}});
 assert.equal(p.workspace_fence.actual_distinct_pid_wait,false);assert.equal(p.workspace_fence.normal_public_mutation_return,false);
 assert.equal(p.authority,undefined);assert.equal(Object.keys(r.source_seals).length,97);
 return{receipt:CARRY278_PATH,receipt_sha256:CARRY278_SHA,observed_at:r.observed_at,result:'dated_partial_PASS_from_failed_run',four_RLS_controls:true,cross_workspace_FK:true,remaining_RC_fence_membership_capability_expiry_not_carried:true,final_clone_restoration_not_carried:true,replayed:false};
}
export async function admitCarry(root,reader=readBounded){
 const base=await admit393(root,reader),raw=await reader(path.join(root,CARRY278_PATH));assert.equal(sha(raw),CARRY278_SHA);const r=JSON.parse(raw.toString('utf8')),evidence=validate278(r);
 for(const[name,expected]of Object.entries(r.source_seals)){
  assert(!path.isAbsolute(name)&&!name.split(/[\\/]/u).includes('..'));const bytes=await reader(path.join(root,name));
  if(name===ENTRY){
   const text=bytes.toString('utf8'),pattern=/^export const EXECUTION_ENABLED=(?:false|true);$/gmu;assert.equal([...text.matchAll(pattern)].length,1);
   assert.equal(sha(text.replace(pattern,'export const EXECUTION_ENABLED=true;')),expected);assert.equal(sha(text.replace(pattern,'export const EXECUTION_ENABLED=false;')),CLOSED);
  }else assert.equal(sha(bytes),expected);
 }
 return{...base,evidence:{...base.evidence,additional_dated278:evidence}};
}
export function freshCarry(ctx,admitted){
 const result=fresh393(ctx,admitted),q=ctx.report.fixture_uuid_qualification;
 assert.equal(q.selection_before_database_or_claim,true);assert.equal(q.outcome_or_timing_observed,false);assert.equal(q.source_rows_or_SQL_changed,false);
 assert.equal(q.slot_domain_UUID_valid,true);assert.equal(q.pool_domain_UUID_valid,true);assert.equal(q.attempt_cap,4096);assert(Number.isInteger(q.attempt_count)&&q.attempt_count>=1&&q.attempt_count<=4096);assert.equal(q.rejected_namespace_count,q.attempt_count-1);
 const pair=firstPair(ctx.runId);assert.equal(qualifies(ctx.runId),true);assert.equal(q.slot_sha256,sha(pair.slot.id));assert.equal(q.pool_sha256,sha(pair.pool.id));assert.equal(q.first_slot_index,pair.slot.index);assert.equal(q.first_pool_index,pair.pool.index);
 return{...result,fresh_runtime_namespace_qualified_only_for_canonical_public_inputs:true};
}
