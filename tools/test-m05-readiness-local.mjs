// Exact owned local24, synthetic preconditions and flag transition all rolled back.
import assert from 'node:assert/strict';
import {createHash,randomUUID}from'node:crypto';
import {spawn}from'node:child_process';
import {mkdir,open,readFile,unlink,writeFile}from'node:fs/promises';
import {isDeepStrictEqual}from'node:util';
import {runOwnedLocalSql,verifyLocalTarget}from'./local-postgres.mjs';
const HARNESS='tools/test-m05-readiness-local.mjs';
const SQL='development/m05/enable-presentation-processing.sql';
const READINESS='tools/sql/m05-presentation-readiness.sql';
const READBACK='tools/sql/m05-presentation-readback.sql';
const FILES=[HARNESS,SQL,READINESS,READBACK,'tools/local-postgres.mjs','development/local-db/instance.json','development/local-db/reviewed.json','supabase/migrations/20261029215218_m05_immutable_presentation_versions.sql'];
const sha=value=>createHash('sha256').update(value).digest('hex');
const rows=output=>output.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
const nest=source=>source.replace(/^begin(?: isolation level repeatable read read only)?;/mu,'').replace(/^(?:rollback|commit);/mu,'');
const run=randomUUID();const application=`eps-m05-enable-${run}`;const lockPath='.local/local-postgres/test-db.lock';
const sources=Object.fromEntries(await Promise.all(FILES.map(async path=>[path,await readFile(path,'utf8')])));
const seals=Object.fromEntries(FILES.map(path=>[path,sha(sources[path])]));
const report={run_id:run,started_at:new Date().toISOString(),result:'failed',cloud_called:false,provider_called:false,hosted_credentials_loaded:false,harness_path:HARNESS,harness_sha256:seals[HARNESS],source_sha256:seals,scope:'Owned local24 only. Synthetic Auth row and temporary Auth RLS, project/workspace/waiting-job and existing-review-readiness preconditions are created inside the same outer rollback before the activation-before snapshot. No real M02 row or readiness is committed.'};
let locked=false;let original;
async function execute(sql,container){assert(Buffer.byteLength(sql)<=512*1024);return new Promise((resolve,reject)=>{const endpoint=process.platform==='win32'?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock';const child=spawn('docker',['--host',endpoint,'exec','--user','postgres','-i',container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','supabase_admin','-d','postgres'],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';const timer=setTimeout(()=>child.kill(),30000);child.stdout.on('data',value=>{stdout+=value;if(Buffer.byteLength(stdout)>4*1024*1024)child.kill();});child.stderr.on('data',value=>{stderr+=value;if(Buffer.byteLength(stderr)>65536)child.kill();});child.once('error',reject);child.once('close',code=>{clearTimeout(timer);if(code)reject(new Error(stderr||'OWNED_READINESS_SQL_UNCONFIRMED'));else resolve({stdout,stderr});});child.stdin.end(sql);});}
try{
 const target=await verifyLocalTarget();assert.equal(JSON.parse(sources['development/local-db/reviewed.json']).migrations.length,24);
 const lock=await open(lockPath,'wx',0o600);await lock.writeFile(JSON.stringify({run_id:run,pid:process.pid}));await lock.close();locked=true;
 original=rows((await runOwnedLocalSql(sources[READBACK])).stdout)[0];report.original=original;
 const fixture=`set local role supabase_auth_admin;alter table auth.users enable row level security;set local role postgres;
 do $fixture$begin if exists(select 1 from auth.users where id='8a1a0000-0000-4000-8000-000000000001')or exists(select 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496')or exists(select 1 from public.projects where id='8a0a0000-0000-4000-8000-000000000001')then raise exception'M05_LOCAL_READINESS_FIXTURE_NAMESPACE_OCCUPIED';end if;end$fixture$;
 insert into auth.users(id,is_anonymous,deleted_at,banned_until)values('8a1a0000-0000-4000-8000-000000000001',false,null,null);
 insert into public.projects(id,name)values('8a0a0000-0000-4000-8000-000000000001','Synthetic M05 readiness fixture');
 insert into eps.workspaces(id,project_id)values('8a2a0000-0000-4000-8000-000000000001','8a0a0000-0000-4000-8000-000000000001');
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,status,stage,input,input_hash,input_hash_version,dedupe_key,correlation_id,error)
 values('b3f90268-147d-41d4-8875-2a6435df1496','8a2a0000-0000-4000-8000-000000000001','8a1a0000-0000-4000-8000-000000000001','specs_extract','73a1a500-acfe-48cc-91ba-53a83b895118','waiting_for_input','extract_specs','{}',repeat('a',64),'eps.specs-input.pg-jsonb.v1',repeat('a',64),'m05-local-readiness-only','{"code":"INPUT_CHANGED","message":"Synthetic local readiness prerequisite.","details":{},"retryable":false}');
 update eps.review_processing_config set enabled=true where id;`;
 const repeat=`do $repeat_check$begin begin execute $repeat_source$${nest(sources[SQL])}$repeat_source$;raise exception'M05_REPEATED_ENABLE_ACCEPTED';exception when raise_exception then if sqlerrm<>'M05_PRESENTATION_EXPECTED_DISABLED_CONFIGURATION_REQUIRED'then raise;end if;end;perform set_config('eps.m05.repeat_denied','true',true);end$repeat_check$;select jsonb_build_object('repeated_enable_denied',current_setting('eps.m05.repeat_denied')='true');`;
 const result=await execute(`begin;set local role postgres;set local application_name='${application}';${fixture}${nest(sources[READBACK])}${nest(sources[READINESS])}${nest(sources[SQL])}${nest(sources[READBACK])}${nest(sources[READINESS])}${repeat}rollback;`,target.container.Id);
 const objects=rows(result.stdout);[report.before,report.enabled_state]=objects.filter(value=>Object.hasOwn(value,'catalog_delta_values'));[report.readiness_before,report.readiness_after]=objects.filter(value=>Object.hasOwn(value,'presentation_processing')&&Object.hasOwn(value,'active_jobs'));
 report.repeated_enable_denied=objects.find(value=>Object.hasOwn(value,'repeated_enable_denied'))?.repeated_enable_denied===true;
 assert(report.before&&report.enabled_state&&report.readiness_before&&report.readiness_after&&report.repeated_enable_denied);
 const expected=structuredClone(report.before);expected.m05_state.config.enabled=true;
 expected.m05_state.tables['eps.presentation_processing_config'].sha256=report.enabled_state.m05_state.tables['eps.presentation_processing_config'].sha256;
 assert.notEqual(expected.m05_state.tables['eps.presentation_processing_config'].sha256,report.before.m05_state.tables['eps.presentation_processing_config'].sha256);
 assert.deepEqual(report.enabled_state,expected,'ONLY_NEW_READINESS_FLAG_MAY_CHANGE');
 const readinessExpected=structuredClone(report.readiness_before);readinessExpected.presentation_processing.enabled=true;assert.deepEqual(report.readiness_after,readinessExpected,'EXISTING_JOB_AND_REVIEW_READINESS_MUST_REMAIN_IDENTICAL');
 report.synthetic_preconditions=true;report.exact_single_flag_change=true;report.behavior_assertions_passed=true;report.stdout_sha256=sha(result.stdout);
}catch(error){await mkdir(`.local/m05-readiness/${run}`,{recursive:true});await writeFile(`.local/m05-readiness/${run}/diagnostic.txt`,String(error.stack??error));report.private_diagnostic=`.local/m05-readiness/${run}/diagnostic.txt`;
}finally{
 if(locked){report.owned_backend_settled=rows((await runOwnedLocalSql(`begin read only;select jsonb_build_object('count',count(*))from pg_stat_activity where application_name='${application}';rollback;`)).stdout)[0].count===0;
  if(original&&report.owned_backend_settled){report.after=rows((await runOwnedLocalSql(sources[READBACK])).stdout)[0];report.rollback_verified=isDeepStrictEqual(original,report.after);report.sources_stable=(await Promise.all(FILES.map(async path=>sha(await readFile(path))===seals[path]))).every(Boolean);if(report.behavior_assertions_passed&&report.rollback_verified&&report.sources_stable)report.result='passed';}
  if(report.rollback_verified&&report.owned_backend_settled){const lock=JSON.parse(await readFile(lockPath,'utf8'));assert.equal(lock.run_id,run);await unlink(lockPath);}}
 report.finished_at=new Date().toISOString();await mkdir('tracking/evidence/m05/readiness-local',{recursive:true});const receipt=`tracking/evidence/m05/readiness-local/${report.finished_at.replace(/[:.]/gu,'-')}-${run.slice(0,8)}.json`;await writeFile(receipt,JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify({result:report.result,receipt,rollback_verified:report.rollback_verified,diagnostic:report.private_diagnostic})+'\n');if(report.result!=='passed')process.exitCode=1;
}
