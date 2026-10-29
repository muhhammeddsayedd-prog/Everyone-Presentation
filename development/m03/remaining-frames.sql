-- M03 frame extraction: development fragment composed after reviewed17 and
-- support/filter fragments. Disabled until separately reviewed activation.
set local search_path='';
set local lock_timeout='3s';
set local statement_timeout='30s';

alter table eps.jobs drop constraint jobs_kind_check;
alter table eps.jobs add constraint jobs_kind_check check(kind in('specs_extract','candidate_scan','frame_extract'));
alter table eps.jobs drop constraint jobs_stage_check;
alter table eps.jobs add constraint jobs_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate','extract_frames','apply_frames'));
alter table eps.jobs drop constraint jobs_kind_stage_check;
alter table eps.jobs add constraint jobs_kind_stage_check check((kind='specs_extract' and stage in('prepare_document','extract_specs','apply_specs')) or (kind='candidate_scan' and stage in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate')) or (kind='frame_extract' and stage in('extract_frames','apply_frames')));
alter table eps.jobs drop constraint jobs_input_hash_version_check;
alter table eps.jobs add constraint jobs_input_hash_version_check check(input_hash_version in('eps.specs-input.pg-jsonb.v1','eps.candidate-input.pg-jsonb.v1','eps.frame-input.pg-jsonb.v1'));
alter table eps.job_events drop constraint job_events_stage_check;
alter table eps.job_events add constraint job_events_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate','extract_frames','apply_frames'));
alter table eps.outbox_events drop constraint outbox_events_stage_check;
alter table eps.outbox_events add constraint outbox_events_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate','extract_frames','apply_frames'));
alter table eps.candidate_stage_payloads drop constraint candidate_stage_payloads_stage_check;
alter table eps.candidate_stage_payloads add constraint candidate_stage_payloads_stage_check check(stage in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate','extract_frames','apply_frames'));

create table eps.frame_extraction_config (
 id boolean primary key default true check(id),enabled boolean not null default false,
 native_image_id text check(native_image_id~'^sha256:[a-f0-9]{64}$'),
 implementation_version text not null default 'frame-extraction.v1' check(implementation_version='frame-extraction.v1'),
 check(not enabled or native_image_id is not null)
);
insert into eps.frame_extraction_config(id) values(true);
create table eps.frame_extraction_requests (
 job_id uuid primary key references eps.jobs(id) on delete restrict,
 candidate_media_id uuid not null references eps.candidate_media(id) on delete restrict,
 candidate_id uuid not null references eps.candidates(id) on delete restrict,
 source_asset_id uuid not null references eps.media_assets(id) on delete restrict,
 media_row_version bigint not null check(media_row_version between 1 and 9007199254740991),
 frozen_input jsonb not null check(jsonb_typeof(frozen_input)='object' and octet_length(frozen_input::text)<=16384),
 created_at timestamptz not null default clock_timestamp()
);
create index frame_requests_media_idx on eps.frame_extraction_requests(candidate_media_id);
create index frame_requests_source_idx on eps.frame_extraction_requests(source_asset_id);
create index frame_requests_candidate_idx on eps.frame_extraction_requests(candidate_id);
alter table eps.frame_extraction_config enable row level security;alter table eps.frame_extraction_config force row level security;
alter table eps.frame_extraction_requests enable row level security;alter table eps.frame_extraction_requests force row level security;
revoke all on eps.frame_extraction_config,eps.frame_extraction_requests from public,anon,authenticated,service_role,eps_api_owner;
grant select on eps.frame_extraction_config to eps_candidate_stage_owner,eps_candidate_assets_owner,eps_cast_owner;
grant select on eps.frame_extraction_requests to eps_candidate_stage_owner,eps_candidate_assets_owner;
grant select,insert on eps.frame_extraction_requests to eps_cast_owner;
create policy frame_config_internal_read on eps.frame_extraction_config for select to eps_candidate_stage_owner,eps_candidate_assets_owner,eps_cast_owner using(true);
create policy frame_requests_service_read on eps.frame_extraction_requests for select to eps_candidate_stage_owner,eps_candidate_assets_owner using(true);
create policy frame_requests_user_read on eps.frame_extraction_requests for select to eps_cast_owner using(eps.has_capability('cast.read') and exists(select 1 from eps.jobs j where j.id=job_id and j.requested_by=auth.uid() and j.kind='frame_extract'));
create policy frame_requests_user_insert on eps.frame_extraction_requests for insert to eps_cast_owner with check(eps.has_capability('cast.upload') and eps.has_capability('cast.read') and exists(select 1 from eps.jobs j where j.id=job_id and j.requested_by=auth.uid() and j.kind='frame_extract' and j.resource_id=candidate_media_id and j.input_asset_id=source_asset_id and j.input=frozen_input));
grant select,insert on eps.jobs to eps_cast_owner;grant insert on eps.outbox_events to eps_cast_owner;
grant execute on function eps.specs_stage_assert(boolean,text),eps.specs_stage_shape(jsonb,text[],text[]),eps.specs_stage_integer(jsonb,bigint,bigint) to eps_cast_owner;
create policy frame_enqueue_job_read on eps.jobs for select to eps_cast_owner using(kind='frame_extract' and requested_by=auth.uid() and eps.has_capability('cast.read'));
create policy frame_enqueue_job_insert on eps.jobs for insert to eps_cast_owner with check(kind='frame_extract' and requested_by=auth.uid() and eps.has_capability('cast.read') and eps.has_capability('cast.upload')
 and stage='extract_frames' and status='queued' and attempt=0 and current_attempt_id is null and lease_token_digest is null and dispatch_generation=1
 and exists(select 1 from eps.candidate_media m join eps.media_assets a on a.id=m.source_asset_id where m.id=resource_id and a.id=input_asset_id and a.origin_workspace_id=jobs.workspace_id and a.status='ready' and a.purpose='candidate_video'));
create policy frame_enqueue_dispatch on eps.outbox_events for insert to eps_cast_owner with check(exists(select 1 from eps.jobs j where j.id=job_id and j.kind='frame_extract' and j.requested_by=auth.uid() and stage='extract_frames' and dispatch_generation=1));
create policy frame_enqueue_idempotency on eps.idempotency_records for all to eps_cast_owner using(principal_id=auth.uid() and operation='cast.extract_candidate_frames') with check(principal_id=auth.uid() and operation='cast.extract_candidate_frames');
create policy frame_enqueue_audit on eps.audit_events for insert to eps_cast_owner with check(principal_id=auth.uid() and action='cast.extract_candidate_frames');
create policy frame_stage_jobs_read on eps.jobs for select to eps_candidate_stage_owner using(kind='frame_extract');
create policy frame_stage_jobs_update on eps.jobs for update to eps_candidate_stage_owner using(kind='frame_extract') with check(kind='frame_extract');
create policy frame_asset_jobs_read on eps.jobs for select to eps_candidate_assets_owner using(kind='frame_extract');
grant select on eps.candidates,eps.candidate_media,eps.candidate_media_frames to eps_candidate_stage_owner;
grant update(id) on eps.candidates to eps_candidate_stage_owner;
grant update(row_version) on eps.candidate_media to eps_candidate_stage_owner;
grant insert on eps.candidate_media_frames to eps_candidate_stage_owner;
grant insert(principal_id,action,resource_id,request_id,client_type) on eps.audit_events to eps_candidate_stage_owner;
create policy frame_stage_candidate_read on eps.candidates for select to eps_candidate_stage_owner using(true);
create policy frame_stage_candidate_lock on eps.candidates for update to eps_candidate_stage_owner using(true) with check(false);
create policy frame_stage_media_read on eps.candidate_media for select to eps_candidate_stage_owner using(true);
create policy frame_stage_media_update on eps.candidate_media for update to eps_candidate_stage_owner using(true) with check(exists(select 1 from eps.jobs j where j.id::text=current_setting('eps.frame_apply.job_id',true) and j.kind='frame_extract' and j.stage='apply_frames' and j.resource_id=candidate_media.id and j.status='running'));
create policy frame_stage_frames_read on eps.candidate_media_frames for select to eps_candidate_stage_owner using(true);
create policy frame_stage_frames_insert on eps.candidate_media_frames for insert to eps_candidate_stage_owner with check(exists(select 1 from eps.jobs j where j.id::text=current_setting('eps.frame_apply.job_id',true) and j.kind='frame_extract' and j.stage='apply_frames' and j.resource_id=candidate_media_id and j.status='running'));
create policy frame_stage_payload_insert on eps.candidate_stage_payloads for insert to eps_candidate_stage_owner with check(stage in('extract_frames','apply_frames') and exists(select 1 from eps.jobs j where j.id=job_id and j.kind='frame_extract' and j.workspace_id=candidate_stage_payloads.workspace_id and j.current_attempt_id=attempt_id and j.input_hash=candidate_stage_payloads.input_hash));
create policy frame_apply_audit on eps.audit_events for insert to eps_candidate_stage_owner with check(action='candidate.frames_extracted' and client_type='api' and exists(select 1 from eps.jobs j where j.id::text=current_setting('eps.frame_apply.job_id',true) and j.kind='frame_extract' and j.requested_by=audit_events.principal_id));

create function eps.frame_job_hash(p_input jsonb) returns text language sql immutable security invoker set search_path='' as $$
 select encode(sha256(convert_to('eps.frame-input.pg-jsonb.v1:'||p_input::text,'UTF8')),'hex')
$$;
create function eps.frame_stage_can_execute(p_principal uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select eps.job_requester_active(p_principal) and not exists(select 1 from unnest(array['cast.read','cast.upload']) required where not exists(select 1 from public.app_capability_grants g where g.principal_id=p_principal and g.capability=required and g.active))
$$;
create function eps.frame_is_job(p_job uuid) returns boolean language sql volatile security definer set search_path='' as $$ select exists(select 1 from eps.jobs where id=p_job and kind='frame_extract') $$;
create function eps.frame_capture_input(p_media uuid,p_actor uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare m eps.candidate_media;c eps.candidates;a eps.media_assets;begin
 perform eps.specs_stage_assert(eps.frame_stage_can_execute(p_actor),'CAPABILITY_REQUIRED');
 select * into m from eps.candidate_media where id=p_media;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Introduction not found.',404);end if;
 select * into c from eps.candidates where id=m.candidate_id for update;
 perform eps.specs_stage_assert(found and c.archived_at is null and c.merged_into_candidate_id is null,'RESOURCE_NOT_FOUND');
 select * into m from eps.candidate_media where id=p_media and candidate_id=c.id for update;
 select * into a from eps.media_assets where id=m.source_asset_id and purpose='candidate_video' and status='ready';
 perform eps.specs_stage_assert(found and a.sha256~'^[a-f0-9]{64}$' and a.duration_ms between 1 and 1800000 and a.origin_workspace_id is not null,'MEDIA_REFERENCE_INVALID');
 return jsonb_build_object('schema_version','1.0','candidate_media_id',m.id,'candidate_id',c.id,'media_row_version',m.row_version,'workspace_id',a.origin_workspace_id,
  'source_asset_id',a.id,'source_sha256',a.sha256,'source_size_bytes',a.size_bytes,'source_mime_type',a.mime_type,'source_duration_ms',a.duration_ms);
end $$;
create function eps.frame_source_identity_matches(p_job eps.jobs) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from eps.frame_extraction_requests r join eps.candidate_media m on m.id=r.candidate_media_id join eps.candidates c on c.id=m.candidate_id join eps.media_assets a on a.id=m.source_asset_id
  where r.job_id=p_job.id and p_job.kind='frame_extract' and r.frozen_input=p_job.input and r.candidate_media_id=p_job.resource_id and r.candidate_id=c.id
   and r.source_asset_id=p_job.input_asset_id and r.source_asset_id=a.id and c.archived_at is null and c.merged_into_candidate_id is null
   and a.status='ready' and a.purpose='candidate_video' and a.origin_workspace_id=p_job.workspace_id and p_job.input->>'source_sha256'=a.sha256
   and p_job.input->>'source_size_bytes'=a.size_bytes::text and p_job.input->>'source_mime_type'=a.mime_type and p_job.input->>'source_duration_ms'=a.duration_ms::text
   and p_job.input->>'candidate_media_id'=m.id::text and p_job.input->>'candidate_id'=c.id::text and p_job.input->>'media_row_version'=r.media_row_version::text
   and p_job.input_hash_version='eps.frame-input.pg-jsonb.v1' and p_job.input_hash=eps.frame_job_hash(p_job.input))
$$;
create function eps.frame_source_matches(p_job eps.jobs) returns boolean language sql volatile security definer set search_path='' as $$
 select eps.frame_source_identity_matches(p_job) and exists(select 1 from eps.frame_extraction_requests r join eps.candidate_media m on m.id=r.candidate_media_id where r.job_id=p_job.id and m.row_version=r.media_row_version)
$$;
create function eps.frame_stage_lock(p_job uuid,p_require_access boolean default true) returns eps.jobs language plpgsql volatile security definer set search_path='' as $$
declare r eps.frame_extraction_requests;job eps.jobs;locked uuid;begin
 select * into r from eps.frame_extraction_requests where job_id=p_job;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Frame extraction job not found.',404);end if;
 select id into locked from eps.candidates where id=r.candidate_id for update;
 select id into locked from eps.candidate_media where id=r.candidate_media_id for update;
 select * into job from eps.jobs where id=p_job and kind='frame_extract' and resource_id=r.candidate_media_id and input_asset_id=r.source_asset_id for update;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');if p_require_access then perform eps.specs_stage_assert(eps.frame_stage_can_execute(job.requested_by),'CAPABILITY_REQUIRED');end if;return job;
end $$;
create function eps.frame_stage_current(p_job uuid,p_attempt uuid,p_lease text) returns eps.jobs language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;begin
 job:=eps.frame_stage_lock(p_job);perform eps.specs_stage_assert(job.status='running' and job.current_attempt_id=p_attempt and job.cancel_requested_at is null and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(p_lease~'^[a-f0-9]{64}$' and job.lease_token_digest=encode(sha256(convert_to(p_lease,'UTF8')),'hex'),'LEASE_INVALID');
 perform eps.specs_stage_assert(eps.frame_source_matches(job),'INPUT_CHANGED');return job;
end $$;
create function eps.frame_stage_live(p_job uuid,p_attempt uuid,p_input_hash text) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from eps.jobs j where j.id=p_job and j.kind='frame_extract' and j.current_attempt_id=p_attempt and j.status='running' and j.input_hash=p_input_hash and j.cancel_requested_at is null and j.lease_expires_at>clock_timestamp() and eps.frame_stage_can_execute(j.requested_by) and eps.frame_source_matches(j))
$$;
create function public.eps_extract_candidate_frames(p_candidate_media_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare captured jsonb;input_value jsonb;payload jsonb;response jsonb;config eps.frame_extraction_config;job eps.jobs;fingerprint text;timestamps jsonb;count_frames integer;begin
 perform eps.require_capability('cast.read');perform eps.require_capability('cast.upload');
 perform eps.specs_stage_assert(p_idempotency_key is not null and length(p_idempotency_key) between 16 and 200 and p_idempotency_key!~'[[:cntrl:]]');
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['source_asset_id','timestamps_ms']) and octet_length(p_input::text)<=4096 and jsonb_typeof(p_input->'source_asset_id')='string' and jsonb_typeof(p_input->'timestamps_ms')='array' and jsonb_array_length(p_input->'timestamps_ms') between 1 and 10);
 captured:=eps.frame_capture_input(p_candidate_media_id,auth.uid());
 perform eps.specs_stage_assert(p_input->>'source_asset_id'=captured->>'source_asset_id','MEDIA_REFERENCE_INVALID');
 perform eps.specs_stage_assert(not exists(select 1 from jsonb_array_elements(p_input->'timestamps_ms') t where not eps.specs_stage_integer(t,0,(captured->>'source_duration_ms')::bigint-1))
  and (select count(*)=count(distinct value) from jsonb_array_elements(p_input->'timestamps_ms')));
 select jsonb_agg(value order by value::bigint) into timestamps from jsonb_array_elements(p_input->'timestamps_ms');
 payload:=jsonb_build_object('candidate_media_id',p_candidate_media_id,'input',jsonb_build_object('source_asset_id',p_input->>'source_asset_id','timestamps_ms',timestamps));
 response:=eps.idempotency_begin('cast.extract_candidate_frames',p_idempotency_key,payload);
 captured:=eps.frame_capture_input(p_candidate_media_id,auth.uid());if response is not null then return response;end if;
 select count(*) into count_frames from eps.candidate_media_frames where candidate_media_id=p_candidate_media_id;
 perform eps.specs_stage_assert(count_frames+jsonb_array_length(timestamps)<=100,'MEDIA_REFERENCE_INVALID');
 select * into config from eps.frame_extraction_config where id and enabled;if not found then perform eps.fail('DEPENDENCY_UNAVAILABLE','Chosen-frame extraction is not configured.',503);end if;
 input_value:=captured||jsonb_build_object('timestamps_ms',timestamps,'configuration',jsonb_build_object('implementation_version',config.implementation_version,'native_image_id',config.native_image_id));
 fingerprint:=eps.frame_job_hash(input_value);
 select * into job from eps.jobs where kind='frame_extract' and dedupe_key=encode(sha256(convert_to('frame_extract:'||auth.uid()::text||':'||fingerprint,'UTF8')),'hex');
 if not found then
  insert into eps.jobs(workspace_id,requested_by,kind,resource_id,input_asset_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id)
  values((captured->>'workspace_id')::uuid,auth.uid(),'frame_extract',p_candidate_media_id,(captured->>'source_asset_id')::uuid,input_value,fingerprint,'eps.frame-input.pg-jsonb.v1',encode(sha256(convert_to('frame_extract:'||auth.uid()::text||':'||fingerprint,'UTF8')),'hex'),'extract_frames','frames:'||gen_random_uuid()::text) returning * into job;
  insert into eps.frame_extraction_requests(job_id,candidate_media_id,candidate_id,source_asset_id,media_row_version,frozen_input) values(job.id,p_candidate_media_id,(captured->>'candidate_id')::uuid,job.input_asset_id,(captured->>'media_row_version')::bigint,input_value);
  insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key) values(job.id,job.stage,job.input_hash,1,job.id::text||':1');
 end if;
 return eps.finish_mutation('cast.extract_candidate_frames',p_idempotency_key,payload,jsonb_build_object('job_id',job.id,'resource_id',p_candidate_media_id,'poll_url','/api/v1/jobs/'||job.id::text,'status',job.status),p_candidate_media_id);
end $$;

create function eps.get_frame_stage_input(p_job uuid,p_attempt uuid,p_lease text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;a eps.media_assets;begin
 job:=eps.frame_stage_current(p_job,p_attempt,p_lease);select * into strict a from eps.media_assets where id=job.input_asset_id;
 return jsonb_build_object('job_id',job.id,'attempt_id',job.current_attempt_id,'stage',job.stage,'input_hash',job.input_hash,'configuration',job.input->'configuration',
  'candidate_media_id',job.resource_id,'timestamps_ms',job.input->'timestamps_ms','source_duration_ms',a.duration_ms,
  'source',jsonb_build_object('asset_id',a.id,'sha256',a.sha256,'size_bytes',a.size_bytes,'mime_type',a.mime_type));
end $$;
create function eps.frame_validate_stage(p_job eps.jobs,p_schema text,p_payload jsonb) returns void language plpgsql volatile security definer set search_path='' as $$
declare item jsonb;frame jsonb;ordinal integer:=0;geometry jsonb;ratio jsonb;begin
 perform eps.specs_stage_assert(jsonb_typeof(p_payload)='object' and octet_length(p_payload::text)<=393216 and p_payload->>'source_asset_id'=p_job.input_asset_id::text,'RESULT_INVALID');
 if p_job.stage='apply_frames' then perform eps.specs_stage_assert(p_schema='frame-application.v1' and eps.specs_stage_shape(p_payload,array['source_asset_id']),'RESULT_INVALID');return;end if;
 perform eps.specs_stage_assert(p_job.stage='extract_frames' and p_schema='frame-extraction-stage.v1' and eps.specs_stage_shape(p_payload,array['source_asset_id','source_sha256','frames','requests','warnings','implementation_version','native_image_id','ffmpeg_version','display_geometry'])
  and p_payload->>'source_sha256'=p_job.input->>'source_sha256' and p_payload->>'implementation_version'='frame-extraction.v1' and p_payload->>'native_image_id'=p_job.input#>>'{configuration,native_image_id}'
  and jsonb_typeof(p_payload->'ffmpeg_version')='string' and length(p_payload->>'ffmpeg_version') between 1 and 500
  and jsonb_typeof(p_payload->'frames')='array' and jsonb_array_length(p_payload->'frames')<=10 and jsonb_typeof(p_payload->'requests')='array'
  and jsonb_array_length(p_payload->'requests')=jsonb_array_length(p_job.input->'timestamps_ms') and eps.specs_stage_strings(p_payload->'warnings') and jsonb_array_length(p_payload->'warnings')<=32,'RESULT_INVALID');
 geometry:=p_payload->'display_geometry';perform eps.specs_stage_assert(eps.specs_stage_shape(geometry,array['sample_aspect_ratio','display_aspect_ratio','width','height']) and eps.specs_stage_integer(geometry->'width',1,1280) and eps.specs_stage_integer(geometry->'height',1,1280),'RESULT_INVALID');
 foreach ratio in array array[geometry->'sample_aspect_ratio',geometry->'display_aspect_ratio'] loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(ratio,array['numerator','denominator']) and eps.specs_stage_integer(ratio->'numerator',1) and eps.specs_stage_integer(ratio->'denominator',1),'RESULT_INVALID');
 end loop;
 for frame in select value from jsonb_array_elements(p_payload->'frames') loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(frame,array['asset_id','sha256','size_bytes','mime_type','source_asset_id','timestamp_ms','width','height','quality_flags'])
   and frame->>'source_asset_id'=p_job.input_asset_id::text and frame->>'mime_type'='image/jpeg' and frame->'width'=geometry->'width' and frame->'height'=geometry->'height'
   and eps.specs_stage_integer(frame->'timestamp_ms',0,(p_job.input->>'source_duration_ms')::bigint-1) and eps.specs_stage_strings(frame->'quality_flags')
   and not exists(select 1 from jsonb_array_elements_text(frame->'quality_flags') flag where flag not in('EXPOSURE_LIMIT','LOW_DETAIL'))
   and exists(select 1 from eps.media_assets a where a.id::text=frame->>'asset_id' and a.origin_workspace_id=p_job.workspace_id and a.purpose='candidate_frame' and a.status='ready'
    and a.source_asset_id=p_job.input_asset_id and a.producing_job_id=p_job.id and a.producing_attempt_id=p_job.current_attempt_id and a.output_stage='extract_frames'
    and a.sha256=frame->>'sha256' and a.size_bytes::text=frame->>'size_bytes' and a.mime_type=frame->>'mime_type' and a.width::text=frame->>'width' and a.height::text=frame->>'height' and a.source_timestamp_ms::text=frame->>'timestamp_ms'),'RESULT_INVALID');
 end loop;
 perform eps.specs_stage_assert((select count(*)=count(distinct value->>'asset_id') from jsonb_array_elements(p_payload->'frames')),'RESULT_INVALID');
 for item in select value from jsonb_array_elements(p_payload->'requests') loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(item,array['requested_timestamp_ms','frame_asset_id','actual_timestamp_ms','unavailable_reason']) and item->'requested_timestamp_ms'=p_job.input->'timestamps_ms'->ordinal,'RESULT_INVALID');ordinal:=ordinal+1;
  if item->'frame_asset_id'='null' then perform eps.specs_stage_assert(item->'actual_timestamp_ms'='null' and item->>'unavailable_reason'='FRAME_TIMESTAMP_UNAVAILABLE','RESULT_INVALID');
  else perform eps.specs_stage_assert(item->'unavailable_reason'='null' and eps.specs_stage_integer(item->'actual_timestamp_ms',(item->>'requested_timestamp_ms')::bigint,(p_job.input->>'source_duration_ms')::bigint-1)
   and exists(select 1 from jsonb_array_elements(p_payload->'frames') f where f->>'asset_id'=item->>'frame_asset_id' and f->'timestamp_ms'=item->'actual_timestamp_ms'),'RESULT_INVALID');end if;
 end loop;
 perform eps.specs_stage_assert(not exists(select 1 from jsonb_array_elements(p_payload->'frames') f where not exists(select 1 from jsonb_array_elements(p_payload->'requests') r where r->>'frame_asset_id'=f->>'asset_id')),'RESULT_INVALID');
end $$;
create function eps.apply_frame_extraction(p_job_id uuid,p_attempt_id uuid,p_lease_token text,p_input_hash text,p_result jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;payload jsonb;frame jsonb;new_ids jsonb:='[]';unavailable integer;unavailable_times jsonb;public_warnings jsonb;begin
 job:=eps.frame_stage_current(p_job_id,p_attempt_id,p_lease_token);
 perform eps.specs_stage_assert(job.stage='apply_frames' and job.input_hash=p_input_hash and eps.specs_stage_shape(p_result,array['source_asset_id']) and p_result->>'source_asset_id'=job.input_asset_id::text,'RESULT_INVALID');
 select p.payload into payload from eps.candidate_stage_payloads p where p.job_id=job.id and p.input_hash=job.input_hash and p.stage='extract_frames'
  and exists(select 1 from jsonb_array_elements(job.completed_stages) s where s->>'stage'='extract_frames' and s#>>'{result,stage_output_id}'=p.id::text and s->>'attempt_id'=p.attempt_id::text);
 perform eps.specs_stage_assert(payload is not null and payload->>'source_sha256'=job.input->>'source_sha256','RESULT_INVALID');
 perform eps.specs_stage_assert((select count(*) from eps.candidate_media_frames where candidate_media_id=job.resource_id)+jsonb_array_length(payload->'frames')<=100,'INPUT_CHANGED');
 perform set_config('eps.frame_apply.job_id',job.id::text,true);
 for frame in select value from jsonb_array_elements(payload->'frames') loop
  perform eps.specs_stage_assert(not exists(select 1 from eps.candidate_media_frames where candidate_media_id=job.resource_id and asset_id=(frame->>'asset_id')::uuid),'RESULT_INVALID');
  insert into eps.candidate_media_frames(candidate_media_id,asset_id,quality_flags) values(job.resource_id,(frame->>'asset_id')::uuid,array(select jsonb_array_elements_text(frame->'quality_flags')));
  new_ids:=new_ids||jsonb_build_array(frame->>'asset_id');
 end loop;
 if jsonb_array_length(new_ids)>0 then update eps.candidate_media set row_version=row_version+1 where id=job.resource_id and row_version=(job.input->>'media_row_version')::bigint;perform eps.specs_stage_assert(found,'INPUT_CHANGED');end if;
 select count(*),coalesce(jsonb_agg(r->'requested_timestamp_ms' order by ordinal),'[]'::jsonb) into unavailable,unavailable_times from jsonb_array_elements(payload->'requests') with ordinality list(r,ordinal) where r->'frame_asset_id'='null';
 select coalesce(jsonb_agg(flag order by flag),'[]'::jsonb) into public_warnings from (select distinct flag from jsonb_array_elements_text(payload->'warnings') flag where flag in('FRAME_TIMESTAMP_SHARED','FRAME_TIMESTAMP_UNAVAILABLE')) safe;
 insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type) values(job.requested_by,'candidate.frames_extracted',job.resource_id,job.correlation_id,'api');
 return jsonb_build_object('candidate_media_id',job.resource_id,'source_asset_id',job.input_asset_id,'frame_asset_ids',new_ids,'requested_count',jsonb_array_length(payload->'requests'),'frame_count',jsonb_array_length(new_ids),'unavailable_count',unavailable,'unavailable_timestamps_ms',unavailable_times,'warnings',public_warnings);
end $$;
create function eps.recover_frame_job_stages(p_limit integer) returns integer language plpgsql volatile security definer set search_path='' as $$
declare candidate record;job eps.jobs;recovered integer:=0;at_value timestamptz;obsolete boolean;attempts integer;begin
 perform eps.specs_stage_assert(p_limit between 0 and 100);if p_limit=0 then return 0;end if;
 for candidate in select j.id from eps.jobs j where j.kind='frame_extract' and j.status in('queued','running') and (j.status='running' and j.lease_expires_at<=clock_timestamp() or not eps.frame_stage_can_execute(j.requested_by) or not eps.frame_source_matches(j)) order by j.lease_expires_at nulls last,j.id limit 100 loop
  exit when recovered>=p_limit;job:=eps.frame_stage_lock(candidate.id,false);at_value:=clock_timestamp();if job.status not in('queued','running') then continue;end if;
  obsolete:=not eps.frame_stage_can_execute(job.requested_by) or not eps.frame_source_matches(job);if not obsolete and (job.status='queued' or job.lease_expires_at>at_value) then continue;end if;
  attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);
  if obsolete then job.status:='waiting_for_input';job.error:=eps.specs_stage_error('INPUT_CHANGED');
  elsif attempts>=3 then job.status:='failed';job.error:=jsonb_build_object('code','RETRY_EXHAUSTED','message','Frame extraction retry budget exhausted. Existing material was preserved.','details','{}'::jsonb,'retryable',false);
  else job.status:='queued';job.error:=eps.specs_stage_error('LEASE_EXPIRED');job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval '2 seconds';end if;
  update eps.jobs set status=job.status,error=job.error,lease_token_digest=null,lease_expires_at=null,available_at=job.available_at,dispatch_generation=job.dispatch_generation,row_version=row_version+1,updated_at=at_value where id=job.id;
  if job.status='queued' then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at) values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;recovered:=recovered+1;
 end loop;return recovered;
end $$;

-- Exact-source cloning retains the proven lease/event/asset machinery. Only the
-- named closed kind/stage/validator/apply dispatch changes; no generic SQL port.
do $frame_clones$
declare item record;source text;definition text;replacement text;old_next text;begin
 for item in select * from (values
  ('eps.claim_candidate_job_stage(jsonb)','claim_candidate_job_stage','claim_frame_job_stage','e5ac1c5fe0a22f45163f61c9cb51cf90ccf8d351bb38005070d27bcf643140f4'),
  ('eps.record_candidate_job_event(jsonb)','record_candidate_job_event','record_frame_job_event','2c7cacbd9329955fac77f8cea9dc4a0d5aef1bd23dca318ee6ad767cfefe433d'),
  ('eps.get_candidate_asset_access(jsonb)','get_candidate_asset_access','get_frame_asset_access','41e83770011836dcef48ccda3741c95b638185d93138a09b420d06569701d6af'),
  ('eps.reserve_candidate_job_output(jsonb)','reserve_candidate_job_output','reserve_frame_job_output','fe1e39058b643592ccea14b9840a32f13934e0333301f860aefe419d03bd8b73'),
  ('eps.complete_candidate_job_output(jsonb)','complete_candidate_job_output','complete_frame_job_output','a9d129a5ba2f4b012ff54a7d1e81b1dcc0dde74825bd0005c3cd6c2a1469f221'),
  ('eps.candidate_capability_allowed(text,text,text)','candidate_capability_allowed','frame_capability_allowed','fbe7f0270534a1f65554c095aca6e1cbf5862624e59d450c06c73374618ffd07')
 ) as clones(signature,old_name,new_name,old_hash) loop
  select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>item.old_hash then raise exception 'REVIEWED_FRAME_LEAF_SOURCE_REQUIRED: %',item.signature;end if;
  replacement:=replace(replace(replace(replace(source,'eps.candidate_stage_current','eps.frame_stage_current'),'eps.candidate_stage_lock','eps.frame_stage_lock'),'eps.candidate_stage_source_matches','eps.frame_source_matches'),'eps.candidate_stage_live','eps.frame_stage_live');
  if item.old_name='claim_candidate_job_stage' then
   replacement:=replace(replacement,'''prepare_candidate'',''transcribe_candidate'',''extract_candidate'',''select_frames'',''apply_candidate''','''extract_frames'',''apply_frames''');
   replacement:=replace(replacement,'eps.candidate_asset_config where id and enabled','eps.frame_extraction_config where id and enabled and native_image_id=job.input#>>''{configuration,native_image_id}''');
   replacement:=replace(replacement,'eps.frame_source_matches(job)','(eps.frame_source_matches(job) or eps.frame_source_identity_matches(job) and exists(select 1 from jsonb_array_elements(job.completed_stages) s where s->>''stage''=p_input->>''stage'' and s->>''input_hash''=job.input_hash))');
  elsif item.old_name='record_candidate_job_event' then
   replacement:=replace(replacement,'''prepare_candidate'',''transcribe_candidate'',''extract_candidate'',''select_frames'',''apply_candidate''','''extract_frames'',''apply_frames''');
   replacement:=replace(replace(replacement,'eps.candidate_validate_stage','eps.frame_validate_stage'),'eps.apply_candidate_scan','eps.apply_frame_extraction');
   replacement:=replace(replacement,'job.stage=''apply_candidate''','job.stage=''apply_frames''');
   old_next:='case job.stage when ''prepare_candidate'' then ''transcribe_candidate'' when ''transcribe_candidate'' then ''extract_candidate'' when ''extract_candidate'' then ''select_frames'' when ''select_frames'' then ''apply_candidate'' else null end';
   if position(old_next in replacement)=0 then raise exception 'REVIEWED_FRAME_STAGE_CHAIN_REQUIRED';end if;
   replacement:=replace(replacement,old_next,'case job.stage when ''extract_frames'' then ''apply_frames'' else null end');
  elsif item.old_name='reserve_candidate_job_output' then
   replacement:=replace(replacement,'kind:=p_input->>''asset_kind'';','kind:=p_input->>''asset_kind'';perform eps.specs_stage_assert(kind=''candidate_frame'');');
   replacement:=replace(replacement,'job.stage=''prepare_candidate''','job.stage=''extract_frames''');
   replacement:=replace(replacement,'^frame_([0-9]|1[01])$','^frame_[0-9]$');
  elsif item.old_name='complete_candidate_job_output' then replacement:=replace(replacement,'asset.purpose not in(''audio'',''transcript'',''candidate_frame'')','asset.purpose<>''candidate_frame''');
  end if;
  if replacement=source then raise exception 'REVIEWED_FRAME_CLONE_TRANSFORM_REQUIRED';end if;
  definition:=replace(replace(definition,source,replacement),'FUNCTION eps.'||item.old_name||'(','FUNCTION eps.'||item.new_name||'(');execute definition;
 end loop;
end $frame_clones$;

create policy frame_asset_service_insert on eps.media_assets for insert to eps_candidate_assets_owner with check(purpose='candidate_frame' and status='uploading' and bucket='eps-candidate-outputs' and sha256 is null and output_stage='extract_frames' and eps.frame_stage_live(producing_job_id,producing_attempt_id,(select j.input_hash from eps.jobs j where j.id=producing_job_id)));
create policy frame_asset_service_complete on eps.media_assets for update to eps_candidate_assets_owner using(purpose='candidate_frame' and status='uploading' and output_stage='extract_frames' and eps.frame_stage_live(producing_job_id,producing_attempt_id,(select j.input_hash from eps.jobs j where j.id=producing_job_id))) with check(status='ready' and sha256 is not null);

grant create on schema eps to eps_candidate_stage_owner,eps_candidate_assets_owner;
do $$declare routine regprocedure;begin
 foreach routine in array array[
  'eps.frame_job_hash(jsonb)'::regprocedure,'eps.frame_stage_can_execute(uuid)'::regprocedure,'eps.frame_is_job(uuid)'::regprocedure,
  'eps.frame_capture_input(uuid,uuid)'::regprocedure,'eps.frame_source_identity_matches(eps.jobs)'::regprocedure,'eps.frame_source_matches(eps.jobs)'::regprocedure,'eps.frame_stage_lock(uuid,boolean)'::regprocedure,
  'eps.frame_stage_current(uuid,uuid,text)'::regprocedure,'eps.frame_stage_live(uuid,uuid,text)'::regprocedure,
  'eps.claim_frame_job_stage(jsonb)'::regprocedure,'eps.get_frame_stage_input(uuid,uuid,text)'::regprocedure,'eps.frame_validate_stage(eps.jobs,text,jsonb)'::regprocedure,
  'eps.apply_frame_extraction(uuid,uuid,text,text,jsonb)'::regprocedure,'eps.record_frame_job_event(jsonb)'::regprocedure,'eps.recover_frame_job_stages(integer)'::regprocedure
 ] loop execute format('alter function %s owner to eps_candidate_stage_owner',routine);execute format('revoke all on function %s from public,anon,authenticated,service_role,eps_api_owner,eps_cast_owner',routine);end loop;
 foreach routine in array array['eps.get_frame_asset_access(jsonb)'::regprocedure,'eps.reserve_frame_job_output(jsonb)'::regprocedure,'eps.complete_frame_job_output(jsonb)'::regprocedure,'eps.frame_capability_allowed(text,text,text)'::regprocedure]
 loop execute format('alter function %s owner to eps_candidate_assets_owner',routine);execute format('revoke all on function %s from public,anon,authenticated,service_role,eps_api_owner,eps_cast_owner',routine);end loop;
end $$;
revoke create on schema eps from eps_candidate_stage_owner,eps_candidate_assets_owner;
grant execute on function eps.frame_capture_input(uuid,uuid),eps.frame_job_hash(jsonb) to eps_cast_owner;
grant execute on function eps.frame_stage_current(uuid,uuid,text),eps.frame_stage_live(uuid,uuid,text) to eps_candidate_assets_owner;
grant execute on function eps.frame_is_job(uuid),eps.claim_frame_job_stage(jsonb),eps.get_frame_stage_input(uuid,uuid,text),eps.record_frame_job_event(jsonb),eps.recover_frame_job_stages(integer),eps.frame_stage_lock(uuid,boolean),eps.frame_source_matches(eps.jobs),eps.frame_source_identity_matches(eps.jobs) to eps_specs_stage_owner;
grant execute on function eps.frame_is_job(uuid),eps.get_frame_asset_access(jsonb),eps.reserve_frame_job_output(jsonb),eps.complete_frame_job_output(jsonb) to eps_specs_assets_owner;
grant execute on function eps.frame_is_job(uuid),eps.frame_source_matches(eps.jobs),eps.frame_stage_can_execute(uuid) to eps_jobs_owner;
grant create on schema public to eps_cast_owner;
alter function public.eps_extract_candidate_frames(uuid,jsonb,text) owner to eps_cast_owner;
revoke create on schema public from eps_cast_owner;
revoke all on function public.eps_extract_candidate_frames(uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.eps_extract_candidate_frames(uuid,jsonb,text) to authenticated;

-- Preserve17 implementations except closed frame dispatch. Login roles keep
-- exactly their existing11 entrypoints; none receives a new function grant.
do $frame_dispatch$
declare item record;source text;definition text;replacement text;anchor text;insertion text;begin
 for item in select * from (values
  ('eps.claim_job_stage(jsonb)','8fcace269d3eee540a48828674634f7fbd5497579ab68586bb6db7f3a7d507b3',E'begin\n',E'begin\n if p_input->>''stage'' in(''extract_frames'',''apply_frames'') then return eps.claim_frame_job_stage(p_input);end if;\n'),
  ('eps.record_job_event(jsonb)','a5f7bc003cddf5025ee3e5688ef9cece2a9d45529e9c38ed5516ad8283349b54',E'begin\n',E'begin\n if p_event->>''stage'' in(''extract_frames'',''apply_frames'') then return eps.record_frame_job_event(p_event);end if;\n'),
  ('eps.get_specs_stage_input(uuid,uuid,text)','19255d9da9f1338e4736a0c58aa9b95165d737cc95fcbfb892fa3ec6ba673cca',E'begin\n',E'begin\n if eps.frame_is_job(p_job_id) then return eps.get_frame_stage_input(p_job_id,p_attempt_id,p_lease_token);end if;\n'),
  ('eps.get_job_asset_access(jsonb)','cbeb99eeaeba5833541ccacacca40786e25405af5b108225688214d69d91f7e7',E'begin\n',E'begin\n if eps.frame_is_job(eps.input_uuid(p_input->>''job_id'')) then return eps.get_frame_asset_access(p_input);end if;\n'),
  ('eps.reserve_job_output(jsonb)','ccf48ffc8dcbe82696b7da9f835f0c38944887f0000294d0f0e742b3710a9b78',E'begin\n',E'begin\n if eps.frame_is_job(eps.input_uuid(p_input->>''job_id'')) then return eps.reserve_frame_job_output(p_input);end if;\n'),
  ('eps.complete_job_output(jsonb)','db6031c3c128b17245fd1d5e5e00ba0ef87c5f088920f0cc9d450eb1cc5db6c4',E'begin\n',E'begin\n if eps.frame_is_job(eps.input_uuid(p_input->>''job_id'')) then return eps.complete_frame_job_output(p_input);end if;\n'),
  ('eps.recover_job_stages(integer)','a793eba7674871d3fda3851864e94a894dbb5f08aab3fca7f24c718364c0c434','return jsonb_build_object(''recovered'',recovered+eps.recover_candidate_job_stages(p_limit-recovered));','recovered:=recovered+eps.recover_candidate_job_stages(p_limit-recovered);return jsonb_build_object(''recovered'',recovered+eps.recover_frame_job_stages(p_limit-recovered));'),
  ('eps.candidate_capability_allowed(text,text,text)','fbe7f0270534a1f65554c095aca6e1cbf5862624e59d450c06c73374618ffd07',E'begin\n',E'begin\n if eps.frame_capability_allowed(p_bucket,p_key,p_permission) then return true;end if;\n')
 ) as changes(signature,old_hash,old_anchor,new_value) loop
  select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>item.old_hash then raise exception 'REVIEWED_FRAME_DISPATCH_SOURCE_REQUIRED: %',item.signature;end if;
  anchor:=item.old_anchor;insertion:=item.new_value;if position(E'\r\n' in source)>0 then anchor:=replace(anchor,E'\n',E'\r\n');insertion:=replace(insertion,E'\n',E'\r\n');end if;
  if position(anchor in source)=0 then raise exception 'REVIEWED_FRAME_DISPATCH_ANCHOR_REQUIRED: %',item.signature;end if;
  if anchor in(E'begin\n',E'begin\r\n') then replacement:=overlay(source placing insertion from position(anchor in source) for length(anchor));else replacement:=replace(source,anchor,insertion);end if;
  execute replace(definition,source,replacement);
 end loop;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid='eps.claim_job_stage_replay(jsonb,text,text,text)'::regprocedure;
 if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>'83e2e0dd6c629ef23173a9b74eafa98b8ccdb9338060bfb55217108037f0531d' then raise exception 'REVIEWED_FRAME_REPLAY_SOURCE_REQUIRED';end if;
 anchor:='if eps.candidate_is_job(old.job_id) then job:=eps.candidate_stage_lock(old.job_id);else job:=eps.specs_stage_lock(old.job_id);end if;';
 if position(anchor in source)=0 then raise exception 'REVIEWED_FRAME_REPLAY_LOCK_REQUIRED';end if;
 replacement:=replace(source,anchor,'if eps.frame_is_job(old.job_id) then job:=eps.frame_stage_lock(old.job_id);elsif eps.candidate_is_job(old.job_id) then job:=eps.candidate_stage_lock(old.job_id);else job:=eps.specs_stage_lock(old.job_id);end if;');
 anchor:='case when job.kind=''candidate_scan'' then eps.candidate_stage_source_matches(job) else eps.specs_stage_source_matches(job) end';
 if position(anchor in replacement)=0 then raise exception 'REVIEWED_FRAME_REPLAY_SOURCE_ANCHOR_REQUIRED';end if;
 replacement:=replace(replacement,anchor,'case when job.kind=''frame_extract'' then (eps.frame_source_matches(job) or eps.frame_source_identity_matches(job) and exists(select 1 from jsonb_array_elements(job.completed_stages) s where s->>''stage''=p_input->>''stage'' and s->>''input_hash''=job.input_hash)) when job.kind=''candidate_scan'' then eps.candidate_stage_source_matches(job) else eps.specs_stage_source_matches(job) end');
 execute replace(definition,source,replacement);
end $frame_dispatch$;
notify pgrst,'reload schema';
