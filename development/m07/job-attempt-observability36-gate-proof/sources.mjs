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
export const FAILED_RECEIPT='tracking/evidence/m07/job-attempt-observability36-gate-proof/2026-11-01T01-42-48-715Z-207731a6.json';
export const FAILED_RECEIPT_SHA='7a82bdf5bfbda3f3cb1940cc71b2f4f3d423851c4fdf609d249db21fb375cda7';
export const FAILED_ARCHIVE=PURPOSE+'source-history/207731a6/source-archive.json';
export const FAILED_ARCHIVE_SHA='9ca49c35add688f1eab358bcdecd36df58a2d1538537a46a30ead7268b3282c0';
export const FAILED_ARTIFACTS={
 [FAILED_RECEIPT]:FAILED_RECEIPT_SHA,[FAILED_ARCHIVE]:FAILED_ARCHIVE_SHA,
 [PURPOSE+'FAILED_207_SQL_RESULT.md']:'12ad7deef1d24ef18c96ab3e1e6c9f35bd7989448b4b64f5b3fd9e5cd565dec5',
 'tracking/evidence/m07/job-attempt-observability36-gate-proof/2026-11-01-failed207-private-scan.json':'86ad6dd64052cc47971ce68e2e2a8f08a218d9e8c41ea5d2bf9d0866f52ed6d7'};
export const FAILED281_RECEIPT='tracking/evidence/m07/job-attempt-observability36-gate-proof/2026-11-01T01-58-05-677Z-28122d90.json';
export const FAILED281_RECEIPT_SHA='2689ade3bd96db640a0b432a66e828edfd05c44c248da2c16dfe4b22fc738c4e';
export const FAILED281_ARCHIVE=PURPOSE+'source-history/28122d90/delta-source-archive.json';
export const FAILED281_ARCHIVE_SHA='074e75d47e3687384708824149d6510fca82dcc41e3d0359fa512b886d6374b2';
export const FAILED281_ARTIFACTS={
 [FAILED281_RECEIPT]:FAILED281_RECEIPT_SHA,[FAILED281_ARCHIVE]:FAILED281_ARCHIVE_SHA,
 [PURPOSE+'FAILED_281_SQL_RESULT.md']:'aa6272d7871015b12fe3de5de4e6fc3ebbbd30ed5f8d7a0db30fa2e1eb6e5046',
 'tracking/evidence/m07/job-attempt-observability36-gate-proof/2026-11-01-failed281-private-scan.json':'39dc26e1870be46907bf043694c212d045467435ae34564115c1bc89d2ef1ce3',
 'tracking/evidence/m07/job-attempt-observability36-gate-proof/2026-11-01-failed281-diagnostic.json':'87402cdb857997044aabcee130865dbb38c9e45b2332a077a14f0ee8032cb910'};
export const FROZEN_MANIFEST_SHA='d4e26604b1ed234332b804119388ea21322b5fbf779dc2fae49ec33404fbb217';
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
export function assertFailedCleanup(value){
 assert.equal(value.run_id,'207731a6-8462-4eec-8d27-f2fc8f34f2fd');assert.equal(value.result,'failed');
 assert.equal(value.checkpoint,'attempt36-owned-local-rollback-proof');assert.equal(value.failure_code,'M07_LOCAL_RECOVERY_UNCONFIRMED');
 for(const key of ['cloud_called','provider_called','runtime_configuration_loaded','canonical_business_writes'])assert.equal(value[key],false);
 for(const key of ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged',
  'original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged',
  'existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.equal(value[key],true,'ATTEMPT36_FAILED207_CLEANUP_REQUIRED');
 assert.notEqual(value.cleanup_unconfirmed,true);assert.deepEqual(value.actual_disposable_database_absence,{
  eps_m07_r33_source_207731a684624eec8d27f2fc8f34f2fd:false,eps_m07_r33_restore_207731a684624eec8d27f2fc8f34f2fd:false});
 assert.deepEqual(value.actual_local_migrations_executed,['20261030154824','20261031010000','20261031104603','20261031130207']);
 assert.equal(Object.keys(value.source_seals).length,229);assert.equal(value.attempt36_sql,undefined);assert.equal(value.attempt36_gate_sql,undefined);
}
export function assertFailedArchive(archive,failed,prior){
 assertFailedCleanup(failed);assertPriorProof(prior);assert.equal(archive.schema_version,'1.0');assert.equal(archive.failed_run_id,failed.run_id);
 assert.deepEqual(archive.failed_receipt,{path:FAILED_RECEIPT,sha256:FAILED_RECEIPT_SHA});
 assert.equal(archive.unchanged185_prior_receipt,PRIOR_RECEIPT);assert.equal(archive.unchanged185_base_commit,'1813dd7');
 assert.equal(archive.encoding,'base64 preserves exact CRLF bytes independent of Git text filters');
 assert.deepEqual(archive.all229_source_seals,failed.source_seals);
 for(const[file,digest]of Object.entries(prior.source_seals))assert.equal(failed.source_seals[file],digest,'ATTEMPT36_FAILED207_OLD185_CHANGED');
 const expected=Object.keys(failed.source_seals).filter(file=>!Object.hasOwn(prior.source_seals,file)).sort();assert.equal(expected.length,44);
 assert(Array.isArray(archive.new44_exact_byte_sources)&&archive.new44_exact_byte_sources.length===44);
 assert.deepEqual(archive.new44_exact_byte_sources.map(row=>row.path).sort(),expected);
 for(const row of archive.new44_exact_byte_sources){
  assert.equal(row.sha256,failed.source_seals[row.path]);assert(Number.isSafeInteger(row.bytes)&&row.bytes>0&&row.bytes<8*1024*1024);
  assert.equal(typeof row.base64,'string');const bytes=Buffer.from(row.base64,'base64');assert.equal(bytes.toString('base64'),row.base64);
  assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256,'ATTEMPT36_FAILED207_ARCHIVE_BYTES_CHANGED');
  if(row.path===PURPOSE+'controller.mjs')assert(bytes.toString('utf8').includes('export const EXECUTION_ENABLED=true;'),'ATTEMPT36_FAILED207_ACTUAL_ENABLED_SOURCE_REQUIRED');
 }
}
export function assertFailed281Cleanup(value){
 assert.equal(value.run_id,'28122d90-4018-446c-a83f-1f8a38d92c3f');assert.equal(value.result,'failed');
 assert.equal(value.checkpoint,'attempt36-owned-local-rollback-proof');assert.equal(value.failure_code,'M07_LOCAL_RECOVERY_UNCONFIRMED');
 for(const key of ['cloud_called','provider_called','runtime_configuration_loaded','canonical_business_writes'])assert.equal(value[key],false);
 for(const key of ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged',
  'original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged',
  'existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.equal(value[key],true,'ATTEMPT36_FAILED281_CLEANUP_REQUIRED');
 assert.notEqual(value.cleanup_unconfirmed,true);assert.deepEqual(value.actual_disposable_database_absence,{
  eps_m07_r33_source_28122d904018446ca83f1f8a38d92c3f:false,eps_m07_r33_restore_28122d904018446ca83f1f8a38d92c3f:false});
 assert.deepEqual(value.actual_local_migrations_executed,['20261030154824','20261031010000','20261031104603','20261031130207']);
 assert.equal(Object.keys(value.source_seals).length,233);assert.equal(value.attempt36_sql,undefined);assert.equal(value.attempt36_gate_sql,undefined);
}
export function assertFailed281Archive(archive,failed,base,previous,prior,sources){
 assertFailed281Cleanup(failed);assertFailedArchive(base,previous,prior);
 assert.equal(archive.schema_version,'1.0');assert.equal(archive.failed_run_id,failed.run_id);
 assert.deepEqual(archive.failed_receipt,{path:FAILED281_RECEIPT,sha256:FAILED281_RECEIPT_SHA});
 assert.deepEqual(archive.base44_archive,{path:FAILED_ARCHIVE,sha256:FAILED_ARCHIVE_SHA});assert.equal(archive.prior185_unchanged_receipt,PRIOR_RECEIPT);
 assert.deepEqual(archive.all233_source_seals,failed.source_seals);
 assert.deepEqual(archive.coverage,{prior_unchanged:185,base_entry_reuse:37,delta_bytes:7,immutable_history_refs:4,total:233});
 assert.equal(archive.encoding,'base64 delta preserves exact bytes; historical refs stay immutable; no recursively copied archive');
 const reconstructed={...prior.source_seals},baseByPath=new Map(base.new44_exact_byte_sources.map(row=>[row.path,row]));
 const reused=archive.reused37_base_entry_paths,modified=archive.modified7_exact_byte_sources,refs=archive.new4_immutable_history_artifact_refs;
 assert(Array.isArray(reused)&&reused.length===37&&new Set(reused).size===37);
 assert(Array.isArray(modified)&&modified.length===7&&new Set(modified.map(row=>row.path)).size===7);
 assert.deepEqual([...reused,...modified.map(row=>row.path)].sort(),[...baseByPath.keys()].sort());
 for(const file of reused){const row=baseByPath.get(file);assert(row);assert.equal(failed.source_seals[file],row.sha256);reconstructed[file]=row.sha256;}
 for(const row of modified){
  assert(baseByPath.has(row.path));assert.equal(row.sha256,failed.source_seals[row.path]);assert.notEqual(row.sha256,baseByPath.get(row.path).sha256);
  assert(Number.isSafeInteger(row.bytes)&&row.bytes>0&&row.bytes<8*1024*1024&&typeof row.base64==='string');
  const bytes=Buffer.from(row.base64,'base64');assert.equal(bytes.toString('base64'),row.base64);assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);
  if(row.path===PURPOSE+'controller.mjs')assert(bytes.toString('utf8').includes('export const EXECUTION_ENABLED=true;'));
  reconstructed[row.path]=row.sha256;
 }
 assert(Array.isArray(refs)&&refs.length===4);assert.deepEqual(refs.map(row=>row.path).sort(),Object.keys(FAILED_ARTIFACTS).sort());
 for(const row of refs){
  assert.equal(row.sha256,FAILED_ARTIFACTS[row.path]);assert.equal(row.sha256,failed.source_seals[row.path]);
  const bytes=sources.get(row.path);assert(bytes instanceof Uint8Array);assert.equal(bytes.byteLength,row.bytes);assert.equal(sha(bytes),row.sha256);
  reconstructed[row.path]=row.sha256;
 }
 assert.deepEqual(reconstructed,failed.source_seals,'ATTEMPT36_FAILED281_EXACT233_COVERAGE_REQUIRED');
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
 for(const[file,digest]of Object.entries(FAILED_ARTIFACTS))assert.equal(pins[file],digest,'ATTEMPT36_FAILED207_HISTORY_REQUIRED');
 assertFailedArchive(JSON.parse(sources.get(FAILED_ARCHIVE).toString('utf8')),JSON.parse(sources.get(FAILED_RECEIPT).toString('utf8')),prior);
 for(const[file,digest]of Object.entries(FAILED281_ARTIFACTS))assert.equal(pins[file],digest,'ATTEMPT36_FAILED281_HISTORY_REQUIRED');
 assertFailed281Archive(JSON.parse(sources.get(FAILED281_ARCHIVE).toString('utf8')),JSON.parse(sources.get(FAILED281_RECEIPT).toString('utf8')),
  JSON.parse(sources.get(FAILED_ARCHIVE).toString('utf8')),JSON.parse(sources.get(FAILED_RECEIPT).toString('utf8')),prior,sources);
 for(const[file,digest]of Object.entries(prior.source_seals))assert.equal(pins[file],digest,'ATTEMPT36_GATE_EXECUTED185_CHANGED');
 for(const file of PURPOSE_FILES)assert(sources.get(PURPOSE+file)instanceof Uint8Array,'ATTEMPT36_GATE_PURPOSE_SOURCE_REQUIRED');
}
export async function loadSources(){
 const manifest=await readSource(PURPOSE+'frozen-inputs.json');assert.equal(sha(manifest),FROZEN_MANIFEST_SHA);
 const sources=new Map(await Promise.all(Object.entries(JSON.parse(manifest.toString('utf8'))).map(async([file,digest])=>{
  const bytes=await readSource(file);assert.equal(sha(bytes),digest);return[file,bytes];})));
 for(const file of PURPOSE_FILES)sources.set(PURPOSE+file,await readSource(PURPOSE+file));validateSources(sources);return sources;
}
