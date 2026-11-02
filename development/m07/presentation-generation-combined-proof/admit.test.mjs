/** Immutable actual helper receipts and pure future-profile admission only. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile}from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath}from 'node:url';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {admitCarry,freshCarry,validateSecurity,SECURITY_PATH,SECURITY_SHA}from './admit.mjs';
const MAIN='D:/Everyone/Presentation/Everyone-Presentation-Studio';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
test('actual remaining-RC normal pass admitted as helper-only; altered wait/clock/restore cannot pass',async()=>{
 const raw=await readFile(path.join(MAIN,SECURITY_PATH));assert.equal(sha(raw),SECURITY_SHA);const r=JSON.parse(raw),outcome={normal_process_exit_code:0,actual_receipt:{sha256:SECURITY_SHA}};
 assert.equal(validateSecurity(r,outcome).not_whole_generation_or_four_new_body_acceptance,true);
 for(const mutate of[r=>r.result='failed',r=>r.pool_helper_proof.workspace_fence.actual_distinct_pid_wait=false,r=>r.pool_helper_proof.authority[2].database_clock_expired=false,r=>r.pool_helper_proof.authority[0].authority_restored=false,r=>r.pool_helper_proof.original_presentation_configuration_restored=false]){const copy=JSON.parse(JSON.stringify(r));mutate(copy);assert.throws(()=>validateSecurity(copy,outcome));}
 assert.throws(()=>validateSecurity(r,{...outcome,normal_process_exit_code:1}));
});
test('full dated chain source seals are checked; fresh baseline/qualified namespace and four future body differences required',async()=>{
 const reader=async file=>{try{return await readFile(path.join(ROOT,path.relative(MAIN,file)));}catch(error){if(error.code!=='ENOENT')throw error;return readFile(file);}};
 const admitted=await admitCarry(MAIN,reader);assert.equal(admitted.evidence.additional_actual_remaining_RC.result,'actual_local_remaining_RC_PASS');
 const r=admitted.securityReceipt,ctx={runId:r.run_id,report:r,baseline:JSON.parse(JSON.stringify(r.pool_helper_proof.fresh_baseline)),bindings:{baseSha:admitted.evidence.helper_sha256,candidateSha:admitted.evidence.helper_sha256,beforeBodies:[1,2,3,4].map(x=>({sha:'old'+x})),afterBodies:[1,2,3,4].map(x=>({sha:'new'+x}))}};
 assert.equal(freshCarry(ctx,admitted).cross_run_business_hash_equality_claimed,false);
 ctx.bindings.afterBodies[0].sha='old1';assert.throws(()=>freshCarry(ctx,admitted));ctx.bindings.afterBodies[0].sha='new1';ctx.baseline.tables['eps.media_assets'].count--;assert.throws(()=>freshCarry(ctx,admitted));
});
