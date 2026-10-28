begin;
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_TARGET_REQUIRED'; end if; end $$;
set local application_name='eps_order_revoke_a';
select pg_advisory_xact_lock(hashtextextended('7a940000-0000-4000-8000-000000000001:specs.reorder_workspace:order-local-reorder',0));
select jsonb_build_object('phase','holding','session_pid',pg_backend_pid(),'at',clock_timestamp());
select pg_sleep(6);
update public.project_memberships set active=false where project_id='7b940000-0000-4000-8000-000000000001' and principal_id='7a940000-0000-4000-8000-000000000001';
commit;
