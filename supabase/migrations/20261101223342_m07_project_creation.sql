-- Additive canonical project creation. Supabase CLI 2.122.0 generated this file.
-- Existing workspaces, snapshots, capabilities and client memberships are unchanged.
begin;
set local search_path = '';
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $target$ begin
  if current_database() <> 'postgres' or current_user <> 'postgres' or session_user <> 'postgres'
    or (select count(*) from supabase_migrations.schema_migrations) <> 38
    or not exists(select 1 from supabase_migrations.schema_migrations where version='20261101110939')
    or to_regclass('eps.project_creation_intents') is not null
  then raise exception 'PROJECT_CREATION_EXACT_CANONICAL38_REQUIRED'; end if;
end $target$;

-- BEGIN PROJECT CREATION FUNCTIONAL CHANGE
create role eps_project_creator nologin noinherit nobypassrls;
grant eps_project_creator to postgres;
-- Managed Auth access follows the existing one-way inheritance pattern.
grant authenticated to eps_project_creator with inherit true, set false, admin false;
grant usage on schema public, eps to eps_project_creator;

create table eps.project_creation_intents (
  project_id uuid primary key references public.projects(id) on delete restrict,
  presentation_type text not null check (presentation_type in ('casting','wardrobe','art_direction','storyboard','vehicles_animals','fitting','pre_ppm','ppm','production_documents')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table eps.project_creation_intents enable row level security;
alter table eps.project_creation_intents force row level security;
revoke all on eps.project_creation_intents from public, anon, authenticated, service_role;
grant select on eps.project_creation_intents to eps_api_owner;
grant insert on eps.project_creation_intents to eps_project_creator;
create policy project_intent_read on eps.project_creation_intents for select to eps_api_owner
  using (eps.project_access(project_id,false));
create policy project_intent_insert on eps.project_creation_intents for insert to eps_project_creator
  with check (created_by=auth.uid() and project_id=nullif(current_setting('eps.project_create.new_id',true),'')::uuid);

grant insert (id,name,client_id) on public.projects to eps_project_creator;
grant insert (project_id,principal_id,can_write,active) on public.project_memberships to eps_project_creator;
grant select, insert on eps.idempotency_records to eps_project_creator;
grant insert on eps.audit_events to eps_project_creator;
create policy new_project_insert on public.projects for insert to eps_project_creator
  with check (id=nullif(current_setting('eps.project_create.new_id',true),'')::uuid
    and eps.has_capability('projects.read') and eps.has_capability('projects.write')
    and (client_id is null or eps.client_access(client_id,true)));
create policy creator_membership_insert on public.project_memberships for insert to eps_project_creator
  with check (project_id=nullif(current_setting('eps.project_create.new_id',true),'')::uuid and principal_id=auth.uid() and can_write and active);
create policy project_creator_idempotency on eps.idempotency_records for all to eps_project_creator
  using (principal_id=auth.uid() and operation='create_project') with check (principal_id=auth.uid() and operation='create_project');
create policy project_creator_audit on eps.audit_events for insert to eps_project_creator
  with check (principal_id=auth.uid() and action='create_project');
grant execute on function eps.fail(text,text,integer,bigint), eps.require_capability(text),
  eps.check_input(jsonb,text[]), eps.input_text(jsonb,text,integer,boolean), eps.input_uuid(text),
  eps.idempotency_begin(text,text,jsonb), eps.finish_mutation(text,text,jsonb,jsonb,uuid) to eps_project_creator;

-- Legacy projects retain their byte-equivalent DTO shape; only explicit intents add a field.
create or replace function eps.project_dto(p_project uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('id',p.id,'name',p.name,'client_id',p.client_id,'client_name',c.name,
    'client_logo_asset_id',c.logo_asset_id,'row_version',p.row_version,'client_row_version',c.row_version,
    'casting_workspace_id',w.id,'can_edit',eps.project_access(p.id,true))
    || case when i.project_id is null then '{}'::jsonb else jsonb_build_object('presentation_type',i.presentation_type) end
  from public.projects p left join public.clients c on c.id=p.client_id
  left join eps.workspaces w on w.project_id=p.id and w.archived_at is null
  left join eps.project_creation_intents i on i.project_id=p.id
  where p.id=p_project and p.archived_at is null
$$;

create function public.eps_list_project_clients(p_q text default '',p_cursor text default null,p_limit integer default 25)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare cursor_id uuid; items jsonb[]; begin
  perform eps.require_capability('projects.read'); perform eps.require_capability('projects.write');
  cursor_id:=eps.check_list(p_q,p_cursor,p_limit);
  select coalesce(array_agg(dto order by id),array[]::jsonb[]) into items from (
    select c.id,jsonb_build_object('id',c.id,'name',c.name,'row_version',c.row_version) dto
    from public.clients c where c.archived_at is null and eps.client_access(c.id,true)
      and (cursor_id is null or c.id>cursor_id) and c.name ilike '%'||p_q||'%'
    order by c.id limit p_limit+1
  ) selected;
  return eps.page_result(items,p_limit);
end $$;

create function public.eps_create_project(p_input jsonb,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare project_name text; type_key text; client_id uuid; new_id uuid; result jsonb; payload jsonb; begin
  perform eps.require_capability('projects.read'); perform eps.require_capability('projects.write');
  perform eps.check_input(p_input,array['name','presentation_type','client_id']);
  project_name:=eps.input_text(p_input,'name',500); type_key:=eps.input_text(p_input,'presentation_type',40);
  if project_name ~ '[[:cntrl:]]' or type_key not in ('casting','wardrobe','art_direction','storyboard','vehicles_animals','fitting','pre_ppm','ppm','production_documents')
    or p_idempotency_key is null or length(p_idempotency_key) not between 16 and 200
  then perform eps.fail('INVALID_REQUEST','Provide a valid name, presentation type and Idempotency-Key.',400); end if;
  if p_input?'client_id' then client_id:=eps.input_uuid(eps.input_text(p_input,'client_id',200)); end if;
  payload:=jsonb_build_object('name',project_name,'presentation_type',type_key)
    || case when client_id is null then '{}'::jsonb else jsonb_build_object('client_id',client_id) end;
  result:=eps.idempotency_begin('create_project',p_idempotency_key,payload);
  -- Recheck after the advisory wait; stale/revoked requests cannot return a receipt.
  perform eps.require_capability('projects.read'); perform eps.require_capability('projects.write');
  if client_id is not null and not exists(select 1 from public.clients c where c.id=client_id and c.archived_at is null and eps.client_access(c.id,true))
  then perform eps.fail('RESOURCE_NOT_FOUND','An authorized client was not found.',404); end if;
  if result is not null then
    if not eps.project_access(eps.input_uuid(result->>'id'),true)
      or not exists(select 1 from public.projects p where p.id=eps.input_uuid(result->>'id') and p.archived_at is null)
    then perform eps.fail('RESOURCE_NOT_FOUND','The created project is no longer accessible.',404); end if;
    return public.eps_get_project(eps.input_uuid(result->>'id'));
  end if;
  new_id:=gen_random_uuid(); perform set_config('eps.project_create.new_id',new_id::text,true);
  insert into public.projects(id,name,client_id) values(new_id,project_name,client_id);
  insert into public.project_memberships(project_id,principal_id,can_write,active) values(new_id,auth.uid(),true,true);
  insert into eps.project_creation_intents(project_id,presentation_type,created_by) values(new_id,type_key,auth.uid());
  result:=public.eps_get_project(new_id);
  return eps.finish_mutation('create_project',p_idempotency_key,payload,result,new_id);
end $$;

revoke all on function public.eps_list_project_clients(text,text,integer),public.eps_create_project(jsonb,text)
  from public,anon,authenticated,service_role;
grant create on schema public to eps_api_owner,eps_project_creator;
alter function public.eps_list_project_clients(text,text,integer) owner to eps_api_owner;
alter function public.eps_create_project(jsonb,text) owner to eps_project_creator;
revoke create on schema public from eps_api_owner,eps_project_creator;
grant execute on function public.eps_list_project_clients(text,text,integer),public.eps_create_project(jsonb,text) to authenticated;
notify pgrst,'reload schema';
-- END PROJECT CREATION FUNCTIONAL CHANGE
commit;
