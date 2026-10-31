import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { exactPreimageAdmission, roleCleanupSql33 } from './runtime.mjs';
import { compileController33, staticControllerSql33, fullCatalogue33Sql, migration33Adapters, SOURCE_PINS } from './compiler.mjs';
import { ownedRestoreSql33 } from './ownership.mjs';

const root = path.resolve(import.meta.dirname, '../../..');
const sources = new Map(await Promise.all(Object.keys(SOURCE_PINS).map(async file => [file, await readFile(path.join(root, file))])));
const identity = { database: 'eps_m07_r33_source_12345678123442348234123456789abc', marker: 'eps-m07-recovery33:12345678-1234-4234-8234-123456789abc:source', oid: 12345 };
test('owned role cleanup directly drops the exact guarded role, retaining downstream grant graph checks', () => {
  const name = 'eps_oauth_consent_owner';
  const memberships = [
    { role: name, member: 'postgres', grantor: 'supabase_admin', admin: true, inherit: false, set: false },
    { role: name, member: 'postgres', grantor: 'postgres', admin: false, inherit: true, set: true },
  ];
  const expected = { name, attempted: true, marker: 'eps-m07-recovery33:12345678-1234-4234-8234-123456789abc:consent', oid: 12345, memberships };
  const observed = { name, marker: expected.marker, oid: '12345', login: false, super: false, inherit: false, bypassrls: false,
    create_role: false, create_db: false, replication: false, connection_limit: -1, valid_until: null, clients: 0, dependencies: [], memberships };
  const sql = roleCleanupSql33(expected, observed);
  assert(!/\brevoke\b|\bcascade\b|\bdrop owned\b|\breassign owned\b/iu.test(sql));
  assert(sql.includes(`drop role ${name};commit;`));
  assert(sql.indexOf('RECOVERY33_OWNED_ROLE_CLEANUP_REQUIRED') < sql.indexOf(`drop role ${name};`));
  assert(sql.includes('lock table pg_authid,pg_auth_members,pg_shdepend in share row exclusive mode'));
  for (const changed of [{ ...observed, oid: '12346' }, { ...observed, marker: expected.marker + 'other' },
    { ...observed, memberships: memberships.slice(0, 1) }, { ...observed, dependencies: [{ dbid: 100 }] },
    { ...observed, clients: 1 }, { ...observed, super: true }]) assert.throws(() => roleCleanupSql33(expected, changed));
});
test('owned admission checks full in-transaction catalogue and protected-data preimages before functional DDL', () => {
  const catalogueSql = fullCatalogue33Sql(sources).sql;
  const admission = exactPreimageAdmission({ catalogueSql, catalogue: { 'functions|private|source_sha256': "synthetic'quoted" },
    dataSql: '-- synthetic read-only projection', data: { versions: ['one'], table_hash: 'synthetic' }, identity });
  assert(admission.includes('current_user<>\'postgres\''));
  assert(admission.includes('oid = 12345 and'));
  assert(admission.includes("synthetic''quoted"));
  assert(admission.includes("current_setting('eps.m07_readback.old_data')::jsonb is distinct from"));
  assert(!/oid = \d+and/u.test(admission));
  assert.throws(() => exactPreimageAdmission({ catalogueSql: 'unrecognized', catalogue: {}, dataSql: '', data: {}, identity }));
});
test('native prerequisite contains no artificial migration history and synthetic config excludes all real secrets', async () => {
  const prerequisite = await readFile(path.join(root, 'development/m07/recovery33/native-auth-prerequisite.sql'), 'utf8');
  assert(!/insert\s+into\s+supabase_migrations/iu.test(prerequisite));
  assert(!/drop\s+(?:table|schema)|create\s+table\s+auth\.(?:users|sessions)\b/iu.test(prerequisite));
  const config = JSON.parse(await readFile(path.join(root, 'development/m07/recovery33/provider-config.synthetic.json'), 'utf8'));
  assert.equal(config.provenance, 'synthetic_inventory_only'); assert.equal(config.secrets_included, false);
  assert.equal(config.signing_keys_included, false); assert.equal(config.provider_configuration_applied, false);
});
test('installed PostgreSQL parsers accept the emitted local migration wire, prerequisite, seed and ownership predicates', async () => {
  const wire = migration33Adapters(sources, identity).migrations.map(value => value.sql);
  const generated = compileController33(sources, { root, runId: '12345678-1234-4234-8234-123456789abc', mode: 'metadata' });
  wire.push(...Object.values(staticControllerSql33(generated.source)));
  wire.push(await readFile(path.join(root, 'development/m07/recovery33/native-auth-prerequisite.sql'), 'utf8'));
  wire.push(await readFile(path.join(root, 'development/m07/recovery33/seed-auth.sql'), 'utf8'));
  wire.push(exactPreimageAdmission({ catalogueSql: fullCatalogue33Sql(sources).sql, catalogue: {},
    dataSql: sources.get('development/m07/db/data29.sql').toString('utf8'), data: {}, identity }));
  const expected = { name: 'eps_mcp_issuer_owner', attempted: true, marker: 'eps-m07-recovery33:12345678-1234-4234-8234-123456789abc:issuer', oid: 12345, memberships: [] };
  const observed = { name: expected.name, marker: expected.marker, oid: '12345', login: false, super: false, inherit: false, bypassrls: false,
    create_role: false, create_db: false, replication: false, connection_limit: -1, valid_until: null, clients: 0, dependencies: [], memberships: [] };
  wire.push(roleCleanupSql33(expected, observed));
  wire.push(ownedRestoreSql33(Buffer.from('create table public.synthetic_restore(id integer);'), identity).toString('utf8'));
  const script = "import json,sys\nfrom pglast import parse_sql,parse_plpgsql\nvalues=json.load(sys.stdin)\nfor sql in values:\n parse_sql(sql)\n parse_plpgsql(sql)\nprint(json.dumps({'parsed':len(values)}))";
  const result = spawnSync(path.join(root, '.venv-skills/Scripts/python.exe'), ['-X', 'utf8', '-c', script], {
    input: JSON.stringify(wire), encoding: 'utf8', windowsHide: true, shell: false, timeout: 15000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), { parsed: wire.length });
});
test('the actual generated all-global-role preflight query parses before any database creation', () => {
  const compiled = compileController33(sources, { root, runId: '12345678-1234-4234-8234-123456789abc', mode: 'metadata' });
  const query = staticControllerSql33(compiled.source).rolesSql; assert(query);
  assert(!query.includes("rolname like'eps_%'")); assert(!query.includes("member::regrole::text like'eps_%'"));
  const result = spawnSync(path.join(root, '.venv-skills/Scripts/python.exe'), ['-X', 'utf8', '-c',
    "from pglast import parse_sql;import sys;parse_sql(sys.stdin.read());print('PARSED')"], {
    input: query, encoding: 'utf8', windowsHide: true, shell: false, timeout: 10000, maxBuffer: 65536 });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), 'PARSED');
});
