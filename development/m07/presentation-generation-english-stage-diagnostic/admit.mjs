/** Failed c20 full-proof admission only; its interrupted stage stays unknown. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {admitCarry as admitEarlier}from '../presentation-generation-english-companion-first-proof/admit.mjs';
import {freshCarry as admitFourStage}from '../presentation-generation-raw-companion-stage-diagnostic/admit.mjs';
import {assertEnglishBindings}from '../presentation-generation-english-full-proof/admit.mjs';
import {readBounded}from '../presentation-lock-source-edge-rls-proof/admit.mjs';
export {assertEnglishBindings};
export const FAILED_PATH='tracking/evidence/m07/presentation-generation-english-full-proof/2026-11-03T06-42-50.816Z-c20a8614.json';
export const FAILED_SHA='386db57c4010ea547d03648f62d5edb9083478b3f4500c69a45b76115777e1fc';
const OUTCOME='tracking/evidence/m07/presentation-generation-english-full-proof/c20a8614-outcome.json';
const OUTCOME_SHA='d90d9c48c52caa41b23f57db863ed61b852432d67fd3a0af223621385755b3c8';
const ENTRY='development/m07/presentation-generation-english-full-proof/entry.mjs';
const ARMED='c50d34b3400a13b4c7d09349fc69e78a6850729ec3576e3c30794f9f292e3159';
const CLOSED='f6e4f892bc55724c88e6109ca7cb1a9d99d28fecdc107293d897eb857a91c8fc';
const BEFORE=['4d46151993a60d8c6ac9d36e48781fee34c12c3e1dede727ac1ed4d31a953ab7','f0815e014144f1345b4679d96114aab6b358d95df317e3cfe6ac6b59989813cb','b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08','ed4a3469971fa410078b546b13aa0a875b4867efdda4b134dc729563dd887187','c68de52a4ede0ec6401aa05e0f40b5932905dd8dc8c1c72149c9f95c51a23aeb'];
const AFTER=['0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd','c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10','41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d','f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5','b763cd502ed70c49f7d9d07106397bd6c774a6c00d87322f7e0954f25f1ac4ad'];
export function validateFailed(r,outcome){
 assert.equal(r.run_id,'c20a8614-6d63-4128-8bdb-a0b78881f30c');assert.equal(r.result,'failed');assert.equal(r.checkpoint,'combined-first-candidate-mcp-large');
 assert.equal(outcome.normal_process_exit,1);assert.equal(outcome.actual_receipt.sha256,FAILED_SHA);
 assert.equal(outcome.current_cancellation_stack_or_stage,'unobserved');assert.equal(outcome.prior9ed_English_context_not_relabeled,true);
 assert.equal(outcome.final_canonical_installation_record_present,false);assert.equal(outcome.source_seal_count,183);
 assert.equal(r.cloud_called,false);assert.equal(r.provider_called,false);
 for(const key of['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','independent_successful_daemon_label_inventories_empty'])assert.equal(r[key],true);
 const d=r.combined_generation;assert.equal(d.catalogue_prosrc_exclusions,6);assert.equal(d.first_calls.length,1);assert.equal(d.projections.length,0);
 assert.notEqual(d.actual_first_whole_generation_matrix_completed,true);assert.notEqual(d.original4107_and_all_five_old_bodies_restored,true);
 const c=d.first_calls[0];assert.equal(c.variant,'candidate');assert.equal(c.mode,'mcp');assert.equal(c.label,'large');
 assert.equal(c.first_in_fresh_backend,true);assert.equal(c.application_calls_before_dispatch,0);assert.equal(c.normal_return,true);assert.equal(c.rolled_back,true);
 assert.deepEqual(Object.keys(c.generation).sort(),['code','duration_ms','ok','operation']);assert.equal(c.generation.ok,false);assert.equal(c.generation.code,'57014');assert.equal(c.generation.operation,'generate');
 assert.deepEqual(d.helper_installations,[{variant:'candidate',source_sha256:'aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3',authority_unchanged:true}]);
 const installs=r.data_reuse_body_installations;assert.equal(installs.length,2);
 for(const[i,expected]of[[0,BEFORE],[1,AFTER]]){const x=installs[i];assert.equal(x.normal_return,true);assert.deepEqual(x.expected.map(v=>v.source),expected);for(const item of x.expected){assert.equal(x.actual[item.name].source,item.source);assert.deepEqual(x.actual[item.name].authority,installs[0].actual[item.name].authority);}}
 assert.equal(Object.keys(r.source_seals).length,183);
 return{receipt:FAILED_PATH,receipt_sha256:FAILED_SHA,observed_at:r.observed_at,normal_process_exit:1,application_result:'failed57014',
  first_candidate_MCP_large_only:true,interrupted_current_stage:'unknown',previous_9ed_stage_not_relabeled:true,
  candidate_five_bodies_and_separate_AA_full_authority_verified:true,in_callback_final_six_restore:'unreached',outer_original_database_and_resource_cleanup:true,
  all_later_matrix_semantic_lock_authority_and_performance_scopes_unreached:true,replayed:false};
}
export function admitRecordedSource(name,expected,bytes){const actual=sha(bytes);if(name===ENTRY){assert.equal(expected,ARMED);assert([ARMED,CLOSED].includes(actual));}else assert.equal(actual,expected);}
export async function admitCarry(root,reader=readBounded){
 const earlier=await admitEarlier(root,reader),raw=await reader(path.join(root,FAILED_PATH)),safe=await reader(path.join(root,OUTCOME));
 assert.equal(sha(raw),FAILED_SHA);assert.equal(sha(safe),OUTCOME_SHA);const r=JSON.parse(raw.toString('utf8')),evidence=validateFailed(r,JSON.parse(safe.toString('utf8')));
 for(const[name,expected]of Object.entries(r.source_seals)){assert(!path.isAbsolute(name)&&!name.split(/[\\/]/u).includes('..'));admitRecordedSource(name,expected,await reader(path.join(root,name)));}
 return{...earlier,evidence:{...earlier.evidence,failed_full_English_c20:evidence}};
}
export function freshCarry(ctx,admitted){
 const prior=admitFourStage(ctx,admitted);assertEnglishBindings(ctx.bindings);
 return{...prior,current_English_before_after_exact:true,closed_six_prosrc_mask_and_full_authority_required:true,
  English_security_or_performance_carried:false,all_later_full_proofs_still_required:true};
}
