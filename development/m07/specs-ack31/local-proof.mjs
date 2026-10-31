/** Closed proof projections. Pure: no process, filesystem, DB or provider access. */
import assert from 'node:assert/strict';
const {structuredClone}=globalThis;
export const ACK_SOURCE_KEY='functions|eps.specs_submit_ack(uuid,uuid,uuid)|source_sha256';
const exact=(value,keys)=>{assert(value&&typeof value==='object'&&!Array.isArray(value));assert.deepEqual(Object.keys(value).sort(),[...keys].sort());};
export function assertPhaseProof(value,phase){
 assert(['red','green'].includes(phase));
 exact(value,['phase','expected_failure_observed','sqlstate','permission_object','checks']);assert.equal(value.phase,phase);
 const red=phase==='red';assert.equal(value.expected_failure_observed,red);assert.equal(value.sqlstate,red?'42501':null);assert.equal(value.permission_object,red?'jobs':null);
 exact(value.checks,['ack','idempotency','stale','denial','invalid_relations']);for(const result of Object.values(value.checks))assert.equal(result,!red);
 return structuredClone(value);
}
export function assertProjectionOnlyDelta(before,after,{version,newSourceSha256}){
 assert(typeof version==='string'&&/^\d{14}$/u.test(version)&&version>'20261030154824');
 assert(typeof newSourceSha256==='string'&&/^[a-f0-9]{64}$/u.test(newSourceSha256));
 assert(Object.hasOwn(before.catalog,ACK_SOURCE_KEY));assert.notEqual(before.catalog[ACK_SOURCE_KEY],newSourceSha256);
 const expected=structuredClone(before);assert(!expected.context.migration_versions.includes(version));assert(!expected.protected_data.versions.includes(version));
 expected.catalog[ACK_SOURCE_KEY]=newSourceSha256;expected.context.migration_versions.push(version);expected.protected_data.versions.push(version);
 assert.deepEqual(after,expected,'ACK31_EXACT_SOURCE_HISTORY_ONLY_REQUIRED');
}
export function assertCleanupComplete(value){
 exact(value,['dbAbsent','roleAbsent','originalExact','processUnconfirmed']);
 assert.equal(value.dbAbsent,true);assert.equal(value.roleAbsent,true);assert.equal(value.originalExact,true);assert.equal(value.processUnconfirmed,false);
}
export function assertAckReadbackResult(payloads,expected){
 assert.equal(payloads.length,1);const value=payloads[0];assert.deepEqual(value,expected);return value;
}
