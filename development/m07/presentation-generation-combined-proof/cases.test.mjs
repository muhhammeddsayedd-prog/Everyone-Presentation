/** Synthetic ports only: first-call order, evidence retention and equality. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {firstWholeGenerations,projectionEqualities}from './cases.mjs';
function fake({candidateFailure=false,projectionDrift=false}={}){
 let variant='old',pid=100;const sessions=[],baseline={synthetic_baseline:true};
 const ctx={runId:'00000000-0000-4000-8000-000000000001',report:{combined_generation:{}},baseline,profiles:{control:{workspace:'control',series:'control-series',meta:{input:{expected_input_fingerprint:'same'}}},large:{workspace:'large',series:'large-series',meta:{input:{expected_input_fingerprint:'same'}}}},acting:(mode,role)=>'/*'+mode+'/'+role+'*/',value:async()=>baseline,captureError:async()=>({normal_return:true,private_file:'synthetic-private-error.json'}),installVariant:async value=>{variant=value;},startFreshGeneration:async tag=>{
  const state={tag,variant,pid:++pid,requests:[],finished:false,done:Promise.resolve(0),finish:async()=>{state.finished=true;},request:async sql=>{
   state.requests.push(sql);
   if(sql.includes("locksource41_measure('generate'")){
    assert.equal(state.requests.length,2);assert(state.requests[0].startsWith('begin;'));
    const canceled=variant==='old'&&tag.includes('mcp_large')||candidateFailure&&variant==='candidate';
    return[canceled?{ok:false,code:'57014',duration_ms:8000}:{ok:true,duration_ms:100,role:'authenticated',resource_id:'00000000-0000-4000-8000-000000000002'}];
   }
   if(sql.includes('locksource41_generated_projection'))return[{normalized_snapshot_sha256:projectionDrift&&variant==='candidate'?'different':'same',job_status:'queued',outbox_rows:1}];
   if(sql.includes('data_reuse_pin_projection'))return[{private_filename_in_output:false,pin_metadata_sha256:'same'}];
   if(sql.includes('locksource41_measure('))return[{ok:true,duration_ms:100,contract_hash:projectionDrift&&variant==='candidate'?'different':'same'}];
   return[];
  }};sessions.push(state);return state;
 }};
 return{ctx,sessions};
}
test('eight distinct first-public-call backends preserve old cancellation and candidate projection hashes, rollback all',async()=>{
 const f=fake();await firstWholeGenerations(f.ctx);const rows=f.ctx.report.combined_generation.first_calls;
 assert.equal(rows.length,8);assert.equal(new Set(rows.map(x=>x.pid)).size,8);assert(rows.every(x=>x.rolled_back&&x.full_baseline_restored));
 assert.equal(rows.find(x=>x.variant==='old'&&x.mode==='mcp'&&x.label==='large').baseline_cancellation_retained,true);
 assert.equal(rows.find(x=>x.variant==='candidate'&&x.mode==='mcp'&&x.label==='large').old_generation_projection_unavailable,true);
 assert(f.sessions.every(x=>x.finished));
});
test('new whole-generation failure retains server/client response before assertion and stops, without a warm retry',async()=>{
 const f=fake({candidateFailure:true});await assert.rejects(firstWholeGenerations(f.ctx),/^AssertionError.*COMBINED_NEW_WHOLE_GENERATION_FAILED/u);
 const rows=f.ctx.report.combined_generation.first_calls;assert.equal(rows.length,5);const failed=rows.at(-1);
 assert.equal(failed.generation.code,'57014');assert.equal(failed.generation.duration_ms,8000);assert.equal(typeof failed.client_elapsed_ms,'number');assert.equal(failed.rolled_back,true);
 assert.equal(f.ctx.report.combined_generation.actual_first_whole_generation_matrix_completed,undefined);assert(f.sessions.every(x=>x.finished));
});
test('candidate persisted snapshot drift rejects after actual projections are attached, not claimed equal',async()=>{
 const f=fake({projectionDrift:true});await assert.rejects(firstWholeGenerations(f.ctx));
 const rows=f.ctx.report.combined_generation.first_calls;assert.equal(rows.length,8);assert.equal(rows.at(-1).projection.normalized_snapshot_sha256,'different');assert(rows.every(x=>x.rolled_back));
});
test('projection warming cannot precede the first whole-generation matrix',async()=>{
 const f=fake();await assert.rejects(projectionEqualities(f.ctx),/^AssertionError.*COMBINED_FIRST_MATRIX_REQUIRED_BEFORE_PROJECTIONS/u);assert.equal(f.sessions.length,0);
});
test('post-first review/snapshot equality covers16 actual hash observations; drift is rejected',async()=>{
 const f=fake();await firstWholeGenerations(f.ctx);await projectionEqualities(f.ctx);assert.equal(f.ctx.report.combined_generation.projections.length,16);assert.equal(f.ctx.report.combined_generation.review_and_snapshot_contract_equalities_completed,true);
 const g=fake({projectionDrift:true});g.ctx.report.combined_generation.actual_first_whole_generation_matrix_completed=true;await assert.rejects(projectionEqualities(g.ctx));assert.equal(g.ctx.report.combined_generation.projections.length,16);
});
