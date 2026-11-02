/** Pure fake sessions: complete domains, clock denial, snapshots and boundaries. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {RELATIONS,EXPECTED_COUNTS,FIELDS,keys,partition,keyId,hash,admitResult}from './keys.mjs';
import {prepareOracle,readOracle}from './oracle.mjs';
import {semanticTuples}from './semantic.mjs';
const uuid=n=>'00000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
function domains(){
 const all=Object.fromEntries(RELATIONS.map((r,i)=>[r,Array.from({length:EXPECTED_COUNTS[r]},(_,j)=>({id:uuid(i*10000+j+1)}))]));
 all['eps.presentation_templates']=[{key:'a:b',version:'c'},{key:'a',version:'b:c'}];
 all['eps.candidate_media_frames']=Array.from({length:328},(_,i)=>({candidate_media_id:uuid(91+i),asset_id:uuid(1000+i)}));return all;
}
function fixture(options={}){
 const all=domains(),counts={},requests=[],record={},error=Error('SYNTHETIC_CURRENT_SCOPE_DENIED');let role='postgres',claims='a'.repeat(64),liveCalls=0;
 const id=()=>({pid:77,snapshot:'10:20:',role,isolation:'repeatable read',read_only:'on',statement_timeout:'8s',lock_timeout:'8s',claims_sha256:claims});
 const session={pid:77,async request(text){
  requests.push(text);if(text.includes('ACT_AS_MCP')){role='eps_review_owner';claims='b'.repeat(64);}
  if(text==='select pg_temp.complete41_universe();')return[{identity:id(),universes:Object.fromEntries(RELATIONS.map(r=>[r,{keys:all[r],rows:all[r].length,pk_valid:options.badPK!==r}]))}];
  if(text==='select pg_temp.complete41_identity();')return[id()];
  if(text.startsWith('select pg_temp.complete41_live(')){liveCalls++;if(liveCalls===options.failLive)throw error;return[id()];}
  if(text.startsWith('select pg_temp.complete41_slice(')){
   const relation=/slice\('([^']+)'/u.exec(text)[1],i=counts[relation]??0;counts[relation]=i+1;
   if(options.failSlice===i&&options.failRelation===relation)throw error;
   const response=options.crossPair&&relation==='eps.candidate_media_frames'?[{candidate_media_id:uuid(91),asset_id:uuid(1001)}]:options.emptyTail&&i>0?[]:[all[relation][i]];
   const identity=id();if(options.snapshotDrift&&i===1)identity.snapshot='10:21:';
   return[{identity,keys:response}];
  }
  return[];
 }};
 const ctx={runId:uuid(900),profiles:{large:{workspace:uuid(901),series:uuid(902)}},bindings:{completeOracleSql:'INSTALL_TMP'},baseline:{tables:Object.fromEntries(RELATIONS.map(r=>[r,{count:all[r].length}]))},acting:()=> 'ACT_AS_MCP;'};
 return{ctx,session,record,all,counts,requests,error};
}
test('all12 exhaustive single-key domains preserve server order, TEXT tuples and exact pairs',async()=>{
 const f=fixture();await prepareOracle(f.ctx,f.session,f.record);
 for(const r of RELATIONS)assert.deepEqual(await readOracle(f.ctx,f.session,r,f.record),f.all[r]);
 assert.equal(f.record.complete_oracle.total_keys,Object.values(f.all).reduce((n,v)=>n+v.length,0));
 assert.equal(f.record.complete_oracle.total_keys,1637);
 assert.equal(f.record.complete_oracle.relations.every(r=>r.completed&&r.chunks.length===r.universe_rows),true);
 assert.notEqual(keyId('eps.presentation_templates',f.all['eps.presentation_templates'][0]),keyId('eps.presentation_templates',f.all['eps.presentation_templates'][1]));
 assert(!JSON.stringify(f.record).includes('a:b'));assert(!JSON.stringify(f.record).includes('10:20:'));
 for(const r of RELATIONS)assert.equal(f.counts[r]??0,f.all[r].length);
});
test('PK catalog mismatch fails before acting-user membership dispatch',async()=>{
 const f=fixture({badPK:'eps.slots'});await assert.rejects(prepareOracle(f.ctx,f.session,f.record),/ACTUAL_PK_SHAPE_CHANGED/u);assert.equal(Object.keys(f.counts).length,0);
});
test('pair cross-product or any result outside its exact one-key slice fails closed',async()=>{
 const f=fixture({crossPair:true});await prepareOracle(f.ctx,f.session,f.record);await assert.rejects(readOracle(f.ctx,f.session,'eps.candidate_media_frames',f.record),/OUTSIDE_PARTITION/u);assert.equal(f.record.complete_oracle.relations[0].completed,false);
});
test('snapshot drift after an earlier normal point query cannot complete a relation',async()=>{
 const f=fixture({snapshotDrift:true});await prepareOracle(f.ctx,f.session,f.record);await assert.rejects(readOracle(f.ctx,f.session,'eps.presentation_templates',f.record),/SNAPSHOT_CHANGED/u);
 const progress=f.record.complete_oracle.relations[0];assert.equal(progress.chunks[0].normal_return,true);assert.equal(progress.completed,false);
});
test('expiry during empty tail still rejects after earlier selected rows',async()=>{
 const f=fixture({emptyTail:true,failRelation:'eps.roles',failSlice:2});await prepareOracle(f.ctx,f.session,f.record);
 await assert.rejects(readOracle(f.ctx,f.session,'eps.roles',f.record),e=>e===f.error);
 const p=f.record.complete_oracle.relations[0];assert.equal(p.chunks[0].selected_rows,1);assert.equal(p.chunks[1].selected_rows,0);assert.equal(p.chunks[2].normal_return,false);assert(Number.isFinite(p.chunks[2].client_elapsed_ms));assert.equal(p.completed,false);
});
test('final live-scope check is required even for zero-key/zero-selected relation',async()=>{
 const f=fixture({failLive:3});await prepareOracle(f.ctx,f.session,f.record);await assert.rejects(readOracle(f.ctx,f.session,'public.clients',f.record),e=>e===f.error);
 assert.equal(f.record.complete_oracle.relations[0].chunks.length,0);assert.equal(f.record.complete_oracle.relations[0].completed,false);
});
test('every closed PK shape rejects duplicates/extra fields and partitions exhaustively',()=>{
 for(const r of RELATIONS){const all=domains()[r];assert.deepEqual(partition(r,all).flat(),all);if(all.length)assert.throws(()=>keys(r,[all[0],all[0]]),/DUPLICATE_KEY/u);assert.throws(()=>keys(r,[{...all[0],unexpected:'x'}]),/KEY_SHAPE/u);}
 assert.throws(()=>admitResult('eps.media_assets',[{id:uuid(2)}],[{id:uuid(1)}],[],new Set()),/OUTSIDE_PARTITION/u);assert.equal(Object.keys(FIELDS).length,12);
 const text=[{key:'\u{10000}',version:''},{key:'\ue000',version:'1'}];assert.deepEqual(partition('eps.presentation_templates',text).flat(),text);
});
test('semantic holder complete pool universe, original tuples, unchanged claim and RR-only boundary',async()=>{
 const pool=[{id:uuid(1)},{id:uuid(2)}],row={id:uuid(1),candidate_id:uuid(3),selected_candidate_media_id:null,selected_frame_asset_ids:[]};
 let role='eps_review_owner';const counts={},requests=[],record={name:'baseline'},identity=()=>({pid:88,snapshot:'20:30:',role,isolation:'repeatable read',read_only:'off',statement_timeout:'8s',lock_timeout:'8s',claims_sha256:'c'.repeat(64)});
 const session={pid:88,async request(text){requests.push(text);if(text.startsWith('reset role;'))role='postgres';if(text==='set role eps_review_owner;')role='eps_review_owner';
  if(text==='select pg_temp.complete41_semantic_universe();')return[{identity:identity(),universes:{'eps.workspace_candidates':{keys:pool,rows:2,pk_valid:true}}}];
  if(text.startsWith('select pg_temp.complete41_semantic_slice(')){const variant=/slice\('([^']+)'/u.exec(text)[1],i=counts[variant]??0;counts[variant]=i+1;return[{identity:identity(),keys:i===0?[variant==='capture'?pool[0]:row]:[]}];}
  if(text.startsWith('select pg_temp.complete41_'))return[identity()];return[];
 }};
 const ctx={report:{pool_helper_proof:{semantic:[record]}},bindings:{completeSemanticSql:'SEMANTIC_TMP'},baseline:{tables:{'eps.workspace_candidates':{count:2}}},acting(){throw Error('CLAIM_REFRESH_FORBIDDEN');}};
 const result=await semanticTuples(ctx,session,uuid(901));assert.equal(result.captured_pool_count,1);assert.equal(result.old_tuple_sha256,result.new_tuple_sha256);assert.deepEqual(counts,{capture:2,old:2,new:2});
 assert.equal(record.complete_semantic.claim_refresh_or_extension,false);assert.equal(record.complete_semantic.variants.every(v=>v.completed),true);assert(!requests.some(q=>q.includes('set_config')));assert.equal(hash([row]),result.old_tuple_sha256);
});
