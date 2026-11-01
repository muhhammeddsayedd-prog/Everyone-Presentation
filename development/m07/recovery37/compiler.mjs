/** NEW full-mode compiler. Importing/compilation never runs a controller. */
import assert from 'node:assert/strict';
import {readFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {compileController33,sha} from '../recovery33/compiler.mjs';
import {adapters36} from '../recovery36/compiler.mjs';
import {ownedPredicate33} from '../recovery33/ownership.mjs';
export {sha};
export const ROOT=path.resolve(import.meta.dirname,'../../..');
export const PURPOSE='development/m07/recovery37/';
export const EXECUTION_ENABLED=true;
export const IMAGE='sha256:ea6e27d158a843fee524d7f43f2f88a4ede8bc58e8ac32578b7dec5c1594ba6b';
export const FILES=['compiler.mjs','runtime.mjs','fixture.sql','run.mjs','recovery.test.mjs','frozen-inputs.json','README.md'];
export const MIGRATION37='supabase/migrations/20261101042702_m07_feedback_summary.sql';
export const MIGRATION37_SHA='14bb7f74e597b9a1a9b49df6fe047b16a788efa703e5d7a849ed254c3cbe98b3';
export const RECEIPTS={
 full33:['tracking/evidence/m07/recovery33/2026-10-31T15-34-37-577Z-9af6774f.json','eacc14970a54f74863801e8181c8d18a11e3fb7543ad9ee5a817390508ff1e54'],
 metadata36:['tracking/evidence/m07/recovery36-trace-profile/2026-11-01T04-23-15-971Z-b7b41927.json','9a1a12fbf1989e278aa05d6656a42d83f024e5620f9322152661f581dc58a5c8'],
 sql37:['tracking/evidence/m07/feedback-summary37-proof/2026-11-01T09-45-45-482Z-e109a4d1.json','3a98d0dabac723e8c599f200a30e6849596b41281c0828868a64a313d008b1b9'],
 native508:['tracking/evidence/m07/recovery36-trace-acl-native/2026-11-01T03-57-54-599Z-508198d5.json','b25fef4d9cd48583faae96d0d74835ba5acf30b8f4a7e192d04be89d4837a46c'],
 apply37:['tracking/evidence/m07/feedback-summary37-release/2026-11-01T10-02-00-079274Z-apply.json','776ddc9e16af407c613d9203b6c07918826160ae0b3f48af7437b88409bed4f6'],
 readback37:['tracking/evidence/m07/feedback-summary37-release/2026-11-01T10-02-27-793801Z-readback.json','cc0936d60ab10c9f2bdabcd6c7b26dc07655abc9126de692cfe519a589e2c8c2']};
export const MANIFEST_SHA='46530f56d8c0babe123b9fc72e31a87fb04ed1679e920f220a91b6cf1697e86a';
export const text=(sources,file)=>{assert(sources.get(file)instanceof Uint8Array);return sources.get(file).toString('utf8');};
export async function checked(file){
 assert(typeof file==='string'&&!path.isAbsolute(file)&&!file.includes('\\')&&!file.startsWith('.local/')&&!file.split('/').some(v=>!v||v==='.'||v==='..'));
 const target=path.join(ROOT,file),s=await lstat(target);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<8*1024*1024&&await realpath(target)===target);return readFile(target);
}
export function validateSources(sources){
 const raw=sources.get(PURPOSE+'frozen-inputs.json');assert.equal(sha(raw),MANIFEST_SHA);
 const manifest=JSON.parse(raw);assert.equal(manifest.schema_version,'1.0');assert.equal(manifest.internal_graph.unresolved,0);
 assert(manifest.internal_graph.files.length>=71);assert.equal(manifest.media_image,IMAGE);
 assert.deepEqual([...sources.keys()].sort(),[...new Set([...Object.keys(manifest.pins),...FILES.map(f=>PURPOSE+f)])].sort());
 for(const[f,h]of Object.entries(manifest.pins))assert.equal(sha(sources.get(f)),h,'RECOVERY37_FROZEN_INPUT_CHANGED');
 const docs={};for(const[name,[file,h]]of Object.entries(RECEIPTS)){assert.equal(sha(sources.get(file)),h);docs[name]=JSON.parse(text(sources,file));}
 for(const[name,count]of [['full33',119],['metadata36',145],['sql37',217],['native508',138]]){
  const v=docs[name];assert.equal(v.result,'passed');assert.equal(v.checkpoint,'complete');assert.equal(Object.keys(v.source_seals).length,count);
  for(const k of ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.equal(v[k],true);
  for(const k of ['cloud_called','provider_called','runtime_configuration_loaded','canonical_business_writes'])assert.equal(v[k],false);
  for(const[f,h]of Object.entries(v.source_seals)){
   if(name==='full33'&&f==='development/m07/recovery33/README.md'){assert.deepEqual(manifest.prior33_documentation_delta,{path:f,prior_sha256:h,current_sha256:sha(sources.get(f))});}
   else assert.equal(sha(sources.get(f)),h,'RECOVERY37_EXECUTED_SOURCE_CHANGED');
  }
 }
 assert.equal(docs.metadata36.recovery36_metadata.result,'passed');assert.equal(docs.sql37.feedback37_sql.actual37_sha256,MIGRATION37_SHA);
 const a=docs.apply37,r=docs.readback37;assert.equal(a.action,'apply');assert.equal(a.result,'passed');assert.equal(a.normal_return_marker_observed,true);assert.equal(a.independent_readback_verified,true);assert.deepEqual(a.first,a.second);
 assert.equal(r.result,'observed_applied');assert.deepEqual(r.source_pins,a.source_pins);assert.deepEqual(r.static_schema_after,a.static_schema_after);
 assert.equal(r.static_schema_after.history.length,37);assert.equal(r.static_schema_after.history.at(-1),'20261101042702');
 assert.equal(a.target,r.target);assert.equal(r.target,'pyibofyctwnqpvktepse');
 for(const[f,h]of Object.entries(a.source_pins))assert.equal(sha(sources.get(f)),h,'RECOVERY37_CANONICAL_OPERATOR_CHANGED');
 assert.equal(sha(sources.get(MIGRATION37)),MIGRATION37_SHA);return{manifest,docs};
}
export async function loadSources(){
 const raw=await checked(PURPOSE+'frozen-inputs.json');assert.equal(sha(raw),MANIFEST_SHA);
 const m=JSON.parse(raw),sources=new Map();for(const f of new Set([...Object.keys(m.pins),...FILES.map(f=>PURPOSE+f)]))sources.set(f,await checked(f));validateSources(sources);return sources;
}
export function adapters37(sources,identity){
 const list=adapters36(sources,identity),original=text(sources,MIGRATION37);assert.equal(sha(original),MIGRATION37_SHA);
 assert.equal(original.split('\nbegin;\n').length,2);assert(original.endsWith('\ncommit;\n'));
 let sql=original.replace('\nbegin;\n','\n').slice(0,-'commit;\n'.length);assert.equal(sql.split("current_database()<>'postgres'").length,2);
 sql=sql.replace("current_database()<>'postgres'",'('+ownedPredicate33(identity)+')');
 const anchor='\ncreate function eps.feedback_summary';assert.equal(sql.slice(sql.indexOf(anchor)),original.slice(original.indexOf(anchor),-'commit;\n'.length));
 return[...list,{file:MIGRATION37,version:'20261101042702',sql,source_sha256:MIGRATION37_SHA,adapted_sha256:sha(sql),admission_only:true}];
}
export function compileRecovery37(sources,{root=ROOT,runId}){
 const{manifest,docs}=validateSources(sources);assert(path.isAbsolute(root));assert(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(runId));
 assert(!Object.values(docs).some(v=>v.run_id===runId));let source=compileController33(sources,{root,runId,mode:'full'}).source;const changes=[];
 const once=(a,b,label)=>{assert.equal(source.split(a).length,2,'RECOVERY37_EXACT_FULL_SEAM:'+label);changes.push({label,before_sha256:sha(a),after_sha256:sha(b)});source=source.replace(a,()=>b);};
 const url=pathToFileURL(path.join(root,PURPOSE,'runtime.mjs')).href;
 once(`import { createRecovery33Context } from '${pathToFileURL(path.join(root,'development/m07/recovery33/runtime.mjs')).href}';`,`import { createRecovery37Context } from '${url}';\nif(!${EXECUTION_ENABLED})throw Error('RECOVERY37_EXECUTION_DISABLED');\nif(['OPENAI_API_KEY','N8N_API_KEY','VERCEL_TOKEN','SUPABASE_SERVICE_ROLE_KEY','VERCEL'].some(k=>process.env[k]))throw Error('RECOVERY37_PROVIDER_ENV_FORBIDDEN');`,'new-disabled-full-runtime');
 once('recovery33 = createRecovery33Context(','recovery33 = createRecovery37Context(','new-context');
 once("scope: 'AT-070 full owned29->33 full synthetic local restore; original29 and existing global roles preserved'","scope: 'AT-070 owned full history37 synthetic metadata/filesystem/native PDF-video restore; no Storage HTTP/provider/deployed/independent/RTO proof'",'truthful-scope');
 once("'tracking/evidence/m07/recovery33'","'tracking/evidence/m07/recovery37'",'new-receipts');
 once("'eps-media:local-76b4944f14af6bde'",JSON.stringify(IMAGE),'exact-image-not-tag');
 once("assert(/^sha256:[a-f0-9]{64}$/u.test(image)); report.native_media_image_id = image;",`assert.equal(image,${JSON.stringify(IMAGE)}); report.native_media_image_id = image;`,'returned-image-identity');
 once("update eps.workspace_candidates set selected_candidate_media_id='${mediaId}'", "${recovery33.fixtureSql()}\nupdate eps.workspace_candidates set selected_candidate_media_id='${mediaId}'",'authored-English-before-generation');
 once('const sourceSnapshot = await snapshot(sourceDb);','await recovery33.beforeBackup(scope,pendingJob); const sourceSnapshot = await snapshot(sourceDb);','all-populated37-capture-before-dump');
 once('report.restored_clone_profile=await preserveOriginalDumpProfile(restoreDb,sourceCatalogue);','await recovery33.beforeFullRestoreProfile(sourceCatalogue); report.restored_clone_profile=await preserveOriginalDumpProfile(restoreDb,sourceCatalogue);','strict37-ACL-before-GLOBAL-profile');
 once('report.metadata_exact_after_restore = true;','report.metadata_exact_after_restore = true; await recovery33.afterRestore(scope);','extra37-exact-before-recovery');
 once("report.job_recovery = { running_job_and_attempt_restored: true, controlled_expiry: true, exactly_one_recovered: true, stale_callback_stale_true_applied_false: true, job_queued_for_bounded_retry: true, completed_version_and_pdf_preserved: true };","report.job_recovery = { running_job_and_attempt_restored: true, controlled_expiry: true, exactly_one_recovered: true, stale_callback_stale_true_applied_false: true, job_queued_for_bounded_retry: true, completed_version_and_pdf_preserved: true }; await recovery33.freshRestoredLease(pendingJob,oldStageLease,pendingHash.hash);",'fresh-restored-trace-after-old-fences');
 once('report.restored_object_count = manifest.objects.length;','assert.equal(manifest.objects.length,4); report.restored_object_count = manifest.objects.length;','exact-four-referenced-objects');
 once('createRecoveryBundle({ root: privateRoot, runId, metadata, objects: objectInventory, objectBytes: objects, sourceFiles })','createRecoveryBundle({ root: privateRoot, runId, metadata, objects: objectInventory, objectBytes: objects, sourceFiles: recovery33.bundleSources(sourceFiles) })','bundle-internal-source-not-external-installation');
 const migrations=Object.keys(manifest.pins).filter(f=>/^supabase\/migrations\/[0-9]{14}_[^/]+\.sql$/u.test(f)).sort();assert.equal(migrations.length,37);
 once("const migrationFiles = (await readdir('supabase/migrations')).filter(file => file.endsWith('.sql')).map(file => `supabase/migrations/${file}`);",`const migrationFiles=${JSON.stringify(migrations)};assert.deepEqual((await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).map(f=>'supabase/migrations/'+f).sort(),migrationFiles);`,'exact-history37-source-inventory');
 const at=source.indexOf('sourcePaths.push(...');assert(at>0);source=source.slice(0,at)+`sourcePaths.push(...${JSON.stringify([...sources.keys()])});\n  `+source.slice(at);
 const seal='report.source_seals = Object.fromEntries([...sourceFiles].map(([file, bytes]) => [file, sha(bytes)]));';
 once(seal,seal+`\nfor(const[f,h]of Object.entries(${JSON.stringify(Object.fromEntries([...sources].map(([f,b])=>[f,sha(b)])))}))assert.equal(sha(sourceFiles.get(f)),h,'RECOVERY37_PREPARED_SOURCE_CHANGED');`,'complete-reviewed-graph-before-clone');
 return{source,manifest:{schema_version:'1.0',run_id:runId,purpose:'full-history37-synthetic-local-recovery',mode:'full',execution_enabled:EXECUTION_ENABLED,source_sha256:sha(source),source_pins:Object.fromEntries([...sources].map(([f,b])=>[f,sha(b)])),changes,media_image:IMAGE,operational_execution:false}};
}
