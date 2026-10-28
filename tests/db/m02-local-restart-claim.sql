-- Lease token output is PRIVATE to the driver process memory, never a receipt.
begin;
set local application_name='eps_m02_single_a';
do $$ begin
 if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
   or not exists(select 1 from eps_local_guard.m02_fixture where id=1 and marker='EPS M02 LOCAL DURABILITY V1')
   or (select count(*) from eps.jobs)<>3 or (select count(*) from eps.outbox_events where status='pending')<>1
 then raise exception 'M02_RESTART_FIXTURE_STATE_INVALID'; end if;
end $$;
select jsonb_build_object('phase','started','session_pid',pg_backend_pid(),'at',clock_timestamp());
set local role eps_jobs_dispatcher;
do $$ declare claimed jsonb; begin
 claimed:=eps.claim_job_outbox(1);
 if jsonb_array_length(claimed->'leases')<>1 then raise exception 'M02_RESTART_SINGLE_LEASE_REQUIRED'; end if;
 perform set_config('eps.m02.private_claim',claimed::text,true);
end $$;
reset role;
select jsonb_build_object('phase','private_lease','session_pid',pg_backend_pid(),'lease',current_setting('eps.m02.private_claim')::jsonb->'leases'->0);
select jsonb_build_object('phase','returned','session_pid',pg_backend_pid(),'at',clock_timestamp(),'event_id',current_setting('eps.m02.private_claim')::jsonb->'leases'->0->>'id');
select jsonb_build_object('phase','holding','session_pid',pg_backend_pid(),'at',clock_timestamp());
select pg_sleep(4);
commit;
