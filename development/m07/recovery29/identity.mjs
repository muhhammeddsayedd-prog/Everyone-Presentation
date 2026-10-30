/** PostgreSQL JSON renders oid as decimal text. Normalize only that exact
 * unsigned32 identity representation before the existing integer-only guard. */
export function normalizeDatabaseOid(value){
 const numeric=typeof value==='string'&&/^[1-9][0-9]{0,9}$/u.test(value)?Number(value):value;
 if(!Number.isSafeInteger(numeric)||numeric<1||numeric>4294967295||typeof value==='string'&&String(numeric)!==value)throw Error('RECOVERY29_CANONICAL_DATABASE_OID_REQUIRED');
 return numeric;
}
