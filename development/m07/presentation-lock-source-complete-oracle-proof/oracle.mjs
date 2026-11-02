/** Complete independent universes stay private; every key uses original live RLS. */
import assert from 'node:assert/strict';
import {performance}from 'node:perf_hooks';
import {RELATIONS,EXPECTED_COUNTS,CHUNK_SIZE,only,hash,literal,keyId,identity,universe,admitResult,context}from './keys.mjs';
const prepared=new WeakMap();
async function verify(oracle,state,evidence){
 const value=only(await oracle.request('select pg_temp.complete41_identity();'));
 identity(value,'eps_review_owner',state.pid,state.snapshot,'on',state.claims);evidence.identity_checks++;return value;
}
async function live(oracle,state,evidence){
 const value=only(await oracle.request(`select pg_temp.complete41_live(${literal(state.workspace)}::uuid);`));
 identity(value,'eps_review_owner',state.pid,state.snapshot,'on',state.claims);evidence.identity_checks++;evidence.live_authority_checks++;
}
export async function prepareOracle(ctx,oracle,record){
 const scope=context(ctx);assert(!prepared.has(oracle),'COMPLETE_ORACLE_ALREADY_PREPARED');
 assert(typeof ctx.bindings.completeOracleSql==='string'&&ctx.bindings.completeOracleSql.length>0,'COMPLETE_ORACLE_SQL_REQUIRED');
 const evidence={chunk_size:CHUNK_SIZE,complete_global_primary_key_snapshot:false,same_connection_required:true,identity_checks:0,live_authority_checks:0,universes:{},relations:[]};record.complete_oracle=evidence;
 await oracle.request(ctx.bindings.completeOracleSql);
 await oracle.request("reset role;begin isolation level repeatable read read only;set local statement_timeout='8s';set local lock_timeout='8s';");
 const full=only(await oracle.request('select pg_temp.complete41_universe();'));
 assert(full&&typeof full==='object'&&Object.keys(full).sort().join(',')==='identity,universes','COMPLETE_ORACLE_UNIVERSE_REQUIRED');
 const original=identity(full.identity,'postgres',oracle.pid);
 assert(full.universes&&Object.keys(full.universes).sort().join(',')===[...RELATIONS].sort().join(','),'COMPLETE_ORACLE_ALL_TWELVE_REQUIRED');
 const universes={};let total=0;
 for(const relation of RELATIONS){
  assert.equal(ctx.baseline.tables[relation].count,EXPECTED_COUNTS[relation],'COMPLETE_ORACLE_REVIEWED_FIXTURE_SCALE_CHANGED');
  const value=universe(relation,full.universes[relation],ctx.baseline.tables[relation].count);universes[relation]=value;total+=value.all.length;
  evidence.universes[relation]={rows:value.all.length,sha256:hash(value.all),chunks:value.chunks.length,actual_pk_shape_verified:true};
 }
 evidence.trusted_pid=original.pid;evidence.snapshot_sha256=hash(original.snapshot);evidence.complete_global_primary_key_snapshot=true;evidence.total_keys=total;
 const state={...scope,pid:original.pid,snapshot:original.snapshot,universes,claims:null};
 await oracle.request(ctx.acting('mcp')+"set local statement_timeout='8s';set local lock_timeout='8s';");
 const actor=await verify(oracle,state,evidence);state.claims=actor.claims_sha256;await live(oracle,state,evidence);prepared.set(oracle,state);
}
export async function readOracle(ctx,oracle,relation,record){
 const scope=context(ctx),state=prepared.get(oracle),evidence=record.complete_oracle;
 assert(state&&evidence&&scope.runId===state.runId&&scope.workspace===state.workspace&&scope.series===state.series,'COMPLETE_ORACLE_NOT_PREPARED');
 assert(RELATIONS.includes(relation),'COMPLETE_ORACLE_CLOSED_RELATION_REQUIRED');await verify(oracle,state,evidence);await live(oracle,state,evidence);
 const {all,chunks,ordinal}=state.universes[relation],selected=[],seen=new Set();
 const progress={relation,universe_rows:all.length,universe_sha256:hash(all),chunks:[],completed:false};evidence.relations.push(progress);
 for(let i=0;i<chunks.length;i++){
  const chunk=chunks[i],item={index:i,universe_rows:1,universe_sha256:hash(chunk),normal_return:false,selected_rows:null};progress.chunks.push(item);
  const started=performance.now();let value;
  try{value=only(await oracle.request(`select pg_temp.complete41_slice(${literal(relation)},${literal(scope.workspace)}::uuid,${literal(scope.series)}::uuid,${literal(JSON.stringify(chunk))}::jsonb);`));item.client_elapsed_ms=performance.now()-started;}catch(error){item.client_elapsed_ms=performance.now()-started;throw error;}
  assert(value&&typeof value==='object'&&Object.keys(value).sort().join(',')==='identity,keys','COMPLETE_ORACLE_SLICE_REQUIRED');
  identity(value.identity,'eps_review_owner',state.pid,state.snapshot,'on',state.claims);evidence.identity_checks++;evidence.live_authority_checks+=2;
  const admitted=admitResult(relation,value.keys,chunk,selected,seen);item.selected_rows=admitted.length;item.selected_sha256=hash(admitted);item.same_identity_and_live_scope_verified=true;item.normal_return=true;
 }
 selected.sort((a,b)=>ordinal.get(keyId(relation,a))-ordinal.get(keyId(relation,b)));
 assert.equal(progress.chunks.length,all.length,'COMPLETE_ORACLE_FULL_COVERAGE_REQUIRED');await live(oracle,state,evidence);await verify(oracle,state,evidence);
 progress.selected_rows=selected.length;progress.selected_sha256=hash(selected);progress.final_live_scope_and_snapshot_verified=true;progress.completed=true;return selected;
}
