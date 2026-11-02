/** Pure admission of retained actual timing evidence; never provider/DB work. */
import assert from 'node:assert/strict';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
export const PRIOR_PATH='tracking/evidence/m07/presentation-lock-source-pool-proof/2026-11-02T18-53-13.327Z-c2f4fe15.json';
export const PRIOR_SHA='6db69c2ce69a6491e7b144057d33545ea6cb58c95fcc18eaded65d48244c0187';
export function admitTiming(bytes){
 assert.equal(sha(bytes),PRIOR_SHA,'ORACLE_PRIOR_TIMING_BYTES_CHANGED');
 const r=JSON.parse(bytes),p=r.pool_helper_proof;
 assert.equal(r.run_id,'c2f4fe15-ee8d-468b-abee-8e3166a508b6');assert.equal(r.result,'failed');assert.equal(r.checkpoint,'pool-proof-semantic-baseline');
 for(const key of['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released'])assert.equal(r[key],true);
 assert.equal(p.candidate_four_bodies_executed,false);assert.equal(p.catalogue_prosrc_exclusions,1);
 assert.equal(p.cold.length,8);assert.equal(p.warm.length,8);assert.equal(new Set(p.cold.map(x=>x.pid)).size,8);
 for(const variant of['old','new'])for(const mode of['api','mcp'])for(const fenced of[false,true]){
  const rows=p.cold.filter(x=>x.variant===variant&&x.mode===mode&&x.fenced===fenced);assert.equal(rows.length,1);
  const row=rows[0];assert.equal(row.first_in_fresh_backend,true);assert.equal(row.helper_calls_before_dispatch,0);assert.equal(row.helper_call_index,1);
  if(variant==='old'&&mode==='mcp'){assert.equal(row.error.sqlstate,'57014');assert.equal(row.error.provenance,'first_verbose_psql_ERROR_line');assert.equal(row.backend_exit,3);assert.equal(row.private_error.normal_return,true);}
  else{assert.equal(row.normal_return,true);assert.equal(row.response.ok,true);assert(row.response.duration_ms>=0&&row.response.duration_ms<8000);assert.equal(row.rollback_normal,true);}
  if(variant==='new'){
   const warm=p.warm.filter(x=>x.case_id===row.case_id);assert.equal(warm.length,2);
   for(const sample of warm){assert.equal(sample.normal_return,true);assert.equal(sample.rollback_normal,true);assert.equal(sample.response.ok,true);assert(sample.response.duration_ms>=0&&sample.response.duration_ms<8000);}
  }
 }
 const installed=p.installations.find(x=>x.variant==='new');assert.equal(installed.actual_source_sha256,'280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4');assert.equal(installed.authority_unchanged,true);
 return{path:PRIOR_PATH,sha256:PRIOR_SHA,scope:'retained actual isolated helper first8/warm8 only; original oracle failed57014; no full acceptance',fresh_timing_claim:false};
}
