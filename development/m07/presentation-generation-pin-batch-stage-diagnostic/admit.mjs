/** Exact374 failure only. No phase, performance or unreached security is carried. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {firstPair,qualifies}from '../presentation-lock-source-uuid-proof/fixture.mjs';
import {admitCarry as admitEarlier}from '../presentation-generation-acquisition-stage-diagnostic/admit.mjs';
import {readBounded}from '../presentation-lock-source-edge-rls-proof/admit.mjs';
export const FAILED_PATH='tracking/evidence/m07/presentation-generation-pin-batch-proof/2026-11-03T05-14-07.996Z-374eead8.json';
export const FAILED_SHA='791d7a1a3d1658bb9b10c62cb12accb8b50ee3c61581289e4b84427ed3387b3e';
const OUTCOME='tracking/evidence/m07/presentation-generation-pin-batch-proof/374eead8-outcome.json';
const OUTCOME_SHA='397519993fa6837d22271cb3643793c9dd30230fb447455dc1c5fe500429eb0b';
const ENTRY='development/m07/presentation-generation-pin-batch-proof/entry.mjs';
const ARMED='bfe59d0a8876245a510eb711fce70a5a57c1f683a6219ace9d34a416aa840046';
const CLOSED='2c8e12d5432588a98a3207f81bc080dadffdaa0f07a77a47339166c27239577d';
const BASE='280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4';
const HELPER='aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3';
const CURRENT=['0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd','c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10','41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d','afe33691e2bb1dad42999b49c8c5ba9d583d68bfc6cced60bfbea0adadc37dd7'];
const INSTRUMENTED=['234cec65947a522b488c679cdc3eed9fec662394f80998626f31fba2d90dc72c','c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10','b3bc105e6fb7d14194b04db6dbb5e8bbaad8bad9fe237d276cbde751c112b2a3','afe33691e2bb1dad42999b49c8c5ba9d583d68bfc6cced60bfbea0adadc37dd7'];
export function validateFailed(r,outcome){
 assert.equal(r.run_id,'374eead8-0ccf-4c83-8bc3-609ebaf1cb32');assert.equal(r.result,'failed');assert.equal(r.checkpoint,'combined-first-candidate-mcp-large');
 assert.equal(outcome.normal_process_exit,1);assert.equal(outcome.actual_receipt.sha256,FAILED_SHA);assert.equal(r.cloud_called,false);assert.equal(r.provider_called,false);
 for(const key of['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','independent_successful_daemon_label_inventories_empty'])assert.equal(r[key],true);
 const p=r.combined_generation,c=p.first_calls[0];assert.equal(p.first_calls.length,1);assert.equal(p.projections.length,0);assert.equal(p.actual_first_whole_generation_matrix_completed,undefined);
 assert.deepEqual([c.variant,c.mode,c.label],['candidate','mcp','large']);assert.equal(c.normal_return,true);assert.equal(c.rolled_back,true);assert.equal(c.first_in_fresh_backend,true);assert.equal(c.application_calls_before_dispatch,0);assert.equal(c.generation.ok,false);assert.equal(c.generation.code,'57014');
 assert.deepEqual(p.helper_installations,[{variant:'candidate',source_sha256:HELPER,authority_unchanged:true}]);
 assert.deepEqual(r.data_reuse_body_installations.at(-1).expected.map(x=>x.source),CURRENT);
 assert.deepEqual(r.lock_acquisition_FK,{deferred:false,validated:true,deferrable:false,foreign_key:true,source_columns:true,target_columns:true,source_relation:true,target_relation:true});
 assert.equal(Object.keys(r.source_seals).length,162);assert.deepEqual(r.pin_batch_cases,{});
 assert.equal(outcome.current_cancellation_stack_or_stage_observed,false);assert.equal(outcome.performance_or_semantic_security_acceptance,false);assert.equal(outcome.prior_eeca_context_not_relabeled,true);
 return{receipt:FAILED_PATH,receipt_sha256:FAILED_SHA,observed_at:r.observed_at,result:'failed',normal_process_exit:1,
  current_helper_sha256:HELPER,current_GEN_sha256:CURRENT[2],one_first_MCP_large57014:true,
  remaining_seven_and_all_later_acceptance_unreached:true,current_cancelled_subphase:'unknown',
  prior_eeca_context_not_relabeled:true,performance_acceptance:false,replayed:false};
}
export function admitRecordedSource(name,expected,bytes){
 const actual=sha(bytes);
 if(name===ENTRY){assert.equal(expected,ARMED);assert([ARMED,CLOSED].includes(actual));}
 else assert.equal(actual,expected);
}
export async function admitCarry(root,reader=readBounded){
 const earlier=await admitEarlier(root,reader),raw=await reader(path.join(root,FAILED_PATH)),safe=await reader(path.join(root,OUTCOME));assert.equal(sha(raw),FAILED_SHA);assert.equal(sha(safe),OUTCOME_SHA);
 const r=JSON.parse(raw.toString('utf8')),evidence=validateFailed(r,JSON.parse(safe.toString('utf8')));
 for(const[name,expected]of Object.entries(r.source_seals)){
  assert(!path.isAbsolute(name)&&!name.split(/[\\/]/u).includes('..'));admitRecordedSource(name,expected,await reader(path.join(root,name)));
 }
 return{...earlier,evidence:{...earlier.evidence,failed_pinbatch374:evidence}};
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
