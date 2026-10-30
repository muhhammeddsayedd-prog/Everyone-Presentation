/** Guard-only adapter around the unchanged, source-proven exact eight-pair plan. */
import assert from'node:assert/strict';
import{exactRestoreProfile8Sql}from'../recovery29/profile8.mjs';
import{ownedDatabasePredicate}from'../recovery29/ownership.mjs';
import{ownedIdentityPredicate}from'./admission.mjs';
export function issuerOwnedRestoreProfile(expected,observed,owned){
 const replacement=ownedIdentityPredicate(owned),hex=owned.name.slice('eps_m07_issuer30_'.length),uuid=owned.marker.slice('eps-m07-issuer30:'.length);
 const virtual={database:'eps_m07_r29_source_'+hex,marker:'eps-m07-recovery29:'+uuid+':source',oid:owned.oid};
 const predicate=ownedDatabasePredicate({name:virtual.database,marker:virtual.marker,oid:virtual.oid});
 const result=exactRestoreProfile8Sql(expected,observed,virtual);assert.equal(result.sql.split(predicate).length,2);
 return{sql:result.sql.replace(predicate,replacement),differences:result.differences};
}
