/** Fake ports only. Original matrix/focus checks stay bound to unchanged code. */
import '../presentation-generation-assignment-proof/assignment-cases.test.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyAcquisitionLocks}from './locks.mjs';
import {freshCarry,BEFORE,AFTER}from './admit.mjs';
import {firstPair}from '../presentation-lock-source-uuid-proof/fixture.mjs';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
const BASE='280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4';
const NEW='aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3';

test('fresh helper locks refuse before any query unless first matrix and components passed',async()=>{
 let reads=0;
 const ctx={report:{combined_generation:{}},value:async()=>{reads++;throw new Error('Must not read');}};
 await assert.rejects(verifyAcquisitionLocks(ctx),/ACQUISITION_FIRST_MATRIX_REQUIRED/u);
 ctx.report.combined_generation.actual_first_whole_generation_matrix_completed=true;
 await assert.rejects(verifyAcquisitionLocks(ctx),/ACQUISITION_COMPONENT_EQUALITY_REQUIRED/u);assert.equal(reads,0);
});

test('helper timeout is retained before fail-stop and rollback; no oracle or RC retry',async()=>{
 const calls=[],workspace='00000000-0000-4000-8000-000000000001',authority={same:true};
 const ctx={report:{combined_generation:{actual_first_whole_generation_matrix_completed:true,review_and_snapshot_contract_equalities_completed:true}},
  bindings:{candidateSha:NEW,measureSql:'',oracleSql:''},profiles:{large:{workspace}},sourceBefore:{authority},acting:()=>'',baseline:{same:true},
  value:async()=>({source:NEW,authority}),captureError:async()=>({normal_return:true,private_file:'fake-private-error.json'}),
  start:async tag=>({pid:42,async request(sql){calls.push(sql);
   if(sql.startsWith("select jsonb_build_object('workspace_fenced'"))return[{workspace_fenced:workspace}];
   if(sql.startsWith('select pg_temp.pool_proof_measure('))return[{ok:false,code:'57014',duration_ms:8000}];
   return[];},async finish(){calls.push('finish:'+tag);}})};
 await assert.rejects(verifyAcquisitionLocks(ctx));
 const row=ctx.report.pool_helper_proof.all_twelve;assert.equal(row.helper.code,'57014');assert.equal(row.helper.duration_ms,8000);assert.equal(row.rolled_back,true);assert.equal(row.normal_return,false);
 assert.equal(row.private_error.normal_return,true);assert.equal(row.held,undefined);assert.equal(ctx.report.pool_helper_proof.authority,undefined);
 assert.equal(calls.filter(x=>x.startsWith('select pg_temp.pool_proof_measure(')).length,1);assert(!calls.some(x=>x.includes('complete41_slice(')));
});

test('historical prerequisites never admit changed-helper lock or authority acceptance',()=>{
 const runId='c35b7493-c72c-4e14-9002-de2c726e58e4',pair=firstPair(runId),baseline={tables:{one:{count:1}},ready_versions:13,pins:60,reason_nonnull_rows:1};
 const report={fixture_uuid_qualification:{slot_sha256:sha(pair.slot.id),pool_sha256:sha(pair.pool.id),selection_before_database_or_claim:true,outcome_or_timing_observed:false,source_rows_or_SQL_changed:false,attempt_cap:4096,attempt_count:1,rejected_namespace_count:0}};
 const securityReceipt={pool_helper_proof:{fresh_baseline:baseline}};
 for(const key of['metadata_sha256','migration_sha256','functional_sha256','image_id'])report[key]=securityReceipt[key]='synthetic';
 const ctx={runId,baseline,report,bindings:{baseSha:BASE,candidateSha:NEW,beforeBodies:BEFORE.map(sha=>({sha})),afterBodies:AFTER.map(sha=>({sha}))}};
 const result=freshCarry(ctx,{securityReceipt,evidence:{dated_only:true}});
 assert.equal(result.helper280_scopes_dated_only,true);assert.equal(result.changed_helper_lock_or_security_carried,false);assert.equal(result.all_twelve_locksets_and_RC_security_required_fresh,true);
 for(const edit of[x=>{x.bindings.candidateSha=BASE;},x=>{x.bindings.beforeBodies=x.bindings.afterBodies;},x=>{x.report.fixture_uuid_qualification.outcome_or_timing_observed=true;}]){
  const bad=JSON.parse(JSON.stringify(ctx));edit(bad);assert.throws(()=>freshCarry(bad,{securityReceipt,evidence:{}}));
 }
});
