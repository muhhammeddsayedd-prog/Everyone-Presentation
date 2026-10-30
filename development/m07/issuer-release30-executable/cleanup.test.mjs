import assert from'node:assert/strict';import{test}from'node:test';
import{roleCleanupDecision,validateReleasePlan}from'./cleanup.mjs';
const expected={attempted:true,name:'eps_mcp_issuer_owner',marker:'eps-m07-issuer30:07000000-0000-4000-8000-000000000001',oid:1234,membership_states:[[]]};
const observed={name:'eps_mcp_issuer_owner',marker:expected.marker,oid:'1234',login:false,super:false,inherit:false,bypassrls:false,create_role:false,create_db:false,replication:false,connection_limit:-1,valid_until:null,memberships:[],dependencies:[],active_clients:0};
test('only exact newly created issuer identity with no other dependencies/clients can be removed',()=>{assert.deepEqual(roleCleanupDecision(expected,observed),{absent:false,can_drop:true,oid:1234});assert.deepEqual(roleCleanupDecision(expected,null),{absent:true,can_drop:false});});
test('unknown creation/identity/membership/dependency outcome cannot claim successful cleanup',()=>{
 for(const patch of[{name:'existing_role'},{marker:'other-run'},{oid:'1235'},{login:true},{inherit:true},{super:true},{bypassrls:true},{dependencies:[{database:'postgres'}]},{active_clients:1},{memberships:[{role:'eps_mcp_issuer_owner',member:'other'}]}])assert.throws(()=>roleCleanupDecision(expected,{...observed,...patch}));
 for(const patch of[{attempted:false},{oid:undefined},{membership_states:undefined}])assert.throws(()=>roleCleanupDecision({...expected,...patch},observed));
 assert.throws(()=>roleCleanupDecision(expected,undefined));
});
test('closed CLI release plan rejects external paths and changed shape before any file read',()=>{
 const good={schema_version:'1.0',version:'20261030160000',migration_path:'supabase/migrations/20261030160000_m07_native_oauth_issuer.sql',migration_sha256:'a'.repeat(64),candidate_sha256:'a'.repeat(64),cli_version:'2.122.0'};
 assert.equal(validateReleasePlan(good),good);
 for(const patch of[{version:'20261030111549'},{migration_path:'C:/private/secret'},{migration_path:'../outside.sql'},{migration_path:'supabase/migrations/../outside.sql'},{migration_path:'supabase/migrations/other.sql'},{migration_sha256:'x'},{candidate_sha256:'b'.repeat(64)},{unreviewed:true},{cli_version:'latest'}])assert.throws(()=>validateReleasePlan({...good,...patch}));
});
