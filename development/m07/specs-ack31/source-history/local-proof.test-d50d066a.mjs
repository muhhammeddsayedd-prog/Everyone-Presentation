import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assertPhaseProof, assertProjectionOnlyDelta, assertCleanupComplete, assertAckReadbackResult, ACK_SOURCE_KEY} from './local-proof.mjs';
const {structuredClone}=globalThis;

const hash='a'.repeat(64), nextHash='b'.repeat(64), version='20261031010000';
const baseline=()=>({catalog:{[ACK_SOURCE_KEY]:hash,'functions|eps.specs_submit_ack(uuid,uuid,uuid)|acl':'owner-only','tables|eps.jobs|acl':'narrow'},
 context:{migration_versions:['29','30'],all_roles:[{name:'existing',oid:42}],all_memberships:[],effective_privileges:{runtime:{select:false}}},
 protected_data:{versions:['29','30'],counts:{'eps.jobs':1},hashes:{'eps.jobs':hash}},admission:{database:'owned',protected_m02:{exists:true}}});
function after(){const value=baseline();value.catalog[ACK_SOURCE_KEY]=nextHash;value.context.migration_versions.push(version);value.protected_data.versions.push(version);return value;}
const proof=phase=>({phase,expected_failure_observed:phase==='red',sqlstate:phase==='red'?'42501':null,permission_object:phase==='red'?'jobs':null,
 checks:Object.fromEntries(['ack','idempotency','stale','denial','invalid_relations'].map(key=>[key,phase==='green']))});

test('RED requires the real narrow jobs permission failure and cannot precredit green checks',()=>{
 assertPhaseProof(proof('red'),'red');
 for(const change of [{sqlstate:'P0001'},{permission_object:'auth.users'},{expected_failure_observed:false},{checks:{...proof('red').checks,ack:true}},{private:'synthetic'}])
  assert.throws(()=>assertPhaseProof({...proof('red'),...change},'red'));
});
test('GREEN requires every independent API behavior and excludes unexpected payloads',()=>{
 assertPhaseProof(proof('green'),'green');
 for(const key of Object.keys(proof('green').checks))assert.throws(()=>assertPhaseProof({...proof('green'),checks:{...proof('green').checks,[key]:false}},'green'));
 for(const value of [{...proof('green'),sqlstate:'42501'},{...proof('green'),expected_failure_observed:true},{...proof('green'),checks:{...proof('green').checks,unknown:true}}])
  assert.throws(()=>assertPhaseProof(value,'green'));
});
test('the only persisted clone31 delta is the pinned ACK source plus coordinated history',()=>{
 const before=baseline(),current=after(),saved=structuredClone({before,current});
 assertProjectionOnlyDelta(before,current,{version,newSourceSha256:nextHash});assert.deepEqual({before,current},saved);
});
test('any privilege, business, old-role, settings or catalogue drift refuses exact preservation',()=>{
 const mutations=[v=>v.catalog['tables|eps.jobs|acl']='broad',v=>v.catalog.extra=true,v=>v.context.all_roles[0].oid=43,
  v=>v.context.all_memberships.push({role:'new'}),v=>v.context.effective_privileges.runtime.select=true,
  v=>v.protected_data.hashes['eps.jobs']='c'.repeat(64),v=>v.admission.protected_m02.exists=false];
 for(const mutate of mutations){const value=after();mutate(value);assert.throws(()=>assertProjectionOnlyDelta(baseline(),value,{version,newSourceSha256:nextHash}));}
});
test('missing/duplicate history and a wrong source never pass the projection delta',()=>{
 for(const mutate of [v=>v.context.migration_versions.pop(),v=>v.protected_data.versions.push(version),v=>delete v.catalog[ACK_SOURCE_KEY],v=>v.catalog[ACK_SOURCE_KEY]=hash]){
  const value=after();mutate(value);assert.throws(()=>assertProjectionOnlyDelta(baseline(),value,{version,newSourceSha256:nextHash}));
 }
});
test('unknown command/create outcome cannot release the lock even after apparent absence',()=>{
 const clean={dbAbsent:true,roleAbsent:true,originalExact:true,processUnconfirmed:false};assertCleanupComplete(clean);
 for(const change of [{processUnconfirmed:true},{dbAbsent:undefined},{roleAbsent:false},{originalExact:false}])assert.throws(()=>assertCleanupComplete({...clean,...change}));
});
test('psql At exposes the sole JSON column directly, retaining closed narrow readback assertions',()=>{
 const value={database:'synthetic-owned',operator:'postgres',history:['synthetic30'],owner:'eps_specs_submit_owner',acl:'{eps_specs_submit_owner=X/eps_specs_submit_owner}',private_invoker:true,language:'plpgsql',volatility:'v',search_path:['search_path=""'],body_sha256:hash,owner_ack_execute:true,public_callers_denied:true,existing_projection_columns_granted:true,whole_job_select_still_denied:true,generic_jobs_dto_sha256:nextHash};
 assert.deepEqual(assertAckReadbackResult([structuredClone(value)],value),value);
 assert.throws(()=>assertAckReadbackResult([{specs_ack31_readback:value}],value));
 for(const changed of [{...value,whole_job_select_still_denied:false},{...value,private:'synthetic'},{...value,body_sha256:nextHash}])assert.throws(()=>assertAckReadbackResult([changed],value));
});
