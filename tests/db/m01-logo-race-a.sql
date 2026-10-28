-- Run concurrently with m01-logo-race-b.sql in separate reviewed local sessions.
-- Synthetic signed SQL proof only; no actual image bytes or Storage HTTP.
begin;
set transaction isolation level read committed;
do $$ declare fixture eps_local_guard.logo_race_fixture; begin
  if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_FIXTURE_TARGET_REQUIRED'; end if;
  select * into strict fixture from eps_local_guard.logo_race_fixture where fixture_id=1 and marker='EPS LOCAL LOGO SQL POLICY RACE V1';
  if fixture.principal_id<>'dddddddd-1111-4111-8111-111111111111' or fixture.workspace_id<>'dddddddd-3333-4333-8333-333333333333' then raise exception 'LOGO_RACE_FIXTURE_OWNERSHIP_MISMATCH'; end if;
  perform set_config('eps.logo_race.call',jsonb_build_object('upload_id',fixture.upload_id,'input',fixture.completion_input,'payload',fixture.proof_payload,'mac',fixture.proof_mac)::text,true);
  perform set_config('request.jwt.claim.sub',fixture.principal_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',fixture.principal_id,'role','authenticated','is_anonymous',false)::text,true);
end $$;
set local role authenticated;
select jsonb_build_object('session_pid',pg_backend_pid(),'claim_started_at',clock_timestamp()) as claim_started;
do $$ declare input jsonb:=current_setting('eps.logo_race.call')::jsonb; result jsonb; begin
  result:=public.eps_finalize_logo_completion((input->>'upload_id')::uuid,input->'input','eps-local-logo-race-a',input->>'payload',input->>'mac');
  if result->>'status' is distinct from 'ready' or result->'asset'->>'sha256' is distinct from repeat('b',64) then raise exception 'LOGO_RACE_COMPLETION_NOT_READY'; end if;
end $$;
select jsonb_build_object('session_pid',pg_backend_pid(),'claim_returned_at',clock_timestamp()) as claim_returned;
select pg_sleep(1); -- Keep per-upload/advisory and transition row locks through peer claim.
commit;
