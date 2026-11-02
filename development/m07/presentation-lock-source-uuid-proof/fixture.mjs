/** Pure pre-DB namespace qualification for exact public UUID input validity. */
import assert from 'node:assert/strict';
import {idFor,sha}from '../presentation-lock-source-proof/proof.mjs';
export const ATTEMPT_CAP=4096;
export const DOMAIN_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RUNTIME_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
export function firstPair(run){
 assert(RUNTIME_UUID.test(run));
 const slots=Array.from({length:16},(_,i)=>({index:i+1,id:idFor(run,'slot-2-'+(i+1))})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 const pools=Array.from({length:11},(_,i)=>({index:i+1,id:idFor(run,'pool-2-'+(i+1))})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 const assigned=new Set(Array.from({length:19},(_,i)=>((i%16)+1)+':'+((i%11)+1)));
 for(const slot of slots)for(const pool of pools)if(!assigned.has(slot.index+':'+pool.index))return{slot,pool};
 assert.fail('FIXTURE_FIRST_PAIR_UNAVAILABLE');
}
export function qualifies(run){const pair=firstPair(run);return DOMAIN_UUID.test(pair.slot.id)&&DOMAIN_UUID.test(pair.pool.id);}
export function qualifyRuntimeUUID(randomUUID){
 assert.equal(typeof randomUUID,'function');
 for(let attempt=1;attempt<=ATTEMPT_CAP;attempt++){
  const run=randomUUID();assert(RUNTIME_UUID.test(run),'FIXTURE_RUNTIME_UUID_REQUIRED');
  if(!qualifies(run))continue;
  const pair=firstPair(run);
  return{run_id:run,evidence:{schema_version:'pure-public-UUID-fixture-qualification.v1',criterion:'ONLY canonical UUID validity of unchanged first public assignment slot_id and workspace_candidate_id',attempt_cap:ATTEMPT_CAP,attempt_count:attempt,rejected_namespace_count:attempt-1,selection_before_database_or_claim:true,outcome_or_timing_observed:false,source_rows_or_SQL_changed:false,first_slot_index:pair.slot.index,first_pool_index:pair.pool.index,slot_sha256:sha(pair.slot.id),pool_sha256:sha(pair.pool.id),slot_domain_UUID_valid:true,pool_domain_UUID_valid:true}};
 }
 assert.fail('FIXTURE_UUID_ATTEMPT_CAP_EXHAUSTED');
}
