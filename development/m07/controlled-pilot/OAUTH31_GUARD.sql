-- Read-only admission metadata only. No Auth rows, provider keys or client IDs.
begin isolation level repeatable read read only;
set local search_path='';set local timezone='UTC';set local statement_timeout='30s';
select jsonb_build_object('database',current_database(),'operator',current_user,
 'history',(select array_agg(version order by version)from supabase_migrations.schema_migrations),
 'hook_body_sha256',(select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')from pg_proc where oid=to_regprocedure('eps.mcp_custom_access_token_hook(jsonb)')),
 'ack_body_sha256',(select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')from pg_proc where oid=to_regprocedure('eps.specs_submit_ack(uuid,uuid,uuid)')),
 'hook_security',jsonb_build_object(
 'owner_and_body',exists(select 1 from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid=to_regprocedure('eps.mcp_custom_access_token_hook(jsonb)')and r.rolname='eps_mcp_issuer_owner'and not r.rolsuper and not r.rolbypassrls and not r.rolcanlogin and not r.rolinherit and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication and p.prosecdef and p.provolatile='s'and p.prorettype='jsonb'::regtype and p.proconfig=array['search_path=""']::text[] and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='b6e422c7df5cb146e9d0c0aaaad6dfa7fc5373a36179d82284438cf599fd218c'),
 'auth_admin_execute',has_function_privilege('supabase_auth_admin','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE'),
 'no_public_client_execute',not(has_function_privilege('anon','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')or has_function_privilege('authenticated','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')or has_function_privilege('service_role','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')),
 'auth_admin_schema',has_schema_privilege('supabase_auth_admin','eps','USAGE')and not has_schema_privilege('supabase_auth_admin','eps','CREATE'),
 'auth_admin_no_other_eps_execute',not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps'and p.oid<>to_regprocedure('eps.mcp_custom_access_token_hook(jsonb)')and has_function_privilege('supabase_auth_admin',p.oid,'EXECUTE')),
 'no_issuer_schema_create',not(has_schema_privilege('eps_mcp_issuer_owner','eps','CREATE')or has_schema_privilege('eps_mcp_issuer_owner','public','CREATE')),
 'registry_forced_rls',exists(select 1 from pg_class where oid='eps.mcp_oauth_resources'::regclass and relrowsecurity and relforcerowsecurity),
 'capability_forced_rls',exists(select 1 from pg_class where oid='public.app_capability_grants'::regclass and relrowsecurity and relforcerowsecurity)),
 'ack_security',jsonb_build_object(
 'owner_body',exists(select 1 from pg_proc p where p.oid=to_regprocedure('eps.specs_submit_ack(uuid,uuid,uuid)')and p.proowner::regrole::text='eps_specs_submit_owner'and not p.prosecdef and p.proacl::text='{eps_specs_submit_owner=X/eps_specs_submit_owner}'and p.proconfig=array['search_path=""']::text[] and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='e0a7c7be311e6b2139faf08238121f4687d379844a26dd602ff8331b54231481'),
 'owner_execute',has_function_privilege('eps_specs_submit_owner','eps.specs_submit_ack(uuid,uuid,uuid)','EXECUTE'),
 'public_execute_denied',(select bool_and(not has_function_privilege(role,'eps.specs_submit_ack(uuid,uuid,uuid)','EXECUTE'))from unnest(array['anon','authenticated','service_role'])role),
 'column_selects',(select bool_and(has_column_privilege('eps_specs_submit_owner',relation,column_name,'SELECT'))from(values('eps.jobs','id'),('eps.jobs','kind'),('eps.jobs','resource_id'),('eps.jobs','status'),('eps.jobs','workspace_id'),('eps.specs','id'),('eps.specs','workspace_id'))v(relation,column_name)),
 'whole_job_select_denied',not has_table_privilege('eps_specs_submit_owner','eps.jobs','SELECT'))
)as oauth31_guard;
rollback;
