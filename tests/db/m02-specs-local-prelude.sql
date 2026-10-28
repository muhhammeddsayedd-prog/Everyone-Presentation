-- Committed pre-DDL local fixture. No Auth principal, source or provider.
begin;
do $$ begin
 if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
   or not exists(select 1 from eps_local_guard.instance where id=1) then raise exception 'LOCAL_TARGET_REQUIRED'; end if;
 if to_regclass('eps_local_guard.specs_local_fixture') is not null
   or exists(select 1 from public.projects where id='7b710000-0000-4000-8000-000000000001')
   or exists(select 1 from eps.workspaces where id='7c710000-0000-4000-8000-000000000001')
   or exists(select 1 from auth.users where id='7a720000-0000-4000-8000-000000000001')
 then raise exception 'SPECS_LOCAL_COLLISION_PRESERVE_DATA'; end if;
end $$;
create table eps_local_guard.specs_local_fixture(
 id integer primary key check(id=1), marker text not null check(marker='EPS SPECS LOCAL V1'),
 project_id uuid not null, workspace_id uuid not null, principal_id uuid not null, role_id uuid,
 role_input jsonb not null, created_at timestamptz not null default clock_timestamp()
);
revoke all on eps_local_guard.specs_local_fixture from public,anon,authenticated,service_role,eps_api_owner,eps_jobs_owner,eps_jobs_dispatcher;
insert into public.projects(id,name) values('7b710000-0000-4000-8000-000000000001','Synthetic specs backfill fixture');
insert into eps.workspaces(id,project_id,row_version,draft_revision,has_unpublished_changes)
 values('7c710000-0000-4000-8000-000000000001','7b710000-0000-4000-8000-000000000001',19,17,true);
insert into eps_local_guard.specs_local_fixture(id,marker,project_id,workspace_id,principal_id,role_input)
 values(1,'EPS SPECS LOCAL V1','7b710000-0000-4000-8000-000000000001','7c710000-0000-4000-8000-000000000001','7a720000-0000-4000-8000-000000000001',
 '{"name":"Synthetic manual role","headcount":3,"requirements":{"age_range":null,"gender_requirement":null,"appearance_performance":null,"languages":[],"accents":[],"skills":[],"scene_references":["1","3"],"shoot_dates":[],"location":null,"availability_requirements":null,"other_instructions":null}}');
commit;
