/** Exact failed evidence + frozen strict phase/custody fake ports; no SQL. */
import '../presentation-generation-stage-diagnostic/run.test.mjs';
import '../presentation-generation-stage-diagnostic/markers.test.mjs';
import assert from 'node:assert/strict';
import {Buffer}from 'node:buffer';
import test from 'node:test';
import {readFile}from 'node:fs/promises';
import {URL}from 'node:url';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {validateFailed,admitRecordedSource,FAILED_PATH,FAILED_SHA}from './admit.mjs';

test('exact374 has no current stack or later acceptance; eeca is not relabeled',async()=>{
 const raw=await readFile('D:/Everyone/Presentation/Everyone-Presentation-Studio/'+FAILED_PATH);assert.equal(sha(raw),FAILED_SHA);
 const r=JSON.parse(raw),outcome=JSON.parse(await readFile(new URL('../../../tracking/evidence/m07/presentation-generation-pin-batch-proof/374eead8-outcome.json',import.meta.url)));
 const result=validateFailed(r,outcome);assert.equal(result.current_cancelled_subphase,'unknown');assert.equal(result.prior_eeca_context_not_relabeled,true);assert.equal(result.performance_acceptance,false);
 for(const mutate of[x=>{x.combined_generation.first_calls[0].generation.ok=true;},x=>{x.data_reuse_body_installations.at(-1).expected[2].source='0'.repeat(64);},x=>{x.shared_lock_released=false;},x=>{x.pin_batch_cases={candidate:{passed:true}};}]){
  const bad=JSON.parse(JSON.stringify(r));mutate(bad);assert.throws(()=>validateFailed(bad,outcome));
 }
 const badOutcome=JSON.parse(JSON.stringify(outcome));badOutcome.current_cancellation_stack_or_stage_observed=true;assert.throws(()=>validateFailed(r,badOutcome));
});

test('only exact374 entry flag closure is admitted, not normalization or other drift',async()=>{
 const name='development/m07/presentation-generation-pin-batch-proof/entry.mjs',armed='bfe59d0a8876245a510eb711fce70a5a57c1f683a6219ace9d34a416aa840046';
 const closed=await readFile(new URL('../presentation-generation-pin-batch-proof/entry.mjs',import.meta.url));
 admitRecordedSource(name,armed,closed);
 const live=Buffer.from(closed.toString().replace('export const EXECUTION_ENABLED=false;','export const EXECUTION_ENABLED=true;'));
 admitRecordedSource(name,armed,live);
 for(const bytes of[Buffer.concat([closed,Buffer.from('\n')]),Buffer.from(closed.toString().replace('assert.notEqual','assert.equal'))])assert.throws(()=>admitRecordedSource(name,armed,bytes));
 assert.throws(()=>admitRecordedSource(name,sha(closed),closed));
 admitRecordedSource('other-source',sha(closed),closed);assert.throws(()=>admitRecordedSource('other-source',sha(closed),live));
});
