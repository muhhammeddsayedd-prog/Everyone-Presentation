-- Synthetic admission/idempotency/authorization proof only; no bytes/native/provider calls.
create function pg_temp.resubmission_assert(value boolean,label text)returns void language plpgsql as $$begin
 if value is distinct from true then raise exception 'FRAME_RESUBMISSION_ASSERTION: %',label;end if;
end $$;
create function pg_temp.resubmission_submit(request_key text)returns jsonb language plpgsql as $$declare response jsonb;begin
 execute 'set local role authenticated';
 response:=public.eps_extract_candidate_frames(current_setting('eps.frame.fixture.media')::uuid,
  jsonb_build_object('source_asset_id',current_setting('eps.frame.fixture.source'),'timestamps_ms','[1000,4500]'::jsonb),request_key);
 execute 'set local role postgres';return response;
end $$;
create function pg_temp.resubmission_expect(command text,expected_code text)returns void language plpgsql as $$begin
 begin execute command;raise exception 'FRAME_RESUBMISSION_DENIAL_EXPECTED';exception when others then
  if sqlerrm<>expected_code and sqlstate<>expected_code then raise;end if;
 end;
end $$;

do $$declare original uuid:=current_setting('eps.frame.fixture.job')::uuid;new_job uuid;next_job uuid;response jsonb;receipt jsonb;
 original_receipt jsonb;terminal_before jsonb;facts_before jsonb;media_before jsonb;pins_before jsonb;lease jsonb;claim_input jsonb;begin
 select to_jsonb(c)into facts_before from eps.candidates c where id='7f3f0000-0000-4000-8000-000000000001';
 select to_jsonb(m)into media_before from eps.candidate_media m where id=current_setting('eps.frame.fixture.media')::uuid;
 select jsonb_agg(to_jsonb(p)order by id)into pins_before from eps.workspace_candidates p where candidate_id='7f3f0000-0000-4000-8000-000000000001';
 original_receipt:=pg_temp.resubmission_submit('synthetic-frame-fixture-enqueue');
 response:=pg_temp.resubmission_submit('synthetic-frame-active-queued-newkey');
 perform pg_temp.resubmission_assert(response->>'job_id'=original::text and response->>'status'='queued','new keys coalesce queued work');
 perform pg_temp.resubmission_assert(pg_temp.resubmission_submit('synthetic-frame-active-queued-newkey')=response,'coalesced key exact replay');
 perform pg_temp.resubmission_assert((select count(*)=1 from eps.outbox_events where job_id=original),'active coalescing adds no dispatch');
 execute 'set local role authenticated';response:=public.eps_cancel_job(original,'{"row_version":1}','synthetic-frame-original-cancel');execute 'set local role postgres';
 select to_jsonb(j)into terminal_before from eps.jobs j where id=original;
 perform pg_temp.resubmission_assert(response->>'status'='cancelled','real public cancellation confirmed');
 perform pg_temp.resubmission_assert(pg_temp.resubmission_submit('synthetic-frame-fixture-enqueue')=original_receipt,'same original key retains original receipt after cancellation');
 receipt:=pg_temp.resubmission_submit('synthetic-frame-after-cancel-newkey');new_job:=(receipt->>'job_id')::uuid;
 perform pg_temp.resubmission_assert(new_job<>original and receipt->>'status'='queued','new key after cancellation creates distinct queued job');
 perform pg_temp.resubmission_assert(pg_temp.resubmission_submit('synthetic-frame-after-cancel-newkey')=receipt,'new job acknowledgement exact replay');
 perform pg_temp.resubmission_assert((select to_jsonb(j)=terminal_before from eps.jobs j where id=original),'cancelled job is immutable, never resurrected');
 perform pg_temp.resubmission_assert((select count(*)=1 from eps.outbox_events where job_id=new_job),'new intent dispatch inserted once');
 perform pg_temp.resubmission_assert((select dedupe_key=encode(sha256(convert_to('frame_extract:'||requested_by::text||':'||input_hash||':synthetic-frame-after-cancel-newkey','UTF8')),'hex')from eps.jobs where id=new_job),'new admission dedupe binds exact request key and fingerprint');

 update eps.jobs set status='failed',error='{"code":"DEPENDENCY_UNAVAILABLE","message":"Synthetic bounded failure","details":{},"retryable":true}'where id=new_job;
 select to_jsonb(j)into terminal_before from eps.jobs j where id=new_job;
 response:=pg_temp.resubmission_submit('synthetic-frame-after-failure-newkey');next_job:=(response->>'job_id')::uuid;
 perform pg_temp.resubmission_assert(next_job not in(original,new_job)and response->>'status'='queued','new key after failure creates distinct queued job');
 perform pg_temp.resubmission_assert(pg_temp.resubmission_submit('synthetic-frame-after-cancel-newkey')=receipt,'failed old job still replays exact original acknowledgement');
 perform pg_temp.resubmission_assert((select to_jsonb(j)=terminal_before from eps.jobs j where id=new_job),'failed job and error retained exactly');
 update eps.jobs set status='succeeded',result=jsonb_build_object('candidate_media_id',resource_id,'source_asset_id',input_asset_id,'frame_asset_ids','[]'::jsonb,
  'requested_count',2,'frame_count',0,'unavailable_count',2,'unavailable_timestamps_ms','[1000,4500]'::jsonb,'warnings','["FRAME_TIMESTAMP_UNAVAILABLE"]'::jsonb)where id=next_job;
 select to_jsonb(j)into terminal_before from eps.jobs j where id=next_job;
 response:=pg_temp.resubmission_submit('synthetic-frame-after-success-newkey');new_job:=(response->>'job_id')::uuid;
 perform pg_temp.resubmission_assert(new_job not in(original,next_job)and response->>'status'='queued','new key after zero-frame success creates distinct job');
 perform pg_temp.resubmission_assert((select to_jsonb(j)=terminal_before from eps.jobs j where id=next_job),'succeeded result retained exactly');

 select jsonb_build_object('job_id',new_job,'stage','extract_frames','input_hash',input_hash)into claim_input from eps.jobs where id=new_job;
 execute 'set local role eps_jobs_executor';
 lease:=eps.claim_job_stage(claim_input);
 execute 'set local role postgres';
 response:=pg_temp.resubmission_submit('synthetic-frame-active-running-newkey');
 perform pg_temp.resubmission_assert(response->>'job_id'=new_job::text and response->>'status'='running','running work coalesces without new native stage');
 update eps.jobs set status='waiting_for_input',current_attempt_id=null,lease_token_digest=null,lease_expires_at=null where id=new_job;
 response:=pg_temp.resubmission_submit('synthetic-frame-active-waiting-newkey');
 perform pg_temp.resubmission_assert(response->>'job_id'=new_job::text and response->>'status'='waiting_for_input','waiting work remains coalesced');
 perform pg_temp.resubmission_assert((select count(*)=1 from eps.outbox_events where job_id=new_job),'all active states retain one initial dispatch');
 perform pg_temp.resubmission_assert((select to_jsonb(c)=facts_before from eps.candidates c where id='7f3f0000-0000-4000-8000-000000000001'),'facts and review unchanged');
 perform pg_temp.resubmission_assert((select to_jsonb(m)=media_before from eps.candidate_media m where id=current_setting('eps.frame.fixture.media')::uuid),'library media/frame selection unchanged');
 perform pg_temp.resubmission_assert((select jsonb_agg(to_jsonb(p)order by id)=pins_before from eps.workspace_candidates p where candidate_id='7f3f0000-0000-4000-8000-000000000001'),'both project pins, availability and versions unchanged');
end $$;
select 'M03_FRAME_TERMINAL_NEW_INTENT_ACTIVE_COALESCING_AND_EXACT_REPLAY_PASSED';

insert into auth.users(id,is_anonymous,deleted_at,banned_until)values('7f1f0000-0000-4000-8000-000000000002',false,null,null);
insert into public.app_capability_grants(principal_id,capability)select'7f1f0000-0000-4000-8000-000000000002'::uuid,value from unnest(array['cast.read','cast.upload'])value;
select set_config('request.jwt.claim.sub','7f1f0000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"7f1f0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$declare response jsonb;begin
 response:=pg_temp.resubmission_submit('synthetic-frame-other-requester-newkey');
 perform pg_temp.resubmission_assert((select requested_by='7f1f0000-0000-4000-8000-000000000002'::uuid from eps.jobs where id=(response->>'job_id')::uuid),'another requester never receives first requester active job');
end $$;
select set_config('request.jwt.claim.sub',current_setting('eps.frame.fixture.principal'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.frame.fixture.principal'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.resubmission_expect(format('select public.eps_extract_candidate_frames(%L::uuid,jsonb_build_object(''source_asset_id'',%L,''timestamps_ms'',''[1001]''::jsonb),''synthetic-frame-fixture-enqueue'')',current_setting('eps.frame.fixture.media'),current_setting('eps.frame.fixture.source')),'IDEMPOTENCY_KEY_REUSED');
set local role postgres;
delete from public.app_capability_grants where principal_id=current_setting('eps.frame.fixture.principal')::uuid and capability='cast.upload';
set local role authenticated;
select pg_temp.resubmission_expect(format('select public.eps_extract_candidate_frames(%L::uuid,jsonb_build_object(''source_asset_id'',%L,''timestamps_ms'',''[1000,4500]''::jsonb),''synthetic-frame-fixture-enqueue'')',current_setting('eps.frame.fixture.media'),current_setting('eps.frame.fixture.source')),'CAPABILITY_REQUIRED');
set local role anon;
select pg_temp.resubmission_expect('select public.eps_extract_candidate_frames(''7f5f0000-0000-4000-8000-000000000001'',''{}'',''synthetic-frame-guest'')','42501');
set local role postgres;
select 'M03_FRAME_RESUBMISSION_REQUESTER_SCOPE_REVOKED_ACCESS_AND_KEY_CONFLICT_PASSED';
