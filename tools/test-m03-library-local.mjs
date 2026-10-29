/** Persisted local15 manual/library regression, synthetic data and full rollback. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { isDeepStrictEqual } from 'node:util';
import { runOwnedLocalSql, verifyLocalTarget } from './local-postgres.mjs';
const ROOT = path.resolve(import.meta.dirname, '..');
const TEST = 'development/m03/candidates-assertions.sql'; const READBACK = 'tools/sql/candidates-library-readback.sql';
const MIGRATION = 'supabase/migrations/20261029090724_m03_candidate_library.sql';
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const hash = value => createHash('sha256').update(value).digest('hex');
async function target() { const value = await verifyLocalTarget(); assert.equal(value.observed.system_identifier, '7701520506262638626'); return value; }
async function snapshot() {
  await target(); const result = await runOwnedLocalSql(await readFile(path.join(ROOT, READBACK), 'utf8'));
  const lines = result.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')); assert.equal(lines.length, 1); return JSON.parse(lines[0]);
}
async function main() {
  assert.equal(process.argv.length, 2); const runId = randomUUID(); const applicationName = `eps-m03-library-${runId}`;
  const source = await readFile(path.join(ROOT, TEST), 'utf8'); const seals = { [TEST]: hash(source), [READBACK]: hash(await readFile(path.join(ROOT, READBACK))), [MIGRATION]: hash(await readFile(path.join(ROOT, MIGRATION))) };
  assert.equal(seals[MIGRATION], '2a84e240fa1ed3a283a483775e797e7ef1bafeea36d2d11ace17e06b857d8b8d');
  const report = { run_id: runId, started_at: new Date().toISOString(), result: 'failed', cloud_called: false, provider_called: false,
    source_seals: seals, harness_sha256: hash(await readFile(import.meta.filename)), candidate_ddl_executed: false,
    scope: 'Persisted owned local15 manual fact/review/search/duplicate/two-project pool regression and permission negatives; synthetic rows rolled back. No media bytes/provider/UI claim.' };
  let owns = false; let before; let attempted = false; let settled = false;
  try {
    await target(); const handle = await open(LOCK, 'wx', 0o600); owns = true;
    try { await handle.writeFile(JSON.stringify({ run_id: runId, pid: process.pid, application_name: applicationName })); } finally { await handle.close(); }
    before = await snapshot(); assert.equal(before.versions.length, 15); assert.equal(before.versions.at(-1), '20261029090724'); report.before = before;
    attempted = true; const result = await runOwnedLocalSql(`begin; set local application_name='${applicationName}';\n${source}\nrollback;`);
    for (const marker of ['M03_MANUAL_REVIEW_SEARCH_DUPLICATE_POOL_PASSED', 'M03_RLS_CAPABILITY_SCOPE_DENIALS_PASSED']) assert.equal(result.stdout.split(/\r?\n/u).filter(line => line === marker).length, 1);
    report.assertions_passed = true; report.transaction_completed_to_rollback = true;
  } catch (error) { report.diagnostic = String(error.message).slice(0, 2000); }
  finally {
    if (owns) { try { const result = await runOwnedLocalSql(`begin read only; select jsonb_build_object('remaining',count(*)) from pg_stat_activity where application_name='${applicationName}'; rollback;`); settled = JSON.parse(result.stdout.split(/\r?\n/u).find(line => line.startsWith('{'))).remaining === 0; } catch { /* Retain unresolved owner lock. */ } }
    report.owned_backend_settled = settled;
    if (before && settled) {
      try { const after = await snapshot(); report.after = after; report.rollback_verified = isDeepStrictEqual(before, after);
        report.sources_unchanged = (await Promise.all(Object.entries(seals).map(async ([file, seal]) => hash(await readFile(path.join(ROOT, file))) === seal))).every(Boolean);
        if (report.assertions_passed && report.rollback_verified && report.sources_unchanged) report.result = 'passed';
      } catch { report.rollback_verified = false; }
    }
    if (owns && (!attempted || settled)) { const owner = JSON.parse(await readFile(LOCK, 'utf8')); assert.equal(owner.run_id, runId); assert.equal(owner.pid, process.pid); await unlink(LOCK); }
    report.finished_at = new Date().toISOString(); const directory = path.join(ROOT, 'tracking/evidence/m03/library-local'); await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${report.finished_at.replace(/[:.]/gu, '-')}-${runId.slice(0, 8)}.json`); await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ result: report.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), rollback_verified: report.rollback_verified === true, source_stability_verified: report.sources_unchanged === true }) + '\n');
    if (report.result !== 'passed') process.exitCode = 1;
  }
}
main().catch(() => { process.stderr.write('Fixed local15 library regression stopped without confirmation.\n'); process.exitCode = 1; });
