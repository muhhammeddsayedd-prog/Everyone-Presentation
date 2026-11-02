/** Fake-port state-machine tests only. No process, database or provider calls. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { firstAndWarm,heldCohorts } from './cases.mjs';
import { nativeError } from './native.mjs';
import { acting } from '../presentation-lock-source-proof/proof.mjs';

const UUID='00000000-0000-4000-8000-000000000001';
function fixture(failing=null,sqlstate='57014',duration=1){
 let pid=20,current;const events=[],captured=[],instances=[];
 const primary=Object.assign(Error('LOCKSOURCE41_SESSION_FAILED'),{diagnostic:{stdout:'PRIVATE_STDOUT',stderr:'ERROR: '+sqlstate+': PRIVATE_STDERR'}});
 const ctx={profiles:{large:{workspace:UUID}},acting,report:{pool_helper_proof:{}},
  async installHelper(variant){current=variant;events.push({kind:'install',variant});},
  async captureError(name,error){assert.equal(error,primary);captured.push(name);return{private_file:'synthetic',normal_return:true};},
  async startPrepared(tag){
   let calls=0,ended=false;const value={pid:++pid,tag,variant:current,requests:[],done:Promise.resolve(3),async finish(){events.push({kind:'finish',tag});},async request(text){
    this.requests.push(text);
    if(ended)throw Error('ENDED_SESSION');
    if(text.includes('select pg_temp.pool_proof_measure(')){
     calls++;events.push({kind:calls===1?'first':'warm',tag,variant:this.variant,index:calls});
     if(tag===failing&&calls===1){ended=true;throw primary;}
     return[{ok:true,duration_ms:duration,role:'eps_review_owner'}];
    }
    if(text.includes("jsonb_build_object('workspace_fenced'"))return[{workspace_fenced:UUID}];
    return[];
   }};instances.push(value);return value;
  }};
 return{ctx,events,captured,instances,primary};
}

test('all8 fresh first calls precede every warm; each new backend gets only2warm calls',async()=>{
 const f=fixture();await firstAndWarm(f.ctx);
 const measured=f.events.filter(row=>['first','warm'].includes(row.kind));
 assert.deepEqual(measured.map(row=>row.kind),[...Array(8).fill('first'),...Array(8).fill('warm')]);
 assert.equal(new Set(f.ctx.report.pool_helper_proof.cold.map(row=>row.pid)).size,8);
 assert.equal(f.ctx.report.pool_helper_proof.cold.every(row=>row.helper_calls_before_dispatch===0),true);
 assert.equal(f.ctx.report.pool_helper_proof.warm.every(row=>row.variant==='new'),true);
 for(const instance of f.instances.filter(row=>row.variant==='new'))assert.equal(measured.filter(row=>row.tag===instance.tag).length,3);
 const fenced=f.instances.filter(row=>row.tag.endsWith('_f'));
 for(const instance of fenced){assert(instance.requests.findIndex(text=>text.includes('workspace_fenced'))<instance.requests.findIndex(text=>text.includes('pool_proof_measure')));}
});

test('new first failure retains result/code and stops before every scheduled warm',async()=>{
 const f=fixture('n_m_s');await assert.rejects(firstAndWarm(f.ctx),error=>error===f.primary);
 assert.equal(f.ctx.report.pool_helper_proof.cold.at(-1).error.sqlstate,'57014');assert.equal(f.ctx.report.pool_helper_proof.warm.length,0);
 assert(Number.isFinite(f.ctx.report.pool_helper_proof.cold.at(-1).client_elapsed_ms));
 assert.equal(f.events.some(row=>row.kind==='warm'),false);assert.equal(f.captured.length,1);
});

test('only observed baseline57014 may be retained; its failed backend is never warmed',async()=>{
 const f=fixture('o_m_s');await firstAndWarm(f.ctx);
 const old=f.ctx.report.pool_helper_proof.cold.find(row=>row.case_id==='old_mcp_standalone');
 assert.equal(old.normal_return,false);assert.equal(old.baseline_cancellation_retained,true);assert.equal(old.backend_exit,3);
 assert.equal(f.events.some(row=>row.kind==='warm'&&row.tag==='o_m_s'),false);
});

test('unknown baseline SQL failure stops rather than advancing to new body',async()=>{
 const f=fixture('o_a_s','42703');await assert.rejects(firstAndWarm(f.ctx),error=>error===f.primary);
 assert.equal(f.ctx.report.pool_helper_proof.cold[0].error.sqlstate,'42703');assert.equal(f.events.some(row=>row.kind==='install'&&row.variant==='new'),false);assert.equal(f.ctx.report.pool_helper_proof.warm.length,0);
});

test('a lost private baseline error capture stops without treating cancellation as admitted',async()=>{
 const f=fixture('o_a_s');f.ctx.captureError=async()=>({normal_return:false,private_capture_failed:true});
 await assert.rejects(firstAndWarm(f.ctx),error=>error===f.primary);
 assert.equal(f.ctx.report.pool_helper_proof.cold[0].private_error.normal_return,false);assert.equal(f.events.some(row=>row.kind==='install'&&row.variant==='new'),false);
});

test('slow successful response is retained before threshold assertion; no warm escape',async()=>{
 const f=fixture(null,'57014',8000);f.ctx.captureError=async()=>({normal_return:true});await assert.rejects(firstAndWarm(f.ctx));
 assert.equal(f.ctx.report.pool_helper_proof.cold[0].response.duration_ms,8000);assert.equal(f.ctx.report.pool_helper_proof.cold[0].normal_return,true);assert.equal(f.ctx.report.pool_helper_proof.warm.length,0);
 assert(Number.isFinite(f.ctx.report.pool_helper_proof.cold[0].client_elapsed_ms));
});

test('oracle failure leaves recorded timings intact and remains unconfirmed',async()=>{
 const primary=Object.assign(Error('LOCKSOURCE41_SESSION_FAILED'),{diagnostic:{stderr:'ERROR: 57014: PRIVATE_QUERY'}}),record={},timing={cold:[{duration_ms:1}],warm:[]};
 const oracle={pid:2,async request(text){if(text.includes('pool_proof_cohort'))throw primary;return[];},async finish(){}};
 const contender={pid:3,async request(){return[];},async finish(){}};
 const ctx={profiles:{large:{workspace:UUID,series:UUID}},acting,report:{pool_helper_proof:timing},async captureError(){return{normal_return:true};},async startPrepared(tag){return tag==='oracle'?oracle:contender;}};
 await assert.rejects(heldCohorts(ctx,{pid:1},record),error=>error===primary);
 assert.deepEqual(timing,{cold:[{duration_ms:1}],warm:[]});assert.equal(record.completed,undefined);assert.equal(record.relations[0].normal_return,false);
});

test('only first verbose PostgreSQL ERROR supplies public code; Node EPIPE/privatewords do not',()=>{
 assert.deepEqual(nativeError(Object.assign(Error('x'),{code:'EPIPE'})),{sqlstate:null,provenance:null,application_code:null});
 assert.equal(nativeError({diagnostic:{stderr:'ERROR: denied\nDETAIL: ERROR: 57014: PRIVATE'}}).sqlstate,null);
 const value=nativeError({diagnostic:{stderr:'ERROR: P0001: RESOURCE_NOT_FOUND\nDETAIL: PRIVATE'}});assert.equal(value.application_code,'RESOURCE_NOT_FOUND');assert(!JSON.stringify(value).includes('PRIVATE'));
});
