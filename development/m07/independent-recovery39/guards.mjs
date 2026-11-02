/** Pure new-purpose guards. Historical helpers are imported only as mechanisms. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { sha, quote } from '../independent-recovery38/guards.mjs';
export { sha, quote, checkedObjectPath, normalizeCatalogue, roleBootstrapSql, checkedHttpTarget, verifyObjectReference, LEGACY_CLAIM_BRIDGE_SQL } from '../independent-recovery38/guards.mjs';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
export const CREATOR='a7390000-0000-4000-8000-000000000001';
export const MIGRATION='supabase/migrations/20261101223342_m07_project_creation.sql';
export const MIGRATION_SHA='c17af7708a1886d2129df2dc9e4eb196e6b760862939bd2f5fd3c7c1c687e242';
export const NATIVE='sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4';
export const GRAPH='0566342ec367efef328885aac513adeb5a942048ba01c88e1af63e4d636b6730';
export const INPUT={name:'Synthetic independent recovery39 project',presentation_type:'casting'};
export function resourceName(run,kind){assert(UUID.test(run));assert(['source','sourcedata','db','dbdata','rest','storage','network','objects'].includes(kind));return `eps-r39-${run.replaceAll('-','')}-${kind}`;}
export function assertOwnedResource(value,{id,name,run,workspace,created_at}){
 assert(id&&value.Id===id,'RECOVERY39_RESOURCE_ID_MISMATCH');assert.equal((value.Name??'').replace(/^\//u,''),name);
 for(const[k,v]of Object.entries({'eps.recovery.run':run,'eps.recovery.workspace':workspace,'eps.recovery.purpose':'independent39'}))assert.equal(value.Labels?.[k]??value.Config?.Labels?.[k],v,'RECOVERY39_RESOURCE_OWNER_MISMATCH');
 if(created_at!==undefined)assert.equal(value.CreatedAt??value.Created,created_at,'RECOVERY39_RESOURCE_CREATION_CHANGED');
 return value;
}
export function functional39(bytes){
 assert.equal(sha(bytes),MIGRATION_SHA,'RECOVERY39_MIGRATION_CHANGED');const source=Buffer.from(bytes).toString('utf8'),start='-- BEGIN PROJECT CREATION FUNCTIONAL CHANGE',end='-- END PROJECT CREATION FUNCTIONAL CHANGE';
 assert.equal(source.split(start).length,2);assert.equal(source.split(end).length,2);const sql=source.slice(source.indexOf(start)+start.length,source.indexOf(end));assert(!/^\s*(?:begin|commit|rollback)\s*;/imu.test(sql));return sql;
}
export function projectReceipt(value){
 assert.deepEqual(Object.keys(value).sort(),['id','name','client_id','client_name','client_logo_asset_id','row_version','client_row_version','casting_workspace_id','can_edit','presentation_type'].sort());
 assert(UUID.test(value.id));assert.equal(value.name,INPUT.name);assert.equal(value.presentation_type,'casting');assert.equal(value.row_version,1);assert.equal(value.can_edit,true);
 for(const field of['client_id','client_name','client_logo_asset_id','client_row_version','casting_workspace_id'])assert.equal(value[field],null);
 return value;
}
export function namedRoles(snapshot){
 assert(Array.isArray(snapshot.roles)&&Array.isArray(snapshot.memberships));const names=new Map(snapshot.roles.map(role=>[String(role.oid),role.name]));
 return{roles:snapshot.roles.map(({oid,...role})=>{assert(oid!==undefined);return role;}).sort((a,b)=>a.name.localeCompare(b.name)),memberships:snapshot.memberships.map(row=>({role:names.get(String(row.role_oid)),member:names.get(String(row.member_oid)),grantor:names.get(String(row.grantor_oid)),admin:row.admin,inherit:row.inherit,set:row.set})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))};
}
export const ROLE_SNAPSHOT_SQL="select jsonb_build_object('roles',(select jsonb_agg(jsonb_build_object('oid',oid,'name',rolname,'login',rolcanlogin,'superuser',rolsuper,'inherit',rolinherit,'bypassrls',rolbypassrls,'create_role',rolcreaterole,'create_db',rolcreatedb,'replication',rolreplication,'connection_limit',rolconnlimit,'valid_until',rolvaliduntil)order by oid)from pg_roles),'memberships',(select coalesce(jsonb_agg(jsonb_build_object('role_oid',roleid,'member_oid',member,'grantor_oid',grantor,'admin',admin_option,'inherit',inherit_option,'set',set_option)order by roleid,member,grantor),'[]')from pg_auth_members));";
export function authoritySql(project,key){assert(UUID.test(project)&&/^recovery39-create-[a-f0-9-]{36}$/u.test(key));return `select jsonb_build_object(
 'project',(select to_jsonb(t)from public.projects t where id='${project}'),
 'membership',(select to_jsonb(t)from public.project_memberships t where project_id='${project}' and principal_id='${CREATOR}'),
 'intent',(select to_jsonb(t)from eps.project_creation_intents t where project_id='${project}'),
 'idempotency',(select jsonb_agg(to_jsonb(t))from eps.idempotency_records t where principal_id='${CREATOR}' and operation='create_project' and key=${quote(key)}),
 'audit',(select jsonb_agg(to_jsonb(t))from eps.audit_events t where principal_id='${CREATOR}' and action='create_project' and resource_id='${project}'));`;}
export function validateAuthority(value,receipt,key){
 projectReceipt(receipt);assert.equal(value.project.id,receipt.id);assert.equal(value.membership.project_id,receipt.id);assert.equal(value.membership.principal_id,CREATOR);assert.equal(value.membership.active,true);assert.equal(value.membership.can_write,true);
 assert.equal(value.intent.project_id,receipt.id);assert.equal(value.intent.created_by,CREATOR);assert.equal(value.intent.presentation_type,'casting');assert.equal(value.idempotency.length,1);assert.equal(value.idempotency[0].principal_id,CREATOR);assert.equal(value.idempotency[0].operation,'create_project');assert.equal(value.idempotency[0].key,key);assert.deepEqual(value.idempotency[0].response,receipt);assert.equal(value.audit.length,1);assert.equal(value.audit[0].principal_id,CREATOR);assert.equal(value.audit[0].action,'create_project');assert.equal(value.audit[0].resource_id,receipt.id);return value;
}
export function filteredHistoricalRowsSql(project,key){
 assert(UUID.test(project)&&/^recovery39-create-[a-f0-9-]{36}$/u.test(key));
 return `DO $oldrows$ DECLARE r record;n bigint;h text;v jsonb:='{}';filter text;BEGIN
 FOR r IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN('eps','public','auth','storage','supabase_migrations') AND NOT(n.nspname='eps' AND c.relname='project_creation_intents') ORDER BY 1,2 LOOP
 filter:=CASE r.nspname||'.'||r.relname
 WHEN 'public.projects' THEN ' WHERE id<>''${project}'''
 WHEN 'public.project_memberships' THEN ' WHERE NOT(project_id=''${project}'' AND principal_id=''${CREATOR}'')'
 WHEN 'public.app_capability_grants' THEN ' WHERE principal_id<>''${CREATOR}'''
 WHEN 'auth.users' THEN ' WHERE id<>''${CREATOR}'''
 WHEN 'eps.audit_events' THEN ' WHERE NOT(principal_id=''${CREATOR}'' AND action=''create_project'' AND resource_id=''${project}'')'
 WHEN 'eps.idempotency_records' THEN ${quote(" WHERE NOT(principal_id='"+CREATOR+"' AND operation='create_project' AND key="+quote(key)+')')}
 WHEN 'supabase_migrations.schema_migrations' THEN ' WHERE version<>''20261101223342''' ELSE '' END;
 EXECUTE format('SELECT count(*),encode(sha256(convert_to(coalesce(string_agg(h,E''\\n''order by h),''''),''UTF8'')),''hex'')FROM(SELECT encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'')h FROM %I.%I t%s)s',r.nspname,r.relname,filter) INTO n,h;
 v:=v||jsonb_build_object(r.nspname||'.'||r.relname,jsonb_build_object('count',n,'sha256',h));END LOOP;
 PERFORM set_config('eps.recovery39.oldrows',v::text,true);END$oldrows$;SELECT current_setting('eps.recovery39.oldrows')::jsonb;`;
}
export function rlsDenialSql(project){assert(UUID.test(project));return `BEGIN;
DO $precondition$BEGIN IF NOT has_column_privilege('eps_project_creator','public.projects','id','INSERT') OR NOT has_column_privilege('eps_project_creator','public.projects','name','INSERT') OR NOT has_table_privilege('eps_project_creator','eps.project_creation_intents','INSERT') OR NOT(select relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='eps.project_creation_intents'::regclass) THEN RAISE EXCEPTION 'RECOVERY39_RLS_PRECONDITION_FAILED';END IF;END$precondition$;
CREATE FUNCTION pg_temp.expect39(query text)RETURNS void LANGUAGE plpgsql AS $test$BEGIN BEGIN EXECUTE query;EXCEPTION WHEN SQLSTATE '42501' THEN RETURN;END;RAISE EXCEPTION 'RECOVERY39_DIRECT_INSERT_ACCEPTED';END$test$;
SELECT set_config('request.jwt.claim.sub','${CREATOR}',true),set_config('request.jwt.claims','{"sub":"${CREATOR}","role":"authenticated","is_anonymous":false}',true);
SET SESSION AUTHORIZATION authenticated;
SELECT pg_temp.expect39($q$INSERT INTO public.projects(id,name)VALUES('a7390000-0000-4000-8000-000000000099','Denied direct write')$q$);
SELECT pg_temp.expect39($q$INSERT INTO public.project_memberships(project_id,principal_id,can_write,active)VALUES('${project}','${CREATOR}',true,true)$q$);
SELECT pg_temp.expect39($q$SELECT * FROM eps.project_creation_intents$q$);
SELECT pg_temp.expect39($q$SET LOCAL ROLE eps_project_creator$q$);
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION eps_project_creator;
DO $identity$BEGIN IF auth.uid() IS DISTINCT FROM '${CREATOR}'::uuid THEN RAISE EXCEPTION 'RECOVERY39_RLS_IDENTITY_FAILED';END IF;END$identity$;
SELECT pg_temp.expect39($q$INSERT INTO public.projects(id,name)VALUES('a7390000-0000-4000-8000-000000000099','Denied by actual RLS')$q$);
SELECT pg_temp.expect39($q$INSERT INTO eps.project_creation_intents(project_id,presentation_type,created_by)VALUES('${project}','casting','a7390000-0000-4000-8000-000000000099')$q$);
RESET SESSION AUTHORIZATION;ROLLBACK;`;
}
