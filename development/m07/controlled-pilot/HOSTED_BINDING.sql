-- ROOT-EXECUTED hosted registry configuration only, after actual client/core receipts.
-- No Auth, enrollment, capabilities, provider configuration or local binding changes.
begin;set local search_path='';set local lock_timeout='5s';set local statement_timeout='30s';set local timezone='UTC';
lock table supabase_migrations.schema_migrations in share mode;
lock table eps.mcp_oauth_resources in share row exclusive mode;
lock table public.app_capability_grants,eps.app_settings,eps.presentation_versions,eps.version_slides,
 eps.presentation_version_assets,eps.media_assets in share mode;
do $hosted_binding$
declare client constant uuid:='__CLIENT_UUID__';actor constant uuid:='__ACTING_USER_UUID__';
 security jsonb;before_security jsonb;before_data jsonb;observed jsonb;before_caps jsonb;observed_caps jsonb;inserted integer;pass integer;
begin
 if current_user<>'postgres'or current_database()<>'postgres'
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218','20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824']::text[]
 or exists(select 1 from eps.mcp_oauth_resources)
 or exists(select 1 from pg_trigger where tgrelid='eps.mcp_oauth_resources'::regclass and not tgisinternal)
 or not exists(select 1 from public.app_capability_grants where principal_id=actor and active and capability='workspaces.read')
 or not exists(select 1 from public.app_capability_grants where principal_id=actor and active and capability='cast.read')
 then raise exception'HOSTED_BINDING_EMPTY_CANONICAL30_EXISTING_ACTOR_REQUIRED';end if;
 perform 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'for share;
 perform 1 from eps.specs where id=(select resource_id from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496')for share;
 for pass in 1..2 loop
  select jsonb_build_object(
 'owner_and_body',exists(select 1 from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid=to_regprocedure('eps.mcp_custom_access_token_hook(jsonb)')and r.rolname='eps_mcp_issuer_owner'and not r.rolsuper and not r.rolbypassrls and not r.rolcanlogin and not r.rolinherit and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication and p.prosecdef and p.provolatile='s'and p.prorettype='jsonb'::regtype and p.proconfig=array['search_path=""']::text[] and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='b6e422c7df5cb146e9d0c0aaaad6dfa7fc5373a36179d82284438cf599fd218c'),
 'auth_admin_execute',has_function_privilege('supabase_auth_admin','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE'),
 'no_public_client_execute',not(has_function_privilege('anon','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')or has_function_privilege('authenticated','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')or has_function_privilege('service_role','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')),
 'auth_admin_schema',has_schema_privilege('supabase_auth_admin','eps','USAGE')and not has_schema_privilege('supabase_auth_admin','eps','CREATE'),
 'auth_admin_no_other_eps_execute',not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps'and p.oid<>to_regprocedure('eps.mcp_custom_access_token_hook(jsonb)')and has_function_privilege('supabase_auth_admin',p.oid,'EXECUTE')),
 'no_issuer_schema_create',not(has_schema_privilege('eps_mcp_issuer_owner','eps','CREATE')or has_schema_privilege('eps_mcp_issuer_owner','public','CREATE')),
 'registry_forced_rls',exists(select 1 from pg_class where oid='eps.mcp_oauth_resources'::regclass and relrowsecurity and relforcerowsecurity),
 'capability_forced_rls',exists(select 1 from pg_class where oid='public.app_capability_grants'::regclass and relrowsecurity and relforcerowsecurity))into security;
  if security is distinct from jsonb_build_object('owner_and_body',true,'auth_admin_execute',true,'no_public_client_execute',true,'auth_admin_schema',true,'auth_admin_no_other_eps_execute',true,'no_issuer_schema_create',true,'registry_forced_rls',true,'capability_forced_rls',true)then raise exception'HOSTED_BINDING_EXACT_PRIVATE_HOOK_REQUIRED';end if;
  select jsonb_build_object(
 'versions',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(v)::text,E'\n'order by v.id),''),'UTF8')),'hex'))from eps.presentation_versions v),
 'slides',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(s)::text,E'\n'order by s.id),''),'UTF8')),'hex'))from eps.version_slides s),
 'pins',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(p)::text,E'\n'order by p.version_id,p.asset_id),''),'UTF8')),'hex'))from eps.presentation_version_assets p),
 'ready_asset_metadata',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(jsonb_build_object('version_id',v.id,'asset_id',a.id,'sha256',a.sha256,'size_bytes',a.size_bytes,'status',a.status)::text,E'\n'order by v.id,a.id),''),'UTF8')),'hex'))from eps.presentation_versions v join eps.presentation_version_assets p on p.version_id=v.id join eps.media_assets a on a.id=p.asset_id where v.status='ready'),
 'grants',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(g)::text,E'\n'order by g.principal_id,g.capability),''),'UTF8')),'hex'))from public.app_capability_grants g),
 'settings',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(s)::text,E'\n'order by s.singleton),''),'UTF8')),'hex'))from eps.app_settings s),
 'protected_m02',(select jsonb_build_object('id',j.id,'status',j.status,'stage',j.stage,'attempt',j.attempt,'row_version',j.row_version,'resource_id',j.resource_id,
  'manual_note_retained',position('Manual verification: preserve this instruction while extraction is pending.'in coalesce(s.normalized_instructions,''))>0,
  'spec_sha256',encode(sha256(convert_to(jsonb_build_object('id',s.id,'row_version',s.row_version,'normalized_instructions',s.normalized_instructions)::text,'UTF8')),'hex'))from eps.jobs j join eps.specs s on s.id=j.resource_id where j.id='b3f90268-147d-41d4-8875-2a6435df1496')
)into observed;
  if observed#>'{protected_m02,manual_note_retained}'is distinct from'true'::jsonb
  then raise exception'HOSTED_BINDING_PROTECTED_M02_REQUIRED';end if;
  select (select coalesce(jsonb_agg(capability order by capability),'[]')from public.app_capability_grants where principal_id=actor and active)into observed_caps;
  if pass=1 then
   before_security:=security;before_data:=observed;before_caps:=observed_caps;
   insert into eps.mcp_oauth_resources(resource,client_id,enabled)values('https://everyone-presentation-pilot.vercel.app/mcp',client,true);
   get diagnostics inserted=row_count;
   if inserted<>1 or(select count(*)from eps.mcp_oauth_resources)<>1
   or not exists(select 1 from eps.mcp_oauth_resources where resource='https://everyone-presentation-pilot.vercel.app/mcp'and client_id=client and enabled)
   then raise exception'HOSTED_BINDING_EXACT_ONE_INSERT_REQUIRED';end if;
  else
   if observed is distinct from before_data or security is distinct from before_security or observed_caps is distinct from before_caps
   then raise exception'HOSTED_BINDING_BUSINESS_OR_HOOK_STATE_CHANGED';end if;
  end if;
 end loop;
 perform set_config('eps.hosted_binding_result',jsonb_build_object('resource','https://everyone-presentation-pilot.vercel.app/mcp',
 'client_id',client,'enabled',true,'inserted_rows',inserted,'acting_user_id',actor,'producer_capabilities',observed_caps,
 'hook_security',security,'protected_metadata',observed,'business_and_hook_state_preserved',true)::text,true);
end$hosted_binding$;
select current_setting('eps.hosted_binding_result')::jsonb as hosted_binding_update;
commit;
