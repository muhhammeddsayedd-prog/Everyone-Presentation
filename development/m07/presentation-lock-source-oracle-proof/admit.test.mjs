/** Pinned public synthetic receipt only; no private configuration or transport. */
import assert from 'node:assert/strict';
import {readFile}from 'node:fs/promises';
import test from 'node:test';
import {admitTiming,PRIOR_SHA}from './admit.mjs';
const file='D:/Everyone/Presentation/Everyone-Presentation-Studio/tracking/evidence/m07/presentation-lock-source-pool-proof/2026-11-02T18-53-13.327Z-c2f4fe15.json';
test('actual retained c2 timing is admitted only as partial historical evidence',async()=>{
 const result=admitTiming(await readFile(file));assert.equal(result.sha256,PRIOR_SHA);assert.equal(result.fresh_timing_claim,false);assert.match(result.scope,/original oracle failed57014/u);
});
test('changed or parse-only timing evidence is rejected before use',async()=>{
 const before=JSON.parse(await readFile(file));before.pool_helper_proof.cold[0].response.duration_ms=0;
 assert.throws(()=>admitTiming(JSON.stringify(before)),/ORACLE_PRIOR_TIMING_BYTES_CHANGED/u);
 assert.throws(()=>admitTiming('{}'),/ORACLE_PRIOR_TIMING_BYTES_CHANGED/u);
});
