-- Fixed owner-requested named TEST record bootstrap; not a cloud seed/reset.
-- Render only the bounded lowercase hex envelope. Never log rendered input/errors.
-- Target project-ref and immutable private request/phase ownership are runner guards.
-- These wrappers create no persistent helper, public RPC or fake actor audit event.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
-- EPS_BOOTSTRAP_ACTION_BEGIN
do $eps_bootstrap_records$ declare
  request_hex text:='__EPS_BOOTSTRAP_REQUEST_HEX__'; original json; request jsonb;
  total_fields integer; unique_fields integer; field text; versions text[];
  request_uuid uuid; client_uuid uuid; project_uuid uuid; pinned_uuid uuid;
  email_value text; client_label text; project_label text; result jsonb;
  client_exists boolean; project_exists boolean; matching_pair boolean;
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

  perform pg_advisory_xact_lock(hashtextextended('eps:owner-m01-bootstrap',0));
  -- Brief table locks make absent-name checks safe against concurrent inserts,
  -- including writers which do not use this operator's advisory lock.
  lock table public.clients,public.projects in share row exclusive mode;
  select exists(select 1 from public.clients where id=client_uuid),exists(select 1 from public.projects where id=project_uuid),
    exists(select 1 from public.projects project join public.clients client on client.id=project.client_id where project.id=project_uuid and client.id=client_uuid)
    into client_exists,project_exists,matching_pair;
  if client_exists or project_exists then
    if not matching_pair then raise exception 'BOOTSTRAP_RESOURCE_COLLISION'; end if;
    -- Only the runner's immutable private prepared request proves ownership.
    -- An existing pair never authorizes fresh adoption. Do not restore labels.
    result:=jsonb_build_object('request_id',request_uuid,'client_id',client_uuid,'project_id',project_uuid,'result','existing_pair','workspace_created',false);
  else
    if exists(select 1 from public.clients where lower(btrim(name))=lower(client_label))
      or exists(select 1 from public.projects where lower(btrim(name))=lower(project_label))
    then raise exception 'BOOTSTRAP_NAME_COLLISION'; end if;
    insert into public.clients(id,name) values(client_uuid,client_label);
    insert into public.projects(id,client_id,name) values(project_uuid,client_uuid,project_label);
    result:=jsonb_build_object('request_id',request_uuid,'client_id',client_uuid,'project_id',project_uuid,'result','created','workspace_created',false);
  end if;

  perform set_config('eps.bootstrap.result',result::text,true);
end $eps_bootstrap_records$;
-- EPS_BOOTSTRAP_ACTION_END
select current_setting('eps.bootstrap.result')::jsonb as bootstrap;
commit;
