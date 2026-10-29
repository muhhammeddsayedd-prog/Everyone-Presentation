/** Additive19 RED/GREEN on owned local18; all fixtures, DDL and simulated history roll back. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { isDeepStrictEqual } from 'node:util';
import { runOwnedLocalSql, verifyLocalTarget } from './local-postgres.mjs';
import { sha256 } from './prepare-m03-remaining-migration.mjs';
import { expectedSnapshotFromOutput } from './test-m03-remaining-composed.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const MIGRATION = 'supabase/migrations/20261029135318_m03_frame_request_resubmission.sql';
const FRAGMENT = 'development/m03/frame-request-resubmission.sql';
const SEAL = 'e816ad6b491626ace489efd256b56c322d25d9101de94e5fb8b24d2d4b745048';
const QUERY = 'tools/sql/m03-remaining-readback.sql';
const QUERY_SEAL = 'c8e74d2bd7399682c984ad79b8f1732fd074056bf6ac065c19407948bfcc7b72';
const FIXTURE = 'tests/db/m03-frame-fixture.sql';
const RED = 'tests/db/m03-frame-resubmission-red.sql';
const GREEN = 'tests/db/m03-frame-resubmission.sql';
const BASELINE = 'tracking/evidence/m03/remaining-promotion/2026-10-29T13-49-25-671Z-06ab16d1.json';
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const FUNCTION = 'public.eps_extract_candidate_frames(uuid, jsonb, text)';
const OLD_FUNCTION_SHA = 'eb387571390cf53240d819be16b408efa111d9461a81e881c83ea73c2dbcced3';
const MARKERS = ['M03_FRAME_TERMINAL_RESUBMISSION_RED_REPRODUCED', 'M03_FRAME_TERMINAL_NEW_INTENT_ACTIVE_COALESCING_AND_EXACT_REPLAY_PASSED', 'M03_FRAME_RESUBMISSION_REQUESTER_SCOPE_REVOKED_ACCESS_AND_KEY_CONFLICT_PASSED'];
const runId = randomUUID(); const application = `eps-frame-resubmit-${runId}`; let container;
async function target() {
  const actual = await verifyLocalTarget(); assert.equal(actual.observed.system_identifier, '7701520506262638626');
  assert.equal(actual.config.container, 'eps-presentation-canonical-pg17-local');
  if (container) assert.equal(actual.container.Id, container); else container = actual.container.Id;
}
const rows = output => output.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
async function snapshot(query) { await target(); const result = await runOwnedLocalSql(query); const values = rows(result.stdout); assert.equal(values.length, 1); assert.equal(values[0].query_role, 'postgres'); assert.equal(values[0].unrestricted_visibility, true); return values[0]; }
async function authSnapshot() { const result = await runOwnedLocalSql(`begin read only;select jsonb_build_object('owner',pg_get_userbyid(relowner),'rls',relrowsecurity,'forced_rls',relforcerowsecurity,'acl',relacl::text)from pg_class where oid='auth.users'::regclass;rollback;`); return rows(result.stdout)[0]; }
async function execute(sql) {
  await target(); assert(Buffer.byteLength(sql) < 256 * 1024);
  const endpoint = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
  return await new Promise((resolve, reject) => {
    const child = spawn('docker', ['--host', endpoint, 'exec', '--user', 'postgres', '-i', container, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '/var/run/postgresql', '-U', 'supabase_admin', '-d', 'postgres'], { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let stopped = false;
    const timer = setTimeout(() => { stopped = true; child.kill(); }, 60_000);
    child.stdout.on('data', chunk => { stdout += chunk.toString(); if (Buffer.byteLength(stdout) > 16 * 1024 * 1024) { stopped = true; child.kill(); } });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); if (Buffer.byteLength(stderr) > 64 * 1024) { stopped = true; child.kill(); } });
    child.once('error', () => { clearTimeout(timer); reject(new Error('LOCAL19_TRANSPORT_UNCONFIRMED')); });
    child.once('close', code => { clearTimeout(timer); if (code !== 0 || stopped) { const error = new Error(stopped ? 'LOCAL19_BOUND_EXCEEDED' : 'LOCAL19_SQL_UNCONFIRMED'); error.localDiagnostic = { stdout, stderr }; reject(error); } else resolve({ stdout, stderr }); });
    child.stdin.on('error', () => undefined); child.stdin.end(sql);
  });
}
async function main() {
  assert.equal(process.argv.length, 2);
  const sources = new Map(await Promise.all([MIGRATION, FRAGMENT, QUERY, FIXTURE, RED, GREEN, BASELINE, 'development/local-db/reviewed.json'].map(async file => [file, await readFile(path.join(ROOT, file), 'utf8')])));
  const seals = Object.fromEntries([...sources].map(([file, value]) => [file, sha256(value)]));
  assert.equal(seals[MIGRATION], SEAL); assert.equal(sources.get(MIGRATION), sources.get(FRAGMENT)); assert.equal(seals[QUERY], QUERY_SEAL);
  const promotion = JSON.parse(sources.get(BASELINE)); assert.equal(promotion.result, 'passed');
  const manifest = JSON.parse(sources.get('development/local-db/reviewed.json')); assert.equal(manifest.migrations.length, 18);
  const report = { run_id: runId, started_at: new Date().toISOString(), result: 'failed', cloud_called: false, provider_called: false, hosted_credential_files_read: false,
    migration: MIGRATION, migration_sha256: SEAL, scope: 'Owned local18 RED terminal-dedupe reproduction and additive19 GREEN synthetic public admission/idempotency/actor proof; complete rollback. No native/provider/app acceptance.',
    source_seals: seals, harness_sha256: sha256(await readFile(import.meta.filename)), markers: MARKERS };
  let ownsLock = false; let settled = false; let before; let authBefore;
  try {
    const lock = await open(LOCK, 'wx', 0o600); try { await lock.writeFile(JSON.stringify({ run_id: runId, pid: process.pid })); ownsLock = true; } finally { await lock.close(); }
    before = await snapshot(sources.get(QUERY)); report.before = before; assert.deepEqual(before, promotion.after); assert.equal(before.versions.length, 18);
    authBefore = await authSnapshot(); report.managed_auth_before = authBefore;
    const query = sources.get(QUERY); assert.equal(query.split('begin isolation level repeatable read read only;').length, 2); assert(/\nrollback;\s*$/u.test(query));
    const embedded = query.replace('begin isolation level repeatable read read only;', '-- Parent rollback supplies transaction.').replace(/\nrollback;\s*$/u, '\n');
    const prefix = `set local role supabase_auth_admin;alter table auth.users enable row level security;reset role;set local role postgres;\n`;
    const result = await execute(`begin isolation level repeatable read;set local application_name='${application}';set local lock_timeout='3s';set local statement_timeout='30s';
do $identity$begin if current_user<>'supabase_admin'or current_database()<>'postgres'or inet_client_addr()is not null or(select system_identifier::text from pg_control_system())<>'7701520506262638626'then raise exception'EXACT_OWNED_LOCAL_UNIX_SOCKET_REQUIRED';end if;end $identity$;
set local role postgres;
savepoint red;${prefix}${sources.get(FIXTURE)}\n${sources.get(RED)}\nrollback to savepoint red;release savepoint red;
${sources.get(MIGRATION)}
insert into supabase_migrations.schema_migrations(version,statements,name)values('20261029135318',array[]::text[],'m03_frame_request_resubmission');
select 'M03_REMAINING_EXPECTED18_SNAPSHOT_BEGIN';${embedded}\nselect 'M03_REMAINING_EXPECTED18_SNAPSHOT_END';
savepoint green;${prefix}${sources.get(FIXTURE)}\n${sources.get(GREEN)}\nrollback to savepoint green;release savepoint green;
rollback;`);
    for (const marker of MARKERS) assert.equal(result.stdout.split(/\r?\n/u).filter(line => line === marker).length, 1, marker);
    report.expected = expectedSnapshotFromOutput(result.stdout);
    assert.deepEqual(report.expected.versions, [...before.versions, '20261029135318']);
    for (const [key, value] of Object.entries(before)) if (!['catalog', 'versions'].includes(key)) assert.deepEqual(report.expected[key], value, `UNREVIEWED19_STATE_CHANGE:${key}`);
    const masked = globalThis.structuredClone(report.expected.catalog);
    const oldFunction = before.catalog.functions.find(row => row.signature === FUNCTION); const newFunction = masked.functions.find(row => row.signature === FUNCTION);
    assert.equal(oldFunction.source_sha256, OLD_FUNCTION_SHA); assert.notEqual(newFunction.source_sha256, OLD_FUNCTION_SHA);
    report.changed_function = { signature: FUNCTION, before_sha256: OLD_FUNCTION_SHA, after_sha256: newFunction.source_sha256 };
    newFunction.source_sha256 = oldFunction.source_sha256; assert.deepEqual(masked, before.catalog);
    report.only_reviewed_function_body_changed = true; report.red_reproduced = true; report.assertions_passed = true; report.transaction_completed_to_rollback = true;
    report.stdout_sha256 = sha256(result.stdout); report.stderr_sha256 = sha256(result.stderr);
  } catch (error) {
    report.diagnostic = error.localDiagnostic ? error.message : String(error.message).replace(/[A-Za-z0-9_-]{43,}/gu, '[LONG_VALUE_REDACTED]').slice(0, 1500);
    if (error.localDiagnostic) { const directory = path.join(ROOT, '.local/m03-frame-resubmission'); await mkdir(directory, { recursive: true }); const file = path.join(directory, `${runId}.json`); await writeFile(file, JSON.stringify(error.localDiagnostic), { flag: 'wx', mode: 0o600 }); report.private_diagnostic = path.relative(ROOT, file).replaceAll('\\', '/'); }
  } finally {
    if (ownsLock) { try { const active = await runOwnedLocalSql(`begin read only;select jsonb_build_object('remaining',count(*))from pg_stat_activity where application_name='${application}';rollback;`); settled = rows(active.stdout)[0].remaining === 0; } catch { /* Unknown backend keeps lock. */ } }
    report.owned_backend_settled = settled;
    if (before && settled) { try { report.after = await snapshot(sources.get(QUERY)); report.managed_auth_after = await authSnapshot(); report.rollback_verified = isDeepStrictEqual(before, report.after) && isDeepStrictEqual(authBefore, report.managed_auth_after); report.sources_stable = (await Promise.all(Object.entries(seals).map(async ([file, hash]) => sha256(await readFile(path.join(ROOT, file))) === hash))).every(Boolean); if (report.assertions_passed && report.rollback_verified && report.sources_stable) report.result = 'passed'; } catch { report.rollback_verified = false; } }
    if (ownsLock && settled && report.rollback_verified) { const lock = JSON.parse(await readFile(LOCK, 'utf8')); assert.equal(lock.run_id, runId); assert.equal(lock.pid, process.pid); await unlink(LOCK); }
    report.finished_at = new Date().toISOString(); const directory = path.join(ROOT, 'tracking/evidence/m03/frame-resubmission-local'); await mkdir(directory, { recursive: true }); const file = path.join(directory, `${report.finished_at.replace(/[:.]/gu, '-')}-${runId.slice(0, 8)}.json`); await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ result: report.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), rollback_verified: report.rollback_verified, sources_stable: report.sources_stable, diagnostic: report.diagnostic }) + '\n'); if (report.result !== 'passed') process.exitCode = 1;
  }
}
main().catch(() => { process.stderr.write('Local18-to19 rollback proof stopped; no promotion or cloud fallback.\n'); process.exitCode = 1; });
