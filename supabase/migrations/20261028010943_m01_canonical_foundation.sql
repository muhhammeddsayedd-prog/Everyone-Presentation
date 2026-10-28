-- M01 canonical foundation. Authoritative history: this repository, by owner decision.
-- Auth/storage managed schemas already exist. No users, projects, clients or cloud fixtures are seeded.
-- Curated user-scoped RPC only; no service-role credential is part of the user runtime.
-- Sources: https://supabase.com/docs/guides/database/functions
-- https://supabase.com/docs/guides/database/postgres/row-level-security
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create role eps_api_owner nologin noinherit nobypassrls;
create role eps_draft_owner nologin noinherit nobypassrls;
grant eps_api_owner, eps_draft_owner to postgres;
create schema eps;
revoke all on schema eps from public, anon, authenticated, service_role;
grant usage on schema eps to authenticated, eps_api_owner, eps_draft_owner;
grant usage on schema public, auth to eps_api_owner;
grant usage on schema public to eps_draft_owner;
grant execute on function auth.uid() to eps_api_owner, eps_draft_owner;
grant execute on function auth.jwt() to eps_api_owner;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 500),
  logo_asset_id uuid,
  archived_at timestamptz,
  row_version bigint not null default 1 check (row_version >= 1),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 500),
  archived_at timestamptz,
  row_version bigint not null default 1 check (row_version >= 1),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index projects_client_idx on public.projects(client_id);
create table public.project_memberships (
  project_id uuid not null references public.projects(id) on delete restrict,
  principal_id uuid not null references auth.users(id) on delete cascade,
  can_write boolean not null default false, active boolean not null default true,
  created_at timestamptz not null default now(), primary key (project_id, principal_id)
);
create index project_memberships_principal_idx on public.project_memberships(principal_id, project_id) where active;
create table public.client_memberships (
  client_id uuid not null references public.clients(id) on delete restrict,
  principal_id uuid not null references auth.users(id) on delete cascade,
  can_write boolean not null default false, active boolean not null default true,
  created_at timestamptz not null default now(), primary key (client_id, principal_id)
);
create index client_memberships_principal_idx on public.client_memberships(principal_id, client_id) where active;
create table public.app_capability_grants (
  principal_id uuid not null references auth.users(id) on delete cascade,
  capability text not null check (capability in ('projects.read','projects.write','workspaces.read','workspaces.write','cast.read','cast.upload','cast.write','cast.review','presentations.generate','review_links.manage','settings.manage','operations.read','operations.retry')),
  active boolean not null default true, created_at timestamptz not null default now(),
  primary key (principal_id, capability)
);
create table eps.workspaces (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  module text not null default 'casting' check (module = 'casting'),
  archived_at timestamptz, logo_asset_id uuid,
  logo_placement text not null default 'cover' check (logo_placement in ('cover','every_slide')),
  row_version bigint not null default 1 check (row_version >= 1),
  draft_revision bigint not null default 0 check (draft_revision >= 0),
  has_unpublished_changes boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_active_casting_workspace on eps.workspaces(project_id,module) where archived_at is null;
create table eps.user_workspace_preferences (
  principal_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references eps.workspaces(id) on delete restrict,
  active_output text not null check (active_output in ('selection','shortlist')),
  primary key (principal_id, workspace_id)
);
create index user_workspace_preferences_workspace_idx on eps.user_workspace_preferences(workspace_id);
create table eps.media_assets (
  id uuid primary key default gen_random_uuid(),
  origin_workspace_id uuid references eps.workspaces(id) on delete restrict,
  client_id uuid references public.clients(id) on delete restrict,
  purpose text not null check (purpose = 'client_logo'),
  filename text not null check (length(filename) between 1 and 255),
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp')),
  bucket text not null, object_key text not null,
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  sha256 text check (sha256 ~ '^[a-f0-9]{64}$'),
  width integer check (width > 0), height integer check (height > 0),
  status text not null check (status in ('uploading','ready','failed','quarantined','archived')),
  created_at timestamptz not null default now(),
  check (origin_workspace_id is not null or client_id is not null),
  check (status <> 'ready' or (sha256 is not null and width is not null and height is not null)),
  unique (bucket,object_key)
);
create index media_assets_workspace_idx on eps.media_assets(origin_workspace_id);
create index media_assets_client_idx on eps.media_assets(client_id);
alter table public.clients add constraint clients_logo_asset_fk foreign key (logo_asset_id) references eps.media_assets(id) on delete restrict;
alter table eps.workspaces add constraint workspaces_logo_asset_fk foreign key (logo_asset_id) references eps.media_assets(id) on delete restrict;
create index clients_logo_asset_idx on public.clients(logo_asset_id);
create index workspaces_logo_asset_idx on eps.workspaces(logo_asset_id);
create table eps.audience_presets (
  id uuid primary key default gen_random_uuid(), key text not null unique check (length(btrim(key)) between 1 and 100),
  label text not null check (length(btrim(label)) between 1 and 500),
  scope text not null check (scope in ('internal','external')),
  settings jsonb not null default '{}' check (settings = '{}'::jsonb),
  archived boolean not null default false,
  row_version bigint not null default 1 check (row_version >= 1)
);
create table eps.idempotency_records (
  principal_id uuid not null references auth.users(id) on delete cascade,
  operation text not null, key text not null check (length(key) between 1 and 200),
  request_hash text not null, response jsonb not null,
  created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours',
  primary key (principal_id,operation,key)
);
create table eps.audit_events (
  id uuid primary key default gen_random_uuid(),
  principal_id uuid not null references auth.users(id) on delete restrict,
  action text not null, resource_id uuid not null,
  request_id text check (request_id is null or request_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  client_type text not null default 'api' check (client_type in ('browser','api','mcp')),
  created_at timestamptz not null default now()
);
comment on column eps.audit_events.client_type is 'Declared client metadata for traceability, never an authorization source.';
create index audit_events_principal_created_idx on eps.audit_events(principal_id,created_at);

-- Owned by the migration administrator, not the runtime function roles.
do $policies$ declare target text; begin
  foreach target in array array['public.clients','public.projects','public.project_memberships','public.client_memberships','public.app_capability_grants','eps.workspaces','eps.user_workspace_preferences','eps.media_assets','eps.audience_presets','eps.idempotency_records','eps.audit_events'] loop
    execute format('alter table %s enable row level security',target);
    execute format('alter table %s force row level security',target);
    execute format('revoke all on table %s from public,anon,authenticated,service_role',target);
  end loop;
end $policies$;
grant select on public.clients,public.projects,public.project_memberships,public.client_memberships,public.app_capability_grants to authenticated,eps_api_owner;
grant update (name,logo_asset_id,row_version,updated_at) on public.clients to eps_api_owner;
grant update (name,row_version,updated_at) on public.projects to eps_api_owner;
grant select,insert,update on eps.workspaces,eps.user_workspace_preferences,eps.audience_presets to eps_api_owner;
grant select on eps.media_assets to eps_api_owner;
grant select,insert on eps.idempotency_records to eps_api_owner;
grant insert on eps.audit_events to eps_api_owner;

create function eps.fail(p_code text,p_message text,p_status integer default 422,p_current_version bigint default null)
returns void language plpgsql security invoker set search_path = '' as $$ begin
  raise exception using errcode='P0001',message=p_code,detail=jsonb_strip_nulls(jsonb_build_object('message',p_message,'status',p_status,'current_row_version',p_current_version))::text;
end $$;
create function eps.has_capability(p_capability text) returns boolean language sql stable security invoker set search_path = '' as $$
  select auth.uid() is not null and coalesce(auth.jwt()->'is_anonymous','false'::jsonb)='false'::jsonb
    and exists(select 1 from public.app_capability_grants g where g.principal_id=auth.uid() and g.capability=p_capability and g.active)
$$;
create function eps.require_capability(p_capability text) returns void language plpgsql stable security invoker set search_path = '' as $$ begin
  if auth.uid() is null then perform eps.fail('AUTH_REQUIRED','Sign in to continue.',401); end if;
  if not eps.has_capability(p_capability) then perform eps.fail('CAPABILITY_REQUIRED','This action is not permitted.',403); end if;
end $$;
create function eps.project_scope(p_project uuid,p_write boolean default false) returns boolean language sql stable security invoker set search_path = '' as $$
  select eps.has_capability('projects.read')
    and exists(select 1 from public.project_memberships m where m.project_id=p_project and m.principal_id=auth.uid() and m.active and (not p_write or m.can_write))
$$;
create function eps.project_access(p_project uuid,p_write boolean default false) returns boolean language sql stable security invoker set search_path = '' as $$
  select eps.project_scope(p_project,p_write) and (not p_write or eps.has_capability('projects.write'))
$$;
create function eps.client_access(p_client uuid,p_write boolean default false) returns boolean language sql stable security invoker set search_path = '' as $$
  select eps.has_capability(case when p_write then 'projects.write' else 'projects.read' end) and (
    exists(select 1 from public.client_memberships m where m.client_id=p_client and m.principal_id=auth.uid() and m.active and (not p_write or m.can_write))
    or (not p_write and exists(select 1 from public.projects p where p.client_id=p_client and p.archived_at is null)))
$$;
create policy grants_self on public.app_capability_grants for select to authenticated,eps_api_owner using (principal_id=(select auth.uid()));
create policy project_memberships_self on public.project_memberships for select to authenticated,eps_api_owner using (principal_id=(select auth.uid()));
create policy client_memberships_self on public.client_memberships for select to authenticated,eps_api_owner using (principal_id=(select auth.uid()));
create policy projects_read on public.projects for select to authenticated,eps_api_owner using (archived_at is null and eps.project_access(id,false));
create policy projects_write on public.projects for update to eps_api_owner using (archived_at is null and eps.project_access(id,true)) with check (archived_at is null and eps.project_access(id,true));
create policy clients_read on public.clients for select to authenticated,eps_api_owner using (archived_at is null and eps.client_access(id,false));
create policy clients_write on public.clients for update to eps_api_owner using (archived_at is null and eps.client_access(id,true)) with check (archived_at is null and eps.client_access(id,true));
create policy workspaces_read on eps.workspaces for select to eps_api_owner using (archived_at is null and eps.has_capability('workspaces.read') and eps.project_access(project_id,false) and exists(select 1 from public.projects p where p.id=project_id and p.archived_at is null));
create policy workspaces_write on eps.workspaces for all to eps_api_owner using (archived_at is null and eps.has_capability('workspaces.write') and eps.project_scope(project_id,true) and exists(select 1 from public.projects p where p.id=project_id and p.archived_at is null)) with check (archived_at is null and eps.has_capability('workspaces.write') and eps.project_scope(project_id,true) and exists(select 1 from public.projects p where p.id=project_id and p.archived_at is null));
create policy preferences_self on eps.user_workspace_preferences for all to eps_api_owner using (principal_id=auth.uid() and exists(select 1 from eps.workspaces w where w.id=workspace_id)) with check (principal_id=auth.uid() and exists(select 1 from eps.workspaces w where w.id=workspace_id));
create policy media_read on eps.media_assets for select to eps_api_owner using (
  exists(select 1 from eps.workspaces w where w.id=origin_workspace_id or w.logo_asset_id=media_assets.id)
  or (client_id is not null and eps.client_access(client_id,false))
  or exists(select 1 from public.clients c where c.logo_asset_id=media_assets.id)
);
create policy presets_read on eps.audience_presets for select to eps_api_owner using (eps.has_capability('workspaces.read') or eps.has_capability('settings.manage'));
create policy presets_manage on eps.audience_presets for all to eps_api_owner using (eps.has_capability('settings.manage')) with check (eps.has_capability('settings.manage'));
create policy idempotency_self on eps.idempotency_records for all to eps_api_owner using (principal_id=auth.uid()) with check (principal_id=auth.uid());
create policy audit_append on eps.audit_events for insert to eps_api_owner with check (principal_id=auth.uid());

-- Central changes invalidate future draft state across every affected workspace,
-- including projects the editing user cannot themselves open. This trigger role
-- can read only project identity/client relation and update only draft counters.
grant select (id,client_id) on public.projects to eps_draft_owner;
grant select (id,project_id,row_version,draft_revision),update (row_version,draft_revision,has_unpublished_changes,updated_at) on eps.workspaces to eps_draft_owner;
create policy draft_project_identity on public.projects for select to eps_draft_owner using (true);
create policy draft_workspace_read on eps.workspaces for select to eps_draft_owner using (true);
create policy draft_workspace_update on eps.workspaces for update to eps_draft_owner using (true) with check (true);
create function eps.invalidate_central_drafts() returns trigger language plpgsql security definer set search_path = '' as $$ begin
  if tg_table_name='projects' then
    update eps.workspaces w set row_version=w.row_version+1,draft_revision=w.draft_revision+1,has_unpublished_changes=true,updated_at=now() where w.project_id=new.id;
  else
    update eps.workspaces w set row_version=w.row_version+1,draft_revision=w.draft_revision+1,has_unpublished_changes=true,updated_at=now() where w.project_id in (select p.id from public.projects p where p.client_id=new.id);
  end if;
  return new;
end $$;
create trigger projects_invalidate_drafts after update of name on public.projects for each row when (old.name is distinct from new.name) execute function eps.invalidate_central_drafts();
create trigger clients_invalidate_drafts after update of name,logo_asset_id on public.clients for each row when (old.name is distinct from new.name or old.logo_asset_id is distinct from new.logo_asset_id) execute function eps.invalidate_central_drafts();

create function eps.check_input(p_input jsonb,p_allowed text[]) returns void language plpgsql immutable security invoker set search_path = '' as $$ begin
  if p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where not(k=any(p_allowed))) then perform eps.fail('INVALID_REQUEST','Unexpected or invalid request fields.',400); end if;
end $$;
create function eps.input_text(p_input jsonb,p_key text,p_max integer default 500,p_required boolean default true) returns text language plpgsql immutable security invoker set search_path = '' as $$ declare v text; begin
  if not(p_input?p_key) and not p_required then return null; end if;
  if jsonb_typeof(p_input->p_key) is distinct from 'string' then perform eps.fail('INVALID_REQUEST','A text field is required.',400); end if;
  v:=btrim(p_input->>p_key); if length(v)<1 or length(v)>p_max then perform eps.fail('INVALID_REQUEST','A text field is outside its allowed length.',400); end if; return v;
end $$;
create function eps.input_uuid(p_value text) returns uuid language plpgsql immutable security invoker set search_path = '' as $$ begin
  if p_value is null then perform eps.fail('INVALID_REQUEST','A resource identifier is required.',400); end if;
  return p_value::uuid;
exception when invalid_text_representation then perform eps.fail('INVALID_REQUEST','The resource identifier is invalid.',400); return null;
end $$;
create function eps.expected_version(p_input jsonb,p_key text default 'row_version') returns bigint language plpgsql immutable security invoker set search_path = '' as $$ begin
  if jsonb_typeof(p_input->p_key) is distinct from 'number' or (p_input->>p_key)!~'^[1-9][0-9]{0,14}$' then perform eps.fail('INVALID_REQUEST','A positive integer row version is required.',400); end if; return (p_input->>p_key)::bigint;
end $$;
create function eps.check_list(p_q text,p_cursor text,p_limit integer) returns uuid language plpgsql immutable security invoker set search_path = '' as $$ begin
  if p_q is null or length(p_q)>500 or p_limit is null or p_limit<1 or p_limit>100 then perform eps.fail('INVALID_REQUEST','Invalid search or page size.',400); end if;
  if p_cursor is null then return null; end if; return eps.input_uuid(p_cursor);
end $$;
create function eps.page_result(p_items jsonb[],p_limit integer) returns jsonb language sql immutable security invoker set search_path = '' as $$
  select jsonb_build_object('data',coalesce(to_jsonb(p_items[1:p_limit]),'[]'::jsonb),'page',jsonb_build_object('next_cursor',case when cardinality(p_items)>p_limit then p_items[p_limit]->>'id' else null end))
$$;
create function eps.idempotency_begin(p_operation text,p_key text,p_input jsonb) returns jsonb language plpgsql security invoker set search_path = '' as $$ declare old eps.idempotency_records; begin
  if p_key is null then return null; end if;
  if length(p_key)<1 or length(p_key)>200 then perform eps.fail('INVALID_REQUEST','A bounded Idempotency-Key is required.',400); end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_operation||':'||p_key,0));
  select * into old from eps.idempotency_records where principal_id=auth.uid() and operation=p_operation and key=p_key;
  if found then
    if old.request_hash<>encode(sha256(convert_to(p_input::text,'UTF8')),'hex') then perform eps.fail('IDEMPOTENCY_KEY_REUSED','This key was used with different input.',409); end if;
    if old.expires_at<now() then perform eps.fail('IDEMPOTENCY_WINDOW_EXPIRED','Use a new key after refreshing the current resource.',409); end if;
    return old.response;
  end if; return null;
end $$;
create function eps.finish_mutation(p_operation text,p_key text,p_input jsonb,p_response jsonb,p_resource uuid) returns jsonb language plpgsql security invoker set search_path = '' as $$ declare headers jsonb:='{}'; request_id text; client_type text; begin
  if p_key is not null then insert into eps.idempotency_records(principal_id,operation,key,request_hash,response) values(auth.uid(),p_operation,p_key,encode(sha256(convert_to(p_input::text,'UTF8')),'hex'),p_response); end if;
  begin headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb; exception when invalid_text_representation then headers:='{}'; end;
  if jsonb_typeof(headers) is distinct from 'object' then headers:='{}'; end if;
  request_id:=headers->>'x-eps-request-id';
  if request_id is not null and request_id!~'^[A-Za-z0-9._:-]{1,128}$' then request_id:=null; end if;
  client_type:=headers->>'x-eps-client-type'; if client_type is null or client_type not in ('browser','api','mcp') then client_type:='api'; end if;
  -- Headers are untrusted trace labels only. Persist this two-field allowlist,
  -- never the source header JSON, Authorization, API keys or token payloads.
  insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type) values(auth.uid(),p_operation,p_resource,request_id,client_type); return p_response;
end $$;
create function eps.project_dto(p_project uuid) returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('id',p.id,'name',p.name,'client_id',p.client_id,'client_name',c.name,'client_logo_asset_id',c.logo_asset_id,'row_version',p.row_version,'client_row_version',c.row_version,'casting_workspace_id',w.id,'can_edit',eps.project_access(p.id,true))
  from public.projects p left join public.clients c on c.id=p.client_id left join eps.workspaces w on w.project_id=p.id and w.archived_at is null where p.id=p_project and p.archived_at is null
$$;
create function eps.workspace_dto(p_workspace uuid) returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('id',w.id,'project_id',w.project_id,'module',w.module,'title',p.name,'logo_asset_id',w.logo_asset_id,'logo_placement',w.logo_placement,'active_output',coalesce(pref.active_output,'selection'),'row_version',w.row_version,'draft_revision',w.draft_revision,'has_unpublished_changes',w.has_unpublished_changes,'created_at',w.created_at,'updated_at',w.updated_at)
  from eps.workspaces w join public.projects p on p.id=w.project_id left join eps.user_workspace_preferences pref on pref.workspace_id=w.id and pref.principal_id=auth.uid() where w.id=p_workspace and w.archived_at is null
$$;
create function eps.require_ready_logo(p_asset uuid) returns void language plpgsql stable security invoker set search_path = '' as $$ begin
  if p_asset is not null and not exists(select 1 from eps.media_assets a where a.id=p_asset and a.status='ready' and a.purpose='client_logo') then perform eps.fail('RESOURCE_NOT_FOUND','A permitted verified logo asset was not found.',404); end if;
end $$;

create function public.eps_get_capabilities() returns jsonb language plpgsql stable security definer set search_path = '' as $$ begin
  if auth.uid() is null or coalesce(auth.jwt()->'is_anonymous','false'::jsonb)<>'false'::jsonb then perform eps.fail('AUTH_REQUIRED','An internal signed-in user is required.',401); end if;
  return jsonb_build_object('principal_id',auth.uid(),'capabilities',coalesce((select jsonb_agg(g.capability order by g.capability) from public.app_capability_grants g where g.principal_id=auth.uid() and g.active),'[]'::jsonb),'timezone','Africa/Cairo','enabled_modules',jsonb_build_array('casting'),'upload_policy',jsonb_build_object('allowed_mime_types',jsonb_build_array('image/png','image/jpeg','image/webp'),'maximum_file_bytes',5242880,'recommended_batch_size',200,'available_purposes','[]'::jsonb));
end $$;
create function public.eps_list_projects(p_q text default '',p_cursor text default null,p_limit integer default 25) returns jsonb language plpgsql stable security definer set search_path = '' as $$ declare cursor_id uuid; items jsonb[]; begin
  perform eps.require_capability('projects.read'); cursor_id:=eps.check_list(p_q,p_cursor,p_limit);
  select coalesce(array_agg(obj order by id),array[]::jsonb[]) into items from(select p.id,eps.project_dto(p.id) obj from public.projects p left join public.clients c on c.id=p.client_id where p.archived_at is null and (cursor_id is null or p.id>cursor_id) and (p.name||' '||coalesce(c.name,'')) ilike '%'||p_q||'%' order by p.id limit p_limit+1) selected;
  return eps.page_result(items,p_limit);
end $$;
create function public.eps_get_project(p_project_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$ declare result jsonb; begin
  perform eps.require_capability('projects.read'); result:=eps.project_dto(p_project_id);
  if result is null then perform eps.fail('RESOURCE_NOT_FOUND','Project not found.',404); end if; return result;
end $$;
create function public.eps_update_project(p_project_id uuid,p_input jsonb,p_idempotency_key text default null) returns jsonb language plpgsql security definer set search_path = '' as $$ declare p public.projects; c public.clients; result jsonb; payload jsonb; client_changed boolean; logo uuid; begin
  perform eps.require_capability('projects.write'); perform eps.check_input(p_input,array['row_version','name','client_name','client_logo_asset_id','expected_client_row_version']);
  select * into p from public.projects where id=p_project_id and eps.project_access(id,true);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Editable project not found.',404); end if;
  if (p_input?'client_name' or p_input?'client_logo_asset_id') and (p.client_id is null or not eps.client_access(p.client_id,true)) then perform eps.fail('CAPABILITY_REQUIRED','Canonical client write permission is required.',403); end if;
  payload:=jsonb_build_object('id',p_project_id,'input',p_input); result:=eps.idempotency_begin('update_project',p_idempotency_key,payload); if result is not null then return result; end if;
  select * into p from public.projects where id=p_project_id and eps.project_access(id,true) for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Editable project not found.',404); end if;
  if eps.expected_version(p_input)<>p.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Reload the project before saving.',409,p.row_version); end if;
  client_changed:=p_input?'client_name' or p_input?'client_logo_asset_id';
  if client_changed then
    if p.client_id is null then perform eps.fail('INVALID_REQUEST','This project has no canonical client.',400); end if;
    if not eps.client_access(p.client_id,true) then perform eps.fail('CAPABILITY_REQUIRED','Canonical client write permission is required.',403); end if;
    select * into c from public.clients where id=p.client_id for update;
    if not found then perform eps.fail('RESOURCE_NOT_FOUND','Client not found.',404); end if;
    if eps.expected_version(p_input,'expected_client_row_version')<>c.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Reload the client before saving.',409,c.row_version); end if;
    if p_input?'client_logo_asset_id' then
      if p_input->'client_logo_asset_id'='null'::jsonb then logo:=null; else logo:=eps.input_uuid(eps.input_text(p_input,'client_logo_asset_id',200)); end if; perform eps.require_ready_logo(logo);
    else logo:=c.logo_asset_id; end if;
    update public.clients set name=case when p_input?'client_name' then eps.input_text(p_input,'client_name') else c.name end,logo_asset_id=logo,row_version=row_version+1,updated_at=now() where id=c.id;
  end if;
  update public.projects set name=case when p_input?'name' then eps.input_text(p_input,'name') else p.name end,row_version=row_version+1,updated_at=now() where id=p.id;
  result:=eps.project_dto(p.id); return eps.finish_mutation('update_project',p_idempotency_key,payload,result,p.id);
end $$;
create function public.eps_list_workspaces(p_q text default '',p_cursor text default null,p_limit integer default 25,p_project_id uuid default null) returns jsonb language plpgsql stable security definer set search_path = '' as $$ declare cursor_id uuid; items jsonb[]; begin
  perform eps.require_capability('workspaces.read'); cursor_id:=eps.check_list(p_q,p_cursor,p_limit);
  select coalesce(array_agg(obj order by id),array[]::jsonb[]) into items from(select w.id,eps.workspace_dto(w.id) obj from eps.workspaces w join public.projects p on p.id=w.project_id where w.archived_at is null and (p_project_id is null or w.project_id=p_project_id) and (cursor_id is null or w.id>cursor_id) and p.name ilike '%'||p_q||'%' order by w.id limit p_limit+1) selected;
  return eps.page_result(items,p_limit);
end $$;
create function public.eps_get_workspace(p_workspace_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$ declare result jsonb; begin
  perform eps.require_capability('workspaces.read'); result:=eps.workspace_dto(p_workspace_id); if result is null then perform eps.fail('RESOURCE_NOT_FOUND','Workspace not found.',404); end if; return result;
end $$;
create function public.eps_create_workspace(p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path = '' as $$ declare p_id uuid; w_id uuid; output text; result jsonb; begin
  perform eps.require_capability('projects.read'); perform eps.require_capability('workspaces.write'); perform eps.check_input(p_input,array['project_id','initial_output']);
  if p_idempotency_key is null then perform eps.fail('INVALID_REQUEST','Idempotency-Key is required.',400); end if;
  p_id:=eps.input_uuid(eps.input_text(p_input,'project_id',200)); output:=eps.input_text(p_input,'initial_output',20);
  if output not in ('selection','shortlist') then perform eps.fail('INVALID_REQUEST','Unsupported presentation output.',400); end if;
  if not exists(select 1 from public.projects p where p.id=p_id and p.archived_at is null and eps.project_scope(p.id,true)) then perform eps.fail('RESOURCE_NOT_FOUND','Writable canonical project not found.',404); end if;
  result:=eps.idempotency_begin('create_workspace',p_idempotency_key,p_input); if result is not null then return result; end if;
  perform pg_advisory_xact_lock(hashtextextended('eps-workspace:'||p_id::text,0));
  perform 1 from public.projects p where p.id=p_id and p.archived_at is null and eps.project_scope(p.id,true);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Writable canonical project not found.',404); end if;
  select id into w_id from eps.workspaces where project_id=p_id and archived_at is null;
  if w_id is null then insert into eps.workspaces(project_id) values(p_id) returning id into w_id; end if;
  insert into eps.user_workspace_preferences(principal_id,workspace_id,active_output) values(auth.uid(),w_id,output) on conflict(principal_id,workspace_id) do nothing;
  result:=eps.workspace_dto(w_id); return eps.finish_mutation('create_workspace',p_idempotency_key,p_input,result,w_id);
end $$;
create function public.eps_update_workspace(p_workspace_id uuid,p_input jsonb,p_idempotency_key text default null) returns jsonb language plpgsql security definer set search_path = '' as $$ declare w eps.workspaces; logo uuid; result jsonb; payload jsonb; output text; placement text; begin
  perform eps.require_capability('workspaces.write'); perform eps.check_input(p_input,array['row_version','logo_asset_id','logo_placement','active_output']);
  if not exists(select 1 from eps.workspaces w where w.id=p_workspace_id and eps.project_scope(w.project_id,true)) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  payload:=jsonb_build_object('id',p_workspace_id,'input',p_input); result:=eps.idempotency_begin('update_workspace',p_idempotency_key,payload); if result is not null then return result; end if;
  select * into w from eps.workspaces where id=p_workspace_id and eps.project_scope(project_id,true) for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  if eps.expected_version(p_input)<>w.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Reload the workspace before saving.',409,w.row_version); end if;
  if p_input?'logo_asset_id' then if p_input->'logo_asset_id'='null'::jsonb then logo:=null; else logo:=eps.input_uuid(eps.input_text(p_input,'logo_asset_id',200)); end if; perform eps.require_ready_logo(logo); else logo:=w.logo_asset_id; end if;
  placement:=case when p_input?'logo_placement' then eps.input_text(p_input,'logo_placement',30) else w.logo_placement end;
  if placement not in ('cover','every_slide') then perform eps.fail('INVALID_REQUEST','Unsupported logo placement.',400); end if;
  if p_input?'active_output' then
    output:=eps.input_text(p_input,'active_output',20); if output not in ('selection','shortlist') then perform eps.fail('INVALID_REQUEST','Unsupported output.',400); end if;
    insert into eps.user_workspace_preferences(principal_id,workspace_id,active_output) values(auth.uid(),w.id,output) on conflict(principal_id,workspace_id) do update set active_output=excluded.active_output;
  end if;
  if p_input?'logo_asset_id' or p_input?'logo_placement' then update eps.workspaces set logo_asset_id=logo,logo_placement=placement,row_version=row_version+1,draft_revision=draft_revision+1,has_unpublished_changes=true,updated_at=now() where id=w.id; end if;
  result:=eps.workspace_dto(w.id); return eps.finish_mutation('update_workspace',p_idempotency_key,payload,result,w.id);
end $$;
create function public.eps_list_audience_presets(p_q text default '',p_cursor text default null,p_limit integer default 25) returns jsonb language plpgsql stable security definer set search_path = '' as $$ declare cursor_id uuid; items jsonb[]; begin
  perform eps.require_capability('workspaces.read'); cursor_id:=eps.check_list(p_q,p_cursor,p_limit);
  select coalesce(array_agg(obj order by id),array[]::jsonb[]) into items from(select a.id,to_jsonb(a) obj from eps.audience_presets a where not a.archived and (cursor_id is null or a.id>cursor_id) and (a.label||' '||a.key) ilike '%'||p_q||'%' order by a.id limit p_limit+1) selected; return eps.page_result(items,p_limit);
end $$;
create function public.eps_create_audience_preset(p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path = '' as $$ declare preset eps.audience_presets; result jsonb; preset_key text; preset_scope text; begin
  perform eps.require_capability('settings.manage'); perform eps.check_input(p_input,array['key','label','scope','settings']);
  if p_idempotency_key is null then perform eps.fail('INVALID_REQUEST','Idempotency-Key is required.',400); end if;
  result:=eps.idempotency_begin('create_audience_preset',p_idempotency_key,p_input); if result is not null then return result; end if;
  if p_input->'settings' is distinct from '{}'::jsonb then perform eps.fail('INVALID_REQUEST','Preset settings must be an empty object in v1.',400); end if;
  preset_key:=coalesce(eps.input_text(p_input,'key',100,false),'custom_'||gen_random_uuid()::text); preset_scope:=eps.input_text(p_input,'scope',20);
  if preset_scope not in ('internal','external') then perform eps.fail('INVALID_REQUEST','Unsupported audience scope.',400); end if;
  begin insert into eps.audience_presets(key,label,scope) values(preset_key,eps.input_text(p_input,'label'),preset_scope) returning * into preset; exception when unique_violation then perform eps.fail('AUDIENCE_PRESET_EXISTS','This preset key already exists.',409); end;
  return eps.finish_mutation('create_audience_preset',p_idempotency_key,p_input,to_jsonb(preset),preset.id);
end $$;
create function public.eps_update_audience_preset(p_preset_id uuid,p_input jsonb,p_idempotency_key text default null) returns jsonb language plpgsql security definer set search_path = '' as $$ declare preset eps.audience_presets; result jsonb; payload jsonb; begin
  perform eps.require_capability('settings.manage'); perform eps.check_input(p_input,array['row_version','label','settings']); payload:=jsonb_build_object('id',p_preset_id,'input',p_input);
  result:=eps.idempotency_begin('update_audience_preset',p_idempotency_key,payload); if result is not null then return result; end if;
  select * into preset from eps.audience_presets where id=p_preset_id and not archived for update; if not found then perform eps.fail('RESOURCE_NOT_FOUND','Audience preset not found.',404); end if;
  if eps.expected_version(p_input)<>preset.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Reload the preset before saving.',409,preset.row_version); end if;
  if p_input?'settings' and p_input->'settings' is distinct from '{}'::jsonb then perform eps.fail('INVALID_REQUEST','Preset settings must be an empty object in v1.',400); end if;
  update eps.audience_presets set label=case when p_input?'label' then eps.input_text(p_input,'label') else preset.label end,row_version=row_version+1 where id=preset.id returning * into preset;
  return eps.finish_mutation('update_audience_preset',p_idempotency_key,payload,to_jsonb(preset),preset.id);
end $$;
create function public.eps_archive_audience_preset(p_preset_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path = '' as $$ declare preset eps.audience_presets; result jsonb; payload jsonb; begin
  perform eps.require_capability('settings.manage'); perform eps.check_input(p_input,array['row_version','reason']); if p_idempotency_key is null then perform eps.fail('INVALID_REQUEST','Idempotency-Key is required.',400); end if;
  payload:=jsonb_build_object('id',p_preset_id,'input',p_input); result:=eps.idempotency_begin('archive_audience_preset',p_idempotency_key,payload); if result is not null then return result; end if;
  select * into preset from eps.audience_presets where id=p_preset_id for update; if not found then perform eps.fail('RESOURCE_NOT_FOUND','Audience preset not found.',404); end if;
  if eps.expected_version(p_input)<>preset.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Reload the preset before archiving.',409,preset.row_version); end if;
  if p_input?'reason' and p_input->'reason'<>'null'::jsonb then perform eps.input_text(p_input,'reason',2000); end if;
  update eps.audience_presets set archived=true,row_version=row_version+1 where id=preset.id;
  result:=jsonb_build_object('success',true,'affected_ids',jsonb_build_array(preset.id)); return eps.finish_mutation('archive_audience_preset',p_idempotency_key,payload,result,preset.id);
end $$;

-- Default preset configuration only, no business entities or auth identities.
insert into eps.audience_presets(key,label,scope) values('internal_production','Internal Production','internal'),('agency','Agency','external'),('client','Client','external');

-- Revoke function defaults and give ownership only to narrow, non-table-owner roles.
-- Fixed catalog selection; no identifier comes from a request or uploaded source.
grant create on schema eps,public to eps_api_owner;
grant create on schema eps to eps_draft_owner;
do $functions$ declare f record; begin
  for f in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps' or(n.nspname='public' and p.proname like 'eps\_%' escape '\') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
    if f.nspname='eps' and f.proname='invalidate_central_drafts' then execute format('alter function %s owner to eps_draft_owner',f.signature);
    else execute format('alter function %s owner to eps_api_owner',f.signature); end if;
    if f.nspname='public' then execute format('grant execute on function %s to authenticated',f.signature); end if;
  end loop;
end $functions$;
revoke create on schema eps,public from eps_api_owner;
revoke create on schema eps from eps_draft_owner;
grant execute on function eps.has_capability(text),eps.project_scope(uuid,boolean),eps.project_access(uuid,boolean),eps.client_access(uuid,boolean) to authenticated;
revoke all on all tables in schema eps from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
