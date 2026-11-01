/** New full-metadata purpose; all executed native/base bytes remain immutable. */
import assert from 'node:assert/strict';
import {readFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadSources as loadNative,validateSources as nativeSources,ROOT,sha} from '../recovery36-trace-acl-native/compiler.mjs';
import {compileRecovery36} from '../recovery36/compiler.mjs';
export {ROOT,sha};
export const PURPOSE='development/m07/recovery36-trace-profile/';
export const EXECUTION_ENABLED=true;
export const FILES=['compiler.mjs','runtime.mjs','run.mjs','profile.test.mjs','observation.json','README.md'];
export const NATIVE_RECEIPT='tracking/evidence/m07/recovery36-trace-acl-native/2026-11-01T03-57-54-599Z-508198d5.json';
export const NATIVE_SHA='b25fef4d9cd48583faae96d0d74835ba5acf30b8f4a7e192d04be89d4837a46c';
const changed=(s,a,b)=>{assert.equal(s.split(a).length,2,'TRACE_PROFILE_EXACT_SEAM_REQUIRED');return s.replace(a,()=>b);};
async function checked(file){assert(!path.isAbsolute(file)&&!file.includes('\\')&&!file.startsWith('.local/')&&!file.split('/').some(x=>!x||x==='.'||x==='..'));const p=path.join(ROOT,file),s=await lstat(p);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<8*1024*1024&&await realpath(p)===p);return readFile(p);}
export function admitNativeReceipt(bytes,sources){
 assert.equal(sha(bytes),NATIVE_SHA,'TRACE_PROFILE_ACTUAL_NATIVE_RECEIPT_REQUIRED');const receipt=JSON.parse(bytes);
 assert.equal(receipt.run_id,'508198d5-0460-4057-bda3-8aeb1fc8cd66');assert.equal(receipt.result,'passed');assert.equal(receipt.checkpoint,'complete');assert.equal(receipt.metadata_restore_acceptance,false);
 for(const k of ['cloud_called','provider_called','runtime_configuration_loaded','canonical_business_writes','storage_http_tested','deployed_restore_tested'])assert.equal(receipt[k],false);
 for(const k of ['disposable_databases_removed','new36_trace_role_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged','original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.equal(receipt[k],true);
 assert.equal(Object.keys(receipt.source_seals).length,138);for(const[f,h]of Object.entries(receipt.source_seals))assert.equal(sha(sources.get(f)),h,'TRACE_PROFILE_FROZEN138_CHANGED');
 const p=receipt.trace_acl_native;for(const[k,v]of Object.entries({result:'passed',native_only:true,metadata_restore_acceptance:false,role_count:61,public_pseudo_role_included:true,table_privileges:8,column_count:14,column_privileges:4,grant_options_compared:true,table_matrix_rows:496,column_matrix_rows:3472,schema_matrix_rows:124,symmetric_differences:0,null_acl_restored:true,owner_rls_policy_column_grants_schema_trigger_fk_and_global_roles_exact:true}))assert.equal(p[k],v);
 for(const k of ['table_matrix_sha256','column_matrix_sha256','schema_matrix_sha256','expanded_acl_sha256','actual_native_rows_sha256'])assert.match(p[k],/^[a-f0-9]{64}$/u);
 return receipt;
}
export async function loadSources(){const sources=await loadNative();sources.set(NATIVE_RECEIPT,await checked(NATIVE_RECEIPT));for(const f of FILES)sources.set(PURPOSE+f,await checked(PURPOSE+f));validateSources(sources);return sources;}
export function validateSources(sources){
 const receipt=admitNativeReceipt(sources.get(NATIVE_RECEIPT),sources),native=new Map(Object.keys(receipt.source_seals).map(f=>[f,sources.get(f)]));
 const{base}=nativeSources(native);assert.deepEqual([...sources.keys()].sort(),[...Object.keys(receipt.source_seals),NATIVE_RECEIPT,...FILES.map(f=>PURPOSE+f)].sort());
 const observation=JSON.parse(sources.get(PURPOSE+'observation.json'));assert.deepEqual(observation,{schema_version:'1.0',native_receipt:NATIVE_RECEIPT,native_receipt_sha256:NATIVE_SHA,admitted_pair:{key:'tables|eps.job_stage_attempts|acl',source:'{postgres=arwdDxtm/postgres}',restored:null},prior138_unchanged:true,metadata_recovery_executed:false});
 return{receipt,base};
}
export function compileTraceProfile(sources,{root=ROOT,runId}){
 const{base,receipt}=validateSources(sources);assert(path.isAbsolute(root));assert(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(runId));assert(![receipt.run_id,'0843096a-6482-402a-bbcf-9cf162289b8a','c0aa3c0e-42e0-4ddc-a0ea-8f9d3f676d01','5d8d863a-af4c-476f-acb5-ce0879e6daf2'].includes(runId));
 const old=compileRecovery36(base,{root,runId});let source=old.source;
 source=changed(source,`import { createRecovery36Context } from '${pathToFileURL(path.join(root,'development/m07/recovery36/runtime.mjs')).href}';`,`import { createTraceProfileContext } from '${pathToFileURL(path.join(root,PURPOSE,'runtime.mjs')).href}';\nif(!${EXECUTION_ENABLED})throw Error('TRACE_PROFILE_EXECUTION_DISABLED');`);
 source=changed(source,'recovery33 = createRecovery36Context(','recovery33 = createTraceProfileContext(');
 source=changed(source,"scope: 'AT-070 owned local36 populated metadata-only restore; no object bytes/Auth program/Storage HTTP/deployed proof'","scope: 'AT-070 owned full history36 metadata recovery with exact native-proved trace ACL profile; no object bytes/Storage HTTP/provider Auth/deployed restore'");
 source=changed(source,"'tracking/evidence/m07/recovery36'","'tracking/evidence/m07/recovery36-trace-profile'");
 const at=source.indexOf('sourcePaths.push(...');assert(at>0);source=source.slice(0,at)+`sourcePaths.push(...${JSON.stringify([...sources.keys()])});\n  `+source.slice(at);
 const seals='report.source_seals = Object.fromEntries([...sourceFiles].map(([file, bytes]) => [file, sha(bytes)]));';source=changed(source,seals,seals+`\nfor(const[f,h]of Object.entries(${JSON.stringify(Object.fromEntries([...sources].map(([f,b])=>[f,sha(b)])))}))assert.equal(sha(sourceFiles.get(f)),h,'TRACE_PROFILE_PREPARED_SOURCE_CHANGED');`);
 return{source,manifest:{schema_version:'1.0',purpose:'owned36-trace-table-exact-profile',run_id:runId,execution_enabled:EXECUTION_ENABLED,source_sha256:sha(source),source_pins:Object.fromEntries([...sources].map(([f,b])=>[f,sha(b)])),prior138_unchanged:true,functional_ddl_unchanged:true,native_receipt_sha256:NATIVE_SHA,database_executed:false}};
}
