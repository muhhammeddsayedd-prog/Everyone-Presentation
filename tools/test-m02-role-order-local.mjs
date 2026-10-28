/** Fixed reviewed migration9/backend races. Owned local Docker only. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { setTimeout } from 'node:timers';
import { runOwnedLocalSql, runReviewedSqlFile, verifyLocalTarget } from './local-postgres.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const MANIFEST=path.join(ROOT,'development/local-db/reviewed.json');
const LOCK=path.join(ROOT,'.local/local-postgres/test-db.lock');
const MIGRATION='supabase/migrations/20261028184145_m02_role_order.sql';
const ASSERTIONS='tests/db/m02-role-order-candidate.sql';
const ASSERTIONS_HASH='fc77286d9ee889649b4172fe18d4066d493e773bd9ada781f4d9250bca3a7138';
const FILES=Object.fromEntries(['setup','reorder-a','editor-b','create-a','stale-b','replay-control','revoke-a','revoke-b','verify','mark-source','unmark-source','cleanup']
 .map(name=>[name,`tests/db/m02-role-order-local-${name}.sql`]));
const hash=value=>createHash('sha256').update(value).digest('hex');
function assert(value,message) { if(!value) throw new Error(message); }
function safe(error) { return String(error instanceof Error?error.message:'Local role-order proof failed.').replace(/[A-Za-z0-9_-]{43,}/gu,'[LONG_VALUE_REDACTED]').slice(0,3500); }
function rows(stdout) { return stdout.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line)); }
function marker(values,phase) { const selected=values.filter(value=>value.phase===phase); assert(selected.length===1&&Number.isSafeInteger(selected[0].session_pid),'Unique SQL backend marker required.'); return selected[0]; }
function duration(values) { return Date.parse(marker(values,'returned').at)-Date.parse(marker(values,'started').at); }
function guardAssertions(sql) {
 const outer=sql.replace(/\$([A-Za-z_][A-Za-z0-9_]*|)\$[\s\S]*?\$\1\$/gu,()=> ' ')
  .replace(/--[^\r\n]*/gu,' ').replace(/\/\*[\s\S]*?\*\//gu,' ').replace(/'(?:''|[^'])*'/gu,' ').replace(/"(?:""|[^"])*"/gu,' ');
 assert(!outer.includes('\\'),'No psql commands in sealed assertions.');
 for(const statement of outer.split(';')) assert(!/^\s*(?:begin\b|start\s+transaction\b|commit\b|end\b|rollback\b|abort\b|savepoint\b|release\b|prepare\s+transaction\b|set\s+transaction\b)/iu.test(statement),'The driver owns the assertion transaction.');
}
const SNAPSHOT=`begin read only;
do $snapshot$ declare item record; amount bigint; counts jsonb:='{}'; value jsonb; begin
 for item in select ns.nspname,relation.relname from pg_class relation join pg_namespace ns on ns.oid=relation.relnamespace
  where ns.nspname in('public','eps','auth','storage','eps_local_guard','supabase_migrations') and relation.relkind in('r','p') order by ns.nspname,relation.relname loop
  execute format('select count(*) from %I.%I',item.nspname,item.relname) into amount;
  counts:=counts||jsonb_build_object(item.nspname||'.'||item.relname,amount);
 end loop;
 value:=jsonb_build_object('query_role',current_user,'database',current_database(),'unrestricted',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
  'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),'all_business_counts',counts,
  'fixture_present',to_regclass('eps_local_guard.role_order_fixture') is not null,
  'owner_sort_update',has_column_privilege('eps_specs_owner','eps.roles','sort_order','UPDATE'),
  'source_identity_protected',not has_column_privilege('eps_specs_owner','eps.roles','source_role','UPDATE') and not has_column_privilege('eps_specs_owner','eps.roles','id','UPDATE')
   and not has_table_privilege('eps_specs_owner','eps.user_workspace_preferences','SELECT'),
  'functions',(select coalesce(jsonb_agg(jsonb_build_object('name',ns.nspname||'.'||routine.proname,'owner',pg_get_userbyid(routine.proowner),'definer',routine.prosecdef,'config',routine.proconfig,
   'source_sha256',encode(sha256(convert_to(routine.prosrc,'UTF8')),'hex'),'public',exists(select 1 from aclexplode(coalesce(routine.proacl,acldefault('f',routine.proowner))) acl where acl.grantee=0 and acl.privilege_type='EXECUTE'),
   'authenticated',has_function_privilege('authenticated',routine.oid,'EXECUTE'),'anon',has_function_privilege('anon',routine.oid,'EXECUTE'),'service',has_function_privilege('service_role',routine.oid,'EXECUTE')) order by ns.nspname,routine.proname),'[]'::jsonb)
   from pg_proc routine join pg_namespace ns on ns.oid=routine.pronamespace where ns.nspname='eps' and routine.proname='specs_order_workspace_dto' or ns.nspname='public' and routine.proname='eps_reorder_workspace'),
  'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',policy.polname,'command',policy.polcmd,'permissive',policy.polpermissive,'using',pg_get_expr(policy.polqual,policy.polrelid),'check',pg_get_expr(policy.polwithcheck,policy.polrelid)) order by policy.polname),'[]'::jsonb)
   from pg_policy policy where policy.polname in('specs_order_replay_read','specs_order_replay_insert','specs_order_audit')));
 perform set_config('eps.order.snapshot',value::text,true);
end $snapshot$;
select current_setting('eps.order.snapshot')::jsonb;
rollback;`;

async function main() {
 assert(process.argv.length===2&&/^v24\./u.test(process.version),'Pinned Node24 and no arguments required.');
 const runId=randomUUID(); let ownsLock=false; let setup=false; let sourceMarked=false; let manifest; let manifestHash;
 const summary={schema_version:'1.0',run_id:runId,started_at:new Date().toISOString(),harness_sha256:hash(await readFile(import.meta.filename)),result:'failed',stages:[],concurrency:[],
  cloud_called:false,provider_called:false,source_submission_tested:false,assignments_integrated:false,dispatcher_daemon_tested:false,
  scope:'Persisted role-only ordering, current-user SQL/RLS, separate backend waits and strict source-preserving fixture cleanup; no cloud/provider/assignment or daemon acceptance.'};
 async function unchanged() { assert(hash(await readFile(MANIFEST))===manifestHash,'Reviewed manifest changed during proof.'); }
 async function sealed(file) {
  await unchanged(); const entry=[...manifest.migrations,...manifest.tests].find(value=>value.path===file);
  assert(entry&&/^[a-f0-9]{64}$/u.test(entry.sha256)&&entry.reviewed_by&&Number.isFinite(Date.parse(entry.reviewed_at)),`Missing review entry: ${file}`);
  const bytes=await readFile(path.join(ROOT,file)); assert(hash(bytes)===entry.sha256&&!/^\s*\\/mu.test(bytes.toString('utf8')),`Reviewed bytes changed: ${file}`);
  return {entry,sql:bytes.toString('utf8')};
 }
 async function snapshot() { const result=rows((await runOwnedLocalSql(SNAPSHOT)).stdout); assert(result.length===1&&result[0].query_role==='postgres'&&result[0].unrestricted===true&&result[0].database==='postgres','Owned unrestricted local snapshot required.'); return result[0]; }
 async function stage(name,file,{expectedError}={}) {
  const {entry,sql}=await sealed(file); const start=performance.now(); const record={name,path:file,sha256:entry.sha256,result:'failed',started_at:new Date().toISOString()}; summary.stages.push(record);
  try { const result=await runOwnedLocalSql(sql); assert(!expectedError,'Cleanup accepted a nonempty source.'); const values=rows(result.stdout); record.markers=values.filter(value=>['started','returned','holding'].includes(value.phase)); record.result='passed'; return values; }
  catch(error) { if(expectedError&&error instanceof Error&&new RegExp('^ERROR:\\s+'+expectedError+'\\s*$','mu').test(error.message)) { record.result='expected_rejection';record.code=expectedError;return []; } record.error=safe(error);throw error; }
  finally {record.duration_ms=Math.round(performance.now()-start);record.finished_at=new Date().toISOString();}
 }
 async function holding(application) {
  assert(['eps_order_edit_a','eps_order_create_a','eps_order_revoke_a','eps_order_source_a'].includes(application),'Unknown fixed barrier.');
  const deadline=Date.now()+10000;
  while(Date.now()<deadline) { const row=rows((await runOwnedLocalSql(`begin read only;select jsonb_build_object('pid',(select pid from pg_stat_activity where application_name='${application}' and state='active' and wait_event='PgSleep'));rollback;`)).stdout)[0];
   if(Number.isSafeInteger(row?.pid)) return row.pid; await new Promise(done=>setTimeout(done,50)); }
  throw new Error('Fixed holding backend was not observed.');
 }
 async function blocked(application,holder) {
  assert(['eps_order_edit_b','eps_order_create_b','eps_order_revoke_b','eps_order_cleanup_b'].includes(application)&&Number.isSafeInteger(holder),'Unknown fixed waiter.');
  const deadline=Date.now()+8000;
  while(Date.now()<deadline) { const row=rows((await runOwnedLocalSql(`begin read only;select jsonb_build_object('pid',(select pid from pg_stat_activity where application_name='${application}' and ${holder}=any(pg_blocking_pids(pid))));rollback;`)).stdout)[0];
   if(Number.isSafeInteger(row?.pid)&&row.pid!==holder) return row.pid; await new Promise(done=>setTimeout(done,50)); }
  throw new Error('Exact waiter/holder blocking was not sampled.');
 }
 async function pair(name,fileA,fileB,application,flag) {
  const pending=[stage(`${name}-a`,fileA)];pending[0].catch(()=>undefined);
  try {const holder=await holding(`${application}_a`);pending.push(stage(`${name}-b`,fileB));const waiter=await blocked(`${application}_b`,holder);
   const values=await Promise.all(pending); const first=values[0].find(value=>['started','holding'].includes(value.phase));
   assert(first?.session_pid===holder&&marker(values[1],'started').session_pid===waiter&&marker(values[1],'returned')[flag]===true&&duration(values[1])>900,'Pair did not prove its exact backend wait/outcome.');
   summary.concurrency.push({name,holder_pid:holder,waiter_pid:waiter,actual_blocker_sampled:true,distinct_backends:true,waiter_rpc_ms:duration(values[1]),[flag]:true});return values;
  } finally {await Promise.allSettled(pending);}
 }
 try {
  const target=await verifyLocalTarget();summary.environment={container:target.config.container,system_identifier:target.observed.system_identifier,host_ip:'127.0.0.1',host_port:'55433'};
  await mkdir(path.dirname(LOCK),{recursive:true});const lock=await open(LOCK,'wx',0o600);
  try {await lock.writeFile(JSON.stringify({run_id:runId,pid:process.pid}));await lock.sync();ownsLock=true;}finally{await lock.close();}
  const bytes=await readFile(MANIFEST);manifest=JSON.parse(bytes.toString('utf8'));manifestHash=hash(bytes);
  assert(manifest.version===1&&Array.isArray(manifest.migrations)&&Array.isArray(manifest.tests),'Reviewed manifest required.');
  const migrations=(await readdir(path.join(ROOT,'supabase/migrations'))).filter(file=>file.endsWith('.sql')).sort().map(file=>`supabase/migrations/${file}`);
  assert(migrations.length===9&&migrations.at(-1)===MIGRATION&&manifest.migrations.length===9,'Exact nine-file reviewed history required.');
  assert(new Set([...manifest.migrations,...manifest.tests].map(entry=>entry.path)).size===manifest.migrations.length+manifest.tests.length,'Duplicate review entries.');
  for(const file of [...migrations,ASSERTIONS,...Object.values(FILES)]) await sealed(file);
  assert((await sealed(ASSERTIONS)).entry.sha256===ASSERTIONS_HASH,'Historical rollback assertions changed.');
  summary.reviewed_manifest_sha256=manifestHash;summary.expected_versions=migrations.map(file=>path.basename(file).slice(0,14));
  summary.pre_migration=await snapshot();
  assert(JSON.stringify(summary.pre_migration.versions)===JSON.stringify(summary.expected_versions.slice(0,8))||JSON.stringify(summary.pre_migration.versions)===JSON.stringify(summary.expected_versions),'Require exact before8/after9 history.');
  assert(!summary.pre_migration.fixture_present,'No fixture adoption.');
  if(summary.pre_migration.versions.length===8) assert(!summary.pre_migration.owner_sort_update&&summary.pre_migration.functions.length===0&&summary.pre_migration.policies.length===0,'Require unchanged eight-version role-order boundary.');
  for(const file of migrations) {await unchanged();const result=await runReviewedSqlFile(file);assert(['applied','already_applied'].includes(result.result),'Migration not confirmed.');
   if(file===MIGRATION) summary.migration9_result=result.result;summary.stages.push({name:'migration-replay',path:file,sha256:result.sha256,result:result.result,receipt:result.receipt});}
  summary.before=await snapshot();
  assert(JSON.stringify(summary.before.versions)===JSON.stringify(summary.expected_versions)&&summary.before.owner_sort_update&&summary.before.source_identity_protected&&summary.before.functions.length===2&&summary.before.policies.length===3,'Persisted role-order catalog boundary missing.');
  assert(summary.before.functions.every(fn=>fn.definer&&!fn.public&&!fn.anon&&!fn.service&&fn.config?.length===1&&fn.config[0]==='search_path=""'&&fn.owner===(fn.name.startsWith('public.')?'eps_specs_owner':'eps_api_owner')&&fn.authenticated===fn.name.startsWith('public.')),'Function ownership/execute boundary differs.');
  const expected={...summary.pre_migration.all_business_counts};if(summary.pre_migration.versions.length===8){expected['supabase_migrations.schema_migrations']++;expected['eps_local_guard.migration_replay']++;}
  assert(JSON.stringify(Object.entries(expected).sort())===JSON.stringify(Object.entries(summary.before.all_business_counts).sort()),'Migration changed business row counts.');summary.application_preserved_business_counts=true;
  const assertions=await sealed(ASSERTIONS);guardAssertions(assertions.sql);const sql=`begin;set local eps.role_order_candidate_rehearsal='rollback-only-v1';\n${assertions.sql}\nrollback;`;
  await runOwnedLocalSql(sql);summary.stages.push({name:'persisted-role-order-contract-assertions',path:ASSERTIONS,sha256:ASSERTIONS_HASH,result:'passed',composed_sql_sha256:hash(sql)});
  await stage('committed-fixture-setup',FILES.setup);setup=true;
  await pair('reorder-versus-editor',FILES['reorder-a'],FILES['editor-b'],'eps_order_edit','edited');
  await pair('create-versus-stale-reorder',FILES['create-a'],FILES['stale-b'],'eps_order_create','stale_rejected');
  await stage('legitimate-cached-replay-control',FILES['replay-control']);
  await pair('revoked-cached-reorder',FILES['revoke-a'],FILES['revoke-b'],'eps_order_revoke','revoked_replay_denied');
  await stage('committed-effects-source-identity-verification',FILES.verify);
  const pending=[stage('known-source-writer',FILES['mark-source']).then(value=>{sourceMarked=true;return value;})];pending[0].catch(()=>undefined);
  try {const holder=await holding('eps_order_source_a');pending.push(stage('nonempty-source-cleanup-denied',FILES.cleanup,{expectedError:'ROLE_ORDER_LOCAL_SOURCE_PRESERVATION_REQUIRED'}));const waiter=await blocked('eps_order_cleanup_b',holder);await Promise.all(pending);
   summary.concurrency.push({name:'cleanup-preserves-source-after-wait',holder_pid:holder,waiter_pid:waiter,actual_blocker_sampled:true,distinct_backends:true,cleanup_denied:true});
  }finally{await Promise.allSettled(pending);}
  await stage('restore-only-known-source-sentinel',FILES['unmark-source']);sourceMarked=false;summary.result='passed';
 }catch(error){summary.error=safe(error);}
 finally {
  if(sourceMarked){try{await stage('recover-only-known-source-sentinel',FILES['unmark-source']);sourceMarked=false;}catch(error){summary.result='failed';summary.source_recovery_error=safe(error);}}
  if(setup){try{await stage('strict-scoped-cleanup',FILES.cleanup);summary.cleanup='passed';summary.after=await snapshot();assert(JSON.stringify(summary.before)===JSON.stringify(summary.after),'Catalog/history/all business counts were not restored.');summary.all_business_counts_restored=true;}catch(error){summary.result='failed';summary.cleanup='failed; unknown data preserved';summary.cleanup_error=safe(error);}}
  if(ownsLock){try{const owner=JSON.parse(await readFile(LOCK,'utf8'));assert(owner.run_id===runId&&owner.pid===process.pid,'Test lock owner changed.');await unlink(LOCK);}catch(error){summary.result='failed';summary.lock_error=safe(error);}}
  summary.finished_at=new Date().toISOString();const directory=path.join(ROOT,'tracking/evidence/m02/role-order-local');await mkdir(directory,{recursive:true});const file=path.join(directory,`${summary.finished_at.replace(/[:.]/gu,'-')}-${runId.slice(0,8)}.json`);await writeFile(file,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
  process.stdout.write(`M02 role-order local proof: ${summary.result}\nReceipt: ${path.relative(ROOT,file).replaceAll('\\','/')}\n`);if(summary.result!=='passed'){process.stderr.write((summary.error??summary.cleanup_error??'Role-order proof failed.')+'\n');process.exitCode=1;}
 }
}
main().catch(error=>{process.stderr.write(safe(error)+'\n');process.exitCode=1;});
