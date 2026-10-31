-- READ ONLY, exact owned-local29 observation. No clone, grants, role changes,
-- Auth rows, tokens, secret columns, reset, migration replay or cloud target.
begin isolation level repeatable read read only;
set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='15s';
do $target$begin
 if current_database()<>'postgres'
 or(select system_identifier::text from pg_control_system())<>'7701520506262638626'
 or(select count(*)from supabase_migrations.schema_migrations)<>29
 or(select max(version)from supabase_migrations.schema_migrations)<>'20261030111549'
 or not exists(select 1 from pg_roles where rolname='supabase_auth_admin'and oid=16504)
 or not exists(select 1 from pg_class where oid='auth.schema_migrations'::regclass
  and relowner=16504 and relacl::text='{supabase_auth_admin=arwdDxtm/supabase_auth_admin}'
  and not relrowsecurity and not relforcerowsecurity)
 then raise exception'RECOVERY33_ACL_EXACT_SOURCE_REQUIRED';end if;
end$target$;
with explicit_entries as(select grantor,grantee,privilege_type,is_grantable
 from aclexplode('{supabase_auth_admin=arwdDxtm/supabase_auth_admin}'::aclitem[])),
default_entries as(select grantor,grantee,privilege_type,is_grantable
 from aclexplode(coalesce(null::aclitem[],acldefault('r'::"char",16504::oid)))),
differences as((select *from explicit_entries except select *from default_entries)
 union all(select *from default_entries except select *from explicit_entries))
select jsonb_build_object('scope','exact_local29_read_only_acl_semantics','owner_role_oid',16504,
 'owner_role_name',(select rolname from pg_roles where oid=16504),
 'explicit_entry_count',(select count(*)from explicit_entries),'default_entry_count',(select count(*)from default_entries),
 'symmetric_difference_count',(select count(*)from differences),
 'expanded_explicit',(select jsonb_agg(jsonb_build_object('grantor_oid',grantor,'grantee_oid',grantee,'privilege',privilege_type,'grantable',is_grantable)order by privilege_type,grantor,grantee,is_grantable)from explicit_entries),
 'expanded_default',(select jsonb_agg(jsonb_build_object('grantor_oid',grantor,'grantee_oid',grantee,'privilege',privilege_type,'grantable',is_grantable)order by privilege_type,grantor,grantee,is_grantable)from default_entries),
 'source_owner_only',(select bool_and(grantor=16504 and grantee=16504 and not is_grantable)from explicit_entries),
 'default_owner_only',(select bool_and(grantor=16504 and grantee=16504 and not is_grantable)from default_entries));
rollback;
