import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { URL } from 'node:url';
import { CASTING_BASELINE, CASTING_FRAGMENTS, CASTING_MIGRATION, CASTING_VERSION, composeCastingMigration } from '../../tools/prepare-m04-casting-migration.mjs';

const root = new URL('../../', import.meta.url);
const baseline = await readFile(new URL(CASTING_BASELINE, root));
const sources = new Map(await Promise.all(CASTING_FRAGMENTS.map(async ([file]) => [file, await readFile(new URL(file, root))])));

test('migration20 retains both reviewed fragments in exact atomic order and bytes', async () => {
  const actual = composeCastingMigration(baseline, sources);
  const kernel = sources.get(CASTING_FRAGMENTS[0][0]); const lifecycle = sources.get(CASTING_FRAGMENTS[1][0]);
  assert(actual.indexOf(kernel) >= 0); assert(actual.indexOf(lifecycle) > actual.indexOf(kernel) + kernel.length);
  assert(actual.equals(await readFile(new URL(CASTING_MIGRATION, root))));
  assert(!/^\s*(?:begin\s*;|commit\s*;|rollback\s*;|start\s+transaction\b|\\)/imu.test(actual.toString('utf8')));
  assert(actual.includes(Buffer.from('M04_RELEASE_EXACT_REVIEWED_NINETEEN_REQUIRED')));
  assert(!actual.includes(Buffer.from(`values('${CASTING_VERSION}'`)));
});
test('changed or reordered baseline manifest is denied rather than regenerated from current history', () => {
  const altered = JSON.parse(baseline); altered.migrations.reverse();
  assert.throws(() => composeCastingMigration(Buffer.from(JSON.stringify(altered)), sources), /EXACT_REVIEWED_NINETEEN/);
});
test('a table-only composition or additional unknown fragment is denied', () => {
  const missing = new Map(sources); missing.delete(CASTING_FRAGMENTS[1][0]);
  assert.throws(() => composeCastingMigration(baseline, missing), /BOTH_ATOMIC/);
  const extra = new Map(sources); extra.set('unreviewed.sql', Buffer.from('select 1;'));
  assert.throws(() => composeCastingMigration(baseline, extra), /BOTH_ATOMIC/);
});
test('a changed lifecycle or kernel byte is denied even if semantically equivalent', () => {
  for (const [file] of CASTING_FRAGMENTS) {
    const changed = new Map(sources); changed.set(file, Buffer.concat([changed.get(file), Buffer.from('\n')]));
    assert.throws(() => composeCastingMigration(baseline, changed), /REVIEWED_CASTING_FRAGMENT_CHANGED/);
  }
});
