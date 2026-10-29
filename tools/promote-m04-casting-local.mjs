/** Fixed reviewed19->20 local promotion. Root reviews and extends the manifest first. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { runOwnedLocalSql, runReviewedSqlFile, verifyLocalTarget } from './local-postgres.mjs';
import { CASTING_BASELINE, CASTING_BASELINE_SHA, CASTING_MIGRATION, CASTING_VERSION, castingSha256 as sha } from './prepare-m04-casting-migration.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
export const CASTING_MIGRATION_SHA = '2825681bf529f1b32db2473749180901f0961b025e8da847b38ad49c06f4b900';
export const CASTING_PROOF = 'tracking/evidence/m04/migration-local/2026-10-29T17-50-48-101Z-2d85109f.json';
export const CASTING_PROOF_SHA = 'f3c6400ce6905ce4562021cc61453640251dac4a93dbadee711a92a1a7bf88d0';
const QUERY = 'tools/sql/m03-remaining-readback.sql';
const QUERY_SHA = 'c8e74d2bd7399682c984ad79b8f1732fd074056bf6ac065c19407948bfcc7b72';
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const NEW_TABLES = ['eps.assignments', 'eps.assignment_change_events', 'eps.assignment_change_consumptions'];

export function validateCastingPromotionManifest(manifest, baseline) {
  assert.equal(baseline.migrations.length, 19); assert.equal(manifest.migrations.length, 20, 'REVIEWED_TWENTY_MANIFEST_REQUIRED');
  assert.deepEqual(manifest.migrations.slice(0, 19), baseline.migrations, 'PREVIOUS_NINETEEN_MANIFEST_ENTRIES_CHANGED');
  assert.equal(manifest.migrations[19].path, CASTING_MIGRATION); assert.equal(manifest.migrations[19].sha256, CASTING_MIGRATION_SHA);
  assert.equal(typeof manifest.migrations[19].reviewed_by, 'string'); assert(manifest.migrations[19].reviewed_by.trim());
  assert.equal(typeof manifest.migrations[19].reviewed_at, 'string'); assert(Number.isFinite(Date.parse(manifest.migrations[19].reviewed_at)));
}
export function compareCastingLocalPromotion(before, after, proof) {
  assert.deepEqual(before, proof.before, 'FRESH_LOCAL19_DIFFERS_FROM_PROVEN_BASELINE');
  assert.deepEqual(after, proof.expected, 'LOCAL20_DIFFERS_FROM_EXACT_REVIEWED_STATE');
  assert.deepEqual(after.versions, [...before.versions, CASTING_VERSION]);
  for (const [table, count] of Object.entries(before.counts)) assert.equal(after.counts[table], count, `OLD_COUNT_CHANGED:${table}`);
  for (const [table, value] of Object.entries(before.data_sha256)) assert.equal(after.data_sha256[table], value, `OLD_ROW_CHANGED:${table}`);
  for (const table of NEW_TABLES) assert.equal(after.counts[table], 0, 'NEW_CASTING_TABLE_MUST_BE_EMPTY');
  for (const key of Object.keys(before).filter(key => !['catalog', 'counts', 'data_sha256', 'versions'].includes(key))) assert.deepEqual(after[key], before[key], `UNREVIEWED_RUNTIME_OR_CONFIGURATION_CHANGE:${key}`);
  return { business_rows_preserved: true, exact_reviewed_catalog_delta: true, runtime_and_configuration_unchanged: true, new_casting_tables_empty: true };
}
async function snapshot(query) {
  const response = await runOwnedLocalSql(query); const rows = response.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert.equal(rows.length, 1); assert.equal(rows[0].query_role, 'postgres'); assert.equal(rows[0].unrestricted_visibility, true); return rows[0];
}
async function managedAuth() {
  return snapshot(`begin isolation level repeatable read read only;set local search_path='';
select jsonb_build_object('query_role',current_user,'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
 'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forced_rls',c.relforcerowsecurity,'acl',c.relacl::text,
 'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,
 'roles',(select jsonb_agg(case when roleid=0 then 'PUBLIC' else pg_get_userbyid(roleid)end order by roleid)from unnest(p.polroles)r(roleid)),
 'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))order by p.polname),'[]')from pg_policy p where p.polrelid=c.oid))
from pg_class c where c.oid='auth.users'::regclass;rollback;`);
}
async function main() {
  assert.equal(process.argv.length, 2);
  const report = { run_id: randomUUID(), started_at: new Date().toISOString(), result: 'failed', cloud_called: false, provider_called: false,
    migration: CASTING_MIGRATION, migration_sha256: CASTING_MIGRATION_SHA, proof: CASTING_PROOF, proof_sha256: CASTING_PROOF_SHA,
    readback: QUERY, readback_sha256: QUERY_SHA, baseline_manifest: CASTING_BASELINE, baseline_manifest_sha256: CASTING_BASELINE_SHA,
    harness_sha256: sha(await readFile(import.meta.filename)), scope: 'Exact reviewed local19-to20 assignment/lifecycle DDL/history only. No fixture, key, runtime/configuration activation, provider or hosting change.' };
  let ownsLock = false; let dispatched = false;
  try {
    const bytes = await readFile(path.join(ROOT, CASTING_PROOF)); assert.equal(sha(bytes), CASTING_PROOF_SHA); const proof = JSON.parse(bytes);
    for (const key of ['rollback_verified', 'sources_stable', 'assertions_passed', 'owned_backend_settled', 'preexisting_rows_configs_and_runtime_preserved_in_draft', 'lifecycle_behavior_tested']) assert.equal(proof[key], true);
    assert.equal(proof.result, 'passed'); assert.equal(proof.cloud_called, false); assert.equal(proof.provider_called, false); assert.equal(proof.hosted_credential_files_read, false);
    assert.equal(proof.migration_sha256, CASTING_MIGRATION_SHA); assert.equal(proof.markers.length, 8); assert.deepEqual(proof.before, proof.after); assert.deepEqual(proof.managed_auth_before, proof.managed_auth_after);
    for (const [file, digest] of Object.entries(proof.source_seals)) if (file !== 'development/local-db/reviewed.json') assert.equal(sha(await readFile(path.join(ROOT, file))), digest, 'PROVEN_SOURCE_CHANGED');
    assert.equal(sha(await readFile(path.join(ROOT, 'tools/test-m04-casting-migration-local.mjs'))), proof.harness_sha256);
    const baselineBytes = await readFile(path.join(ROOT, CASTING_BASELINE)); assert.equal(sha(baselineBytes), CASTING_BASELINE_SHA);
    assert.equal(proof.source_seals['development/local-db/reviewed.json'], CASTING_BASELINE_SHA);
    const manifest = JSON.parse(await readFile(path.join(ROOT, 'development/local-db/reviewed.json'))); validateCastingPromotionManifest(manifest, JSON.parse(baselineBytes));
    for (const row of manifest.migrations) assert.equal(sha(await readFile(path.join(ROOT, row.path))), row.sha256);
    const query = await readFile(path.join(ROOT, QUERY), 'utf8'); assert.equal(sha(query), QUERY_SHA);
    const lock = await open(LOCK, 'wx', 0o600); try { await lock.writeFile(JSON.stringify({ run_id: report.run_id, pid: process.pid })); ownsLock = true; } finally { await lock.close(); }
    const target = await verifyLocalTarget(); assert.equal(target.observed.system_identifier, '7701520506262638626'); assert.equal(target.config.container, 'eps-presentation-canonical-pg17-local');
    report.before = await snapshot(query); assert.deepEqual(report.before, proof.before); report.managed_auth_before = await managedAuth();
    for (const key of Object.keys(proof.managed_auth_before)) assert.deepEqual(report.managed_auth_before[key], proof.managed_auth_before[key]);
    dispatched = true; report.promotion = await runReviewedSqlFile(CASTING_MIGRATION);
    report.after = await snapshot(query); report.managed_auth_after = await managedAuth(); report.comparison = compareCastingLocalPromotion(report.before, report.after, proof);
    assert.deepEqual(report.managed_auth_after, report.managed_auth_before); report.managed_auth_preserved = true;
    const actual = await verifyLocalTarget(); assert.equal(actual.container.Id, target.container.Id); assert.equal(actual.observed.system_identifier, target.observed.system_identifier);
    report.business_and_old_catalog_preserved = true; report.result = 'passed';
  } catch {
    report.dispatch_attempted = dispatched; report.diagnostic = dispatched ? 'LOCAL20_PROMOTION_OUTCOME_UNCONFIRMED' : 'LOCAL20_PROMOTION_PRECONDITION_UNCONFIRMED';
    if (ownsLock) { try { report.unverified_readback = await snapshot(await readFile(path.join(ROOT, QUERY), 'utf8')); report.unverified_managed_auth = await managedAuth(); } catch { /* Unconfirmed writes retain the lock. */ } }
    process.exitCode = 1;
  } finally {
    if (ownsLock && (!dispatched || report.result === 'passed')) { const lock = JSON.parse(await readFile(LOCK, 'utf8')); assert.equal(lock.run_id, report.run_id); assert.equal(lock.pid, process.pid); await unlink(LOCK); }
    report.lock_retained = ownsLock && dispatched && report.result !== 'passed'; report.finished_at = new Date().toISOString();
    const directory = path.join(ROOT, 'tracking/evidence/m04/migration-promotion'); await mkdir(directory, { recursive: true }); const file = path.join(directory, `${report.finished_at.replace(/[:.]/gu, '-')}-${report.run_id.slice(0, 8)}.json`);
    await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ result: report.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), cloud_called: false, lock_retained: report.lock_retained, diagnostic: report.diagnostic }) + '\n');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(() => {
  process.stderr.write('Local20 promotion stopped; no cloud fallback.\n'); process.exitCode = 1;
});
