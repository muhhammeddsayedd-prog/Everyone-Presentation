/** Exact independently reviewed specs candidate; one owned-local rollback only. */
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { mkdir, open, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';
import { runOwnedLocalSql, verifyLocalTarget } from './local-postgres.mjs';

const ROOT = realpathSync(path.resolve(import.meta.dirname, '..'));
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const CANDIDATE = 'development/m02/specs-draft-candidate.sql';
const ASSERTIONS = 'tests/db/m02-specs-draft-candidate.sql';
const HASHES = {
  candidate: '9e92f8bf1be2493fba93a09f04be5b74435202784bcda7fff9b48499652fc901',
  assertions: '3b3c4e259934639e03e0536aaabd34c2a0a91ccca5535b630dc2410546323d67',
};
const VERSIONS = ['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800'];
const sha256 = value => createHash('sha256').update(value).digest('hex');
function assert(condition, message) { if (!condition) throw new Error(message); }
function diagnostic(error) { return String(error instanceof Error ? error.message : 'Local specs rehearsal failed.').replace(/[A-Za-z0-9_-]{43,}/gu, '[LONG_VALUE_REDACTED]').slice(0, 4000); }

/** Fixed-source outer-statement accident guard, not a general-purpose SQL parser. */
function guardSource(sql) {
  const outer = sql.replace(/\$([A-Za-z_][A-Za-z0-9_]*|)\$[\s\S]*?\$\1\$/gu, () => ' ')
    .replace(/--[^\r\n]*/gu, ' ').replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/'(?:''|[^'])*'/gu, ' ').replace(/"(?:""|[^"])*"/gu, ' ');
  assert(!outer.includes('\\'), 'Reviewed SQL may not contain psql metacommands.');
  for (const statement of outer.split(';')) {
    assert(!/^\s*(?:begin\b|start\s+transaction\b|commit\b|end\b|rollback\b|abort\b|savepoint\b|release\b|prepare\s+transaction\b|set\s+transaction\b)/iu.test(statement),
      'Candidate/assertions must not control transactions; the harness owns BEGIN/ROLLBACK.');
  }
}
async function sealedSource(file, expected) {
  const absolute = await realpath(path.join(ROOT, file));
  assert(absolute === path.resolve(ROOT, file), 'Reviewed SQL may not resolve through a symbolic link.');
  const bytes = await readFile(absolute);
  assert(sha256(bytes) === expected, 'Candidate/assertion bytes changed after independent review.');
  const sql = bytes.toString('utf8'); guardSource(sql); return sql;
}
const INSPECTION = `begin read only;
do $snapshot$ declare item record; amount bigint; counts jsonb:='{}'; snapshot jsonb; begin
  for item in select namespace.nspname,relation.relname from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname in('public','eps','auth','storage','eps_local_guard','supabase_migrations') and relation.relkind in('r','p') order by namespace.nspname,relation.relname loop
    execute format('select count(*) from %I.%I',item.nspname,item.relname) into amount;
    counts:=counts||jsonb_build_object(item.nspname||'.'||item.relname,amount);
  end loop;
  select jsonb_build_object('query_role',current_user,'database',current_database(),
    'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
    'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),'all_business_counts',counts,
    'candidate_relations',(select count(*) from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace where namespace.nspname='eps' and relation.relname in('specs','roles','slots','assignments')),
    'candidate_roles',(select count(*) from pg_roles where rolname in('eps_specs_owner','eps_specs_initializer')),
    'candidate_routines',(select count(*) from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace where ns.nspname='eps' and proc.proname like 'specs\\_%' escape '\\'
      or ns.nspname='public' and proc.proname in('eps_get_specs','eps_update_specs','eps_list_roles','eps_create_role','eps_update_role','eps_list_slots','eps_resize_role_slots','eps_archive_role','eps_update_slot')),
    'catalog',jsonb_build_object(
      'relations',(select jsonb_agg(jsonb_build_array(relation.oid,namespace.nspname,relation.relname,relation.relkind,relation.relowner,relation.relrowsecurity,relation.relforcerowsecurity,relation.relacl) order by relation.oid)
        from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace where namespace.nspname in('public','eps','auth','storage','eps_local_guard','supabase_migrations')),
      'columns',(select jsonb_agg(jsonb_build_array(attribute.attrelid,attribute.attnum,attribute.attname,attribute.atttypid,attribute.attnotnull,attribute.attisdropped,attribute.attacl,pg_get_expr(default_value.adbin,default_value.adrelid)) order by attribute.attrelid,attribute.attnum)
        from pg_attribute attribute join pg_class relation on relation.oid=attribute.attrelid join pg_namespace namespace on namespace.oid=relation.relnamespace
        left join pg_attrdef default_value on default_value.adrelid=attribute.attrelid and default_value.adnum=attribute.attnum
        where attribute.attnum>0 and namespace.nspname in('public','eps','auth','storage','eps_local_guard','supabase_migrations')),
      'functions',(select jsonb_agg(jsonb_build_array(proc.oid,namespace.nspname,proc.proname,pg_get_function_identity_arguments(proc.oid),pg_get_function_result(proc.oid),proc.proowner,proc.prosecdef,proc.provolatile,proc.proconfig,proc.proacl,encode(sha256(convert_to(proc.prosrc,'UTF8')),'hex')) order by proc.oid)
        from pg_proc proc join pg_namespace namespace on namespace.oid=proc.pronamespace where namespace.nspname in('public','eps','auth','storage')),
      'policies',(select jsonb_agg(jsonb_build_array(policy.oid,policy.polrelid,policy.polname,policy.polroles,policy.polcmd,policy.polpermissive,pg_get_expr(policy.polqual,policy.polrelid),pg_get_expr(policy.polwithcheck,policy.polrelid)) order by policy.oid)
        from pg_policy policy join pg_class relation on relation.oid=policy.polrelid join pg_namespace namespace on namespace.oid=relation.relnamespace where namespace.nspname in('public','eps','auth','storage')),
      'triggers',(select jsonb_agg(jsonb_build_array(trigger.oid,trigger.tgrelid,trigger.tgname,trigger.tgenabled,pg_get_triggerdef(trigger.oid)) order by trigger.oid)
        from pg_trigger trigger join pg_class relation on relation.oid=trigger.tgrelid join pg_namespace namespace on namespace.oid=relation.relnamespace where not trigger.tgisinternal and namespace.nspname in('public','eps','auth','storage')),
      'constraints',(select jsonb_agg(jsonb_build_array(constraint_row.oid,constraint_row.conrelid,constraint_row.conname,pg_get_constraintdef(constraint_row.oid)) order by constraint_row.oid)
        from pg_constraint constraint_row join pg_namespace namespace on namespace.oid=constraint_row.connamespace where namespace.nspname in('public','eps','auth','storage','eps_local_guard','supabase_migrations')),
      'roles',(select jsonb_agg(jsonb_build_array(oid,rolname,rolcanlogin,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolbypassrls) order by oid) from pg_roles),
      'memberships',(select jsonb_agg(jsonb_build_array(roleid,member,grantor,admin_option,inherit_option,set_option) order by roleid,member,grantor) from pg_auth_members)
    )) into snapshot;
  perform set_config('eps.specs_probe.snapshot',snapshot::text,true);
end $snapshot$;
select current_setting('eps.specs_probe.snapshot')::jsonb as state;
rollback;`;
const PRELUDE = `do $prelude$ begin
 if exists(select 1 from public.projects where id='7b710000-0000-4000-8000-000000000001')
   or exists(select 1 from eps.workspaces where id='7c710000-0000-4000-8000-000000000001')
 then raise exception 'SPECS_BACKFILL_FIXTURE_COLLISION_PRESERVE_DATA'; end if;
end $prelude$;
insert into public.projects(id,name) values('7b710000-0000-4000-8000-000000000001','Synthetic specs backfill fixture');
insert into eps.workspaces(id,project_id,row_version,draft_revision,has_unpublished_changes)
 values('7c710000-0000-4000-8000-000000000001','7b710000-0000-4000-8000-000000000001',19,17,true);`;
async function inspect() {
  const result = await runOwnedLocalSql(INSPECTION);
  const values = result.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert(values.length === 1 && values[0].query_role === 'postgres' && values[0].database === 'postgres' && values[0].unrestricted_visibility === true, 'Unrestricted owned-local catalog/count inspection is required.');
  return values[0];
}
async function main() {
  assert(process.argv.length === 2 && /^v24\./u.test(process.version), 'Use pinned Node24 without target/file/mode arguments.');
  const runId = randomUUID(); let ownsLock = false; let before; let after;
  const receipt = { schema_version: '1.0', run_id: runId, started_at: new Date().toISOString(), result: 'failed',
    candidate: CANDIDATE, assertions: ASSERTIONS, hashes: HASHES, harness_sha256: sha256(await readFile(new URL(import.meta.url))),
    cloud_called: false, provider_called: false, assignments_integrated: false, concurrent_sessions_tested: false,
    persisted_specs_tested: false, source_submission_tested: false, job_callbacks_tested: false, promotion_performed: false,
    scope: 'Fixed synthetic manual specs/role/slot SQL assertions in one owned-local transaction, including pre-candidate backfill; always rollback.' };
  try {
    const target = await verifyLocalTarget();
    receipt.environment = { container: target.config.container, system_identifier: target.observed.system_identifier, host_ip: '127.0.0.1', host_port: '55433', image_digest: target.config.image_digest };
    await mkdir(path.dirname(LOCK), { recursive: true }); const handle = await open(LOCK, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify({ run_id: runId, pid: process.pid })); await handle.sync(); ownsLock = true; } finally { await handle.close(); }
    const candidate = await sealedSource(CANDIDATE, HASHES.candidate); const assertions = await sealedSource(ASSERTIONS, HASHES.assertions);
    before = await inspect();
    assert(JSON.stringify(before.versions) === JSON.stringify(VERSIONS) && before.candidate_relations === 0 && before.candidate_roles === 0 && before.candidate_routines === 0,
      'Require exact seven-version local baseline with no candidate objects to adopt.');
    receipt.before = before;
    const sql = `begin; set local eps.specs_candidate_rehearsal='rollback-only-v1';\n${PRELUDE}\n${candidate}\n${assertions}\nrollback;\n`;
    assert(Buffer.byteLength(sql,'utf8')<=256*1024, 'The reviewed composed SQL exceeds its local bound.');
    receipt.composed_sql_sha256 = sha256(sql);
    receipt.execution_attempted = true;
    await runOwnedLocalSql(sql);
    receipt.transaction_completed_to_rollback = true;
  } catch (error) { receipt.error = diagnostic(error); }
  finally {
    if (before) {
      try {
        after = await inspect(); receipt.after = after;
        receipt.catalog_and_all_counts_restored = JSON.stringify(before) === JSON.stringify(after);
        receipt.rollback_verified = receipt.catalog_and_all_counts_restored;
        if (receipt.transaction_completed_to_rollback && receipt.rollback_verified) receipt.result = 'passed';
      } catch (error) { receipt.verification_error = diagnostic(error); receipt.rollback_verified = false; }
    }
    if (ownsLock) { try { const owner = JSON.parse(await readFile(LOCK,'utf8')); assert(owner.run_id === runId && owner.pid === process.pid, 'Shared DB test lock owner changed; refusing removal.'); await unlink(LOCK); }
      catch (error) { receipt.result = 'failed'; receipt.lock_error = diagnostic(error); } }
    receipt.finished_at = new Date().toISOString();
    const directory = path.join(ROOT,'tracking/evidence/m02/specs-candidate'); await mkdir(directory,{ recursive:true });
    const file = path.join(directory,`${receipt.finished_at.replace(/[:.]/gu,'-')}-${runId.slice(0,8)}-rollback.json`);
    await writeFile(file,JSON.stringify(receipt,null,2)+'\n',{ flag:'wx' });
    process.stdout.write(`M02 specs candidate: ${receipt.result}\nReceipt: ${path.relative(ROOT,file).replaceAll('\\','/')}\n`);
    if (receipt.result !== 'passed') { process.stderr.write(`${receipt.error ?? receipt.verification_error ?? receipt.lock_error ?? 'Catalog/count rollback was not verified.'}\n`); process.exitCode=1; }
  }
}
main().catch(error=>{ process.stderr.write(diagnostic(error)+'\n'); process.exitCode=1; });
