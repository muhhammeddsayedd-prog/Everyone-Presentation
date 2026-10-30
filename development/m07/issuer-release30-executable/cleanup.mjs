import assert from'node:assert/strict';import{isDeepStrictEqual}from'node:util';
import{normalizeDatabaseOid}from'../recovery29/identity.mjs';
export function validateReleasePlan(plan){
 assert(plan&&typeof plan==='object');assert.deepEqual(Object.keys(plan).sort(),['candidate_sha256','cli_version','migration_path','migration_sha256','schema_version','version']);
 assert.equal(plan.schema_version,'1.0');assert.equal(plan.cli_version,'2.122.0');
 assert(typeof plan.version==='string'&&/^\d{14}$/u.test(plan.version)&&plan.version>'20261030111549');
 assert.equal(plan.migration_path,`supabase/migrations/${plan.version}_m07_native_oauth_issuer.sql`);
 assert(typeof plan.migration_sha256==='string'&&/^[a-f0-9]{64}$/u.test(plan.migration_sha256));assert.equal(plan.candidate_sha256,plan.migration_sha256);return plan;
}
/** null means a successful exact-name SQL observation proved absence. */
export function roleCleanupDecision(expected,observed){
 if(observed===null)return{absent:true,can_drop:false};
 assert(expected.attempted===true&&expected.name==='eps_mcp_issuer_owner'&&/^eps-m07-issuer30:[a-f0-9-]{36}$/u.test(expected.marker));
 assert(Number.isSafeInteger(expected.oid)&&normalizeDatabaseOid(expected.oid)===expected.oid);
 assert(observed&&observed.name===expected.name&&observed.marker===expected.marker);
 const oid=normalizeDatabaseOid(observed.oid);assert.equal(oid,expected.oid);
 for(const key of['login','super','inherit','bypassrls','create_role','create_db','replication'])assert.equal(observed[key],false);
 assert.equal(observed.connection_limit,-1);assert.equal(observed.valid_until,null);
 assert.equal(observed.active_clients,0);assert.deepEqual(observed.dependencies,[]);
 assert(Array.isArray(expected.membership_states)&&expected.membership_states.some(v=>isDeepStrictEqual(v,observed.memberships)));
 return{absent:false,can_drop:true,oid};
}
