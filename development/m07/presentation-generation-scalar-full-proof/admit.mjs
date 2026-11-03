/** Existing actual evidence only; no generation or hosted acceptance is inferred. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {readBounded}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-lock-source-edge-rls-proof/admit.mjs';
import {sha}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-lock-source-proof/proof.mjs';
import {admitCarry as earlierCarry,freshCarry as earlierFresh,assertEnglishBindings}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-generation-slide-batch-full-proof/admit.mjs';

export const SCALAR_PARITY_REF={
 receipt:{path:'tracking/evidence/m07/presentation-mcp-scalar-owned-proof/2026-11-03T08-15-55.999Z-4e6f2d50.json',sha256:'eba50d765a6a0c37e90477ab34223f1514c79f272aea7b8675cca72d539c6e35'},
 outcome:{path:'tracking/evidence/m07/presentation-mcp-scalar-owned-proof/4e6f2d50-outcome.json',sha256:'c8dc25d78bc3425d7cf3c0c4394d5e5162ba38b7314c8ef909588e0bb361f461'},
 audit:{path:'tracking/evidence/m07/presentation-mcp-scalar-owned-proof/Root-4e6f2d50-postrun-audit.json',sha256:'3295c91e4a4fc62a2b6e30b9d1b89463c67c84f5c6dedd8fdeda78be900f480d'},
 entry_closure:{path:'development/m07/presentation-mcp-scalar-owned-proof/entry.mjs',armed_sha256:'1673792eac9ea6b46389a107d77d195f32436efc77e7c1fab63ad3ca486d06d7',closed_sha256:'4127de8dc8343ab6b97a28871bf508c07d7b6d7057dccecb30db0e0f2bff605c'}
};
export const ADMISSION_READY=SCALAR_PARITY_REF!==null;
const BINDINGS={"scalarBefore":{"name":"eps.mcp_token_permits_capability","sha":"5eb6c1272a78a4ca821569082c54d2b1ce434516585c8eac533c29ec1c445ccc","definition_sha256":"3aa105d4df15c7eadab2e528c8b2bddf9e1e2b64eae1064427e8e271f0bed865"},"scalarAfter":{"name":"eps.mcp_token_permits_capability","sha":"8455eeb4094d74a11e487627711f237192c9b591fdf61d1b54b9114bedd487ab","definition_sha256":"84db2c21ed0eececbaabc9cc701b253bfe9e388e31928a8ecbb1d3f644aa140d"},"publicValidator":{"name":"public.eps_validate_own_oauth_session","sha":"9fe44accb3998d924bb0f453c721a33f5603f20e4c245abbf0e46807561891f6","definition_sha256":"29d78b1d7ee99138ce4fda76632c2674aeef3b3f442464904569a36f31b3388b"}};
const SLIDE_RAW='tracking/evidence/m07/presentation-generation-slide-batch-full-proof/2026-11-03T07-37-49.745Z-1267c728.json';
const SLIDE_SHA='38645f7fb7787c745837bab1c07907cb48323061bf842e014ee8f4019fe559d1';
const SLIDE_OUTCOME='tracking/evidence/m07/presentation-generation-slide-batch-full-proof/1267c728-outcome.json';
const OUTCOME_SHA='b9fdc91ff7651c2a202cdc6acf1fab68ad5b0fe8de2d645a6b549a267e615d50';
const SLIDE_ENTRY='development/m07/presentation-generation-slide-batch-full-proof/entry.mjs';
const SLIDE_ARMED='48e7f48777bd398c0975936ca5e453dee657c1ef9393d839f3a2caa663661aa3';
const SLIDE_CLOSED='4ffb0305768a3bd7899174b9bd47927c39367b59c05f0a0d8b73c887e2e0e5df';

export function assertSevenBindings(bindings){
 assertEnglishBindings(bindings);
 for(const[key,expected]of Object.entries(BINDINGS)){
  const item=bindings[key];assert(item&&Object.getPrototypeOf(item)===Object.prototype);
  assert.deepEqual(Object.keys(item).sort(),['definition_sha256','name','sha','sql']);
  for(const name of['name','sha','definition_sha256'])assert.equal(item[name],expected[name]);
  assert.equal(sha(item.sql),expected.definition_sha256);
  const match=/ AS (\$[a-zA-Z0-9_]*\$)([\s\S]*)\1;$/u.exec(item.sql);
  assert(match);assert.equal(sha(match[2]),expected.sha);
 }
 assert.equal(Object.keys(BINDINGS).length,3);
}

export function freshCarry(ctx,admitted){
 assertSevenBindings(ctx.bindings);
 const evidence=earlierFresh(ctx,admitted);
 return{...evidence,scalar_parity_prerequisite:admitted.scalarParity,
  changed_scalar_generation_security_or_performance_carried:false,
  all_full_generation_and_authority_scopes_required_fresh:true};
}

export function validateSlideFailure(r,o){
 assert.equal(r.run_id,'1267c728-b253-45c6-9756-9e9cecdfcf94');
 assert.equal(r.result,'failed');assert.equal(o.result,'failed');assert.equal(o.normal_process_exit,1);
 assert.equal(o.actual_receipt.sha256,SLIDE_SHA);assert.equal(Object.keys(r.source_seals).length,197);
 const call=o.first_and_only_application_call;
 assert.equal(call.normal_return,true);assert.equal(call.rolled_back,true);assert.equal(call.application_calls_before_dispatch,0);
 assert.equal(call.first_in_fresh_backend,true);assert.equal(call.mode,'mcp');assert.equal(call.label,'large');
 assert.equal(call.generation.ok,false);assert.equal(call.generation.code,'57014');
 assert.equal(o.installation_count,2);assert.equal(o.final_canonical_installation_record_present,false);
 assert.equal(o.actual_candidate_installation.all_five_full_authority_records_equal_initial_canonical,true);
 assert.equal(o.actual_candidate_installation.expected_and_actual_pg_proc_sources_equal[2].source,'af486a7217ed5ddafea5d98dc2979d928a8e9ba675862ef0960c2930b362b198');
 assert.equal(o.current_cancellation_stack_or_stage,'unobserved');
 assert.equal(o.performance_semantic_security_or_production_acceptance,false);
 for(const key of['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','independent_successful_daemon_label_inventories_empty'])assert.equal(r[key],true);
 return{receipt:SLIDE_RAW,receipt_sha256:SLIDE_SHA,outcome:SLIDE_OUTCOME,outcome_sha256:OUTCOME_SHA,
  observed_at:r.observed_at,application_failed57014:true,current_stage:'unobserved',
  in_callback_final_restore_reached:false,remaining_matrix_semantic_lock_and_authority_scopes_unreached:true,
  scalar845_not_executed_by_this_receipt:true,performance_or_security_acceptance:false,replayed:false};
}

export function admitSlideSource(name,expected,bytes){
 if(name===SLIDE_ENTRY){assert.equal(expected,SLIDE_ARMED);assert([SLIDE_ARMED,SLIDE_CLOSED].includes(sha(bytes)));}
 else assert.equal(sha(bytes),expected);
}

export function validateScalarParity(r,o,audit){
 assert(ADMISSION_READY&&SCALAR_PARITY_REF?.receipt,'SCALAR_FULL_PROOF_PARITY_UNBOUND');
 assert.equal(r.run_id,'4e6f2d50-9b0b-4f02-a719-7ab2b66fa4c4');assert.equal(o.run_id,r.run_id);assert.equal(audit.run_id,r.run_id);
 assert.equal(r.result,'passed');assert.equal(o.result,'passed_local_scalar_parity');assert.equal(o.normal_process_exit,0);assert.equal(audit.normal_process_exit,0);
 assert.equal(o.actual_receipt.sha256,SCALAR_PARITY_REF.receipt.sha256);
 assert.equal(audit.actual_receipt.sha256,SCALAR_PARITY_REF.receipt.sha256);
 assert.equal(o.Root_independent_audit.sha256,SCALAR_PARITY_REF.audit.sha256);
 const m=r.mcp_scalar;
 for(const key of['exact_old_new_case_parity','normal_child_return','deterministic_collation_verified',
  'target_function_restored_before_rollback','one_target_prosrc_only','public_validator_unchanged',
  'full_clone_rows_catalogue_roles_rollback_exact','auth_rows_rollback_exact'])assert.equal(m[key],true);
 assert.equal(m.signed_OAuth_or_hosted_acceptance,false);
 assert.equal(m.target_body_sha256,BINDINGS.scalarAfter.sha);
 assert.equal(m.public_validator_body_sha256,BINDINGS.publicValidator.sha);
 assert.equal(m.case_count,m.cases.length);assert.equal(m.case_count,122);
 for(const key of['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released'])assert.equal(r[key],true);
 assert.deepEqual(r.cleanup_inventories,{same_engine_container_inventory_empty:true,same_engine_volume_inventory_empty:true});
 assert.equal(Object.keys(r.source_seals).length,33);assert.equal(audit.source_seals_verified,33);
 for(const key of['all_actual_and_private_executed_source_hashes_equal','normal_private_output_and_public_projection_equal','independent_successful_daemon_label_inventories_empty','fresh_shared_lock_absent'])assert.equal(audit[key],true);
 assert.deepEqual(audit.independent_inventories,[{kind:'ps',normal_exit:0,empty:true},{kind:'volume',normal_exit:0,empty:true}]);
 const preserved=o.actual_preservation_and_cleanup;
 for(const key of['normal_child_return','auth_users_sessions_full_rows_rollback_exact','full_clone_rows_catalogue_global_roles_rollback_exact','all_preexisting_rows_preserved','original_target_data_catalogue_global_roles_unchanged','all_owned_resources_absent','shared_lock_released','independent_same_daemon_container_volume_normal0_empty','fresh_shared_lock_absent'])assert.equal(preserved[key],true);
 assert.equal(o.actual_local_scope.actual_case_rows,122);assert.equal(o.actual_local_scope.exact_old_candidate_pairs,61);
 assert.equal(audit.private_output_case_rows,122);assert.equal(audit.old_candidate_pairs_exact,61);
 assert.equal(o.private_custody.normal_output_sha256,audit.private_output_sha256);assert.equal(o.private_custody.proof_input_sha256,audit.private_proof_input_sha256);
 assert.deepEqual(o.entry_closed_by_Root,SCALAR_PARITY_REF.entry_closure);assert.deepEqual(audit.sole_entry_closed_after_once_run,SCALAR_PARITY_REF.entry_closure);
 assert.equal(o.signed_OAuth_hosted_Auth_MCP_wire_generation_performance_or_production_acceptance,false);
 return{receipt:SCALAR_PARITY_REF.receipt,outcome:SCALAR_PARITY_REF.outcome,audit:SCALAR_PARITY_REF.audit,
  observed_at:r.observed_at,normal_process_exit:0,case_rows:122,exact_old_candidate_pairs:61,
  scope:'owned synthetic rollback claims and current policies; not signed OAuth or hosted acceptance',
  exact_case_parity:true,whole_generation_acceptance:false,performance_acceptance:false};
}

export async function admitCarry(root,reader=readBounded){
 assert(ADMISSION_READY,'SCALAR_FULL_PROOF_PARITY_UNBOUND');
 assert(SCALAR_PARITY_REF?.receipt&&SCALAR_PARITY_REF?.outcome,'SCALAR_FULL_PROOF_PARITY_UNBOUND');
 const earlier=await earlierCarry(root,reader);
 const raw=await reader(path.join(root,SLIDE_RAW)),safe=await reader(path.join(root,SLIDE_OUTCOME));
 assert.equal(sha(raw),SLIDE_SHA);assert.equal(sha(safe),OUTCOME_SHA);
 const slide=JSON.parse(raw.toString('utf8')),failed=validateSlideFailure(slide,JSON.parse(safe.toString('utf8')));
 for(const[name,expected]of Object.entries(slide.source_seals)){
  assert(!path.isAbsolute(name)&&!name.split(/[\\/]/u).includes('..'));
  admitSlideSource(name,expected,await reader(path.join(root,name)));
 }
 const parityBytes=await reader(path.join(root,SCALAR_PARITY_REF.receipt.path)),outcomeBytes=await reader(path.join(root,SCALAR_PARITY_REF.outcome.path)),auditBytes=await reader(path.join(root,SCALAR_PARITY_REF.audit.path));
 assert.equal(sha(parityBytes),SCALAR_PARITY_REF.receipt.sha256);assert.equal(sha(outcomeBytes),SCALAR_PARITY_REF.outcome.sha256);assert.equal(sha(auditBytes),SCALAR_PARITY_REF.audit.sha256);
 const parity=JSON.parse(parityBytes.toString('utf8')),scalarParity=validateScalarParity(parity,JSON.parse(outcomeBytes.toString('utf8')),JSON.parse(auditBytes.toString('utf8')));
 for(const[name,expected]of Object.entries(parity.source_seals)){
  assert(!path.isAbsolute(name)&&!name.split(/[\\/]/u).includes('..'));
  const bytes=await reader(path.join(root,name)),closure=SCALAR_PARITY_REF.entry_closure;
  if(closure&&name===closure.path){assert.equal(expected,closure.armed_sha256);assert([closure.armed_sha256,closure.closed_sha256].includes(sha(bytes)));}
  else assert.equal(sha(bytes),expected);
 }
 return{...earlier,scalarParity,evidence:{...earlier.evidence,failed_slide_first1267:failed,scalar_owned_parity:scalarParity}};
}
