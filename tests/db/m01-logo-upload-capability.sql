-- LOCAL SQL metadata/scope proof only. No emails, provider token, key or bytes.
begin;
do $$ begin
  if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
    or current_database()<>'postgres' then raise exception 'LOCAL_FIXTURE_TARGET_REQUIRED'; end if;
end $$;
create function pg_temp.assert_logo_purpose(condition boolean,label text) returns void language plpgsql as $$ begin
  if condition is distinct from true then raise exception 'ASSERTION_FAILED: %',label; end if;
end $$;
create function pg_temp.logo_purpose_user(subject uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub',subject::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated','is_anonymous',false)::text,true);
end $$;
create function pg_temp.logo_purpose_denied(target uuid,expected text) returns void language plpgsql as $$ begin
  begin
    perform public.eps_reserve_logo_upload(jsonb_build_object('workspace_id',target,'purpose','client_logo',
      'filename','synthetic-capability.png','mime_type','image/png','size_bytes',1234),'synthetic-capability-denied');
  exception when others then
    if sqlerrm=expected then return; end if; raise;
  end;
  raise exception 'TARGET_RESERVATION_SHOULD_HAVE_FAILED';
end $$;

insert into auth.users(id) values('abababab-1111-4111-8111-111111111111'),('abababab-1111-4111-8111-111111111112');
insert into public.projects(id,name) values
  ('abababab-2222-4222-8222-222222222221','Synthetic writable capability project'),
  ('abababab-2222-4222-8222-222222222222','Synthetic read-only capability project'),
  ('abababab-2222-4222-8222-222222222223','Synthetic denied capability project');
insert into eps.workspaces(id,project_id) values
  ('abababab-3333-4333-8333-333333333331','abababab-2222-4222-8222-222222222221'),
  ('abababab-3333-4333-8333-333333333332','abababab-2222-4222-8222-222222222222'),
  ('abababab-3333-4333-8333-333333333333','abababab-2222-4222-8222-222222222223');
insert into public.project_memberships(project_id,principal_id,can_write) values
  ('abababab-2222-4222-8222-222222222221','abababab-1111-4111-8111-111111111111',true),
  ('abababab-2222-4222-8222-222222222222','abababab-1111-4111-8111-111111111111',false);
insert into public.app_capability_grants(principal_id,capability)
  select actor,capability from unnest(array['abababab-1111-4111-8111-111111111111'::uuid,'abababab-1111-4111-8111-111111111112'::uuid]) actor
  cross join unnest(array['projects.read','workspaces.read','workspaces.write']) capability;

set local role authenticated;
select pg_temp.logo_purpose_user('abababab-1111-4111-8111-111111111111');
select pg_temp.assert_logo_purpose(public.eps_get_capabilities()->'upload_policy'->'available_purposes'='["client_logo"]'::jsonb,'ordinary writable scoped contributor sees implemented purpose');
select pg_temp.assert_logo_purpose(not(public.eps_get_capabilities()->'capabilities'?'projects.write'),'shared-project write is not needed for personal workspace logo');
select pg_temp.assert_logo_purpose(public.eps_get_capabilities()::text !~* '(token|secret|payload|key_id|verification)','capability metadata contains no transfer or verification material');
-- Advertising some usable scope never grants every target to this actor.
select pg_temp.logo_purpose_denied('abababab-3333-4333-8333-333333333332','RESOURCE_NOT_FOUND');
select pg_temp.logo_purpose_denied('abababab-3333-4333-8333-333333333333','RESOURCE_NOT_FOUND');
select pg_temp.assert_logo_purpose(public.eps_reserve_logo_upload(
  '{"workspace_id":"abababab-3333-4333-8333-333333333331","purpose":"client_logo","filename":"synthetic-capability.png","mime_type":"image/png","size_bytes":1234}',
  'synthetic-capability-allowed')->>'status'='open','normal scoped reservation succeeds without a principal-specific bypass');

select pg_temp.logo_purpose_user('abababab-1111-4111-8111-111111111112');
select set_config('request.headers','{"x-eps-client-type":"mcp","principal_id":"abababab-1111-4111-8111-111111111111"}',true);
select pg_temp.assert_logo_purpose(public.eps_get_capabilities()->'upload_policy'->'available_purposes'='[]'::jsonb,'global grants and claimed MCP principal do not replace membership');
select pg_temp.logo_purpose_denied('abababab-3333-4333-8333-333333333331','RESOURCE_NOT_FOUND');
select pg_temp.logo_purpose_user('abababab-1111-4111-8111-111111111111');
reset role;
update public.app_capability_grants set active=false where principal_id='abababab-1111-4111-8111-111111111111' and capability='workspaces.write';
set local role authenticated;
select pg_temp.assert_logo_purpose(public.eps_get_capabilities()->'upload_policy'->'available_purposes'='[]'::jsonb,'inactive workspace write hides purpose');
select pg_temp.logo_purpose_denied('abababab-3333-4333-8333-333333333331','CAPABILITY_REQUIRED');
reset role;
update public.app_capability_grants set active=true where principal_id='abababab-1111-4111-8111-111111111111' and capability='workspaces.write';
update public.app_capability_grants set active=false where principal_id='abababab-1111-4111-8111-111111111111' and capability='workspaces.read';
set local role authenticated;
select pg_temp.assert_logo_purpose(public.eps_get_capabilities()->'upload_policy'->'available_purposes'='[]'::jsonb,'inactive workspace read hides purpose');
reset role;
update public.app_capability_grants set active=true where principal_id='abababab-1111-4111-8111-111111111111' and capability='workspaces.read';
update public.project_memberships set can_write=false where project_id='abababab-2222-4222-8222-222222222221' and principal_id='abababab-1111-4111-8111-111111111111';
set local role authenticated;
select pg_temp.assert_logo_purpose(public.eps_get_capabilities()->'upload_policy'->'available_purposes'='[]'::jsonb,'read-only memberships do not advertise upload authority');
reset role;
update public.project_memberships set can_write=true where project_id='abababab-2222-4222-8222-222222222221' and principal_id='abababab-1111-4111-8111-111111111111';
update public.projects set archived_at=clock_timestamp() where id='abababab-2222-4222-8222-222222222221';
set local role authenticated;
select pg_temp.assert_logo_purpose(public.eps_get_capabilities()->'upload_policy'->'available_purposes'='[]'::jsonb,'archived canonical scope cannot advertise uploads');
reset role;
select 'Scoped logo capability metadata assertions passed; all synthetic records roll back. Frontend readiness intersection remains separately SDK-tested.' as result;
rollback;
