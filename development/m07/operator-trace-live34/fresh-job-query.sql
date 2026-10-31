-- Exact new scan; metadata only. Never reads stage/source/result/event payloads.
begin isolation level repeatable read read only;
set local search_path='';
set local statement_timeout='20s';
set local timezone='UTC';
with matched as (
 select j.id,j.kind,j.workspace_id,j.status,j.stage,j.attempt,j.correlation_id,j.n8n_execution_id,j.created_at,j.updated_at
 from eps.jobs j join eps.candidate_media m on m.source_job_id=j.id and m.source_asset_id=j.input_asset_id
 join eps.media_assets a on a.id=m.source_asset_id
 where j.id='3cf25d3b-c1ec-4347-af3b-fa48f3f0f5e7'::uuid and j.kind='candidate_scan'
 and j.workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa'::uuid and j.status='succeeded'
 and m.id='13614da0-9c0e-40c4-afbf-2c739f463a74'::uuid
 and m.candidate_id='25a3c924-7b6c-48e3-88ce-c72e72b99c6d'::uuid
 and a.id='d9db9907-5e60-4382-b61c-bb2b67709c09'::uuid
 and a.sha256='ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a'
), bounded_events as (
 select e.attempt_id,e.sequence,e.stage,e.event_type,e.created_at from eps.job_events e
 join matched j on j.id=e.job_id order by e.created_at,e.attempt_id,e.sequence limit 100
)
select jsonb_build_object(
 'database',current_database(),'operator',current_user,'observed_at',clock_timestamp(),'read_only',true,
 'exact_history34',(select encode(sha256(convert_to(jsonb_agg(version order by version)::text,'UTF8')),'hex')
 from supabase_migrations.schema_migrations)='6a58bdde0319e8e1f388dd9b61a6fe4e702c15c8a708e0860b50b985aee2fb3e',
 'english_enabled',(select count(*)=1 and bool_and(english_transcript_version='1.0')from eps.candidate_asset_config),
 'candidate_apply_source_attributes_preserved',(select
 encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='ffd7c9fb5c05923c1a61a6a2a8170daca99dba308ab5b804d65d69cd205287b2'
 and encode(sha256(convert_to((to_jsonb(p)-'prosrc')::text,'UTF8')),'hex')='c353bf720814e3321a5a8a91e65afdadd6f68ca5e104fff167a119585dd561f4'
 from pg_proc p where oid='eps.apply_candidate_scan(uuid,uuid,text,text,jsonb)'::regprocedure),
 'protected_m02_metadata_preserved',exists(select 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'::uuid
 and status='waiting_for_input'and stage='apply_specs'and attempt=3 and row_version=7),
 'match_count',(select count(*)from matched),
 'job',(select jsonb_build_object('id',id,'kind',kind,'workspace_id',workspace_id,'status',status,'stage',stage,'attempt',attempt,
 'request_id',case when correlation_id~'^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$'then correlation_id else null end,
 'workflow_execution_id',case when n8n_execution_id~'^[1-9][0-9]{0,15}$'then n8n_execution_id else null end,
 'created_at',created_at,'updated_at',updated_at)from matched),
 'events_total',(select count(*)from eps.job_events e join matched j on j.id=e.job_id),
 'events_truncated',(select count(*)>100 from eps.job_events e join matched j on j.id=e.job_id),
 'events',(select coalesce(jsonb_agg(to_jsonb(e)order by e.created_at,e.attempt_id,e.sequence),'[]'::jsonb)from bounded_events e),
 'outbox',(select jsonb_build_object('total',count(*),'pending',count(*)filter(where o.status='pending'),
 'leased',count(*)filter(where o.status='leased'),'delivered',count(*)filter(where o.status='delivered'),
 'dead',count(*)filter(where o.status='dead'))from eps.outbox_events o join matched j on j.id=o.job_id)
)as fresh_operator_job;
rollback;
