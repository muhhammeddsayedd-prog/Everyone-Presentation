-- Effective permissions only. No Auth rows, tokens or authorization selectors.
begin isolation level repeatable read read only;
set local search_path='';
set local timezone='UTC';
set local statement_timeout='20s';
select jsonb_build_object(
 'database',current_database(),'operator',current_user,'observed_at',clock_timestamp(),
 'role',(select jsonb_build_object('name',rolname,'login',rolcanlogin,'inherit',rolinherit,'superuser',rolsuper,'bypass_rls',rolbypassrls,'create_db',rolcreatedb,'create_role',rolcreaterole,'replication',rolreplication)from pg_roles where rolname='eps_oauth_consent_owner'),
 'schema_usage',jsonb_build_object('auth',has_schema_privilege('eps_oauth_consent_owner','auth','USAGE'),'eps',has_schema_privilege('eps_oauth_consent_owner','eps','USAGE'),'public',has_schema_privilege('eps_oauth_consent_owner','public','USAGE')),
 'function_execute',jsonb_build_object(
  'auth_uid',has_function_privilege('eps_oauth_consent_owner','auth.uid()','EXECUTE'),
  'auth_jwt',has_function_privilege('eps_oauth_consent_owner','auth.jwt()','EXECUTE'),
  'browser_session',has_function_privilege('eps_oauth_consent_owner','eps.oauth_consent_browser_session()','EXECUTE'),
  'binding',has_function_privilege('eps_oauth_consent_owner','eps.oauth_consent_binding(text,text)','EXECUTE'),
  'binding_hash',has_function_privilege('eps_oauth_consent_owner','eps.oauth_consent_binding_hash(jsonb,text)','EXECUTE'),
  'authenticated_claim',has_function_privilege('authenticated','public.eps_oauth_consent_claim(text,text,text,uuid)','EXECUTE'),
  'authenticated_finish',has_function_privilege('authenticated','public.eps_oauth_consent_finish(text,text,uuid,text)','EXECUTE'),
  'anon_claim',has_function_privilege('anon','public.eps_oauth_consent_claim(text,text,text,uuid)','EXECUTE'),
  'anon_finish',has_function_privilege('anon','public.eps_oauth_consent_finish(text,text,uuid,text)','EXECUTE')),
 'session_select',(select jsonb_object_agg(name,has_column_privilege('eps_oauth_consent_owner','auth.sessions',name,'SELECT'))from unnest(array['id','user_id','oauth_client_id','not_after'])name),
 'registry_select',(select jsonb_object_agg(name,has_column_privilege('eps_oauth_consent_owner','eps.mcp_oauth_resources',name,'SELECT'))from unnest(array['resource','client_id','enabled'])name),
 'ledger',jsonb_build_object('select',has_table_privilege('eps_oauth_consent_owner','eps.oauth_consent_claims','SELECT'),'insert',has_table_privilege('eps_oauth_consent_owner','eps.oauth_consent_claims','INSERT'),'update',has_table_privilege('eps_oauth_consent_owner','eps.oauth_consent_claims','UPDATE'),
  'metadata',(select jsonb_build_object('owner',pg_get_userbyid(relowner),'rls',relrowsecurity,'force_rls',relforcerowsecurity)from pg_class where oid='eps.oauth_consent_claims'::regclass)),
 'auth_schema',(select jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl::text,'postgres_usage',has_schema_privilege('postgres','auth','USAGE'),'postgres_usage_grant_option',has_schema_privilege('postgres','auth','USAGE WITH GRANT OPTION'))from pg_namespace where nspname='auth'),
 'memberships',(select coalesce(jsonb_agg(jsonb_build_object('member',pg_get_userbyid(member),'role',pg_get_userbyid(roleid),'grantor',pg_get_userbyid(grantor),'admin',admin_option,'inherit',inherit_option,'set',set_option)order by member,roleid),'[]'::jsonb)from pg_auth_members where roleid=(select oid from pg_roles where rolname='eps_oauth_consent_owner')or member=(select oid from pg_roles where rolname='eps_oauth_consent_owner')),
 'effective_role_users',(select coalesce(jsonb_agg(rolname order by rolname),'[]'::jsonb)from pg_roles where pg_has_role(oid,'eps_oauth_consent_owner','USAGE')),
 'policies',(select coalesce(jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,'permissive',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check)order by schemaname,tablename,policyname),'[]'::jsonb)from pg_policies where policyname in('oauth_consent_ordinary_own_session','oauth_consent_enabled_registry','oauth_consent_own_claim')),
 'history_count',(select count(*)from supabase_migrations.schema_migrations)
)as oauth_privilege_metadata;
rollback;
