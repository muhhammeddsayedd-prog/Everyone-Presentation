import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';
import {loadSources,validateSources,compileTraceProfile,admitNativeReceipt,ROOT,sha,EXECUTION_ENABLED,NATIVE_RECEIPT,NATIVE_SHA} from './compiler.mjs';
import {COLUMNS,snapshotSql} from '../recovery36-trace-acl-native/runtime.mjs';
import {admitPair,correctionSql,createTraceProfileContext} from './runtime.mjs';
import {ownedPredicate33} from '../recovery33/ownership.mjs';
import {execute} from './run.mjs';
const sources=await loadSources(),runId='36000000-0000-4000-8000-000000000038';
const identity={database:'eps_m07_r33_restore_'+runId.replaceAll('-',''),marker:`eps-m07-recovery33:${runId}:restore`,oid:12345};
const KEY='tables|eps.job_stage_attempts|acl',ACL='{postgres=arwdDxtm/postgres}',COLUMN='{eps_job_trace_owner=a/postgres}';
const versions=[...sources.keys()].filter(f=>/^supabase\/migrations\/[0-9]{14}_[^/]+\.sql$/u.test(f)).map(f=>f.split('/').at(-1).slice(0,14)).sort();
function pair(){const expected={[KEY]:ACL,'tables|eps.job_stage_attempts|owner':'postgres','tables|eps.job_stage_attempts|rls':true,'tables|eps.job_stage_attempts|force_rls':true,'schemas|eps|acl':'SYNTHETIC_SCHEMA','triggers|eps.jobs.capture_job_stage_attempt|definition':'SYNTHETIC_TRIGGER','tables|eps.unrelated|acl':'SYNTHETIC_OLD_FIELD'};for(const c of COLUMNS)expected[`columns|eps.job_stage_attempts.${c}|acl`]=COLUMN;return{expected,observed:{...expected,[KEY]:null}};}
const snapshot=()=>({table_acl:null,identity:{owner:'postgres',owner_oid:16384,rls:true,force_rls:true},columns:COLUMNS.map(name=>({name,acl:COLUMN})),private_marker:'SYNTHETIC_NATIVE_METADATA'});
test('actual native receipt and all138 executed sources bind145closure without modifying prior planners',()=>{
 const{receipt}=validateSources(sources);assert.equal(receipt.result,'passed');assert.equal(receipt.metadata_restore_acceptance,false);assert.equal(sources.size,145);
 assert.equal(sha(sources.get(NATIVE_RECEIPT)),NATIVE_SHA);assert.equal(Object.keys(receipt.source_seals).length,138);for(const[f,h]of Object.entries(receipt.source_seals))assert.equal(sha(sources.get(f)),h);
 assert.throws(()=>admitNativeReceipt(Buffer.from('invented'),sources));const altered=new Map(sources);altered.set('development/m07/recovery36-trace-acl-native/runtime.mjs',Buffer.from('changed'));assert.throws(()=>validateSources(altered));
});
test('only exact explicitpostgres/null owner pair with unchanged target metadata and14column grants is admitted',()=>{
 const{expected,observed}=pair();assert.equal(admitPair(expected,observed),true);
 for(const mutate of [v=>{v[KEY]='{}';},v=>{v['tables|eps.job_stage_attempts|owner']='foreign';},v=>{v['tables|eps.job_stage_attempts|rls']=false;},v=>{v['tables|eps.job_stage_attempts|force_rls']=false;},v=>{v[`columns|eps.job_stage_attempts.${COLUMNS[0]}|acl`]=null;},v=>{v['schemas|eps|acl']='changed';},v=>{v['triggers|eps.jobs.capture_job_stage_attempt|definition']='changed';}]){const bad=structuredClone(observed);mutate(bad);assert.throws(()=>admitPair(expected,bad));}
 assert.throws(()=>admitPair({...expected,[KEY]:null},observed));
});
test('correction is ownedrestore-only, exact36history and atomic native snapshot on both sides of onegrant',()=>{
 const sql=correctionSql(identity,snapshot(),versions);assert.equal(sql.split('grant all privileges on table eps.job_stage_attempts to postgres;').length,2);assert(sql.includes('TRACE_PROFILE_CURRENT_SNAPSHOT_REQUIRED'));assert(sql.includes('TRACE_PROFILE_ONLY_OWNER_ACL_MAY_CHANGE'));assert(sql.includes("(v-'table_acl')is distinct from(b-'table_acl')"));
 assert(sql.includes('TRACE_PROFILE_EXACT_ROLE_MEMBERSHIP_REQUIRED'));assert(sql.includes('shobj_description'));assert(sql.includes('prosecdef'));assert(sql.includes('a1de1739a8c0005e5b8a09e2e87bfb1094c38839631a813f06635e339afb9228'));
 for(const bad of [{...identity,database:'postgres'},{...identity,marker:'foreign'},{...identity,oid:0},{...identity,database:identity.database.replace('_restore_','_source_'),marker:identity.marker.replace(':restore',':source')}])assert.throws(()=>correctionSql(bad,snapshot(),versions));
 assert.throws(()=>correctionSql(identity,snapshot(),versions.slice(1)));assert.throws(()=>correctionSql(identity,{...snapshot(),table_acl:ACL},versions));
 assert(!/\b(?:drop|revoke|alter role|update pg_)\b/iu.test(sql));
});
test('real generated correction and inherited controller parseSQL/PLpgSQL/Node before any operation',()=>{
 const sql=correctionSql(identity,snapshot(),versions),python=path.join(ROOT,'.venv-skills/Scripts/python.exe');
 const parsed=spawnSync(python,['-I','-X','utf8','-B','-c',"import sys;from pglast import parse_sql,parse_plpgsql,ast;s=sys.stdin.read();t=parse_sql(s)\nfor n in t:\n if isinstance(n.stmt,ast.DoStmt):parse_plpgsql(s[n.stmt_location:n.stmt_location+n.stmt_len]+';')\nprint('PARSED')"],{input:sql,encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(parsed.status,0,parsed.stderr);
 const built=compileTraceProfile(sources,{runId});assert.equal(built.manifest.execution_enabled,EXECUTION_ENABLED);assert.equal(built.manifest.prior138_unchanged,true);assert(built.source.includes('createTraceProfileContext('));assert(built.source.includes('TRACE_PROFILE_EXECUTION_DISABLED'));assert(built.source.includes("'tracking/evidence/m07/recovery36-trace-profile'"));
 assert(built.source.includes('original29_full_catalogue_unchanged'));assert(built.source.includes('shared_test_lock_released'));assert(built.source.includes('await recovery33.metadataRestore();'));
 const checked=spawnSync(process.execPath,['--check','--input-type=module'],{input:built.source,encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(checked.status,0,checked.stderr);
 for(const id of ['0843096a-6482-402a-bbcf-9cf162289b8a','c0aa3c0e-42e0-4ddc-a0ea-8f9d3f676d01','5d8d863a-af4c-476f-acb5-ce0879e6daf2','508198d5-0460-4057-bda3-8aeb1fc8cd66'])assert.throws(()=>compileTraceProfile(sources,{runId:id}));
});
function ports({phase='populated36-metadata-dump-restore',database=identity.database,matching=false,helperFailure=false,writeFailure=false}={}){
 const values=pair(),receipt=JSON.parse(sources.get(NATIVE_RECEIPT));if(matching)values.observed[KEY]=ACL;let current=values.observed,valueSql;const calls=[];
 const ctx={sourceFiles:sources,restoreDb:identity.database,report:{checkpoint:phase,metadata36_catalogue_difference_count:13,metadata36_catalogue_difference_keys:receipt.metadata36_catalogue_difference_keys},async catalogue(){return current;},async databaseIdentity(){return{oid:identity.oid};},marker:()=>identity.marker,async value(db,sql){valueSql=sql;calls.push('native-snapshot');return snapshot();},async sql(db,sql){calls.push('correction');assert.equal(db,identity.database);assert(sql.includes('grant all privileges'));if(writeFailure)throw Error('SQL_UNCONFIRMED');current={...current,[KEY]:ACL};},async preserveOriginalDumpProfile(db,expected){calls.push('old-helper');assert.equal(db,database);assert.equal(expected,values.expected);if(helperFailure)throw Error('OLD_PROFILE_GUARD_REFUSED');return{corrected_known_fields:['SYNTHETIC_EXISTING_PAIR'],exact_raw_catalogue:true};}};
 const factory=wrapped=>({get catalogueSql(){throw Error('Lazy inherited getter');},async metadataRestore(){const result=await wrapped.preserveOriginalDumpProfile(database,values.expected);calls.push('full-catalogue-data-workflow');ctx.report.recovery36_metadata={result:'passed',synthetic_test_only:true};return result;}});
 return{ctx,calls,get valueSql(){return valueSql;},runtime:createTraceProfileContext(ctx,{contextFactory:factory})};
}
test('one correction precedes unchanged old helper and full workflow, with no rawmetadata in public report',async()=>{
 const f=ports(),result=await f.runtime.metadataRestore();assert.equal(f.valueSql,snapshotSql()+';');assert.deepEqual(f.calls,['native-snapshot','correction','old-helper','full-catalogue-data-workflow']);assert.deepEqual(result.corrected_known_fields,['SYNTHETIC_EXISTING_PAIR',KEY]);assert.equal(f.ctx.report.trace_profile_correction.native_receipt_sha256,NATIVE_SHA);assert(!JSON.stringify(f.ctx.report).includes('SYNTHETIC_NATIVE_METADATA'));
});
test('actual frozen sql port assembles snapshot BEGIN/body/COMMIT with a valid statement boundary',async()=>{
 const f=ports();await f.runtime.metadataRestore();const built=compileTraceProfile(sources,{runId});
 const start=built.source.indexOf('async function sql(database, body, role = '),end=built.source.indexOf('\nconst value = async ',start);assert(start>0&&end>start);
 // Evaluate only the SHA-bound emitted sql() function with synthetic ports.
 // No controller entry, filesystem, Docker, database or process API is exposed.
 const definition=built.source.slice(start,end);assert(!/\b(?:import|require|spawn|process)\b/u.test(definition));let assembled;
 const sqlPort=vm.runInNewContext('('+definition+')',{assert,databaseIdentity:async()=>({oid:identity.oid}),marker:()=>identity.marker,ownedPredicate33,literal:v=>"'"+String(v).replaceAll("'","''")+"'",psqlArgs:()=>['SYNTHETIC'],docker:async(_args,options)=>{assembled=options.input;return{stdout:''};}},{timeout:1000});
 await sqlPort(identity.database,f.valueSql);assert(assembled.includes('begin;set local search_path='));assert(assembled.includes(f.valueSql+'\ncommit;'));
 const result=spawnSync(path.join(ROOT,'.venv-skills/Scripts/python.exe'),['-I','-X','utf8','-B','-c',"from pglast import parse_sql;import sys;parse_sql(sys.stdin.read());print('PARSED')"],{input:assembled,encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'PARSED');
});
test('matching/other-context calls delegate unchanged; SQL or oldprofile failure never gets acceptance',async()=>{
 for(const options of [{matching:true},{phase:'other'},{database:identity.database.replace('_restore_','_source_')}]){const f=ports(options);await f.runtime.metadataRestore();assert.deepEqual(f.calls,['old-helper','full-catalogue-data-workflow']);assert.equal(f.ctx.report.trace_profile_correction,undefined);}
 const denied=ports({writeFailure:true});await assert.rejects(denied.runtime.metadataRestore(),/SQL_UNCONFIRMED/u);assert(!denied.calls.includes('old-helper'));assert.equal(denied.ctx.report.recovery36_metadata,undefined);
 const old=ports({helperFailure:true});await assert.rejects(old.runtime.metadataRestore(),/OLD_PROFILE_GUARD_REFUSED/u);assert(!old.calls.includes('full-catalogue-data-workflow'));assert.equal(old.ctx.report.recovery36_metadata,undefined);
});
const englishSql=JSON.parse(/const englishSql=("[^\n]+?");/u.exec(sources.get('development/m07/recovery36/runtime.mjs').toString('utf8'))[1]);
function valueRuntime(value){return createTraceProfileContext({sourceFiles:sources,restoreDb:identity.database,value},{contextFactory:wrapped=>({async metadataRestore(database=identity.database,sql=englishSql,...rest){return wrapped.value(database,sql,...rest);}})});}
test('actual frozen rows/value drops raw arrays; exact English envelope preserves allrows and object ports',async()=>{
 const built=compileTraceProfile(sources,{runId}),rowsLine=built.source.split('\n').filter(v=>v.startsWith('const rows = ')),valueLine=built.source.split('\n').filter(v=>v.startsWith('const value = async '));assert.equal(rowsLine.length,1);assert.equal(valueLine.length,1);
 const english=[{status:'available',private_fixture:'SYNTHETIC_AUTHORED_ENGLISH'}],data={'eps.job_stage_attempts':{count:2,sha256:'a'.repeat(64)}},calls=[];
 const envelope=`select jsonb_build_object('rows',(${englishSql.slice(0,-1)}));`;
 const frozen=vm.runInNewContext('(()=>{'+rowsLine[0]+'\n'+valueLine[0]+'\nreturn value;})()',{sql:async(...args)=>{calls.push(args);return{stdout:JSON.stringify(args[1]===englishSql?english:args[1]===envelope?{rows:english}:data)+'\n'};}},{timeout:1000});
 assert.equal(await frozen(identity.database,englishSql),undefined); // Preserve the actual legacy parser behavior.
 const runtime=valueRuntime(frozen),result=await runtime.metadataRestore();assert(Array.isArray(result)&&result.length===1&&result[0].status==='available');assert.equal(JSON.stringify(result),JSON.stringify(english));assert.equal(calls.at(-1)[1],envelope);
 const ordinary='select jsonb_build_object(\'unchanged_table_hashes\',true);';assert.equal(JSON.stringify(await runtime.metadataRestore(identity.database,ordinary,'eps_jobs_executor')),JSON.stringify(data));assert.deepEqual(calls.at(-1),[identity.database,ordinary,'eps_jobs_executor']);
 const source=identity.database.replace('_restore_','_source_');assert.equal(await runtime.metadataRestore(source,englishSql),undefined);assert.equal(calls.at(-1)[1],englishSql);
 const start=built.source.indexOf('async function sql(database, body, role = '),end=built.source.indexOf('\nconst value = async ',start);assert(start>0&&end>start);let assembled;
 const sqlPort=vm.runInNewContext('('+built.source.slice(start,end)+')',{assert,databaseIdentity:async()=>({oid:identity.oid}),marker:()=>identity.marker,ownedPredicate33,literal:v=>"'"+String(v).replaceAll("'","''")+"'",psqlArgs:()=>['SYNTHETIC'],docker:async(_args,options)=>{assembled=options.input;return{stdout:''};}},{timeout:1000});
 await sqlPort(identity.database,envelope);
 const parsed=spawnSync(path.join(ROOT,'.venv-skills/Scripts/python.exe'),['-I','-X','utf8','-B','-c',"from pglast import parse_sql;import sys;parse_sql(sys.stdin.read());print('PARSED')"],{input:assembled,encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(parsed.status,0,parsed.stderr);
});
test('English adapter requires only closed data rows:Array without broad query rewrites or semantic defaults',async()=>{
 let getter=false;const accessor={get rows(){getter=true;return[];}};
 for(const bad of [undefined,null,[],{}, {rows:null},{rows:{}},{rows:'[]'},{rows:[],extra:false},{rows:[],[Symbol('extra')]:false},accessor]){
  const runtime=valueRuntime(async()=>bad);await assert.rejects(runtime.metadataRestore());
 }
 assert.equal(getter,false);
 const empty=valueRuntime(async()=>({rows:[]}));const result=await empty.metadataRestore();assert(Array.isArray(result)&&result.length===0); // Original length/status guard still decides semantics.
 const marker={unmodified:true},calls=[];const exact=valueRuntime(async(...args)=>{calls.push(args);return marker;});const altered=englishSql+' ';
 assert.equal(await exact.metadataRestore(identity.database,altered,'authenticated','SYNTHETIC_ACTOR',true),marker);assert.deepEqual(calls[0],[identity.database,altered,'authenticated','SYNTHETIC_ACTOR',true]);
 const frozen=sources.get('development/m07/recovery36/runtime.mjs').toString('utf8');assert.equal((frozen.match(/ctx\.value\(ctx\.restoreDb,englishSql\)/gu)??[]).length,3);assert(frozen.includes("assert(Array.isArray(english)&&english.length===1&&english[0].status==='available')"));assert(frozen.includes("'RECOVERY36_ALL_POPULATED_TABLE_ROWS_CHANGED'"));assert(frozen.includes('assert.deepEqual(await ctx.value(ctx.restoreDb,englishSql),english)'));
});
test('disabled once-only runner refuses before private source/plan/child operations',async()=>{
 if(!EXECUTION_ENABLED)await assert.rejects(execute('bad'),/TRACE_PROFILE_EXECUTION_DISABLED/u);else assert.equal(typeof EXECUTION_ENABLED,'boolean');
 const runner=await readFile(path.join(ROOT,'development/m07/recovery36-trace-profile/run.mjs'),'utf8');assert(runner.includes("flag:'wx'"));assert(runner.includes('automatic_retry:false'));assert(!runner.includes('process.env.DEBUG'));assert(!runner.includes('SUPABASE_ACCESS_TOKEN'));
});
