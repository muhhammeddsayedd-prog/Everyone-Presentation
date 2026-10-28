-- LOCAL-ONLY scoped cleanup, preserving any unexpected data rather than guessing ownership.
begin;
do $$ begin
  if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_FIXTURE_TARGET_REQUIRED'; end if;
  if not exists(select 1 from public.clients where id='eeeeeeee-3333-4333-8333-333333333333' and name='EPS LOCAL CONCURRENCY FIXTURE')
    or (select count(*) from public.projects where client_id='eeeeeeee-3333-4333-8333-333333333333')<>2
    or not exists(select 1 from public.projects where id='eeeeeeee-2222-4222-8222-222222222221' and client_id='eeeeeeee-3333-4333-8333-333333333333' and name='EPS LOCAL CONCURRENCY SAME KEY')
    or not exists(select 1 from public.projects where id='eeeeeeee-2222-4222-8222-222222222222' and client_id='eeeeeeee-3333-4333-8333-333333333333' and name='EPS LOCAL CONCURRENCY DIFFERENT KEYS')
    or exists(select 1 from eps.media_assets where origin_workspace_id in(select id from eps.workspaces where project_id in ('eeeeeeee-2222-4222-8222-222222222221','eeeeeeee-2222-4222-8222-222222222222')))
  then raise exception 'CONCURRENCY_FIXTURE_OWNERSHIP_MISMATCH_PRESERVE_DATA'; end if;
end $$;
delete from eps.user_workspace_preferences where workspace_id in(select id from eps.workspaces where project_id in ('eeeeeeee-2222-4222-8222-222222222221','eeeeeeee-2222-4222-8222-222222222222'));
delete from eps.audit_events where principal_id='eeeeeeee-1111-4111-8111-111111111111';
delete from eps.idempotency_records where principal_id='eeeeeeee-1111-4111-8111-111111111111';
delete from eps.workspaces where project_id in ('eeeeeeee-2222-4222-8222-222222222221','eeeeeeee-2222-4222-8222-222222222222');
delete from public.project_memberships where project_id in ('eeeeeeee-2222-4222-8222-222222222221','eeeeeeee-2222-4222-8222-222222222222');
delete from public.app_capability_grants where principal_id='eeeeeeee-1111-4111-8111-111111111111';
delete from public.projects where id in ('eeeeeeee-2222-4222-8222-222222222221','eeeeeeee-2222-4222-8222-222222222222');
delete from public.clients where id='eeeeeeee-3333-4333-8333-333333333333';
delete from auth.users where id='eeeeeeee-1111-4111-8111-111111111111';
commit;
