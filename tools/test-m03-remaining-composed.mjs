/** Exact composed18 on the owned local17 instance; all DDL and synthetic tests roll back. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { runOwnedLocalSql, verifyLocalTarget } from './local-postgres.mjs';
import { composeRemainingMigration, REMAINING_FRAGMENTS, REMAINING_MIGRATION, sha256 } from './prepare-m03-remaining-migration.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SYSTEM = '7701520506262638626';
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const QUERY = 'tools/sql/m03-remaining-readback.sql';
const MANIFEST = 'development/local-db/reviewed.json';
const FIXTURES = ['tests/db/m03-support-uploads.sql', 'tests/db/m03-candidate-filters.sql', 'tests/db/m03-frame-fixture.sql', 'tests/db/m03-frame-kernel.sql', 'tests/db/m03-frame-user-jobs.sql'];
const MARKERS = [
  'M03_SUPPORT_VERIFY_ASSOCIATE_ARCHIVE_CANCEL_REPLAY_RLS_PASSED',
  'M03_FILTER_SOURCE_CURRENT_EDIT_AND_AUTHORIZATION_PASSED',
  'M03_FRAME_NARROW_PORT_APPEND_PARTIAL_PRIVATE_DUPLICATE_AND_PIN_PASSED',
  'M03_FRAME_EXPIRED_RECOVERY_CANCELLATION_MANUAL_FENCE_AND_GUEST_PASSED',
  'M03_FRAME_REQUESTER_USER_JOBS_RETRY_CANCEL_AND_LEGACY_PASSED',
];
const runId = randomUUID();
const application = `eps-m03-remaining-${runId}`;
const SNAPSHOT_BEGIN = 'M03_REMAINING_EXPECTED18_SNAPSHOT_BEGIN';
const SNAPSHOT_END = 'M03_REMAINING_EXPECTED18_SNAPSHOT_END';
let container;

async function target() {
  const actual = await verifyLocalTarget();
  assert.equal(actual.observed.system_identifier, SYSTEM);
  assert.equal(actual.config.container, 'eps-presentation-canonical-pg17-local');
  if (container) assert.equal(actual.container.Id, container); else container = actual.container.Id;
}

function jsonRows(output) { return output.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line)); }

export function expectedSnapshotFromOutput(output) {
  const lines = output.split(/\r?\n/u);
  assert.equal(lines.filter(line => line === SNAPSHOT_BEGIN).length, 1, 'EXACT_EXPECTED_SNAPSHOT_BEGIN_REQUIRED');
  assert.equal(lines.filter(line => line === SNAPSHOT_END).length, 1, 'EXACT_EXPECTED_SNAPSHOT_END_REQUIRED');
  const begin = lines.indexOf(SNAPSHOT_BEGIN); const end = lines.indexOf(SNAPSHOT_END);
  assert(end > begin, 'EXPECTED_SNAPSHOT_ORDER_REQUIRED');
  const rows = jsonRows(lines.slice(begin + 1, end).join('\n'));
  assert.equal(rows.length, 1, 'EXACT_EXPECTED_SNAPSHOT_ROW_REQUIRED');
  return rows[0];
}

async function snapshot(query) {
  await target();
  const result = await runOwnedLocalSql(query);
  const rows = jsonRows(result.stdout);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].query_role, 'postgres');
  assert.equal(rows[0].unrestricted_visibility, true);
  assert.equal(rows[0].versions.length, 17);
  return rows[0];
}

function embeddedReadback(query) {
  const open = 'begin isolation level repeatable read read only;';
  assert.equal(query.split(open).length, 2, 'EXACT_READ_ONLY_QUERY_WRAPPER_REQUIRED');
  assert(/\nrollback;\s*$/u.test(query));
  return query.replace(open, '-- Existing proof transaction supplies isolation; no nested transaction.').replace(/\nrollback;\s*$/u, '\n');
}

async function execute(sql) {
  await target();
  assert(Buffer.byteLength(sql, 'utf8') < 768 * 1024);
  const endpoint = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
  return await new Promise((resolve, reject) => {
    const child = spawn('docker', ['--host', endpoint, 'exec', '--user', 'postgres', '-i', container, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '/var/run/postgresql', '-U', 'supabase_admin', '-d', 'postgres'],
      { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let stopped = false;
    const timer = setTimeout(() => { stopped = true; child.kill(); }, 90_000);
    child.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); if (Buffer.byteLength(stdout) > 16 * 1024 * 1024) { stopped = true; child.kill(); } });
    child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); if (Buffer.byteLength(stderr) > 64 * 1024) { stopped = true; child.kill(); } });
    child.once('error', () => { clearTimeout(timer); reject(new Error('OWNED_LOCAL18_TRANSPORT_UNCONFIRMED')); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code !== 0 || stopped) {
        const error = new Error(stopped ? 'OWNED_LOCAL18_BOUND_EXCEEDED' : 'OWNED_LOCAL18_SQL_UNCONFIRMED');
        error.localDiagnostic = { stdout, stderr }; reject(error);
      } else resolve({ stdout, stderr });
    });
    child.stdin.on('error', () => undefined); child.stdin.end(sql);
  });
}

async function main() {
  assert.equal(process.argv.length, 2);
  const files = [MANIFEST, REMAINING_MIGRATION, QUERY, ...REMAINING_FRAGMENTS.map(([file]) => file), ...FIXTURES];
  const sources = new Map(await Promise.all(files.map(async file => [file, await readFile(path.join(ROOT, file), 'utf8')])));
  const seals = Object.fromEntries([...sources].map(([file, value]) => [file, sha256(value)]));
  const manifest = JSON.parse(sources.get(MANIFEST));
  const versions = manifest.migrations.map(row => path.basename(row.path).slice(0, 14));
  assert.equal(manifest.migrations.length, 17);
  for (const row of manifest.migrations) assert.equal(sha256(await readFile(path.join(ROOT, row.path))), row.sha256);
  assert.equal(sources.get(REMAINING_MIGRATION), composeRemainingMigration(versions, new Map(REMAINING_FRAGMENTS.map(([file]) => [file, sources.get(file)]))));
  const report = { run_id: runId, started_at: new Date().toISOString(), result: 'failed', cloud_called: false, provider_called: false,
    hosted_credential_files_read: false, migration: REMAINING_MIGRATION, migration_sha256: seals[REMAINING_MIGRATION],
    scope: 'Exact composed18 on owned local17; expected18 catalogue before fixtures, then isolated support/filter/frame-kernel/requester-job synthetic savepoints and complete rollback. No hosted Storage, byte/native, provider or app acceptance.',
    source_seals: seals, harness_sha256: sha256(await readFile(import.meta.filename)), markers: MARKERS };
  let ownsLock = false; let before; let settled = false;
  try {
    const lock = await open(LOCK, 'wx', 0o600);
    try { await lock.writeFile(JSON.stringify({ run_id: runId, pid: process.pid })); ownsLock = true; } finally { await lock.close(); }
    before = await snapshot(sources.get(QUERY)); report.before = before; report.before_sha256 = sha256(JSON.stringify(before));
    assert.deepEqual(before.versions, versions);
    const fixturePrefix = `set local role supabase_auth_admin;alter table auth.users enable row level security;reset role;set local role postgres;\nset local eps.local_fixture_tests='eps-presentation-canonical-pg17-local';set local eps.m03_candidate_rehearsal='rollback-only-v1';set local eps.specs_assets_rehearsal='rollback-only-v1';\n`;
    const branch = (name, bodies) => `savepoint ${name};\n${fixturePrefix}${bodies.map(file => sources.get(file)).join('\n')}\nrollback to savepoint ${name};\nrelease savepoint ${name};\n`;
    const sql = `begin isolation level repeatable read;
set local application_name='${application}';set local lock_timeout='3s';set local statement_timeout='30s';
do $identity$begin
 if current_user<>'supabase_admin' or current_database()<>'postgres' or inet_client_addr() is not null
 or (select system_identifier::text from pg_control_system())<>'${SYSTEM}'
 then raise exception 'EXACT_OWNED_LOCAL_UNIX_SOCKET_REQUIRED';end if;
end $identity$;
set local role postgres;
${sources.get(REMAINING_MIGRATION)}
insert into supabase_migrations.schema_migrations(version,statements,name)values('20261029133455',array[]::text[],'m03_remaining_media_library');
select '${SNAPSHOT_BEGIN}';
${embeddedReadback(sources.get(QUERY))}
select '${SNAPSHOT_END}';
${branch('support_fixture', [FIXTURES[0]])}
${branch('filter_fixture', [FIXTURES[1]])}
${branch('stage_fixture', [FIXTURES[2], FIXTURES[3]])}
${branch('user_fixture', [FIXTURES[2], FIXTURES[4]])}
rollback;`;
    const result = await execute(sql);
    for (const marker of MARKERS) assert.equal(result.stdout.split(/\r?\n/u).filter(line => line === marker).length, 1, marker);
    report.expected = expectedSnapshotFromOutput(result.stdout);
    assert.deepEqual(report.expected.versions, [...versions, '20261029133455']);
    assert.equal(report.expected.query_role, 'postgres'); assert.equal(report.expected.unrestricted_visibility, true);
    report.expected_sha256 = sha256(JSON.stringify(report.expected));
    report.assertions_passed = true; report.transaction_completed_to_rollback = true;
    report.stdout_sha256 = sha256(result.stdout); report.stderr_sha256 = sha256(result.stderr);
  } catch (error) {
    report.diagnostic = error.localDiagnostic ? error.message : String(error.message).replace(/[A-Za-z0-9_-]{43,}/gu, '[LONG_VALUE_REDACTED]').slice(0, 500);
    if (error.localDiagnostic) {
      const directory = path.join(ROOT, '.local/m03-remaining-proof'); await mkdir(directory, { recursive: true });
      const localFile = path.join(directory, `${runId}.diagnostic.json`);
      await writeFile(localFile, JSON.stringify(error.localDiagnostic), { flag: 'wx', mode: 0o600 });
      report.private_diagnostic = path.relative(ROOT, localFile).replaceAll('\\', '/');
      report.stdout_sha256 = sha256(error.localDiagnostic.stdout); report.stderr_sha256 = sha256(error.localDiagnostic.stderr);
    }
  } finally {
    if (ownsLock) {
      try {
        const active = await runOwnedLocalSql(`begin read only;select jsonb_build_object('remaining',count(*))from pg_stat_activity where application_name='${application}';rollback;`);
        settled = jsonRows(active.stdout)[0].remaining === 0;
      } catch { /* Retain lock unless this specific backend is known settled. */ }
    }
    report.owned_backend_settled = settled;
    if (before && settled) {
      try {
        const after = await snapshot(sources.get(QUERY)); report.after = after; report.after_sha256 = sha256(JSON.stringify(after));
        report.rollback_verified = isDeepStrictEqual(before, after);
        report.sources_stable = (await Promise.all(Object.entries(seals).map(async ([file, hash]) => sha256(await readFile(path.join(ROOT, file))) === hash))).every(Boolean);
        if (report.assertions_passed && report.rollback_verified && report.sources_stable) report.result = 'passed';
      } catch { report.rollback_verified = false; }
    }
    if (ownsLock && settled && report.rollback_verified) {
      const lock = JSON.parse(await readFile(LOCK, 'utf8')); assert.equal(lock.run_id, runId); assert.equal(lock.pid, process.pid); await unlink(LOCK);
    }
    report.finished_at = new Date().toISOString();
    const directory = path.join(ROOT, 'tracking/evidence/m03/remaining-composed-local'); await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${report.finished_at.replace(/[:.]/gu, '-')}-${runId.slice(0, 8)}.json`);
    await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ result: report.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), rollback_verified: report.rollback_verified, sources_stable: report.sources_stable, diagnostic: report.diagnostic }) + '\n');
    if (report.result !== 'passed') process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => { process.stderr.write('Composed18 local proof stopped; no cloud fallback or promotion.\n'); process.exitCode = 1; });
}
