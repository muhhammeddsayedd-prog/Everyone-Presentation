-- Durable optional WF05 and native layout measurement on reviewed21 + M04 review core.
-- New work is disabled until coordinated worker/routing activation. Existing jobs unchanged.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
create role eps_review_stage_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_review_stage_owner to postgres;
grant usage on schema eps,public,extensions to eps_review_stage_owner;
create table eps.review_processing_config(id boolean primary key default true check(id),enabled boolean not null default false,model text not null check(model~'^[A-Za-z0-9._-]{1,200}$'),prompt_version text not null,renderer_version text not null);
insert into eps.review_processing_config(id,model,prompt_version,renderer_version)values(true,'gpt-6.1-sol','contextual_suggestion_v1','everyone-casting-fit-v1');
create table eps.ai_suggestions(
 id uuid primary key,workspace_id uuid not null references eps.workspaces(id),job_id uuid unique references eps.jobs(id),
 target_type text not null check(target_type in('assignment','role','workspace_candidate','candidate')),target_id uuid not null,target_row_version bigint not null,
 field text not null,bound_context_sha256 text not null check(bound_context_sha256~'^[a-f0-9]{64}$'),proposal jsonb,
 created_at timestamptz not null default clock_timestamp(),check(proposal is null or jsonb_typeof(proposal)='object')
);
create table eps.review_stage_payloads(
 id uuid primary key default gen_random_uuid(),job_id uuid not null references eps.jobs(id),workspace_id uuid not null references eps.workspaces(id),
 stage text not null,attempt_id uuid not null,input_hash text not null,result_schema text not null,payload jsonb not null check(jsonb_typeof(payload)='object'and octet_length(payload::text)<=1048576),
 created_at timestamptz not null default clock_timestamp(),unique(job_id,stage,input_hash)
);
create table eps.review_fit_results(
 job_id uuid primary key references eps.jobs(id),workspace_id uuid not null references eps.workspaces(id),series_id uuid not null references eps.presentation_series(id),
 input_fingerprint text not null check(input_fingerprint~'^[a-f0-9]{64}$'),status text not null check(status in('measured','failed')),result jsonb,error_code text,
 completed_at timestamptz not null default clock_timestamp(),check(status='measured'and result is not null and error_code is null or status='failed'and result is null and error_code is not null)
);
create index review_fit_scope on eps.review_fit_results(series_id,input_fingerprint,completed_at desc);
alter table eps.review_processing_config enable row level security;alter table eps.review_processing_config force row level security;
alter table eps.ai_suggestions enable row level security;alter table eps.ai_suggestions force row level security;
alter table eps.review_stage_payloads enable row level security;alter table eps.review_stage_payloads force row level security;
alter table eps.review_fit_results enable row level security;alter table eps.review_fit_results force row level security;
revoke all on eps.review_processing_config,eps.ai_suggestions,eps.review_stage_payloads,eps.review_fit_results from public,anon,authenticated,service_role;
grant select on eps.review_processing_config to eps_review_owner,eps_review_stage_owner;
grant select,insert,update on eps.ai_suggestions to eps_review_owner;
grant select,update on eps.ai_suggestions to eps_review_stage_owner;
grant select,insert on eps.review_stage_payloads,eps.review_fit_results to eps_review_stage_owner;
grant select on eps.review_fit_results to eps_review_owner;
create policy review_processing_config_read on eps.review_processing_config for select to eps_review_owner,eps_review_stage_owner using(true);
create policy review_suggestions_read on eps.ai_suggestions for select to eps_review_owner using(eps.review_scope(workspace_id)and eps.has_capability('cast.read'));
create policy review_suggestions_insert on eps.ai_suggestions for insert to eps_review_owner with check(eps.review_scope(workspace_id)and eps.project_scope((select project_id from eps.workspaces where id=workspace_id),true)and eps.has_capability('workspaces.write')and eps.has_capability('cast.read'));
create policy review_suggestions_job_update on eps.ai_suggestions for update to eps_review_owner using(eps.review_scope(workspace_id)and eps.has_capability('workspaces.write'))with check(eps.review_scope(workspace_id)and eps.has_capability('workspaces.write'));
create policy review_suggestions_service on eps.ai_suggestions for all to eps_review_stage_owner using(true)with check(true);
create policy review_payloads_service on eps.review_stage_payloads for all to eps_review_stage_owner using(true)with check(true);
create policy review_fit_service on eps.review_fit_results for all to eps_review_stage_owner using(true)with check(true);
create policy review_fit_read on eps.review_fit_results for select to eps_review_owner using(eps.review_scope(workspace_id));

alter table eps.jobs drop constraint jobs_kind_check;
alter table eps.jobs add constraint jobs_kind_check check(kind in('specs_extract','candidate_scan','frame_extract','ai_suggestion','review_fit'));
alter table eps.jobs drop constraint jobs_stage_check;
alter table eps.jobs add constraint jobs_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate','extract_frames','apply_frames','prepare_suggestion','generate_suggestion','validate_suggestion','measure_review_fit'));
alter table eps.jobs drop constraint jobs_kind_stage_check;
alter table eps.jobs add constraint jobs_kind_stage_check check(kind='specs_extract'and stage in('prepare_document','extract_specs','apply_specs')or kind='candidate_scan'and stage in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate')or kind='frame_extract'and stage in('extract_frames','apply_frames')or kind='ai_suggestion'and stage in('prepare_suggestion','generate_suggestion','validate_suggestion')or kind='review_fit'and stage='measure_review_fit');
alter table eps.jobs drop constraint jobs_input_hash_version_check;
alter table eps.jobs add constraint jobs_input_hash_version_check check(input_hash_version in('eps.specs-input.pg-jsonb.v1','eps.candidate-input.pg-jsonb.v1','eps.frame-input.pg-jsonb.v1','eps.review-job-input.pg-jsonb.v1'));
alter table eps.job_events drop constraint job_events_stage_check;
alter table eps.job_events add constraint job_events_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate','extract_frames','apply_frames','prepare_suggestion','generate_suggestion','validate_suggestion','measure_review_fit'));
alter table eps.outbox_events drop constraint outbox_events_stage_check;
alter table eps.outbox_events add constraint outbox_events_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate','extract_frames','apply_frames','prepare_suggestion','generate_suggestion','validate_suggestion','measure_review_fit'));
grant select,insert on eps.jobs,eps.outbox_events to eps_review_owner;
create policy review_jobs_user_read on eps.jobs for select to eps_review_owner using(kind in('ai_suggestion','review_fit')and eps.review_scope(workspace_id));
create policy review_jobs_user_insert on eps.jobs for insert to eps_review_owner with check(kind in('ai_suggestion','review_fit')and requested_by=auth.uid()and status='queued'and stage in('prepare_suggestion','measure_review_fit')and attempt=0 and dispatch_generation=1 and current_attempt_id is null and lease_token_digest is null and eps.review_scope(workspace_id)and eps.project_scope((select project_id from eps.workspaces where id=workspace_id),true)and eps.has_capability('cast.read')and(kind='ai_suggestion'and eps.has_capability('workspaces.write')or kind='review_fit'and eps.has_capability('workspaces.write')));
create policy review_outbox_user_read on eps.outbox_events for select to eps_review_owner using(exists(select 1 from eps.jobs j where j.id=job_id and j.kind in('ai_suggestion','review_fit')));
create policy review_outbox_user_insert on eps.outbox_events for insert to eps_review_owner with check(exists(select 1 from eps.jobs j where j.id=job_id and j.kind in('ai_suggestion','review_fit')and j.requested_by=auth.uid()and j.status='queued'));
grant select,update on eps.jobs to eps_review_stage_owner;
grant select,insert on eps.job_events,eps.outbox_events to eps_review_stage_owner;
create policy review_jobs_service_read on eps.jobs for select to eps_review_stage_owner using(kind in('ai_suggestion','review_fit'));
create policy review_jobs_service_update on eps.jobs for update to eps_review_stage_owner using(kind in('ai_suggestion','review_fit'))with check(kind in('ai_suggestion','review_fit'));
create policy review_events_service on eps.job_events for all to eps_review_stage_owner using(exists(select 1 from eps.jobs j where j.id=job_id))with check(exists(select 1 from eps.jobs j where j.id=job_id));
create policy review_outbox_service on eps.outbox_events for all to eps_review_stage_owner using(exists(select 1 from eps.jobs j where j.id=job_id))with check(exists(select 1 from eps.jobs j where j.id=job_id));
grant select on public.projects,public.clients,public.project_memberships,public.app_capability_grants,eps.workspaces,eps.specs,eps.roles,eps.slots,eps.assignments,eps.workspace_candidates,eps.candidates,eps.candidate_media,eps.candidate_media_frames,eps.media_assets,eps.presentation_templates,eps.presentation_series to eps_review_stage_owner;
grant update(id)on eps.workspaces to eps_review_stage_owner;
do $$declare table_name text;begin
 foreach table_name in array array['public.projects','public.clients','public.project_memberships','public.app_capability_grants','eps.workspaces','eps.specs','eps.roles','eps.slots','eps.assignments','eps.workspace_candidates','eps.candidates','eps.candidate_media','eps.candidate_media_frames','eps.media_assets','eps.presentation_templates','eps.presentation_series']loop
  execute format('create policy review_stage_read on %s for select to eps_review_stage_owner using(true)',table_name);
 end loop;
end$$;
create function eps.review_stage_can_write(p_principal uuid,p_workspace uuid,p_kind text)returns boolean language sql volatile security invoker set search_path=''as $$
 select exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id join public.project_memberships m on m.project_id=p.id and m.principal_id=p_principal
 where w.id=p_workspace and w.archived_at is null and p.archived_at is null and m.active and m.can_write and eps.job_requester_active(p_principal)
 and not exists(select 1 from unnest(array['projects.read','workspaces.read','workspaces.write','cast.read'])required where not exists(select 1 from public.app_capability_grants g where g.principal_id=p_principal and g.capability=required and g.active)))
$$;
create function eps.review_stage_source_matches(p_job eps.jobs)returns boolean language plpgsql volatile security definer set search_path=''as $$
declare item eps.ai_suggestions;context jsonb;review jsonb;begin
 if p_job.kind not in('ai_suggestion','review_fit')or p_job.input_hash_version<>'eps.review-job-input.pg-jsonb.v1'or p_job.input_hash<>encode(sha256(convert_to(p_job.input::text,'UTF8')),'hex')or p_job.input->>'workspace_id'<>p_job.workspace_id::text then return false;end if;
 if p_job.kind='ai_suggestion'then
  select * into item from eps.ai_suggestions where id=p_job.resource_id and job_id=p_job.id and workspace_id=p_job.workspace_id;
  if not found then return false;end if;
  context:=eps.review_target_context(p_job.workspace_id,item.target_type,item.target_id,item.field);
  return item.bound_context_sha256=context->>'bound_context_sha256'and item.target_row_version=(context->>'target_row_version')::bigint and p_job.input->>'source_text'=context->>'source_text'and p_job.input->'template'=context->'template';
 end if;
 if p_job.resource_id::text<>p_job.input->>'series_id'then return false;end if;
 review:=eps.review_snapshot_data(p_job.workspace_id,p_job.resource_id,null);
 return review->>'input_fingerprint'=p_job.input->>'expected_input_fingerprint'and review->'template'=p_job.input->'template';
exception when raise_exception then return false;end$$;
create function eps.review_is_job(p_job uuid)returns boolean language sql volatile security definer set search_path=''as $$select exists(select 1 from eps.jobs where id=p_job and kind in('ai_suggestion','review_fit'))$$;
create function eps.review_stage_lock(p_job uuid,p_require_access boolean default true)returns eps.jobs language plpgsql volatile security definer set search_path=''as $$
declare identity eps.jobs;job eps.jobs;begin
 select * into identity from eps.jobs where id=p_job and kind in('ai_suggestion','review_fit');if not found then perform eps.fail('RESOURCE_NOT_FOUND','Review processing job not found.',404);end if;
 perform 1 from eps.workspaces where id=identity.workspace_id for update;
 select * into job from eps.jobs where id=p_job and workspace_id=identity.workspace_id and resource_id=identity.resource_id and kind=identity.kind for update;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');
 if p_require_access and not eps.review_stage_can_write(job.requested_by,job.workspace_id,job.kind)then perform eps.fail('CAPABILITY_REQUIRED','The requester no longer has this processing authority.',403);end if;
 return job;
end$$;
create function eps.claim_review_job_stage(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;completed jsonb;token text;attempts integer;at_value timestamptz:=clock_timestamp();begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','stage','input_hash','workflow_execution_id'],array['job_id','stage','input_hash'])and p_input->>'stage'in('prepare_suggestion','generate_suggestion','validate_suggestion','measure_review_fit')and p_input->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.review_stage_lock((p_input->>'job_id')::uuid);at_value:=clock_timestamp();perform eps.specs_stage_assert(exists(select 1 from eps.review_processing_config where id and enabled),'DEPENDENCY_UNAVAILABLE');
 perform eps.specs_stage_assert(eps.review_stage_source_matches(job),'INPUT_CHANGED');perform eps.specs_stage_assert(job.input_hash=p_input->>'input_hash','INPUT_HASH_MISMATCH');
 if job.status='cancelled'or job.cancel_requested_at is not null then perform eps.fail('JOB_CANCELLED','Review processing was cancelled.',409);end if;
 select value into completed from jsonb_array_elements(job.completed_stages)value where value->>'stage'=p_input->>'stage'and value->>'input_hash'=job.input_hash;
 if completed is not null then return jsonb_build_object('job_id',job.id,'stage',p_input->>'stage','attempt_id',completed->>'attempt_id','lease_token','','lease_expires_at',completed->>'completed_at','already_completed',true,'input',jsonb_build_object('input_hash',job.input_hash,'result_schema',completed->>'result_schema','result',completed->'result'));end if;
 perform eps.specs_stage_assert(job.stage=p_input->>'stage','STAGE_OUT_OF_ORDER');
 if job.status='running'and job.lease_expires_at>at_value then perform eps.fail('JOB_ALREADY_RUNNING','Review stage already has an active lease.',409);end if;
 perform eps.specs_stage_assert(job.status in('queued','running')and job.available_at<=at_value,'JOB_NOT_AVAILABLE');attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);perform eps.specs_stage_assert(attempts<3,'RETRY_EXHAUSTED');
 token:=encode(extensions.gen_random_bytes(32),'hex');
 update eps.jobs set status='running',attempt=attempt+1,current_attempt_id=gen_random_uuid(),lease_token_digest=encode(sha256(convert_to(token,'UTF8')),'hex'),lease_expires_at=at_value+interval'90seconds',heartbeat_at=at_value,last_event_sequence=0,stage_attempts=jsonb_set(stage_attempts,array[stage],to_jsonb(attempts+1)),progress_completed=0,progress_total=null,error=null,n8n_execution_id=p_input->>'workflow_execution_id',row_version=row_version+1,updated_at=at_value where id=job.id returning * into job;
 return jsonb_build_object('job_id',job.id,'stage',job.stage,'attempt_id',job.current_attempt_id,'lease_token',token,'lease_expires_at',job.lease_expires_at,'already_completed',false,'input',job.input||jsonb_build_object('input_hash',job.input_hash));
end$$;
create function eps.get_review_stage_input(p_job_id uuid,p_attempt_id uuid,p_lease_token text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;generated jsonb;review jsonb;begin
 job:=eps.review_stage_lock(p_job_id);perform eps.specs_stage_assert(job.status='running'and job.current_attempt_id=p_attempt_id and job.cancel_requested_at is null and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(p_lease_token~'^[a-f0-9]{64}$'and job.lease_token_digest=encode(sha256(convert_to(p_lease_token,'UTF8')),'hex'),'LEASE_INVALID');perform eps.specs_stage_assert(eps.review_stage_source_matches(job),'INPUT_CHANGED');
 if job.kind='ai_suggestion'then
  if job.stage='validate_suggestion'then select payload into generated from eps.review_stage_payloads where job_id=job.id and input_hash=job.input_hash and stage='generate_suggestion';perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');end if;
  return job.input||jsonb_build_object('job_id',job.id,'attempt_id',p_attempt_id,'stage',job.stage,'input_hash',job.input_hash,'generated',generated);
 end if;
 review:=eps.review_snapshot_data(job.workspace_id,job.resource_id,null);
 return job.input||jsonb_build_object('job_id',job.id,'attempt_id',p_attempt_id,'stage',job.stage,'input_hash',job.input_hash,'review',review);
end$$;
create function eps.review_validate_proposal(p_job eps.jobs,p_value jsonb)returns void language plpgsql immutable security invoker set search_path=''as $$
declare metadata jsonb;change jsonb;usage jsonb;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['schema_version','suggested_text','proposed_changes','warnings','metadata'])and p_value->>'schema_version'='1.0'and jsonb_typeof(p_value->'suggested_text')='string'and length(btrim(p_value->>'suggested_text'))between 1 and 20000 and octet_length(p_value->>'suggested_text')<=32768 and p_value->'warnings'='[]'::jsonb and jsonb_typeof(p_value->'proposed_changes')='array'and jsonb_array_length(p_value->'proposed_changes')=1,'RESULT_INVALID');
 change:=p_value#>'{proposed_changes,0}';perform eps.specs_stage_assert(eps.specs_stage_shape(change,array['field','old_value','new_value'])and change->>'field'=p_job.input->>'field'and change->>'old_value'=p_job.input->>'source_text'and change->>'new_value'=p_value->>'suggested_text','RESULT_INVALID');
 metadata:=p_value->'metadata';perform eps.specs_stage_assert(eps.specs_stage_shape(metadata,array['provider','sdk_version','requested_model','resolved_model','request_id','response_id','prompt_version','input_sha256','usage','prompt_sha256','schema_sha256'])and metadata->>'provider'='openai'and metadata->>'sdk_version'='7.45.1'and metadata->>'requested_model'=p_job.input#>>'{configuration,model}'and metadata->>'prompt_version'=p_job.input#>>'{configuration,prompt_version}'and metadata->>'prompt_sha256'='8480a63823dc9be53ff4898c42df82f6e5b70ccc72100d141392d6c99766c242'and metadata->>'schema_sha256'~'^[a-f0-9]{64}$'and metadata->>'input_sha256'=p_job.input_hash and metadata->>'resolved_model'~'^[A-Za-z0-9._:-]{1,200}$'and metadata->>'response_id'~'^[A-Za-z0-9._:-]{1,200}$' and(metadata->'request_id'='null'or jsonb_typeof(metadata->'request_id')='string'and metadata->>'request_id'~'^[A-Za-z0-9._:-]{1,200}$'),'RESULT_INVALID');
 usage:=metadata->'usage';if usage<>'null'then perform eps.specs_stage_assert(eps.specs_stage_shape(usage,array['input_tokens','output_tokens','total_tokens'])and eps.specs_stage_integer(usage->'input_tokens')and eps.specs_stage_integer(usage->'output_tokens')and eps.specs_stage_integer(usage->'total_tokens')and(usage->>'input_tokens')::bigint+(usage->>'output_tokens')::bigint=(usage->>'total_tokens')::bigint,'RESULT_INVALID');end if;
end$$;
create function eps.review_validate_fit(p_job eps.jobs,p_value jsonb)returns void language plpgsql stable security invoker set search_path=''as $$
declare overflow jsonb;review jsonb;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['schema_version','input_fingerprint','template_content_sha256','renderer_version','chromium_version','font_hashes','overflows','measured_at'])and p_value->>'schema_version'='1.0'and p_value->>'input_fingerprint'=p_job.input->>'expected_input_fingerprint'and p_value->>'template_content_sha256'=p_job.input#>>'{template,content_sha256}'and p_value->>'renderer_version'=p_job.input#>>'{configuration,renderer_version}'and length(p_value->>'chromium_version')between 1 and 100 and jsonb_typeof(p_value->'font_hashes')='object'and jsonb_typeof(p_value->'measured_at')='string'and p_value->>'measured_at'~'(Z|[+-][0-9]{2}:[0-9]{2})$'and jsonb_typeof(p_value->'overflows')='array'and jsonb_array_length(p_value->'overflows')<=10000,'RESULT_INVALID');
 if p_value->'font_hashes'is distinct from(select font_hashes from eps.presentation_templates where key=p_job.input#>>'{template,key}'and version=p_job.input#>>'{template,version}'and content_sha256=p_job.input#>>'{template,content_sha256}')or exists(select 1 from jsonb_each_text(p_value->'font_hashes')where value!~'^[a-f0-9]{64}$')or(select count(*)from jsonb_object_keys(p_value->'font_hashes'))<>6 then perform eps.fail('RESULT_INVALID','Measured font inventory is invalid.',422);end if;
 begin if(p_value->>'measured_at')::timestamptz>clock_timestamp()+interval'5 minutes'then perform eps.fail('RESULT_INVALID','Measurement timestamp is invalid.',422);end if;exception when invalid_datetime_format or datetime_field_overflow then perform eps.fail('RESULT_INVALID','Measurement timestamp is invalid.',422);end;
 review:=eps.review_snapshot_data(p_job.workspace_id,p_job.resource_id,null);
 for overflow in select value from jsonb_array_elements(p_value->'overflows')loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(overflow,array['slide_index','field','axis','overflow_px'])and eps.specs_stage_integer(overflow->'slide_index',0,jsonb_array_length(review->'slides'))and jsonb_typeof(overflow->'field')='string'and length(overflow->>'field')between 1 and 100 and overflow->>'axis'in('horizontal','vertical')and jsonb_typeof(overflow->'overflow_px')='number'and(overflow->>'overflow_px')::numeric>0 and(overflow->>'overflow_px')::numeric<=100000000,'RESULT_INVALID');
 end loop;
end$$;
create policy review_stage_workspace_lock on eps.workspaces for update to eps_review_stage_owner using(true)with check(false);
create policy eps_review_stage_no_storage on storage.objects as restrictive for all to eps_review_stage_owner using(false)with check(false);
create policy eps_review_stage_no_buckets on storage.buckets as restrictive for all to eps_review_stage_owner using(false)with check(false);
grant execute on function eps.fail(text,text,integer,bigint),eps.specs_stage_assert(boolean,text),eps.specs_stage_shape(jsonb,text[],text[]),eps.specs_stage_integer(jsonb,bigint,bigint),eps.specs_stage_error(text,boolean,jsonb),eps.job_requester_active(uuid),eps.review_snapshot_data(uuid,uuid,text),eps.review_fields(jsonb,text,text),eps.review_template_dto(eps.presentation_series),eps.review_issue(text,text,uuid,text,text,text),eps.cast_fingerprint(jsonb,jsonb),eps.cast_canonical(jsonb),eps.input_uuid(text)to eps_review_stage_owner;
grant execute on function extensions.gen_random_bytes(integer)to eps_review_stage_owner;

create function eps.review_target_context(p_workspace uuid,p_type text,p_target uuid,p_field text)returns jsonb language plpgsql stable security invoker set search_path=''as $$
declare assignment eps.assignments;pool eps.workspace_candidates;candidate eps.candidates;role_item eps.roles;source text;target_version bigint;context jsonb;template eps.presentation_templates;begin
 select * into template from eps.presentation_templates where key='everyone-casting'and version='1.0.0'and registered;if not found then perform eps.fail('TEMPLATE_UNAVAILABLE','Registered template unavailable.',503);end if;
 if p_type='assignment'then
  if p_field not in('name_or_id','age_or_range','height_measurements','languages_accents','skills_experience','city','previous_projects_roles','classification','availability','presentation_notes')then perform eps.fail('VALIDATION_FAILED','Unsupported assignment field.',400);end if;
  select * into assignment from eps.assignments a where a.id=p_target and a.workspace_id=p_workspace and a.archived_at is null and exists(select 1 from eps.slots s join eps.roles r on r.id=s.role_id where s.id=a.slot_id and s.archived_at is null and r.archived_at is null);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Suggestion assignment unavailable.',404);end if;
  select * into pool from eps.workspace_candidates where id=assignment.workspace_candidate_id and workspace_id=p_workspace and archived_at is null;
  select * into candidate from eps.candidates where id=pool.candidate_id and merged_into_candidate_id is null;
  if candidate.id is null then perform eps.fail('RESOURCE_NOT_FOUND','Suggestion source profile unavailable.',404);end if;
  source:=(eps.review_fields(candidate.facts,pool.availability,assignment.presentation_notes)||jsonb_strip_nulls(assignment.slide_wording))->>p_field;target_version:=assignment.row_version;
  context:=jsonb_build_object('candidate_fingerprint',eps.cast_fingerprint(candidate.facts,candidate.field_sources),'pool_media_id',pool.selected_candidate_media_id,'pool_frames',to_jsonb(pool.selected_frame_asset_ids),'availability',pool.availability,'presentation_notes',assignment.presentation_notes,'slide_wording',assignment.slide_wording,'selected_media_content',(select jsonb_build_object('source_id',m.source_asset_id,'source_sha256',a.sha256,'source_status',a.status,'transcript_sha256',encode(sha256(convert_to(coalesce(m.original_transcript,''),'UTF8')),'hex'))from eps.candidate_media m join eps.media_assets a on a.id=m.source_asset_id where m.id=pool.selected_candidate_media_id),'frame_content',(select jsonb_agg(jsonb_build_object('id',f.id,'sha256',f.sha256,'status',f.status)order by v.ordinal)from unnest(pool.selected_frame_asset_ids)with ordinality v(id,ordinal)left join eps.media_assets f on f.id=v.id));
 elsif p_type='candidate'then
  if p_field not in('name','age_or_range','height_measurements','skills_experience','city','previous_projects_roles','classification')then perform eps.fail('VALIDATION_FAILED','Unsupported reusable text field.',400);end if;
  select * into candidate from eps.candidates c where c.id=p_target and c.archived_at is null and c.merged_into_candidate_id is null and exists(select 1 from eps.workspace_candidates p where p.workspace_id=p_workspace and p.candidate_id=c.id and p.archived_at is null);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Suggestion profile unavailable in this project.',404);end if;
  source:=candidate.facts->>p_field;target_version:=candidate.row_version;context:=jsonb_build_object('facts_fingerprint',eps.cast_fingerprint(candidate.facts,candidate.field_sources));
 elsif p_type='workspace_candidate'then
  if p_field<>'availability'then perform eps.fail('VALIDATION_FAILED','Unsupported project text field.',400);end if;
  select * into pool from eps.workspace_candidates where id=p_target and workspace_id=p_workspace and archived_at is null;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Suggestion project candidate unavailable.',404);end if;
  source:=pool.availability;target_version:=pool.row_version;context:=jsonb_build_object('availability',pool.availability,'selected_media',pool.selected_candidate_media_id,'selected_frames',to_jsonb(pool.selected_frame_asset_ids));
 elsif p_type='role'then
  if p_field not in('name','requirements.age_range','requirements.appearance_performance','requirements.location','requirements.availability_requirements','requirements.other_instructions')then perform eps.fail('VALIDATION_FAILED','Unsupported role text field.',400);end if;
  select * into role_item from eps.roles where id=p_target and workspace_id=p_workspace and archived_at is null;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Suggestion role unavailable.',404);end if;
  source:=case when p_field='name'then role_item.name else role_item.requirements->>split_part(p_field,'.',2)end;target_version:=role_item.row_version;context:=jsonb_build_object('name',role_item.name,'requirements',role_item.requirements,'clarifications',role_item.clarifications,'headcount',role_item.headcount);
 else perform eps.fail('VALIDATION_FAILED','Unsupported suggestion target.',400);end if;
 if source is null or length(btrim(source))=0 or source in('Not provided','Pending')then perform eps.fail('AI_SOURCE_REQUIRED','Provide source text before requesting wording.',409);end if;
 if octet_length(source)>20000 then perform eps.fail('VALIDATION_FAILED','The selected text exceeds the bounded AI context budget.',400);end if;
 return jsonb_build_object('source_text',source,'target_row_version',target_version,'template',jsonb_build_object('key',template.key,'version',template.version,'content_sha256',template.content_sha256,'font_key',template.font_key),
 'bound_context_sha256',encode(sha256(convert_to(jsonb_build_object('target_type',p_type,'target_id',p_target,'target_row_version',target_version,'field',p_field,'source_text',source,'context',context,'template',to_jsonb(template)-'registered')::text,'UTF8')),'hex'));
end$$;
create function public.eps_create_ai_suggestion(p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare workspace uuid;target uuid;expected bigint;binding jsonb;configuration eps.review_processing_config;input_value jsonb;job_input jsonb;cached jsonb;suggestion uuid:=gen_random_uuid();job uuid:=gen_random_uuid();input_hash text;begin
 perform eps.review_body(p_input,array['workspace_id','capability','target_type','target_id','target_row_version','field','instruction','source_text'],array['workspace_id','capability','target_type','target_id','target_row_version','field','instruction']);
 workspace:=eps.casting_uuid(p_input->'workspace_id');target:=eps.casting_uuid(p_input->'target_id');expected:=eps.casting_version(p_input->'target_row_version');
 perform eps.require_capability('workspaces.write');perform eps.require_capability('cast.read');perform eps.review_require(workspace);
 if not eps.project_scope((select project_id from eps.workspaces where id=workspace),true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable suggestion workspace unavailable.',404);end if;
 cached:=eps.review_replay('create_ai_suggestion',p_idempotency_key,p_input);
 perform 1 from eps.workspaces where id=workspace for update;perform eps.require_capability('workspaces.write');perform eps.require_capability('cast.read');perform eps.review_require(workspace);
 if not eps.project_scope((select project_id from eps.workspaces where id=workspace),true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable suggestion workspace changed.',404);end if;
 if cached is not null then return cached;end if;
 select * into configuration from eps.review_processing_config where id and enabled;if not found then perform eps.fail('REVIEW_PROCESSING_UNAVAILABLE','Review processing is not enabled.',503);end if;
 if jsonb_typeof(p_input->'capability')is distinct from'string'or p_input->>'capability'not in('slide_shorten','normalize_english','contextual_instruction')or jsonb_typeof(p_input->'target_type')is distinct from'string'or p_input->>'target_type'not in('assignment','candidate','workspace_candidate','role')or p_input->>'capability'='slide_shorten'and p_input->>'target_type'<>'assignment'or jsonb_typeof(p_input->'instruction')is distinct from'string'or length(btrim(p_input->>'instruction'))=0 or length(p_input->>'instruction')>8000 or octet_length(p_input->>'instruction')>16384 or jsonb_typeof(p_input->'field')is distinct from'string'then perform eps.fail('VALIDATION_FAILED','Invalid contextual instruction.',400);end if;
 binding:=eps.review_target_context(workspace,p_input->>'target_type',target,p_input->>'field');
 if(binding->>'target_row_version')::bigint<>expected then perform eps.fail('STALE_RESOURCE_VERSION','Suggestion target changed.',409,(binding->>'target_row_version')::bigint);end if;
 if p_input?'source_text'and(jsonb_typeof(p_input->'source_text')<>'string'or p_input->>'source_text'<>binding->>'source_text')then perform eps.fail('INPUT_CHANGED','Selected source text changed.',409);end if;
 job_input:=jsonb_build_object('schema_version','1.0','workspace_id',workspace,'target_type',p_input->>'target_type','target_id',target,'target_row_version',expected,'capability',p_input->>'capability','field',p_input->>'field','instruction',p_input->>'instruction','source_text',binding->>'source_text','budget',case when p_input->>'target_type'='assignment'then jsonb_build_object('max_characters',96,'max_lines',2)else jsonb_build_object('max_characters',600,'max_lines',6)end,'template',binding->'template','configuration',jsonb_build_object('model',configuration.model,'prompt_version',configuration.prompt_version));
 if octet_length(job_input::text)>65536 then perform eps.fail('VALIDATION_FAILED','The bounded processing context exceeds its byte budget.',400);end if;
 input_hash:=encode(sha256(convert_to(job_input::text,'UTF8')),'hex');
 insert into eps.ai_suggestions(id,workspace_id,target_type,target_id,target_row_version,field,bound_context_sha256)values(suggestion,workspace,p_input->>'target_type',target,expected,p_input->>'field',binding->>'bound_context_sha256');
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id)values(job,workspace,auth.uid(),'ai_suggestion',suggestion,job_input,input_hash,'eps.review-job-input.pg-jsonb.v1',encode(sha256(convert_to(auth.uid()::text||':review.ai:'||p_idempotency_key,'UTF8')),'hex'),'prepare_suggestion',job::text);
 update eps.ai_suggestions set job_id=job where id=suggestion;
 insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key)values(job,'prepare_suggestion',input_hash,1,job::text||':1');
 return eps.review_remember('create_ai_suggestion',p_idempotency_key,p_input,jsonb_build_object('job_id',job,'resource_id',suggestion,'status','queued','poll_url','/api/v1/jobs/'||job::text),suggestion);
end$$;
create function public.eps_get_ai_suggestion(p_suggestion_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$declare item eps.ai_suggestions;job eps.jobs;context jsonb;visible_status text;begin
 perform eps.require_capability('workspaces.read');perform eps.require_capability('cast.read');select * into item from eps.ai_suggestions where id=p_suggestion_id;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Suggestion not found.',404);end if;perform eps.review_require(item.workspace_id);
 select * into job from eps.jobs where id=item.job_id and kind='ai_suggestion'and resource_id=item.id and workspace_id=item.workspace_id;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Suggestion job unavailable.',404);end if;
 visible_status:=job.status;if job.status='succeeded'then begin context:=eps.review_target_context(item.workspace_id,item.target_type,item.target_id,item.field);if context->>'bound_context_sha256'<>item.bound_context_sha256 then visible_status:='waiting_for_input';end if;exception when raise_exception then visible_status:='waiting_for_input';end;end if;
 return jsonb_build_object('id',item.id,'target_id',item.target_id,'target_row_version',item.target_row_version,'status',visible_status,'suggested_text',case when visible_status='succeeded'then item.proposal->>'suggested_text'else null end,'proposed_changes',case when visible_status='succeeded'then item.proposal->'proposed_changes'else'[]'::jsonb end,'warnings',case when visible_status='succeeded'then item.proposal->'warnings'else'[]'::jsonb end);
end$$;
create function public.eps_request_workspace_review_fit(p_workspace_id uuid,p_series_id uuid,p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare review jsonb;configuration eps.review_processing_config;cached jsonb;request jsonb;job_input jsonb;job uuid:=gen_random_uuid();input_hash text;begin
 perform eps.review_require(p_workspace_id);perform eps.require_capability('workspaces.write');perform eps.require_capability('cast.read');if not eps.project_scope((select project_id from eps.workspaces where id=p_workspace_id),true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable fit workspace unavailable.',404);end if;perform eps.review_body(p_input,array['expected_input_fingerprint'],array['expected_input_fingerprint']);
 if jsonb_typeof(p_input->'expected_input_fingerprint')is distinct from'string'or(p_input->>'expected_input_fingerprint')!~'^[a-f0-9]{64}$'then perform eps.fail('VALIDATION_FAILED','A complete review input fingerprint is required.',400);end if;
 request:=p_input||jsonb_build_object('workspace_id',p_workspace_id,'series_id',p_series_id);cached:=eps.review_replay('request_fit',p_idempotency_key,request);
 perform 1 from eps.workspaces where id=p_workspace_id for update;perform eps.review_require(p_workspace_id);perform eps.require_capability('workspaces.write');perform eps.require_capability('cast.read');if not eps.project_scope((select project_id from eps.workspaces where id=p_workspace_id),true)then perform eps.fail('RESOURCE_NOT_FOUND','Writable fit workspace changed.',404);end if;if cached is not null then return cached;end if;
 select * into configuration from eps.review_processing_config where id and enabled;if not found then perform eps.fail('REVIEW_PROCESSING_UNAVAILABLE','Review processing is not enabled.',503);end if;
 review:=eps.review_snapshot(p_workspace_id,p_series_id,null);
 if(p_input->>'expected_input_fingerprint')is distinct from(review->>'input_fingerprint')then perform eps.fail('INPUT_CHANGED','Review content changed. Refresh before measuring.',409);end if;
 job_input:=jsonb_build_object('schema_version','1.0','workspace_id',p_workspace_id,'series_id',p_series_id,'expected_input_fingerprint',review->>'input_fingerprint','template',review->'template','configuration',jsonb_build_object('renderer_version',configuration.renderer_version));
 if octet_length(job_input::text)>65536 then perform eps.fail('VALIDATION_FAILED','The bounded processing context exceeds its byte budget.',400);end if;
 input_hash:=encode(sha256(convert_to(job_input::text,'UTF8')),'hex');
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id)values(job,p_workspace_id,auth.uid(),'review_fit',p_series_id,job_input,input_hash,'eps.review-job-input.pg-jsonb.v1',encode(sha256(convert_to(auth.uid()::text||':review.fit:'||p_idempotency_key,'UTF8')),'hex'),'measure_review_fit',job::text);
 insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key)values(job,'measure_review_fit',input_hash,1,job::text||':1');
 return eps.review_remember('request_fit',p_idempotency_key,request,jsonb_build_object('job_id',job,'resource_id',p_series_id,'status','queued','poll_url','/api/v1/jobs/'||job::text),p_series_id);
end$$;
create function eps.record_review_job_event(p_event jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;previous eps.job_events;receipt jsonb;digest text;attempt uuid;sequence_value bigint;at_value timestamptz:=clock_timestamp();safe_error jsonb;payload_id uuid;next_stage text;generated jsonb;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_event,array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash','result_schema','result','error'],array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash'])and octet_length(p_event::text)<=case when p_event->>'stage'='measure_review_fit'then 1048576 else 409600 end and p_event->>'stage'in('prepare_suggestion','generate_suggestion','validate_suggestion','measure_review_fit')and p_event->>'event_type'in('heartbeat','progress','succeeded','failed')and eps.specs_stage_integer(p_event->'sequence',1)and length(p_event->>'event_id')between 1 and 200 and p_event->>'lease_token'~'^[a-f0-9]{64}$'and p_event->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.review_stage_lock((p_event->>'job_id')::uuid);at_value:=clock_timestamp();attempt:=(p_event->>'attempt_id')::uuid;sequence_value:=(p_event->>'sequence')::bigint;digest:=encode(sha256(convert_to(p_event::text,'UTF8')),'hex');
 select * into previous from eps.job_events where job_id=job.id and attempt_id=attempt and event_id=p_event->>'event_id';
 if found then perform eps.specs_stage_assert(previous.payload_digest=digest,'EVENT_ID_CONFLICT');return previous.receipt||'{"duplicate":true,"applied":false}'::jsonb;end if;
 perform eps.specs_stage_assert(not exists(select 1 from eps.job_events where job_id=job.id and attempt_id=attempt and sequence=sequence_value),'EVENT_SEQUENCE_CONFLICT');
 receipt:=jsonb_build_object('event_id',p_event->>'event_id','applied',false,'duplicate',false,'stale',false,'job_status',job.status);
 if job.status<>'running'or job.cancel_requested_at is not null or job.current_attempt_id<>attempt or job.stage<>p_event->>'stage'or job.lease_expires_at<=at_value then return receipt||'{"stale":true}'::jsonb;end if;
 perform eps.specs_stage_assert(job.lease_token_digest=encode(sha256(convert_to(p_event->>'lease_token','UTF8')),'hex'),'LEASE_INVALID');perform eps.specs_stage_assert(job.input_hash=p_event->>'input_hash','INPUT_HASH_MISMATCH');
 if sequence_value<=job.last_event_sequence then return receipt||'{"stale":true}'::jsonb;end if;
 if not eps.review_stage_source_matches(job)then job.status:='waiting_for_input';safe_error:=eps.specs_stage_error('INPUT_CHANGED',false);
 elsif p_event->>'event_type'='heartbeat'then
  perform eps.specs_stage_assert(not(p_event?'result')and not(p_event?'result_schema')and coalesce(p_event->'error','null')='null');job.heartbeat_at:=at_value;job.lease_expires_at:=at_value+interval'90seconds';
 elsif p_event->>'event_type'='progress'then
  perform eps.specs_stage_assert(eps.specs_stage_shape(p_event->'result',array['progress_completed','progress_total'])and eps.specs_stage_integer(p_event#>'{result,progress_completed}',job.progress_completed)and(p_event#>'{result,progress_total}'='null'or eps.specs_stage_integer(p_event#>'{result,progress_total}',(p_event#>>'{result,progress_completed}')::bigint)),'INVALID_PROGRESS');job.progress_completed:=(p_event#>>'{result,progress_completed}')::bigint;job.progress_total:=(p_event#>>'{result,progress_total}')::bigint;
 elsif p_event->>'event_type'='failed'then
  perform eps.specs_stage_assert(not(p_event?'result')and eps.specs_stage_shape(p_event->'error',array['code','message','details','retryable'])and jsonb_typeof(p_event#>'{error,code}')='string'and length(p_event#>>'{error,code}')between 1 and 200 and jsonb_typeof(p_event#>'{error,retryable}')='boolean');safe_error:=eps.specs_stage_error(p_event#>>'{error,code}',(p_event#>>'{error,retryable}')::boolean);
 else
  begin
   if job.kind='review_fit'then
    perform eps.specs_stage_assert(p_event->>'result_schema'='review-fit-measurement.v1','RESULT_INVALID');perform eps.review_validate_fit(job,p_event->'result');
    -- A changed source never publishes a successful fit for a different snapshot.
    perform eps.specs_stage_assert(eps.review_stage_source_matches(job),'INPUT_CHANGED');
    insert into eps.review_fit_results(job_id,workspace_id,series_id,input_fingerprint,status,result)values(job.id,job.workspace_id,job.resource_id,job.input->>'expected_input_fingerprint','measured',p_event->'result');
   elsif job.stage='prepare_suggestion'then
    perform eps.specs_stage_assert(p_event->>'result_schema'='suggestion-preparation.v1'and eps.specs_stage_shape(p_event->'result',array['schema_version','target_id','target_row_version','field','source_text'])and p_event#>>'{result,schema_version}'='1.0'and p_event#>>'{result,target_id}'=job.input->>'target_id'and p_event#>'{result,target_row_version}'=job.input->'target_row_version'and p_event#>>'{result,field}'=job.input->>'field'and p_event#>>'{result,source_text}'=job.input->>'source_text','RESULT_INVALID');
   else
    perform eps.specs_stage_assert(p_event->>'result_schema'=case job.stage when'generate_suggestion'then'contextual-suggestion.v1'else'suggestion-validation.v1'end,'RESULT_INVALID');perform eps.review_validate_proposal(job,p_event->'result');
    if job.stage='validate_suggestion'then
     select payload into generated from eps.review_stage_payloads where job_id=job.id and input_hash=job.input_hash and stage='generate_suggestion';perform eps.specs_stage_assert(found and generated=p_event->'result','RESULT_INVALID');
     perform eps.specs_stage_assert(eps.review_stage_source_matches(job),'INPUT_CHANGED');
     update eps.ai_suggestions set proposal=p_event->'result'where id=job.resource_id and job_id=job.id and workspace_id=job.workspace_id;
     perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
    end if;
   end if;
   insert into eps.review_stage_payloads(job_id,workspace_id,stage,attempt_id,input_hash,result_schema,payload)values(job.id,job.workspace_id,job.stage,attempt,job.input_hash,p_event->>'result_schema',p_event->'result')returning id into payload_id;
  exception when raise_exception then
   if sqlerrm in('INPUT_CHANGED','STALE_RESOURCE_VERSION')then job.status:='waiting_for_input';safe_error:=eps.specs_stage_error('INPUT_CHANGED',false);
   elsif sqlerrm in('RESULT_INVALID','INVALID_REQUEST')then safe_error:=eps.specs_stage_error('RESULT_INVALID',false);else raise;end if;
  end;
  if safe_error is null then
   job.completed_stages:=job.completed_stages||jsonb_build_array(jsonb_build_object('stage',job.stage,'attempt_id',attempt,'input_hash',job.input_hash,'result_schema',p_event->>'result_schema','result',jsonb_build_object('stage_output_id',payload_id),'completed_at',at_value));
   next_stage:=case job.stage when'prepare_suggestion'then'generate_suggestion'when'generate_suggestion'then'validate_suggestion'else null end;
   if next_stage is null then job.status:='succeeded';job.result:=case when job.kind='ai_suggestion'then jsonb_build_object('suggestion_id',job.resource_id)else jsonb_build_object('series_id',job.resource_id,'input_fingerprint',job.input->>'expected_input_fingerprint')end;
   else job.status:='queued';job.stage:=next_stage;job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value;job.progress_completed:=0;job.progress_total:=null;end if;
   job.lease_token_digest:=null;job.lease_expires_at:=null;
  end if;
 end if;
 if safe_error is not null then
  job.error:=safe_error;job.lease_token_digest:=null;job.lease_expires_at:=null;
  if job.status<>'waiting_for_input'then
   if safe_error->'retryable'='true'and coalesce((job.stage_attempts->>job.stage)::integer,0)<3 then job.status:='queued';job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval'2seconds';else job.status:='failed';end if;
  end if;
  if job.kind='review_fit'and job.status='failed'then insert into eps.review_fit_results(job_id,workspace_id,series_id,input_fingerprint,status,error_code)values(job.id,job.workspace_id,job.resource_id,job.input->>'expected_input_fingerprint','failed','FIT_MEASUREMENT_FAILED');end if;
 end if;
 update eps.jobs set status=job.status,stage=job.stage,completed_stages=job.completed_stages,result=job.result,error=job.error,last_event_sequence=sequence_value,heartbeat_at=job.heartbeat_at,lease_expires_at=job.lease_expires_at,lease_token_digest=job.lease_token_digest,available_at=job.available_at,dispatch_generation=job.dispatch_generation,progress_completed=job.progress_completed,progress_total=job.progress_total,row_version=row_version+1,updated_at=at_value where id=job.id;
 if job.status='queued'then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;
 receipt:=receipt||jsonb_build_object('applied',true,'job_status',job.status);
 insert into eps.job_events(job_id,attempt_id,event_id,sequence,stage,event_type,payload_digest,receipt)values(job.id,attempt,p_event->>'event_id',sequence_value,p_event->>'stage',p_event->>'event_type',digest,receipt);return receipt;
end$$;
create function eps.recover_review_job_stages(p_limit integer)returns integer language plpgsql volatile security definer set search_path=''as $$
declare item record;job eps.jobs;recovered integer:=0;obsolete boolean;at_value timestamptz;begin
 perform eps.specs_stage_assert(p_limit between 0 and 100);if p_limit=0 then return 0;end if;
 for item in select id,workspace_id from eps.jobs where kind in('ai_suggestion','review_fit')and status in('queued','running')order by lease_expires_at nulls last,id limit 1000 loop
  exit when recovered>=p_limit;
  perform 1 from eps.workspaces where id=item.workspace_id for update skip locked;if not found then continue;end if;
  job:=eps.review_stage_lock(item.id,false);if job.status not in('queued','running')or job.cancel_requested_at is not null then continue;end if;at_value:=clock_timestamp();obsolete:=not eps.review_stage_can_write(job.requested_by,job.workspace_id,job.kind)or not eps.review_stage_source_matches(job);
  if not obsolete and(job.status='queued'or job.lease_expires_at>at_value)then continue;end if;
  if obsolete then job.status:='waiting_for_input';job.error:=eps.specs_stage_error('INPUT_CHANGED',false);
  elsif coalesce((job.stage_attempts->>job.stage)::integer,0)>=3 then job.status:='failed';job.error:=eps.specs_stage_error('RETRY_EXHAUSTED',false);
  else job.status:='queued';job.error:=eps.specs_stage_error('LEASE_EXPIRED');job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval'2seconds';end if;
  update eps.jobs set status=job.status,error=job.error,lease_token_digest=null,lease_expires_at=null,available_at=job.available_at,dispatch_generation=job.dispatch_generation,row_version=row_version+1,updated_at=at_value where id=job.id;
  if job.status='queued'then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);
  elsif job.kind='review_fit'and job.status='failed'then insert into eps.review_fit_results(job_id,workspace_id,series_id,input_fingerprint,status,error_code)values(job.id,job.workspace_id,job.resource_id,job.input->>'expected_input_fingerprint','failed','FIT_MEASUREMENT_FAILED')on conflict(job_id)do nothing;end if;
  recovered:=recovered+1;
 end loop;return recovered;
end$$;
create or replace function public.eps_get_workspace_review(p_workspace_id uuid,p_series_id uuid,p_output_type text default null)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare review jsonb;fit eps.review_fit_results;overflows jsonb;issue jsonb;entry jsonb;begin
 review:=eps.review_snapshot(p_workspace_id,p_series_id,p_output_type);
 select * into fit from eps.review_fit_results where workspace_id=p_workspace_id and series_id=p_series_id and input_fingerprint=review->>'input_fingerprint'order by completed_at desc,job_id desc limit 1;
 if not found then return review||jsonb_build_object('can_generate',false,'issues',review->'issues'||jsonb_build_array(eps.review_issue('FIT_MEASUREMENT_REQUIRED','blocking',p_series_id,null,'This exact template snapshot has not been measured.','Measure the current review layout.')),'fit',jsonb_build_object('status','unmeasured','input_fingerprint',null,'measured_at',null,'overflows','[]'::jsonb,'error_code','FIT_MEASUREMENT_REQUIRED'));end if;
 if fit.status='failed'then return review||jsonb_build_object('can_generate',false,'issues',review->'issues'||jsonb_build_array(eps.review_issue('FIT_MEASUREMENT_FAILED','blocking',p_series_id,null,'Layout measurement failed. Saved content was retained.','Retry layout measurement.')),'fit',jsonb_build_object('status','failed','input_fingerprint',fit.input_fingerprint,'measured_at',null,'overflows','[]'::jsonb,'error_code',fit.error_code));end if;
 overflows:=fit.result->'overflows';
 for entry in select value from jsonb_array_elements(overflows)loop
  issue:=eps.review_issue('LAYOUT_OVERFLOW','blocking',case when(entry->>'slide_index')::integer=0 then p_series_id else nullif(review#>>array['slides',((entry->>'slide_index')::integer-1)::text,'assignment_id'],'')::uuid end,entry->>'field','Text exceeds the selected slide layout.','Shorten this display field or correct its supplied content, then measure again.');review:=review||jsonb_build_object('issues',review->'issues'||jsonb_build_array(issue));
 end loop;
 return review||jsonb_build_object('can_generate',(review->'can_generate'='true')and jsonb_array_length(overflows)=0,'fit',jsonb_build_object('status','measured','input_fingerprint',fit.input_fingerprint,'measured_at',fit.result->>'measured_at','overflows',overflows,'error_code',null));
end$$;

grant create on schema eps,public to eps_review_owner,eps_review_stage_owner;
alter function eps.review_target_context(uuid,text,uuid,text)owner to eps_review_owner;
revoke all on function eps.review_target_context(uuid,text,uuid,text)from public,anon,authenticated,service_role;
grant execute on function eps.review_target_context(uuid,text,uuid,text)to eps_review_stage_owner;
do $$declare routine regprocedure;begin
 for routine in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps'and(p.proname like'review_stage_%'or p.proname in('review_is_job','claim_review_job_stage','get_review_stage_input','record_review_job_event','recover_review_job_stages','review_validate_proposal','review_validate_fit'))loop
  execute format('alter function %s owner to eps_review_stage_owner',routine);execute format('revoke all on function %s from public,anon,authenticated,service_role',routine);
 end loop;
end$$;
alter function public.eps_create_ai_suggestion(jsonb,text)owner to eps_review_owner;
alter function public.eps_get_ai_suggestion(uuid)owner to eps_review_owner;
alter function public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)owner to eps_review_owner;
alter function public.eps_get_workspace_review(uuid,uuid,text)owner to eps_review_owner;
revoke create on schema eps,public from eps_review_owner,eps_review_stage_owner;
revoke all on function public.eps_create_ai_suggestion(jsonb,text),public.eps_get_ai_suggestion(uuid),public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text),public.eps_get_workspace_review(uuid,uuid,text)from public,anon,authenticated,service_role;
grant execute on function public.eps_create_ai_suggestion(jsonb,text),public.eps_get_ai_suggestion(uuid),public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text),public.eps_get_workspace_review(uuid,uuid,text)to authenticated;
grant execute on function eps.review_is_job(uuid),eps.review_stage_lock(uuid,boolean),eps.review_stage_source_matches(eps.jobs),eps.claim_review_job_stage(jsonb),eps.get_review_stage_input(uuid,uuid,text),eps.record_review_job_event(jsonb),eps.recover_review_job_stages(integer)to eps_specs_stage_owner;

-- Closed dispatch only, exact preceding source hashes. The original user and
-- service ports/owners/ACLs remain; no caller chooses a new handler or SQL name.
do $dispatch$
declare item record;source text;definition text;replacement text;anchor text;start_at integer;begin
 for item in select * from(values
 ('eps.claim_job_stage(jsonb)','a1dc5c518d686b1423c5fb3f8defee6b81b85b39c23a607059d706d396363322',E'begin\n if p_input->>''stage''in(''prepare_suggestion'',''generate_suggestion'',''validate_suggestion'',''measure_review_fit'')then return eps.claim_review_job_stage(p_input);end if;\n'),
 ('eps.get_specs_stage_input(uuid,uuid,text)','89d180bb49abd83b5e00b3a0ac37037bbabbe136682123952a337f92b46f63b4',E'begin\n if eps.review_is_job(p_job_id)then return eps.get_review_stage_input(p_job_id,p_attempt_id,p_lease_token);end if;\n'),
 ('eps.record_job_event(jsonb)','0cafccb9f712f73a3c7e22605ac61407a2486c07e0a650263db9a82889b0c873',E'begin\n if p_event->>''stage''in(''prepare_suggestion'',''generate_suggestion'',''validate_suggestion'',''measure_review_fit'')then return eps.record_review_job_event(p_event);end if;\n'),
 ('eps.recover_job_stages(integer)','c1bdac48813a2a6061ea4c8ff8a353329e9fa0e0d32d8beef93b334cebcd08fd',E'begin\n recovered:=eps.recover_review_job_stages(p_limit);\n')
 )v(signature,expected_sha256,insert_value)loop
  select prosrc,pg_get_functiondef(oid)into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>item.expected_sha256 then raise exception'M04_REVIEW_PRECEDING_DISPATCH_SOURCE_REQUIRED';end if;
  start_at:=position('begin'in source);anchor:=case when substring(source from start_at for 7)=E'begin\r\n' then E'begin\r\n'else E'begin\n'end;
  if substring(source from start_at for length(anchor))<>anchor then raise exception'M04_REVIEW_DISPATCH_BEGIN_REQUIRED';end if;
  if anchor=E'begin\r\n' then item.insert_value:=replace(item.insert_value,E'\n',E'\r\n');end if;
  replacement:=overlay(source placing item.insert_value from start_at for length(anchor));
  if replacement=source then raise exception'M04_REVIEW_DISPATCH_ANCHOR_REQUIRED';end if;execute replace(definition,source,replacement);
 end loop;
 select prosrc,pg_get_functiondef(oid)into source,definition from pg_proc where oid='eps.claim_job_stage_replay(jsonb,text,text,text)'::regprocedure;
 if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>'3848197d49b97eb0a9b28d688b07771b895c2bf57166ab64072abac1e29369b9'then raise exception'M04_REVIEW_PRECEDING_REPLAY_SOURCE_REQUIRED';end if;
 replacement:=replace(source,'job:=eps.specs_stage_lock(old.job_id);','if eps.review_is_job(old.job_id)then job:=eps.review_stage_lock(old.job_id);else job:=eps.specs_stage_lock(old.job_id);end if;');
 replacement:=replace(replacement,'else eps.specs_stage_source_matches(job) end','when job.kind in(''ai_suggestion'',''review_fit'')then eps.review_stage_source_matches(job) else eps.specs_stage_source_matches(job) end');
 if replacement=source or position('eps.review_stage_source_matches(job)'in replacement)=0 then raise exception'M04_REVIEW_REPLAY_ANCHOR_REQUIRED';end if;execute replace(definition,source,replacement);
end$dispatch$;
notify pgrst,'reload schema';
