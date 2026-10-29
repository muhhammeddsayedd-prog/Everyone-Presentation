/** New M04 series/review rollback proof on the exact owned local21; no cloud IO. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { setTimeout,clearTimeout } from 'node:timers';
import { isDeepStrictEqual } from 'node:util';
import { runOwnedLocalSql, verifyLocalTarget } from './local-postgres.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const FILES=['development/m04/review-series.sql','tests/db/m04-review.sql','tests/db/m04-assignments-fixture.sql','tools/sql/m04-review-local-snapshot.sql','development/local-db/reviewed.json','development/m04/retirement-undo.sql','tests/db/m04-retirement-undo.sql','development/m04/review-processing.sql','tests/db/m04-review-processing.sql'];
const MARKERS=['M04_REVIEW_SERIES_POLICY_SNAPSHOT_SCOPE_REPLAY_PASSED','M04_REVIEW_TEN_FIELDS_ORDER_PENDING_AND_SHARED_FACT_FINGERPRINT_PASSED','M04_REVIEW_MEDIA_PIN_HASH_ORDER_AND_UNRELATED_PROCESSING_STABILITY_PASSED','M04_REVIEW_SCOPE_REVIEWED_PERMISSION_AND_TEMPLATE_BINDING_PASSED','M04_ROLE_RETIREMENT_TYPED_UNDO_HISTORY_AND_REPLAY_PASSED','M04_POOL_RETIREMENT_UNDO_MAIN_CONFLICT_STALE_AND_LIBRARY_PRESERVATION_PASSED','M04_SLOT_RETIREMENT_COMPLETE_INVERSE_CURRENT_AUTHORITY_PASSED','M04_AI_DURABLE_THREE_STAGES_SOURCE_BINDING_REPLAY_AND_NO_AUTOAPPLY_PASSED','M04_AI_SHARED_SOURCE_CHANGE_WITHOUT_ASSIGNMENT_REVISION_BLOCKS_PUBLISH_PASSED','M04_NATIVE_FIT_JOB_HASH_FONT_FENCE_AND_MISSING_CONTENT_FLEXIBILITY_PASSED','M04_FIT_CANONICAL_CHANGED_INPUT_AND_PRIVATE_SERVICE_SCOPE_PASSED'];
MARKERS.push('M04_PUBLIC_NEW_KIND_CANCEL_RETRY_REPLAY_AND_LATE_CALLBACK_PASSED');
MARKERS.push('M04_DIRECT_RPC_NULL_AND_WRONG_TYPE_INPUTS_REJECTED_PASSED');
const sha=value=>createHash('sha256').update(value).digest('hex');
const CATALOG='tools/sql/m04-review-catalog.sql';const NEW_STATE='tools/sql/m04-review-new-state.sql';FILES.push(CATALOG,NEW_STATE);
const HARNESS='tools/test-m04-review-local.mjs';const RACE_PROOF='tracking/evidence/m04/review-race-local/2026-10-29T20-25-05-251Z-7b9b9fa1.json';FILES.push(HARNESS,RACE_PROOF);
const MIGRATION='supabase/migrations/20261029202629_m04_review_series_processing.sql';FILES.push(MIGRATION);
const READBACK='tools/sql/m04-review-readback.sql';const DELTA='development/m04/review-release-delta.json';FILES.push(READBACK,DELTA);
function catalogDelta(before,after){const changes={created:{},changed:{},deleted:{}};for(const[name,value]of Object.entries(after))if(!(name in before))changes.created[name]=value;else if(!isDeepStrictEqual(value,before[name]))changes.changed[name]={before:before[name],after:value};for(const[name,value]of Object.entries(before))if(!(name in after))changes.deleted[name]=value;return changes;}
const records=value=>value.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
async function snapshot(source){const output=await runOwnedLocalSql(source);const data=records(output.stdout);assert.equal(data.length,1);return data[0];}
async function execute(sql,container){
 assert(Buffer.byteLength(sql)<=512*1024);const endpoint=process.platform==='win32'?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock';
 return await new Promise((resolve,reject)=>{const child=spawn('docker',['--host',endpoint,'exec','--user','postgres','-i',container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','supabase_admin','-d','postgres'],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';let stopped=false;
 const timer=setTimeout(()=>{stopped=true;child.kill();},60000);child.stdout.on('data',v=>{stdout+=v;if(Buffer.byteLength(stdout)>4*1024*1024){stopped=true;child.kill();}});child.stderr.on('data',v=>{stderr+=v;if(Buffer.byteLength(stderr)>65536){stopped=true;child.kill();}});child.once('error',()=>{clearTimeout(timer);reject(new Error('OWNED_TRANSPORT_UNCONFIRMED'));});child.once('close',code=>{clearTimeout(timer);if(code!==0||stopped)reject(new Error(stderr||'OWNED_SQL_UNCONFIRMED'));else resolve({stdout,stderr});});child.stdin.on('error',()=>undefined);child.stdin.end(sql);});
}
async function main(){
 assert(process.argv.length===2||process.argv.length===3&&process.argv[2]==='red');const red=process.argv[2]==='red';
 const run=randomUUID();const application=`eps-m04-review-${run}`;const lockFile=path.join(ROOT,'.local/local-postgres/test-db.lock');let locked=false;let before;let beforeCatalog;let report;let settled=false;
 const sources=Object.fromEntries(await Promise.all(FILES.map(async name=>[name,await readFile(path.join(ROOT,name),'utf8')])));const seals=Object.fromEntries(Object.entries(sources).map(([name,text])=>[name,sha(text)]));
 const sourceBytes=Object.fromEntries(await Promise.all(FILES.map(async name=>[name,sha(await readFile(path.join(ROOT,name)))])));
 const target=await verifyLocalTarget();assert.equal(target.config.container,'eps-presentation-canonical-pg17-local');assert.equal(target.observed.system_identifier,'7701520506262638626');
 const manifest=JSON.parse(sources['development/local-db/reviewed.json']);assert.equal(manifest.migrations.length,21);for(const item of manifest.migrations)assert.equal(sha(await readFile(path.join(ROOT,item.path))),item.sha256);
 const race=JSON.parse(sources[RACE_PROOF]);assert.equal(race.result,'passed');for(const field of['canonical21_unchanged','managed_auth_metadata_and_row_revisions_preserved','disposable_cleanup_verified','sources_stable'])assert.equal(race[field],true);for(const file of[FILES[0],FILES[5],FILES[7]])assert.equal(race.source_seals[file],seals[file],'RACE_PROVEN_SQL_CHANGED');
 assert.equal(sources[MIGRATION],[sources[FILES[0]],sources[FILES[5]],sources[FILES[7]]].join('\n'),'EXACT_FROZEN_FRAGMENT_COMPOSITION_REQUIRED');
 const reviewedDelta=JSON.parse(sources[DELTA]);assert.equal(sourceBytes[DELTA],sha(JSON.stringify(reviewedDelta,null,2)+'\n'),'EXACT_DELTA_SERIALIZATION_REQUIRED');
 report={run_id:run,started_at:new Date().toISOString(),result:'failed',mode:red?'red_missing_implementation':'candidate',scope:'Owned local21 SQL compilation, non-owner public RPC behavior and exact transaction rollback; synthetic Auth claims, not hosted authentication.',cloud_called:false,provider_called:false,hosted_credentials_loaded:false,source_sha256:sourceBytes,harness_path:HARNESS,harness_sha256:sourceBytes[HARNESS],race_proof:RACE_PROOF,race_proof_sha256:sourceBytes[RACE_PROOF],migration_path:MIGRATION,migration_sha256:sourceBytes[MIGRATION],markers:red?[]:MARKERS};
 try{
  const handle=await open(lockFile,'wx',0o600);await handle.writeFile(JSON.stringify({run_id:run,pid:process.pid}));await handle.close();locked=true;
  before=await snapshot(sources[FILES[3]]);assert.equal(before.versions.length,21);
  report.before=before;
  beforeCatalog=records((await runOwnedLocalSql(`begin isolation level repeatable read read only;set local search_path='';${sources[CATALOG]}rollback;`)).stdout)[0];
  const readbackBefore=records((await runOwnedLocalSql(sources[READBACK])).stdout);assert.equal(readbackBefore.length,1);report.readback_before=readbackBefore[0];
  if(red){await runOwnedLocalSql("begin;select public.eps_get_workspace_review('8a2a0000-0000-4000-8000-000000000001','8a7a0000-0000-4000-8000-000000000001',null);rollback;");throw new Error('RED_DID_NOT_FAIL');}
  assert(!sources[FILES[0]].includes('__TEMPLATE_CONTENT_SHA256__'),'ACTUAL_REGISTERED_TEMPLATE_SHA_REQUIRED');
  const sql=`begin;set local role postgres;set local application_name='eps-m04-review-${run}';do $$begin if current_user<>'postgres'or session_user<>'supabase_admin'or current_database()<>'postgres'or inet_client_addr()is not null or(select system_identifier::text from pg_control_system())<>'7701520506262638626'then raise exception'EXACT_OWNED_LOCAL_UNIX_REQUIRED';end if;end$$;${sources[MIGRATION]}\nsavepoint fixtures;set local role supabase_auth_admin;alter table auth.users enable row level security;set local role postgres;${sources[FILES[2]]}\n${sources[FILES[1]]}\nrollback to savepoint fixtures;release savepoint fixtures;savepoint inverse;set local role postgres;${sources[FILES[2]]}\n${sources[FILES[6]]}\nrollback to savepoint inverse;release savepoint inverse;savepoint processing;set local role postgres;${sources[FILES[2]]}\n${sources[FILES[8]]}\nrollback to savepoint processing;release savepoint processing;rollback;`;
  assert.equal((sources[READBACK].match(/^begin isolation level repeatable read read only;/gmu)??[]).length,1);assert.equal((sources[READBACK].match(/^rollback;/gmu)??[]).length,1);
  const nestedReadback=sources[READBACK].replace(/^begin isolation level repeatable read read only;/mu,'').replace(/^rollback;/mu,'');
  const result=await execute(sql.replace('savepoint fixtures;',`${sources[CATALOG]}${sources[NEW_STATE]}${nestedReadback}savepoint fixtures;`),target.container.Id);for(const marker of MARKERS)assert.equal(result.stdout.split(/\r?\n/u).filter(line=>line===marker).length,1,marker);
  const [expectedCatalog,newState,readbackExpected]=records(result.stdout);assert(expectedCatalog&&Object.keys(expectedCatalog).some(key=>key.startsWith('functions|')));report.catalog_delta={schema_version:'1.0',...catalogDelta(beforeCatalog,expectedCatalog),...newState};report.catalog_delta_sha256=sha(JSON.stringify(report.catalog_delta,null,2)+'\n');report.catalog_before_sha256=sha(JSON.stringify(beforeCatalog));report.catalog_expected_sha256=sha(JSON.stringify(expectedCatalog));assert.deepEqual(report.catalog_delta,reviewedDelta,'RELEASE_DELTA_MUST_MATCH_ACTUAL_ROLLED_BACK_DDL');
  const beforeReadback=report.readback_before;assert.equal(readbackExpected.catalog_protected_sha256,beforeReadback.catalog_protected_sha256,'UNREVIEWED_CATALOG_FIELD_CHANGED');
  assert.equal(readbackExpected.catalog_count,beforeReadback.catalog_count+Object.keys(reviewedDelta.created).length-Object.keys(reviewedDelta.deleted).length);
  const expectedBefore=Object.fromEntries([...Object.entries(reviewedDelta.changed).map(([key,value])=>[key,value.before]),...Object.entries(reviewedDelta.deleted)]);const expectedAfter={...reviewedDelta.created,...Object.fromEntries(Object.entries(reviewedDelta.changed).map(([key,value])=>[key,value.after]))};assert.deepEqual(beforeReadback.catalog_delta_values,expectedBefore);assert.deepEqual(readbackExpected.catalog_delta_values,expectedAfter);
  assert.deepEqual(beforeReadback.review_state,{config:null,template:null});assert.deepEqual(readbackExpected.review_state,reviewedDelta.review_state);
  for(const[table,value]of Object.entries(beforeReadback.counts))assert.equal(readbackExpected.counts[table],value);for(const[table,value]of Object.entries(beforeReadback.data_sha256))assert.equal(readbackExpected.data_sha256[table],value);
  for(const[table,value]of Object.entries(reviewedDelta.new_tables)){assert.equal(readbackExpected.counts[table],value.count);assert.equal(readbackExpected.data_sha256[table],value.sha256);}
  for(const key of Object.keys(beforeReadback).filter(key=>!['counts','data_sha256','catalog_full_sha256','catalog_count','catalog_delta_values','review_state'].includes(key)))assert.deepEqual(readbackExpected[key],beforeReadback[key],`UNCHANGED_READBACK_FIELD_REQUIRED:${key}`);
  report.readback_expected=readbackExpected;report.compact_release_readback_proven=true;
  report.behavior_assertions_passed=true;report.stdout_sha256=sha(result.stdout);report.stderr_sha256=sha(result.stderr);
 }catch(error){
  const dir=path.join(ROOT,'.local/m04-review-local',run);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'diagnostic.txt'),String(error.stack??error));report.private_diagnostic=path.relative(ROOT,path.join(dir,'diagnostic.txt')).replaceAll('\\','/');report.code=red?'EXPECTED_MISSING_IMPLEMENTATION':'M04_REVIEW_LOCAL_UNCONFIRMED';
 }finally{
  if(locked){try{settled=records((await runOwnedLocalSql(`begin read only;select jsonb_build_object('count',count(*))from pg_stat_activity where application_name='${application}';rollback;`)).stdout)[0].count===0;}catch{/* Retain the lock unless the owned backend is confirmed closed. */}}
  report.owned_backend_settled=settled;
  if(locked&&before&&settled){try{const after=await snapshot(sources[FILES[3]]);report.before=before;report.after=after;report.rollback_verified=isDeepStrictEqual(before,after);report.sources_stable=(await Promise.all(Object.entries(sourceBytes).map(async([name,digest])=>sha(await readFile(path.join(ROOT,name)))===digest))).every(Boolean);if(report.behavior_assertions_passed&&report.rollback_verified&&report.sources_stable)report.result='passed';if(red&&report.code==='EXPECTED_MISSING_IMPLEMENTATION'&&report.rollback_verified)report.result='expected_red';}catch{report.rollback_verified=false;}}
  if(locked&&settled&&report.rollback_verified){const lock=JSON.parse(await readFile(lockFile,'utf8'));assert.equal(lock.run_id,run);assert.equal(lock.pid,process.pid);await unlink(lockFile);}
  report.finished_at=new Date().toISOString();const dir=path.join(ROOT,'tracking/evidence/m04/review-local');await mkdir(dir,{recursive:true});const name=path.join(dir,report.finished_at.replace(/[:.]/gu,'-')+'-'+run.slice(0,8)+'.json');await writeFile(name,JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({result:report.result,receipt:path.relative(ROOT,name).replaceAll('\\','/'),rollback_verified:report.rollback_verified,sources_stable:report.sources_stable})+'\n');if(report.result!=='passed'&&report.result!=='expected_red')process.exitCode=1;
 }
}
main().catch(()=>{process.stderr.write('M04 local review proof stopped; no external fallback.\n');process.exitCode=1;});
