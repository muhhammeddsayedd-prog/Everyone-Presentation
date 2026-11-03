/** Fake SQL sessions only; no database, child process or provider dispatch. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyPinAuthorityCases} from './pin-authority.mjs';

const ACTOR='a4410000-0000-4000-8000-000000000001';
const project='00000000-0000-4000-8000-000000000001';
const workspace='00000000-0000-4000-8000-000000000002';
const series='00000000-0000-4000-8000-000000000003';
const canary='PRIVATE_AUTHORITY_ROW_DO_NOT_PUBLISH';
const clone=value=>JSON.parse(JSON.stringify(value));

function context(variant='candidate',options={}){
 const calls=[],senders=[],baseline={synthetic:'unchanged'};
 const original={membership:{project_id:project,principal_id:ACTOR,role:'producer',private_note:canary},
  capability:{principal_id:ACTOR,capability:'presentations.generate',active:true,private_note:canary}};
 const state={membership:clone(original.membership),capability:clone(original.capability)};
 let current,barrier=false,nextPid=20;
 const report={combined_generation:{actual_first_whole_generation_matrix_completed:true,
  review_and_snapshot_contract_equalities_completed:true},pin_batch_cases:{}};
 const release=()=>{
  if(!current?.resolve)return;
  const {change}=current;
  if(options.native&&change==='membership'){
   current.exit(options.nativeExit??3);
   current.reject(Object.assign(new Error('private native failure'),options.unprovenNative?
    {code:'42501'}:{diagnostic:{stderr:'ERROR:  P0001:  IMMUTABLE_VERSION\nDETAIL: '+canary}}));
  }else{
   const codes={membership:'RESOURCE_NOT_FOUND',capability:'CAPABILITY_REQUIRED',expiry:'AUTH_REQUIRED'};
   const changed=change==='expiry'?current.clockReads>=2:change==='membership'?state.membership===null:state.capability.active===false;
   current.resolve([options.result??{ok:!changed,code:changed?codes[change]:undefined,duration_ms:20}]);
  }
  current.resolve=undefined;
 };
 const holder={pid:10,async request(sql){calls.push(['holder',sql]);
  if(sql.includes('lock table eps.presentation_version_assets in share mode'))barrier=true;
  if(sql.startsWith('rollback;')){barrier=false;release();}
  return[];
 }};
 const writer={pid:11,async request(sql){calls.push(['writer',sql]);
  if(sql.includes('with affected as(')){
   assert.equal(barrier,true);assert.equal(current.waitObserved,true);
   if(sql.includes('delete from public.project_memberships'))state.membership=null;else state.capability.active=false;
   return[{changed_rows:1}];
  }
  if(sql.includes('jsonb_populate_record')){
   assert(sql.includes(canary));
   const key=sql.includes('null::public.project_memberships')?'membership':'capability';
   state[key]=clone(original[key]);if(options.badRestore)state[key].private_note='different';
  }
  return[];
 }};
 const observer={pid:12,async request(sql){calls.push(['observer',sql]);
  if(sql.includes("'epoch'")){current.clockReads++;return[{epoch:current.clockReads===1?1000:1005}];}
  if(sql.includes('pg_locks')){
   assert(sql.includes("mode='RowExclusiveLock'"));assert(sql.includes("relation='eps.presentation_version_assets'::regclass"));
   const waiting=!options.noWait&&barrier&&Boolean(current.resolve);current.waitObserved=waiting;return[{waiting}];
  }
  return[];
 }};
 const ctx={variant,holder,writer,observer,contender:{pid:13},profiles:{control:{project,workspace,series,
  meta:{input:{expected_workspace_row_version:1,expected_draft_revision:1,expected_input_fingerprint:'f'.repeat(64)}}}},
  acting:(mode,role,actor,override)=>{assert.equal(mode,'mcp');assert.equal(role,'authenticated');assert.equal(actor,ACTOR);
   current.override=override;return '/* normal controlled claims */';},
  runId:'00000000-0000-4000-8000-000000000004',baseline,report,
  captureError:async()=>({normal_return:!options.captureFails,private_file:'fake-private-error.json'}),
  value:async sql=>{
   calls.push(['value',sql]);if(sql==='select locksource41_proof.row_hashes();')return options.badBaseline?{changed:true}:baseline;
   assert(sql.startsWith('select to_jsonb(t)'));return clone(sql.includes('public.project_memberships')?state.membership:state.capability);
  },
  startFreshGeneration:async tag=>{
   const change={m:'membership',c:'capability',e:'expiry'}[tag.at(-1)];
   let exit;const done=new Promise(resolve=>{exit=resolve;});
   const sender={pid:nextPid++,done,change,clockReads:0,exit,waitObserved:false,finished:false,dispatches:0,
    async request(sql){calls.push(['sender',sql]);
     if(sql.startsWith('begin isolation level read committed;')){
      assert(sql.includes("set local statement_timeout='8s';set local lock_timeout='8s';"));return[];
     }
     if(sql.startsWith('select pg_temp.locksource41_measure(')){
      sender.dispatches++;assert.equal(sender.dispatches,1);assert(sql.includes("'generate'"));
      assert(sql.includes('pinbatch-'+ctx.runId+'-'+variant+'-'+change));
      const result=new Promise((resolve,reject)=>{sender.resolve=resolve;sender.reject=reject;});
      if(options.noWait){sender.resolve([options.result??{ok:false,code:'AUTH_REQUIRED',duration_ms:1}]);sender.resolve=undefined;}
      return result;
     }
     if(sql.startsWith('rollback;'))sender.rollback=true;
     return[];
    },async finish(){sender.finished=true;sender.exit(0);}};
   current=sender;senders.push(sender);return sender;
  }};
 return{ctx,calls,senders,state,original};
}

test('both variants require three real-barrier sequences with exact restore and fresh sessions',async()=>{
 for(const variant of ['old','candidate']){
  const f=context(variant);await verifyPinAuthorityCases(f.ctx);const evidence=f.ctx.report.pin_batch_cases[variant];
  assert.equal(evidence.completed,true);assert.equal(evidence.codes_must_match_other_variant,false);
  assert.deepEqual(evidence.cases.map(row=>row.case),['membership','capability','expiry']);
  for(const row of evidence.cases){assert(row.actual_pin_INSERT_wait&&row.fresh_authority_denial_observed&&row.sender_rolled_back&&row.full_baseline_restored&&row.completed);}
  assert(evidence.cases.slice(0,2).every(row=>row.authority_changed&&row.authority_restored));
  const expiry=evidence.cases[2];assert.equal(expiry.database_clock_expired,true);assert.equal(expiry.authority_changed,false);
  assert.equal(f.senders[2].override.exp,1004);assert.equal(new Set(f.senders.map(sender=>sender.pid)).size,3);
  assert(f.senders.every(sender=>sender.dispatches===1&&sender.finished));assert.deepEqual(f.state,f.original);
  assert(!JSON.stringify(evidence).includes(canary));
 }
});

test('verbose native denial requires private custody and actual exit3 then discards that sender',async()=>{
 const f=context('old',{native:true});await verifyPinAuthorityCases(f.ctx);
 const row=f.ctx.report.pin_batch_cases.old.cases[0];
 assert.equal(row.result.code,'IMMUTABLE_VERSION');assert.equal(row.normal_SQL_return,false);
 assert.equal(row.native_error.provenance,'first_verbose_psql_ERROR_line');assert.equal(row.backend_exit,3);
 assert.equal(row.rollback_by_backend_exit,true);assert.equal(row.authority_restored,true);
 assert(f.senders[0].finished);assert.equal(f.senders.length,3);assert(!JSON.stringify(f.ctx.report).includes(canary));
});

test('57014 is retained but never counted as authority denial or retried',async()=>{
 const f=context('candidate',{result:{ok:false,code:'57014',duration_ms:7999}});
 await assert.rejects(verifyPinAuthorityCases(f.ctx),/PIN_AUTHORITY_FRESH_DENIAL_REQUIRED/u);
 const evidence=f.ctx.report.pin_batch_cases.candidate,row=evidence.cases[0];
 assert.equal(row.result.code,'57014');assert.equal(row.completed,false);assert.equal(evidence.completed,false);
 assert.equal(row.authority_restored,true);assert.equal(row.sender_rolled_back,true);assert.equal(f.senders.length,1);
});

test('denial without the exact INSERT wait cannot mutate authority or pass',async()=>{
 const f=context('candidate',{noWait:true});await assert.rejects(verifyPinAuthorityCases(f.ctx),/PIN_AUTHORITY_ACTUAL_INSERT_WAIT_REQUIRED/u);
 const row=f.ctx.report.pin_batch_cases.candidate.cases[0];assert.equal(row.authority_changed,false);
 assert.equal(row.sender_rolled_back,true);assert(!f.calls.some(([port,sql])=>port==='writer'&&sql.includes('with affected')));
});

test('unproven native error, wrong backend exit or lost private custody cannot pass',async()=>{
 for(const options of [{native:true,unprovenNative:true},{native:true,nativeExit:1},{native:true,captureFails:true}]){
  const f=context('candidate',options);await assert.rejects(verifyPinAuthorityCases(f.ctx));
  const evidence=f.ctx.report.pin_batch_cases.candidate;assert.equal(evidence.completed,false);assert.equal(evidence.cases[0].completed,false);
  assert.equal(evidence.cases[0].authority_restored,true);assert.equal(f.senders.length,1);
 }
});

test('unknown result fields stay private and cannot supply a public error code',async()=>{
 const f=context('candidate',{result:{ok:false,code:canary,duration_ms:1,body:canary,url:'https://private.invalid/'+canary}});
 await assert.rejects(verifyPinAuthorityCases(f.ctx));const row=f.ctx.report.pin_batch_cases.candidate.cases[0];
 assert.equal(row.result.code,null);assert(!JSON.stringify(f.ctx.report).includes(canary));assert.deepEqual(f.state,f.original);
});

test('exact preimage and full baseline failures are meaningful acceptance failures',async()=>{
 for(const options of [{badRestore:true},{badBaseline:true}]){
  const f=context('candidate',options);await assert.rejects(verifyPinAuthorityCases(f.ctx));
  const row=f.ctx.report.pin_batch_cases.candidate.cases[0];assert.equal(row.completed,false);
  if(options.badRestore)assert.equal(row.authority_restored,false);else assert.equal(row.full_baseline_restored,undefined);
 }
});

test('matrix/component gates precede SQL and the same variant cannot run twice',async()=>{
 const f=context();f.ctx.report.combined_generation.actual_first_whole_generation_matrix_completed=false;
 await assert.rejects(verifyPinAuthorityCases(f.ctx),/PIN_AUTHORITY_FIRST_MATRIX_REQUIRED/u);assert.equal(f.calls.length,0);
 f.ctx.report.combined_generation.actual_first_whole_generation_matrix_completed=true;
 f.ctx.report.combined_generation.review_and_snapshot_contract_equalities_completed=false;
 await assert.rejects(verifyPinAuthorityCases(f.ctx),/PIN_AUTHORITY_COMPONENTS_REQUIRED/u);assert.equal(f.calls.length,0);
 const good=context();await verifyPinAuthorityCases(good.ctx);const count=good.calls.length;
 await assert.rejects(verifyPinAuthorityCases(good.ctx),/PIN_AUTHORITY_ONCE_PER_VARIANT_REQUIRED/u);assert.equal(good.calls.length,count);
});
