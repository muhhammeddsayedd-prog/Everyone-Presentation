import assert from 'node:assert/strict';
import {Buffer}from 'node:buffer';
import {readFile}from 'node:fs/promises';
import test from 'node:test';
import {URL}from 'node:url';
import {ADMISSION_READY,SCALAR_PARITY_REF,admitCarry,validateScalarParity,validateSlideFailure,admitSlideSource}from './admit.mjs';
const ROOT='D:/Everyone/Presentation/Everyone-Presentation-Studio';
const FOLDER=ROOT+'/tracking/evidence/m07/presentation-generation-slide-batch-full-proof/';

test('actual three-reference parity admission separates raw cleanup from independent audit',async()=>{
 assert.equal(ADMISSION_READY,true);
 const [raw,safe,audit]=await Promise.all([SCALAR_PARITY_REF.receipt,SCALAR_PARITY_REF.outcome,SCALAR_PARITY_REF.audit].map(async r=>JSON.parse(await readFile(ROOT+'/'+r.path))));
 const result=validateScalarParity(raw,safe,audit);assert.equal(result.case_rows,122);assert.equal(result.exact_old_candidate_pairs,61);assert.equal(result.whole_generation_acceptance,false);
 const admitted=await admitCarry(ROOT);assert.equal(admitted.scalarParity.normal_process_exit,0);
 for(const change of[x=>{x.independent_successful_daemon_label_inventories_empty=false;},x=>{x.normal_private_output_and_public_projection_equal=false;},x=>{x.source_seals_verified=32;}]){
  const bad=structuredClone(audit);change(bad);assert.throws(()=>validateScalarParity(raw,safe,bad));
 }
 const wrong=structuredClone(raw);wrong.cleanup_inventories.same_engine_volume_inventory_empty=false;assert.throws(()=>validateScalarParity(wrong,safe,audit));
});

test('removing only the actual reference makes the same code refuse before any reader',async()=>{
 const source=await readFile(new URL('./admit.mjs',import.meta.url),'utf8'),start=source.indexOf('export const SCALAR_PARITY_REF='),end=source.indexOf('\nexport const ADMISSION_READY',start);
 assert(start>=0&&end>start);const mutant=source.slice(0,start)+'export const SCALAR_PARITY_REF=null;'+source.slice(end);
 const unbound=await import('data:text/javascript,'+encodeURIComponent(mutant));assert.equal(unbound.ADMISSION_READY,false);
 let reads=0;await assert.rejects(unbound.admitCarry(ROOT,async()=>{reads++;throw new Error('reader must remain unused');}),/SCALAR_FULL_PROOF_PARITY_UNBOUND/u);
 assert.equal(reads,0);assert.throws(()=>unbound.validateScalarParity({},{}),/SCALAR_FULL_PROOF_PARITY_UNBOUND/u);
});

test('actual1267 stays failed with unknown phase and no final clone restore',async()=>{
 const raw=JSON.parse(await readFile(FOLDER+'2026-11-03T07-37-49.745Z-1267c728.json'));
 const safe=JSON.parse(await readFile(FOLDER+'1267c728-outcome.json'));
 const result=validateSlideFailure(raw,safe);
 assert.equal(result.current_stage,'unobserved');assert.equal(result.in_callback_final_restore_reached,false);
 assert.equal(result.scalar845_not_executed_by_this_receipt,true);assert.equal(result.performance_or_security_acceptance,false);
 for(const change of[x=>{x.normal_process_exit=0;},x=>{x.current_cancellation_stack_or_stage='english_companion_capture';},
  x=>{x.final_canonical_installation_record_present=true;},x=>{x.actual_candidate_installation.expected_and_actual_pg_proc_sources_equal[2].source='0'.repeat(64);}]){
  const bad=structuredClone(safe);change(bad);assert.throws(()=>validateSlideFailure(raw,bad));
 }
});

test('only the exact known1267 entry closure is qualified',async()=>{
 const raw=JSON.parse(await readFile(FOLDER+'2026-11-03T07-37-49.745Z-1267c728.json'));
 const name='development/m07/presentation-generation-slide-batch-full-proof/entry.mjs',expected=raw.source_seals[name];
 const closed=await readFile(ROOT+'/'+name);admitSlideSource(name,expected,closed);
 admitSlideSource(name,expected,Buffer.from(closed.toString().replace('export const EXECUTION_ENABLED=false;','export const EXECUTION_ENABLED=true;')));
 assert.throws(()=>admitSlideSource(name,expected,Buffer.concat([closed,Buffer.from('\n')])));
 assert.throws(()=>admitSlideSource(name,'0'.repeat(64),closed));
});
