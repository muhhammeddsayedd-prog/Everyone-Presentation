/** Marked disposable local DB only; canonical and existing app DB remain untouched. */
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { verifyLocalTarget } from '../../../tools/local-postgres.mjs';

const ROOT=path.resolve(import.meta.dirname,'../../..'),HERE=import.meta.dirname;
const run=randomUUID().replaceAll('-',''),database='eps_oauth_consent_'+run,marker='eps-oauth-consent-owned:'+run;
const lock=path.join(ROOT,'.local/local-postgres/test-db.lock');
const oldMigration='supabase/migrations/20261031104603_m07_oauth_consent_binding_and_claims.sql';
const migration='supabase/migrations/20261031130207_m07_oauth_consent_browser_context.sql';
const host=process.platform==='win32'?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock';
const sha=value=>createHash('sha256').update(value).digest('hex');
const report={schema_version:'1.0',evidence_kind:'synthetic_context_disposable_local_database',run_id:run,started_at:new Date().toISOString(),result:'failed',cloud_called:false,provider_called:false,existing_app_database_writes:false,checkpoint:'initialization'};
let target,created=false,locked=false,oid,roleMayExist=false,roleOid,rolesBefore;
async function command(args,input=''){return new Promise((resolve,reject)=>{const child=spawn('docker',['--host',host,...args],{cwd:ROOT,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';const timer=setTimeout(()=>child.kill(),60000);child.stdout.on('data',b=>{stdout+=b;if(stdout.length>2*1024*1024)child.kill();});child.stderr.on('data',b=>{stderr+=b;if(stderr.length>256*1024)child.kill();});child.once('error',()=>{clearTimeout(timer);reject(Error('CONTEXT_LOCAL_TRANSPORT_FAILED'));});child.once('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr});});child.stdin.on('error',()=>{});child.stdin.end(input);});}
const psql=db=>['exec','--user','postgres','-i',target.container.Id,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-h','/var/run/postgresql','-U','supabase_admin','-d',db];
async function sql(db,body){const result=await command(psql(db),body);if(result.code!==0)throw Object.assign(Error('CONTEXT_LOCAL_SQL_FAILED'),{diagnostic:result.stderr.slice(-12000)});return result.stdout;}
async function identity(){const value=JSON.parse((await sql('template1',`begin read only;select jsonb_build_object('oid',oid::text,'name',datname,'owner',datdba::regrole::text,'marker',shobj_description(oid,'pg_database'),'clients',(select count(*)from pg_stat_activity where datname='${database}'))from pg_database where datname='${database}';rollback;`)).trim());assert.equal(value.name,database);assert.equal(value.owner,'postgres');assert.equal(value.marker,marker);if(oid)assert.equal(value.oid,oid);return value;}
const rolesSql="begin read only;select coalesce(jsonb_agg(jsonb_build_object('oid',oid,'name',rolname,'login',rolcanlogin,'inherit',rolinherit,'bypass',rolbypassrls,'super',rolsuper)order by oid),'[]')from pg_roles;rollback;";
async function roleIdentity(){const raw=(await sql('template1',"begin read only;select jsonb_build_object('oid',r.oid::text,'marker',shobj_description(r.oid,'pg_authid'),'safe',not r.rolcanlogin and not r.rolsuper and not r.rolinherit and not r.rolbypassrls and not r.rolcreaterole and not r.rolcreatedb and not r.rolreplication,'members',(select array_agg(distinct member::regrole::text order by member::regrole::text)from pg_auth_members where roleid=r.oid))from pg_roles r where rolname='eps_oauth_consent_owner';rollback;")).trim();if(!raw)return null;const value=JSON.parse(raw);assert.equal(value.marker,marker);assert.equal(value.safe,true);assert.deepEqual(value.members,['postgres']);if(roleOid)assert.equal(value.oid,roleOid);return value;}
const claims=session=>JSON.stringify({sub:'10000000-0000-4000-8000-000000000001',role:'authenticated',aud:'authenticated',is_anonymous:false,session_id:session});
const sid='20000000-0000-4000-8000-000000000001';
const browser=`set local role authenticated;select set_config('request.jwt.claims','${claims(sid)}',true);`;
const extract=text=>text.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
try{
 const handle=await open(lock,'wx',0o600);await handle.writeFile(JSON.stringify({run_id:run,pid:process.pid,purpose:'oauth-context-synthetic-local'}));await handle.close();locked=true;
 target=await verifyLocalTarget();assert.equal(target.observed.system_identifier,'7701520506262638626');
 rolesBefore=await sql('postgres',rolesSql);report.global_roles_before_sha256=sha(rolesBefore);
 assert(/^eps_oauth_consent_[a-f0-9]{32}$/u.test(database));
 await sql('template1',`create database "${database}"with template template0 owner postgres;comment on database "${database}"is '${marker}';`);created=true;oid=(await identity()).oid;
 const files=[oldMigration,migration,'development/m07/oauth-consent-fix/fixture.sql','development/m07/oauth-consent-fix/tests.sql','development/m07/oauth-attempt-trace/fixture-auth-schema.sql','development/m07/oauth-attempt-trace/tests-context.sql','development/m07/oauth-attempt-trace/release-context33.py','development/m07/oauth-attempt-trace/run-local-context.mjs','development/m07/oauth-attempt-trace/test_context_source.py','development/m07/oauth-attempt-trace/inspect-attempt.py'];
 const sources=Object.fromEntries(await Promise.all(files.map(async file=>[file,await readFile(path.join(ROOT,file),'utf8')])));report.source_sha256=Object.fromEntries(Object.entries(sources).map(([file,body])=>[file,sha(body)]));
 report.checkpoint='faithful32-synthetic-setup';roleMayExist=true;
 const fixtureStatus="create table eps.jobs(id uuid primary key,status text,stage text,attempt integer,row_version bigint);insert into eps.jobs values('b3f90268-147d-41d4-8875-2a6435df1496','waiting_for_input','apply_specs',3,7);";
 await sql(database,`set log_statement='none';set log_min_duration_statement=-1;begin;set local role postgres;set local timezone='UTC';set local search_path='';set local eps.oauth_consent_test_run='${run}';${sources['development/m07/oauth-consent-fix/fixture.sql']}\n${sources['development/m07/oauth-attempt-trace/fixture-auth-schema.sql']}\n${fixtureStatus}\n${sources[oldMigration]}\ninsert into supabase_migrations.schema_migrations(version)values('20261031104603');comment on role eps_oauth_consent_owner is '${marker}';commit;`);
 roleOid=(await roleIdentity()).oid;
 report.managed_namespace_faithful=JSON.parse((await sql(database,"begin read only;select jsonb_build_object('owner_usage',has_schema_privilege('eps_oauth_consent_owner','auth','USAGE'),'postgres_usage',has_schema_privilege('postgres','auth','USAGE'),'postgres_grant_option',has_schema_privilege('postgres','auth','USAGE WITH GRANT OPTION'),'auth_owner',(select pg_get_userbyid(nspowner)from pg_namespace where nspname='auth'));rollback;")).trim());
 assert.deepEqual(report.managed_namespace_faithful,{owner_usage:false,postgres_usage:true,postgres_grant_option:false,auth_owner:'supabase_admin'});
 report.checkpoint='red32-prefix';
 const red=await command(psql(database),`set log_statement='none';begin;${browser}select public.eps_oauth_consent_claim(repeat('a',32),'https://studio.example.invalid/mcp','details','40000000-0000-4000-8000-000000000001');rollback;`);
 assert.notEqual(red.code,0);assert(/42501:[\s\S]*permission denied for schema auth/u.test(red.stderr));report.original_failure_reproduced={sqlstate:'42501',reason:'permission_denied_auth_schema'};
 const prefix=`set log_statement='none';set log_min_duration_statement=-1;begin;set local role postgres;set local timezone='UTC';set local search_path='';set local eps.oauth_consent_test_run='${run}';`;
 report.checkpoint='minimal-bridge-policy-probe';
 const policyStart=sources[migration].indexOf('-- The ledger keeps exactly');assert(policyStart>0);
 const minimal=await command(psql(database),prefix+sources[migration].slice(0,policyStart)+browser+"select public.eps_oauth_consent_claim(repeat('a',32),'https://studio.example.invalid/mcp','details','40000000-0000-4000-8000-000000000001');rollback;");
 assert.notEqual(minimal.code,0);assert(/42501:[\s\S]*permission denied for schema auth/u.test(minimal.stderr));report.stored_sql_helper_policy_failure_reproduced={sqlstate:'42501',existing_synthetic_uid_calls_auth_jwt:true,own_ledger_policy_bridge_required:true};
 report.checkpoint='green33-original-and-context-tests';
 const oldTests=sources['development/m07/oauth-consent-fix/tests.sql'],newTests=sources['development/m07/oauth-attempt-trace/tests-context.sql'];
 // Temporary values table from the original fixture is session-local.
 const temp="create temporary table consent_test_values(name text primary key,value jsonb);grant all on consent_test_values to authenticated;";
 const result=await sql(database,prefix+temp+sources[migration]+oldTests+newTests+'rollback;');
 const proof=extract(result).find(value=>value.scope==='synthetic-context-with-auth-usage-false');assert.equal(proof?.result,'passed');
 report.assertion_count=[...(oldTests+newTests).matchAll(/select public\.consent_test_(?:assert|reject)\(/gu)].length;report.synthetic_tests=proof;
 assert.equal((await sql(database,"begin read only;select to_regprocedure('eps.oauth_consent_browser_context()')is null and not exists(select 1 from eps.oauth_consent_claims);rollback;")).trim(),'t');report.green_transaction_rollback_verified=true;
 report.checkpoint='complete-emitted-wire-with-real-guards';
 const stateCode="import importlib.util;from pathlib import Path;p=Path('development/m07/oauth-attempt-trace/release-context33.py');s=importlib.util.spec_from_file_location('r',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(m.state_sql())";
 const stateSql=execFileSync('python',['-X','utf8','-B','-c',stateCode],{cwd:ROOT,encoding:'utf8',windowsHide:true}).trim();
 const wireBefore=JSON.parse((await sql(database,"begin read only;set local role postgres;set local search_path='';set local timezone='UTC';"+stateSql+';rollback;')).trim());
 const wireMarker=randomUUID();const wire=JSON.parse(execFileSync('python',['-X','utf8','-B',path.join(HERE,'release-context33.py'),'render-local'],{cwd:ROOT,input:JSON.stringify({before:wireBefore,marker:wireMarker}),encoding:'utf8',windowsHide:true})).sql;
 const wireResult=await sql(database,`set log_statement='none';set log_min_duration_statement=-1;set role postgres;set timezone='UTC';set eps.oauth_consent_test_run='${run}';`+wire);
 const wireReturn=extract(wireResult).at(-1);assert.equal(wireReturn.version,'20261031130207');assert.equal(wireReturn.marker,wireMarker);
 const wireAfter=JSON.parse((await sql(database,"begin read only;set local role postgres;set local search_path='';set local timezone='UTC';"+stateSql+';rollback;')).trim());
 const verifyCode="import importlib.util,json,sys;from pathlib import Path;p=Path('development/m07/oauth-attempt-trace/release-context33.py');s=importlib.util.spec_from_file_location('r',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);v=json.load(sys.stdin);m.check_after(v['after'],v['before']);print('VERIFIED')";
 assert.equal(execFileSync('python',['-X','utf8','-B','-c',verifyCode],{cwd:ROOT,input:JSON.stringify({before:wireBefore,after:wireAfter}),encoding:'utf8',windowsHide:true}).trim(),'VERIFIED');
 report.full_emitted_wire={sql_sha256:sha(wire),real_before_and_after_guards_executed:true,coordinated_history33_before_commit:true,no_jwt_functional_guard_executed:true,managed_metadata_exactly_preserved:true,previous_sixteen_checks_still_true:true,committed_only_owned_disposable_database:true};
 report.new_policy=JSON.parse((await sql(database,"begin read only;select jsonb_build_object('using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid))from pg_policy where polrelid='eps.oauth_consent_claims'::regclass and polname='oauth_consent_own_claim';rollback;")).trim());
 report.checkpoint='independent-connection-races';
 const rpc=(letter,action,id,session=sid)=>`begin;set local role authenticated;select set_config('request.jwt.claims','${claims(session)}',true);select public.eps_oauth_consent_claim(repeat('${letter}',32),'https://studio.example.invalid/mcp','${action}','40000000-0000-4000-8000-${String(id).padStart(12,'0')}');select pg_sleep(0.15);commit;`;
 const envelopes=result=>extract(result.stdout).filter(value=>Object.hasOwn(value,'state'));
 const detailsRace=await Promise.all([command(psql(database),rpc('j','details',101)),command(psql(database),rpc('j','details',102))]);assert(detailsRace.every(result=>result.code===0));const details=detailsRace.flatMap(envelopes);assert.deepEqual(details.map(value=>value.state).sort(),['claimed','in_progress']);const winner=details.find(value=>value.state==='claimed');
 await sql(database,`begin;set local role postgres;update auth.oauth_authorizations set user_id='10000000-0000-4000-8000-000000000001'where authorization_id=repeat('j',32);${browser}select public.eps_oauth_consent_finish(repeat('j',32),'https://studio.example.invalid/mcp','${winner.claim_id}','consent_ready');commit;`);
 const decisionRace=await Promise.all([command(psql(database),rpc('j','approve',103)),command(psql(database),rpc('j','deny',104))]);assert(decisionRace.every(result=>result.code===0));assert.deepEqual(decisionRace.flatMap(envelopes).map(value=>value.state).sort(),['claimed','in_progress']);
 const browserRace=await Promise.all([command(psql(database),rpc('k','details',105)),command(psql(database),rpc('k','details',106,'20000000-0000-4000-8000-000000000002'))]);assert.equal(browserRace.filter(result=>result.code===0).length,1);assert.equal(browserRace.filter(result=>result.code!==0).length,1);assert.equal(browserRace.flatMap(envelopes).filter(value=>value.state==='claimed').length,1);
 report.concurrent_checks={details_one_winner:true,approve_deny_one_winner:true,different_browser_one_winner:true,independent_connections:true,coordinator_auth_usage:false};
 report.result='passed';report.checkpoint='complete';
}catch(error){report.failure='CONTEXT_LOCAL_UNCONFIRMED';report.synthetic_diagnostic=error.diagnostic??error.message;}
finally{
 try{
  if(created){const current=await identity();assert.equal(current.clients,0);await sql('template1',`drop database "${database}";`);assert.equal((await sql('template1',`begin read only;select not exists(select 1 from pg_database where datname='${database}');rollback;`)).trim(),'t');report.owned_disposable_database_removed=true;}
  if(roleMayExist){const role=await roleIdentity();if(role){roleOid=role.oid;assert.equal((await sql('template1',`begin read only;select count(*)from pg_shdepend where refclassid='pg_authid'::regclass and refobjid=${roleOid}::oid and dbid<>0;rollback;`)).trim(),'0');await roleIdentity();await sql('template1','drop role eps_oauth_consent_owner;');assert.equal(await roleIdentity(),null);}report.owned_test_role_removed=true;}
  if(rolesBefore){assert.equal(await sql('postgres',rolesSql),rolesBefore);report.global_roles_unchanged=true;}
  if(locked&&report.owned_disposable_database_removed&&report.global_roles_unchanged){assert.equal(JSON.parse(await readFile(lock,'utf8')).run_id,run);await unlink(lock);report.shared_lock_released=true;}
 }catch{report.result='failed';report.cleanup_unconfirmed=true;}
 report.finished_at=new Date().toISOString();const folder=path.join(ROOT,'tracking/evidence/m07/oauth-attempt-trace');await mkdir(folder,{recursive:true});const file=path.join(folder,report.started_at.replace(/[:.]/gu,'-')+'-'+run.slice(0,8)+'-local-context.json');await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({result:report.result,checkpoint:report.checkpoint,cleanup:report.owned_disposable_database_removed,roles_unchanged:report.global_roles_unchanged,lock_released:report.shared_lock_released,evidence:path.relative(ROOT,file)}));if(report.result!=='passed')process.exitCode=1;
}
