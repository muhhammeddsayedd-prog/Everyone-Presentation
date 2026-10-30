import assert from'node:assert/strict';
import{test}from'node:test';
import{readFile}from'node:fs/promises';
import{spawnSync}from'node:child_process';
import{assertAdmission,extractIssuerSuffix,makeAdmissionSql,ownedIdentityPredicate}from'./admission.mjs';
const receipt=JSON.parse(await readFile('tracking/evidence/m07/issuer-release30-executable/2026-10-30T15-31-12-986032Z-b19aca5b-canonical-discovery.json','utf8'));
const baseline=receipt.discovery,source=await readFile('development/m07/oauth-hook29/candidate.sql');
test('all ordered history, metadata, protected data, mutable Settings and old role identities must match',()=>{
 assertAdmission(baseline,structuredClone(baseline));
 for(const change of[
  v=>v.context.migration_versions[0]='20261028010944',
  v=>v.catalog['functions|eps.has_capability(text)|source_sha256']='0'.repeat(64),
  v=>v.catalog['functions|eps.mcp_claim_uuid(text)|owner']='postgres',
  v=>v.catalog['tables|public.app_capability_grants|force_rls']=false,
  v=>v.catalog['columns|public.app_capability_grants.active|type']='text',
  v=>delete v.catalog['columns|eps.mcp_oauth_resources.resource|not_null'],
  v=>v.catalog['memberships|authenticated>eps_mcp_session_owner/postgres|inherit']=false,
  v=>v.context.all_roles[0].oid='4294967295',
  v=>v.context.settings.row_version++,
  v=>v.protected_data.hashes['eps.presentation_versions']='0'.repeat(64),
  v=>v.context.issuer_role_exists=true,
  v=>v.context.issuer_function_count=1,
  v=>v.context.issuer_policy_count=1,
  v=>v.context.registry_count=1,
  v=>v.context.effective_privileges.supabase_auth_admin.schemas.eps.usage=true
 ]){const changed=structuredClone(baseline);change(changed);assert.throws(()=>assertAdmission(baseline,changed));}
});
test('issuer suffix remains exact and changed source cannot be adopted',()=>{
 const suffix=extractIssuerSuffix(source);assert.equal(suffix.length,4735);
 assert(suffix.equals(source.subarray(source.indexOf(Buffer.from('\ncreate role eps_mcp_issuer_owner')))));
 assert.throws(()=>extractIssuerSuffix(Buffer.concat([source,Buffer.from('\n')])));
});
test('owned identity cannot target original or guessed names, markers, owners or OIDs; predicates parse',()=>{
 const identity={name:'eps_m07_issuer30_07000000000040008000000000000001',marker:'eps-m07-issuer30:07000000-0000-4000-8000-000000000001',oid:12345,owner:'postgres'};
 const predicate=ownedIdentityPredicate(identity);
 const parsed=spawnSync('.venv-skills/Scripts/python.exe',['-X','utf8','-c','from pglast import parse_sql;import sys;parse_sql("SELECT ("+sys.stdin.read()+");")'],{input:predicate,encoding:'utf8',windowsHide:true,shell:false,timeout:10000});assert.equal(parsed.status,0);
 for(const patch of[{name:'postgres'},{marker:'unrelated'},{oid:'12345'},{oid:0},{owner:'supabase_admin'}])assert.throws(()=>ownedIdentityPredicate({...identity,...patch}));
});
test('canonical and owned-local admission are explicit separate prefixes; neither contains transaction commit',async()=>{
 const catalog=await readFile('development/m07/db/catalog29.sql');
 const data=await readFile('development/m07/db/data29.sql');
 const sql=makeAdmissionSql(baseline,{catalog,data});
 assert(sql.includes('M07_ISSUER30_EXACT_CATALOGUE_REQUIRED'));
 assert(sql.includes('M07_ISSUER30_EXACT_PROTECTED_DATA_REQUIRED'));
 assert(sql.includes("current_database()<>'postgres'"));
 assert(!/^\s*(?:begin|commit|rollback)\s*;/imu.test(sql));
 assert.throws(()=>makeAdmissionSql(baseline,{catalog:Buffer.concat([catalog,Buffer.from('\n')]),data}));
});
