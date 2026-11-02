/** Fake transport and immutable receipt admission only. No SQL/Docker/provider. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile}from 'node:fs/promises';
import {Buffer}from 'node:buffer';
import path from 'node:path';
import {URL}from 'node:url';
import {edgeCounterfactual}from './edge.mjs';
import {admitCarry,validateCarry,freshCarry,CARRY_PATH,CARRY_SHA}from './admit.mjs';
import {sha}from '../presentation-lock-source-proof/proof.mjs';
const MAIN='D:/Everyone/Presentation/Everyone-Presentation-Studio';
const ROOT=path.resolve(new URL('../../..',import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/u,''));
const clone=value=>JSON.parse(JSON.stringify(value));
async function retained(){const raw=await readFile(path.join(MAIN,CARRY_PATH));assert.equal(sha(raw),CARRY_SHA);return JSON.parse(raw);}

test('actual retained393 is a dated partial carry; altered incomplete evidence never becomes full PASS',async()=>{
 const r=await retained(),proof=validateCarry(r);assert.equal(proof.held_selected_rows,150);assert.equal(proof.carried_RR_cases.length,3);assert.equal(proof.whole_generation_or_four_body_acceptance,false);
 for(const mutate of[
  r=>r.result='passed',r=>r.pool_helper_proof.semantic[0].held.relations[10].held_rows--,
  r=>r.pool_helper_proof.semantic[2].rolled_back=false,r=>r.pool_helper_proof.semantic[3].selected_asset_still_held.locked=true,
  r=>r.shared_lock_released=false,r=>r.pool_helper_proof.installations[0].actual_source_sha256='changed',
 ]){const copy=clone(r);mutate(copy);assert.throws(()=>validateCarry(copy));}
});

test('all88 retained source/artifact bytes are read-only checked, only old flag literal normalized',async()=>{
 const reader=async file=>{
  const relative=path.relative(MAIN,file);let local=path.join(ROOT,relative);
  try{return await readFile(local);}catch(error){if(error.code!=='ENOENT')throw error;return readFile(file);}
 };
 const admitted=await admitCarry(MAIN,reader);assert.equal(admitted.evidence.fresh_oracle_or_benchmark_replay,false);
 await assert.rejects(admitCarry(MAIN,async file=>{const raw=await reader(file);return file.replaceAll('\\','/').endsWith('presentation-lock-source-complete-oracle-proof/entry.mjs')?Buffer.from(raw.toString().replace('No old controller','Changed old controller')):raw;}));
 await assert.rejects(admitCarry(MAIN,async file=>file.endsWith('candidate.py')?Buffer.from('drift'):reader(file)));
 const r=admitted.receipt,baseline=clone(r.pool_helper_proof.fresh_baseline);
 const ctx={report:r,baseline,bindings:{candidateSha:admitted.evidence.helper_sha256,beforeBodies:[1],afterBodies:[1]}};
 assert.equal(freshCarry(ctx,admitted).cross_run_business_hash_equality_claimed,false);
 baseline.tables['eps.media_assets'].count--;assert.throws(()=>freshCarry(ctx,admitted));
});

function fake({wrongDeletedVisibility=false,failBranch=false}={}){
 const baseline={synthetic:true},requests=[],sessions=[];let counter=0,state='visible',variant='old',inHolder=false;
 const ctx={report:{pool_helper_proof:{}},profiles:{large:{workspace:'00000000-0000-4000-8000-000000000001'}},id:label=>label==='frame-4'?'00000000-0000-4000-8000-000000000004':'00000000-0000-4000-8000-000000000002',acting:mode=>'/*ACTING_'+mode+'*/set role eps_review_owner;',baseline,
  value:async()=>baseline,captureError:async()=>({normal_return:true,private_file:'closed-error.json'}),
  startPrepared:async tag=>{
   const holder=tag==='edge_h';const s={pid:++counter,done:Promise.resolve(0),finish:async()=>{s.finished=true;},request:async sql=>{
    requests.push({holder,sql});
    if(sql.startsWith('begin isolation')){state='visible';inHolder=false;return[];}
    if(sql.startsWith('delete from')){state='own_pair_deleted';return[{deleted:true}];}
    if(sql.includes("'fenced'"))return[{fenced:ctx.profiles.large.workspace}];
    if(sql.includes("'asset_exists'"))return[{asset_exists:true,selected_frame_unchanged:true,pair_exists:state==='visible'}];
    if(sql.includes("'asset_visible'")){const visible=!holder||state==='visible'||wrongDeletedVisibility;return[{asset_visible:visible,pair_visible:!holder||state==='visible',role:'eps_review_owner'}];}
    if(sql.includes('select pg_temp.edge41_')){if(failBranch)throw Object.assign(new Error('PRIVATE_SQL'),{diagnostic:{stderr:'PRIVATE'}});variant=sql.includes('edge41_old')?'old':'new';inHolder=true;return[{found:state==='visible',source_ids_include_target:variant==='new'?true:null,role:'eps_review_owner',statement_timeout:'8s',lock_timeout:'8s'}];}
    if(sql.includes('locksource41_probe('))return[inHolder&&state==='visible'?{found:true,locked:true,code:'55P03'}:{found:true,locked:false}];
    return[];
   }};sessions.push(s);return s;
  }};
 return{ctx,requests,sessions};
}

test('same-holder DELETE controls oldWHERE/newIDs; committed contender remains visible and each transaction restores',async()=>{
 const f=fake();await edgeCounterfactual(f.ctx);const rows=f.ctx.report.pool_helper_proof.edge_rls;
 assert.equal(rows.length,4);assert(rows.every(x=>x.normal_return&&x.rolled_back&&x.full_baseline_restored));
 assert.deepEqual(rows.map(x=>[x.variant,x.state,x.branch.found]),[['old','visible',true],['old','own_pair_deleted',false],['new','visible',true],['new','own_pair_deleted',false]]);
 assert.equal(f.requests.filter(x=>x.sql.startsWith('delete from')).length,2);
 assert(f.sessions.every(x=>x.finished));assert(!JSON.stringify(rows).includes('PRIVATE'));
});

test('disputed edge visibility mismatch retains both branch/probe controls before failing; no assertion flip',async()=>{
 const f=fake({wrongDeletedVisibility:true});await assert.rejects(edgeCounterfactual(f.ctx));
 const row=f.ctx.report.pool_helper_proof.edge_rls.at(-1);assert.equal(row.state,'own_pair_deleted');assert(row.branch&&row.after);assert.equal(row.normal_return,false);assert.equal(row.rolled_back,true);
 assert.equal(f.ctx.report.pool_helper_proof.edge_rls_counterfactual_completed,undefined);assert(f.sessions.every(x=>x.finished));
});

test('first actual-transport error is privately captured before cleanup; public evidence contains no raw diagnostics',async()=>{
 const f=fake({failBranch:true});const sequence=[];f.ctx.captureError=async()=>{sequence.push('capture');return{normal_return:true,private_file:'closed-error.json'};};
 await assert.rejects(edgeCounterfactual(f.ctx),{message:'PRIVATE_SQL'});assert.deepEqual(sequence,['capture']);
 const row=f.ctx.report.pool_helper_proof.edge_rls[0];assert.equal(row.branch_dispatch_started,true);assert.equal(row.rolled_back,true);assert(!JSON.stringify(row).includes('PRIVATE_SQL'));assert(!JSON.stringify(row).includes('PRIVATE'));
});
