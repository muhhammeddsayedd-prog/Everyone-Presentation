/** Actual public evidence and synthetic context only; no SQL/provider. */
import assert from 'node:assert/strict';
import {Buffer}from 'node:buffer';
import {readFile}from 'node:fs/promises';
import test from 'node:test';
import {sha}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-lock-source-proof/proof.mjs';
import {custodyAndStrip}from 'file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/presentation-generation-cancel-diagnostic/capture.mjs';
import {validateFailed,admitRecordedSource,admitCarry,FAILED_PATH}from './admit.mjs';
const ROOT='D:/Everyone/Presentation/Everyone-Presentation-Studio/';
const raw=JSON.parse(await readFile(ROOT+FAILED_PATH)),safe=JSON.parse(await readFile(ROOT+'tracking/evidence/m07/presentation-generation-scalar-full-proof/c024137f-outcome.json'));
const clone=x=>JSON.parse(JSON.stringify(x));

test('actual212-source c024 admission keeps current cancellation unknown and final restore unreached',async()=>{
 const value=validateFailed(raw,safe);assert.equal(value.current_cancelled_stage,'unknown');assert.equal(value.final_in_callback_original_seven_restore,'unreached');
 const admitted=await admitCarry(ROOT);assert.equal(admitted.evidence.current7_first_c024.normal_process_exit,1);
 for(const mutate of[
  r=>{r.data_reuse_body_installations[1].actual['eps.mcp_token_permits_capability'].source='0'.repeat(64);},
  r=>{r.data_reuse_body_installations[1].actual['public.eps_validate_own_oauth_session'].authority.prosecdef=false;},
  r=>{r.combined_generation.first_calls.push(clone(r.combined_generation.first_calls[0]));},
  r=>{r.shared_lock_released=false;},r=>{r.combined_generation.original4107_and_all_six_old_bodies_restored=true;},
 ]){const r=clone(raw);mutate(r);assert.throws(()=>validateFailed(r,safe));}
 const bad=clone(safe);bad.current_cancellation_stack_or_stage='english_companion_capture';assert.throws(()=>validateFailed(raw,bad));
});

test('sole known raw entry closure admitted, all other bytes unchanged',async()=>{
 const name='development/m07/presentation-generation-scalar-full-proof/entry.mjs',closed=await readFile(ROOT+name),armed=Buffer.from(closed.toString().replace('export const EXECUTION_ENABLED=false;','export const EXECUTION_ENABLED=true;'));
 for(const bytes of[closed,armed])admitRecordedSource(name,sha(armed),bytes);
 assert.throws(()=>admitRecordedSource(name,sha(armed),Buffer.concat([closed,Buffer.from('\n')])));
 assert.throws(()=>admitRecordedSource(name,'0'.repeat(64),closed));
});

test('frozen context custody already recognizes scalar frames and retains unknown count without raw leaks',async()=>{
 const canary='PRIVATE_CONTEXT_CANARY';const context='PL/pgSQL function eps.mcp_token_permits_capability(text) line 29 at SQL statement\nSQL function "mcp_token_permits_capability" statement 1\nPL/pgSQL function eps.capture_presentation_video_english_transcripts(uuid) line 12 at FOR over SELECT rows\nPL/pgSQL function private_unknown.fn(uuid) line 1 at SQL statement\n'+canary;
 let stored;const row={ok:false,code:'57014',duration_ms:8000,operation:'generate',__owned_private_cancel:{context,message:'canceling statement due to statement timeout',sqlstate:'57014'}};
 const result=await custodyAndStrip([row],async value=>{stored=value;return{normal_return:true,private_file:'context.json',sha256:'a'.repeat(64),extra:canary};},{candidate_generate_body_sha256:'5b0f389300a86b9cfa0b39e182eaca49f5bac81566e0bb72be1caa152faecca1',line_stages:[]});
 assert.equal(stored.context,context);assert.equal(result.cancellation.unknown_frame_count,1);
 assert(result.cancellation.allowlisted_frames.some(x=>x.function==='eps.mcp_token_permits_capability'));
 assert(result.cancellation.allowlisted_frames.some(x=>x.function==='mcp_token_permits_capability'));
 assert.equal(result.cancellation.stage,'english_companion_capture');assert(!JSON.stringify(result).includes(canary));
});
