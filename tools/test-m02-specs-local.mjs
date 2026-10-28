/** Fixed, reviewed local migration8/manual-specs gate. No cloud/provider calls. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { setTimeout } from 'node:timers';
import { runOwnedLocalSql, runReviewedSqlFile, verifyLocalTarget } from './local-postgres.mjs';

const ROOT = path.resolve(import.meta.dirname,'..');
const MANIFEST = path.join(ROOT,'development/local-db/reviewed.json');
const LOCK = path.join(ROOT,'.local/local-postgres/test-db.lock');
const MIGRATION = 'supabase/migrations/20261028172320_m02_manual_specs_draft.sql';
const HISTORICAL = 'tests/db/m02-specs-draft-candidate.sql';
const HISTORICAL_HASH = '3b3c4e259934639e03e0536aaabd34c2a0a91ccca5535b630dc2410546323d67';
const FILES = Object.fromEntries(['prelude','setup','column-acl','create-a','create-b','conflict-a','conflict-b','revoke-a','revoke-b','verify','mark-source','unmark-source','cleanup']
  .map(name=>[name,`tests/db/m02-specs-local-${name}.sql`]));
const sha256 = value=>createHash('sha256').update(value).digest('hex');
function assert(value,message) { if(!value) throw new Error(message); }
function diagnostic(error) { return String(error instanceof Error?error.message:'Local specs test failed.').replace(/[A-Za-z0-9_-]{43,}/gu,'[LONG_VALUE_REDACTED]').slice(0,3000); }
function records(stdout) { return stdout.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line)); }
function one(result,phase) { const values=result.filter(value=>value.phase===phase); assert(values.length===1&&Number.isSafeInteger(values[0].session_pid),`Missing unique ${phase} backend marker.`); return values[0]; }
function duration(result) { return Date.parse(one(result,'returned').at)-Date.parse(one(result,'started').at); }
/** Accident guard for these sealed sources, not an arbitrary SQL parser. */
function guardSource(sql) {
 const outer=sql.replace(/\$([A-Za-z_][A-Za-z0-9_]*|)\$[\s\S]*?\$\1\$/gu,()=> ' ')
  .replace(/--[^\r\n]*/gu,' ').replace(/\/\*[\s\S]*?\*\//gu,' ')
  .replace(/'(?:''|[^'])*'/gu,' ').replace(/"(?:""|[^"])*"/gu,' ');
 assert(!outer.includes('\\'),'Reviewed assertions may not contain psql metacommands.');
 for(const statement of outer.split(';')) assert(!/^\s*(?:begin\b|start\s+transaction\b|commit\b|end\b|rollback\b|abort\b|savepoint\b|release\b|prepare\s+transaction\b|set\s+transaction\b)/iu.test(statement),
  'Historical assertions may not control transactions.');
}

const SNAPSHOT = `begin read only;
do $snapshot$ declare item record; amount bigint; counts jsonb:='{}'; result jsonb; specs jsonb; begin
 for item in select ns.nspname,relation.relname from pg_class relation join pg_namespace ns on ns.oid=relation.relnamespace
  where ns.nspname in('public','eps','auth','storage','eps_local_guard','supabase_migrations') and relation.relkind in('r','p') order by ns.nspname,relation.relname loop
  execute format('select count(*) from %I.%I',item.nspname,item.relname) into amount;
  counts:=counts||jsonb_build_object(item.nspname||'.'||item.relname,amount);
 end loop;
 if to_regclass('eps.specs') is not null then
  select jsonb_build_object(
   'relations',(select jsonb_agg(jsonb_build_object('name',relation.relname,'rls',relation.relrowsecurity,'force',relation.relforcerowsecurity,'owner',pg_get_userbyid(relation.relowner)) order by relation.relname)
    from pg_class relation join pg_namespace ns on ns.oid=relation.relnamespace where ns.nspname='eps' and relation.relname in('specs','roles','slots') and relation.relkind='r'),
   'roles',(select jsonb_agg(jsonb_build_object('name',role.rolname,'login',role.rolcanlogin,'bypass',role.rolbypassrls,'superuser',role.rolsuper) order by role.rolname)
    from pg_roles role where role.rolname in('eps_specs_owner','eps_specs_initializer')),
   'rpcs',(select jsonb_agg(jsonb_build_object('name',proc.proname,'owner',pg_get_userbyid(proc.proowner),'definer',proc.prosecdef,'config',proc.proconfig,
     'anon',has_function_privilege('anon',proc.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',proc.oid,'EXECUTE'),'service',has_function_privilege('service_role',proc.oid,'EXECUTE')) order by proc.proname)
    from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace where ns.nspname='public' and proc.proname in('eps_get_specs','eps_update_specs','eps_list_roles','eps_create_role','eps_update_role','eps_list_slots','eps_resize_role_slots','eps_archive_role','eps_update_slot')),
   'initializer_only_workspace_insert',has_column_privilege('eps_specs_initializer','eps.specs','workspace_id','INSERT') and not has_column_privilege('eps_specs_initializer','eps.specs','source_text','INSERT') and not has_table_privilege('eps_specs_initializer','eps.specs','SELECT'),
   'no_direct_user_tables',not has_table_privilege('authenticated','eps.specs','SELECT') and not has_table_privilege('authenticated','eps.roles','INSERT') and not has_table_privilege('authenticated','eps.slots','UPDATE'),
   'no_processing_enqueue',not has_function_privilege('eps_specs_owner','eps.m02_enqueue_specs_job(uuid,jsonb,text)','EXECUTE')
  ) into specs;
 end if;
 result:=jsonb_build_object('query_role',current_user,'unrestricted',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
  'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),'counts',counts,'specs_boundary',specs,
  'specs_relations',(select count(*) from pg_class relation join pg_namespace ns on ns.oid=relation.relnamespace where ns.nspname='eps' and relation.relname in('specs','roles','slots')));
 perform set_config('eps.specs_local.snapshot',result::text,true);
end $snapshot$;
select current_setting('eps.specs_local.snapshot')::jsonb;
rollback;`;

async function main() {
 assert(process.argv.length===2&&/^v24\./u.test(process.version),'Require pinned Node24 and no target/file arguments.');
 const runId=randomUUID(); let ownsLock=false; let prelude=false; let sourceMarked=false; let manifest; let manifestHash;
 const summary={schema_version:'1.0',run_id:runId,started_at:new Date().toISOString(),harness_sha256:sha256(await readFile(import.meta.filename)),result:'failed',stages:[],concurrency:[],cloud_called:false,provider_called:false,
  source_submission_tested:false,assignment_retirement_integrated:false,job_callbacks_tested:false,scope:'Persisted manual-specs migration, local real-role SQL assertions, separate-backend races and strict owned fixture cleanup only.'};
 async function unchanged() { assert(sha256(await readFile(MANIFEST))===manifestHash,'Review manifest changed during the local gate.'); }
 async function sealed(file) {
  await unchanged(); const entry=[...manifest.migrations,...manifest.tests].find(value=>value.path===file);
  assert(entry&&/^[a-f0-9]{64}$/u.test(entry.sha256)&&entry.reviewed_by&&Number.isFinite(Date.parse(entry.reviewed_at)),`Missing reviewed source: ${file}.`);
  const bytes=await readFile(path.join(ROOT,file)); assert(sha256(bytes)===entry.sha256&&!/^\s*\\/mu.test(bytes.toString('utf8')),`Reviewed source changed: ${file}.`);
  return {entry,sql:bytes.toString('utf8')};
 }
 async function stage(name,file,{expectedError}={}) {
  const source=await sealed(file); const start=performance.now(); const record={name,path:file,sha256:source.entry.sha256,result:'failed',started_at:new Date().toISOString()}; summary.stages.push(record);
  try {
   const result=await runOwnedLocalSql(source.sql);
   assert(!expectedError,'Cleanup unexpectedly accepted a nonempty source.');
   const values=records(result.stdout); record.markers=values.filter(value=>['started','returned','holding'].includes(value.phase)); record.result='passed'; return values;
  } catch(error) {
   if(expectedError&&error instanceof Error&&new RegExp('^ERROR:\\s+'+expectedError+'\\s*$','mu').test(error.message)) { record.result='expected_rejection'; record.code=expectedError; return []; }
   record.error=diagnostic(error); throw error;
  } finally { record.finished_at=new Date().toISOString(); record.duration_ms=Math.round(performance.now()-start); }
 }
 async function snapshot() { const result=records((await runOwnedLocalSql(SNAPSHOT)).stdout); assert(result.length===1&&result[0].query_role==='postgres'&&result[0].unrestricted===true,'Unrestricted owned-local snapshot required.'); return result[0]; }
 async function waitHolding(name) {
  assert(['eps_specs_revoke_a','eps_specs_source_a','eps_specs_create_a','eps_specs_conflict_a'].includes(name),'Unknown fixed barrier.'); const deadline=Date.now()+10000;
  while(Date.now()<deadline) {
   const found=records((await runOwnedLocalSql(`begin read only; select jsonb_build_object('pid',(select pid from pg_stat_activity where application_name='${name}' and state='active' and wait_event='PgSleep')); rollback;`)).stdout)[0];
   if(Number.isSafeInteger(found?.pid)) return found.pid;
   await new Promise(done=>setTimeout(done,50));
  }
  throw new Error('Reviewed transaction holding its lock was not observed.');
 }
 async function pair(name,fileA,fileB) {
  const application=name==='same-key-role-create'?'eps_specs_create':name==='rename-versus-resize'?'eps_specs_conflict':null;
  assert(application,'Unknown fixed pair.');
  const pending=[stage(`${name}-a`,fileA)]; pending[0].catch(()=>undefined);
  try {
   const holder=await waitHolding(`${application}_a`); pending.push(stage(`${name}-b`,fileB));
   const deadline=Date.now()+8000; let observed;
   while(Date.now()<deadline&&!observed) {
    const value=records((await runOwnedLocalSql(`begin read only; select jsonb_build_object('waiter',(select pid from pg_stat_activity where application_name='${application}_b' and ${holder}=any(pg_blocking_pids(pid))),'holder',${holder}); rollback;`)).stdout)[0];
    if(Number.isSafeInteger(value?.waiter)&&value.waiter!==holder) observed=value; else await new Promise(done=>setTimeout(done,50));
   }
   const values=await Promise.all(pending); const pids=values.map(value=>one(value,'started').session_pid);
   assert(observed&&pids[0]===holder&&pids[1]===observed.waiter&&duration(values[1])>900,'Distinct backends and actual parent/advisory lock blocking over900ms required.');
   summary.concurrency.push({name,distinct_backends:true,pids,rpc_durations_ms:values.map(duration),actual_blocker_sampled:true,holder_pid:holder,waiter_pid:observed.waiter}); return values;
  } finally { await Promise.allSettled(pending); }
 }
 try {
  const target=await verifyLocalTarget(); summary.environment={container:target.config.container,system_identifier:target.observed.system_identifier,host_ip:'127.0.0.1',host_port:'55433'};
  await mkdir(path.dirname(LOCK),{recursive:true}); const lock=await open(LOCK,'wx',0o600);
  try { await lock.writeFile(JSON.stringify({run_id:runId,pid:process.pid})); await lock.sync(); ownsLock=true; } finally { await lock.close(); }
  const bytes=await readFile(MANIFEST); manifest=JSON.parse(bytes.toString('utf8')); manifestHash=sha256(bytes);
  assert(manifest.version===1&&Array.isArray(manifest.migrations)&&Array.isArray(manifest.tests),'Reviewed manifest required.');
  const migrations=(await readdir(path.join(ROOT,'supabase/migrations'))).filter(file=>file.endsWith('.sql')).sort().map(file=>`supabase/migrations/${file}`);
  assert(migrations.length===8&&migrations.at(-1)===MIGRATION&&manifest.migrations.length===8,'Exact reviewed eight-file history required.');
  const all=[...manifest.migrations,...manifest.tests]; assert(new Set(all.map(value=>value.path)).size===all.length,'Duplicate review manifest entries.');
  for(const file of [...migrations,...Object.values(FILES),HISTORICAL]) await sealed(file);
  assert((await sealed(HISTORICAL)).entry.sha256===HISTORICAL_HASH,'Historical assertions were changed.');
  summary.reviewed_manifest_sha256=manifestHash;
  const versions=migrations.map(file=>path.basename(file).slice(0,14)); summary.expected_versions=versions; summary.before=await snapshot();
  assert(JSON.stringify(summary.before.versions)===JSON.stringify(versions.slice(0,7))||JSON.stringify(summary.before.versions)===JSON.stringify(versions),'Require exact before7/after8 local target.');
  const firstApply=summary.before.versions.length===7; summary.first_migration_application=firstApply;
  if(firstApply) assert(summary.before.specs_boundary===null&&summary.before.specs_relations===0,'Initial backfill proof requires the uninstalled specs schema before fixture creation.');
  await stage(firstApply?'committed-pre-DDL-backfill-fixture':'committed-existing-schema-fixture',FILES.prelude); prelude=true;
  for(const file of migrations) { await unchanged(); const replay=await runReviewedSqlFile(file); assert(['applied','already_applied'].includes(replay.result),'Migration replay unconfirmed.');
   if(file===MIGRATION) { summary.migration8_result=replay.result; if(firstApply) assert(replay.result==='applied','Initial backfill must actually apply migration8.'); }
   summary.stages.push({name:'migration-replay',path:file,sha256:replay.sha256,result:replay.result,receipt:replay.receipt}); }
  await stage('manual-owner-source-identity-column-ACL',FILES['column-acl']);
  const historical=await sealed(HISTORICAL);
  guardSource(historical.sql);
  const composed=`begin; set local eps.specs_candidate_rehearsal='rollback-only-v1';\n${historical.sql}\nrollback;`;
  await runOwnedLocalSql(composed); summary.stages.push({name:'persisted-role-RLS-suppressed-DML-assertions',path:HISTORICAL,sha256:HISTORICAL_HASH,result:'passed',composed_sql_sha256:sha256(composed)});
  summary.backfill_tested_by_migration=firstApply;
  await stage('acting-user-fixture',FILES.setup);
  const created=await pair('same-key-role-create',FILES['create-a'],FILES['create-b']);
  assert(one(created[0],'returned').role_id===one(created[1],'returned').role_id,'Idempotent role creation returned different identities.');
  const conflict=await pair('rename-versus-resize',FILES['conflict-a'],FILES['conflict-b']);
  assert(conflict.map(value=>one(value,'returned').outcome).sort().join(',')==='applied,stale','Expected one applied mutation and one stale-version rejection.');
  const pending=[stage('scope-revoker',FILES['revoke-a'])]; pending[0].catch(()=>undefined);
  try { const holder=await waitHolding('eps_specs_revoke_a'); pending.push(stage('cached-replay-after-revoke',FILES['revoke-b']));
   const deadline=Date.now()+8000; let observed;
   while(Date.now()<deadline&&!observed) {
    const value=records((await runOwnedLocalSql(`begin read only; select jsonb_build_object('waiter',(select pid from pg_stat_activity where application_name='eps_specs_revoke_b' and ${holder}=any(pg_blocking_pids(pid))),'holder',${holder}); rollback;`)).stdout)[0];
    if(Number.isSafeInteger(value?.waiter)&&value.waiter!==holder) observed=value; else await new Promise(done=>setTimeout(done,50));
   }
   const result=await Promise.all(pending);
   assert(observed&&one(result[1],'started').session_pid===observed.waiter&&one(result[1],'returned').revoked_replay_denied===true&&duration(result[1])>900,'Revoked cached replay did not demonstrably block and deny.');
   summary.concurrency.push({name:'revoked-cached-role-replay',holder_pid:holder,waiter_pid:observed.waiter,rpc_duration_ms:duration(result[1]),actual_blocker_sampled:true,denied:true});
  } finally { await Promise.allSettled(pending); }
  await stage('persisted-manual-effects',FILES.verify);
  const preservation=[stage('controlled-source-sentinel',FILES['mark-source']).then(value=>{sourceMarked=true;return value;})]; preservation[0].catch(()=>undefined);
  try {
   const holder=await waitHolding('eps_specs_source_a');
   preservation.push(stage('nonempty-source-cleanup-refused',FILES.cleanup,{expectedError:'SPECS_LOCAL_SOURCE_PRESERVATION_REQUIRED'}));
   const deadline=Date.now()+8000; let observed;
   while(Date.now()<deadline&&!observed) {
    const value=records((await runOwnedLocalSql(`begin read only; select jsonb_build_object('waiter',(select pid from pg_stat_activity where application_name='eps_specs_cleanup_b' and ${holder}=any(pg_blocking_pids(pid))),'holder',${holder}); rollback;`)).stdout)[0];
    if(Number.isSafeInteger(value?.waiter)&&value.waiter!==holder) observed=value; else await new Promise(done=>setTimeout(done,50));
   }
   await Promise.all(preservation);
   assert(observed,'Actual cleanup blocking behind the source writer was not sampled.');
   summary.concurrency.push({name:'cleanup-preserves-source-after-row-wait',holder_pid:holder,waiter_pid:observed.waiter,actual_blocker_sampled:true,cleanup_denied:true});
  } finally { await Promise.allSettled(preservation); }
  await stage('known-source-sentinel-restored',FILES['unmark-source']); sourceMarked=false;
  summary.result='passed';
 } catch(error) { summary.error=diagnostic(error); }
 finally {
  if(sourceMarked) { try { await stage('recover-only-known-source-sentinel',FILES['unmark-source']); sourceMarked=false; } catch(error) { summary.result='failed'; summary.source_recovery_error=diagnostic(error); } }
  if(prelude) { try {
   await stage('strict-owned-fixture-cleanup',FILES.cleanup); summary.cleanup='passed'; summary.after=await snapshot();
   assert(JSON.stringify(summary.after.versions)===JSON.stringify(summary.after.versions.length===8?summary.expected_versions:summary.before.versions),'Exact sealed migration history was not preserved.');
   const expected={...summary.before.counts};
   if(summary.first_migration_application&&summary.after.versions.length===8) { expected['eps.specs']=expected['eps.workspaces']; expected['eps.roles']=0; expected['eps.slots']=0; expected['supabase_migrations.schema_migrations']++; expected['eps_local_guard.migration_replay']++; }
   assert(JSON.stringify(Object.entries(expected).sort())===JSON.stringify(Object.entries(summary.after.counts).sort()),'All business counts were not restored except the intentional migration/backfill.');
   const boundary=summary.after.specs_boundary;
   if(summary.after.versions.length===8) assert(boundary?.relations.length===3&&boundary.relations.every(row=>row.rls&&row.force&&row.owner==='postgres')
    &&boundary.roles.length===2&&boundary.roles.every(role=>!role.login&&!role.bypass&&!role.superuser)&&boundary.rpcs.length===9
    &&boundary.rpcs.every(rpc=>rpc.owner==='eps_specs_owner'&&rpc.definer&&rpc.authenticated&&!rpc.anon&&!rpc.service&&rpc.config?.length===1&&rpc.config[0]==='search_path=""')
    &&boundary.initializer_only_workspace_insert&&boundary.no_direct_user_tables&&boundary.no_processing_enqueue,'Persisted manual specs role/RLS/RPC boundary differs.');
   summary.all_business_counts_restored=true;
  } catch(error) { summary.result='failed'; summary.cleanup='failed; unknown data preserved'; summary.cleanup_error=diagnostic(error); } }
  if(ownsLock) { try { const owner=JSON.parse(await readFile(LOCK,'utf8')); assert(owner.run_id===runId&&owner.pid===process.pid,'Local DB lock owner changed.'); await unlink(LOCK); } catch(error) {summary.result='failed'; summary.lock_error=diagnostic(error);} }
  summary.finished_at=new Date().toISOString(); const directory=path.join(ROOT,'tracking/evidence/m02/specs-local'); await mkdir(directory,{recursive:true});
  const file=path.join(directory,`${summary.finished_at.replace(/[:.]/gu,'-')}-${runId.slice(0,8)}.json`); await writeFile(file,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
  process.stdout.write(`M02 persisted specs gate: ${summary.result}\nReceipt: ${path.relative(ROOT,file).replaceAll('\\','/')}\n`);
  if(summary.result!=='passed') {process.stderr.write(`${summary.error??summary.cleanup_error??summary.lock_error??'Local specs proof failed.'}\n`); process.exitCode=1;}
 }
}
main().catch(error=>{process.stderr.write(diagnostic(error)+'\n');process.exitCode=1;});
