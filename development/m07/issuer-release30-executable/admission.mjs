/** Exact canonical/local admission compiler. No DB, provider, CLI or I/O calls. */
import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{isDeepStrictEqual}from'node:util';
import{normalizeDatabaseOid}from'../recovery29/identity.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const same=(a,b)=>assert(isDeepStrictEqual(a,b),'ISSUER30_EXACT_ADMISSION_REQUIRED');
const q=v=>"'"+v.replaceAll("'","''")+"'";
export const PROVEN_CANDIDATE_SHA='136de55221d05053f0d3ae40754f641d32d0edf3d8ed73f952c92e1d819bce03';
export const ISSUER_SUFFIX_SHA='6fdab1bd84db93d427780f86ff5d8797a4fc67580796f379df4876f7bb269018';
export function extractIssuerSuffix(bytes){
 assert.equal(sha(bytes),PROVEN_CANDIDATE_SHA,'ISSUER30_PROVEN_SOURCE_REQUIRED');
 const marker=Buffer.from('\ncreate role eps_mcp_issuer_owner'),offset=bytes.indexOf(marker);
 assert(offset>0&&bytes.indexOf(marker,offset+1)===-1);
 const suffix=bytes.subarray(offset);assert.equal(sha(suffix),ISSUER_SUFFIX_SHA);return suffix;
}
function roleIdentities(roles){
 assert(Array.isArray(roles)&&roles.length>0);const result=Object.create(null);
 for(const role of roles){assert(typeof role.name==='string'&&!Object.hasOwn(result,role.name));result[role.name]=String(normalizeDatabaseOid(role.oid));}
 return result;
}
export function assertAdmission(expected,observed){
 assert(observed&&typeof observed==='object');same(observed.catalog,expected.catalog);
 same(observed.protected_data,expected.protected_data);
 const a=observed.context,b=expected.context;
 assert(a.operator==='postgres'&&a.unrestricted_visibility===true);
 same(a.migration_versions,b.migration_versions);assert.equal(a.migration_versions.length,29);
 same(a.settings,b.settings);same(roleIdentities(a.all_roles),roleIdentities(b.all_roles));
 same(a.all_memberships,b.all_memberships);same(a.effective_privileges,b.effective_privileges);
 assert.equal(a.issuer_role_exists,false);assert.equal(a.issuer_function_count,0);assert.equal(a.issuer_policy_count,0);assert.equal(a.registry_count,0);
 assert.equal(observed.admission.active_jobs,0);assert.equal(observed.admission.leased_outbox,0);
 same(observed.admission.protected_m02,expected.admission.protected_m02);
}
export function ownedIdentityPredicate(identity){
 const match=/^eps_m07_issuer30_([a-f0-9]{32})$/u.exec(identity?.name??'');
 assert(match&&identity.owner==='postgres'&&Number.isSafeInteger(identity.oid)&&normalizeDatabaseOid(identity.oid)===identity.oid);
 const hex=match[1],uuid=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
 assert.equal(identity.marker,'eps-m07-issuer30:'+uuid);
 return `current_database() <> ${q(identity.name)} or not exists(select 1 from pg_catalog.pg_database where datname=current_database() and oid = ${identity.oid} and datdba::regrole::text='postgres' and pg_catalog.shobj_description(oid,'pg_database') = ${q(identity.marker)})`;
}
export function makeAdmissionSql(baseline,{catalog,data,owned}={}){
 assert.equal(sha(catalog),'1af59495b01424e6ec2578f6ea1f8ac362829577612c32b2cd373545a58b9098','ISSUER30_CATALOG_SOURCE_REQUIRED');
 assert.equal(sha(data),'931581121cf2548af7b244b5638d243176bed9a4a83241bd4f72998ddec90a81','ISSUER30_DATA_SOURCE_REQUIRED');
 assertAdmission(baseline,baseline);
 const tail="select coalesce(jsonb_object_agg(key,value),'{}')catalog from flat;";
 const catalogSql=catalog.toString('utf8');assert.equal(catalogSql.split(tail).length,2);
 const actualSql=catalogSql.replace(tail,"select coalesce(jsonb_object_agg(key,value),'{}')into actual_catalogue from flat;");
 const target=owned?ownedIdentityPredicate(owned):"current_database()<>'postgres'";
 const versions=baseline.context.migration_versions.map(q).join(',');
 const roleIds=JSON.stringify(roleIdentities(baseline.context.all_roles));
 const auth=baseline.context.effective_privileges.supabase_auth_admin;
 assert.equal(auth.schemas.eps.usage,false);assert.equal(auth.schemas.eps.create,false);
 assert.equal(auth.schemas.public.usage,true);assert.equal(auth.schemas.public.create,false);
 assert(!Object.entries(auth.functions).some(([name,v])=>/^(?:eps|public)\./u.test(name)&&v.execute));
 return `-- Issuer30 ${owned?'EXPLICIT OWNED LOCAL ADAPTER':'CANONICAL'} admission; no transaction ownership or provider activation.
-- Canonical project identity pyibofyctwnqpvktepse must also be bound by the release controller.
-- Global role OIDs are pinned; CLI-managed short credential expiry is not normalized into application metadata.
set local search_path='';set local timezone='UTC';set local standard_conforming_strings=on;set local lock_timeout='5s';set local statement_timeout='45s';
do $issuer30_target$begin
 if current_user<>'postgres' or ${target}
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array[${versions}]::text[]
 or exists(select 1 from pg_catalog.pg_roles where rolname='eps_mcp_issuer_owner')
 or exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='eps'and p.proname='mcp_custom_access_token_hook')
 or exists(select 1 from pg_catalog.pg_policies where(schemaname,tablename,policyname)in(('eps','mcp_oauth_resources','mcp_issuer_resource_lookup'),('public','app_capability_grants','mcp_issuer_capability_lookup')))
 then raise exception 'M07_ISSUER30_EXACT_TARGET_HISTORY_ABSENCE_REQUIRED';end if;
end$issuer30_target$;
${data.toString('utf8')}
do $issuer30_metadata$declare actual_catalogue jsonb;begin
${actualSql}
 if actual_catalogue is distinct from ${q(JSON.stringify(baseline.catalog))}::jsonb
 then raise exception 'M07_ISSUER30_EXACT_CATALOGUE_REQUIRED';end if;
 if current_setting('eps.m07_readback.old_data')::jsonb is distinct from ${q(JSON.stringify(baseline.protected_data))}::jsonb
 then raise exception 'M07_ISSUER30_EXACT_PROTECTED_DATA_REQUIRED';end if;
 if(select jsonb_object_agg(rolname,oid::text)from pg_catalog.pg_roles)is distinct from ${q(roleIds)}::jsonb
 then raise exception 'M07_ISSUER30_EXISTING_ROLE_IDENTITIES_REQUIRED';end if;
 if(select jsonb_build_object('template_version',template_version,'default_timezone',default_timezone,'row_version',row_version,'default_review_expiry_days',default_review_expiry_days)from eps.app_settings where singleton)is distinct from ${q(JSON.stringify(baseline.context.settings))}::jsonb
 or(select count(*)from eps.mcp_oauth_resources)<>0
 or(select count(*)from eps.jobs where status in('queued','running'))<>0
 or(select count(*)from eps.outbox_events where status='leased')<>0
 then raise exception 'M07_ISSUER30_CURRENT_SETTINGS_EMPTY_REGISTRY_AND_QUIESCENCE_REQUIRED';end if;
 if has_schema_privilege('supabase_auth_admin','eps','USAGE') or has_schema_privilege('supabase_auth_admin','eps','CREATE')
 or not has_schema_privilege('supabase_auth_admin','public','USAGE') or has_schema_privilege('supabase_auth_admin','public','CREATE')
 or exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public')and p.prokind='f'and has_function_privilege('supabase_auth_admin',p.oid,'EXECUTE'))
 then raise exception 'M07_ISSUER30_AUTH_ADMIN_EXISTING_EFFECTIVE_PRIVILEGES_REQUIRED';end if;
end$issuer30_metadata$;
`;
}
