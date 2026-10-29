import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { composeRemainingMigration, REMAINING_FRAGMENTS, REMAINING_MIGRATION, sha256 } from '../../tools/prepare-m03-remaining-migration.mjs';
import { expectedSnapshotFromOutput } from '../../tools/test-m03-remaining-composed.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(await readFile(path.join(root, 'tracking/evidence/m03/remaining-preparation/baseline17-reviewed-manifest.json'), 'utf8'));
const versions = manifest.migrations.map(row => path.basename(row.path).slice(0, 14));
const sources = new Map(await Promise.all(REMAINING_FRAGMENTS.map(async ([file]) => [file, await readFile(path.join(root, file), 'utf8')])));

test('composed18 preserves each reviewed fragment exactly and binds strict17 history', async () => {
  const sql = composeRemainingMigration(versions, sources);
  assert.equal(sql, await readFile(path.join(root, REMAINING_MIGRATION), 'utf8'));
  let previous = -1;
  for (const [file, seal] of REMAINING_FRAGMENTS) {
    assert.equal(sha256(sources.get(file)), seal);
    const marker = `-- Exact reviewed fragment: ${file}\n`;
    const start = sql.indexOf(marker);
    assert(start > previous);
    assert.equal(sql.slice(start + marker.length, start + marker.length + sources.get(file).length), sources.get(file));
    previous = start;
  }
  assert(sql.includes(`array[${versions.map(value => `'${value}'`).join(',')}]::text[]`));
  assert(sql.includes('M03_REMAINING_REVIEWED_SEVENTEEN_REQUIRED'));
});

test('changed reviewed fragment or missing fragment cannot produce executable18', () => {
  const altered = new Map(sources);
  altered.set(REMAINING_FRAGMENTS[0][0], altered.get(REMAINING_FRAGMENTS[0][0]) + '\nselect 1;');
  assert.throws(() => composeRemainingMigration(versions, altered), /REVIEWED_FRAGMENT_CHANGED/u);
  const missing = new Map(sources); missing.delete(REMAINING_FRAGMENTS[2][0]);
  assert.throws(() => composeRemainingMigration(versions, missing));
});

test('ambiguous, reordered or non17 baseline cannot be sealed', () => {
  assert.throws(() => composeRemainingMigration(versions.slice(1), sources), /EXACT_REVIEWED_SEVENTEEN_REQUIRED/u);
  assert.throws(() => composeRemainingMigration([...versions.slice(0, 16), versions[0]], sources));
  assert.throws(() => composeRemainingMigration([...versions].reverse(), sources));
  assert.throws(() => composeRemainingMigration([...versions.slice(0, 16), "20261029100500';select1"], sources));
});

test('snapshot evidence ignores unrelated synthetic fixture JSON outside its exact boundaries', () => {
  const expected = { versions: ['17', '18'], catalog: { functions: [] } };
  assert.deepEqual(expectedSnapshotFromOutput(`{"synthetic":"before"}\nM03_REMAINING_EXPECTED18_SNAPSHOT_BEGIN\n${JSON.stringify(expected)}\nM03_REMAINING_EXPECTED18_SNAPSHOT_END\n{"synthetic":"after"}\n`), expected);
});

test('ambiguous or missing expected snapshot boundaries cannot produce evidence', () => {
  assert.throws(() => expectedSnapshotFromOutput('{"versions":["18"]}\n'), /EXACT_EXPECTED_SNAPSHOT_BEGIN_REQUIRED/u);
  assert.throws(() => expectedSnapshotFromOutput('M03_REMAINING_EXPECTED18_SNAPSHOT_BEGIN\n{}\nM03_REMAINING_EXPECTED18_SNAPSHOT_BEGIN\nM03_REMAINING_EXPECTED18_SNAPSHOT_END\n'), /EXACT_EXPECTED_SNAPSHOT_BEGIN_REQUIRED/u);
  assert.throws(() => expectedSnapshotFromOutput('M03_REMAINING_EXPECTED18_SNAPSHOT_END\n{}\nM03_REMAINING_EXPECTED18_SNAPSHOT_BEGIN\n'), /EXPECTED_SNAPSHOT_ORDER_REQUIRED/u);
  assert.throws(() => expectedSnapshotFromOutput('M03_REMAINING_EXPECTED18_SNAPSHOT_BEGIN\n{}\n{}\nM03_REMAINING_EXPECTED18_SNAPSHOT_END\n'), /EXACT_EXPECTED_SNAPSHOT_ROW_REQUIRED/u);
});
