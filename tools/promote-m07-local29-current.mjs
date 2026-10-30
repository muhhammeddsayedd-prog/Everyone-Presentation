/** Additive current exact-profile guard. Frozen first helper/plan/proof stay unchanged. */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,open,readFile,readdir,unlink,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {runOwnedLocalSql,runReviewedSqlFile,verifyLocalTarget} from './local-postgres.mjs';
import {PROFILE,PROFILE_SHA,assertExactProfileBefore,assertExactProfileAfter,loadOriginalProfile29} from './m07-original-profile29-comparison.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),SELF='tools/promote-m07-local29-current.mjs',PLAN='development/m07/db/release29-plan.json',MANIFEST='development/local-db/reviewed.json';
const FOLDER='.local/m07-local29',CLAIM=FOLDER+'/promote.claim.json',LOCK='.local/local-postgres/test-db.lock',EVIDENCE='tracking/evidence/m07/local29-promotion';
const sha=value=>createHash('sha256').update(value).digest('hex'),read=file=>readFile(path.join(ROOT,file),'utf8'),json=async file=>JSON.parse(await read(file)),rows=value=>value.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
async function sealed(file,digest){const bytes=await readFile(path.join(ROOT,file));assert.equal(sha(bytes),digest,'M07_CURRENT_PROFILE_SOURCE_CHANGED');return bytes;}
export async function performExactProfilePromotion({before,profile,version,claim,dispatch,readback}){
 assertExactProfileBefore(before,profile);await claim();const result=await dispatch();assert.equal(result.result,'applied');const after=await readback();assertExactProfileAfter(after,profile,version);return{result,after};
}
async function inputs(){
 const profile=await loadOriginalProfile29(),plan=JSON.parse(await sealed(profile.plan,profile.plan_sha256));
 const manifest=await json(MANIFEST),baseline=JSON.parse(await sealed(plan.baseline,plan.baseline_sha256));assert.equal(manifest.migrations.length,29);assert.deepEqual(manifest.migrations.slice(0,28),baseline.migrations);assert.equal(manifest.migrations[28].path,plan.migration_path);assert.equal(manifest.migrations[28].sha256,plan.migration_sha256);
 assert.deepEqual((await readdir(path.join(ROOT,'supabase/migrations'))).filter(name=>name.endsWith('.sql')).sort(),manifest.migrations.map(value=>path.basename(value.path)));for(const value of manifest.migrations)await sealed(value.path,value.sha256);
 const rehearsal=JSON.parse(await sealed(profile.rehearsal.path,profile.rehearsal.sha256));
 const files=[SELF,PLAN,MANIFEST,PROFILE,'tools/m07-original-profile29-comparison.mjs','tests/operations/m07-original-profile29.test.mjs',profile.catalog_delta,profile.readback_query,profile.rehearsal.path];
 const seals=Object.fromEntries(await Promise.all(files.map(async file=>[file,sha(await readFile(path.join(ROOT,file)))])));
 return{profile,plan,rehearsal,seals};
}
async function roleIdentity(rehearsal){
 const names=rehearsal.existing_role_oids.roles.map(role=>"'"+role.name.replaceAll("'","''")+"'").join(',');
 const value=rows((await runOwnedLocalSql(`begin read only;select jsonb_build_object('roles',(select jsonb_agg(jsonb_build_object('oid',oid,'name',rolname,'login',rolcanlogin,'superuser',rolsuper,'bypass',rolbypassrls)order by rolname)from pg_roles where rolname in(${names})),'candidate_roles_absent',not exists(select 1 from pg_roles where rolname in('eps_settings_owner','eps_mcp_session_owner')));rollback;`)).stdout).at(-1);
 assert.deepEqual(value.roles,rehearsal.existing_role_oids.roles,'M07_EXISTING_ROLE_OIDS_CHANGED');return value;
}
async function refuseRepeat(){
 try{await readFile(path.join(ROOT,CLAIM));throw Error('M07_LOCAL29_CLAIM_ALREADY_EXISTS');}catch(error){if(error.code!=='ENOENT')throw error;}
 for(const file of(await readdir(path.join(ROOT,EVIDENCE))).filter(file=>file.endsWith('-promote.json'))){const value=await json(EVIDENCE+'/'+file);assert(!(value.dispatch_attempted===true||value.promotion?.result==='applied'||value.failure_code==='M07_LOCAL29_OUTCOME_UNCONFIRMED'),'M07_LOCAL29_PRIOR_WRITE_REQUIRES_READBACK');}
}
async function main(){
 const[action]=process.argv.slice(2);assert.equal(process.argv.length,3);assert(['inspect','promote','readback'].includes(action),'M07_FIXED_CURRENT_LOCAL29_ACTION_REQUIRED');
 const run=randomUUID();let locked=false,dispatched=false,lockOwner=run,priorClaim;const report={schema_version:'1.0',run_id:run,started_at:new Date().toISOString(),action,result:'failed',cloud_called:false,provider_called:false,credentials_loaded:false,automatic_retry:false,dispatch_attempted:false,comparison_profile:{path:PROFILE,sha256:PROFILE_SHA},scope:'Fixed owned local28->29 through exact original baseline-profile proof; no general ACL normalization or hash bypass.'};
 try{
  const context=await inputs(),{profile,plan,rehearsal,seals}=context;report.source_seals=seals;report.plan_sha256=profile.plan_sha256;
  await mkdir(path.join(ROOT,FOLDER),{recursive:true});
  if(action==='readback'){
   const claim=await json(CLAIM);assert.equal(claim.profile_sha256,PROFILE_SHA);assert.equal(claim.plan_sha256,profile.plan_sha256);assert.equal(claim.migration_sha256,plan.migration_sha256);assert.equal(claim.before_sha256,sha(JSON.stringify(profile.before)));lockOwner=claim.run_id;priorClaim=claim;
   const lock=await json(LOCK);assert.equal(lock.run_id,lockOwner);locked=true;dispatched=true;
  }else{const lock=await open(path.join(ROOT,LOCK),'wx',0o600);await lock.writeFile(JSON.stringify({run_id:run,pid:process.pid,purpose:'m07-current-profile29-'+action}));await lock.close();locked=true;}
  const target=await verifyLocalTarget();assert.equal(target.observed.system_identifier,'7701520506262638626');report.system_identifier=target.observed.system_identifier;
  if(priorClaim){assert.equal(priorClaim.system_identifier,target.observed.system_identifier);assert.equal(priorClaim.container_id,target.container.Id);report.reconciled_claim={run_id:priorClaim.run_id,profile_sha256:PROFILE_SHA,before_sha256:priorClaim.before_sha256};}
  const query=await read(profile.readback_query),readback=async()=>rows((await runOwnedLocalSql(query)).stdout).at(-1);report.before=await readback();const roles=await roleIdentity(rehearsal);report.existing_role_oids=roles.roles;
  if(action==='inspect'){
   if(isDeepStrictEqual(report.before,profile.before)){assert.equal(roles.candidate_roles_absent,true);report.stage='before29';}
   else{assertExactProfileAfter(report.before,profile,plan.version);assert.equal(roles.candidate_roles_absent,false);report.stage='after29';}
   report.readback=report.before;
  }else if(action==='readback'){
   assertExactProfileAfter(report.before,profile,plan.version);assert.equal(roles.candidate_roles_absent,false);report.after=report.before;report.before=profile.before;report.exact_proven_catalog_delta=true;report.old_business_auth_and_config_preserved=true;
  }else{
   assert.equal(roles.candidate_roles_absent,true);assertExactProfileBefore(report.before,profile);await refuseRepeat();
   const outcome=await performExactProfilePromotion({before:report.before,profile,version:plan.version,
    claim:async()=>{const file=await open(path.join(ROOT,CLAIM),'wx',0o600);await file.writeFile(JSON.stringify({run_id:run,system_identifier:target.observed.system_identifier,container_id:target.container.Id,profile_sha256:PROFILE_SHA,plan_sha256:profile.plan_sha256,migration_sha256:plan.migration_sha256,before_sha256:sha(JSON.stringify(report.before)),dispatch_may_have_occurred:true})+'\n');await file.sync();await file.close();},
    dispatch:async()=>{await inputs();dispatched=true;report.dispatch_attempted=true;return runReviewedSqlFile(plan.migration_path);},readback});
   report.promotion=outcome.result;report.after=outcome.after;report.exact_proven_catalog_delta=true;report.old_business_auth_and_config_preserved=true;await roleIdentity(rehearsal);
  }
  assert.equal((await verifyLocalTarget()).container.Id,target.container.Id);for(const[file,digest]of Object.entries(seals))await sealed(file,digest);await loadOriginalProfile29();report.sources_stable=true;report.result='passed';
 }catch(error){report.failure_code=dispatched?'M07_LOCAL29_OUTCOME_UNCONFIRMED':'M07_LOCAL29_PRECONDITION_UNCONFIRMED';await mkdir(path.join(ROOT,FOLDER),{recursive:true});await writeFile(path.join(ROOT,FOLDER,run+'-current-diagnostic.txt'),JSON.stringify({message:error.message,stack:error.stack},null,2),{mode:0o600});}
 finally{
  if(locked&&(!dispatched||report.result==='passed')){assert.equal((await json(LOCK)).run_id,lockOwner);await unlink(path.join(ROOT,LOCK));}report.lock_retained=locked&&dispatched&&report.result!=='passed';report.finished_at=new Date().toISOString();await mkdir(path.join(ROOT,EVIDENCE),{recursive:true});const file=EVIDENCE+'/'+report.finished_at.replace(/[:.]/gu,'-')+'-'+run.slice(0,8)+'-current-'+action+'.json';await writeFile(path.join(ROOT,file),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({result:report.result,evidence:file,stage:report.stage,dispatch_attempted:report.dispatch_attempted,lock_retained:report.lock_retained,cloud_called:false}));if(report.result!=='passed')process.exitCode=1;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
