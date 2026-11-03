/** Historical280 prerequisites only; changed-helper acceptance must run fresh. */
import assert from 'node:assert/strict';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {firstPair,qualifies}from '../presentation-lock-source-uuid-proof/fixture.mjs';
import {admitCarry as admitEarlier}from '../presentation-generation-english-stage-diagnostic/admit.mjs';
const BASE='280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4';
const NEW='aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3';
export const BEFORE=['4d46151993a60d8c6ac9d36e48781fee34c12c3e1dede727ac1ed4d31a953ab7','f0815e014144f1345b4679d96114aab6b358d95df317e3cfe6ac6b59989813cb','b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08','ed4a3469971fa410078b546b13aa0a875b4867efdda4b134dc729563dd887187'];
export const AFTER=['0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd','c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10','af486a7217ed5ddafea5d98dc2979d928a8e9ba675862ef0960c2930b362b198','f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5'];
export function freshCarry(ctx,admitted){
 assertEnglishBindings(ctx.bindings);
 const r=admitted.securityReceipt;
 for(const key of['metadata_sha256','migration_sha256','functional_sha256','image_id'])assert.equal(ctx.report[key],r[key]);
 const counts=baseline=>Object.entries(baseline.tables).map(([name,row])=>[name,row.count]).sort(([a],[b])=>a<b?-1:a>b?1:0);
 assert.deepEqual(counts(ctx.baseline),counts(r.pool_helper_proof.fresh_baseline));
 assert.equal(ctx.baseline.ready_versions,13);assert.equal(ctx.baseline.pins,60);assert.equal(ctx.baseline.reason_nonnull_rows,1);
 const q=ctx.report.fixture_uuid_qualification,pair=firstPair(ctx.runId);
 assert.equal(qualifies(ctx.runId),true);assert.equal(q.slot_sha256,sha(pair.slot.id));assert.equal(q.pool_sha256,sha(pair.pool.id));
 assert.equal(q.selection_before_database_or_claim,true);assert.equal(q.outcome_or_timing_observed,false);assert.equal(q.source_rows_or_SQL_changed,false);
 assert.equal(q.attempt_cap,4096);assert(Number.isInteger(q.attempt_count)&&q.attempt_count>=1&&q.attempt_count<=4096);assert.equal(q.rejected_namespace_count,q.attempt_count-1);
 assert.equal(ctx.bindings.baseSha,BASE);assert.equal(ctx.bindings.candidateSha,NEW);
 assert.deepEqual(ctx.bindings.beforeBodies.map(x=>x.sha),BEFORE);assert.deepEqual(ctx.bindings.afterBodies.map(x=>x.sha),AFTER);
 return{...admitted.evidence,fresh_fixture_counts_equal:true,cross_run_business_hash_equality_claimed:false,
  baseline_count_provenance_only:true,old_four_and_candidate_four_compared_fresh:true,
  helper280_scopes_dated_only:true,changed_helper_lock_or_security_carried:false,
  changed_helper_source_sha256:NEW,all_twelve_locksets_and_RC_security_required_fresh:true};
}

export function assertEnglishBindings(bindings){
 for(const[key,expected,definition]of[['englishBefore',"c68de52a4ede0ec6401aa05e0f40b5932905dd8dc8c1c72149c9f95c51a23aeb",'8c26f0bfc9b389ed297d8e2dd6d021876ee607c54959b0caae27246704e7ac03'],['englishAfter',"b763cd502ed70c49f7d9d07106397bd6c774a6c00d87322f7e0954f25f1ac4ad",'95a38067b74c9279541be4627f82cfccc1a93160d01937823fdc250b20b987b0']]){
  const item=bindings[key];assert(item&&Object.getPrototypeOf(item)===Object.prototype);
  assert.deepEqual(Object.keys(item).sort(),['definition_sha256','name','sha','sql']);
  assert.equal(item.name,'eps.capture_presentation_video_english_transcripts');
  assert.equal(item.sha,expected);assert.equal(item.definition_sha256,definition);assert.equal(sha(item.sql),definition);
  const match=/ AS (\$[a-zA-Z0-9_]*\$)([\s\S]*)\1;$/u.exec(item.sql);
  assert(match,'ENGLISH_FULL_BODY_DELIMITER_REQUIRED');assert.equal(sha(match[2]),expected);
 }
}

// Historical validators keep the previous body tuples. Only freshCarry above
// binds GENaf486; no previous diagnostic is relabeled as its execution.
import path from 'node:path';
import {readBounded}from '../presentation-lock-source-edge-rls-proof/admit.mjs';
export const FAILED_PATH='tracking/evidence/m07/presentation-generation-english-stage-diagnostic/2026-11-03T07-03-51.590Z-f540866b.json';
export const FAILED_SHA='2aaed820518499fabdf2f81bec41fe032e57f36e213326e05ea05a17814d4242';
const OUTCOME='tracking/evidence/m07/presentation-generation-english-stage-diagnostic/f540866b-outcome.json';
const OUTCOME_SHA='0cfc4ec480c612cea5e31d433bd0590909053916913e966e028718c1a321c1c5';
const ENTRY='development/m07/presentation-generation-english-stage-diagnostic/entry.mjs';
const ARMED='94a6ae695fd4af81ecf037c1c12c62b881e159aca26255ff3cd39a90ef7314e4';
const CLOSED='1c7e89c1800165832c8e20896ff1cbe60777d12c2041012b4abe661bfd5bef3c';
const HISTORICAL_CANONICAL=['4d46151993a60d8c6ac9d36e48781fee34c12c3e1dede727ac1ed4d31a953ab7','f0815e014144f1345b4679d96114aab6b358d95df317e3cfe6ac6b59989813cb','b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08','ed4a3469971fa410078b546b13aa0a875b4867efdda4b134dc729563dd887187','c68de52a4ede0ec6401aa05e0f40b5932905dd8dc8c1c72149c9f95c51a23aeb'];
const HISTORICAL_CURRENT=['234cec65947a522b488c679cdc3eed9fec662394f80998626f31fba2d90dc72c','c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10','b3bc105e6fb7d14194b04db6dbb5e8bbaad8bad9fe237d276cbde751c112b2a3','f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5','b763cd502ed70c49f7d9d07106397bd6c774a6c00d87322f7e0954f25f1ac4ad'];
export function validateF540(r,outcome){
 assert.equal(r.run_id,'f540866b-2c78-4b8d-acef-79e815ce7c63');assert.equal(r.result,'passed');assert.equal(r.checkpoint,'complete');assert.equal(r.cloud_called,false);assert.equal(r.provider_called,false);
 assert.equal(outcome.normal_process_exit,0);assert.equal(outcome.actual_receipt.sha256,FAILED_SHA);assert.equal(outcome.performance_semantic_security_or_production_acceptance,false);assert.equal(outcome.English_rows_or_INSERT_count_observed,false);
 for(const key of['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','independent_successful_daemon_label_inventories_empty'])assert.equal(r[key],true);
 const d=r.generation_stage_diagnostic,c=d.call;assert.equal(d.scope_only,true);assert.equal(d.catalogue_prosrc_exclusions,6);assert.equal(d.single_call_completed,true);assert.equal(d.performance_or_release_acceptance,false);
 assert.equal(c.normal_SQL_return,true);assert.equal(c.rolled_back,true);assert.equal(c.full_fresh_baseline_restored,true);assert.equal(c.first_application_call_in_fresh_backend,true);assert.equal(c.application_calls_before_dispatch,0);assert.equal(c.mode,'mcp');assert.equal(c.profile,'large');assert.equal(c.result.ok,false);assert.equal(c.result.code,'57014');
 assert.equal(c.cancellation.stage,'english_companion_capture');assert(c.cancellation.allowlisted_frames.some(x=>x.function==='eps.capture_presentation_video_english_transcripts'&&x.line===12));
 const installs=r.data_reuse_body_installations;assert.equal(installs.length,3);
 for(const[i,expected]of[[0,HISTORICAL_CANONICAL],[1,HISTORICAL_CURRENT],[2,HISTORICAL_CANONICAL]]){const x=installs[i];assert.equal(x.normal_return,true);assert.deepEqual(x.expected.map(v=>v.source),expected);for(const item of x.expected){assert.equal(x.actual[item.name].source,item.source);assert.deepEqual(x.actual[item.name].authority,installs[0].actual[item.name].authority);}}
 assert.equal(d.original4107_and_five_old_bodies_restored,true);assert.equal(d.original_config_and_full_baseline_restored,true);assert.equal(Object.keys(r.source_seals).length,203);
 return{receipt:FAILED_PATH,receipt_sha256:FAILED_SHA,observed_at:r.observed_at,diagnostic_result:'passed',normal_process_exit:0,application_result:'failed57014',current_observed_stage:'english_companion_capture',English_line:12,
  current_slide_GENaf486_not_executed_by_this_receipt:true,English_rows_or_INSERT_count_observed:false,dominant_cost_or_performance_proven:false,candidate_index1_and_restore_index2_all_five_sources_and_full_authority_verified:true,all_fresh_full_proofs_still_required:true,replayed:false};
}
export function admitRecordedSource(name,expected,bytes){const actual=sha(bytes);if(name===ENTRY){assert.equal(expected,ARMED);assert([ARMED,CLOSED].includes(actual));}else assert.equal(actual,expected);}
export async function admitCarry(root,reader=readBounded){
 const earlier=await admitEarlier(root,reader),raw=await reader(path.join(root,FAILED_PATH)),safe=await reader(path.join(root,OUTCOME));assert.equal(sha(raw),FAILED_SHA);assert.equal(sha(safe),OUTCOME_SHA);const r=JSON.parse(raw.toString('utf8')),evidence=validateF540(r,JSON.parse(safe.toString('utf8')));
 for(const[name,expected]of Object.entries(r.source_seals)){assert(!path.isAbsolute(name)&&!name.split(/[\\/]/u).includes('..'));admitRecordedSource(name,expected,await reader(path.join(root,name)));}
 return{...earlier,evidence:{...earlier.evidence,failed_English_stage_f540:evidence}};
}
