/** Changed helper gets fresh exact-scope locks and original RC authority tests. */
import assert from 'node:assert/strict';
import {readFile}from 'node:fs/promises';
import {URL}from 'node:url';
import {literal,sha}from '../presentation-lock-source-proof/proof.mjs';
import {nativeError}from '../presentation-lock-source-pool-proof/native.mjs';
import {heldCohorts,crossWorkspaceKeys,workspaceFenceRace,authorityCases}from './security.mjs';
const only=rows=>{assert.equal(rows.length,1);return rows[0];};
const SNAPSHOT='select locksource41_proof.row_hashes();';
const bounds="set local statement_timeout='8s';set local lock_timeout='8s';";
const measure=workspace=>`select pg_temp.pool_proof_measure(${literal(workspace)}::uuid);`;
const fence=workspace=>`select jsonb_build_object('workspace_fenced',id)from eps.workspaces where id=${literal(workspace)}::uuid for update;`;

async function transaction(ctx,name,body){
 const holder=await ctx.startPrepared('al_'+name.slice(0,8));
 const record={normal_return:false,rolled_back:false,actual_helper_RC:true,fenced_caller_only:true};
 ctx.report.pool_helper_proof[name]=record;let primary,cleanupError;
 try{await body(holder,record);record.normal_return=true;}
 catch(error){primary=error;record.error=nativeError(error);record.private_error=await ctx.captureError('acq_'+name,error);}
 finally{
  try{await holder.request('rollback;reset role;');record.rolled_back=true;}
  catch(error){record.cleanup_error=nativeError(error);if(!primary){cleanupError=error;record.private_cleanup_error=await ctx.captureError('acq_'+name+'_cleanup',error);}}
  await holder.finish();
 }
 if(primary)throw primary;if(cleanupError)throw cleanupError;
 assert.deepEqual(await ctx.value(SNAPSHOT),ctx.baseline,'ACQUISITION_LOCK_CASE_BASELINE_CHANGED');record.full_baseline_restored=true;
 return record;
}

async function archivedReference(ctx){
 const p=ctx.profiles.large;
 await transaction(ctx,'archived_reference',async(holder,record)=>{
  await holder.request(`reset role;begin;${bounds}update eps.assignments set workspace_candidate_id=${literal(ctx.id('pool-2-12'))}::uuid where id=${literal(ctx.id('assignment-2-1'))}::uuid and workspace_id=${literal(p.workspace)}::uuid;`);
  record.pool_state=only(await holder.request(`select jsonb_build_object('archived_pool',p.archived_at is not null,'active_reference',a.archived_at is null)from eps.assignments a join eps.workspace_candidates p on p.id=a.workspace_candidate_id where a.id=${literal(ctx.id('assignment-2-1'))}::uuid and p.id=${literal(ctx.id('pool-2-12'))}::uuid;`));
  assert.deepEqual(record.pool_state,{archived_pool:true,active_reference:true});
  const contender=await ctx.startPrepared('al_arch_c');
  const probe=async()=>{
   await contender.request('begin;'+ctx.acting('mcp')+bounds);
   try{return only(await contender.request(`select pg_temp.locksource41_probe_pool_share(${literal(ctx.id('pool-2-12'))}::uuid);`));}
   finally{await contender.request('rollback;reset role;');}
  };
  try{
   record.fk_key_share_control=await probe();assert.deepEqual(record.fk_key_share_control,{found:true,locked:false});
   await holder.request(ctx.acting('mcp')+bounds);record.fence=only(await holder.request(fence(p.workspace)));assert.equal(record.fence.workspace_fenced,p.workspace);
   record.helper=only(await holder.request(measure(p.workspace)));assert.equal(record.helper.ok,true);assert(record.helper.duration_ms<8000);
   record.actual_share_probe=await probe();assert.deepEqual(record.actual_share_probe,{found:true,locked:true,code:'55P03'});
  }finally{await contender.finish();}
  record.ready_dml_issued=false;
 });
}

export async function verifyAcquisitionLocks(ctx){
 assert.equal(ctx.report.combined_generation.actual_first_whole_generation_matrix_completed,true,'ACQUISITION_FIRST_MATRIX_REQUIRED');
 assert.equal(ctx.report.combined_generation.review_and_snapshot_contract_equalities_completed,true,'ACQUISITION_COMPONENT_EQUALITY_REQUIRED');
 assert.equal(ctx.bindings.candidateSha,'aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3');
 const evidence=ctx.report.pool_helper_proof={fresh_changed_helper:true,helper_source_sha256:ctx.bindings.candidateSha,lock_or_security_acceptance_carried:false,
  actual_helper_and_RC_races_unchanged_isolation:true,oracle_only_RR_readonly:true,standalone_unfenced_equality_claimed:false};
 const cohorts=await readFile(new URL('../presentation-lock-source-proof/cohorts.sql',import.meta.url),'utf8');
 assert.equal(sha(cohorts),'06d12e3c2b2ca36deb7831579a7ef55ec183cdd77b9e66515b18c3b0bbc953ef');
 ctx.startPrepared=async tag=>{const s=await ctx.start(tag);await s.request('reset role;'+cohorts+ctx.bindings.measureSql+ctx.bindings.oracleSql);return s;};
 const actual=await ctx.value("select jsonb_build_object('source',encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex'),'authority',to_jsonb(p)-'prosrc')from pg_proc p where oid='eps.presentation_lock_sources(uuid,text,text)'::regprocedure;");
 evidence.identity={source:actual.source,authority_unchanged:JSON.stringify(actual.authority)===JSON.stringify(ctx.sourceBefore.authority)};
 assert.equal(evidence.identity.source,ctx.bindings.candidateSha);assert.equal(evidence.identity.authority_unchanged,true);
 await transaction(ctx,'all_twelve',async(holder,record)=>{
  await holder.request('begin;'+ctx.acting('mcp')+bounds);
  record.fence=only(await holder.request(fence(ctx.profiles.large.workspace)));assert.equal(record.fence.workspace_fenced,ctx.profiles.large.workspace);
  record.helper=only(await holder.request(measure(ctx.profiles.large.workspace)));assert.equal(record.helper.ok,true);assert(record.helper.duration_ms<8000);
  record.held={};await heldCohorts(ctx,holder,record.held);
  assert.equal(record.held.relations.length,12);assert.equal(record.held.completed,true);
  record.selected_rows=record.held.relations.reduce((n,r)=>n+r.selected_rows,0);record.held_rows=record.held.relations.reduce((n,r)=>n+r.held_rows,0);
  assert.equal(record.selected_rows,150);assert.equal(record.held_rows,150);assert.equal(record.held.negatives.length,8);
 });
 await archivedReference(ctx);
 ctx.report.checkpoint='acquisition-candidate-cross-FK';await crossWorkspaceKeys(ctx);
 ctx.report.checkpoint='acquisition-candidate-workspace-fence';await workspaceFenceRace(ctx);
 ctx.report.checkpoint='acquisition-candidate-live-authority';await authorityCases(ctx);
 assert.deepEqual(await ctx.value(SNAPSHOT),ctx.baseline,'ACQUISITION_RC_BASELINE_CHANGED');
 evidence.all_twelve_NOWAIT_archived_FK_workspace_fence_membership_capability_expiry_completed=true;
}
