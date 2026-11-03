import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile}from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath}from 'node:url';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {validateFailed,FAILED_PATH,FAILED_SHA}from './admit.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');

test('actual d093 remains a failed one-call baseline with unknown current phase',async()=>{
 const raw=await readFile(path.join('D:/Everyone/Presentation/Everyone-Presentation-Studio',FAILED_PATH));assert.equal(sha(raw),FAILED_SHA);
 const r=JSON.parse(raw.toString('utf8')),outcome=JSON.parse(await readFile(path.join(ROOT,'tracking/evidence/m07/presentation-generation-assignment-proof/d093fd61-outcome.json'),'utf8'));
 const v=validateFailed(r,outcome);assert.equal(v.result,'failed');assert.equal(v.actual_cancelled_subphase,'unknown');assert.equal(v.no_performance_acceptance,true);assert.equal(v.replayed,false);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const bad=copy(r);bad.combined_generation.first_calls.push(copy(bad.combined_generation.first_calls[0]));assert.throws(()=>validateFailed(bad,outcome));
 const context=copy(outcome);context.current_cancelled_subphase='review_and_fit';assert.throws(()=>validateFailed(r,context));
 const lost=copy(r);lost.original_data_catalogue_and_global_roles_unchanged=false;assert.throws(()=>validateFailed(lost,outcome));
});
