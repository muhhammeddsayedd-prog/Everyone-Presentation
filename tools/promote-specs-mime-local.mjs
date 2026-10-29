/** Fixed function-only local12 promotion; no cloud or feature activation. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { runOwnedLocalSql, runReviewedSqlFile } from './local-postgres.mjs';
import { verifyNativeSpecsLocalTarget } from './lib/native-specs-local-transport.mjs';
const root = path.resolve(import.meta.dirname, '..');
const file = 'supabase/migrations/20261029003941_m02_specs_mime_guard.sql';
const seal = '5a4439e9dd5262cae7e6f813997c4c9506db3eb74fe4ea95d2a352726effb549';
const readback = 'tools/sql/specs-assets-readback.sql';
const readbackSeal = 'c5f49dc4efdd325fec7c608ec7c5bbb2f8d17e9c2beab92077eb540b1a39b192';
const lock = path.join(root, '.local/local-postgres/test-db.lock');
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { observed_at: new Date().toISOString(), run_id: randomUUID(), result: 'unconfirmed',
  scope: 'Fixed local12 function-only promotion with actual data and owner/ACL preservation', cloud_called: false, file, migration_sha256: seal };
let owns = false; let dispatched = false;
async function snapshot() {
  const source = await readFile(path.join(root, readback)); assert.equal(hash(source), readbackSeal);
  const output = await runOwnedLocalSql(source.toString('utf8'));
  const rows = output.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert.equal(rows.length, 1); assert.equal(rows[0].query_role, 'postgres'); return rows[0];
}
try {
  assert.equal(process.argv.length, 2);
  const sql = await readFile(path.join(root, file)); assert.equal(hash(sql), seal);
  assert.equal(hash(await readFile(path.join(root, 'development/local-db/reviewed.json'))), '41981d2fbf426976c1a6557bacffe0f38866ca579bcfe0b58247d72d3425eb31');
  const proof = JSON.parse(await readFile(path.join(root, 'tracking/evidence/m02/specs-mime-guard/2026-10-29T00-44-31-102Z-b269f7d7-rollback.json'), 'utf8'));
  assert(proof.result === 'passed' && proof.rollback_verified && proof.catalog_and_all_counts_restored && proof.cloud_called === false);
  const handle = await open(lock, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify({ run_id: report.run_id, pid: process.pid })); await handle.sync(); owns = true; }
  finally { await handle.close(); }
  const target = await verifyNativeSpecsLocalTarget(); const before = await snapshot();
  assert.equal(before.versions.length, 11); assert.equal(before.versions.at(-1), '20261029001520');
  const directory = path.join(root, 'tracking/evidence/m02/specs-mime-promotion'); await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, report.run_id + '-attempt.json'), JSON.stringify({ ...report, before }, null, 2) + '\n', { flag: 'wx' });
  dispatched = true; report.promotion = await runReviewedSqlFile(file);
  const after = await snapshot(); report.observed_versions = after.versions;
  assert.deepEqual(after.versions, [...before.versions, '20261029003941']);
  assert.deepEqual(after.counts, before.counts); assert.deepEqual(after.data_sha256, before.data_sha256);
  assert.deepEqual(after.source_config, before.source_config); assert.deepEqual(after.assets, before.assets);
  assert.equal(after.release_additions_pristine, true);
  const adjusted = structuredClone(after.catalog);
  const oldRoutine = before.catalog.functions.find(item => item.name === 'public.eps_reserve_specs_upload');
  const newRoutine = adjusted.functions.find(item => item.name === oldRoutine.name);
  assert(oldRoutine && newRoutine && oldRoutine.source_sha256 !== newRoutine.source_sha256);
  const match = sql.toString('utf8').match(/as\s+\$\$([\s\S]*?)\$\$;/iu); assert(match);
  assert.equal(newRoutine.source_sha256, hash(match[1].replaceAll('\r\n', '\n')));
  report.changed_function = { name: oldRoutine.name, before_source_sha256: oldRoutine.source_sha256, after_source_sha256: newRoutine.source_sha256 };
  newRoutine.source_sha256 = oldRoutine.source_sha256; assert.deepEqual(adjusted, before.catalog);
  assert.equal((await verifyNativeSpecsLocalTarget()).container.Id, target.container.Id);
  report.business_rows_preserved = true; report.only_reviewed_function_body_changed = true; report.result = 'passed';
} catch {
  report.dispatch_attempted = dispatched; report.automatic_retry = false; process.exitCode = 1;
  if (owns) { try { report.unverified_readback = await snapshot(); } catch { /* retain unknown */ } }
} finally {
  if (owns) { const owner = JSON.parse(await readFile(lock, 'utf8')); assert(owner.run_id === report.run_id && owner.pid === process.pid); await unlink(lock); }
  report.finished_at = new Date().toISOString(); const directory = path.join(root, 'tracking/evidence/m02/specs-mime-promotion'); await mkdir(directory, { recursive: true });
  const output = path.join(directory, report.finished_at.replace(/[:.]/gu, '-') + '-' + report.run_id.slice(0, 8) + '.json');
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ result: report.result, cloud_called: false, dispatch_attempted: dispatched,
    business_rows_preserved: report.business_rows_preserved === true, receipt: path.relative(root, output).replaceAll('\\', '/') }));
}
