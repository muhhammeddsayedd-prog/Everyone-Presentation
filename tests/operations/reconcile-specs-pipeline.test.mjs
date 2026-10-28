import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import { validateOldFunctions, validateReviewedGrants, validateSnapshots, validateOriginalLockBytes } from '../../tools/reconcile-m02-specs-pipeline-local.mjs';

// Sealed catalog metadata only. Importing the helper cannot run its guarded main.
// No Docker, SQL, process signal, lock deletion, login or provider is invoked.
const failed=JSON.parse(readFileSync(new URL('../../tracking/evidence/m02/specs-pipeline-local-promotion/2026-10-28T22-26-28-140Z-b32c1d2d.json',import.meta.url),'utf8'));
const migration=readFileSync(new URL('../../supabase/migrations/20261028222030_m02_specs_pipeline.sql',import.meta.url),'utf8');
const fresh=()=>JSON.parse(JSON.stringify(failed.after));
const routine='eps.jobs_dto(p_job uuid)';
const validate=current=>validateSnapshots(failed,current,failed.default_pipeline,failed.after.ledger);

test('actual failed metadata reconciles only13 old routines /17 reviewed EXEC additions',()=>{
 assert.equal(validateReviewedGrants(migration),17);
 assert.deepEqual(validate(fresh()),{old_routines:89,reviewed_acl_routines:13,reviewed_execute_additions:17});
});
test('old function owner/definer/volatility/path/body changes remain rejected',()=>{
 for(const [index,value]of [[0,'0'],[1,true],[2,'v'],[3,['search_path=public']],[5,'0'.repeat(64)]]){
  const after=fresh();after.functions[routine][index]=value;
  assert.throws(()=>validateOldFunctions(failed.before.functions,after.functions),/RECONCILE_NON_ACL_FUNCTION_DRIFT/);
 }
});
test('removing old ACLs, new actors, grant options and wrong grantors are rejected',()=>{
 const cases=[items=>items.slice(1),items=>[...items,'authenticated=X/eps_jobs_owner'],
  items=>items.map(item=>item.startsWith('eps_specs_submit_owner=')?item.replace('=X/','=X*/'):item),
  items=>items.map(item=>item.startsWith('eps_specs_submit_owner=')?'eps_specs_submit_owner=X/postgres':item)];
 for(const change of cases){const after=fresh();after.functions[routine][4]=change(after.functions[routine][4]);
  assert.throws(()=>validateOldFunctions(failed.before.functions,after.functions),/RECONCILE_UNREVIEWED_ACL_DRIFT/);}
});
test('missing old routine and unexpected current routine cannot be hidden by ACL exceptions',()=>{
 const missing=fresh();delete missing.functions[routine];
 assert.throws(()=>validateOldFunctions(failed.before.functions,missing.functions),/RECONCILE_OLD_ROUTINE_MISSING/);
 const extra=fresh();extra.functions['eps.unreviewed()']=[...extra.functions[routine]];
 assert.throws(()=>validate(extra),/RECONCILE_CURRENT_STATE_CHANGED_SINCE_FAILURE/);
});
test('history/ledger and business data drift fail before lock release',()=>{
 const ledger=fresh();ledger.ledger['supabase/migrations/20261028222030_m02_specs_pipeline.sql']='0'.repeat(64);
 assert.throws(()=>validate(ledger),/RECONCILE_EXACT_LOCAL_TEN_REQUIRED/);
 const history=fresh();history.versions.pop();assert.throws(()=>validate(history),/RECONCILE_EXACT_LOCAL_TEN_REQUIRED/);
 const data=fresh();data.counts['eps.jobs']=1;assert.throws(()=>validate(data),/RECONCILE_CURRENT_STATE_CHANGED_SINCE_FAILURE/);
});
test('enabled configuration/nonempty retained inputs never reconcile as default-disabled',()=>{
 for(const changes of [{disabled:false},{private_inputs:1},{private_payloads:1},{model_unset:false}])
  assert.throws(()=>validateSnapshots(failed,fresh(),{...failed.default_pipeline,...changes},failed.after.ledger),/RECONCILE_DEFAULT_DISABLED_EMPTY_INPUTS_REQUIRED/);
});
test('a different failure cause or rewritten passed original is rejected',()=>{
 for(const changes of [{result:'passed'},{commit_observed:false},{prior_function_contracts_unchanged:true},{shared_db_lock_retained:false}])
  assert.throws(()=>validateSnapshots({...failed,...changes},fresh(),failed.default_pipeline,failed.after.ledger),/RECONCILE_EXACT_COMMITTED_FAILURE_REQUIRED/);
});
test('ACL exception must occur in reviewed GRANT statements',()=>{
 assert.throws(()=>validateReviewedGrants(migration.replaceAll('eps.jobs_dto(uuid),','')),/RECONCILE_ACL_MAP_NOT_IN_REVIEWED_MIGRATION/);
});
test('only exact original lock bytes are accepted, never equivalent JSON/new owner',()=>{
 const original=Buffer.from('{"run_id":"b32c1d2d-5a10-4743-ba10-896dd5ff3424","pid":2384}');
 validateOriginalLockBytes(original);
 for(const changed of [Buffer.concat([original,Buffer.from('\n')]),Buffer.from('{"pid":2384,"run_id":"b32c1d2d-5a10-4743-ba10-896dd5ff3424"}'),Buffer.from('{"run_id":"new-owner","pid":2384}')])
  assert.throws(()=>validateOriginalLockBytes(changed),/RECONCILE_ORIGINAL_LOCK_BYTES_CHANGED/);
});
