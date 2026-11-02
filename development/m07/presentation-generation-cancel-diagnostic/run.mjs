/** Exactly one fresh-backend MCP large generation; diagnostic, never a pass fix. */
import assert from 'node:assert/strict';
import {performance}from 'node:perf_hooks';
import {setTimeout}from 'node:timers/promises';
import {literal,json}from '../presentation-lock-source-proof/proof.mjs';
import {nativeError}from '../presentation-lock-source-pool-proof/native.mjs';
import {custodyAndStrip}from './capture.mjs';
export async function runDiagnostic(ctx){
 const record=ctx.report.generation_cancel_diagnostic.call={profile:'large',mode:'mcp',body_variant:'candidate',first_application_call_in_fresh_backend:true,application_calls_before_dispatch:0,normal_SQL_return:false,rolled_back:false,performance_acceptance:false};
 const p=ctx.profiles.large,s=await ctx.startFreshGeneration('diag_mcp_large');record.pid=s.pid;
 let primary,cleanupError;
 try{
  ctx.report.checkpoint='diagnostic-single-mcp-large-first';
  await s.request('begin;'+ctx.acting('mcp','authenticated')+"set local statement_timeout='8s';set local lock_timeout='8s';");
  const started=performance.now();let rows;
  try{rows=await s.request(`select pg_temp.locksource41_measure('generate',${literal(p.workspace)}::uuid,${literal(p.series)}::uuid,${json(p.meta.input)},${literal('cancel-diagnostic-'+ctx.runId)});`);}
  finally{record.sql_client_elapsed_ms=performance.now()-started;}
  record.normal_SQL_return=true;
  // Never attach the raw SQL row to a report, even when custody/validation fails.
  const projected=await custodyAndStrip(rows,ctx.custodyDiagnostic,ctx.bindings.diagnosticStageMap);
  record.result=projected.result;record.cancellation=projected.cancellation;
  record.diagnostic_status=projected.cancellation?'cancellation_observed_private_context_preserved':'cancellation_not_reproduced';
  assert(record.result.ok===true||record.result.code==='57014','DIAG_UNEXPECTED_APPLICATION_RESULT');
  if(record.result.ok){assert.equal(record.result.role,'authenticated');assert.equal(record.result.status,'queued');}
 }catch(error){primary=error;record.error=nativeError(error);record.private_error=await ctx.captureError('single_cancel_diagnostic',error);}
 finally{
  try{await s.request('rollback;reset role;');record.rolled_back=true;}
  catch(error){record.cleanup_error=nativeError(error);if(!primary){cleanupError=error;record.private_cleanup_error=await ctx.captureError('single_cancel_diagnostic_cleanup',error);}else{record.backend_exit=await Promise.race([s.done,setTimeout(5000).then(()=>null)]);record.rolled_back_by_backend_exit=record.backend_exit===3;}}
  await s.finish();
 }
 if(primary)throw primary;if(cleanupError)throw cleanupError;
 assert.deepEqual(await ctx.value('select locksource41_proof.row_hashes();'),ctx.baseline,'DIAG_ROLLBACK_BASELINE_CHANGED');record.full_fresh_baseline_restored=true;
 ctx.report.generation_cancel_diagnostic.single_call_completed=true;
 ctx.report.generation_cancel_diagnostic.original78_performance_failure_remains_open=true;
}
