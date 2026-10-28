-- Run concurrently with m01-race-same-b.sql through reviewed local runner.
begin;
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_FIXTURE_TARGET_REQUIRED'; end if; end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"eeeeeeee-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
select jsonb_build_object('session_pid',pg_backend_pid(),'claim_started_at',clock_timestamp()) as claim_started;
select public.eps_create_workspace('{"project_id":"eeeeeeee-2222-4222-8222-222222222221","initial_output":"selection"}','local-race-same-key') as same_a;
select jsonb_build_object('session_pid',pg_backend_pid(),'claim_returned_at',clock_timestamp()) as claim_returned;
select pg_sleep(1); -- Keep transaction/advisory locks held during the other session's claim.
commit;
