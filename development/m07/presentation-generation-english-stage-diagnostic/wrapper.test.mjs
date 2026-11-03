/** Public evidence fixtures and synthetic mutations only; no provider/SQL. */
import assert from 'node:assert/strict';
import {Buffer}from 'node:buffer';
import {readFile}from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {validateFailed,admitRecordedSource,FAILED_PATH}from './admit.mjs';
// The immutable actual receipt and its original runtime seals live in Main.
// This is public file I/O only, never a provider/database reader.
const root='D:/Everyone/Presentation/Everyone-Presentation-Studio';
const original=JSON.parse(await readFile(path.join(root,FAILED_PATH),'utf8'));
const outcome=JSON.parse(await readFile(path.join(root,'tracking/evidence/m07/presentation-generation-english-full-proof/c20a8614-outcome.json'),'utf8'));
const clone=value=>JSON.parse(JSON.stringify(value));

test('actual c20 failed first-only application stays stage-unknown and final restore-unreached',()=>{
 const result=validateFailed(original,outcome);
 assert.equal(result.application_result,'failed57014');assert.equal(result.interrupted_current_stage,'unknown');
 assert.equal(result.in_callback_final_six_restore,'unreached');assert.equal(result.previous_9ed_stage_not_relabeled,true);
 assert.equal(result.all_later_matrix_semantic_lock_authority_and_performance_scopes_unreached,true);
});

test('wrong English source/authority, extra call, missing cleanup and invented stage are refused',()=>{
 for(const mutate of[
  r=>{r.data_reuse_body_installations[1].actual['eps.capture_presentation_video_english_transcripts'].source='0'.repeat(64);},
  r=>{r.data_reuse_body_installations[1].actual['eps.capture_presentation_video_english_transcripts'].authority.prosecdef=true;},
  r=>{r.combined_generation.first_calls.push(clone(r.combined_generation.first_calls[0]));},
  r=>{r.shared_lock_released=false;},
  r=>{r.combined_generation.original4107_and_all_five_old_bodies_restored=true;},
 ]){const r=clone(original);mutate(r);assert.throws(()=>validateFailed(r,outcome));}
 const changed=clone(outcome);changed.current_cancellation_stack_or_stage='english_companion_capture';assert.throws(()=>validateFailed(original,changed));
});

test('only actual known entry flag closure is admitted; every other source byte stays exact',async()=>{
 const entry='development/m07/presentation-generation-english-full-proof/entry.mjs';
 const closed=await readFile(path.join(root,entry));const armed=Buffer.from(closed.toString('utf8').replace('export const EXECUTION_ENABLED=false;','export const EXECUTION_ENABLED=true;'));
 for(const bytes of[closed,armed])admitRecordedSource(entry,sha(armed),bytes);
 assert.throws(()=>admitRecordedSource(entry,sha(armed),Buffer.concat([closed,Buffer.from('\n')])));
 const name='development/m07/presentation-generation-english-full-proof/compiler.py',raw=await readFile(path.join(root,name));
 admitRecordedSource(name,sha(raw),raw);assert.throws(()=>admitRecordedSource(name,sha(raw),Buffer.concat([raw,Buffer.from('\n')])));
});
