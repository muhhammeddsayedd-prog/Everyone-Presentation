begin read only;
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_TARGET_REQUIRED'; end if; end $$;
do $$ declare fixture eps_local_guard.role_order_fixture; begin
 select * into strict fixture from eps_local_guard.role_order_fixture where id=1 and marker='EPS ROLE ORDER LOCAL V1';
 if not exists(select 1 from eps.workspaces where id=fixture.workspace_id and row_version=23 and draft_revision=20 and has_unpublished_changes)
  or not exists(select 1 from eps.roles where id='7d940000-0000-4000-8000-000000000001' and sort_order=1 and row_version=2 and headcount is null)
  or not exists(select 1 from eps.roles where id='7d940000-0000-4000-8000-000000000002' and sort_order=0 and row_version=2)
  or not exists(select 1 from eps.roles where id='7d940000-0000-4000-8000-000000000003' and sort_order=2 and row_version=2 and name='Concurrent editor')
  or fixture.created_role_id is null or fixture.created_role is null or fixture.created_slot is null or (select count(*) from eps.roles where workspace_id=fixture.workspace_id)<>4
  or (select to_jsonb(role) from eps.roles role where id=fixture.created_role_id) is distinct from fixture.created_role
  or (select to_jsonb(slot) from eps.slots slot where role_id=fixture.created_role_id) is distinct from fixture.created_slot
  or (select jsonb_agg(to_jsonb(slot) order by id) from eps.slots slot where workspace_id=fixture.workspace_id and role_id<>fixture.created_role_id) is distinct from fixture.original_slots
  or (select jsonb_agg(to_jsonb(role)-array['sort_order','row_version','updated_at','name'] order by id) from eps.roles role where workspace_id=fixture.workspace_id and id<>fixture.created_role_id) is distinct from
    (select jsonb_agg(value-array['sort_order','row_version','updated_at','name'] order by value->>'id') from jsonb_array_elements(fixture.original_roles) value)
  or (select to_jsonb(spec) from eps.specs spec where workspace_id=fixture.workspace_id) is distinct from fixture.original_spec
  or (select count(*) from eps.audit_events where principal_id=fixture.principal_id)<>3
  or (select count(*) from eps.idempotency_records where principal_id=fixture.principal_id)<>3
  or not exists(select 1 from public.project_memberships where project_id=fixture.project_id and principal_id=fixture.principal_id and can_write and not active)
  or not exists(select 1 from eps.idempotency_records where principal_id=fixture.principal_id and operation='specs.reorder_workspace' and key='order-local-reorder' and response=fixture.reorder_response)
 then raise exception 'ROLE_ORDER_LOCAL_EFFECTS_INVALID'; end if;
end $$;
select jsonb_build_object('one_reorder',true,'editor_serialized',true,'new_role_preserved',true,'stale_reorder_no_effect',true,'revoked_cache_denied',true,'source_and_slots_preserved',true);
rollback;
