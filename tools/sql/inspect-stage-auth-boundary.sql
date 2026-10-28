-- Fixed read-only catalog/grantability check; no Auth rows or identifiers.
begin read only;
set local lock_timeout='3s';
set local statement_timeout='15s';
select jsonb_build_object(
 'query_role',current_user,
 'postgres_auth_usage_grantable',has_schema_privilege(current_user,'auth','USAGE WITH GRANT OPTION'),
 'api_owner_auth_usage',has_schema_privilege('eps_api_owner','auth','USAGE'),
 'users_owner',(select pg_get_userbyid(relowner) from pg_class where oid='auth.users'::regclass),
 'users_rls',(select relrowsecurity from pg_class where oid='auth.users'::regclass),
 'users_forced_rls',(select relforcerowsecurity from pg_class where oid='auth.users'::regclass),
 'required_columns',(select jsonb_agg(jsonb_build_object('name',attname,
   'postgres_select_grantable',has_column_privilege(current_user,'auth.users',attname,'SELECT WITH GRANT OPTION'),
   'api_owner_select',has_column_privilege('eps_api_owner','auth.users',attname,'SELECT')) order by attname)
  from pg_attribute where attrelid='auth.users'::regclass and not attisdropped
   and attname in('id','is_anonymous','deleted_at','banned_until'))
) as stage_auth_boundary;
rollback;
