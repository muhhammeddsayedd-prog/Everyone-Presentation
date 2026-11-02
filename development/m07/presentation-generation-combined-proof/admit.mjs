/** Actual isolated helper/security chain only; never substitutes for generation. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {admitCarry as admitEarlier}from '../presentation-lock-source-uuid-proof/admit.mjs';
import {firstPair,qualifies}from '../presentation-lock-source-uuid-proof/fixture.mjs';
import {readBounded}from '../presentation-lock-source-edge-rls-proof/admit.mjs';
export const SECURITY_PATH='tracking/evidence/m07/presentation-lock-source-uuid-proof/2026-11-02T22-00-11.340Z-c35b7493.json';
export const SECURITY_SHA='1c73ede315fc040dc9a5080209307b7ed7380dd292dc25831fd66ab95768e632';
const OUTCOME='tracking/evidence/m07/presentation-lock-source-uuid-proof/c35b7493-outcome.json';
const OUTCOME_SHA='e9119108244c8cd6bd7340536eb2c174e49bba6407a53458d0e3e40aaf5fa870';
const ENTRY='development/m07/presentation-lock-source-uuid-proof/entry.mjs';
const CLOSED='a92a26d668fff088277bd9bab2e49ddbf241279546cb5af0d68622d6a027e875';
export function validateSecurity(r,outcome){
 assert.equal(r.run_id,'c35b7493-c72c-4e14-9002-de2c726e58e4');assert.equal(r.result,'passed');assert.equal(r.checkpoint,'complete');
 assert.equal(outcome.normal_process_exit_code,0);assert.equal(outcome.actual_receipt.sha256,SECURITY_SHA);
 assert.equal(r.provider_called,false);assert.equal(r.cloud_called,false);
 for(const key of['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','independent_successful_daemon_label_inventories_empty'])assert.equal(r[key],true);
 const p=r.pool_helper_proof;assert.equal(p.completed_RLS_and_cross_FK_carried_not_replayed,true);assert.equal(p.remaining_semantics_and_security_completed,true);
 const fence=p.workspace_fence;assert.equal(fence.actual_distinct_pid_wait,true);assert.equal(fence.normal_public_mutation_return,true);assert.equal(fence.writer_rolled_back,true);assert.equal(fence.helper.ok,true);assert(fence.helper.duration_ms<8000);
 assert.deepEqual(p.authority.map(x=>x.case),['membership','capability','expiry']);
 for(const row of p.authority){assert.equal(row.actual_relation_wait,true);assert.equal(row.expected_denial,true);assert.deepEqual(row.error,{sqlstate:'P0001',provenance:'first_verbose_psql_ERROR_line',application_code:'RESOURCE_NOT_FOUND'});assert.equal(row.private_error.normal_return,true);if(row.case==='expiry')assert.equal(row.database_clock_expired,true);else{assert.equal(row.authority_changed,true);assert.equal(row.authority_restored,true);}}
 for(const key of['original_lock_and_four_preceding_bodies_restored','full_fresh_data_catalogue_reason_ready_auth_preserved','original_presentation_configuration_restored'])assert.equal(p[key],true);
 assert.equal(p.restored_helper_source_sha256,'4107c87b1a51d2c5ed506a64c81378026068406a5136b202779767efb30264e7');assert.equal(Object.keys(r.source_seals).length,106);
 return{receipt:SECURITY_PATH,receipt_sha256:SECURITY_SHA,observed_at:r.observed_at,normal_process_exit_code:0,result:'actual_local_remaining_RC_PASS',workspace_fence:true,membership_capability_clock_expiry:true,source_and_config_restoration:true,helper280_and_four_OLD_bodies_only:true,not_whole_generation_or_four_new_body_acceptance:true,replayed:false};
}
export async function admitCarry(root,reader=readBounded){
 const earlier=await admitEarlier(root,reader),raw=await reader(path.join(root,SECURITY_PATH)),safe=await reader(path.join(root,OUTCOME));assert.equal(sha(raw),SECURITY_SHA);assert.equal(sha(safe),OUTCOME_SHA);
 const r=JSON.parse(raw.toString('utf8')),evidence=validateSecurity(r,JSON.parse(safe.toString('utf8')));
 for(const[name,expected]of Object.entries(r.source_seals)){
  assert(!path.isAbsolute(name)&&!name.split(/[\\/]/u).includes('..'));const bytes=await reader(path.join(root,name));
  if(name===ENTRY){const text=bytes.toString('utf8'),pattern=/^export const EXECUTION_ENABLED=(?:false|true);$/gmu;assert.equal([...text.matchAll(pattern)].length,1);assert.equal(sha(text.replace(pattern,'export const EXECUTION_ENABLED=true;')),expected);assert.equal(sha(text.replace(pattern,'export const EXECUTION_ENABLED=false;')),CLOSED);}
  else assert.equal(sha(bytes),expected);
 }
 return{...earlier,securityReceipt:r,evidence:{...earlier.evidence,additional_actual_remaining_RC:evidence}};
}
export function freshCarry(ctx,admitted){
 // Source/recipe counts and pure input qualification remain fresh. Authority is
 // never cached: the new actual generation/equality/security tests must run.
 const r=admitted.securityReceipt;
 for(const key of['metadata_sha256','migration_sha256','functional_sha256','image_id'])assert.equal(ctx.report[key],r[key]);
 const counts=baseline=>Object.entries(baseline.tables).map(([name,row])=>[name,row.count]).sort(([a],[b])=>a<b?-1:a>b?1:0);
 assert.deepEqual(counts(ctx.baseline),counts(r.pool_helper_proof.fresh_baseline));assert.equal(ctx.baseline.ready_versions,13);assert.equal(ctx.baseline.pins,60);assert.equal(ctx.baseline.reason_nonnull_rows,1);
 const q=ctx.report.fixture_uuid_qualification,pair=firstPair(ctx.runId);assert.equal(qualifies(ctx.runId),true);assert.equal(q.slot_sha256,sha(pair.slot.id));assert.equal(q.pool_sha256,sha(pair.pool.id));
 assert.equal(q.selection_before_database_or_claim,true);assert.equal(q.outcome_or_timing_observed,false);assert.equal(q.source_rows_or_SQL_changed,false);assert.equal(q.attempt_cap,4096);assert(Number.isInteger(q.attempt_count)&&q.attempt_count>=1&&q.attempt_count<=4096);assert.equal(q.rejected_namespace_count,q.attempt_count-1);
 assert.equal(ctx.bindings.baseSha,'280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4');assert.equal(ctx.bindings.candidateSha,ctx.bindings.baseSha);
 assert.equal(ctx.bindings.beforeBodies.length,4);assert.equal(ctx.bindings.afterBodies.length,4);assert(ctx.bindings.beforeBodies.every((x,i)=>x.sha!==ctx.bindings.afterBodies[i].sha));
 return{...admitted.evidence,fresh_fixture_counts_equal:true,cross_run_business_hash_equality_claimed:false,baseline_count_provenance_only:true,old_four_and_candidate_four_compared_fresh:true};
}
