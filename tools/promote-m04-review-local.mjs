/** Fixed reviewed21->22 local promotion. No cloud, fixtures or activation. */
import assert from 'node:assert/strict';
import {createHash,randomUUID}from'node:crypto';
import{mkdir,open,readFile,unlink,writeFile}from'node:fs/promises';
import path from'node:path';
import{isDeepStrictEqual}from'node:util';
import{runOwnedLocalSql,runReviewedSqlFile,verifyLocalTarget}from'./local-postgres.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');
const HARNESS='tools/promote-m04-review-local.mjs';
const PROOF='tracking/evidence/m04/review-local/2026-10-29T20-28-40-932Z-1473f485.json';
const PROOF_SHA='7d8005b472ac9184bfe19e61217d3b07f7b25b1e9eff4f03b1313804032396ff';
const MIGRATION='supabase/migrations/20261029202629_m04_review_series_processing.sql';
const MIGRATION_SHA='3f1543b9d4b525d486287f2f00711270ed1fbdc30911dac3aea725aee50679e4';
const BASELINE='development/m04/review-baseline21.json';
const BASELINE_SHA='1ecec87384926fea82b433d3ddfde386f64d09c17a946ac2aa6fd51b4831dedc';
const MANIFEST='development/local-db/reviewed.json';const QUERY='tools/sql/m04-review-readback.sql';
const LOCK=path.join(ROOT,'.local/local-postgres/test-db.lock');
const sha=value=>createHash('sha256').update(value).digest('hex');
const read=relative=>readFile(path.join(ROOT,relative));
const records=value=>value.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
async function snapshot(query){const rows=records((await runOwnedLocalSql(query)).stdout);assert.equal(rows.length,1);assert.equal(rows[0].query_role,'postgres');assert.equal(rows[0].unrestricted_visibility,true);return rows[0];}
async function main(){
 assert.equal(process.argv.length,2);const run=randomUUID();let locked=false;let dispatched=false;
 const report={run_id:run,started_at:new Date().toISOString(),result:'failed',cloud_called:false,provider_called:false,hosted_credentials_loaded:false,harness_path:HARNESS,harness_sha256:sha(await read(HARNESS)),proof:PROOF,proof_sha256:PROOF_SHA,migration_path:MIGRATION,migration_sha256:MIGRATION_SHA,scope:'Fixed exact owned local21-to22 DDL/history only. No fixtures, Auth identities, runtime/login changes, processing activation, n8n, provider or hosting operations.'};
 try{
  const proofBytes=await read(PROOF);assert.equal(sha(proofBytes),PROOF_SHA);const proof=JSON.parse(proofBytes);assert.equal(proof.result,'passed');for(const key of['behavior_assertions_passed','rollback_verified','owned_backend_settled','sources_stable','compact_release_readback_proven'])assert.equal(proof[key],true);assert.equal(proof.markers.length,13);assert.equal(new Set(proof.markers).size,13);assert.equal(proof.migration_path,MIGRATION);assert.equal(proof.migration_sha256,MIGRATION_SHA);assert.equal(proof.catalog_delta_sha256,sha(await read('development/m04/review-release-delta.json')));
  const baselineBytes=await read(BASELINE);assert.equal(sha(baselineBytes),BASELINE_SHA);const baseline=JSON.parse(baselineBytes);assert.equal(baseline.migrations.length,21);assert.equal(proof.source_sha256[MANIFEST],BASELINE_SHA);
  const manifest=JSON.parse(await read(MANIFEST));assert.equal(manifest.migrations.length,22);assert.deepEqual(manifest.migrations.slice(0,21),baseline.migrations);assert.equal(manifest.migrations[21].path,MIGRATION);assert.equal(manifest.migrations[21].sha256,MIGRATION_SHA);assert(manifest.migrations[21].reviewed_by.trim());assert(Number.isFinite(Date.parse(manifest.migrations[21].reviewed_at)));
  for(const row of manifest.migrations)assert.equal(sha(await read(row.path)),row.sha256,'ESTABLISHED_MIGRATION_BYTES_CHANGED');
  report.source_sha256={};for(const[file,digest]of Object.entries(proof.source_sha256)){const actual=sha(await read(file));if(file!==MANIFEST)assert.equal(actual,digest,'PROVEN_SOURCE_CHANGED');report.source_sha256[file]=actual;}
  for(const file of[BASELINE,HARNESS,'tools/local-postgres.mjs',PROOF])report.source_sha256[file]=sha(await read(file));
  const revalidate=async()=>{for(const[file,digest]of Object.entries(report.source_sha256))assert.equal(sha(await read(file)),digest,'SOURCE_CHANGED_BEFORE_DISPATCH');};
  const query=(await read(QUERY)).toString('utf8');const lock=await open(LOCK,'wx',0o600);try{await lock.writeFile(JSON.stringify({run_id:run,pid:process.pid}));locked=true;}finally{await lock.close();}
  const target=await verifyLocalTarget();assert.equal(target.config.container,'eps-presentation-canonical-pg17-local');assert.equal(target.observed.system_identifier,'7701520506262638626');report.before=await snapshot(query);assert.deepEqual(report.before,proof.readback_before,'FRESH_LOCAL21_MUST_EQUAL_PROVEN_BASELINE');
  await revalidate();dispatched=true;report.promotion=await runReviewedSqlFile(MIGRATION);assert.equal(report.promotion.result,'applied');report.after=await snapshot(query);const expected={...proof.readback_expected,versions:[...proof.readback_before.versions,'20261029202629']};assert.deepEqual(report.after,expected,'LOCAL22_MUST_EQUAL_EXACT_PROVEN_DISABLED_STATE');
  const actual=await verifyLocalTarget();assert.equal(actual.container.Id,target.container.Id);assert.equal(actual.observed.system_identifier,target.observed.system_identifier);await revalidate();report.sources_stable=true;report.exact_reviewed_catalog_delta=true;report.business_auth_runtime_and_old_configuration_preserved=true;report.new_processing_disabled=true;report.result='passed';
 }catch(error){report.dispatch_attempted=dispatched;report.diagnostic=dispatched?'LOCAL22_PROMOTION_OUTCOME_UNCONFIRMED':'LOCAL22_PROMOTION_PRECONDITION_UNCONFIRMED';report.safe_assertion=error?.code==='ERR_ASSERTION'?String(error.message).split('\n')[0].slice(0,200):null;if(dispatched){try{report.unverified_readback=await snapshot((await read(QUERY)).toString('utf8'));}catch{/* Preserve lock on an unknown committed outcome. */}}process.exitCode=1;
 }finally{
  if(locked&&(!dispatched||report.result==='passed')){const lock=JSON.parse(await readFile(LOCK,'utf8'));assert.equal(lock.run_id,run);assert.equal(lock.pid,process.pid);await unlink(LOCK);}report.lock_retained=locked&&dispatched&&report.result!=='passed';report.finished_at=new Date().toISOString();const dir=path.join(ROOT,'tracking/evidence/m04/review-promotion');await mkdir(dir,{recursive:true});const file=path.join(dir,report.finished_at.replace(/[:.]/gu,'-')+'-'+run.slice(0,8)+'.json');await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({result:report.result,receipt:path.relative(ROOT,file).replaceAll('\\','/'),lock_retained:report.lock_retained,diagnostic:report.diagnostic})+'\n');
 }
}
main().catch(()=>{process.stderr.write('Fixed local22 promotion stopped; no cloud fallback.\n');process.exitCode=1;});
