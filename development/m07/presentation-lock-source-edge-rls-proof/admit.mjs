/** Read-only admission of dated, incomplete393 evidence. No authority is reused. */
import assert from 'node:assert/strict';
import {lstat,readFile}from 'node:fs/promises';
import path from 'node:path';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
export const CARRY_PATH='tracking/evidence/m07/presentation-lock-source-complete-oracle-proof/2026-11-02T20-33-12.340Z-39386edd.json';
export const CARRY_SHA='f5de1993783c8c3f4e618189091291ea905bd34839effd088af59e403d477cac';
const ENTRY='development/m07/presentation-lock-source-complete-oracle-proof/entry.mjs';
const ENTRY_DISABLED_SHA='98b7c5d2f2f5b6d80450396474d59ba3d710cd83c79e35c9a65916a92fbb4b3a';
const EXPECTED=[['public.projects',1],['public.clients',0],['eps.presentation_templates',1],['eps.specs',1],['eps.roles',2],['eps.slots',16],['eps.assignments',19],['eps.workspace_candidates',11],['eps.candidates',11],['eps.candidate_media',11],['eps.media_assets',44],['eps.candidate_media_frames',33]];
const TARGET='280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4';
const canon=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canon(value[k])])):Array.isArray(value)?value.map(canon):value;
export function validateCarry(r){
 assert.equal(r.run_id,'39386edd-a030-4b00-89ad-f2747442f900');assert.equal(r.result,'failed');
 assert.equal(r.checkpoint,'pool-proof-semantic-missing_selected_pair');assert.equal(r.failure_code,'LOCKSOURCE41_ASSERTION_FAILED');
 assert.equal(r.cloud_called,false);assert.equal(r.provider_called,false);
 for(const name of['all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','independent_successful_daemon_label_inventories_empty'])assert.equal(r[name],true);
 const p=r.pool_helper_proof;assert.equal(p.candidate_four_bodies_executed,false);assert.equal(p.catalogue_prosrc_exclusions,1);assert.equal(p.fresh_timing_matrix_executed,false);
 assert.deepEqual(p.installations,[{variant:'new',actual_source_sha256:TARGET,expected_source_sha256:TARGET,authority_unchanged:true}]);
 const rows=p.semantic;assert.deepEqual(rows.map(x=>x.name),['baseline','empty_assignments','referenced_archived_pool','missing_selected_pair']);
 for(const row of rows){assert.equal(row.rolled_back,true);assert.equal(row.old_ready_dml_issued,false);assert.equal(row.helper.ok,true);assert(row.helper.duration_ms<8000);assert.equal(row.tuples.old_tuple_sha256,row.tuples.new_tuple_sha256);assert.equal(row.tuples.old_tuple_count,row.tuples.new_tuple_count);}
 const held=rows[0].held;assert.equal(held.completed,true);assert.equal(new Set(held.independent_pids).size,3);
 assert.deepEqual(held.relations.map(x=>[x.relation,x.selected_rows]),EXPECTED);
 assert(held.relations.every(x=>x.normal_return===true&&x.held_rows===x.selected_rows));assert.equal(held.negatives.length,8);
 const negativeExpected=[true,true,true,true,true,true,true,false];
 held.negatives.forEach((x,i)=>assert.deepEqual(x.result,{found:negativeExpected[i],locked:false}));
 assert.equal(held.complete_oracle.total_keys,1637);assert.equal(held.complete_oracle.identity_checks,1687);assert.equal(held.complete_oracle.live_authority_checks,3299);
 assert.equal(held.complete_oracle.complete_global_primary_key_snapshot,true);assert.equal(held.complete_oracle.same_connection_required,true);
 assert.equal(rows[1].tuples.captured_pool_count,0);assert.equal(rows[2].tuples.captured_pool_count,12);
 assert.deepEqual(rows[2].fk_key_share_control,{found:true,locked:false});assert.deepEqual(rows[2].archived_share_held,{found:true,locked:true,code:'55P03'});
 assert.deepEqual(rows[3].selected_asset_still_held,{found:true,locked:false});assert.equal(rows[3].selected_pair_missing,true);
 assert.equal(p.remaining_semantics_and_security_completed,undefined);
 assert.equal(Object.keys(r.source_seals).length,88);assert.equal(Object.keys(p.fresh_baseline.tables).length,87);
 return{schema_version:'edge-rls-dated-carry.v1',receipt:CARRY_PATH,receipt_sha256:CARRY_SHA,observed_at:r.observed_at,result:'partial_pass_from_failed_run',
  helper_sha256:TARGET,complete_oracle_relations:12,held_selected_rows:150,unselected_negatives:8,total_universe_keys:1637,
  carried_RR_cases:['baseline','empty_assignments','referenced_archived_pool'],fourth_case_tuple_equality_only:true,
  failed_assertion_retained:{case:'missing_selected_pair',found:true,locked:false},fresh_oracle_or_benchmark_replay:false,
  RC_fence_authority_expiry_not_carried:true,whole_generation_or_four_body_acceptance:false};
}
export async function readBounded(file,max=2*1024**2){
 const before=await lstat(file);assert(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size>0&&before.size<=max);
 const raw=await readFile(file);const after=await lstat(file);assert(raw.length<=max&&raw.length===before.size&&after.size===before.size&&after.mtimeMs===before.mtimeMs&&after.ino===before.ino);return raw;
}
export async function admitCarry(root,reader=readBounded){
 const raw=await reader(path.join(root,CARRY_PATH));assert.equal(sha(raw),CARRY_SHA);const receipt=JSON.parse(raw.toString('utf8'));const evidence=validateCarry(receipt);
 for(const[name,expected]of Object.entries(receipt.source_seals)){
  assert(!path.isAbsolute(name)&&!name.split(/[\\/]/u).includes('..'));
  const bytes=await reader(path.join(root,name));
  if(name===ENTRY){
   const text=bytes.toString('utf8'),pattern=/^export const EXECUTION_ENABLED=(?:false|true);$/gmu;assert.equal([...text.matchAll(pattern)].length,1);
   assert.equal(sha(text.replace(pattern,'export const EXECUTION_ENABLED=true;')),expected);
   assert.equal(sha(text.replace(pattern,'export const EXECUTION_ENABLED=false;')),ENTRY_DISABLED_SHA);
  }else assert.equal(sha(bytes),expected);
 }
 return{receipt,evidence};
}
export function freshCarry(ctx,admitted){
 const r=admitted.receipt;
 for(const k of['metadata_sha256','migration_sha256','functional_sha256','image_id'])assert.equal(ctx.report[k],r[k]);
 const counts=x=>Object.fromEntries(Object.entries(x.tables).map(([name,row])=>[name,row.count]));
 assert.deepEqual(canon(counts(ctx.baseline)),canon(counts(r.pool_helper_proof.fresh_baseline)));
 assert.equal(ctx.baseline.ready_versions,r.pool_helper_proof.fresh_baseline.ready_versions);assert.equal(ctx.baseline.reason_nonnull_rows,1);
 assert.equal(ctx.bindings.candidateSha,admitted.evidence.helper_sha256);assert.deepEqual(ctx.bindings.beforeBodies,ctx.bindings.afterBodies);
 return{...admitted.evidence,fresh_fixture_counts_equal:true,cross_run_business_hash_equality_claimed:false};
}
