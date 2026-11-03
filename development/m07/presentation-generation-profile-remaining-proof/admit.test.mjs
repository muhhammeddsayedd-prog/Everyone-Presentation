import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile}from 'node:fs/promises';
import {Buffer}from 'node:buffer';
import test from 'node:test';
import {REFS,completedCarry,validateCompleted}from './admit.mjs';
import {readBounded}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-lock-source-edge-rls-proof/admit.mjs';
import {runCases}from './entry.mjs';
const ROOT='D:/Everyone/Presentation/Everyone-Presentation-Studio';
const values={};for(const[key,ref]of Object.entries(REFS))values[key]=JSON.parse(await readFile(path.join(ROOT,ref.path)));

test('actual48ed references and220 current source seals admit dated scopes only',async()=>{
 const admitted=await completedCarry(ROOT);
 assert.equal(admitted.executed_in_current_runtime,false);assert.equal(admitted.completed_old_pin_three,true);
 assert.equal(admitted.remaining_security_and_final_restore_not_carried,true);
 assert.equal(admitted.old_data_and_assignment_recomputed_for_fresh_UUID_hash_comparisons,true);
 assert.equal(admitted.production_or_complete_security_acceptance,false);
});

test('missing matrix/AA/frame/pin evidence or altered source cannot be carried',async()=>{
 for(const mutate of[
  v=>v.raw.combined_generation.first_calls.pop(),
  v=>v.raw.combined_generation.projections[0].rolled_back=false,
  v=>v.raw.pool_helper_proof.all_twelve.held_rows=149,
  v=>v.raw.pool_helper_proof.workspace_fence.writer_rolled_back=false,
  v=>v.raw.combined_generation.missing_selected_frame_blocking_equal=false,
  v=>v.raw.pin_batch_cases.old.cases[2].database_clock_expired=false,
  v=>v.raw.raw_authority_cases.old.cases[0].error.sqlstate='57014'
 ]){const v=globalThis.structuredClone(values);mutate(v);assert.throws(()=>validateCompleted(v.raw,v.audit,v.supplement,v.outcome));}
 const target='development/m07/presentation-generation-canonical-profile-full-proof/entry.mjs';
 const original=await readFile(path.join(ROOT,target));
 const armed=Buffer.from(original.toString().replace('export const EXECUTION_ENABLED=false;','export const EXECUTION_ENABLED=true;'));
 await completedCarry(ROOT,async file=>file===path.join(ROOT,target)?armed:readBounded(file));
 await assert.rejects(completedCarry(ROOT,async file=>file===path.join(ROOT,target)?Buffer.concat([original,Buffer.from('\n')]):readBounded(file)));
});

test('new entry stays OFF before any context or transport port is touched',async()=>{
 let reads=0;const ctx=new Proxy({},{get(){reads++;throw Error('PORT_REACHED');}});
 await assert.rejects(runCases(ctx),/PROFILE_REMAINING_PROOF_EXECUTION_DISABLED/u);assert.equal(reads,0);
});
