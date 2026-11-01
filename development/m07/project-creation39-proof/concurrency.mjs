/** Separate real-session race on an owned independent PG17 cluster. No cloud. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { pathToFileURL } from 'node:url';
import { functionalChange } from './run.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const IMAGE = 'public.ecr.aws/supabase/postgres@sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb';
const BACKUP = '639da33a-7e90-4471-b0ec-c7a8ff6097ef';
const METADATA = '12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c';
const MIGRATION = 'supabase/migrations/20261101223342_m07_project_creation.sql';
const ACTOR = 'a4390000-0000-4000-8000-000000000001';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const quote = text => "'" + text.replaceAll("'", "''") + "'";
const rows = text => text.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export function assertRaceResource(value, expected) {
  assert.equal(value.Id, expected.id); assert.equal((value.Name ?? '').replace(/^\//u, ''), expected.name);
  if (expected.image) assert.equal(value.Image, expected.image);
  for (const [key, label] of Object.entries(expected.labels)) assert.equal(value.Labels?.[key] ?? value.Config?.Labels?.[key], label);
  return value;
}
async function command(exe, args, { input = '', env = process.env, timeout = 60000, allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd: ROOT, env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', bytes = 0, timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    for (const [stream, out] of [[child.stdout, true], [child.stderr, false]]) stream.on('data', b => { bytes += b.length; if (bytes > 32 * 1024 ** 2) child.kill(); else if (out) stdout += b; else stderr += b; });
    child.stdin.on('error', () => {}); child.stdin.end(input); child.once('error', () => { clearTimeout(timer); reject(Error('PROJECT39_RACE_COMMAND_UNCONFIRMED')); });
    child.once('close', code => { clearTimeout(timer); if (timedOut || bytes > 32 * 1024 ** 2 || code !== 0 && !allowFailure) reject(Object.assign(Error('PROJECT39_RACE_COMMAND_FAILED'), { diagnostic: { code, stdout, stderr } })); else resolve({ code, stdout, stderr }); });
  });
}
async function protect(directory) {
  await mkdir(directory, { mode: 0o700 }); assert.equal(await realpath(directory), directory);
  const script = "$ErrorActionPreference='Stop';$p=$env:EPS_PROJECT39_RACE_PRIVATE;$s=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$a=New-Object System.Security.AccessControl.DirectorySecurity;$a.SetOwner($s);$a.SetAccessRuleProtection($true,$false);foreach($i in @($s,[System.Security.Principal.SecurityIdentifier]'S-1-5-18')){$r=New-Object System.Security.AccessControl.FileSystemAccessRule($i,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$a.AddAccessRule($r)};Set-Acl -LiteralPath $p -AclObject $a;$a=Get-Acl -LiteralPath $p;if(-not$a.AreAccessRulesProtected-or$a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value-ne$s.Value){throw 'ACL'};foreach($r in $a.Access){if($r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value-notin@($s.Value,'S-1-5-18')-or$r.AccessControlType-ne'Allow'-or$r.FileSystemRights-ne'FullControl'){throw 'ACL'}};if($a.Access.Count-ne2){throw 'ACL'};Write-Output 'VERIFIED'";
  assert.equal((await command(path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, EPS_PROJECT39_RACE_PRIVATE: directory } })).stdout.trim(), 'VERIFIED');
}
export async function runRace(sourceRoot) {
  assert.equal(process.platform, 'win32'); assert.equal(process.version, 'v24.18.0'); assert(!process.env.NODE_OPTIONS && !process.env.NPM_CONFIG_NODE_OPTIONS);
  sourceRoot = await realpath(path.resolve(sourceRoot));
  const runId = randomUUID(), started = Date.now(), privateRoot = path.join(ROOT, '.local/project-creation39-race', runId);
  const labelValues = { 'eps.project39.run': runId, 'eps.project39.workspace': ROOT, 'eps.project39.purpose': 'independent-race39' };
  const labelArgs = Object.entries(labelValues).flatMap(([key, value]) => ['--label', key + '=' + value]);
  const base = 'eps-c39-' + runId.replaceAll('-', ''), resources = [], sessions = [];
  const report = { schema_version: '1.0', run_id: runId, observed_at: new Date(started).toISOString(), result: 'failed', checkpoint: 'preflight',
    scope: 'independent owned local PG17 cluster, restored synthetic38 plus exact39 functional DDL; independent-session advisory-lock/idempotency race; no cloud/provider/hosted acceptance', cloud_called: false, provider_called: false };
  let port, before, lock, lockPath, outcome, db, privateReady = false, catalogueSql, dataSql;
  const docker = (args, options) => command('docker', ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args], options);
  const inspect = async resource => {
    const result = JSON.parse((await docker([resource.type, 'inspect', resource.id])).stdout)[0]; if (resource.type === 'volume') result.Id = result.Name;
    return assertRaceResource(result, resource);
  };
  const originalRolesSql = "select jsonb_build_object('roles',(select jsonb_agg(jsonb_build_object('oid',oid,'name',rolname,'super',rolsuper,'inherit',rolinherit,'create_role',rolcreaterole,'create_db',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypassrls',rolbypassrls,'connlimit',rolconnlimit,'validuntil',rolvaliduntil)order by oid)from pg_roles),'memberships',(select jsonb_agg(to_jsonb(m)order by roleid,member,grantor)from pg_auth_members m));";
  const original = async () => rows((await port.runOwnedLocalSql('begin read only;set local search_path=pg_catalog;' + dataSql + catalogueSql + originalRolesSql + 'rollback;')).stdout);
  const psqlArgs = (database = 'project39') => ['exec', '-i', '--user', 'postgres', db.id, 'psql', '-h', '/var/run/postgresql', '-U', 'supabase_admin', '-d', database, '-X', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-q'];
  const sql = async (body, database = 'project39') => { await inspect(db); return docker(psqlArgs(database), { input: body, timeout: 120000 }); };
  const value = async body => { const results = rows((await sql("set search_path='';" + body)).stdout); assert.equal(results.length, 1); return results[0]; };
  const claim = tag => `begin;set local application_name=${quote('c39-' + runId.slice(0, 8) + '-' + tag)};set local statement_timeout='30s';select set_config('request.jwt.claim.sub','${ACTOR}',true),set_config('request.jwt.claims','{"sub":"${ACTOR}","role":"authenticated","is_anonymous":false}',true);set local role authenticated;`;
  async function held(tag, key, name) {
    await inspect(db);
    const child = spawn('docker', ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...psqlArgs()], { cwd: ROOT, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', bytes = 0, closed = false;
    child.stdout.on('data', b => { bytes += b.length; stdout += b; if (bytes > 128 * 1024) child.kill(); }); child.stderr.on('data', b => { stderr += b; if (stderr.length > 128 * 1024) child.kill(); }); child.stdin.on('error', () => {});
    const done = new Promise((resolve, reject) => { child.once('error', () => reject(Error('PROJECT39_RACE_SESSION_UNCONFIRMED'))); child.once('close', code => { closed = true; if (code !== 0) reject(Object.assign(Error('PROJECT39_RACE_SESSION_FAILED'), { diagnostic: { code, stdout, stderr } })); else resolve(); }); });
    done.catch(() => {});
    const result = async () => { for (let i = 0; i < 200; i++) { const found = rows(stdout).find(r => r.created); if (found) return found; if (closed) { await done; throw Error('PROJECT39_RACE_NO_RESULT'); } await delay(50); } throw Error('PROJECT39_RACE_RESULT_TIMEOUT'); };
    const session = { child, done, result, close: () => { if (!closed) child.stdin.end('commit;\n'); }, rollback: () => { if (!closed) child.stdin.end('rollback;\n'); } }; sessions.push(session);
    child.stdin.write(claim(tag) + `select jsonb_build_object('pid',pg_backend_pid(),'created',public.eps_create_project(${quote(JSON.stringify({ name, presentation_type: 'casting' }))}::jsonb,${quote(key)}));\n`);
    return session;
  }
  try {
    await mkdir(path.dirname(privateRoot), { recursive: true }); await protect(privateRoot); privateReady = true; report.private_acl_verified = true;
    await writeFile(path.join(privateRoot, 'claim.json'), JSON.stringify({ run_id: runId, automatic_retry: false }), { flag: 'wx' });
    port = await import(pathToFileURL(path.join(sourceRoot, 'tools/local-postgres.mjs')).href); const target = await port.verifyLocalTarget(); assert.equal(target.observed.system_identifier, '7701520506262638626');
    lock = { run_id: runId, purpose: 'project-creation39-independent-race', workspace: ROOT }; lockPath = path.join(sourceRoot, '.local/local-postgres/test-db.lock'); await writeFile(lockPath, JSON.stringify(lock), { flag: 'wx' });
    const bundle = await import(pathToFileURL(path.join(sourceRoot, 'tools/m07-recovery-bundle.mjs')).href), backupRoot = path.join(sourceRoot, '.local/m07-recovery', BACKUP);
    const verified = await bundle.verifyRecoveryBundle(backupRoot, BACKUP, 'backup'); assert.equal(verified.manifest.metadata.sha256, METADATA);
    const metadata = await readFile(path.join(backupRoot, 'backup/metadata.sql')); assert.equal(sha(metadata), METADATA);
    const sourceMap = new Map(); for (const entry of verified.manifest.sources) sourceMap.set(entry.path, await readFile(path.join(backupRoot, 'backup', entry.file)));
    const { fullCatalogue33Sql } = await import(pathToFileURL(path.join(sourceRoot, 'development/m07/recovery33/compiler.mjs')).href), { dataSql36 } = await import(pathToFileURL(path.join(sourceRoot, 'development/m07/recovery36/runtime.mjs')).href);
    const { roleBootstrapSql, normalizeCatalogue } = await import(pathToFileURL(path.join(sourceRoot, 'development/m07/independent-recovery38/guards.mjs')).href);
    catalogueSql = fullCatalogue33Sql(sourceMap).sql; dataSql = dataSql36(); before = await original(); assert.equal(before.length, 3);
    const migration = await readFile(path.join(sourceRoot, MIGRATION)), functional = functionalChange(migration.toString('utf8'));
    report.metadata_sha256 = METADATA; report.migration_sha256 = sha(migration); report.functional_sha256 = sha(functional); report.original_baseline_sha256 = sha(JSON.stringify(before));
    report.source_seals = {}; for (const [root, file] of [[ROOT, 'development/m07/project-creation39-proof/concurrency.mjs'], [ROOT, 'development/m07/project-creation39-proof/run.mjs'], [sourceRoot, 'development/m07/independent-recovery38/guards.mjs']]) {
      const bytes = await readFile(path.join(root, file)); report.source_seals[file] = sha(bytes); const destination = path.join(privateRoot, 'executed-sources', file); await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, bytes, { flag: 'wx' });
    }
    await writeFile(path.join(privateRoot, 'migration39.sql'), migration, { flag: 'wx' });
    const expectedCatalogue = JSON.parse(await readFile(path.join(backupRoot, 'restore38-before-profile.json'))), sourceReceipt = JSON.parse(await readFile(path.join(sourceRoot, 'tracking/evidence/m07/recovery38/2026-11-01T20-19-31-495Z-639da33a.json')));
    const roleState = globalThis.structuredClone(sourceReceipt.existing_global_roles_before), extras = ['eps_mcp_issuer_owner', 'eps_oauth_consent_owner', 'eps_job_trace_owner'];
    for (const [index, name] of extras.entries()) roleState.roles.push({ oid: 'extra' + index, name, login: false, superuser: false, inherit: false, bypassrls: false, create_db: false, create_role: false, replication: false, connection_limit: -1, valid_until: null });
    const oid = name => { const found = roleState.roles.find(r => r.name === name); assert(found); return found.oid; };
    for (const [key, admin] of Object.entries(expectedCatalogue).filter(([key]) => key.startsWith('memberships|') && key.endsWith('|admin'))) {
      const match = /^memberships\|([^>]+)>([^/]+)\/([^|]+)\|admin$/u.exec(key); assert(match); if (!extras.includes(match[1]) && !extras.includes(match[2])) continue;
      const stem = key.slice(0, -5); roleState.memberships.push({ role_oid: oid(match[1]), member_oid: oid(match[2]), grantor_oid: oid(match[3]), admin, inherit: expectedCatalogue[stem + 'inherit'], set: expectedCatalogue[stem + 'set'] });
    }
    report.checkpoint = 'create-independent-owned-cluster';
    const image = JSON.parse((await docker(['image', 'inspect', IMAGE])).stdout)[0]; report.image_id = image.Id;
    const volumeName = base + '-data'; assert.notEqual((await docker(['volume', 'inspect', volumeName], { allowFailure: true })).code, 0);
    const volume = { type: 'volume', name: volumeName, id: (await docker(['volume', 'create', ...labelArgs, volumeName])).stdout.trim(), labels: labelValues }; resources.push(volume); await inspect(volume);
    const password = randomBytes(32).toString('base64url'), envFile = path.join(privateRoot, 'db.env'); await writeFile(envFile, `POSTGRES_PASSWORD=${password}\nPGPASSWORD=${password}\nPOSTGRES_DB=postgres\nPGDATA=/var/lib/postgresql/data\n`, { flag: 'wx' });
    const dbName = base + '-db'; assert.notEqual((await docker(['container', 'inspect', dbName], { allowFailure: true })).code, 0);
    db = { type: 'container', name: dbName, id: (await docker(['container', 'create', '--pull=never', '--name', dbName, ...labelArgs, '--network', 'none', '--env-file', envFile, '--mount', `type=volume,source=${volume.name},target=/var/lib/postgresql/data`, IMAGE])).stdout.trim(), image: image.Id, labels: labelValues };
    resources.push(db); await inspect(db); await docker(['container', 'start', db.id]);
    let ready = false; for (let i = 0; i < 90; i++) { const current = await inspect(db), probe = await docker(['exec', db.id, 'pg_isready', '-h', '127.0.0.1', '-U', 'supabase_admin'], { allowFailure: true }); if (probe.code === 0 && current.State.Health?.Status === 'healthy') { ready = true; break; } await delay(500); } assert(ready, 'PROJECT39_INDEPENDENT_STARTUP_TIMEOUT');
    await sql(roleBootstrapSql(roleState) + 'create database project39 owner postgres template template0;', 'postgres');
    const identity = await value("select jsonb_build_object('system_identifier',(pg_control_system()).system_identifier::text,'database',current_database());"); assert.notEqual(identity.system_identifier, target.observed.system_identifier); report.independent_cluster = identity;
    report.checkpoint = 'restore38-and-apply39'; await sql(metadata.toString('utf8'));
    const restoredRows = rows((await sql('begin read only;' + dataSql + 'rollback;')).stdout)[0]; assert.deepEqual(restoredRows, JSON.parse(await readFile(path.join(backupRoot, 'source38-populated-row-hashes.json')))); report.restored38_all_table_hashes_exact = true;
    assert.deepEqual(normalizeCatalogue(await value('begin read only;' + catalogueSql + 'rollback;')), normalizeCatalogue(expectedCatalogue)); report.restored38_catalogue_exact = true;
    const snapshot = `create schema project39_proof;create table project39_proof.original_rows(table_name text,row_hash text);do $snapshot$declare r record;begin for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'and n.nspname in('eps','public','auth','storage','supabase_migrations')loop execute format('insert into project39_proof.original_rows select %L,encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'')from %I.%I t',r.nspname||'.'||r.relname,r.nspname,r.relname);end loop;end$snapshot$;`;
    await sql('begin;set local row_security=on;set local role postgres;' + functional + 'reset role;' + snapshot + `insert into auth.users(id,is_anonymous)values('${ACTOR}',false);insert into public.app_capability_grants(principal_id,capability)select '${ACTOR}'::uuid,cap from unnest(array['projects.read','projects.write'])cap;commit;`);
    const after39 = await value('begin read only;' + catalogueSql + 'rollback;');
    const normalizedBefore = normalizeCatalogue(expectedCatalogue), normalizedAfter = normalizeCatalogue(after39), delta = {};
    for (const key of new Set([...Object.keys(normalizedBefore), ...Object.keys(normalizedAfter)])) {
      if (JSON.stringify(normalizedBefore[key]) !== JSON.stringify(normalizedAfter[key])) delta[key] = { before: normalizedBefore[key] ?? null, after: normalizedAfter[key] ?? null, added: !Object.hasOwn(normalizedBefore, key), removed: !Object.hasOwn(normalizedAfter, key) };
    }
    await writeFile(path.join(privateRoot, 'catalogue39.json'), JSON.stringify(after39), { flag: 'wx' });
    report.catalogue39_delta = delta; report.catalogue39_delta_sha256 = sha(JSON.stringify(delta));
    report.checkpoint = 'same-key-independent-session-race';
    const sameKey = 'project39-race-same-' + runId, a = await held('same-a', sameKey, 'Synthetic concurrent same key'), aResult = await a.result(), b = await held('same-b', sameKey, 'Synthetic concurrent same key');
    let observed; for (let i = 0; i < 100; i++) { const state = await value(`select jsonb_build_object('pid',pid,'wait_type',wait_event_type,'wait_event',wait_event,'blockers',pg_blocking_pids(pid))from pg_stat_activity where application_name=${quote('c39-' + runId.slice(0, 8) + '-same-b')};`).catch(() => null); if (state?.wait_type === 'Lock' && state.wait_event === 'advisory' && state.blockers.includes(aResult.pid)) { observed = state; break; } await delay(100); } assert(observed, 'PROJECT39_ACTUAL_ADVISORY_WAIT_REQUIRED');
    a.close(); await a.done; const bResult = await b.result(); b.close(); await b.done;
    assert.notEqual(aResult.pid, bResult.pid); assert.deepEqual(aResult.created, bResult.created); report.same_key = { distinct_backend_pids: [aResult.pid, bResult.pid], advisory_blocking_observed: true, waiter: observed, identical_saved_receipt: true, project_id: aResult.created.id };
    report.checkpoint = 'different-key-independent-session-race';
    const c = await held('different-c', 'project39-race-c-' + runId, 'Synthetic independent key C'), d = await held('different-d', 'project39-race-d-' + runId, 'Synthetic independent key D');
    const [cResult, dResult] = await Promise.all([c.result(), d.result()]); assert.notEqual(cResult.pid, dResult.pid); assert.notEqual(cResult.created.id, dResult.created.id);
    const locks = await value(`select jsonb_build_object('holders',count(distinct pid))from pg_locks where locktype='advisory'and granted and pid in(${cResult.pid},${dResult.pid});`); assert.equal(locks.holders, 2);
    c.close(); d.close(); await Promise.all([c.done, d.done]); report.different_keys = { distinct_backend_pids: [cResult.pid, dResult.pid], both_results_before_either_commit: true, two_advisory_holders_observed: true, distinct_project_ids: [cResult.created.id, dResult.created.id] };
    report.checkpoint = 'conflict-count-and-preservation-readbacks';
    const conflict = await value(claim('changed-body') + `do $conflict$begin begin perform public.eps_create_project('{"name":"Changed body","presentation_type":"casting"}',${quote(sameKey)});exception when others then if sqlerrm='IDEMPOTENCY_KEY_REUSED'then perform set_config('eps.c39.conflict','true',true);return;end if;raise;end;raise exception'PROJECT39_CHANGED_BODY_NOT_DENIED';end$conflict$;select jsonb_build_object('changed_body_denied',current_setting('eps.c39.conflict')='true');rollback;`); assert.equal(conflict.changed_body_denied, true); report.changed_body_same_key_denied = true;
    const ids = [aResult.created.id, cResult.created.id, dResult.created.id];
    const counts = await value(`select jsonb_build_object('projects',(select count(*)from public.projects where id in(${ids.map(quote).join(',')})),'memberships',(select count(*)from public.project_memberships where project_id in(${ids.map(quote).join(',')})and principal_id='${ACTOR}'),'intents',(select count(*)from eps.project_creation_intents where project_id in(${ids.map(quote).join(',')})),'audit',(select count(*)from eps.audit_events where resource_id in(${ids.map(quote).join(',')})and action='create_project'),'receipts',(select count(*)from eps.idempotency_records where principal_id='${ACTOR}'and operation='create_project'));`);
    assert.deepEqual(counts, { projects: 3, memberships: 3, intents: 3, audit: 3, receipts: 3 }); report.exact_committed_counts = counts;
    await sql(`do $preserve$declare r record;missing bigint;begin for r in select distinct table_name from project39_proof.original_rows loop execute format('select count(*)from(select row_hash from project39_proof.original_rows where table_name=%L except select encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'')from %s t)s',r.table_name,r.table_name)into missing;if missing<>0 then raise exception'PROJECT39_PRIOR_ROW_CHANGED';end if;end loop;end$preserve$;`); report.all_preexisting_rows_preserved = true;
    assert.equal(sha(await readFile(path.join(sourceRoot, MIGRATION))), sha(migration)); report.result = 'passed'; report.checkpoint = 'complete';
  } catch (error) {
    report.failure_code = error instanceof assert.AssertionError ? 'PROJECT39_RACE_ASSERTION_FAILED' : 'PROJECT39_RACE_COMMAND_FAILED';
    if (privateReady) await writeFile(path.join(privateRoot, 'failure.json'), JSON.stringify({ message: error.message, diagnostic: error.diagnostic ?? null }), { flag: 'wx' });
  } finally {
    try {
      for (const session of sessions) session.rollback(); await Promise.race([Promise.allSettled(sessions.map(s => s.done)), delay(10000)]);
      for (const resource of [...resources].reverse()) { await inspect(resource); await docker([resource.type, 'rm', ...(resource.type === 'container' ? ['-f'] : []), resource.id]); assert.notEqual((await docker([resource.type, 'inspect', resource.id], { allowFailure: true })).code, 0); } report.all_owned_resources_absent = resources.length === 2;
      if (before) { assert.deepEqual(await original(), before); report.original_data_catalogue_and_global_roles_unchanged = true; }
      if (lock) { assert.deepEqual(JSON.parse(await readFile(lockPath)), lock); await unlink(lockPath); report.shared_lock_released = true; }
    } catch { report.result = 'failed'; report.cleanup_unconfirmed = true; }
    report.finished_at = new Date().toISOString(); report.elapsed_ms = Date.now() - started;
    const directory = path.join(ROOT, 'tracking/evidence/m07/project-creation39-race'); await mkdir(directory, { recursive: true }); const file = path.join(directory, report.observed_at.replaceAll(':', '-') + '-' + runId.slice(0, 8) + '.json'); await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    outcome = { result: report.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), cleanup_verified: report.all_owned_resources_absent === true && report.original_data_catalogue_and_global_roles_unchanged === true && report.shared_lock_released === true };
  }
  return outcome;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3) throw Error('Supply the owned original workspace root.');
  runRace(process.argv[2]).then(result => { process.stdout.write(JSON.stringify(result) + '\n'); if (result.result !== 'passed') process.exitCode = 1; }).catch(() => { process.stderr.write('Project39 independent race unconfirmed; diagnostics suppressed.\n'); process.exitCode = 1; });
}
