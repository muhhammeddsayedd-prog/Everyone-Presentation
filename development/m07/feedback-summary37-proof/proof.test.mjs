import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {ownedPredicate33} from '../recovery33/ownership.mjs';
import {loadSources,validateSources,compileFeedback37,ROOT,EXECUTION_ENABLED,PURPOSE,sha} from './controller.mjs';
import {renderFeedback37Wire,ownedMigration37,verifyFeedback37Observation,ROLLED_BACK,MARKER,createFeedback37Runtime} from './runtime.mjs';
import {execute} from './run.mjs';
const run='37000000-0000-4000-8000-000000000001';
const identity={database:'eps_m07_r33_source_'+run.replaceAll('-',''),marker:`eps-m07-recovery33:${run}:source`,oid:12345};
const sources=await loadSources();

test('new source closure admits real185 proof and latest b7 complete cleanup, with official37 bytes only',()=>{
 const v=validateSources(sources);assert.equal(v.base.size,185);assert.equal(v.migration,'supabase/migrations/20261101042702_m07_feedback_summary.sql');
 const changed=new Map(sources);changed.set('development/m07/recovery33/runtime.mjs',Buffer.from('changed'));assert.throws(()=>validateSources(changed));
 const bad=new Map(sources);bad.set(v.migration,Buffer.from('foreign'));assert.throws(()=>validateSources(bad));
});

test('new disabled compiler preserves old functional controller and adds new hook/evidence/source pins',()=>{
 const c=compileFeedback37(sources,{runId:run});assert.equal(c.manifest.execution_enabled,EXECUTION_ENABLED);assert.equal(c.manifest.prior185_unchanged,true);
 assert(c.source.includes('await runFeedback37({'));assert(!c.source.includes('await runAttempt36({'));
 assert(c.source.includes('FEEDBACK37_EXECUTION_DISABLED'));assert(c.source.includes("'tracking/evidence/m07/feedback-summary37-proof'"));
 for(const f of ['original29_full_catalogue_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert(c.source.includes(f));
 const checked=spawnSync(process.execPath,['--check','--input-type=module'],{input:c.source,encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(checked.status,0,checked.stderr);
 assert.throws(()=>compileFeedback37(sources,{runId:'7cff5c7d-8329-4abd-ba27-a6e390a7208d'}));
});

test('actual34-37 wire uses owned admission only, ephemeral history37 and complete savepoint rollback',()=>{
 const wire=renderFeedback37Wire(sources,identity);assert(wire.body.includes("values('20261101042702')"));
 assert(wire.body.includes('rollback to savepoint feedback37_source_proof'));assert(wire.body.includes(MARKER));
 assert(!/^\s*(begin|commit|rollback)\s*;/imu.test(wire.body));assert(!wire.body.includes('ATTEMPT36_REAL_CLAIM_CALLBACK_RETRY_ASSERTIONS_PASSED'));
 const original=sources.get(wire.migration).toString('utf8'),adapted=ownedMigration37(original,identity);
 assert.equal(adapted.canonical_sha256,sha(original));assert(adapted.sql.includes(identity.marker));assert(!adapted.sql.includes("current_database()<>'postgres'"));
 assert.throws(()=>ownedMigration37(original,{...identity,database:'postgres'}));
});

test('parse the actual compiled sql port BEGIN/body/COMMIT composition plus all PLpgSQL bodies',async()=>{
 const wire=renderFeedback37Wire(sources,identity);
 const compiled=compileFeedback37(sources,{runId:run}).source;
 const start=compiled.indexOf('async function sql(database, body, role = '),end=compiled.indexOf('\nconst value = async ',start);
 assert(start>0&&end>start);const definition=compiled.slice(start,end);
 assert(!/\b(?:import|require|spawn|process)\b/u.test(definition));let assembled;
 const sqlPort=vm.runInNewContext('('+definition+')',{assert,databaseIdentity:async()=>({oid:identity.oid}),marker:()=>identity.marker,ownedPredicate33,
  literal:v=>"'"+String(v).replaceAll("'","''")+"'",psqlArgs:()=>['SYNTHETIC'],docker:async(_args,options)=>{assembled=options.input;return{stdout:''};}},{timeout:1000});
 await sqlPort(identity.database,wire.body);assert(assembled.includes(identity.marker));
 assert(assembled.includes("begin;set local search_path='';"));assert(assembled.endsWith(wire.body+'\ncommit;'));
 const script="import json,sys;from pglast import parse_sql,parse_plpgsql,ast\ns=json.load(sys.stdin);nodes=parse_sql(s)\nfor n in nodes:\n stmt=n.stmt\n if isinstance(stmt,ast.DoStmt)or isinstance(stmt,ast.CreateFunctionStmt)and any(o.defname=='language'and o.arg.sval=='plpgsql'for o in stmt.options):parse_plpgsql(s[n.stmt_location:n.stmt_location+n.stmt_len]+';')\nprint('COMPOSED_SQL_PARSED')";
 const p=spawnSync(path.join(ROOT,'.venv-skills/Scripts/python.exe'),['-I','-X','utf8','-B','-c',script],{input:JSON.stringify(assembled),encoding:'utf8',windowsHide:true,timeout:20000});
 assert.equal(p.status,0,p.stderr);assert.equal(p.stdout.trim(),'COMPOSED_SQL_PARSED');
});

test('observation requires unique actual fixture marker, full rollback and unchanged before/after states',()=>{
 const before={catalogue:{old:'catalogue-hash'},data:{old:'data-hash'},history:{versions:Array(33).fill('v')}};
 const stdout=MARKER+'\n'+JSON.stringify(ROLLED_BACK)+'\n';const rows=s=>s.split(/\r?\n/u).filter(x=>x.startsWith('{')).map(x=>JSON.parse(x));
 assert.deepEqual(verifyFeedback37Observation(stdout,rows,before,structuredClone(before)),[MARKER]);
 assert.throws(()=>verifyFeedback37Observation(stdout+MARKER,rows,before,before));
 assert.throws(()=>verifyFeedback37Observation(stdout,rows,before,{...before,data:{old:'changed'}}));
 assert.throws(()=>verifyFeedback37Observation(MARKER+'\n'+JSON.stringify({...ROLLED_BACK,trace_role_absent:false}),rows,before,before));
});

test('actual runtime hook wiring/private ACL/source seals/marker checks are exercised without database IO',async()=>{
 const writes=new Map(),history={versions:[...Array(32).fill('old'),'20261031130207']};let calls=0,valueCalls=0;
 const compiled=compileFeedback37(sources,{runId:run}).source;
 const line=prefix=>{const start=compiled.indexOf(prefix);assert(start>0);return compiled.slice(start,compiled.indexOf('\n',start));};
 const ports=vm.runInNewContext(line('const rows = ')+line('const value = async ')+';({rows,value});',{JSON,
  sql:async(_db,sql)=>{assert(sql.endsWith(';'));valueCalls++;return{stdout:JSON.stringify(sql.startsWith("select jsonb_build_object('versions'")?history:{old:'data-hash'})+'\n'};}},{timeout:1000});
 const ctx={root:ROOT,sourceFiles:sources,sourceDb:identity.database,privateRoot:'synthetic-private',report:{private_artifact_acl:process.platform==='win32'?'current-user-and-SYSTEM-only-verified':'mode0700'},
  marker:()=>identity.marker,async databaseIdentity(){return{oid:identity.oid};},async catalogue(){return{old:'catalogue-hash'};},
  value:ports.value,
  rows:s=>s.split(/\r?\n/u).filter(x=>x.startsWith('{')).map(x=>JSON.parse(x)),
  async sql(_db,body){calls++;assert(body.includes(MARKER));return{stdout:MARKER+'\n'+JSON.stringify(ROLLED_BACK)};}};
 const io={async readFile(file){const key=path.relative(ROOT,file).replaceAll('\\','/');assert(sources.has(key));return sources.get(key);},async writeFile(file,body,options){assert.equal(options.flag,'wx');assert.equal(options.mode,0o600);assert(!writes.has(file));writes.set(file,body);}};
 await createFeedback37Runtime(io)(ctx);assert.equal(calls,1);assert.equal(valueCalls,4);assert.equal(writes.size,1);assert.equal(ctx.report.feedback37_sql.result,'passed');
 assert.equal(ctx.report.feedback37_sql.original_AT074_fixture_replayed,false);assert.equal(ctx.report.feedback37_sql.hosted_acceptance,false);assert.equal(ctx.report.attempt36_sql,undefined);
});

test('entry blocks before private artifact/source/SQL dispatch while disabled',async()=>{
 assert.equal(typeof EXECUTION_ENABLED,'boolean');if(!EXECUTION_ENABLED)await assert.rejects(execute('not-a-run'),/FEEDBACK37_EXECUTION_DISABLED/u);
 assert(sources.get(PURPOSE+'run.mjs').toString().includes("flag:'wx'"));
 assert(!sources.get(PURPOSE+'run.mjs').toString().includes('process.env.DEBUG'));
});
