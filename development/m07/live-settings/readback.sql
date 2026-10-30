begin read only;
set local statement_timeout='15s';set local search_path='';set local timezone='UTC';
select jsonb_build_object(
 'database',current_database(),'operator',current_user,'timezone',current_setting('TimeZone'),
 'migration_versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'settings',(select jsonb_build_object('template_version',template_version,'default_timezone',default_timezone,'row_version',row_version)from eps.app_settings where singleton),
 'other_grants_digest',(select md5(coalesce(jsonb_agg(to_jsonb(g)order by principal_id,capability)::text,''))from public.app_capability_grants g where not(principal_id='0a79a703-caba-47e5-93d4-42e32197037a'and capability='settings.manage')),
 'ready_versions_digest',(select md5(coalesce(jsonb_agg(to_jsonb(v)order by id)::text,''))from eps.presentation_versions v where status='ready'),
 'mutations',(select coalesce(jsonb_agg(jsonb_build_object('intent_key',key,'request_hash',request_hash,'response_row_version',response->'row_version','response_timezone',response->'default_timezone','created_at',created_at)order by created_at,key),'[]')from eps.idempotency_records where principal_id='0a79a703-caba-47e5-93d4-42e32197037a'and operation='settings.update_settings'),
 'audit',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'principal_id',principal_id,'action',action,'request_id',request_id,'client_type',client_type,'created_at',created_at)order by created_at,id),'[]')from eps.audit_events where action='settings.update_settings'),
 'mcp_resource_count',(select count(*)from eps.mcp_oauth_resources)
)as discovery;
commit;
