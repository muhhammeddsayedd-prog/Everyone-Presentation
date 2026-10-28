begin;
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' or not exists(select 1 from eps_local_guard.m02_fixture where id=1 and marker='EPS M02 LOCAL DURABILITY V1') or exists(select 1 from eps.outbox_events where status in('pending','leased')) then raise exception 'M02_FINISH_RACE_FIXTURE_INVALID'; end if; end $$;
select set_config('request.jwt.claim.sub','7a111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"7a111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
select set_config('eps.m02.input',(select jsonb_set(input,'{specs_id}','"7d555555-5555-4555-8555-555555555555"')::text from eps_local_guard.m02_fixture),true);
set local role eps_jobs_owner;
do $$ declare job jsonb; begin job:=eps.m02_enqueue_specs_job('7c111111-1111-4111-8111-111111111111',current_setting('eps.m02.input')::jsonb,'m02-local-finish-prepare'); perform set_config('eps.m02.newjob',job->>'id',true); end $$;
reset role;
set local role eps_jobs_dispatcher;
do $$ declare claimed jsonb; begin
 claimed:=eps.claim_job_outbox(1);
 if jsonb_array_length(claimed->'leases')<>1 or claimed->'leases'->0->'envelope'->>'job_id' is distinct from current_setting('eps.m02.newjob') then raise exception 'M02_FINISH_RACE_LEASE_INVALID'; end if;
 perform set_config('eps.m02.private_claim',claimed::text,true);
end $$;
reset role;
select jsonb_build_object('phase','private_lease','session_pid',pg_backend_pid(),'lease',current_setting('eps.m02.private_claim')::jsonb->'leases'->0);
commit;
