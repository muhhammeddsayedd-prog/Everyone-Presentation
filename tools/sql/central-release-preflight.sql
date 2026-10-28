begin read only;
set local statement_timeout = '10s';
select jsonb_build_object(
  'query_role',current_user,'postgres_version',current_setting('server_version'),
  'eps_schema_present',exists(select 1 from pg_namespace where nspname='eps'),
  'business_collisions',(select coalesce(jsonb_agg(table_name),'[]') from information_schema.tables where table_schema='public' and table_name in ('clients','projects','project_memberships','client_memberships','app_capability_grants')),
  'role_collisions',(select coalesce(jsonb_agg(rolname),'[]') from pg_roles where rolname in ('eps_api_owner','eps_draft_owner')),
  'auth_users',(select count(*) from auth.users),
  'storage_buckets',(select count(*) from storage.buckets)
) as preflight;
rollback;
