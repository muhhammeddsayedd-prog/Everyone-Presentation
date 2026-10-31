/** Owned disposable synthetic DB. No existing app database/schema/data changes. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { verifyLocalTarget } from '../../../tools/local-postgres.mjs';
const ROOT=path.resolve(import.meta.dirname,'../../..'),HERE=import.meta.dirname;
const run=randomUUID().replaceAll('-',''),database='eps_oauth_consent_'+run,marker='eps-oauth-consent-owned:'+run;
const lock=path.join(ROOT,'.local/local-postgres/test-db.lock');
const migration='supabase/migrations/20261031104603_m07_oauth_consent_binding_and_claims.sql';
const host=process.platform==='win32'?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock';
const sha=value=>createHash('sha256').update(value).digest('hex');
let target,created=false,locked=false,oid,roleMayExist=false,roleOid;
const report={schema_version:'1.0',evidence_kind:'synthetic_disposable_local_database',run_id:run,started_at:new Date().toISOString(),result:'failed',cloud_called:false,provider_called:false,existing_app_database_writes:false,checkpoint:'initialization'};
async function command(args,input=''){return new Promise((resolve,reject)=>{const child=spawn('docker',['--host',host,...args],{cwd:ROOT,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';const timer=setTimeout(()=>child.kill(),60000);child.stdout.on('data',b=>{stdout+=b;if(stdout.length>2*1024*1024)child.kill();});child.stderr.on('data',b=>{stderr+=b;if(stderr.length>256*1024)child.kill();});child.once('error',()=>{clearTimeout(timer);reject(Error('CONSENT_LOCAL_TRANSPORT_FAILED'));});child.once('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr});});child.stdin.on('error',()=>{});child.stdin.end(input);});}
const psql=db=>['exec','--user','postgres','-i',target.container.Id,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','supabase_admin','-d',db];
async function sql(db,body){const result=await command(psql(db),body);if(result.code!==0)throw Object.assign(Error('CONSENT_LOCAL_SQL_FAILED'),{diagnostic:result.stderr.slice(-12000)});return result.stdout;}
async function identity(){const value=JSON.parse((await sql('template1',`begin read only;select jsonb_build_object('oid',oid::text,'name',datname,'owner',datdba::regrole::text,'marker',shobj_description(oid,'pg_database'),'clients',(select count(*)from pg_stat_activity where datname='${database}'))from pg_database where datname='${database}';rollback;`)).trim());assert.equal(value.name,database);assert.equal(value.owner,'postgres');assert.equal(value.marker,marker);if(oid)assert.equal(value.oid,oid);return value;}
const rolesSql="begin read only;select coalesce(jsonb_agg(jsonb_build_object('oid',oid,'name',rolname,'login',rolcanlogin,'inherit',rolinherit,'bypass',rolbypassrls,'super',rolsuper)order by oid),'[]')from pg_roles;rollback;";
async function roleIdentity(){const raw=(await sql('template1',"begin read only;select jsonb_build_object('oid',r.oid::text,'marker',shobj_description(r.oid,'pg_authid'),'safe',not r.rolcanlogin and not r.rolsuper and not r.rolinherit and not r.rolbypassrls and not r.rolcreaterole and not r.rolcreatedb and not r.rolreplication,'members',(select array_agg(distinct member::regrole::text order by member::regrole::text)from pg_auth_members where roleid=r.oid))from pg_roles r where rolname='eps_oauth_consent_owner';rollback;")).trim();if(!raw)return null;const value=JSON.parse(raw);assert.equal(value.marker,marker);assert.equal(value.safe,true);assert.deepEqual(value.members,['postgres']);if(roleOid)assert.equal(value.oid,roleOid);return value;}
let roleBefore;
try{
 const handle=await open(lock,'wx',0o600);await handle.writeFile(JSON.stringify({run_id:run,pid:process.pid,purpose:'oauth-consent-synthetic-local'}));await handle.close();locked=true;
 target=await verifyLocalTarget();assert.equal(target.observed.system_identifier,'7701520506262638626');
 roleBefore=await sql('postgres',rolesSql);report.global_roles_before_sha256=sha(roleBefore);
 assert(/^eps_oauth_consent_[a-f0-9]{32}$/u.test(database));
 await sql('template1',`create database "${database}"with template template0 owner postgres;comment on database "${database}"is '${marker}';`);created=true;oid=(await identity()).oid;
 const sources=await Promise.all([migration,...['fixture.sql','tests.sql'].map(f=>'development/m07/oauth-consent-fix/'+f)].map(async f=>[f,await readFile(path.join(ROOT,f),'utf8')]));
 report.source_sha256=Object.fromEntries(sources.map(([f,b])=>[f,sha(b)]));
 const byFile=Object.fromEntries(sources);report.assertion_count=[...byFile['development/m07/oauth-consent-fix/tests.sql'].matchAll(/select public\.consent_test_(?:assert|reject)\(/gu)].length;report.checkpoint='candidate-and-synthetic-tests-rollback';
 const result=await sql(database,`set log_statement='none';set log_min_duration_statement=-1;begin;set local role postgres;set local timezone='UTC';set local eps.oauth_consent_test_run='${run}';${byFile['development/m07/oauth-consent-fix/fixture.sql']}\n${byFile[migration]}\n${byFile['development/m07/oauth-consent-fix/tests.sql']}\nrollback;`);
 const proof=result.split(/\r?\n/u).filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)).at(-1);assert.equal(proof.result,'passed');report.proof=proof;
 const after=await sql(database,"begin read only;select jsonb_build_object('auth_absent',to_regnamespace('auth')is null,'eps_absent',to_regnamespace('eps')is null,'role_absent',not exists(select 1 from pg_roles where rolname='eps_oauth_consent_owner'));rollback;");assert.deepEqual(JSON.parse(after.trim()),{auth_absent:true,eps_absent:true,role_absent:true});report.transaction_rollback_verified=true;
 // Real concurrent connections use the identical candidate committed ONLY in
 // this marked synthetic disposable DB. The newly owned role is removed only
 // after exact OID/marker/attributes/membership and dependency verification.
 report.checkpoint='concurrent-claims';roleMayExist=true;
 await sql(database,`set log_statement='none';set log_min_duration_statement=-1;begin;set local role postgres;set local timezone='UTC';set local eps.oauth_consent_test_run='${run}';${byFile['development/m07/oauth-consent-fix/fixture.sql']}\n${byFile[migration]}\ncomment on role eps_oauth_consent_owner is '${marker}';commit;`);
 roleOid=(await roleIdentity()).oid;
 report.new_policy_metadata=JSON.parse((await sql(database,"begin read only;set local search_path='';select jsonb_agg(jsonb_build_object('relation',polrelid::regclass::text,'name',polname,'command',polcmd,'roles',(select array_agg(rolname order by rolname)from pg_roles where oid=any(polroles)),'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid))order by polname)from pg_policy where polname in('oauth_consent_ordinary_own_session','oauth_consent_enabled_registry');rollback;")).trim());
 const claims=sid=>JSON.stringify({sub:'10000000-0000-4000-8000-000000000001',role:'authenticated',aud:'authenticated',is_anonymous:false,session_id:sid});
 const sid='20000000-0000-4000-8000-000000000001';
 const rpc=(letter,action,id,session=sid)=>`begin;set local role authenticated;select set_config('request.jwt.claims','${claims(session)}',true);select public.eps_oauth_consent_claim(repeat('${letter}',32),'https://studio.example.invalid/mcp','${action}','40000000-0000-4000-8000-${String(id).padStart(12,'0')}');select pg_sleep(0.15);commit;`;
 const envelopes=result=>result.stdout.split(/\r?\n/u).filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)).filter(v=>Object.hasOwn(v,'state'));
 const detailRace=await Promise.all([command(psql(database),rpc('j','details',101)),command(psql(database),rpc('j','details',102))]);assert(detailRace.every(r=>r.code===0));const details=detailRace.flatMap(envelopes);assert.deepEqual(details.map(v=>v.state).sort(),['claimed','in_progress']);
 const detailWinner=details.find(v=>v.state==='claimed');
 await sql(database,`begin;set local role postgres;update auth.oauth_authorizations set user_id='10000000-0000-4000-8000-000000000001'where authorization_id=repeat('j',32);set local role authenticated;select set_config('request.jwt.claims','${claims(sid)}',true);select public.eps_oauth_consent_finish(repeat('j',32),'https://studio.example.invalid/mcp','${detailWinner.claim_id}','consent_ready');commit;`);
 const decisionRace=await Promise.all([command(psql(database),rpc('j','approve',103)),command(psql(database),rpc('j','deny',104))]);assert(decisionRace.every(r=>r.code===0));assert.deepEqual(decisionRace.flatMap(envelopes).map(v=>v.state).sort(),['claimed','in_progress']);
 const browserRace=await Promise.all([command(psql(database),rpc('k','details',105)),command(psql(database),rpc('k','details',106,'20000000-0000-4000-8000-000000000002'))]);assert.equal(browserRace.filter(r=>r.code===0).length,1);assert.equal(browserRace.filter(r=>r.code!==0).length,1);assert.equal(browserRace.flatMap(envelopes).filter(v=>v.state==='claimed').length,1);
 const counts=JSON.parse((await sql(database,"begin read only;select jsonb_build_object('rows',(select count(*)from eps.oauth_consent_claims),'decisions',(select count(*)from eps.oauth_consent_claims where action in('approve','deny')));rollback;")).trim());assert.deepEqual(counts,{rows:2,decisions:1});
 report.concurrent_checks={same_browser_details_single_winner:true,approve_deny_single_winner:true,different_browser_single_winner:true,claims_rows:counts.rows,decision_rows:counts.decisions,connections_independent:true};
 report.result='passed';report.checkpoint='complete';
}catch(error){report.failure='CONSENT_LOCAL_UNCONFIRMED';report.synthetic_diagnostic=error.diagnostic??error.message;}
finally{
 try{
  if(created){const current=await identity();assert.equal(current.clients,0);await sql('template1',`drop database "${database}";`);const absent=await sql('template1',`begin read only;select not exists(select 1 from pg_database where datname='${database}');rollback;`);assert.equal(absent.trim(),'t');report.owned_disposable_database_removed=true;}
  if(roleMayExist){const role=await roleIdentity();if(role){roleOid=role.oid;const dependencies=(await sql('template1',`begin read only;select count(*)from pg_shdepend where refclassid='pg_authid'::regclass and refobjid=${roleOid}::oid and dbid<>0;rollback;`)).trim();assert.equal(dependencies,'0');await roleIdentity();await sql('template1','drop role eps_oauth_consent_owner;');assert.equal(await roleIdentity(),null);}report.owned_test_role_removed=true;}
  if(roleBefore){const after=await sql('postgres',rolesSql);assert.equal(after,roleBefore);report.global_roles_unchanged=true;}
  if(locked&&(!created||report.owned_disposable_database_removed)&&report.global_roles_unchanged){assert.equal(JSON.parse(await readFile(lock,'utf8')).run_id,run);await unlink(lock);report.shared_lock_released=true;}
 }catch{report.result='failed';report.cleanup_unconfirmed=true;}
 report.finished_at=new Date().toISOString();const folder=path.join(ROOT,'tracking/evidence/m07/oauth-consent-fix');await mkdir(folder,{recursive:true});const file=path.join(folder,report.started_at.replace(/[:.]/gu,'-')+'-'+run.slice(0,8)+'-local.json');await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({result:report.result,checkpoint:report.checkpoint,cleanup:report.owned_disposable_database_removed,roles_unchanged:report.global_roles_unchanged,lock_released:report.shared_lock_released,evidence:path.relative(ROOT,file)}));if(report.result!=='passed')process.exitCode=1;
}
