import assert from 'node:assert/strict';
import test from 'node:test';
import {ownedPostgresCommand,closedProfile,observeProfile,PROFILE,REFERENCE,PROFILE_SQL}from './profile.mjs';
import {runCases}from './entry.mjs';

const image=()=>({Config:{Entrypoint:['docker-entrypoint.sh'],Cmd:['postgres','-D','/etc/postgresql']}});
const actual=()=>({observed_at:'2026-11-03T09:30:00+00:00',pid:42,settings:{
 jit:{setting:'off',reset_val:'off',source:'command line'},
 plan_cache_mode:{setting:'auto',reset_val:'auto',source:'default'},
 default_statistics_target:{setting:'100',reset_val:'100',source:'default'}}});

test('owned startup retains the entire default CMD and adds only jit=off',()=>{
 const value=image();assert.deepEqual(ownedPostgresCommand(value),['postgres','-D','/etc/postgresql','-c','jit=off']);
 assert.deepEqual(value,image());
 for(const mutate of[v=>v.Config.Cmd=['postgres'],v=>v.Config.Entrypoint=['other-entrypoint'],v=>v.Config.Cmd.push('-c','jit=on')]){
  const bad=image();mutate(bad);assert.throws(()=>ownedPostgresCommand(bad));
 }
});

test('effective OFF alone cannot pass without inherited OFF and command-line source',()=>{
 assert.deepEqual(closedProfile(actual()),actual());
 for(const mutate of[v=>v.settings.jit.setting='on',v=>v.settings.jit.reset_val='on',v=>v.settings.jit.source='session',
  v=>v.settings.plan_cache_mode.setting='force_generic_plan',v=>v.settings.default_statistics_target.reset_val='200',
  v=>v.private_text='PRIVATE_CANARY',v=>v.settings.jit.private_text='PRIVATE_CANARY']){
  const bad=actual();mutate(bad);assert.throws(()=>closedProfile(bad));
 }
});

test('actual fresh sender and pre-matrix settings are read, pid-bound and closed',async()=>{
 let calls=0;
 const ctx={bindings:{canonicalPlannerProfile:PROFILE,canonicalPlannerReference:REFERENCE},report:{}};
 const session={pid:42,request:async sql=>{calls++;assert.equal(sql,PROFILE_SQL);return[actual()];}};
 await observeProfile(ctx,session,'wf_cml');await observeProfile(ctx,session,'before_matrix');
 assert.equal(calls,2);assert.equal(ctx.report.canonical_planner_profile.backend_observations.length,2);
 assert.deepEqual(ctx.report.canonical_planner_profile.actual_before_matrix,actual());
 const bad={...ctx,bindings:{...ctx.bindings,canonicalPlannerProfile:{...PROFILE,jit:'on'}}};
 await assert.rejects(observeProfile(bad,session,'wf_cml'));assert.equal(calls,2);
 await assert.rejects(observeProfile(ctx,{...session,pid:43},'wf_cml'));
});

test('entry remains disabled before any context or port read',async()=>{
 let reads=0;const ctx=new Proxy({},{get(){reads++;throw Error('PORT_REACHED');}});
 await assert.rejects(runCases(ctx),/CANONICAL_PROFILE_FULL_PROOF_EXECUTION_DISABLED/u);assert.equal(reads,0);
});
