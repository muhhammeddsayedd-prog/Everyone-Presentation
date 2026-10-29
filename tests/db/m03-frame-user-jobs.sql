-- Requires the frame fixture's real publicenqueue-created job, then rolls back with its parent.
-- Synthetic metadata only: no original/derivative bytes, provider or browser credit.
create function pg_temp.frame_user_assert(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'M03_FRAME_USER_ASSERTION: %',label;end if;end $$;
create function pg_temp.frame_user_expect(command text,expected_code text) returns void language plpgsql as $$
begin begin execute command;raise exception 'EXPECTED_FRAME_USER_DENIAL';exception when raise_exception then if sqlerrm<>expected_code then raise;end if;end;end $$;
set local role postgres;
select set_config('eps.frame.user.workspace',(select origin_workspace_id::text from eps.media_assets where id=current_setting('eps.frame.fixture.source')::uuid),true);
select set_config('eps.frame.user.project',(select project_id::text from eps.workspaces where id=current_setting('eps.frame.user.workspace')::uuid),true);
select pg_temp.frame_user_assert(not exists(select 1 from public.project_memberships where principal_id=current_setting('eps.frame.fixture.principal')::uuid and project_id=current_setting('eps.frame.user.project')::uuid),'global requester has no origin project membership');
do $$ begin if exists(select 1 from auth.users where id='7f1f0000-0000-4000-8000-000000000002') then raise exception 'FRAME_USER_SECOND_FIXTURE_ALREADY_EXISTS';end if;end $$;
insert into auth.users(id,is_anonymous,deleted_at,banned_until) values('7f1f0000-0000-4000-8000-000000000002',false,null,null);
insert into public.app_capability_grants(principal_id,capability)
 select '7f1f0000-0000-4000-8000-000000000002'::uuid,value from unnest(array['projects.read','workspaces.read','operations.retry','cast.read','cast.upload']) value;
insert into public.project_memberships(project_id,principal_id,can_write) values(current_setting('eps.frame.user.project')::uuid,'7f1f0000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.sub',current_setting('eps.frame.fixture.principal'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.frame.fixture.principal'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.frame_user_assert(public.eps_get_job(current_setting('eps.frame.fixture.job')::uuid)->>'kind'='frame_extract','requester reads own job without origin membership');
select pg_temp.frame_user_assert(not(public.eps_get_job(current_setting('eps.frame.fixture.job')::uuid) ?| array['input','result','completed_stages','lease_token','lease_token_digest']),'job DTO has no private stage or lease payload');
select pg_temp.frame_user_assert(not(public.eps_get_job(current_setting('eps.frame.fixture.job')::uuid) ? 'frame_extraction'),'queued outcome is not fabricated');
select pg_temp.frame_user_assert(public.eps_list_jobs(current_setting('eps.frame.user.workspace')::uuid)->'data' @> jsonb_build_array(jsonb_build_object('id',current_setting('eps.frame.fixture.job'))),'requester lists own lineage-workspace job');

select set_config('request.jwt.claim.sub','7f1f0000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"7f1f0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('eps.frame.user.second_job',(public.eps_extract_candidate_frames(current_setting('eps.frame.fixture.media')::uuid,jsonb_build_object('source_asset_id',current_setting('eps.frame.fixture.source'),'timestamps_ms','[2]'::jsonb),'synthetic-frame-user-second')->>'job_id'),true);
select pg_temp.frame_user_expect(format('select public.eps_get_job(%L::uuid)',current_setting('eps.frame.fixture.job')),'RESOURCE_NOT_FOUND');
select pg_temp.frame_user_assert(not(public.eps_list_jobs(current_setting('eps.frame.user.workspace')::uuid)->'data' @> jsonb_build_array(jsonb_build_object('id',current_setting('eps.frame.fixture.job')))),'origin project operator cannot list another requester frame job');
select pg_temp.frame_user_expect(format('select public.eps_cancel_job(%L::uuid,''{"row_version":1}'',''synthetic-frame-other-cancel'')',current_setting('eps.frame.fixture.job')),'RESOURCE_NOT_FOUND');
select pg_temp.frame_user_expect(format('select public.eps_retry_job(%L::uuid,''{"row_version":1}'',''synthetic-frame-other-retry'')',current_setting('eps.frame.fixture.job')),'RESOURCE_NOT_FOUND');
set local role eps_jobs_owner;
select pg_temp.frame_user_assert((select count(*)=0 from eps.jobs where id=current_setting('eps.frame.fixture.job')::uuid),'RLS excludes another requester frame even for origin project operator');
set local role authenticated;

set local role postgres;
insert into eps.jobs(id,workspace_id,requested_by,kind,status,stage,resource_id,input,input_hash,dedupe_key,correlation_id,error)
 values('7f6f0000-0000-4000-8000-000000000009',current_setting('eps.frame.user.workspace')::uuid,'7f1f0000-0000-4000-8000-000000000002','specs_extract','failed','prepare_document',
 (select id from eps.specs where workspace_id=current_setting('eps.frame.user.workspace')::uuid),
 '{"synthetic_authorization_fixture":true}',repeat('a',64),repeat('b',64),'synthetic-frame-ordinary-job','{"code":"DEPENDENCY_UNAVAILABLE","message":"Synthetic bounded failure","details":{},"retryable":true}');
set local role authenticated;
select pg_temp.frame_user_assert(public.eps_get_job('7f6f0000-0000-4000-8000-000000000009')->>'kind'='specs_extract','ordinary project read preserved');
select pg_temp.frame_user_assert(not(public.eps_get_job('7f6f0000-0000-4000-8000-000000000009') ? 'frame_extraction'),'ordinary job DTO unchanged');
select pg_temp.frame_user_assert(public.eps_retry_job('7f6f0000-0000-4000-8000-000000000009','{"row_version":1}','synthetic-frame-ordinary-retry')->>'status'='queued','ordinary authorized retry preserved');
select pg_temp.frame_user_assert(public.eps_cancel_job('7f6f0000-0000-4000-8000-000000000009','{"row_version":2}','synthetic-frame-ordinary-cancel')->>'status'='cancelled','ordinary authorized cancellation preserved');

select set_config('request.jwt.claim.sub',current_setting('eps.frame.fixture.principal'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.frame.fixture.principal'),'role','authenticated')::text,true);
select pg_temp.frame_user_expect(format('select public.eps_get_job(%L::uuid)',current_setting('eps.frame.user.second_job')),'RESOURCE_NOT_FOUND');
select pg_temp.frame_user_assert(not(public.eps_list_jobs(current_setting('eps.frame.user.workspace')::uuid,null,null,100)->'data' @> jsonb_build_array(jsonb_build_object('id',current_setting('eps.frame.user.second_job')))),'same media does not expose another requester job');
set local role postgres;
update eps.jobs set status='failed',error='{"code":"DEPENDENCY_UNAVAILABLE","message":"Synthetic bounded failure","details":{},"retryable":true}' where id=current_setting('eps.frame.fixture.job')::uuid;
select set_config('eps.frame.user.outbox_before',(select count(*)::text from eps.outbox_events where job_id=current_setting('eps.frame.fixture.job')::uuid),true);
set local role authenticated;
select set_config('eps.frame.user.retry',public.eps_retry_job(current_setting('eps.frame.fixture.job')::uuid,'{"row_version":1}','synthetic-frame-own-retry')::text,true);
select pg_temp.frame_user_assert(current_setting('eps.frame.user.retry')::jsonb->>'status'='queued','requester retries failed job without origin membership');
select pg_temp.frame_user_assert(public.eps_retry_job(current_setting('eps.frame.fixture.job')::uuid,'{"row_version":1}','synthetic-frame-own-retry')=current_setting('eps.frame.user.retry')::jsonb,'retry replay returns exact receipt');
set local role postgres;
select pg_temp.frame_user_assert((select count(*) from eps.outbox_events where job_id=current_setting('eps.frame.fixture.job')::uuid)=current_setting('eps.frame.user.outbox_before')::bigint+1,'retry dispatch inserted once');
update eps.candidate_media set row_version=row_version+1 where id=current_setting('eps.frame.fixture.media')::uuid;
set local role authenticated;
select pg_temp.frame_user_expect(format('select public.eps_retry_job(%L::uuid,''{"row_version":1}'',''synthetic-frame-own-retry'')',current_setting('eps.frame.fixture.job')),'RESOURCE_NOT_FOUND');
select pg_temp.frame_user_assert(public.eps_get_job(current_setting('eps.frame.fixture.job')::uuid)->>'status'='queued','changed source retains readable job diagnostics');
select pg_temp.frame_user_assert(public.eps_cancel_job(current_setting('eps.frame.fixture.job')::uuid,'{"row_version":2}','synthetic-frame-own-cancel')->>'status'='cancelled','requester may cancel after source changes');

select set_config('eps.frame.user.third_job',(public.eps_extract_candidate_frames(current_setting('eps.frame.fixture.media')::uuid,jsonb_build_object('source_asset_id',current_setting('eps.frame.fixture.source'),'timestamps_ms','[3]'::jsonb),'synthetic-frame-user-third')->>'job_id'),true);
set local role postgres;
update eps.jobs set status='failed',error='{"code":"DEPENDENCY_UNAVAILABLE","message":"Synthetic bounded failure","details":{},"retryable":true}' where id=current_setting('eps.frame.user.third_job')::uuid;
update public.app_capability_grants set active=false where principal_id=current_setting('eps.frame.fixture.principal')::uuid and capability='cast.upload';
set local role authenticated;
select pg_temp.frame_user_expect(format('select public.eps_retry_job(%L::uuid,''{"row_version":1}'',''synthetic-frame-revoked-upload'')',current_setting('eps.frame.user.third_job')),'RESOURCE_NOT_FOUND');
select pg_temp.frame_user_assert(public.eps_cancel_job(current_setting('eps.frame.user.third_job')::uuid,'{"row_version":1}','synthetic-frame-stop-after-revoke')->>'status'='cancelled','upload revocation blocks retry but keeps own cancellation');
set local role postgres;
update public.app_capability_grants set active=false where principal_id=current_setting('eps.frame.fixture.principal')::uuid and capability='operations.retry';
set local role authenticated;
select pg_temp.frame_user_expect(format('select public.eps_cancel_job(%L::uuid,''{"row_version":2}'',''synthetic-frame-revoked-operations'')',current_setting('eps.frame.user.third_job')),'CAPABILITY_REQUIRED');
set local role postgres;
update public.app_capability_grants set active=false where principal_id=current_setting('eps.frame.fixture.principal')::uuid and capability='cast.read';
set local role authenticated;
select pg_temp.frame_user_expect(format('select public.eps_get_job(%L::uuid)',current_setting('eps.frame.fixture.job')),'CAPABILITY_REQUIRED');
do $$ begin begin perform eps.frame_user_can_read(null::eps.jobs);raise exception 'EXPECTED_PRIVATE_USER_HELPER_DENIAL';exception when insufficient_privilege then null;end;end $$;
set local role postgres;
select 'M03_FRAME_REQUESTER_USER_JOBS_RETRY_CANCEL_AND_LEGACY_PASSED';
