/** Fixed local17 rollback-only role-filter proof. No cloud, providers or credentials from hosted services. */
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

const ROOT = path.resolve(import.meta.dirname, '..');
const FILES = ['development/m03/remaining-filters.sql', 'tests/db/m03-candidate-filters.sql'];
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const SYSTEM = '7701520506262638626';
const digest = value => createHash('sha256').update(value).digest('hex');
const runId = randomUUID();
let container;
async function target() {
  const actual = await verifyLocalTarget();
  assert.equal(actual.observed.system_identifier, SYSTEM);
  assert.equal(actual.config.container, 'eps-presentation-canonical-pg17-local');
  if (container) assert.equal(actual.container.Id, container); else container = actual.container.Id;
}
async function snapshot() {
  await target();
  const result = await runOwnedLocalSql(await readFile(path.join(ROOT, 'tools/sql/specs-read-operation-readback.sql'), 'utf8'));
  const values = result.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert.equal(values.length, 1); assert.equal(values[0].versions.length, 17);
  return values[0];
}
async function execute(sql) {
  await target();
  const endpoint = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
  assert(Buffer.byteLength(sql, 'utf8') < 128 * 1024);
  return await new Promise((resolve, reject) => {
    // Matches the existing candidate-kernel harness: isolated managed-Auth fixtures need its local admin route.
    const child = spawn('docker', ['--host', endpoint, 'exec', '--user', 'postgres', '-i', container, 'psql', '-X', '-q', '-A', '-t',
      '-v', 'ON_ERROR_STOP=1', '-h', '/var/run/postgresql', '-U', 'supabase_admin', '-d', 'postgres'],
    { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let stopped = false;
    const timer = setTimeout(() => { stopped = true; child.kill(); }, 45_000);
    child.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); if (stdout.length > 100_000) { stopped = true; child.kill(); } });
    child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); if (stderr.length > 32_768) { stopped = true; child.kill(); } });
    child.once('error', () => { clearTimeout(timer); reject(new Error('FIXED_LOCAL_FILTER_TRANSPORT_UNCONFIRMED')); });
    child.once('close', code => { clearTimeout(timer); if (code !== 0 || stopped) reject(new Error(stderr.slice(0, 6000) || 'FIXED_LOCAL_FILTER_SQL_UNCONFIRMED')); else resolve({ stdout, stderr }); });
    child.stdin.on('error', () => undefined); child.stdin.end(sql);
  });
}
async function main() {
  assert.equal(process.argv.length, 2);
  const fragments = await Promise.all(FILES.map(async file => [file, await readFile(path.join(ROOT, file), 'utf8')]));
  const seals = Object.fromEntries(fragments.map(([file, source]) => [file, digest(source)]));
  const report = { run_id: runId, started_at: new Date().toISOString(), result: 'failed', cloud_called: false, provider_called: false,
    hosted_credential_files_read: false, scope: 'Synthetic roles/current edits and capability/project/archived/guest denials in one rolled-back owned-local transaction. No app/browser/provider acceptance.',
    source_seals: seals, harness_sha256: digest(await readFile(import.meta.filename)) };
  let ownsLock = false; let before;
  try {
    const lock = await open(LOCK, 'wx', 0o600);
    try { await lock.writeFile(JSON.stringify({ run_id: runId, pid: process.pid })); ownsLock = true; } finally { await lock.close(); }
    before = await snapshot(); report.before_sha256 = digest(JSON.stringify(before));
    const sql = `begin;
set local application_name='eps-filter-${runId}';
set local lock_timeout='3s'; set local statement_timeout='30s';
do $identity$ begin
 if current_user<>'supabase_admin' or current_database()<>'postgres' or inet_client_addr() is not null
   or (select system_identifier::text from pg_control_system())<>'${SYSTEM}'
 then raise exception 'EXACT_OWNED_LOCAL_UNIX_SOCKET_REQUIRED'; end if;
end $identity$;
set local role supabase_auth_admin; alter table auth.users enable row level security; reset role; set local role postgres;
do $baseline$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>17
   or to_regprocedure('public.eps_suggest_candidate_filters(uuid)') is not null
 then raise exception 'EXACT_LOCAL17_FILTER_BASELINE_REQUIRED'; end if;
end $baseline$;
${fragments.map(([, source]) => source).join('\n')}
rollback;`;
    const result = await execute(sql);
    assert.equal(result.stdout.split(/\r?\n/u).filter(line => line === 'M03_FILTER_SOURCE_CURRENT_EDIT_AND_AUTHORIZATION_PASSED').length, 1);
    report.assertions_passed = true; report.transaction_completed_to_rollback = true;
    report.stdout_sha256 = digest(result.stdout); report.stderr_sha256 = digest(result.stderr);
  } catch (error) {
    report.diagnostic = String(error?.message ?? 'FILTER_PROOF_UNCONFIRMED').slice(0, 6000);
  } finally {
    if (before) {
      try {
        const after = await snapshot(); report.after_sha256 = digest(JSON.stringify(after)); report.rollback_verified = isDeepStrictEqual(before, after);
        report.sources_stable = true;
        for (const [file, seal] of Object.entries(seals)) if (digest(await readFile(path.join(ROOT, file))) !== seal) report.sources_stable = false;
        if (report.assertions_passed && report.rollback_verified && report.sources_stable) report.result = 'passed';
      } catch { report.rollback_verified = false; }
    }
    if (ownsLock && report.rollback_verified) {
      const lock = JSON.parse(await readFile(LOCK, 'utf8')); assert.equal(lock.run_id, runId); assert.equal(lock.pid, process.pid); await unlink(LOCK);
    }
    report.finished_at = new Date().toISOString();
    const directory = path.join(ROOT, 'tracking/evidence/m03/remaining-filters-local'); await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${report.finished_at.replace(/[:.]/gu, '-')}-${runId.slice(0, 8)}.json`);
    await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ result: report.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), rollback_verified: report.rollback_verified, diagnostic: report.diagnostic }) + '\n');
    if (report.result !== 'passed') process.exitCode = 1;
  }
}
main().catch(() => { process.stderr.write('Fixed local17 filter proof stopped; no cloud fallback.\n'); process.exitCode = 1; });
