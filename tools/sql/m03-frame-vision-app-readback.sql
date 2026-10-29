-- One strict UUID substituted by the fixed observer from its ignored local intent.
-- Metadata only. No transcript, name, facts, free provider reason, image or Auth row.
begin isolation level repeatable read read only;
set local statement_timeout='20s';set local search_path='';set local timezone='UTC';
do $scope$begin
 if current_user<>'postgres'or current_database()<>'postgres'
  or not exists(select 1 from pg_roles where rolname=current_user and(rolsuper or rolbypassrls))
  or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from
  array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841','20261029180953']::text[]
 then raise exception 'M03_VISION_READONLY_HISTORY_OR_ROLE_UNCONFIRMED';end if;
end $scope$;
with intended as(select '__M03_VISION_JOB_UUID__'::uuid id),
jobs as(select j.*from eps.jobs j join intended i on i.id=j.id join eps.workspaces w on w.id=j.workspace_id
 join eps.media_assets a on a.id=j.input_asset_id
 where j.kind='candidate_scan'and j.workspace_id='e470aefd-e0f7-480c-bf0d-170cb2cb7069'
 and w.project_id='bd14d10f-b1c5-4d6a-8b4d-e5c48208433c'and w.archived_at is null
 and j.input->>'project_id'=w.project_id::text and j.input->>'workspace_id'=w.id::text and j.input->>'target_candidate_id'is null
 and a.sha256='ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a'and a.size_bytes=4316429),
payloads as(select p.*from eps.candidate_stage_payloads p join jobs j on j.id=p.job_id and j.input_hash=p.input_hash),
prepared as(select *from payloads where stage='prepare_candidate'),selected as(select *from payloads where stage='select_frames'),
applied as(select m.*from eps.candidate_media m join jobs j on j.id=m.source_job_id),
old_jobs as(select *from eps.jobs where id in(
 'a9715586-7fa5-4056-9c44-ef410929ee40','d24f8cb5-f3d4-47ce-a54d-d3b042309518','4b813dcd-c831-43f7-9234-9be73edf7297',
 '7bc09d3b-7a4c-415d-a76e-ac6fa2f94ca9','035db630-c074-4951-bc14-fd88b261d15c','17dfcc28-e075-45cd-8b81-ec83b27b76a5',
 'e3d64049-2356-44ec-af42-84c22530df91','16ec9b26-78d2-42f0-9f06-56a55d83a012','739aa2fc-4d0b-4f6f-8a89-518fc7f0ec56'))
select jsonb_build_object(
 'observed_at',clock_timestamp(),'query_role',current_user,'database',current_database(),
 'versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'job',(select jsonb_build_object('id',j.id,'kind',j.kind,'workspace_id',j.workspace_id,'project_id',j.input->'project_id','status',j.status,'stage',j.stage,
  'input_sha256',j.input_hash,'source_asset_id',j.input_asset_id,'upload_id',j.resource_id,'target_candidate_id',j.input->'target_candidate_id','created_at',j.created_at,
  'n8n_execution_id',j.n8n_execution_id,'extraction_model',j.input#>>'{configuration,extraction_model}',
  'completed_stages',(select coalesce(jsonb_agg(jsonb_build_object('stage',v.value->'stage','input_hash_matches',v.value->>'input_hash'=j.input_hash)order by v.ordinal),'[]')from jsonb_array_elements(j.completed_stages)with ordinality v(value,ordinal)),
  'outbox',(select coalesce(jsonb_agg(jsonb_build_object('stage',o.stage,'status',o.status,'input_hash_matches',o.input_hash=j.input_hash)order by o.dispatch_generation),'[]')from eps.outbox_events o where o.job_id=j.id))from jobs j),
 'source',(select jsonb_build_object('asset_id',a.id,'sha256',a.sha256,'size_bytes',a.size_bytes,'duration_ms',a.duration_ms,'width',a.width,'height',a.height,'status',a.status,'mime_type',a.mime_type,
  'declared_sha256',j.input->'source_declared_sha256','declared_size_bytes',j.input->'source_size_bytes','upload_id',u.id,'upload_status',u.status,
  'upload_actor_bound',u.principal_id=j.requested_by and u.workspace_id=j.workspace_id and u.asset_id=a.id and u.job_id=j.id and u.expected_sha256=a.sha256,
  'storage_object_exists',exists(select 1 from storage.objects o where o.bucket_id=a.bucket and o.name=a.object_key),
  'storage_size_bytes',(select case when o.metadata->>'size'~'^[0-9]{1,15}$'then(o.metadata->>'size')::bigint end from storage.objects o where o.bucket_id=a.bucket and o.name=a.object_key),
  'private_path_bound',a.bucket='eps-candidate-assets'and a.object_key like'assets/'||a.id::text||'/original.%'and a.origin_workspace_id=j.workspace_id)
  from jobs j join eps.media_assets a on a.id=j.input_asset_id join eps.candidate_uploads u on u.id=j.resource_id),
 'preparation',(select jsonb_build_object('payload_id',p.id,'attempt_id',p.attempt_id,'result_schema',p.result_schema,'input_hash_matches',p.input_hash=j.input_hash,
  'source_sha256',p.payload->'source_sha256','implementation_version',p.payload->'implementation_version',
  'sampled_frames',(select coalesce(jsonb_agg(jsonb_build_object('ordinal',v.ordinal,'frame_asset_id',v.value->'frame_asset_id','source_asset_id',v.value->'source_asset_id',
   'timestamp_ms',v.value->'timestamp_ms','width',v.value->'width','height',v.value->'height','sha256',v.value->'sha256','asset_sha256',a.sha256,
   'asset_timestamp_ms',a.source_timestamp_ms,'asset_width',a.width,'asset_height',a.height,'size_bytes',a.size_bytes,'status',a.status,'mime_type',a.mime_type,
   'source_and_job_match',a.source_asset_id=j.input_asset_id and a.producing_job_id=j.id,
   'storage_object_exists',exists(select 1 from storage.objects o where o.bucket_id=a.bucket and o.name=a.object_key),
   'registered_in_result',exists(select 1 from applied m join eps.candidate_media_frames f on f.candidate_media_id=m.id where f.asset_id=a.id))order by v.ordinal),'[]')
   from jsonb_array_elements(p.payload->'sampled_frames')with ordinality v(value,ordinal)left join eps.media_assets a on a.id::text=v.value->>'frame_asset_id'))from prepared p join jobs j on j.id=p.job_id),
 'selection',(select jsonb_build_object('payload_id',s.id,'attempt_id',s.attempt_id,'result_schema',s.result_schema,'input_hash_matches',s.input_hash=j.input_hash,
  'source_asset_id',s.payload->'source_asset_id','method',s.payload->'selection_method',
  'metadata',jsonb_build_object('provider',s.payload#>'{metadata,provider}','sdk_version',s.payload#>'{metadata,sdk_version}','requested_model',s.payload#>'{metadata,requested_model}',
   'resolved_model',s.payload#>'{metadata,resolved_model}','prompt_version',s.payload#>'{metadata,prompt_version}','prompt_sha256',s.payload#>'{metadata,prompt_sha256}',
   'schema_sha256',s.payload#>'{metadata,schema_sha256}','input_sha256',s.payload#>'{metadata,input_sha256}','frame_input_sha256',s.payload#>'{metadata,frame_input_sha256}',
   'response_id_sha256',case when s.payload#>>'{metadata,response_id}'is not null then encode(sha256(convert_to(s.payload#>>'{metadata,response_id}','UTF8')),'hex')end,
   'request_id_sha256',case when s.payload#>>'{metadata,request_id}'is not null then encode(sha256(convert_to(s.payload#>>'{metadata,request_id}','UTF8')),'hex')end,
   'usage',s.payload#>'{metadata,usage}'),
  'selected_frame_asset_ids',(select coalesce(jsonb_agg(v.value->'frame_asset_id'order by v.ordinal),'[]')from jsonb_array_elements(s.payload->'selected_frames')with ordinality v(value,ordinal)))from selected s join jobs j on j.id=s.job_id),
 'application',(select jsonb_build_object('candidate_id',m.candidate_id,'candidate_media_id',m.id,'source_asset_id',m.source_asset_id,'source_job_id',m.source_job_id,
  'processing_issues',m.processing_issues,'selected_frame_asset_ids',m.selected_frame_asset_ids,'registered_frame_count',(select count(*)from eps.candidate_media_frames f where f.candidate_media_id=m.id),
  'reviewed',c.reviewed_facts_fingerprint is not null,'source_kind',c.source_kind,'created_by_matches_job',c.created_by=j.requested_by)
  from applied m join eps.candidates c on c.id=m.candidate_id join jobs j on j.id=m.source_job_id),
 'retained_profiles',(select coalesce(jsonb_agg(jsonb_build_object('job_id',j.id,'candidate_id',c.id,'candidate_media_id',m.id,'source_asset_id',m.source_asset_id,'source_sha256',a.sha256,
  'facts_sha256',encode(sha256(convert_to(c.facts::text,'UTF8')),'hex'),'unarchived',c.archived_at is null,'selected_frame_asset_ids',m.selected_frame_asset_ids,
  'frames',(select coalesce(jsonb_agg(jsonb_build_object('asset_id',f.asset_id,'sha256',fa.sha256,'timestamp_ms',fa.source_timestamp_ms,'width',fa.width,'height',fa.height,
   'ready',fa.status='ready','source_and_job_match',fa.source_asset_id=j.input_asset_id and fa.producing_job_id=j.id)order by fa.source_timestamp_ms,fa.id),'[]')
   from eps.candidate_media_frames f join eps.media_assets fa on fa.id=f.asset_id where f.candidate_media_id=m.id))order by j.id),'[]')
  from old_jobs j join eps.candidate_media m on m.source_job_id=j.id join eps.candidates c on c.id=m.candidate_id join eps.media_assets a on a.id=m.source_asset_id)
)as m03_frame_vision;
rollback;
