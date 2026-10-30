begin read only;
set local search_path='';set local statement_timeout='15s';set local timezone='UTC';
select jsonb_build_object('database',current_database(),'operator',current_user,
 'history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'bindings',(select coalesce(jsonb_agg(to_jsonb(r)order by resource,client_id),'[]')from eps.mcp_oauth_resources r),
 'hook_present',to_regprocedure('eps.mcp_custom_access_token_hook(jsonb)')is not null,
 'hook_security',jsonb_build_object(
  'owner_and_body',exists(select 1 from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid=to_regprocedure('eps.mcp_custom_access_token_hook(jsonb)')and r.rolname='eps_mcp_issuer_owner'and not r.rolsuper and not r.rolbypassrls and not r.rolcanlogin and not r.rolinherit and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication and p.prosecdef and p.provolatile='s'and p.prorettype='jsonb'::regtype and p.proconfig=array['search_path=""']::text[] and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='b6e422c7df5cb146e9d0c0aaaad6dfa7fc5373a36179d82284438cf599fd218c'),
  'auth_admin_execute',has_function_privilege('supabase_auth_admin','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE'),
  'no_public_client_execute',not(has_function_privilege('anon','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')or has_function_privilege('authenticated','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')or has_function_privilege('service_role','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')),
  'auth_admin_schema',has_schema_privilege('supabase_auth_admin','eps','USAGE')and not has_schema_privilege('supabase_auth_admin','eps','CREATE'),
  'auth_admin_no_other_eps_execute',not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps'and p.oid<>to_regprocedure('eps.mcp_custom_access_token_hook(jsonb)')and has_function_privilege('supabase_auth_admin',p.oid,'EXECUTE')),
  'no_issuer_schema_create',not(has_schema_privilege('eps_mcp_issuer_owner','eps','CREATE')or has_schema_privilege('eps_mcp_issuer_owner','public','CREATE')),
  'registry_forced_rls',exists(select 1 from pg_class where oid='eps.mcp_oauth_resources'::regclass and relrowsecurity and relforcerowsecurity),
  'capability_forced_rls',exists(select 1 from pg_class where oid='public.app_capability_grants'::regclass and relrowsecurity and relforcerowsecurity)),
 'settings',(select jsonb_build_object('timezone',default_timezone,'template_version',template_version,'row_version',row_version)from eps.app_settings where singleton)
)as inspection;
commit;
