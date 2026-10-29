-- LOCAL DEVELOPMENT COMPOSITION after candidate core and candidate kernel.
-- No upload reservation, arbitrary source setter, role provisioning or network.
set local search_path=''; set local lock_timeout='3s'; set local statement_timeout='30s';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or current_setting('eps.m03_candidate_rehearsal',true) is distinct from 'rollback-only-v1'
  or to_regclass('eps.candidates') is null or to_regclass('eps.candidate_stage_payloads') is null
  or not exists(select 1 from pg_roles where rolname='eps_candidate_stage_owner')
  or exists(select 1 from pg_roles where rolname='eps_candidate_apply_owner')
 then raise exception 'M03_APPLY_LOCAL_COMPOSITION_REQUIRED'; end if;
end $$;
create role eps_candidate_apply_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_candidate_apply_owner to postgres;
grant usage on schema eps,public to eps_candidate_apply_owner;
grant select on eps.jobs,eps.candidate_stage_payloads,eps.media_assets,eps.candidates,eps.candidate_media,eps.candidate_media_frames,eps.workspace_candidates to eps_candidate_apply_owner;
grant select(id,project_id,archived_at,row_version,draft_revision) on eps.workspaces to eps_candidate_apply_owner;
grant select(id,archived_at) on public.projects to eps_candidate_apply_owner;
grant select(project_id,principal_id,can_write,active) on public.project_memberships to eps_candidate_apply_owner;
grant select(principal_id,capability,active) on public.app_capability_grants to eps_candidate_apply_owner;
grant insert on eps.candidates,eps.candidate_media,eps.candidate_media_frames,eps.workspace_candidates to eps_candidate_apply_owner;
grant update(row_version,draft_revision,has_unpublished_changes,updated_at) on eps.workspaces to eps_candidate_apply_owner;
grant insert(principal_id,action,resource_id,request_id,client_type) on eps.audit_events to eps_candidate_apply_owner;
-- SELECT FOR UPDATE requires a harmless UPDATE grant even when the function
-- only locks the immutable job. No status/input/lease mutation is authorized.
grant update(row_version) on eps.jobs,eps.candidates to eps_candidate_apply_owner;
grant execute on function eps.fail(text,text,integer,bigint),eps.input_uuid(text),eps.check_input(jsonb,text[]),eps.cast_facts(jsonb),eps.cast_fingerprint(jsonb,jsonb),eps.cast_canonical(jsonb),eps.job_requester_active(uuid) to eps_candidate_apply_owner;
create policy candidate_apply_jobs_read on eps.jobs for select to eps_candidate_apply_owner using(kind='candidate_scan');
create policy candidate_apply_jobs_lock on eps.jobs for update to eps_candidate_apply_owner using(kind='candidate_scan') with check(kind='candidate_scan');
create policy candidate_apply_payload_read on eps.candidate_stage_payloads for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_assets_read on eps.media_assets for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_candidates_read on eps.candidates for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_candidates_lock on eps.candidates for update to eps_candidate_apply_owner using(true) with check(true);
create policy candidate_apply_candidates_insert on eps.candidates for insert to eps_candidate_apply_owner with check(source_kind='scan' and exists(select 1 from eps.jobs job where job.id::text=current_setting('eps.candidate_apply.job_id',true) and job.requested_by=created_by and job.kind='candidate_scan' and job.stage='apply_candidate' and job.status='running'));
create policy candidate_apply_media_read on eps.candidate_media for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_media_insert on eps.candidate_media for insert to eps_candidate_apply_owner with check(source_job_id::text=current_setting('eps.candidate_apply.job_id',true));
create policy candidate_apply_frames_read on eps.candidate_media_frames for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_frames_insert on eps.candidate_media_frames for insert to eps_candidate_apply_owner with check(exists(select 1 from eps.candidate_media media where media.id=candidate_media_id and media.source_job_id::text=current_setting('eps.candidate_apply.job_id',true)));
create policy candidate_apply_pool_read on eps.workspace_candidates for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_pool_insert on eps.workspace_candidates for insert to eps_candidate_apply_owner with check(exists(select 1 from eps.jobs job where job.id::text=current_setting('eps.candidate_apply.job_id',true) and job.workspace_id=workspace_candidates.workspace_id));
create policy candidate_apply_workspace_read on eps.workspaces for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_workspace_update on eps.workspaces for update to eps_candidate_apply_owner using(exists(select 1 from eps.jobs job where job.id::text=current_setting('eps.candidate_apply.job_id',true) and job.workspace_id=workspaces.id)) with check(exists(select 1 from eps.jobs job where job.id::text=current_setting('eps.candidate_apply.job_id',true) and job.workspace_id=workspaces.id));
create policy candidate_apply_project_read on public.projects for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_membership_read on public.project_memberships for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_capability_read on public.app_capability_grants for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_audit_insert on eps.audit_events for insert to eps_candidate_apply_owner with check(action='candidate.scan_applied' and client_type='api' and exists(select 1 from eps.jobs job where job.id::text=current_setting('eps.candidate_apply.job_id',true) and job.requested_by=audit_events.principal_id));

create function eps.candidate_apply_assert(p_condition boolean,p_code text default 'RESULT_INVALID') returns void language plpgsql immutable security invoker set search_path='' as $$ begin
 if p_condition is distinct from true then perform eps.fail(p_code,'The candidate application could not be validated.',case when p_code='LEASE_INVALID' then 403 when p_code='RESOURCE_NOT_FOUND' then 404 else 409 end); end if;
end $$;
create function eps.apply_candidate_scan(p_job_id uuid,p_attempt_id uuid,p_lease_token text,p_input_hash text,p_result jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
#variable_conflict use_variable
declare job eps.jobs; source eps.media_assets; candidate eps.candidates; media eps.candidate_media; workspace eps.workspaces;
 prepared eps.candidate_stage_payloads; transcribed eps.candidate_stage_payloads; extracted eps.candidate_stage_payloads; selected eps.candidate_stage_payloads;
 extraction jsonb; transcript jsonb; facts jsonb; provenance jsonb:='{}'; evidence jsonb; ref jsonb; segment jsonb; field text; claim jsonb; frame jsonb; frame_asset eps.media_assets;
 candidate_id uuid; media_id uuid; pool_id uuid; source_casting_id text; chosen_frames uuid[]; transcript_id uuid; languages text[]; issues text[]:='{}'; result jsonb; changed bigint; begin
 perform eps.candidate_apply_assert(p_job_id is not null and p_attempt_id is not null and length(p_lease_token) between 1 and 1024 and p_input_hash ~ '^[a-f0-9]{64}$','INVALID_REQUEST');
 select * into job from eps.jobs where id=p_job_id and kind='candidate_scan' for update;
 perform eps.candidate_apply_assert(found,'RESOURCE_NOT_FOUND');
 perform eps.candidate_apply_assert(job.stage='apply_candidate' and job.status='running' and job.cancel_requested_at is null and job.current_attempt_id=p_attempt_id and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.candidate_apply_assert(job.lease_token_digest=encode(sha256(convert_to(p_lease_token,'UTF8')),'hex'),'LEASE_INVALID');
 perform eps.candidate_apply_assert(job.input_hash=p_input_hash,'INPUT_HASH_MISMATCH');
 perform eps.candidate_apply_assert(job.input->>'schema_version'='1.0' and job.input->>'workspace_id'=job.workspace_id::text and job.input->>'source_asset_id'=job.input_asset_id::text,'INPUT_CHANGED');
 perform eps.candidate_apply_assert(jsonb_typeof(p_result)='object' and (select count(*)=1 from jsonb_object_keys(p_result)) and p_result->>'source_asset_id'=job.input_asset_id::text);
 perform set_config('eps.candidate_apply.job_id',job.id::text,true);
 select id,project_id,archived_at,row_version,draft_revision into workspace.id,workspace.project_id,workspace.archived_at,workspace.row_version,workspace.draft_revision
  from eps.workspaces where id=job.workspace_id and archived_at is null for update;
 perform eps.candidate_apply_assert(found and workspace.project_id::text=job.input->>'project_id','INPUT_CHANGED');
 perform eps.candidate_apply_assert(eps.job_requester_active(job.requested_by) and exists(select 1 from public.projects where id=workspace.project_id and archived_at is null)
  and exists(select 1 from public.project_memberships where project_id=workspace.project_id and principal_id=job.requested_by and active and can_write)
  and not exists(select 1 from unnest(array['projects.read','workspaces.write','cast.upload','cast.read']) required where not exists(select 1 from public.app_capability_grants where principal_id=job.requested_by and capability=required and active)),'CAPABILITY_REQUIRED');
 select * into source from eps.media_assets where id=job.input_asset_id and status='ready' and purpose='candidate_video';
 perform eps.candidate_apply_assert(found and source.origin_workspace_id=job.workspace_id and source.size_bytes=(job.input->>'source_size_bytes')::bigint and source.mime_type=job.input->>'source_mime_type' and source.sha256 is not null and source.duration_ms>0 and source.width>0 and source.height>0,'INPUT_CHANGED');
 select * into prepared from eps.candidate_stage_payloads where job_id=job.id and stage='prepare_candidate' and input_hash=job.input_hash;
 perform eps.candidate_apply_assert(found and prepared.result_schema='media-preparation.v1' and prepared.payload->>'source_asset_id'=source.id::text and prepared.payload->>'source_sha256'=source.sha256);
 select * into transcribed from eps.candidate_stage_payloads where job_id=job.id and stage='transcribe_candidate' and input_hash=job.input_hash;
 perform eps.candidate_apply_assert(found and transcribed.result_schema='candidate-transcript-stage.v1' and transcribed.payload->>'source_asset_id'=source.id::text);
 select * into extracted from eps.candidate_stage_payloads where job_id=job.id and stage='extract_candidate' and input_hash=job.input_hash;
 perform eps.candidate_apply_assert(found and extracted.result_schema='candidate-extraction-stage.v1' and extracted.payload->>'source_asset_id'=source.id::text);
 select * into selected from eps.candidate_stage_payloads where job_id=job.id and stage='select_frames' and input_hash=job.input_hash;
 perform eps.candidate_apply_assert(found and selected.result_schema='frame-selection-stage.v1' and selected.payload->>'source_asset_id'=source.id::text);
 -- The four canonical payload IDs must be the successful completed outputs,
 -- rather than a stale private payload injected before a stage completed.
 perform eps.candidate_apply_assert(not exists(select 1 from (values(prepared.id,prepared.stage,prepared.attempt_id),(transcribed.id,transcribed.stage,transcribed.attempt_id),(extracted.id,extracted.stage,extracted.attempt_id),(selected.id,selected.stage,selected.attempt_id)) payload(id,stage,attempt) where not exists(select 1 from jsonb_array_elements(job.completed_stages) completed where completed->>'stage'=payload.stage and completed->>'attempt_id'=payload.attempt::text and completed->>'input_hash'=job.input_hash and completed#>>'{result,stage_output_id}'=payload.id::text)));
 transcript:=transcribed.payload->'original_transcript'; extraction:=extracted.payload->'result';
 if extraction is null or extraction='null'::jsonb then
  perform eps.candidate_apply_assert(extracted.payload->'manual_profile_required'='true'::jsonb and (
   transcript='null'::jsonb and transcribed.payload->'transcript_asset'='null'::jsonb
   or extracted.payload->>'missing_extraction_reason'='CANDIDATE_EXTRACTION_FAILED' and jsonb_typeof(transcript)='object'
    and transcript->>'source_asset_id'=source.id::text and jsonb_typeof(transcript->'original_text')='string' and jsonb_typeof(transcript->'segments')='array'));
  facts:='{"name":null,"casting_id":null,"age_or_range":null,"stated_gender":null,"height_measurements":null,"languages":[],"accents":[],"skills_experience":null,"city":null,"previous_projects_roles":null,"classification":null}'::jsonb;
 else
  perform eps.candidate_apply_assert(extraction->>'schema_version'='1.0' and extraction->>'source_asset_id'=source.id::text and transcript->>'source_asset_id'=source.id::text and jsonb_typeof(transcript->'segments')='array' and jsonb_typeof(transcript->'original_text')='string' and jsonb_typeof(extraction->'evidence')='array');
  facts:=eps.cast_facts(extraction->'facts');
  for evidence in select value from jsonb_array_elements(extraction->'evidence') loop
   field:=evidence->>'field_path'; ref:=evidence->'source';
   perform eps.candidate_apply_assert(field='project_availability_statement' or field=any(array['facts.name','facts.casting_id','facts.age_or_range','facts.stated_gender','facts.height_measurements','facts.languages','facts.accents','facts.skills_experience','facts.city','facts.previous_projects_roles','facts.classification']));
   select value into segment from jsonb_array_elements(transcript->'segments') value where value->'index'=ref->'segment_index';
   perform eps.candidate_apply_assert(segment is not null and ref->>'asset_id'=source.id::text and ref->'page'='null'::jsonb and ref->'paragraph'='null'::jsonb and nullif(btrim(ref->>'quote'),'') is not null and position(ref->>'quote' in segment->>'text')>0 and ref->'start_ms'=segment->'start_ms' and ref->'end_ms'=segment->'end_ms');
   if field like 'facts.%' and not provenance?substring(field from 7) then provenance:=provenance||jsonb_build_object(substring(field from 7),jsonb_build_object('kind','transcript','source',ref)); end if;
  end loop;
  for field,claim in select key,value from jsonb_each(facts) loop
   if claim<>'null'::jsonb and claim<>'[]'::jsonb then perform eps.candidate_apply_assert(provenance?field); end if;
  end loop;
  if extraction->'project_availability_statement'<>'null'::jsonb then perform eps.candidate_apply_assert(exists(select 1 from jsonb_array_elements(extraction->'evidence') value where value->>'field_path'='project_availability_statement')); end if;
 end if;
 if transcribed.payload->'transcript_asset'<>'null'::jsonb then
  transcript_id:=eps.input_uuid(transcribed.payload#>>'{transcript_asset,asset_id}');
  perform eps.candidate_apply_assert(exists(select 1 from eps.media_assets asset where asset.id=transcript_id and asset.status='ready' and asset.purpose='transcript' and asset.mime_type='application/json' and asset.sha256=transcribed.payload#>>'{transcript_asset,sha256}' and asset.source_asset_id=source.id and asset.producing_job_id=job.id and asset.producing_attempt_id=transcribed.attempt_id and asset.output_stage='transcribe_candidate'));
 end if;
 select coalesce(array_agg(value),'{}') into languages from jsonb_array_elements_text(transcribed.payload->'languages') value;
 perform eps.candidate_apply_assert(jsonb_typeof(selected.payload->'selected_frames')='array' and jsonb_array_length(selected.payload->'selected_frames')<=3);
 select coalesce(array_agg(eps.input_uuid(value->>'frame_asset_id') order by ordinal),'{}') into chosen_frames from jsonb_array_elements(selected.payload->'selected_frames') with ordinality list(value,ordinal);
 perform eps.candidate_apply_assert(cardinality(chosen_frames)=(select count(distinct frame_id) from unnest(chosen_frames) frame_id));
 if cardinality(chosen_frames)<3 then perform eps.candidate_apply_assert(nullif(btrim(selected.payload->>'insufficient_frames_reason'),'') is not null); end if;
 perform eps.candidate_apply_assert(not exists(select 1 from unnest(chosen_frames) frame_id where not exists(select 1 from jsonb_array_elements(prepared.payload->'sampled_frames') available where available->>'frame_asset_id'=frame_id::text)));
 if prepared.payload#>'{probe,has_audio}'='false'::jsonb or transcribed.payload->>'missing_transcript_reason'='NO_INTELLIGIBLE_AUDIO' then issues:=array_append(issues,'NO_AUDIO');end if;
 if transcribed.payload->>'missing_transcript_reason'='TRANSCRIPTION_FAILED' then issues:=array_append(issues,'TRANSCRIPTION_FAILED');end if;
 if extracted.payload->>'missing_extraction_reason'='CANDIDATE_EXTRACTION_FAILED' then issues:=array_append(issues,'EXTRACTION_FAILED');end if;
 if cardinality(chosen_frames)<3 then issues:=array_append(issues,'INSUFFICIENT_FRAMES');end if;
 candidate_id:=case when job.input->>'target_candidate_id' is not null then eps.input_uuid(job.input->>'target_candidate_id') end;
 if candidate_id is not null then
  select * into candidate from eps.candidates where id=candidate_id and archived_at is null and merged_into_candidate_id is null for update;
  perform eps.candidate_apply_assert(found and candidate.row_version=(job.input->>'target_candidate_row_version')::bigint,'INPUT_CHANGED');
  -- New media is appended; supplied facts and factual confirmation are untouched.
 else
  candidate_id:=gen_random_uuid(); source_casting_id:=facts->>'casting_id';
  if source_casting_id is null or exists(select 1 from eps.candidates where lower(casting_id)=lower(source_casting_id)) then facts:=jsonb_set(facts,'{casting_id}',to_jsonb('EPS-'||upper(replace(candidate_id::text,'-','')))); end if;
  -- Upload time does not establish when an old recording's stated age applied.
  -- Keep that context unknown until a real recording/as-of date is supplied.
  insert into eps.candidates(id,facts,casting_id,source_casting_id,source_kind,field_sources,age_as_of,created_by)
   values(candidate_id,facts,facts->>'casting_id',source_casting_id,'scan',provenance,null,job.requested_by);
 end if;
 -- Stable source asset uniqueness protects uncertain completion/retries. The
 -- kernel handles callback replay; a different job cannot reassign this video.
 select * into media from eps.candidate_media where source_asset_id=source.id;
 if found then
  perform eps.candidate_apply_assert(media.source_job_id=job.id and media.candidate_id=candidate_id,'INPUT_CHANGED'); media_id:=media.id;
 else
  media_id:=gen_random_uuid();
  insert into eps.candidate_media(id,candidate_id,source_asset_id,transcript_asset_id,original_transcript,transcript_segments,languages,extraction,source_job_id,selected_frame_asset_ids,processing_issues)
   values(media_id,candidate_id,source.id,transcript_id,transcript->>'original_text',coalesce(transcript->'segments','[]'::jsonb),languages,nullif(extraction,'null'::jsonb),job.id,chosen_frames,issues);
  for frame in select value from jsonb_array_elements(prepared.payload->'sampled_frames') loop
   select * into frame_asset from eps.media_assets where id=eps.input_uuid(frame->>'frame_asset_id');
   perform eps.candidate_apply_assert(found and frame_asset.status='ready' and frame_asset.purpose='candidate_frame' and frame_asset.source_asset_id=source.id and frame_asset.producing_job_id=job.id and frame_asset.producing_attempt_id=prepared.attempt_id and frame_asset.output_stage='prepare_candidate' and frame_asset.sha256=frame->>'sha256' and frame_asset.source_timestamp_ms=(frame->>'timestamp_ms')::bigint and frame_asset.source_timestamp_ms<source.duration_ms and frame_asset.width=(frame->>'width')::integer and frame_asset.height=(frame->>'height')::integer);
   insert into eps.candidate_media_frames(candidate_media_id,asset_id,quality_flags) values(media_id,frame_asset.id,array(select jsonb_array_elements_text(frame->'quality_flags')));
  end loop;
 end if;
 select participation.id into pool_id from eps.workspace_candidates participation
  where participation.workspace_id=job.workspace_id and participation.candidate_id=candidate_id and participation.archived_at is null;
 if not found then
  insert into eps.workspace_candidates(workspace_id,candidate_id,selected_candidate_media_id,selected_frame_asset_ids,availability)
   values(job.workspace_id,candidate_id,media_id,chosen_frames,extraction->>'project_availability_statement') returning id into pool_id;
 end if;
 -- Existing workspace media/fresh-material/availability/notes are pinned. The
 -- original project may explicitly choose this new recording after review.
 update eps.workspaces set row_version=row_version+1,draft_revision=draft_revision+1,has_unpublished_changes=true,updated_at=clock_timestamp() where id=job.workspace_id;
 get diagnostics changed=row_count; perform eps.candidate_apply_assert(changed=1,'INPUT_CHANGED');
 insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type) values(job.requested_by,'candidate.scan_applied',candidate_id,job.correlation_id,'api');
 result:=jsonb_build_object('candidate_id',candidate_id,'candidate_media_id',media_id,'workspace_candidate_id',pool_id,'source_asset_id',source.id,'workspace_id',job.workspace_id,'review_status',case when candidate.reviewed_facts_fingerprint is not null and candidate.reviewed_facts_fingerprint=eps.cast_fingerprint(candidate.facts,candidate.field_sources) then 'reviewed' else 'unreviewed' end);
 return result;
end $$;
grant create on schema eps to eps_candidate_apply_owner;
alter function eps.candidate_apply_assert(boolean,text) owner to eps_candidate_apply_owner;
alter function eps.apply_candidate_scan(uuid,uuid,text,text,jsonb) owner to eps_candidate_apply_owner;
revoke create on schema eps from eps_candidate_apply_owner;
revoke all on function eps.candidate_apply_assert(boolean,text),eps.apply_candidate_scan(uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role,eps_jobs_executor,eps_cast_owner;
grant execute on function eps.apply_candidate_scan(uuid,uuid,text,text,jsonb) to eps_candidate_stage_owner;
