/** Synthetic fake-session regressions only; no SQL or provider execution. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {legacyCloneSQL,verifyRawAuthorityCases} from './raw-authority.mjs';

const ACTOR='a4410000-0000-4000-8000-000000000001';
const profile={project:'00000000-0000-4000-8000-000000000001',workspace:'00000000-0000-4000-8000-000000000002',series:'00000000-0000-4000-8000-000000000003'};
const privateCanary='PRIVATE_SYNTHETIC_AUTHORITY_ROW';
const clone=value=>JSON.parse(JSON.stringify(value));
const cases=[['valid_one',null,false],['valid_zero',null,true],['membership','membership',false],['capability','capability',false],['expiry','expiry',false],['empty_expiry','expiry',true]];

function context(variant='candidate',options={}){
 const calls=[],senders=[],baseline={synthetic:'same'};
 const original={membership:{project_id:profile.project,principal_id:ACTOR,active:true,private_note:privateCanary},capability:{principal_id:ACTOR,capability:'presentations.generate',active:true,private_note:privateCanary}};
 const state=clone(original);let current,barrier=false,pid=20;
 const fail=(code='IMMUTABLE_VERSION',sqlstate='P0001')=>{
  current.exit(options.nativeExit??3);current.reject(Object.assign(new Error('native private failure'),{diagnostic:{stderr:'ERROR:  '+sqlstate+':  '+code+'\nDETAIL: '+privateCanary}}));current.resolve=undefined;
 };
 const release=()=>{
  if(!current?.resolve)return;
  if(options.unreadableMedia&&current.name==='valid_one'){fail('SNAPSHOT_INVALID');return;}
  if(options.timeout&&current.change!==null){fail('statement timeout','57014');return;}
  const normal=current.change===null||(current.empty&&variant==='old')||(current.empty&&options.omitNewFence);
  if(normal){current.resolve([options.extraResult?{captured:current.empty?0:1,body:privateCanary}:{captured:current.empty?0:1}]);current.resolve=undefined;}
  else if(current.empty)fail();else fail('new row violates row-level security policy','42501');
 };
 const holder={pid:10,async request(sql){calls.push(['holder',sql]);
  if(sql.includes('lock table ')){
   assert(current.clonePrepared);barrier=true;
   assert(sql.includes(current.empty?'eps.presentation_version_assets in access exclusive mode':'eps.presentation_video_transcripts in share mode'));
  }
  if(sql.startsWith('rollback;')){barrier=false;release();}return[];
 }};
 const writer={pid:11,async request(sql){calls.push(['writer',sql]);
  if(sql.includes('with affected as(')){
   assert(barrier&&current.waitObserved);
   if(sql.includes('delete from public.project_memberships'))state.membership=null;else state.capability.active=false;
   return[{changed_rows:1}];
  }
  if(sql.includes('jsonb_populate_record')){
   const name=sql.includes('null::public.project_memberships')?'membership':'capability';assert(sql.includes(privateCanary));state[name]=clone(original[name]);
   if(options.badRestore)state[name].private_note='changed';
  }return[];
 }};
 const observer={pid:12,async request(sql){calls.push(['observer',sql]);
  if(sql.includes("'epoch'")){current.clocks++;return[{epoch:current.clocks===1?1000:1005}];}
  if(sql.includes("'raw_insert_lock'"))return[{raw_insert_lock:current.dispatched&&current.empty&&options.emptyInsert===true,pin_lock_count:current.empty&&!current.dispatched?(options.priorPinRead?1:0):1}];
  if(sql.includes("'waiting'")){
   assert(sql.includes(current.empty?"mode='AccessShareLock'":"mode='RowExclusiveLock'"));
   const waiting=!options.noWait&&barrier&&Boolean(current.resolve);current.waitObserved=waiting;return[{waiting}];
  }return[];
 }};
 const ctx={variant,holder,writer,observer,profiles:{control:profile},runId:'00000000-0000-4000-8000-000000000004',
  report:{combined_generation:{actual_first_whole_generation_matrix_completed:true,review_and_snapshot_contract_equalities_completed:true}},baseline,
  id:label=>{const v=createHash('md5').update(label).digest('hex');return[v.slice(0,8),v.slice(8,12),v.slice(12,16),v.slice(16,20),v.slice(20)].join('-');},
  acting:(mode,role,actor,override)=>{assert.equal(mode,'mcp');assert.equal(role,'eps_review_owner');assert.equal(actor,ACTOR);current.override=override;return '/* original controlled MCP claims */';},
  value:async sql=>{calls.push(['value',sql]);if(sql==='select locksource41_proof.row_hashes();')return options.badBaseline?{changed:true}:baseline;return clone(sql.includes('public.project_memberships')?state.membership:state.capability);},
  captureError:async()=>({normal_return:!options.captureFails,private_file:'fake-private-error.json'}),
  startFreshGeneration:async()=>{
   const [name,change,empty]=cases[senders.length];let exit;const done=new Promise(resolve=>{exit=resolve;});
   const s={pid:pid++,name,change,empty,done,exit,clocks:0,dispatched:false,dispatches:0,clonePrepared:false,
    async request(sql){calls.push(['sender',sql]);
     if(sql.includes('do $raw_owned$')){
      assert(sql.includes("'status','queued','english_transcript_version',null"));assert(!sql.includes('update eps.presentation_versions'));
      if(empty){assert(!sql.includes('eps.presentation_version_assets'));assert(!sql.includes('eps.version_slides'));}
      s.clonePrepared=true;return[{version:ctx.id('rawauth-version-'+variant+'-'+name),queued:true,legacy_null_English:true,controlled_owner:true,control_scope:true,source_ready_sha256:'a'.repeat(64)}];
     }
     if(sql.startsWith('select jsonb_build_object(\'captured\'')){
      s.dispatched=true;s.dispatches++;const promise=new Promise((resolve,reject)=>{s.resolve=resolve;s.reject=reject;});
      if(options.noWait){s.resolve([{captured:0}]);s.resolve=undefined;}return promise;
     }
     if(sql.includes("'raw_count'"))return[{raw_count:empty?0:1,english_count:0,capture_context_empty:true}];
     if(sql.startsWith('rollback;'))s.rollback=true;
     return[];
    },async finish(){s.finished=true;s.exit(0);}};
   current=s;senders.push(s);return s;
  }};
 return{ctx,calls,senders,state,original};
}

test('typed queued clone remaps only new metadata; empty setup never accesses pins or slides',()=>{
 const f=context(),one=legacyCloneSQL(f.ctx,'valid_one',false),zero=legacyCloneSQL(f.ctx,'valid_zero',true);
 assert(one.includes('insert into eps.presentation_version_assets'));assert(one.includes('insert into eps.version_slides'));
 for(const sql of [one,zero]){
  assert(sql.includes("'status','queued','english_transcript_version',null"));
  assert(sql.includes("'manifest_asset_id',null,'pdf_asset_id',null,'ready_at',null,'failure_code',null"));
  assert(!/\b(?:grant|commit|update|delete)\b/iu.test(sql));assert(sql.includes("status='ready'"));
 }
 assert(!zero.includes('eps.presentation_version_assets'));assert(!zero.includes('eps.version_slides'));
});

test('real-flow fake ports require valid one/zero controls before native revoke and expiry cases',async()=>{
 for(const variant of ['old','candidate']){
  const f=context(variant);await verifyRawAuthorityCases(f.ctx);const evidence=f.ctx.report.raw_authority_cases[variant];
  assert.equal(evidence.completed,true);assert.equal(evidence.cases.length,6);
  assert(evidence.cases.slice(0,2).every(row=>row.valid_direct_control_passed));
  assert(evidence.cases.every(row=>row.completed&&row.rolled_back&&row.full_baseline_restored));
  assert(f.senders.every(s=>s.dispatches===1&&s.finished));assert.equal(new Set(f.senders.map(s=>s.pid)).size,6);assert.deepEqual(f.state,f.original);
  const empty=evidence.cases[5];assert.equal(empty.database_clock_expired,true);assert.equal(f.senders[5].override.exp,1004);
  assert.equal(empty.during_wait.raw_insert_lock,false);assert.equal(empty.wait_mode,'AccessShareLock');
  if(variant==='old'){assert.equal(empty.result.captured,0);assert.equal(empty.old_empty_expiry_return_retained,true);assert.equal(empty.authorization_acceptance_claimed,false);}
  else{assert.equal(empty.denial_code,'IMMUTABLE_VERSION');assert.equal(empty.backend_exit,3);assert.equal(empty.fresh_authority_denial_observed,true);}
  assert(!JSON.stringify(evidence).includes(privateCanary));
 }
});

test('unreadable control source fails before any authority mutation instead of forcing grants/origins',async()=>{
 const f=context('candidate',{unreadableMedia:true});await assert.rejects(verifyRawAuthorityCases(f.ctx));
 assert.equal(f.senders.length,1);assert(!f.calls.some(([port])=>port==='writer'));assert.deepEqual(f.state,f.original);
});

test('candidate returning zero after empty expiry is rejected as the missing fresh-fence regression',async()=>{
 const f=context('candidate',{omitNewFence:true});await assert.rejects(verifyRawAuthorityCases(f.ctx),/RAW_AUTHORITY_FRESH_DENIAL_REQUIRED/u);
 const evidence=f.ctx.report.raw_authority_cases.candidate;assert.equal(evidence.cases[5].result.captured,0);assert.equal(evidence.completed,false);
});

test('empty path cannot retain prior pin locks or acquire a raw INSERT lock',async()=>{
 for(const options of [{priorPinRead:true},{emptyInsert:true}]){
  const f=context('candidate',options);await assert.rejects(verifyRawAuthorityCases(f.ctx));
  assert.equal(f.ctx.report.raw_authority_cases.candidate.completed,false);assert.equal(f.senders.length,2);
 }
});

test('no observed wait, timeout, wrong exit or lost private custody never counts as fresh denial',async()=>{
 for(const options of [{noWait:true},{timeout:true},{nativeExit:1},{captureFails:true}]){
  const f=context('candidate',options);await assert.rejects(verifyRawAuthorityCases(f.ctx));
  assert.equal(f.ctx.report.raw_authority_cases.candidate.completed,false);assert.deepEqual(f.state,f.original);
 }
});

test('malformed result cannot publish arbitrary fields or bypass a positive control',async()=>{
 const f=context('candidate',{extraResult:true});await assert.rejects(verifyRawAuthorityCases(f.ctx));
 assert(!JSON.stringify(f.ctx.report).includes(privateCanary));assert.equal(f.senders.length,1);
});

test('exact authority restoration and baseline preservation remain required',async()=>{
 for(const options of [{badRestore:true},{badBaseline:true}]){
  const f=context('candidate',options);await assert.rejects(verifyRawAuthorityCases(f.ctx));assert.equal(f.ctx.report.raw_authority_cases.candidate.completed,false);
 }
});

test('matrix gates and once-per-variant check prevent unintended dispatch',async()=>{
 const f=context();f.ctx.report.combined_generation.actual_first_whole_generation_matrix_completed=false;
 await assert.rejects(verifyRawAuthorityCases(f.ctx));assert.equal(f.senders.length,0);
 const good=context();await verifyRawAuthorityCases(good.ctx);await assert.rejects(verifyRawAuthorityCases(good.ctx),/RAW_AUTHORITY_ONCE_PER_VARIANT_REQUIRED/u);assert.equal(good.senders.length,6);
});
