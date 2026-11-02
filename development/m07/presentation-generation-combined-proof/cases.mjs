/** Combined280/four-body harness core. No entry/dispatch or provider transport. */
import assert from 'node:assert/strict';
import {performance}from 'node:perf_hooks';
import {setTimeout}from 'node:timers/promises';
import {literal,json}from '../presentation-lock-source-proof/proof.mjs';
import {nativeError}from '../presentation-lock-source-pool-proof/native.mjs';
const only=rows=>{assert.equal(rows.length,1);return rows[0];};
const SNAPSHOT='select locksource41_proof.row_hashes();';
const bounds="set local statement_timeout='8s';set local lock_timeout='8s';";
const metric=(operation,p,input=null,key=null)=>`select pg_temp.locksource41_measure(${literal(operation)},${literal(p.workspace)}::uuid,${literal(p.series)}::uuid,${input===null?'null':json(input)},${key===null?'null':literal(key)});`;

export async function firstWholeGenerations(ctx){
 const records=ctx.report.combined_generation.first_calls=[];
 // Every measured generation is the first application call in a fresh backend;
 // fixture creation and shared OS/database caches are not called cold-start proof.
 for(const variant of['old','candidate']){
  await ctx.installVariant(variant);
  for(const mode of['api','mcp'])for(const label of['control','large']){
   const p=ctx.profiles[label],record={variant,mode,label,phase:'session_start',normal_return:false,rolled_back:false,application_calls_before_dispatch:0,first_in_fresh_backend:true};
   records.push(record);ctx.report.checkpoint='combined-first-'+variant+'-'+mode+'-'+label;
   const s=await ctx.startFreshGeneration('whole_'+variant+'_'+mode+'_'+label);record.pid=s.pid;
   let primary,cleanupError;
   try{
    record.phase='begin';await s.request('begin;'+ctx.acting(mode,'authenticated')+bounds);
    record.phase='actual_public_generate';record.dispatched=true;
    const started=performance.now();
    try{record.generation=only(await s.request(metric('generate',p,p.meta.input,'combined-'+ctx.runId+'-'+variant+'-'+mode+'-'+label)));}
    finally{record.client_elapsed_ms=performance.now()-started;}
    record.normal_return=true;
    if(record.generation.ok){
     await s.request('reset role;');record.phase='persisted_projection';
     record.projection=only(await s.request(`select pg_temp.locksource41_generated_projection(${literal(record.generation.resource_id)}::uuid);`));
     record.pins=only(await s.request(`select pg_temp.data_reuse_pin_projection(${literal(record.generation.resource_id)}::uuid);`));
    }
   }catch(error){primary=error;record.error=nativeError(error);record.private_error=await ctx.captureError('combined_first_'+variant+'_'+mode+'_'+label,error);}
   finally{
    try{await s.request('rollback;reset role;');record.rolled_back=true;}
    catch(error){
     record.cleanup_error=nativeError(error);
     if(!primary){cleanupError=error;record.private_cleanup_error=await ctx.captureError('combined_cleanup_'+variant+'_'+mode+'_'+label,error);}
     else{record.backend_exit=await Promise.race([s.done,setTimeout(5000).then(()=>null)]);record.rolled_back_by_backend_exit=record.backend_exit===3;}
    }
    await s.finish();
   }
   if(primary)throw primary;if(cleanupError)throw cleanupError;
   // Safe server/client measurements and persisted hashes remain attached before
   // any acceptance assertion, including a successful-but-too-slow response.
   const result=record.generation;assert.equal(record.rolled_back,true);
   if(variant==='candidate')assert.equal(result.ok,true,'COMBINED_NEW_WHOLE_GENERATION_FAILED');
   else assert(result.ok||result.code==='57014','COMBINED_OLD_UNEXPECTED_GENERATION_FAILURE');
   if(result.ok){
    assert(result.duration_ms<8000,'COMBINED_WHOLE_GENERATION_BUDGET_EXCEEDED');
    assert.equal(result.role,'authenticated');assert.equal(record.projection.job_status,'queued');assert.equal(record.projection.outbox_rows,1);
    assert.equal(record.pins.private_filename_in_output,false);
   }else record.baseline_cancellation_retained=true;
   assert.deepEqual(await ctx.value(SNAPSHOT),ctx.baseline,'COMBINED_FIRST_ROLLBACK_BASELINE_CHANGED');record.full_baseline_restored=true;
  }
 }
 assert.equal(records.length,8);assert.equal(new Set(records.map(x=>x.pid)).size,8);
 for(const after of records.filter(x=>x.variant==='candidate')){
  const before=records.find(x=>x.variant==='old'&&x.mode===after.mode&&x.label===after.label);
  if(before.generation.ok){assert.deepEqual(before.projection,after.projection);assert.deepEqual(before.pins,after.pins);after.normalized_old_new_equal=true;}
  else after.old_generation_projection_unavailable=true;
 }
 ctx.report.combined_generation.actual_first_whole_generation_matrix_completed=true;
}

export async function projectionEqualities(ctx){
 assert.equal(ctx.report.combined_generation.actual_first_whole_generation_matrix_completed,true,'COMBINED_FIRST_MATRIX_REQUIRED_BEFORE_PROJECTIONS');
 const records=ctx.report.combined_generation.projections=[];
 for(const variant of['old','candidate']){
  await ctx.installVariant(variant);
  for(const mode of['api','mcp'])for(const label of['control','large'])for(const operation of['review','snapshot']){
   const record={variant,mode,label,operation,normal_return:false,rolled_back:false};records.push(record);
   const s=await ctx.startFreshGeneration('projection_'+variant+'_'+mode+'_'+label+'_'+operation);
   let primary;
   try{
    await s.request('begin;'+ctx.acting(mode)+bounds);
    record.result=only(await s.request(metric(operation,ctx.profiles[label])));record.normal_return=true;
   }catch(error){primary=error;record.error=nativeError(error);record.private_error=await ctx.captureError('combined_projection_'+variant+'_'+mode+'_'+label+'_'+operation,error);}
   finally{
    try{await s.request('rollback;reset role;');record.rolled_back=true;}
    catch(error){record.cleanup_error=nativeError(error);if(!primary){primary=error;record.private_cleanup_error=await ctx.captureError('combined_projection_cleanup_'+variant+'_'+mode+'_'+label+'_'+operation,error);}}
    await s.finish();
   }
   if(primary)throw primary;
   assert.equal(record.result.ok,true,'COMBINED_ORIGINAL_OR_NEW_DATA_EQUALITY_UNCONFIRMED');
   assert(record.result.duration_ms<8000);assert.deepEqual(await ctx.value(SNAPSHOT),ctx.baseline);record.full_baseline_restored=true;
  }
 }
 for(const after of records.filter(x=>x.variant==='candidate')){
  const before=records.find(x=>x.variant==='old'&&x.mode===after.mode&&x.label===after.label&&x.operation===after.operation);
  assert.equal(before.result.contract_hash,after.result.contract_hash,'COMBINED_DATA_FINGERPRINT_CHANGED');after.old_new_contract_hash_equal=true;
 }
 ctx.report.combined_generation.review_and_snapshot_contract_equalities_completed=true;
}
