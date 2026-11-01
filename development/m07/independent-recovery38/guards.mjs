/** Inert guards for a new synthetic recovery target. No cloud configuration. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const sha=x=>createHash('sha256').update(x).digest('hex');
export const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
const ROLE=/^[a-z][a-z0-9_]{0,62}$/u;
const ident=x=>{assert(ROLE.test(x),'RECOVERY_ROLE_INVALID');return '"'+x+'"';};
export function resourceName(run,kind){assert(UUID.test(run));assert(['db','rest','storage','network','dbdata','objects'].includes(kind));return `eps-r38-${run.replaceAll('-','')}-${kind}`;}
export function assertOwnedResource(value,{id,name,run,workspace}){
 assert(id&&value.Id===id,'RECOVERY_RESOURCE_ID_MISMATCH');
 assert.equal((value.Name??'').replace(/^\//u,''),name);
 for(const[k,v]of Object.entries({'eps.recovery.run':run,'eps.recovery.workspace':workspace,'eps.recovery.purpose':'independent38'}))assert.equal(value.Labels?.[k]??value.Config?.Labels?.[k],v,'RECOVERY_RESOURCE_OWNER_MISMATCH');
 return value;
}
export function checkedObjectPath(bucket,key){assert(/^[a-z0-9][a-z0-9-]{0,99}$/u.test(bucket));assert(typeof key==='string'&&key.length<=512&&key.split('/').every(x=>/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(x)&&!['.','..'].includes(x)),'RECOVERY_OBJECT_PATH_INVALID');return bucket+'/'+key;}
export function normalizeCatalogue(value){return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,key.endsWith('|acl')&&typeof v==='string'?v.slice(1,-1).split(',').sort():v]));}
export function roleBootstrapSql(snapshot){
 assert(Array.isArray(snapshot.roles)&&Array.isArray(snapshot.memberships));const names=new Map(),stmts=[];
 for(const r of snapshot.roles){ident(r.name);assert(!names.has(String(r.oid)));names.set(String(r.oid),r.name);if(r.name.startsWith('pg_'))continue;
  assert(Number.isSafeInteger(r.connection_limit));assert(r.valid_until===null||typeof r.valid_until==='string');
  const flags=[['login','LOGIN'],['superuser','SUPERUSER'],['inherit','INHERIT'],['bypassrls','BYPASSRLS'],['create_db','CREATEDB'],['create_role','CREATEROLE'],['replication','REPLICATION']].map(([k,flag])=>{assert(typeof r[k]==='boolean');return(r[k]?'':'NO')+flag;}).join(' ');
  stmts.push(`DO $role$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${quote(r.name)}) THEN CREATE ROLE ${ident(r.name)}; END IF; END $role$;\nALTER ROLE ${ident(r.name)} ${flags} CONNECTION LIMIT ${r.connection_limit}${r.valid_until===null?'':' VALID UNTIL '+quote(r.valid_until)};`);
 }
 // A non-superuser grantor must receive its source ADMIN grant before it can
 // reproduce the separately attributed dependent membership.
 for(const m of snapshot.memberships.slice().sort((a,b)=>Number(b.admin)-Number(a.admin))){const role=names.get(String(m.role_oid)),member=names.get(String(m.member_oid)),grantor=names.get(String(m.grantor_oid));assert(role&&member&&grantor,'RECOVERY_MEMBERSHIP_ROLE_MISSING');for(const k of ['admin','inherit','set'])assert(typeof m[k]==='boolean');
  stmts.push(`GRANT ${ident(role)} TO ${ident(member)} WITH ADMIN ${String(m.admin).toUpperCase()}, INHERIT ${String(m.inherit).toUpperCase()}, SET ${String(m.set).toUpperCase()} GRANTED BY ${ident(grantor)};`);
 }
 return stmts.join('\n');
}
