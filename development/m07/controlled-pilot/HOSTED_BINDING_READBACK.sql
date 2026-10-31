-- Fixed hosted binding readback; only public IDs, capabilities, booleans and business fingerprints.
begin isolation level repeatable read read only;set local search_path='';set local statement_timeout='30s';set local timezone='UTC';
do $hosted_binding_readback$
declare actor constant uuid:='__ACTING_USER_UUID__';observed jsonb;
begin
 select jsonb_build_object('database',current_database(),'operator',current_user,
 'history',(select array_agg(version order by version)from supabase_migrations.schema_migrations),
 'registry_trigger_count',(select count(*)from pg_trigger where tgrelid='eps.mcp_oauth_resources'::regclass and not tgisinternal),
 'bindings',(select coalesce(jsonb_agg(to_jsonb(r)order by resource,client_id),'[]')from eps.mcp_oauth_resources r),
 'acting_user_id',actor,'producer_capabilities',(select coalesce(jsonb_agg(capability order by capability),'[]')from public.app_capability_grants where principal_id=actor and active),'hook_security',jsonb_build_object(
 'owner_and_body',exists(select 1 from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid=to_regprocedure('eps.mcp_custom_access_token_hook(jsonb)')and r.rolname='eps_mcp_issuer_owner'and not r.rolsuper and not r.rolbypassrls and not r.rolcanlogin and not r.rolinherit and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication and p.prosecdef and p.provolatile='s'and p.prorettype='jsonb'::regtype and p.proconfig=array['search_path=""']::text[] and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='b6e422c7df5cb146e9d0c0aaaad6dfa7fc5373a36179d82284438cf599fd218c'),
 'auth_admin_execute',has_function_privilege('supabase_auth_admin','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE'),
 'no_public_client_execute',not(has_function_privilege('anon','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')or has_function_privilege('authenticated','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')or has_function_privilege('service_role','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')),
 'auth_admin_schema',has_schema_privilege('supabase_auth_admin','eps','USAGE')and not has_schema_privilege('supabase_auth_admin','eps','CREATE'),
 'auth_admin_no_other_eps_execute',not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps'and p.oid<>to_regprocedure('eps.mcp_custom_access_token_hook(jsonb)')and has_function_privilege('supabase_auth_admin',p.oid,'EXECUTE')),
 'no_issuer_schema_create',not(has_schema_privilege('eps_mcp_issuer_owner','eps','CREATE')or has_schema_privilege('eps_mcp_issuer_owner','public','CREATE')),
 'registry_forced_rls',exists(select 1 from pg_class where oid='eps.mcp_oauth_resources'::regclass and relrowsecurity and relforcerowsecurity),
 'capability_forced_rls',exists(select 1 from pg_class where oid='public.app_capability_grants'::regclass and relrowsecurity and relforcerowsecurity)),
 'protected_metadata',jsonb_build_object(
 'versions',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(v)::text,E'\n'order by v.id),''),'UTF8')),'hex'))from eps.presentation_versions v),
 'slides',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(s)::text,E'\n'order by s.id),''),'UTF8')),'hex'))from eps.version_slides s),
 'pins',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(p)::text,E'\n'order by p.version_id,p.asset_id),''),'UTF8')),'hex'))from eps.presentation_version_assets p),
 'ready_asset_metadata',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(jsonb_build_object('version_id',v.id,'asset_id',a.id,'sha256',a.sha256,'size_bytes',a.size_bytes,'status',a.status)::text,E'\n'order by v.id,a.id),''),'UTF8')),'hex'))from eps.presentation_versions v join eps.presentation_version_assets p on p.version_id=v.id join eps.media_assets a on a.id=p.asset_id where v.status='ready'),
 'grants',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(g)::text,E'\n'order by g.principal_id,g.capability),''),'UTF8')),'hex'))from public.app_capability_grants g),
 'settings',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(s)::text,E'\n'order by s.singleton),''),'UTF8')),'hex'))from eps.app_settings s),
 'protected_m02',(select jsonb_build_object('id',j.id,'status',j.status,'stage',j.stage,'attempt',j.attempt,'row_version',j.row_version,'resource_id',j.resource_id,
  'manual_note_retained',position('Manual verification: preserve this instruction while extraction is pending.'in coalesce(s.normalized_instructions,''))>0,
  'spec_sha256',encode(sha256(convert_to(jsonb_build_object('id',s.id,'row_version',s.row_version,'normalized_instructions',s.normalized_instructions)::text,'UTF8')),'hex'))from eps.jobs j join eps.specs s on s.id=j.resource_id where j.id='b3f90268-147d-41d4-8875-2a6435df1496')
))into observed;
 perform set_config('eps.hosted_binding_readback',observed::text,true);
end$hosted_binding_readback$;
select current_setting('eps.hosted_binding_readback')::jsonb as hosted_binding_readback;
rollback;
