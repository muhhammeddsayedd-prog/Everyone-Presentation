/** Exact633 failed application, normal observation/restore. Current stage remains unknown. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {firstPair,qualifies}from '../presentation-lock-source-uuid-proof/fixture.mjs';
import {admitCarry as admitEarlier}from '../presentation-generation-pin-batch-stage-diagnostic/admit.mjs';
import {readBounded}from '../presentation-lock-source-edge-rls-proof/admit.mjs';
export const FAILED_PATH='tracking/evidence/m07/presentation-generation-raw-companion-first-proof/2026-11-03T05-58-13.099Z-63350829.json';
export const FAILED_SHA='24df393b180678451a34e92904060fd97f618c51463948ca9b9356631c880863';
const OUTCOME='tracking/evidence/m07/presentation-generation-raw-companion-first-proof/63350829-outcome.json';
const OUTCOME_SHA='cdc0752a76dd2cb3eb85be9b39780723847f3b183d492c1c792cb452ea7d3c25';
const CORRECTION='tracking/evidence/m07/presentation-generation-raw-companion-first-proof/63350829-body-provenance-correction.json';
const CORRECTION_SHA='d78515d65ae297cc144dce89162c4007d62c755820d111320136289989e0f024';
const ENTRY='development/m07/presentation-generation-raw-companion-first-proof/entry.mjs';
const ARMED='dbf5e165d81d87e5c4b6cd4097db3bce45e7ea14c04278b84b59e3622cccc3c3';
const CLOSED='dce315c6530c2062090d3127e3d3451de9945a086dea63bacea8d14d5128e9e1';
const BASE='280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4';
const HELPER='aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3';
const CURRENT=['0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd','c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10','41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d','f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5'];
const CANONICAL=['4d46151993a60d8c6ac9d36e48781fee34c12c3e1dede727ac1ed4d31a953ab7','f0815e014144f1345b4679d96114aab6b358d95df317e3cfe6ac6b59989813cb','b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08','ed4a3469971fa410078b546b13aa0a875b4867efdda4b134dc729563dd887187'];
const INSTRUMENTED=['234cec65947a522b488c679cdc3eed9fec662394f80998626f31fba2d90dc72c','c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10','b3bc105e6fb7d14194b04db6dbb5e8bbaad8bad9fe237d276cbde751c112b2a3','f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5'];
export function validateFailed(r,outcome){
 assert.equal(r.run_id,'63350829-0a08-4095-94f4-99523a6a74b7');assert.equal(r.result,'passed');assert.equal(r.checkpoint,'complete');
 assert.equal(outcome.normal_process_exit,0);assert.equal(outcome.actual_receipt.sha256,FAILED_SHA);assert.equal(r.cloud_called,false);assert.equal(r.provider_called,false);
 for(const key of['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','independent_successful_daemon_label_inventories_empty'])assert.equal(r[key],true);
 const d=r.generation_first_call,c=d.call;assert.equal(d.scope_only,true);assert.equal(d.performance_or_release_acceptance,false);assert.equal(d.single_call_completed,true);assert.equal(d.all_later_proofs_remain_required,true);
 assert.equal(c.profile,'large');assert.equal(c.mode,'mcp');assert.equal(c.first_application_call_in_fresh_backend,true);assert.equal(c.application_calls_before_dispatch,0);assert.equal(c.normal_SQL_return,true);assert.equal(c.rolled_back,true);assert.equal(c.child_exit,0);assert.equal(c.full_fresh_baseline_restored,true);assert.equal(c.result.ok,false);assert.equal(c.result.code,'57014');assert.equal(c.application_returned_queued,false);
 assert.equal(d.original4107_and_four_old_bodies_restored,true);assert.equal(d.original_config_and_full_baseline_restored,true);
 const installs=r.data_reuse_body_installations;assert.equal(installs.length,3);
 for(const[i,expected]of[[0,CANONICAL],[1,CURRENT],[2,CANONICAL]]){
  const x=installs[i];assert.equal(x.normal_return,true);assert.deepEqual(x.expected.map(v=>v.source),expected);
  for(const item of x.expected){assert.equal(x.actual[item.name].source,item.source);assert.deepEqual(x.actual[item.name].authority,installs[0].actual[item.name].authority);}
 }
 assert.equal(Object.keys(r.source_seals).length,187);assert.equal(outcome.current_cancelled_stage_or_stack,'unobserved');assert.equal(outcome.previous_ee38_stage_not_relabeled,true);assert.equal(outcome.performance_semantic_security_or_production_acceptance,false);
 return{receipt:FAILED_PATH,receipt_sha256:FAILED_SHA,observed_at:r.observed_at,limited_observation_result:'passed',application_result:'failed57014',normal_process_exit:0,
  current_helper_sha256:HELPER,current_raw_sha256:CURRENT[3],one_first_MCP_large57014:true,current_cancelled_subphase:'unknown',
  previous_ee38_context_not_relabeled:true,candidate_index1_actual_source_and_full_authority_verified:true,final_index2_canonical_source_and_authority_verified:true,all_matrix_semantic_lock_authority_cases_still_required:true,performance_acceptance:false,replayed:false};
}
export function admitRecordedSource(name,expected,bytes){
 const actual=sha(bytes);
 if(name===ENTRY){assert.equal(expected,ARMED);assert([ARMED,CLOSED].includes(actual));}
 else assert.equal(actual,expected);
}
export async function admitCarry(root,reader=readBounded){
 const earlier=await admitEarlier(root,reader),raw=await reader(path.join(root,FAILED_PATH)),safe=await reader(path.join(root,OUTCOME));assert.equal(sha(raw),FAILED_SHA);assert.equal(sha(safe),OUTCOME_SHA);
 const r=JSON.parse(raw.toString('utf8')),evidence=validateFailed(r,JSON.parse(safe.toString('utf8')));
 const corrected=await reader(path.join(root,CORRECTION));assert.equal(sha(corrected),CORRECTION_SHA);const correction=JSON.parse(corrected.toString('utf8'));assert.equal(correction.corrects_safe_outcome.sha256,OUTCOME_SHA);assert.equal(correction.candidate_installation_index,1);assert.equal(correction.final_restoration_installation_index,2);
 for(const[name,expected]of Object.entries(r.source_seals)){
  assert(!path.isAbsolute(name)&&!name.split(/[\\/]/u).includes('..'));admitRecordedSource(name,expected,await reader(path.join(root,name)));
 }
 return{...earlier,evidence:{...earlier.evidence,failed_first633:evidence}};
}
export function freshCarry(ctx,admitted){
 const r=admitted.securityReceipt;
 for(const key of['metadata_sha256','migration_sha256','functional_sha256','image_id'])assert.equal(ctx.report[key],r[key]);
 const counts=b=>Object.entries(b.tables).map(([name,row])=>[name,row.count]).sort(([a],[b])=>a<b?-1:a>b?1:0);
 assert.deepEqual(counts(ctx.baseline),counts(r.pool_helper_proof.fresh_baseline));assert.equal(ctx.baseline.ready_versions,13);assert.equal(ctx.baseline.pins,60);assert.equal(ctx.baseline.reason_nonnull_rows,1);
 const q=ctx.report.fixture_uuid_qualification,pair=firstPair(ctx.runId);assert.equal(qualifies(ctx.runId),true);assert.equal(q.slot_sha256,sha(pair.slot.id));assert.equal(q.pool_sha256,sha(pair.pool.id));
 assert.equal(q.selection_before_database_or_claim,true);assert.equal(q.outcome_or_timing_observed,false);assert.equal(q.source_rows_or_SQL_changed,false);assert.equal(q.attempt_cap,4096);assert(Number.isInteger(q.attempt_count)&&q.attempt_count>=1&&q.attempt_count<=4096);assert.equal(q.rejected_namespace_count,q.attempt_count-1);
 assert.equal(ctx.bindings.baseSha,BASE);assert.equal(ctx.bindings.candidateSha,HELPER);
 assert.deepEqual(ctx.bindings.afterBodies.map(x=>x.sha),INSTRUMENTED);assert.deepEqual(ctx.bindings.stageInstrumentation.map(x=>x.current_candidate_body_sha256),CURRENT);
 for(const item of ctx.bindings.stageInstrumentation){assert.equal(item.business_SQL_inverse_byte_equal,true);assert.equal(item.line_count_equal,true);}
 return{...admitted.evidence,fresh_fixture_counts_equal:true,cross_run_business_hash_equality_claimed:false,baseline_count_provenance_only:true,
  helper280_scopes_dated_only:true,changed_helper_security_or_performance_carried:false,whole_generation_equality_or_performance_proven:false,
  current_four_business_hashes_verified:true,instrumentation_overhead_present:true};
}
