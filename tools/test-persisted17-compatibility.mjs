/** Fixed persisted17 specs and candidate compatibility boundary, one rollback, no credentials/provider. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash,randomUUID } from 'node:crypto';
import { mkdir,open,readFile,unlink,writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout,setTimeout } from 'node:timers';
import { isDeepStrictEqual } from 'node:util';
import { runOwnedLocalSql } from './local-postgres.mjs';
import { verifyNativeSpecsLocalTarget } from './lib/native-specs-local-transport.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');
const FILES=['tests/db/m02-specs-assets-candidate.sql','tests/db/m02-pdf-vision-prepare.sql','tests/db/m02-pdf-vision-assertions.sql',
 'tests/db/m03-candidate-kernel.sql','tests/db/m03-candidate-kernel-behavior.sql','tests/db/m03-candidate-lifecycle.sql','tests/db/m03-candidate-partial-issues.sql','tests/db/m03-candidate-batch-control.sql'];
const LOCK=path.join(ROOT,'.local/local-postgres/test-db.lock');
const SYSTEM='7701520506262638626';
const hash=value=>createHash('sha256').update(value).digest('hex');
let containerId;
async function target(){const value=await verifyNativeSpecsLocalTarget();assert.equal(value.observed.system_identifier,SYSTEM);if(containerId)assert.equal(value.container.Id,containerId);else containerId=value.container.Id;return value;}
async function snapshot(){await target();const value=await runOwnedLocalSql(await readFile(path.join(ROOT,'tools/sql/candidate-pipeline-readback.sql'),'utf8'));
 const rows=value.stdout.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));assert.equal(rows.length,1);assert.equal(rows[0].versions.length,17);return rows[0];}
async function execute(sql,runId){
 const pinned=await target();const endpoint=process.platform==='win32'?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock';
 assert(Buffer.byteLength(sql,'utf8')<256*1024);
 return await new Promise((resolve,reject)=>{
  const child=spawn('docker',['--host',endpoint,'exec','--user','postgres','-i',pinned.container.Id,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','supabase_admin','-d','postgres'],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
  let stdout='';let stderr='';let stopped=false;const timer=setTimeout(()=>{stopped=true;child.kill();},45000);
  child.stdout.on('data',chunk=>{stdout+=chunk.toString('utf8');if(stdout.length>1000000){stopped=true;child.kill();}});
  child.stderr.on('data',chunk=>{stderr+=chunk.toString('utf8');if(stderr.length>65536){stopped=true;child.kill();}});
  child.on('error',()=>{clearTimeout(timer);reject(new Error('FIXED_LOCAL_TRANSPORT_UNCONFIRMED'));});
  child.on('close',code=>{clearTimeout(timer);if(code!==0||stopped)reject(new Error(stderr.slice(0,8000)||'FIXED_LOCAL_SQL_UNCONFIRMED'));else resolve(stdout);});
  child.stdin.end(`begin;set local application_name='eps-candidate-kernel-${runId}';set local lock_timeout='5s';set local statement_timeout='30s';
set local role supabase_auth_admin;alter table auth.users enable row level security;reset role;set local role postgres;
set local eps.local_fixture_tests='eps-presentation-canonical-pg17-local';set local eps.m03_candidate_rehearsal='rollback-only-v1';set local eps.specs_assets_rehearsal='rollback-only-v1';\n${sql}\nrollback;`);
 });
}
async function main(){
 assert.equal(process.argv.length,2);const runId=randomUUID();const fragments=await Promise.all(FILES.map(async file=>[file,await readFile(path.join(ROOT,file),'utf8')]));
 const seals=Object.fromEntries(fragments.map(([file,source])=>[file,hash(source)]));
 const report={run_id:runId,started_at:new Date().toISOString(),result:'failed',cloud_called:false,provider_called:false,credential_files_read:false,
  scope:'Persisted17 synthetic SQL: existing M02 PDF/DOCX/vision through new bridges and seven M03 state/permission cases in separate rolled-back fixture transactions; no native/bytes/provider/cloud.',source_seals:seals,harness_sha256:hash(await readFile(import.meta.filename))};
 let owns=false;let before;
 try{
  const lock=await open(LOCK,'wx',0o600);try{await lock.writeFile(JSON.stringify({run_id:runId,pid:process.pid}));owns=true;}finally{await lock.close();}
  before=await snapshot();report.before_sha256=hash(JSON.stringify(before));
  const prepare=fragments[1][1];
  const red=" execute 'set local role eps_specs_assets_executor';perform pg_temp.asset_expect('select eps.store_specs_preparation(current_setting(''eps.vision.scope'')::jsonb)','RESULT_INVALID');execute 'set local role postgres';";
  assert.equal(prepare.split(red).length,2);
  // This historical fixture's one pre16 RED expectation is removed only in
  // this persisted17 regression. Its GREEN validation is executed unchanged.
  const specs=await execute([fragments[0][1],prepare.replace(red,'').replace("select 'PDF_VISION_RED_CURRENT_METHOD_REJECTED';",''),fragments[2][1]].join('\n'),runId+'-specs');
  assert.equal(specs.split(/\r?\n/u).filter(line=>line==='PDF_VISION_GREEN_PAGES_CALLBACK_AND_FORMAT_GUARDS_PASSED').length,1);
  report.specs_assets_and_vision_dispatch_passed=true;
  const output=await execute(fragments.slice(3).map(([,source])=>source).join('\n'),runId+'-candidate');
  for(const marker of ['CANDIDATE_KERNEL_SILENT_FLOW_AND_PRIVATE_FENCES_PASSED','CANDIDATE_GROUNDED_TRANSCRIPT_FRAME_AND_EVIDENCE_GUARD_PASSED','CANDIDATE_MANUAL_GUARD_AND_EXISTING_MEDIA_PINNING_PASSED','CANDIDATE_EXPIRED_RECOVERY_STALE_CANCEL_AND_GUEST_PASSED','CANDIDATE_RETAINED_HISTORY_EXPLICIT_LINK_AND_REASON_PARITY_PASSED','CANDIDATE_SAFE_PARTIAL_PROCESSING_ISSUES_PASSED','CANDIDATE_200_SYNTHETIC_CONTROL_PLANE_AND_BOUNDED_SCHEDULING_PASSED'])assert.equal(output.split(/\r?\n/u).filter(line=>line===marker).length,1);report.assertions_passed=true;report.transaction_completed_to_rollback=true;
 }catch(error){report.diagnostic=String(error?.message??'CANDIDATE_KERNEL_UNCONFIRMED').replace(/[A-Za-z0-9_-]{43,}/gu,'[LONG_VALUE_REDACTED]').slice(0,8000);}
 finally{
  if(before){try{const after=await snapshot();report.after_sha256=hash(JSON.stringify(after));report.rollback_verified=isDeepStrictEqual(before,after);
   report.sources_stable=true;for(const [file,seal]of Object.entries(seals)){if(hash(await readFile(path.join(ROOT,file)))!==seal)report.sources_stable=false;}
   if(report.assertions_passed&&report.rollback_verified&&report.sources_stable)report.result='passed';}catch{report.rollback_verified=false;}}
  if(owns&&report.rollback_verified){const owner=JSON.parse(await readFile(LOCK,'utf8'));assert.equal(owner.run_id,runId);assert.equal(owner.pid,process.pid);await unlink(LOCK);}
  report.finished_at=new Date().toISOString();const directory=path.join(ROOT,'tracking/evidence/m03/persisted17-compatibility');await mkdir(directory,{recursive:true});const file=path.join(directory,`${report.finished_at.replace(/[:.]/gu,'-')}-${runId.slice(0,8)}.json`);
  await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({result:report.result,receipt:path.relative(ROOT,file).replaceAll('\\','/'),rollback_verified:report.rollback_verified,diagnostic:report.diagnostic})+'\n');if(report.result!=='passed')process.exitCode=1;
 }
}
main().catch(()=>{process.stderr.write('Fixed persisted17 compatibility regression stopped.\n');process.exitCode=1;});
