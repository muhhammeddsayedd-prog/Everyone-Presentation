/** Reuse the exact strict parser/custody fake cases; no child SQL or provider. */
import '../presentation-generation-stage-diagnostic/run.test.mjs';
import '../presentation-generation-stage-diagnostic/markers.test.mjs';
import assert from 'node:assert/strict';
import {Buffer}from 'node:buffer';
import test from 'node:test';
import {readFile}from 'node:fs/promises';
import {URL}from 'node:url';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {validateFailed,admitRecordedSource,FAILED_PATH,FAILED_SHA}from './admit.mjs';

test('exact actual a820 is cancelled and all later scope unavailable, never prior d958 context',async()=>{
 const raw=await readFile('D:/Everyone/Presentation/Everyone-Presentation-Studio/'+FAILED_PATH);assert.equal(sha(raw),FAILED_SHA);
 const r=JSON.parse(raw),outcome=JSON.parse(await readFile(new URL('../../../tracking/evidence/m07/presentation-generation-lock-acquisition-proof/a8203194-outcome.json',import.meta.url)));
 const result=validateFailed(r,outcome);assert.equal(result.current_cancelled_subphase,'unknown');assert.equal(result.prior_d958_context_not_relabeled,true);assert.equal(result.performance_acceptance,false);
 for(const mutate of[x=>{x.combined_generation.first_calls[0].generation.ok=true;},x=>{x.combined_generation.helper_installations[0].source_sha256='0'.repeat(64);},x=>{x.shared_lock_released=false;}]){
  const bad=JSON.parse(JSON.stringify(r));mutate(bad);assert.throws(()=>validateFailed(bad,outcome));
 }
});

test('only exact a820 entry true-to-false closure is qualified, every other byte remains sealed',async()=>{
 const name='development/m07/presentation-generation-lock-acquisition-proof/entry.mjs',armed='a40af5d5f772ba938074b7ee5f06cf9f27237a3c29677d9e9cdc17b36d9488d2';
 const closed=await readFile(new URL('../presentation-generation-lock-acquisition-proof/entry.mjs',import.meta.url));
 admitRecordedSource(name,armed,closed);
 const live=Buffer.from(closed.toString().replace('export const EXECUTION_ENABLED=false;','export const EXECUTION_ENABLED=true;'));
 admitRecordedSource(name,armed,live);
 for(const bytes of[Buffer.concat([closed,Buffer.from('\n')]),Buffer.from(closed.toString().replace('assert.notEqual','assert.equal'))])assert.throws(()=>admitRecordedSource(name,armed,bytes));
 assert.throws(()=>admitRecordedSource(name,sha(closed),closed));
 admitRecordedSource('other-source',sha(closed),closed);assert.throws(()=>admitRecordedSource('other-source',sha(closed),live));
});
