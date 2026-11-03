/** Shared dated admission fake/immutable evidence checks only. */
import assert from 'node:assert/strict';
import {Buffer}from 'node:buffer';
import {readFile}from 'node:fs/promises';
import test from 'node:test';
import {URL}from 'node:url';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {validate9ed,admitRecordedSource,FAILED_PATH,FAILED_SHA}from './admit.mjs';

test('actual9ed English query interruption stays failed with candidate/restoration indices distinct',async()=>{
 const raw=await readFile('D:/Everyone/Presentation/Everyone-Presentation-Studio/'+FAILED_PATH);assert.equal(sha(raw),FAILED_SHA);const r=JSON.parse(raw),outcome=JSON.parse(await readFile(new URL('../../../tracking/evidence/m07/presentation-generation-raw-companion-stage-diagnostic/9ed4ca6c-outcome.json',import.meta.url)));
 const e=validate9ed(r,outcome);assert.equal(e.current_observed_stage,'english_companion_capture');assert.equal(e.English_rows_or_INSERT_count_observed,false);assert.equal(e.dominant_cost_or_performance_proven,false);
 for(const change of[x=>{x.generation_stage_diagnostic.call.result.ok=true;},x=>{x.generation_stage_diagnostic.call.cancellation.stage='raw_source_companion_capture';},x=>{x.data_reuse_body_installations[1].actual['eps.review_snapshot_data'].source='0'.repeat(64);},x=>{x.data_reuse_body_installations[1].actual['eps.capture_presentation_video_transcripts'].authority.prosecdef=true;},x=>{x.data_reuse_body_installations[2].expected[3].source='0'.repeat(64);},x=>{x.shared_lock_released=false;}]){const bad=JSON.parse(raw);change(bad);assert.throws(()=>validate9ed(bad,outcome));}
});
test('only exact9ed stage entry closure is qualified; other sources stay exact',async()=>{
 const r=JSON.parse(await readFile('D:/Everyone/Presentation/Everyone-Presentation-Studio/'+FAILED_PATH));const name='development/m07/presentation-generation-raw-companion-stage-diagnostic/entry.mjs',armed=r.source_seals[name],closed=await readFile(new URL('../presentation-generation-raw-companion-stage-diagnostic/entry.mjs',import.meta.url));
 admitRecordedSource(name,armed,closed);const live=Buffer.from(closed.toString().replace('export const EXECUTION_ENABLED=false;','export const EXECUTION_ENABLED=true;'));admitRecordedSource(name,armed,live);
 assert.throws(()=>admitRecordedSource(name,armed,Buffer.concat([closed,Buffer.from('\n')])));assert.throws(()=>admitRecordedSource(name,sha(closed),closed));admitRecordedSource('other',sha(closed),closed);assert.throws(()=>admitRecordedSource('other',sha(closed),live));
});
