import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { compareRemainingLocalPromotion, validateRemainingPromotionManifest } from '../../tools/promote-m03-remaining-local.mjs';
import { REMAINING_MIGRATION } from '../../tools/prepare-m03-remaining-migration.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const proof = JSON.parse(await readFile(path.join(root, 'tracking/evidence/m03/remaining-composed-local/2026-10-29T13-43-40-528Z-97b70205.json'), 'utf8'));
const baseline = JSON.parse(await readFile(path.join(root, 'tracking/evidence/m03/remaining-preparation/baseline17-reviewed-manifest.json'), 'utf8'));
const reviewed = { ...baseline, migrations: [...baseline.migrations, { path: REMAINING_MIGRATION, sha256: proof.migration_sha256 }] };

test('promotion needs exact18 manifest while every historical migration entry stays fixed', () => {
  validateRemainingPromotionManifest(reviewed, baseline);
  assert.throws(() => validateRemainingPromotionManifest(baseline, baseline), /REVIEWED_MANIFEST_EIGHTEEN_REQUIRED/u);
  const rewritten = globalThis.structuredClone(reviewed); rewritten.migrations[0].sha256 = '0'.repeat(64);
  assert.throws(() => validateRemainingPromotionManifest(rewritten, baseline), /OLD_MIGRATION_MANIFEST_CHANGED/u);
  const substituted = globalThis.structuredClone(reviewed); substituted.migrations[17].sha256 = '0'.repeat(64);
  assert.throws(() => validateRemainingPromotionManifest(substituted, baseline));
});

test('exact proven18 preserves all previous business hashes and honestly records absent local runtime', () => {
  const result = compareRemainingLocalPromotion(proof.before, proof.expected, proof);
  assert.equal(result.business_rows_preserved, true);
  assert.equal(result.old_catalog_preserved_except_exact_reviewed_delta, true);
  assert.equal(result.local_runtime_role_present, false);
});

test('pre-existing data drift or an unrelated new privilege cannot pass the promotion comparison', () => {
  const changedData = globalThis.structuredClone(proof.expected);
  changedData.data_sha256['eps.candidates'] = '0'.repeat(64);
  assert.throws(() => compareRemainingLocalPromotion(proof.before, changedData, proof), /LOCAL18_DIFFERS_FROM_EXACT_REVIEWED_STATE/u);
  const changedAcl = globalThis.structuredClone(proof.expected);
  changedAcl.catalog.functions[0].explicit_acl.push({ grantor: 'postgres', grantee: 'authenticated', privilege: 'EXECUTE', grantable: true });
  assert.throws(() => compareRemainingLocalPromotion(proof.before, changedAcl, proof), /LOCAL18_DIFFERS_FROM_EXACT_REVIEWED_STATE/u);
  const stale = globalThis.structuredClone(proof.before); stale.counts['eps.candidates']++;
  assert.throws(() => compareRemainingLocalPromotion(stale, proof.expected, proof), /FRESH_LOCAL17_DIFFERS_FROM_PROVEN_BASELINE/u);
});
