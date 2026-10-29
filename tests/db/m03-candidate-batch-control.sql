-- 200 synthetic file intents, bounded control-plane scheduling only. No file
-- bytes, FFmpeg, n8n, OpenAI or 200-video throughput acceptance is inferred.
do $$declare reservation jsonb;completed jsonb;first_reservation jsonb;first_completion jsonb;input_value jsonb;index_value integer;
 batch uuid:='7dae0000-0000-4000-8000-000000000001';asset_count bigint;job_count bigint;profile_count bigint;begin
 select count(*) into profile_count from eps.candidates;perform set_config('eps.scale.profiles_before',profile_count::text,true);
 for index_value in 1..200 loop
  input_value:=jsonb_build_object('workspace_id','7cae0000-0000-4000-8000-000000000001','batch_id',batch,'purpose','candidate_video',
   'filename','same-introduction.mp4','mime_type','video/mp4','size_bytes',1000,'sha256',md5(index_value::text)||md5(index_value::text));
  execute 'set local role authenticated';reservation:=public.eps_reserve_candidate_upload(input_value,'scale-reserve-'||lpad(index_value::text,3,'0'));
  completed:=public.eps_complete_candidate_upload((reservation->>'upload_id')::uuid,'{"actual_size_bytes":1000,"start_processing":true}','scale-complete-'||lpad(index_value::text,3,'0'));
  execute 'set local role postgres';if index_value=1 then first_reservation:=reservation;first_completion:=completed;end if;
 end loop;
 select count(*),count(distinct input_asset_id) into job_count,asset_count from eps.jobs where batch_id=batch;
 perform pg_temp.kernel_assert(job_count=200 and asset_count=200,'200 same-name files retain distinct stable source/job IDs');
 perform pg_temp.kernel_assert((select count(*)=200 and bool_and(status='queued' and attempt=0 and stage='prepare_candidate') from eps.jobs where batch_id=batch),'batch acceptance does not begin200 provider executions');
 input_value:=jsonb_build_object('workspace_id','7cae0000-0000-4000-8000-000000000001','batch_id',batch,'purpose','candidate_video',
  'filename','same-introduction.mp4','mime_type','video/mp4','size_bytes',1000,'sha256',md5('1')||md5('1'));
 execute 'set local role authenticated';reservation:=public.eps_reserve_candidate_upload(input_value,'scale-reserve-001');
 completed:=public.eps_complete_candidate_upload((reservation->>'upload_id')::uuid,'{"actual_size_bytes":1000,"start_processing":true}','scale-complete-001');execute 'set local role postgres';
 perform pg_temp.kernel_assert(reservation->>'upload_id'=first_reservation->>'upload_id' and completed=first_completion
  and (select count(*)=200 from eps.jobs where batch_id=batch),'retry of one batch intent creates no201st source/job');
end $$;
-- Dispatcher crash before stage claim: expired outbox intent is reclaimed with
-- a new token; an old acknowledgement cannot consume that replacement lease.
do $$declare first_lease jsonb;next_lease jsonb;begin
 first_lease:=eps.claim_job_outbox(1)#>'{leases,0}';perform pg_temp.kernel_assert(first_lease is not null,'one durable pending dispatch claimed');
 update eps.outbox_events set lease_expires_at=clock_timestamp()-interval '1 second' where id=(first_lease->>'id')::uuid;
 next_lease:=eps.claim_job_outbox(1)#>'{leases,0}';
 perform pg_temp.kernel_assert(first_lease->>'id'=next_lease->>'id' and first_lease->>'lease_token'<>next_lease->>'lease_token','crashed dispatch recovers same intent with fresh fence');
 perform set_config('eps.scale.old_dispatch',first_lease::text,true);
 perform pg_temp.kernel_expect('select eps.finish_job_outbox((current_setting(''eps.scale.old_dispatch'')::jsonb->>''id'')::uuid,current_setting(''eps.scale.old_dispatch'')::jsonb->>''lease_token'',true)','INVALID_TRANSITION');
 perform eps.finish_job_outbox((next_lease->>'id')::uuid,next_lease->>'lease_token',false);
 update eps.outbox_events set available_at=clock_timestamp() where id=(next_lease->>'id')::uuid;
end $$;
do $$declare batch uuid:='7dae0000-0000-4000-8000-000000000001';dispatch jsonb;row_value jsonb;leases jsonb;lease jsonb;handled integer:=0;rounds integer:=0;
 event jsonb;receipt jsonb;version bigint;active_count integer;begin
 loop
  dispatch:=eps.claim_job_outbox(2);perform pg_temp.kernel_assert(jsonb_array_length(dispatch->'leases')<=2,'caller bound limits dispatched work per turn');
  exit when jsonb_array_length(dispatch->'leases')=0;rounds:=rounds+1;leases:='[]';
  for row_value in select value from jsonb_array_elements(dispatch->'leases') loop
   perform pg_temp.kernel_assert((select batch_id=batch from eps.jobs where id=(row_value#>>'{envelope,job_id}')::uuid),'dispatch stays on synthetic batch');
   lease:=eps.claim_job_stage(jsonb_build_object('job_id',row_value#>'{envelope,job_id}','stage',row_value#>'{envelope,stage}','input_hash',row_value#>'{envelope,input_hash}'));
   perform eps.finish_job_outbox((row_value->>'id')::uuid,row_value->>'lease_token',true);leases:=leases||jsonb_build_array(lease);
  end loop;
  select count(*) into active_count from eps.jobs where batch_id=batch and status='running';
  perform pg_temp.kernel_assert(active_count between 1 and 2,'two-slot synthetic scheduler applies explicit backpressure');
  for lease in select value from jsonb_array_elements(leases) loop
   handled:=handled+1;
   if handled=1 then
    event:=jsonb_build_object('event_id',gen_random_uuid(),'job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage',lease->'stage',
     'input_hash',lease#>'{input,input_hash}','sequence',1,'event_type','failed','error',jsonb_build_object('code','SOURCE_UNREADABLE','message','Synthetic corrupt-file control-plane failure.','details','{}'::jsonb,'retryable',false));
    receipt:=eps.record_job_event(event);perform pg_temp.kernel_assert(receipt->>'job_status'='failed'
     and (select count(*)=199 from eps.jobs where batch_id=batch and status in('queued','running')),'one failed file leaves199 independent pending/running intents');
   else
    select row_version into strict version from eps.jobs where id=(lease->>'job_id')::uuid;
    execute 'set local role authenticated';perform public.eps_cancel_job((lease->>'job_id')::uuid,jsonb_build_object('row_version',version),'scale-cancel-'||handled::text);execute 'set local role postgres';
   end if;
  end loop;
  perform pg_temp.kernel_assert((select count(*)=0 from eps.jobs where batch_id=batch and status='running'),'completed scheduler turn releases its active slots');
  perform pg_temp.kernel_assert(rounds<=100,'bounded200-file scheduling completes in100 two-slot turns');
 end loop;
 perform pg_temp.kernel_assert(handled=200 and rounds=100,'all200 control-plane intents independently scheduled');
 perform pg_temp.kernel_assert((select count(*) filter(where status='failed')=1 and count(*) filter(where status='cancelled')=199
  and bool_and(attempt=1) from eps.jobs where batch_id=batch),'bounded attempts and independent terminal states retained');
 perform pg_temp.kernel_assert((select count(*)=current_setting('eps.scale.profiles_before')::bigint from eps.candidates),'no fake cast facts/provider output generated by batch control test');
end $$;
select 'CANDIDATE_200_SYNTHETIC_CONTROL_PLANE_AND_BOUNDED_SCHEDULING_PASSED';
