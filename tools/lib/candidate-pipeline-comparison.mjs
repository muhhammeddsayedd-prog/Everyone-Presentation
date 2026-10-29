/** Exact reviewed catalog delta; unrelated cloud columns/rows stay preserved. */
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
const KEYS={functions:['signature'],relations:['name'],columns:['table','name'],roles:['name'],table_acls:['table','role'],column_acls:['table','column','role'],policies:['table','name'],constraints:['table','name'],indexes:['table','name'],triggers:['table','name']};
const NEW_TABLES=['eps.candidate_asset_config','eps.candidate_uploads','eps.candidate_stage_payloads','eps.candidate_asset_grants','eps.cast_operation_notes'];
const NEW_ROLES=['eps_candidate_stage_owner','eps_candidate_assets_owner','eps_candidate_upload_owner','eps_candidate_apply_owner'];
const key=(kind,row)=>JSON.stringify(KEYS[kind].map(name=>row[name]));
const map=(kind,rows)=>new Map(rows.map(row=>[key(kind,row),row]));
function patch(value,old,next){
 if(isDeepStrictEqual(old,next))return globalThis.structuredClone(value);
 if(old&&next&&typeof old==='object'&&typeof next==='object'&&!Array.isArray(old)&&!Array.isArray(next)){
  const result=globalThis.structuredClone(value);assert(result&&typeof result==='object'&&!Array.isArray(result));
  for(const name of new Set([...Object.keys(old),...Object.keys(next)])){
   if(!(name in old)){assert(!(name in result));result[name]=globalThis.structuredClone(next[name]);}
   else if(!(name in next)){assert.deepEqual(result[name],old[name]);delete result[name];}
   else result[name]=patch(result[name],old[name],next[name]);
  }return result;
 }
 assert.deepEqual(value,old);return globalThis.structuredClone(next);
}
export function compareCandidateCatalog(before,after,referenceBefore,referenceAfter){
 assert.deepEqual(Object.keys(before).sort(),Object.keys(KEYS).sort());assert.deepEqual(Object.keys(after).sort(),Object.keys(KEYS).sort());
 for(const kind of Object.keys(KEYS)){
  const expected=map(kind,globalThis.structuredClone(before[kind]));const old=map(kind,referenceBefore[kind]);const next=map(kind,referenceAfter[kind]);
  for(const [id,row]of old){assert(next.has(id),'No reviewed17 catalog removals');if(!isDeepStrictEqual(row,next.get(id))){assert(expected.has(id));expected.set(id,patch(expected.get(id),row,next.get(id)));}}
  for(const [id,row]of next)if(!old.has(id)){assert(!expected.has(id));expected.set(id,globalThis.structuredClone(row));}
  // Managed Storage may have additional columns. New definer roles get the
  // same table privileges already reviewed; no column-specific grant extends
  // to an unknown column. Every existing principal's privileges stay exact.
  if(kind==='column_acls')for(const column of before.columns)for(const role of NEW_ROLES){
   const id=key(kind,{table:column.table,column:column.name,role});if(expected.has(id))continue;
   const table=referenceAfter.table_acls.find(row=>row.table===column.table&&row.role===role);assert(table);
   expected.set(id,{table:column.table,column:column.name,role,select:table.select,insert:table.insert,update:table.update,references:table.references});
  }
  assert.deepEqual(map(kind,after[kind]),expected,`Unreviewed17 catalog delta: ${kind}`);
 }
}
export function compareCandidatePipeline(before,after,referenceBefore,referenceAfter,{history=true}={}){
 assert.deepEqual(Object.keys(after).sort(),Object.keys(before).sort());
 assert.deepEqual(after.versions,history?[...before.versions,'20261029100500']:before.versions);
 for(const name of ['query_role','database','unrestricted_visibility','runtime','source_config','assets','release_additions_pristine','buckets'])assert.deepEqual(after[name],before[name]);
 assert.deepEqual(before.candidate_buckets,[]);assert.deepEqual(after.candidate_buckets,referenceAfter.candidate_buckets);
 assert.equal(after.candidate_processing_issues_pristine,true);
 const counts={...after.counts};const fingerprints={...after.data_sha256};
 for(const table of NEW_TABLES){assert.equal(counts[table],table==='eps.candidate_asset_config'?1:0);assert.equal(fingerprints[table],referenceAfter.data_sha256[table]);delete counts[table];delete fingerprints[table];}
 assert.equal(counts['storage.buckets'],before.counts['storage.buckets']+2);counts['storage.buckets']-=2;
 assert.deepEqual(counts,before.counts);assert.deepEqual(fingerprints,before.data_sha256);
 compareCandidateCatalog(before.catalog,after.catalog,referenceBefore.catalog,referenceAfter.catalog);
 return {business_rows_preserved:true,old_catalog_preserved_except_reviewed_delta:true,new_tables_empty_except_disabled_config:true,runtime_authority_unchanged:true};
}
