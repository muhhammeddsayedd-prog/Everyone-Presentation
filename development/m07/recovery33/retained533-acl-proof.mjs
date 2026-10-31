/** Exact historical533 ACL semantics. Offline builder/projector; no database IO. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const AUTH_SOURCE = '{postgres=arwdDxtm/supabase_auth_admin,supabase_auth_admin=arwdDxtm/supabase_auth_admin,dashboard_user=arwdDxtm/supabase_auth_admin}';
const AUTH_RESTORED = '{supabase_auth_admin=arwdDxtm/supabase_auth_admin,postgres=arwdDxtm/supabase_auth_admin,dashboard_user=arwdDxtm/supabase_auth_admin}';
const PRIVILEGES = ['DELETE','INSERT','MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE'];
const SHA = value => createHash('sha256').update(value).digest('hex');
const q = value => "'" + String(value).replaceAll("'","''") + "'";
const exact = (value, keys) => { assert(value && typeof value === 'object' && !Array.isArray(value)); assert.deepEqual(Object.keys(value).sort(), [...keys].sort()); };
export function assertRetained533Observation(value, sourceBytes, restoredBytes) {
  assert.equal(value.scope, 'retained533_exact_acl_pairs_not_yet_admitted');
  assert.equal(SHA(sourceBytes), value.source_sha256); assert.equal(SHA(restoredBytes), value.restored_sha256);
  assert.equal(value.source_sha256, '04ff9e09b9c9265f91eb5a07a699eeaa310d7add809788a56b4ab9cfede8b7b3');
  assert.equal(value.restored_sha256, '9257eaa1cb1deca857055cc440fe9de1fdc8319ae426ce769150bc5e34402035');
  const source = JSON.parse(sourceBytes), restored = JSON.parse(restoredBytes);
  assert.deepEqual(value.role_oids, { postgres:16384,supabase_auth_admin:16504,dashboard_user:16514,eps_oauth_consent_owner_historical:185052 });
  assert.deepEqual(value.observations.map(row => row.table), ['auth.oauth_clients','auth.oauth_authorizations','eps.oauth_consent_claims']);
  for (const row of value.observations) {
    const auth = row.table.startsWith('auth.');
    exact(row,['table','acl','owner','rls','force_rls']);
    for (const key of ['acl','owner','rls','force_rls']) {
      assert.equal(row[key].source, source[`tables|${row.table}|${key}`]); assert.equal(row[key].restored, restored[`tables|${row.table}|${key}`]);
    }
    assert.deepEqual(row.acl, auth ? { source: AUTH_SOURCE, restored: AUTH_RESTORED } : { source:'{eps_oauth_consent_owner=arwdDxtm/eps_oauth_consent_owner}',restored:null });
    assert.deepEqual(row.owner, {source:auth?'supabase_auth_admin':'eps_oauth_consent_owner',restored:auth?'supabase_auth_admin':'eps_oauth_consent_owner'});
    for (const key of ['rls','force_rls']) assert.deepEqual(row[key], {source:!auth,restored:!auth});
  }
  return value;
}
export function buildRetained533AclProofSql() {
  const expansion = name => `(select jsonb_agg(jsonb_build_object('grantor_oid',grantor,'grantee_oid',grantee,'privilege',privilege_type,'grantable',is_grantable)order by privilege_type,grantor,grantee,is_grantable)from ${name})`;
  return `-- Read-only native ACL semantics of SHA-pinned retained533 metadata. Does not replay a table or restore Auth.
-- Historical185052 owner identity is supplied numerically; that role was removed after exact cleanup.
begin read only;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='15s';
do $retained533$begin if current_database()<>'postgres'or(select system_identifier::text from pg_control_system())<>'7701520506262638626'
 or(select count(*)from supabase_migrations.schema_migrations)<>29
 or not exists(select 1 from pg_roles where rolname='postgres'and oid=16384)
 or not exists(select 1 from pg_roles where rolname='supabase_auth_admin'and oid=16504)
 or not exists(select 1 from pg_roles where rolname='dashboard_user'and oid=16514)
 then raise exception'RETAINED533_EXACT_LOCAL_ROLE_IDENTITIES_REQUIRED';end if;end$retained533$;
with auth_source as(select*from aclexplode(${q(AUTH_SOURCE)}::aclitem[])),auth_restored as(select*from aclexplode(${q(AUTH_RESTORED)}::aclitem[])),
claim_source as(select*from aclexplode(array[makeaclitem(185052::oid,185052::oid,'INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN',false)])),
claim_restored as(select*from aclexplode(acldefault('r'::"char",185052::oid))),
auth_diff as((select*from auth_source except select*from auth_restored)union all(select*from auth_restored except select*from auth_source)),
claim_diff as((select*from claim_source except select*from claim_restored)union all(select*from claim_restored except select*from claim_source))
select jsonb_build_object('scope','retained533_native_literal_acl_semantics_only','actual_table_restore_proved',false,
 'historical_claim_owner_oid',185052,'auth_source_entries',${expansion('auth_source')},'auth_restored_entries',${expansion('auth_restored')},
 'claim_source_entries',${expansion('claim_source')},'claim_default_entries',${expansion('claim_restored')},
 'auth_symmetric_difference',(select count(*)from auth_diff),'claim_symmetric_difference',(select count(*)from claim_diff));
rollback;\n`;
}
export function assertRetained533AclProof(value) {
  exact(value,['scope','actual_table_restore_proved','historical_claim_owner_oid','auth_source_entries','auth_restored_entries','claim_source_entries','claim_default_entries','auth_symmetric_difference','claim_symmetric_difference']);
  assert.equal(value.scope,'retained533_native_literal_acl_semantics_only'); assert.equal(value.actual_table_restore_proved,false);
  assert.equal(value.historical_claim_owner_oid,185052); assert.equal(value.auth_symmetric_difference,0); assert.equal(value.claim_symmetric_difference,0);
  const expected = grantees => PRIVILEGES.flatMap(privilege => grantees.map(grantee => ({grantor_oid:grantees.length===1?'185052':'16504',grantee_oid:String(grantee),privilege,grantable:false})));
  for (const key of ['auth_source_entries','auth_restored_entries']) assert.deepEqual(value[key],expected([16384,16504,16514]));
  for (const key of ['claim_source_entries','claim_default_entries']) assert.deepEqual(value[key],expected([185052]));
  return { native_literal_semantics_equal:true,auth_expanded_entries:24,claim_expanded_entries:8,symmetric_differences:0,actual_table_restore_proved:false };
}
