/** The exact failed eight-call baseline remains failed and is never replayed. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {admitCarry as admitSecurity,freshCarry}from '../presentation-generation-combined-proof/admit.mjs';
import {readBounded}from '../presentation-lock-source-edge-rls-proof/admit.mjs';
export{freshCarry};
export const FAILED_PATH='tracking/evidence/m07/presentation-generation-combined-proof/2026-11-02T22-44-11.890Z-78df9599.json';
export const FAILED_SHA='1732443e726cfe1e40e3a4b4160e18bd732196f86992580f357af3681dafb942';
const ENTRY='development/m07/presentation-generation-combined-proof/entry.mjs';
const DISABLED='8dca5891b9f2e832f94c8ebc206377f159fd234441a4721d0e812f3055f51e88';
export function validateFailed(r){
 assert.equal(r.run_id,'78df9599-a7e7-4b7d-81ff-235218430a45');assert.equal(r.result,'failed');assert.equal(r.checkpoint,'combined-first-candidate-mcp-large');
 assert.equal(r.cloud_called,false);assert.equal(r.provider_called,false);
 for(const k of['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','independent_successful_daemon_label_inventories_empty'])assert.equal(r[k],true);
 const rows=r.combined_generation.first_calls;assert.equal(rows.length,8);assert.equal(new Set(rows.map(x=>x.pid)).size,8);
 assert.deepEqual(rows.map(x=>[x.variant,x.mode,x.label]),['old','candidate'].flatMap(v=>['api','mcp'].flatMap(m=>['control','large'].map(p=>[v,m,p]))));
 for(const row of rows){assert.equal(row.normal_return,true);assert.equal(row.rolled_back,true);assert.equal(row.application_calls_before_dispatch,0);assert.equal(typeof row.client_elapsed_ms,'number');
  if(row.mode==='mcp'&&row.label==='large'){assert.equal(row.generation.ok,false);assert.equal(row.generation.code,'57014');}
  else assert.equal(row.generation.ok,true);
 }
 assert.equal(r.combined_generation.projections.length,0);assert.equal(r.combined_generation.actual_first_whole_generation_matrix_completed,undefined);
 return{receipt:FAILED_PATH,receipt_sha256:FAILED_SHA,result:'failed',all_eight_results_retained:true,large_MCP_old_and_candidate_cancelled:true,diagnostic_context_previously_unavailable:true,unchanged_failed_performance_acceptance:true,replayed:false};
}
export async function admitCarry(root,reader=readBounded){
 const security=await admitSecurity(root,reader),raw=await reader(path.join(root,FAILED_PATH));assert.equal(sha(raw),FAILED_SHA);const r=JSON.parse(raw.toString('utf8')),failure=validateFailed(r);
 for(const[name,expected]of Object.entries(r.source_seals)){
  assert(!path.isAbsolute(name)&&!name.split(/[\\/]/u).includes('..'));const bytes=await reader(path.join(root,name));
  if(name===ENTRY){const text=bytes.toString('utf8'),pattern=/^export const EXECUTION_ENABLED=(?:false|true);$/gmu;assert.equal([...text.matchAll(pattern)].length,1);assert.equal(sha(text.replace(pattern,'export const EXECUTION_ENABLED=true;')),expected);assert.equal(sha(text.replace(pattern,'export const EXECUTION_ENABLED=false;')),DISABLED);}
  else assert.equal(sha(bytes),expected);
 }
 return{...security,evidence:{...security.evidence,failed_combined78:failure}};
}
