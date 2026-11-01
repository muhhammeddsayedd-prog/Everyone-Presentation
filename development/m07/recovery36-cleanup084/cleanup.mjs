/** One failed owned-local run only. Import is inert; no provider/database dispatch. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalizeDatabaseOid} from '../recovery29/identity.mjs';
export const RUN='0843096a-6482-402a-bbcf-9cf162289b8a';
export const SYSTEM='7701520506262638626';
export const ROLES=Object.freeze(['eps_job_trace_owner','eps_mcp_issuer_owner','eps_oauth_consent_owner']);
export const DBS=Object.freeze(['source','restore'].map(x=>`eps_m07_r33_${x}_${RUN.replaceAll('-','')}`));
export const LOCK_SHA='3cfe49dd74bad35ae53a74567970e58fdfb070ab45b2e589fd1f62fb88d79a0a';
export const sha=x=>createHash('sha256').update(x).digest('hex');
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const j=x=>q(JSON.stringify(x))+'::jsonb';
const keys=(x,k)=>assert.deepEqual(Object.keys(x).sort(),k.sort(),'CLEANUP084_CLOSED_SHAPE');
export function canonicalMemberships(rows,name){
 assert(Array.isArray(rows)&&rows.length>=1&&rows.length<=2);const canonical=[];
 for(const row of rows){keys(row,['role','member','grantor','admin','inherit','set']);assert.equal(row.role,name);assert.equal(row.member,'postgres');
  for(const k of ['admin','inherit','set'])assert.equal(typeof row[k],'boolean');
  const explicit={role:name,member:'postgres',grantor:'postgres',admin:false,inherit:name!==ROLES[1],set:true};
  const bootstrap={role:name,member:'postgres',grantor:'supabase_admin',admin:true,inherit:false,set:false};
  if(row.grantor==='postgres')assert.deepEqual(row,explicit);else assert.deepEqual(row,bootstrap);
  canonical.push(JSON.stringify(row.grantor==='postgres'?explicit:bootstrap));
 }
 assert.equal(new Set(canonical).size,canonical.length);assert(rows.some(x=>x.grantor==='postgres'));
 return canonical.sort();
}
export function validateRole(row,name){
 keys(row,['name','oid','marker','login','super','inherit','bypassrls','create_role','create_db','replication','connection_limit','valid_until','memberships','dependencies','clients']);
 assert.equal(row.name,name);const oid=normalizeDatabaseOid(row.oid);if(name===ROLES[0])assert.equal(oid,243387);
 const kind=name===ROLES[0]?'36':'33',suffix=name===ROLES[0]?'trace':name===ROLES[1]?'issuer':'consent';
 assert.equal(row.marker,`eps-m07-recovery${kind}:${RUN}:${suffix}`);
 for(const k of ['login','super','inherit','bypassrls','create_role','create_db','replication'])assert.equal(row[k],false);
 assert.equal(row.connection_limit,-1);assert.equal(row.valid_until,null);assert.equal(row.clients,0);assert.deepEqual(row.dependencies,[]);
 canonicalMemberships(row.memberships,name);return row; // Return raw native representation/order unchanged.
}
export function roleQuery(name){assert(ROLES.includes(name));return `select jsonb_build_object('name',r.rolname,'oid',r.oid,'marker',shobj_description(r.oid,'pg_authid'),
 'login',r.rolcanlogin,'super',r.rolsuper,'inherit',r.rolinherit,'bypassrls',r.rolbypassrls,'create_role',r.rolcreaterole,'create_db',r.rolcreatedb,'replication',r.rolreplication,'connection_limit',r.rolconnlimit,'valid_until',r.rolvaliduntil,
 'memberships',(select coalesce(jsonb_agg(jsonb_build_object('role',roleid::regrole::text,'member',member::regrole::text,'grantor',grantor::regrole::text,'admin',admin_option,'inherit',inherit_option,'set',set_option)order by roleid,member,grantor),'[]')from pg_auth_members where roleid=r.oid or member=r.oid or grantor=r.oid),
 'dependencies',(select coalesce(jsonb_agg(jsonb_build_object('dbid',dbid,'classid',classid::regclass::text,'objid',objid,'objsubid',objsubid,'deptype',deptype)order by dbid,classid,objid,objsubid),'[]')from pg_shdepend where refclassid='pg_authid'::regclass and refobjid=r.oid),
 'clients',(select count(*)from pg_stat_activity where backend_type='client backend'and pid<>pg_backend_pid()))from pg_roles r where r.rolname=${q(name)}`;}
export function scopeSql(){return `select jsonb_build_object('databases',(select coalesce(jsonb_agg(datname order by datname),'[]')from pg_database where datname in(${DBS.map(q).join(',')})),'roles',jsonb_build_array(${ROLES.map(n=>'('+roleQuery(n)+')').join(',')}))`;}
export function validateScope(scope){keys(scope,['databases','roles']);assert.deepEqual(scope.databases,[]);assert.equal(scope.roles.length,3);scope.roles.forEach((v,i)=>validateRole(v,ROLES[i]));assert.equal(new Set(scope.roles.map(x=>normalizeDatabaseOid(x.oid))).size,3);return scope;}
export function withoutOwnedGlobals(value,scope){
 validateScope(scope);keys(value,['roles','memberships']);const ids=new Set(scope.roles.map(r=>String(normalizeDatabaseOid(r.oid))));
 const extra=value.roles.filter(r=>ids.has(String(normalizeDatabaseOid(r.oid))));assert.equal(extra.length,3);
 for(const r of scope.roles){const g=extra.find(x=>x.name===r.name);assert(g);const expected={oid:r.oid,name:r.name,login:false,superuser:false,inherit:false,bypassrls:false,replication:false,create_role:false,create_db:false,connection_limit:-1,valid_until:null};assert.deepEqual(g,expected);}
 const names=new Map(value.roles.map(r=>[String(normalizeDatabaseOid(r.oid)),r.name]));
 const memberships=value.memberships.filter(r=>['role_oid','member_oid','grantor_oid'].some(k=>ids.has(String(normalizeDatabaseOid(r[k])))));
 const projected=memberships.map(r=>{keys(r,['role_oid','member_oid','grantor_oid','admin','inherit','set']);return{role:names.get(String(normalizeDatabaseOid(r.role_oid))),member:names.get(String(normalizeDatabaseOid(r.member_oid))),grantor:names.get(String(normalizeDatabaseOid(r.grantor_oid))),admin:r.admin,inherit:r.inherit,set:r.set};});
 assert.equal(projected.length,scope.roles.reduce((n,r)=>n+r.memberships.length,0));
 for(const r of scope.roles)assert.deepEqual(canonicalMemberships(projected.filter(x=>x.role===r.name),r.name),canonicalMemberships(r.memberships,r.name));
 return{roles:value.roles.filter(r=>!ids.has(String(normalizeDatabaseOid(r.oid)))),memberships:value.memberships.filter(r=>!['role_oid','member_oid','grantor_oid'].some(k=>ids.has(String(normalizeDatabaseOid(r[k])))))};
}
export function withoutOwnedCatalogue(value,scope){
 validateScope(scope);const extras={};for(const r of scope.roles){
  for(const k of ['login','super','inherit','bypassrls','create_role','create_db','replication','connection_limit','valid_until'])extras[`roles|${r.name}|${k}`]=r[k];
  for(const m of r.memberships)for(const k of ['grantor','admin','inherit','set'])extras[`memberships|${m.role}>${m.member}/${m.grantor}|${k}`]=m[k];
 }
 const result={...value};for(const[k,v]of Object.entries(extras)){assert(Object.hasOwn(result,k));assert.deepEqual(result[k],v);delete result[k];}return result;
}
const stripTransaction=sql=>{assert(sql.startsWith('begin read only;')&&sql.endsWith('rollback;'));return sql.slice('begin read only;'.length,-'rollback;'.length);};
export function dropSql(scope,globals,beforeGlobals,rolesSql){
 validateScope(scope);assert.deepEqual(withoutOwnedGlobals(globals,scope),beforeGlobals);
 const query=stripTransaction(rolesSql).trim().replace(/;$/u,'');assert(query.startsWith('select jsonb_build_object('));
 return `begin;set local lock_timeout='5s';set local statement_timeout='30s';lock table pg_authid,pg_auth_members,pg_shdepend in share row exclusive mode;
 do $cleanup084$declare v jsonb;begin
 ${scopeSql()} into v;if v is distinct from ${j(scope)} then raise exception 'CLEANUP084_ROLE_PREIMAGE_CHANGED';end if;
 ${query} into v;if v is distinct from ${j(globals)} then raise exception 'CLEANUP084_GLOBAL_PREIMAGE_CHANGED';end if;
 end$cleanup084$;
 ${ROLES.map(n=>'drop role '+n+';').join('\n')}
 do $cleanup084$declare v jsonb;begin ${query} into v;if v is distinct from ${j(beforeGlobals)} then raise exception 'CLEANUP084_ORIGINAL_GLOBALS_CHANGED';end if;end$cleanup084$;commit;`;
}

/** The frozen profile hashes EPS role rows. Before DROP exclude only the three
 * independently validated new identities, never any old row/category/hash. */
export function profileSqlBefore(sql){
 const role="from pg_roles where rolname like'eps_%')";
 const members="from pg_auth_members where roleid::regrole::text like'eps_%'or member::regrole::text like'eps_%')";
 assert.equal(sql.split(role).length,2);assert.equal(sql.split(members).length,2);
 const list=ROLES.map(q).join(',');
 return sql.replace(role,`from pg_roles where rolname like'eps_%' and rolname not in(${list}))`)
  .replace(members,`from pg_auth_members where(roleid::regrole::text like'eps_%'or member::regrole::text like'eps_%')and roleid::regrole::text not in(${list})and member::regrole::text not in(${list})and grantor::regrole::text not in(${list}))`);
}
