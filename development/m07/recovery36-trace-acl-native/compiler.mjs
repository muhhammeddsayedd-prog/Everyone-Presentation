/** Native-pair proof compiler. Imports are inert; only public source bytes load. */
import assert from 'node:assert/strict';
import {readFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,loadSources as loadBase,compileRecovery36,sha} from '../recovery36/compiler.mjs';
export {ROOT,sha};
export const PURPOSE='development/m07/recovery36-trace-acl-native/';
export const EXECUTION_ENABLED=true;
export const FILES=['compiler.mjs','runtime.mjs','run.mjs','proof.test.mjs','observation.json','README.md'];
const observationPath=PURPOSE+'observation.json';
const replaced=(s,old,next)=>{assert.equal(s.split(old).length,2,'TRACE_ACL_EXACT_SEAM_REQUIRED');return s.replace(old,()=>next);};
async function checked(file){assert(!path.isAbsolute(file)&&!file.includes('\\')&&!file.startsWith('.local/')&&!file.split('/').some(x=>!x||x==='.'||x==='..'));const p=path.join(ROOT,file),s=await lstat(p);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<8*1024*1024&&await realpath(p)===p);return readFile(p);}
export async function loadSources(){
 const base=await loadBase(),sources=new Map(base),observation=JSON.parse(await checked(observationPath));
 for(const ref of Object.values(observation.references)){const bytes=await checked(ref.path);assert.equal(sha(bytes),ref.sha256);sources.set(ref.path,bytes);}
 for(const file of FILES)sources.set(PURPOSE+file,await checked(PURPOSE+file));
 validateSources(sources);return sources;
}
export function validateSources(sources){
 const read=file=>{assert(sources.get(file)instanceof Uint8Array);return JSON.parse(sources.get(file));};
 const observation=read(observationPath);assert.equal(observation.scope,'actual5d_trace_acl_pair_not_yet_admitted');
 for(const ref of Object.values(observation.references))assert.equal(sha(sources.get(ref.path)),ref.sha256);
 const receipt=read(observation.references.actual_receipt.path),archive=read(observation.references.archive.path),pair=read(observation.references.pair.path);
 assert.equal(receipt.run_id,'5d8d863a-af4c-476f-acb5-ce0879e6daf2');assert.equal(receipt.result,'failed');assert.equal(receipt.checkpoint,'populated36-metadata-dump-restore');
 assert.equal(Object.keys(receipt.source_seals).length,129);assert.deepEqual(archive.source_pins,receipt.source_seals);
 for(const[file,digest]of Object.entries(receipt.source_seals))assert.equal(sha(sources.get(file)),digest,'TRACE_ACL_PRIOR129_CHANGED');
 assert.equal(Object.keys(archive.new7_exact_bytes_base64).length,7);for(const[file,encoded]of Object.entries(archive.new7_exact_bytes_base64))assert.equal(sha(Buffer.from(encoded,'base64')),receipt.source_seals[file]);
 assert.equal(archive.all129_source_pins_matched_at_archive,true);assert.equal(archive.cleanup_all_preservation_and_lock_release_passed,true);assert.equal(archive.replay_allowed,false);
 for(const field of ['disposable_databases_removed','new36_trace_role_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged','original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.equal(receipt[field],true);
 assert.deepEqual(pair.target_pair,{key:'tables|eps.job_stage_attempts|acl',source:'{postgres=arwdDxtm/postgres}',restored:null});
 assert.equal(pair.actual_receipt_sha256,observation.references.actual_receipt.sha256);assert.equal(pair.difference_count,13);
 assert.equal(pair.pair_semantic_equivalence_proven,false);assert.equal(pair.profile_exception_admitted,false);assert.equal(pair.recovery36_acceptance,false);
 assert.equal(pair.source_catalogue_sha256,receipt.metadata36_catalogue_sha256);assert.equal(pair.restored_catalogue_sha256,receipt.metadata36_restored_before_profile_sha256);assert.equal(pair.private_difference_artifact_sha256,receipt.metadata36_catalogue_differences_sha256);
 assert.deepEqual([...sources.keys()].sort(),[...Object.keys(receipt.source_seals),...Object.values(observation.references).map(r=>r.path),...FILES.map(f=>PURPOSE+f)].sort());
 return{observation,receipt,base:new Map(Object.keys(receipt.source_seals).map(f=>[f,sources.get(f)]))};
}
export function compileNativeProof(sources,{root=ROOT,runId}){
 const{base}=validateSources(sources);assert(path.isAbsolute(root));assert(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(runId));
 assert(!['0843096a-6482-402a-bbcf-9cf162289b8a','c0aa3c0e-42e0-4ddc-a0ea-8f9d3f676d01','5d8d863a-af4c-476f-acb5-ce0879e6daf2'].includes(runId));
 const old=compileRecovery36(base,{root,runId});let source=old.source;
 source=replaced(source,`import { createRecovery36Context } from '${pathToFileURL(path.join(root,'development/m07/recovery36/runtime.mjs')).href}';`, `import { createTraceAclNativeContext } from '${pathToFileURL(path.join(root,PURPOSE,'runtime.mjs')).href}';\nif(!${EXECUTION_ENABLED})throw Error('TRACE_ACL_NATIVE_EXECUTION_DISABLED');`);
 source=replaced(source,'recovery33 = createRecovery36Context(','recovery33 = createTraceAclNativeContext(');
 source=replaced(source,"scope: 'AT-070 owned local36 populated metadata-only restore; no object bytes/Auth program/Storage HTTP/deployed proof'","scope: 'Owned36 trace-table native ACL semantics only; not metadata restore acceptance'");
 source=replaced(source,"'tracking/evidence/m07/recovery36'","'tracking/evidence/m07/recovery36-trace-acl-native'");
 const push='sourcePaths.push(...';const at=source.indexOf(push);assert(at>0);source=source.slice(0,at)+`sourcePaths.push(...${JSON.stringify([...sources.keys()])});\n  `+source.slice(at);
 const seals='report.source_seals = Object.fromEntries([...sourceFiles].map(([file, bytes]) => [file, sha(bytes)]));';
 source=replaced(source,seals,seals+`\nfor(const[file,digest]of Object.entries(${JSON.stringify(Object.fromEntries([...sources].map(([f,b])=>[f,sha(b)])))}))assert.equal(sha(sourceFiles.get(file)),digest,'TRACE_ACL_PREPARED_SOURCE_CHANGED');`);
 return{source,manifest:{schema_version:'1.0',purpose:'trace-table-native-acl-only',run_id:runId,execution_enabled:EXECUTION_ENABLED,source_sha256:sha(source),source_pins:Object.fromEntries([...sources].map(([f,b])=>[f,sha(b)])),prior129_unchanged:true,functional_ddl_unchanged:true,metadata_restore_acceptance:false,database_executed:false}};
}
