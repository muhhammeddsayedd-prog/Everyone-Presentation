-- Delete only the exact owned fixture. Unknown sources/identities are preserved.
begin;
set local application_name='eps_order_cleanup_b';
set local lock_timeout='10s';
do $$ declare fixture eps_local_guard.role_order_fixture; orders bigint; edits bigint; creates bigint; begin
 if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_TARGET_REQUIRED'; end if;
 select * into strict fixture from eps_local_guard.role_order_fixture where id=1 and marker='EPS ROLE ORDER LOCAL V1';
 perform 1 from eps.workspaces where id=fixture.workspace_id for update;
 perform 1 from eps.specs where workspace_id=fixture.workspace_id order by id for update;
 perform 1 from eps.roles where workspace_id=fixture.workspace_id order by id for update;
 perform 1 from eps.slots where workspace_id=fixture.workspace_id order by id for update;
 if fixture.principal_id<>'7a940000-0000-4000-8000-000000000001' or fixture.project_id<>'7b940000-0000-4000-8000-000000000001'
  or fixture.workspace_id<>'7c940000-0000-4000-8000-000000000001' or (select count(*) from eps_local_guard.role_order_fixture)<>1
  or not exists(select 1 from public.projects where id=fixture.project_id and name='EPS ROLE ORDER LOCAL V1' and client_id is null and row_version=1 and archived_at is null)
  or (select count(*) from eps.workspaces where project_id=fixture.project_id)<>1
  or not exists(select 1 from auth.users where id=fixture.principal_id and email is null)
  or exists(select 1 from eps.media_assets where origin_workspace_id=fixture.workspace_id)
  or exists(select 1 from eps.upload_sessions where workspace_id=fixture.workspace_id or principal_id=fixture.principal_id)
  or exists(select 1 from eps.jobs where workspace_id=fixture.workspace_id or requested_by=fixture.principal_id)
  or exists(select 1 from public.client_memberships where principal_id=fixture.principal_id)
 then raise exception 'ROLE_ORDER_LOCAL_OWNERSHIP_MISMATCH_PRESERVE_DATA'; end if;
 if (select count(*) from eps.specs where workspace_id=fixture.workspace_id)<>1
  or (select to_jsonb(spec) from eps.specs spec where workspace_id=fixture.workspace_id) is distinct from fixture.original_spec
 then raise exception 'ROLE_ORDER_LOCAL_SOURCE_PRESERVATION_REQUIRED'; end if;
 select count(*) into orders from eps.audit_events where principal_id=fixture.principal_id and action='specs.reorder_workspace';
 select count(*) into edits from eps.audit_events where principal_id=fixture.principal_id and action='specs.update_role';
 select count(*) into creates from eps.audit_events where principal_id=fixture.principal_id and action='specs.create_role';
 if orders not between 0 and 1 or edits not between 0 and 1 or creates not between 0 and 1
  or not exists(select 1 from eps.workspaces where id=fixture.workspace_id and project_id=fixture.project_id and logo_asset_id is null and archived_at is null
   and row_version=20+orders+edits+creates and draft_revision=17+orders+edits+creates and has_unpublished_changes=(orders+edits+creates>0))
  or (select count(*) from eps.audit_events where principal_id=fixture.principal_id)<>orders+edits+creates
  or exists(select 1 from eps.audit_events where principal_id=fixture.principal_id and not(
   action='specs.reorder_workspace' and resource_id=fixture.workspace_id or action='specs.update_role' and resource_id='7d940000-0000-4000-8000-000000000003'
   or action='specs.create_role' and resource_id=fixture.created_role_id))
  or (select count(*) from eps.idempotency_records where principal_id=fixture.principal_id)<>orders+edits+creates
  or exists(select 1 from eps.idempotency_records where principal_id=fixture.principal_id and not(
   operation='specs.reorder_workspace' and key='order-local-reorder' or operation='specs.update_role' and key='order-local-edit'
   or operation='specs.create_role' and key='order-local-create'))
 then raise exception 'ROLE_ORDER_LOCAL_EFFECT_OWNERSHIP_MISMATCH_PRESERVE_DATA'; end if;
 if (select count(*) from eps.roles where workspace_id=fixture.workspace_id)<>3+creates
  or not exists(select 1 from eps.roles where id='7d940000-0000-4000-8000-000000000001' and workspace_id=fixture.workspace_id and name='Original A' and sort_order=orders and row_version=1+orders and archived_at is null)
  or not exists(select 1 from eps.roles where id='7d940000-0000-4000-8000-000000000002' and workspace_id=fixture.workspace_id and name='Original B' and sort_order=1-orders and row_version=1+orders and archived_at is null)
  or not exists(select 1 from eps.roles where id='7d940000-0000-4000-8000-000000000003' and workspace_id=fixture.workspace_id and name=case when edits=1 then 'Concurrent editor' else 'Original C' end and sort_order=2 and row_version=1+edits and archived_at is null)
  or (select jsonb_agg(to_jsonb(role)-array['sort_order','row_version','updated_at','name'] order by id) from eps.roles role where workspace_id=fixture.workspace_id and id in('7d940000-0000-4000-8000-000000000001','7d940000-0000-4000-8000-000000000002','7d940000-0000-4000-8000-000000000003')) is distinct from
   (select jsonb_agg(value-array['sort_order','row_version','updated_at','name'] order by value->>'id') from jsonb_array_elements(fixture.original_roles) value)
  or (creates=0 and (fixture.created_role_id is not null or fixture.created_role is not null or fixture.created_slot is not null))
  or (creates=1 and (fixture.created_role_id is null or fixture.created_role is null or fixture.created_slot is null
   or (select to_jsonb(role) from eps.roles role where id=fixture.created_role_id and workspace_id=fixture.workspace_id) is distinct from fixture.created_role))
  or (select count(*) from eps.slots where workspace_id=fixture.workspace_id)<>3+creates
  or (select jsonb_agg(to_jsonb(slot) order by id) from eps.slots slot where workspace_id=fixture.workspace_id and role_id in('7d940000-0000-4000-8000-000000000001','7d940000-0000-4000-8000-000000000002','7d940000-0000-4000-8000-000000000003')) is distinct from fixture.original_slots
  or (creates=1 and (select to_jsonb(slot) from eps.slots slot where role_id=fixture.created_role_id) is distinct from fixture.created_slot)
 then raise exception 'ROLE_ORDER_LOCAL_UNKNOWN_ROLE_SLOT_PRESERVE_DATA'; end if;
 if (select count(*) from public.project_memberships where project_id=fixture.project_id or principal_id=fixture.principal_id)<>1
  or not exists(select 1 from public.project_memberships where project_id=fixture.project_id and principal_id=fixture.principal_id and can_write)
  or (select count(*) from public.app_capability_grants where principal_id=fixture.principal_id)<>2
  or exists(select 1 from public.app_capability_grants where principal_id=fixture.principal_id and (not active or capability not in('projects.read','workspaces.write')))
  or (select count(*) from eps.user_workspace_preferences where principal_id=fixture.principal_id or workspace_id=fixture.workspace_id)<>1
  or not exists(select 1 from eps.user_workspace_preferences where principal_id=fixture.principal_id and workspace_id=fixture.workspace_id and active_output='shortlist')
 then raise exception 'ROLE_ORDER_LOCAL_UNKNOWN_AUTH_PREFERENCES_PRESERVE_DATA'; end if;
 delete from eps.audit_events where principal_id=fixture.principal_id;
 delete from eps.idempotency_records where principal_id=fixture.principal_id;
 delete from eps.slots where workspace_id=fixture.workspace_id;
 delete from eps.roles where workspace_id=fixture.workspace_id;
 delete from eps.specs where workspace_id=fixture.workspace_id;
 delete from eps.user_workspace_preferences where principal_id=fixture.principal_id and workspace_id=fixture.workspace_id;
 delete from eps.workspaces where id=fixture.workspace_id;
 delete from public.project_memberships where project_id=fixture.project_id and principal_id=fixture.principal_id;
 delete from public.app_capability_grants where principal_id=fixture.principal_id;
 delete from public.projects where id=fixture.project_id;
 delete from auth.users where id=fixture.principal_id;
end $$;
drop table eps_local_guard.role_order_fixture;
commit;
