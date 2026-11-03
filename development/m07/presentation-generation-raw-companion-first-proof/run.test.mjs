import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile}from 'node:fs/promises';
import {URL}from 'node:url';
import {decodedRow}from '../presentation-lock-source-proof/session.mjs';
import {closedResult,runDiagnostic}from './run.mjs';

const failure={ok:false,code:'57014',operation:'generate',duration_ms:8000.1};
const actualSession=await readFile(new URL('../presentation-generation-stage-diagnostic/session.mjs',import.meta.url),'utf8');
const tagContract=actualSession.match(/assert\(\/(\^\[a-z_\]\{1,[0-9]+\}\$)\/u\.test\(tag\)\);/u);assert(tagContract,'ACTUAL_SESSION_TAG_REGEX_REQUIRED');
const tagPattern=new RegExp(tagContract[1],'u');
test('sender fake uses actual frozen session regex and rejects former overlong tag',()=>{assert.equal(tagPattern.test('raw_first_mcp_large'),false);assert.equal(tagPattern.test('raw_mcp_large'),true);});
test('actual frozen decodedRow is flat JSON, not a DataAPI column wrapper',()=>{
 const flat=decodedRow(JSON.stringify(failure));assert.deepEqual(closedResult([flat]),failure);
 assert.throws(()=>closedResult([{locksource41_measure:flat}]));
 assert.throws(()=>closedResult([{...flat,private_text:'private-canary'}]));
 assert.throws(()=>closedResult([{...flat,role:'PRIVATE_CANARY'}]));
 const success={ok:true,duration_ms:123,role:'authenticated',status:'queued',job_id:'00000000-0000-4000-8000-000000000001',resource_id:'00000000-0000-4000-8000-000000000002'};
 assert.throws(()=>closedResult([{...success,code:'PRIVATE_CANARY',operation:'PRIVATE_CANARY'}]));
});
function fixture(ok=false){
 const calls=[],baseline={fixture:true};
 const result=ok?{ok:true,duration_ms:123,role:'authenticated',status:'queued',job_id:'00000000-0000-4000-8000-000000000001',resource_id:'00000000-0000-4000-8000-000000000002'}:failure;
 const s={pid:42,done:Promise.resolve(0),request:async sql=>{calls.push(sql);return sql.startsWith('select pg_temp.locksource41_measure')?[decodedRow(JSON.stringify(result))]:[];},finish:async()=>{calls.push('finish');}};
 const ctx={report:{generation_first_call:{}},profiles:{large:{workspace:'00000000-0000-4000-8000-000000000003',series:'00000000-0000-4000-8000-000000000004',meta:{input:{}}}},acting:()=>"set local role authenticated;",runId:'00000000-0000-4000-8000-000000000005',baseline,startFreshGeneration:async tag=>{assert(tagPattern.test(tag),'ACTUAL_SESSION_TAG_CONTRACT_REQUIRED');return s;},captureError:async()=>({private_file:'error.json',normal_return:true}),value:async()=>baseline};
 return{ctx,calls,s};
}
test('one normal cancellation is recorded then rollback/close/baseline, no warm or acceptance',async()=>{
 const{ctx,calls}=fixture();await runDiagnostic(ctx);const r=ctx.report.generation_first_call;
 assert.deepEqual(r.call.result,failure);assert.equal(r.call.normal_SQL_return,true);assert.equal(r.call.rolled_back,true);assert.equal(r.call.full_fresh_baseline_restored,true);assert.equal(r.call.performance_acceptance,false);assert.equal(r.all_later_proofs_remain_required,true);
 assert.equal(calls.filter(x=>x.startsWith('select pg_temp.locksource41_measure')).length,1);assert(calls[0].includes("statement_timeout='8s';set local lock_timeout='8s'"));assert(calls.includes('rollback;reset role;'));assert.equal(calls.at(-1),'finish');
});
test('queued success remains first-call-only; native failure keeps identity and cleanup',async()=>{
 const normal=fixture(true);await runDiagnostic(normal.ctx);assert.equal(normal.ctx.report.generation_first_call.call.result.ok,true);assert.equal(normal.ctx.report.generation_first_call.call.performance_acceptance,false);
 const bad=fixture(),original=new Error('private-canary');let n=0;bad.s.request=async sql=>{bad.calls.push(sql);if(sql.startsWith('select pg_temp.locksource41_measure')){n++;throw original;}return[];};
 await assert.rejects(runDiagnostic(bad.ctx),e=>e===original);assert.equal(n,1);assert.equal(bad.ctx.report.generation_first_call.call.rolled_back,true);assert.equal(JSON.stringify(bad.ctx.report).includes('private-canary'),false);assert.equal(bad.calls.at(-1),'finish');
});
