/** One owned local SQL proof; no cloud, providers, original schema writes or historical runner execution. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const BACKUP = '639da33a-7e90-4471-b0ec-c7a8ff6097ef';
const METADATA = '12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c';
const MIGRATION = 'supabase/migrations/20261101223342_m07_project_creation.sql';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const rows = text => text.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
export function functionalChange(source) {
  const start = '-- BEGIN PROJECT CREATION FUNCTIONAL CHANGE', end = '-- END PROJECT CREATION FUNCTIONAL CHANGE';
  assert.equal(source.split(start).length, 2); assert.equal(source.split(end).length, 2);
  const body = source.slice(source.indexOf(start) + start.length, source.indexOf(end));
  assert(body.length > 0 && !/^\s*(?:begin|commit|rollback|start\s+transaction)\s*;/imu.test(body)); return body;
}
export function assertOwnedDatabase(actual, expected) {
  for (const key of ['database', 'oid', 'owner', 'marker', 'system_identifier']) assert.equal(actual[key], expected[key], 'PROJECT39_OWNED_DATABASE_REQUIRED');
  assert.equal(actual.clients, 0, 'PROJECT39_OTHER_SESSION');
}
async function command(exe, args, { input = '', env = process.env, timeout = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd: ROOT, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', bytes = 0, timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    for (const [stream, key] of [[child.stdout, 'out'], [child.stderr, 'err']]) stream.on('data', b => { bytes += b.length; if (bytes > 32 * 1024 ** 2) child.kill(); else if (key === 'out') stdout += b; else stderr += b; });
    child.stdin.on('error', () => {}); child.stdin.end(input); child.once('error', () => { clearTimeout(timer); reject(Error('PROJECT39_COMMAND_UNCONFIRMED')); });
    child.once('close', (code, signal) => { clearTimeout(timer); if (timedOut || bytes > 32 * 1024 ** 2 || code !== 0) reject(Object.assign(Error('PROJECT39_COMMAND_FAILED'), { diagnostic: { code, signal, stdout, stderr } })); else resolve({ stdout, stderr }); });
  });
}
async function protect(directory) {
  await mkdir(directory, { mode: 0o700 }); assert.equal(await realpath(directory), directory);
  if (process.platform !== 'win32') { assert.equal((await lstat(directory)).mode & 0o777, 0o700); return; }
  const script = "$ErrorActionPreference='Stop';$p=$env:EPS_PROJECT39_PRIVATE;$s=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$a=New-Object System.Security.AccessControl.DirectorySecurity;$a.SetOwner($s);$a.SetAccessRuleProtection($true,$false);foreach($i in @($s,[System.Security.Principal.SecurityIdentifier]'S-1-5-18')){$r=New-Object System.Security.AccessControl.FileSystemAccessRule($i,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$a.AddAccessRule($r)};Set-Acl -LiteralPath $p -AclObject $a;$a=Get-Acl -LiteralPath $p;if(-not$a.AreAccessRulesProtected-or$a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value-ne$s.Value){throw 'ACL'};foreach($r in $a.Access){if($r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value-notin@($s.Value,'S-1-5-18')-or$r.AccessControlType-ne'Allow'-or$r.FileSystemRights-ne'FullControl'){throw 'ACL'}};if($a.Access.Count-ne2){throw 'ACL'};Write-Output 'VERIFIED'";
  const result = await command(path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, EPS_PROJECT39_PRIVATE: directory } });
  assert.equal(result.stdout.trim(), 'VERIFIED');
}
export async function run(sourceRoot) {
  assert.equal(process.version, 'v24.18.0'); assert(!process.env.NODE_OPTIONS && !process.env.NPM_CONFIG_NODE_OPTIONS);
  sourceRoot = await realpath(path.resolve(sourceRoot));
  const runId = randomUUID(), started = Date.now(), privateRoot = path.join(ROOT, '.local/project-creation39-proof', runId);
  const report = { schema_version: '1.0', run_id: runId, observed_at: new Date(started).toISOString(), result: 'failed', checkpoint: 'preflight',
    scope: 'synthetic current38 metadata restored into owned disposable local database; byte-exact39 functional DDL and sequential permissions/replay tests in one ROLLBACK; no cloud, concurrent-session race, provider or hosted acceptance', cloud_called: false, provider_called: false };
  let port, before, lock, lockPath, expected, outcome, privateReady = false, creationAttempted = false;
  const database = 'eps_c39_' + runId.replaceAll('-', ''), marker = 'eps-project39:' + runId;
  assert(/^eps_c39_[a-f0-9]{32}$/u.test(database));
  const rolesSql = "select jsonb_build_object('roles',(select jsonb_agg(jsonb_build_object('oid',oid,'name',rolname,'super',rolsuper,'inherit',rolinherit,'create_role',rolcreaterole,'create_db',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypassrls',rolbypassrls,'connlimit',rolconnlimit,'validuntil',rolvaliduntil)order by oid)from pg_roles),'memberships',(select jsonb_agg(to_jsonb(m)order by roleid,member,grantor)from pg_auth_members m));";
  let catalogueSql, dataSql;
  const baseline = async () => rows((await port.runOwnedLocalSql('begin read only;set local search_path=pg_catalog;' + dataSql + catalogueSql + rolesSql + 'rollback;')).stdout);
  let runtime;
  const psql = async (target, sql) => {
    const checked = await port.verifyLocalTarget(); assert.equal(checked.container.Id, runtime.container.Id); assert.equal(checked.observed.system_identifier, '7701520506262638626');
    return command('docker', ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', 'exec', '-i', '--user', 'postgres', checked.config.container,
      'psql', '-h', '/var/run/postgresql', '-U', 'supabase_admin', '-d', target, '-X', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-q'], { input: sql, timeout: 120000 });
  };
  const identity = async () => {
    const value = await port.runOwnedLocalSql("begin read only;select jsonb_build_object('database',datname,'oid',oid::text,'owner',datdba::regrole::text,'marker',shobj_description(oid,'pg_database'),'system_identifier',(pg_control_system()).system_identifier::text,'clients',(select count(*)from pg_stat_activity where datname=" + quote(database) + "))from pg_database where datname=" + quote(database) + ';rollback;');
    return rows(value.stdout).at(-1) ?? null;
  };
  try {
    await mkdir(path.dirname(privateRoot), { recursive: true }); await protect(privateRoot); privateReady = true;
    await writeFile(path.join(privateRoot, 'claim.json'), JSON.stringify({ run_id: runId, automatic_retry: false }), { flag: 'wx' });
    port = await import(pathToFileURL(path.join(sourceRoot, 'tools/local-postgres.mjs')).href); runtime = await port.verifyLocalTarget();
    assert.equal(runtime.observed.system_identifier, '7701520506262638626');
    lockPath = path.join(sourceRoot, '.local/local-postgres/test-db.lock'); lock = { run_id: runId, purpose: 'project-creation39-proof', workspace: ROOT };
    await writeFile(lockPath, JSON.stringify(lock), { flag: 'wx' }); report.private_acl_verified = true;
    const bundle = await import(pathToFileURL(path.join(sourceRoot, 'tools/m07-recovery-bundle.mjs')).href);
    const backupRoot = path.join(sourceRoot, '.local/m07-recovery', BACKUP);
    const verified = await bundle.verifyRecoveryBundle(backupRoot, BACKUP, 'backup'); assert.equal(verified.manifest.metadata.sha256, METADATA);
    const metadata = await readFile(path.join(backupRoot, 'backup/metadata.sql')); assert.equal(sha(metadata), METADATA);
    const sourceMap = new Map(); for (const e of verified.manifest.sources) sourceMap.set(e.path, await readFile(path.join(backupRoot, 'backup', e.file)));
    const { fullCatalogue33Sql } = await import(pathToFileURL(path.join(sourceRoot, 'development/m07/recovery33/compiler.mjs')).href);
    const { dataSql36 } = await import(pathToFileURL(path.join(sourceRoot, 'development/m07/recovery36/runtime.mjs')).href);
    catalogueSql = fullCatalogue33Sql(sourceMap).sql; dataSql = dataSql36(); before = await baseline(); assert.equal(before.length, 3);
    assert.equal(before[0]['supabase_migrations.schema_migrations'].count, 29);
    assert(!before[2].roles.some(r => ['eps_mcp_issuer_owner', 'eps_oauth_consent_owner', 'eps_job_trace_owner', 'eps_project_creator'].includes(r.name)), 'PROJECT39_EXISTING_ROLE_NOT_ADOPTED');
    const migration = await readFile(path.join(sourceRoot, MIGRATION)), functional = functionalChange(migration.toString('utf8'));
    const fixture = await readFile(path.join(ROOT, 'development/m07/project-creation39-proof/fixture.sql'));
    report.source_seals = { [MIGRATION]: sha(migration), 'development/m07/project-creation39-proof/run.mjs': sha(await readFile(import.meta.filename)), 'development/m07/project-creation39-proof/fixture.sql': sha(fixture) };
    report.metadata_sha256 = METADATA; report.original_baseline_sha256 = sha(JSON.stringify(before)); report.functional_sha256 = sha(functional);
    await writeFile(path.join(privateRoot, 'migration39.sql'), migration, { flag: 'wx' });
    await writeFile(path.join(privateRoot, 'executed-run.mjs'), await readFile(import.meta.filename), { flag: 'wx' });
    await writeFile(path.join(privateRoot, 'executed-fixture.sql'), fixture, { flag: 'wx' }); report.executed_source_snapshots_retained_privately = true;
    assert.equal(await identity(), null, 'PROJECT39_DATABASE_ALREADY_EXISTS');
    report.checkpoint = 'create-owned-disposable-database';
    creationAttempted = true;
    await port.runOwnedLocalSql(`create database ${database} with template template0 owner postgres;comment on database ${database} is ${quote(marker)};`);
    expected = await identity(); assert(expected); assert.equal(expected.owner, 'postgres'); assert.equal(expected.marker, marker); assert.equal(expected.clients, 0);
    const guard = `do $owned$begin if current_database()<>${quote(database)} or (pg_control_system()).system_identifier::text<>'7701520506262638626' or (select shobj_description(oid,'pg_database')from pg_database where datname=current_database())<>${quote(marker)} then raise exception'PROJECT39_OWNED_TARGET_REQUIRED';end if;end$owned$;`;
    const bootstrap = "create role eps_mcp_issuer_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;create role eps_oauth_consent_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;create role eps_job_trace_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;";
    const preserveBefore = `create temporary table proof_original_rows(table_name text,row_hash text);do $snapshot$declare r record;begin for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'and n.nspname in('eps','public','auth','storage','supabase_migrations')loop execute format('insert into proof_original_rows select %L,encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'')from %I.%I t',r.nspname||'.'||r.relname,r.nspname,r.relname);end loop;end$snapshot$;`;
    const preserveAfter = `do $preserve$declare r record;missing bigint;begin for r in select distinct table_name from proof_original_rows loop execute format('select count(*)from(select row_hash from proof_original_rows where table_name=%L except select encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'')from %s t)s',r.table_name,r.table_name)into missing;if missing<>0 then raise exception'PROJECT39_PRIOR_ROW_CHANGED';end if;end loop;end$preserve$;select jsonb_build_object('all_preexisting_rows_preserved',true,'restored_tables',(select count(distinct table_name)from proof_original_rows));`;
    report.checkpoint = 'restore38-apply39-test-and-rollback';
    const result = await psql(database, 'begin;set local lock_timeout=\'5s\';set local statement_timeout=\'60s\';' + guard + bootstrap + metadata.toString('utf8')
      + '\nset local row_security=on;set local lock_timeout=\'5s\';set local statement_timeout=\'60s\';\n' + dataSql + preserveBefore + '\nset local role postgres;\n' + functional + '\nreset role;\n' + fixture.toString('utf8') + preserveAfter + '\nrollback;');
    const results = rows(result.stdout); const restored = results.find(r => r['supabase_migrations.schema_migrations']);
    const sourceRows = JSON.parse(await readFile(path.join(backupRoot, 'source38-populated-row-hashes.json')));
    assert.deepEqual(restored, sourceRows); report.restored38_all_table_hashes_exact = true;
    const assertions = results.find(r => r.assertions); assert(assertions?.assertions >= 29); report.sql_assertions = assertions;
    assert.equal(results.at(-1).all_preexisting_rows_preserved, true); report.all_preexisting_rows_preserved = true;
    assert.equal(sha(await readFile(path.join(sourceRoot, MIGRATION))), sha(migration), 'PROJECT39_MIGRATION_CHANGED_DURING_PROOF');
    const empty = rows((await psql(database, "begin read only;" + guard + "select jsonb_build_object('application_schema_absent',to_regnamespace('eps')is null);rollback;")).stdout).at(-1);
    assert.equal(empty.application_schema_absent, true); report.all_restore_and39_ddl_rolled_back = true;
    report.result = 'passed'; report.checkpoint = 'complete';
  } catch (error) {
    report.failure_code = error instanceof assert.AssertionError ? 'PROJECT39_ASSERTION_FAILED' : 'PROJECT39_COMMAND_FAILED';
    if (privateReady) await writeFile(path.join(privateRoot, 'failure.json'), JSON.stringify({ message: error.message, diagnostic: error.diagnostic ?? null }), { flag: 'wx' });
  } finally {
    try {
      if (port && creationAttempted) {
        const actual = await identity();
        if (actual) {
          if (!expected) { assert.equal(actual.owner, 'postgres'); assert.equal(actual.marker, marker); assert.equal(actual.database, database); expected = actual; }
          assertOwnedDatabase(actual, expected); await port.runOwnedLocalSql(`drop database ${database};`); assert.equal(await identity(), null);
        }
        report.owned_database_absent = true;
      }
      if (port && before) { assert.deepEqual(await baseline(), before); report.original_data_catalogue_and_global_roles_unchanged = true; }
      if (lock && lockPath) { assert.deepEqual(JSON.parse(await readFile(lockPath)), lock); await unlink(lockPath); report.shared_lock_released = true; }
    } catch { report.result = 'failed'; report.cleanup_unconfirmed = true; }
    report.finished_at = new Date().toISOString(); report.elapsed_ms = Date.now() - started;
    const directory = path.join(ROOT, 'tracking/evidence/m07/project-creation39-proof'); await mkdir(directory, { recursive: true });
    const file = path.join(directory, report.observed_at.replaceAll(':', '-') + '-' + runId.slice(0, 8) + '.json'); await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    outcome = { result: report.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), cleanup_verified: report.owned_database_absent === true && report.original_data_catalogue_and_global_roles_unchanged === true && report.shared_lock_released === true };
  }
  return outcome;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3) throw Error('Supply the owned original workspace root.');
  run(process.argv[2]).then(result => { process.stdout.write(JSON.stringify(result) + '\n'); if (result.result !== 'passed') process.exitCode = 1; }).catch(() => { process.stderr.write('Project39 local proof unconfirmed; diagnostics suppressed.\n'); process.exitCode = 1; });
}
