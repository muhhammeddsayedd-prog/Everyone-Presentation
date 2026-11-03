import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile}from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath}from 'node:url';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {validateDiagnostic,DIAGNOSTIC_PATH,DIAGNOSTIC_SHA}from './admit.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const MAIN='D:/Everyone/Presentation/Everyone-Presentation-Studio';
const clone=value=>JSON.parse(JSON.stringify(value));

test('actual dated diagnostic is admitted as a cancelled application, never a performance pass',async()=>{
 const raw=await readFile(path.join(MAIN,DIAGNOSTIC_PATH));assert.equal(sha(raw),DIAGNOSTIC_SHA);
 const outcome=JSON.parse(await readFile(path.join(ROOT,'tracking/evidence/m07/presentation-generation-cancel-diagnostic/13f5ba7e-outcome.json'),'utf8'));
 const r=JSON.parse(raw.toString('utf8')),v=validateDiagnostic(r,outcome);
 assert.equal(v.application_generation,'statement_timeout57014');assert.equal(v.performance_acceptance,false);assert.equal(v.replayed,false);assert.equal(v.dominant_cost_or_invocation_count_claimed,false);
 for(const change of[
  x=>{x.generation_cancel_diagnostic.performance_or_release_acceptance=true;},
  x=>{x.original_data_catalogue_and_global_roles_unchanged=false;},
  x=>{x.generation_cancel_diagnostic.call.result.ok=true;},
 ]){const bad=clone(r);change(bad);assert.throws(()=>validateDiagnostic(bad,outcome));}
 const unknown=clone(outcome);unknown.normal_process_exit=null;assert.throws(()=>validateDiagnostic(r,unknown));
});
