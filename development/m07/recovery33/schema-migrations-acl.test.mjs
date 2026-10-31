import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { exactRestoreProfile33Sql, ownedPredicate33 } from './ownership.mjs';
import { assertAclSemanticProof33 } from './acl-semantics-proof.mjs';
const runId = '12345678-1234-4234-8234-123456789abc', hex = runId.replaceAll('-', '');
const identity = { database: 'eps_m07_r33_source_' + hex, marker: `eps-m07-recovery33:${runId}:source`, oid: 12345 };
const key = 'tables|auth.schema_migrations|acl';
const expected = { [key]: '{supabase_auth_admin=arwdDxtm/supabase_auth_admin}', 'tables|auth.schema_migrations|owner': 'supabase_auth_admin',
  'tables|auth.schema_migrations|rls': false, 'tables|auth.schema_migrations|force_rls': false };
const observed = { ...expected, [key]: null };

test('one actually observed owner-default ACL pair produces only an owned owner-grant correction', () => {
  const plan = exactRestoreProfile33Sql(expected, observed, identity);
  assert.deepEqual(plan.differences, [key]); assert(plan.sql.includes(ownedPredicate33(identity)));
  assert(plan.sql.includes('relowner=16504')); assert(plan.sql.includes('relacl is null'));
  assert(plan.sql.includes('set local role supabase_auth_admin;grant all privileges on table auth.schema_migrations to supabase_auth_admin;set local role postgres;'));
  assert(!/grant.*to public\b|grant.*to authenticated\b|grant.*to anon\b|grant.*to service_role\b/iu.test(plan.sql));
});
test('changed grant options, grantees, owner, table flags and unrelated differences stay refused', () => {
  for (const patch of [{ [key]: '{supabase_auth_admin=arwdDxtm*/supabase_auth_admin}' },
    { [key]: '{supabase_auth_admin=arwdDxtm/supabase_auth_admin,postgres=r/supabase_auth_admin}' },
    { 'tables|auth.schema_migrations|owner': 'postgres' }, { 'tables|auth.schema_migrations|rls': true },
    { 'tables|auth.schema_migrations|force_rls': true }, { 'unknown|new|field': true }]) {
    assert.throws(() => exactRestoreProfile33Sql(expected, { ...observed, ...patch }, identity));
  }
  assert.throws(() => exactRestoreProfile33Sql(expected, observed, { ...identity, database: 'postgres' }));
  assert.throws(() => exactRestoreProfile33Sql({ [key]: expected[key] }, { [key]: null }, identity));
});
test('already identical owner ACLs remain unchanged and observation provenance is byte sealed', async () => {
  assert.deepEqual(exactRestoreProfile33Sql(expected, expected, identity).differences, []);
  const bytes = await readFile(new URL('./schema-migrations-acl-observation.json', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'ae00c7258469b913bc82be4f06a4aebb6c0467f26841423a97ee28b9512adf4a');
  const observation = JSON.parse(bytes); assert.equal(observation.provenance, 'actual_owned_local_dump_observation');
  assert.equal(observation.pair.source, expected[key]); assert.equal(observation.pair.dump_clone, null);
  assert.equal(observation.pair.owner_role_oid, '16504');
});
test('semantic proof projection refuses changed privilege, grantor, grant options and private/unknown fields', () => {
  const entries = ['DELETE', 'INSERT', 'MAINTAIN', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE']
    .map(privilege => ({ grantor_oid: '16504', grantee_oid: '16504', privilege, grantable: false }));
  const valid = { scope: 'exact_local29_read_only_acl_semantics', owner_role_oid: 16504, owner_role_name: 'supabase_auth_admin',
    explicit_entry_count: 8, default_entry_count: 8, symmetric_difference_count: 0, expanded_explicit: entries, expanded_default: structuredClone(entries),
    source_owner_only: true, default_owner_only: true };
  assert.equal(assertAclSemanticProof33(valid).symmetric_difference, 0);
  for (const mutate of [value => { value.expanded_default[0].grantable = true; }, value => { value.expanded_explicit[0].grantor_oid = '16384'; },
    value => { value.expanded_default[0].privilege = 'UNKNOWN'; }, value => { value.symmetric_difference_count = 1; },
    value => { value.private = 'private-value'; }]) {
    const changed = structuredClone(valid); mutate(changed); assert.throws(() => assertAclSemanticProof33(changed));
  }
});
test('actual read-only proof and exact new correction SQL retain their source binding and parse', async () => {
  const root = path.resolve(import.meta.dirname, '../../..');
  const bytes = await readFile(path.join(root, 'tracking/evidence/m07/recovery33/2026-10-31-auth-schema-migrations-acl-semantic-proof.json'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'aeaff1879563b96acadf05ef8f885b8602bf5d225209e95c0721506bcca8a813');
  const proof = JSON.parse(bytes); assert.equal(proof.read_only, true); assert.equal(proof.cloud_called, false);
  assert.equal(assertAclSemanticProof33(proof.metadata).owner_only, true);
  const source = await readFile(path.join(root, proof.sql_source));
  assert.equal(createHash('sha256').update(source).digest('hex'), proof.sql_sha256);
  const sql = exactRestoreProfile33Sql(expected, observed, identity).sql;
  const result = spawnSync(path.join(root, '.venv-skills/Scripts/python.exe'), ['-X', 'utf8', '-c',
    "from pglast import parse_sql,parse_plpgsql;import sys;s=sys.stdin.read();parse_sql(s);parse_plpgsql(s);print('PARSED')"], {
    input: sql, encoding: 'utf8', windowsHide: true, shell: false, timeout: 10000, maxBuffer: 65536 });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), 'PARSED');
});
