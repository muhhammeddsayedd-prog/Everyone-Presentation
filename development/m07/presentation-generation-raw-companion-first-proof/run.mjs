/** One uninstrumented first call and rollback. No performance/security acceptance. */
import assert from 'node:assert/strict';
import {performance}from 'node:perf_hooks';
import {setTimeout}from 'node:timers/promises';
import {literal,json,sha}from '../presentation-lock-source-proof/proof.mjs';
import {nativeError}from '../presentation-lock-source-pool-proof/native.mjs';
import {firstPair,qualifies}from '../presentation-lock-source-uuid-proof/fixture.mjs';

const BEFORE=['4d46151993a60d8c6ac9d36e48781fee34c12c3e1dede727ac1ed4d31a953ab7','f0815e014144f1345b4679d96114aab6b358d95df317e3cfe6ac6b59989813cb','b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08','ed4a3469971fa410078b546b13aa0a875b4867efdda4b134dc729563dd887187'];
const AFTER=['0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd','c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10','41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d','f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5'];
export function freshCarry(ctx,admitted){
 const r=admitted.securityReceipt;
 for(const key of['metadata_sha256','migration_sha256','functional_sha256','image_id'])assert.equal(ctx.report[key],r[key]);
 const counts=b=>Object.entries(b.tables).map(([name,row])=>[name,row.count]).sort(([a],[b])=>a<b?-1:a>b?1:0);
 assert.deepEqual(counts(ctx.baseline),counts(r.pool_helper_proof.fresh_baseline));assert.equal(ctx.baseline.ready_versions,13);assert.equal(ctx.baseline.pins,60);assert.equal(ctx.baseline.reason_nonnull_rows,1);
 const q=ctx.report.fixture_uuid_qualification,pair=firstPair(ctx.runId);assert.equal(qualifies(ctx.runId),true);assert.equal(q.slot_sha256,sha(pair.slot.id));assert.equal(q.pool_sha256,sha(pair.pool.id));
 assert.equal(q.selection_before_database_or_claim,true);assert.equal(q.outcome_or_timing_observed,false);assert.equal(q.source_rows_or_SQL_changed,false);assert.equal(q.attempt_cap,4096);assert(Number.isInteger(q.attempt_count)&&q.attempt_count>=1&&q.attempt_count<=4096);assert.equal(q.rejected_namespace_count,q.attempt_count-1);
 assert.equal(ctx.bindings.baseSha,'280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4');assert.equal(ctx.bindings.candidateSha,'aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3');
 assert.deepEqual(ctx.bindings.beforeBodies.map(x=>x.sha),BEFORE);assert.deepEqual(ctx.bindings.afterBodies.map(x=>x.sha),AFTER);
 return{...admitted.evidence,fresh_fixture_counts_equal:true,baseline_count_provenance_only:true,cross_run_business_hash_equality_claimed:false,
  current_uninstrumented_five_bodies_verified:true,first_call_scope_only:true,all_matrix_semantic_locks_authority_and_raw_cases_still_required:true,
  changed_helper_or_raw_security_or_performance_carried:false,performance_or_release_acceptance:false};
}
export function closedResult(rows){
 assert(Array.isArray(rows)&&rows.length===1&&rows[0]&&typeof rows[0]==='object','FIRST_CALL_RESULT_SHAPE_REQUIRED');
 const r=rows[0];
 assert(r&&typeof r==='object'&&!Array.isArray(r),'FIRST_CALL_RESULT_SHAPE_REQUIRED');
 const allowed=new Set(['ok','code','operation','duration_ms','role','job_id','resource_id','status']);assert(Object.keys(r).every(k=>allowed.has(k)),'FIRST_CALL_CLOSED_FIELDS_REQUIRED');
 assert(typeof r.ok==='boolean'&&Number.isFinite(r.duration_ms)&&r.duration_ms>=0,'FIRST_CALL_RESULT_SCALARS_REQUIRED');
 if(r.ok){assert.equal(r.role,'authenticated');assert.equal(r.status,'queued');for(const k of['job_id','resource_id'])assert(typeof r[k]==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u.test(r[k]),'FIRST_CALL_GENERATED_UUID_REQUIRED');}
 else{assert(typeof r.code==='string'&&/^(?:57014|55P03|42501|CAPABILITY_REQUIRED|RESOURCE_NOT_FOUND|AUTH_REQUIRED|INPUT_CHANGED|STALE_RESOURCE_VERSION|LAYOUT_NOT_READY|SNAPSHOT_INVALID|ASSET_UNAVAILABLE|PRESENTATION_PROCESSING_UNAVAILABLE|PERMISSION_CHANGED)$/u.test(r.code),'FIRST_CALL_CLOSED_CODE_REQUIRED');assert.equal(r.operation,'generate');}
 return{...r};
}
export async function runDiagnostic(ctx){
 const record=ctx.report.generation_first_call.call={profile:'large',mode:'mcp',first_application_call_in_fresh_backend:true,application_calls_before_dispatch:0,normal_SQL_return:false,rolled_back:false,instrumentation_cost_present:false,performance_acceptance:false};
 const p=ctx.profiles.large,s=await ctx.startFreshGeneration('raw_first_mcp_large');record.pid=s.pid;let primary,cleanupError;
 try{
  ctx.report.checkpoint='raw-first-single-candidate-mcp-large';await s.request('begin;'+ctx.acting('mcp','authenticated')+"set local statement_timeout='8s';set local lock_timeout='8s';");
  const started=performance.now();let rows;
  try{rows=await s.request(`select pg_temp.locksource41_measure('generate',${literal(p.workspace)}::uuid,${literal(p.series)}::uuid,${json(p.meta.input)},${literal('raw-first-'+ctx.runId)});`);}
  finally{record.sql_client_elapsed_ms=performance.now()-started;}
  record.normal_SQL_return=true;record.result=closedResult(rows);record.application_returned_queued=record.result.ok;record.no_matrix_or_semantic_acceptance=true;
 }catch(error){primary=error;record.error=nativeError(error);record.private_error=await ctx.captureError('raw_first_call',error);}
 finally{
  try{await s.request('rollback;reset role;');record.rolled_back=true;}
  catch(error){record.cleanup_error=nativeError(error);if(!primary){cleanupError=error;record.private_cleanup_error=await ctx.captureError('raw_first_cleanup',error);}else{record.backend_exit=await Promise.race([s.done,setTimeout(5000).then(()=>null)]);record.rolled_back_by_backend_exit=record.backend_exit===3;}}
  try{await s.finish();record.child_exit=await s.done;if(!primary)assert.equal(record.child_exit,0,'FIRST_CALL_NORMAL_CHILD_CLOSE_REQUIRED');}
  catch(error){if(!primary&&!cleanupError)cleanupError=error;record.private_close_error=await ctx.captureError('raw_first_close',error);}
 }
 if(primary)throw primary;if(cleanupError)throw cleanupError;
 assert.deepEqual(await ctx.value('select locksource41_proof.row_hashes();'),ctx.baseline,'FIRST_CALL_ROLLBACK_BASELINE_CHANGED');record.full_fresh_baseline_restored=true;
 ctx.report.generation_first_call.single_call_completed=true;ctx.report.generation_first_call.all_later_proofs_remain_required=true;
}
