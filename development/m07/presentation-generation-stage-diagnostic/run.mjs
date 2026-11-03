/** One first call; private context/strict NOTICE records, never performance proof. */
import assert from 'node:assert/strict';
import {performance}from 'node:perf_hooks';
import {setTimeout}from 'node:timers/promises';
import {literal,json}from '../presentation-lock-source-proof/proof.mjs';
import {nativeError}from '../presentation-lock-source-pool-proof/native.mjs';
import {custodyAndStrip}from '../presentation-generation-cancel-diagnostic/capture.mjs';
import {custodyStages,closedPhaseCustody}from './markers.mjs';

export async function runDiagnostic(ctx){
 const record=ctx.report.generation_stage_diagnostic.call={profile:'large',mode:'mcp',first_application_call_in_fresh_backend:true,application_calls_before_dispatch:0,normal_SQL_return:false,rolled_back:false,instrumentation_cost_present:true,performance_acceptance:false};
 const p=ctx.profiles.large,s=await ctx.startFreshGeneration('stage_mcp_large');record.pid=s.pid;
 let primary,cleanupError;
 try{
  ctx.report.checkpoint='stage-diagnostic-single-first-mcp-large';
  await s.request('begin;'+ctx.acting('mcp','authenticated')+"set local statement_timeout='8s';set local lock_timeout='8s';");
  const started=performance.now();let rows;
  try{rows=await s.request(`select pg_temp.locksource41_measure('generate',${literal(p.workspace)}::uuid,${literal(p.series)}::uuid,${json(p.meta.input)},${literal('stage-diagnostic-'+ctx.runId)});`);}
  finally{record.sql_client_elapsed_ms=performance.now()-started;}
  record.normal_SQL_return=true;
  // No raw row/context can be assigned to a public report before private custody.
  const projected=await custodyAndStrip(rows,ctx.custodyDiagnostic,ctx.bindings.diagnosticStageMap);
  record.result=projected.result;record.cancellation=projected.cancellation;
  record.diagnostic_status=projected.cancellation?'cancellation_observed_private_context_preserved':'cancellation_not_reproduced';
  assert(record.result.ok===true||record.result.code==='57014','STAGE_DIAG_UNEXPECTED_APPLICATION_RESULT');
  if(record.result.ok){assert.equal(record.result.role,'authenticated');assert.equal(record.result.status,'queued');}
 }catch(error){primary=error;record.error=nativeError(error);record.private_error=await ctx.captureError('single_stage_diagnostic',error);}
 finally{
  try{await s.request('rollback;reset role;');record.rolled_back=true;}
  catch(error){record.cleanup_error=nativeError(error);if(!primary){cleanupError=error;record.private_cleanup_error=await ctx.captureError('single_stage_cleanup',error);}else{record.backend_exit=await Promise.race([s.done,setTimeout(5000).then(()=>null)]);record.rolled_back_by_backend_exit=record.backend_exit===3;}}
  try{
   await s.finish();const exit=await s.done;
   // Child close follows closure of its stdout/stderr streams. Never sample the
   // notice buffer merely because the SQL stdout marker arrived first.
   const captured={...s.stageRecords(),after_normal_close:exit===0,child_exit:exit};
   if(record.result)record.stages=await custodyStages(captured,record.result,ctx.custodyPhase);
   else{record.private_phase_custody=closedPhaseCustody(await ctx.custodyPhase(captured));record.stage_projection_unavailable=true;}
  }catch(error){record.stage_capture_error=nativeError(error);record.private_stage_error=await ctx.captureError('single_stage_records',error);if(!primary&&!cleanupError)cleanupError=error;}
 }
 if(primary)throw primary;if(cleanupError)throw cleanupError;
 assert.deepEqual(await ctx.value('select locksource41_proof.row_hashes();'),ctx.baseline,'STAGE_DIAG_ROLLBACK_BASELINE_CHANGED');record.full_fresh_baseline_restored=true;
 ctx.report.generation_stage_diagnostic.single_call_completed=true;
}
