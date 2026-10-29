import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';
import {compareCandidatePipeline} from '../../tools/lib/candidate-pipeline-comparison.mjs';
const proof=JSON.parse(await readFile(new URL('../../tracking/evidence/m03/kernel-catalog/2026-10-29T10-20-30-781Z-5b008cdd.json',import.meta.url),'utf8'));
assert.equal(proof.result,'passed');assert.equal(proof.rollback_verified,true);
function states(){const before=globalThis.structuredClone(proof.before);const after=globalThis.structuredClone(proof.candidate);after.versions.push('20261029100500');return{before,after};}
function compare(before,after){return compareCandidatePipeline(before,after,proof.before,proof.candidate);}
test('exact composed delta preserves current data and execute-only runtime',()=>{const{before,after}=states();assert.equal(compare(before,after).runtime_authority_unchanged,true);});
test('private-helper authority and unrelated function mutation fail closed',()=>{
 const{before,after}=states();const helper=after.catalog.functions.find(row=>row.name==='eps.candidate_upload_scope');assert.equal(helper.execute.authenticated,false);helper.execute.authenticated=true;assert.throws(()=>compare(before,after));
 const clean=states();const unaffected=clean.after.catalog.functions.find(row=>row.name==='eps.input_uuid');unaffected.source_sha256='0'.repeat(64);assert.throws(()=>compare(clean.before,clean.after));
});
test('business changes, enabled candidate config and runtime authority drift fail',()=>{
 for(const mutate of [after=>{after.data_sha256['eps.jobs']='1'.repeat(64);},after=>{after.data_sha256['eps.candidate_asset_config']='2'.repeat(64);},after=>{after.runtime={unexpected:true};},after=>{after.candidate_processing_issues_pristine=false;}]){
  const{before,after}=states();mutate(after);assert.throws(()=>compare(before,after));
 }
});
test('additional managed Storage columns retain the reviewed inherited ACL shape',()=>{
 const{before,after}=states();const column={table:'storage.objects',name:'future_managed_metadata',position:999,type:'text',not_null:false,identity:'',generated:'',default:null,explicit_acl:[]};
 before.catalog.columns.push(column);after.catalog.columns.push(globalThis.structuredClone(column));
 for(const role of ['eps_candidate_stage_owner','eps_candidate_assets_owner','eps_candidate_upload_owner','eps_candidate_apply_owner']){
  const table=proof.candidate.catalog.table_acls.find(row=>row.table===column.table&&row.role===role);
  after.catalog.column_acls.push({table:column.table,column:column.name,role,select:table.select,insert:table.insert,update:table.update,references:table.references});
 }
 assert.equal(compare(before,after).old_catalog_preserved_except_reviewed_delta,true);
 after.catalog.column_acls.find(row=>row.column===column.name).select=true;assert.throws(()=>compare(before,after));
});
