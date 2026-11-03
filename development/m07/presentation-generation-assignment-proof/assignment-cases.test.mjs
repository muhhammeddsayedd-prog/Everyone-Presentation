import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile}from 'node:fs/promises';
import {URL}from 'node:url';
import {verifyAssignmentCases,assertAssignmentEquality}from './assignment-cases.mjs';
import {firstWholeGenerations}from './matrix.mjs';

function focusContext(variant,{badBudget=false,badShortlist=false}={}){
 const baseline={synthetic:'same'},report={combined_generation:{actual_first_whole_generation_matrix_completed:true},assignment_cases:{}};
 const states={selection_main:[19,0,16,0],selection_no_main:[19,0,15,1],oversize_private_assignment:[1,0,1,0],shortlist_excluded_main:[1,15,0,1],shortlist_included_main:[2,15,1,0],shortlist_empty:[0,16,0,0]};
 const names=Object.keys(states);let index=-1,clocks=0;
 const preset={audience_preset_id:'00000000-0000-4000-8000-000000000001',template_version:'1.1.0'};
 const common=async sql=>{
  if(sql.includes("'audience_preset_id',audience_preset_id"))return[preset];
  if(sql.includes('public.eps_create_presentation_series('))return[{id:'00000000-0000-4000-8000-000000000002',template_version:'1.1.0',output_type:'shortlist'}];
  return[];
 };
 const holder={pid:10,async request(sql){
  if(sql.startsWith('reset role;begin;')&&!sql.includes('lock table'))index++;
  if(sql.includes("'over_shared_budget'"))return[{over_shared_budget:!badBudget,note_bytes:5242909}];
  if(sql.startsWith('select pg_temp.assignment_review_observe(')){
   const name=names[index],s=states[name],hash=name;
   return[{ok:true,duration_ms:1,contract_hash:hash,new_series_normalized_hash:hash,normalization:['new series_id','series-dependent input_fingerprint'],input_fingerprint:'f'.repeat(64),output_type:name.startsWith('shortlist_')?'shortlist':'selection',candidate_count:badShortlist&&name==='shortlist_excluded_main'?2:s[0],pending_count:s[1],main_count:s[2],no_main_count:s[3],ordered_assignments_sha256:name,private_internal_note_in_output:false}];
  }
  return common(sql);
 }};
 const contender={pid:11,async request(sql){if(sql.includes("'included',count(*)"))return[{included:0}];if(sql.startsWith('select pg_temp.assignment_review_observe('))return[{ok:false,code:'RESOURCE_NOT_FOUND'}];return common(sql);}};
 const observer={pid:12,async request(sql){if(sql.includes('pg_locks'))return[{waiting:true}];if(sql.includes("'epoch'"))return[{epoch:clocks++===0?1000:1006}];return[];}};
 const p={workspace:'00000000-0000-4000-8000-000000000004',series:'00000000-0000-4000-8000-000000000005',meta:{input:{expected_input_fingerprint:'f'.repeat(64)}}};
 const ctx={variant,holder,contender,observer,report,runId:'00000000-0000-4000-8000-000000000003',profiles:{large:p,control:p},id:()=> '00000000-0000-4000-8000-000000000006',acting:()=>'',value:async()=>baseline,baseline,captureError:async()=>({normal_return:true,private_file:'safe-private-error.json'})};
 return ctx;
}

test('six focused data cases, actual-bound virtual expiry sequence and old/new normalized equality',async()=>{
 const evidence={};
 for(const variant of['old','candidate']){
  const ctx=focusContext(variant);await verifyAssignmentCases(ctx);evidence[variant]=ctx.report.assignment_cases[variant];
  assert.equal(evidence[variant].cases.length,6);assert(evidence[variant].cases.every(x=>x.rolled_back&&x.full_baseline_restored));
  assert.equal(evidence[variant].empty_tail_expiry.actual_distinct_pid_relation_wait,true);
 }
 assertAssignmentEquality(evidence);
});

test('private-row budget negative stops before snapshot, retains cost and rollback',async()=>{
 const ctx=focusContext('candidate',{badBudget:true});await assert.rejects(verifyAssignmentCases(ctx));
 const rows=ctx.report.assignment_cases.candidate.cases;assert.equal(rows.length,3);assert.equal(rows[2].cost.over_shared_budget,false);assert.equal(rows[2].rolled_back,true);assert.equal(rows[2].normal_return,undefined);
});

test('wrong Shortlist inclusion is rejected with result retained before assertion',async()=>{
 const ctx=focusContext('candidate',{badShortlist:true});await assert.rejects(verifyAssignmentCases(ctx));
 const rows=ctx.report.assignment_cases.candidate.cases;assert.equal(rows.length,4);assert.equal(rows[3].observation.candidate_count,2);assert.equal(rows[3].rolled_back,true);
});

test('first matrix candidate MCP-large is first, and its failure stops remaining seven',async()=>{
 const profile={workspace:'00000000-0000-4000-8000-000000000001',series:'00000000-0000-4000-8000-000000000002',meta:{input:{}}};
 const calls=[],ctx={report:{combined_generation:{}},profiles:{control:profile,large:profile},runId:'first-only',acting:()=>'',installVariant:async v=>calls.push(v),captureError:async()=>({normal_return:true}),startFreshGeneration:async tag=>({pid:99,request:async sql=>sql.startsWith('select pg_temp.locksource41_measure(')?[{ok:false,code:'57014',duration_ms:8000}]:[],finish:async()=>{calls.push(tag);}})};
 await assert.rejects(firstWholeGenerations(ctx));const rows=ctx.report.combined_generation.first_calls;
 assert.equal(rows.length,1);assert.deepEqual([rows[0].variant,rows[0].mode,rows[0].label],['candidate','mcp','large']);assert.equal(rows[0].generation.code,'57014');assert.equal(rows[0].normal_return,true);assert.equal(rows[0].rolled_back,true);assert.equal(rows[0].client_elapsed_ms>=0,true);assert.equal(calls.length,2);
});

test('fresh matrix exposes all eight unique first calls and original component gates remain',async()=>{
 const source=await readFile(new URL('./matrix.mjs',import.meta.url),'utf8');
 assert(source.includes("[{variant:'candidate',mode:'mcp',label:'large'}"));
 assert(source.includes("x.variant==='candidate'&&x.mode==='mcp'&&x.label==='large'"));
 assert(source.includes("assert.equal(records.length,8);assert.equal(new Set(records.map(x=>x.pid)).size,8)"));
 assert.equal(source.split('COMBINED_FIRST_MATRIX_REQUIRED_BEFORE_PROJECTIONS').length,2);
 assert.equal(source.split('COMBINED_FIRST_MATRIX_REQUIRED_BEFORE_MISSING_FRAME').length,2);
});

test('actual matrix orchestration makes exactly eight distinct calls and retains old cancellation as negative control',async()=>{
 const baseline={same:true},profiles={control:{workspace:'control-ws',series:'control-series',meta:{input:{expected_input_fingerprint:'control-fingerprint'}}},large:{workspace:'large-ws',series:'large-series',meta:{input:{expected_input_fingerprint:'large-fingerprint'}}}};
 let variant,pid=100;
 const ctx={report:{combined_generation:{}},profiles,runId:'eight-only',acting:()=>'',baseline,value:async()=>baseline,installVariant:async v=>{variant=v;},captureError:async()=>({normal_return:true}),startFreshGeneration:async tag=>{
  const current=variant,label=tag.endsWith('l')?'large':'control',mode=tag.at(-2)==='m'?'mcp':'api';
  return{pid:pid++,finish:async()=>{},async request(sql){
   if(sql.startsWith('select pg_temp.locksource41_measure('))return[current==='old'&&mode==='mcp'&&label==='large'?{ok:false,code:'57014',duration_ms:8000}:{ok:true,duration_ms:1,role:'authenticated',resource_id:'00000000-0000-4000-8000-000000000001'}];
   if(sql.includes('pg_temp.locksource41_generated_projection('))return[{job_status:'queued',outbox_rows:1,label}];
   if(sql.includes('pg_temp.data_reuse_pin_projection('))return[{private_filename_in_output:false,label}];
   if(sql.includes('pg_temp.combined_manifest_projection('))return[{stored_snapshot_hash_valid:true,stored_manifest_hash_valid:true,stored_inventory_hash_valid:true,input_fingerprint:profiles[label].meta.input.expected_input_fingerprint}];
   return[];
  }};
 }};
 await firstWholeGenerations(ctx);const rows=ctx.report.combined_generation.first_calls;
 assert.equal(rows.length,8);assert.equal(new Set(rows.map(x=>[x.variant,x.mode,x.label].join(':'))).size,8);assert.equal(new Set(rows.map(x=>x.pid)).size,8);
 assert.deepEqual([rows[0].variant,rows[0].mode,rows[0].label],['candidate','mcp','large']);
 assert.equal(rows.find(x=>x.variant==='old'&&x.mode==='mcp'&&x.label==='large').baseline_cancellation_retained,true);
 assert.equal(rows[0].old_generation_projection_unavailable,true);assert.equal(ctx.report.combined_generation.actual_first_whole_generation_matrix_completed,true);
});
