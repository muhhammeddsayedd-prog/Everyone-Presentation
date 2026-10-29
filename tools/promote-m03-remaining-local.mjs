/** Guarded reviewed17->18 local promotion. Root runs only after reviewing and extending the manifest. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { runOwnedLocalSql, runReviewedSqlFile, verifyLocalTarget } from './local-postgres.mjs';
import { REMAINING_MIGRATION, sha256 } from './prepare-m03-remaining-migration.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const MIGRATION_SHA = '2e190e001b2bda044d9c90da4287f54e5839b0af7ffec84d4c93083909c944fb';
const PROOF = 'tracking/evidence/m03/remaining-composed-local/2026-10-29T13-43-40-528Z-97b70205.json';
const PROOF_SHA = '04f7e98ea89d6ed8550ee56b8c19fa4ee4f112c5625a27af05608c4db535cba0';
const READBACK = 'tools/sql/m03-remaining-readback.sql';
const READBACK_SHA = 'c8e74d2bd7399682c984ad79b8f1732fd074056bf6ac065c19407948bfcc7b72';
const BASELINE = 'tracking/evidence/m03/remaining-preparation/baseline17-reviewed-manifest.json';
const BASELINE_SHA = 'f4ae3d8ba1169ae9f89ee16c1d8b922edaf6a5bea2e8ad56c5a5194ef8aadfdb';
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');

export function validateRemainingPromotionManifest(manifest, baseline) {
  assert.equal(baseline.migrations.length, 17);
  assert.equal(manifest.migrations.length, 18, 'REVIEWED_MANIFEST_EIGHTEEN_REQUIRED');
  assert.deepEqual(manifest.migrations.slice(0, 17), baseline.migrations, 'OLD_MIGRATION_MANIFEST_CHANGED');
  assert.equal(manifest.migrations[17].path, REMAINING_MIGRATION);
  assert.equal(manifest.migrations[17].sha256, MIGRATION_SHA);
}

export function compareRemainingLocalPromotion(before, after, proof) {
  assert.deepEqual(before, proof.before, 'FRESH_LOCAL17_DIFFERS_FROM_PROVEN_BASELINE');
  assert.deepEqual(after, proof.expected, 'LOCAL18_DIFFERS_FROM_EXACT_REVIEWED_STATE');
  assert.deepEqual(after.versions, [...before.versions, '20261029133455']);
  for (const [table, fingerprint] of Object.entries(before.data_sha256)) assert.equal(after.data_sha256[table], fingerprint);
  for (const [table, count] of Object.entries(before.counts)) assert.equal(after.counts[table], count + (table === 'storage.buckets' ? 1 : 0));
  for (const key of ['runtime', 'source_config', 'assets', 'candidate_buckets', 'buckets', 'protected_m02']) assert.deepEqual(after[key], before[key]);
  return { business_rows_preserved: true, old_catalog_preserved_except_exact_reviewed_delta: true,
    exact_local_reference_before_and_after: true, runtime_snapshot_unchanged: true, local_runtime_role_present: before.runtime !== null };
}

async function snapshot(query) {
  const result = await runOwnedLocalSql(query);
  const rows = result.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert.equal(rows.length, 1); assert.equal(rows[0].query_role, 'postgres'); assert.equal(rows[0].unrestricted_visibility, true);
  return rows[0];
}

async function managedAuth() {
  return await snapshot(`begin isolation level repeatable read read only;set local search_path='';set local statement_timeout='15s';
select jsonb_build_object('query_role',current_user,'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
 'table','auth.users','owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forced_rls',c.relforcerowsecurity,
 'acl',c.relacl::text,'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,
 'roles',(select jsonb_agg(case when roleid=0 then 'PUBLIC' else pg_get_userbyid(roleid) end order by roleid)from unnest(p.polroles)r(roleid)),
 'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))order by p.polname),'[]')from pg_policy p where p.polrelid=c.oid))
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relname='users';rollback;`);
}

async function main() {
  assert.equal(process.argv.length, 2);
  const report = { run_id: randomUUID(), started_at: new Date().toISOString(), result: 'failed', cloud_called: false, provider_called: false,
    migration: REMAINING_MIGRATION, migration_sha256: MIGRATION_SHA, proof: PROOF, proof_sha256: PROOF_SHA,
    readback: READBACK, readback_sha256: READBACK_SHA, baseline_manifest: BASELINE, baseline_manifest_sha256: BASELINE_SHA,
    harness_sha256: sha256(await readFile(import.meta.filename)), scope: 'Owned local17-to18 exact reviewed DDL/history only; no fixture, provider, native image/config activation or hosted service call.' };
  let ownsLock = false; let dispatched = false; let target;
  try {
    assert.equal(sha256(await readFile(path.join(ROOT, REMAINING_MIGRATION))), MIGRATION_SHA);
    const proofBytes = await readFile(path.join(ROOT, PROOF)); assert.equal(sha256(proofBytes), PROOF_SHA);
    const proof = JSON.parse(proofBytes);
    assert(proof.result === 'passed' && proof.rollback_verified && proof.sources_stable && proof.owned_backend_settled && proof.assertions_passed);
    assert(proof.cloud_called === false && proof.provider_called === false && proof.hosted_credential_files_read === false);
    assert.equal(proof.migration_sha256, MIGRATION_SHA); assert.equal(proof.markers.length, 5);
    for (const [file, hash] of Object.entries(proof.source_seals)) {
      if (file !== 'development/local-db/reviewed.json') assert.equal(sha256(await readFile(path.join(ROOT, file))), hash, 'PROVEN_SOURCE_CHANGED');
    }
    const query = await readFile(path.join(ROOT, READBACK), 'utf8'); assert.equal(sha256(query), READBACK_SHA);
    const baselineBytes = await readFile(path.join(ROOT, BASELINE)); assert.equal(sha256(baselineBytes), BASELINE_SHA);
    assert.equal(proof.source_seals['development/local-db/reviewed.json'], BASELINE_SHA);
    const baseline = JSON.parse(baselineBytes);
    const manifest = JSON.parse(await readFile(path.join(ROOT, 'development/local-db/reviewed.json'), 'utf8'));
    validateRemainingPromotionManifest(manifest, baseline);
    for (const row of manifest.migrations) assert.equal(sha256(await readFile(path.join(ROOT, row.path))), row.sha256);
    const lock = await open(LOCK, 'wx', 0o600);
    try { await lock.writeFile(JSON.stringify({ run_id: report.run_id, pid: process.pid })); ownsLock = true; } finally { await lock.close(); }
    target = await verifyLocalTarget(); assert.equal(target.observed.system_identifier, '7701520506262638626');
    assert.equal(target.config.container, 'eps-presentation-canonical-pg17-local');
    report.before = await snapshot(query); assert.deepEqual(report.before, proof.before);
    report.managed_auth_before = await managedAuth();
    dispatched = true; report.promotion = await runReviewedSqlFile(REMAINING_MIGRATION);
    report.after = await snapshot(query); report.managed_auth_after = await managedAuth();
    report.comparison = compareRemainingLocalPromotion(report.before, report.after, proof);
    assert.deepEqual(report.managed_auth_after, report.managed_auth_before, 'MANAGED_AUTH_CATALOG_CHANGED');
    report.managed_auth_preserved = true;
    report.auth_rls_normalization = { applied: false, reason: 'Reference expected18 was captured before fixture-only Auth RLS enabling; actual managed Auth metadata is independently preserved exactly.' };
    const actual = await verifyLocalTarget(); assert.equal(actual.container.Id, target.container.Id); assert.equal(actual.observed.system_identifier, target.observed.system_identifier);
    report.business_and_old_catalog_preserved = true; report.result = 'passed';
  } catch {
    report.dispatch_attempted = dispatched; report.diagnostic = dispatched ? 'LOCAL18_PROMOTION_OUTCOME_UNCONFIRMED' : 'LOCAL18_PROMOTION_PRECONDITION_UNCONFIRMED';
    if (ownsLock) {
      try { report.unverified_readback = await snapshot(await readFile(path.join(ROOT, READBACK), 'utf8')); report.unverified_managed_auth = await managedAuth(); }
      catch { /* Unknown outcome remains explicit and keeps the lock after dispatch. */ }
    }
    process.exitCode = 1;
  } finally {
    if (ownsLock && (!dispatched || report.result === 'passed')) {
      const lock = JSON.parse(await readFile(LOCK, 'utf8')); assert.equal(lock.run_id, report.run_id); assert.equal(lock.pid, process.pid); await unlink(LOCK);
    }
    report.lock_retained = ownsLock && dispatched && report.result !== 'passed'; report.finished_at = new Date().toISOString();
    const directory = path.join(ROOT, 'tracking/evidence/m03/remaining-promotion'); await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${report.finished_at.replace(/[:.]/gu, '-')}-${report.run_id.slice(0, 8)}.json`);
    await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ result: report.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), cloud_called: false, lock_retained: report.lock_retained, diagnostic: report.diagnostic }) + '\n');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => { process.stderr.write('Local18 promotion stopped; no cloud fallback.\n'); process.exitCode = 1; });
}
