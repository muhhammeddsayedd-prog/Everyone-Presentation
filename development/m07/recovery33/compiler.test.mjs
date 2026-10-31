import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { Script } from 'node:vm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { compileController33, migration33Adapters, fullCatalogue33Sql, SOURCE_PINS, sha } from './compiler.mjs';
import { ownedPredicate33, ownedRestoreSql33, exactRestoreProfile33Sql, roleCleanup33 } from './ownership.mjs';
const root = path.resolve(import.meta.dirname, '../../..'), runId = '12345678-1234-4234-8234-123456789abc', hex = runId.replaceAll('-', '');
const identity = { database: `eps_m07_r33_source_${hex}`, marker: `eps-m07-recovery33:${runId}:source`, oid: 12345 };
const sources = new Map(await Promise.all(Object.keys(SOURCE_PINS).map(async file => [file, await readFile(path.join(root, file))])));

test('actual emitted full fixture resets the inherited authenticated role before private Auth seeding', async () => {
  const compiled = compileController33(sources, { root, runId, mode: 'full' });
  const anchor = 'const scope = await value(sourceDb, `', start = compiled.source.indexOf(anchor);
  assert(start > 0); const first = start + anchor.length - 1, last = compiled.source.indexOf('`);', first + 1);
  assert(last > first);
  const baseFixture = await readFile(path.join(root, 'tests/db/m04-assignments-fixture.sql'), 'utf8');
  const versionFixture = await readFile(path.join(root, 'tests/db/m05-versions-fixture.sql'), 'utf8');
  const seed = await readFile(path.join(root, 'development/m07/recovery33/seed-auth.sql'), 'utf8');
  assert(/set local role authenticated;\s*$/u.test(baseFixture));
  // Evaluate only the generated template in an isolated VM with fixed synthetic ports; no SQL or controller code runs.
  const wire = new Script(compiled.source.slice(first, last + 1)).runInNewContext({ baseFixture, versionFixture,
    recovery33: { seedSql: () => seed }, actor: '8a1a0000-0000-4000-8000-000000000001',
    videoId: '8a9f0000-0000-4000-8000-000000000001', mediaId: '8a9f0000-0000-4000-8000-000000000002',
    media: { bytes: Buffer.from('synthetic'), probe: { width: 320, height: 240, duration_ms: 1000 } }, suffix: hex, sha,
  }, { timeout: 1000 });
  const seedAt = wire.indexOf('insert into auth.oauth_clients'); assert(seedAt > 0);
  const roles = [...wire.slice(0, seedAt).matchAll(/\bset\s+local\s+role\s+([a-z_]+)\s*;/giu)].map(match => match[1]);
  assert.equal(roles.at(-1), 'postgres');
  assert(wire.includes(baseFixture) && wire.includes(seed) && wire.includes(versionFixture));
  assert.equal((wire.match(/insert into auth\.oauth_clients/gu) ?? []).length, 1);
});

test('new controller compiles frozen29 once-only changes and keeps native/full mode separately reviewable', () => {
  for (const mode of ['metadata', 'full']) {
    const result = compileController33(sources, { root, runId, mode });
    assert.equal(sha(result.source), result.manifest.generated_source_sha256);
    assert(result.manifest.substitutions.every(value => value.expected_count === 1));
    assert(result.source.includes(`if (${mode === 'full'}) {`));
    assert(result.source.includes('expectedSourceCatalogue'));
    assert(result.source.includes('sourcePaths.push(...'));
    assert(result.source.includes('tracking/evidence/m07/recovery33/2026-10-31-auth-schema-migrations-acl-semantic-proof.json'));
    assert(result.source.includes('recovery33.cleanupRoles()'));
    assert(result.source.includes('development/m07/recovery33/retained533-profile.mjs'));
    assert(result.source.includes('recovery33?.profileEvidence()'));
    assert(result.source.includes('tracking/evidence/m07/recovery33/2026-10-31-retained533-acl-native-semantics.json'));
    assert(result.source.includes('await restoreOwnedDump(sourceDb,initialDump)'));
    assert(!result.source.includes('await docker(psqlArgs(sourceDb), { input: initialDump })'));
    assert(!result.source.includes('const sourceDb = `eps_m07_r29_'));
    assert.equal(result.manifest.database_executed, false);
  }
});
test('clean dump byte restoration requires an in-connection owned identity and refuses target-changing dumps', () => {
  const dump = Buffer.from('-- synthetic exact dump\ncreate table public.synthetic_restore(id integer);\n');
  const sql = ownedRestoreSql33(dump, identity);
  const position = sql.indexOf(dump); assert(position > 0); assert(sql.subarray(position, position + dump.length).equals(dump));
  assert(sql.toString('utf8').indexOf(ownedPredicate33(identity)) < sql.toString('utf8').indexOf('create table'));
  for (const input of ['\\connect postgres\n', '\\c other\n', 'create database other;\n', 'drop database other;\n']) {
    assert.throws(() => ownedRestoreSql33(Buffer.from(input), identity), /RECOVERY33_DUMP_TARGET_CHANGE_FORBIDDEN/u);
  }
  assert.throws(() => ownedRestoreSql33(dump, { ...identity, database: 'postgres' }));
  assert.throws(() => ownedRestoreSql33(dump, { ...identity, oid: 0 }));
});

test('source pin and exact frozen substitution deny modified historical sources', () => {
  const tampered = new Map(sources); tampered.set('development/m07/recovery29/run.mjs', Buffer.from('private-untrusted-source'));
  assert.throws(() => compileController33(tampered, { root, runId }), /RECOVERY33_FROZEN_SOURCE_CHANGED/u);
  assert.throws(() => compileController33(sources, { root, runId: '../escape' }));
});

test('all four real DDL suffixes stay byte exact and only local target admission changes', () => {
  const result = migration33Adapters(sources, identity);
  assert.equal(result.migrations.length, 4); assert(result.substitutions.every(value => value.expected_count === 1));
  assert.deepEqual(result.migrations.map(value => value.version), ['20261030154824', '20261031010000', '20261031104603', '20261031130207']);
  for (const migration of result.migrations) {
    assert.equal(migration.only_local_admission_changed, true); assert(migration.sql.includes(ownedPredicate33(identity)));
    assert.notEqual(migration.source_sha256, migration.adapted_sha256);
  }
});

test('full33 catalogue includes restored native Auth surfaces while retaining unknown-pair refusal', () => {
  const result = fullCatalogue33Sql(sources);
  assert(result.sql.includes("n.nspname in('eps','public','auth','storage')"));
  assert(result.substitutions.every(value => value.expected_count === 1));
  const planned = exactRestoreProfile33Sql({}, {}, identity); assert.deepEqual(planned.differences, []);
  assert(planned.sql.includes(identity.database)); assert(!planned.sql.includes('eps_m07_r29_source_'));
  assert.throws(() => exactRestoreProfile33Sql({ 'new|unknown|field': 'one' }, { 'new|unknown|field': 'two' }, identity), /RECOVERY29_UNKNOWN_CATALOGUE_PAIR/u);
  assert.throws(() => ownedPredicate33({ ...identity, database: 'postgres' }));
});

test('new role cleanup requires exact run/OID/attributes/dependencies/membership observations', () => {
  const expected = { name: 'eps_mcp_issuer_owner', attempted: true, marker: `eps-m07-recovery33:${runId}:issuer`, oid: 12346, memberships: [] };
  const observed = { name: expected.name, marker: expected.marker, oid: '12346', login: false, super: false, inherit: false, bypassrls: false,
    create_role: false, create_db: false, replication: false, connection_limit: -1, valid_until: null, clients: 0, dependencies: [], memberships: [] };
  assert.equal(roleCleanup33(expected, observed).can_drop, true);
  for (const patch of [{ oid: 12347 }, { marker: 'unowned' }, { login: true }, { dependencies: ['other-database'] }, { memberships: [{ member: 'unrelated' }] }]) {
    assert.throws(() => roleCleanup33(expected, { ...observed, ...patch }));
  }
});
