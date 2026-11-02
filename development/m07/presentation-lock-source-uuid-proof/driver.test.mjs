/** Actual immutable failure + pure namespace selection; no DB/claims/provider. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile}from 'node:fs/promises';
import {Buffer}from 'node:buffer';
import path from 'node:path';
import {fileURLToPath}from 'node:url';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
import {DOMAIN_UUID,ATTEMPT_CAP,firstPair,qualifies,qualifyRuntimeUUID}from './fixture.mjs';
import {admitCarry,validate278,freshCarry,CARRY278_PATH,CARRY278_SHA}from './admit.mjs';
const MAIN='D:/Everyone/Presentation/Everyone-Presentation-Studio';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const FAILED='278a260d-9070-4896-b565-95c860411a26';
function accepted(){
 for(let i=1;i<=ATTEMPT_CAP;i++){const candidate='00000000-0000-4000-8000-'+String(i).padStart(12,'0');if(qualifies(candidate))return candidate;}
 assert.fail('TEST_VALID_NAMESPACE_NOT_FOUND');
}
test('actual278 first pair exactly reconstructs slot7 valid and pool3 invalid under unmodified domain validator',()=>{
 const pair=firstPair(FAILED);assert.equal(pair.slot.index,7);assert.equal(pair.pool.index,3);assert(DOMAIN_UUID.test(pair.slot.id));assert(!DOMAIN_UUID.test(pair.pool.id));assert.equal(qualifies(FAILED),false);
 assert.equal(sha(pair.slot.id),'f4dc1edf2409e4a20fc677e73fa691eb9bb2d5e0848836dde82e14911c86bfc2');assert.equal(sha(pair.pool.id),'a7d9d736592dce0bd86075459b5086b20f17af02ad58fcff5327630fb4b28afd');
});
test('accepted fresh namespace qualifies exact first pair; count records rejected candidates only, without outcomes/timing',()=>{
 const good=accepted(),input=[FAILED,good];let count=0;const result=qualifyRuntimeUUID(()=>input[count++]);
 assert.equal(result.run_id,good);assert.equal(count,2);assert.equal(result.evidence.attempt_count,2);assert.equal(result.evidence.rejected_namespace_count,1);
 assert.equal(result.evidence.outcome_or_timing_observed,false);assert.equal(result.evidence.selection_before_database_or_claim,true);assert.equal(result.evidence.source_rows_or_SQL_changed,false);
 const pair=firstPair(good);assert(DOMAIN_UUID.test(pair.slot.id)&&DOMAIN_UUID.test(pair.pool.id));assert.equal(result.evidence.slot_sha256,sha(pair.slot.id));assert.equal(result.evidence.pool_sha256,sha(pair.pool.id));
});
test('attempt cap and malformed runtime UUID refuse purely before any resource action',()=>{
 let count=0;assert.throws(()=>qualifyRuntimeUUID(()=>{count++;return FAILED;}),{message:'FIXTURE_UUID_ATTEMPT_CAP_EXHAUSTED'});assert.equal(count,4096);
 assert.throws(()=>qualifyRuntimeUUID(()=> 'invalid'),{message:'FIXTURE_RUNTIME_UUID_REQUIRED'});
});
test('278 remains a failed run; only four RLS controls and crossFK carry; altered evidence rejected',async()=>{
 const raw=await readFile(path.join(MAIN,CARRY278_PATH));assert.equal(sha(raw),CARRY278_SHA);const r=JSON.parse(raw),proof=validate278(r);assert.equal(proof.four_RLS_controls,true);assert.equal(proof.remaining_RC_fence_membership_capability_expiry_not_carried,true);
 for(const mutate of[r=>r.result='passed',r=>r.pool_helper_proof.edge_rls[3].branch.source_ids_include_target=false,r=>r.pool_helper_proof.edge_rls[1].holder_visibility.asset_visible=true,r=>r.pool_helper_proof.cross_workspace.result.pool='passed',r=>r.shared_lock_released=false]){const copy=JSON.parse(JSON.stringify(r));mutate(copy);assert.throws(()=>validate278(copy));}
});
test('all393+278 immutable sources checked with flag-only closure; fresh admission verifies actual accepted namespace',async()=>{
 const reader=async file=>{try{return await readFile(path.join(ROOT,path.relative(MAIN,file)));}catch(error){if(error.code!=='ENOENT')throw error;return readFile(file);}};
 const admitted=await admitCarry(MAIN,reader);assert.equal(admitted.evidence.additional_dated278.replayed,false);
 await assert.rejects(admitCarry(MAIN,async file=>file.replaceAll('\\','/').endsWith('presentation-lock-source-edge-rls-proof/entry.mjs')?Buffer.from('changed'):reader(file)));
 const q=qualifyRuntimeUUID(()=>accepted()),baseline=admitted.receipt.pool_helper_proof.fresh_baseline;
 const ctx={runId:q.run_id,report:{...admitted.receipt,fixture_uuid_qualification:q.evidence},baseline,bindings:{candidateSha:admitted.evidence.helper_sha256,beforeBodies:[1],afterBodies:[1]}};
 assert.equal(freshCarry(ctx,admitted).fresh_runtime_namespace_qualified_only_for_canonical_public_inputs,true);
 assert.throws(()=>freshCarry({...ctx,runId:FAILED},admitted));
});
