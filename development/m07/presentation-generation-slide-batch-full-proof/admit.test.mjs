import assert from 'node:assert/strict';
import {Buffer}from 'node:buffer';
import {readFile}from 'node:fs/promises';
import test from 'node:test';
import {URL}from 'node:url';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {validateF540,admitRecordedSource,FAILED_PATH,FAILED_SHA}from './admit.mjs';

test('F540 is dated failed application with all five sources/authority and separate canonical restore',async()=>{
 const raw=await readFile('D:/Everyone/Presentation/Everyone-Presentation-Studio/'+FAILED_PATH);assert.equal(sha(raw),FAILED_SHA);const r=JSON.parse(raw),outcome=JSON.parse(await readFile(new URL('../../../tracking/evidence/m07/presentation-generation-english-stage-diagnostic/f540866b-outcome.json',import.meta.url)));const result=validateF540(r,outcome);
 assert.equal(result.application_result,'failed57014');assert.equal(result.current_slide_GENaf486_not_executed_by_this_receipt,true);assert.equal(result.dominant_cost_or_performance_proven,false);
 for(const change of[x=>{x.generation_stage_diagnostic.call.result.ok=true;},x=>{x.data_reuse_body_installations[1].actual['eps.capture_presentation_video_english_transcripts'].source='0'.repeat(64);},x=>{x.data_reuse_body_installations[1].actual['eps.capture_presentation_video_english_transcripts'].authority.prosecdef=true;},x=>{x.data_reuse_body_installations[2].expected[4].source='0'.repeat(64);},x=>{x.shared_lock_released=false;}]){const bad=JSON.parse(raw);change(bad);assert.throws(()=>validateF540(bad,outcome));}
});
test('only exact known F540 entry closure is accepted without normalizing other bytes',async()=>{
 const r=JSON.parse(await readFile('D:/Everyone/Presentation/Everyone-Presentation-Studio/'+FAILED_PATH)),name='development/m07/presentation-generation-english-stage-diagnostic/entry.mjs',armed=r.source_seals[name],closed=await readFile(new URL('../presentation-generation-english-stage-diagnostic/entry.mjs',import.meta.url));
 admitRecordedSource(name,armed,closed);admitRecordedSource(name,armed,Buffer.from(closed.toString().replace('export const EXECUTION_ENABLED=false;','export const EXECUTION_ENABLED=true;')));
 assert.throws(()=>admitRecordedSource(name,armed,Buffer.concat([closed,Buffer.from('\n')])));assert.throws(()=>admitRecordedSource(name,sha(closed),closed));
 admitRecordedSource('other',sha(closed),closed);assert.throws(()=>admitRecordedSource('other',sha(closed),Buffer.concat([closed,Buffer.from('\n')])));
});
