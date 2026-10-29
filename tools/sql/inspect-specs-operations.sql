-- Fixed read-only inspection of the genuine first successful job's requester.
-- No Auth rows, email, source, output, tokens or capability/membership writes.
begin read only;
set local statement_timeout='10s';
set local search_path='';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941']::text[]
  or not exists(select 1 from eps.jobs where id='3ba110dd-711c-4c7f-aa89-0f4578310543'
   and workspace_id='098d5b48-42a3-475b-b562-735c9eafce80' and kind='specs_extract' and status='succeeded')
 then raise exception 'SPEC_OPERATIONS_FIXED_REQUESTER_UNCONFIRMED'; end if;
end $$;
with requester as (
 select j.requested_by,w.id workspace_id,w.project_id from eps.jobs j join eps.workspaces w on w.id=j.workspace_id
 where j.id='3ba110dd-711c-4c7f-aa89-0f4578310543' and w.id='098d5b48-42a3-475b-b562-735c9eafce80'
), statuses as (
 select capability,case when not exists(select 1 from public.app_capability_grants g,requester r where g.principal_id=r.requested_by and g.capability=required.capability)
  then 'absent' when exists(select 1 from public.app_capability_grants g,requester r where g.principal_id=r.requested_by and g.capability=required.capability and g.active)
  then 'active' else 'inactive' end status
 from unnest(array['operations.read','operations.retry','projects.read','workspaces.read','workspaces.write']) required(capability)
)
select jsonb_build_object('query_role',current_user,'database',current_database(),'job_id','3ba110dd-711c-4c7f-aa89-0f4578310543',
 'requester_found',(select count(*)=1 from requester),
 'requester_currently_active',(select eps.job_requester_active(requested_by) from requester),
 'capability_status',(select jsonb_object_agg(capability,status order by capability) from statuses),
 'project_membership',(select jsonb_build_object('present',exists(select 1 from public.project_memberships m where m.project_id=r.project_id and m.principal_id=r.requested_by),
  'active',exists(select 1 from public.project_memberships m where m.project_id=r.project_id and m.principal_id=r.requested_by and m.active),
  'can_write',exists(select 1 from public.project_memberships m where m.project_id=r.project_id and m.principal_id=r.requested_by and m.active and m.can_write)) from requester r),
 'writes_requested',false) as operations;
rollback;
