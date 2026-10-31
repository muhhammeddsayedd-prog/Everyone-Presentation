import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { exactRestoreProfile33Sql } from './retained533-profile.mjs';
const root = path.resolve(import.meta.dirname, '../../..');
const run = '12345678-1234-4234-8234-123456789abc';
const identity = { database: `eps_m07_r33_restore_${run.replaceAll('-', '')}`, marker: `eps-m07-recovery33:${run}:restore`, oid: 12345 };
async function fixture() {
  const prefix = path.join(root, '.local/m07-recovery/5332c86b-b1f9-410e-8702-647031182b17');
  const expected = JSON.parse(await readFile(path.join(prefix, 'metadata33-source-catalogue.json')));
  const observed = JSON.parse(await readFile(path.join(prefix, 'metadata33-restored-before-profile.json')));
  const nativeReceipt = await readFile(path.join(root, 'tracking/evidence/m07/recovery33/2026-10-31-retained533-acl-native-semantics.json'));
  const consentOwner = { name: 'eps_oauth_consent_owner', oid: '12346', attempted: true, marker: `eps-m07-recovery33:${run}:consent`, memberships: [] };
  return { expected, observed, evidence: { nativeReceipt, consentOwner } };
}
test('only the retained533 exact three new pairs extend the frozen nine-pair owned planner', async () => {
  const { expected, observed, evidence } = await fixture();
  const result = exactRestoreProfile33Sql(expected, observed, identity, evidence);
  assert.equal(result.differences.length, 12);
  for (const table of ['auth.oauth_clients','auth.oauth_authorizations','eps.oauth_consent_claims']) assert(result.differences.includes(`tables|${table}|acl`));
  assert(result.sql.includes(`oid = ${identity.oid} and`)); assert(result.sql.includes(identity.marker));
  assert(result.sql.includes("rolname='eps_oauth_consent_owner'and oid=12346")); assert(result.sql.includes(evidence.consentOwner.marker));
  assert(result.sql.includes("rolname='postgres'and oid=16384")); assert(result.sql.includes("rolname='dashboard_user'and oid=16514"));
  assert(result.sql.includes("rolname='supabase_auth_admin'and oid=16504"));
  assert(result.sql.includes('relrowsecurity=true and relforcerowsecurity=true'));
  const added = result.sql.slice(result.sql.indexOf('do $retained533_acl$'));
  assert(!/update\s+pg_class|alter\s+role|grant\s+.*\s+to\s+(?:anon|authenticated|service_role|public)\b/iu.test(added));
});
test('changed ACL, grantor, owner, RLS, evidence, owned role and unknown catalogue pairs are refused', async () => {
  const { expected, observed, evidence } = await fixture();
  for (const patch of [
    { 'tables|auth.oauth_clients|acl': '{supabase_auth_admin=arwdDxtm*/supabase_auth_admin}' },
    { 'tables|auth.oauth_authorizations|acl': '{supabase_auth_admin=arwdDxtm/postgres}' },
    { 'tables|eps.oauth_consent_claims|owner': 'postgres' }, { 'tables|eps.oauth_consent_claims|force_rls': false },
    { 'tables|auth.oauth_clients|rls': true }, { 'unrecognized|table|acl': 'new' },
  ]) assert.throws(() => exactRestoreProfile33Sql(expected, { ...observed, ...patch }, identity, evidence));
  for (const changed of [{}, { ...evidence, nativeReceipt: Buffer.from('{}') }, { ...evidence, consentOwner: { ...evidence.consentOwner, oid: 0 } },
    { ...evidence, consentOwner: { ...evidence.consentOwner, marker: evidence.consentOwner.marker + 'other' } }]) {
    assert.throws(() => exactRestoreProfile33Sql(expected, observed, identity, changed));
  }
  assert.throws(() => exactRestoreProfile33Sql(expected, observed, { ...identity, database: 'postgres' }, evidence));
});
test('already equal ACLs remain untouched and full generated SQL/PLpgSQL parse without a database', async () => {
  const { expected, observed, evidence } = await fixture();
  assert.deepEqual(exactRestoreProfile33Sql(expected, expected, identity).differences, []);
  const sql = exactRestoreProfile33Sql(expected, observed, identity, evidence).sql;
  const result = spawnSync(path.join(root, '.venv-skills/Scripts/python.exe'), ['-X','utf8','-c',
    "from pglast import parse_sql,parse_plpgsql;import sys;s=sys.stdin.read();parse_sql(s);parse_plpgsql(s);print('PARSED')"],
  { input: sql, encoding: 'utf8', timeout: 10000, shell: false, windowsHide: true, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), 'PARSED');
});
