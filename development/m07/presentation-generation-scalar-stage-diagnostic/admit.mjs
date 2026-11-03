/** Current7 first-failure admission, never a timing/security acceptance claim. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {readBounded}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-lock-source-edge-rls-proof/admit.mjs';
import {sha}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-lock-source-proof/proof.mjs';
import {firstPair,qualifies}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-lock-source-uuid-proof/fixture.mjs';
import {admitCarry as earlierCarry,assertSevenBindings}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-generation-scalar-full-proof/admit.mjs';
export {assertSevenBindings};
export const FAILED_PATH='tracking/evidence/m07/presentation-generation-scalar-full-proof/2026-11-03T08-29-24.099Z-c024137f.json';
export const FAILED_SHA='c1a320db56836dd263a76ee0a0f3c50be656cc7394436cd40ae4a5ba29d4a391';
const OUTCOME='tracking/evidence/m07/presentation-generation-scalar-full-proof/c024137f-outcome.json';
const OUTCOME_SHA='1b7294cacec0b4d8806ff25903cc7c2f7bf20e4745f35c600dc243776177b75e';
const ENTRY='development/m07/presentation-generation-scalar-full-proof/entry.mjs';
const ARMED='738e0c2078b7661882f6789734861d0a418be810a5ac54082f3613330cace314';
const CLOSED='984e50c42a7e942e7b15cb852a4be6d71b4095f40759fe9e42ddfb1d4bce164a';
const CANONICAL=['4d46151993a60d8c6ac9d36e48781fee34c12c3e1dede727ac1ed4d31a953ab7','f0815e014144f1345b4679d96114aab6b358d95df317e3cfe6ac6b59989813cb','b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08','ed4a3469971fa410078b546b13aa0a875b4867efdda4b134dc729563dd887187','c68de52a4ede0ec6401aa05e0f40b5932905dd8dc8c1c72149c9f95c51a23aeb','5eb6c1272a78a4ca821569082c54d2b1ce434516585c8eac533c29ec1c445ccc'];
const CURRENT=['0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd','c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10','af486a7217ed5ddafea5d98dc2979d928a8e9ba675862ef0960c2930b362b198','f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5','b763cd502ed70c49f7d9d07106397bd6c774a6c00d87322f7e0954f25f1ac4ad','8455eeb4094d74a11e487627711f237192c9b591fdf61d1b54b9114bedd487ab'];
const INSTRUMENTED_FOUR=['234cec65947a522b488c679cdc3eed9fec662394f80998626f31fba2d90dc72c',CURRENT[1],'5b0f389300a86b9cfa0b39e182eaca49f5bac81566e0bb72be1caa152faecca1',CURRENT[3]];
const VALIDATOR='public.eps_validate_own_oauth_session';
export function validateFailed(r,o){
 assert.equal(r.run_id,'c024137f-e397-4a26-a5f0-8be9236aff38');assert.equal(o.run_id,r.run_id);
 assert.equal(r.result,'failed');assert.equal(o.normal_process_exit,1);assert.equal(o.actual_receipt.sha256,FAILED_SHA);
 assert.equal(r.checkpoint,'combined-first-candidate-mcp-large');assert.equal(r.cloud_called,false);assert.equal(r.provider_called,false);
 assert.equal(o.current_cancellation_stack_or_stage,'unobserved');assert.equal(o.prior_F540_English_context_not_relabeled,true);
 assert.equal(o.final_original_seven_function_installation_record_present,false);assert.equal(o.catalogue_prosrc_exclusions,7);
 const d=r.combined_generation;assert.equal(d.catalogue_prosrc_exclusions,7);assert.equal(d.first_calls.length,1);assert.equal(d.projections.length,0);
 assert.notEqual(d.actual_first_whole_generation_matrix_completed,true);assert.notEqual(d.original4107_and_all_six_old_bodies_restored,true);
 const c=d.first_calls[0];assert.equal(c.variant,'candidate');assert.equal(c.mode,'mcp');assert.equal(c.label,'large');
 assert.equal(c.first_in_fresh_backend,true);assert.equal(c.application_calls_before_dispatch,0);assert.equal(c.normal_return,true);assert.equal(c.rolled_back,true);
 assert.deepEqual(Object.keys(c.generation).sort(),['code','duration_ms','ok','operation']);assert.equal(c.generation.ok,false);assert.equal(c.generation.code,'57014');assert.equal(c.generation.operation,'generate');
 const installs=r.data_reuse_body_installations;assert.equal(installs.length,2);
 for(const[i,expected]of[[0,CANONICAL],[1,CURRENT]]){
  const x=installs[i];assert.equal(x.normal_return,true);assert.equal(x.public_validator_unchanged,true);assert.deepEqual(x.expected.map(v=>v.source),expected);
  for(const item of x.expected){assert.equal(x.actual[item.name].source,item.source);assert.deepEqual(x.actual[item.name].authority,installs[0].actual[item.name].authority);}
  assert.deepEqual(x.actual[VALIDATOR],installs[0].actual[VALIDATOR]);assert.equal(x.actual[VALIDATOR].source,'9fe44accb3998d924bb0f453c721a33f5603f20e4c245abbf0e46807561891f6');
 }
 assert.deepEqual(d.helper_installations,[{variant:'candidate',source_sha256:'aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3',authority_unchanged:true}]);
 for(const key of['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','independent_successful_daemon_label_inventories_empty'])assert.equal(r[key],true);
 assert.equal(Object.keys(r.source_seals).length,212);
 return{receipt:FAILED_PATH,receipt_sha256:FAILED_SHA,outcome:OUTCOME,outcome_sha256:OUTCOME_SHA,observed_at:r.observed_at,
  normal_process_exit:1,application_result:'failed57014',current_cancelled_stage:'unknown',previous_F540_context_not_relabeled:true,
  candidate_six_sources_full_authority_and_public_validator_verified:true,helperAA_verified_separately:true,
  final_in_callback_original_seven_restore:'unreached',outer_original_database_and_owned_cleanup:'passed',
  all_later_generation_semantic_lock_authority_scopes_unreached:true,replayed:false};
}
export function admitRecordedSource(name,expected,bytes){
 if(name===ENTRY){assert.equal(expected,ARMED);assert([ARMED,CLOSED].includes(sha(bytes)));}else assert.equal(sha(bytes),expected);
}
export async function admitCarry(root,reader=readBounded){
 const earlier=await earlierCarry(root,reader),raw=await reader(path.join(root,FAILED_PATH)),safe=await reader(path.join(root,OUTCOME));
 assert.equal(sha(raw),FAILED_SHA);assert.equal(sha(safe),OUTCOME_SHA);const r=JSON.parse(raw.toString('utf8')),evidence=validateFailed(r,JSON.parse(safe.toString('utf8')));
 for(const[name,expected]of Object.entries(r.source_seals)){assert(!path.isAbsolute(name)&&!name.split(/[\\/]/u).includes('..'));admitRecordedSource(name,expected,await reader(path.join(root,name)));}
 return{...earlier,evidence:{...earlier.evidence,current7_first_c024:evidence}};
}
export function freshCarry(ctx,admitted){
 const r=admitted.securityReceipt;assertSevenBindings(ctx.bindings);
 for(const key of['metadata_sha256','migration_sha256','functional_sha256','image_id'])assert.equal(ctx.report[key],r[key]);
 const counts=b=>Object.entries(b.tables).map(([name,row])=>[name,row.count]).sort(([a],[b])=>a<b?-1:a>b?1:0);
 assert.deepEqual(counts(ctx.baseline),counts(r.pool_helper_proof.fresh_baseline));assert.equal(ctx.baseline.ready_versions,13);assert.equal(ctx.baseline.pins,60);assert.equal(ctx.baseline.reason_nonnull_rows,1);
 const q=ctx.report.fixture_uuid_qualification,pair=firstPair(ctx.runId);assert.equal(qualifies(ctx.runId),true);assert.equal(q.slot_sha256,sha(pair.slot.id));assert.equal(q.pool_sha256,sha(pair.pool.id));
 assert.equal(q.selection_before_database_or_claim,true);assert.equal(q.outcome_or_timing_observed,false);assert.equal(q.source_rows_or_SQL_changed,false);assert.equal(q.attempt_cap,4096);assert(Number.isInteger(q.attempt_count)&&q.attempt_count>=1&&q.attempt_count<=4096);assert.equal(q.rejected_namespace_count,q.attempt_count-1);
 assert.equal(ctx.bindings.baseSha,'280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4');assert.equal(ctx.bindings.candidateSha,'aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3');
 assert.deepEqual(ctx.bindings.afterBodies.map(x=>x.sha),INSTRUMENTED_FOUR);
 assert.deepEqual(ctx.bindings.stageInstrumentation.map(x=>x.current_candidate_body_sha256),CURRENT.slice(0,4));
 for(const item of ctx.bindings.stageInstrumentation){assert.equal(item.business_SQL_inverse_byte_equal,true);assert.equal(item.line_count_equal,true);}
 return{...admitted.evidence,fresh_fixture_counts_equal:true,cross_run_business_hash_equality_claimed:false,
  current_seven_sources_verified:true,public_validator_unchanged:true,instrumentation_overhead_present:true,
  changed_scalar_generation_security_or_performance_carried:false,all_full_generation_scopes_remain_required:true};
}
