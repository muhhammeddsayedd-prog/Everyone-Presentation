/** One observed managed-Storage baseline difference; no SQL or grant changes. */
import assert from 'node:assert/strict';
import {compareCandidatePipeline} from './candidate-pipeline-comparison.mjs';
export const MANAGED_PREDICATES=['storage.operation()','storage.allow_only_operation(text)','storage.allow_any_operation(text[])'];
export const DERIVED_ROLES=['eps_candidate_stage_owner','eps_candidate_assets_owner','eps_candidate_apply_owner'];
export function reconcileCandidate17(before,after,referenceBefore,referenceAfter){
 const expected=globalThis.structuredClone(referenceAfter);const observations=[];
 for(const signature of MANAGED_PREDICATES){
  const old=before.catalog.functions.find(row=>row.signature===signature);const current=after.catalog.functions.find(row=>row.signature===signature);
  const local=referenceBefore.catalog.functions.find(row=>row.signature===signature);const adapted=expected.catalog.functions.find(row=>row.signature===signature);
  assert(old&&current&&local&&adapted);assert.equal(local.public_execute,false);assert.equal(old.public_execute,true);assert.equal(current.public_execute,true);
  assert(old.explicit_acl.some(acl=>acl.grantee==='PUBLIC'&&acl.privilege==='EXECUTE'&&acl.grantable===false));
  const {execute:oldExecute,...oldDefinition}=old;const {execute:currentExecute,...currentDefinition}=current;
  assert.deepEqual(currentDefinition,oldDefinition,'Managed function/ACL must stay exact');
  for(const [role,value]of Object.entries(oldExecute))assert.equal(currentExecute[role],value,'Existing role EXECUTE must stay exact');
  for(const role of DERIVED_ROLES){assert(!(role in oldExecute));assert.equal(currentExecute[role],true);assert.equal(adapted.execute[role],false);adapted.execute[role]=true;}
  observations.push({signature,public_execute_before:true,public_execute_after:true,explicit_acl_unchanged:true,existing_role_execute_unchanged:true,derived_role_execute:DERIVED_ROLES});
 }
 const result=compareCandidatePipeline(before,after,referenceBefore,expected);
 return {...result,managed_public_predicates:observations,derived_boolean_count:9,cloud_grants_changed:false};
}
