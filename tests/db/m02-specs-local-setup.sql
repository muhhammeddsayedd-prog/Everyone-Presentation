begin;
do $$ begin
 if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
   or not exists(select 1 from eps_local_guard.specs_local_fixture where id=1 and marker='EPS SPECS LOCAL V1')
   or exists(select 1 from auth.users where id='7a720000-0000-4000-8000-000000000001')
   or not exists(select 1 from eps.workspaces where id='7c710000-0000-4000-8000-000000000001' and row_version=19 and draft_revision=17)
   or (select count(*) from eps.specs where workspace_id='7c710000-0000-4000-8000-000000000001' and row_version=1 and source_text is null and source_asset_id is null and processing_job_id is null)<>1
 then raise exception 'SPECS_LOCAL_BACKFILL_NOT_ESTABLISHED'; end if;
end $$;
insert into auth.users(id) values('7a720000-0000-4000-8000-000000000001');
insert into public.project_memberships(project_id,principal_id,can_write) values('7b710000-0000-4000-8000-000000000001','7a720000-0000-4000-8000-000000000001',true);
insert into public.app_capability_grants(principal_id,capability)
 select '7a720000-0000-4000-8000-000000000001'::uuid,capability from unnest(array['projects.read','workspaces.read','workspaces.write']) capability;
commit;
