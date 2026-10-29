/** Fixed additive13 local promotion only. No cloud, data/config writes or retry. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { runOwnedLocalSql, runReviewedSqlFile } from './local-postgres.mjs';
import { verifyNativeSpecsLocalTarget } from './lib/native-specs-local-transport.mjs';
const root = path.resolve(import.meta.dirname, '..');
const file = 'supabase/migrations/20261029070038_m02_specs_read_operation.sql';
const seal = '040151ec89b461be2dc0c1d4ab8446652062488aac5f63822129d497ecf1702e';
const manifestSeal = 'b03d02089e81e13dd5ec8b4245ecfdc81cd6f08e6e4e24ef97933e5d30d77a6c';
const readback = 'tools/sql/specs-assets-readback.sql';
const readbackSeal = 'c5f49dc4efdd325fec7c608ec7c5bbb2f8d17e9c2beab92077eb540b1a39b192';
const proofFile = 'tracking/evidence/m02/specs-read-operation-candidate/2026-10-29T06-58-54-461Z-156cc7e0-rollback.json';
const proofSeal = '02b560e8259bccaacfb665e4558ed771eb6af40935e535504815b00da6d04e7f';
const lock = path.join(root, '.local/local-postgres/test-db.lock');
const hash = value => createHash('sha256').update(value).digest('hex');
const changed = ['eps_specs_original_read', 'eps_specs_capability_read', 'eps_specs_read_guard'];
const body = "storage.allow_only_operation('object.get_authenticated'::text)";
const info = "storage.allow_only_operation('object.get_authenticated_info'::text)";
const report = { observed_at: new Date().toISOString(), run_id: randomUUID(), result: 'unconfirmed', file,
  migration_sha256: seal, manifest_sha256: manifestSeal, candidate_proof: proofFile, candidate_proof_sha256: proofSeal,
  cloud_called: false, promotion_retry: false, scope: 'Only three reviewed Storage SELECT policy expressions change on owned local12→13; all data/roles/functions/other policies preserved.' };
let owns = false; let dispatched = false;
async function snapshot() {
  const source = await readFile(path.join(root, readback)); assert.equal(hash(source), readbackSeal);
  const output = await runOwnedLocalSql(source.toString('utf8'));
  const rows = output.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert.equal(rows.length, 1); assert.equal(rows[0].query_role, 'postgres'); return rows[0];
}
try {
  assert.equal(process.argv.length, 2);
  assert.equal(hash(await readFile(path.join(root, file))), seal);
  assert.equal(hash(await readFile(path.join(root, 'development/local-db/reviewed.json'))), manifestSeal);
  const proofBytes = await readFile(path.join(root, proofFile)); assert.equal(hash(proofBytes), proofSeal);
  const proof = JSON.parse(proofBytes.toString('utf8'));
  assert(proof.result === 'passed' && proof.rollback_verified && proof.catalog_and_all_counts_restored && proof.owned_backend_settled
    && proof.red_body_allowed_info_denied && proof.green_body_and_info_allowed && proof.scope_and_lease_negatives_passed && proof.cloud_called === false);
  const handle = await open(lock, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify({ run_id: report.run_id, pid: process.pid })); await handle.sync(); owns = true; } finally { await handle.close(); }
  const target = await verifyNativeSpecsLocalTarget(); const before = await snapshot();
  assert.deepEqual(before.versions, proof.after.versions); assert.equal(before.versions.length, 12);
  const directory = path.join(root, 'tracking/evidence/m02/specs-read-operation-promotion'); await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, report.run_id + '-attempt.json'), JSON.stringify({ ...report, before }, null, 2) + '\n', { flag: 'wx' });
  dispatched = true; report.promotion = await runReviewedSqlFile(file);
  const after = await snapshot(); report.observed_versions = after.versions;
  assert.deepEqual(after.versions, [...before.versions, '20261029070038']);
  for (const key of ['counts', 'data_sha256', 'source_config', 'assets', 'runtime']) assert.deepEqual(after[key], before[key]);
  const adjusted = globalThis.structuredClone(after.catalog); const policyEffects = [];
  for (const name of changed) {
    const old = before.catalog.policies.find(item => item.table === 'storage.objects' && item.name === name);
    const current = adjusted.policies.find(item => item.table === 'storage.objects' && item.name === name);
    assert(old && current && old.using.split(body).length === 2 && !old.using.includes(info));
    const expected = old.using.replace(body, `(${body} OR ${info})`);
    assert.deepEqual(current, { ...old, using: expected });
    policyEffects.push({ name, before_using_sha256: hash(old.using), after_using_sha256: hash(current.using) });
    current.using = old.using;
  }
  assert.deepEqual(adjusted, before.catalog);
  assert.equal((await verifyNativeSpecsLocalTarget()).container.Id, target.container.Id);
  report.business_rows_preserved = true; report.only_three_reviewed_read_predicates_changed = true; report.policy_effects = policyEffects;
  report.result = 'passed';
} catch {
  report.dispatch_attempted = dispatched; report.automatic_retry = false; process.exitCode = 1;
  if (owns) { try { report.unverified_readback = await snapshot(); } catch { /* Remain unconfirmed; never reapply. */ } }
} finally {
  // A possibly committed unverified promotion retains its own exact lock for
  // root's read-only reconciliation. It is never silently retried or adopted.
  if (owns && (!dispatched || report.result === 'passed')) {
    const owner = JSON.parse(await readFile(lock, 'utf8')); assert(owner.run_id === report.run_id && owner.pid === process.pid); await unlink(lock);
  }
  report.lock_retained = owns && dispatched && report.result !== 'passed';
  report.finished_at = new Date().toISOString(); const directory = path.join(root, 'tracking/evidence/m02/specs-read-operation-promotion'); await mkdir(directory, { recursive: true });
  const output = path.join(directory, report.finished_at.replace(/[:.]/gu, '-') + '-' + report.run_id.slice(0, 8) + '.json');
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ result: report.result, cloud_called: false, dispatch_attempted: dispatched, lock_retained: report.lock_retained,
    business_rows_preserved: report.business_rows_preserved === true, receipt: path.relative(root, output).replaceAll('\\', '/') })+'\n');
}
