-- Fixed operator configuration after coordinated issuer30. No identity grants.
begin;
set local search_path='';set local lock_timeout='5s';set local statement_timeout='20s';set local timezone='UTC';
do $$declare
 client constant uuid:='__CLIENT_UUID__';expected constant jsonb:=convert_from(decode('__HISTORY_HEX__','hex'),'utf8')::jsonb;
 before_ready text;before_settings text;before_caps text;inserted integer;
begin
 if current_user<>'postgres'or current_database()<>'postgres'
 or(select count(*)from supabase_migrations.schema_migrations)<>30
 or(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from expected
 then raise exception 'MCP_BIND_REVIEWED_ISSUER30_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('eps:m07-local-oauth-client-binding',0));
 lock table supabase_migrations.schema_migrations in share mode;
 lock table eps.mcp_oauth_resources in share row exclusive mode;
 if(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from expected
 or not exists(select 1 from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid=to_regprocedure('eps.mcp_custom_access_token_hook(jsonb)')and r.rolname='eps_mcp_issuer_owner'and not r.rolsuper and not r.rolbypassrls and not r.rolcanlogin and not r.rolinherit and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication and p.prosecdef and p.provolatile='s'and p.prorettype='jsonb'::regtype and p.proconfig=array['search_path=""']::text[] and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='b6e422c7df5cb146e9d0c0aaaad6dfa7fc5373a36179d82284438cf599fd218c')
 or not has_schema_privilege('supabase_auth_admin','eps','USAGE')
 or has_schema_privilege('supabase_auth_admin','eps','CREATE')
 or not has_function_privilege('supabase_auth_admin','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')
 or has_function_privilege('anon','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')
 or has_function_privilege('authenticated','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')
 or has_function_privilege('service_role','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')
 or exists(select 1 from eps.mcp_oauth_resources)
 or exists(select 1 from pg_trigger where tgrelid='eps.mcp_oauth_resources'::regclass and not tgisinternal)
 then raise exception 'MCP_BIND_EXISTING_CONFIGURATION_PRESERVED';end if;
 select md5(coalesce(jsonb_agg(to_jsonb(v)order by id)::text,''))into before_ready from eps.presentation_versions v where status='ready';
 select md5(coalesce(jsonb_agg(to_jsonb(s))::text,''))into before_settings from eps.app_settings s;
 select md5(coalesce(jsonb_agg(to_jsonb(g)order by principal_id,capability)::text,''))into before_caps from public.app_capability_grants g;
 insert into eps.mcp_oauth_resources(resource,client_id,enabled)values('http://127.0.0.1:3000/mcp',client,true);
 get diagnostics inserted=row_count;
 if inserted<>1 or(select count(*)from eps.mcp_oauth_resources)<>1
 or not exists(select 1 from eps.mcp_oauth_resources where resource='http://127.0.0.1:3000/mcp'and client_id=client and enabled)
 or(select md5(coalesce(jsonb_agg(to_jsonb(v)order by id)::text,''))from eps.presentation_versions v where status='ready')is distinct from before_ready
 or(select md5(coalesce(jsonb_agg(to_jsonb(s))::text,''))from eps.app_settings s)is distinct from before_settings
 or(select md5(coalesce(jsonb_agg(to_jsonb(g)order by principal_id,capability)::text,''))from public.app_capability_grants g)is distinct from before_caps
 then raise exception 'MCP_BIND_CONFIGURATION_UNCONFIRMED';end if;
 perform set_config('eps.m07_bound_client',jsonb_build_object('resource','http://127.0.0.1:3000/mcp','client_id',client,'enabled',true,'inserted_rows',inserted,'ready_settings_capabilities_unchanged',true)::text,true);
end$$;
select current_setting('eps.m07_bound_client')::jsonb as binding;
commit;
