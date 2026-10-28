-- Fixed owner-requested named TEST record bootstrap; not a cloud seed/reset.
-- Render only the bounded lowercase hex envelope. Never log rendered input/errors.
-- Target project-ref and immutable private request/phase ownership are runner guards.
-- These wrappers create no persistent helper, public RPC or fake actor audit event.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
-- EPS_BOOTSTRAP_ACTION_BEGIN
do $eps_bootstrap_grants$ declare
  request_hex text:='__EPS_BOOTSTRAP_REQUEST_HEX__'; original json; request jsonb;
  total_fields integer; unique_fields integer; field text; versions text[];
  request_uuid uuid; client_uuid uuid; project_uuid uuid; pinned_uuid uuid;
  email_value text; client_label text; project_label text; result jsonb;
  candidate uuid; principal_count bigint; ready boolean; had_all boolean; capabilities text[]:=array['projects.read','projects.write','workspaces.read','workspaces.write'];
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

  if pinned_uuid is null then raise exception 'BOOTSTRAP_PINNED_PRINCIPAL_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('eps:owner-m01-bootstrap',0));
  lock table public.app_capability_grants,public.project_memberships,public.client_memberships in share row exclusive mode;
  perform id from public.clients where id=client_uuid and archived_at is null for share;
  if not found then raise exception 'BOOTSTRAP_RESOURCE_MISMATCH'; end if;
  perform id from public.projects where id=project_uuid and client_id=client_uuid and archived_at is null for share;
  if not found then raise exception 'BOOTSTRAP_RESOURCE_MISMATCH'; end if;
  select count(*),(array_agg(id order by id))[1] into principal_count,candidate from auth.users where lower(btrim(email))=email_value;
  if principal_count<>1 or candidate is distinct from pinned_uuid then raise exception 'BOOTSTRAP_PRINCIPAL_MISMATCH'; end if;
  select email_confirmed_at is not null and last_sign_in_at is not null and is_anonymous is false and deleted_at is null
    and (banned_until is null or banned_until<=clock_timestamp()) into ready from auth.users
    where id=pinned_uuid and lower(btrim(email))=email_value for share;
  if not found or ready is distinct from true then raise exception 'BOOTSTRAP_PRINCIPAL_NOT_READY'; end if;
  if exists(select 1 from public.app_capability_grants where principal_id=pinned_uuid and capability=any(capabilities) and not active)
    or exists(select 1 from public.project_memberships where project_id=project_uuid and principal_id=pinned_uuid and not active)
    or exists(select 1 from public.client_memberships where client_id=client_uuid and principal_id=pinned_uuid and not active)
  then raise exception 'BOOTSTRAP_REVOKED_GRANT'; end if;
  if exists(select 1 from public.project_memberships where project_id=project_uuid and principal_id=pinned_uuid and active and not can_write)
    or exists(select 1 from public.client_memberships where client_id=client_uuid and principal_id=pinned_uuid and active and not can_write)
  then raise exception 'BOOTSTRAP_READONLY_MEMBERSHIP'; end if;
  had_all:=(select count(*)=4 from public.app_capability_grants where principal_id=pinned_uuid and capability=any(capabilities) and active)
    and exists(select 1 from public.project_memberships where project_id=project_uuid and principal_id=pinned_uuid and active and can_write)
    and exists(select 1 from public.client_memberships where client_id=client_uuid and principal_id=pinned_uuid and active and can_write);
  insert into public.app_capability_grants(principal_id,capability)
    select pinned_uuid,requested from unnest(capabilities) requested
    where not exists(select 1 from public.app_capability_grants old where old.principal_id=pinned_uuid and old.capability=requested);
  insert into public.project_memberships(project_id,principal_id,can_write)
    select project_uuid,pinned_uuid,true where not exists(select 1 from public.project_memberships where project_id=project_uuid and principal_id=pinned_uuid);
  insert into public.client_memberships(client_id,principal_id,can_write)
    select client_uuid,pinned_uuid,true where not exists(select 1 from public.client_memberships where client_id=client_uuid and principal_id=pinned_uuid);
  result:=jsonb_build_object('request_id',request_uuid,'principal_id',pinned_uuid,'client_id',client_uuid,'project_id',project_uuid,
    'capabilities',to_jsonb(capabilities),'result',case when had_all then 'already_granted' else 'granted' end,'workspace_created',false);

  perform set_config('eps.bootstrap.result',result::text,true);
end $eps_bootstrap_grants$;
-- EPS_BOOTSTRAP_ACTION_END
select current_setting('eps.bootstrap.result')::jsonb as bootstrap;
commit;
