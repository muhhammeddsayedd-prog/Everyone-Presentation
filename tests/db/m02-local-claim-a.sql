begin;
set local application_name='eps_m02_claim_a';
set local statement_timeout='10s'; set local lock_timeout='5s';
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' or not exists(select 1 from eps_local_guard.m02_fixture where id=1 and marker='EPS M02 LOCAL DURABILITY V1') then raise exception 'LOCAL_TARGET_REQUIRED'; end if; end $$;
select jsonb_build_object('phase','started','session_pid',pg_backend_pid(),'at',clock_timestamp());
set local role eps_jobs_dispatcher;
do $$ declare lease jsonb; begin
  lease:=eps.claim_job_outbox(1);
  if jsonb_array_length(lease->'leases')<>1 then raise exception 'M02_ONE_CLAIM_REQUIRED'; end if;
  perform set_config('eps.m02.claim',lease->'leases'->0->>'id',true);
  if eps.finish_job_outbox((lease->'leases'->0->>'id')::uuid,lease->'leases'->0->>'lease_token',true) is distinct from '{"acknowledged":true,"stale":false}'::jsonb then raise exception 'M02_ACK_FAILED'; end if;
end $$;
reset role;
select jsonb_build_object('phase','returned','session_pid',pg_backend_pid(),'at',clock_timestamp(),'event_id',current_setting('eps.m02.claim'));
select jsonb_build_object('phase','holding','session_pid',pg_backend_pid(),'at',clock_timestamp());
select pg_sleep(4);
commit;
