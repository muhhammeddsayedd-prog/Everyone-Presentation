/** Closed proof-only PK domains. No permissions, provider or transport cache. */
import assert from 'node:assert/strict';
import {createHash}from 'node:crypto';
export const RELATIONS=['public.projects','public.clients','eps.presentation_templates','eps.specs','eps.roles','eps.slots','eps.assignments','eps.workspace_candidates','eps.candidates','eps.candidate_media','eps.media_assets','eps.candidate_media_frames'];
export const FIELDS=Object.fromEntries(RELATIONS.map(r=>[r,r==='eps.presentation_templates'?['key','version']:r==='eps.candidate_media_frames'?['candidate_media_id','asset_id']:['id']]));
export const CHUNK_SIZE=1;
export const EXPECTED_COUNTS={'public.projects':5,'public.clients':0,'eps.presentation_templates':2,'eps.specs':5,'eps.roles':42,'eps.slots':605,'eps.assignments':62,'eps.workspace_candidates':32,'eps.candidates':28,'eps.candidate_media':27,'eps.media_assets':501,'eps.candidate_media_frames':328};
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
export const only=rows=>{assert(Array.isArray(rows)&&rows.length===1,'COMPLETE_ORACLE_ONE_RESULT_REQUIRED');return rows[0];};
export const canon=value=>Array.isArray(value)?value.map(canon):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canon(value[k])])):value;
export const hash=value=>createHash('sha256').update(JSON.stringify(canon(value))).digest('hex');
export const literal=value=>"'"+value.replaceAll("'","''")+"'";
export const keyId=(relation,key)=>JSON.stringify(FIELDS[relation].map(k=>key[k]));
export function keys(relation,value){
 assert(RELATIONS.includes(relation)&&Array.isArray(value),'COMPLETE_ORACLE_KEYS_REQUIRED');
 const fields=FIELDS[relation];
 for(const row of value)assert(row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).sort().join(',')===[...fields].sort().join(',')&&fields.every(k=>typeof row[k]==='string'&&(relation==='eps.presentation_templates'||UUID.test(row[k]))),'COMPLETE_ORACLE_KEY_SHAPE_REQUIRED');
 assert(new Set(value.map(k=>keyId(relation,k))).size===value.length,'COMPLETE_ORACLE_DUPLICATE_KEY');return value;
}
export function partition(relation,value){
 const all=keys(relation,value),chunks=all.map(k=>[k]);
 assert.equal(chunks.flat().length,all.length);assert.equal(hash(chunks.flat()),hash(all));return chunks;
}
export function identity(value,role,pid,snapshot=null,readonly='on',claims=null){
 const fields=['pid','snapshot','role','isolation','read_only','statement_timeout','lock_timeout','claims_sha256'];
 assert(value&&typeof value==='object'&&Object.keys(value).sort().join(',')===fields.sort().join(','),'COMPLETE_ORACLE_IDENTITY_REQUIRED');
 assert(Number.isSafeInteger(value.pid)&&value.pid>0&&value.pid===pid&&value.role===role&&value.isolation==='repeatable read'&&value.read_only===readonly&&value.statement_timeout==='8s'&&value.lock_timeout==='8s','COMPLETE_ORACLE_IDENTITY_CHANGED');
 assert(typeof value.snapshot==='string'&&/^[0-9]+:[0-9]+:(?:[0-9]+(?:,[0-9]+)*)?$/u.test(value.snapshot)&&value.snapshot.length<=32768,'COMPLETE_ORACLE_SNAPSHOT_REQUIRED');
 assert(typeof value.claims_sha256==='string'&&/^[a-f0-9]{64}$/u.test(value.claims_sha256),'COMPLETE_ORACLE_CLAIMS_IDENTITY_REQUIRED');
 assert(snapshot===null||value.snapshot===snapshot,'COMPLETE_ORACLE_SNAPSHOT_CHANGED');assert(claims===null||value.claims_sha256===claims,'COMPLETE_ORACLE_CLAIMS_CHANGED');return value;
}
export function universe(relation,item,expectedCount){
 assert(item&&typeof item==='object'&&Object.keys(item).sort().join(',')==='keys,pk_valid,rows','COMPLETE_ORACLE_UNIVERSE_REQUIRED');
 assert.equal(item.pk_valid,true,'COMPLETE_ORACLE_ACTUAL_PK_SHAPE_CHANGED');
 const all=keys(relation,item.keys);assert(Number.isSafeInteger(expectedCount)&&expectedCount>=0,'COMPLETE_ORACLE_BASELINE_COUNT_REQUIRED');
 assert.equal(item.rows,expectedCount);assert.equal(all.length,expectedCount);
 return {all,chunks:partition(relation,all),ordinal:new Map(all.map((k,i)=>[keyId(relation,k),i]))};
}
export function admitResult(relation,result,chunk,selected,seen){
 const admitted=keys(relation,result),domain=new Set(chunk.map(k=>keyId(relation,k)));
 for(const row of admitted){const id=keyId(relation,row);assert(domain.has(id)&&!seen.has(id),'COMPLETE_ORACLE_RESULT_OUTSIDE_PARTITION');seen.add(id);selected.push(row);}return admitted;
}
export function context(ctx){
 const {workspace,series}=ctx.profiles.large;assert(UUID.test(workspace)&&UUID.test(series)&&UUID.test(ctx.runId),'COMPLETE_ORACLE_CONTEXT_REQUIRED');return{workspace,series,runId:ctx.runId};
}
