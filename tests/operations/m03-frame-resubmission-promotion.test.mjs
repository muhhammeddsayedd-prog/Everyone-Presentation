import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { compareFrameResubmissionPromotion, validateFrameResubmissionManifest } from '../../tools/promote-m03-frame-resubmission-local.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const proof = JSON.parse(await readFile(path.join(root, 'tracking/evidence/m03/frame-resubmission-local/2026-10-29T13-58-19-049Z-f0b71f9a.json'), 'utf8'));
const baseline = JSON.parse(await readFile(path.join(root, 'tracking/evidence/m03/remaining-preparation/baseline18-reviewed-manifest.json'), 'utf8'));

test('local19 admission requires the exact forward migration and all18 old manifest entries', () => {
  const next = { ...baseline, migrations: [...baseline.migrations, { path: proof.migration, sha256: proof.migration_sha256 }] };
  validateFrameResubmissionManifest(next, baseline);
  assert.throws(() => validateFrameResubmissionManifest(baseline, baseline), /REVIEWED_NINETEEN_MANIFEST_REQUIRED/u);
  const rewritten = globalThis.structuredClone(next); rewritten.migrations[17].sha256 = '0'.repeat(64);
  assert.throws(() => validateFrameResubmissionManifest(rewritten, baseline), /PREVIOUS_EIGHTEEN_MANIFEST_ENTRIES_CHANGED/u);
  const other = globalThis.structuredClone(next); other.migrations[18].path = 'supabase/migrations/20990101000000_unreviewed.sql';
  assert.throws(() => validateFrameResubmissionManifest(other, baseline));
});
test('proven forward19 changes one function body while all previous data and privileges stay exact', () => {
  const value = compareFrameResubmissionPromotion(proof.before, proof.expected, proof);
  assert.equal(value.only_one_reviewed_function_body_changed, true); assert.equal(value.business_rows_preserved, true); assert.equal(value.local_runtime_role_present, false);
});
test('unrelated source, ACL or business mutations cannot be promoted as the reviewed19', () => {
  for (const mutate of [
    value => { value.catalog.functions[0].source_sha256 = '0'.repeat(64); },
    value => { value.catalog.functions[0].public_execute = true; },
    value => { value.counts['eps.candidates']++; },
  ]) { const changed = globalThis.structuredClone(proof.expected); mutate(changed); assert.throws(() => compareFrameResubmissionPromotion(proof.before, changed, proof), /LOCAL19_DIFFERS_FROM_EXACT_REVIEWED_STATE/u); }
});
