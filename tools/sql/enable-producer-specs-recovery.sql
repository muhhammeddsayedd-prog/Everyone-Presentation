-- Complete the real initial Producer's M02 recovery capability only.
-- Requester is derived from their actual successful app job, never supplied.
begin;
set local statement_timeout='10s';
set local search_path='';
lock table public.app_capability_grants in share row exclusive mode;
do $$ declare actor uuid; changed integer; begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941']::text[]
 then raise exception 'PRODUCER_SPECS_RECOVERY_TARGET_UNCONFIRMED'; end if;
 select j.requested_by into strict actor from eps.jobs j join eps.workspaces w on w.id=j.workspace_id join public.projects p on p.id=w.project_id
 where j.id='3ba110dd-711c-4c7f-aa89-0f4578310543' and j.kind='specs_extract' and j.status='succeeded'
  and j.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80' and w.project_id='4b70c8ce-18bd-4a8c-b5a9-bc1156c06463'
  and w.archived_at is null and p.archived_at is null;
 if not eps.job_requester_active(actor)
  or not exists(select 1 from public.project_memberships where project_id='4b70c8ce-18bd-4a8c-b5a9-bc1156c06463'
   and principal_id=actor and active and can_write)
  or (select count(*) from public.app_capability_grants where principal_id=actor and active
   and capability in('projects.read','projects.write','workspaces.read','workspaces.write'))<>4
  or exists(select 1 from public.app_capability_grants where principal_id=actor and capability='operations.retry')
 then raise exception 'PRODUCER_SPECS_RECOVERY_EXISTING_SCOPE_UNCONFIRMED'; end if;
 insert into public.app_capability_grants(principal_id,capability,active) values(actor,'operations.retry',true);
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'PRODUCER_SPECS_RECOVERY_UNCONFIRMED'; end if;
end $$;
select jsonb_build_object('capability','operations.retry','active',true,'new_grants',1,
 'auth_identity_created',false,'existing_memberships_changed',false,'inactive_grants_reactivated',false) as recovery;
commit;
