/** Private complete-PK universe; every actual selection remains under live RLS. */
import assert from 'node:assert/strict';
import {createHash}from 'node:crypto';

export const CHUNK_SIZE=16;
const HEAVY=['eps.media_assets','eps.candidate_media_frames'];
const OTHER=['public.projects','public.clients','eps.presentation_templates','eps.specs','eps.roles','eps.slots','eps.assignments','eps.workspace_candidates','eps.candidates','eps.candidate_media'];
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
const prepared=new WeakMap();
const only=rows=>{assert(Array.isArray(rows)&&rows.length===1,'ORACLE_PARTITION_ONE_RESULT_REQUIRED');return rows[0];};
const hash=value=>createHash('sha256').update(JSON.stringify(canon(value))).digest('hex');
const canon=value=>Array.isArray(value)?value.map(canon):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canon(value[k])])):value;
const literal=value=>"'"+value.replaceAll("'","''")+"'";
const keyFields=relation=>relation===HEAVY[0]?['id']:['candidate_media_id','asset_id'];
const keyId=(relation,key)=>keyFields(relation).map(k=>key[k]).join(':');
const compare=(relation,a,b)=>{const x=keyId(relation,a),y=keyId(relation,b);return x<y?-1:x>y?1:0;};
function keys(relation,value){
 assert(HEAVY.includes(relation)&&Array.isArray(value),'ORACLE_PARTITION_KEYS_REQUIRED');
 const fields=keyFields(relation);
 for(const row of value)assert(row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).sort().join(',')===[...fields].sort().join(',')&&fields.every(k=>typeof row[k]==='string'&&UUID.test(row[k])),'ORACLE_PARTITION_KEY_SHAPE_REQUIRED');
 assert(new Set(value.map(k=>keyId(relation,k))).size===value.length,'ORACLE_PARTITION_DUPLICATE_KEY');
 return value;
}
export function partitionUniverse(relation,value){
 const universe=keys(relation,value);
 assert(universe.every((k,i)=>i===0||compare(relation,universe[i-1],k)<0),'ORACLE_PARTITION_ORDER_REQUIRED');
 const chunks=[];for(let i=0;i<universe.length;i+=CHUNK_SIZE)chunks.push(universe.slice(i,i+CHUNK_SIZE));
 assert(chunks.flat().length===universe.length&&hash(chunks.flat())===hash(universe),'ORACLE_PARTITION_COVERAGE_CHANGED');
 return chunks;
}
function identity(value,role,pid,snapshot=null){
 const names=['pid','snapshot','role','isolation','read_only','statement_timeout','lock_timeout'];
 assert(value&&typeof value==='object'&&Object.keys(value).sort().join(',')===names.sort().join(','),'ORACLE_PARTITION_IDENTITY_REQUIRED');
 assert(Number.isSafeInteger(value.pid)&&value.pid>0&&value.pid===pid&&value.role===role&&value.isolation==='repeatable read'&&value.read_only==='on'&&value.statement_timeout==='8s'&&value.lock_timeout==='8s','ORACLE_PARTITION_IDENTITY_CHANGED');
 assert(typeof value.snapshot==='string'&&/^[0-9]+:[0-9]+:(?:[0-9]+(?:,[0-9]+)*)?$/u.test(value.snapshot)&&value.snapshot.length<=32768,'ORACLE_PARTITION_SNAPSHOT_REQUIRED');
 assert(snapshot===null||value.snapshot===snapshot,'ORACLE_PARTITION_SNAPSHOT_CHANGED');
 return value;
}
async function verifyIdentity(oracle,state,publicRecord){
 const value=only(await oracle.request('select pg_temp.pool_oracle41_identity();'));
 identity(value,'eps_review_owner',state.pid,state.snapshot);
 publicRecord.identity_checks++;return value;
}
function context(ctx){
 const {workspace,series}=ctx.profiles.large;
 assert(UUID.test(workspace)&&UUID.test(series)&&UUID.test(ctx.runId),'ORACLE_PARTITION_CONTEXT_REQUIRED');
 return {workspace,series,runId:ctx.runId};
}
export async function prepareOracle(ctx,oracle,record){
 const scope=context(ctx);assert(!prepared.has(oracle),'ORACLE_PARTITION_ALREADY_PREPARED');
 assert(typeof ctx.bindings.oracleSliceSql==='string'&&ctx.bindings.oracleSliceSql.length>0,'ORACLE_PARTITION_SQL_REQUIRED');
 const evidence={chunk_size:CHUNK_SIZE,complete_global_primary_key_snapshot:false,same_connection_required:true,identity_checks:0,universes:{},relations:[]};record.partitioned_oracle=evidence;
 // Install only temporary functions before the read-only snapshot begins.
 await oracle.request(ctx.bindings.oracleSliceSql);
 await oracle.request("reset role;begin isolation level repeatable read read only;set local statement_timeout='8s';set local lock_timeout='8s';");
 const full=only(await oracle.request('select pg_temp.pool_oracle41_universe();'));
 assert(full&&typeof full==='object'&&Object.keys(full).sort().join(',')==='identity,universes','ORACLE_PARTITION_UNIVERSE_REQUIRED');
 const original=identity(full.identity,'postgres',oracle.pid);
 assert(full.universes&&Object.keys(full.universes).sort().join(',')===[...HEAVY].sort().join(','),'ORACLE_PARTITION_UNIVERSE_REQUIRED');
 const universes={};
 for(const relation of HEAVY){
  const all=keys(relation,full.universes[relation]);const chunks=partitionUniverse(relation,all);
  evidence.universes[relation]={rows:all.length,sha256:hash(all),chunks:chunks.length};
  assert(all.length===(relation===HEAVY[0]?501:328),'ORACLE_PARTITION_FULL_FIXTURE_COUNT_CHANGED');universes[relation]={all,chunks};
 }
 evidence.trusted_pid=original.pid;evidence.snapshot_sha256=hash(original.snapshot);evidence.complete_global_primary_key_snapshot=true;
 const state={...scope,pid:original.pid,snapshot:original.snapshot,universes};
 await oracle.request(ctx.acting('mcp')+"set local statement_timeout='8s';set local lock_timeout='8s';");
 await verifyIdentity(oracle,state,evidence);prepared.set(oracle,state);
}
export async function readOracle(ctx,oracle,relation,record){
 const scope=context(ctx),state=prepared.get(oracle),evidence=record.partitioned_oracle;
 assert(state&&evidence&&scope.runId===state.runId&&scope.workspace===state.workspace&&scope.series===state.series,'ORACLE_PARTITION_NOT_PREPARED');
 assert(HEAVY.includes(relation)||OTHER.includes(relation),'ORACLE_PARTITION_CLOSED_RELATION_REQUIRED');
 await verifyIdentity(oracle,state,evidence);
 if(OTHER.includes(relation)){
  const value=only(await oracle.request(`select pg_temp.pool_proof_cohort(${literal(relation)},${literal(scope.workspace)}::uuid,${literal(scope.series)}::uuid);`));
  assert(Array.isArray(value),'ORACLE_PARTITION_ORIGINAL_KEYS_REQUIRED');await verifyIdentity(oracle,state,evidence);return value;
 }
 const {all,chunks}=state.universes[relation],selected=[],seen=new Set();
 const publicRelation={relation,universe_rows:all.length,universe_sha256:hash(all),chunks:[],completed:false};evidence.relations.push(publicRelation);
 for(let i=0;i<chunks.length;i++){
  const chunk=chunks[i],item={index:i,universe_rows:chunk.length,universe_sha256:hash(chunk),normal_return:false,selected_rows:null};publicRelation.chunks.push(item);
  const value=only(await oracle.request(`select pg_temp.pool_oracle41_slice(${literal(relation)},${literal(scope.workspace)}::uuid,${literal(scope.series)}::uuid,${literal(JSON.stringify(chunk))}::jsonb);`));
  assert(value&&typeof value==='object'&&Object.keys(value).sort().join(',')==='identity,keys','ORACLE_PARTITION_SLICE_REQUIRED');
  identity(value.identity,'eps_review_owner',state.pid,state.snapshot);evidence.identity_checks++;
  const admitted=keys(relation,value.keys),domain=new Set(chunk.map(k=>keyId(relation,k)));
  for(const row of admitted){const id=keyId(relation,row);assert(domain.has(id)&&!seen.has(id),'ORACLE_PARTITION_RESULT_OUTSIDE_CHUNK');seen.add(id);selected.push(row);}
  item.selected_rows=admitted.length;item.selected_sha256=hash(admitted);item.same_pid_snapshot_role_and_bounds=true;item.normal_return=true;
 }
 selected.sort((a,b)=>compare(relation,a,b));keys(relation,selected);
 assert(publicRelation.chunks.length===chunks.length&&publicRelation.chunks.reduce((n,c)=>n+c.universe_rows,0)===all.length,'ORACLE_PARTITION_FULL_COVERAGE_REQUIRED');
 await verifyIdentity(oracle,state,evidence);
 publicRelation.selected_rows=selected.length;publicRelation.selected_sha256=hash(selected);publicRelation.final_same_snapshot_verified=true;publicRelation.completed=true;
 return selected;
}
