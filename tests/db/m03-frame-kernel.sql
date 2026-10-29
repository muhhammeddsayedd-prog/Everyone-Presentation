-- Frame stage SQL contract proof only. Every media row/hash below is synthetic
-- metadata; actual JPEG bytes/native timing are independently required.
create function pg_temp.frame_assert(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'M03_FRAME_ASSERTION: %',label;end if;end $$;
create function pg_temp.frame_expect(command text,expected_code text) returns void language plpgsql as $$
begin begin execute command;raise exception 'EXPECTED_FRAME_DENIAL';exception when others then if sqlerrm<>expected_code and sqlstate<>expected_code then raise;end if;end;end $$;
create function pg_temp.frame_claim(p_job uuid,p_stage text default null,p_key text default null) returns jsonb language plpgsql as $$
declare job eps.jobs;input_value jsonb;lease jsonb;begin
 select * into strict job from eps.jobs where id=p_job;
 input_value:=jsonb_build_object('job_id',job.id,'stage',coalesce(p_stage,job.stage),'input_hash',job.input_hash);
 execute 'set local role eps_jobs_executor';
 lease:=eps.claim_job_stage_replay(input_value,coalesce(p_key,'synthetic-frame-claim-'||job.id::text||'-'||coalesce(p_stage,job.stage)),'synthetic-frame-key',repeat('f',64));
 execute 'set local role postgres';return lease;
end $$;
create function pg_temp.frame_event(lease jsonb,kind text,payload jsonb default null,schema_name text default null) returns jsonb language sql as $$
 select jsonb_build_object('event_id',gen_random_uuid(),'job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token',
  'stage',lease->'stage','sequence',1,'event_type',kind,'input_hash',lease#>'{input,input_hash}')
 ||case when payload is null then '{}'::jsonb else jsonb_build_object('result',payload,'result_schema',schema_name) end
$$;
create function pg_temp.frame_send(event jsonb) returns jsonb language plpgsql as $$declare receipt jsonb;begin
 execute 'set local role eps_jobs_executor';receipt:=eps.record_job_event(event);execute 'set local role postgres';return receipt;
end $$;
create function pg_temp.frame_output(lease jsonb,offset_ms bigint,output_name text default 'frame_0') returns jsonb language plpgsql as $$
declare reserved jsonb;completed jsonb;replayed jsonb;request_value jsonb;begin
 execute 'set local role eps_specs_assets_executor';
 reserved:=eps.reserve_job_output(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token',
  'asset_kind','candidate_frame','output_key',output_name,'filename',replace(output_name,'_','-')||'.jpg','mime_type','image/jpeg','expected_size_bytes',1000,
  'parent_asset_id',current_setting('eps.frame.fixture.source'),'time_offset_ms',offset_ms));
 request_value:=jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',reserved#>'{asset,id}',
  'sha256',repeat('c',64),'actual_size_bytes',1000,'width',320,'height',240,'duration_ms',null);
 completed:=eps.complete_job_output(request_value);replayed:=eps.complete_job_output(request_value);
 execute 'set local role postgres';perform pg_temp.frame_assert(completed=replayed,'asset completion is exact replay');
 return jsonb_build_object('asset_id',completed->'id','sha256',completed->'sha256','size_bytes',completed->'size_bytes','mime_type',completed->'mime_type',
  'source_asset_id',current_setting('eps.frame.fixture.source'),'timestamp_ms',offset_ms,'width',320,'height',240,'quality_flags','[]'::jsonb);
end $$;
create function pg_temp.frame_payload(frame jsonb,requested bigint,partial_timestamp bigint default null) returns jsonb language sql as $$
 select jsonb_build_object('source_asset_id',current_setting('eps.frame.fixture.source'),'source_sha256',repeat('a',64),'frames',jsonb_build_array(frame),
  'requests',jsonb_build_array(jsonb_build_object('requested_timestamp_ms',requested,'frame_asset_id',frame->'asset_id','actual_timestamp_ms',frame->'timestamp_ms','unavailable_reason',null))
   ||case when partial_timestamp is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('requested_timestamp_ms',partial_timestamp,'frame_asset_id',null,'actual_timestamp_ms',null,'unavailable_reason','FRAME_TIMESTAMP_UNAVAILABLE')) end,
  'warnings',case when partial_timestamp is null then '[]'::jsonb else '["FRAME_TIMESTAMP_UNAVAILABLE"]'::jsonb end,
  'implementation_version','frame-extraction.v1','native_image_id','sha256:'||repeat('e',64),'ffmpeg_version','synthetic-sql-metadata-fixture',
  'display_geometry',jsonb_build_object('sample_aspect_ratio',jsonb_build_object('numerator',1,'denominator',1),'display_aspect_ratio',jsonb_build_object('numerator',4,'denominator',3),'width',320,'height',240))
$$;
create function pg_temp.frame_new_job(label text,timestamp_ms bigint) returns uuid language plpgsql as $$declare response jsonb;begin
 execute 'set local role authenticated';response:=public.eps_extract_candidate_frames(current_setting('eps.frame.fixture.media')::uuid,
  jsonb_build_object('source_asset_id',current_setting('eps.frame.fixture.source'),'timestamps_ms',jsonb_build_array(timestamp_ms)),'synthetic-frame-'||label);
 execute 'set local role postgres';return (response->>'job_id')::uuid;
end $$;

set local role postgres;
do $$declare lease jsonb;replay jsonb;input_value jsonb;grant_value jsonb;ref jsonb;payload jsonb;event jsonb;receipt jsonb;before_pool jsonb;before_facts jsonb;before_selected uuid[];job uuid:=current_setting('eps.frame.fixture.job')::uuid;begin
 select jsonb_agg(to_jsonb(pool) order by pool.id) into before_pool from eps.workspace_candidates pool where candidate_id='7f3f0000-0000-4000-8000-000000000001';
 select to_jsonb(candidate) into before_facts from eps.candidates candidate where id='7f3f0000-0000-4000-8000-000000000001';
 select selected_frame_asset_ids into before_selected from eps.candidate_media where id=current_setting('eps.frame.fixture.media')::uuid;
 lease:=pg_temp.frame_claim(job);replay:=pg_temp.frame_claim(job);perform pg_temp.frame_assert(lease=replay,'same service claim identity returns identical live lease');
 execute 'set local role eps_jobs_executor';
 input_value:=eps.get_specs_stage_input(job,(lease->>'attempt_id')::uuid,lease->>'lease_token');
 execute 'set local role eps_specs_assets_executor';
 grant_value:=eps.get_job_asset_access(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',current_setting('eps.frame.fixture.source')));
 execute 'set local role postgres';
 perform pg_temp.frame_assert(input_value->>'stage'='extract_frames' and input_value#>>'{source,asset_id}'=current_setting('eps.frame.fixture.source') and input_value->'timestamps_ms'='[1000,4500]','existing narrow input port dispatches frozen frame source');
 perform set_config('request.headers',jsonb_build_object('x-eps-asset-grant',grant_value->>'grant_token')::text,true);
 perform pg_temp.frame_assert(eps.candidate_capability_allowed(grant_value->>'bucket',grant_value->>'object_key','read') and not eps.candidate_capability_allowed(grant_value->>'bucket',grant_value->>'object_key','write'),'exact original read capability through unchanged predicate');
 perform pg_temp.frame_expect(format('select eps.record_job_event(%L::jsonb)',jsonb_set(pg_temp.frame_event(lease,'heartbeat'),'{lease_token}',to_jsonb(repeat('0',64)))),'LEASE_INVALID');
 ref:=pg_temp.frame_output(lease,1000);payload:=pg_temp.frame_payload(ref,1000,4500);
 -- Invalid metadata must not become a durable completed stage; keep this denial in an inner rollback.
 begin
  receipt:=pg_temp.frame_send(pg_temp.frame_event(lease,'succeeded',jsonb_set(payload,'{frames,0,timestamp_ms}','2000'),'frame-extraction-stage.v1'));
  perform pg_temp.frame_assert(receipt->>'job_status'='failed','unregistered source/time metadata rejected');
  raise exception using errcode='PZ001',message='ROLLBACK_INVALID_FRAME_FIXTURE';
 exception when sqlstate 'PZ001' then null;end;
 event:=pg_temp.frame_event(lease,'succeeded',payload,'frame-extraction-stage.v1');receipt:=pg_temp.frame_send(event);replay:=pg_temp.frame_send(event);
 perform pg_temp.frame_assert(receipt->>'job_status'='queued' and replay->'duplicate'='true' and replay->'applied'='false','extraction callback commits once and duplicate is inert');
 perform pg_temp.frame_assert(not eps.candidate_capability_allowed(grant_value->>'bucket',grant_value->>'object_key','read'),'previous-stage capability immediately stale');
 perform pg_temp.frame_assert((select completed_stages::text not like '%display_geometry%' and completed_stages::text not like '%FRAME_TIMESTAMP_UNAVAILABLE%' from eps.jobs where id=job),'completed stages contain private pointers, not full result payload');
 lease:=pg_temp.frame_claim(job);event:=pg_temp.frame_event(lease,'succeeded',jsonb_build_object('source_asset_id',current_setting('eps.frame.fixture.source')),'frame-application.v1');
 receipt:=pg_temp.frame_send(event);replay:=pg_temp.frame_send(event);
 perform pg_temp.frame_assert(receipt->>'job_status'='succeeded' and replay->'duplicate'='true','apply and duplicate callback remain fenced after media version change');
 perform pg_temp.frame_assert((select result->>'frame_count'='1' and result->>'unavailable_count'='1' and jsonb_array_length(completed_stages)=2 from eps.jobs where id=job),'one actual registered frame plus explicit unavailable request; two stages');
 execute 'set local role authenticated';input_value:=public.eps_get_job(job);execute 'set local role postgres';
 perform pg_temp.frame_assert(input_value->'frame_extraction'='{"requested_count":2,"extracted_count":1,"unavailable_timestamps_ms":[4500],"warnings":["FRAME_TIMESTAMP_UNAVAILABLE"]}'::jsonb,'public outcome honestly reports only bounded safe partial metadata');
 perform pg_temp.frame_assert(not(input_value ?| array['result','input','completed_stages','lease_token']) and input_value::text not like '%display_geometry%','public outcome excludes private payload and lease');
 perform pg_temp.frame_assert((select count(*)=2 from eps.candidate_media_frames where candidate_media_id=current_setting('eps.frame.fixture.media')::uuid),'append retains existing frame');
 perform pg_temp.frame_assert((select selected_frame_asset_ids=before_selected and row_version=2 from eps.candidate_media where id=current_setting('eps.frame.fixture.media')::uuid),'available frames append without selecting or replacing library defaults');
 perform pg_temp.frame_assert((select jsonb_agg(to_jsonb(pool) order by pool.id)=before_pool from eps.workspace_candidates pool where candidate_id='7f3f0000-0000-4000-8000-000000000001'),'both project pins/availability/versions remain exact');
 perform pg_temp.frame_assert((select to_jsonb(candidate)=before_facts from eps.candidates candidate where id='7f3f0000-0000-4000-8000-000000000001'),'no fact, review or profile version mutation');
 replay:=pg_temp.frame_claim(job,'apply_frames','synthetic-frame-completed-claim');
 perform pg_temp.frame_assert(replay->'already_completed'='true' and replay->>'lease_token'='','completed workorder replays without computation after own append');
 perform pg_temp.frame_assert(pg_temp.frame_claim(job,'apply_frames','synthetic-frame-completed-claim')=replay,'completed claim cached replay remains exact');
end $$;
select 'M03_FRAME_NARROW_PORT_APPEND_PARTIAL_PRIVATE_DUPLICATE_AND_PIN_PASSED';

do $$declare job uuid;lease jsonb;fresh jsonb;receipt jsonb;version bigint;ref jsonb;begin
 job:=pg_temp.frame_new_job('expired-recovery',2000);lease:=pg_temp.frame_claim(job);
 update eps.jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=job;
 receipt:=pg_temp.frame_send(pg_temp.frame_event(lease,'heartbeat'));perform pg_temp.frame_assert(receipt->'stale'='true' and receipt->'applied'='false','expired callback has no effect');
 execute 'set local role eps_jobs_executor';receipt:=eps.recover_job_stages(100);execute 'set local role postgres';
 perform pg_temp.frame_assert((select status='queued' and dispatch_generation=2 from eps.jobs where id=job),'expired frame stage recovered by existing bounded port');
 update eps.jobs set available_at=clock_timestamp() where id=job;fresh:=pg_temp.frame_claim(job,null,'synthetic-frame-recovered-claim');
 perform pg_temp.frame_assert(fresh->>'attempt_id'<>lease->>'attempt_id' and fresh->>'lease_token'<>lease->>'lease_token','recovery fences old lease');
 receipt:=pg_temp.frame_send(pg_temp.frame_event(lease,'heartbeat'));perform pg_temp.frame_assert(receipt->'stale'='true','prior attempt remains stale');
 select row_version into version from eps.jobs where id=job;
 execute 'set local role authenticated';perform public.eps_cancel_job(job,jsonb_build_object('row_version',version),'synthetic-frame-cancel-running');execute 'set local role postgres';
 receipt:=pg_temp.frame_send(pg_temp.frame_event(fresh,'heartbeat'));perform pg_temp.frame_assert(receipt->'stale'='true' and receipt->>'job_status'='cancelled','cancel rejects late frame callback');
 job:=pg_temp.frame_new_job('manual-media-change',2100);lease:=pg_temp.frame_claim(job);ref:=pg_temp.frame_output(lease,2100);
 receipt:=pg_temp.frame_send(pg_temp.frame_event(lease,'succeeded',pg_temp.frame_payload(ref,2100),'frame-extraction-stage.v1'));
 lease:=pg_temp.frame_claim(job);update eps.candidate_media set row_version=row_version+1 where id=current_setting('eps.frame.fixture.media')::uuid;
 receipt:=pg_temp.frame_send(pg_temp.frame_event(lease,'succeeded',jsonb_build_object('source_asset_id',current_setting('eps.frame.fixture.source')),'frame-application.v1'));
 perform pg_temp.frame_assert(receipt->>'job_status'='waiting_for_input','manual media edit preserves user choices against late apply');
 perform pg_temp.frame_assert((select count(*)=2 from eps.candidate_media_frames where candidate_media_id=current_setting('eps.frame.fixture.media')::uuid),'changed-source result appends no material');
 perform pg_temp.frame_expect(format('select pg_temp.frame_claim(%L::uuid,''apply_frames'',''synthetic-frame-changed-new-claim'')',job),'INPUT_CHANGED');
end $$;
set local role anon;
select pg_temp.frame_expect('select public.eps_extract_candidate_frames(''7f5f0000-0000-4000-8000-000000000001'',''{}'',''synthetic-frame-guest'')','42501');
select pg_temp.frame_expect('select eps.claim_job_stage(''{}'')','42501');
set local role postgres;
select pg_temp.frame_assert(not has_table_privilege('authenticated','eps.candidate_stage_payloads','SELECT') and not has_function_privilege('authenticated','eps.frame_user_outcome(eps.jobs)','EXECUTE'),'private stage payloads and result projector remain private');
select 'M03_FRAME_EXPIRED_RECOVERY_CANCELLATION_MANUAL_FENCE_AND_GUEST_PASSED';
