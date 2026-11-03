/** Exact failed first-call baseline, not evidence of a new cancelled phase. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {admitCarry as admitEarlier,freshCarry}from '../presentation-generation-assignment-proof/admit.mjs';
import {readBounded}from '../presentation-lock-source-edge-rls-proof/admit.mjs';
export{freshCarry};
export const FAILED_PATH='tracking/evidence/m07/presentation-generation-assignment-proof/2026-11-03T01-37-14.180Z-d093fd61.json';
export const FAILED_SHA='6761aae8363a506197e1a5cca45c97a3dca20d1645dafa07c5182831ed007de2';
const OUTCOME='tracking/evidence/m07/presentation-generation-assignment-proof/d093fd61-outcome.json';
const OUTCOME_SHA='f798aeeb1332806563cbba79ceb056d8fa530a9565f049016ff0951f030175b9';
const ENTRY='development/m07/presentation-generation-assignment-proof/entry.mjs';
const CLOSED='8b9c0afe4080b6673fbb19303dc19655ef9bf4c4c1d4069bb6e2567554372785';
export function validateFailed(r,outcome){
 assert.equal(r.run_id,'d093fd61-304d-453a-bc2d-7c94fe85d228');assert.equal(r.result,'failed');assert.equal(r.checkpoint,'combined-first-candidate-mcp-large');
 assert.equal(r.cloud_called,false);assert.equal(r.provider_called,false);assert.equal(outcome.normal_process_exit,1);assert.equal(outcome.actual_receipt.sha256,FAILED_SHA);
 for(const key of['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','independent_successful_daemon_label_inventories_empty'])assert.equal(r[key],true);
 const p=r.combined_generation;assert.equal(p.first_calls.length,1);assert.equal(p.projections.length,0);assert.equal(p.actual_first_whole_generation_matrix_completed,undefined);
 const c=p.first_calls[0];assert.deepEqual([c.variant,c.mode,c.label],['candidate','mcp','large']);assert.equal(c.normal_return,true);assert.equal(c.rolled_back,true);assert.equal(c.first_in_fresh_backend,true);assert.equal(c.application_calls_before_dispatch,0);assert.equal(c.generation.ok,false);assert.equal(c.generation.code,'57014');
 const a=r.assignment_enumeration;assert.equal(a.after_data_sha256,'0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd');assert.deepEqual(a.actual_FK,{deferred:false,validated:true,deferrable:false,references_slots:true,workspace_slot_columns:true,referenced_workspace_id_columns:true});
 assert.equal(outcome.current_cancelled_subphase,'unknown');assert.equal(outcome.prior13f5_context_not_relabeled_as_current,true);
 return{receipt:FAILED_PATH,receipt_sha256:FAILED_SHA,observed_at:r.observed_at,normal_process_exit:1,result:'failed',one_first_candidate_MCP_large_cancelled:true,remaining_seven_not_run:true,actual_cancelled_subphase:'unknown',no_performance_acceptance:true,replayed:false};
}
export async function admitCarry(root,reader=readBounded){
 const earlier=await admitEarlier(root,reader),raw=await reader(path.join(root,FAILED_PATH)),safe=await reader(path.join(root,OUTCOME));assert.equal(sha(raw),FAILED_SHA);assert.equal(sha(safe),OUTCOME_SHA);
 const r=JSON.parse(raw.toString('utf8')),evidence=validateFailed(r,JSON.parse(safe.toString('utf8')));
 for(const[name,expected]of Object.entries(r.source_seals)){
  assert(!path.isAbsolute(name)&&!name.split(/[\\/]/u).includes('..'));const bytes=await reader(path.join(root,name));
  if(name===ENTRY){const text=bytes.toString('utf8'),pattern=/^export const EXECUTION_ENABLED=(?:false|true);$/gmu;assert.equal([...text.matchAll(pattern)].length,1);assert.equal(sha(text.replace(pattern,'export const EXECUTION_ENABLED=true;')),expected);assert.equal(sha(text.replace(pattern,'export const EXECUTION_ENABLED=false;')),CLOSED);}
  else assert.equal(sha(bytes),expected);
 }
 return{...earlier,evidence:{...earlier.evidence,failed_assignment_d093:evidence}};
}
