-- Key metadata only. No raw key, key digest, session token or private payload.
begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='15s';
select jsonb_build_object('schema_version','1.0','query_role',current_user,'database',current_database(),
 'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
 'versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'gateway',(select jsonb_build_object('count',count(*),'enabled',bool_or(enabled),'key_present',bool_or(backend_key is not null),'key_bytes',coalesce(max(octet_length(backend_key)),0),'replay_ttl_seconds',min(replay_ttl_seconds),'session_ttl_seconds',min(session_ttl_seconds))from eps.review_gateway_config),
 'presentation_processing_enabled',(select enabled from eps.presentation_processing_config where id),
 'active_jobs',(select count(*)from eps.jobs where status in('queued','running')),'leased_outbox',(select count(*)from eps.outbox_events where status='leased'),
 'protected_m02',(select jsonb_build_object('id',j.id,'status',j.status,'error_code',j.error->>'code','manual_note_retained',position('Manual verification: preserve this instruction while extraction is pending.'in coalesce(s.normalized_instructions,''))>0)from eps.jobs j join eps.specs s on s.id=j.resource_id and s.workspace_id=j.workspace_id where j.id='b3f90268-147d-41d4-8875-2a6435df1496'))as m06_guest26_readiness;
rollback;
