/** Fake sessions exercise the actual frozen cleanup mask; no SQL/Docker/I/O. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { preserveFirstOwnedError } from './capture.mjs';
import { verifyHeld } from '../presentation-lock-source-proof/probes.mjs';

const uuid='00000000-0000-4000-8000-000000000001';
function fixture(){
 const primary=Object.assign(Error('LOCKSOURCE41_SESSION_FAILED'),{diagnostic:{stdout:'PRIVATE_STDOUT_CANARY',stderr:'ERROR: 57014: PRIVATE_STDERR_CANARY'}});
 const holder={pid:11,async request(text){
  if(text.includes("select pg_temp.locksource41_measure('locks'"))return [{ok:true,duration_ms:1}];
  if(text.includes('select pg_temp.locksource41_cohorts('))throw primary;
  if(text==='rollback;')throw Error('SYNTHETIC_ENDED_SESSION');
  return [];
 }};
 const contender={pid:12,async request(){return [];}};
 return{primary,holder,contender,context:{holder,contender,workspace:uuid,series:uuid,variant:'old',acting:()=>'',id:()=>uuid}};
}

test('RED witness: frozen verifyHeld cleanup masks original native error',async()=>{
 const value=fixture();
 await assert.rejects(verifyHeld(value.context),error=>error!==value.primary&&error.message==='LOCKSOURCE41_PROBE_ROLLBACK_UNCONFIRMED');
});

test('GREEN: first native diagnostic is privately retained before same cleanup mask',async()=>{
 const value=fixture(),privateRecords=[],report={};
 const array=preserveFirstOwnedError([],async record=>privateRecords.push(record),report);
 array.push(value.holder,value.contender);
 await assert.rejects(verifyHeld(value.context),{message:'LOCKSOURCE41_PROBE_ROLLBACK_UNCONFIRMED'});
 assert.equal(privateRecords.length,1);assert.equal(privateRecords[0].stdout,'PRIVATE_STDOUT_CANARY');assert.equal(privateRecords[0].stderr,'ERROR: 57014: PRIVATE_STDERR_CANARY');
 assert.equal(report.first_native_error_capture.phase,'source_cohort_read');assert.equal(report.first_native_error_capture.native_sqlstate,'57014');assert.equal(report.first_native_error_capture.private_capture_normal_return,true);
 const publicText=JSON.stringify(report);assert(!publicText.includes('PRIVATE_'));assert(!publicText.includes('stdout'));assert(!publicText.includes('stderr'));
});

test('original rejection identity and one capture survive sink failure',async()=>{
 const original=Error('ORIGINAL'),report={};let attempts=0;
 const target={async request(){throw original;}};
 preserveFirstOwnedError([],async()=>{attempts++;throw Error('PRIVATE_SINK_FAILED');},report).push(target);
 for(let i=0;i<2;i++)await assert.rejects(target.request('select 1;'),error=>error===original);
 assert.equal(attempts,1);assert.equal(report.first_native_error_capture.private_capture_failed,true);assert.equal(report.first_native_error_capture.private_capture_normal_return,false);
});

test('no native SQLSTATE is inferred from non-verbose error words or public payload',async()=>{
 const report={},target={async request(){throw Object.assign(Error('LOCKSOURCE41_SESSION_FAILED'),{diagnostic:{stderr:'ERROR: permission denied for PRIVATE_RELATION'}});}};
 preserveFirstOwnedError([],async()=>{},report).push(target);
 await assert.rejects(target.request('select 1;'));
 assert.equal(report.first_native_error_capture.native_sqlstate,null);assert(!JSON.stringify(report).includes('PRIVATE_RELATION'));
});

test('Node EPIPE cannot become a native SQLSTATE',async()=>{
 const report={},target={async request(){throw Object.assign(Error('transport'),{code:'EPIPE'});}};
 preserveFirstOwnedError([],async()=>{},report).push(target);
 await assert.rejects(target.request('select 1;'));
 assert.equal(report.first_native_error_capture.native_sqlstate,null);assert.equal(report.first_native_error_capture.native_sqlstate_provenance,null);
});

test('later private text resembling an ERROR cannot replace a nonverbose first ERROR',async()=>{
 const report={},target={async request(){throw Object.assign(Error('LOCKSOURCE41_SESSION_FAILED'),{diagnostic:{stderr:'ERROR: permission denied\nDETAIL: PRIVATE_ROW\nERROR: 22P02: PRIVATE_ROW_TEXT'}});}};
 preserveFirstOwnedError([],async()=>{},report).push(target);
 await assert.rejects(target.request('select 1;'));
 assert.equal(report.first_native_error_capture.native_sqlstate,null);assert(!JSON.stringify(report).includes('PRIVATE_ROW'));
});
