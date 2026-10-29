/** Local15 RED/compatibility16/GREEN, one rollback. No provider/native or cloud. */
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
const ROOT=path.resolve(import.meta.dirname,'..');const LOCK=path.join(ROOT,'.local/local-postgres/test-db.lock');
const FILES=['tests/db/m02-specs-assets-candidate.sql','tests/db/m02-pdf-vision-prepare.sql','development/m02/pdf-vision-compatibility-candidate.sql','tests/db/m02-pdf-vision-assertions.sql'];
const READBACK='tools/sql/specs-read-operation-readback.sql';const SYSTEM='7701520506262638626';
const hash=value=>createHash('sha256').update(value).digest('hex');let containerId;
async function target(){const value=await verifyNativeSpecsLocalTarget();assert.equal(value.observed.system_identifier,SYSTEM);if(containerId)assert.equal(value.container.Id,containerId);else containerId=value.container.Id;return value;}
async function snapshot(){await target();const result=await runOwnedLocalSql(await readFile(path.join(ROOT,READBACK),'utf8'));
 const rows=result.stdout.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));assert.equal(rows.length,1);assert.equal(rows[0].versions.length,15);
 const auth=await runOwnedLocalSql("begin read only;select jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity) from pg_class where oid='auth.users'::regclass;rollback;");
 rows[0].local_managed_auth_catalog=JSON.parse(auth.stdout.split(/\r?\n/u).find(line=>line.startsWith('{')));return rows[0];}
async function execute(sql,runId){const pinned=await target();const endpoint=process.platform==='win32'?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock';assert(Buffer.byteLength(sql,'utf8')<256*1024);
 return await new Promise((resolve,reject)=>{const child=spawn('docker',['--host',endpoint,'exec','--user','postgres','-i',pinned.container.Id,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','supabase_admin','-d','postgres'],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
 let stdout='';let stderr='';let stopped=false;const timer=setTimeout(()=>{stopped=true;child.kill();},60000);
 child.stdout.on('data',chunk=>{stdout+=chunk.toString('utf8');if(stdout.length>1000000){stopped=true;child.kill();}});child.stderr.on('data',chunk=>{stderr+=chunk.toString('utf8');if(stderr.length>65536){stopped=true;child.kill();}});
 child.on('error',()=>{clearTimeout(timer);reject(new Error('LOCAL_PDF_VISION_TRANSPORT_UNCONFIRMED'));});child.on('close',code=>{clearTimeout(timer);if(code!==0||stopped)reject(new Error(stderr.slice(0,8000)||'LOCAL_PDF_VISION_SQL_UNCONFIRMED'));else resolve(stdout);});
 child.stdin.end(`begin;set local application_name='eps-pdf-vision-${runId}';set local lock_timeout='5s';set local statement_timeout='30s';
set local role supabase_auth_admin;alter table auth.users enable row level security;reset role;set local role postgres;
set local eps.local_fixture_tests='eps-presentation-canonical-pg17-local';set local eps.specs_assets_rehearsal='rollback-only-v1';\n${sql}\nrollback;`);});}
async function main(){assert.equal(process.argv.length,2);const runId=randomUUID();const fragments=await Promise.all(FILES.map(async file=>[file,await readFile(path.join(ROOT,file),'utf8')]));
 const seals=Object.fromEntries(fragments.map(([file,source])=>[file,hash(source)]));
 const report={run_id:runId,started_at:new Date().toISOString(),result:'failed',cloud_called:false,provider_called:false,source_files_read:false,credential_files_read:false,native_ocr_tested:false,
  scope:'Owned local15 synthetic document service pipeline regression plus truthful pdf_vision RED/GREEN/page/mime guards. No native raster, image, actual OCR, HTTP or provider acceptance.',source_seals:seals,harness_sha256:hash(await readFile(import.meta.filename))};
 let owns=false;let before;
 try{const lock=await open(LOCK,'wx',0o600);try{await lock.writeFile(JSON.stringify({run_id:runId,pid:process.pid}));owns=true;}finally{await lock.close();}
  before=await snapshot();report.before_sha256=hash(JSON.stringify(before));
  const archive=path.join(ROOT,'development/m02/pdf-vision-attempts',runId.slice(0,8));await mkdir(archive,{recursive:true});for(const [file,source]of fragments)await writeFile(path.join(archive,path.basename(file)),source,{flag:'wx'});
  await writeFile(path.join(archive,'runner.source.mjs'),await readFile(import.meta.filename),{flag:'wx'});
  const output=await execute(fragments.map(([,source])=>source).join('\n'),runId);
  for(const marker of ['PDF_VISION_RED_CURRENT_METHOD_REJECTED','PDF_VISION_GREEN_PAGES_CALLBACK_AND_FORMAT_GUARDS_PASSED'])assert.equal(output.split(/\r?\n/u).filter(line=>line===marker).length,1);
  report.red_rejected_before_patch=true;report.green_private_paged_preparation_and_callback=true;report.prior_document_pipeline_fixture_passed=true;report.transaction_completed_to_rollback=true;
 }catch(error){report.diagnostic=String(error?.message??'LOCAL_PDF_VISION_UNCONFIRMED').replace(/[A-Za-z0-9_-]{43,}/gu,'[LONG_VALUE_REDACTED]').slice(0,8000);}
 finally{if(before){try{const after=await snapshot();report.after_sha256=hash(JSON.stringify(after));report.rollback_verified=isDeepStrictEqual(before,after);
   report.sources_stable=true;for(const [file,seal]of Object.entries(seals))if(hash(await readFile(path.join(ROOT,file)))!==seal)report.sources_stable=false;
   if(report.red_rejected_before_patch&&report.green_private_paged_preparation_and_callback&&report.rollback_verified&&report.sources_stable)report.result='passed';}catch{report.rollback_verified=false;}}
  if(owns&&report.rollback_verified){const owner=JSON.parse(await readFile(LOCK,'utf8'));assert.equal(owner.run_id,runId);assert.equal(owner.pid,process.pid);await unlink(LOCK);}
  report.finished_at=new Date().toISOString();const directory=path.join(ROOT,'tracking/evidence/m02/pdf-vision-local');await mkdir(directory,{recursive:true});const file=path.join(directory,`${report.finished_at.replace(/[:.]/gu,'-')}-${runId.slice(0,8)}.json`);
  await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({result:report.result,receipt:path.relative(ROOT,file).replaceAll('\\','/'),rollback_verified:report.rollback_verified,diagnostic:report.diagnostic})+'\n');if(report.result!=='passed')process.exitCode=1;}
}
main().catch(()=>{process.stderr.write('Fixed local15 PDF vision rehearsal stopped.\n');process.exitCode=1;});
