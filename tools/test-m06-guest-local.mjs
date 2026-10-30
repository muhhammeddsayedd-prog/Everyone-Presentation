/** Owned local24 + rolled-back M06 only; never loads cloud/provider secrets. */
import assert from 'node:assert/strict';
import{spawn}from'node:child_process';
import {createHash,randomUUID}from'node:crypto';
import{mkdir,open,readFile,unlink,writeFile}from'node:fs/promises';
import{runOwnedLocalSql,verifyLocalTarget}from'./local-postgres.mjs';
const FILES=['development/m06/schema.sql','development/m06/links.sql','development/m06/feedback.sql','development/m06/exports.sql','development/m06/gateway.sql',...process.argv.includes('--guest-only')?[]:['development/m06/export-processing.sql'],'development/m06/finalize.sql'];
const sha=value=>createHash('sha256').update(value).digest('hex');
const rows=value=>value.split(/\r?\n/u).filter(v=>v.startsWith('{')).map(v=>JSON.parse(v));
const run=randomUUID();const app=`eps-m06-guest-${run}`;let locked=false;let before;
const report={run_id:run,started_at:new Date().toISOString(),result:'failed',scope:'Owned isolated local24, candidate DDL and synthetic transactions rolled back; no hosted config, cloud, provider or real media.',cloud_called:false,provider_called:false,hosted_credentials_loaded:false};
const sources=Object.fromEntries(await Promise.all(FILES.map(async f=>[f,await readFile(f,'utf8')])));report.source_seals=Object.fromEntries(Object.entries(sources).map(([f,text])=>[f,sha(text)]));
const snapshot=await readFile('tools/sql/m04-review-local-snapshot.sql','utf8');report.snapshot_query_sha256=sha(snapshot);
async function fixtureSql(sql,target){return new Promise((resolve,reject)=>{const endpoint=process.platform==='win32'?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock';const child=spawn('docker',['--host',endpoint,'exec','--user','postgres','-i',target.container.Id,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','supabase_admin','-d','postgres'],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';const timer=setTimeout(()=>child.kill(),60000);child.stdout.on('data',v=>{stdout+=v;if(Buffer.byteLength(stdout)>16*1024*1024)child.kill();});child.stderr.on('data',v=>{stderr+=v;if(Buffer.byteLength(stderr)>65536)child.kill();});child.once('error',reject);child.once('close',code=>{clearTimeout(timer);if(code)reject(new Error(stderr||'OWNED_SQL_UNCONFIRMED'));else resolve({stdout,stderr});});child.stdin.end(sql);});}
try{
 const target=await verifyLocalTarget();const lock=await open('.local/local-postgres/test-db.lock','wx',0o600);await lock.writeFile(JSON.stringify({run_id:run,pid:process.pid}));await lock.close();locked=true;
 before=rows((await runOwnedLocalSql(snapshot)).stdout)[0];assert.equal(before.versions.length,24);report.before=before;
 let proof=process.argv.includes('--compile-only')?`select 'M06_CANDIDATE_COMPILED_ROLLBACK_PASSED';`:await readFile('tests/db/m06-guests.sql','utf8');
 if(!process.argv.includes('--compile-only')){
  const fixtures=['tests/db/m04-assignments-fixture.sql','tests/db/m05-versions-fixture.sql','tests/db/m05-versions.sql','tests/db/m05-processing.sql'];
  const texts=await Promise.all(fixtures.map(f=>readFile(f,'utf8')));report.fixture_seals=Object.fromEntries(fixtures.map((f,i)=>[f,sha(texts[i])]));
  assert(texts[1].includes("'m05-synthetic-internal','Synthetic internal','internal'"));
  texts[1]=texts[1].replace("'m05-synthetic-internal','Synthetic internal','internal'","'m06-synthetic-external','Synthetic external','external'");
  report.fixture_adaptation='Retained M05 synthetic fixture is composed in-memory with one exact preset key/label/scope replacement to external; original file untouched. Auth RLS enabled only inside outer rollback.';
  proof=`set local role supabase_auth_admin;alter table auth.users enable row level security;set local role postgres;${texts.join('\n')}\n${proof}`;
 }
 if(!process.argv.includes('--compile-only'))report.proof_sha256=sha(proof);
 if(!process.argv.includes('--compile-only')&&!process.argv.includes('--guest-only')){const exportProof=await readFile('tests/db/m06-export-processing.sql','utf8');const accessProof=await readFile('tests/db/m06-export-access.sql','utf8');report.export_proof_sha256=sha(exportProof);report.export_access_proof_sha256=sha(accessProof);proof+='\n'+exportProof+'\n'+accessProof;}
 const sql=`begin;set local role postgres;set local application_name='${app}';${FILES.map(f=>sources[f]).join('\n')}\n${proof}\nrollback;`;
 const output=await fixtureSql(sql,target);report.stdout_sha256=sha(output.stdout);report.markers=output.stdout.split(/\r?\n/u).filter(v=>/^M06_.*_PASSED$/u.test(v));assert(report.markers.length>0);report.behavior_passed=!process.argv.includes('--compile-only');report.compile_passed=true;
}catch(error){await mkdir(`.local/m06-guest/${run}`,{recursive:true});await writeFile(`.local/m06-guest/${run}/diagnostic.txt`,String(error.stack??error));report.private_diagnostic=`.local/m06-guest/${run}/diagnostic.txt`;}
finally{
 if(locked){report.backend_settled=rows((await runOwnedLocalSql(`begin read only;select jsonb_build_object('count',count(*))from pg_stat_activity where application_name='${app}';rollback;`)).stdout)[0].count===0;
  if(report.backend_settled){report.after=rows((await runOwnedLocalSql(snapshot)).stdout)[0];report.rollback_verified=JSON.stringify(before)===JSON.stringify(report.after);report.sources_stable=(await Promise.all(FILES.map(async f=>sha(await readFile(f))===report.source_seals[f]))).every(Boolean);
   if(report.compile_passed&&report.rollback_verified&&report.sources_stable)report.result='passed';
   const owner=JSON.parse(await readFile('.local/local-postgres/test-db.lock','utf8'));assert.equal(owner.run_id,run);await unlink('.local/local-postgres/test-db.lock');}
 }
 report.finished_at=new Date().toISOString();await mkdir('tracking/evidence/m06/guest-local',{recursive:true});const file=`tracking/evidence/m06/guest-local/${report.finished_at.replace(/[:.]/gu,'-')}-${run.slice(0,8)}.json`;await writeFile(file,JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify({result:report.result,receipt:file,diagnostic:report.private_diagnostic,rollback_verified:report.rollback_verified})+'\n');if(report.result!=='passed')process.exitCode=1;
}
