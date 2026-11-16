-- m11: Re-scan a stored candidate video that was never scanned (e.g. the m09 archive import).
-- The worker pipeline is unchanged: a re-scan is an ordinary candidate_scan job.
--  * public.eps_rescan_candidate_media records a completed upload intent for the already-stored
--    video (one per asset, like any upload) and queues the job in the video's origin workspace,
--    naming the existing introduction row in the job input (rescan_candidate_media_id).
--  * eps.apply_candidate_scan fills that existing row once (transcript, extraction, languages,
--    English projection, AI frame pick when none is chosen, sampled frames). Candidate facts,
--    review state and workspace pools are never changed by a re-scan.
-- The requester needs the same rights as an upload into that workspace (project write membership).
set local search_path='';set local lock_timeout='5s';set local statement_timeout='60s';

-- 1. The save step may fill a never-scanned introduction row, only for its own running re-scan job.
grant update(transcript_asset_id,original_transcript,transcript_segments,languages,extraction,source_job_id,selected_frame_asset_ids,
 processing_issues,english_transcript,english_transcript_status,english_transcript_source_sha256,english_transcript_input_hash,
 english_transcript_metadata,row_version) on eps.candidate_media to eps_candidate_apply_owner;
create policy candidate_apply_media_rescan on eps.candidate_media as permissive for update to eps_candidate_apply_owner
 using (source_job_id is null)
 with check ((source_job_id)::text=current_setting('eps.candidate_apply.job_id',true) and exists(select 1 from eps.jobs j
  where j.id=candidate_media.source_job_id and j.kind='candidate_scan' and j.stage='apply_candidate' and j.status='running'
   and j.input_asset_id=candidate_media.source_asset_id and j.input->>'rescan_candidate_media_id'=candidate_media.id::text));

-- The queueing function records its own idempotency and audit rows (same shape as frame extraction).
create policy candidate_rescan_idempotency on eps.idempotency_records as permissive for all to eps_candidate_upload_owner
 using (principal_id=auth.uid() and operation='candidate.rescan_media') with check (principal_id=auth.uid() and operation='candidate.rescan_media');
create policy candidate_rescan_audit on eps.audit_events as permissive for insert to eps_candidate_upload_owner
 with check (principal_id=auth.uid() and action='candidate.rescan_media');

-- 2. Queue a re-scan of a stored introduction video.
create function public.eps_rescan_candidate_media(p_candidate_media_id uuid,p_idempotency_key text) returns jsonb
 language plpgsql volatile security definer set search_path='' as $$
declare m eps.candidate_media;c eps.candidates;a eps.media_assets;workspace eps.workspaces;config eps.candidate_asset_config;intent eps.candidate_uploads;job eps.jobs;
 payload jsonb:=jsonb_build_object('candidate_media_id',p_candidate_media_id);replay jsonb;input_value jsonb;hash_value text;
 upload_id uuid:=gen_random_uuid();job_id uuid:=gen_random_uuid();result jsonb;begin
 perform eps.require_capability('cast.read');perform eps.require_capability('cast.upload');perform eps.require_capability('workspaces.write');perform eps.require_capability('projects.read');
 if p_candidate_media_id is null or p_idempotency_key is null or length(p_idempotency_key) not between 16 and 200 or p_idempotency_key~'[[:cntrl:]]' then
  perform eps.fail('INVALID_REQUEST','Choose a stored introduction video and a bounded Idempotency-Key.',400);end if;
 replay:=eps.idempotency_begin('candidate.rescan_media',p_idempotency_key,payload);if replay is not null then return replay;end if;
 select * into m from eps.candidate_media where id=p_candidate_media_id;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Introduction not found.',404);end if;
 select * into a from eps.media_assets where id=m.source_asset_id and purpose='candidate_video' and status='ready';
 perform eps.specs_stage_assert(found and a.origin_workspace_id is not null and a.bucket='eps-candidate-assets' and a.sha256~'^[a-f0-9]{64}$'
  and a.duration_ms between 1 and 1800000 and a.width between 1 and 4096 and a.height between 1 and 4096 and a.size_bytes between 1 and 268435456
  and a.mime_type in('video/mp4','video/quicktime','video/webm','video/x-matroska'),'MEDIA_REFERENCE_INVALID');
 -- Same lock order as upload completion: workspace first, then the upload intent.
 select * into workspace from eps.workspaces where id=a.origin_workspace_id and archived_at is null for update;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');
 perform eps.specs_stage_assert(eps.candidate_stage_can_write(auth.uid(),workspace.id) and eps.candidate_upload_scope(workspace.id),'CAPABILITY_REQUIRED');
 select * into c from eps.candidates where id=m.candidate_id and archived_at is null and merged_into_candidate_id is null;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');
 -- A video has at most one upload intent and one scan job; return the re-scan already queued.
 select * into intent from eps.candidate_uploads where asset_id=a.id;
 if found then
  select * into job from eps.jobs where id=intent.job_id and kind='candidate_scan' and input->>'rescan_candidate_media_id'=m.id::text;
  perform eps.specs_stage_assert(found,'INVALID_TRANSITION');
 else
  perform eps.specs_stage_assert(m.source_job_id is null and m.original_transcript is null and m.transcript_asset_id is null and m.extraction is null,'INVALID_TRANSITION');
  select * into config from eps.candidate_asset_config where id and enabled;
  if not found then perform eps.fail('DEPENDENCY_UNAVAILABLE','Candidate processing is not configured.',503);end if;
  begin
   insert into eps.candidate_uploads(id,asset_id,principal_id,workspace_id,bucket,object_key,expected_size_bytes,expected_mime_type,expected_sha256,target_candidate_id,target_candidate_row_version)
    values(upload_id,a.id,auth.uid(),workspace.id,a.bucket,a.object_key,a.size_bytes,a.mime_type,a.sha256,c.id,c.row_version);
  exception when unique_violation then perform eps.fail('INVALID_TRANSITION','This video already has a scan job.',409);
  end;
  input_value:=jsonb_build_object('schema_version','1.0','workspace_id',workspace.id,'project_id',workspace.project_id,'source_asset_id',a.id,
   'source_size_bytes',a.size_bytes,'source_mime_type',a.mime_type,'source_declared_sha256',a.sha256,
   'target_candidate_id',c.id,'target_candidate_row_version',c.row_version,'rescan_candidate_media_id',m.id,
   'configuration',jsonb_build_object('transcription_model',config.transcription_model,'extraction_model',config.extraction_model,'prompt_version',config.prompt_version,
    'schema_version',config.schema_version,'media_implementation_version',config.media_implementation_version)||case when config.english_transcript_version is null then '{}'::jsonb else jsonb_build_object('english_transcript_version',config.english_transcript_version)end);
  hash_value:=eps.candidate_job_hash(input_value);
  insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input_asset_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id)
  values(job_id,workspace.id,auth.uid(),'candidate_scan',upload_id,a.id,input_value,hash_value,'eps.candidate-input.pg-jsonb.v1',
   encode(sha256(convert_to('candidate_scan:'||upload_id::text,'UTF8')),'hex'),'prepare_candidate','candidate:'||job_id::text) returning * into job;
  insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key) values(job.id,job.stage,job.input_hash,1,job.id::text||':1');
  update eps.candidate_uploads set status='completed',completed_at=clock_timestamp(),completed_input=input_value,job_id=job.id where id=upload_id and status='open';
  perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
 end if;
 result:=jsonb_build_object('job_id',job.id,'candidate_media_id',m.id,'source_asset_id',a.id,'status',job.status,'poll_url','/api/v1/jobs/'||job.id::text);
 return eps.finish_mutation('candidate.rescan_media',p_idempotency_key,payload,result,m.id);
end $$;
grant create on schema public to eps_candidate_upload_owner;
alter function public.eps_rescan_candidate_media(uuid,text) owner to eps_candidate_upload_owner;
revoke create on schema public from eps_candidate_upload_owner;
revoke all on function public.eps_rescan_candidate_media(uuid,text) from public,anon,service_role;
grant execute on function public.eps_rescan_candidate_media(uuid,text) to authenticated;

-- 3. Exact-source guarded patch of the save step (same method as the m03 English projection).
do $m11_apply$declare routine regprocedure:='eps.apply_candidate_scan(uuid,uuid,text,text,jsonb)'::regprocedure;source text;definition text;original_source text;
 old_text text;new_text text;before_attributes jsonb;seams text[][];i int;begin
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n'),to_jsonb(p)-'prosrc' into source,definition,before_attributes from pg_proc p where oid=routine;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'ffd7c9fb5c05923c1a61a6a2a8170daca99dba308ab5b804d65d69cd205287b2'
 or before_attributes->>'proowner' is distinct from ('eps_candidate_apply_owner'::regrole::oid)::text or before_attributes->'prosecdef' is distinct from 'true'::jsonb
 or (select proacl::text from pg_proc where oid=routine) is distinct from '{eps_candidate_apply_owner=X/eps_candidate_apply_owner,eps_candidate_stage_owner=X/eps_candidate_apply_owner}'
 then raise exception 'M11_APPLY_SOURCE_CHANGED';end if;
 seams:=array[
  [$o1$ candidate_id uuid; media_id uuid; pool_id uuid;$o1$,
   $n1$ candidate_id uuid; media_id uuid; rescan_id uuid; pool_id uuid;$n1$],
  [$o2$ candidate_id:=case when job.input->>'target_candidate_id' is not null then eps.input_uuid(job.input->>'target_candidate_id') end;$o2$,
   $n2$ candidate_id:=case when job.input->>'target_candidate_id' is not null then eps.input_uuid(job.input->>'target_candidate_id') end;
 -- m11: a re-scan of a stored, never-scanned video names its existing introduction row.
 rescan_id:=case when job.input?'rescan_candidate_media_id' then eps.input_uuid(job.input->>'rescan_candidate_media_id') end;
 perform eps.candidate_apply_assert(rescan_id is null or candidate_id is not null,'INPUT_CHANGED');$n2$],
  [$o3$  perform eps.candidate_apply_assert(found and candidate.row_version=(job.input->>'target_candidate_row_version')::bigint,'INPUT_CHANGED');$o3$,
   $n3$  perform eps.candidate_apply_assert(found and (rescan_id is not null or candidate.row_version=(job.input->>'target_candidate_row_version')::bigint),'INPUT_CHANGED');$n3$],
  [$o4$ select participation.id into pool_id from eps.workspace_candidates participation$o4$,
   $n4$ -- m11: a re-scan never adds the person to a workspace pool or changes a workspace draft.
 if rescan_id is null then
 select participation.id into pool_id from eps.workspace_candidates participation$n4$],
  [$o5$ get diagnostics changed=row_count; perform eps.candidate_apply_assert(changed=1,'INPUT_CHANGED');
 insert into eps.audit_events($o5$,
   $n5$ get diagnostics changed=row_count; perform eps.candidate_apply_assert(changed=1,'INPUT_CHANGED');
 end if;
 insert into eps.audit_events($n5$],
  [$o6$ select * into media from eps.candidate_media where source_asset_id=source.id;
 if found then
  perform eps.candidate_apply_assert(media.source_job_id=job.id and media.candidate_id=candidate_id,'INPUT_CHANGED'); media_id:=media.id;
 else$o6$,
   $n6$ select * into media from eps.candidate_media where source_asset_id=source.id;
 if rescan_id is not null then
  -- m11: fill the stored introduction once. Facts, review state and workspace choices stay untouched.
  perform eps.candidate_apply_assert(found and media.id=rescan_id and media.candidate_id=candidate_id,'INPUT_CHANGED'); media_id:=media.id;
  if media.source_job_id is null then
   perform eps.candidate_apply_assert(media.original_transcript is null and media.transcript_asset_id is null and media.extraction is null and media.english_transcript_status='not_captured','INPUT_CHANGED');
   update eps.candidate_media set transcript_asset_id=transcript_id,original_transcript=transcript->>'original_text',transcript_segments=coalesce(transcript->'segments','[]'::jsonb),
    languages=languages,extraction=nullif(extraction,'null'::jsonb),source_job_id=job.id,
    selected_frame_asset_ids=case when cardinality(selected_frame_asset_ids)=0 then chosen_frames else selected_frame_asset_ids end,processing_issues=issues,
    english_transcript=extracted.payload#>>'{english_transcript,text}',english_transcript_status=coalesce(extracted.payload#>>'{english_transcript,status}','not_captured'),
    english_transcript_source_sha256=extracted.payload#>>'{english_transcript,source_sha256}',
    english_transcript_input_hash=case when job.input#>>'{configuration,english_transcript_version}'='1.0'then job.input_hash end,
    english_transcript_metadata=coalesce(extracted.payload#>'{english_transcript,metadata}','[]'::jsonb),row_version=row_version+1
   where id=media_id and source_job_id is null;
   get diagnostics changed=row_count; perform eps.candidate_apply_assert(changed=1,'INPUT_CHANGED');
   for frame in select value from jsonb_array_elements(prepared.payload->'sampled_frames') loop
    select * into frame_asset from eps.media_assets where id=eps.input_uuid(frame->>'frame_asset_id');
    perform eps.candidate_apply_assert(found and frame_asset.status='ready' and frame_asset.purpose='candidate_frame' and frame_asset.source_asset_id=source.id and frame_asset.producing_job_id=job.id and frame_asset.producing_attempt_id=prepared.attempt_id and frame_asset.output_stage='prepare_candidate' and frame_asset.sha256=frame->>'sha256' and frame_asset.source_timestamp_ms=(frame->>'timestamp_ms')::bigint and frame_asset.source_timestamp_ms<source.duration_ms and frame_asset.width=(frame->>'width')::integer and frame_asset.height=(frame->>'height')::integer);
    insert into eps.candidate_media_frames(candidate_media_id,asset_id,quality_flags) values(media_id,frame_asset.id,array(select jsonb_array_elements_text(frame->'quality_flags')));
   end loop;
  else perform eps.candidate_apply_assert(media.source_job_id=job.id,'INPUT_CHANGED');
  end if;
 elsif found then
  perform eps.candidate_apply_assert(media.source_job_id=job.id and media.candidate_id=candidate_id,'INPUT_CHANGED'); media_id:=media.id;
 else$n6$]];
 for i in 1..array_length(seams,1) loop
  old_text:=seams[i][1];new_text:=seams[i][2];
  if length(source)-length(replace(source,old_text,''))<>length(old_text) then raise exception 'M11_APPLY_SEAM_% _CHANGED',i;end if;
  source:=replace(source,old_text,new_text);
 end loop;
 select replace(prosrc,E'\r\n',E'\n') into original_source from pg_proc where oid=routine;
 if length(definition)-length(replace(definition,original_source,''))<>length(original_source) then raise exception 'M11_APPLY_DEFINITION_SEAM_CHANGED';end if;
 execute replace(definition,original_source,source);
 if (select to_jsonb(p)-'prosrc' from pg_proc p where oid=routine) is distinct from before_attributes then raise exception 'M11_APPLY_AUTHORITY_CHANGED';end if;
end $m11_apply$;

-- 4. Verify.
do $m11_verify$begin
 if (select pg_get_userbyid(proowner) from pg_proc where oid='public.eps_rescan_candidate_media(uuid,text)'::regprocedure) is distinct from 'eps_candidate_upload_owner'
 or not has_function_privilege('authenticated','public.eps_rescan_candidate_media(uuid,text)','execute')
 or has_function_privilege('anon','public.eps_rescan_candidate_media(uuid,text)','execute')
 or (select count(*) from pg_policies where schemaname='eps' and policyname in('candidate_apply_media_rescan','candidate_rescan_idempotency','candidate_rescan_audit'))<>3
 or not has_column_privilege('eps_candidate_apply_owner','eps.candidate_media','source_job_id','update')
 or (select prosrc from pg_proc where oid='eps.apply_candidate_scan(uuid,uuid,text,text,jsonb)'::regprocedure) !~ 'rescan_id:=case when job.input\?''rescan_candidate_media_id'''
 then raise exception 'M11_VERIFY_FAILED';end if;
end $m11_verify$;
