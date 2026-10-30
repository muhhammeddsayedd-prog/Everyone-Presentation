import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {assertExactProfileBefore,assertExactProfileAfter,loadOriginalProfile29} from '../../tools/m07-original-profile29-comparison.mjs';
import {performExactProfilePromotion} from '../../tools/promote-m07-local29-current.mjs';
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const profile=await read('development/m07/db/release29-original-profile.json');
const plan=await read(profile.plan);
test('source-pinned original profile accepts the actual failed precondition snapshot exactly',async()=>{
 const value=await loadOriginalProfile29();assert.equal(value.migration_sha256,'6531e8decab5496e212eb01575aca666cd9e03b0575f92dd66bd380760f84af4');
 const refused=await read('tracking/evidence/m07/local29-promotion/2026-10-30T11-22-37-612Z-1cf50401-promote.json');assertExactProfileBefore(refused.before,value);
});
test('original profile refuses frozen clone representation and arbitrary protected hash changes',async()=>{
 const proof=await read(profile.original_clone_proof);assert.throws(()=>assertExactProfileBefore({...proof.release.readback_before,database:'postgres'},profile));
 const changed=structuredClone(profile.before);changed.catalog_protected_sha256='0'.repeat(64);assert.throws(()=>assertExactProfileBefore(changed,profile));
});
test('the original PUBLIC usage and all old ACL/data/history fields remain exact requirements',()=>{
 for(const mutate of[
  value=>{value.catalog_delta_values['schemas|public|acl']=value.catalog_delta_values['schemas|public|acl'].replace(',=U/pg_database_owner','');},
  value=>{value.catalog_delta_values['columns|auth.sessions.id|acl']='{authenticated=r/postgres}';},
  value=>{value.old_data.hashes['eps.presentation_versions']='0'.repeat(64);},
  value=>{value.old_data.versions.push('20990101000000');},
  value=>{value.catalog_delta_values['unexpected|field|acl']='{authenticated=r/postgres}';},
 ]){const changed=structuredClone(profile.before);mutate(changed);assert.throws(()=>assertExactProfileBefore(changed,profile));}
});
test('after profile accepts only exact additive29 history and exact observed preserved baseline',()=>{
 const after=structuredClone(profile.expected_after);after.old_data.versions.push(plan.version);assertExactProfileAfter(after,profile,plan.version);
 for(const mutate of[value=>{value.new_state.mcp_oauth_resources.count=1;},value=>{value.catalog_protected_sha256=profile.original_clone_proof_sha256;},value=>{value.old_data.versions.push('20990101000000');},value=>{value.catalog_delta_values['schemas|public|acl']=value.catalog_delta_values['schemas|public|acl'].replace(',=U/pg_database_owner','');}]){const changed=structuredClone(after);mutate(changed);assert.throws(()=>assertExactProfileAfter(changed,profile,plan.version));}
});
test('current guard refuses unknown preconditions before a claim or dispatch',async()=>{
 const events=[],before=structuredClone(profile.before);before.catalog_protected_sha256='0'.repeat(64);
 await assert.rejects(performExactProfilePromotion({before,profile,version:plan.version,claim:async()=>events.push('claim'),dispatch:async()=>events.push('dispatch'),readback:async()=>events.push('readback')}));assert.deepEqual(events,[]);
});
test('current guard claims before one dispatch and requires exact independent after readback',async()=>{
 const events=[],after=structuredClone(profile.expected_after);after.old_data.versions.push(plan.version);
 const result=await performExactProfilePromotion({before:profile.before,profile,version:plan.version,claim:async()=>events.push('claim'),dispatch:async()=>{events.push('dispatch');return{result:'applied'};},readback:async()=>{events.push('readback');return after;}});assert.deepEqual(events,['claim','dispatch','readback']);assert.deepEqual(result.after,after);
 for(const fail of['dispatch','readback']){const observed=[];await assert.rejects(performExactProfilePromotion({before:profile.before,profile,version:plan.version,claim:async()=>observed.push('claim'),dispatch:async()=>{observed.push('dispatch');if(fail==='dispatch')throw Error('Synthetic unknown outcome');return{result:'applied'};},readback:async()=>{observed.push('readback');return profile.before;}}));assert.equal(observed.filter(v=>v==='dispatch').length,1);}
});
