import assert from 'node:assert/strict';
import test from 'node:test';
import {runDiagnostic}from './run.mjs';
import {PHASES,projectStageLines}from './markers.mjs';
const RUN='00000000-0000-4000-8000-000000000001';

function fixture({success=false,custodyFails=false}={}){
 const baseline={same:true},report={generation_stage_diagnostic:{}},privateRecords=[],order=[];let finished=false,generations=0;
 const phases=success?PHASES:[...PHASES.slice(0,7),'measure_cancel'];
 const markerRecords=projectStageLines(phases.map((x,i)=>`NOTICE: 00000: EPS_STAGE_V1|${RUN}|${x}|${1000+i/10}`).join('\n'),RUN);
 const raw=success?{ok:true,duration_ms:7000,role:'authenticated',job_id:RUN,resource_id:RUN,status:'queued'}:{ok:false,duration_ms:8000,code:'57014',operation:'generate',__owned_private_cancel:{sqlstate:'57014',message:'canceling statement due to statement timeout',context:'SQL statement "PRIVATE_CANCEL_QUERY_CANARY"\nPL/pgSQL function eps.review_snapshot_data(uuid,uuid,text) line 42 at FOR over SELECT rows\nPL/pgSQL function public.eps_generate_version(uuid,jsonb,text) line 26 at assignment'}};
 const s={pid:41,done:Promise.resolve(0),async request(sql){if(sql.startsWith('select pg_temp.locksource41_measure(')){generations++;return[raw];}return[];},async finish(){order.push('closed');finished=true;},stageRecords(){assert.equal(finished,true);order.push('getter_after_close');return markerRecords;}};
 const ctx={report,runId:RUN,baseline,profiles:{large:{workspace:RUN,series:RUN,meta:{input:{}}}},acting:()=>'',startFreshGeneration:async()=>s,value:async()=>baseline,bindings:{diagnosticStageMap:{candidate_generate_body_sha256:'a'.repeat(64),line_stages:[{line:1,stage:'input_authority_and_series_fence'},{line:26,stage:'review_and_fit'}]}},
  custodyDiagnostic:async value=>{order.push('private_context');if(custodyFails)throw Error('SINK_FAILED');privateRecords.push(value);return{normal_return:true,private_file:'query-canceled-private.json',sha256:'b'.repeat(64),PRIVATE_EXTRA:'SECRET'};},
  custodyPhase:async value=>{order.push('private_phases');privateRecords.push(value);return{normal_return:true,private_file:'phase-markers-private.json',sha256:'c'.repeat(64),PRIVATE_EXTRA:'SECRET'};},
  captureError:async()=>({normal_return:true,private_file:'private-error.json'})};
 return{ctx,privateRecords,order,generations:()=>generations};
}

test('one cancelled call has private context before public result and phases only after close/custody',async()=>{
 const f=fixture();await runDiagnostic(f.ctx);const r=f.ctx.report.generation_stage_diagnostic.call;
 assert.equal(f.generations(),1);assert.equal(r.result.code,'57014');assert.equal(r.rolled_back,true);assert.equal(r.full_fresh_baseline_restored,true);assert.equal(r.stages.paired_diagnostic_intervals.assignment_enumeration.completed,false);assert.equal(r.performance_acceptance,false);
 assert.deepEqual(f.order,['private_context','closed','getter_after_close','private_phases']);
 const publicText=JSON.stringify(f.ctx.report);for(const x of['PRIVATE_CANCEL_QUERY_CANARY','PRIVATE_EXTRA','SECRET'])assert(!publicText.includes(x));
 assert(f.privateRecords.some(x=>x.context?.includes('PRIVATE_CANCEL_QUERY_CANARY')));
});

test('normal success is diagnostic nonreproduction, not performance acceptance or another call',async()=>{
 const f=fixture({success:true});await runDiagnostic(f.ctx);const r=f.ctx.report.generation_stage_diagnostic.call;
 assert.equal(f.generations(),1);assert.equal(r.result.ok,true);assert.equal(r.diagnostic_status,'cancellation_not_reproduced');assert.equal(r.stages.terminal,'measure_exit');assert.equal(r.performance_acceptance,false);assert.equal(f.ctx.report.generation_stage_diagnostic.single_call_completed,true);assert.deepEqual(f.order,['closed','getter_after_close','private_phases']);
});

test('failed private context sink fails closed, still closes receiver and preserves private phase records',async()=>{
 const f=fixture({custodyFails:true});await assert.rejects(runDiagnostic(f.ctx),/DIAG_PRIVATE_CUSTODY_FAILED/u);
 const r=f.ctx.report.generation_stage_diagnostic.call;assert.equal(f.generations(),1);assert.equal(r.result,undefined);assert.equal(r.rolled_back,true);assert.equal(r.stage_projection_unavailable,true);assert.equal(r.private_phase_custody.normal_return,true);assert(!JSON.stringify(f.ctx.report).includes('PRIVATE_CANCEL_QUERY_CANARY'));
});
