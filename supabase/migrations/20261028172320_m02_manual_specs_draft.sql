-- M02 manual draft foundation, promoted from the independently reviewed local
-- rollback candidate. Apply only through the coordinated reviewed migration runner.
-- No new cloud data, specs upload purpose, source setter, job enqueue or callback.
-- Source/evidence columns are reserved for a later source/lease-validated commit.
-- Pure types/planner: packages/domain/src/specs-types.ts and specs.ts.
-- SQL mirrors that contract; runtime callers have no direct table authority.
-- Sources: https://supabase.com/docs/guides/database/functions
-- https://supabase.com/docs/guides/database/postgres/row-level-security
-- https://www.postgresql.org/docs/17/explicit-locking.html
set local lock_timeout='3s';
set local statement_timeout='30s';
set local search_path='';
do $$ begin
  if current_user<>'postgres' or current_database()<>'postgres'
    or (select array_agg(version order by version) from supabase_migrations.schema_migrations)
      is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800']::text[]
    or to_regclass('eps.specs') is not null or to_regclass('eps.roles') is not null or to_regclass('eps.slots') is not null
    or to_regclass('eps.assignments') is not null or exists(select 1 from pg_roles where rolname in('eps_specs_owner','eps_specs_initializer'))
    or exists(select 1 from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace
      where ns.nspname='eps' and proc.proname like 'specs\_%' escape '\'
        or ns.nspname='public' and proc.proname in('eps_get_specs','eps_update_specs','eps_list_roles','eps_create_role','eps_update_role','eps_list_slots','eps_resize_role_slots','eps_archive_role','eps_update_slot'))
  then raise exception 'M02_SPECS_REVIEWED_SEVEN_VERSION_BASELINE_REQUIRED'; end if;
end $$;

create role eps_specs_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
create role eps_specs_initializer nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_specs_owner,eps_specs_initializer to postgres;
grant authenticated to eps_specs_owner with inherit true,set false,admin false;
grant usage on schema eps,public to eps_specs_owner;
grant usage on schema eps to eps_specs_initializer;
create table eps.specs (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null unique references eps.workspaces(id) on delete restrict,
  source_asset_id uuid references eps.media_assets(id) on delete restrict, source_text text,
  normalized_instructions text, clarifications jsonb not null default '[]' check(jsonb_typeof(clarifications)='array'),
  source_extraction jsonb check(source_extraction is null or jsonb_typeof(source_extraction)='object'),
  source_language_codes text[] not null default '{}',
  source_row_version bigint not null default 1 check(source_row_version between 1 and 9007199254740991),
  processing_job_id uuid references eps.jobs(id) on delete restrict,
  row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),
  created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
  unique(workspace_id,id)
);
create index specs_source_asset_idx on eps.specs(source_asset_id) where source_asset_id is not null;
create index specs_processing_job_idx on eps.specs(processing_job_id) where processing_job_id is not null;
create table eps.roles (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references eps.workspaces(id) on delete restrict,
  spec_id uuid, name text not null, headcount bigint check(headcount between 1 and 9007199254740991), category text,
  requirements jsonb not null check(jsonb_typeof(requirements)='object'),
  clarifications jsonb not null default '[]' check(jsonb_typeof(clarifications)='array'),
  source_role jsonb check(source_role is null or jsonb_typeof(source_role)='object'),
  sort_order bigint not null check(sort_order between 0 and 9007199254740991), archived_at timestamptz,
  row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),
  created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
  unique(workspace_id,id), foreign key(workspace_id,spec_id) references eps.specs(workspace_id,id) on delete restrict
);
create index roles_workspace_order_idx on eps.roles(workspace_id,sort_order,id) where archived_at is null;
create index roles_spec_idx on eps.roles(workspace_id,spec_id) where spec_id is not null;
create table eps.slots (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references eps.workspaces(id) on delete restrict,
  role_id uuid not null, ordinal bigint not null check(ordinal between 1 and 9007199254740991), label text not null,
  sort_order bigint not null check(sort_order between 0 and 9007199254740991),
  provisional boolean not null default false, archived_at timestamptz,
  row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),
  created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
  unique(workspace_id,id), foreign key(workspace_id,role_id) references eps.roles(workspace_id,id) on delete restrict
);
create unique index slots_active_ordinal_unique on eps.slots(role_id,ordinal) where archived_at is null;
create index slots_role_order_idx on eps.slots(role_id,sort_order,id);
create index slots_workspace_idx on eps.slots(workspace_id);
comment on column eps.specs.source_text is 'Original prepared/pasted evidence, never replaced by a normalized display edit. No public setter until scoped submit/apply is implemented.';
comment on column eps.roles.source_role is 'Single immutable original extraction evidence, separate from working edits; not a revision history. No public setter.';
comment on column eps.slots.provisional is 'Technical single-slot default for unknown headcount; headcount itself remains NULL.';

alter table eps.specs enable row level security;
alter table eps.specs force row level security;
alter table eps.roles enable row level security;
alter table eps.roles force row level security;
alter table eps.slots enable row level security;
alter table eps.slots force row level security;
revoke all on eps.specs,eps.roles,eps.slots from public,anon,authenticated,service_role,eps_api_owner,eps_jobs_owner,eps_jobs_dispatcher;
grant select on eps.specs,eps.roles,eps.slots to eps_specs_owner;
-- The manual role cannot insert or replace source evidence or resource identity.
-- Default Spec creation belongs only to the narrow workspace initializer.
grant update(normalized_instructions,clarifications,row_version,updated_at) on eps.specs to eps_specs_owner;
grant insert(workspace_id,name,headcount,category,requirements,clarifications,sort_order),
  update(name,category,requirements,clarifications,headcount,archived_at,row_version,updated_at) on eps.roles to eps_specs_owner;
grant insert(workspace_id,role_id,ordinal,label,sort_order,provisional),
  update(label,provisional,archived_at,row_version,updated_at) on eps.slots to eps_specs_owner;
grant insert(workspace_id) on eps.specs to eps_specs_initializer;
grant select(id,project_id,archived_at,row_version,draft_revision),update(row_version,draft_revision,has_unpublished_changes,updated_at) on eps.workspaces to eps_specs_owner;
grant select,insert on eps.idempotency_records to eps_specs_owner;
grant insert on eps.audit_events to eps_specs_owner;
grant execute on function eps.fail(text,text,integer,bigint),eps.has_capability(text),eps.require_capability(text),eps.project_scope(uuid,boolean),
  eps.check_input(jsonb,text[]),eps.input_uuid(text),eps.expected_version(jsonb,text),eps.idempotency_begin(text,text,jsonb),
  eps.finish_mutation(text,text,jsonb,jsonb,uuid),eps.page_result(jsonb[],integer) to eps_specs_owner;
create policy specs_workspace_identity on eps.workspaces for select to eps_specs_owner
  using(archived_at is null and eps.project_scope(project_id,false) and (eps.has_capability('workspaces.read') or eps.has_capability('workspaces.write')));
create policy specs_workspace_update on eps.workspaces for update to eps_specs_owner
  using(archived_at is null and eps.project_scope(project_id,true) and eps.has_capability('workspaces.write'))
  with check(archived_at is null and eps.project_scope(project_id,true) and eps.has_capability('workspaces.write'));
create function eps.specs_scope(p_workspace uuid,p_write boolean default false) returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from eps.workspaces workspace join public.projects project on project.id=workspace.project_id
    where workspace.id=p_workspace and workspace.archived_at is null and project.archived_at is null
      and eps.project_scope(project.id,p_write) and eps.has_capability(case when p_write then 'workspaces.write' else 'workspaces.read' end))
$$;
create policy specs_read on eps.specs for select to eps_specs_owner using(eps.specs_scope(workspace_id,false) or eps.specs_scope(workspace_id,true));
create policy specs_insert on eps.specs for insert to eps_specs_owner with check(eps.specs_scope(workspace_id,true));
-- Initializer has only INSERT(workspace_id), reached exclusively from the fixed
-- workspace INSERT trigger. It cannot read/update source, roles, grants or jobs.
create policy specs_initialize_insert on eps.specs for insert to eps_specs_initializer with check(true);
create policy specs_update on eps.specs for update to eps_specs_owner using(eps.specs_scope(workspace_id,true)) with check(eps.specs_scope(workspace_id,true));
create policy roles_read on eps.roles for select to eps_specs_owner using(eps.specs_scope(workspace_id,false) or eps.specs_scope(workspace_id,true));
create policy roles_insert on eps.roles for insert to eps_specs_owner with check(eps.specs_scope(workspace_id,true));
create policy roles_update on eps.roles for update to eps_specs_owner using(eps.specs_scope(workspace_id,true)) with check(eps.specs_scope(workspace_id,true));
create policy slots_read on eps.slots for select to eps_specs_owner using(eps.specs_scope(workspace_id,false) or eps.specs_scope(workspace_id,true));
create policy slots_insert on eps.slots for insert to eps_specs_owner with check(eps.specs_scope(workspace_id,true));
create policy slots_update on eps.slots for update to eps_specs_owner using(eps.specs_scope(workspace_id,true)) with check(eps.specs_scope(workspace_id,true));
create policy specs_idempotency on eps.idempotency_records for all to eps_specs_owner
  using(principal_id=auth.uid() and operation in('specs.update_specs','specs.create_role','specs.update_role','specs.archive_role','specs.resize_role_slots','specs.update_slot'))
  with check(principal_id=auth.uid() and operation in('specs.update_specs','specs.create_role','specs.update_role','specs.archive_role','specs.resize_role_slots','specs.update_slot'));
create policy specs_audit on eps.audit_events for insert to eps_specs_owner with check(principal_id=auth.uid() and action in('specs.update_specs','specs.create_role','specs.update_role','specs.archive_role','specs.resize_role_slots','specs.update_slot'));
-- Inherited authenticated membership supplies Auth usage, never Storage authority.
create policy eps_specs_no_objects on storage.objects as restrictive for all to eps_specs_owner using(false) with check(false);
create policy eps_specs_no_buckets on storage.buckets as restrictive for all to eps_specs_owner using(false) with check(false);

create function eps.specs_check_body(p_input jsonb,p_fields text[]) returns void language plpgsql immutable security invoker set search_path='' as $$ begin
  perform eps.check_input(p_input,p_fields);
  if octet_length(p_input::text)>65536 then perform eps.fail('INVALID_REQUEST','Specs mutation exceeds the request byte limit.',400); end if;
end $$;
create function eps.specs_check_text(p_value jsonb,p_nullable boolean default true) returns void language plpgsql immutable security invoker set search_path='' as $$ begin
  if p_value is null or not(jsonb_typeof(p_value)='string' or p_nullable and p_value='null'::jsonb)
  then perform eps.fail('INVALID_REQUEST','Expected text or a permitted null value.',400); end if;
end $$;
create function eps.specs_check_requirements(p_value jsonb) returns void language plpgsql immutable security invoker set search_path='' as $$
declare key text; begin
  perform eps.check_input(p_value,array['age_range','gender_requirement','appearance_performance','languages','accents','skills','scene_references','shoot_dates','location','availability_requirements','other_instructions']);
  foreach key in array array['age_range','gender_requirement','appearance_performance','location','availability_requirements','other_instructions'] loop
    perform eps.specs_check_text(p_value->key,true);
  end loop;
  foreach key in array array['languages','accents','skills','scene_references','shoot_dates'] loop
    if jsonb_typeof(p_value->key) is distinct from 'array' then perform eps.fail('INVALID_REQUEST','Requirement arrays are required.',400); end if;
    if exists(select 1 from jsonb_array_elements(p_value->key) item where jsonb_typeof(item)<>'string')
    then perform eps.fail('INVALID_REQUEST','Requirement arrays contain only text.',400); end if;
  end loop;
end $$;
create function eps.specs_check_clarifications(p_value jsonb) returns void language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb; source jsonb; key text; minimum integer; begin
  if jsonb_typeof(p_value) is distinct from 'array' then perform eps.fail('INVALID_REQUEST','Clarifications must be an array.',400); end if;
  for item in select value from jsonb_array_elements(p_value) loop
    perform eps.check_input(item,array['field_path','reason','source','resolved']);
    perform eps.specs_check_text(item->'field_path',false); perform eps.specs_check_text(item->'reason',false);
    if jsonb_typeof(item->'resolved') is distinct from 'boolean' or not(item?'source') then perform eps.fail('INVALID_REQUEST','Each clarification requires its source and resolution state.',400); end if;
    source:=item->'source';
    if source<>'null'::jsonb then
      perform eps.check_input(source,array['asset_id','page','paragraph','segment_index','start_ms','end_ms','quote']);
      perform eps.specs_check_text(source->'asset_id',true); perform eps.specs_check_text(source->'quote',true);
      if source->'asset_id'<>'null'::jsonb and length(source->>'asset_id') not between 1 and 200 then perform eps.fail('INVALID_REQUEST','Invalid source identifier.',400); end if;
      foreach key in array array['page','paragraph','segment_index','start_ms','end_ms'] loop
        minimum:=case when key='page' then 1 else 0 end;
        if not(source?key) then perform eps.fail('INVALID_REQUEST','Source coordinates must be explicit.',400); end if;
        if source->key<>'null'::jsonb and (jsonb_typeof(source->key)<>'number' or (source->>key)!~'^[0-9]+$') then perform eps.fail('INVALID_REQUEST','Invalid source coordinate.',400); end if;
        if source->key<>'null'::jsonb and ((source->>key)::numeric<minimum or (source->>key)::numeric>9007199254740991) then perform eps.fail('INVALID_REQUEST','Invalid source coordinate.',400); end if;
      end loop;
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_value) as entries(value) group by entries.value-'resolved' having count(*)>1)
  then perform eps.fail('INVALID_REQUEST','A clarification update may identify each source marker once.',400); end if;
end $$;
create function eps.specs_merge_clarifications(p_current jsonb,p_updates jsonb) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare remaining jsonb:=coalesce(p_updates,'[]'); result jsonb:='[]'; item jsonb; replacement jsonb; position bigint; begin
  for item in select value from jsonb_array_elements(p_current) loop
    select value,ordinality into replacement,position from jsonb_array_elements(remaining) with ordinality where value-'resolved'=item-'resolved' limit 1;
    result:=result||jsonb_build_array(case when found then replacement else item end);
    if found then remaining:=remaining-(position::integer-1); end if;
  end loop;
  return result||remaining;
end $$;
create function eps.specs_count(p_value jsonb,p_nullable boolean default true) returns bigint language plpgsql immutable security invoker set search_path='' as $$ begin
  if p_nullable and p_value='null'::jsonb then return null; end if;
  if jsonb_typeof(p_value) is distinct from 'number' or p_value::text!~'^[1-9][0-9]*$' then perform eps.fail('INVALID_REQUEST','Headcount must be a positive integer or a permitted null.',400); end if;
  if p_value::numeric>9007199254740991 then perform eps.fail('INVALID_REQUEST','Headcount exceeds the exact integer range.',400); end if;
  return p_value::text::bigint;
end $$;
create function eps.specs_check_allocation(p_new bigint) returns void language plpgsql immutable security invoker set search_path='' as $$ begin
  -- Operational materialization budget, matching the neutral planner default.
  -- Do not truncate headcount or accept a caller-controlled session override.
  if p_new>1000 then perform eps.fail('SLOT_ALLOCATION_LIMIT_EXCEEDED','This operation exceeds the new-slot transaction budget.',422); end if;
end $$;
create function eps.specs_assert_rows(p_actual bigint,p_expected bigint) returns void language plpgsql immutable security invoker set search_path='' as $$ begin
  if p_actual is distinct from p_expected then perform eps.fail('SPECS_STATE_INVALID','The draft mutation did not apply its complete expected effect.',409); end if;
end $$;
create function eps.specs_assert_slots(p_role uuid,p_expected bigint,p_provisional boolean) returns void language plpgsql volatile security invoker set search_path='' as $$
declare actual bigint; begin
  select count(*) into actual from eps.slots where role_id=p_role and archived_at is null;
  perform eps.specs_assert_rows(actual,p_expected);
  if exists(select 1 from eps.slots where role_id=p_role and archived_at is null and provisional is distinct from p_provisional)
  then perform eps.fail('SPECS_STATE_INVALID','The draft slot provisional state is inconsistent.',409); end if;
end $$;
create function eps.specs_lock_workspace(p_workspace uuid) returns void language plpgsql volatile security invoker set search_path='' as $$ begin
  perform eps.require_capability('workspaces.write');
  perform 1 from eps.workspaces where id=p_workspace and eps.specs_scope(id,true) for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  -- Separate VOLATILE command takes a fresh post-wait READ COMMITTED snapshot.
  perform eps.require_capability('workspaces.write');
  if not eps.specs_scope(p_workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
end $$;
create function eps.specs_changed(p_workspace uuid) returns void language plpgsql security invoker set search_path='' as $$
declare changed integer; begin
  update eps.workspaces set row_version=row_version+1,draft_revision=draft_revision+1,has_unpublished_changes=true,updated_at=clock_timestamp()
    where id=p_workspace and eps.specs_scope(id,true);
  get diagnostics changed=row_count;
  if changed<>1 then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
end $$;
create function eps.specs_retirement_gate() returns void language plpgsql volatile security invoker set search_path='' as $$ begin
  -- M04 must replace this with the actual scoped assignment locks+archival+Undo
  -- before enabling assignment storage. There is no guessed assignment schema.
  -- Reject even a view/partitioned relation under the documented canonical name.
  if to_regclass('eps.assignments') is not null then
    perform eps.fail('ASSIGNMENT_RETIREMENT_UNAVAILABLE','Assignment retirement must be integrated before archiving slots.',503);
  end if;
end $$;
create function eps.specs_dto(p_workspace uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',id,'workspace_id',workspace_id,'source_asset_id',source_asset_id,'source_text',source_text,
    'normalized_instructions',normalized_instructions,'clarifications',clarifications,'row_version',row_version,'processing_job_id',processing_job_id)
    from eps.specs where workspace_id=p_workspace
$$;
create function eps.specs_role_dto(p_role uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',id,'workspace_id',workspace_id,'name',name,'headcount',headcount,'category',category,'requirements',requirements,
    'clarifications',clarifications,'sort_order',sort_order,'row_version',row_version,'archived',archived_at is not null) from eps.roles where id=p_role
$$;
create function eps.specs_slot_dto(p_slot uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',id,'role_id',role_id,'label',label,'sort_order',sort_order,'row_version',row_version,'archived',archived_at is not null) from eps.slots where id=p_slot
$$;

-- Atomic empty-draft creation, including canonical workspaces predating M02.
-- The trigger does NOT create a job/source/role and is not exposed as an RPC.
-- A workspace insert is already subject to its authorized mutation. A separate
-- non-owner/non-BYPASS initializer can insert only its new empty working record.
create function eps.specs_initialize_workspace() returns trigger language plpgsql security definer set search_path='' as $$
declare changed bigint; begin
  if tg_table_schema<>'eps' or tg_table_name<>'workspaces' or tg_op<>'INSERT' then raise exception 'SPECS_WORKSPACE_TRIGGER_CONTEXT_REQUIRED'; end if;
  insert into eps.specs(workspace_id) values(new.id);
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'SPECS_INITIALIZATION_FAILED'; end if;
  return new;
end $$;
create trigger specs_initialize_workspace after insert on eps.workspaces for each row execute function eps.specs_initialize_workspace();
insert into eps.specs(workspace_id) select id from eps.workspaces on conflict(workspace_id) do nothing;

create function public.eps_get_specs(p_workspace_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
  perform eps.require_capability('workspaces.read');
  if not eps.specs_scope(p_workspace_id,false) then perform eps.fail('RESOURCE_NOT_FOUND','Workspace not found.',404); end if;
  result:=eps.specs_dto(p_workspace_id);
  if result is null then perform eps.fail('DEPENDENCY_UNAVAILABLE','The persistent working specification is unavailable.',503); end if;
  return result;
end $$;
create function public.eps_update_specs(p_workspace_id uuid,p_input jsonb,p_idempotency_key text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare spec eps.specs; payload jsonb; result jsonb; changed bigint; begin
  perform eps.require_capability('workspaces.write'); perform eps.specs_check_body(p_input,array['row_version','normalized_instructions','clarifications']);
  if p_input?'normalized_instructions' then perform eps.specs_check_text(p_input->'normalized_instructions'); end if;
  if p_input?'clarifications' then perform eps.specs_check_clarifications(p_input->'clarifications'); end if;
  if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  payload:=jsonb_build_object('id',p_workspace_id,'input',p_input); result:=eps.idempotency_begin('specs.update_specs',p_idempotency_key,payload);
  perform eps.specs_lock_workspace(p_workspace_id); if result is not null then return result; end if;
  select * into spec from eps.specs where workspace_id=p_workspace_id for update;
  if not found then perform eps.fail('DEPENDENCY_UNAVAILABLE','Working specification missing.',503); end if;
  if eps.expected_version(p_input)<>spec.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Specification changed.',409,spec.row_version); end if;
  update eps.specs set normalized_instructions=case when p_input?'normalized_instructions' then p_input->>'normalized_instructions' else normalized_instructions end,
    clarifications=eps.specs_merge_clarifications(clarifications,p_input->'clarifications'),row_version=row_version+1,updated_at=clock_timestamp() where id=spec.id;
  get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
  perform eps.specs_changed(p_workspace_id);
  return eps.finish_mutation('specs.update_specs',p_idempotency_key,payload,eps.specs_dto(p_workspace_id),spec.id);
end $$;
create function public.eps_list_roles(p_workspace_id uuid,p_cursor text default null,p_limit integer default 25) returns jsonb language plpgsql security definer set search_path='' as $$
declare cursor_id uuid; cursor_sort bigint; items jsonb[]; begin
  perform eps.require_capability('workspaces.read');
  if not eps.specs_scope(p_workspace_id,false) then perform eps.fail('RESOURCE_NOT_FOUND','Workspace not found.',404); end if;
  if p_limit is null or p_limit not between 1 and 100 then perform eps.fail('INVALID_REQUEST','Invalid page size.',400); end if;
  if p_cursor is not null then
    cursor_id:=eps.input_uuid(p_cursor); select sort_order into cursor_sort from eps.roles where id=cursor_id and workspace_id=p_workspace_id and archived_at is null;
    if not found then perform eps.fail('INVALID_REQUEST','Cursor is not in this active role list.',400); end if;
  end if;
  select coalesce(array_agg(dto order by sort_order,id),array[]::jsonb[]) into items from
    (select id,sort_order,eps.specs_role_dto(id) dto from eps.roles where workspace_id=p_workspace_id and archived_at is null
      and (cursor_id is null or (sort_order,id)>(cursor_sort,cursor_id)) order by sort_order,id limit p_limit+1) page;
  return eps.page_result(items,p_limit);
end $$;
create function public.eps_create_role(p_workspace_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare role eps.roles; payload jsonb; result jsonb; count bigint; order_value bigint; index bigint; markers jsonb:='[]'; changed bigint; begin
  perform eps.require_capability('workspaces.write'); perform eps.specs_check_body(p_input,array['name','headcount','category','requirements']);
  perform eps.specs_check_text(p_input->'name',false); perform eps.specs_check_requirements(p_input->'requirements'); count:=eps.specs_count(p_input->'headcount');
  if p_input?'category' then perform eps.specs_check_text(p_input->'category'); end if;
  perform eps.specs_check_allocation(coalesce(count,1));
  if p_idempotency_key is null then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key required.',400); end if;
  if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  payload:=jsonb_build_object('workspace_id',p_workspace_id,'input',p_input); result:=eps.idempotency_begin('specs.create_role',p_idempotency_key,payload);
  perform eps.specs_lock_workspace(p_workspace_id); if result is not null then return result; end if;
  if count is null then markers:=markers||jsonb_build_array(jsonb_build_object('field_path','headcount','reason','Headcount is not known. The single slot is provisional.','source',null,'resolved',false)); end if;
  if p_input->>'name'='' then markers:=markers||jsonb_build_array(jsonb_build_object('field_path','name','reason','Role name is not provided.','source',null,'resolved',false)); end if;
  select coalesce(max(sort_order),-1)+1 into order_value from eps.roles where workspace_id=p_workspace_id;
  insert into eps.roles(workspace_id,name,headcount,category,requirements,clarifications,sort_order)
    values(p_workspace_id,p_input->>'name',count,p_input->>'category',p_input->'requirements',markers,order_value) returning * into role;
  get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
  for index in 1..coalesce(count,1) loop
    insert into eps.slots(workspace_id,role_id,ordinal,label,sort_order,provisional)
      values(p_workspace_id,role.id,index,coalesce(nullif(role.name,''),'Slot')||' '||index::text,index-1,count is null);
    get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
  end loop;
  perform eps.specs_assert_slots(role.id,coalesce(count,1),count is null);
  perform eps.specs_changed(p_workspace_id);
  return eps.finish_mutation('specs.create_role',p_idempotency_key,payload,eps.specs_role_dto(role.id),role.id);
end $$;
create function public.eps_update_role(p_role_id uuid,p_input jsonb,p_idempotency_key text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare role eps.roles; workspace_id uuid; payload jsonb; result jsonb; changed bigint; begin
  perform eps.require_capability('workspaces.write'); perform eps.specs_check_body(p_input,array['row_version','name','category','requirements','clarifications']);
  if p_input?'name' then perform eps.specs_check_text(p_input->'name',false); end if;
  if p_input?'category' then perform eps.specs_check_text(p_input->'category'); end if;
  if p_input?'requirements' then perform eps.specs_check_requirements(p_input->'requirements'); end if;
  if p_input?'clarifications' then perform eps.specs_check_clarifications(p_input->'clarifications'); end if;
  select resource.workspace_id into workspace_id from eps.roles resource where resource.id=p_role_id and eps.specs_scope(resource.workspace_id,true);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Writable role not found.',404); end if;
  payload:=jsonb_build_object('id',p_role_id,'input',p_input); result:=eps.idempotency_begin('specs.update_role',p_idempotency_key,payload);
  perform eps.specs_lock_workspace(workspace_id); if result is not null then return result; end if;
  select * into role from eps.roles where id=p_role_id and archived_at is null for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active role not found.',404); end if;
  if eps.expected_version(p_input)<>role.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Role changed.',409,role.row_version); end if;
  update eps.roles set name=case when p_input?'name' then p_input->>'name' else name end,
    category=case when p_input?'category' then p_input->>'category' else category end,requirements=coalesce(p_input->'requirements',requirements),
    clarifications=eps.specs_merge_clarifications(clarifications,p_input->'clarifications'),row_version=row_version+1,updated_at=clock_timestamp() where id=role.id;
  get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
  perform eps.specs_changed(workspace_id);
  return eps.finish_mutation('specs.update_role',p_idempotency_key,payload,eps.specs_role_dto(role.id),role.id);
end $$;
create function public.eps_list_slots(p_role_id uuid,p_cursor text default null,p_limit integer default 25) returns jsonb language plpgsql security definer set search_path='' as $$
declare workspace_id uuid; cursor_id uuid; cursor_sort bigint; items jsonb[]; begin
  perform eps.require_capability('workspaces.read');
  select resource.workspace_id into workspace_id from eps.roles resource where resource.id=p_role_id and resource.archived_at is null and eps.specs_scope(resource.workspace_id,false);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active role not found.',404); end if;
  if p_limit is null or p_limit not between 1 and 100 then perform eps.fail('INVALID_REQUEST','Invalid page size.',400); end if;
  if p_cursor is not null then
    cursor_id:=eps.input_uuid(p_cursor); select sort_order into cursor_sort from eps.slots where id=cursor_id and role_id=p_role_id and archived_at is null;
    if not found then perform eps.fail('INVALID_REQUEST','Cursor is not in this active slot list.',400); end if;
  end if;
  select coalesce(array_agg(dto order by sort_order,id),array[]::jsonb[]) into items from
    (select id,sort_order,eps.specs_slot_dto(id) dto from eps.slots where role_id=p_role_id and archived_at is null
      and (cursor_id is null or (sort_order,id)>(cursor_sort,cursor_id)) order by sort_order,id limit p_limit+1) page;
  return eps.page_result(items,p_limit);
end $$;
create function public.eps_resize_role_slots(p_role_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare role eps.roles; workspace_id uuid; payload jsonb; result jsonb; desired bigint; retire uuid[]:='{}';
  active_count bigint; excess bigint; next_ordinal bigint; next_order bigint; index bigint; markers jsonb; changed bigint; provisional_count bigint; begin
  perform eps.require_capability('workspaces.write'); perform eps.specs_check_body(p_input,array['row_version','desired_count','retire_slot_ids']); desired:=eps.specs_count(p_input->'desired_count',false);
  if p_input?'retire_slot_ids' then
    if jsonb_typeof(p_input->'retire_slot_ids') is distinct from 'array'
      or exists(select 1 from jsonb_array_elements(p_input->'retire_slot_ids') item where jsonb_typeof(item)<>'string')
    then perform eps.fail('INVALID_REQUEST','Retirement choices must be slot identifiers.',400); end if;
    select coalesce(array_agg(eps.input_uuid(value)),array[]::uuid[]) into retire from jsonb_array_elements_text(p_input->'retire_slot_ids');
    if cardinality(retire)<>(select count(distinct item) from unnest(retire) item) then perform eps.fail('INVALID_REQUEST','A retirement choice may appear once.',400); end if;
  end if;
  if p_idempotency_key is null then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key required.',400); end if;
  select resource.workspace_id into workspace_id from eps.roles resource where resource.id=p_role_id and eps.specs_scope(resource.workspace_id,true);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Writable role not found.',404); end if;
  payload:=jsonb_build_object('id',p_role_id,'input',p_input); result:=eps.idempotency_begin('specs.resize_role_slots',p_idempotency_key,payload);
  perform eps.specs_lock_workspace(workspace_id); if result is not null then return result; end if;
  select * into role from eps.roles where id=p_role_id and archived_at is null for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active role not found.',404); end if;
  if eps.expected_version(p_input)<>role.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Role changed.',409,role.row_version); end if;
  perform 1 from eps.slots where role_id=role.id order by id for update;
  select count(*) into active_count from eps.slots where role_id=role.id and archived_at is null;
  if active_count<>coalesce(role.headcount,1) or exists(select 1 from eps.slots where role_id=role.id and archived_at is null and provisional is distinct from (role.headcount is null))
  then perform eps.fail('SPECS_STATE_INVALID','Active slot count/provisional state differs from working headcount.',409); end if;
  excess:=greatest(0,active_count-desired);
  if excess>0 and cardinality(retire)=0 then perform eps.fail('SLOT_RETIREMENT_REQUIRED','Choose the excess slots to archive.',409); end if;
  if cardinality(retire)<>excess or exists(select 1 from unnest(retire) selected where not exists(select 1 from eps.slots where id=selected and role_id=role.id and archived_at is null))
  then perform eps.fail('SLOT_RETIREMENT_INVALID','Retire exactly the selected excess active slots.',409); end if;
  perform eps.specs_check_allocation(greatest(0,desired-active_count));
  if excess>0 then perform eps.specs_retirement_gate(); end if;
  select count(*) into provisional_count from eps.slots where role_id=role.id and archived_at is null and provisional and not(id=any(retire));
  update eps.slots set archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp() where id=any(retire);
  get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,excess);
  update eps.slots set provisional=false,row_version=row_version+1,updated_at=clock_timestamp() where role_id=role.id and archived_at is null and provisional;
  get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,provisional_count);
  select coalesce(max(ordinal),0),coalesce(max(sort_order),-1) into next_ordinal,next_order from eps.slots where role_id=role.id;
  if desired>active_count then
    for index in 1..(desired-active_count) loop
      insert into eps.slots(workspace_id,role_id,ordinal,label,sort_order,provisional)
        values(workspace_id,role.id,next_ordinal+index,coalesce(nullif(role.name,''),'Slot')||' '||(next_ordinal+index)::text,next_order+index,false);
      get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
    end loop;
  end if;
  select coalesce(jsonb_agg(case when item->>'field_path'='headcount' then item||'{"resolved":true}'::jsonb else item end order by ordinality),'[]'::jsonb)
    into markers from jsonb_array_elements(role.clarifications) with ordinality item(item,ordinality);
  update eps.roles set headcount=desired,clarifications=markers,row_version=row_version+1,updated_at=clock_timestamp() where id=role.id;
  get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
  perform eps.specs_assert_slots(role.id,desired,false);
  perform eps.specs_changed(workspace_id);
  return eps.finish_mutation('specs.resize_role_slots',p_idempotency_key,payload,eps.specs_role_dto(role.id),role.id);
end $$;
create function public.eps_archive_role(p_role_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare role eps.roles; workspace_id uuid; payload jsonb; result jsonb; affected uuid[]; changed bigint; begin
  perform eps.require_capability('workspaces.write'); perform eps.specs_check_body(p_input,array['row_version','reason']);
  if p_input?'reason' then perform eps.specs_check_text(p_input->'reason',true); end if;
  if p_idempotency_key is null then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key required.',400); end if;
  select resource.workspace_id into workspace_id from eps.roles resource where resource.id=p_role_id and eps.specs_scope(resource.workspace_id,true);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Writable role not found.',404); end if;
  payload:=jsonb_build_object('id',p_role_id,'input',p_input); result:=eps.idempotency_begin('specs.archive_role',p_idempotency_key,payload);
  perform eps.specs_lock_workspace(workspace_id); if result is not null then return result; end if;
  select * into role from eps.roles where id=p_role_id and archived_at is null for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active role not found.',404); end if;
  if eps.expected_version(p_input)<>role.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Role changed.',409,role.row_version); end if;
  perform 1 from eps.slots where role_id=role.id order by id for update;
  perform eps.specs_retirement_gate();
  select array[role.id]||coalesce(array_agg(id order by sort_order,id),array[]::uuid[]) into affected from eps.slots where role_id=role.id and archived_at is null;
  update eps.slots set archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp() where role_id=role.id and archived_at is null;
  get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,cardinality(affected)-1);
  update eps.roles set archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp() where id=role.id;
  get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
  perform eps.specs_assert_slots(role.id,0,false);
  perform eps.specs_changed(workspace_id);
  return eps.finish_mutation('specs.archive_role',p_idempotency_key,payload,jsonb_build_object('success',true,'affected_ids',to_jsonb(affected)),role.id);
end $$;
create function public.eps_update_slot(p_slot_id uuid,p_input jsonb,p_idempotency_key text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare slot eps.slots; workspace_id uuid; parent_id uuid; payload jsonb; result jsonb; changed bigint; begin
  perform eps.require_capability('workspaces.write'); perform eps.specs_check_body(p_input,array['row_version','label']); perform eps.specs_check_text(p_input->'label',false);
  select resource.workspace_id,resource.role_id into workspace_id,parent_id from eps.slots resource where resource.id=p_slot_id and eps.specs_scope(resource.workspace_id,true);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Writable slot not found.',404); end if;
  payload:=jsonb_build_object('id',p_slot_id,'input',p_input); result:=eps.idempotency_begin('specs.update_slot',p_idempotency_key,payload);
  perform eps.specs_lock_workspace(workspace_id); if result is not null then return result; end if;
  perform 1 from eps.roles where id=parent_id and archived_at is null for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active role not found.',404); end if;
  select * into slot from eps.slots where id=p_slot_id and role_id=parent_id and archived_at is null for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active slot not found.',404); end if;
  if eps.expected_version(p_input)<>slot.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Slot changed.',409,slot.row_version); end if;
  update eps.slots set label=p_input->>'label',row_version=row_version+1,updated_at=clock_timestamp() where id=slot.id;
  get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
  perform eps.specs_changed(workspace_id);
  return eps.finish_mutation('specs.update_slot',p_idempotency_key,payload,eps.specs_slot_dto(slot.id),slot.id);
end $$;

-- Only this candidate's fixed function names; no changes to M01/jobs owners.
grant create on schema eps,public to eps_specs_owner;
grant create on schema eps to eps_specs_initializer;
do $$ declare routine record; begin
  for routine in select proc.oid::regprocedure signature,ns.nspname,proc.proname from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace
    where ns.nspname='eps' and proc.proname like 'specs\_%' escape '\'
      or ns.nspname='public' and proc.proname in('eps_get_specs','eps_update_specs','eps_list_roles','eps_create_role','eps_update_role','eps_list_slots','eps_resize_role_slots','eps_archive_role','eps_update_slot') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role,eps_api_owner,eps_jobs_owner,eps_jobs_dispatcher',routine.signature);
    if routine.proname='specs_initialize_workspace' then execute format('alter function %s owner to eps_specs_initializer',routine.signature);
    else execute format('alter function %s owner to eps_specs_owner',routine.signature); end if;
    if routine.nspname='public' then execute format('grant execute on function %s to authenticated',routine.signature); end if;
  end loop;
end $$;
revoke create on schema eps,public from eps_specs_owner;
revoke create on schema eps from eps_specs_initializer;
-- Neither source setters nor processing helpers are granted to the new owner.
-- Future M02 source/apply must recheck actual source versions, workspace revision,
-- job lease/input hash and output ownership atomically; this candidate does not.
-- Source processing, callback publication and assignment retirement remain separate.
