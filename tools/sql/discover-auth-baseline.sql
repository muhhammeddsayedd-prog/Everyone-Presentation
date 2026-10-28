-- Metadata needed for the owner-authorized new canonical migration. Read only.
begin read only;
set local statement_timeout = '10s';
select jsonb_build_object(
  'auth_user_identity_columns', (select coalesce(jsonb_agg(jsonb_build_object('column',column_name,'type',data_type,'nullable',is_nullable)), '[]') from information_schema.columns where table_schema='auth' and table_name='users' and column_name in ('id','aud','role','email','deleted_at','is_anonymous')),
  'auth_identity_functions', (select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid))), '[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' and p.proname in ('uid','role','jwt')),
  'runtime_roles', (select coalesce(jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'bypassrls',rolbypassrls,'superuser',rolsuper)), '[]') from pg_roles where rolname in ('anon','authenticated','service_role','postgres','authenticator','eps_api_owner'))
) as auth_baseline;
rollback;
