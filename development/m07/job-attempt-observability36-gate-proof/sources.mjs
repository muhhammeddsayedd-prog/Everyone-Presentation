/** Source-only loader; no target, lock, process, private env or provider access. */
import assert from 'node:assert/strict';
import { lstat,readFile,realpath } from 'node:fs/promises';
import path from 'node:path';
import { sha } from '../recovery33/compiler.mjs';
export const ROOT=path.resolve(import.meta.dirname,'../../..');
export const PURPOSE='development/m07/job-attempt-observability36-gate-proof/';
export const PURPOSE_FILES=['controller.mjs','runtime.mjs','sources.mjs','run.mjs','python.mjs','bridge.py','proof.test.mjs','test_bridge.py','DESIGN.md','README.md','frozen-inputs.json'];
export const PRIOR_RECEIPT='tracking/evidence/m07/job-attempt-observability36-proof/2026-11-01T01-16-10-092Z-7cff5c7d.json';
export const PRIOR_RECEIPT_SHA='fc7742e874e0c10f11312f798a991c884515db507377a571a831f8f6586c0b51';
export const FROZEN_MANIFEST_SHA='b8a5d59f5921c2a132f8ea07918b70fc04d0256fa0dd710b6120678593fb7ed0';
export function assertPriorProof(value){
 assert.equal(value.run_id,'7cff5c7d-8329-4abd-ba27-a6e390a7208d');assert.equal(value.result,'passed');assert.equal(value.checkpoint,'complete');
 for(const key of ['cloud_called','provider_called','runtime_configuration_loaded','canonical_business_writes'])assert.equal(value[key],false);
 for(const key of ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged',
  'original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged',
  'existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.equal(value[key],true,'ATTEMPT36_GATE_PRIOR_CLEANUP_REQUIRED');
 assert.notEqual(value.cleanup_unconfirmed,true);assert.deepEqual(value.actual_disposable_database_absence,{
  eps_m07_r33_source_7cff5c7d83294abdba27a6e390a7208d:false,eps_m07_r33_restore_7cff5c7d83294abdba27a6e390a7208d:false});
 assert.equal(Object.keys(value.source_seals).length,185);
 assert.deepEqual(value.actual_local_migrations_executed,['20261030154824','20261031010000','20261031104603','20261031130207']);
 const proof=value.attempt36_sql;assert.equal(proof.result,'passed');assert.equal(proof.persistent_history_count,33);
 for(const key of ['functional_sql_unchanged','actual_claim_callback_manual_retry','ddl_data_catalogue_rolled_back','trace_role_rolled_back','history34_and35_ephemeral'])assert.equal(proof[key],true);
 for(const key of ['candidate36_history_inserted','managed_auth_policy_changed','native_executed','cloud_called','provider_called','hosted_acceptance'])assert.equal(proof[key],false);
}
export async function readSource(file){
 assert(typeof file==='string'&&!path.isAbsolute(file)&&!file.includes('\\')&&!file.split('/').some(p=>!p||p==='.'||p==='..'));
 const target=path.join(ROOT,file);assert(target.startsWith(ROOT+path.sep));const info=await lstat(target);
 assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.size<8*1024*1024);assert.equal(await realpath(target),target);return readFile(target);
}
export function validateSources(sources){
 assert.equal(sha(sources.get(PURPOSE+'frozen-inputs.json')),FROZEN_MANIFEST_SHA,'ATTEMPT36_GATE_FROZEN_INPUTS_REQUIRED');
 const pins=JSON.parse(sources.get(PURPOSE+'frozen-inputs.json').toString('utf8'));
 for(const[file,digest]of Object.entries(pins))assert.equal(sha(sources.get(file)),digest,'ATTEMPT36_GATE_PIN_CHANGED');
 assert.equal(pins[PRIOR_RECEIPT],PRIOR_RECEIPT_SHA);const prior=JSON.parse(sources.get(PRIOR_RECEIPT).toString('utf8'));assertPriorProof(prior);
 for(const[file,digest]of Object.entries(prior.source_seals))assert.equal(pins[file],digest,'ATTEMPT36_GATE_EXECUTED185_CHANGED');
 for(const file of PURPOSE_FILES)assert(sources.get(PURPOSE+file)instanceof Uint8Array,'ATTEMPT36_GATE_PURPOSE_SOURCE_REQUIRED');
}
export async function loadSources(){
 const manifest=await readSource(PURPOSE+'frozen-inputs.json');assert.equal(sha(manifest),FROZEN_MANIFEST_SHA);
 const sources=new Map(await Promise.all(Object.entries(JSON.parse(manifest.toString('utf8'))).map(async([file,digest])=>{
  const bytes=await readSource(file);assert.equal(sha(bytes),digest);return[file,bytes];})));
 for(const file of PURPOSE_FILES)sources.set(PURPOSE+file,await readSource(PURPOSE+file));validateSources(sources);return sources;
}
