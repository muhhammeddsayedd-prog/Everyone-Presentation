begin;
set local application_name='eps_specs_revoke_a';
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' or not exists(select 1 from eps_local_guard.specs_local_fixture where id=1 and marker='EPS SPECS LOCAL V1') then raise exception 'LOCAL_TARGET_REQUIRED'; end if; end $$;
select pg_advisory_xact_lock(hashtextextended('7a720000-0000-4000-8000-000000000001:specs.create_role:specs-local-create',0));
select jsonb_build_object('phase','holding','session_pid',pg_backend_pid(),'at',clock_timestamp());
select pg_sleep(6);
update public.project_memberships set active=false where project_id='7b710000-0000-4000-8000-000000000001' and principal_id='7a720000-0000-4000-8000-000000000001';
commit;
