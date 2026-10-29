-- Fixed read-only source/review observer. Scalar comparison digests are PRIVATE
-- CLI output only; the observer never publishes them or an answer-key digest.
begin isolation level repeatable read read only;
set local statement_timeout='20s';
set local search_path='';
set local timezone='UTC';
with job as (
 select j.* from eps.jobs j join eps.workspaces w on w.id=j.workspace_id
 join eps.media_assets a on a.id=j.input_asset_id
 where j.id='9a5ddb61-6a9a-4157-b6be-8653cf2eadef'
 and j.kind='candidate_scan' and j.workspace_id='e470aefd-e0f7-480c-bf0d-170cb2cb7069'
 and w.project_id='bd14d10f-b1c5-4d6a-8b4d-e5c48208433c' and w.archived_at is null
 and j.input->>'project_id'=w.project_id::text and j.input->>'workspace_id'=w.id::text
 and j.input->>'target_candidate_id' is null
 and a.id='5f8a6d53-0da0-4064-aacf-aea6b9c47c81'
 and a.sha256='ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a'
 and a.size_bytes=4316429
), subject as (
 select c.*,m.id media_id,m.source_job_id,m.source_asset_id,m.extraction,m.selected_frame_asset_ids,j.requested_by
 from job j join eps.candidate_media m on m.source_job_id=j.id
 join eps.candidates c on c.id=m.candidate_id
 where c.id='25a3c924-7b6c-48e3-88ce-c72e72b99c6d' and m.id='f5dff77f-092f-4777-9f56-3bbce4dee57c'
 and m.source_asset_id=j.input_asset_id
), private_ages as (
 select
  (regexp_match(lower(s.facts->>'age_or_range'),'^[[:space:]]*([0-9]{1,3})[[:space:]]*(?:years?(?:[[:space:]]*old)?)?[[:space:]]*$'))[1]::integer current_age,
  (regexp_match(lower(s.extraction#>>'{facts,age_or_range}'),'^[[:space:]]*([0-9]{1,3})[[:space:]]*(?:years?(?:[[:space:]]*old)?)?[[:space:]]*$'))[1]::integer original_age
 from subject s
), audit as (
 select a.*,s.requested_by from eps.audit_events a join subject s on s.id=a.resource_id
 join job j on j.id=s.source_job_id
 where a.action in('cast.update_candidate','cast.confirm_candidate_reviewed') and a.created_at>=j.created_at
), old_jobs as (
 select * from eps.jobs where id in(
 'a9715586-7fa5-4056-9c44-ef410929ee40','d24f8cb5-f3d4-47ce-a54d-d3b042309518','4b813dcd-c831-43f7-9234-9be73edf7297',
 '7bc09d3b-7a4c-415d-a76e-ac6fa2f94ca9','035db630-c074-4951-bc14-fd88b261d15c','17dfcc28-e075-45cd-8b81-ec83b27b76a5',
 'e3d64049-2356-44ec-af42-84c22530df91','16ec9b26-78d2-42f0-9f06-56a55d83a012','739aa2fc-4d0b-4f6f-8a89-518fc7f0ec56')
)
select jsonb_build_object(
 'observed_at',clock_timestamp(),'query_role',current_user,'database',current_database(),
 'unrestricted_visibility',exists(select 1 from pg_roles where rolname=current_user and(rolsuper or rolbypassrls)),
 'versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'job',(select jsonb_build_object('id',j.id,'kind',j.kind,'workspace_id',j.workspace_id,'project_id',j.input->>'project_id',
  'status',j.status,'stage',j.stage,'input_sha256',j.input_hash,'target_candidate_id',j.input->'target_candidate_id')from job j),
 'source',(select jsonb_build_object('asset_id',a.id,'sha256',a.sha256,'size_bytes',a.size_bytes,'status',a.status)
  from job j join eps.media_assets a on a.id=j.input_asset_id),
 'candidate',(select jsonb_build_object('id',s.id,'candidate_media_id',s.media_id,'source_job_id',s.source_job_id,'source_asset_id',s.source_asset_id,
  'source_kind',s.source_kind,'unarchived',s.archived_at is null and s.merged_into_candidate_id is null,
  'created_by_matches_requester',s.created_by=s.requested_by,
  'effective_reviewed',eps.cast_is_reviewed(s.id_row),
  'review_fingerprint_matches',s.reviewed_facts_fingerprint=eps.cast_fingerprint(s.facts,s.field_sources),
  'facts_fingerprint',eps.cast_fingerprint(s.facts,s.field_sources),'reviewed_facts_fingerprint',s.reviewed_facts_fingerprint,
  'reviewer_matches_requester',s.reviewed_by=s.requested_by,'reviewed_at',s.reviewed_at,'row_version',s.row_version,
  'name_manual_by_requester',s.field_sources#>>'{name,kind}'='manual' and s.field_sources#>>'{name,principal_id}'=s.requested_by::text,
  'other_supplied_facts_unchanged',(s.facts-'name'-'casting_id')=((s.extraction->'facts')-'name'-'casting_id'),
  'populated_source_fact_count',(select count(*)from jsonb_each(s.extraction->'facts') v where v.key<>'casting_id' and v.value not in('null'::jsonb,'[]'::jsonb,'""'::jsonb)),
  'changed_supplied_field_paths',(select coalesce(jsonb_agg('facts.'||v.key order by v.key),'[]')from jsonb_each(s.extraction->'facts')v where v.key<>'casting_id' and s.facts->v.key is distinct from v.value),
  'extraction_matches_persisted_stage',exists(select 1 from eps.candidate_stage_payloads p join job j on j.id=p.job_id and j.input_hash=p.input_hash
   where p.stage='extract_candidate' and p.result_schema='candidate-extraction-stage.v1'
   and p.payload->>'source_asset_id'=s.source_asset_id::text and p.payload->'result'=s.extraction
   and exists(select 1 from jsonb_array_elements(j.completed_stages)done where done->>'stage'=p.stage
    and done->>'attempt_id'=p.attempt_id::text and done->>'input_hash'=j.input_hash and done#>>'{result,stage_output_id}'=p.id::text)),
  'selected_frame_asset_ids',s.selected_frame_asset_ids,
  'frames',(select coalesce(jsonb_agg(jsonb_build_object('asset_id',f.asset_id,'sha256',a.sha256,'timestamp_ms',a.source_timestamp_ms,'width',a.width,'height',a.height,
   'ready',a.status='ready','source_and_job_match',a.source_asset_id=s.source_asset_id and a.producing_job_id=s.source_job_id)order by a.source_timestamp_ms,a.id),'[]')
   from eps.candidate_media_frames f join eps.media_assets a on a.id=f.asset_id where f.candidate_media_id=s.media_id),
  'private_comparison',jsonb_build_object(
   'current_name_sha256',encode(sha256(convert_to(s.facts->>'name','UTF8')),'hex'),
   'original_name_sha256',encode(sha256(convert_to(s.extraction#>>'{facts,name}','UTF8')),'hex'),
   'current_age_integer_sha256',encode(sha256(convert_to(pa.current_age::text,'UTF8')),'hex'),
   'original_age_integer_sha256',encode(sha256(convert_to(pa.original_age::text,'UTF8')),'hex')))
  from(select subject.*,c id_row from subject join eps.candidates c on c.id=subject.id)s cross join private_ages pa),
 'audit',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'at',a.created_at,'actor_matches_requester',a.principal_id=a.requested_by)order by a.created_at,a.id),'[]')from audit a),
 'generation_capability',(select jsonb_build_object('capability','presentations.generate','requester_derived_from_job',true,
  'grant_count',count(g.principal_id),'active',bool_or(g.active),'state',case when count(g.principal_id)=0 then'absent'when bool_or(g.active)then'active'else'inactive'end)
  from job j left join public.app_capability_grants g on g.principal_id=j.requested_by and g.capability='presentations.generate'),
 'retained_profiles',(select coalesce(jsonb_agg(jsonb_build_object('job_id',j.id,'candidate_id',c.id,'candidate_media_id',m.id,'source_asset_id',m.source_asset_id,'source_sha256',a.sha256,
  'facts_sha256',encode(sha256(convert_to(c.facts::text,'UTF8')),'hex'),'unarchived',c.archived_at is null,'selected_frame_asset_ids',m.selected_frame_asset_ids,
  'frames',(select coalesce(jsonb_agg(jsonb_build_object('asset_id',f.asset_id,'sha256',fa.sha256,'timestamp_ms',fa.source_timestamp_ms,'width',fa.width,'height',fa.height,
   'ready',fa.status='ready','source_and_job_match',fa.source_asset_id=j.input_asset_id and fa.producing_job_id=j.id)order by fa.source_timestamp_ms,fa.id),'[]')
   from eps.candidate_media_frames f join eps.media_assets fa on fa.id=f.asset_id where f.candidate_media_id=m.id))order by j.id),'[]')
  from old_jobs j join eps.candidate_media m on m.source_job_id=j.id join eps.candidates c on c.id=m.candidate_id join eps.media_assets a on a.id=m.source_asset_id)
)as m03_reviewed;
rollback;
