/** Exact composed20 rehearsal on owned local19. Every DDL/history/fixture change is rolled back. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { isDeepStrictEqual } from 'node:util';
import { runOwnedLocalSql, verifyLocalTarget } from './local-postgres.mjs';
import { CASTING_BASELINE, CASTING_BASELINE_SHA, CASTING_FRAGMENTS, CASTING_MIGRATION, CASTING_VERSION, composeCastingMigration } from './prepare-m04-casting-migration.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const QUERY = 'tools/sql/m03-remaining-readback.sql';
const FILES = ['development/m04/assignments.sql', 'tests/db/m04-assignments-fixture.sql', 'tests/db/m04-assignments.sql', QUERY, 'development/local-db/reviewed.json', 'development/m04/lifecycle-forward.sql', 'tests/db/m04-lifecycle.sql', 'tests/db/m04-assignment-bounds.sql', CASTING_MIGRATION, CASTING_BASELINE, 'tools/prepare-m04-casting-migration.mjs'];
const MARKERS = ['M04_ASSIGNMENT_INDEPENDENCE_MAIN_UNDO_PAGINATION_AND_REPLAY_PASSED', 'M04_ASSIGNMENT_EXACT_REORDER_AND_CURRENT_OTHER_WRITER_UNDO_PASSED', 'M04_ASSIGNMENT_FORCE_RLS_PRIVATE_INVERSE_COMPOSITE_SCOPE_AND_ONE_MAIN_INDEX_PASSED',
  'M04_SCOPED_ROLE_RESIZE_ARCHIVE_ASSIGNMENTS_HISTORY_AND_REPLAY_PASSED', 'M04_PROJECT_POOL_REMOVAL_RETIRES_ONLY_ITS_ASSIGNMENTS_AND_RETAINS_LIBRARY_PASSED', 'M04_SOURCE_BASELINE_SCOPED_ASSIGNMENT_SERVICE_VISIBILITY_AND_MANUAL_PROTECTION_PASSED', 'M04_EXPLICIT_DUPLICATE_COLLAPSE_SUPPORT_IMMUTABILITY_HIDDEN_SCOPE_AND_REVOKED_REPLAY_PASSED', 'M04_CUMULATIVE_WORDING_LARGE_MAIN_BOUNDED_PRIVATE_BATCHES_AND_122_ROW_REORDER_PASSED'];
const sha = value => createHash('sha256').update(value).digest('hex');
const rows = value => value.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
const run = randomUUID(); const application = `eps-m04-composed-${run}`;
const lockFile = path.join(ROOT, '.local/local-postgres/test-db.lock');
async function snapshot(query) {
  const result = await runOwnedLocalSql(query); const values = rows(result.stdout); assert.equal(values.length, 1);
  assert.equal(values[0].query_role, 'postgres'); assert.equal(values[0].unrestricted_visibility, true); return values[0];
}
async function authSnapshot() {
  return rows((await runOwnedLocalSql("begin read only;select jsonb_build_object('owner',pg_get_userbyid(relowner),'rls',relrowsecurity,'forced_rls',relforcerowsecurity,'acl',relacl::text)from pg_class where oid='auth.users'::regclass;rollback;")).stdout)[0];
}
async function execute(sql, container) {
  assert(Buffer.byteLength(sql) <= 512 * 1024);
  const endpoint = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
  return await new Promise((resolve, reject) => {
    const child = spawn('docker', ['--host', endpoint, 'exec', '--user', 'postgres', '-i', container, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '/var/run/postgresql', '-U', 'supabase_admin', '-d', 'postgres'], { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let stopped = false;
    const timer = setTimeout(() => { stopped = true; child.kill(); }, 60_000);
    child.stdout.on('data', value => { stdout += value.toString(); if (Buffer.byteLength(stdout) > 16 * 1024 * 1024) { stopped = true; child.kill(); } });
    child.stderr.on('data', value => { stderr += value.toString(); if (Buffer.byteLength(stderr) > 64 * 1024) { stopped = true; child.kill(); } });
    child.once('error', () => { clearTimeout(timer); reject(new Error('M04_OWNED_TRANSPORT_UNCONFIRMED')); });
    child.once('close', code => { clearTimeout(timer); if (code !== 0 || stopped) reject(new Error(stderr || 'M04_OWNED_SQL_UNCONFIRMED')); else resolve({ stdout, stderr }); });
    child.stdin.on('error', () => undefined); child.stdin.end(sql);
  });
}
async function main() {
  assert.equal(process.argv.length, 2);
  const includeLifecycle = true;
  const markers = includeLifecycle ? MARKERS : MARKERS.filter(marker => !['M04_SCOPED_ROLE_', 'M04_PROJECT_POOL_', 'M04_SOURCE_BASELINE_', 'M04_EXPLICIT_DUPLICATE_'].some(prefix => marker.startsWith(prefix)));
  const source = new Map(await Promise.all(FILES.map(async file => [file, await readFile(path.join(ROOT, file), 'utf8')])));
  const seals = Object.fromEntries([...source].map(([file, value]) => [file, sha(value)]));
  assert.equal(seals[QUERY], 'c8e74d2bd7399682c984ad79b8f1732fd074056bf6ac065c19407948bfcc7b72');
  assert.equal(JSON.parse(source.get(FILES[4])).migrations.length, 19);
  assert.equal(seals[CASTING_BASELINE], CASTING_BASELINE_SHA); assert.equal(seals[FILES[4]], CASTING_BASELINE_SHA);
  const composed = composeCastingMigration(Buffer.from(source.get(CASTING_BASELINE)), new Map(CASTING_FRAGMENTS.map(([file]) => [file, Buffer.from(source.get(file))])));
  assert(composed.equals(Buffer.from(source.get(CASTING_MIGRATION))), 'COMPOSED_MIGRATION_BYTES_CHANGED');
  const target = await verifyLocalTarget(); assert.equal(target.config.container, 'eps-presentation-canonical-pg17-local'); assert.equal(target.observed.system_identifier, '7701520506262638626');
  const report = { run_id: run, started_at: new Date().toISOString(), result: 'failed', cloud_called: false, provider_called: false, hosted_credential_files_read: false,
    migration: CASTING_MIGRATION, migration_sha256: seals[CASTING_MIGRATION], baseline_manifest_sha256: CASTING_BASELINE_SHA,
    scope: `Exact generated20 assignment/lifecycle migration and temporary history20 with ${includeLifecycle ? 'assignment, lifecycle and boundary' : 'assignment and boundary only; lifecycle behavior excluded'} synthetic public RPC fixtures on exact owned local19, all DDL/history/rows rolled back. Index boundary is single-session; two-session race is separate.`, lifecycle_behavior_tested: includeLifecycle, source_seals: seals, harness_sha256: sha(await readFile(import.meta.filename)), markers };
  let locked = false; let settled = false; let before; let authBefore;
  try {
    const lock = await open(lockFile, 'wx', 0o600); try { await lock.writeFile(JSON.stringify({ run_id: run, pid: process.pid })); locked = true; } finally { await lock.close(); }
    before = await snapshot(source.get(QUERY)); report.before = before; assert.equal(before.versions.length, 19);
    authBefore = await authSnapshot(); report.managed_auth_before = authBefore;
    const embedded = source.get(QUERY).replace('begin isolation level repeatable read read only;', '-- Parent transaction supplies boundary.').replace(/\nrollback;\s*$/u, '\n');
    const sql = `begin;set local application_name='${application}';
do $identity$begin if current_user<>'supabase_admin'or current_database()<>'postgres'or inet_client_addr()is not null or(select system_identifier::text from pg_control_system())<>'7701520506262638626'then raise exception'EXACT_OWNED_LOCAL_UNIX_SOCKET_REQUIRED';end if;end $identity$;
set local role postgres;
${source.get(CASTING_MIGRATION)}
insert into supabase_migrations.schema_migrations(version,statements,name)values('${CASTING_VERSION}',array[]::text[],'m04_casting_assignments_lifecycle');
select 'M04_EXPECTED_SNAPSHOT_BEGIN';${embedded}select 'M04_EXPECTED_SNAPSHOT_END';
savepoint fixtures;set local role supabase_auth_admin;alter table auth.users enable row level security;set local role postgres;
${source.get(FILES[1])}\n${source.get(FILES[2])}
rollback to savepoint fixtures;release savepoint fixtures;
${includeLifecycle ? `savepoint lifecycle;set local role supabase_auth_admin;alter table auth.users enable row level security;set local role postgres;
${source.get(FILES[1])}\n${source.get(FILES[6])}
rollback to savepoint lifecycle;release savepoint lifecycle;` : ''}
savepoint bounds;set local role supabase_auth_admin;alter table auth.users enable row level security;set local role postgres;
${source.get(FILES[1])}\n${source.get(FILES[7])}
rollback to savepoint bounds;release savepoint bounds;rollback;`;
    const fresh = await verifyLocalTarget(); assert.equal(fresh.container.Id, target.container.Id);
    const result = await execute(sql, fresh.container.Id);
    for (const marker of markers) assert.equal(result.stdout.split(/\r?\n/u).filter(line => line === marker).length, 1, marker);
    const selected = result.stdout.split('M04_EXPECTED_SNAPSHOT_BEGIN')[1]?.split('M04_EXPECTED_SNAPSHOT_END')[0];
    const expected = rows(selected ?? ''); assert.equal(expected.length, 1); report.expected = expected[0];
    assert.deepEqual(report.expected.versions, [...before.versions, CASTING_VERSION]);
    for (const field of ['counts', 'data_sha256']) for (const [table, value] of Object.entries(before[field])) assert.deepEqual(report.expected[field][table], value, `PREEXISTING_ROW_CHANGED:${table}`);
    for (const field of Object.keys(before).filter(key => !['catalog', 'counts', 'data_sha256', 'versions'].includes(key))) assert.deepEqual(report.expected[field], before[field], `UNREVIEWED_CONFIG_RUNTIME_OR_STATE_CHANGE:${field}`);
    report.preexisting_rows_configs_and_runtime_preserved_in_draft = true;
    report.assertions_passed = true; report.transaction_completed_to_rollback = true; report.stdout_sha256 = sha(result.stdout); report.stderr_sha256 = sha(result.stderr);
  } catch (error) {
    const directory = path.join(ROOT, '.local/m04-casting-migration'); await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${run}.txt`); await writeFile(file, String(error.stack ?? error), { flag: 'wx', mode: 0o600 });
    report.diagnostic = 'M04_LOCAL_KERNEL_UNCONFIRMED'; report.private_diagnostic = path.relative(ROOT, file).replaceAll('\\', '/');
  } finally {
    if (locked) { try { settled = rows((await runOwnedLocalSql(`begin read only;select jsonb_build_object('count',count(*))from pg_stat_activity where application_name='${application}';rollback;`)).stdout)[0].count === 0; } catch { /* Unknown backend retains lock. */ } }
    report.owned_backend_settled = settled;
    if (before && settled) { try { report.after = await snapshot(source.get(QUERY)); report.managed_auth_after = await authSnapshot(); report.rollback_verified = isDeepStrictEqual(before, report.after) && isDeepStrictEqual(authBefore, report.managed_auth_after); report.sources_stable = (await Promise.all(Object.entries(seals).map(async ([file, seal]) => sha(await readFile(path.join(ROOT, file))) === seal))).every(Boolean); if (report.assertions_passed && report.rollback_verified && report.sources_stable) report.result = 'passed'; } catch { report.rollback_verified = false; } }
    if (locked && settled && report.rollback_verified) { const lock = JSON.parse(await readFile(lockFile, 'utf8')); assert.equal(lock.run_id, run); assert.equal(lock.pid, process.pid); await unlink(lockFile); }
    report.finished_at = new Date().toISOString(); const directory = path.join(ROOT, 'tracking/evidence/m04/migration-local'); await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${report.finished_at.replace(/[:.]/gu, '-')}-${run.slice(0, 8)}.json`); await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ result: report.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), rollback_verified: report.rollback_verified, sources_stable: report.sources_stable, private_diagnostic: report.private_diagnostic }) + '\n'); if (report.result !== 'passed') process.exitCode = 1;
  }
}
main().catch(() => { process.stderr.write('Composed M04 migration rollback proof stopped; no external fallback.\n'); process.exitCode = 1; });
