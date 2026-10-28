-- REVIEW CANDIDATE ONLY: parent owns BEGIN/ROLLBACK and the exact eight-version
-- local target. Never run standalone or copy into cloud migration history.
-- Role ordering only. Original evidence, slot identity/order, assignments,
-- processing and ready versions are untouched.
-- Sources: https://www.postgresql.org/docs/17/explicit-locking.html
-- https://supabase.com/docs/guides/database/functions
set local lock_timeout='5s';
set local statement_timeout='30s';
set local search_path='';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or current_setting('eps.role_order_candidate_rehearsal',true) is distinct from 'rollback-only-v1'
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320']::text[]
  or to_regprocedure('public.eps_reorder_workspace(uuid,jsonb,text)') is not null
  or to_regprocedure('eps.specs_order_workspace_dto(uuid)') is not null
  or exists(select 1 from pg_policy where polname in('specs_order_replay_read','specs_order_replay_insert','specs_order_audit'))
 then raise exception 'ROLE_ORDER_REVIEWED_EIGHT_VERSION_ROLLBACK_REQUIRED'; end if;
end $$;

grant update(sort_order) on eps.roles to eps_specs_owner;
create policy specs_order_replay_read on eps.idempotency_records for select to eps_specs_owner
 using(principal_id=auth.uid() and operation='specs.reorder_workspace');
create policy specs_order_replay_insert on eps.idempotency_records for insert to eps_specs_owner
 with check(principal_id=auth.uid() and operation='specs.reorder_workspace');
create policy specs_order_audit on eps.audit_events for insert to eps_specs_owner
 with check(principal_id=auth.uid() and action='specs.reorder_workspace' and eps.specs_scope(resource_id,true));

-- Existing API owner reads the public Workspace projection only after a current
-- write-scope check. The manual owner gets no branding/preferences table grants.
create function eps.specs_order_workspace_dto(p_workspace_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare result jsonb; begin
 perform eps.require_capability('workspaces.write');
 if not exists(select 1 from eps.workspaces workspace where workspace.id=p_workspace_id and workspace.archived_at is null
   and eps.project_scope(workspace.project_id,true)) then
  perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404);
 end if;
 result:=eps.workspace_dto(p_workspace_id);
 if result is null then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 return result;
end $$;

create function public.eps_reorder_workspace(p_workspace_id uuid,p_input jsonb,p_idempotency_key text default null) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare expected bigint; current_version bigint; current_draft bigint; requested uuid[]; active_ids uuid[]; current_order uuid[];
 payload jsonb; cached jsonb; result jsonb; expected_changes bigint:=0; changed bigint;
 headers jsonb:='{}'; request_id text; client_type text; map_name text; map_item record;
begin
 perform eps.require_capability('workspaces.write');
 perform eps.specs_check_body(p_input,array['row_version','role_ids','slot_ids_by_role','assignment_ids_by_slot']);
 expected:=eps.expected_version(p_input);
 foreach map_name in array array['slot_ids_by_role','assignment_ids_by_slot'] loop
  if p_input?map_name then
   if jsonb_typeof(p_input->map_name) is distinct from 'object' then
    perform eps.fail('INVALID_REQUEST','Order maps must contain identifier arrays.',400);
   end if;
   for map_item in select key,value from jsonb_each(p_input->map_name) loop
    if length(map_item.key) not between 1 and 200 or jsonb_typeof(map_item.value) is distinct from 'array' then
     perform eps.fail('INVALID_REQUEST','Order maps require bounded identifiers and arrays.',400);
    end if;
    if exists(select 1 from jsonb_array_elements(map_item.value) value
      where jsonb_typeof(value)<>'string' or length(value#>>'{}') not between 1 and 200) then
     perform eps.fail('INVALID_REQUEST','Order maps contain only bounded identifiers.',400);
    end if;
   end loop;
  end if;
 end loop;
 if p_input?'role_ids' then
  if jsonb_typeof(p_input->'role_ids') is distinct from 'array'
    or exists(select 1 from jsonb_array_elements(p_input->'role_ids') value where jsonb_typeof(value)<>'string' or length(value#>>'{}') not between 1 and 200) then
   perform eps.fail('INVALID_REQUEST','Role order must be an array of identifiers.',400);
  end if;
 end if;
 -- Validate the complete public shape before reporting an unsupported feature.
 -- UUID/permutation semantics belong only to the supported role-only branch.
 if p_input?'slot_ids_by_role' or p_input?'assignment_ids_by_slot' then
  perform eps.fail('FEATURE_NOT_IMPLEMENTED','Slot and assignment ordering are not available in this role-only operation.',503);
 end if;
 if p_input?'role_ids' then
  select coalesce(array_agg(eps.input_uuid(value) order by ordinality),array[]::uuid[]) into requested
   from jsonb_array_elements_text(p_input->'role_ids') with ordinality entries(value,ordinality);
  if cardinality(requested)<>(select count(distinct id) from unnest(requested) id) then
   perform eps.fail('ROLE_ORDER_INVALID','Every active role must appear exactly once.',409);
  end if;
 end if;
 if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 payload:=jsonb_build_object('id',p_workspace_id,'input',p_input);
 cached:=eps.idempotency_begin('specs.reorder_workspace',p_idempotency_key,payload);
 perform eps.specs_lock_workspace(p_workspace_id);
 perform 1 from eps.roles where workspace_id=p_workspace_id order by id for update;
 -- Separate commands refresh current authority after either blocking lock.
 perform eps.require_capability('workspaces.write');
 if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 if cached is not null then return cached; end if;
 select row_version,draft_revision into current_version,current_draft from eps.workspaces where id=p_workspace_id;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 if expected<>current_version then perform eps.fail('STALE_RESOURCE_VERSION','Workspace changed.',409,current_version); end if;
 if requested is not null then
  select coalesce(array_agg(id order by id),array[]::uuid[]) into active_ids
   from eps.roles where workspace_id=p_workspace_id and archived_at is null;
  if active_ids is distinct from array(select id from unnest(requested) id order by id) then
   perform eps.fail('ROLE_ORDER_INVALID','The order must contain every current active role in this workspace exactly once.',409);
  end if;
  select coalesce(array_agg(id order by sort_order,id),array[]::uuid[]) into current_order
   from eps.roles where workspace_id=p_workspace_id and archived_at is null;
  -- Equal logical order is a no-op even if previous archival left sparse ranks.
  if requested is distinct from current_order then
   select count(*) into expected_changes from unnest(requested) with ordinality entries(id,position)
    join eps.roles role on role.id=entries.id where role.sort_order<>entries.position-1;
  end if;
  if expected_changes>0 then
   update eps.roles role set sort_order=entries.position-1,row_version=role.row_version+1,updated_at=clock_timestamp()
    from unnest(requested) with ordinality entries(id,position)
    where role.id=entries.id and role.workspace_id=p_workspace_id and role.archived_at is null and role.sort_order<>entries.position-1;
   get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,expected_changes);
   if exists(select 1 from unnest(requested) with ordinality entries(id,position)
     left join eps.roles role on role.id=entries.id and role.workspace_id=p_workspace_id and role.archived_at is null
     where role.id is null or role.sort_order<>entries.position-1) then
    perform eps.fail('SPECS_STATE_INVALID','Role order did not apply completely.',409);
   end if;
   perform eps.specs_changed(p_workspace_id);
   if not exists(select 1 from eps.workspaces where id=p_workspace_id and row_version=current_version+1 and draft_revision=current_draft+1) then
    perform eps.fail('SPECS_STATE_INVALID','Workspace revision did not apply completely.',409);
   end if;
  end if;
 end if;
 result:=eps.specs_order_workspace_dto(p_workspace_id);
 -- A no-op may remember a key, but never adds an audit or draft revision.
 if p_idempotency_key is not null then
  insert into eps.idempotency_records(principal_id,operation,key,request_hash,response)
   values(auth.uid(),'specs.reorder_workspace',p_idempotency_key,encode(sha256(convert_to(payload::text,'UTF8')),'hex'),result);
  get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
 end if;
 if expected_changes>0 then
  begin headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
   exception when invalid_text_representation then headers:='{}'; end;
  if jsonb_typeof(headers) is distinct from 'object' then headers:='{}'; end if;
  request_id:=headers->>'x-eps-request-id';
  if request_id is not null and request_id!~'^[A-Za-z0-9._:-]{1,128}$' then request_id:=null; end if;
  client_type:=headers->>'x-eps-client-type';
  if client_type is null or client_type not in('browser','api','mcp') then client_type:='api'; end if;
  insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type)
   values(auth.uid(),'specs.reorder_workspace',p_workspace_id,request_id,client_type);
  get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
 end if;
 return result;
end $$;

revoke all on function eps.specs_order_workspace_dto(uuid),public.eps_reorder_workspace(uuid,jsonb,text)
 from public,anon,authenticated,service_role,eps_api_owner,eps_logo_verify_owner,eps_jobs_owner,eps_jobs_dispatcher,eps_specs_owner,eps_specs_initializer;
grant create on schema eps to eps_api_owner;
grant create on schema public to eps_specs_owner;
alter function eps.specs_order_workspace_dto(uuid) owner to eps_api_owner;
alter function public.eps_reorder_workspace(uuid,jsonb,text) owner to eps_specs_owner;
grant execute on function eps.specs_order_workspace_dto(uuid) to eps_specs_owner;
grant execute on function public.eps_reorder_workspace(uuid,jsonb,text) to authenticated;
revoke create on schema eps from eps_api_owner;
revoke create on schema public from eps_specs_owner;
