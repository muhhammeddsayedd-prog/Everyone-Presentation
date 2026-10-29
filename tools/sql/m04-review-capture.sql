-- Fixed two-workspace M04 metadata observer. No personal scalars, source text,
-- proposal text, transcripts, credentials or private audit payloads returned.
begin isolation level repeatable read read only;
set local statement_timeout='30s';set local search_path='';set local timezone='UTC';
do $scope$begin
 if current_user<>'postgres'or current_database()<>'postgres'
 or not exists(select 1 from pg_roles where rolname=current_user and(rolsuper or rolbypassrls))
 or(select count(*)from supabase_migrations.schema_migrations)not in(22,23)
 or(select count(*)from eps.workspaces where(id,project_id)in(
 ('098d5b48-42a3-475b-b562-735c9eafce80'::uuid,'4b70c8ce-18bd-4a8c-b5a9-bc1156c06463'::uuid),
 ('e470aefd-e0f7-480c-bf0d-170cb2cb7069'::uuid,'bd14d10f-b1c5-4d6a-8b4d-e5c48208433c'::uuid))and archived_at is null)<>2
 or(select count(*)from eps.jobs where workspace_id in('098d5b48-42a3-475b-b562-735c9eafce80','e470aefd-e0f7-480c-bf0d-170cb2cb7069')and kind in('ai_suggestion','review_fit'))>128
 or(select count(*)from eps.presentation_series where workspace_id in('098d5b48-42a3-475b-b562-735c9eafce80','e470aefd-e0f7-480c-bf0d-170cb2cb7069'))>64
 or(select count(*)from eps.assignments where workspace_id in('098d5b48-42a3-475b-b562-735c9eafce80','e470aefd-e0f7-480c-bf0d-170cb2cb7069'))>512
 or(select count(*)from eps.assignment_change_events where workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'and payload#>>'{details,resource_id}'='6354dd4c-b790-430c-a1b7-40902fa70271')>128
 then raise exception'M04_REVIEW_CAPTURE_SCOPE_UNCONFIRMED';end if;
end$scope$;
with workspaces as(select *from eps.workspaces where id in('098d5b48-42a3-475b-b562-735c9eafce80','e470aefd-e0f7-480c-bf0d-170cb2cb7069')),
series as(select s.*from eps.presentation_series s join workspaces w on w.id=s.workspace_id),
reviews as materialized(select s.id,s.workspace_id,eps.review_snapshot_data(s.workspace_id,s.id,null)payload from series s where not s.archived),
jobs as(select j.*from eps.jobs j join workspaces w on w.id=j.workspace_id where j.kind in('ai_suggestion','review_fit')),
suggestions as(select s.*from eps.ai_suggestions s join jobs j on j.id=s.job_id),
fits as(select f.*from eps.review_fit_results f join jobs j on j.id=f.job_id),
assignments as(select a.*from eps.assignments a join workspaces w on w.id=a.workspace_id),
waiter_events as(select *from eps.assignment_change_events where workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'and payload#>>'{details,resource_id}'='6354dd4c-b790-430c-a1b7-40902fa70271'),
old_jobs as(select *from eps.jobs where id in(
'a9715586-7fa5-4056-9c44-ef410929ee40','d24f8cb5-f3d4-47ce-a54d-d3b042309518','4b813dcd-c831-43f7-9234-9be73edf7297',
'7bc09d3b-7a4c-415d-a76e-ac6fa2f94ca9','035db630-c074-4951-bc14-fd88b261d15c','17dfcc28-e075-45cd-8b81-ec83b27b76a5',
'e3d64049-2356-44ec-af42-84c22530df91','16ec9b26-78d2-42f0-9f06-56a55d83a012','739aa2fc-4d0b-4f6f-8a89-518fc7f0ec56'))
select jsonb_build_object(
'observed_at',clock_timestamp(),'query_role',current_user,'database',current_database(),
'unrestricted_visibility',exists(select 1 from pg_roles where rolname=current_user and(rolsuper or rolbypassrls)),
'versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
'workspaces',(select jsonb_agg(jsonb_build_object('id',id,'project_id',project_id,'row_version',row_version,'draft_revision',draft_revision,'archived',archived_at is not null)order by id)from workspaces),
'series',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'workspace_id',workspace_id,'output_type',output_type,'audience_preset_id',audience_preset_id,'audience_scope',audience_snapshot->>'scope',
 'title_sha256',encode(sha256(convert_to(title,'UTF8')),'hex'),'audience_sha256',encode(sha256(convert_to(audience_snapshot::text,'UTF8')),'hex'),
 'template_key',template_key,'template_version',template_version,'template_content_sha256',template_content_sha256,'font_key',font_key,'row_version',row_version,'archived',archived)order by id),'[]')from series),
'reviews',(select coalesce(jsonb_agg(jsonb_build_object('series_id',r.id,'workspace_id',r.workspace_id,'input_fingerprint',r.payload->>'input_fingerprint','draft_revision',r.payload->'draft_revision','output_type',r.payload->>'output_type',
 'candidate_slide_count',r.payload->'candidate_slide_count','pending_slide_count',r.payload->'pending_slide_count','expected_page_count',jsonb_array_length(r.payload->'slides')+1,
 'expected_tenfield_rectangle_count',(r.payload->>'candidate_slide_count')::bigint*10,'total_rectangles_persisted',false,
 'cover_sha256',encode(sha256(convert_to((r.payload->'cover')::text,'UTF8')),'hex'),
 'slides',(select coalesce(jsonb_agg(jsonb_build_object('order',v.ordinal,'kind',v.value->>'kind','role_id',v.value->'role_id','slot_id',v.value->'slot_id',
  'assignment_id',v.value->'assignment_id','candidate_id',v.value->'candidate_id','candidate_media_id',v.value->'candidate_media_id','position',v.value->'position','review_status',v.value->'review_status',
  'fields_sha256',encode(sha256(convert_to((v.value->'fields')::text,'UTF8')),'hex'),'source_fields_sha256',encode(sha256(convert_to((v.value->'source_fields')::text,'UTF8')),'hex'),
  'requirements_sha256',encode(sha256(convert_to((v.value->'requirements')::text,'UTF8')),'hex'),
  'frame_asset_ids',(select coalesce(jsonb_agg(f.value->'asset_id'order by f.ordinal),'[]')from jsonb_array_elements(v.value->'frames')with ordinality f(value,ordinal)),
  'video_asset_id',v.value->'video_asset_id')order by v.ordinal),'[]')from jsonb_array_elements(r.payload->'slides')with ordinality v(value,ordinal)))order by r.id),'[]')from reviews r),
'jobs',(select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'workspace_id',j.workspace_id,'resource_id',j.resource_id,'kind',j.kind,'status',j.status,'stage',j.stage,'attempt',j.attempt,
 'input_hash',j.input_hash,'input_hash_matches',j.input_hash=encode(sha256(convert_to(j.input::text,'UTF8')),'hex'),'configuration_sha256',encode(sha256(convert_to((j.input->'configuration')::text,'UTF8')),'hex'),
 'n8n_execution_id',j.n8n_execution_id,'created_at',j.created_at,'error_code',j.error->>'code',
 'completed_stages',(select coalesce(jsonb_agg(jsonb_build_object('stage',d.value->>'stage','attempt_id',d.value->>'attempt_id','input_hash_matches',d.value->>'input_hash'=j.input_hash,'result_sha256',encode(sha256(convert_to((d.value->'result')::text,'UTF8')),'hex'))order by d.ordinal),'[]')from jsonb_array_elements(j.completed_stages)with ordinality d(value,ordinal)),
 'outbox',(select coalesce(jsonb_agg(jsonb_build_object('stage',o.stage,'status',o.status,'generation',o.dispatch_generation,'attempt_count',o.attempt_count,'input_hash_matches',o.input_hash=j.input_hash)order by o.dispatch_generation),'[]')from eps.outbox_events o where o.job_id=j.id),
 'payloads',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'stage',p.stage,'attempt_id',p.attempt_id,'result_schema',p.result_schema,'input_hash_matches',p.input_hash=j.input_hash,
  'payload_sha256',encode(sha256(convert_to(p.payload::text,'UTF8')),'hex'),
  'metadata',case when p.payload?'metadata'then jsonb_build_object('provider',p.payload#>'{metadata,provider}','sdk_version',p.payload#>'{metadata,sdk_version}','requested_model',p.payload#>'{metadata,requested_model}','resolved_model',p.payload#>'{metadata,resolved_model}',
   'prompt_version',p.payload#>'{metadata,prompt_version}','prompt_sha256',p.payload#>'{metadata,prompt_sha256}','schema_sha256',p.payload#>'{metadata,schema_sha256}','input_sha256',p.payload#>'{metadata,input_sha256}',
   'response_id_sha256',encode(sha256(convert_to(p.payload#>>'{metadata,response_id}','UTF8')),'hex'),'request_id_sha256',encode(sha256(convert_to(p.payload#>>'{metadata,request_id}','UTF8')),'hex'),'usage',p.payload#>'{metadata,usage}')else null end)order by p.stage,p.id),'[]')from eps.review_stage_payloads p where p.job_id=j.id))order by j.created_at,j.id),'[]')from jobs j),
'suggestions',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'workspace_id',s.workspace_id,'job_id',s.job_id,'target_type',s.target_type,'target_id',s.target_id,'target_row_version',s.target_row_version,'field',s.field,
 'bound_context_sha256',s.bound_context_sha256,'proposal_sha256',encode(sha256(convert_to(s.proposal::text,'UTF8')),'hex'),'proposed_change_count',case when s.proposal is not null then jsonb_array_length(s.proposal->'proposed_changes')else 0 end,
 'current_assignment_wording_matches',case when s.target_type='assignment'and s.proposal is not null then exists(select 1 from eps.assignments a where a.id=s.target_id and a.workspace_id=s.workspace_id and a.slide_wording->>s.field=s.proposal->>'suggested_text')else null end)order by s.id),'[]')from suggestions s),
'fit_results',(select coalesce(jsonb_agg(jsonb_build_object('job_id',f.job_id,'workspace_id',f.workspace_id,'series_id',f.series_id,'input_fingerprint',f.input_fingerprint,'status',f.status,'error_code',f.error_code,'completed_at',f.completed_at,
 'result_sha256',encode(sha256(convert_to(f.result::text,'UTF8')),'hex'),'renderer_version',f.result->>'renderer_version','chromium_version',f.result->>'chromium_version','template_content_sha256',f.result->>'template_content_sha256',
 'font_hashes',f.result->'font_hashes','overflow_count',case when f.result is not null then jsonb_array_length(f.result->'overflows')else null end,
 'overflows',f.result->'overflows','total_rectangles_persisted',false,'matches_current_review',exists(select 1 from reviews r where r.id=f.series_id and r.payload->>'input_fingerprint'=f.input_fingerprint))order by f.completed_at,f.job_id),'[]')from fits f),
'waiter',jsonb_build_object('role_id','6354dd4c-b790-430c-a1b7-40902fa70271','role_active',exists(select 1 from eps.roles r where r.id='6354dd4c-b790-430c-a1b7-40902fa70271'and r.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'and r.archived_at is null and r.headcount=3),
 'active_slot_ids',(select coalesce(jsonb_agg(s.id order by s.sort_order,s.id),'[]')from eps.slots s where s.role_id='6354dd4c-b790-430c-a1b7-40902fa70271'and s.archived_at is null),
 'assignment_ids',(select coalesce(jsonb_agg(a.id order by a.id),'[]')from eps.assignments a join eps.slots s on s.id=a.slot_id where s.role_id='6354dd4c-b790-430c-a1b7-40902fa70271'),
 'archive_event_ids',(select coalesce(jsonb_agg(id order by created_at,id),'[]')from waiter_events where operation='archive_role'),
 'undo_event_ids',(select coalesce(jsonb_agg(id order by created_at,id),'[]')from waiter_events where operation='undo_retirement'),
 'consumed_archive_count',(select count(*)from waiter_events e join eps.assignment_change_consumptions c on c.event_id=e.id where e.operation='archive_role'),
 'archive_audit_count',(select count(*)from eps.audit_events where resource_id='6354dd4c-b790-430c-a1b7-40902fa70271'and action='casting.archive_role'),
 'undo_audit_count',(select count(*)from eps.audit_events where resource_id='6354dd4c-b790-430c-a1b7-40902fa70271'and action='casting.undo_retirement')),
'subject',(select jsonb_build_object('id',c.id,'row_version',c.row_version,'facts_fingerprint',eps.cast_fingerprint(c.facts,c.field_sources),'effective_reviewed',eps.cast_is_reviewed(c),
 'reviewed_facts_fingerprint',c.reviewed_facts_fingerprint,'candidate_media_id',m.id,'source_job_id',m.source_job_id,'source_asset_id',m.source_asset_id,'source_sha256',a.sha256,'source_size_bytes',a.size_bytes,
 'selected_frame_asset_ids',m.selected_frame_asset_ids,
 'frames',(select coalesce(jsonb_agg(jsonb_build_object('asset_id',f.asset_id,'sha256',fa.sha256,'timestamp_ms',fa.source_timestamp_ms,'width',fa.width,'height',fa.height,'ready',fa.status='ready','source_and_job_match',fa.source_asset_id=m.source_asset_id and fa.producing_job_id=m.source_job_id)order by fa.source_timestamp_ms,fa.id),'[]')from eps.candidate_media_frames f join eps.media_assets fa on fa.id=f.asset_id where f.candidate_media_id=m.id))from eps.candidates c join eps.candidate_media m on m.candidate_id=c.id and m.id='f5dff77f-092f-4777-9f56-3bbce4dee57c'join eps.media_assets a on a.id=m.source_asset_id where c.id='25a3c924-7b6c-48e3-88ce-c72e72b99c6d'),
'assignment_separation',(select coalesce(jsonb_agg(jsonb_build_object('assignment_id',a.id,'workspace_id',a.workspace_id,'slot_id',a.slot_id,'candidate_id',p.candidate_id,'position',a.position,'shortlist_included',a.shortlist_included,'archived',a.archived_at is not null,
 'presentation_notes_sha256',encode(sha256(convert_to(a.presentation_notes,'UTF8')),'hex'),'internal_notes_sha256',encode(sha256(convert_to(a.internal_notes,'UTF8')),'hex'),'slide_wording_sha256',encode(sha256(convert_to(a.slide_wording::text,'UTF8')),'hex'),
 'candidate_facts_fingerprint',eps.cast_fingerprint(c.facts,c.field_sources),
 'candidate_facts_sha256',encode(sha256(convert_to(c.facts::text,'UTF8')),'hex'),'candidate_field_sources_sha256',encode(sha256(convert_to(c.field_sources::text,'UTF8')),'hex'),
 'project_availability_sha256',encode(sha256(convert_to(p.availability,'UTF8')),'hex'))order by a.id),'[]')from assignments a join eps.workspace_candidates p on p.id=a.workspace_candidate_id join eps.candidates c on c.id=p.candidate_id),
'retained_profiles',(select coalesce(jsonb_agg(jsonb_build_object('job_id',j.id,'candidate_id',c.id,'candidate_media_id',m.id,'source_asset_id',m.source_asset_id,'source_sha256',a.sha256,
  'facts_sha256',encode(sha256(convert_to(c.facts::text,'UTF8')),'hex'),'unarchived',c.archived_at is null,'selected_frame_asset_ids',m.selected_frame_asset_ids,
  'frames',(select coalesce(jsonb_agg(jsonb_build_object('asset_id',f.asset_id,'sha256',fa.sha256,'timestamp_ms',fa.source_timestamp_ms,'width',fa.width,'height',fa.height,
   'ready',fa.status='ready','source_and_job_match',fa.source_asset_id=j.input_asset_id and fa.producing_job_id=j.id)order by fa.source_timestamp_ms,fa.id),'[]')
   from eps.candidate_media_frames f join eps.media_assets fa on fa.id=f.asset_id where f.candidate_media_id=m.id))order by j.id),'[]')
  from old_jobs j join eps.candidate_media m on m.source_job_id=j.id join eps.candidates c on c.id=m.candidate_id join eps.media_assets a on a.id=m.source_asset_id),
 'protected_m02',jsonb_build_object('job_id','b3f90268-147d-41d4-8875-2a6435df1496',
  'job_exists',exists(select 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'),
  'job_sha256',(select encode(sha256(convert_to(to_jsonb(j)::text,'UTF8')),'hex')from eps.jobs j where id='b3f90268-147d-41d4-8875-2a6435df1496'),
  'specs_id',(select resource_id from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'),
  'specs_sha256',(select encode(sha256(convert_to(to_jsonb(s)::text,'UTF8')),'hex')from eps.specs s join eps.jobs j on j.resource_id=s.id where j.id='b3f90268-147d-41d4-8875-2a6435df1496'),
  'manual_note_retained',coalesce((select position('Manual verification: preserve this instruction while extraction is pending.'in coalesce(s.normalized_instructions,''))>0 from eps.specs s join eps.jobs j on j.resource_id=s.id where j.id='b3f90268-147d-41d4-8875-2a6435df1496'),false),
  'source_inputs_count',(select count(*)from eps.specs_source_inputs where job_id='b3f90268-147d-41d4-8875-2a6435df1496'),
  'source_inputs_sha256',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(i)::text,E'\n'order by to_jsonb(i)::text),''),'UTF8')),'hex')from eps.specs_source_inputs i where job_id='b3f90268-147d-41d4-8875-2a6435df1496'))
)as m04_review_capture;
rollback;
