/** Owned disposable LOCAL history28 clone. No linked CLI, credentials, cloud or provider calls. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { verifyLocalTarget, runOwnedLocalSql } from '../../../tools/local-postgres.mjs';
const ROOT=path.resolve(import.meta.dirname,'../../..');
assert(process.argv.length<=3&&(!process.argv[2]||['--red','--red-default'].includes(process.argv[2])));
const red=process.argv[2]==='--red',defaultRed=process.argv[2]==='--red-default',runId=randomUUID(),database=`eps_m07_settings_${runId.replaceAll('-','')}`;
const marker=`eps-m07-owned-settings29:${runId}`,privateRoot=path.join(ROOT,'.local/m07-db',runId);
const roleNames=['eps_settings_owner','eps_mcp_session_owner'];
const sha=v=>createHash('sha256').update(v).digest('hex'),rows=v=>v.split(/\r?\n/u).filter(s=>s.startsWith('{')).map(s=>JSON.parse(s));
const literal=v=>"'"+String(v).replaceAll("'","''")+"'",json=v=>literal(JSON.stringify(v))+'::jsonb';
const report={schema_version:'1.0',run_id:runId,started_at:new Date().toISOString(),result:'failed',mode:red?'red28':defaultRed?'red-default-consumption':'candidate29',cloud_called:false,provider_called:false,credentials_loaded:false,scope:'Owned disposable local28 clone, real database roles, synthetic settings/versions/Auth catalogue fixture. No cloud migration or live OAuth acceptance.'};
let target,locked=false,ownedOid,baseline;const ownedRoles=new Map();
async function command(args,{input='',allowFailure=false}={}){
 return new Promise((resolve,reject)=>{const child=spawn('docker',['--host',process.platform==='win32'?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock',...args],{cwd:ROOT,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',size=0;const timer=setTimeout(()=>child.kill(),60000);
  child.stdout.on('data',v=>{stdout+=v;size+=v.length;if(size>64*1024*1024)child.kill();});child.stderr.on('data',v=>{stderr+=v;size+=v.length;if(size>64*1024*1024)child.kill();});
  child.once('error',()=>{clearTimeout(timer);reject(Error('M07_LOCAL29_TRANSPORT_FAILED'));});child.once('close',code=>{clearTimeout(timer);if(code&&!allowFailure)reject(Object.assign(Error('M07_LOCAL29_SQL_UNCONFIRMED'),{privateDiagnostic:{code,stderr}}));else resolve({code,stdout,stderr});});child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
const psqlArgs=db=>['exec','--user','postgres','-i',target.container.Id,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','supabase_admin','-d',db];
async function identity(){
 const value=rows((await command(psqlArgs('template1'),{input:`begin read only;select jsonb_build_object('oid',oid,'name',datname,'owner',datdba::regrole::text,'comment',shobj_description(oid,'pg_database'),'clients',(select count(*)from pg_stat_activity where datname=${literal(database)}))from pg_database where datname=${literal(database)};rollback;`})).stdout).at(-1);
 assert(value);assert.equal(value.name,database);assert.equal(value.owner,'postgres');assert.equal(value.comment,marker);if(ownedOid)assert.equal(value.oid,ownedOid);return value;
}
async function sql(body,{role='postgres',claims,allowFailure=false,rollback=false}={}){
 await identity();assert(['postgres','supabase_auth_admin','authenticated','anon','eps_mcp_session_owner'].includes(role));
 const guard=`do $guard$begin if current_database()<>${literal(database)}or(select shobj_description(oid,'pg_database')from pg_database where datname=current_database())is distinct from${literal(marker)}then raise exception'OWNED_LOCAL29_DATABASE_REQUIRED';end if;end$guard$;`;
 return command(psqlArgs(database),{input:`set log_statement='none';set log_min_duration_statement=-1;${guard}begin;set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';set local eps.local_fixture_tests='eps-presentation-canonical-pg17-local';set local eps.m07_candidate_tests='owned-local29';set local role ${role};${claims?`select set_config('request.jwt.claim.sub',${literal(claims.sub??'')},true),set_config('request.jwt.claims',${json(claims)}::text,true);`:''}${body}\n${rollback?'rollback':'commit'};`,allowFailure});
}
const value=async(...args)=>rows((await sql(...args)).stdout).at(-1);
async function proveExactRelease(sources){
 const catalog=sources.get('development/m07/db/catalog29.sql'),data=sources.get('development/m07/db/data29.sql'),state=sources.get('development/m07/db/state29.sql'),candidate=sources.get('development/m07/db/candidate29.sql');
 const snapshot=data+'\n'+state+"\nselect jsonb_build_object('old_data',current_setting('eps.m07_readback.old_data')::jsonb,'new_state',current_setting('eps.m07_readback.new_state')::jsonb);\n";
 const observed=rows((await sql(catalog+'\n'+snapshot+'\n'+candidate+'\n'+catalog+'\n'+snapshot,{rollback:true})).stdout);assert.equal(observed.length,4);
 const[beforeCatalog,beforeState,afterCatalog,afterState]=observed;
 assert.deepEqual(beforeState.old_data,afterState.old_data,'M07_ESTABLISHED_DATA_OR_AUTH_METADATA_CHANGED');assert.deepEqual(beforeState.new_state.prior,afterState.new_state.prior);
 assert.equal(beforeState.new_state.app_settings,null);assert.equal(beforeState.new_state.mcp_oauth_resources,null);
 assert.deepEqual(afterState.new_state.app_settings,{count:1,settings:[{template_version:'1.1.0',default_timezone:'Africa/Cairo',default_review_expiry_days:30,row_version:1,identity_present:true}]});assert.deepEqual(afterState.new_state.mcp_oauth_resources,{count:0,enabled_count:0});
 const delta={schema_version:'1.0',created:Object.fromEntries(Object.entries(afterCatalog).filter(([k])=>!Object.hasOwn(beforeCatalog,k))),changed:Object.fromEntries(Object.entries(afterCatalog).filter(([k,v])=>Object.hasOwn(beforeCatalog,k)&&!isDeepStrictEqual(beforeCatalog[k],v)).map(([k,v])=>[k,{before:beforeCatalog[k],after:v}])),deleted:Object.fromEntries(Object.entries(beforeCatalog).filter(([k])=>!Object.hasOwn(afterCatalog,k))),new_state:afterState.new_state};
 assert.deepEqual(delta.deleted,{});assert.deepEqual(Object.keys(delta.changed).sort(),[
 'functions|eps.has_capability(text)|source_sha256','functions|public.eps_create_presentation_series(jsonb,text)|source_sha256','functions|public.eps_get_capabilities()|source_sha256','schemas|eps|acl','schemas|public|acl',
 ...['id','user_id','oauth_client_id','not_after','scopes'].map(name=>'columns|auth.sessions.'+name+'|acl'),
 ...['candidate_asset_config.id','candidate_asset_config.transcription_model','candidate_asset_config.extraction_model','presentation_templates.key','presentation_templates.version','presentation_templates.registered','review_processing_config.id','review_processing_config.model','specs_pipeline_config.id','specs_pipeline_config.model_version'].map(name=>'columns|eps.'+name+'|acl'),
 ...['check_input(jsonb,text[])','expected_version(jsonb,text)','fail(text,text,integer,bigint)','finish_mutation(text,text,jsonb,jsonb,uuid)','has_capability(text)','idempotency_begin(text,text,jsonb)','require_capability(text)'].map(name=>'functions|eps.'+name+'|acl'),
 'tables|eps.audit_events|acl','tables|eps.idempotency_records|acl'].sort());
 const deltaPath='development/m07/db/release29-delta.json';await writeFile(path.join(ROOT,deltaPath),JSON.stringify(delta,null,2)+'\n');
 const excluded=JSON.stringify([...Object.keys(delta.created),...Object.keys(delta.changed)].sort()).replaceAll("'","''");
 const ending="select coalesce(jsonb_object_agg(key,value),'{}')catalog from flat;";assert.equal(catalog.split(ending).length,2);
 const inside=catalog.replace(ending,"select coalesce(jsonb_object_agg(key,value),'{}')into mapped from flat;");
 const query=`-- M07 fixed-source metadata/data readback. No Auth rows, key values, credential digests, secrets or private payloads.\nbegin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';\n${data}\n${state}\ndo $m07_catalog$declare mapped jsonb;protected jsonb;selected jsonb;excluded jsonb:='${excluded}'::jsonb;begin\n${inside}\nselect coalesce(jsonb_object_agg(key,value),'{}')into protected from jsonb_each(mapped)where not excluded?key;select coalesce(jsonb_object_agg(key,value),'{}')into selected from jsonb_each(mapped)where excluded?key;perform set_config('eps.m07_readback.catalog',jsonb_build_object('catalog_protected_sha256',encode(sha256(convert_to(protected::text,'UTF8')),'hex'),'catalog_count',(select count(*)from jsonb_each(mapped)),'catalog_delta_values',selected)::text,true);end$m07_catalog$;\nselect jsonb_build_object('query_role',current_user,'database',current_database(),'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),'old_data',current_setting('eps.m07_readback.old_data')::jsonb,'new_state',current_setting('eps.m07_readback.new_state')::jsonb)||current_setting('eps.m07_readback.catalog')::jsonb;rollback;\n`;
 const queryPath='development/m07/db/release29-readback.sql';await writeFile(path.join(ROOT,queryPath),query);
 const inner=query.replace('begin isolation level repeatable read read only;','').replace(/rollback;\s*$/u,'');
 const before=await value(inner);assert.deepEqual(before.old_data,beforeState.old_data);assert.deepEqual(before.catalog_delta_values,Object.fromEntries(Object.entries(delta.changed).map(([k,v])=>[k,v.before])));
 await sql(candidate);
 const after=await value(inner);assert.deepEqual(after.old_data,before.old_data);assert.equal(after.catalog_protected_sha256,before.catalog_protected_sha256);assert.equal(after.catalog_count,before.catalog_count+Object.keys(delta.created).length);assert.deepEqual(after.catalog_delta_values,{...delta.created,...Object.fromEntries(Object.entries(delta.changed).map(([k,v])=>[k,v.after]))});assert.deepEqual(after.new_state,delta.new_state);
 report.exact_composed_candidate_rehearsed=true;report.compact_readback_exact=true;report.pure_candidate_rollback_verified=true;report.old_business_auth_and_config_preserved=true;
 report.release={candidate_path:'development/m07/db/candidate29.sql',candidate_sha256:sha(candidate),catalog_delta:deltaPath,catalog_delta_sha256:sha(await readFile(path.join(ROOT,deltaPath))),catalog_created_fields:Object.keys(delta.created).length,catalog_changed_fields:Object.keys(delta.changed).length,readback_query:queryPath,readback_sha256:sha(query),readback_before:before,readback_expected:after};
}
async function concurrencyProofs(){
 const principal='8f7a0000-0000-4000-8000-000000000001',claims={sub:principal,role:'authenticated',is_anonymous:false,aud:'authenticated'};
 await sql(`set local role supabase_auth_admin;insert into auth.users(id,is_anonymous)values('${principal}',false);set local role postgres;insert into public.app_capability_grants(principal_id,capability)values('${principal}','settings.manage');`);
 const options={role:'authenticated',claims,allowFailure:true};
 const racing=await Promise.all(['UTC','Europe/London'].map((zone,index)=>sql(`select public.eps_update_settings(${json({row_version:1,default_timezone:zone})},'m07-synthetic-race-write-${index}');`,options)));
 assert.equal(racing.filter(r=>r.code===0).length,1);assert.equal(racing.filter(r=>r.stderr.includes('STALE_RESOURCE_VERSION')).length,1);
 let state=await value('select public.eps_get_settings();',{role:'authenticated',claims});assert.equal(state.row_version,2);
 const input={row_version:2,default_timezone:'Africa/Cairo'},key='m07-synthetic-concurrent-replay';
 const same=await Promise.all([1,2].map(()=>sql(`select public.eps_update_settings(${json(input)},'${key}');`,options)));
 assert(same.every(r=>r.code===0));assert.deepEqual(rows(same[0].stdout).at(-1),rows(same[1].stdout).at(-1));
 state=await value('select public.eps_get_settings();',{role:'authenticated',claims});assert.equal(state.row_version,3);
 const replayLock=`hashtextextended('${principal}:settings.update_settings:${key}',0)`;
 const holder=sql(`set local application_name='m07-local29-replay-holder';select pg_advisory_xact_lock(${replayLock});select pg_sleep(5);`);
 let held=false;for(let i=0;i<20;i++){const observed=await value("select jsonb_build_object('held',exists(select 1 from pg_stat_activity where application_name='m07-local29-replay-holder'and wait_event='PgSleep'));",{});if(observed.held){held=true;break;}await new Promise(done=>setTimeout(done,100));}assert(held);
 const waiter=sql(`set local application_name='m07-local29-replay-waiter';select public.eps_update_settings(${json(input)},'${key}');`,options);
 let waiting=false;for(let i=0;i<20;i++){const observed=await value("select jsonb_build_object('waiting',exists(select 1 from pg_stat_activity where application_name='m07-local29-replay-waiter'and wait_event='advisory'));",{});if(observed.waiting){waiting=true;break;}await new Promise(done=>setTimeout(done,100));}assert(waiting);
 await sql(`update public.app_capability_grants set active=false where principal_id='${principal}'and capability='settings.manage';`);
 const [holderResult,waiterResult]=await Promise.all([holder,waiter]);assert.equal(holderResult.code,0);assert.notEqual(waiterResult.code,0);assert(waiterResult.stderr.includes('CAPABILITY_REQUIRED'));
 const count=await value("select jsonb_build_object('audit_count',(select count(*)from eps.audit_events where action='settings.update_settings'),'idempotency_count',(select count(*)from eps.idempotency_records where operation='settings.update_settings'),'row_version',(select row_version from eps.app_settings));");
 assert.deepEqual(count,{audit_count:2,idempotency_count:2,row_version:3});
 report.concurrent_same_revision_single_winner=true;report.concurrent_idempotent_replay_once=true;report.revocation_during_observed_advisory_wait_denied_cached_response=true;
}
const baselineSql=`begin read only;do $$declare r record;v text;result jsonb:='{}';begin for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'and n.nspname in('eps','public','auth','storage','supabase_migrations','eps_local_guard')order by 1,2 loop execute format('select md5(coalesce(string_agg(to_jsonb(t)::text,E''\\n''order by to_jsonb(t)::text),''''))from %I.%I t',r.nspname,r.relname)into v;result:=result||jsonb_build_object(r.nspname||'.'||r.relname,v);end loop;perform set_config('eps.m07.baseline',result::text,true);end$$;select jsonb_build_object('rows',current_setting('eps.m07.baseline')::jsonb,'functions',(select md5(string_agg(pg_get_functiondef(p.oid),E'\\n'order by p.oid::regprocedure::text))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public')and p.prokind='f'),'grants',(select md5(string_agg(c.oid::text||coalesce(c.relacl::text,''),E'\\n'order by c.oid))from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('eps','public','auth','storage')),'roles',(select md5(string_agg(rolname||oid::text||rolsuper::text||rolcanlogin::text||rolbypassrls::text,E'\\n'order by rolname))from pg_roles),'memberships',(select md5(string_agg(to_jsonb(m)::text,E'\\n'order by roleid,member))from pg_auth_members m));rollback;`;
async function cleanup(){
 if(ownedOid){const own=await identity();assert.equal(own.clients,0);await command(psqlArgs('template1'),{input:`drop database "${database}";`});const gone=rows((await command(psqlArgs('template1'),{input:`select jsonb_build_object('count',count(*))from pg_database where datname=${literal(database)};`})).stdout).at(-1);assert.equal(gone.count,0);report.disposable_database_removed=true;}
 for(const [name,oid]of ownedRoles){const found=rows((await command(psqlArgs('template1'),{input:`select jsonb_build_object('oid',oid,'name',rolname,'login',rolcanlogin,'superuser',rolsuper,'bypass',rolbypassrls)from pg_roles where rolname=${literal(name)};`})).stdout).at(-1);assert(found);assert.equal(found.oid,oid);assert.equal(found.name,name);assert.equal(found.login,false);assert.equal(found.superuser,false);assert.equal(found.bypass,false);await command(psqlArgs('template1'),{input:`drop role ${name};`});}
 report.created_roles_removed=ownedRoles.size;
 if(baseline){const after=rows((await runOwnedLocalSql(baselineSql)).stdout).at(-1);assert(isDeepStrictEqual(baseline,after));report.original_local28_database_and_roles_unchanged=true;}
 if(locked){assert.equal(JSON.parse(await readFile(path.join(ROOT,'.local/local-postgres/test-db.lock'),'utf8')).run_id,runId);await unlink(path.join(ROOT,'.local/local-postgres/test-db.lock'));report.shared_test_lock_released=true;}
}
try{
 await mkdir(privateRoot,{recursive:true,mode:0o700});
 target=await verifyLocalTarget();assert.equal(target.observed.system_identifier,'7701520506262638626');
 const lock=await open(path.join(ROOT,'.local/local-postgres/test-db.lock'),'wx',0o600);await lock.writeFile(JSON.stringify({run_id:runId,pid:process.pid,purpose:'m07-owned-local29'}));await lock.close();locked=true;
 const preflight=rows((await runOwnedLocalSql(`begin read only;select jsonb_build_object('migrations',(select count(*)from supabase_migrations.schema_migrations),'users',(select count(*)from auth.users),'other_clients',(select count(*)from pg_stat_activity where backend_type='client backend'and pid<>pg_backend_pid()),'roles',(select count(*)from pg_roles where rolname in('eps_settings_owner','eps_mcp_session_owner')));rollback;`)).stdout).at(-1);
 assert.deepEqual(preflight,{migrations:28,users:0,other_clients:0,roles:0});report.preflight=preflight;
 baseline=rows((await runOwnedLocalSql(baselineSql)).stdout).at(-1);report.original_baseline_sha256=sha(JSON.stringify(baseline));
 const sourcePaths=['development/m07/db/run-local29.mjs','tools/prepare-m07-candidate29.mjs',...['settings-forward.sql','settings-tests.sql','session-forward.sql','session-tests.sql','local-auth-fixture.sql','capabilities-default-forward.sql','capabilities-default-tests.sql','candidate29.sql','candidate29-inputs.json','baseline28-reviewed.json','catalog29.sql','data29.sql','state29.sql'].map(f=>'development/m07/db/'+f),...['m04-assignments-fixture.sql','m05-versions-fixture.sql','m05-versions.sql','m05-processing.sql'].map(f=>'tests/db/'+f),...(await readdir(path.join(ROOT,'supabase/migrations'))).filter(f=>f.endsWith('.sql')).map(f=>'supabase/migrations/'+f)];
 const sourceFiles=new Map(await Promise.all(sourcePaths.map(async f=>[f,await readFile(path.join(ROOT,f),'utf8')])));report.source_seals=Object.fromEntries([...sourceFiles].map(([f,v])=>[f,sha(v)]));
 const dump=await command(['exec','--user','postgres',target.container.Id,'pg_dump','-h','/var/run/postgresql','-U','supabase_admin','-d','postgres','--no-password','--no-security-labels','--clean','--if-exists','--strict-names','--no-large-objects',...['eps','public','auth','storage','supabase_migrations','extensions'].flatMap(s=>['--schema',s]),...['pg_stat_statements','pgcrypto','uuid-ossp'].flatMap(e=>['--extension',e])]);
 assert(!/^\\connect\b/mu.test(dump.stdout));
 await command(psqlArgs('template1'),{input:`create database "${database}" with template template0 owner postgres;comment on database "${database}" is ${literal(marker)};`});ownedOid=(await identity()).oid;
 await command(psqlArgs(database),{input:dump.stdout});
 if(red){
  for(const[signature,code]of[['public.eps_get_settings()','M07_SETTINGS_CAPABILITY_MISSING'],['public.eps_validate_own_oauth_session(text)','M07_OWN_OAUTH_SESSION_CAPABILITY_MISSING']]){const result=await sql(`do $$begin if to_regprocedure('${signature}')is null then raise exception'${code}';end if;end$$;`,{allowFailure:true});assert.notEqual(result.code,0);assert(result.stderr.includes(code));}
  report.meaningful_red=true;report.missing_settings_and_own_oauth_session_reproduced=true;
 }
 else{
  await sql(sourceFiles.get('development/m07/db/local-auth-fixture.sql'));
  if(defaultRed)await sql(sourceFiles.get('development/m07/db/settings-forward.sql')+'\n'+sourceFiles.get('development/m07/db/session-forward.sql'));
  else await proveExactRelease(sourceFiles);
  const roleRows=rows((await command(psqlArgs('template1'),{input:`select jsonb_build_object('name',rolname,'oid',oid)from pg_roles where rolname in('eps_settings_owner','eps_mcp_session_owner');`})).stdout);for(const role of roleRows)ownedRoles.set(role.name,role.oid);
  const fixtures=await Promise.all(['tests/db/m04-assignments-fixture.sql','tests/db/m05-versions-fixture.sql','tests/db/m05-versions.sql','tests/db/m05-processing.sql'].map(f=>readFile(path.join(ROOT,f),'utf8')));
  const proof=await sql(`set local role supabase_auth_admin;alter table auth.users enable row level security;set local role postgres;${fixtures.join('\n')}\n${sourceFiles.get('development/m07/db/settings-tests.sql')}\n${sourceFiles.get('development/m07/db/session-tests.sql')}\n${sourceFiles.get('development/m07/db/capabilities-default-tests.sql')}`,{rollback:true,allowFailure:defaultRed});
  if(defaultRed){assert.notEqual(proof.code,0);assert(proof.stderr.includes('M07_SETTINGS_DEFAULT_NOT_CONSUMED'));report.meaningful_default_consumption_red=true;}
  else{
  report.markers=proof.stdout.split(/\r?\n/u).filter(v=>/^M07_(?:SETTINGS|SESSION)_.*_PASSED$/u.test(v));assert.equal(report.markers.filter(v=>v.startsWith('M07_SETTINGS_')).length,4);assert.equal(report.markers.filter(v=>v.startsWith('M07_SESSION_')).length,4);report.real_role_settings_proofs_passed=true;report.real_role_own_session_and_direct_delegation_proofs_passed=true;
  assert(proof.stdout.includes('M07_CAPABILITIES_SAVED_TIMEZONE_NARROW_READ_AND_READY_PRESERVATION_PASSED'));report.saved_default_capabilities_and_ready_preservation_passed=true;
  await concurrencyProofs();
  }
 }
 for(const[f,v]of sourceFiles)assert.equal(sha(await readFile(path.join(ROOT,f),'utf8')),sha(v));report.sources_unchanged=true;report.result='passed';
}catch(error){report.failure_code='M07_LOCAL29_UNCONFIRMED';await writeFile(path.join(privateRoot,'diagnostic.txt'),JSON.stringify({message:error.message,stack:error.stack,diagnostic:error.privateDiagnostic},null,2),{mode:0o600});report.private_diagnostic=path.relative(ROOT,path.join(privateRoot,'diagnostic.txt')).replaceAll('\\','/');}
finally{
 // Candidate DDL can fail after creating roles; discover only the two absent-
 // before, fixed-name candidates, then validate their OIDs before cleanup.
 if(target&&ownedOid)try{const roles=rows((await command(psqlArgs('template1'),{input:`select jsonb_build_object('name',rolname,'oid',oid)from pg_roles where rolname in('eps_settings_owner','eps_mcp_session_owner');`})).stdout);for(const r of roles)if(roleNames.includes(r.name)&&!ownedRoles.has(r.name))ownedRoles.set(r.name,r.oid);}catch{report.role_cleanup_unconfirmed=true;}
 try{await cleanup();}catch(error){report.result='failed';report.cleanup_unconfirmed=true;await writeFile(path.join(privateRoot,'cleanup-diagnostic.txt'),JSON.stringify({message:error.message,diagnostic:error.privateDiagnostic},null,2),{mode:0o600});}
 report.finished_at=new Date().toISOString();report.elapsed_ms=Date.parse(report.finished_at)-Date.parse(report.started_at);
 const directory=path.join(ROOT,'tracking/evidence/m07/database29');await mkdir(directory,{recursive:true});const receipt=path.join(directory,`${report.started_at.replace(/[:.]/gu,'-')}-${runId.slice(0,8)}.json`);await writeFile(receipt,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({result:report.result,red:report.meaningful_red,settings:report.real_role_settings_proofs_passed,evidence:path.relative(ROOT,receipt).replaceAll('\\','/'),baseline_unchanged:report.original_local28_database_and_roles_unchanged,lock_released:report.shared_test_lock_released,diagnostic:report.private_diagnostic}));if(report.result!=='passed')process.exitCode=1;
}
