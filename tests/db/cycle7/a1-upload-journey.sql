-- Cycle 7 A1: the real upload path. reserve -> complete -> claim/stage events -> apply (record_job_event with
-- controlled provider results), for a new person and for an extra tape after a facts edit. Proves the job
-- result names candidate_id + workspace_candidate_id (get_job, uploads list) and that replays create no
-- duplicate person, tape or membership. Synthetic metadata only; no bytes or providers. Rolls back.
begin;
set local search_path='';
alter table auth.users add column if not exists is_anonymous boolean not null default false,add column if not exists deleted_at timestamptz,add column if not exists banned_until timestamptz;
-- The replica image's extensions schema lacks the canonical USAGE grant for the stage owners (rolled back).
grant usage on schema extensions to eps_candidate_stage_owner,eps_candidate_assets_owner,eps_jobs_owner;
insert into auth.users(id,instance_id,aud,role,email) values('a1200000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a1-journey@example.invalid');
insert into public.app_capability_grants(principal_id,capability) select 'a1200000-0000-4000-8000-0000000000a1',capability from unnest(array['projects.read','workspaces.read','workspaces.write','cast.read','cast.write','cast.upload']) capability;
insert into public.projects(id,name) values('a1200000-0000-4000-8000-00000000c001','A1 journey project');
insert into public.project_memberships(project_id,principal_id,can_write) values('a1200000-0000-4000-8000-00000000c001','a1200000-0000-4000-8000-0000000000a1',true);
insert into eps.workspaces(id,project_id) values('a1200000-0000-4000-8000-00000000d001','a1200000-0000-4000-8000-00000000c001');
insert into eps.candidate_asset_config(id,enabled,transcription_model,extraction_model) values(true,true,'synthetic-transcription-model','synthetic-extraction-model')
 on conflict (id) do update set enabled=true,transcription_model=excluded.transcription_model,extraction_model=excluded.extraction_model,english_transcript_version=null;

create function pg_temp.a1_claim(job uuid) returns jsonb language plpgsql as $$declare item eps.jobs;begin
 select * into strict item from eps.jobs where id=job;
 return eps.claim_job_stage(jsonb_build_object('job_id',item.id,'stage',item.stage,'input_hash',item.input_hash));
end $$;
create function pg_temp.a1_event(lease jsonb,payload jsonb,schema_name text) returns jsonb language sql as $$
 select jsonb_build_object('event_id',gen_random_uuid(),'job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token',
  'stage',lease->'stage','sequence',1,'event_type','succeeded','input_hash',lease#>'{input,input_hash}','result',payload,'result_schema',schema_name)
$$;
-- Controlled provider results: a silent video with no usable frames (manual profile path).
create function pg_temp.a1_process(job uuid) returns jsonb language plpgsql as $$
declare lease jsonb;receipt jsonb;asset uuid;apply_event jsonb;begin
 select input_asset_id into asset from eps.jobs where id=job;
 lease:=pg_temp.a1_claim(job);receipt:=eps.record_job_event(pg_temp.a1_event(lease,jsonb_build_object('source_asset_id',asset,'source_sha256',repeat('a',64),'probe',jsonb_build_object('duration_ms',1000,'width',640,'height',480,'rotation_degrees',0,'frame_rate',25,'video_codec','h264','audio_codec',null,'has_audio',false,'container','mp4','source_start_ms',0),
  'audio_chunks','[]'::jsonb,'sampled_frames','[]'::jsonb,'warnings','["NO_AUDIO"]'::jsonb,'implementation_version','video-preparation.v1','ffmpeg_version','synthetic-sql-metadata-fixture'),'media-preparation.v1'));
 if receipt->>'job_status'<>'queued' then raise exception 'A1_FAIL prepare %',receipt;end if;
 lease:=pg_temp.a1_claim(job);receipt:=eps.record_job_event(pg_temp.a1_event(lease,jsonb_build_object('source_asset_id',asset,'transcript_asset',null,'original_transcript',null,'languages','[]'::jsonb,'segment_count',0,'timestamp_precision','chunk','missing_transcript_reason','NO_INTELLIGIBLE_AUDIO','provider_metadata','[]'::jsonb),'candidate-transcript-stage.v1'));
 if receipt->>'job_status'<>'queued' then raise exception 'A1_FAIL transcribe %',receipt;end if;
 lease:=pg_temp.a1_claim(job);receipt:=eps.record_job_event(pg_temp.a1_event(lease,jsonb_build_object('source_asset_id',asset,'result',null,'manual_profile_required',true,'provider_metadata',null),'candidate-extraction-stage.v1'));
 if receipt->>'job_status'<>'queued' then raise exception 'A1_FAIL extract %',receipt;end if;
 lease:=pg_temp.a1_claim(job);receipt:=eps.record_job_event(pg_temp.a1_event(lease,jsonb_build_object('schema_version','1.0','source_asset_id',asset,'selected_frames','[]'::jsonb,'insufficient_frames_reason','No real source frames were prepared; manual material selection remains available.','selection_method','no_frames','metadata',null),'frame-selection-stage.v1'));
 if receipt->>'job_status'<>'queued' then raise exception 'A1_FAIL select % %',receipt,(select error from eps.jobs where id=job);end if;
 lease:=pg_temp.a1_claim(job);apply_event:=pg_temp.a1_event(lease,jsonb_build_object('source_asset_id',asset),'candidate-application.v1');
 receipt:=eps.record_job_event(apply_event);
 if receipt->>'job_status'<>'succeeded' then raise exception 'A1_FAIL apply %',receipt;end if;
 -- A duplicate callback (worker retry after an uncertain acknowledgement) is inert.
 receipt:=eps.record_job_event(apply_event);
 if receipt->'duplicate'<>'true'::jsonb then raise exception 'A1_FAIL duplicate apply %',receipt;end if;
 return apply_event;
end $$;

-- 1. A new person uploaded into the project.
select set_config('request.jwt.claim.sub','a1200000-0000-4000-8000-0000000000a1',true),set_config('request.jwt.claims','{"sub":"a1200000-0000-4000-8000-0000000000a1","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $$declare reservation jsonb;completion jsonb;replay jsonb;begin
 reservation:=public.eps_reserve_candidate_upload('{"workspace_id":"a1200000-0000-4000-8000-00000000d001","purpose":"candidate_video","filename":"new-person.mp4","mime_type":"video/mp4","size_bytes":1000,"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}','a1-journey-reserve-0001');
 completion:=public.eps_complete_candidate_upload((reservation->>'upload_id')::uuid,'{"actual_size_bytes":1000,"start_processing":true}','a1-journey-complete-0001');
 replay:=public.eps_complete_candidate_upload((reservation->>'upload_id')::uuid,'{"actual_size_bytes":1000,"start_processing":true}','a1-journey-complete-0001');
 if completion<>replay then raise exception 'A1_FAIL complete replay';end if;
 perform set_config('a1.job',completion->>'processing_job_id',true),set_config('a1.upload',reservation->>'upload_id',true);
 -- While processing, the upload row is already restorable after a refresh.
 if public.eps_list_workspace_uploads('a1200000-0000-4000-8000-00000000d001',null,5)#>>'{data,0,state}'<>'processing' then raise exception 'A1_FAIL processing row';end if;
end $$;
reset role;
select pg_temp.a1_process(current_setting('a1.job')::uuid) is not null;
set local role authenticated;
do $$declare job jsonb;uploads jsonb;again jsonb;begin
 job:=public.eps_get_job(current_setting('a1.job')::uuid);
 if job->>'status'<>'succeeded' or job#>>'{candidate_result,candidate_id}' is null or job#>>'{candidate_result,workspace_candidate_id}' is null then raise exception 'A1_FAIL get_job result %',job;end if;
 uploads:=public.eps_list_workspace_uploads('a1200000-0000-4000-8000-00000000d001',null,5);
 if uploads#>>'{data,0,state}'<>'ready' or uploads#>>'{data,0,workspace_candidate_id}'<>job#>>'{candidate_result,workspace_candidate_id}' or uploads#>>'{data,0,candidate_id}'<>job#>>'{candidate_result,candidate_id}' then raise exception 'A1_FAIL uploads ready %',uploads;end if;
 -- The resolved row is on page 1 of the project list (newest person first).
 if public.eps_list_workspace_candidates('a1200000-0000-4000-8000-00000000d001',null,1)#>>'{data,0,id}'<>job#>>'{candidate_result,workspace_candidate_id}' then raise exception 'A1_FAIL row not first';end if;
 -- Adding the same person from the Library afterwards converges on that membership.
 again:=public.eps_add_workspace_candidate('a1200000-0000-4000-8000-00000000d001',jsonb_build_object('candidate_id',job#>>'{candidate_result,candidate_id}'),'a1-journey-add-000001');
 if again->>'id'<>job#>>'{candidate_result,workspace_candidate_id}' or again->'already_member'<>'true'::jsonb then raise exception 'A1_FAIL library add after upload %',again;end if;
 perform set_config('a1.person',job#>>'{candidate_result,candidate_id}',true),set_config('a1.pool',job#>>'{candidate_result,workspace_candidate_id}',true);
end $$;
reset role;
do $$begin
 if (select count(*) from eps.candidate_media where source_asset_id=(select input_asset_id from eps.jobs where id=current_setting('a1.job')::uuid))<>1
  or (select count(*) from eps.workspace_candidates where workspace_id='a1200000-0000-4000-8000-00000000d001' and archived_at is null)<>1
  or (select count(*) from eps.candidates where created_by='a1200000-0000-4000-8000-0000000000a1')<>1
  or (select media_selection_state from eps.workspace_candidates where id=current_setting('a1.pool')::uuid)<>'pinned'
 then raise exception 'A1_FAIL duplicates after replay';end if;
end $$;

-- 2. Extra tape for that person; the profile is edited while the video processes.
set local role authenticated;
do $$declare reservation jsonb;completion jsonb;profile jsonb;begin
 reservation:=public.eps_reserve_candidate_upload(jsonb_build_object('workspace_id','a1200000-0000-4000-8000-00000000d001','candidate_id',current_setting('a1.person'),'purpose','candidate_video','filename','extra-tape.mp4','mime_type','video/mp4','size_bytes',1000,'sha256',repeat('a',64)),'a1-journey-reserve-0002');
 completion:=public.eps_complete_candidate_upload((reservation->>'upload_id')::uuid,'{"actual_size_bytes":1000,"start_processing":true}','a1-journey-complete-0002');
 perform set_config('a1.job2',completion->>'processing_job_id',true);
 profile:=public.eps_get_candidate(current_setting('a1.person')::uuid);
 perform public.eps_update_candidate(current_setting('a1.person')::uuid,jsonb_build_object('row_version',(profile->>'row_version')::int,'facts',(profile->'facts')||'{"name":"Edited while processing","city":"Synthetic City"}'),'a1-journey-edit-00001');
end $$;
reset role;
select pg_temp.a1_process(current_setting('a1.job2')::uuid) is not null;
set local role authenticated;
do $$declare job jsonb;profile jsonb;begin
 job:=public.eps_get_job(current_setting('a1.job2')::uuid);
 if job->>'status'<>'succeeded' or job#>>'{candidate_result,candidate_id}'<>current_setting('a1.person') or job#>>'{candidate_result,workspace_candidate_id}'<>current_setting('a1.pool') then raise exception 'A1_FAIL extra tape job %',job;end if;
 profile:=public.eps_get_candidate(current_setting('a1.person')::uuid);
 if profile#>>'{facts,name}'<>'Edited while processing' or profile#>>'{facts,city}'<>'Synthetic City' then raise exception 'A1_FAIL edited facts lost %',profile->'facts';end if;
end $$;
reset role;
do $$begin
 if (select count(*) from eps.candidate_media where candidate_id=current_setting('a1.person')::uuid)<>2
  or (select count(*) from eps.workspace_candidates where workspace_id='a1200000-0000-4000-8000-00000000d001' and archived_at is null)<>1
  or (select count(*) from eps.candidates where created_by='a1200000-0000-4000-8000-0000000000a1')<>1
 then raise exception 'A1_FAIL extra tape duplicated rows';end if;
end $$;

select json_build_object('result','passed','file','a1-upload-journey','checks',json_build_array('reserve_complete_replay','processing_row_restorable','stage_events_apply','duplicate_callback_inert',
 'get_job_candidate_result','uploads_ready_ids','resolved_row_first','library_add_converges','no_duplicate_person_tape_membership','extra_tape_after_facts_edit','edited_facts_intact'))::text;
rollback;
