begin read only;
set local statement_timeout = '10s';
select jsonb_build_object(
  'postgres_version',current_setting('server_version'),
  'migrations',(select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations),
  'canonical_relations',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and (n.nspname='eps' or n.nspname='public' and c.relname in ('clients','projects','project_memberships','client_memberships','app_capability_grants'))),
  'runtime_roles',(select jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'bypassrls',rolbypassrls,'superuser',rolsuper,'create_role',rolcreaterole)) from pg_roles where rolname in ('eps_api_owner','eps_draft_owner')),
  'identity_inheritance',(select jsonb_build_object('inherit',inherit_option,'set',set_option,'admin',admin_option) from pg_auth_members where roleid=(select oid from pg_roles where rolname='authenticated') and member=(select oid from pg_roles where rolname='eps_api_owner')),
  'reverse_membership',pg_has_role('authenticated','eps_api_owner','MEMBER'),
  'user_rpc_security',(select jsonb_agg(jsonb_build_object('name',p.proname,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,'anonymous_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE')) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'eps_%' escape ''),
  'authenticated_private_select',has_table_privilege('authenticated','eps.workspaces','SELECT'),
  'authenticated_canonical_update',has_table_privilege('authenticated','public.projects','UPDATE'),
  'counts',jsonb_build_object('auth_users',(select count(*) from auth.users),'clients',(select count(*) from public.clients),'projects',(select count(*) from public.projects),'memberships',(select count(*) from public.project_memberships),'capability_grants',(select count(*) from public.app_capability_grants),'workspaces',(select count(*) from eps.workspaces),'media',(select count(*) from eps.media_assets),'buckets',(select count(*) from storage.buckets),'audience_presets',(select count(*) from eps.audience_presets)),
  'audience_defaults',(select jsonb_agg(jsonb_build_object('key',key,'scope',scope) order by key) from eps.audience_presets)
) as readback;
rollback;
