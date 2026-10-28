begin read only;
set local statement_timeout = '10s';
select jsonb_build_object(
  'query_role',current_user,
  'postgres_auth_usage',has_schema_privilege('postgres','auth','USAGE'),
  'postgres_auth_grant_option',has_schema_privilege('postgres','auth','USAGE WITH GRANT OPTION'),
  'authenticated_auth_usage',has_schema_privilege('authenticated','auth','USAGE'),
  'anon_auth_usage',has_schema_privilege('anon','auth','USAGE'),
  'postgres_uid_grant_option',has_function_privilege('postgres','auth.uid()','EXECUTE WITH GRANT OPTION'),
  'postgres_jwt_grant_option',has_function_privilege('postgres','auth.jwt()','EXECUTE WITH GRANT OPTION'),
  'postgres_authenticated_member',pg_has_role('postgres','authenticated','MEMBER'),
  'postgres_auth_owner_member',pg_has_role('postgres','supabase_auth_admin','MEMBER'),
  'postgres_auth_namespace_owner_member',pg_has_role('postgres',(select nspowner from pg_namespace where nspname='auth'),'MEMBER')
) as auth_privileges;
rollback;
