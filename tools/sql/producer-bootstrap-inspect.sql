-- Fixed owner-requested named TEST record bootstrap; not a cloud seed/reset.
-- Render only the bounded lowercase hex envelope. Never log rendered input/errors.
-- Target project-ref and immutable private request/phase ownership are runner guards.
-- These wrappers create no persistent helper, public RPC or fake actor audit event.
begin read only;
set local lock_timeout='3s';
set local statement_timeout='15s';
-- EPS_BOOTSTRAP_ACTION_BEGIN
do $eps_bootstrap_inspect$ declare
  request_hex text:='__EPS_BOOTSTRAP_REQUEST_HEX__'; original json; request jsonb;
  total_fields integer; unique_fields integer; field text; versions text[];
  request_uuid uuid; client_uuid uuid; project_uuid uuid; pinned_uuid uuid;
  email_value text; client_label text; project_label text; result jsonb;
  client_exists boolean; project_exists boolean; matching_pair boolean; candidate uuid; principal_count bigint;
  confirmed boolean:=false; signed_in boolean:=false; nonanonymous boolean:=false; nondeleted boolean:=false; nonbanned boolean:=false;
  capability_status jsonb; project_status text:='absent'; client_status text:='absent';
begin
  if current_database()<>'postgres' or current_user<>'postgres'
    or not exists(select 1 from pg_roles where rolname=current_user and (rolbypassrls or rolsuper))
  then raise exception 'BOOTSTRAP_TARGET_OR_ROLE_INVALID'; end if;
  select array_agg(version order by version) into versions from supabase_migrations.schema_migrations;
  if versions is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205']::text[]
    and versions is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515']::text[]
  then raise exception 'BOOTSTRAP_MIGRATION_HISTORY_INVALID'; end if;
  if length(request_hex)<2 or length(request_hex)>16384 or length(request_hex)%2<>0 or request_hex!~'^[0-9a-f]+$'
  then raise exception 'BOOTSTRAP_REQUEST_INVALID'; end if;
  begin original:=convert_from(decode(request_hex,'hex'),'UTF8')::json;
  exception when others then raise exception 'BOOTSTRAP_REQUEST_INVALID'; end;
  if json_typeof(original) is distinct from 'object' then raise exception 'BOOTSTRAP_REQUEST_INVALID'; end if;
  select count(*),count(distinct item.key) into total_fields,unique_fields from json_each(original) item;
  if total_fields<>8 or unique_fields<>8 then raise exception 'BOOTSTRAP_REQUEST_INVALID'; end if;
  request:=original::jsonb;
  if exists(select 1 from jsonb_object_keys(request) item(key) where not(item.key=any(array['schema_version','request_id','client_id','project_id','principal_id','producer_email','client_name','project_name'])))
  then raise exception 'BOOTSTRAP_REQUEST_INVALID'; end if;
  foreach field in array array['schema_version','request_id','client_id','project_id','producer_email','client_name','project_name'] loop
    if jsonb_typeof(request->field) is distinct from 'string' then raise exception 'BOOTSTRAP_REQUEST_INVALID'; end if;
  end loop;
  if request->>'schema_version'<>'1.0' or jsonb_typeof(request->'principal_id') not in('null','string')
  then raise exception 'BOOTSTRAP_REQUEST_INVALID'; end if;
  begin
    request_uuid:=(request->>'request_id')::uuid; client_uuid:=(request->>'client_id')::uuid; project_uuid:=(request->>'project_id')::uuid;
    pinned_uuid:=(request->>'principal_id')::uuid;
  exception when others then raise exception 'BOOTSTRAP_REQUEST_INVALID'; end;
  email_value:=lower(btrim(request->>'producer_email')); client_label:=btrim(request->>'client_name'); project_label:=btrim(request->>'project_name');
  if length(email_value) not between 3 and 320 or email_value!~'^[^[:space:]@]+@[^[:space:]@]+$'
    or length(client_label) not between 1 and 500 or length(project_label) not between 1 and 500
    or client_label~'[[:cntrl:]]' or project_label~'[[:cntrl:]]'
  then raise exception 'BOOTSTRAP_REQUEST_INVALID'; end if;

  select exists(select 1 from public.clients where id=client_uuid),exists(select 1 from public.projects where id=project_uuid),
    exists(select 1 from public.projects project join public.clients client on client.id=project.client_id where project.id=project_uuid and client.id=client_uuid)
    into client_exists,project_exists,matching_pair;
  select count(*),(array_agg(id order by id))[1] into principal_count,candidate from auth.users where lower(btrim(email))=email_value;
  if principal_count=1 then
    select email_confirmed_at is not null,last_sign_in_at is not null,is_anonymous is false,deleted_at is null,
      banned_until is null or banned_until<=clock_timestamp()
      into confirmed,signed_in,nonanonymous,nondeleted,nonbanned from auth.users where id=candidate;
    select case when not active then 'inactive' when can_write then 'write' else 'readonly' end into project_status
      from public.project_memberships where project_id=project_uuid and principal_id=candidate;
    select case when not active then 'inactive' when can_write then 'write' else 'readonly' end into client_status
      from public.client_memberships where client_id=client_uuid and principal_id=candidate;
  else candidate:=null; end if;
  select jsonb_object_agg(requested.capability,case when grant_row.principal_id is null then 'absent' when grant_row.active then 'active' else 'inactive' end order by requested.capability)
    into capability_status from unnest(array['projects.read','projects.write','workspaces.read','workspaces.write']) requested(capability)
    left join public.app_capability_grants grant_row on grant_row.principal_id=candidate and grant_row.capability=requested.capability;
  result:=jsonb_build_object('request_id',request_uuid,'client_id',client_uuid,'project_id',project_uuid,
    'resource_state',case when not client_exists and not project_exists then 'absent' when matching_pair then 'complete_pair' else 'partial_or_mismatch' end,
    'client_name_collisions',(select count(*) from public.clients where lower(btrim(name))=lower(client_label) and id<>client_uuid),
    'project_name_collisions',(select count(*) from public.projects where lower(btrim(name))=lower(project_label) and id<>project_uuid),
    'principal_match_count',principal_count,'principal_id',candidate,'principal_confirmed',confirmed,'signed_in',signed_in,
    'nonanonymous',nonanonymous,'nondeleted',nondeleted,'nonbanned',nonbanned,
    'pinned_principal_matches',pinned_uuid is not null and candidate is not null and pinned_uuid=candidate,
    'capabilities',capability_status,'project_membership',coalesce(project_status,'absent'),'client_membership',coalesce(client_status,'absent'));

  perform set_config('eps.bootstrap.result',result::text,true);
end $eps_bootstrap_inspect$;
-- EPS_BOOTSTRAP_ACTION_END
select current_setting('eps.bootstrap.result')::jsonb as bootstrap;
commit;
