/** Isolated semantic RR validation only; actual race callers remain unchanged RC. */
import assert from 'node:assert/strict';
import {performance}from 'node:perf_hooks';
import {only,hash,literal,keyId,identity,universe,admitResult}from './keys.mjs';
const RELATION='eps.workspace_candidates';
async function check(s,state,evidence,live=false){
 const value=only(await s.request(live?`select pg_temp.complete41_semantic_live(${literal(state.workspace)}::uuid);`:'select pg_temp.complete41_identity();'));
 identity(value,'eps_review_owner',state.pid,state.snapshot,'off',state.claims);evidence.identity_checks++;if(live)evidence.live_authority_checks++;return value;
}
export async function semanticTuples(ctx,s,workspace,mustInclude=null,mustContainFrame=null){
 const record=ctx.report.pool_helper_proof.semantic.at(-1);assert(record&&['baseline','empty_assignments','referenced_archived_pool','missing_selected_pair'].includes(record.name));
 const evidence={scope:'isolated rollback semantic validation only; not concurrent grant-revocation proof',holder_RR_readwrite_required:true,prepared_after_fixture_DML_and_unchanged_helper:true,no_source_or_authority_writer_launched_until_semantic_phase_returns:true,claim_refresh_or_extension:false,identity_checks:0,live_authority_checks:0,variants:[]};record.complete_semantic=evidence;
 await s.request('reset role;'+ctx.bindings.completeSemanticSql);
 const full=only(await s.request('select pg_temp.complete41_semantic_universe();'));
 assert(full&&typeof full==='object'&&Object.keys(full).sort().join(',')==='identity,universes');
 const trusted=identity(full.identity,'postgres',s.pid,null,'off');assert.deepEqual(Object.keys(full.universes),[RELATION]);
 const domain=universe(RELATION,full.universes[RELATION],ctx.baseline.tables[RELATION].count);
 evidence.universe_rows=domain.all.length;evidence.universe_sha256=hash(domain.all);evidence.snapshot_sha256=hash(trusted.snapshot);evidence.holder_pid=trusted.pid;
 const state={workspace,pid:trusted.pid,snapshot:trusted.snapshot,claims:trusted.claims_sha256};
 // Restore the same caller, without setting JWT claims or extending its expiry.
 await s.request('set role eps_review_owner;');await check(s,state,evidence);await check(s,state,evidence,true);
 const results={},ids=[];
 for(const variant of['capture','old','new']){
  const selected=[],seen=new Set(),progress={variant,chunks:[],completed:false};evidence.variants.push(progress);
  const array='array['+ids.map(id=>literal(id)+'::uuid').join(',')+']::uuid[]';
  for(let i=0;i<domain.chunks.length;i++){
   const chunk=domain.chunks[i],item={index:i,key_sha256:hash(chunk),normal_return:false};progress.chunks.push(item);const started=performance.now();
   let value;try{value=only(await s.request(`select pg_temp.complete41_semantic_slice(${literal(variant)},${literal(workspace)}::uuid,${array},${literal(JSON.stringify(chunk))}::jsonb);`));item.client_elapsed_ms=performance.now()-started;}catch(error){item.client_elapsed_ms=performance.now()-started;throw error;}
   assert(value&&typeof value==='object'&&Object.keys(value).sort().join(',')==='identity,keys');identity(value.identity,'eps_review_owner',state.pid,state.snapshot,'off',state.claims);evidence.identity_checks++;evidence.live_authority_checks+=2;
   assert(Array.isArray(value.keys));const pk=value.keys.map(row=>({id:row.id}));admitResult(RELATION,pk,chunk,[],seen);
   if(variant!=='capture')for(const row of value.keys)assert.equal(Object.keys(row).sort().join(','),'candidate_id,id,selected_candidate_media_id,selected_frame_asset_ids');
   selected.push(...value.keys);item.selected_rows=value.keys.length;item.result_sha256=hash(value.keys);item.normal_return=true;
  }
  selected.sort((a,b)=>domain.ordinal.get(keyId(RELATION,a))-domain.ordinal.get(keyId(RELATION,b)));assert.equal(progress.chunks.length,domain.all.length);await check(s,state,evidence,true);await check(s,state,evidence);
  progress.selected_rows=selected.length;progress.selected_sha256=hash(selected);progress.final_live_scope_snapshot_and_claims_verified=true;progress.completed=true;results[variant]=selected;
  if(variant==='capture')ids.push(...selected.map(row=>row.id));
 }
 if(mustInclude!==null)assert(ids.includes(mustInclude),'POOL_PROOF_ARCHIVED_REFERENCE_MISSING');
 if(mustContainFrame!==null)assert(results.new.some(row=>Array.isArray(row.selected_frame_asset_ids)&&row.selected_frame_asset_ids.includes(mustContainFrame)),'POOL_PROOF_SELECTED_FRAME_DROPPED');
 const answer={captured_pool_count:ids.length,old_tuple_count:results.old.length,new_tuple_count:results.new.length,old_tuple_sha256:hash(results.old),new_tuple_sha256:hash(results.new)};
 assert.equal(answer.old_tuple_sha256,answer.new_tuple_sha256,'POOL_PROOF_SELECTED_TUPLES_DIFFER');return answer;
}
