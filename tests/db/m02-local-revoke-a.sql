-- Hold the exact cached enqueue key while another backend begins authorized.
begin;
set local application_name='eps_m02_revoke_a';
set local statement_timeout='10s'; set local lock_timeout='7s';
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' or not exists(select 1 from eps_local_guard.m02_fixture where id=1 and marker='EPS M02 LOCAL DURABILITY V1') then raise exception 'LOCAL_TARGET_REQUIRED'; end if; end $$;
select pg_advisory_xact_lock(hashtextextended('7a111111-1111-4111-8111-111111111111:jobs.enqueue:m02-local-enqueue-a',0));
select jsonb_build_object('phase','holding','session_pid',pg_backend_pid(),'at',clock_timestamp());
select pg_sleep(4);
update public.project_memberships set active=false where principal_id='7a111111-1111-4111-8111-111111111111' and project_id='7b111111-1111-4111-8111-111111111111';
commit;
