/** Pure compilation of a NEW local38 rehearsal. Importing never dispatches it. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {compileRecovery37,validateSources as validate37,adapters37,RECEIPTS as RECEIPTS37,sha} from '../recovery37/compiler.mjs';
import {ownedPredicate33} from '../recovery33/ownership.mjs';
export {sha};
export const ROOT=path.resolve(import.meta.dirname,'../../..');
export const PURPOSE='development/m07/recovery38/';
export const EXECUTION_ENABLED=true;
export const IMAGE='sha256:ea6e27d158a843fee524d7f43f2f88a4ede8bc58e8ac32578b7dec5c1594ba6b';
export const FILES=['compiler.mjs','runtime.mjs','run.mjs','recovery.test.mjs','frozen-inputs.json','README.md'];
export const MANIFEST_SHA='d9850feedaf734f15b9054cb476a566567280a086b768e58e71eccc8a4611af5';
export const MIGRATION38='supabase/migrations/20261101110939_m07_job_batch_filter.sql';
export const MIGRATION38_SHA='47af16421613320b76abc6e7119da92912859f0334b03b047a98492f75f6ea2d';
export const RECEIPTS={...RECEIPTS37,
 full37:['tracking/evidence/m07/recovery37/2026-11-01T10-25-49-755Z-7c2a8d9a.json','32a45739f183308d6d98d6a28fec9e65ba47679c15d4413737d70e75f85f3824'],
 bytes37:['tracking/evidence/m07/recovery37/2026-11-01T10-35-00-377771Z-source-checkpoint-bytes.json','87543a4940b6ad5e87ed562d65469d14fc7387c92c34ef29d4179efaa6d11e06'],
 apply38:['tracking/evidence/m07/job-batch-filter38-release/2026-11-01T17-28-00-388406Z-apply.json','6c29313263ab6e1ed62b653b376a5bec6b789deaf03e21ca48c48f7e7d14f94d'],
 readback38:['tracking/evidence/m07/job-batch-filter38-release/2026-11-01T17-28-42-546410Z-readback.json','1950fd161e98e4fdb37fe039a753230b73764c8a6721f1ce6f03f55896371a53']};
export const text=(sources,file)=>{assert(sources.get(file)instanceof Uint8Array);return Buffer.from(sources.get(file)).toString('utf8');};
const pins=sources=>Object.fromEntries([...sources].map(([f,b])=>[f,sha(b)]));
export async function checked(file){
 assert(typeof file==='string'&&!path.isAbsolute(file)&&!file.includes('\\')&&!file.startsWith('.local/')&&!file.split('/').some(v=>!v||v==='.'||v==='..'));
 const target=path.join(ROOT,file),s=await lstat(target);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<8*1024*1024&&await realpath(target)===target);return readFile(target);
}
/** Conservative closure of the known literal imports, including import type/export from. */
export function internalClosure(sources,seeds){
 const found=new Set(seeds),queue=[...seeds],unresolved=[];
 const resolve=base=>[base,base.replace(/\.js$/u,'.ts'),base+'.ts',base+'.tsx',base+'.json',base+'/index.ts'].find(f=>sources.has(f));
 while(queue.length){const file=queue.shift();assert(sources.has(file));if(!/\.[cm]?[jt]sx?$/u.test(file))continue;
  for(const match of text(sources,file).matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/gu)){
   const spec=match[1];let base;
   if(spec.startsWith('.'))base=path.posix.normalize(path.posix.join(path.posix.dirname(file),spec));
   else if(spec.startsWith('@eps/')){const[pkg,...rest]=spec.slice(5).split('/');base='packages/'+pkg+'/src/'+(rest.length?rest.join('/'):'index');if(spec==='@eps/central/specs-runtime')base='packages/central/src/specs-runtime-gateway';}
   else continue;
   const target=resolve(base);if(!target){unresolved.push({file,spec});continue;}if(!found.has(target)){found.add(target);queue.push(target);}
  }
 }
 return{files:[...found].sort(),unresolved};
}
export function validateSources(sources){
 assert(sources instanceof Map);assert.equal(sha(sources.get(PURPOSE+'frozen-inputs.json')),MANIFEST_SHA);
 const manifest=JSON.parse(text(sources,PURPOSE+'frozen-inputs.json'));
 assert.equal(manifest.schema_version,'1.0');assert.equal(manifest.media_image,IMAGE);assert.equal(manifest.source_checkpoint,'fe077d8ee9477065cf52d7496859e211f38a51df');
 assert.deepEqual([...sources.keys()].sort(),[...new Set([...Object.keys(manifest.pins),...FILES.map(f=>PURPOSE+f)])].sort());
 for(const[f,h]of Object.entries(manifest.pins))assert.equal(sha(sources.get(f)),h,'RECOVERY38_CURRENT_INPUT_CHANGED');
 assert.deepEqual(Object.keys(manifest.provenance_only).sort(),['apps/web/app/api/v1/[...segments]/route.ts','tests/server/foundation-list-query.test.ts']);
 for(const f of Object.keys(manifest.provenance_only))assert(!sources.has(f),'RECOVERY38_PROVENANCE_IS_NOT_NATIVE_BUNDLE');
 const graph=internalClosure(sources,manifest.internal_graph.files);assert.deepEqual(graph.unresolved,[]);assert.deepEqual(graph.files,manifest.internal_graph.files);assert.equal(graph.files.length,72);assert(graph.files.includes('packages/domain/src/job-filters.ts'));assert.equal(manifest.internal_graph.unresolved,0);
 const docs={};for(const[name,[file,h]]of Object.entries(RECEIPTS)){assert.equal(sha(sources.get(file)),h);docs[name]=JSON.parse(text(sources,file));}
 const p=docs.full37;assert.equal(p.result,'passed');assert.equal(p.checkpoint,'complete');assert.equal(Object.keys(p.source_seals).length,365);assert.equal(p.restored_object_count,4);
 for(const key of ['disposable_databases_removed','new33_roles_removed','new37_trace_role_removed','original_local_database_unchanged','original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.equal(p[key],true);
 for(const key of ['cloud_called','provider_called','runtime_configuration_loaded','canonical_business_writes'])assert.equal(p[key],false);
 assert.equal(p.full37_restore.result,'passed');assert.equal(manifest.historical37.source_count,365);assert.equal(manifest.historical37.git_blob_count,353);assert.equal(manifest.historical37.installed_count,12);
 assert.deepEqual(Object.fromEntries(Object.entries(manifest.historical37.inputs).map(([f,v])=>[f,v.sha256])),p.source_seals);
 const delta=Object.entries(p.source_seals).filter(([f,h])=>sha(sources.get(f))!==h).map(([f,h])=>({path:f,historical_sha256:h,current_sha256:sha(sources.get(f))})).sort((a,b)=>a.path.localeCompare(b.path));
 assert.deepEqual(delta,manifest.historical_to_current_deltas);assert.equal(delta.length,5);
 const a=docs.apply38,r=docs.readback38;assert.equal(a.action,'apply');assert.equal(a.result,'passed');assert.equal(a.normal_return_marker_observed,true);assert.equal(a.independent_readback_verified,true);assert.deepEqual(a.first,a.second);
 assert.equal(r.result,'observed_applied');assert.equal(r.two_static_reads_equal,true);assert.deepEqual(r.static_schema_after,a.static_schema_after);assert.equal(r.target,a.target);assert.equal(r.target,'pyibofyctwnqpvktepse');
 assert.equal(r.static_schema_after.history.length,38);assert.equal(r.static_schema_after.history.at(-1),'20261101110939');assert.equal(a.migration_sha256,MIGRATION38_SHA);assert.equal(r.migration_sha256,MIGRATION38_SHA);
 for(const[f,h]of Object.entries(r.source_pins))assert.equal(sha(sources.get(f)),h,'RECOVERY38_POST_RELEASE_SOURCE_CHANGED');
 for(const f of Object.keys(r.source_pins))assert(Object.hasOwn(a.source_pins,f));
 const releaseDelta=Object.entries(a.source_pins).filter(([f,h])=>sources.has(f)&&h!==sha(sources.get(f))).map(([f,h])=>({path:f,historical_sha256:h,current_sha256:sha(sources.get(f))})).sort((a,b)=>a.path.localeCompare(b.path));assert.deepEqual(releaseDelta,delta);
 assert.equal(sha(sources.get(MIGRATION38)),MIGRATION38_SHA);return{manifest,docs};
}
export function validateInputs({sources,historical,provenance}){
 const{manifest,docs}=validateSources(sources);validate37(historical);assert.deepEqual(pins(historical),docs.full37.source_seals);
 assert(provenance instanceof Map);assert.deepEqual(pins(provenance),manifest.provenance_only);
 for(const[f,v]of Object.entries(manifest.historical37.inputs)){assert.equal(historical.get(f).length,v.bytes);assert.equal(sha(historical.get(f)),v.sha256);}
 return{manifest,docs};
}
export async function loadInputs(){
 const raw=await checked(PURPOSE+'frozen-inputs.json');assert.equal(sha(raw),MANIFEST_SHA);const manifest=JSON.parse(raw),sources=new Map(),provenance=new Map(),historical=new Map();
 for(const f of new Set([...Object.keys(manifest.pins),...FILES.map(f=>PURPOSE+f)]))sources.set(f,await checked(f));
 for(const f of Object.keys(manifest.provenance_only))provenance.set(f,await checked(f));
 const entries=Object.entries(manifest.historical37.inputs).filter(([,v])=>v.git_blob),request=entries.map(([f])=>manifest.historical37.git_checkpoint+':'+f+'\n').join('');
 const result=spawnSync('git',['cat-file','--batch'],{cwd:ROOT,input:request,windowsHide:true,maxBuffer:32*1024*1024,timeout:30000});assert.equal(result.status,0,'RECOVERY38_HISTORICAL_SOURCE_UNAVAILABLE');let at=0;
 for(const[f,v]of entries){const end=result.stdout.indexOf(10,at),header=result.stdout.subarray(at,end).toString().split(' ');assert(end>at);assert.deepEqual(header,[v.git_blob,'blob',String(v.bytes)]);const b=result.stdout.subarray(end+1,end+1+v.bytes);assert.equal(sha(b),v.sha256);assert.equal(result.stdout[end+1+v.bytes],10);historical.set(f,Buffer.from(b));at=end+v.bytes+2;}
 assert.equal(at,result.stdout.length);for(const[f,v]of Object.entries(manifest.historical37.inputs))if(v.external_installed){const b=await checked(f);assert.equal(sha(b),v.sha256);historical.set(f,b);}
 const inputs={sources,historical,provenance};validateInputs(inputs);return inputs;
}
export function adapters38(sources,identity){
 const list=adapters37(sources,identity),original=text(sources,MIGRATION38);assert.equal(sha(original),MIGRATION38_SHA);assert.equal(original.split('\nbegin;\n').length,2);assert(original.endsWith('\ncommit;\n'));
 let sql=original.replace('\nbegin;\n','\n').slice(0,-'commit;\n'.length);assert.equal(sql.split("current_database()<>'postgres'").length,2);sql=sql.replace("current_database()<>'postgres'",'('+ownedPredicate33(identity)+')');
 // The unchanged local transport authenticates as supabase_admin, then SET LOCAL ROLE postgres.
 // Keep both identities constrained; SET ROLE does not change session_user.
 assert.equal(sql.split("session_user<>'postgres'").length,2);sql=sql.replace("session_user<>'postgres'","session_user<>'supabase_admin'");
 const anchor='\ncreate function public.eps_list_jobs_by_batch(';assert.equal(original.split(anchor).length,2);assert.equal(sql.slice(sql.indexOf(anchor)),original.slice(original.indexOf(anchor),-'commit;\n'.length));
 return[...list,{file:MIGRATION38,version:'20261101110939',sql,anchor,functional:original.slice(original.indexOf(anchor),-'commit;\n'.length),source_sha256:MIGRATION38_SHA,adapted_sha256:sha(sql),admission_only:true,owned_session_user:'supabase_admin',owned_current_user:'postgres'}];
}
export function compileRecovery38(inputs,{root=ROOT,runId}){
 const{sources,historical,provenance}=inputs,{manifest,docs}=validateInputs(inputs);assert(path.isAbsolute(root));assert(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(runId));assert(!Object.values(docs).some(v=>v.run_id===runId));
 let source=compileRecovery37(historical,{root,runId}).source;const changes=[];
 const once=(a,b,label)=>{assert.equal(source.split(a).length,2,'RECOVERY38_EXACT_FULL_SEAM:'+label);source=source.replace(a,()=>b);changes.push({label,before_sha256:sha(a),after_sha256:sha(b)});};
 once(`import { createRecovery37Context } from '${pathToFileURL(path.join(root,'development/m07/recovery37/runtime.mjs')).href}';\nif(!true)throw Error('RECOVERY37_EXECUTION_DISABLED');`,`import { createRecovery38Context } from '${pathToFileURL(path.join(root,PURPOSE,'runtime.mjs')).href}';\nif(!${EXECUTION_ENABLED})throw Error('RECOVERY38_EXECUTION_DISABLED');`,'new-disabled-purpose');
 once('recovery33 = createRecovery37Context(','recovery33 = createRecovery38Context(','new-context');
 once("scope: 'AT-070 owned full history37 synthetic metadata/filesystem/native PDF-video restore; no Storage HTTP/provider/deployed/independent/RTO proof'","scope: 'AT-070 owned local38 metadata/four synthetic filesystem objects/native PDF-video; historical media engine ea6e only; no full web/installed distribution/hosted50082 configuration/Storage HTTP/provider/deployed/independent/RTO/RPO proof'",'bounded-current38-scope');
 once("'tracking/evidence/m07/recovery37'","'tracking/evidence/m07/recovery38'",'new-receipts');
 const priorMigrations=[...historical.keys()].filter(f=>/^supabase\/migrations\/[0-9]{14}_[^/]+\.sql$/u.test(f)).sort(),migrations=[...sources.keys()].filter(f=>/^supabase\/migrations\/[0-9]{14}_[^/]+\.sql$/u.test(f)).sort();assert.equal(priorMigrations.length,37);assert.equal(migrations.length,38);
 once('const migrationFiles='+JSON.stringify(priorMigrations)+';','const migrationFiles='+JSON.stringify(migrations)+';','exact-history38-inventory');
 once('sourcePaths.push(...'+JSON.stringify([...historical.keys()])+');','sourcePaths.push(...'+JSON.stringify([...sources.keys()])+');','current-core-not-historical-five');
 once(`for(const[f,h]of Object.entries(${JSON.stringify(pins(historical))}))assert.equal(sha(sourceFiles.get(f)),h,'RECOVERY37_PREPARED_SOURCE_CHANGED');`,`for(const[f,h]of Object.entries(${JSON.stringify(pins(sources))}))assert.equal(sha(sourceFiles.get(f)),h,'RECOVERY38_PREPARED_SOURCE_CHANGED');\nreport.provenance_only_inputs=${JSON.stringify(pins(provenance))};for(const[f,h]of Object.entries(report.provenance_only_inputs))assert.equal(sha(await readFile(f)),h,'RECOVERY38_PROVENANCE_CHANGED');\nreport.provenance_only_inputs_restored=false;report.source_checkpoint=${JSON.stringify(manifest.source_checkpoint)};report.historical_blueprint_source_count=365;report.source_bundle_scope='current72 native dependency cohort plus sealed rehearsal sources; provenance2 excluded; no full web restore';`,'current-seal-and-separated-provenance-before-clone');
 return{source,manifest:{schema_version:'1.0',run_id:runId,purpose:'full-history38-synthetic-local-recovery',mode:'full',execution_enabled:EXECUTION_ENABLED,source_sha256:sha(source),source_pins:pins(sources),provenance_only_inputs:pins(provenance),historical_blueprint_source_count:365,historical_blueprint_checkpoint:manifest.historical37.git_checkpoint,source_checkpoint:manifest.source_checkpoint,changes,media_image:IMAGE,operational_execution:false}};
}
