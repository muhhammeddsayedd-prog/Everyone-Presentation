/** Synthetic rows/ports and immutable failed receipt only; no SQL execution. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile}from 'node:fs/promises';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {custodyAndStrip}from './capture.mjs';
import {runDiagnostic}from './run.mjs';
import {validateFailed,FAILED_SHA,FAILED_PATH}from './admit.mjs';
const stages={candidate_generate_body_sha256:'a5e5c60d3f94d9e05c62fc1cfc76ac4552713000b72b1efe4eac028da15c0d40',line_stages:[{line:1,stage:'input_authority_and_series_fence'},{line:22,stage:'source_locking'},{line:26,stage:'review_and_fit'}]};
const context='SQL statement "PRIVATE_SENTINEL"\nPL/pgSQL function eps.review_snapshot_data(uuid,uuid,text) line 43 at SQL statement\nPL/pgSQL function public.eps_generate_version(uuid,jsonb,text) line 26 at assignment\nPL/pgSQL function private_secret_function() line 1 at SQL statement';
const canceled=()=>({ok:false,code:'57014',operation:'generate',duration_ms:8000,__owned_private_cancel:{context,message:'canceling statement due to statement timeout',sqlstate:'57014'}});
const sink=async payload=>({private_file:'query-canceled-private.json',sha256:sha(JSON.stringify(payload)),normal_return:true,unwanted_private_copy:payload});

test('raw context custody precedes closed public result; raw SQL/names and sink extras never copied',async()=>{
 let written;const result=await custodyAndStrip([canceled()],async payload=>{written=payload;return sink(payload);},stages);
 assert.equal(written.context,context);assert.equal(result.cancellation.stage,'review_and_fit');assert.equal(result.cancellation.message_class,'statement_timeout');assert.equal(result.cancellation.unknown_frame_count,1);
 assert(!JSON.stringify(result).includes('PRIVATE_SENTINEL'));assert(!JSON.stringify(result).includes('private_secret_function'));assert(!JSON.stringify(result).includes('__owned_private_cancel'));assert(!JSON.stringify(result).includes('unwanted_private_copy'));
});
test('missing/corrupt/uncustodied cancellation fails closed and empty context stays unknown',async()=>{
 await assert.rejects(custodyAndStrip([{ok:false,code:'57014'}],sink,stages),{message:'DIAG_CANCEL_CONTEXT_MISSING'});
 await assert.rejects(custodyAndStrip([canceled()],async()=>{throw Error('PRIVATE_SINK_ERROR');},stages),{message:'DIAG_PRIVATE_CUSTODY_FAILED'});
 const empty=canceled();empty.__owned_private_cancel.context='';const result=await custodyAndStrip([empty],sink,stages);assert.equal(result.cancellation.context_empty,true);assert.equal(result.cancellation.stage,'unknown');
});
test('unexpected extra raw fields cannot cross public metric whitelist',async()=>{
 await assert.rejects(custodyAndStrip([{...canceled(),context:'PRIVATE_SIDE_CHANNEL'}],sink,stages),{message:'DIAG_METRIC_KEYS_UNEXPECTED'});
});
test('one fresh MCP call only; cancellation and non-reproduction both rollback without performance acceptance',async()=>{
 for(const cancel of[true,false]){
  let calls=0,finished=false,sinks=0;const baseline={synthetic:true};
  const ctx={runId:'00000000-0000-4000-8000-000000000001',report:{generation_cancel_diagnostic:{}},profiles:{large:{workspace:'workspace',series:'series',meta:{input:{}}}},baseline,bindings:{diagnosticStageMap:stages},acting:()=>'',value:async()=>baseline,custodyDiagnostic:async payload=>{sinks++;return sink(payload);},captureError:async()=>({normal_return:true}),startFreshGeneration:async tag=>{
   assert(/^[a-z_]{1,15}$/u.test(tag));return{pid:123,done:Promise.resolve(0),finish:async()=>{finished=true;},request:async sql=>{if(sql.includes("locksource41_measure('generate'")){calls++;return[cancel?canceled():{ok:true,duration_ms:7000,role:'authenticated',status:'queued'}];}return[];}};
  }};
  await runDiagnostic(ctx);const record=ctx.report.generation_cancel_diagnostic.call;assert.equal(calls,1);assert.equal(sinks,cancel?1:0);assert.equal(finished,true);assert.equal(record.rolled_back,true);assert.equal(record.full_fresh_baseline_restored,true);assert.equal(record.performance_acceptance,false);assert.equal(record.diagnostic_status,cancel?'cancellation_observed_private_context_preserved':'cancellation_not_reproduced');assert(!JSON.stringify(ctx.report).includes('PRIVATE_SENTINEL'));
 }
});
test('actual78 remains failed with eight recorded baselines; context diagnostic never relabels it',async()=>{
 const raw=await readFile('D:/Everyone/Presentation/Everyone-Presentation-Studio/'+FAILED_PATH);assert.equal(sha(raw),FAILED_SHA);const r=JSON.parse(raw);assert.equal(validateFailed(r).unchanged_failed_performance_acceptance,true);
 const changed=JSON.parse(raw);changed.result='passed';assert.throws(()=>validateFailed(changed));
});
