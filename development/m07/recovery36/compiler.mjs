/** Pure compiler plus bounded public-source loader. No database/provider calls. */
import assert from 'node:assert/strict';
import {readFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {compileController33,sha} from '../recovery33/compiler.mjs';
import {ownedPredicate33} from '../recovery33/ownership.mjs';
export {sha};
export const ROOT=path.resolve(import.meta.dirname,'../../..');
export const PURPOSE='development/m07/recovery36/';
export const EXECUTION_ENABLED=false;
export const MANIFEST_SHA='3a85938c9c6c1126e63db4b39dd31dab9c3d99585148670adec0b0550cf60117';
export const PURPOSE_FILES=['compiler.mjs','runtime.mjs','fixture.sql','run.mjs','recovery.test.mjs','README.md','frozen-inputs.json'];
export const PRIOR='tracking/evidence/m07/recovery33/2026-10-31T15-34-37-577Z-9af6774f.json';
export const MIGRATIONS=[
 ['supabase/migrations/20261031143711_m03_english_transcript_projection.sql','0705f1940abbc5c4afc65a49e85d9ef2ce6a6489178b6dd82c3acb33cf976472','\ncreate function eps.english_transcript_text_valid'],
 ['supabase/migrations/20261031182038_m07_workspace_summary.sql','cbb12610603318bce68ced4a58d0a9a01ee07737838c99a2ea0e6214e5e933e0','\ncreate function public.eps_get_workspace_summary'],
 ['supabase/migrations/20261101012057_m07_job_attempt_observability.sql','4209e16b7d67cfb793375d24dfd22f9fee72f3516e3dde16be1d2b0d633b7267','\ncreate role eps_job_trace_owner']];
const text=(sources,file)=>{assert(sources.get(file)instanceof Uint8Array);return Buffer.from(sources.get(file)).toString('utf8');};
function replaceOnce(value,old,next){assert.equal(value.split(old).length,2,'RECOVERY36_EXACT_SOURCE_SEAM_REQUIRED');return value.replace(old,()=>next);}
export function validateSources(sources){
 const bytes=sources.get(PURPOSE+'frozen-inputs.json');assert(bytes instanceof Uint8Array);assert.equal(sha(bytes),MANIFEST_SHA);
 const manifest=JSON.parse(Buffer.from(bytes));assert.equal(manifest.schema_version,'1.0');
 assert.deepEqual([...sources.keys()].sort(),[...new Set([...Object.keys(manifest.pins),...PURPOSE_FILES.map(f=>PURPOSE+f)])].sort());
 for(const[file,digest]of Object.entries(manifest.pins))assert.equal(sha(sources.get(file)),digest,'RECOVERY36_SOURCE_PIN_CHANGED');
 const prior=JSON.parse(text(sources,PRIOR));assert.equal(prior.result,'passed');assert.equal(prior.checkpoint,'complete');assert.equal(Object.keys(prior.source_seals).length,119);
 for(const key of ['cloud_called','provider_called','runtime_configuration_loaded','canonical_business_writes'])assert.equal(prior[key],false);
 for(const key of ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged','original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.equal(prior[key],true);
 const changed=Object.entries(prior.source_seals).filter(([file,digest])=>sha(sources.get(file))!==digest);
 assert.equal(changed.length,1);const [file,old]=changed[0];assert.equal(file,'development/m07/recovery33/README.md');
 assert.deepEqual(manifest.documentation_delta,{path:file,prior_sha256:old,current_sha256:sha(sources.get(file))});
}
export async function loadSources(){
 const raw=await readFile(path.join(ROOT,PURPOSE,'frozen-inputs.json'));assert.equal(sha(raw),MANIFEST_SHA);
 const pins=JSON.parse(raw).pins;const entries=[];
 for(const file of [...new Set([...Object.keys(pins),...PURPOSE_FILES.map(f=>PURPOSE+f)])]){
  assert(!path.isAbsolute(file)&&!file.includes('\\')&&!file.split('/').some(p=>!p||p==='..'||p==='.')&&!file.startsWith('.local/'));
  const target=path.join(ROOT,file),info=await lstat(target);assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.size<8*1024*1024&&await realpath(target)===target);
  entries.push([file,await readFile(target)]);
 }
 const result=new Map(entries);validateSources(result);return result;
}
export function adapters36(sources,identity){
 const owned=ownedPredicate33(identity);return MIGRATIONS.map(([file,digest,anchor],index)=>{
  const original=text(sources,file);assert.equal(sha(original),digest);assert.equal(original.split(anchor).length,2);
  const functional=original.slice(original.indexOf(anchor));let sql=original;
  if(index===0){const start=sql.indexOf("(current_database()<>'postgres'and not("),end=sql.indexOf('\n or(select array_agg(version',start);assert(start>0&&end>start);sql=replaceOnce(sql,sql.slice(start,end),'('+owned+')');}
  else if(index===1)sql=replaceOnce(sql,"current_database() <> 'postgres'",'('+owned+')');
  else{
   const history=/array\[([\s\S]*?)\]::text\[\]/u.exec(original)?.[0];assert(history);
   const admission=`set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';\ndo $recovery36$begin
 if current_user<>'postgres' or (${owned})
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from ${history}
 or to_regclass('eps.job_stage_attempts')is not null or to_regprocedure('eps.capture_job_stage_attempt()')is not null
 or exists(select 1 from pg_roles where rolname='eps_job_trace_owner')
 or exists(select 1 from pg_trigger where tgrelid='eps.jobs'::regclass and tgname='capture_job_stage_attempt')
 or(select encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex')from pg_proc where oid=to_regprocedure('public.eps_get_workspace_summary(uuid)'))is distinct from '6912140e41804faf2c2fd257a9b1ecac9eba8c3ccee5cbd7ff75fbff4d9be953'
 then raise exception'RECOVERY36_EXACT_OWNED35_REQUIRED';end if;end$recovery36$;\n`;
   sql=admission+functional;
  }
  assert.equal(sql.slice(sql.indexOf(anchor)),functional);
  return{file,version:path.basename(file).slice(0,14),sql,anchor,functional,source_sha256:digest,functional_sha256:sha(functional),adapted_sha256:sha(sql),admission_only:true};
 });
}
export function compileRecovery36(sources,{root,runId,mode='metadata'}){
 assert.equal(mode,'metadata');assert(path.isAbsolute(root));assert(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(runId));validateSources(sources);
 const base=compileController33(sources,{root,runId,mode:'metadata'});let source=base.source;const changes=[];
 const change=(old,next,label)=>{source=replaceOnce(source,old,next);changes.push({label,removed_sha256:sha(old),inserted_sha256:sha(next)});};
 change(`import { createRecovery33Context } from '${pathToFileURL(path.join(root,'development/m07/recovery33/runtime.mjs')).href}';`,`import { createRecovery36Context } from '${pathToFileURL(path.join(root,PURPOSE,'runtime.mjs')).href}';\nif(!${EXECUTION_ENABLED})throw Error('RECOVERY36_EXECUTION_DISABLED');`,'new-runtime-and-disabled-gate');
 change('recovery33 = createRecovery33Context(', 'recovery33 = createRecovery36Context(', 'wrapped-owned-upgrade-restore-cleanup');
 change("scope: 'AT-070 full owned29->33 metadata synthetic local restore; original29 and existing global roles preserved'","scope: 'AT-070 owned local36 populated metadata-only restore; no object bytes/Auth program/Storage HTTP/deployed proof'",'truthful-scope');
 change("'tracking/evidence/m07/recovery33'","'tracking/evidence/m07/recovery36'",'new-evidence-purpose');
 const push='sourcePaths.push(...';const at=source.indexOf(push);assert(at>0);source=source.slice(0,at)+`sourcePaths.push(...${JSON.stringify([...sources.keys()])});\n  `+source.slice(at);
 const seals='report.source_seals = Object.fromEntries([...sourceFiles].map(([file, bytes]) => [file, sha(bytes)]));';
 change(seals,seals+`\n for(const[file,digest]of Object.entries(${JSON.stringify(Object.fromEntries([...sources].map(([file,bytes])=>[file,sha(bytes)])))}))assert.equal(sha(sourceFiles.get(file)),digest,'RECOVERY36_PREPARED_SOURCE_CHANGED');`,'all-reviewed-source-bytes-before-clone');
 return{source,manifest:{schema_version:'1.0',run_id:runId,mode,execution_enabled:EXECUTION_ENABLED,source_sha256:sha(source),source_pins:Object.fromEntries([...sources].map(([file,bytes])=>[file,sha(bytes)])),substitutions:changes,inherited_substitutions:base.manifest.substitutions,functional_ddl_unchanged:true,native_media_executed:false,database_executed:false}};
}
