import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile}from 'node:fs/promises';
import {URL}from 'node:url';
import {createHash}from 'node:crypto';
import {closedObservation,runDiagnostic,TABLES}from './run.mjs';
import {runCases}from './entry.mjs';

const sql=await readFile(new URL('./observations.sql',import.meta.url),'utf8');
const digest=createHash('sha256').update(sql).digest('hex');
const UID='00000000-0000-4000-8000-000000000001';
const settings={autovacuum:'on',autovacuum_analyze_scale_factor:'0.1',autovacuum_analyze_threshold:'50',default_statistics_target:'100',jit:'off',jit_above_cost:'100000',jit_inline_above_cost:'500000',jit_optimize_above_cost:'500000',plan_cache_mode:'auto'};
const observation=()=>({observed_at:'2026-11-03T09:00:00+00:00',server_version_num:'170004',settings:{...settings},tables:TABLES.map(table=>({table,estimated_rows:-1,pages:0,all_visible_pages:0,last_analyze:null,last_autoanalyze:null,analyze_count:0,autoanalyze_count:0,live_estimate:1,modifications_since_analyze:1}))});
function fixture(arm='control',ok=false){
 const calls=[],baseline={tables:{safe:true}},result=ok?{ok:true,duration_ms:123,role:'authenticated',status:'queued',job_id:UID,resource_id:UID}:{ok:false,code:'57014',operation:'generate',duration_ms:8000};
 const s={pid:42,done:Promise.resolve(0),finish:async()=>calls.push('finish'),request:async text=>{calls.push(text);if(text.startsWith('select pg_temp.locksource41_measure'))return[result];if(text===sql)return[observation()];return[];}};
 const ctx={bindings:{statsArm:arm,observationsSha:digest},root:'unused',system:'1234567890123456789',runId:UID,baseline,report:{generation_first_call:{}},profiles:{large:{workspace:UID,series:UID,meta:{input:{}}}},acting:()=>'',
  startFreshGeneration:async tag=>{assert.equal(tag,'raw_mcp_large');calls.push('sender');return s;},captureError:async()=>({private_file:'error.json',normal_return:true}),value:async text=>text===sql?observation():baseline,sql:async text=>{calls.push(text);return{code:0};}};
 return{ctx,calls,s};
}
test('closed numeric/date/settings/table projection rejects arbitrary text and canaries',()=>{
 assert.deepEqual(closedObservation(observation()),observation());
 for(const mutate of[v=>v.private_text='PRIVATE_CANARY',v=>v.settings.jit='https://private.invalid',v=>v.tables[0].table='PRIVATE_CANARY',v=>v.tables[0].last_analyze='PRIVATE_CANARY',v=>v.tables[0].most_common_vals=['PRIVATE_CANARY']]){
  const v=observation();mutate(v);assert.throws(()=>closedObservation(v));
 }
});
test('control never ANALYZEs; one original kernel call keeps normal cancellation and rollback',async()=>{
 const{ctx,calls}=fixture();await runDiagnostic(ctx);
 assert.equal(calls.some(x=>x.includes('analyze auth.sessions')),false);
 assert.equal(calls.filter(x=>x.startsWith('select pg_temp.locksource41_measure')).length,1);
 assert(calls.includes('rollback;reset role;'));assert.equal(ctx.report.generation_first_call.call.result.code,'57014');
 assert.equal(ctx.report.planner_statistics.performance_acceptance,false);assert.equal(ctx.report.planner_statistics.one_application_dispatch,true);
 assert.equal(JSON.stringify(ctx.report).includes('PRIVATE_CANARY'),false);
});
test('treatment one exact bounded owned ANALYZE precedes sender; queued is diagnostic only',async()=>{
 const{ctx,calls}=fixture('analyzed',true);await runDiagnostic(ctx);
 const writes=calls.filter(x=>x.includes('analyze auth.sessions'));assert.equal(writes.length,1);
 assert(writes[0].startsWith("reset session authorization;begin;set local statement_timeout='8s';set local lock_timeout='8s';"));
 assert(writes[0].endsWith('analyze '+TABLES.join(',')+';commit;'));
 assert(writes[0].includes("current_database()<>'project39'"));assert(writes[0].includes(ctx.system));
 assert(calls.indexOf(writes[0])<calls.indexOf('sender'));
 assert.equal(ctx.report.planner_statistics.explicit_analyze_normal_return,true);
 assert.equal(ctx.report.generation_first_call.call.result.status,'queued');assert.equal(ctx.report.generation_first_call.call.performance_acceptance,false);
});
test('ANALYZE unknown stops before sender; native generation error preserves identity and has no retry',async()=>{
 const before=fixture('analyzed'),original=new Error('PRIVATE_CANARY');before.ctx.sql=async()=>{throw original;};
 await assert.rejects(runDiagnostic(before.ctx),e=>e===original);assert(!before.calls.includes('sender'));
 const after=fixture();const request=after.s.request;after.s.request=async text=>{if(text.startsWith('select pg_temp.locksource41_measure')){after.calls.push(text);throw original;}return request(text);};
 await assert.rejects(runDiagnostic(after.ctx),e=>e===original);
 assert.equal(after.calls.filter(x=>x.startsWith('select pg_temp.locksource41_measure')).length,1);
 assert(after.calls.includes('rollback;reset role;'));assert.equal(JSON.stringify(after.ctx.report).includes('PRIVATE_CANARY'),false);
});
test('literal disabled entry refuses before any context/port read',async()=>{
 let reads=0;const ctx=new Proxy({},{get(){reads++;throw Error('PORT_REACHED');}});
 await assert.rejects(runCases(ctx),/PLANNER_STATS_EXECUTION_DISABLED/u);assert.equal(reads,0);
});
