-- m17 structured scene operations (cycle 7, A2). Additive and guarded.
--
-- A role stays the canonical character and owns slots and assignments. A scene occurrence only
-- says "this role appears in this scene", so every occurrence of one role shares Main/Option/Backup
-- and shortlist. Nothing here reads or writes assignments, candidates or workspace candidates.
--
-- 1. Review state: proposals (from specs extraction) are 'proposed' until a person confirms or
--    rejects them. A rejected proposal is kept (archived) so a later import does not re-propose it.
--    proposal_key (generated) identifies "the same scene" across imports; proposal_base records the
--    role row_version and fingerprint an occurrence proposal was made against, so a stale proposal
--    never confirms over a newer human edit of that role.
-- 2. Integrity: a trigger refuses slot_ids that are not active slots of the linked role in the same
--    workspace (role/scene workspace equality is already enforced by the composite foreign keys).
-- 3. Public RPCs (owner eps_specs_owner, execute to authenticated, like eps_update_role): list,
--    create, update, reorder, archive scenes; link/update/unlink occurrences; list a role's scenes;
--    confirm/reject proposals. Every mutation requires an Idempotency-Key, fences row_version
--    (STALE_RESOURCE_VERSION) and calls eps.specs_changed (draft_revision/has_unpublished_changes).
-- 4. eps.specs_stage_apply (owner kept: eps_specs_apply_owner) additionally inserts v2 extraction
--    scenes and role occurrences as proposals. It never updates a confirmed or human-edited row:
--    an existing scene with the same proposal_key only receives new proposed occurrences, a
--    rejected one is skipped, and replacing an untouched machine baseline is refused when a person
--    already confirmed or edited an occurrence of a role that would be archived.
set local lock_timeout='3s';
set local statement_timeout='60s';
set local search_path='';
do $$ begin
  if to_regclass('eps.scenes') is null or to_regclass('eps.scene_occurrences') is null
    or to_regprocedure('eps.specs_stage_apply(eps.jobs)') is null or to_regprocedure('eps.specs_changed(uuid)') is null
    or to_regprocedure('eps.specs_lock_workspace(uuid)') is null or to_regprocedure('eps.idempotency_begin(text,text,jsonb)') is null then
    raise exception 'M17_SCENES_PREREQUISITES_MISSING';
  end if;
  if to_regprocedure('public.eps_list_scenes(uuid,text,integer)') is not null
    or exists(select 1 from information_schema.columns where table_schema='eps' and table_name='scenes' and column_name='proposal_key') then
    raise exception 'M17_SCENES_ALREADY_APPLIED';
  end if;
  if (select pg_get_userbyid(proowner) from pg_proc where oid='eps.specs_stage_apply(eps.jobs)'::regprocedure)<>'eps_specs_apply_owner' then
    raise exception 'M17_SCENES_PREREQUISITES_MISSING: unexpected specs_stage_apply owner';
  end if;
end $$;

-- 1. Review state -------------------------------------------------------------------------
alter table eps.scenes drop constraint scenes_status_check;
alter table eps.scenes add constraint scenes_status_check check (status in ('proposed','confirmed','rejected'));
alter table eps.scenes add constraint scenes_rejected_archived_check check (status<>'rejected' or archived_at is not null);
alter table eps.scene_occurrences drop constraint scene_occurrences_status_check;
alter table eps.scene_occurrences add constraint scene_occurrences_status_check check (status in ('proposed','confirmed','rejected'));
alter table eps.scene_occurrences add constraint scene_occurrences_rejected_archived_check check (status<>'rejected' or archived_at is not null);
alter table eps.scenes add column proposal_key text generated always as (lower(btrim(coalesce(scene_number,'')))||'|'||lower(btrim(title))) stored;
alter table eps.scene_occurrences add column proposal_base jsonb
  check (proposal_base is null or (jsonb_typeof(proposal_base)='object' and octet_length(proposal_base::text)<=2000));
create index scenes_workspace_proposal_key_idx on eps.scenes(workspace_id, proposal_key);
comment on column eps.scenes.proposal_key is 'Normalised scene number + title. Imports never duplicate or re-propose a scene with the same key.';
comment on column eps.scene_occurrences.proposal_base is 'For a proposed occurrence: {role_id, role_row_version, role_sha256} at proposal time. Confirm skips it when the role changed.';
grant update(proposal_base) on eps.scene_occurrences to eps_specs_owner;
-- The import may archive its own untouched earlier proposals (never confirmed or edited rows).
grant update(archived_at,row_version,updated_at) on eps.scenes, eps.scene_occurrences to eps_specs_apply_owner;
create policy scenes_stage_apply_update on eps.scenes for update to eps_specs_apply_owner using (true) with check (true);
create policy scene_occurrences_stage_apply_update on eps.scene_occurrences for update to eps_specs_apply_owner using (true) with check (true);

-- Idempotency and audit rows of the scene operations (same shape as the specs policies).
create policy scenes_idempotency on eps.idempotency_records for all to eps_specs_owner
  using (principal_id=auth.uid() and operation like 'scenes.%') with check (principal_id=auth.uid() and operation like 'scenes.%');
create policy scenes_audit on eps.audit_events for insert to eps_specs_owner
  with check (principal_id=auth.uid() and action = any(array['scenes.create_scene','scenes.update_scene','scenes.reorder_scenes','scenes.archive_scene',
    'scenes.link_scene_occurrence','scenes.update_scene_occurrence','scenes.unlink_scene_occurrence','scenes.confirm_scene_proposals','scenes.reject_scene_proposals']));

-- 2. Integrity ------------------------------------------------------------------------------
create function eps.scene_occurrence_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if cardinality(new.slot_ids)<>(select count(distinct x) from unnest(new.slot_ids) x) then
    raise exception using errcode='P0001',message='INVALID_REQUEST',detail='{"message":"Slots repeat.","status":400}';
  end if;
  if (tg_op='INSERT' or new.slot_ids is distinct from old.slot_ids or new.role_id is distinct from old.role_id) and new.archived_at is null and cardinality(new.slot_ids)>0
    and (select count(*) from eps.slots s where s.id=any(new.slot_ids) and s.role_id=new.role_id and s.workspace_id=new.workspace_id and s.archived_at is null)<>cardinality(new.slot_ids) then
    raise exception using errcode='P0001',message='INVALID_REQUEST',detail='{"message":"Every slot must be an active slot of the linked role.","status":400}';
  end if;
  return new;
end $$;
create trigger scene_occurrences_guard before insert or update on eps.scene_occurrences for each row execute function eps.scene_occurrence_guard();

-- 3. Helpers --------------------------------------------------------------------------------
create function eps.scene_check_text(p_value jsonb, p_max integer, p_nullable boolean default true) returns void language plpgsql immutable set search_path='' as $$ begin
  if p_value is null or not (p_nullable and p_value='null'::jsonb
    or jsonb_typeof(p_value)='string' and length(p_value#>>'{}') between 1 and p_max and (p_nullable or btrim(p_value#>>'{}')<>'')) then
    perform eps.fail('INVALID_REQUEST','Scene text is missing, blank or too long.',400);
  end if;
end $$;

create function eps.scene_check_requirements(p_value jsonb) returns void language plpgsql immutable set search_path='' as $$ begin
  if jsonb_typeof(p_value) is distinct from 'object' or (select array_agg(k) from jsonb_object_keys(p_value) k) is distinct from array['items']
    or jsonb_typeof(p_value->'items') is distinct from 'array' or jsonb_array_length(p_value->'items')>50
    or exists(select 1 from jsonb_array_elements(p_value->'items') item where jsonb_typeof(item)<>'string' or length(item#>>'{}') not between 1 and 500) then
    perform eps.fail('INVALID_REQUEST','Scene requirements are {"items": [text]} with at most 50 entries.',400);
  end if;
end $$;

create function eps.scene_uuid_list(p_value jsonb, p_max integer) returns uuid[] language plpgsql immutable set search_path='' as $$
declare result uuid[]; begin
  if jsonb_typeof(p_value) is distinct from 'array' or jsonb_array_length(p_value)>p_max
    or exists(select 1 from jsonb_array_elements(p_value) item where jsonb_typeof(item)<>'string') then
    perform eps.fail('INVALID_REQUEST','Expected a bounded list of identifiers.',400);
  end if;
  select coalesce(array_agg(eps.input_uuid(item) order by ordinal),array[]::uuid[]) into result from jsonb_array_elements_text(p_value) with ordinality x(item,ordinal);
  if cardinality(result)<>(select count(distinct x) from unnest(result) x) then perform eps.fail('INVALID_REQUEST','Identifiers repeat.',400); end if;
  return result;
end $$;

create function eps.scene_role_fingerprint(p_role uuid) returns text language sql stable set search_path='' as $$
  select encode(sha256(convert_to(r.name||E'\n'||r.requirements::text,'UTF8')),'hex') from eps.roles r where r.id=p_role
$$;

create function eps.scene_occurrence_dto(p_occurrence uuid) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id',o.id,'scene_id',o.scene_id,'role_id',o.role_id,'role_name',r.name,
    'slot_ids',to_jsonb(array(select x from unnest(o.slot_ids) with ordinality u(x,n) where exists(select 1 from eps.slots s where s.id=u.x and s.role_id=o.role_id and s.archived_at is null) order by n)),
    'display_title',o.display_title,'setting_override',o.setting_override,'presentation_note',o.presentation_note,'deck_placement',o.deck_placement,
    'status',o.status,'source_refs',o.source_refs,'sort_order',o.sort_order,'row_version',o.row_version,
    'proposal_stale',coalesce(o.status='proposed' and o.proposal_base is not null
      and (o.proposal_base->>'role_sha256' is distinct from eps.scene_role_fingerprint(o.role_id)),false))
  from eps.scene_occurrences o join eps.roles r on r.id=o.role_id where o.id=p_occurrence
$$;

create function eps.scene_dto(p_scene uuid) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id',s.id,'workspace_id',s.workspace_id,'scene_number',s.scene_number,'title',s.title,'sequence_label',s.sequence_label,
    'setting',s.setting,'notes',s.notes,'requirements',case when s.requirements ? 'items' then s.requirements else '{"items":[]}'::jsonb end,
    'source_refs',s.source_refs,'status',s.status,'sort_order',s.sort_order,'row_version',s.row_version,'archived',s.archived_at is not null,
    'occurrences',coalesce((select jsonb_agg(eps.scene_occurrence_dto(o.id) order by o.sort_order,o.id) from (
      select o.id,o.sort_order from eps.scene_occurrences o join eps.roles r on r.id=o.role_id
      where o.scene_id=s.id and o.archived_at is null and r.archived_at is null order by o.sort_order,o.id limit 200) o),'[]'::jsonb))
  from eps.scenes s where s.id=p_scene
$$;

-- Workspace of a scene the caller may write; locks the workspace first (same order as other specs writes).
create function eps.scene_write_scope(p_scene uuid) returns uuid language plpgsql set search_path='' as $$
declare workspace uuid; begin
  perform eps.require_capability('workspaces.write');
  select s.workspace_id into workspace from eps.scenes s where s.id=p_scene and eps.specs_scope(s.workspace_id,true);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Writable scene not found.',404); end if;
  return workspace;
end $$;

create function eps.scene_require_key(p_key text) returns void language plpgsql immutable set search_path='' as $$ begin
  if p_key is null then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key required.',400); end if;
end $$;

-- 4. Public operations ------------------------------------------------------------------------
create function public.eps_list_scenes(p_workspace_id uuid, p_cursor text default null, p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cursor_id uuid; cursor_sort bigint; items jsonb[]; begin
  perform eps.require_capability('workspaces.read');
  if not eps.specs_scope(p_workspace_id,false) then perform eps.fail('RESOURCE_NOT_FOUND','Workspace not found.',404); end if;
  if p_limit is null or p_limit not between 1 and 100 then perform eps.fail('INVALID_REQUEST','Invalid page size.',400); end if;
  if p_cursor is not null then
    cursor_id:=eps.input_uuid(p_cursor); select sort_order into cursor_sort from eps.scenes where id=cursor_id and workspace_id=p_workspace_id and archived_at is null;
    if not found then perform eps.fail('INVALID_REQUEST','Cursor is not in this active scene list.',400); end if;
  end if;
  select coalesce(array_agg(dto order by sort_order,id),array[]::jsonb[]) into items from
    (select id,sort_order,eps.scene_dto(id) dto from eps.scenes where workspace_id=p_workspace_id and archived_at is null
      and (cursor_id is null or (sort_order,id)>(cursor_sort,cursor_id)) order by sort_order,id limit p_limit+1) page;
  return eps.page_result(items,p_limit);
end $$;

create function public.eps_create_scene(p_workspace_id uuid, p_input jsonb, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare payload jsonb; result jsonb; scene eps.scenes; order_value bigint; begin
  perform eps.require_capability('workspaces.write'); perform eps.specs_check_body(p_input,array['title','scene_number','sequence_label','setting','notes','requirements']);
  perform eps.scene_check_text(p_input->'title',300,false);
  if p_input?'scene_number' then perform eps.scene_check_text(p_input->'scene_number',40); end if;
  if p_input?'sequence_label' then perform eps.scene_check_text(p_input->'sequence_label',300); end if;
  if p_input?'setting' then perform eps.scene_check_text(p_input->'setting',300); end if;
  if p_input?'notes' then perform eps.scene_check_text(p_input->'notes',4000); end if;
  if p_input?'requirements' then perform eps.scene_check_requirements(p_input->'requirements'); end if;
  perform eps.scene_require_key(p_idempotency_key);
  if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  payload:=jsonb_build_object('workspace_id',p_workspace_id,'input',p_input); result:=eps.idempotency_begin('scenes.create_scene',p_idempotency_key,payload);
  perform eps.specs_lock_workspace(p_workspace_id); if result is not null then return result; end if;
  select coalesce(max(sort_order),-1)+1 into order_value from eps.scenes where workspace_id=p_workspace_id;
  insert into eps.scenes(workspace_id,scene_number,title,sequence_label,setting,notes,requirements,status,sort_order)
    values(p_workspace_id,p_input->>'scene_number',p_input->>'title',p_input->>'sequence_label',p_input->>'setting',p_input->>'notes',
      coalesce(p_input->'requirements','{"items":[]}'::jsonb),'confirmed',order_value) returning * into scene;
  perform eps.specs_changed(p_workspace_id);
  return eps.finish_mutation('scenes.create_scene',p_idempotency_key,payload,eps.scene_dto(scene.id),scene.id);
end $$;

create function public.eps_update_scene(p_scene_id uuid, p_input jsonb, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare workspace uuid; payload jsonb; result jsonb; scene eps.scenes; begin
  perform eps.require_capability('workspaces.write'); perform eps.specs_check_body(p_input,array['row_version','title','scene_number','sequence_label','setting','notes','requirements']);
  if (select count(*) from jsonb_object_keys(p_input))<2 then perform eps.fail('INVALID_REQUEST','Change at least one scene field.',400); end if;
  if p_input?'title' then perform eps.scene_check_text(p_input->'title',300,false); end if;
  if p_input?'scene_number' then perform eps.scene_check_text(p_input->'scene_number',40); end if;
  if p_input?'sequence_label' then perform eps.scene_check_text(p_input->'sequence_label',300); end if;
  if p_input?'setting' then perform eps.scene_check_text(p_input->'setting',300); end if;
  if p_input?'notes' then perform eps.scene_check_text(p_input->'notes',4000); end if;
  if p_input?'requirements' then perform eps.scene_check_requirements(p_input->'requirements'); end if;
  perform eps.scene_require_key(p_idempotency_key); workspace:=eps.scene_write_scope(p_scene_id);
  payload:=jsonb_build_object('id',p_scene_id,'input',p_input); result:=eps.idempotency_begin('scenes.update_scene',p_idempotency_key,payload);
  perform eps.specs_lock_workspace(workspace); if result is not null then return result; end if;
  select * into scene from eps.scenes where id=p_scene_id and archived_at is null for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active scene not found.',404); end if;
  if eps.expected_version(p_input)<>scene.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Scene changed.',409,scene.row_version); end if;
  update eps.scenes set title=coalesce(p_input->>'title',title),
    scene_number=case when p_input?'scene_number' then p_input->>'scene_number' else scene_number end,
    sequence_label=case when p_input?'sequence_label' then p_input->>'sequence_label' else sequence_label end,
    setting=case when p_input?'setting' then p_input->>'setting' else setting end,
    notes=case when p_input?'notes' then p_input->>'notes' else notes end,
    requirements=coalesce(p_input->'requirements',requirements),row_version=row_version+1,updated_at=clock_timestamp() where id=scene.id;
  perform eps.specs_changed(workspace);
  return eps.finish_mutation('scenes.update_scene',p_idempotency_key,payload,eps.scene_dto(scene.id),scene.id);
end $$;

create function public.eps_reorder_scenes(p_workspace_id uuid, p_input jsonb, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare payload jsonb; result jsonb; ids uuid[]; current_version bigint; begin
  perform eps.require_capability('workspaces.write'); perform eps.specs_check_body(p_input,array['row_version','scene_ids']);
  if not (p_input?'row_version' and p_input?'scene_ids') then perform eps.fail('INVALID_REQUEST','row_version and scene_ids are required.',400); end if;
  ids:=eps.scene_uuid_list(p_input->'scene_ids',1000); perform eps.expected_version(p_input);
  perform eps.scene_require_key(p_idempotency_key);
  if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  payload:=jsonb_build_object('workspace_id',p_workspace_id,'input',p_input); result:=eps.idempotency_begin('scenes.reorder_scenes',p_idempotency_key,payload);
  perform eps.specs_lock_workspace(p_workspace_id); if result is not null then return result; end if;
  select row_version into current_version from eps.workspaces where id=p_workspace_id;
  if eps.expected_version(p_input)<>current_version then perform eps.fail('STALE_RESOURCE_VERSION','Workspace changed.',409,current_version); end if;
  perform 1 from eps.scenes where workspace_id=p_workspace_id and archived_at is null order by id for update;
  if array(select x from unnest(ids) x order by x) is distinct from array(select id from eps.scenes where workspace_id=p_workspace_id and archived_at is null order by id) then
    perform eps.fail('SCENE_ORDER_INVALID','Send every active scene of this workspace exactly once.',409);
  end if;
  if ids is distinct from array(select id from eps.scenes where workspace_id=p_workspace_id and archived_at is null order by sort_order,id) then
    update eps.scenes s set sort_order=x.n-1,row_version=s.row_version+1,updated_at=clock_timestamp() from unnest(ids) with ordinality x(id,n)
      where s.id=x.id and s.sort_order<>x.n-1;
    perform eps.specs_changed(p_workspace_id);
  end if;
  result:=jsonb_build_object('workspace_id',p_workspace_id,'row_version',(select row_version from eps.workspaces where id=p_workspace_id),
    'scene_ids',to_jsonb(array(select id from eps.scenes where workspace_id=p_workspace_id and archived_at is null order by sort_order,id)));
  return eps.finish_mutation('scenes.reorder_scenes',p_idempotency_key,payload,result,p_workspace_id);
end $$;

create function public.eps_archive_scene(p_scene_id uuid, p_input jsonb, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare workspace uuid; payload jsonb; result jsonb; scene eps.scenes; stamp timestamptz:=clock_timestamp(); affected uuid[]; begin
  perform eps.require_capability('workspaces.write'); perform eps.specs_check_body(p_input,array['row_version']); perform eps.expected_version(p_input);
  perform eps.scene_require_key(p_idempotency_key); workspace:=eps.scene_write_scope(p_scene_id);
  payload:=jsonb_build_object('id',p_scene_id,'input',p_input); result:=eps.idempotency_begin('scenes.archive_scene',p_idempotency_key,payload);
  perform eps.specs_lock_workspace(workspace); if result is not null then return result; end if;
  select * into scene from eps.scenes where id=p_scene_id and archived_at is null for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active scene not found.',404); end if;
  if eps.expected_version(p_input)<>scene.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Scene changed.',409,scene.row_version); end if;
  -- Only the scene and its occurrence links. Roles, slots, assignments and candidates are untouched.
  with archived as (update eps.scene_occurrences set archived_at=stamp,row_version=row_version+1,updated_at=stamp
    where scene_id=scene.id and archived_at is null returning id) select coalesce(array_agg(id order by id),array[]::uuid[]) into affected from archived;
  update eps.scenes set archived_at=stamp,row_version=row_version+1,updated_at=stamp where id=scene.id;
  perform eps.specs_changed(workspace);
  return eps.finish_mutation('scenes.archive_scene',p_idempotency_key,payload,
    jsonb_build_object('success',true,'affected_ids',to_jsonb(array[scene.id]||affected)),scene.id);
end $$;

create function eps.scene_check_occurrence_fields(p_input jsonb) returns void language plpgsql immutable set search_path='' as $$ begin
  if p_input?'slot_ids' then perform eps.scene_uuid_list(p_input->'slot_ids',1000); end if;
  if p_input?'display_title' then perform eps.scene_check_text(p_input->'display_title',300); end if;
  if p_input?'setting_override' then perform eps.scene_check_text(p_input->'setting_override',300); end if;
  if p_input?'presentation_note' then perform eps.scene_check_text(p_input->'presentation_note',500); end if;
  if p_input?'deck_placement' and (jsonb_typeof(p_input->'deck_placement') is distinct from 'string' or p_input->>'deck_placement' not in ('auto','repeat','hidden')) then
    perform eps.fail('INVALID_REQUEST','deck_placement is auto, repeat or hidden.',400);
  end if;
end $$;

create function public.eps_link_scene_occurrence(p_scene_id uuid, p_input jsonb, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare workspace uuid; payload jsonb; result jsonb; v_role uuid; existing eps.scene_occurrences; order_value bigint; begin
  perform eps.require_capability('workspaces.write');
  perform eps.specs_check_body(p_input,array['role_id','slot_ids','display_title','setting_override','presentation_note','deck_placement']);
  if jsonb_typeof(p_input->'role_id') is distinct from 'string' then perform eps.fail('INVALID_REQUEST','role_id is required.',400); end if;
  v_role:=eps.input_uuid(p_input->>'role_id'); perform eps.scene_check_occurrence_fields(p_input);
  perform eps.scene_require_key(p_idempotency_key); workspace:=eps.scene_write_scope(p_scene_id);
  payload:=jsonb_build_object('id',p_scene_id,'input',p_input); result:=eps.idempotency_begin('scenes.link_scene_occurrence',p_idempotency_key,payload);
  perform eps.specs_lock_workspace(workspace); if result is not null then return result; end if;
  perform 1 from eps.scenes where id=p_scene_id and archived_at is null for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active scene not found.',404); end if;
  -- Explicit link by id: the role must be active in this scene's workspace (never matched by name).
  perform 1 from eps.roles r where r.id=v_role and r.workspace_id=workspace and r.archived_at is null for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active role not found in this project.',404); end if;
  select * into existing from eps.scene_occurrences o where o.scene_id=p_scene_id and o.role_id=v_role order by o.archived_at is null desc,o.updated_at desc limit 1 for update;
  if found and existing.archived_at is null then perform eps.fail('SCENE_OCCURRENCE_EXISTS','This role is already linked to this scene.',409); end if;
  if found then
    update eps.scene_occurrences o set archived_at=null,status='confirmed',proposal_base=null,
      slot_ids=coalesce(array(select eps.input_uuid(x) from jsonb_array_elements_text(p_input->'slot_ids') x),'{}'),
      display_title=p_input->>'display_title',setting_override=p_input->>'setting_override',presentation_note=p_input->>'presentation_note',
      deck_placement=coalesce(p_input->>'deck_placement','auto'),row_version=o.row_version+1,updated_at=clock_timestamp() where o.id=existing.id;
  else
    select coalesce(max(sort_order),-1)+1 into order_value from eps.scene_occurrences where scene_id=p_scene_id;
    insert into eps.scene_occurrences(workspace_id,scene_id,role_id,slot_ids,display_title,setting_override,presentation_note,deck_placement,status,sort_order)
      values(workspace,p_scene_id,v_role,coalesce(array(select eps.input_uuid(x) from jsonb_array_elements_text(p_input->'slot_ids') x),'{}'),
        p_input->>'display_title',p_input->>'setting_override',p_input->>'presentation_note',coalesce(p_input->>'deck_placement','auto'),'confirmed',order_value);
  end if;
  perform eps.specs_changed(workspace);
  return eps.finish_mutation('scenes.link_scene_occurrence',p_idempotency_key,payload,eps.scene_dto(p_scene_id),p_scene_id);
end $$;

create function eps.scene_occurrence_write(p_occurrence uuid, p_input jsonb, p_key text, p_operation text) returns eps.scene_occurrences
language plpgsql set search_path='' as $$
declare workspace uuid; occurrence eps.scene_occurrences; begin
  perform eps.scene_require_key(p_key); perform eps.require_capability('workspaces.write');
  select o.workspace_id into workspace from eps.scene_occurrences o where o.id=p_occurrence and eps.specs_scope(o.workspace_id,true);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Writable scene link not found.',404); end if;
  perform eps.specs_lock_workspace(workspace);
  select * into occurrence from eps.scene_occurrences where id=p_occurrence for update;
  return occurrence;
end $$;

create function public.eps_update_scene_occurrence(p_occurrence_id uuid, p_input jsonb, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare payload jsonb; result jsonb; occurrence eps.scene_occurrences; begin
  perform eps.require_capability('workspaces.write');
  perform eps.specs_check_body(p_input,array['row_version','slot_ids','display_title','setting_override','presentation_note','deck_placement']);
  if (select count(*) from jsonb_object_keys(p_input))<2 then perform eps.fail('INVALID_REQUEST','Change at least one link field.',400); end if;
  perform eps.expected_version(p_input); perform eps.scene_check_occurrence_fields(p_input); perform eps.scene_require_key(p_idempotency_key);
  if not exists(select 1 from eps.scene_occurrences o where o.id=p_occurrence_id and eps.specs_scope(o.workspace_id,true)) then
    perform eps.fail('RESOURCE_NOT_FOUND','Writable scene link not found.',404); end if;
  payload:=jsonb_build_object('id',p_occurrence_id,'input',p_input); result:=eps.idempotency_begin('scenes.update_scene_occurrence',p_idempotency_key,payload);
  occurrence:=eps.scene_occurrence_write(p_occurrence_id,p_input,p_idempotency_key,'update'); if result is not null then return result; end if;
  if occurrence.archived_at is not null or exists(select 1 from eps.roles r where r.id=occurrence.role_id and r.archived_at is not null) then
    perform eps.fail('RESOURCE_NOT_FOUND','Active scene link not found.',404); end if;
  if eps.expected_version(p_input)<>occurrence.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Scene link changed.',409,occurrence.row_version); end if;
  update eps.scene_occurrences o set
    slot_ids=case when p_input?'slot_ids' then array(select eps.input_uuid(x) from jsonb_array_elements_text(p_input->'slot_ids') x) else slot_ids end,
    display_title=case when p_input?'display_title' then p_input->>'display_title' else display_title end,
    setting_override=case when p_input?'setting_override' then p_input->>'setting_override' else setting_override end,
    presentation_note=case when p_input?'presentation_note' then p_input->>'presentation_note' else presentation_note end,
    deck_placement=coalesce(p_input->>'deck_placement',deck_placement),row_version=o.row_version+1,updated_at=clock_timestamp() where o.id=occurrence.id;
  perform eps.specs_changed(occurrence.workspace_id);
  return eps.finish_mutation('scenes.update_scene_occurrence',p_idempotency_key,payload,eps.scene_dto(occurrence.scene_id),occurrence.id);
end $$;

create function public.eps_unlink_scene_occurrence(p_occurrence_id uuid, p_input jsonb, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare payload jsonb; result jsonb; occurrence eps.scene_occurrences; begin
  perform eps.require_capability('workspaces.write'); perform eps.specs_check_body(p_input,array['row_version']); perform eps.expected_version(p_input);
  perform eps.scene_require_key(p_idempotency_key);
  if not exists(select 1 from eps.scene_occurrences o where o.id=p_occurrence_id and eps.specs_scope(o.workspace_id,true)) then
    perform eps.fail('RESOURCE_NOT_FOUND','Writable scene link not found.',404); end if;
  payload:=jsonb_build_object('id',p_occurrence_id,'input',p_input); result:=eps.idempotency_begin('scenes.unlink_scene_occurrence',p_idempotency_key,payload);
  occurrence:=eps.scene_occurrence_write(p_occurrence_id,p_input,p_idempotency_key,'unlink'); if result is not null then return result; end if;
  if occurrence.archived_at is not null then perform eps.fail('RESOURCE_NOT_FOUND','Active scene link not found.',404); end if;
  if eps.expected_version(p_input)<>occurrence.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Scene link changed.',409,occurrence.row_version); end if;
  update eps.scene_occurrences set archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp() where id=occurrence.id;
  perform eps.specs_changed(occurrence.workspace_id);
  return eps.finish_mutation('scenes.unlink_scene_occurrence',p_idempotency_key,payload,eps.scene_dto(occurrence.scene_id),occurrence.id);
end $$;

create function public.eps_list_role_occurrences(p_role_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare workspace uuid; begin
  perform eps.require_capability('workspaces.read');
  select r.workspace_id into workspace from eps.roles r where r.id=p_role_id and r.archived_at is null and eps.specs_scope(r.workspace_id,false);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active role not found.',404); end if;
  return jsonb_build_object('role_id',p_role_id,'data',coalesce((select jsonb_agg(jsonb_build_object('occurrence_id',o.id,'scene_id',s.id,'scene_number',s.scene_number,
      'scene_title',s.title,'setting',s.setting,'scene_position',s.position,'scene_status',s.status,'status',o.status) order by s.position)
    from (select x.*,row_number() over (order by x.sort_order,x.id) position from eps.scenes x where x.workspace_id=workspace and x.archived_at is null) s
    join eps.scene_occurrences o on o.scene_id=s.id and o.role_id=p_role_id and o.archived_at is null where s.position<=500),'[]'::jsonb));
end $$;

-- Confirm or reject proposals. Both lists omitted = every active proposal in the workspace.
create function eps.scene_review(p_workspace_id uuid, p_input jsonb, p_idempotency_key text, p_decision text) returns jsonb
language plpgsql set search_path='' as $$
declare operation text:='scenes.'||p_decision||'_scene_proposals'; payload jsonb; result jsonb; scene_ids uuid[]; occurrence_ids uuid[]; current_version bigint;
  done_scenes uuid[]:='{}'; done_occurrences uuid[]:='{}'; skipped uuid[]:='{}'; stamp timestamptz:=clock_timestamp(); begin
  perform eps.require_capability('workspaces.write'); perform eps.specs_check_body(p_input,array['row_version','scene_ids','occurrence_ids']); perform eps.expected_version(p_input);
  if p_input?'scene_ids' then scene_ids:=eps.scene_uuid_list(p_input->'scene_ids',10000); end if;
  if p_input?'occurrence_ids' then occurrence_ids:=eps.scene_uuid_list(p_input->'occurrence_ids',10000); end if;
  perform eps.scene_require_key(p_idempotency_key);
  if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  payload:=jsonb_build_object('workspace_id',p_workspace_id,'input',p_input); result:=eps.idempotency_begin(operation,p_idempotency_key,payload);
  perform eps.specs_lock_workspace(p_workspace_id); if result is not null then return result; end if;
  select row_version into current_version from eps.workspaces where id=p_workspace_id;
  if eps.expected_version(p_input)<>current_version then perform eps.fail('STALE_RESOURCE_VERSION','Workspace changed.',409,current_version); end if;
  if scene_ids is null and occurrence_ids is null then
    select array_agg(id) into scene_ids from eps.scenes where workspace_id=p_workspace_id and archived_at is null and status='proposed';
    select array_agg(o.id) into occurrence_ids from eps.scene_occurrences o join eps.roles r on r.id=o.role_id
      where o.workspace_id=p_workspace_id and o.archived_at is null and o.status='proposed' and r.archived_at is null;
  end if;
  scene_ids:=coalesce(scene_ids,'{}'); occurrence_ids:=coalesce(occurrence_ids,'{}');
  if exists(select 1 from unnest(scene_ids) x where not exists(select 1 from eps.scenes s where s.id=x and s.workspace_id=p_workspace_id and s.archived_at is null))
    or exists(select 1 from unnest(occurrence_ids) x where not exists(select 1 from eps.scene_occurrences o where o.id=x and o.workspace_id=p_workspace_id and o.archived_at is null)) then
    perform eps.fail('RESOURCE_NOT_FOUND','A listed scene or link is not active in this project.',404);
  end if;
  perform 1 from eps.scenes where id=any(scene_ids) order by id for update; perform 1 from eps.scene_occurrences where id=any(occurrence_ids) order by id for update;
  if p_decision='confirm' then
    -- A proposal made against an older version of the role is never confirmed over that newer human edit.
    select coalesce(array_agg(o.id order by o.id),'{}') into skipped from eps.scene_occurrences o where o.id=any(occurrence_ids) and o.status='proposed'
      and (exists(select 1 from eps.roles r where r.id=o.role_id and r.archived_at is not null)
        or o.proposal_base is not null and o.proposal_base->>'role_sha256' is distinct from eps.scene_role_fingerprint(o.role_id));
    with changed as (update eps.scenes set status='confirmed',row_version=row_version+1,updated_at=stamp where id=any(scene_ids) and status='proposed' returning id)
      select coalesce(array_agg(id order by id),'{}') into done_scenes from changed;
    with changed as (update eps.scene_occurrences set status='confirmed',row_version=row_version+1,updated_at=stamp
      where id=any(occurrence_ids) and status='proposed' and not id=any(skipped) returning id)
      select coalesce(array_agg(id order by id),'{}') into done_occurrences from changed;
  else
    -- Rejecting a scene proposal also removes its links; roles, slots and casting stay untouched.
    with changed as (update eps.scene_occurrences set status=case when status='proposed' then 'rejected' else status end,archived_at=stamp,row_version=row_version+1,updated_at=stamp
      where archived_at is null and (id=any(occurrence_ids) and status='proposed' or scene_id in (select id from eps.scenes where id=any(scene_ids) and status='proposed')) returning id)
      select coalesce(array_agg(id order by id),'{}') into done_occurrences from changed;
    with changed as (update eps.scenes set status='rejected',archived_at=stamp,row_version=row_version+1,updated_at=stamp where id=any(scene_ids) and status='proposed' returning id)
      select coalesce(array_agg(id order by id),'{}') into done_scenes from changed;
  end if;
  if cardinality(done_scenes)+cardinality(done_occurrences)>0 then perform eps.specs_changed(p_workspace_id); end if;
  result:=jsonb_build_object('workspace_id',p_workspace_id,'row_version',(select row_version from eps.workspaces where id=p_workspace_id));
  if p_decision='confirm' then
    result:=result||jsonb_build_object('confirmed_scene_ids',to_jsonb(done_scenes),'confirmed_occurrence_ids',to_jsonb(done_occurrences),'skipped_occurrence_ids',to_jsonb(skipped));
  else
    result:=result||jsonb_build_object('rejected_scene_ids',to_jsonb(done_scenes),'rejected_occurrence_ids',to_jsonb(done_occurrences));
  end if;
  return eps.finish_mutation(operation,p_idempotency_key,payload,result,p_workspace_id);
end $$;

create function public.eps_confirm_scene_proposals(p_workspace_id uuid, p_input jsonb, p_idempotency_key text) returns jsonb
language sql security definer set search_path='' as $$ select eps.scene_review(p_workspace_id,p_input,p_idempotency_key,'confirm') $$;
create function public.eps_reject_scene_proposals(p_workspace_id uuid, p_input jsonb, p_idempotency_key text) returns jsonb
language sql security definer set search_path='' as $$ select eps.scene_review(p_workspace_id,p_input,p_idempotency_key,'reject') $$;

-- 5. Specs import: v2 scenes and occurrences become proposals ---------------------------------
create or replace function eps.specs_stage_apply(p_job eps.jobs)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare spec eps.specs; saved eps.specs_stage_payloads; preparation eps.specs_stage_payloads; workspace_version bigint; workspace_draft bigint; extraction jsonb; role_value jsonb; frozen_source_text text;
 current_role_id uuid; role_index bigint:=0; slot_count bigint:=0; requested_slots numeric; count_value bigint; ordinal_value bigint; working_clarifications_value jsonb; changed bigint; marker_count bigint:=0; old_role_count bigint; old_slot_count bigint; archive_time timestamptz; old_roles jsonb; old_slots jsonb; prepared_asset eps.media_assets; pending eps.specs_file_preparations; checked_preparation jsonb;
 role_map jsonb:='{}'; scene_map jsonb:='{}'; scene_value jsonb; occurrence_value jsonb; scene_key text; existing_scene eps.scenes; new_scene_id uuid; scene_order bigint; occurrence_order bigint;
begin
 -- Caller already holds workspace -> Spec -> job. Repeat exact binding under
 -- those locks; this helper never acquires job/outbox after child role locks.
 select row_version,draft_revision into workspace_version,workspace_draft from eps.workspaces where id=p_job.workspace_id for update;
 select * into spec from eps.specs where id=p_job.resource_id and workspace_id=p_job.workspace_id for update;
 perform eps.specs_stage_assert(found and eps.specs_stage_source_matches(p_job) and eps.specs_stage_can_write(p_job.requested_by,p_job.workspace_id),'INPUT_CHANGED');
 select source_text into frozen_source_text from eps.specs_source_inputs where job_id=p_job.id;
 perform eps.specs_stage_assert(found,'INPUT_CHANGED');
 perform 1 from eps.roles where workspace_id=p_job.workspace_id order by id for update;
 perform 1 from eps.slots where workspace_id=p_job.workspace_id order by id for update;
 perform 1 from eps.scenes where workspace_id=p_job.workspace_id order by id for update;
 perform 1 from eps.scene_occurrences where workspace_id=p_job.workspace_id order by id for update;
 perform eps.specs_stage_assert(workspace_version::text=p_job.input->>'workspace_row_version'
  and ((spec.normalized_instructions is null and spec.clarifications='[]' and spec.source_extraction is null and cardinality(spec.source_language_codes)=0
   and not exists(select 1 from eps.roles where workspace_id=p_job.workspace_id)
   and not exists(select 1 from eps.slots where workspace_id=p_job.workspace_id)) or eps.specs_machine_baseline(spec)),'INPUT_CHANGED');
 -- Replacing a machine baseline archives its roles. A person's confirmed or edited scene link of
 -- such a role is a human decision the import may not discard.
 perform eps.specs_stage_assert(not exists(select 1 from eps.scene_occurrences o join eps.roles r on r.id=o.role_id
   where o.workspace_id=p_job.workspace_id and o.archived_at is null and r.archived_at is null and (o.status<>'proposed' or o.row_version<>1)),'INPUT_CHANGED');
 select * into saved from eps.specs_stage_payloads where job_id=p_job.id and stage='extract_specs' and input_hash=p_job.input_hash;
 perform eps.specs_stage_assert(found and saved.result_schema='specs-extraction-stage.v1','RESULT_INVALID');
 select * into preparation from eps.specs_stage_payloads where job_id=p_job.id and stage='prepare_document' and input_hash=p_job.input_hash;
 perform eps.specs_stage_assert(found,'RESULT_INVALID'); extraction:=saved.result->'result';
 if p_job.input_asset_id is null then
  perform eps.specs_stage_assert(preparation.paragraphs=eps.specs_stage_paragraphs(frozen_source_text)
   and preparation.prepared_text=replace(replace(frozen_source_text,E'\r\n',E'\n'),E'\r',E'\n'),'RESULT_INVALID');
  perform eps.specs_stage_extract(extraction,preparation.paragraphs);
 else
  select * into prepared_asset from eps.media_assets where id=(preparation.result->>'text_asset_id')::uuid;
  perform eps.specs_stage_assert(found,'RESULT_INVALID');
  select * into pending from eps.specs_file_preparations where job_id=p_job.id and attempt_id=preparation.attempt_id and asset_id=prepared_asset.id and input_hash=p_job.input_hash;
  perform eps.specs_stage_assert(found,'RESULT_INVALID'); checked_preparation:=eps.specs_validate_file_preparation(p_job,prepared_asset,pending.payload_utf8);
  perform eps.specs_stage_assert(preparation.prepared_text=checked_preparation->>'text' and preparation.paragraphs=checked_preparation->'paragraphs','RESULT_INVALID');
  perform eps.specs_document_extract(extraction,preparation.paragraphs,p_job.input_asset_id);
 end if;
 perform eps.specs_stage_metadata(saved.result->'metadata',p_job,preparation.paragraphs);
 select coalesce(sum(coalesce((value->>'headcount')::numeric,1)),0) into requested_slots from jsonb_array_elements(extraction->'roles');
 -- Same default budget as commitSpecsExtraction; no huge safe-integer loop.
 perform eps.specs_stage_assert(requested_slots<=1000,'SLOT_ALLOCATION_LIMIT_EXCEEDED');
 -- Archive only the exact untouched machine generation; retain every source
 -- and historical identity. No assignment adapter exists yet, so its presence
 -- disables replacement in specs_machine_baseline rather than guessing facts.
 select count(*) into old_role_count from eps.roles where workspace_id=p_job.workspace_id and archived_at is null;
 select count(*) into old_slot_count from eps.slots where workspace_id=p_job.workspace_id and archived_at is null;
 if old_role_count>0 or old_slot_count>0 then
  perform eps.specs_stage_assert(eps.specs_machine_baseline(spec),'INPUT_CHANGED'); archive_time:=clock_timestamp();
  select coalesce(jsonb_agg(to_jsonb(r)-array['archived_at','row_version','updated_at'] order by id),'[]') into old_roles from eps.roles r where workspace_id=p_job.workspace_id and archived_at is null;
  select coalesce(jsonb_agg(to_jsonb(r)-array['archived_at','row_version','updated_at'] order by id),'[]') into old_slots from eps.slots r where workspace_id=p_job.workspace_id and archived_at is null;
  update eps.slots set archived_at=archive_time,row_version=row_version+1,updated_at=archive_time where workspace_id=p_job.workspace_id and archived_at is null;
  get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=old_slot_count,'STAGE_STATE_INVALID');
  update eps.roles set archived_at=archive_time,row_version=row_version+1,updated_at=archive_time where workspace_id=p_job.workspace_id and archived_at is null;
  get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=old_role_count,'STAGE_STATE_INVALID');
  perform eps.specs_stage_assert((select jsonb_agg(to_jsonb(r)-array['archived_at','row_version','updated_at'] order by id) from eps.roles r where id in(select (value->>'id')::uuid from jsonb_array_elements(old_roles)))=old_roles
   and (old_slot_count=0 or (select jsonb_agg(to_jsonb(r)-array['archived_at','row_version','updated_at'] order by id) from eps.slots r where id in(select (value->>'id')::uuid from jsonb_array_elements(old_slots)))=old_slots)
   and not exists(select 1 from eps.roles r where id in(select (value->>'id')::uuid from jsonb_array_elements(old_roles)) and (archived_at is distinct from archive_time or row_version<>2 or updated_at is distinct from archive_time))
   and not exists(select 1 from eps.slots r where id in(select (value->>'id')::uuid from jsonb_array_elements(old_slots)) and (archived_at is distinct from archive_time or row_version<>2 or updated_at is distinct from archive_time)),'STAGE_STATE_INVALID');
  -- The earlier import's untouched proposals go with its roles; confirmed or edited scenes stay.
  update eps.scene_occurrences set archived_at=archive_time,row_version=row_version+1,updated_at=archive_time
   where workspace_id=p_job.workspace_id and archived_at is null and role_id in(select (value->>'id')::uuid from jsonb_array_elements(old_roles));
  update eps.scenes s set archived_at=archive_time,row_version=s.row_version+1,updated_at=archive_time
   where s.workspace_id=p_job.workspace_id and s.archived_at is null and s.status='proposed' and s.row_version=1 and s.source_job_id is not null
    and not exists(select 1 from eps.scene_occurrences o where o.scene_id=s.id and o.archived_at is null);
 end if;
 for role_value in select value from jsonb_array_elements(extraction->'roles') with ordinality entries(value,ordinal) order by ordinal loop
  select coalesce(jsonb_agg(value||jsonb_build_object('resolved',false) order by ordinal),'[]') into working_clarifications_value from jsonb_array_elements(role_value->'clarifications') with ordinality entries(value,ordinal);
  if role_value->'headcount'='null' and not exists(select 1 from jsonb_array_elements(working_clarifications_value) where value->>'field_path'='headcount') then
   working_clarifications_value:=working_clarifications_value||jsonb_build_array(jsonb_build_object('field_path','headcount','reason','Headcount is not known. The single slot is provisional.','source',null,'resolved',false)); end if;
  if coalesce(role_value->>'name','')='' and not exists(select 1 from jsonb_array_elements(working_clarifications_value) where value->>'field_path'='name') then
   working_clarifications_value:=working_clarifications_value||jsonb_build_array(jsonb_build_object('field_path','name','reason','Role name is not provided.','source',null,'resolved',false)); end if;
  marker_count:=marker_count+jsonb_array_length(working_clarifications_value);
  insert into eps.roles(workspace_id,spec_id,name,headcount,category,requirements,clarifications,source_role,sort_order,source_job_id)
   values(p_job.workspace_id,spec.id,coalesce(role_value->>'name',''),(role_value->>'headcount')::bigint,role_value->>'category',role_value->'requirements',working_clarifications_value,role_value,role_index,p_job.id)
   returning id into current_role_id;
  get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
  role_map:=role_map||jsonb_build_object(role_value->>'source_role_key',current_role_id);
  count_value:=coalesce((role_value->>'headcount')::bigint,1);
  for ordinal_value in 1..count_value loop
   insert into eps.slots(workspace_id,role_id,ordinal,label,sort_order,provisional)
    values(p_job.workspace_id,current_role_id,ordinal_value,coalesce(nullif(role_value->>'name',''),'Slot')||' '||ordinal_value,ordinal_value-1,role_value->'headcount'='null');
   get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
  end loop;
  perform eps.specs_stage_assert(exists(select 1 from eps.roles where id=current_role_id and workspace_id=p_job.workspace_id and spec_id=spec.id
    and name=coalesce(role_value->>'name','') and headcount is not distinct from (role_value->>'headcount')::bigint
    and category is not distinct from role_value->>'category' and requirements=role_value->'requirements' and roles.clarifications=working_clarifications_value
    and source_role=role_value and source_job_id=p_job.id and sort_order=role_index and row_version=1 and archived_at is null)
   and (select count(*) from eps.slots where role_id=current_role_id)=count_value
   and not exists(select 1 from eps.slots where role_id=current_role_id and (workspace_id<>p_job.workspace_id or archived_at is not null or row_version<>1
    or ordinal not between 1 and count_value or sort_order<>ordinal-1 or label<>coalesce(nullif(role_value->>'name',''),'Slot')||' '||ordinal
    or provisional is distinct from (role_value->'headcount'='null'))),'STAGE_STATE_INVALID');
  role_index:=role_index+1; slot_count:=slot_count+count_value;
 end loop;
 -- v2: scenes and per-role occurrences become proposals for review. The role stays the character;
 -- same_character_as never merges roles (it is carried as a role clarification for review).
 if extraction->>'schema_version'='2.0' and not exists(select 1 from eps.scenes where workspace_id=p_job.workspace_id and source_job_id=p_job.id) then
  select coalesce(max(sort_order),-1)+1 into scene_order from eps.scenes where workspace_id=p_job.workspace_id;
  for scene_value in select value from jsonb_array_elements(extraction->'scenes') with ordinality entries(value,ordinal) order by ordinal loop
   scene_key:=lower(btrim(coalesce(scene_value->>'scene_number','')))||'|'||lower(btrim(scene_value->>'title'));
   select * into existing_scene from eps.scenes s where s.workspace_id=p_job.workspace_id and s.proposal_key=scene_key and (s.archived_at is null or s.status='rejected')
    order by s.archived_at is null desc, s.updated_at desc limit 1;
   if found and existing_scene.archived_at is not null then continue; end if; -- rejected earlier: never re-proposed
   if found then new_scene_id:=existing_scene.id; -- existing (confirmed/edited) scene: only new proposed links
   else
    insert into eps.scenes(workspace_id,scene_number,title,sequence_label,setting,notes,requirements,source_refs,status,source_job_id,sort_order)
     values(p_job.workspace_id,nullif(scene_value->>'scene_number',''),left(scene_value->>'title',300),left(nullif(scene_value->>'sequence_label',''),300),
      left(nullif(scene_value->>'setting',''),300),left(nullif(scene_value->>'notes',''),4000),
      jsonb_build_object('items',coalesce((select jsonb_agg(left(item,500)) from (select item from jsonb_array_elements_text(scene_value->'requirements') item where item<>'' limit 50) r),'[]'::jsonb)),
      scene_value->'evidence','proposed',p_job.id,scene_order) returning id into new_scene_id;
    scene_order:=scene_order+1;
   end if;
   scene_map:=scene_map||jsonb_build_object(scene_value->>'scene_key',new_scene_id);
  end loop;
  for role_value in select value from jsonb_array_elements(extraction->'roles') loop
   current_role_id:=(role_map->>(role_value->>'source_role_key'))::uuid;
   for occurrence_value in select value from jsonb_array_elements(coalesce(role_value->'occurrences','[]')) loop
    new_scene_id:=(scene_map->>(occurrence_value->>'scene_key'))::uuid;
    continue when new_scene_id is null or exists(select 1 from eps.scene_occurrences where scene_id=new_scene_id and role_id=current_role_id and archived_at is null);
    select coalesce(max(sort_order),-1)+1 into occurrence_order from eps.scene_occurrences where scene_id=new_scene_id;
    insert into eps.scene_occurrences(workspace_id,scene_id,role_id,display_title,status,source_refs,sort_order,proposal_base)
     values(p_job.workspace_id,new_scene_id,current_role_id,left(nullif(occurrence_value->>'display_title',''),300),'proposed',occurrence_value->'evidence',occurrence_order,
      jsonb_build_object('role_id',current_role_id,'role_row_version',1,'role_sha256',eps.scene_role_fingerprint(current_role_id),'source_job_id',p_job.id));
   end loop;
  end loop;
 end if;
 select coalesce(jsonb_agg(value||jsonb_build_object('resolved',false) order by ordinal),'[]') into working_clarifications_value from jsonb_array_elements(extraction->'clarifications') with ordinality entries(value,ordinal);
 marker_count:=marker_count+jsonb_array_length(working_clarifications_value);
 update eps.specs set normalized_instructions=extraction->>'general_instructions',clarifications=working_clarifications_value,source_extraction=extraction,source_extraction_job_id=p_job.id,
  source_language_codes=array(select jsonb_array_elements_text(extraction->'source_language_codes')),row_version=row_version+1,updated_at=clock_timestamp()
  where id=spec.id and row_version=spec.row_version and processing_job_id=p_job.id;
 get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
 perform eps.specs_stage_assert(exists(select 1 from eps.specs current_spec where current_spec.id=spec.id and current_spec.workspace_id=p_job.workspace_id
  and current_spec.row_version=spec.row_version+1 and current_spec.source_text is not distinct from spec.source_text
  and current_spec.source_asset_id is not distinct from spec.source_asset_id and current_spec.source_row_version=spec.source_row_version
  and current_spec.processing_job_id=p_job.id and current_spec.normalized_instructions is not distinct from extraction->>'general_instructions'
  and current_spec.clarifications=working_clarifications_value and current_spec.source_extraction=extraction and current_spec.source_extraction_job_id=p_job.id
  and current_spec.source_language_codes=array(select jsonb_array_elements_text(extraction->'source_language_codes'))),'STAGE_STATE_INVALID');
 update eps.workspaces set row_version=row_version+1,draft_revision=draft_revision+1,has_unpublished_changes=true,updated_at=clock_timestamp()
  where id=p_job.workspace_id and row_version=workspace_version;
 get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
 perform eps.specs_stage_assert(exists(select 1 from eps.workspaces where id=p_job.workspace_id and row_version=workspace_version+1 and draft_revision=workspace_draft+1 and has_unpublished_changes)
  and (select count(*) from eps.roles where workspace_id=p_job.workspace_id and archived_at is null)=role_index
  and (select count(*) from eps.slots where workspace_id=p_job.workspace_id and archived_at is null)=slot_count,'STAGE_STATE_INVALID');
 insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type) values(p_job.requested_by,'jobs.apply_specs',spec.id,p_job.correlation_id,'api');
 get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
 perform eps.specs_stage_assert(eps.specs_stage_can_write(p_job.requested_by,p_job.workspace_id),'CAPABILITY_REQUIRED');
 return jsonb_build_object('specs_id',spec.id,'workspace_id',p_job.workspace_id,'role_count',role_index,'slot_count',slot_count,'clarification_count',marker_count);
end $function$;

-- 6. Ownership and grants ----------------------------------------------------------------------
grant create on schema eps,public to eps_specs_owner;
do $$ declare routine regprocedure; begin
  foreach routine in array array['eps.scene_check_text(jsonb,integer,boolean)','eps.scene_check_requirements(jsonb)','eps.scene_uuid_list(jsonb,integer)',
    'eps.scene_role_fingerprint(uuid)','eps.scene_occurrence_dto(uuid)','eps.scene_dto(uuid)','eps.scene_write_scope(uuid)','eps.scene_require_key(text)',
    'eps.scene_check_occurrence_fields(jsonb)','eps.scene_occurrence_write(uuid,jsonb,text,text)','eps.scene_review(uuid,jsonb,text,text)',
    'public.eps_list_scenes(uuid,text,integer)','public.eps_create_scene(uuid,jsonb,text)','public.eps_update_scene(uuid,jsonb,text)',
    'public.eps_reorder_scenes(uuid,jsonb,text)','public.eps_archive_scene(uuid,jsonb,text)','public.eps_link_scene_occurrence(uuid,jsonb,text)',
    'public.eps_update_scene_occurrence(uuid,jsonb,text)','public.eps_unlink_scene_occurrence(uuid,jsonb,text)','public.eps_list_role_occurrences(uuid)',
    'public.eps_confirm_scene_proposals(uuid,jsonb,text)','public.eps_reject_scene_proposals(uuid,jsonb,text)']::regprocedure[] loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',routine);
    execute format('alter function %s owner to eps_specs_owner',routine);
    if (select n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid=routine)='public' then execute format('grant execute on function %s to authenticated',routine); end if;
  end loop;
end $$;
revoke create on schema eps,public from eps_specs_owner;
-- The import computes the proposal fingerprint; the guard trigger runs for every writer.
revoke all on function eps.scene_occurrence_guard() from public,anon,authenticated,service_role;
grant execute on function eps.scene_role_fingerprint(uuid) to eps_specs_apply_owner;

do $$ begin
  if (select pg_get_userbyid(proowner) from pg_proc where oid='eps.specs_stage_apply(eps.jobs)'::regprocedure)<>'eps_specs_apply_owner'
    or not has_function_privilege('eps_specs_stage_owner','eps.specs_stage_apply(eps.jobs)','execute')
    or has_function_privilege('anon','public.eps_create_scene(uuid,jsonb,text)','execute')
    or not has_function_privilege('authenticated','public.eps_list_scenes(uuid,text,integer)','execute')
    or has_function_privilege('authenticated','eps.scene_review(uuid,jsonb,text,text)','execute') then
    raise exception 'M17_SCENES_STATE_INVALID';
  end if;
end $$;
