import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';
import {reconcileCandidate17,MANAGED_PREDICATES} from '../../tools/lib/candidate17-storage-reconciliation.mjs';
const actual=JSON.parse(await readFile(new URL('../../tracking/evidence/cloud-candidate-pipeline/2026-10-29T10-32-13-540642Z-e50f546a-apply.json',import.meta.url),'utf8'));
const reference=JSON.parse(await readFile(new URL('../../tracking/evidence/m03/kernel-catalog/2026-10-29T10-20-30-781Z-5b008cdd.json',import.meta.url),'utf8'));
function states(){return{before:globalThis.structuredClone(actual.before),after:globalThis.structuredClone(actual.readback)};}
function check(before,after){return reconcileCandidate17(before,after,reference.before,reference.candidate);}
test('retained failed receipt reconciles exactly three prior PUBLIC predicates and nine derived booleans',()=>{
 const result=check(actual.before,actual.readback);assert.equal(result.derived_boolean_count,9);assert.equal(result.managed_public_predicates.length,3);assert.equal(result.cloud_grants_changed,false);assert.equal(actual.result,'failed');
});
test('new PUBLIC grant, changed managed ACL/source or old-role privilege fails',()=>{
 for(const change of ['prior_public','acl','source','existing_role']){
  const{before,after}=states();const old=before.catalog.functions.find(row=>row.signature===MANAGED_PREDICATES[0]);const row=after.catalog.functions.find(row=>row.signature===MANAGED_PREDICATES[0]);
  if(change==='prior_public')old.public_execute=false;else if(change==='acl')row.explicit_acl=[];else if(change==='source')row.source_sha256='0'.repeat(64);else row.execute.authenticated=false;
  assert.throws(()=>check(before,after));
 }
});
test('private helper authority, runtime drift and old data changes still fail',()=>{
 for(const change of ['private','runtime','data']){
  const{before,after}=states();if(change==='private')after.catalog.functions.find(row=>row.name==='eps.candidate_upload_scope').execute.authenticated=true;else if(change==='runtime')after.runtime.execute.push('eps.candidate_upload_scope(uuid)');else after.data_sha256['eps.jobs']='0'.repeat(64);
  assert.throws(()=>check(before,after));
 }
});
