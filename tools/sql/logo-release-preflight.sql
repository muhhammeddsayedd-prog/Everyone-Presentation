-- Fixed cloud read-only preflight; counts are snapshots, not user-journey proof.
begin read only;
set local statement_timeout='10s';
select jsonb_build_object(
  'query_role',current_user,'database',current_database(),'postgres_version',current_setting('server_version'),
  'count_visibility_unrestricted',(select rolbypassrls or rolsuper from pg_roles where rolname=current_user),
  'migrations',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name) order by version),'[]'::jsonb) from supabase_migrations.schema_migrations),
  'logo_table_collisions',(select coalesce(jsonb_agg(c.relname order by c.relname),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='eps' and c.relname in('upload_sessions','logo_verification_keys')),
  'logo_role_collision',exists(select 1 from pg_roles where rolname='eps_logo_verify_owner'),
  'logo_bucket_collision',exists(select 1 from storage.buckets where id='eps-brand-assets' or name='eps-brand-assets'),
  'logo_function_collisions',(select coalesce(jsonb_agg(p.proname order by p.proname),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps' and p.proname like 'logo\_%' escape '\' or n.nspname='public' and p.proname in('eps_reserve_logo_upload','eps_get_logo_upload','eps_prepare_logo_completion','eps_finalize_logo_completion','eps_cancel_logo_upload','eps_get_logo_media')),
  'logo_policy_collisions',(select coalesce(jsonb_agg(polname order by polname),'[]'::jsonb) from pg_policy where polrelid in('storage.objects'::regclass,'storage.buckets'::regclass) and polname like 'eps\_logo\_%' escape '\'),
  'prerequisites',jsonb_build_object('storage_objects_rls',(select relrowsecurity from pg_class where oid='storage.objects'::regclass),
    'storage_buckets_rls',(select relrowsecurity from pg_class where oid='storage.buckets'::regclass),
    'storage_operation_helper',to_regprocedure('storage.allow_only_operation(text)') is not null,
    'hmac',to_regprocedure('extensions.hmac(bytea,bytea,text)') is not null,
    'bucket_insert',has_table_privilege(current_user,'storage.buckets','INSERT'),
    'authenticated_admin',exists(select 1 from pg_auth_members where roleid='authenticated'::regrole and member=current_user::regrole and admin_option),
    'storage_policy_delegate',coalesce(current_setting('supautils.policy_grants',true),'{}')::jsonb @> '{"postgres":["storage.buckets","storage.objects"]}'::jsonb),
  'counts',jsonb_build_object('auth_users',(select count(*) from auth.users),'clients',(select count(*) from public.clients),
    'projects',(select count(*) from public.projects),'project_memberships',(select count(*) from public.project_memberships),
    'capability_grants',(select count(*) from public.app_capability_grants),'workspaces',(select count(*) from eps.workspaces),
    'media',(select count(*) from eps.media_assets),'buckets',(select count(*) from storage.buckets))
) as preflight;
rollback;
