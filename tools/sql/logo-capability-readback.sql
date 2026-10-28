begin read only;
set local statement_timeout='15s';
select jsonb_build_object(
 'query_role',current_user,'database',current_database(),
 'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
 'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'capability_rpc',(select jsonb_build_object('source',prosrc,'owner',pg_get_userbyid(proowner),'definer',prosecdef,'config',proconfig,
   'anon_execute',has_function_privilege('anon',oid,'EXECUTE'),
   'service_execute',has_function_privilege('service_role',oid,'EXECUTE'),
   'authenticated_execute',has_function_privilege('authenticated',oid,'EXECUTE'))
   from pg_proc where oid='public.eps_get_capabilities()'::regprocedure),
 'counts',jsonb_build_object('clients',(select count(*) from public.clients),
   'projects',(select count(*) from public.projects),'workspaces',(select count(*) from eps.workspaces),
   'media',(select count(*) from eps.media_assets),'uploads',(select count(*) from eps.upload_sessions),
   'verifier_keys',(select count(*) from eps.logo_verification_keys))
) as capability_release;
commit;
