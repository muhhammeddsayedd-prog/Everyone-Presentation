-- Read-only native ACL semantics of SHA-pinned retained533 metadata. Does not replay a table or restore Auth.
-- Historical185052 owner identity is supplied numerically; that role was removed after exact cleanup.
begin read only;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='15s';
do $retained533$begin if current_database()<>'postgres'or(select system_identifier::text from pg_control_system())<>'7701520506262638626'
 or(select count(*)from supabase_migrations.schema_migrations)<>29
 or not exists(select 1 from pg_roles where rolname='postgres'and oid=16384)
 or not exists(select 1 from pg_roles where rolname='supabase_auth_admin'and oid=16504)
 or not exists(select 1 from pg_roles where rolname='dashboard_user'and oid=16514)
 then raise exception'RETAINED533_EXACT_LOCAL_ROLE_IDENTITIES_REQUIRED';end if;end$retained533$;
with auth_source as(select*from aclexplode('{postgres=arwdDxtm/supabase_auth_admin,supabase_auth_admin=arwdDxtm/supabase_auth_admin,dashboard_user=arwdDxtm/supabase_auth_admin}'::aclitem[])),auth_restored as(select*from aclexplode('{supabase_auth_admin=arwdDxtm/supabase_auth_admin,postgres=arwdDxtm/supabase_auth_admin,dashboard_user=arwdDxtm/supabase_auth_admin}'::aclitem[])),
claim_source as(select*from aclexplode(array[makeaclitem(185052::oid,185052::oid,'INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN',false)])),
claim_restored as(select*from aclexplode(acldefault('r'::"char",185052::oid))),
auth_diff as((select*from auth_source except select*from auth_restored)union all(select*from auth_restored except select*from auth_source)),
claim_diff as((select*from claim_source except select*from claim_restored)union all(select*from claim_restored except select*from claim_source))
select jsonb_build_object('scope','retained533_native_literal_acl_semantics_only','actual_table_restore_proved',false,
 'historical_claim_owner_oid',185052,'auth_source_entries',(select jsonb_agg(jsonb_build_object('grantor_oid',grantor,'grantee_oid',grantee,'privilege',privilege_type,'grantable',is_grantable)order by privilege_type,grantor,grantee,is_grantable)from auth_source),'auth_restored_entries',(select jsonb_agg(jsonb_build_object('grantor_oid',grantor,'grantee_oid',grantee,'privilege',privilege_type,'grantable',is_grantable)order by privilege_type,grantor,grantee,is_grantable)from auth_restored),
 'claim_source_entries',(select jsonb_agg(jsonb_build_object('grantor_oid',grantor,'grantee_oid',grantee,'privilege',privilege_type,'grantable',is_grantable)order by privilege_type,grantor,grantee,is_grantable)from claim_source),'claim_default_entries',(select jsonb_agg(jsonb_build_object('grantor_oid',grantor,'grantee_oid',grantee,'privilege',privilege_type,'grantable',is_grantable)order by privilege_type,grantor,grantee,is_grantable)from claim_restored),
 'auth_symmetric_difference',(select count(*)from auth_diff),'claim_symmetric_difference',(select count(*)from claim_diff));
rollback;
