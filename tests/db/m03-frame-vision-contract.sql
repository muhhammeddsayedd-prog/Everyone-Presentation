-- Synthetic SQL contract only. Run inside the reviewed harness's single
-- rollback after history20 + frame-vision.sql; no bytes/provider/AI credit.
create function pg_temp.vision_assert(value boolean,label text) returns void language plpgsql as $$begin
 if value is distinct from true then raise exception 'FRAME_VISION_ASSERTION: %',label;end if;
end $$;
insert into auth.users(id,is_anonymous,deleted_at,banned_until) values('97ae0000-0000-4000-8000-000000000001',false,null,null);
insert into public.projects(id,name) values('97be0000-0000-4000-8000-000000000001','Synthetic frame vision contract');
insert into eps.workspaces(id,project_id) values('97ce0000-0000-4000-8000-000000000001','97be0000-0000-4000-8000-000000000001');
insert into public.project_memberships(project_id,principal_id,can_write) values('97be0000-0000-4000-8000-000000000001','97ae0000-0000-4000-8000-000000000001',true);
insert into public.app_capability_grants(principal_id,capability) select '97ae0000-0000-4000-8000-000000000001'::uuid,c from unnest(array['projects.read','workspaces.read','workspaces.write','cast.read','cast.upload']) c;
update eps.candidate_asset_config set enabled=true,transcription_model='synthetic-transcription-model',extraction_model='synthetic-extraction-model' where id;
select set_config('request.jwt.claim.sub','97ae0000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"97ae0000-0000-4000-8000-000000000001","is_anonymous":false}',true);
set local role authenticated;
do $$declare reservation jsonb;completion jsonb;begin
 reservation:=public.eps_reserve_candidate_upload('{"workspace_id":"97ce0000-0000-4000-8000-000000000001","purpose":"candidate_video","filename":"synthetic-vision.mp4","mime_type":"video/mp4","size_bytes":1000,"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}','synthetic-vision-upload');
 perform set_config('eps.vision.asset',reservation#>>'{asset,id}',true);
 completion:=public.eps_complete_candidate_upload((reservation->>'upload_id')::uuid,'{"actual_size_bytes":1000,"start_processing":true}','synthetic-vision-complete');
 perform set_config('eps.vision.job',completion->>'processing_job_id',true);
end $$;
set local role postgres;
create function pg_temp.vision_claim() returns jsonb language plpgsql as $$declare job eps.jobs;begin
 select * into strict job from eps.jobs where id=current_setting('eps.vision.job')::uuid;
 return eps.claim_job_stage(jsonb_build_object('job_id',job.id,'stage',job.stage,'input_hash',job.input_hash));
end $$;
create function pg_temp.vision_event(lease jsonb,payload jsonb,schema_name text) returns jsonb language sql as $$
 select jsonb_build_object('event_id',gen_random_uuid(),'job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token',
  'stage',lease->'stage','sequence',1,'event_type','succeeded','input_hash',lease#>'{input,input_hash}','result',payload,'result_schema',schema_name)
$$;
do $$declare lease jsonb;receipt jsonb;event jsonb;asset uuid:=current_setting('eps.vision.asset')::uuid;
 frames jsonb:='[]';ref jsonb;reservation jsonb;completed jsonb;i integer;job eps.jobs;metadata jsonb;payload jsonb;bad jsonb;partial_payload jsonb;failed boolean;fingerprint text;input jsonb;vision_payload jsonb;application_lease jsonb;target_count integer;cached_ack jsonb;
begin
 lease:=pg_temp.vision_claim();
 for i in 0..2 loop
  reservation:=eps.reserve_candidate_job_output(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','output_key','frame_'||i,'asset_kind','candidate_frame','filename','frame-'||i||'.jpg','mime_type','image/jpeg','expected_size_bytes',10,'parent_asset_id',asset,'time_offset_ms',100+i*300));
  completed:=eps.complete_candidate_job_output(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',reservation#>'{asset,id}','sha256',repeat((i+1)::text,64),'actual_size_bytes',10,'width',640,'height',480,'duration_ms',null));
  frames:=frames||jsonb_build_array(jsonb_build_object('frame_asset_id',completed->'id','source_asset_id',asset,'timestamp_ms',100+i*300,'width',640,'height',480,'sha256',completed->'sha256','quality_flags','[]'::jsonb,'quality',jsonb_build_object('luminance',100,'contrast',20,'sharpness',20,'difference_hash',repeat(i::text,16))));
 end loop;
 receipt:=eps.record_job_event(pg_temp.vision_event(lease,jsonb_build_object('source_asset_id',asset,'source_sha256',repeat('a',64),'probe',jsonb_build_object('duration_ms',1000,'width',640,'height',480,'rotation_degrees',0,'frame_rate',25,'video_codec','h264','audio_codec',null,'has_audio',false,'container','mp4','source_start_ms',0),
  'audio_chunks','[]'::jsonb,'sampled_frames',frames,'warnings','["NO_AUDIO"]'::jsonb,'implementation_version','video-preparation.v1','ffmpeg_version','synthetic-sql-metadata-only'),'media-preparation.v1'));
 lease:=pg_temp.vision_claim();receipt:=eps.record_job_event(pg_temp.vision_event(lease,jsonb_build_object('source_asset_id',asset,'transcript_asset',null,'original_transcript',null,'languages','[]'::jsonb,'segment_count',0,'timestamp_precision','chunk','missing_transcript_reason','NO_INTELLIGIBLE_AUDIO','provider_metadata','[]'::jsonb),'candidate-transcript-stage.v1'));
 lease:=pg_temp.vision_claim();receipt:=eps.record_job_event(pg_temp.vision_event(lease,jsonb_build_object('source_asset_id',asset,'result',null,'manual_profile_required',true,'provider_metadata',null),'candidate-extraction-stage.v1'));
 lease:=pg_temp.vision_claim();select * into strict job from eps.jobs where id=(lease->>'job_id')::uuid;
 input:=eps.get_candidate_stage_input(job.id,job.current_attempt_id,lease->>'lease_token');
 perform pg_temp.vision_assert(input->'allow_partial_frame_selection'='false','first attempt cannot silently skip retry budget');
 select encode(sha256(convert_to(string_agg((frame->>'frame_asset_id')||E'\n'||(frame->>'source_asset_id')||E'\n'||(frame->>'timestamp_ms')||E'\n'||(frame->>'width')||E'\n'||(frame->>'height')||E'\n'||(frame->>'sha256'),E'\n\n' order by ord),'UTF8')),'hex') into fingerprint from jsonb_array_elements(frames) with ordinality f(frame,ord);
 metadata:=jsonb_build_object('provider','openai','sdk_version','7.45.1','requested_model','synthetic-extraction-model','resolved_model','synthetic-extraction-model','request_id','req_synthetic','response_id','resp_synthetic','prompt_version','frame_selection_vision_v1','prompt_sha256','3c650e433d05e80abca3c880fc4bf86df215b5b504eb906cd98e01f00a442538','schema_sha256',repeat('b',64),'input_sha256',job.input_hash,'frame_input_sha256',fingerprint,'usage',jsonb_build_object('input_tokens',10,'output_tokens',3,'total_tokens',13));
 payload:=jsonb_build_object('schema_version','1.0','source_asset_id',asset,'selected_frames',jsonb_build_array(jsonb_build_object('frame_asset_id',frames#>'{0,frame_asset_id}','reason','Clear frontal source frame.')),'insufficient_frames_reason','Fewer than three clear, distinct source frames are available.','selection_method','openai_vision','metadata',metadata);
 perform eps.candidate_validate_stage(job,'frame-selection-stage.v1',payload);
 -- Unknown provider usage remains explicitly null, never fabricated as zero.
 perform eps.candidate_validate_stage(job,'frame-selection-stage.v1',jsonb_set(payload,'{metadata,usage}','null'::jsonb));
 -- An actually empty prepared sample has a separate non-provider partial path.
 begin
  update eps.candidate_stage_payloads p set payload=jsonb_set(p.payload,'{sampled_frames}','[]'::jsonb) where p.job_id=job.id and p.stage='prepare_candidate';
  perform eps.candidate_validate_stage(job,'frame-selection-stage.v1',jsonb_build_object('schema_version','1.0','source_asset_id',asset,'selected_frames','[]'::jsonb,
   'insufficient_frames_reason','No real source frames were prepared; manual material selection remains available.','selection_method','no_frames','metadata',null));
  raise exception using errcode='PZ023',message='ROLLBACK_EMPTY_SAMPLE_METADATA_ONLY';
 exception when sqlstate 'PZ023' then null;end;
 for bad in select value from jsonb_array_elements(jsonb_build_array(
  jsonb_set(payload,'{metadata,input_sha256}',to_jsonb(repeat('c',64))),
  jsonb_set(payload,'{metadata,frame_input_sha256}',to_jsonb(repeat('c',64))),
  jsonb_set(payload,'{metadata,requested_model}','"other-model"'),
  jsonb_set(payload,'{metadata,prompt_sha256}',to_jsonb(repeat('c',64))),
  jsonb_set(payload,'{metadata,sdk_version}','"0.0.0"'),
  jsonb_set(payload,'{metadata,usage,total_tokens}','12'),
  jsonb_set(payload,'{selected_frames,0,frame_asset_id}','"97de0000-0000-4000-8000-000000000001"'),
  jsonb_set(payload,'{selected_frames,0,reason}','"Attractive person for this role."'),
  jsonb_set(payload,'{selection_method}','"no_frames"'),
  payload||'{"provider_error_code":"OPENAI_UNAVAILABLE"}'::jsonb,
  payload||'{"tool_call":{"name":"untrusted"}}'::jsonb
 )) loop
  failed:=false;
  begin perform eps.candidate_validate_stage(job,'frame-selection-stage.v1',bad);exception when sqlstate 'P0001' then if sqlerrm='RESULT_INVALID' then failed:=true;else raise;end if;end;
  perform pg_temp.vision_assert(failed,'untrusted or mismatched vision output rejected');
 end loop;
 -- Fresh four-key callbacks cannot downgrade vision to the old heuristic.
 failed:=false;begin perform eps.candidate_validate_stage(job,'frame-selection-stage.v1',payload-'selection_method'-'metadata');exception when sqlstate 'P0001' then if sqlerrm='RESULT_INVALID' then failed:=true;else raise;end if;end;
 perform pg_temp.vision_assert(failed,'new legacy-shaped callback cannot bypass vision');
 -- Model retained historical metadata only in a nested rollback. Existing
 -- historical records and exact cached ACKs do not require a new provider call.
 begin
  insert into eps.candidate_stage_payloads(workspace_id,job_id,stage,attempt_id,input_hash,result_schema,payload)
   values(job.workspace_id,job.id,'select_frames',job.current_attempt_id,job.input_hash,'frame-selection-stage.v1',payload-'selection_method'-'metadata');
  perform eps.candidate_validate_stage(job,'frame-selection-stage.v1',payload-'selection_method'-'metadata');
  event:=pg_temp.vision_event(lease,payload-'selection_method'-'metadata','frame-selection-stage.v1');
  cached_ack:=jsonb_build_object('event_id',event->>'event_id','applied',true,'duplicate',false,'stale',false,'job_status','queued');
  insert into eps.job_events(job_id,attempt_id,event_id,sequence,stage,event_type,payload_digest,receipt)
   values(job.id,job.current_attempt_id,event->>'event_id',1,'select_frames','succeeded',encode(sha256(convert_to(event::text,'UTF8')),'hex'),cached_ack);
  receipt:=eps.record_job_event(event);
  perform pg_temp.vision_assert(receipt=cached_ack||'{"duplicate":true,"applied":false}'::jsonb,'stored legacy exact ACK replays before new validation');
  perform pg_temp.vision_assert((select count(*)=1 from eps.candidate_stage_payloads where job_id=job.id and stage='select_frames'),'legacy ACK does not repeat effects');
  raise exception using errcode='PZ022',message='ROLLBACK_HISTORICAL_METADATA_ONLY';
 exception when sqlstate 'PZ022' then null;end;
 failed:=false;begin perform eps.candidate_validate_stage(job,'frame-selection-stage.v1',payload-'selection_method');exception when sqlstate 'P0001' then if sqlerrm='RESULT_INVALID' then failed:=true;else raise;end if;end;
 perform pg_temp.vision_assert(failed,'metadata cannot masquerade as a legacy result');
 -- Commit/replay in a nested rollback proves exact ACK and no repeated effects.
 begin
  event:=pg_temp.vision_event(lease,payload,'frame-selection-stage.v1');receipt:=eps.record_job_event(event);
  perform pg_temp.vision_assert(receipt->'applied'='true','vision output persisted privately');
  receipt:=eps.record_job_event(event);perform pg_temp.vision_assert(receipt->'duplicate'='true','same vision callback replays once');
  perform pg_temp.vision_assert((select p.payload->'metadata'=metadata from eps.candidate_stage_payloads p where p.job_id=job.id and p.stage='select_frames'),'provider metadata bound to stage payload');
  raise exception using errcode='PZ021',message='ROLLBACK_VISION_ACK_ONLY';
 exception when sqlstate 'PZ021' then null;end;
 -- Successful image-aware selection with zero or two usable frames is
 -- insufficiency, not a fabricated provider failure. Each apply is rolled back.
 foreach target_count in array array[0,2]loop
  begin
   select coalesce(jsonb_agg(jsonb_build_object('frame_asset_id',frame->'frame_asset_id','reason',case when ord=1 then 'Clear frontal source frame.'else 'Clear wider source frame.'end)order by ord),'[]')
    into ref from jsonb_array_elements(frames)with ordinality f(frame,ord)where ord<=target_count;
   vision_payload:=jsonb_set(payload,'{selected_frames}',ref);
   receipt:=eps.record_job_event(pg_temp.vision_event(lease,vision_payload,'frame-selection-stage.v1'));
   application_lease:=pg_temp.vision_claim();receipt:=eps.record_job_event(pg_temp.vision_event(application_lease,jsonb_build_object('source_asset_id',asset),'candidate-application.v1'));
   perform pg_temp.vision_assert(receipt->>'job_status'='succeeded','legitimate fewer frames can complete');
   perform pg_temp.vision_assert((select cardinality(m.selected_frame_asset_ids)=target_count and m.processing_issues@>array['INSUFFICIENT_FRAMES']and not(m.processing_issues@>array['FRAME_SELECTION_UNAVAILABLE'])from eps.candidate_media m where m.source_job_id=job.id),'valid vision insufficiency is not a provider warning');
   raise exception using errcode='PZ024',message='ROLLBACK_VALID_VISION_INSUFFICIENCY';
  exception when sqlstate 'PZ024' then null;end;
 end loop;
 partial_payload:=jsonb_build_object('schema_version','1.0','source_asset_id',asset,'selected_frames','[]'::jsonb,'insufficient_frames_reason','Automatic frame review was unavailable; choose real source frames manually.','selection_method','manual_required','metadata',null,'provider_error_code','OPENAI_UNAVAILABLE');
 failed:=false;begin perform eps.candidate_validate_stage(job,'frame-selection-stage.v1',partial_payload);exception when sqlstate 'P0001' then if sqlerrm='RESULT_INVALID' then failed:=true;else raise;end if;end;
 perform pg_temp.vision_assert(failed,'retryable outage does not bypass first attempt');
 update eps.jobs set stage_attempts=jsonb_set(stage_attempts,'{select_frames}','3') where id=job.id returning * into job;
 input:=eps.get_candidate_stage_input(job.id,job.current_attempt_id,lease->>'lease_token');
 perform pg_temp.vision_assert(input->'allow_partial_frame_selection'='true','third attempt exposes explicit partial flag');
 perform eps.candidate_validate_stage(job,'frame-selection-stage.v1',partial_payload);
 receipt:=eps.record_job_event(pg_temp.vision_event(lease,partial_payload,'frame-selection-stage.v1'));
 lease:=pg_temp.vision_claim();receipt:=eps.record_job_event(pg_temp.vision_event(lease,jsonb_build_object('source_asset_id',asset),'candidate-application.v1'));
 perform pg_temp.vision_assert(receipt->>'job_status'='succeeded','manual frame partial can complete without discarding originals');
 perform pg_temp.vision_assert((select cardinality(m.selected_frame_asset_ids)=0 and m.processing_issues@>array['INSUFFICIENT_FRAMES','FRAME_SELECTION_UNAVAILABLE'] and (select count(*) from eps.candidate_media_frames f where f.candidate_media_id=m.id)=3 from eps.candidate_media m where m.source_job_id=job.id),'manual partial retains all source frames with no automatic picks');
 -- A fifth supported code does not admit arbitrary labels or more than five.
 failed:=false;begin
  update eps.candidate_media set processing_issues=array['NO_AUDIO','TRANSCRIPTION_FAILED','EXTRACTION_FAILED','INSUFFICIENT_FRAMES','UNTRUSTED_PROVIDER_DETAIL']where source_job_id=job.id;
 exception when check_violation then failed:=true;end;
 perform pg_temp.vision_assert(failed,'unknown fifth issue code is rejected');
 failed:=false;begin
  update eps.candidate_media set processing_issues=array_fill('FRAME_SELECTION_UNAVAILABLE'::text,array[6])where source_job_id=job.id;
 exception when check_violation then failed:=true;end;
 perform pg_temp.vision_assert(failed,'more than five issue codes is rejected');
 perform pg_temp.vision_assert(not has_function_privilege('authenticated','eps.candidate_validate_stage(eps.jobs,text,jsonb)','EXECUTE') and not has_function_privilege('anon','eps.get_candidate_stage_input(uuid,uuid,text)','EXECUTE'),'private function authorities unchanged');
end $$;
select 'FRAME_VISION_SOURCE_PROVIDER_AND_MANUAL_PARTIAL_CONTRACT_PASSED';
