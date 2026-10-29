-- SQL-only synthetic state/authority proof. No uploaded bytes/provider/native
-- acceptance is credited. Harness owns one complete schema/data rollback.
create function pg_temp.kernel_assert(value boolean,label text) returns void language plpgsql as $$begin
 if value is distinct from true then raise exception 'CANDIDATE_KERNEL_ASSERTION: %',label;end if;
end $$;
create function pg_temp.kernel_expect(query text,expected text) returns void language plpgsql as $$begin
 begin execute query;exception when others then if sqlerrm=expected or sqlstate=expected then return;end if;raise exception 'CANDIDATE_KERNEL_WRONG_ERROR expected %, got % / %',expected,sqlstate,sqlerrm;end;
 raise exception 'CANDIDATE_KERNEL_EXPECTED_ERROR_NOT_RAISED: %',expected;
end $$;
insert into auth.users(id,is_anonymous,deleted_at,banned_until) values('7aae0000-0000-4000-8000-000000000001',false,null,null);
insert into public.projects(id,name) values('7bae0000-0000-4000-8000-000000000001','Synthetic candidate kernel');
insert into eps.workspaces(id,project_id) values('7cae0000-0000-4000-8000-000000000001','7bae0000-0000-4000-8000-000000000001');
insert into public.project_memberships(project_id,principal_id,can_write) values('7bae0000-0000-4000-8000-000000000001','7aae0000-0000-4000-8000-000000000001',true);
insert into public.app_capability_grants(principal_id,capability) select '7aae0000-0000-4000-8000-000000000001'::uuid,c from unnest(array['projects.read','workspaces.read','workspaces.write','cast.read','cast.upload']) c;
update eps.candidate_asset_config set enabled=true,transcription_model='synthetic-transcription-model',extraction_model='synthetic-extraction-model' where id;
select set_config('request.jwt.claim.sub','7aae0000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"7aae0000-0000-4000-8000-000000000001","is_anonymous":false}',true);
set local role authenticated;
do $$declare reservation jsonb;completion jsonb;replay jsonb;begin
 reservation:=public.eps_reserve_candidate_upload('{"workspace_id":"7cae0000-0000-4000-8000-000000000001","purpose":"candidate_video","filename":"silent.mp4","mime_type":"video/mp4","size_bytes":1000,"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}','synthetic-kernel-upload');
 perform set_config('eps.kernel.asset',reservation#>>'{asset,id}',true);perform set_config('eps.kernel.upload',reservation->>'upload_id',true);
 completion:=public.eps_complete_candidate_upload((reservation->>'upload_id')::uuid,'{"actual_size_bytes":1000,"start_processing":true}','synthetic-kernel-complete');
 replay:=public.eps_complete_candidate_upload((reservation->>'upload_id')::uuid,'{"actual_size_bytes":1000,"start_processing":true}','synthetic-kernel-complete');
 perform pg_temp.kernel_assert(completion=replay,'completion replay returns one job');perform set_config('eps.kernel.job',completion->>'processing_job_id',true);
end $$;
set local role postgres;
create function pg_temp.kernel_claim() returns jsonb language plpgsql as $$declare job eps.jobs;begin
 select * into strict job from eps.jobs where id=current_setting('eps.kernel.job')::uuid;
 return eps.claim_job_stage(jsonb_build_object('job_id',job.id,'stage',job.stage,'input_hash',job.input_hash));
end $$;
create function pg_temp.kernel_event(lease jsonb,kind text,payload jsonb default null,schema_name text default null) returns jsonb language sql as $$
 select jsonb_build_object('event_id',gen_random_uuid(),'job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token',
  'stage',lease->'stage','sequence',1,'event_type',kind,'input_hash',lease#>'{input,input_hash}')
  ||case when payload is null then '{}'::jsonb else jsonb_build_object('result',payload,'result_schema',schema_name) end
$$;
do $$declare lease jsonb;event jsonb;receipt jsonb;replay jsonb;input jsonb;asset uuid:=current_setting('eps.kernel.asset')::uuid;grant_value jsonb;begin
 perform pg_temp.kernel_assert((select count(*)=1 from eps.jobs where id=current_setting('eps.kernel.job')::uuid and kind='candidate_scan' and stage='prepare_candidate'),'one queued candidate job');
 lease:=pg_temp.kernel_claim();perform set_config('eps.kernel.lease',lease::text,true);
 input:=eps.get_specs_stage_input((lease->>'job_id')::uuid,(lease->>'attempt_id')::uuid,lease->>'lease_token');
 perform pg_temp.kernel_assert(input#>>'{source,asset_id}'=asset::text and input->>'stage'='prepare_candidate' and input#>>'{configuration,media_preparation_version}'='video-preparation.v1','existing narrow input port dispatches candidate');
 grant_value:=eps.get_job_asset_access(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',asset));
 perform pg_temp.kernel_assert(grant_value->>'bucket'='eps-candidate-assets' and grant_value->>'permission'='read','initial unready original exact read grant');
 perform set_config('request.headers',jsonb_build_object('x-eps-asset-grant',grant_value->>'grant_token')::text,true);
 perform pg_temp.kernel_assert(eps.candidate_capability_allowed(grant_value->>'bucket',grant_value->>'object_key','read') and not eps.candidate_capability_allowed(grant_value->>'bucket',grant_value->>'object_key','write'),'grant is read-only and exact object');
 event:=pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('source_asset_id',asset,'source_sha256',repeat('a',64),'probe',jsonb_build_object('duration_ms',1000,'width',640,'height',480,'rotation_degrees',0,'frame_rate',25,'video_codec','h264','audio_codec',null,'has_audio',false,'container','mp4','source_start_ms',0),
  'audio_chunks','[]'::jsonb,'sampled_frames','[]'::jsonb,'warnings','["NO_AUDIO","NO_USABLE_FRAMES"]'::jsonb,'implementation_version','video-preparation.v1','ffmpeg_version','synthetic-native-sql-proof'),'media-preparation.v1');
 receipt:=eps.record_job_event(event);replay:=eps.record_job_event(event);perform pg_temp.kernel_assert(receipt->'applied'='true' and replay->'duplicate'='true','prepare applies once and duplicate is inert');
 perform pg_temp.kernel_assert((select status='ready' and sha256=repeat('a',64) and duration_ms=1000 from eps.media_assets where id=asset),'original becomes Ready only on native verified payload');
 perform pg_temp.kernel_assert(not eps.candidate_capability_allowed(grant_value->>'bucket',grant_value->>'object_key','read'),'completed attempt grant immediately stale');
 perform pg_temp.kernel_assert((select status='queued' and stage='transcribe_candidate' and error is null and available_at<=clock_timestamp() from eps.jobs where id=(lease->>'job_id')::uuid),'prepare must queue transcribe with no error or future delay');
 lease:=pg_temp.kernel_claim();
 receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('source_asset_id',asset,'transcript_asset',null,'original_transcript',null,'languages','[]'::jsonb,'segment_count',0,'timestamp_precision','chunk','missing_transcript_reason','NO_INTELLIGIBLE_AUDIO','provider_metadata','[]'::jsonb),'candidate-transcript-stage.v1'));
 perform pg_temp.kernel_assert(receipt->'applied'='true' and receipt->>'job_status'='queued','silent transcript absence is explicit');
 lease:=pg_temp.kernel_claim();receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('source_asset_id',asset,'result',null,'manual_profile_required',true,'provider_metadata',null),'candidate-extraction-stage.v1'));
 perform pg_temp.kernel_assert(receipt->'applied'='true' and receipt->>'job_status'='queued','unknown supplied facts remain absent');
 lease:=pg_temp.kernel_claim();receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('schema_version','1.0','source_asset_id',asset,'selected_frames','[]'::jsonb,'insufficient_frames_reason','NO_USABLE_REAL_FRAMES'),'frame-selection-stage.v1'));
 perform pg_temp.kernel_assert(receipt->'applied'='true' and receipt->>'job_status'='queued','zero real frames remain explicit');
 lease:=pg_temp.kernel_claim();
 -- Independent hook assertion in a rolled-back subtransaction keeps a precise
 -- failing validator context while the real callback remains the commit owner.
 begin
  perform eps.apply_candidate_scan((lease->>'job_id')::uuid,(lease->>'attempt_id')::uuid,lease->>'lease_token',lease#>>'{input,input_hash}',jsonb_build_object('source_asset_id',asset));
  raise exception using errcode='PZ001',message='ROLLBACK_APPLY_ASSERTION_SUBTRANSACTION';
 exception when sqlstate 'PZ001' then null;end;
 receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('source_asset_id',asset),'candidate-application.v1'));
 perform pg_temp.kernel_assert(receipt->>'job_status'='succeeded','atomic profile application completes');
 perform pg_temp.kernel_assert((select jsonb_array_length(completed_stages)=5 and result->>'candidate_id' is not null and completed_stages::text not like '%original_transcript%' from eps.jobs where id=(lease->>'job_id')::uuid),'public job stores only stage pointers and result identifiers');
 perform pg_temp.kernel_assert((select facts->'name'='null' and reviewed_at is null from eps.candidates where id=(select (result->>'candidate_id')::uuid from eps.jobs where id=(lease->>'job_id')::uuid)),'manual-profile fallback never invents supplied name or Reviewed');
 perform pg_temp.kernel_assert(not has_table_privilege('authenticated','eps.candidate_stage_payloads','SELECT') and not has_function_privilege('authenticated','eps.record_candidate_job_event(jsonb)','EXECUTE'),'user cannot read stage payloads or forge callbacks');
end $$;
select 'CANDIDATE_KERNEL_SILENT_FLOW_AND_PRIVATE_FENCES_PASSED';
