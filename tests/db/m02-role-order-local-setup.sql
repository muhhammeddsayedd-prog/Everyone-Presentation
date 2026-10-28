-- Committed owned-local fixture. No email, provider, source extraction or bytes.
begin;
do $$ begin
 if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
  or to_regclass('eps_local_guard.role_order_fixture') is not null
  or exists(select 1 from auth.users where id='7a940000-0000-4000-8000-000000000001')
  or exists(select 1 from public.projects where id='7b940000-0000-4000-8000-000000000001')
  or exists(select 1 from eps.workspaces where id='7c940000-0000-4000-8000-000000000001')
  or exists(select 1 from eps.roles where id::text like '7d940000-%')
  or exists(select 1 from eps.slots where id::text like '7e940000-%')
 then raise exception 'ROLE_ORDER_LOCAL_COLLISION_PRESERVE_DATA'; end if;
end $$;
create table eps_local_guard.role_order_fixture(
 id integer primary key check(id=1),marker text not null check(marker='EPS ROLE ORDER LOCAL V1'),
 principal_id uuid not null,project_id uuid not null,workspace_id uuid not null,
 requirements jsonb not null,reorder_input jsonb not null,reorder_response jsonb,
 original_roles jsonb,original_slots jsonb,original_spec jsonb,
 created_role_id uuid,created_role jsonb,created_slot jsonb
);
revoke all on eps_local_guard.role_order_fixture from public,anon,authenticated,service_role,eps_api_owner,eps_specs_owner,eps_specs_initializer,eps_logo_verify_owner,eps_jobs_owner,eps_jobs_dispatcher;
insert into auth.users(id) values('7a940000-0000-4000-8000-000000000001');
insert into public.projects(id,name) values('7b940000-0000-4000-8000-000000000001','EPS ROLE ORDER LOCAL V1');
insert into eps.workspaces(id,project_id,row_version,draft_revision,has_unpublished_changes)
 values('7c940000-0000-4000-8000-000000000001','7b940000-0000-4000-8000-000000000001',20,17,false);
insert into public.project_memberships(project_id,principal_id,can_write) values('7b940000-0000-4000-8000-000000000001','7a940000-0000-4000-8000-000000000001',true);
insert into public.app_capability_grants(principal_id,capability)
 select '7a940000-0000-4000-8000-000000000001'::uuid,capability from unnest(array['projects.read','workspaces.write']) capability;
insert into eps.user_workspace_preferences(principal_id,workspace_id,active_output)
 values('7a940000-0000-4000-8000-000000000001','7c940000-0000-4000-8000-000000000001','shortlist');
insert into eps_local_guard.role_order_fixture(id,marker,principal_id,project_id,workspace_id,requirements,reorder_input)
 values(1,'EPS ROLE ORDER LOCAL V1','7a940000-0000-4000-8000-000000000001','7b940000-0000-4000-8000-000000000001','7c940000-0000-4000-8000-000000000001',
 '{"age_range":null,"gender_requirement":null,"appearance_performance":null,"languages":[],"accents":[],"skills":[],"scene_references":[],"shoot_dates":[],"location":null,"availability_requirements":null,"other_instructions":null}',
 '{"row_version":20,"role_ids":["7d940000-0000-4000-8000-000000000002","7d940000-0000-4000-8000-000000000001","7d940000-0000-4000-8000-000000000003"]}');
insert into eps.roles(id,workspace_id,spec_id,name,headcount,requirements,source_role,sort_order)
 select ('7d940000-0000-4000-8000-'||lpad(number::text,12,'0'))::uuid,fixture.workspace_id,spec.id,'Original '||chr(64+number),
  case when number=1 then null else 1 end,fixture.requirements,jsonb_build_object('synthetic_original',number),number-1
 from generate_series(1,3) number cross join eps_local_guard.role_order_fixture fixture join eps.specs spec on spec.workspace_id=fixture.workspace_id;
insert into eps.slots(id,workspace_id,role_id,ordinal,label,sort_order,provisional)
 select ('7e940000-0000-4000-8000-'||lpad(number::text,12,'0'))::uuid,'7c940000-0000-4000-8000-000000000001',
  ('7d940000-0000-4000-8000-'||lpad(number::text,12,'0'))::uuid,1,'Original slot '||number,0,number=1 from generate_series(1,3) number;
update eps_local_guard.role_order_fixture fixture set
 original_roles=(select jsonb_agg(to_jsonb(role) order by id) from eps.roles role where role.workspace_id=fixture.workspace_id),
 original_slots=(select jsonb_agg(to_jsonb(slot) order by id) from eps.slots slot where slot.workspace_id=fixture.workspace_id),
 original_spec=(select to_jsonb(spec) from eps.specs spec where spec.workspace_id=fixture.workspace_id) where fixture.id=1;
commit;
