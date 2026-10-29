/** Owned local13 candidate14 rehearsal; fixed sources, one rollback, no cloud/provider. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { isDeepStrictEqual } from 'node:util';
import { runOwnedLocalSql } from './local-postgres.mjs';
import { verifyNativeSpecsLocalTarget } from './lib/native-specs-local-transport.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');
const LOCK=path.join(ROOT,'.local/local-postgres/test-db.lock');
const DIRECTORY=path.join(ROOT,'tracking/evidence/m02/service-claim-replay');
const CANDIDATE='development/m02/service-claim-replay-candidate.sql';
const ASSERTIONS='tests/db/m02-service-claim-replay.sql';
const READBACK='tools/sql/specs-read-operation-readback.sql';
const SEALS={ candidate:'705d7432ab8cbe04fa5a94e090e1ce55e36c622590c09e0ce922ac5a59c6baf2',assertions:'98438c7e44285c20bc698776bca0fbc13728f0f3a49159f8771cae1af6f97bd8',readback:'8c23cba328e8eef38c99520807dcb680895b94b5508dc307932d01b5fda76a2f' };
const SYSTEM='7701520506262638626';
const hash=value=>createHash('sha256').update(value).digest('hex');
let containerId;
async function target(){ const result=await verifyNativeSpecsLocalTarget(); assert.equal(result.observed.system_identifier,SYSTEM);
 assert.equal(result.config.container,'eps-presentation-canonical-pg17-local'); if(containerId)assert.equal(result.container.Id,containerId);else containerId=result.container.Id;return result; }
async function sources(){
 for(const [file,seal]of [[CANDIDATE,SEALS.candidate],[ASSERTIONS,SEALS.assertions],[READBACK,SEALS.readback]])assert.equal(hash(await readFile(path.join(ROOT,file))),seal);
 const manifest=JSON.parse(await readFile(path.join(ROOT,'development/local-db/reviewed.json'),'utf8'));assert.equal(manifest.migrations.length,13);
 for(const row of manifest.migrations)assert.equal(hash(await readFile(path.join(ROOT,row.path))),row.sha256);
}
async function snapshot(){await target();const result=await runOwnedLocalSql(await readFile(path.join(ROOT,READBACK),'utf8'));
 const rows=result.stdout.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));assert.equal(rows.length,1);assert.equal(rows[0].versions.length,13);return rows[0];}
async function execute(candidate,assertions,runId){
 const pinned=await target();const endpoint=process.platform==='win32'?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock';
 const sql=`begin;set local application_name='eps-service-claim-${runId}';set local lock_timeout='5s';set local statement_timeout='30s';
set local role supabase_auth_admin;alter table auth.users enable row level security;reset role;set local role postgres;
set local eps.local_fixture_tests='eps-presentation-canonical-pg17-local';set local eps.service_claim_rehearsal='rollback-only-v1';
${candidate}\n${assertions}\nrollback;`;
 assert(Buffer.byteLength(sql,'utf8')<256*1024);assert(/^[a-f0-9-]{36}$/u.test(runId));
 return await new Promise((resolve,reject)=>{
  const child=spawn('docker',['--host',endpoint,'exec','--user','postgres','-i',pinned.container.Id,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','supabase_admin','-d','postgres'],{ shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'] });
  let stdout='';let stderr='';let exceeded=false;
  const timer=setTimeout(()=>{exceeded=true;child.kill();},45000);
  child.stdout.on('data',chunk=>{stdout+=chunk.toString('utf8');if(stdout.length>65536){exceeded=true;child.kill();}});
  child.stderr.on('data',chunk=>{stderr+=chunk.toString('utf8');if(stderr.length>65536){exceeded=true;child.kill();}});
  child.on('error',()=>{clearTimeout(timer);reject(new Error('FIXED_LOCAL_TRANSPORT_FAILED'));});
  child.on('close',code=>{clearTimeout(timer);if(code!==0||exceeded)reject(new Error(stderr.slice(0,4000)||'FIXED_LOCAL_SQL_FAILED'));else resolve(stdout);});
  child.stdin.end(sql);
 });
}
async function main(){
 assert.equal(process.argv.length,2);await sources();const runId=randomUUID();
 const receipt={run_id:runId,started_at:new Date().toISOString(),result:'failed',candidate:CANDIDATE,assertions:ASSERTIONS,source_seals:SEALS,
  harness_sha256:hash(await readFile(import.meta.filename)),cloud_called:false,provider_called:false,credentials_read:false,
  scope:'Synthetic local SQL replay/expiry/access/ciphertext behavior; no HTTP, provider or deployed service proof.'};
 let owns=false;let before;
 try{await mkdir(path.dirname(LOCK),{recursive:true});const lock=await open(LOCK,'wx',0o600);try{await lock.writeFile(JSON.stringify({run_id:runId,pid:process.pid}));owns=true;}finally{await lock.close();}
  await target();before=await snapshot();receipt.before_catalog_sha256=hash(JSON.stringify(before));await sources();
  const output=await execute(await readFile(path.join(ROOT,CANDIDATE),'utf8'),await readFile(path.join(ROOT,ASSERTIONS),'utf8'),runId);
  assert.equal(output.split(/\r?\n/u).filter(line=>line==='SERVICE_CLAIM_REPLAY_AND_SCOPE_PASSED').length,1);
  receipt.assertions_passed=true;receipt.transaction_completed_to_rollback=true;
 }catch(error){receipt.error=String(error?.message??'LOCAL_SERVICE_CLAIM_UNCONFIRMED').replace(/[a-zA-Z0-9_-]{43,}/gu,'[LONG_VALUE_REDACTED]').slice(0,4000);}
 finally{
  if(before){try{const after=await snapshot();receipt.after_catalog_sha256=hash(JSON.stringify(after));receipt.rollback_verified=isDeepStrictEqual(before,after);if(receipt.assertions_passed&&receipt.rollback_verified)receipt.result='passed';}catch{receipt.rollback_verified=false;}}
  if(owns&&receipt.rollback_verified){const owner=JSON.parse(await readFile(LOCK,'utf8'));assert.equal(owner.run_id,runId);assert.equal(owner.pid,process.pid);await unlink(LOCK);}
  receipt.finished_at=new Date().toISOString();await mkdir(DIRECTORY,{recursive:true});const file=path.join(DIRECTORY,`${receipt.finished_at.replace(/[:.]/gu,'-')}-${runId.slice(0,8)}-rollback.json`);
  await writeFile(file,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({result:receipt.result,receipt:path.relative(ROOT,file).replaceAll('\\','/'),rollback_verified:receipt.rollback_verified,error:receipt.error})+'\n');
  if(receipt.result!=='passed')process.exitCode=1;
 }
}
main().catch(()=>{process.stderr.write('Fixed local13 service-claim rehearsal stopped before confirmation.\n');process.exitCode=1;});
