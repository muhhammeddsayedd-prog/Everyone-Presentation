/** Source-only input reader; no subprocess, lock, database or provider action. */
import assert from 'node:assert/strict';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const ROOT=path.resolve(import.meta.dirname,'../../..');
export const PURPOSE='development/m07/workspace-summary35-proof/';
export const PURPOSE_FILES=['controller.mjs','runtime.mjs','sources.mjs','run.mjs','proof.test.mjs','README.md','frozen-inputs.json'];
export const FROZEN_MANIFEST_SHA='0f4282d921c5ae790a7c3b833a9bb25cd4c02e65bc274464bc8d8c29326c5df9';
export const PRIOR_RECEIPT='tracking/evidence/m07/workspace-summary35-proof/2026-10-31T18-39-41-150Z-3304bf06.json';
export const PRIOR_RECEIPT_SHA='72022c9e2a430c6e2739a14029d7d928f5c949e5a9e919c7d3296ab3349d0a4f';
export const EXECUTED_3304_SOURCES=Object.freeze({
 [PURPOSE+'controller.mjs']:'6e930e717389269f45bfd7ea6312bc21d285ec2fcb005aaa6e4e6b9569f980c3',
 [PURPOSE+'runtime.mjs']:'d889fb753e9364d8ed9cd4721dda7234df57da56c98881967b55270635401891',
 [PURPOSE+'sources.mjs']:'09c15ddd851947fbe7facecc78a0f08942c801dd7c03d59e7f6316ba0c20109b',
 [PURPOSE+'run.mjs']:'9015088ab112655e6614a7338bcbbb7daae727d9355c62c3c8a8e1975e532260',
 [PURPOSE+'proof.test.mjs']:'7a690f6a1d60372478221254840aa5d7ee87bfc8c1bb62c60be32d612957c4ae',
 [PURPOSE+'README.md']:'291dc58113592fedd4dc8a88d219ea5a5eb9a2c0763820b2c36bbdfb76905df6',
 [PURPOSE+'frozen-inputs.json']:'ab55b4ca1373e70ad1d02fe2f8496df849013f797b9f338c2135d8394b826f65',
 'supabase/migrations/20261031182038_m07_workspace_summary.sql':'cbb12610603318bce68ced4a58d0a9a01ee07737838c99a2ea0e6214e5e933e0',
 'tests/db/m07-workspace-summary.sql':'1adefb46c3258b5b0a7b4ba6d1ea1ffd05daba5ffbd4db0c1084d70b842cfdc4',
});
export function assertPriorCleanupState(value){
 assert.equal(value.run_id,'3304bf06-3195-4782-944b-8b2efc2cc480');assert.equal(value.result,'failed');
 assert.equal(value.checkpoint,'summary35-owned-synthetic-rollback-proof');assert.equal(value.failure_code,'M07_LOCAL_RECOVERY_UNCONFIRMED');
 for(const key of ['cloud_called','provider_called','runtime_configuration_loaded','canonical_business_writes'])assert.equal(value[key],false,'SUMMARY35_PRIOR_SCOPE_CHANGED');
 for(const key of ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged',
  'original29_full_catalogue_unchanged','original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged',
  'existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.equal(value[key],true,'SUMMARY35_PRIOR_CLEANUP_REQUIRED');
 assert.notEqual(value.cleanup_unconfirmed,true);assert.equal(value.summary35_sql,undefined);
 assert.deepEqual(value.actual_disposable_database_absence,{
  eps_m07_r33_source_3304bf0631954782944b8b2efc2cc480:false,eps_m07_r33_restore_3304bf0631954782944b8b2efc2cc480:false});
 assert.deepEqual(value.actual_local_migrations_executed,['20261030154824','20261031010000','20261031104603','20261031130207']);
 for(const[file,digest]of Object.entries(EXECUTED_3304_SOURCES))assert.equal(value.source_seals[file],digest,'SUMMARY35_PRIOR_EXECUTED_SOURCE_CHANGED');
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function readSource(file){
 const target=path.join(ROOT,file),info=await lstat(target);
 assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.size<8*1024*1024,'SUMMARY35_REGULAR_SOURCE_REQUIRED');
 assert.equal(path.resolve(await realpath(target)),target,'SUMMARY35_SOURCE_PATH_CHANGED');
 return readFile(target);
}
export async function loadSources(){
 const manifest=await readSource(PURPOSE+'frozen-inputs.json');
 assert.equal(sha(manifest),FROZEN_MANIFEST_SHA,'SUMMARY35_FROZEN_MANIFEST_CHANGED');
 const pins=JSON.parse(manifest.toString('utf8'));
 const sources=new Map(await Promise.all(Object.entries(pins).map(async([file,expected])=>{
  const bytes=await readSource(file);assert.equal(sha(bytes),expected,'SUMMARY35_FROZEN_INPUT_CHANGED');return[file,bytes];
 })));
 assert.equal(pins[PRIOR_RECEIPT],PRIOR_RECEIPT_SHA,'SUMMARY35_PRIOR_RECEIPT_REQUIRED');
 assertPriorCleanupState(JSON.parse(sources.get(PRIOR_RECEIPT)));
 for(const[file,digest]of Object.entries(EXECUTED_3304_SOURCES)){
  const historical=PURPOSE+'source-history/'+digest+'-'+path.basename(file)+'.txt';
  assert.equal(sha(sources.get(historical)),digest,'SUMMARY35_EXECUTED_HISTORY_CHANGED');
 }
 const oldPins=JSON.parse(sources.get('development/m03/english-transcript34/recovery-source-pins.json').toString('utf8'));
 for(const[file,expected]of Object.entries(oldPins))assert.equal(sha(sources.get(file)),expected,'SUMMARY35_EXISTING_RECOVERY_PIN_CHANGED');
 const cleanup=JSON.parse(sources.get('tracking/evidence/m07/recovery33/2026-10-31T15-01-22.518Z-533-guarded-cleanup.json'));
 assert.equal(cleanup.run_id,'5332c86b-b1f9-410e-8702-647031182b17');
 for(const key of ['original_baseline_exact','original_full_catalogue_exact','all_preexisting_global_roles_exact',
  'both_task_databases_absent','no_other_clients','independent_read_only_postcheck','lock_released'])assert.equal(cleanup[key],true,'SUMMARY35_ACTUAL_CLEANUP_PROOF_REQUIRED');
 assert.deepEqual(cleanup.role_oids_removed,['185012','185052']);
 for(const file of PURPOSE_FILES)sources.set(PURPOSE+file,await readSource(PURPOSE+file));
 return sources;
}
