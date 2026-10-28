-- Fixed read-only post-release metadata. No key material or personal row values.
begin read only;
set local statement_timeout='10s';
select jsonb_build_object(
  'query_role',current_user,'database',current_database(),'postgres_version',current_setting('server_version'),
  'count_visibility_unrestricted',(select rolbypassrls or rolsuper from pg_roles where rolname=current_user),
  'migrations',(select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations),
  'canonical_relations',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and (n.nspname='eps' or n.nspname='public' and c.relname in('clients','projects','project_memberships','client_memberships','app_capability_grants'))),
  'user_rpc_security',(select jsonb_agg(jsonb_build_object('name',p.proname,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,
    'anonymous_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE')) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'eps\_%' escape '\'),
  'verifier_role',(select jsonb_build_object('name',rolname,'login',rolcanlogin,'superuser',rolsuper,'bypassrls',rolbypassrls,'create_role',rolcreaterole,'create_db',rolcreatedb) from pg_roles where rolname='eps_logo_verify_owner'),
  'verifier_auth_membership',(select jsonb_build_object('inherit',inherit_option,'set',set_option,'admin',admin_option) from pg_auth_members where roleid='authenticated'::regrole and member='eps_logo_verify_owner'::regrole),
  'unsafe_membership',pg_has_role('authenticated','eps_logo_verify_owner','MEMBER') or pg_has_role('anon','eps_logo_verify_owner','MEMBER')
    or pg_has_role('eps_api_owner','eps_logo_verify_owner','MEMBER') or pg_has_role('eps_logo_verify_owner','eps_api_owner','MEMBER'),
  'private_boundary',jsonb_build_object('user_key_read',has_table_privilege('authenticated','eps.logo_verification_keys','SELECT'),
    'api_key_read',has_table_privilege('eps_api_owner','eps.logo_verification_keys','SELECT'),
    'user_upload_read',has_table_privilege('authenticated','eps.upload_sessions','SELECT'),
    'api_checksum_write',has_column_privilege('eps_api_owner','eps.media_assets','sha256','UPDATE'),
    'api_width_write',has_column_privilege('eps_api_owner','eps.media_assets','width','UPDATE'),
    'verifier_project_write',has_table_privilege('eps_logo_verify_owner','public.projects','UPDATE'),
    'verifier_preset_write',has_table_privilege('eps_logo_verify_owner','eps.audience_presets','UPDATE'),
    'user_private_verifier_execute',has_function_privilege('authenticated','eps.logo_verify_receipt(eps.upload_sessions,text,text)','EXECUTE')),
  'brand_bucket',(select jsonb_build_object('id',id,'name',name,'public',public,'maximum_bytes',file_size_limit,'mime_types',allowed_mime_types) from storage.buckets where id='eps-brand-assets'),
  'logo_policies',(select jsonb_agg(jsonb_build_object('table',polrelid::regclass::text,'name',polname,'permissive',polpermissive,'command',polcmd,
    'roles',(select jsonb_agg(role_name order by role_name) from unnest(polroles) role_oid cross join lateral (select pg_get_userbyid(role_oid) role_name) r),
    'using',pg_get_expr(polqual,polrelid),'with_check',pg_get_expr(polwithcheck,polrelid)) order by polname)
    from pg_policy where polrelid in('storage.objects'::regclass,'storage.buckets'::regclass) and polname like 'eps\_logo\_%' escape '\'),
  'capability_uploads_remain_disabled',(select position('''available_purposes'',''[]''::jsonb' in regexp_replace(prosrc,'[[:space:]]','','g'))>0 from pg_proc where oid='public.eps_get_capabilities()'::regprocedure),
  'counts',jsonb_build_object('auth_users',(select count(*) from auth.users),'clients',(select count(*) from public.clients),
    'projects',(select count(*) from public.projects),'project_memberships',(select count(*) from public.project_memberships),
    'capability_grants',(select count(*) from public.app_capability_grants),'workspaces',(select count(*) from eps.workspaces),
    'media',(select count(*) from eps.media_assets),'uploads',(select count(*) from eps.upload_sessions),
    'verification_keys',(select count(*) from eps.logo_verification_keys),'buckets',(select count(*) from storage.buckets))
) as readback;
rollback;
