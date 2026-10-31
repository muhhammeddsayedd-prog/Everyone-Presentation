/** Closed projection of the exact read-only native PostgreSQL semantic proof. */
import assert from 'node:assert/strict';
import { normalizeDatabaseOid } from '../recovery29/identity.mjs';
export const OWNER_OID = 16504;
const PRIVILEGES = ['DELETE', 'INSERT', 'MAINTAIN', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'];
function exact(value, keys) { assert(value && typeof value === 'object' && !Array.isArray(value)); assert.deepEqual(Object.keys(value).sort(), [...keys].sort()); }
export function assertAclSemanticProof33(value) {
  exact(value, ['scope', 'owner_role_oid', 'owner_role_name', 'explicit_entry_count', 'default_entry_count', 'symmetric_difference_count',
    'expanded_explicit', 'expanded_default', 'source_owner_only', 'default_owner_only']);
  assert.equal(value.scope, 'exact_local29_read_only_acl_semantics'); assert.equal(value.owner_role_oid, OWNER_OID); assert.equal(value.owner_role_name, 'supabase_auth_admin');
  assert.equal(value.explicit_entry_count, 8); assert.equal(value.default_entry_count, 8); assert.equal(value.symmetric_difference_count, 0);
  assert.equal(value.source_owner_only, true); assert.equal(value.default_owner_only, true);
  for (const entries of [value.expanded_explicit, value.expanded_default]) {
    assert(Array.isArray(entries) && entries.length === 8); assert.deepEqual(entries.map(entry => entry.privilege), PRIVILEGES);
    for (const entry of entries) {
      exact(entry, ['grantor_oid', 'grantee_oid', 'privilege', 'grantable']);
      assert.equal(normalizeDatabaseOid(entry.grantor_oid), OWNER_OID); assert.equal(normalizeDatabaseOid(entry.grantee_oid), OWNER_OID);
      assert.equal(entry.grantable, false);
    }
  }
  assert.deepEqual(value.expanded_explicit, value.expanded_default);
  return { owner_oid: OWNER_OID, explicit_entries: 8, default_entries: 8, symmetric_difference: 0, owner_only: true, grantor_and_grant_options_exact: true };
}
