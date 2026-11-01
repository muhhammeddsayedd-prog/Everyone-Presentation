/** Inert guards for a new synthetic recovery target. No cloud configuration. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {URL} from 'node:url';
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
export function checkedHttpTarget(base,pathname,allowedOrigins){
 assert(Array.isArray(allowedOrigins)&&allowedOrigins.includes(base),'RECOVERY_HTTP_TARGET_INVALID');
 assert(typeof pathname==='string'&&pathname.startsWith('/')&&!pathname.startsWith('//'),'RECOVERY_HTTP_TARGET_INVALID');
 const target=new URL(pathname,base);
 const boundedPrivateProbe=target.pathname==='/media_assets'&&target.search==='?select=id&limit=1';
 assert(target.protocol==='http:'&&target.origin===base&&!target.username&&!target.password&&(!target.search||boundedPrivateProbe)&&!target.hash,'RECOVERY_HTTP_TARGET_INVALID');
 return target.href;
}
export function verifyObjectReference(read,objects){
 assert(read?.asset&&Array.isArray(objects),'RECOVERY_OBJECT_REFERENCE_INVALID');
 const matches=objects.filter(object=>object.asset_id===read.asset.id);assert.equal(matches.length,1,'RECOVERY_OBJECT_REFERENCE_INVALID');
 const object=matches[0];checkedObjectPath(read.bucket,read.object_key);
 assert.deepEqual({bucket:read.bucket,object_key:read.object_key,size_bytes:read.asset.size_bytes,sha256:read.asset.sha256},
  {bucket:object.bucket,object_key:object.object_key,size_bytes:object.size_bytes,sha256:object.sha256},'RECOVERY_OBJECT_REFERENCE_INVALID');
 return object;
}
// The saved synthetic local Auth prerequisite reads the legacy subject GUC.
// PostgREST16 supplies verified claims as JSON. This separate invoker-only
// runtime adapter retains every restored Auth/application function unchanged.
export const LEGACY_CLAIM_BRIDGE_SQL=`CREATE SCHEMA recovery_http AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA recovery_http FROM PUBLIC;
GRANT USAGE ON SCHEMA recovery_http TO anon,authenticated,service_role;
CREATE FUNCTION recovery_http.restore_claims() RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $bridge$
DECLARE claims jsonb:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;subject text;
BEGIN
 IF claims->>'role' IS DISTINCT FROM current_user THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='RECOVERY_VERIFIED_ROLE_REQUIRED'; END IF;
 IF current_user='authenticated' THEN
  subject:=claims->>'sub';
  IF subject IS NULL OR subject!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='RECOVERY_VERIFIED_SUBJECT_REQUIRED'; END IF;
 END IF;
 PERFORM set_config('request.jwt.claim.sub',coalesce(subject,''),true);
END $bridge$;
REVOKE ALL ON FUNCTION recovery_http.restore_claims() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recovery_http.restore_claims() TO anon,authenticated,service_role;`;
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
