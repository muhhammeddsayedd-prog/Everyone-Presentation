/** New release-query hook; frozen7cff SQL fixtures and observation stay intact. */
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createAttempt36Runtime,renderAttempt36Wire } from '../job-attempt-observability36-proof/runtime.mjs';
import { sha } from '../recovery33/compiler.mjs';
import { runPython } from './python.mjs';
export const TAG='attempt36_release_gate_capture';
export const PHASES=['before','after','public_execute','disabled','wrong_body','old_jobs','restored'];
export function assertPins(pins,sources){
 assert(pins&&Object.getPrototypeOf(pins)===Object.prototype&&Object.keys(pins).length>185,'ATTEMPT36_GATE_QUERY_CLOSURE_REQUIRED');
 for(const[file,digest]of Object.entries(pins)){assert(sources.has(file),'ATTEMPT36_GATE_QUERY_SOURCE_MISSING');assert.equal(sha(sources.get(file)),digest,'ATTEMPT36_GATE_QUERY_SOURCE_CHANGED');}
}
export function injectQueries(oldWire,queries){
 assert(queries&&typeof queries.before==='string'&&typeof queries.after==='string'&&typeof queries.before_capture_sql==='string'&&typeof queries.after_candidate_sql==='string');
 assert.deepEqual(queries.phases,PHASES);
 const candidate=oldWire.candidate.sql;assert.equal(oldWire.body.split(candidate).length,2,'ATTEMPT36_GATE_FIXED_WIRE_SEAM_REQUIRED');
 // Callback replacement preserves SQL dollar quoting ($$) verbatim; passing
 // the SQL as JS replacement text would interpret $$ as a single dollar.
 return oldWire.body.replace(candidate,()=>queries.before_capture_sql+candidate+'\n'+queries.after_candidate_sql);
}
export function stripCapture(stdout){
 assert(typeof stdout==='string');const captured={},order=[],kept=[];
 for(const part of stdout.match(/[^\r\n]*(?:\r\n|\n|$)/gu)||[]){
  const line=part.replace(/\r?\n$/u,'');let value;
  if(line.startsWith('{'))value=JSON.parse(line);
  if(value&&Object.hasOwn(value,TAG)){
   assert.deepEqual(Object.keys(value).sort(),[TAG,'value','atomic_o','atomic_d'].sort(),'ATTEMPT36_GATE_CAPTURE_SHAPE_REQUIRED');
   const phase=value[TAG];assert(PHASES.includes(phase)&&!Object.hasOwn(captured,phase),'ATTEMPT36_GATE_CAPTURE_ORDER_REQUIRED');
   assert(value.value&&Object.getPrototypeOf(value.value)===Object.prototype);
   captured[phase]={value:value.value,atomic_o:value.atomic_o,atomic_d:value.atomic_d};order.push(phase);
  }else kept.push(part);
 }
 assert.deepEqual(order,PHASES,'ATTEMPT36_GATE_ALL_CAPTURES_REQUIRED');return {captured,stdout:kept.join('')};
}
export function createGate36Runtime(io={readFile,writeFile,runPython}){return async function(ctx){
 const queries=await io.runPython(ctx.root,'queries');assertPins(queries.source_pins,ctx.sourceFiles);
 let dispatches=0,validated,actualWireSha,captureSha;
 const wrapper={...ctx,sql:async(database,body,...extra)=>{
  assert.equal(++dispatches,1,'ATTEMPT36_GATE_SINGLE_DISPATCH_REQUIRED');assert.equal(database,ctx.sourceDb);assert.equal(extra.length,0);
  const observed=await ctx.databaseIdentity(database),identity={database,marker:ctx.marker(database),oid:observed.oid};
  const oldWire=renderAttempt36Wire(ctx.sourceFiles,identity);assert.equal(body,oldWire.body,'ATTEMPT36_GATE_UNEXPECTED_SQL_BODY');
  const actual=injectQueries(oldWire,queries);actualWireSha=sha(actual);
  await io.writeFile(path.join(ctx.privateRoot,'attempt36-gates-actual-wire.sql'),actual,{flag:'wx',mode:0o600});
  const result=await ctx.sql(database,actual),stripped=stripCapture(result.stdout);
  const capture=JSON.stringify(stripped.captured);assert(Buffer.byteLength(capture)<=4*1024*1024);captureSha=sha(capture);
  await io.writeFile(path.join(ctx.privateRoot,'attempt36-gates-metadata-private.json'),capture+'\n',{flag:'wx',mode:0o600});
  validated=await io.runPython(ctx.root,'validate',stripped.captured);assert.equal(validated.result,'passed');assertPins(validated.query_source_pins,ctx.sourceFiles);
  assert.deepEqual(validated.query_source_pins,queries.source_pins,'ATTEMPT36_GATE_QUERY_SOURCE_DRIFT');
  for(const key of ['canonical_business_writes','cloud_called','provider_called','hosted_acceptance'])assert.equal(validated[key],false);
  assert.equal(validated.local_metadata_only,true);return {...result,stdout:stripped.stdout};
 }};
 await createAttempt36Runtime({readFile:io.readFile,writeFile:io.writeFile})(wrapper);
 // This new augmented wire inserts transaction-only36 before its postcondition,
 // unlike the historical7cff wire. Override its inherited false field honestly.
 ctx.report.attempt36_sql.candidate36_history_inserted=true;
 ctx.report.attempt36_sql.history36_ephemeral=true;ctx.report.attempt36_sql.history36_persisted=false;
 assert.equal(dispatches,1);assert.equal(ctx.report.attempt36_sql.result,'passed');
 for(const[file,bytes]of ctx.sourceFiles)assert.equal(sha(await io.readFile(path.join(ctx.root,file))),sha(bytes),'ATTEMPT36_GATE_SOURCE_CHANGED');
 ctx.report.attempt36_gate_sql={result:'passed',actual_wire_sha256:actualWireSha,private_metadata_sha256:captureSha,
  query_sha256:{before:sha(queries.before),after:sha(queries.after)},
  ...validated,executed_query_sources_verified:true,old_fixture_and_rollback_observation_passed:true,
  source_query_capture_phase:'before-and-immediately-after-empty-candidate36-and-ephemeral-history36',candidate36_history_inserted:true,
  history36_ephemeral:true,history36_persisted:false};
};}
export const runGate36=createGate36Runtime();
