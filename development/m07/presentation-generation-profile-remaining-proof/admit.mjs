/** Dated completed scope admission only; no old command, claim or auth result replay. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {readBounded}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-lock-source-edge-rls-proof/admit.mjs';
import {sha}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-lock-source-proof/proof.mjs';
import {admitCarry as parentCarry,freshCarry,assertSevenBindings,ADMISSION_READY}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-generation-scalar-full-proof/admit.mjs';
export{freshCarry,assertSevenBindings,ADMISSION_READY};
export const REFS={
 raw:{path:'tracking/evidence/m07/presentation-generation-canonical-profile-full-proof/2026-11-03T09-36-23.937Z-48ed954a.json',sha256:'599527b663a20a5a4e1e66c34a89c41078ca5b87c0998f96f89c546bbc48e721'},
 audit:{path:'tracking/evidence/m07/presentation-generation-canonical-profile-full-proof/Root-48ed954a-postrun-audit.json',sha256:'bf1c991bdef2363629084499e3cc006253a5b1f53d839d81812061f8666601f9'},
 supplement:{path:'tracking/evidence/m07/presentation-generation-canonical-profile-full-proof/Root-48ed954a-completed-scope-supplement.json',sha256:'158cbbc9a7a867d0fd1cc3701a7f7ec5e39792cc953f9be81813582879251678'},
 outcome:{path:'tracking/evidence/m07/presentation-generation-canonical-profile-full-proof/48ed954a-outcome.json',sha256:'7e802b88b42dbcb1d92ab366b19eca36c7148f8fa114c538aa20c9dc385ea018'}
};
const RUN='48ed954a-d841-4c56-8339-c3a28248867c';
const ENTRY='development/m07/presentation-generation-canonical-profile-full-proof/entry.mjs';
const ARMED='35a394b40a6c416d056b032a9107c62f9e5eac7f14e43f3d7a6b2fc8aa445782';
const CLOSED='b142d757016293048d3ecfb47b2b6cf51775ed4a918976bedf060e6185736177';
const yes=(value,keys)=>{for(const key of keys)assert.equal(value[key],true,key);};

export function validateCompleted(r,a,s,o){
 for(const value of[r,a,s,o])assert.equal(value.run_id,RUN);
 assert.equal(r.result,'failed');assert.equal(a.normal_process_exit,1);assert.equal(o.normal_process_exit,1);
 assert.equal(r.checkpoint,'combined-old-focused-cases');assert.equal(a.actual_receipt.sha256,REFS.raw.sha256);
 assert.equal(s.actual_receipt.sha256,REFS.raw.sha256);assert.equal(Object.keys(r.source_seals).length,220);
 assert.equal(a.runtime_source_seals_verified,220);assert.equal(a.installation_count,15);
 yes(a,['actual_and_private_executed_source_hashes_equal','six_body_full_authority_and_actual_sources_verified_every_install',
  'public_validator_full_identity_unchanged','all_four_candidate_calls_normal_queued_within8s',
  'completed_call_and_projection_full_baselines_restored','owned_default_command_preserved_only_jit_off_appended',
  'independent_successful_daemon_label_inventories_empty','fresh_shared_lock_absent']);
 assert.equal(a.final_in_callback_original7_restore_reached,false);
 const g=r.combined_generation;yes(g,['actual_first_whole_generation_matrix_completed','review_and_snapshot_contract_equalities_completed','missing_selected_frame_blocking_equal']);
 assert.equal(g.first_calls.length,8);assert.equal(g.projections.length,16);
 assert.deepEqual(g.first_calls.map(x=>[x.variant,x.mode,x.label]),[
  ['candidate','mcp','large'],['old','api','control'],['old','api','large'],['old','mcp','control'],['old','mcp','large'],
  ['candidate','api','control'],['candidate','api','large'],['candidate','mcp','control']]);
 for(const row of g.first_calls){yes(row,['normal_return','rolled_back','full_baseline_restored']);
  if(row.variant==='candidate'){assert.equal(row.generation.ok,true);assert(row.generation.duration_ms<8000);}
  else assert(row.generation.ok||row.generation.code==='57014');
 }
 for(const row of g.projections){yes(row,['normal_return','rolled_back','full_baseline_restored']);assert.equal(row.result.ok,true);assert(row.result.duration_ms<8000);}
 assert.equal(g.missing_selected_frame.length,2);
 for(const row of g.missing_selected_frame){yes(row,['normal_return','rolled_back','full_baseline_restored']);assert.equal(row.snapshot.ok,true);assert.equal(row.snapshot.can_generate,false);assert(row.snapshot.blocking_codes.includes('FRAME_UNAVAILABLE'));}
 assert.equal(g.missing_selected_frame[0].snapshot.contract_hash,g.missing_selected_frame[1].snapshot.contract_hash);
 const h=r.pool_helper_proof;yes(h,['fresh_changed_helper','all_twelve_NOWAIT_archived_FK_workspace_fence_membership_capability_expiry_completed']);
 assert.equal(h.lock_or_security_acceptance_carried,false);assert.equal(h.helper_source_sha256,'aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3');
 for(const key of['all_twelve','archived_reference'])yes(h[key],['normal_return','rolled_back','full_baseline_restored']);
 assert.equal(h.all_twelve.selected_rows,150);assert.equal(h.all_twelve.held_rows,150);assert.equal(h.all_twelve.held.relations.length,12);assert.equal(h.all_twelve.held.negatives.length,8);
 yes(h.cross_workspace,['normal_return','rolled_back']);yes(h.workspace_fence,['actual_distinct_pid_wait','normal_public_mutation_return','writer_rolled_back']);
 assert.deepEqual(h.authority.map(x=>x.case),['membership','capability','expiry']);
 for(const row of h.authority){yes(row,['actual_relation_wait','expected_denial']);assert.equal(row.error.sqlstate,'P0001');assert.equal(row.error.application_code,'RESOURCE_NOT_FOUND');if(row.case==='expiry')assert.equal(row.database_clock_expired,true);else yes(row,['authority_changed','authority_restored']);}
 yes(s,['fresh_AA_all12_NOWAIT_archived_FK_crossworkspace_workspace_fence_and_three_authority_cases_passed','missing_selected_frame_blocking_old_candidate_equality_passed']);
 assert.equal(s.selected_rows,150);assert.equal(s.held_rows,150);assert.equal(s.old_raw_general_denials_source_races_candidate_remaining_and_final7_restore_complete,false);
 const pin=r.pin_batch_cases.old;assert.equal(pin.completed,true);assert.equal(pin.authority_or_clock_cache,false);assert.deepEqual(pin.cases.map(x=>x.case),['membership','capability','expiry']);
 for(const row of pin.cases){yes(row,['normal_SQL_return','actual_pin_INSERT_wait','barrier_released','sender_rolled_back','completed','fresh_authority_denial_observed','full_baseline_restored']);if(row.case==='expiry')assert.equal(row.database_clock_expired,true);else yes(row,['authority_changed','authority_restored']);}
 assert.equal(r.raw_authority_cases.old.completed,false);assert.equal(r.raw_authority_cases.old.cases.length,1);assert.equal(r.raw_authority_cases.old.cases[0].name,'valid_one');assert.equal(r.raw_authority_cases.old.cases[0].error.sqlstate,'42601');
 assert.deepEqual(Object.keys(g.security),[]);assert.deepEqual(Object.keys(g.races),[]);
 yes(r,['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','independent_successful_daemon_label_inventories_empty']);
 assert.equal(r.canonical_planner_profile.backend_observations.length,56);
 for(const row of r.canonical_planner_profile.backend_observations){assert.equal(row.settings.jit.setting,'off');assert.equal(row.settings.jit.reset_val,'off');assert.equal(row.settings.jit.source,'command line');}
 return{run_id:RUN,observed_at:r.observed_at,references:REFS,matching_frozen_seven_graph:true,
  completed_eight_first_and_sixteen_projections:true,completed_AA_twelve_150_plus_eight_FK_RC_authority:true,
  completed_missing_frame_equality:true,completed_old_pin_three:true,
  old_pin:globalThis.structuredClone(pin),executed_in_current_runtime:false,
  old_data_and_assignment_recomputed_for_fresh_UUID_hash_comparisons:true,
  remaining_security_and_final_restore_not_carried:true,production_or_complete_security_acceptance:false};
}

export async function completedCarry(root,reader=readBounded){
 const values={};for(const[key,ref]of Object.entries(REFS)){const raw=await reader(path.join(root,ref.path));assert.equal(sha(raw),ref.sha256);values[key]=JSON.parse(raw);}
 for(const[name,digest]of Object.entries(values.raw.source_seals)){
  const actual=sha(await reader(path.join(root,name)));
  if(name===ENTRY){assert.equal(digest,ARMED);assert([ARMED,CLOSED].includes(actual));}
  else assert.equal(actual,digest,name);
 }
 return validateCompleted(values.raw,values.audit,values.supplement,values.outcome);
}

export async function admitCarry(root){return{...await parentCarry(root),completed48:await completedCarry(root)};}

export function applyCompletedScopes(ctx,admitted){
 assertSevenBindings(ctx.bindings);assert.equal(admitted.run_id,RUN);assert.equal(admitted.executed_in_current_runtime,false);
 assert.deepEqual(admitted.references,REFS);
 ctx.report.remaining_scope_continuation=globalThis.structuredClone(admitted);
 Object.assign(ctx.report.combined_generation,{
  actual_first_whole_generation_matrix_completed:true,review_and_snapshot_contract_equalities_completed:true,
  missing_selected_frame_blocking_equal:true,completion_flags_refer_to_dated_verified_prefix:true,
  completed_prefix_run_id:RUN,first_calls_executed_in_current_runtime:0,component_projections_executed_in_current_runtime:0,
  changed_helper_security_must_run_fresh:false,matching_graph_AA_security_completed_in_dated_prefix:true});
 ctx.report.pin_batch_cases.old={...globalThis.structuredClone(admitted.old_pin),evidence_run_id:RUN,executed_in_current_runtime:false};
}
