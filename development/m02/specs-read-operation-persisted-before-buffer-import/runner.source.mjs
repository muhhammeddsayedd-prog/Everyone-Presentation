/** Fixed persisted13 GREEN/scope SQL metadata rehearsal only, full rollback. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import { runOwnedLocalSql } from './local-postgres.mjs';
import { verifyNativeSpecsLocalTarget } from './lib/native-specs-local-transport.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SYSTEM = '7701520506262638626';
const ASSERTIONS = 'tests/db/m02-specs-read-operation-local.sql';
const READBACK = 'tools/sql/specs-read-operation-readback.sql';
const MANIFEST = 'development/local-db/reviewed.json';
const MIGRATION = 'supabase/migrations/20261029070038_m02_specs_read_operation.sql';
const SEALS = {
  [ASSERTIONS]: 'df272fe1c3cf4f5e4fbadc2575c25834f854f73db32274d6985c734a40af5187',
  [READBACK]: '8c23cba328e8eef38c99520807dcb680895b94b5508dc307932d01b5fda76a2f',
  [MANIFEST]: 'b03d02089e81e13dd5ec8b4245ecfdc81cd6f08e6e4e24ef97933e5d30d77a6c',
  [MIGRATION]: '040151ec89b461be2dc0c1d4ab8446652062488aac5f63822129d497ecf1702e',
  'tools/local-postgres.mjs': '49929bce8eb51194d9299cfd9639e537eb237daaec76c15740cb88059604e2de',
  'tools/lib/native-specs-local-transport.mjs': '57f2b5dca8ea6e04542366c93283a2bf22a63c8d918918a0b00561b3b31758d9',
};
const VERSIONS = ['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702',
  '20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038'];
const POLICIES = ['eps_specs_original_read','eps_specs_capability_read','eps_specs_read_guard'];
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const DIRECTORY = path.join(ROOT, 'tracking/evidence/m02/specs-read-operation-local');
const hash = value => createHash('sha256').update(value).digest('hex');
let containerId;
async function target() {
  const value = await verifyNativeSpecsLocalTarget();
  assert.equal(value.observed.system_identifier, SYSTEM);
  if (containerId) assert.equal(value.container.Id, containerId);
  else containerId = value.container.Id;
  return value;
}
async function sources() {
  for (const [file, seal] of Object.entries(SEALS)) {
    const absolute = path.join(ROOT, file); assert.equal(await realpath(absolute), absolute);
    assert.equal(hash(await readFile(absolute)), seal);
  }
  const manifest = JSON.parse(await readFile(path.join(ROOT, MANIFEST), 'utf8'));
  assert.equal(manifest.migrations.length, 13);
  assert.deepEqual(manifest.migrations.map(row => path.basename(row.path).slice(0,14)), VERSIONS);
  for (const row of manifest.migrations) {
    assert(row.reviewed_by && row.reviewed_at);
    assert.equal(hash(await readFile(path.join(ROOT, row.path))), row.sha256);
  }
}
async function snapshot() {
  await target();
  const result = await runOwnedLocalSql(await readFile(path.join(ROOT, READBACK), 'utf8'));
  assert.equal(result.system_identifier, SYSTEM);
  assert(Buffer.byteLength(result.stdout, 'utf8') <= 16 * 1024 * 1024);
  const rows = result.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert.equal(rows.length, 1); const state = rows[0];
  assert.equal(state.query_role, 'postgres'); assert.equal(state.database, 'postgres'); assert.equal(state.unrestricted_visibility, true);
  assert.deepEqual(state.versions, VERSIONS); assert.equal(state.runtime, null);
  await target(); return state;
}
function compact(state) {
  return { ...state, catalog: undefined, catalog_sha256: hash(JSON.stringify(state.catalog)) };
}
async function settled(applicationName) {
  assert(/^eps-read-info-[a-f0-9-]{36}$/u.test(applicationName));
  const sql = `begin read only; select jsonb_build_object('remaining',count(*)) from pg_stat_activity where application_name='${applicationName}'; rollback;`;
  for (let count = 0; count < 20; count++) {
    await target(); const result = await runOwnedLocalSql(sql);
    const rows = result.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
    if (rows.length === 1 && rows[0].remaining === 0) return true;
    await setTimeout(250);
  }
  return false;
}
async function main() {
  assert.equal(process.argv.length, 2); assert.match(process.version, /^v24\./u);
  await sources(); // Source-only gate precedes lock or target calls.
  const runId = randomUUID(); const applicationName = `eps-read-info-${runId}`;
  const receipt = { run_id: runId, started_at: new Date().toISOString(), result: 'failed',
    harness_sha256: hash(await readFile(import.meta.filename)), reviewed_manifest_sha256: SEALS[MANIFEST],
    migration: MIGRATION, migration_sha256: SEALS[MIGRATION], assertions: ASSERTIONS,
    hashes: { assertions: SEALS[ASSERTIONS], readback: SEALS[READBACK] }, source_seals: SEALS,
    cloud_called: false, provider_called: false, storage_http_tested: false, candidate_ddl_executed: false,
    persisted_schema_assertions_tested: true, concurrent_sessions_tested: false,
    scope: 'Persisted local13 actual authenticated/anon metadata RLS GREEN and scope/expiry/revocation checks; no DDL, HTTP, byte verification, provider or production identity proof.',
    local_runtime_ownership_files_read: true, worker_provider_configuration_read: false };
  let owns = false; let before;
  try {
    await mkdir(path.dirname(LOCK), { recursive: true }); const lock = await open(LOCK, 'wx', 0o600);
    try { await lock.writeFile(JSON.stringify({ run_id: runId, pid: process.pid })); await lock.sync(); owns = true; }
    finally { await lock.close(); }
    await target(); receipt.environment = { system_identifier: SYSTEM, container_id: containerId };
    before = await snapshot(); receipt.before = compact(before);
    const policies = before.catalog.policies.filter(row => row.table === 'storage.objects' && POLICIES.includes(row.name));
    assert.equal(policies.length, 3); assert.equal(new Set(policies.map(row => row.name)).size, 3);
    await mkdir(DIRECTORY, { recursive: true });
    const contract = { observed_at: new Date().toISOString(), result: 'passed', read_only: true, cloud_called: false,
      system_identifier: SYSTEM, readback_sha256: SEALS[READBACK], catalog_sha256: hash(JSON.stringify(before.catalog)),
      harness_sha256: receipt.harness_sha256,
      policy_contract: { query_role: before.query_role, database: before.database, unrestricted_visibility: before.unrestricted_visibility,
        versions: before.versions, catalog: { policies }, runtime: null } };
    const contractPath = path.join(DIRECTORY, `${runId}-policy-contract.json`);
    const contractBytes = Buffer.from(JSON.stringify(contract, null, 2) + '\n');
    await writeFile(contractPath, contractBytes, { flag: 'wx' });
    receipt.local_policy_contract = path.relative(ROOT, contractPath).replaceAll('\\', '/');
    receipt.local_policy_contract_sha256 = hash(contractBytes);
    await sources(); await target();
    const sql = `begin; set local lock_timeout='5s'; set local statement_timeout='30s'; set local application_name='${applicationName}';
set local eps.specs_read_operation_rehearsal='rollback-only-v1';
${await readFile(path.join(ROOT, ASSERTIONS), 'utf8')}\nrollback;`;
    assert(Buffer.byteLength(sql, 'utf8') < 256 * 1024);
    receipt.execution_attempted = true;
    const result = await runOwnedLocalSql(sql);
    assert.equal(result.system_identifier, SYSTEM);
    const lines = result.stdout.split(/\r?\n/u);
    for (const marker of ['READ_INFO_GREEN_BODY_AND_INFO_ALLOWED','READ_INFO_SCOPE_AND_LEASE_NEGATIVES_PASSED']) {
      assert.equal(lines.filter(line => line === marker).length, 1);
    }
    receipt.green_body_and_info_allowed = true; receipt.scope_and_lease_negatives_passed = true;
    receipt.transaction_completed_to_rollback = true;
  } catch { receipt.failure_code = 'LOCAL_READ_OPERATION_PROOF_UNCONFIRMED'; }
  finally {
    if (before) {
      try {
        receipt.owned_backend_settled = await settled(applicationName);
        assert.equal(receipt.owned_backend_settled, true); await sources();
        const after = await snapshot(); receipt.after = compact(after);
        receipt.catalog_and_all_counts_restored = isDeepStrictEqual(before, after);
        receipt.rollback_verified = receipt.catalog_and_all_counts_restored;
        if (!receipt.failure_code && receipt.transaction_completed_to_rollback && receipt.rollback_verified) receipt.result = 'passed';
      } catch { receipt.verification_code = 'LOCAL_ROLLBACK_UNCONFIRMED'; receipt.owned_backend_settled = false; }
    }
    if (owns && (!receipt.execution_attempted || receipt.owned_backend_settled === true)) {
      try { const owner = JSON.parse(await readFile(LOCK, 'utf8')); assert.equal(owner.run_id, runId); assert.equal(owner.pid, process.pid); await unlink(LOCK); }
      catch { receipt.result = 'failed'; receipt.lock_code = 'LOCAL_LOCK_OWNERSHIP_UNCONFIRMED'; }
    }
    receipt.finished_at = new Date().toISOString(); await mkdir(DIRECTORY, { recursive: true });
    const file = path.join(DIRECTORY, `${receipt.finished_at.replace(/[:.]/gu, '-')}-${runId.slice(0,8)}-rollback.json`);
    await writeFile(file, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ result: receipt.result, receipt: path.relative(ROOT, file).replaceAll('\\','/'),
      rollback_verified: receipt.rollback_verified === true, cloud_called: false }) + '\n');
    if (receipt.result !== 'passed') process.exitCode = 1;
  }
}
main().catch(() => { process.stderr.write('Fixed local13 policy proof stopped before confirmation; private diagnostics suppressed.\n'); process.exitCode = 1; });
