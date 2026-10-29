/** Actual two-session M04 race on a disposable, unexposed owned PG17 container.
 * Canonical local21 is read only. No login/password hashes or hosted config read.
 * Parent authorized this isolated proof; this is never a migration promoter. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { isDeepStrictEqual } from 'node:util';
import { runOwnedLocalSql, verifyLocalTarget } from './local-postgres.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const FILES = ['development/m04/review-series.sql','development/m04/retirement-undo.sql','development/m04/review-processing.sql','tools/sql/m04-review-local-snapshot.sql','development/local-db/reviewed.json','development/local-db/instance.json','tools/m04-review-private-fixture-file.py','tools/provision_logo_verifier.py','tests/db/m04-assignments-fixture.sql','tools/test-m04-review-race-local.mjs','supabase/migrations/20261028222030_m02_specs_pipeline.sql','tools/sql/m04-review-catalog.sql'];
const QUERY = FILES[3]; const IMAGE = 'public.ecr.aws/supabase/postgres@sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb';
const EVENT_METADATA = `begin read only;select jsonb_build_object('events',coalesce(jsonb_agg(jsonb_build_object('name',t.evtname,'owner',pg_get_userbyid(t.evtowner),'event',t.evtevent,'enabled',t.evtenabled,'tags',t.evttags,'function_schema',n.nspname,'function_name',p.proname,'function_owner',pg_get_userbyid(p.proowner),'function_definer',p.prosecdef,'function_config',p.proconfig,'function_arguments',p.pronargs,'function_source_sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'))order by t.evtname),'[]'::jsonb))from pg_event_trigger t join pg_proc p on p.oid=t.evtfoid join pg_namespace n on n.oid=p.pronamespace;rollback;`;
const EXTENSIONS = ['pg_stat_statements', 'pgcrypto', 'uuid-ossp'];
const EXTENSION_METADATA = `begin read only;select jsonb_build_object('extensions',coalesce(jsonb_agg(jsonb_build_object('name',e.extname,'owner',pg_get_userbyid(e.extowner),'version',e.extversion,'schema',n.nspname,'relocatable',e.extrelocatable,'configuration_relations',e.extconfig,'configuration_conditions',e.extcondition)order by e.extname),'[]'::jsonb))from pg_extension e join pg_namespace n on n.oid=e.extnamespace where n.nspname='extensions';rollback;`;
const PUBLIC_SCHEMA_METADATA = `begin read only;select jsonb_build_object('owner',pg_get_userbyid(n.nspowner),'acl',coalesce((select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then'PUBLIC'else pg_get_userbyid(a.grantee)end,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)order by case when a.grantee=0 then'PUBLIC'else pg_get_userbyid(a.grantee)end,pg_get_userbyid(a.grantor),a.privilege_type)from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner)))a),'[]'::jsonb))from pg_namespace n where n.nspname='public';rollback;`;
const sha = value => createHash('sha256').update(value).digest('hex');
const jsonRows = value => value.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
const run = randomUUID(); const name = `eps-m04-review-race-${run.slice(0, 8)}`;
const labels = { 'com.everyone.presentation.owner': 'codex', 'com.everyone.presentation.purpose': 'disposable-m04-review-two-session-race', 'com.everyone.presentation.run': run, 'com.everyone.presentation.workspace': sha(ROOT.toLowerCase()).slice(0, 24) };
const lockFile = path.join(ROOT, '.local/local-postgres/test-db.lock');
const endpoint = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
const privateDirectory = path.join(ROOT, '.local/m04-review-race', run);
let canonical; let disposable; let instance; let approvedSeals; let sourceCheckCount = 0;
async function revalidateSources() {
  assert(approvedSeals, 'APPROVED_OPERATIONAL_SOURCES_REQUIRED');
  for (const [file, expected] of Object.entries(approvedSeals)) assert.equal(sha(await readFile(path.join(ROOT, file))), expected, 'REVIEWED_SOURCE_CHANGED_BEFORE_HANDOFF');
  sourceCheckCount++;
}
async function protectedArtifact(file, contents) {
  await revalidateSources();
  const writer = path.join(ROOT, 'tools/m04-review-private-fixture-file.py');
  const payload = JSON.stringify({ run_id: run, file, contents });
  const result = await new Promise((resolve, reject) => {
    const child = spawn(path.join(ROOT, '.venv-skills/Scripts/python.exe'), ['-X', 'utf8', writer], { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, PATH: '' } });
    let stdout = ''; let stderr = ''; const timer = setTimeout(() => { child.kill(); reject(new Error('M04_PRIVATE_FIXTURE_WRITER_TIMEOUT')); }, 10_000);
    child.stdout.on('data', value => { stdout += value.toString(); }); child.stderr.on('data', value => { stderr += value.toString(); });
    child.once('error', () => { clearTimeout(timer); reject(new Error('M04_PRIVATE_FIXTURE_WRITER_UNCONFIRMED')); });
    child.once('close', code => { clearTimeout(timer); if (code !== 0 || stderr || stdout.length > 1024) reject(new Error('M04_PRIVATE_FIXTURE_WRITER_UNCONFIRMED')); else resolve(JSON.parse(stdout)); });
    child.stdin.on('error', () => undefined); child.stdin.end(payload);
  });
  assert.equal(result.protected, true); assert.equal(result.bytes, Buffer.byteLength(contents));
}
async function docker(args, input = '', { timeout = 60_000, maximum = 64 * 1024 * 1024, allowFailure = false } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn('docker', ['--host', endpoint, ...args], { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let stopped = false;
    const timer = setTimeout(() => { stopped = true; child.kill(); }, timeout);
    child.stdout.on('data', value => { stdout += value.toString(); if (Buffer.byteLength(stdout) > maximum) { stopped = true; child.kill(); } });
    child.stderr.on('data', value => { stderr += value.toString(); if (Buffer.byteLength(stderr) > 1024 * 1024) { stopped = true; child.kill(); } });
    child.once('error', () => { clearTimeout(timer); reject(new Error('M04_RACE_LOCAL_TRANSPORT_UNCONFIRMED')); });
    child.once('close', code => { clearTimeout(timer); if (stopped || code !== 0 && !allowFailure) reject(Object.assign(new Error('M04_RACE_LOCAL_COMMAND_UNCONFIRMED'), { privateDiagnostic: { code, stopped, stdout, stderr } })); else resolve({ code, stdout, stderr }); });
    child.stdin.on('error', () => undefined); child.stdin.end(input);
  });
}
async function inspectDisposable() {
  const values = JSON.parse((await docker(['inspect', name])).stdout); assert.equal(values.length, 1); const value = values[0];
  if (disposable) assert.equal(value.Id, disposable); else disposable = value.Id;
  for (const [key, expected] of Object.entries(labels)) assert.equal(value.Config.Labels[key], expected);
  assert.equal(value.Config.Image, IMAGE); assert.equal(value.HostConfig.NetworkMode, 'none');
  assert.deepEqual(value.HostConfig.PortBindings, {}); assert.equal(Object.keys(value.NetworkSettings.Ports ?? {}).filter(key => value.NetworkSettings.Ports[key]).length, 0);
  assert.equal(value.HostConfig.Memory, 1024 * 1024 * 1024); assert.equal(value.HostConfig.PidsLimit, 256);
  assert.equal(value.HostConfig.NanoCpus, 2_000_000_000); assert.equal(value.HostConfig.Privileged, false);
  assert.equal(value.HostConfig.Tmpfs['/var/lib/postgresql/data'], 'rw,size=512m'); assert(!value.Mounts.some(mount => mount.Type === 'bind'));
  return value;
}
async function sql(text, { role = 'supabase_admin', application, allowFailure = false } = {}) {
  await inspectDisposable();
  assert(['postgres', 'supabase_admin'].includes(role));
  const prefix = instance ? `do $guard$begin if current_database()<>'postgres'or inet_client_addr()is not null or(select system_identifier::text from pg_control_system())<>'${instance}'then raise exception'OWNED_DISPOSABLE_RACE_INSTANCE_REQUIRED';end if;end$guard$;` : '';
  return docker(['exec', '--user', 'postgres', '-i', disposable, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '/var/run/postgresql', '-U', role, '-d', 'postgres'], `${application ? `set application_name='${application}';` : ''}${prefix}${text}`, { allowFailure });
}
async function canonicalSnapshot(query) {
  const actual = await verifyLocalTarget(); assert.equal(actual.observed.system_identifier, '7701520506262638626'); assert.equal(actual.config.container, 'eps-presentation-canonical-pg17-local');
  if (canonical) assert.equal(actual.container.Id, canonical); else canonical = actual.container.Id;
  return jsonRows((await runOwnedLocalSql(query)).stdout)[0];
}
async function canonicalAuthMetadata() {
  const actual = await verifyLocalTarget(); assert.equal(actual.container.Id, canonical);
  const result = await docker(['exec', '--user', 'postgres', '-i', canonical, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '/var/run/postgresql', '-U', 'supabase_admin', '-d', 'postgres'], `begin read only;
do $guard$declare r record;n bigint;h text;value jsonb:='[]';begin
 if current_database()<>'postgres'or current_user<>'supabase_admin'or inet_client_addr()is not null or(select system_identifier::text from pg_control_system())<>'7701520506262638626'then raise exception'EXACT_CANONICAL_AUTH_METADATA_READ_REQUIRED';end if;
 for r in select c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl,pg_get_userbyid(c.relowner)owner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth'and c.relkind in('r','p','m')order by c.relname loop
  -- Hash only nonsecret physical row revisions, never Auth row values, IDs,
  -- token digests, password hashes, provider fields or session contents.
  execute format('select count(*),encode(sha256(convert_to(coalesce(string_agg(ctid::text||'':''||xmin::text,E''\\n''order by ctid),''''),''UTF8'')),''hex'')from auth.%I',r.relname)into n,h;
  value:=value||jsonb_build_array(jsonb_build_object('table',r.relname,'owner',r.owner,'rls',r.relrowsecurity,'forced_rls',r.relforcerowsecurity,'acl',r.relacl::text,'rows',n,'physical_row_revision_sha256',h));
 end loop;perform set_config('eps.m04.auth_metadata',value::text,true);
end$guard$;select jsonb_build_object('auth_relations',current_setting('eps.m04.auth_metadata')::jsonb);rollback;`);
  const values = jsonRows(result.stdout); assert.equal(values.length, 1); return values[0];
}
const identity = actor => `select set_config('request.jwt.claim.sub','${actor}',false);select set_config('request.jwt.claims','{"sub":"${actor}","role":"authenticated"}',false);set role authenticated;`;
async function awaitBlocked(application) {
  for (let count = 0; count < 30; count++) {
    const value = jsonRows((await sql(`begin read only;select jsonb_build_object('waiting',count(*)filter(where wait_event_type='Lock'))from pg_stat_activity where application_name='${application}';rollback;`)).stdout)[0];
    if (value.waiting === 1) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('M04_RACE_SECOND_SESSION_DID_NOT_BLOCK');
}
async function heldTransaction(statements, marker) {
  await inspectDisposable();
  const child = spawn('docker', ['--host', endpoint, 'exec', '--user', 'postgres', '-i', disposable, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '/var/run/postgresql', '-U', 'supabase_admin', '-d', 'postgres'], { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = ''; let ready; let fail;
  const signalled = new Promise((resolve, reject) => { ready = resolve; fail = reject; });
  const timer = setTimeout(() => { child.kill(); fail(new Error('M04_RACE_HELD_SESSION_TIMEOUT')); }, 15_000);
  const completion = new Promise((resolve, reject) => {
    child.stdout.on('data', value => { stdout += value.toString(); if (stdout.split(/\r?\n/u).includes(marker)) ready(); });
    child.stderr.on('data', value => { stderr += value.toString(); });
    child.once('error', () => { clearTimeout(timer); fail(new Error('M04_RACE_HELD_TRANSPORT_ERROR')); reject(new Error('M04_RACE_HELD_TRANSPORT_ERROR')); });
    child.once('close', code => { clearTimeout(timer); if (code !== 0) { fail(new Error('M04_RACE_HELD_SQL_ERROR')); reject(Object.assign(new Error('M04_RACE_HELD_SQL_ERROR'), { privateDiagnostic: { stdout, stderr, code } })); } else resolve({ stdout, stderr }); });
  });
  // Attach early so a timeout/error cannot become an unhandled rejection.
  completion.catch(() => undefined); child.stdin.on('error', () => undefined);
  child.stdin.write(`begin isolation level read committed;set local lock_timeout='10s';set local statement_timeout='12s';${statements};select '${marker}';\n`);
  await signalled;
  return { commit: async () => { child.stdin.end('commit;\n'); return completion; }, abort: async () => { child.stdin.end('rollback;\n'); return completion; } };
}
async function main() {
  assert.equal(process.argv.length, 2);
  const sources = new Map(await Promise.all(FILES.map(async file => [file, await readFile(path.join(ROOT, file), 'utf8')])));
  const seals = Object.fromEntries([...sources].map(([file, value]) => [file, sha(value)]));
  approvedSeals = seals;
  assert.equal(JSON.parse(sources.get(FILES[4])).migrations.length, 21); assert.equal(JSON.parse(sources.get(FILES[5])).image_digest, IMAGE);
  const report = { run_id: run, started_at: new Date().toISOString(), result: 'failed', cloud_called: false, provider_called: false, hosted_credential_files_read: false,
    scope: 'Actual two-session review worker post-lock clock, terminal recovery and current-authority races on a disposable network-none PG17 clone of reviewed catalog/application local21; all Auth row data and large objects excluded. No canonical promotion or login-secret dump.', source_seals: seals, harness_sha256: sha(await readFile(import.meta.filename)), native_image: IMAGE };
  let locked = false; let before; let authBefore; let held;
  try {
    await mkdir(privateDirectory, { recursive: true }); const lock = await open(lockFile, 'wx', 0o600); try { await lock.writeFile(JSON.stringify({ run_id: run, pid: process.pid })); locked = true; } finally { await lock.close(); }
    before = await canonicalSnapshot(sources.get(QUERY)); report.before = before; assert.equal(before.versions.length, 21);
    authBefore = await canonicalAuthMetadata(); report.managed_auth_before = authBefore;
    const nonsecretRows = { 'eps.audience_presets': 3, 'eps.specs_asset_config': 1, 'eps.specs_pipeline_config': 1, 'eps.candidate_asset_config': 1, 'eps.frame_extraction_config': 1, 'eps.candidate_support_config': 1, 'storage.buckets': 6 };
    for (const [table, count] of Object.entries(Object.fromEntries(Object.entries(before.business).map(([name,value])=>[name,value.rows])))) assert.equal(count, nonsecretRows[table] ?? 0, 'EMPTY_BUSINESS_SECRET_AND_GRANT_TABLES_REQUIRED');
    const preflight = await docker(['exec', '--user', 'postgres', '-i', canonical, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '/var/run/postgresql', '-U', 'supabase_admin', '-d', 'postgres'], `begin read only;
do $guard$begin if current_database()<>'postgres'or current_user<>'supabase_admin'or inet_client_addr()is not null or(select system_identifier::text from pg_control_system())<>'7701520506262638626'then raise exception'EXACT_CANONICAL_METADATA_READ_REQUIRED';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth'and c.relkind in('m','f'))then raise exception'UNSUPPORTED_AUTH_DERIVED_DATA_IN_SCHEMA_DUMP';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p','m','f')and(n.nspname='public'and c.relname not in('clients','projects','project_memberships','client_memberships','app_capability_grants','spatial_ref_sys')or n.nspname='extensions'))then raise exception'UNMANAGED_RELATION_IN_DUMP_SCHEMA';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and left(p.proname,4)<>'eps_'and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'))then raise exception'UNMANAGED_FUNCTION_IN_DUMP_SCHEMA';end if;
end$guard$;select jsonb_build_object('auth_schema_only',true,'unmanaged_public_relations_or_functions',false,'extension_secret_tables',false);rollback;`);
    assert.deepEqual(jsonRows(preflight.stdout)[0], { auth_schema_only: true, unmanaged_public_relations_or_functions: false, extension_secret_tables: false }); report.dump_preflight = jsonRows(preflight.stdout)[0];
    const roleQuery = `begin read only;select jsonb_build_object('roles',(select jsonb_agg(jsonb_build_object('name',rolname,'inherit',rolinherit,'login',rolcanlogin,'super',rolsuper,'bypass',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'replication',rolreplication)order by rolname)from pg_roles where left(rolname,4)='eps_'),
 'memberships',(select jsonb_agg(jsonb_build_object('role',parent.rolname,'member',child.rolname,'grantor',grantor.rolname,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)order by parent.rolname,child.rolname,grantor.rolname)from pg_auth_members m join pg_roles parent on parent.oid=m.roleid join pg_roles child on child.oid=m.member join pg_roles grantor on grantor.oid=m.grantor where left(parent.rolname,4)='eps_'or left(child.rolname,4)='eps_'or parent.rolname='authenticated'and child.rolname='postgres'));rollback;`;
    const roles = jsonRows((await runOwnedLocalSql(roleQuery)).stdout)[0];
    const managedEvents = jsonRows((await runOwnedLocalSql(EVENT_METADATA)).stdout)[0];
    const managedExtensions = jsonRows((await runOwnedLocalSql(EXTENSION_METADATA)).stdout)[0];
    const publicSchema = jsonRows((await runOwnedLocalSql(PUBLIC_SCHEMA_METADATA)).stdout)[0];
    const publicUsage = publicSchema.acl.filter(value => value.grantee === 'PUBLIC');
    assert.deepEqual(publicUsage, [{ grantee: 'PUBLIC', grantor: 'pg_database_owner', privilege: 'USAGE', grantable: false }]);
    const legacyPath = FILES[10]; const manifest = JSON.parse(sources.get(FILES[4]));
    assert.equal(manifest.migrations.find(value => value.path === legacyPath)?.sha256, seals[legacyPath], 'SEALED_ORIGINAL_M02_CONSTRAINT_DDL_REQUIRED');
    const constraintFields = ['document_preparation_version', 'model_version', 'prompt_version', 'result_schema_version'];
    const constraintRestore = constraintFields.map(field => {
      const definition = `check(${field} is null or length(${field}) between 1 and 200 and ${field}=btrim(${field}))`;
      assert(sources.get(legacyPath).includes(definition));
      return `alter table eps.specs_pipeline_config drop constraint specs_pipeline_config_${field}_check;alter table eps.specs_pipeline_config add constraint specs_pipeline_config_${field}_check ${definition};`;
    }).join('\n');
    assert.deepEqual(managedExtensions.extensions.map(value => value.name), EXTENSIONS);
    for (const value of managedExtensions.extensions) assert((value.configuration_relations === null || value.configuration_relations.length === 0) && (value.configuration_conditions === null || value.configuration_conditions.length === 0), 'EXTENSION_CONFIGURATION_DATA_MUST_NOT_ENTER_DUMP');
    for (const role of roles.roles) { assert(/^eps_[a-z0-9_]+$/u.test(role.name)); for (const key of ['login', 'super', 'bypass', 'createdb', 'createrole', 'replication']) assert.equal(role[key], false); }
    const grantSql = value => {
      for (const key of ['role', 'member', 'grantor']) assert(/^[a-z][a-z0-9_]+$/u.test(value[key]));
      return `grant ${value.role} to ${value.member} with admin ${value.admin},inherit ${value.inherit},set ${value.set} granted by ${value.grantor};`;
    };
    const authBootstrap = roles.memberships.filter(value => value.role === 'authenticated' && value.member === 'postgres');
    assert.deepEqual(authBootstrap, [{ role: 'authenticated', member: 'postgres', grantor: 'supabase_admin', admin: true, inherit: true, set: true }], 'EXACT_OBSERVED_LOCAL21_AUTH_MEMBERSHIP_REQUIRED');
    // Reproduce the observed grantor dependency and Supautils creator provenance:
    // Auth ADMIN first, NOLOGIN owners created as postgres, exact final grants.
    const roleSql = authBootstrap.map(grantSql).join('\n') + '\nset role postgres;\n'
      + roles.roles.map(role => `create role ${role.name} nologin ${role.inherit ? 'inherit' : 'noinherit'} nosuperuser nocreatedb nocreaterole noreplication nobypassrls;`).join('\n')
      + '\nreset role;\n' + roles.memberships.filter(value => !(value.role === 'authenticated' && value.member === 'postgres')).map(grantSql).join('\n');
    const dump = await docker(['exec', '--user', 'postgres', canonical, 'pg_dump', '-h', '/var/run/postgresql', '-U', 'supabase_admin', '-d', 'postgres', '--no-password', '--no-security-labels', '--clean', '--if-exists', '--strict-names', '--exclude-table-data=auth.*', '--no-large-objects', ...['eps', 'public', 'auth', 'storage', 'supabase_migrations', 'extensions'].flatMap(schema => ['--schema', schema]), ...EXTENSIONS.flatMap(extension => ['--extension', extension])]);
    assert(Buffer.byteLength(dump.stdout) < 16 * 1024 * 1024); assert(!/ALTER ROLE[^;]*PASSWORD/iu.test(roleSql));
    assert(!/^\s*(?:COPY|INSERT INTO)\s+(?:auth|"auth")\./mu.test(dump.stdout), 'AUTH_ROW_DATA_MUST_NEVER_ENTER_DUMP');
    assert(!/\b(?:lo_create|lo_open|pg_largeobject)\b/u.test(dump.stdout), 'LARGE_OBJECT_DATA_MUST_NEVER_ENTER_DUMP');
    assert(/^CREATE TABLE eps\.workspaces \(/mu.test(dump.stdout), 'REVIEWED_APPLICATION_SCHEMA_MUST_REMAIN_SELECTED');
    report.auth_row_data_and_large_objects_excluded = true;
    await protectedArtifact('canonical21.sql', dump.stdout);
    const env = path.join(privateDirectory, 'instance.env'); await protectedArtifact('instance.env', `POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}\nPOSTGRES_DB=postgres\nPGDATA=/var/lib/postgresql/data\n`); report.private_artifacts_owner_system_protected = true;
    await revalidateSources(); report.container_creation_attempted = true;
    const created = await docker(['run', '--detach', '--pull=never', '--name', name, ...Object.entries(labels).flatMap(([key, value]) => ['--label', `${key}=${value}`]), '--network', 'none', '--memory', '1g', '--cpus', '2', '--pids-limit', '256', '--shm-size', '128m', '--tmpfs', '/var/lib/postgresql/data:rw,size=512m', '--env-file', env, IMAGE]);
    disposable = created.stdout.trim(); assert(/^[a-f0-9]{64}$/u.test(disposable)); await inspectDisposable();
    // The observed pinned image uses .postgres-wrapp as PID1 after its temporary
    // initialization server. Admit by the completed init phase and stable real
    // postmaster identity/ancestry, not a guessed Linux process name.
    const serverProbe = `begin read only;select jsonb_build_object('system_identifier',(select system_identifier::text from pg_control_system()),'postmaster_pid',split_part(pg_read_file('postmaster.pid'),E'\\n',1)::integer,'postmaster_started_at',pg_postmaster_start_time());rollback;`;
    let ready = false; let finalServer; let initMarker = false; const processNames = new Set(); let lastProbe;
    for (let n = 0; n < 90; n++) {
      const main = await docker(['exec', disposable, 'cat', '/proc/1/comm'], '', { timeout: 3000, allowFailure: true });
      const processName = /^[A-Za-z0-9 .:_-]{1,32}$/u.test(main.stdout.trim()) ? main.stdout.trim() : 'UNKNOWN'; processNames.add(processName);
      const startup = await docker(['logs', '--tail', '100', disposable], '', { allowFailure: true, maximum: 1024 * 1024 });
      initMarker ||= (startup.stdout + startup.stderr).includes('PostgreSQL init process complete; ready for start up.');
      lastProbe = await docker(['exec', disposable, 'pg_isready', '-U', 'supabase_admin', '-d', 'postgres'], '', { timeout: 3000, allowFailure: true });
      if (initMarker && lastProbe.code === 0) {
        try {
          const first = jsonRows((await sql(serverProbe)).stdout)[0];
          await new Promise(resolve => setTimeout(resolve, 1000));
          const second = jsonRows((await sql(serverProbe)).stdout)[0];
          assert.deepEqual(second, first); assert(Number.isInteger(second.postmaster_pid) && second.postmaster_pid >= 1);
          assert(/^[0-9]+$/u.test(second.system_identifier)); assert(Number.isFinite(Date.parse(second.postmaster_started_at)));
          const chain = []; let pid = second.postmaster_pid;
          for (let depth = 0; depth < 8; depth++) {
            const stat = await docker(['exec', disposable, 'cat', `/proc/${pid}/stat`], '', { timeout: 3000 });
            const match = stat.stdout.match(/^(\d+) \(([^)]*)\) \S (\d+) /u); assert(match); assert.equal(Number(match[1]), pid);
            chain.push({ pid, process_name: /^[A-Za-z0-9 .:_-]{1,32}$/u.test(match[2]) ? match[2] : 'UNKNOWN', parent_pid: Number(match[3]) });
            if (pid === 1) break; pid = Number(match[3]); assert(pid >= 1 && !chain.some(value => value.pid === pid));
          }
          assert.equal(chain.at(-1).pid, 1); finalServer = { ...second, process_chain: chain }; ready = true; break;
        } catch { /* Only read-only startup probes retry; no submitted write is replayed. */ }
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    report.startup_observation = { process_names: [...processNames], init_complete_marker_observed: initMarker, last_readiness_code: lastProbe?.code ?? null, final_server: finalServer ?? null };
    if (!ready) {
      const state = (await inspectDisposable()).State;
      report.startup_observation.state = { running: state.Running, exit_code: state.ExitCode, oom_killed: state.OOMKilled };
      const logs = await docker(['logs', '--tail', '100', disposable], '', { allowFailure: true, maximum: 1024 * 1024 });
      throw Object.assign(new Error('DISPOSABLE_FINAL_POSTMASTER_READY_REQUIRED'), { privateDiagnostic: { startup: report.startup_observation, stdout: logs.stdout, stderr: logs.stderr } });
    }
    instance = finalServer.system_identifier;
    assert.notEqual(instance, '7701520506262638626'); report.disposable = { name, container_id: disposable, system_identifier: instance, network: 'none', published_ports: 0, labels_verified: true, tmpfs_data: true, final_postmaster_observed: true, dumped_login_credentials: false };
    await revalidateSources(); await sql(roleSql);
    assert.deepEqual(jsonRows((await sql(roleQuery)).stdout)[0], roles, 'EXACT_NOLOGIN_OWNER_AND_MEMBERSHIP_PROVENANCE_REQUIRED');
    report.nologin_owner_and_membership_provenance_matches21 = true;
    assert.deepEqual(jsonRows((await sql(EXTENSION_METADATA)).stdout)[0], managedExtensions, 'PINNED_MANAGED_EXTENSIONS_MUST_MATCH_SOURCE');
    // Schema-filtered pg_dump omits global event triggers. Match them to the
    // untouched pinned image first, then temporarily remove only those exact
    // managed dependencies in the disposable target and restore their metadata.
    assert.deepEqual(jsonRows((await sql(EVENT_METADATA)).stdout)[0], managedEvents, 'PINNED_MANAGED_EVENT_TRIGGERS_MUST_MATCH_SOURCE');
    const ident = value => { assert(/^[a-z][a-z0-9_]{0,62}$/u.test(value)); return `"${value}"`; };
    const eventRestore = managedEvents.events.map(value => {
      assert(['postgres', 'supabase_admin'].includes(value.owner)); assert.equal(value.function_arguments, 0);
      assert(['ddl_command_start', 'ddl_command_end', 'sql_drop', 'table_rewrite'].includes(value.event)); assert(['O', 'D', 'R', 'A'].includes(value.enabled));
      let when = ''; if (value.tags !== null) { assert(Array.isArray(value.tags) && value.tags.length <= 100); for (const tag of value.tags) assert(/^[A-Z][A-Z _]{0,79}$/u.test(tag)); when = ` when tag in(${value.tags.map(tag => `'${tag}'`).join(',')})`; }
      const mode = { O: 'enable', D: 'disable', R: 'enable replica', A: 'enable always' }[value.enabled];
      return `create event trigger ${ident(value.name)} on ${value.event}${when} execute function ${ident(value.function_schema)}.${ident(value.function_name)}();alter event trigger ${ident(value.name)} owner to ${ident(value.owner)};alter event trigger ${ident(value.name)} ${mode};`;
    }).join('\n');
    await sql(managedEvents.events.map(value => `drop event trigger ${ident(value.name)};`).join('\n'));
    await sql(dump.stdout);
    // Restore exact source syntax/ACLs lost by the clean filtered pg_dump
    // round-trip. No comparator masking: the final complete snapshot must match.
    await sql(constraintRestore);
    // pg_dump omits an explicit owner-only ACL because it has default effective
    // privileges. Materialize the reviewed explicit ACL rather than normalizing
    // the comparison or granting an additional principal.
    await sql('grant all on table eps.cast_operation_notes to postgres;');
    const restoredPublic = jsonRows((await sql(PUBLIC_SCHEMA_METADATA)).stdout)[0];
    assert.deepEqual(restoredPublic, { owner: publicSchema.owner, acl: publicSchema.acl.filter(value => value.grantee !== 'PUBLIC') }, 'ONLY_SOURCE_DEFAULT_PUBLIC_USAGE_MAY_BE_MISSING');
    await sql('grant usage on schema public to public;');
    assert.deepEqual(jsonRows((await sql(PUBLIC_SCHEMA_METADATA)).stdout)[0], publicSchema, 'PUBLIC_SCHEMA_ACL_MUST_MATCH_SOURCE_EXACTLY');
    report.original_between_constraints_restored_from_sealed_migration = 4; report.public_schema_acl_restored_exactly = true;
    assert.deepEqual(jsonRows((await sql(EXTENSION_METADATA)).stdout)[0], managedExtensions, 'PINNED_MANAGED_EXTENSIONS_MUST_RESTORE_EXACTLY');
    report.pinned_managed_extensions_restored_exactly = true;
    await sql(eventRestore); assert.deepEqual(jsonRows((await sql(EVENT_METADATA)).stdout)[0], managedEvents, 'MANAGED_EVENT_TRIGGERS_MUST_RESTORE_EXACTLY');
    report.pinned_managed_event_triggers_restored_exactly = true;
    const clone = jsonRows((await sql(`set role postgres;${sources.get(QUERY).replaceAll('7701520506262638626',instance)}`)).stdout)[0]; report.clone_snapshot = clone;
    if(!isDeepStrictEqual(clone,before)){
      const originalCatalog=jsonRows((await runOwnedLocalSql(`begin read only;set local search_path='';${sources.get(FILES[11])}rollback;`)).stdout)[0];
      const cloneCatalog=jsonRows((await sql(`begin read only;set local search_path='';${sources.get(FILES[11])}rollback;`)).stdout)[0];
      const difference=Object.fromEntries([...new Set([...Object.keys(originalCatalog),...Object.keys(cloneCatalog)])].filter(key=>!isDeepStrictEqual(originalCatalog[key],cloneCatalog[key])).map(key=>[key,{original:originalCatalog[key],clone:cloneCatalog[key]}]));
      const rawQuery=`select jsonb_build_object('functions',(select jsonb_object_agg(p.oid::regprocedure::text,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public')),'managed_auth',(select jsonb_build_array(relowner::regrole::text,relrowsecurity,relforcerowsecurity,relacl::text)from pg_class where oid='auth.users'::regclass));`;
      const originalRaw=jsonRows((await runOwnedLocalSql(`begin read only;set local search_path='';${rawQuery}rollback;`)).stdout)[0];
      const cloneRaw=jsonRows((await sql(`begin read only;set local search_path='';${rawQuery}rollback;`)).stdout)[0];
      await protectedArtifact('catalog-diagnostic.json',JSON.stringify({difference,raw_functions:Object.fromEntries(Object.keys(originalRaw.functions).filter(key=>originalRaw.functions[key]!==cloneRaw.functions[key]).map(key=>[key,{original:originalRaw.functions[key],clone:cloneRaw.functions[key]}])),managed_auth:{original:originalRaw.managed_auth,clone:cloneRaw.managed_auth}},null,2));
    }
    assert.deepEqual(clone, before, 'EXACT21_REVIEWED_CATALOG_APPLICATION_CLONE_REQUIRED'); report.reviewed_catalog_and_application_snapshot_matches21 = true;
    await revalidateSources();
    const setup=await sql(`begin;set local role postgres;${sources.get(FILES[0])}\n${sources.get(FILES[1])}\n${sources.get(FILES[2])}\nset local role supabase_auth_admin;alter table auth.users enable row level security;set local role postgres;${sources.get(FILES[8])}
set local role postgres;update eps.review_processing_config set enabled=true;insert into public.app_capability_grants(principal_id,capability)select '8a1a0000-0000-4000-8000-000000000001'::uuid,value from unnest(array['cast.read','operations.retry'])value;set local role authenticated;
do $setup$declare ids jsonb:='{}';key text;ack jsonb;begin
 foreach key in array array['terminal','callback','claim','revoked']loop
  ack:=public.eps_create_ai_suggestion('{"workspace_id":"8a2a0000-0000-4000-8000-000000000001","capability":"normalize_english","target_type":"role","target_id":"8a3a0000-0000-4000-8000-000000000001","target_row_version":1,"field":"name","instruction":"Keep the supplied role name unchanged."}','m04-review-race-'||key);ids:=ids||jsonb_build_object(key,ack->>'job_id');
 end loop;perform set_config('eps.m04.race.ids',ids::text,false);
end$setup$;select current_setting('eps.m04.race.ids');commit;`);
    const ids=jsonRows(setup.stdout).at(-1);for(const value of Object.values(ids))assert(/^[a-f0-9-]{36}$/u.test(value));
    const actor='8a1a0000-0000-4000-8000-000000000001';const workspace='8a2a0000-0000-4000-8000-000000000001';
    const service=`select set_config('request.jwt.claim.sub','',false);select set_config('request.jwt.claims','{}',false);set role eps_jobs_executor;`;
    const jobs=jsonRows((await sql(`set role postgres;select jsonb_object_agg(id::text,input_hash)from eps.jobs;`)).stdout)[0];
    // Cancellation owns the job row while recovery sees the old eligible row,
    // acquires the workspace, then demonstrably waits on the same job row.
    held=await heldTransaction(`${identity(actor)}select public.eps_cancel_job('${ids.terminal}','{"row_version":1}','m04-review-race-cancel')`,'M04_REVIEW_CANCEL_HELD');
    const recoveryApplication=`eps-review-recovery-${run}`;const recovery=sql(`begin;${service}select eps.recover_job_stages(100);commit;`,{application:recoveryApplication});
    await awaitBlocked(recoveryApplication);await held.commit();held=undefined;assert.equal(jsonRows((await recovery).stdout).at(-1).recovered,0);
    const terminal=jsonRows((await sql(`set role postgres;select jsonb_build_object('status',status,'row_version',row_version,'dispatch_generation',dispatch_generation)from eps.jobs where id='${ids.terminal}';`)).stdout)[0];assert.deepEqual(terminal,{status:'cancelled',row_version:2,dispatch_generation:1});
    report.terminal_recovery_race={job_lock_wait_observed:true,committed_status:'cancelled',terminal_preserved:true,new_dispatches:0};
    const claimed=jsonRows((await sql(`begin;${service}select eps.claim_job_stage('{"job_id":"${ids.callback}","stage":"prepare_suggestion","input_hash":"${jobs[ids.callback]}"}');commit;`)).stdout).at(-1);
    // This lease expires during the observed workspace wait. A callback that
    // sampled its clock before locking would incorrectly extend that lease.
    held=await heldTransaction(`set role postgres;select 1 from eps.workspaces where id='${workspace}'for update;update eps.jobs set lease_expires_at=clock_timestamp()+interval'1second'where id='${ids.callback}'`,'M04_REVIEW_EXPIRING_CALLBACK_HELD');
    const callbackApplication=`eps-review-callback-${run}`;const event={job_id:ids.callback,attempt_id:claimed.attempt_id,lease_token:claimed.lease_token,stage:'prepare_suggestion',input_hash:jobs[ids.callback],event_id:'synthetic-expiring-heartbeat',sequence:1,event_type:'heartbeat'};
    const callback=sql(`begin;${service}select eps.record_job_event('${JSON.stringify(event)}'::jsonb);commit;`,{application:callbackApplication});await awaitBlocked(callbackApplication);await sql('select pg_sleep(1.2);');await held.commit();held=undefined;
    const callbackReceipt=jsonRows((await callback).stdout).at(-1);assert.equal(callbackReceipt.stale,true);assert.equal(callbackReceipt.applied,false);
    const callbackState=jsonRows((await sql(`set role postgres;select jsonb_build_object('expired',lease_expires_at<clock_timestamp(),'row_version',row_version,'events',(select count(*)from eps.job_events where job_id='${ids.callback}'))from eps.jobs where id='${ids.callback}';`)).stdout)[0];assert.deepEqual(callbackState,{expired:true,row_version:2,events:0});
    report.expired_callback_after_wait={workspace_lock_wait_observed:true,lease_expired_during_wait:true,stale:true,applied:false,events:0};
    // Availability opens during this wait. A freshly sampled post-lock clock
    // admits it and grants the full lease, rather than rejecting a ready job.
    held=await heldTransaction(`set role postgres;select 1 from eps.workspaces where id='${workspace}'for update;update eps.jobs set available_at=clock_timestamp()+interval'1second'where id='${ids.claim}'`,'M04_REVIEW_AVAILABLE_CLAIM_HELD');
    const claimApplication=`eps-review-claim-${run}`;const claim=sql(`begin;${service}select eps.claim_job_stage('{"job_id":"${ids.claim}","stage":"prepare_suggestion","input_hash":"${jobs[ids.claim]}"}');commit;`,{application:claimApplication});await awaitBlocked(claimApplication);await sql('select pg_sleep(1.2);');await held.commit();held=undefined;const claimReceipt=jsonRows((await claim).stdout).at(-1);assert.equal(claimReceipt.already_completed,false);
    const claimState=jsonRows((await sql(`set role postgres;select jsonb_build_object('status',status,'lease_remaining_ms',extract(epoch from(lease_expires_at-clock_timestamp()))*1000)from eps.jobs where id='${ids.claim}';`)).stdout)[0];assert.equal(claimState.status,'running');assert(claimState.lease_remaining_ms>88000&&claimState.lease_remaining_ms<=90000);report.available_claim_after_wait={workspace_lock_wait_observed:true,claimed_after_availability:true,remaining_lease_at_observation_ms:claimState.lease_remaining_ms};
    held=await heldTransaction(`set role postgres;select 1 from eps.workspaces where id='${workspace}'for update;update public.app_capability_grants set active=false where principal_id='${actor}'and capability='workspaces.write'`,'M04_REVIEW_AUTHORITY_HELD');
    const authorityApplication=`eps-review-authority-${run}`;const revoked=sql(`begin;${service}select eps.claim_job_stage('{"job_id":"${ids.revoked}","stage":"prepare_suggestion","input_hash":"${jobs[ids.revoked]}"}');commit;`,{application:authorityApplication,allowFailure:true});await awaitBlocked(authorityApplication);await held.commit();held=undefined;const denial=await revoked;assert.notEqual(denial.code,0);assert(denial.stderr.includes('CAPABILITY_REQUIRED'));report.requester_revocation_after_wait={workspace_lock_wait_observed:true,denied_code:'CAPABILITY_REQUIRED'};
    report.assertions_passed = true;
  } catch (error) {
    try { await protectedArtifact('diagnostic.json', JSON.stringify({ stack: String(error.stack ?? error), detail: error.privateDiagnostic }, null, 2)); report.private_diagnostic = path.relative(ROOT, path.join(privateDirectory, 'diagnostic.json')).replaceAll('\\', '/'); } catch { /* No unsafe diagnostic fallback. */ } report.diagnostic = 'M04_ISOLATED_RACE_UNCONFIRMED';
  } finally {
    if (held) { try { await held.abort(); } catch { /* Container teardown bounds unknown sessions. */ } }
    if (disposable) { try { await inspectDisposable(); await docker(['rm', '--force', '--volumes', disposable]); const present = await docker(['ps', '--all', '--no-trunc', '--filter', `id=${disposable}`, '--format', '{{.ID}}']); assert.equal(present.stdout.trim(), ''); report.disposable_cleanup_verified = true; } catch { report.disposable_cleanup_verified = false; } }
    else if (!report.container_creation_attempted) report.disposable_cleanup_verified = true;
    if (before) { try { report.after = await canonicalSnapshot(sources.get(QUERY)); report.canonical21_unchanged = isDeepStrictEqual(before, report.after); if (authBefore) { report.managed_auth_after = await canonicalAuthMetadata(); report.managed_auth_metadata_and_row_revisions_preserved = isDeepStrictEqual(authBefore, report.managed_auth_after); } } catch { report.canonical21_unchanged = false; } }
    report.sources_stable = (await Promise.all(Object.entries(seals).map(async ([file, value]) => sha(await readFile(path.join(ROOT, file))) === value))).every(Boolean);
    report.pre_handoff_source_checks = sourceCheckCount;
    if (locked && report.canonical21_unchanged && (!authBefore || report.managed_auth_metadata_and_row_revisions_preserved) && report.disposable_cleanup_verified) { const lock = JSON.parse(await readFile(lockFile, 'utf8')); assert.equal(lock.run_id, run); assert.equal(lock.pid, process.pid); await unlink(lockFile); }
    if (report.assertions_passed && report.canonical21_unchanged && report.managed_auth_metadata_and_row_revisions_preserved && report.disposable_cleanup_verified && report.sources_stable) report.result = 'passed';
    report.finished_at = new Date().toISOString(); const directory = path.join(ROOT, 'tracking/evidence/m04/review-race-local'); await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${report.finished_at.replace(/[:.]/gu, '-')}-${run.slice(0, 8)}.json`); await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ result: report.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), canonical21_unchanged: report.canonical21_unchanged, disposable_cleanup_verified: report.disposable_cleanup_verified, sources_stable: report.sources_stable, private_diagnostic: report.private_diagnostic }) + '\n'); if (report.result !== 'passed') process.exitCode = 1;
  }
}
main().catch(() => { process.stderr.write('Isolated M04 race stopped; no canonical fallback.\n'); process.exitCode = 1; });
