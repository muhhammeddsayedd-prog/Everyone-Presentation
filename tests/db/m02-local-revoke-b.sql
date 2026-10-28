begin;
set local statement_timeout='10s'; set local lock_timeout='7s';
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_TARGET_REQUIRED'; end if; end $$;
select set_config('eps.m02.input',(select input::text from eps_local_guard.m02_fixture where id=1 and marker='EPS M02 LOCAL DURABILITY V1'),true);
select set_config('request.jwt.claim.sub','7a111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"7a111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
select jsonb_build_object('phase','started','session_pid',pg_backend_pid(),'at',clock_timestamp());
set local role eps_jobs_owner;
do $$ begin
  begin
    perform eps.m02_enqueue_specs_job('7c111111-1111-4111-8111-111111111111',current_setting('eps.m02.input')::jsonb,'m02-local-enqueue-a');
  exception when others then if sqlerrm='RESOURCE_NOT_FOUND' then return; end if; raise; end;
  raise exception 'M02_REVOKED_CACHED_REPLAY_MUST_DENY';
end $$;
reset role;
select jsonb_build_object('phase','returned','session_pid',pg_backend_pid(),'at',clock_timestamp(),'cached_replay_denied',true);
commit;
