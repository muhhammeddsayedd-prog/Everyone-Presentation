-- Private candidate job kernel. Compose after candidate-kernel-tables.sql and
-- root-owned candidate upload/Storage constraints; no public service identity.
set local search_path='';
alter table eps.jobs drop constraint jobs_kind_check;
alter table eps.jobs add constraint jobs_kind_check check(kind in('specs_extract','candidate_scan'));
alter table eps.jobs drop constraint jobs_stage_check;
alter table eps.jobs add constraint jobs_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate'));
alter table eps.jobs add constraint jobs_kind_stage_check check((kind='specs_extract' and stage in('prepare_document','extract_specs','apply_specs')) or (kind='candidate_scan' and stage in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate')));
alter table eps.jobs drop constraint jobs_input_hash_version_check;
alter table eps.jobs add constraint jobs_input_hash_version_check check(input_hash_version in('eps.specs-input.pg-jsonb.v1','eps.candidate-input.pg-jsonb.v1'));
alter table eps.job_events drop constraint job_events_stage_check;
alter table eps.job_events add constraint job_events_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate'));
alter table eps.outbox_events drop constraint outbox_events_stage_check;
alter table eps.outbox_events add constraint outbox_events_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate'));

grant select on eps.jobs,eps.job_events,eps.outbox_events,eps.media_assets to eps_candidate_stage_owner;
grant update on eps.jobs to eps_candidate_stage_owner;
grant insert on eps.job_events,eps.outbox_events to eps_candidate_stage_owner;
grant select(id,project_id,archived_at),update(id) on eps.workspaces to eps_candidate_stage_owner;
grant update(id) on eps.candidate_uploads to eps_candidate_stage_owner;
grant select(id,archived_at) on public.projects to eps_candidate_stage_owner;
grant select(project_id,principal_id,active,can_write) on public.project_memberships to eps_candidate_stage_owner;
grant select(principal_id,capability,active) on public.app_capability_grants to eps_candidate_stage_owner;
grant update(status,sha256,width,height,duration_ms) on eps.media_assets to eps_candidate_stage_owner;
grant execute on function eps.job_requester_active(uuid),eps.fail(text,text,integer,bigint),eps.specs_stage_assert(boolean,text),
 eps.specs_stage_shape(jsonb,text[],text[]),eps.specs_stage_integer(jsonb,bigint,bigint),eps.specs_stage_error(text,boolean,jsonb) to eps_candidate_stage_owner;
grant execute on function extensions.gen_random_bytes(integer) to eps_candidate_stage_owner,eps_candidate_assets_owner;
create policy candidate_stage_jobs_read on eps.jobs for select to eps_candidate_stage_owner using(kind='candidate_scan');
create policy candidate_stage_jobs_update on eps.jobs for update to eps_candidate_stage_owner using(kind='candidate_scan') with check(kind='candidate_scan');
create policy candidate_stage_events_read on eps.job_events for select to eps_candidate_stage_owner using(true);
create policy candidate_stage_events_insert on eps.job_events for insert to eps_candidate_stage_owner with check(true);
create policy candidate_stage_outbox_read on eps.outbox_events for select to eps_candidate_stage_owner using(true);
create policy candidate_stage_outbox_insert on eps.outbox_events for insert to eps_candidate_stage_owner with check(true);
create policy candidate_stage_workspace_read on eps.workspaces for select to eps_candidate_stage_owner using(true);
create policy candidate_stage_workspace_lock on eps.workspaces for update to eps_candidate_stage_owner using(true) with check(false);
create policy candidate_stage_upload_lock on eps.candidate_uploads for update to eps_candidate_stage_owner using(true) with check(false);
create policy candidate_stage_project_read on public.projects for select to eps_candidate_stage_owner using(true);
create policy candidate_stage_membership_read on public.project_memberships for select to eps_candidate_stage_owner using(true);
create policy candidate_stage_capability_read on public.app_capability_grants for select to eps_candidate_stage_owner using(true);
create policy candidate_stage_media_read on eps.media_assets for select to eps_candidate_stage_owner using(purpose in('candidate_video','audio','transcript','candidate_frame'));
create policy candidate_stage_original_ready on eps.media_assets for update to eps_candidate_stage_owner using(purpose='candidate_video' and status='uploading') with check(purpose='candidate_video' and status='ready' and sha256 is not null and duration_ms between 1 and 1800000 and width>0 and height>0);

create function eps.candidate_job_hash(p_input jsonb) returns text language sql immutable security invoker set search_path='' as $$
 select encode(sha256(convert_to('eps.candidate-input.pg-jsonb.v1:'||p_input::text,'UTF8')),'hex')
$$;
create function eps.candidate_stage_can_write(p_principal uuid,p_workspace uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id
  join public.project_memberships m on m.project_id=p.id and m.principal_id=p_principal
  where w.id=p_workspace and w.archived_at is null and p.archived_at is null and eps.job_requester_active(p_principal) and m.active and m.can_write
   and not exists(select 1 from unnest(array['projects.read','workspaces.write','cast.read','cast.upload']) required
    where not exists(select 1 from public.app_capability_grants g where g.principal_id=p_principal and g.capability=required and g.active)))
$$;
create function eps.candidate_stage_source_matches(p_job eps.jobs) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from eps.candidate_uploads u join eps.media_assets a on a.id=u.asset_id join eps.workspaces w on w.id=u.workspace_id
  where u.id=p_job.resource_id and u.job_id=p_job.id and u.status='completed' and u.completed_input=p_job.input
   and u.principal_id=p_job.requested_by and u.workspace_id=p_job.workspace_id and a.origin_workspace_id=p_job.workspace_id
   and a.id=p_job.input_asset_id and a.purpose='candidate_video' and a.status in('uploading','ready')
   and a.size_bytes=u.expected_size_bytes and a.mime_type=u.expected_mime_type and a.bucket=u.bucket and a.object_key=u.object_key
   and p_job.kind='candidate_scan' and p_job.input->>'schema_version'='1.0' and p_job.input->>'workspace_id'=w.id::text
   and p_job.input->>'project_id'=w.project_id::text and p_job.input->>'source_asset_id'=a.id::text
   and p_job.input->>'source_size_bytes'=a.size_bytes::text and p_job.input->>'source_mime_type'=a.mime_type
   and p_job.input->'source_declared_sha256'=coalesce(to_jsonb(u.expected_sha256),'null'::jsonb)
   and p_job.input_hash_version='eps.candidate-input.pg-jsonb.v1' and p_job.input_hash=eps.candidate_job_hash(p_job.input))
$$;
create function eps.candidate_stage_lock(p_job uuid,p_require_access boolean default true) returns eps.jobs language plpgsql volatile security definer set search_path='' as $$
declare identity_row eps.jobs; job eps.jobs; locked uuid;begin
 select * into identity_row from eps.jobs where id=p_job and kind='candidate_scan';
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Candidate processing job not found.',404);end if;
 select id into locked from eps.workspaces where id=identity_row.workspace_id for update;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');
 select id into locked from eps.candidate_uploads where id=identity_row.resource_id and workspace_id=identity_row.workspace_id for update;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');
 select * into job from eps.jobs where id=p_job and workspace_id=identity_row.workspace_id and resource_id=identity_row.resource_id and kind='candidate_scan' for update;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');
 if p_require_access then perform eps.specs_stage_assert(eps.candidate_stage_can_write(job.requested_by,job.workspace_id),'CAPABILITY_REQUIRED');end if;
 return job;
end $$;
create function eps.candidate_is_job(p_job uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from eps.jobs where id=p_job and kind='candidate_scan')
$$;
create function eps.candidate_stage_current(p_job uuid,p_attempt uuid,p_lease text) returns eps.jobs language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;begin
 job:=eps.candidate_stage_lock(p_job);
 perform eps.specs_stage_assert(job.status='running' and job.current_attempt_id=p_attempt and job.cancel_requested_at is null and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(p_lease~'^[a-f0-9]{64}$' and job.lease_token_digest=encode(sha256(convert_to(p_lease,'UTF8')),'hex'),'LEASE_INVALID');
 perform eps.specs_stage_assert(eps.candidate_stage_source_matches(job),'INPUT_CHANGED');return job;
end $$;
create function eps.candidate_stage_live(p_job uuid,p_attempt uuid,p_input_hash text) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from eps.jobs j where j.id=p_job and j.kind='candidate_scan' and j.current_attempt_id=p_attempt and j.status='running'
  and j.input_hash=p_input_hash and j.cancel_requested_at is null and j.lease_expires_at>clock_timestamp()
  and eps.candidate_stage_can_write(j.requested_by,j.workspace_id) and eps.candidate_stage_source_matches(j))
$$;
create function eps.claim_candidate_job_stage(p_input jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;completed jsonb;token_value text;attempts integer;at_value timestamptz;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','stage','input_hash','workflow_execution_id'],array['job_id','stage','input_hash'])
  and p_input->>'stage' in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate') and p_input->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.candidate_stage_lock((p_input->>'job_id')::uuid);at_value:=clock_timestamp();
 perform eps.specs_stage_assert(exists(select 1 from eps.candidate_asset_config where id and enabled),'DEPENDENCY_UNAVAILABLE');
 perform eps.specs_stage_assert(eps.candidate_stage_source_matches(job),'INPUT_CHANGED');
 perform eps.specs_stage_assert(job.input_hash=p_input->>'input_hash','INPUT_HASH_MISMATCH');
 if job.status='cancelled' or job.cancel_requested_at is not null then perform eps.fail('JOB_CANCELLED','Candidate processing was cancelled.',409);end if;
 select value into completed from jsonb_array_elements(job.completed_stages) value where value->>'stage'=p_input->>'stage' and value->>'input_hash'=job.input_hash;
 if completed is not null then return jsonb_build_object('job_id',job.id,'stage',p_input->>'stage','attempt_id',completed->>'attempt_id','lease_token','',
  'lease_expires_at',completed->>'completed_at','already_completed',true,'input',jsonb_build_object('input_hash',job.input_hash,'result_schema',completed->>'result_schema','result',completed->'result'));end if;
 perform eps.specs_stage_assert(job.stage=p_input->>'stage','STAGE_OUT_OF_ORDER');
 if job.status='running' and job.lease_expires_at>at_value then perform eps.fail('JOB_ALREADY_RUNNING','Candidate stage already has an active lease.',409);end if;
 perform eps.specs_stage_assert(job.status in('queued','running') and job.available_at<=at_value,'JOB_NOT_AVAILABLE');
 attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);perform eps.specs_stage_assert(attempts<3,'RETRY_EXHAUSTED');
 token_value:=encode(extensions.gen_random_bytes(32),'hex');
 update eps.jobs set status='running',attempt=attempt+1,current_attempt_id=gen_random_uuid(),lease_token_digest=encode(sha256(convert_to(token_value,'UTF8')),'hex'),
  lease_expires_at=at_value+interval '90 seconds',heartbeat_at=at_value,last_event_sequence=0,stage_attempts=jsonb_set(stage_attempts,array[stage],to_jsonb(attempts+1)),
  progress_completed=0,progress_total=null,error=null,n8n_execution_id=p_input->>'workflow_execution_id',row_version=row_version+1,updated_at=at_value where id=job.id returning * into job;
 return jsonb_build_object('job_id',job.id,'stage',job.stage,'attempt_id',job.current_attempt_id,'lease_token',token_value,'lease_expires_at',job.lease_expires_at,
  'already_completed',false,'input',job.input||jsonb_build_object('input_hash',job.input_hash));
end $$;
create function eps.get_candidate_stage_input(p_job uuid,p_attempt uuid,p_lease text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;source eps.media_assets;prepared jsonb;transcript jsonb;begin
 job:=eps.candidate_stage_current(p_job,p_attempt,p_lease);select * into strict source from eps.media_assets where id=job.input_asset_id;
 select payload into prepared from eps.candidate_stage_payloads where job_id=job.id and input_hash=job.input_hash and stage='prepare_candidate';
 select payload into transcript from eps.candidate_stage_payloads where job_id=job.id and input_hash=job.input_hash and stage='transcribe_candidate';
 return jsonb_build_object('job_id',job.id,'attempt_id',job.current_attempt_id,'stage',job.stage,'input_hash',job.input_hash,
  'configuration',jsonb_build_object('media_preparation_version',job.input#>'{configuration,media_implementation_version}',
   'transcription_model_version',job.input#>'{configuration,transcription_model}','extraction_model_version',job.input#>'{configuration,extraction_model}',
   'prompt_version','candidate_extract_v1','result_schema_version','1.0'),
  'source',jsonb_build_object('asset_id',source.id,'sha256',coalesce(source.sha256,job.input->>'source_declared_sha256'),'size_bytes',source.size_bytes,'mime_type',source.mime_type))
  ||case when prepared is null then '{}'::jsonb else jsonb_build_object('prepared',prepared) end
  ||case when transcript is null then '{}'::jsonb else jsonb_build_object('transcript_asset',transcript->'transcript_asset') end
  ||jsonb_build_object('allow_partial_transcription',coalesce((job.stage_attempts->>'transcribe_candidate')::integer,0)>=3);
end $$;

-- Fixed definer owners, not a new runtime group or general SQL API.
grant create on schema eps to eps_candidate_stage_owner;
do $$ declare routine record;begin
 for routine in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps' and p.proname in
  ('candidate_job_hash','candidate_stage_can_write','candidate_stage_source_matches','candidate_stage_lock','candidate_is_job','candidate_stage_current','candidate_stage_live','claim_candidate_job_stage','get_candidate_stage_input') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',routine.signature);
  execute format('alter function %s owner to eps_candidate_stage_owner',routine.signature);
 end loop;
end $$;
revoke create on schema eps from eps_candidate_stage_owner;
grant execute on function eps.claim_candidate_job_stage(jsonb),eps.get_candidate_stage_input(uuid,uuid,text),eps.candidate_is_job(uuid),
 eps.candidate_stage_lock(uuid,boolean),eps.candidate_stage_source_matches(eps.jobs),eps.candidate_stage_live(uuid,uuid,text) to eps_specs_stage_owner;
grant execute on function eps.candidate_is_job(uuid),eps.candidate_stage_current(uuid,uuid,text),eps.candidate_stage_live(uuid,uuid,text) to eps_specs_assets_owner,eps_candidate_assets_owner;
