import{normalizeDatabaseOid}from'./identity.mjs';
const fail=()=>{throw Error('RECOVERY29_CLEANUP_UNCONFIRMED');};
/** Only an actual fixed-name catalogue lookup may supply null for absence. */
export function cleanupObservation(expected,observed){
 if(observed===null)return{absent:true,can_drop:false};
 if(!observed||expected.attempted!==true||observed.name!==expected.name||observed.owner!=='postgres'||observed.comment!==expected.marker||observed.clients!==0)fail();
 const oid=normalizeDatabaseOid(observed.oid);if(expected.oid!==undefined&&oid!==normalizeDatabaseOid(expected.oid))fail();
 return{absent:false,can_drop:true,oid};
}
export function assertActualAbsence(names,observations){if(!Array.isArray(names)||names.length===0||names.some(name=>!Object.hasOwn(observations,name)||observations[name]!==false))fail();}
/** Shared actual SQL predicate, separately parsed in tests outside opaque DO. */
export function ownedDatabasePredicate({name,marker,oid}){
 const match=/^eps_m07_r29_(source|restore|diag)_([a-f0-9]{32})$/u.exec(name??'');
 if(!match||!Number.isSafeInteger(oid)||normalizeDatabaseOid(oid)!==oid)fail();
 const hex=match[2],uuid=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
 const expectedMarker=match[1]==='diag'?`eps-m07-recovery29-diagnostic:${uuid}`:`eps-m07-recovery29:${uuid}:${match[1]}`;
 if(marker!==expectedMarker)fail();
 return `current_database() <> '${name}' or not exists (select 1 from pg_database where datname = current_database() and oid = ${oid} and shobj_description(oid, 'pg_database') = '${marker}')`;
}
