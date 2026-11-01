/** Source-only loader. No process, lock, database, private env or provider IO. */
import assert from 'node:assert/strict';
import { lstat,readFile,realpath } from 'node:fs/promises';
import path from 'node:path';
import { sha } from '../recovery33/compiler.mjs';

export const ROOT=path.resolve(import.meta.dirname,'../../..');
export const PURPOSE='development/m07/job-attempt-observability36-proof/';
export const PURPOSE_FILES=['sources.mjs','controller.mjs','runtime.mjs','run.mjs','proof.test.mjs','service-fixture.sql','README.md','frozen-inputs.json'];
export const PRIOR_RECEIPT='tracking/evidence/m07/workspace-summary35-proof/2026-10-31T18-47-07-800Z-ef4cb6c2.json';
export const PRIOR_RECEIPT_SHA='417d1f32cc1b417c51107899e7b6e529e22ffa7b5be7e713b50f58901dac67a9';
export const FROZEN_MANIFEST_SHA='69700aaa71d3a37f73d2f43cfc49f02f3e8c25d9619c2932a174823180951383';
export function assertPriorProof(value){
 assert.equal(value.run_id,'ef4cb6c2-3f4a-4869-a71a-d747f1db99ca');assert.equal(value.result,'passed');assert.equal(value.checkpoint,'complete');
 for(const key of ['cloud_called','provider_called','runtime_configuration_loaded','canonical_business_writes'])assert.equal(value[key],false,'ATTEMPT36_PRIOR_SCOPE_CHANGED');
 for(const key of ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged',
  'original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged',
  'existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.equal(value[key],true,'ATTEMPT36_PRIOR_CLEANUP_REQUIRED');
 assert.notEqual(value.cleanup_unconfirmed,true);
 assert.deepEqual(value.actual_disposable_database_absence,{
  eps_m07_r33_source_ef4cb6c23f4a4869a71ad747f1db99ca:false,eps_m07_r33_restore_ef4cb6c23f4a4869a71ad747f1db99ca:false});
 assert.deepEqual(value.actual_local_migrations_executed,['20261030154824','20261031010000','20261031104603','20261031130207']);
 const proof=value.summary35_sql;assert.equal(proof.result,'passed');assert.equal(proof.ddl_data_catalogue_rolled_back,true);
 assert.equal(proof.persistent_history_count,33);assert.equal(proof.history34_row_ephemeral,true);assert.equal(proof.history35_inserted,false);
 assert.equal(proof.actual34_sha256,'0705f1940abbc5c4afc65a49e85d9ef2ce6a6489178b6dd82c3acb33cf976472');
 assert.equal(proof.actual35_sha256,'cbb12610603318bce68ced4a58d0a9a01ee07737838c99a2ea0e6214e5e933e0');
 for(const key of ['managed_auth_policy_changed','native_pdf_executed','cloud_called','provider_called','hosted_acceptance'])assert.equal(proof[key],false);
 assert.equal(Object.keys(value.source_seals).length,169,'ATTEMPT36_PRIOR_CLOSURE_REQUIRED');
}
export async function readSource(file){
 assert(typeof file==='string'&&!path.isAbsolute(file)&&!file.split('/').some(part=>!part||part==='.'||part==='..')&&!file.includes('\\'));
 const target=path.join(ROOT,file);assert(target.startsWith(ROOT+path.sep));
 const info=await lstat(target);assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.size<8*1024*1024,'ATTEMPT36_REGULAR_SOURCE_REQUIRED');
 assert.equal(path.resolve(await realpath(target)),target,'ATTEMPT36_SOURCE_PATH_CHANGED');return readFile(target);
}
export function validateSources(sources){
 assert.equal(sha(sources.get(PURPOSE+'frozen-inputs.json')),FROZEN_MANIFEST_SHA,'ATTEMPT36_FROZEN_MANIFEST_CHANGED');
 const pins=JSON.parse(sources.get(PURPOSE+'frozen-inputs.json').toString('utf8'));
 for(const[file,digest]of Object.entries(pins))assert.equal(sha(sources.get(file)),digest,'ATTEMPT36_FROZEN_INPUT_CHANGED');
 assert.equal(pins[PRIOR_RECEIPT],PRIOR_RECEIPT_SHA);const previous=JSON.parse(sources.get(PRIOR_RECEIPT).toString('utf8'));assertPriorProof(previous);
 for(const[file,digest]of Object.entries(previous.source_seals))assert.equal(pins[file],digest,'ATTEMPT36_EXECUTED_PRIOR_SOURCE_CHANGED');
 for(const file of PURPOSE_FILES)assert(sources.get(PURPOSE+file)instanceof Uint8Array,'ATTEMPT36_PURPOSE_SOURCE_REQUIRED');
}
export async function loadSources(){
 const manifest=await readSource(PURPOSE+'frozen-inputs.json');assert.equal(sha(manifest),FROZEN_MANIFEST_SHA,'ATTEMPT36_FROZEN_MANIFEST_CHANGED');
 const pins=JSON.parse(manifest.toString('utf8'));
 const sources=new Map(await Promise.all(Object.entries(pins).map(async([file,digest])=>{
  const bytes=await readSource(file);assert.equal(sha(bytes),digest,'ATTEMPT36_FROZEN_INPUT_CHANGED');return[file,bytes];
 })));
 for(const file of PURPOSE_FILES)sources.set(PURPOSE+file,await readSource(PURPOSE+file));
 validateSources(sources);return sources;
}
