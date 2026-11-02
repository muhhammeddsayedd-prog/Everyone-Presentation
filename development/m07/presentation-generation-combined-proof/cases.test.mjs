/** Synthetic ports only: first-call order, evidence retention and equality. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {firstWholeGenerations,projectionEqualities,missingFrameEquality}from './cases.mjs';
function fake({candidateFailure=false,projectionDrift=false,missingFrameUnblocked=false}={}){
 let variant='old',pid=100;const sessions=[],baseline={synthetic_baseline:true};
 const ctx={runId:'00000000-0000-4000-8000-000000000001',report:{combined_generation:{}},baseline,id:label=>label==='media-2'?'00000000-0000-4000-8000-000000000002':'00000000-0000-4000-8000-000000000004',profiles:{control:{workspace:'control',series:'control-series',meta:{input:{expected_input_fingerprint:'same'}}},large:{workspace:'large',series:'large-series',meta:{input:{expected_input_fingerprint:'same'}}}},acting:(mode,role)=>'/*'+mode+'/'+role+'*/',value:async()=>baseline,captureError:async()=>({normal_return:true,private_file:'synthetic-private-error.json'}),installVariant:async value=>{variant=value;},startFreshGeneration:async tag=>{
  assert(/^[a-z_]{1,15}$/u.test(tag));const state={tag,variant,pid:++pid,requests:[],finished:false,done:Promise.resolve(0),finish:async()=>{state.finished=true;},request:async sql=>{
   state.requests.push(sql);
    if(sql.includes('delete from eps.candidate_media_frames'))return[{deleted:true}];
   if(sql.includes("locksource41_measure('generate'")){
    assert.equal(state.requests.length,2);assert(state.requests[0].startsWith('begin;'));
    const canceled=variant==='old'&&tag==='wf_oml'||candidateFailure&&variant==='candidate';
    return[canceled?{ok:false,code:'57014',duration_ms:8000}:{ok:true,duration_ms:100,role:'authenticated',resource_id:'00000000-0000-4000-8000-000000000002'}];
   }
   if(sql.includes('locksource41_generated_projection'))return[{normalized_snapshot_sha256:projectionDrift&&variant==='candidate'?'different':'same',job_status:'queued',outbox_rows:1}];
   if(sql.includes('data_reuse_pin_projection'))return[{private_filename_in_output:false,pin_metadata_sha256:'same'}];
   if(sql.includes('combined_manifest_projection'))return[{normalized_manifest_sha256:'same',inventory_sha256:'same',input_fingerprint:'same',stored_snapshot_hash_valid:true,stored_manifest_hash_valid:true,stored_inventory_hash_valid:true}];
   if(sql.includes('locksource41_measure('))return[{ok:true,duration_ms:100,contract_hash:projectionDrift&&variant==='candidate'?'different':'same',...(tag.startsWith('mf_')?{can_generate:missingFrameUnblocked&&variant==='candidate',blocking_codes:missingFrameUnblocked&&variant==='candidate'?[]:['FRAME_UNAVAILABLE']}:{})}];
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
test('own missing selected frame retains original snapshot blocking and hash equality, separately from helper races',async()=>{
 const f=fake();f.ctx.report.combined_generation.actual_first_whole_generation_matrix_completed=true;await missingFrameEquality(f.ctx);
 const rows=f.ctx.report.combined_generation.missing_selected_frame;assert.equal(rows.length,2);assert(rows.every(x=>x.own_pair_deleted&&x.rolled_back&&x.full_baseline_restored));assert.equal(f.ctx.report.combined_generation.missing_selected_frame_blocking_equal,true);
});
test('new body cannot silently drop missing-frame blocking; failed response remains before assertion',async()=>{
 const f=fake({missingFrameUnblocked:true});f.ctx.report.combined_generation.actual_first_whole_generation_matrix_completed=true;await assert.rejects(missingFrameEquality(f.ctx));
 const row=f.ctx.report.combined_generation.missing_selected_frame.at(-1);assert.equal(row.variant,'candidate');assert.equal(row.snapshot.can_generate,true);assert.equal(row.rolled_back,true);assert.equal(f.ctx.report.combined_generation.missing_selected_frame_blocking_equal,undefined);
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
 const f=fake();await firstWholeGenerations(f.ctx);await projectionEqualities(f.ctx);assert.equal(f.ctx.report.combined_generation.projections.length,16);assert.equal(f.ctx.report.combined_generation.review_and_snapshot_contract_equalities_completed,true);assert.equal(new Set(f.sessions.map(x=>x.tag)).size,24);
 const g=fake({projectionDrift:true});g.ctx.report.combined_generation.actual_first_whole_generation_matrix_completed=true;await assert.rejects(projectionEqualities(g.ctx));assert.equal(g.ctx.report.combined_generation.projections.length,16);
});
