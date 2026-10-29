/** Exact21 candidate on owned local20; RED/GREEN fixtures and all DDL/history roll back. */
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
const MIGRATION = 'supabase/migrations/20261029180953_m03_frame_vision_selection.sql';
const MIGRATION_SHA = 'bcd12794eccfa590e5d160f62dfd67838c8186376cddda1952f291c50d03bec8';
const VERSION = '20261029180953';
const QUERY = 'tools/sql/m04-casting-readback.sql';
const QUERY_SHA = '13cc727a2e2e34321c6bbee2c98a3b7c85af88445fe1a1effd067d895fe5456f';
const BASELINE = 'tracking/evidence/m04/migration-preparation/reviewed20-manifest.json';
const BASELINE_SHA = 'f8e9c48d19a66b38b81eee6f6a7d10e01d8604a9aed9e60e0de1f0f1dc610f14';
const HANDOFF = 'tracking/evidence/m03/frame-vision/2026-10-29-public-technical-issue.json';
const HANDOFF_SHA = '6a2c15de42ab92530364fa61af07480722f2bfbccc042f7d71dfe6f93a40b650';
const FIXTURE = 'tests/db/m03-frame-vision-contract.sql';
const MARKER = 'FRAME_VISION_SOURCE_PROVIDER_AND_MANUAL_PARTIAL_CONTRACT_PASSED';
const FUNCTIONS = ['eps.candidate_validate_stage(eps.jobs, text, jsonb)', 'eps.get_candidate_stage_input(uuid, uuid, text)', 'eps.apply_candidate_scan(uuid, uuid, text, text, jsonb)'];
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const sha = value => createHash('sha256').update(value).digest('hex');
const rows = value => value.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
async function snapshot(query) {
  const value = rows((await runOwnedLocalSql(query)).stdout); assert.equal(value.length, 1);
  assert.equal(value[0].query_role, 'postgres'); assert.equal(value[0].unrestricted_visibility, true); return value[0];
}
async function execute(sql, container) {
  assert(Buffer.byteLength(sql) <= 512 * 1024);
  const endpoint = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['--host', endpoint, 'exec', '--user', 'postgres', '-i', container, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '/var/run/postgresql', '-U', 'supabase_admin', '-d', 'postgres'], { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let stopped = false;
    const timer = setTimeout(() => { stopped = true; child.kill(); }, 60_000);
    child.stdout.on('data', value => { stdout += value.toString(); if (Buffer.byteLength(stdout) > 16 * 1024 * 1024) { stopped = true; child.kill(); } });
    child.stderr.on('data', value => { stderr += value.toString(); if (Buffer.byteLength(stderr) > 128 * 1024) { stopped = true; child.kill(); } });
    child.once('error', () => { clearTimeout(timer); reject(new Error('FRAME_VISION_OWNED_TRANSPORT_UNCONFIRMED')); });
    child.once('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr, stopped }); });
    child.stdin.on('error', () => undefined); child.stdin.end(sql);
  });
}
async function main() {
  assert.equal(process.argv.length, 2);
  const handoffBytes = await readFile(path.join(ROOT, HANDOFF)); assert.equal(sha(handoffBytes), HANDOFF_SHA); const handoff = JSON.parse(handoffBytes);
  const files = [...new Set([MIGRATION, QUERY, BASELINE, HANDOFF, 'development/local-db/reviewed.json', 'tools/local-postgres.mjs', ...Object.keys(handoff.source_sha256)])];
  const source = new Map(await Promise.all(files.map(async file => [file, await readFile(path.join(ROOT, file))]))); const seals = Object.fromEntries([...source].map(([file, bytes]) => [file, sha(bytes)]));
  for (const [file, digest] of Object.entries(handoff.source_sha256)) assert.equal(seals[file], digest, 'FROZEN_FRAME_SOURCE_CHANGED');
  assert.equal(seals[MIGRATION], MIGRATION_SHA); assert.equal(seals[QUERY], QUERY_SHA); assert.equal(seals[BASELINE], BASELINE_SHA); assert.equal(seals['development/local-db/reviewed.json'], BASELINE_SHA);
  assert.equal(seals['tools/local-postgres.mjs'], '49929bce8eb51194d9299cfd9639e537eb237daaec76c15740cb88059604e2de');
  assert.equal(JSON.parse(source.get(BASELINE)).migrations.length, 20);
  const draft = source.get('development/m03/frame-vision.sql'); const candidate = source.get(MIGRATION);
  assert(candidate.subarray(candidate.length - draft.length).equals(draft), 'MIGRATION_MUST_RETAIN_EXACT_DRAFT_BYTES');
  const report = { run_id: randomUUID(), started_at: new Date().toISOString(), result: 'failed', cloud_called: false, provider_called: false, hosted_credential_files_read: false,
    migration: MIGRATION, migration_sha256: MIGRATION_SHA, baseline_manifest: BASELINE, baseline_manifest_sha256: BASELINE_SHA,
    source_seals: seals, harness_sha256: sha(await readFile(import.meta.filename)), markers: [MARKER], scope: 'Exact candidate21/history21 on owned local20 with synthetic leases/provider metadata only; every fixture, history and function change rolls back. No image bytes, provider call or semantic AI credit.' };
  const application = `eps-frame-vision-${report.run_id}`; const query = source.get(QUERY).toString('utf8'); let locked = false; let settled = false; let before;
  const identity = `begin;set local application_name='${application}';do $identity$begin if current_user<>'supabase_admin'or current_database()<>'postgres'or inet_client_addr()is not null or(select system_identifier::text from pg_control_system())<>'7701520506262638626'then raise exception'EXACT_OWNED_LOCAL_UNIX_SOCKET_REQUIRED';end if;end $identity$;set local role postgres;`;
  const fixture = `set local role supabase_auth_admin;alter table auth.users enable row level security;set local role postgres;\n${source.get(FIXTURE)}`;
  try {
    const lock = await open(LOCK, 'wx', 0o600); try { await lock.writeFile(JSON.stringify({ run_id: report.run_id, pid: process.pid })); locked = true; } finally { await lock.close(); }
    const target = await verifyLocalTarget(); assert.equal(target.config.container, 'eps-presentation-canonical-pg17-local'); assert.equal(target.observed.system_identifier, '7701520506262638626');
    before = await snapshot(query); report.before = before; assert.equal(before.versions.length, 20);
    const red = await execute(`${identity}\n${fixture}\nrollback;`, target.container.Id);
    report.red = { exit_code: red.code, stdout_sha256: sha(red.stdout), stderr_sha256: sha(red.stderr), expected_assertion: 'first attempt cannot silently skip retry budget' };
    assert(red.code !== 0 && !red.stopped && red.stderr.includes('FRAME_VISION_ASSERTION: first attempt cannot silently skip retry budget'), 'EXPECTED_OLD_CONTRACT_RED_REQUIRED');
    assert.deepEqual(await snapshot(query), before, 'RED_TRANSACTION_DID_NOT_ROLL_BACK'); report.red_reproduced = true; report.red_rollback_verified = true;
    const embedded = query.replace('begin isolation level repeatable read read only;', '-- Parent supplies transaction boundary.').replace(/\nrollback;\s*$/u, '\n');
    const fresh = await verifyLocalTarget(); assert.equal(fresh.container.Id, target.container.Id);
    const green = await execute(`${identity}\n${candidate}\ninsert into supabase_migrations.schema_migrations(version,statements,name)values('${VERSION}',array[]::text[],'m03_frame_vision_selection');\nselect 'VISION_EXPECTED_BEGIN';${embedded}select 'VISION_EXPECTED_END';\nsavepoint fixtures;${fixture}\nrollback to savepoint fixtures;release savepoint fixtures;rollback;`, fresh.container.Id);
    assert.equal(green.code, 0, green.stderr || 'GREEN_SQL_UNCONFIRMED'); assert.equal(green.stopped, false);
    assert.equal(green.stdout.split(/\r?\n/u).filter(line => line === MARKER).length, 1);
    const expected = rows(green.stdout.split('VISION_EXPECTED_BEGIN')[1]?.split('VISION_EXPECTED_END')[0] ?? ''); assert.equal(expected.length, 1); report.expected = expected[0];
    assert.deepEqual(report.expected.versions, [...before.versions, VERSION]);
    const masked = globalThis.structuredClone(report.expected); masked.versions = before.versions;
    report.changed_functions = FUNCTIONS.map(signature => {
      const old = before.catalog.functions.find(row => row.signature === signature); const changed = masked.catalog.functions.find(row => row.signature === signature);
      assert(old && changed); assert.notEqual(old.source_sha256, changed.source_sha256);
      const result = { signature, before_sha256: old.source_sha256, after_sha256: changed.source_sha256 }; changed.source_sha256 = old.source_sha256; return result;
    });
    const constraintBefore = before.catalog.constraints.find(row => row.table === 'eps.candidate_media' && row.name === 'candidate_media_processing_issues_check');
    const constraintAfter = masked.catalog.constraints.find(row => row.table === 'eps.candidate_media' && row.name === 'candidate_media_processing_issues_check');
    assert(constraintBefore && constraintAfter); assert.equal(sha(constraintBefore.definition), '60cae19b6b16531e21d2b1f3b1c4c096b3c980e4d5bfd788953dee0bbbff76f2'); assert.notEqual(constraintBefore.definition, constraintAfter.definition);
    report.changed_constraint = { table: constraintBefore.table, name: constraintBefore.name, before_definition: constraintBefore.definition, after_definition: constraintAfter.definition, before_sha256: sha(constraintBefore.definition), after_sha256: sha(constraintAfter.definition) };
    constraintAfter.definition = constraintBefore.definition;
    assert.deepEqual(masked, before, 'ONLY_THREE_FUNCTION_BODIES_ONE_TECHNICAL_CHECK_AND_HISTORY_MAY_CHANGE');
    report.only_three_function_bodies_and_one_check_changed = true; report.assertions_passed = true; report.transaction_completed_to_rollback = true; report.stdout_sha256 = sha(green.stdout); report.stderr_sha256 = sha(green.stderr);
  } catch (error) {
    const directory = path.join(ROOT, '.local/frame-vision-local'); await mkdir(directory, { recursive: true }); const file = path.join(directory, `${report.run_id}.txt`); await writeFile(file, String(error.stack ?? error), { flag: 'wx', mode: 0o600 });
    report.diagnostic = 'FRAME_VISION_LOCAL_CONTRACT_UNCONFIRMED'; report.private_diagnostic = path.relative(ROOT, file).replaceAll('\\', '/');
  } finally {
    if (locked) { try { settled = rows((await runOwnedLocalSql(`begin read only;select jsonb_build_object('count',count(*))from pg_stat_activity where application_name='${application}';rollback;`)).stdout)[0].count === 0; } catch { /* Unsettled backend keeps lock. */ } }
    report.owned_backend_settled = settled;
    if (before && settled) { try { report.after = await snapshot(query); report.rollback_verified = isDeepStrictEqual(before, report.after); report.sources_stable = (await Promise.all(Object.entries(seals).map(async ([file, digest]) => sha(await readFile(path.join(ROOT, file))) === digest))).every(Boolean); if (report.assertions_passed && report.rollback_verified && report.red_rollback_verified && report.sources_stable) report.result = 'passed'; } catch { report.rollback_verified = false; } }
    if (locked && settled && report.rollback_verified) { const lock = JSON.parse(await readFile(LOCK, 'utf8')); assert.equal(lock.run_id, report.run_id); assert.equal(lock.pid, process.pid); await unlink(LOCK); }
    report.lock_retained = locked && !(settled && report.rollback_verified); report.finished_at = new Date().toISOString(); const directory = path.join(ROOT, 'tracking/evidence/m03/frame-vision-local'); await mkdir(directory, { recursive: true }); const file = path.join(directory, `${report.finished_at.replace(/[:.]/gu, '-')}-${report.run_id.slice(0, 8)}.json`); await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ result: report.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), red_reproduced: report.red_reproduced, rollback_verified: report.rollback_verified, sources_stable: report.sources_stable, lock_retained: report.lock_retained, private_diagnostic: report.private_diagnostic }) + '\n'); if (report.result !== 'passed') process.exitCode = 1;
  }
}
main().catch(() => { process.stderr.write('Frame vision local21 rollback proof stopped; no external fallback.\n'); process.exitCode = 1; });
