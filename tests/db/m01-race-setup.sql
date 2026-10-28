-- LOCAL-ONLY committed synthetic fixture for concurrent independent sessions.
begin;
do $$ begin
  if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_FIXTURE_TARGET_REQUIRED'; end if;
  if exists(select 1 from auth.users where id='eeeeeeee-1111-4111-8111-111111111111')
    or exists(select 1 from public.clients where id='eeeeeeee-3333-4333-8333-333333333333')
    or exists(select 1 from public.projects where id in ('eeeeeeee-2222-4222-8222-222222222221','eeeeeeee-2222-4222-8222-222222222222'))
  then raise exception 'CONCURRENCY_FIXTURE_COLLISION_PRESERVE_EXISTING_DATA'; end if;
end $$;
insert into auth.users(id) values('eeeeeeee-1111-4111-8111-111111111111');
insert into public.clients(id,name) values('eeeeeeee-3333-4333-8333-333333333333','EPS LOCAL CONCURRENCY FIXTURE');
insert into public.projects(id,client_id,name) values
 ('eeeeeeee-2222-4222-8222-222222222221','eeeeeeee-3333-4333-8333-333333333333','EPS LOCAL CONCURRENCY SAME KEY'),
 ('eeeeeeee-2222-4222-8222-222222222222','eeeeeeee-3333-4333-8333-333333333333','EPS LOCAL CONCURRENCY DIFFERENT KEYS');
insert into public.project_memberships(project_id,principal_id,can_write) values
 ('eeeeeeee-2222-4222-8222-222222222221','eeeeeeee-1111-4111-8111-111111111111',true),
 ('eeeeeeee-2222-4222-8222-222222222222','eeeeeeee-1111-4111-8111-111111111111',true);
insert into public.app_capability_grants(principal_id,capability)
 select 'eeeeeeee-1111-4111-8111-111111111111'::uuid,x from unnest(array['projects.read','workspaces.read','workspaces.write']) x;
commit;
