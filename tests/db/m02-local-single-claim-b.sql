begin;
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_TARGET_REQUIRED'; end if; end $$;
select jsonb_build_object('phase','started','session_pid',pg_backend_pid(),'at',clock_timestamp());
set local role eps_jobs_dispatcher;
do $$ begin if eps.claim_job_outbox(1) is distinct from '{"leases":[]}'::jsonb then raise exception 'M02_CONCURRENT_DUPLICATE_LEASE'; end if; end $$;
reset role;
select jsonb_build_object('phase','returned','session_pid',pg_backend_pid(),'at',clock_timestamp(),'claimed_count',0);
commit;
