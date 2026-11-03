/** New focused data cases only, after the first-eight matrix; no entry point. */
import assert from 'node:assert/strict';
import {readFile}from 'node:fs/promises';
import {setTimeout}from 'node:timers/promises';
import {URL}from 'node:url';
import {ACTOR,literal,json,sha}from '../presentation-lock-source-proof/proof.mjs';
import {observePending}from '../presentation-lock-source-pool-proof/cases.mjs';
import {nativeError}from '../presentation-lock-source-pool-proof/native.mjs';
const only=rows=>{assert.equal(rows.length,1);return rows[0];};
const SNAPSHOT='select locksource41_proof.row_hashes();';
const bounds="set local statement_timeout='8s';set local lock_timeout='8s';";
const observe=p=>`select pg_temp.assignment_review_observe(${literal(p.workspace)}::uuid,${literal(p.series)}::uuid);`;
const safeResult=r=>{assert.equal(r.ok,true);assert(r.duration_ms<8000);assert.equal(r.private_internal_note_in_output,false);assert(/^[a-f0-9]{64}$/u.test(r.input_fingerprint));};

async function shortlist(ctx,session,suffix){
 const p=ctx.profiles.large;
 const source=only(await session.request(`reset role;select jsonb_build_object('audience_preset_id',audience_preset_id,'template_version',template_version)from eps.presentation_series where id=${literal(p.series)}::uuid and workspace_id=${literal(p.workspace)}::uuid;`));
 assert.equal(source.template_version,'1.1.0');
 await session.request(ctx.acting('api','authenticated'));
 const created=only(await session.request(`select public.eps_create_presentation_series(${json({workspace_id:p.workspace,output_type:'shortlist',audience_preset_id:source.audience_preset_id,title:'Owned assignment Shortlist'})},${literal('assignproof-'+ctx.runId+'-'+ctx.variant+'-'+suffix)});`));
 assert.equal(created.output_type,'shortlist');assert.equal(created.template_version,'1.1.0');assert(/^[a-f0-9-]{36}$/u.test(created.id));
 return{workspace:p.workspace,series:created.id};
}

async function dataCase(ctx,records,name,setup,{isShortlist=false,profileLabel='large',expected=null}={}){
 const record={name,rolled_back:false,old_ready_dml_issued:false};records.push(record);
 let primary,cleanupError;
 try{
  await ctx.holder.request('reset role;begin;'+setup);
  const profile=isShortlist?await shortlist(ctx,ctx.holder,name):ctx.profiles[profileLabel];
  if(name==='oversize_private_assignment'){
   record.cost=only(await ctx.holder.request(`reset role;select jsonb_build_object('over_shared_budget',pg_column_size(a)::bigint+octet_length(a::text)::bigint+octet_length(a.id::text)+256>4194304,'note_bytes',octet_length(a.internal_notes))from eps.assignments a where id=${literal(ctx.id('assignment-1-1'))}::uuid and workspace_id=${literal(profile.workspace)}::uuid;`));
   assert.equal(record.cost.over_shared_budget,true);assert(record.cost.note_bytes>5242880);
  }
  await ctx.holder.request(ctx.acting('mcp')+bounds);
  record.observation=only(await ctx.holder.request(observe(profile)));record.normal_return=true;
  safeResult(record.observation);
  if(name==='oversize_private_assignment'){assert.equal(record.observation.input_fingerprint,ctx.profiles.control.meta.input.expected_input_fingerprint);record.original_control_input_fingerprint_unchanged=true;}
  if(expected!==null)for(const[key,value]of Object.entries(expected))assert.equal(record.observation[key],value);
 }catch(error){primary=error;record.error=nativeError(error);record.private_error=await ctx.captureError('assign_'+ctx.variant+'_'+name,error);}
 finally{
  try{await ctx.holder.request('rollback;reset role;');record.rolled_back=true;}
  catch(error){record.cleanup_error=nativeError(error);if(!primary)cleanupError=error;}
 }
 if(primary)throw primary;if(cleanupError)throw cleanupError;
 assert.deepEqual(await ctx.value(SNAPSHOT),ctx.baseline);record.full_baseline_restored=true;
}

async function emptyExpiry(ctx,evidence){
 const {holder,contender,observer,acting,profiles}=ctx;
 const clock=async()=>Number(only(await observer.request("reset role;select jsonb_build_object('epoch',extract(epoch from clock_timestamp()));")).epoch);
 const record=evidence.empty_tail_expiry={source_empty:false,actual_distinct_pid_relation_wait:false,rolled_back:false};
 let pending,primary,barrier=false,contenderStarted=false;
 try{
  await contender.request(`reset role;begin;update eps.assignments set shortlist_included=false where workspace_id=${literal(profiles.large.workspace)}::uuid and archived_at is null;`);contenderStarted=true;
  const p=await shortlist(ctx,contender,'empty_expiry');
  const count=only(await contender.request(`reset role;select jsonb_build_object('included',count(*))from eps.assignments where workspace_id=${literal(p.workspace)}::uuid and archived_at is null and shortlist_included;`));record.source_empty=count.included===0;assert.equal(record.source_empty,true);
  const expiry=Math.floor(await clock())+4;
  await holder.request('reset role;begin;lock table eps.specs in access exclusive mode;');barrier=true;
  await contender.request(acting('mcp','eps_review_owner',ACTOR,{exp:expiry})+bounds);
  pending=observePending(contender.request(observe(p)));
  for(let i=0;i<80;i++){
   const wait=only(await observer.request(`reset role;select jsonb_build_object('waiting',exists(select 1 from pg_locks where pid=${contender.pid} and not granted and relation='eps.specs'::regclass)and ${holder.pid}=any(pg_blocking_pids(${contender.pid})));`));
   if(wait.waiting){record.actual_distinct_pid_relation_wait=true;break;}await setTimeout(20);
  }
  assert.equal(record.actual_distinct_pid_relation_wait,true);assert.notEqual(holder.pid,contender.pid);
  await setTimeout(Math.max(0,expiry*1000+125-(await clock())*1000));record.database_clock_expired=(await clock())>expiry;
  await holder.request('rollback;reset role;');barrier=false;
  record.result=only(await pending);record.normal_return=true;
  assert.equal(record.database_clock_expired,true);
  if(ctx.variant==='candidate'){assert.equal(record.result.ok,false);assert(['CAPABILITY_REQUIRED','RESOURCE_NOT_FOUND','AUTH_REQUIRED','42501'].includes(record.result.code));}
 }catch(error){primary=error;record.error=nativeError(error);record.private_error=await ctx.captureError('assign_'+ctx.variant+'_empty_expiry',error);}
 finally{
  if(barrier)await holder.request('rollback;reset role;');
  if(pending&&!record.normal_return){try{await pending;}catch{/* First error remains privately preserved. */}}
  if(contenderStarted){await contender.request('rollback;reset role;');record.rolled_back=true;}
 }
 if(primary)throw primary;
 assert.deepEqual(await ctx.value(SNAPSHOT),ctx.baseline);record.full_baseline_restored=true;
}

export async function verifyAssignmentCases(ctx){
 assert.equal(ctx.report.combined_generation.actual_first_whole_generation_matrix_completed,true,'ASSIGNMENT_FIRST_MATRIX_REQUIRED');
 const evidence=ctx.report.assignment_cases[ctx.variant]={cases:[]};
 const helpers=await readFile(new URL('./assignment-cases.sql',import.meta.url),'utf8');
 await ctx.holder.request('reset role;'+helpers.replaceAll('create function pg_temp.','create or replace function pg_temp.'));
 await ctx.contender.request('reset role;'+helpers.replaceAll('create function pg_temp.','create or replace function pg_temp.'));
 const ws=literal(ctx.profiles.large.workspace),main=literal(ctx.id('assignment-2-1')),option=literal(ctx.id('assignment-2-17'));
 const none=`update eps.assignments set shortlist_included=false where workspace_id=${ws}::uuid and archived_at is null;`;
 await dataCase(ctx,evidence.cases,'selection_main','',{expected:{output_type:'selection',candidate_count:19,pending_count:0,main_count:16,no_main_count:0}});
 await dataCase(ctx,evidence.cases,'selection_no_main',`update eps.assignments set position='option'where id=${main}::uuid and workspace_id=${ws}::uuid;`,{expected:{output_type:'selection',candidate_count:19,pending_count:0,main_count:15,no_main_count:1}});
 await dataCase(ctx,evidence.cases,'oversize_private_assignment',`update eps.assignments set internal_notes='OWNED_PRIVATE_ASSIGNMENT_NOTE'||repeat('x',5242880)where id=${literal(ctx.id('assignment-1-1'))}::uuid and workspace_id=${literal(ctx.profiles.control.workspace)}::uuid;`,{profileLabel:'control',expected:{output_type:'selection',candidate_count:1,pending_count:0,main_count:1,no_main_count:0}});
 await dataCase(ctx,evidence.cases,'shortlist_excluded_main',none+`update eps.assignments set shortlist_included=true where id=${option}::uuid and workspace_id=${ws}::uuid;`,{isShortlist:true,expected:{output_type:'shortlist',candidate_count:1,pending_count:15,main_count:0,no_main_count:1}});
 await dataCase(ctx,evidence.cases,'shortlist_included_main',none+`update eps.assignments set shortlist_included=true where id in(${main}::uuid,${option}::uuid)and workspace_id=${ws}::uuid;`,{isShortlist:true,expected:{output_type:'shortlist',candidate_count:2,pending_count:15,main_count:1,no_main_count:0}});
 await dataCase(ctx,evidence.cases,'shortlist_empty',none,{isShortlist:true,expected:{output_type:'shortlist',candidate_count:0,pending_count:16,main_count:0,no_main_count:0}});
 await emptyExpiry(ctx,evidence);
}

export function assertAssignmentEquality(evidence){
 assert(evidence.old&&evidence.candidate);assert.equal(evidence.old.cases.length,6);assert.equal(evidence.candidate.cases.length,6);
 for(const variant of['old','candidate'])assert.equal(evidence[variant].cases[2].original_control_input_fingerprint_unchanged,true);
 for(let i=0;i<6;i++){
  const a=evidence.old.cases[i],b=evidence.candidate.cases[i];assert.equal(a.name,b.name);assert.equal(a.rolled_back,true);assert.equal(b.rolled_back,true);
  // Only fresh normal-RPC Shortlist IDs and their series-bound fingerprints are
  // normalized. Original Selection fingerprints must remain exactly equal.
  const key=a.name.startsWith('shortlist_')?'new_series_normalized_hash':'contract_hash';
  assert.equal(a.observation[key],b.observation[key]);assert.equal(a.observation.ordered_assignments_sha256,b.observation.ordered_assignments_sha256);
 }
 const expiry=evidence.candidate.empty_tail_expiry;assert.equal(expiry.source_empty,true);assert.equal(expiry.actual_distinct_pid_relation_wait,true);assert.equal(expiry.database_clock_expired,true);assert.equal(expiry.result.ok,false);assert.equal(expiry.rolled_back,true);
 assert.equal(sha(JSON.stringify(evidence)).length,64);
}
