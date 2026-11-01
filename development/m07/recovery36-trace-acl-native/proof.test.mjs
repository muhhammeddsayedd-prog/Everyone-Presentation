import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {loadSources,validateSources,compileNativeProof,ROOT,PURPOSE,EXECUTION_ENABLED,sha} from './compiler.mjs';
import {COLUMNS,TABLE_PRIVILEGES,COLUMN_PRIVILEGES,nativeProofSql,snapshotSql,validateNativeProof,createTraceAclNativeContext} from './runtime.mjs';
import {execute} from './run.mjs';
const runId='36000000-0000-4000-8000-000000000037';
const identity={database:'eps_m07_r33_restore_'+runId.replaceAll('-',''),marker:`eps-m07-recovery33:${runId}:restore`,oid:12345};
const sourceAcl='{postgres=arwdDxtm/postgres}',columnAcl='{eps_job_trace_owner=a/postgres}';
const types=['text','uuid','uuid','text','text','integer','integer','bigint','text','text','text','text','timestamp with time zone','bigint'];
const sources=await loadSources();
function snapshot(){
 const names=['postgres','anon','authenticated','service_role','eps_job_trace_owner','eps_mcp_issuer_owner','eps_oauth_consent_owner',...Array.from({length:54},(_,i)=>`synthetic_${i}`)];
 const subjects=[...names,'public'];const matrix=(privileges,columns)=>subjects.flatMap(role=>(columns??['']).flatMap(column=>privileges.map(privilege=>({role,...(columns?{column}:{}),privilege,allowed:role==='postgres',grantable:role==='postgres'}))));
 return{table_acl:null,identity:{table_oid:123,owner_oid:16384,owner:'postgres',schema_oid:456,kind:'r',persistence:'p',rls:true,force_rls:true},
  columns:COLUMNS.map((name,i)=>({number:i+1,name,type:types[i],not_null:name!=='workflow_execution_id',acl:columnAcl,default:null})),
  policies:[{name:'job_stage_attempts_capture',command:'a',permissive:true,roles:[20001],using:null,check:'pg_trigger_depth() > 0'}],
  constraints:[{oid:30001,name:'synthetic_fk',type:'f',relation:123,foreign_relation:999,definition:'SYNTHETIC_FK'}],triggers:Array.from({length:4},(_,i)=>({oid:30002+i,relation:i<2?123:999,constraint_relation:i<2?999:123,constraint:30001,enabled:'O',internal:true,definition:'SYNTHETIC_TRIGGER',function:'SYNTHETIC_FUNCTION'})),namespace:{name:'eps',owner_oid:16384,acl:'{postgres=UC/postgres}'},roles:names.map((name,i)=>({oid:name==='postgres'?16384:20000+i,name,login:false,super:false,inherit:false,bypassrls:false,create_role:false,create_db:false,replication:false,connection_limit:-1,valid_until:null})),memberships:[],
  expanded_acl:TABLE_PRIVILEGES.map(privilege=>({grantor:16384,grantee:16384,privilege,grantable:false})),
  table_matrix:matrix(TABLE_PRIVILEGES),column_matrix:matrix(COLUMN_PRIVILEGES,COLUMNS),schema_matrix:matrix(['CREATE','USAGE'])};
}
function proof(){const before=snapshot();return[{phase:'null_before',snapshot:before},{phase:'explicit',snapshot:{...structuredClone(before),table_acl:sourceAcl},metadata_equal_except_acl:true,symmetric_differences:{expanded_acl:0,table_matrix:0,column_matrix:0,schema_matrix:0}},{phase:'null_after',snapshot:structuredClone(before),rollback_exact:true}];}
test('all129 actual failed-source bytes,7 archives and cleanup evidence bind new138-source closure',()=>{
 const admitted=validateSources(sources);assert.equal(Object.keys(admitted.receipt.source_seals).length,129);assert.equal(sources.size,138);
 for(const[file,digest]of Object.entries(admitted.receipt.source_seals))assert.equal(sha(sources.get(file)),digest);
 assert.equal(admitted.receipt.result,'failed');assert.equal(typeof EXECUTION_ENABLED,'boolean');
 const bad=new Map(sources);bad.set('development/m07/recovery36/runtime.mjs',Buffer.from('changed'));assert.throws(()=>validateSources(bad));
});
test('compiler emits only new native-only wrapper and preserves inherited functionalDDL/cleanup/old paths',()=>{
 const built=compileNativeProof(sources,{runId});assert.equal(built.manifest.metadata_restore_acceptance,false);assert.equal(built.manifest.execution_enabled,EXECUTION_ENABLED);
 assert(built.source.includes('createTraceAclNativeContext('));assert(built.source.includes('TRACE_ACL_NATIVE_EXECUTION_DISABLED'));assert(built.source.includes("'tracking/evidence/m07/recovery36-trace-acl-native'"));
 for(const flag of ['original29_full_catalogue_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert(built.source.includes(flag));
 assert(sources.get('development/m07/recovery33/runtime.mjs').toString().includes('original29_full_auth_storage_catalogue_unchanged'));
 const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:built.source,encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(result.status,0,result.stderr);
 for(const id of ['0843096a-6482-402a-bbcf-9cf162289b8a','c0aa3c0e-42e0-4ddc-a0ea-8f9d3f676d01','5d8d863a-af4c-476f-acb5-ce0879e6daf2'])assert.throws(()=>compileNativeProof(sources,{runId:id}));
});
test('actual generatedSQL parses and has one exact grant/savepoint rollback without row or role writes',()=>{
 const sql=nativeProofSql(identity);assert.equal(sql.split('grant all privileges on table eps.job_stage_attempts to postgres;').length,2);
 assert(sql.includes('savepoint trace_acl_native;'));assert(sql.includes('rollback to savepoint trace_acl_native;'));assert(!/\b(?:insert into|update\s+pg_|drop role|alter role|create role|commit;)\b/iu.test(sql));
 assert(sql.includes("union all select 'public'"));assert(sql.includes('WITH GRANT OPTION'));assert(sql.includes("acldefault('r'"));assert(sql.includes('except select value'));
 const result=spawnSync(path.join(ROOT,'.venv-skills/Scripts/python.exe'),['-I','-X','utf8','-B','-c',"import json,sys;from pglast import parse_sql,parse_plpgsql,ast\nfor s in json.load(sys.stdin):\n t=parse_sql(s)\n for n in t:\n  if isinstance(n.stmt,ast.DoStmt):parse_plpgsql(s[n.stmt_location:n.stmt_location+n.stmt_len]+';')\nprint('PARSED')"],{input:JSON.stringify([snapshotSql(),sql]),encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'PARSED');
 assert.throws(()=>nativeProofSql({...identity,database:'postgres'}));assert.throws(()=>nativeProofSql({...identity,marker:'foreign'}));
});
test('complete matrices include all61roles plusPUBLIC,8table/14x4column/schema and grantoptions',()=>{
 const result=validateNativeProof(proof());assert.equal(result.table_matrix_rows,62*8);assert.equal(result.column_matrix_rows,62*14*4);assert.equal(result.schema_matrix_rows,62*2);
 assert.equal(result.metadata_restore_acceptance,false);assert.equal(result.null_acl_restored,true);
});
test('privilege/grantoption/column/owner/RLS/policy/FK/identity or missingPUBLIC drift cannot pass',()=>{
 const mutations=[
  rows=>{rows[1].snapshot.table_matrix[0].allowed=!rows[1].snapshot.table_matrix[0].allowed;},rows=>{rows[1].snapshot.column_matrix[0].grantable=!rows[1].snapshot.column_matrix[0].grantable;},rows=>{rows[1].snapshot.schema_matrix[0].allowed=!rows[1].snapshot.schema_matrix[0].allowed;},
  rows=>{rows[1].snapshot.columns[0].acl=null;},rows=>{rows[1].snapshot.identity.owner_oid=16385;},rows=>{rows[1].snapshot.identity.rls=false;},rows=>{rows[1].snapshot.identity.force_rls=false;},
  rows=>{rows[1].snapshot.policies[0].check='true';},rows=>{rows[1].snapshot.triggers=[];},rows=>{rows[1].snapshot.constraints=[];},rows=>{rows[1].snapshot.roles[0].name='foreign';},
  rows=>{rows[1].snapshot.table_matrix=rows[1].snapshot.table_matrix.filter(r=>r.role!=='public');},rows=>{rows[1].snapshot.column_matrix.pop();},
  rows=>{rows[1].snapshot.table_matrix[0]={...rows[1].snapshot.table_matrix[1]};},rows=>{rows[1].snapshot.expanded_acl[0].grantable=true;},
  rows=>{rows[1].symmetric_differences.table_matrix=1;},rows=>{rows[1].metadata_equal_except_acl=null;},rows=>{rows[2].rollback_exact=false;},rows=>{rows[2].snapshot.table_acl=sourceAcl;}
 ];for(const mutate of mutations){const value=proof();mutate(value);assert.throws(()=>validateNativeProof(value));}
});
test('matching malformed matrices across allphases still refuse rather than rely only on equality',()=>{
 for(const mutation of [s=>{s.table_matrix.pop();},s=>{s.column_matrix[0].allowed=null;},s=>{s.schema_matrix[0].grantable='false';},s=>{s.columns.pop();},s=>{s.roles.push(s.roles[0]);},s=>{s.expanded_acl[0].grantee=0;}]){
  const value=proof();for(const row of value)mutation(row.snapshot);assert.throws(()=>validateNativeProof(value));
 }
});
function ports({wrongPhase=false,wrongPair=false,fault=false}={}){
 const writes=new Map();let delegated=0,sqlCalls=0;const expected={'tables|eps.job_stage_attempts|acl':wrongPair?'foreign':sourceAcl},observed={'tables|eps.job_stage_attempts|acl':null};for(const c of COLUMNS){expected[`columns|eps.job_stage_attempts.${c}|acl`]=columnAcl;observed[`columns|eps.job_stage_attempts.${c}|acl`]=columnAcl;}
 const prior=JSON.parse(sources.get('tracking/evidence/m07/recovery36/2026-11-01T03-34-12-941Z-5d8d863a.json'));
 const ctx={sourceFiles:sources,sourceDb:identity.database.replace('_restore_','_source_'),restoreDb:identity.database,privateRoot:'synthetic-private',report:{checkpoint:wrongPhase?'other':'populated36-metadata-dump-restore',metadata36_catalogue_difference_count:13,metadata36_catalogue_difference_keys:prior.metadata36_catalogue_difference_keys,private_artifact_acl:true},async preserveOriginalDumpProfile(){delegated++;return{prior:true};},async catalogue(){return observed;},async databaseIdentity(){return{oid:identity.oid};},marker:()=>identity.marker,rows:raw=>JSON.parse(raw),async sql(){sqlCalls++;if(fault)throw Error('UNKNOWN_CATALOGUE_PAIR');return{stdout:JSON.stringify(proof())};}};
 const factory=wrapped=>({get catalogueSql(){throw Error('Do not eagerly evaluate inherited getters');},async upgrade(){},async cleanupRoles(){},async metadataRestore(){await wrapped.preserveOriginalDumpProfile(ctx.restoreDb,expected);throw Error('LATER_RESTORE_ACCEPTANCE_MUST_NOT_RUN');}});
 const runtime=createTraceAclNativeContext(ctx,{contextFactory:factory,io:{async writeFile(file,bytes,options){assert.equal(options.flag,'wx');assert.equal(options.mode,0o600);assert(!writes.has(file));writes.set(file,bytes);}}});
 return{ctx,runtime,writes,get delegated(){return delegated;},get sqlCalls(){return sqlCalls;}};
}
test('native-only sentinel stops before originalprofile/later restore acceptance; private proof only',async()=>{
 const f=ports();await f.runtime.metadataRestore();assert.equal(f.delegated,0);assert.equal(f.sqlCalls,1);assert.equal(f.writes.size,1);assert.equal(f.ctx.report.trace_acl_native.result,'passed');assert.equal(f.ctx.report.metadata_restore_acceptance,false);assert.equal(f.ctx.report.recovery36_metadata,undefined);
 const publicReport=JSON.stringify(f.ctx.report);assert(!publicReport.includes('synthetic_'));assert(!publicReport.includes('pg_trigger_depth'));
});
test('other profile contexts delegate unchanged and arbitrary errors cannot spoof completion sentinel',async()=>{
 const other=ports({wrongPhase:true});await assert.rejects(other.runtime.metadataRestore(),/LATER_RESTORE_ACCEPTANCE/u);assert.equal(other.delegated,1);assert.equal(other.sqlCalls,0);
 const wrong=ports({wrongPair:true});await assert.rejects(wrong.runtime.metadataRestore());assert.equal(wrong.sqlCalls,0);assert.equal(wrong.writes.size,0);
 const fault=ports({fault:true});await assert.rejects(fault.runtime.metadataRestore(),/UNKNOWN_CATALOGUE_PAIR/u);assert.equal(fault.writes.size,0);assert.equal(fault.ctx.report.trace_acl_native,undefined);
});
test('gate refuses before privateplan/source/child IO and runners contain newonceclaim/noambientdebug',async()=>{
 if(!EXECUTION_ENABLED)await assert.rejects(execute('not-a-run-id'),/TRACE_ACL_NATIVE_EXECUTION_DISABLED/u);else assert.equal(typeof EXECUTION_ENABLED,'boolean');
 const source=await readFile(path.join(ROOT,PURPOSE,'run.mjs'),'utf8');assert(source.includes("flag:'wx'"));assert(source.includes('automatic_retry:false'));assert(!source.includes('process.env.DEBUG'));assert(!source.includes('SUPABASE_ACCESS_TOKEN'));
});
