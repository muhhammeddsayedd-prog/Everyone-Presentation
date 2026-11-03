/** Shared dated633 +9ed admission; no prior application/security pass invented. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {admitCarry as admitEarlier}from '../presentation-generation-raw-companion-stage-diagnostic/admit.mjs';
import {freshCarry as admitFive}from '../presentation-generation-raw-companion-first-proof/run.mjs';
import {readBounded}from '../presentation-lock-source-edge-rls-proof/admit.mjs';
export const FAILED_PATH='tracking/evidence/m07/presentation-generation-raw-companion-stage-diagnostic/2026-11-03T06-16-43.493Z-9ed4ca6c.json';
export const FAILED_SHA='9ad492f5e99be482dc3d9d69b35f31d24b0a4b9d4d7759382e96d15b49bd7767';
const OUTCOME='tracking/evidence/m07/presentation-generation-raw-companion-stage-diagnostic/9ed4ca6c-outcome.json';
const OUTCOME_SHA='1b8f89b9ae899836c3a8118fdeaa31590234cd7d28cecd2a629b09e40e44dbda';
const ENTRY='development/m07/presentation-generation-raw-companion-stage-diagnostic/entry.mjs';
const ARMED='70db3c3c7828ff605c83fdacec569cc5e704fb886b936d411f7820e92fcb2029';
const CLOSED='dd741e49957f22d7fa084f41ee8420720e68cb38d9f005d22389dbbe6119ed9b';
const CANONICAL=['4d46151993a60d8c6ac9d36e48781fee34c12c3e1dede727ac1ed4d31a953ab7','f0815e014144f1345b4679d96114aab6b358d95df317e3cfe6ac6b59989813cb','b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08','ed4a3469971fa410078b546b13aa0a875b4867efdda4b134dc729563dd887187'];
const CURRENT=['0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd','c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10','41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d','f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5'];
const INSTRUMENTED=['234cec65947a522b488c679cdc3eed9fec662394f80998626f31fba2d90dc72c',CURRENT[1],'b3bc105e6fb7d14194b04db6dbb5e8bbaad8bad9fe237d276cbde751c112b2a3',CURRENT[3]];
export function validate9ed(r,outcome){
 assert.equal(r.run_id,'9ed4ca6c-b736-4b84-b1af-a4cf67328d83');assert.equal(r.result,'passed');assert.equal(r.checkpoint,'complete');assert.equal(r.cloud_called,false);assert.equal(r.provider_called,false);
 assert.equal(outcome.normal_process_exit,0);assert.equal(outcome.actual_receipt.sha256,FAILED_SHA);assert.equal(outcome.performance_semantic_security_or_production_acceptance,false);
 for(const key of['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','independent_successful_daemon_label_inventories_empty'])assert.equal(r[key],true);
 const d=r.generation_stage_diagnostic,c=d.call;assert.equal(d.scope_only,true);assert.equal(d.single_call_completed,true);assert.equal(d.performance_or_release_acceptance,false);
 assert.equal(c.normal_SQL_return,true);assert.equal(c.rolled_back,true);assert.equal(c.full_fresh_baseline_restored,true);assert.equal(c.first_application_call_in_fresh_backend,true);assert.equal(c.application_calls_before_dispatch,0);assert.equal(c.mode,'mcp');assert.equal(c.profile,'large');assert.equal(c.result.ok,false);assert.equal(c.result.code,'57014');assert.equal(c.performance_acceptance,false);
 assert.equal(c.cancellation.stage,'english_companion_capture');assert(c.cancellation.allowlisted_frames.some(x=>x.function==='eps.capture_presentation_video_english_transcripts'&&x.line===12));assert(c.cancellation.allowlisted_frames.some(x=>x.function==='eps.capture_presentation_video_transcripts'&&x.line===55));
 assert.deepEqual(d.instrumentation.map(x=>x.current_candidate_body_sha256),CURRENT);
 const installs=r.data_reuse_body_installations;assert.equal(installs.length,3);
 for(const[i,expected]of[[0,CANONICAL],[1,INSTRUMENTED],[2,CANONICAL]]){const x=installs[i];assert.equal(x.normal_return,true);assert.deepEqual(x.expected.map(v=>v.source),expected);for(const item of x.expected){assert.equal(x.actual[item.name].source,item.source);assert.deepEqual(x.actual[item.name].authority,installs[0].actual[item.name].authority);}}
 assert.equal(d.original4107_and_four_old_bodies_restored,true);assert.equal(d.original_config_and_full_baseline_restored,true);assert.equal(Object.keys(r.source_seals).length,187);
 return{receipt:FAILED_PATH,receipt_sha256:FAILED_SHA,observed_at:r.observed_at,diagnostic_result:'passed',normal_process_exit:0,application_result:'failed57014',
  current_observed_stage:'english_companion_capture',interrupted_English_line:12,raw_caller_line:55,English_rows_or_INSERT_count_observed:false,dominant_cost_or_performance_proven:false,
  candidate_index1_and_final_index2_sources_and_full_authority_verified:true,all_matrix_semantic_lock_and_authority_proofs_still_required:true,replayed:false};
}
export function admitRecordedSource(name,expected,bytes){const actual=sha(bytes);if(name===ENTRY){assert.equal(expected,ARMED);assert([ARMED,CLOSED].includes(actual));}else assert.equal(actual,expected);}
export async function admitCarry(root,reader=readBounded){
 const earlier=await admitEarlier(root,reader),raw=await reader(path.join(root,FAILED_PATH)),safe=await reader(path.join(root,OUTCOME));assert.equal(sha(raw),FAILED_SHA);assert.equal(sha(safe),OUTCOME_SHA);const r=JSON.parse(raw.toString('utf8')),evidence=validate9ed(r,JSON.parse(safe.toString('utf8')));
 for(const[name,expected]of Object.entries(r.source_seals)){assert(!path.isAbsolute(name)&&!name.split(/[\\/]/u).includes('..'));admitRecordedSource(name,expected,await reader(path.join(root,name)));}
 return{...earlier,evidence:{...earlier.evidence,failed_English_stage9ed:evidence}};
}
export function freshCarry(ctx,admitted){
 const prior=admitFive(ctx,admitted);
 for(const[key,expected]of[['englishBefore','c68de52a4ede0ec6401aa05e0f40b5932905dd8dc8c1c72149c9f95c51a23aeb'],['englishAfter','b763cd502ed70c49f7d9d07106397bd6c774a6c00d87322f7e0954f25f1ac4ad']]){const r=ctx.bindings[key];assert.equal(r.name,'eps.capture_presentation_video_english_transcripts');assert.equal(r.sha,expected);assert.equal(sha(r.sql),r.definition_sha256);}
 return{...prior,English_before_after_source_bindings_verified:true,current_six_function_bindings_verified:true,English_security_or_performance_carried:false,all_later_proofs_still_required:true};
}
