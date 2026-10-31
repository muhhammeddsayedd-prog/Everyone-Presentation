/** Finite retained533 three-pair extension. No IO and no generic ACL normalization. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { exactRestoreProfile33Sql as priorProfile33, ownedIdentity33, ownedPredicate33 } from './ownership.mjs';
import { normalizeDatabaseOid } from '../recovery29/identity.mjs';
import { assertRetained533AclProof } from './retained533-acl-proof.mjs';
export const RETAINED533_NATIVE_RECEIPT = 'tracking/evidence/m07/recovery33/2026-10-31-retained533-acl-native-semantics.json';
export const RETAINED533_NATIVE_RECEIPT_SHA = '4e672a10f28d4c653a9714745f75c16e8b5aba1edcddf9fbe480d7e0170dffe5';
const AUTH_SOURCE = '{postgres=arwdDxtm/supabase_auth_admin,supabase_auth_admin=arwdDxtm/supabase_auth_admin,dashboard_user=arwdDxtm/supabase_auth_admin}';
const AUTH_RESTORED = '{supabase_auth_admin=arwdDxtm/supabase_auth_admin,postgres=arwdDxtm/supabase_auth_admin,dashboard_user=arwdDxtm/supabase_auth_admin}';
const CLAIM_SOURCE = '{eps_oauth_consent_owner=arwdDxtm/eps_oauth_consent_owner}';
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
const sha = value => createHash('sha256').update(value).digest('hex');
export function assertRetained533NativeReceipt(bytes) {
  assert(typeof bytes === 'string' || bytes instanceof Uint8Array, 'RECOVERY33_RETAINED533_NATIVE_PROOF_REQUIRED');
  assert.equal(sha(bytes), RETAINED533_NATIVE_RECEIPT_SHA, 'RECOVERY33_RETAINED533_NATIVE_PROOF_CHANGED');
  const proof = JSON.parse(Buffer.from(bytes).toString('utf8'));
  assert.equal(proof.read_only, true); assert.equal(proof.query_sha256, '86b46544bb451cf483dd0ef21b00826cf61a75bd91a8990e3add685d0cb3d4f6');
  return assertRetained533AclProof(proof.actual_native_expansions);
}
function equivalentAcl(actual, source) {
  return `exists((select *from aclexplode(${actual})except select *from aclexplode(${source}))
 union all(select *from aclexplode(${source})except select *from aclexplode(${actual})))`;
}
export function exactRestoreProfile33Sql(expected, observed, identity, evidence = {}) {
  const owned = ownedIdentity33(identity), predicate = ownedPredicate33(identity), remaining = { ...observed }, corrections = [];
  for (const table of ['auth.oauth_clients','auth.oauth_authorizations','eps.oauth_consent_claims']) {
    const key = `tables|${table}|acl`; if (isDeepStrictEqual(expected[key], observed[key])) continue;
    const auth = table.startsWith('auth.'), owner = auth ? 'supabase_auth_admin' : 'eps_oauth_consent_owner';
    const sourceAcl = auth ? AUTH_SOURCE : CLAIM_SOURCE, restoredAcl = auth ? AUTH_RESTORED : null;
    assert.equal(expected[key], sourceAcl, 'RECOVERY33_UNKNOWN_RETAINED533_ACL_PAIR');
    assert.equal(observed[key], restoredAcl, 'RECOVERY33_UNKNOWN_RETAINED533_ACL_PAIR');
    for (const view of [expected, observed]) {
      assert.equal(view[`tables|${table}|owner`], owner, 'RECOVERY33_UNKNOWN_RETAINED533_ACL_PAIR');
      assert.equal(view[`tables|${table}|rls`], !auth, 'RECOVERY33_UNKNOWN_RETAINED533_ACL_PAIR');
      assert.equal(view[`tables|${table}|force_rls`], !auth, 'RECOVERY33_UNKNOWN_RETAINED533_ACL_PAIR');
    }
    assertRetained533NativeReceipt(evidence.nativeReceipt);
    let ownerOid = 16504, ownedRoleGuard = '';
    if (!auth) {
      const role = evidence.consentOwner;
      assert(role && role.attempted === true && role.name === owner, 'RECOVERY33_CREATED_CONSENT_OWNER_REQUIRED');
      ownerOid = normalizeDatabaseOid(role.oid);
      const marker = `eps-m07-recovery33:${owned.run}:consent`; assert.equal(role.marker, marker, 'RECOVERY33_CREATED_CONSENT_OWNER_REQUIRED');
      ownedRoleGuard = `or not exists(select 1 from pg_roles where rolname='eps_oauth_consent_owner'and oid=${ownerOid}
 and shobj_description(oid,'pg_authid')=${q(marker)} and not rolcanlogin and not rolsuper and not rolinherit and not rolbypassrls
 and not rolcreaterole and not rolcreatedb and not rolreplication and rolconnlimit=-1 and rolvaliduntil is null)`;
    }
    const roleGuard = `or not exists(select 1 from pg_roles where rolname='postgres'and oid=16384)
 or not exists(select 1 from pg_roles where rolname='supabase_auth_admin'and oid=16504)
 or not exists(select 1 from pg_roles where rolname='dashboard_user'and oid=16514) ${ownedRoleGuard}`;
    const tableGuard = acl => `not exists(select 1 from pg_class where oid=${q(table)}::regclass and relkind='r'and relowner=${ownerOid}
 and ${acl === null ? 'relacl is null' : `relacl::text=${q(acl)}`} and relrowsecurity=${!auth} and relforcerowsecurity=${!auth})`;
    const currentAcl = auth ? `(select relacl from pg_class where oid=${q(table)}::regclass)` : `acldefault('r'::"char",${ownerOid}::oid)`;
    let commands = `do $retained533_acl$begin if current_user<>'postgres'or ${predicate} ${roleGuard}
 or ${tableGuard(restoredAcl)} or ${equivalentAcl(currentAcl, `${q(sourceAcl)}::aclitem[]`)}
 then raise exception'RECOVERY33_RETAINED533_CURRENT_SOURCE_REQUIRED';end if;end$retained533_acl$;\n`;
    if (auth) commands += `set local role supabase_auth_admin;revoke all privileges on table ${table} from supabase_auth_admin,dashboard_user;
grant all privileges on table ${table} to supabase_auth_admin;grant all privileges on table ${table} to dashboard_user;set local role postgres;\n`;
    else commands += `set local role eps_oauth_consent_owner;grant all privileges on table eps.oauth_consent_claims to eps_oauth_consent_owner;set local role postgres;\n`;
    commands += `do $retained533_after$begin if current_user<>'postgres'or ${predicate} ${roleGuard} or ${tableGuard(sourceAcl)}
 then raise exception'RECOVERY33_RETAINED533_EXACT_RESULT_REQUIRED';end if;end$retained533_after$;\n`;
    corrections.push({ key, commands }); remaining[key] = sourceAcl;
  }
  const previous = priorProfile33(expected, remaining, identity);
  return { sql: previous.sql + corrections.map(value => value.commands).join(''), differences: [...previous.differences, ...corrections.map(value => value.key)] };
}
