begin;
set local application_name='eps_m02_finish_a';
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' or not exists(select 1 from eps_local_guard.m02_fixture where id=1 and marker='EPS M02 LOCAL DURABILITY V1') then raise exception 'LOCAL_TARGET_REQUIRED'; end if; end $$;
select set_config('eps.m02.event',(select event.id::text from eps.outbox_events event join eps.jobs job on job.id=event.job_id where job.workspace_id='7c111111-1111-4111-8111-111111111111' and job.resource_id='7d555555-5555-4555-8555-555555555555'),true);
select jsonb_build_object('phase','started','session_pid',pg_backend_pid(),'at',clock_timestamp());
set local role eps_jobs_dispatcher;
do $$ begin
 if eps.finish_job_outbox(current_setting('eps.m02.event')::uuid,convert_from(decode('__EPS_M02_TOKEN_HEX__','hex'),'UTF8'),true) is distinct from '{"acknowledged":true,"stale":false}'::jsonb
 then raise exception 'M02_FINISH_FIRST_NOT_ACCEPTED'; end if;
end $$;
reset role;
select jsonb_build_object('phase','returned','session_pid',pg_backend_pid(),'at',clock_timestamp());
select jsonb_build_object('phase','holding','session_pid',pg_backend_pid(),'at',clock_timestamp());
select pg_sleep(4);
commit;
