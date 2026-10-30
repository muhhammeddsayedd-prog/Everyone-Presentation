begin read only;
set local statement_timeout='15s';
set local search_path='';
set local timezone='UTC';
select jsonb_build_object(
 'database',current_database(),'operator',current_user,'timezone',current_setting('TimeZone'),
 'migration_versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'eligible_identity_count',(select count(*)from auth.users where id='0a79a703-caba-47e5-93d4-42e32197037a' and lower(email)='mohamed.abdelrahman@everyone.film' and email_confirmed_at is not null and last_sign_in_at is not null and not is_anonymous and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp())),
 'capabilities',(select coalesce(jsonb_agg(jsonb_build_object('capability',capability,'active',active)order by capability),'[]')from public.app_capability_grants where principal_id='0a79a703-caba-47e5-93d4-42e32197037a'),
 'settings',(select jsonb_build_object('template_version',template_version,'default_timezone',default_timezone,'row_version',row_version)from eps.app_settings where singleton),
 'other_grants_digest',(select md5(coalesce(jsonb_agg(to_jsonb(g)order by principal_id,capability)::text,''))from public.app_capability_grants g where not(principal_id='0a79a703-caba-47e5-93d4-42e32197037a'and capability='settings.manage')),
 'ready_versions_digest',(select md5(coalesce(jsonb_agg(to_jsonb(v)order by id)::text,''))from eps.presentation_versions v where status='ready'),
 'mcp_resource_count',(select count(*)from eps.mcp_oauth_resources),
 'settings_audit_count',(select count(*)from eps.audit_events where action='settings.update_settings')
)as discovery;
commit;
