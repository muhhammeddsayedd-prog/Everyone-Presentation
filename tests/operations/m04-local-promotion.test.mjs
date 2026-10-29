import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { URL } from 'node:url';
import { CASTING_BASELINE, CASTING_MIGRATION } from '../../tools/prepare-m04-casting-migration.mjs';
import { CASTING_MIGRATION_SHA, CASTING_PROOF, compareCastingLocalPromotion, validateCastingPromotionManifest } from '../../tools/promote-m04-casting-local.mjs';
const root = new URL('../../', import.meta.url);
const baseline = JSON.parse(await readFile(new URL(CASTING_BASELINE, root)));
const proof = JSON.parse(await readFile(new URL(CASTING_PROOF, root)));
const manifest = () => ({ ...globalThis.structuredClone(baseline), migrations: [...globalThis.structuredClone(baseline.migrations), { path: CASTING_MIGRATION, sha256: CASTING_MIGRATION_SHA, reviewed_by: 'Synthetic offline manifest fixture', reviewed_at: '2026-10-29T18:00:00Z' }] });

test('reviewed20 manifest is additive and pinned to exact reviewed migration bytes', () => {
  validateCastingPromotionManifest(manifest(), baseline);
  for (const change of ['prior', 'sha', 'path', 'review', 'date', 'extra']) {
    const changed = manifest();
    if (change === 'prior') changed.migrations[0].sha256 = '0'.repeat(64);
    else if (change === 'sha') changed.migrations[19].sha256 = '0'.repeat(64);
    else if (change === 'path') changed.migrations[19].path = 'supabase/migrations/20261029174841_unreviewed.sql';
    else if (change === 'review') changed.migrations[19].reviewed_by = '';
    else if (change === 'date') changed.migrations[19].reviewed_at = 'invalid';
    else changed.migrations.push(changed.migrations[19]);
    assert.throws(() => validateCastingPromotionManifest(changed, baseline), change);
  }
});
test('exact rollback-proven local19-to20 state passes', () => {
  const result = compareCastingLocalPromotion(proof.before, proof.expected, proof);
  assert.equal(result.business_rows_preserved, true); assert.equal(result.new_casting_tables_empty, true);
});
test('new fixture rows, changed old facts/config/runtime or unexpected authority are denied', () => {
  for (const change of ['fixture', 'fact', 'runtime', 'permission', 'old_history']) {
    const after = globalThis.structuredClone(proof.expected); const before = globalThis.structuredClone(proof.before);
    if (change === 'fixture') after.counts['eps.assignments'] = 1;
    else if (change === 'fact') after.data_sha256['eps.jobs'] = '0'.repeat(64);
    else if (change === 'runtime') after.runtime = { unreviewed: true };
    else if (change === 'permission') after.catalog.functions[0].execute.authenticated = !after.catalog.functions[0].execute.authenticated;
    else before.versions = before.versions.slice(1);
    assert.throws(() => compareCastingLocalPromotion(before, after, proof), change);
  }
});
