/** New functional proof; imports/compilation never prepare or dispatch SQL. */
import assert from 'node:assert/strict';
import {readFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,loadSources as load185,validateSources as validate185} from '../job-attempt-observability36-proof/sources.mjs';
import {compileAttempt36} from '../job-attempt-observability36-proof/controller.mjs';
import {sha} from '../recovery33/compiler.mjs';
export {ROOT,sha};
export const PURPOSE='development/m07/feedback-summary37-proof/';
export const EXECUTION_ENABLED=true;
export const PRIOR185='tracking/evidence/m07/job-attempt-observability36-proof/2026-11-01T01-16-10-092Z-7cff5c7d.json';
export const PRIOR185_SHA='fc7742e874e0c10f11312f798a991c884515db507377a571a831f8f6586c0b51';
export const CANONICAL36='supabase/migrations/20261101012057_m07_job_attempt_observability.sql';
export const FIXTURE37='tests/db/m07-feedback-summary.sql';
export const OWN=['controller.mjs','runtime.mjs','run.mjs','proof.test.mjs','admission.json','README.md'].map(f=>PURPOSE+f);
export const FEATURE=['packages/domain/src/feedback-summary.ts','packages/domain/src/guest-types.ts','packages/domain/src/index.ts',
 'packages/central/src/guest-reviews.ts','apps/web/lib/guest-http.ts','apps/web/lib/mcp.ts','contracts/openapi.yaml',
 'contracts/mcp-tool-catalog.json','contracts/operation-parity.json','apps/web/lib/generated-contracts.json',
 'tests/domain/feedback-summary.test.ts','packages/central/test/feedback-summary.test.ts','tests/server/feedback-summary.test.ts',
 'tools/update_m07_feedback_summary_contracts.py','docs/integrations/FEEDBACK_SUMMARY.md','docs/integrations/OPERATION_INDEX.md',
 'development/m07/feedback-summary37/build_migration.py','development/m07/feedback-summary37/test_migration.py',
 'development/m07/feedback-summary37/candidate.sql.txt','development/m07/feedback-summary37/README.md',
 'development/m07/recovery36/compiler.mjs',CANONICAL36,FIXTURE37,PRIOR185];
const prior36='tracking/evidence/m07/recovery36-trace-profile/2026-11-01T04-23-15-971Z-b7b41927.json';
const prior36Sha='9a1a12fbf1989e278aa05d6656a42d83f024e5620f9322152661f581dc58a5c8';
export async function checked(file){
 assert(typeof file==='string'&&!path.isAbsolute(file)&&!file.includes('\\')&&!file.startsWith('.local/')&&!file.split('/').some(p=>!p||p==='.'||p==='..'));
 const target=path.join(ROOT,file),info=await lstat(target);assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.size<8*1024*1024&&await realpath(target)===target);
 return readFile(target);
}
export function migrationPath(sources){
 const a=JSON.parse(sources.get(PURPOSE+'admission.json'));
 assert.equal(a.schema_version,'1.0');assert.equal(a.migration_created_by_root_Supabase_CLI,true,'FEEDBACK37_OFFICIAL_FILENAME_PENDING');
 assert.equal(typeof a.canonical_migration37_path,'string');assert(/^supabase\/migrations\/[0-9]{14}_m07_feedback_summary\.sql$/u.test(a.canonical_migration37_path));
 assert.equal(a.prior36_cleanup_receipt,prior36);assert.equal(a.prior36_cleanup_sha256,prior36Sha);assert.equal(a.execution_enabled,EXECUTION_ENABLED);
 return a.canonical_migration37_path;
}
export async function loadSources(){
 const sources=await load185();for(const f of [...OWN,...FEATURE,prior36])sources.set(f,await checked(f));
 const file=migrationPath(sources);sources.set(file,await checked(file));validateSources(sources);return sources;
}
export function validateSources(sources){
 assert.equal(sha(sources.get(PRIOR185)),PRIOR185_SHA);
 const proof=JSON.parse(sources.get(PRIOR185));assert.equal(proof.run_id,'7cff5c7d-8329-4abd-ba27-a6e390a7208d');assert.equal(proof.result,'passed');assert.equal(proof.checkpoint,'complete');
 assert.equal(Object.keys(proof.source_seals).length,185);
 const base=new Map();for(const[f,h]of Object.entries(proof.source_seals)){assert.equal(sha(sources.get(f)),h,'FEEDBACK37_PRIOR185_CHANGED');base.set(f,sources.get(f));}validate185(base);
 assert.equal(sha(sources.get(prior36)),prior36Sha);const latest=JSON.parse(sources.get(prior36));assert.equal(latest.result,'passed');assert.equal(latest.checkpoint,'complete');
 assert.equal(latest.recovery36_metadata.result,'passed');assert.equal(latest.recovery36_metadata.history_count,36);
 for(const k of ['full_portable_catalogue_exact','all_populated_table_hashes_exact','english_companion_and_trace_restored','summary_and_synthetic_auth_boundary_preserved','stale_callback_denied','outbox_lease_and_token_fencing_restored'])assert.equal(latest.recovery36_metadata[k],true);
 for(const k of ['native_media_executed','object_bytes_restored','storage_http_tested','provider_auth_restored','deployed_restore_tested'])assert.equal(latest.recovery36_metadata[k],false);
 for(const k of ['disposable_databases_removed','new36_trace_role_removed','new33_roles_removed','original_local_database_unchanged','original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.equal(latest[k],true);
 const migration=migrationPath(sources);assert.equal(sha(sources.get(migration)),sha(sources.get('development/m07/feedback-summary37/candidate.sql.txt')),'FEEDBACK37_CANONICAL_REVIEW_BYTES_REQUIRED');
 assert.equal(sha(sources.get(CANONICAL36)),'4209e16b7d67cfb793375d24dfd22f9fee72f3516e3dde16be1d2b0d633b7267');
 assert.deepEqual([...sources.keys()].sort(),[...new Set([...base.keys(),...OWN,...FEATURE,prior36,migration])].sort());
 return{base,migration,prior_run_ids:[proof.run_id,latest.run_id]};
}
export function compileFeedback37(sources,{root=ROOT,runId}){
 const{base,migration,prior_run_ids}=validateSources(sources);assert(path.isAbsolute(root));assert(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(runId));assert(!prior_run_ids.includes(runId));
 let source=compileAttempt36(base,{root,runId}).source;
 const once=(a,b)=>{assert.equal(source.split(a).length,2,'FEEDBACK37_FIXED_COMPILER_SEAM_REQUIRED');source=source.replace(a,()=>b);};
 once(`import { runAttempt36 } from '${pathToFileURL(path.join(root,'development/m07/job-attempt-observability36-proof/runtime.mjs')).href}';`,`import { runFeedback37 } from '${pathToFileURL(path.join(root,PURPOSE,'runtime.mjs')).href}';`);
 once('await runAttempt36({','await runFeedback37({');
 once(`const ROOT = ${JSON.stringify(root)};`,`const ROOT = ${JSON.stringify(root)};\nif(!${EXECUTION_ENABLED})throw Error('FEEDBACK37_EXECUTION_DISABLED');`);
 once("scope: 'Owned local29->33 plus ephemeral actual34/35 and future attempt36 local SQL rollback proof; no native/provider/hosted acceptance'","scope: 'Owned local29->33 plus actual34-37 feedback summary SQL rollback proof; no native/provider/hosted/restore acceptance'");
 once("'tracking/evidence/m07/job-attempt-observability36-proof'","'tracking/evidence/m07/feedback-summary37-proof'");
 once("'.local/m07-attempt36-tests'","'.local/m07-feedback-summary37-tests'");
 const at=source.indexOf('sourcePaths.push(...');assert(at>0);source=source.slice(0,at)+`sourcePaths.push(...${JSON.stringify([...sources.keys()])});\n  `+source.slice(at);
 const seals='report.source_seals = Object.fromEntries([...sourceFiles].map(([file, bytes]) => [file, sha(bytes)]));';
 once(seals,seals+`\nfor(const[f,h]of Object.entries(${JSON.stringify(Object.fromEntries([...sources].map(([f,b])=>[f,sha(b)])))}))assert.equal(sha(sourceFiles.get(f)),h,'FEEDBACK37_PREPARED_SOURCE_CHANGED');`);
 return{source,manifest:{schema_version:'1.0',purpose:'feedback-summary37-owned-rollback',run_id:runId,execution_enabled:EXECUTION_ENABLED,
  source_sha256:sha(source),source_pins:Object.fromEntries([...sources].map(([f,b])=>[f,sha(b)])),migration37:migration,prior185_unchanged:true,
  actual34_to37_required:true,rollback_to33_required:true,original29_and_global_roles_cleanup_required:true,database_executed:false,cloud_called:false,provider_called:false}};
}
