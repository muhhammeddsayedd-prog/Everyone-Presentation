import '../presentation-generation-stage-diagnostic/run.test.mjs';
import '../presentation-generation-stage-diagnostic/markers.test.mjs';
import assert from 'node:assert/strict';
import {Buffer}from 'node:buffer';
import {readFile}from 'node:fs/promises';
import test from 'node:test';
import {URL}from 'node:url';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {projectContext}from '../presentation-generation-cancel-diagnostic/capture.mjs';
import {validateFailed,admitRecordedSource,FAILED_PATH,FAILED_SHA}from './admit.mjs';

test('actual633 normal restoration is not generation success or a known current phase',async()=>{
 const raw=await readFile('D:/Everyone/Presentation/Everyone-Presentation-Studio/'+FAILED_PATH);assert.equal(sha(raw),FAILED_SHA);const r=JSON.parse(raw),outcome=JSON.parse(await readFile(new URL('../../../tracking/evidence/m07/presentation-generation-raw-companion-first-proof/63350829-outcome.json',import.meta.url)));
 const value=validateFailed(r,outcome);assert.equal(value.current_cancelled_subphase,'unknown');assert.equal(value.previous_ee38_context_not_relabeled,true);assert.equal(value.performance_acceptance,false);
 for(const change of[x=>{x.generation_first_call.call.result.ok=true;},x=>{x.generation_first_call.call.child_exit=3;},x=>{x.data_reuse_body_installations[1].expected[3].source='0'.repeat(64);},x=>{x.data_reuse_body_installations[1].actual['eps.capture_presentation_video_transcripts'].source='0'.repeat(64);},x=>{x.data_reuse_body_installations[1].actual['eps.capture_presentation_video_transcripts'].authority.prosecdef=true;},x=>{x.data_reuse_body_installations[2].expected[3].source='0'.repeat(64);},x=>{x.shared_lock_released=false;}]){const bad=JSON.parse(raw);change(bad);assert.throws(()=>validateFailed(bad,outcome));}
});
test('only actual633 entry literal closure is admitted; no other byte normalization',async()=>{
 const name='development/m07/presentation-generation-raw-companion-first-proof/entry.mjs',armed='dbf5e165d81d87e5c4b6cd4097db3bce45e7ea14c04278b84b59e3622cccc3c3';const closed=await readFile(new URL('../presentation-generation-raw-companion-first-proof/entry.mjs',import.meta.url));
 admitRecordedSource(name,armed,closed);admitRecordedSource(name,armed,Buffer.from(closed.toString().replace('export const EXECUTION_ENABLED=false;','export const EXECUTION_ENABLED=true;')));
 assert.throws(()=>admitRecordedSource(name,armed,Buffer.concat([closed,Buffer.from('\n')])));assert.throws(()=>admitRecordedSource(name,sha(closed),closed));
});
test('unchanged closed parser distinguishes current raw58-line body and English nested frame',()=>{
 const map={candidate_generate_body_sha256:'b3bc105e6fb7d14194b04db6dbb5e8bbaad8bad9fe237d276cbde751c112b2a3',line_stages:[]};
 const outer='\nPL/pgSQL function public.eps_generate_version(uuid,jsonb,text) line 64 at PERFORM';
 const raw='SQL statement "PRIVATE_SENTINEL"\nPL/pgSQL function eps.capture_presentation_video_transcripts(uuid) line 43 at SQL statement'+outer;
 const a=projectContext(raw,map);assert.equal(a.stage,'raw_source_companion_capture');assert.equal(a.allowlisted_frames[0].line,43);assert(!JSON.stringify(a).includes('PRIVATE_SENTINEL'));
 const b=projectContext('PL/pgSQL function eps.capture_presentation_video_english_transcripts(uuid) line 20 at SQL statement\nPL/pgSQL function eps.capture_presentation_video_transcripts(uuid) line 55 at PERFORM'+outer,map);
 assert.equal(b.stage,'english_companion_capture');assert.equal(b.allowlisted_frames[0].function,'eps.capture_presentation_video_english_transcripts');assert.equal(b.allowlisted_frames[0].line,20);assert.equal(b.unknown_frame_count,0);
});
