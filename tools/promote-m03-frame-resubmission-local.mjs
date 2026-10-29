/** Fixed reviewed18->19 local promotion; root must review and extend the manifest first. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { runOwnedLocalSql, runReviewedSqlFile, verifyLocalTarget } from './local-postgres.mjs';
import { sha256 } from './prepare-m03-remaining-migration.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const MIGRATION = 'supabase/migrations/20261029135318_m03_frame_request_resubmission.sql';
const MIGRATION_SHA = 'e816ad6b491626ace489efd256b56c322d25d9101de94e5fb8b24d2d4b745048';
const PROOF = 'tracking/evidence/m03/frame-resubmission-local/2026-10-29T13-58-19-049Z-f0b71f9a.json';
const PROOF_SHA = '73368b041323340ecc2009bb4432cabb311b8a961a96d48f788547227b28f676';
const QUERY = 'tools/sql/m03-remaining-readback.sql';
const QUERY_SHA = 'c8e74d2bd7399682c984ad79b8f1732fd074056bf6ac065c19407948bfcc7b72';
const BASELINE = 'tracking/evidence/m03/remaining-preparation/baseline18-reviewed-manifest.json';
const BASELINE_SHA = 'ac7a72b6e694e69ad6d59441ccb5b3f65d4de2ea9965c787489ce4e96c230853';
const LOCK = path.join(ROOT, '.local/local-postgres/test-db.lock');
const FUNCTION = 'public.eps_extract_candidate_frames(uuid, jsonb, text)';

export function validateFrameResubmissionManifest(manifest, baseline) {
  assert.equal(baseline.migrations.length, 18); assert.equal(manifest.migrations.length, 19, 'REVIEWED_NINETEEN_MANIFEST_REQUIRED');
  assert.deepEqual(manifest.migrations.slice(0, 18), baseline.migrations, 'PREVIOUS_EIGHTEEN_MANIFEST_ENTRIES_CHANGED');
  assert.equal(manifest.migrations[18].path, MIGRATION); assert.equal(manifest.migrations[18].sha256, MIGRATION_SHA);
}
export function compareFrameResubmissionPromotion(before, after, proof) {
  assert.deepEqual(before, proof.before, 'FRESH_LOCAL18_DIFFERS_FROM_PROVEN_BASELINE');
  assert.deepEqual(after, proof.expected, 'LOCAL19_DIFFERS_FROM_EXACT_REVIEWED_STATE');
  assert.deepEqual(after.versions, [...before.versions, '20261029135318']);
  for (const [key, value] of Object.entries(before)) if (!['catalog', 'versions'].includes(key)) assert.deepEqual(after[key], value);
  const masked = globalThis.structuredClone(after.catalog);
  const previous = before.catalog.functions.find(row => row.signature === FUNCTION); const current = masked.functions.find(row => row.signature === FUNCTION);
  assert.equal(previous.source_sha256, proof.changed_function.before_sha256); assert.equal(current.source_sha256, proof.changed_function.after_sha256);
  assert.notEqual(previous.source_sha256, current.source_sha256); current.source_sha256 = previous.source_sha256; assert.deepEqual(masked, before.catalog);
  return { business_rows_preserved: true, only_one_reviewed_function_body_changed: true, all_other_catalog_and_runtime_preserved: true, local_runtime_role_present: before.runtime !== null };
}
async function readSnapshot(query) {
  const response = await runOwnedLocalSql(query); const rows = response.stdout.split(/\r?\n/u).filter(line => line.startsWith('{')).map(line => JSON.parse(line)); assert.equal(rows.length, 1); return rows[0];
}
async function managedAuth() {
  return await readSnapshot(`begin read only;select jsonb_build_object('owner',pg_get_userbyid(relowner),'rls',relrowsecurity,'forced_rls',relforcerowsecurity,'acl',relacl::text)from pg_class where oid='auth.users'::regclass;rollback;`);
}
async function main() {
  assert.equal(process.argv.length, 2);
  const report = { run_id: randomUUID(), started_at: new Date().toISOString(), result: 'failed', cloud_called: false, provider_called: false,
    migration: MIGRATION, migration_sha256: MIGRATION_SHA, proof: PROOF, proof_sha256: PROOF_SHA, readback: QUERY, readback_sha256: QUERY_SHA,
    baseline_manifest: BASELINE, baseline_manifest_sha256: BASELINE_SHA, harness_sha256: sha256(await readFile(import.meta.filename)),
    scope: 'Exact reviewed18-to19 local function/history change only. No fixtures, native/provider, hosting or configuration activation.' };
  let ownsLock = false; let dispatched = false;
  try {
    const bytes = await readFile(path.join(ROOT, PROOF)); assert.equal(sha256(bytes), PROOF_SHA); const proof = JSON.parse(bytes);
    assert(proof.result === 'passed' && proof.red_reproduced && proof.assertions_passed && proof.only_reviewed_function_body_changed && proof.rollback_verified && proof.sources_stable && proof.owned_backend_settled && proof.cloud_called === false && proof.provider_called === false);
    assert.equal(proof.migration, MIGRATION); assert.equal(proof.migration_sha256, MIGRATION_SHA);
    for (const [file, hash] of Object.entries(proof.source_seals)) if (file !== 'development/local-db/reviewed.json') assert.equal(sha256(await readFile(path.join(ROOT, file))), hash, 'PROVEN_SOURCE_CHANGED');
    const baselineBytes = await readFile(path.join(ROOT, BASELINE)); assert.equal(sha256(baselineBytes), BASELINE_SHA); assert.equal(proof.source_seals['development/local-db/reviewed.json'], BASELINE_SHA);
    const baseline = JSON.parse(baselineBytes); const manifest = JSON.parse(await readFile(path.join(ROOT, 'development/local-db/reviewed.json'), 'utf8')); validateFrameResubmissionManifest(manifest, baseline);
    for (const entry of manifest.migrations) assert.equal(sha256(await readFile(path.join(ROOT, entry.path))), entry.sha256);
    const query = await readFile(path.join(ROOT, QUERY), 'utf8'); assert.equal(sha256(query), QUERY_SHA); assert.equal(sha256(await readFile(path.join(ROOT, MIGRATION))), MIGRATION_SHA);
    const lock = await open(LOCK, 'wx', 0o600); try { await lock.writeFile(JSON.stringify({ run_id: report.run_id, pid: process.pid })); ownsLock = true; } finally { await lock.close(); }
    const target = await verifyLocalTarget(); assert.equal(target.observed.system_identifier, '7701520506262638626'); assert.equal(target.config.container, 'eps-presentation-canonical-pg17-local');
    report.before = await readSnapshot(query); assert.equal(report.before.query_role, 'postgres'); assert.equal(report.before.unrestricted_visibility, true); assert.deepEqual(report.before, proof.before);
    report.managed_auth_before = await managedAuth(); assert.deepEqual(report.managed_auth_before, proof.managed_auth_before);
    dispatched = true; report.promotion = await runReviewedSqlFile(MIGRATION);
    report.after = await readSnapshot(query); report.managed_auth_after = await managedAuth(); report.comparison = compareFrameResubmissionPromotion(report.before, report.after, proof);
    assert.deepEqual(report.managed_auth_after, report.managed_auth_before); report.managed_auth_preserved = true;
    const actual = await verifyLocalTarget(); assert.equal(actual.container.Id, target.container.Id); assert.equal(actual.observed.system_identifier, target.observed.system_identifier);
    report.business_and_old_catalog_preserved = true; report.only_reviewed_function_body_changed = true; report.result = 'passed';
  } catch {
    report.dispatch_attempted = dispatched; report.diagnostic = dispatched ? 'LOCAL19_PROMOTION_OUTCOME_UNCONFIRMED' : 'LOCAL19_PROMOTION_PRECONDITION_UNCONFIRMED';
    if (ownsLock) { try { report.unverified_readback = await readSnapshot(await readFile(path.join(ROOT, QUERY), 'utf8')); report.unverified_managed_auth = await managedAuth(); } catch { /* Unknown write outcome keeps lock. */ } }
    process.exitCode = 1;
  } finally {
    if (ownsLock && (!dispatched || report.result === 'passed')) { const lock = JSON.parse(await readFile(LOCK, 'utf8')); assert.equal(lock.run_id, report.run_id); assert.equal(lock.pid, process.pid); await unlink(LOCK); }
    report.lock_retained = ownsLock && dispatched && report.result !== 'passed'; report.finished_at = new Date().toISOString();
    const directory = path.join(ROOT, 'tracking/evidence/m03/frame-resubmission-promotion'); await mkdir(directory, { recursive: true }); const file = path.join(directory, `${report.finished_at.replace(/[:.]/gu, '-')}-${report.run_id.slice(0, 8)}.json`); await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ result: report.result, receipt: path.relative(ROOT, file).replaceAll('\\', '/'), cloud_called: false, lock_retained: report.lock_retained, diagnostic: report.diagnostic }) + '\n');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => { process.stderr.write('Local19 promotion stopped; no cloud fallback.\n'); process.exitCode = 1; });
}
