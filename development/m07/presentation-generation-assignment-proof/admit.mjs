/** Dated prerequisite evidence only; no generation/security scope is waived. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {admitCarry as admitEarlier,freshCarry}from '../presentation-generation-cancel-diagnostic/admit.mjs';
import {readBounded}from '../presentation-lock-source-edge-rls-proof/admit.mjs';
export{freshCarry};
export const DIAGNOSTIC_PATH='tracking/evidence/m07/presentation-generation-cancel-diagnostic/2026-11-02T23-37-26.745Z-13f5ba7e.json';
export const DIAGNOSTIC_SHA='24bfbc438f1e9f77a85d0ec56e0bf6905ec801cca71dcc16dadb9780d3e74acf';
const OUTCOME='tracking/evidence/m07/presentation-generation-cancel-diagnostic/13f5ba7e-outcome.json';
const OUTCOME_SHA='7b3142cddcfd28dbaa34fdfa0febc07bffb384f53fdacd79e877f27b06131587';
const ENTRY='development/m07/presentation-generation-cancel-diagnostic/entry.mjs';
const CLOSED='a4d7c5642e21001b1a28a024c36596f48bce8cbdf1413ea26f00925ea57774dc';
export function validateDiagnostic(r,outcome){
 assert.equal(r.run_id,'13f5ba7e-47a5-46f8-a5a5-e394210b4c57');assert.equal(r.result,'passed');assert.equal(r.checkpoint,'complete');
 assert.equal(r.cloud_called,false);assert.equal(r.provider_called,false);assert.equal(outcome.normal_process_exit,0);assert.equal(outcome.actual_receipt.sha256,DIAGNOSTIC_SHA);
 for(const key of['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','independent_successful_daemon_label_inventories_empty'])assert.equal(r[key],true);
 const d=r.generation_cancel_diagnostic,c=d.call;
 for(const key of['single_call_completed','candidate_helper_and_four_body_identity_verified','original78_performance_failure_remains_open','original4107_and_four_old_bodies_restored','original_config_and_full_baseline_restored'])assert.equal(d[key],true);
 assert.equal(d.functionstats_enabled,false);assert.equal(d.performance_or_release_acceptance,false);
 assert.equal(c.profile,'large');assert.equal(c.mode,'mcp');assert.equal(c.body_variant,'candidate');assert.equal(c.first_application_call_in_fresh_backend,true);assert.equal(c.application_calls_before_dispatch,0);
 assert.equal(c.normal_SQL_return,true);assert.equal(c.rolled_back,true);assert.equal(c.full_fresh_baseline_restored,true);assert.equal(c.result.ok,false);assert.equal(c.result.code,'57014');
 assert.equal(c.cancellation.message_class,'statement_timeout');assert.equal(c.cancellation.stage,'review_and_fit');assert.equal(c.cancellation.private_custody.normal_return,true);
 const custody=outcome.private_custody_readback;assert.equal(custody.actual_bytes,1000);assert.equal(custody.actual_sha256,c.cancellation.private_custody.sha256);assert.equal(custody.public_custody_hash_equal,true);assert.equal(custody.directory_and_file_only_SYSTEM_and_current_user_allow,true);
 return{receipt:DIAGNOSTIC_PATH,receipt_sha256:DIAGNOSTIC_SHA,observed_at:r.observed_at,normal_process_exit:0,diagnostic_mechanism:'passed',application_generation:'statement_timeout57014',active_stage:'review_and_fit',active_review_data_line:36,dominant_cost_or_invocation_count_claimed:false,failed78_still_open:true,performance_acceptance:false,replayed:false};
}
export async function admitCarry(root,reader=readBounded){
 const earlier=await admitEarlier(root,reader),raw=await reader(path.join(root,DIAGNOSTIC_PATH)),safe=await reader(path.join(root,OUTCOME));assert.equal(sha(raw),DIAGNOSTIC_SHA);assert.equal(sha(safe),OUTCOME_SHA);
 const r=JSON.parse(raw.toString('utf8')),evidence=validateDiagnostic(r,JSON.parse(safe.toString('utf8')));
 for(const[name,expected]of Object.entries(r.source_seals)){
  assert(!path.isAbsolute(name)&&!name.split(/[\\/]/u).includes('..'));const bytes=await reader(path.join(root,name));
  if(name===ENTRY){const text=bytes.toString('utf8'),pattern=/^export const EXECUTION_ENABLED=(?:false|true);$/gmu;assert.equal([...text.matchAll(pattern)].length,1);assert.equal(sha(text.replace(pattern,'export const EXECUTION_ENABLED=true;')),expected);assert.equal(sha(text.replace(pattern,'export const EXECUTION_ENABLED=false;')),CLOSED);}
  else assert.equal(sha(bytes),expected);
 }
 return{...earlier,evidence:{...earlier.evidence,dated_cancellation_diagnostic:evidence}};
}
