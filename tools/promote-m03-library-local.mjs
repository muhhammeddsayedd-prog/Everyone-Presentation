/** Root-reviewed additive library15; fixed owned local target, no cloud or seed. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { runOwnedLocalSql, runReviewedSqlFile, verifyLocalTarget } from './local-postgres.mjs';
import { compareLibraryPromotion } from './lib/candidate-library-comparison.mjs';
const ROOT = path.resolve(import.meta.dirname, '..');
const MIGRATION = 'supabase/migrations/20261029090724_m03_candidate_library.sql';
const CANDIDATE = 'development/m03/candidates-candidate.sql';
const PROOF = 'tracking/evidence/m03/candidate-local/2026-10-29T09-04-40-827Z-25b670e9.json';
const READBACK = 'tools/sql/candidates-library-readback.sql';
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { run_id: randomUUID(), started_at: new Date().toISOString(), result: 'failed', cloud_called: false, migration: MIGRATION };
let owns = false; let dispatched = false;
async function snapshot() {
  const result = await runOwnedLocalSql(await readFile(path.join(ROOT, READBACK), 'utf8'));
  const rows = result.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line)); assert.equal(rows.length, 1); return rows[0];
}
try {
  assert.equal(process.argv.length, 2);
  const source = await readFile(path.join(ROOT, MIGRATION)); assert.equal(hash(source), '2a84e240fa1ed3a283a483775e797e7ef1bafeea36d2d11ace17e06b857d8b8d');
  const proof = JSON.parse(await readFile(path.join(ROOT, PROOF), 'utf8')); assert(proof.result === 'passed' && proof.rollback_verified && proof.cloud_called === false);
  const candidate = await readFile(path.join(ROOT, CANDIDATE), 'utf8'); assert.equal(hash(candidate), proof.source_seals[CANDIDATE]);
  const expected = '-- M03 canonical candidate library. Additive coordinated migration after reviewed14.\n-- Rehearsed locally with synthetic profiles and exact rollback; no seed/runtime enablement.\n'
    + candidate.slice(candidate.indexOf('set local lock_timeout')).replace("  or current_setting('eps.m03_candidate_rehearsal',true) is distinct from 'rollback-only-v1'\n", '').replace('M03_LOCAL14_ROLLBACK_BASELINE_REQUIRED', 'M03_REVIEWED_FOURTEEN_VERSION_BASELINE_REQUIRED');
  assert.equal(source.toString('utf8'), expected);
  report.migration_sha256 = hash(source); report.proof_sha256 = hash(await readFile(path.join(ROOT, PROOF))); report.readback_sha256 = hash(await readFile(path.join(ROOT, READBACK)));
  const lock = await open(LOCK, 'wx', 0o600); try { await lock.writeFile(JSON.stringify({ run_id: report.run_id, pid: process.pid })); owns = true; } finally { await lock.close(); }
  const target = await verifyLocalTarget(); assert.equal(target.observed.system_identifier, '7701520506262638626');
  const before = await snapshot(); assert.equal(before.versions.length, 14); report.before = before;
  dispatched = true; report.promotion = await runReviewedSqlFile(MIGRATION);
  const after = await snapshot(); report.after = after; compareLibraryPromotion(before, after);
  assert.equal((await verifyLocalTarget()).container.Id, target.container.Id);
  report.business_and_old_catalog_preserved = true; report.result = 'passed';
} catch (error) {
  report.dispatch_attempted = dispatched; report.diagnostic = String(error.message).slice(0, 2000);
  if (owns) { try { report.unverified_readback = await snapshot(); } catch { /* Preserve uncertain outcome. */ } } process.exitCode = 1;
} finally {
  if (owns && (!dispatched || report.result === 'passed')) { const owner = JSON.parse(await readFile(LOCK, 'utf8')); assert.equal(owner.run_id, report.run_id); assert.equal(owner.pid, process.pid); await unlink(LOCK); }
  report.lock_retained = owns && dispatched && report.result !== 'passed'; report.finished_at = new Date().toISOString();
  const directory = path.join(ROOT, 'tracking/evidence/m03/library-promotion'); await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${report.finished_at.replace(/[:.]/gu, '-')}-${report.run_id.slice(0, 8)}.json`); await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ result: report.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), cloud_called: false, lock_retained: report.lock_retained, diagnostic: report.diagnostic }) + '\n');
}
