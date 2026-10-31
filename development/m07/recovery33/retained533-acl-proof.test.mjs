import test from 'node:test';import assert from 'node:assert/strict';import {readFile}from'node:fs/promises';import{spawnSync}from'node:child_process';import path from'node:path';
import{assertRetained533Observation,buildRetained533AclProofSql,assertRetained533AclProof}from'./retained533-acl-proof.mjs';
const root=path.resolve(import.meta.dirname,'../../..');
test('three exact retained533 ACL pairs bind source bytes, owners, RLS and former role identity',async()=>{
 const prefix=path.join(root,'.local/m07-recovery/5332c86b-b1f9-410e-8702-647031182b17');
 const observation=JSON.parse(await readFile(path.join(root,'development/m07/recovery33/retained533-acl-observation.json')));
 const source=await readFile(path.join(prefix,'metadata33-source-catalogue.json')),restored=await readFile(path.join(prefix,'metadata33-restored-before-profile.json'));
 assertRetained533Observation(observation,source,restored);
 for(const mutate of [v=>{v.observations[0].acl.restored+='x';},v=>{v.observations[2].force_rls.restored=false;},v=>{v.role_oids.dashboard_user=16515;}]){
  const changed=structuredClone(observation);mutate(changed);assert.throws(()=>assertRetained533Observation(changed,source,restored));
 }
 assert.throws(()=>assertRetained533Observation(observation,Buffer.from('changed'),restored));
});
test('native literal ACL query parses and cannot mutate roles, tables, grants, Auth or migration state',()=>{
 const sql=buildRetained533AclProofSql();assert(sql.startsWith('-- Read-only'));assert(sql.includes('begin read only;'));assert(sql.endsWith('rollback;\n'));
 assert(!/^\s*(?:grant|revoke|create|alter|drop|insert|update|delete)\b/imu.test(sql));
 assert(sql.includes("'actual_table_restore_proved',false"));
 const result=spawnSync(path.join(root,'.venv-skills/Scripts/python.exe'),['-X','utf8','-c',"from pglast import parse_sql,parse_plpgsql;import sys;s=sys.stdin.read();parse_sql(s);parse_plpgsql(s);print('PARSED')"],{input:sql,encoding:'utf8',timeout:10000,windowsHide:true,shell:false});
 assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'PARSED');
});
test('closed semantic proof rejects changed privilege, grantor, grant option or fabricated table restore claim',()=>{
 const privileges=['DELETE','INSERT','MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE'];
 const expand=grantees=>privileges.flatMap(privilege=>grantees.map(grantee=>({grantor_oid:grantees.length===1?'185052':'16504',grantee_oid:String(grantee),privilege,grantable:false})));
 const value={scope:'retained533_native_literal_acl_semantics_only',actual_table_restore_proved:false,historical_claim_owner_oid:185052,auth_source_entries:expand([16384,16504,16514]),auth_restored_entries:expand([16384,16504,16514]),claim_source_entries:expand([185052]),claim_default_entries:expand([185052]),auth_symmetric_difference:0,claim_symmetric_difference:0};
 assert.equal(assertRetained533AclProof(value).actual_table_restore_proved,false);
 for(const mutate of [v=>{v.auth_source_entries[0].grantable=true;},v=>{v.claim_default_entries[0].grantor_oid='16384';},v=>{v.auth_restored_entries[0].privilege='EXECUTE';},v=>{v.actual_table_restore_proved=true;},v=>{v.extra_private_payload='x';}]){
  const changed=structuredClone(value);mutate(changed);assert.throws(()=>assertRetained533AclProof(changed));
 }
});
