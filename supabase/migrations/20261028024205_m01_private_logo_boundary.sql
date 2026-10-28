-- Private M01 logo boundary. No secret, fixture identity or object bytes are seeded.
-- Hosted Storage operation/header propagation is NOT established by this DDL.
-- Keep upload purposes disabled until actual authenticated endpoint gates pass.
-- Storage source: tracking/discovery/storage-operation-context-research.md.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $prerequisites$ begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null
    or to_regprocedure('storage.allow_only_operation(text)') is null
    or to_regprocedure('extensions.hmac(bytea,bytea,text)') is null
    or not exists(select 1 from pg_class where oid='storage.objects'::regclass and relrowsecurity)
    or not exists(select 1 from pg_class where oid='storage.buckets'::regclass and relrowsecurity)
  then raise exception 'MANAGED_STORAGE_AND_HMAC_PREREQUISITES_REQUIRED'; end if;
end $prerequisites$;

create role eps_logo_verify_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_logo_verify_owner to postgres;
grant authenticated to eps_logo_verify_owner with inherit true, set false, admin false;
grant usage on schema eps,public,extensions to eps_logo_verify_owner;

create table eps.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null unique references eps.media_assets(id) on delete restrict,
  principal_id uuid not null references auth.users(id) on delete restrict,
  workspace_id uuid not null references eps.workspaces(id) on delete restrict,
  reservation_revision bigint not null default 1 check(reservation_revision between 1 and 9007199254740991),
  verification_id uuid not null default gen_random_uuid(),
  purpose text not null default 'client_logo' check(purpose='client_logo'),
  bucket text not null check(bucket='eps-brand-assets'), object_key text not null,
  expected_size_bytes bigint not null check(expected_size_bytes between 1 and 5242880),
  expected_mime_type text not null check(expected_mime_type in ('image/png','image/jpeg','image/webp')),
  expected_sha256 text check(expected_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'open' check(status in ('open','completed','cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '2 hours', completed_at timestamptz,
  check(expires_at>created_at), check((status='completed')=(completed_at is not null)),
  unique(bucket,object_key)
);
create index upload_sessions_principal_workspace on eps.upload_sessions(principal_id,workspace_id);
create index upload_sessions_open_expiry on eps.upload_sessions(expires_at) where status='open';
create table eps.logo_verification_keys (
  key_id text primary key check(key_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  purpose text not null default 'client_logo' check(purpose='client_logo'),
  secret bytea not null check(octet_length(secret)=32),
  not_before timestamptz not null default now(), not_after timestamptz, revoked_at timestamptz,
  created_at timestamptz not null default now(), check(not_after is null or not_after>not_before)
);
comment on table eps.logo_verification_keys is 'Dedicated server logo verification key only. Provision outside migrations; never expose through user queries or broad Vault grants.';
alter table eps.upload_sessions enable row level security;
alter table eps.upload_sessions force row level security;
alter table eps.logo_verification_keys enable row level security;
alter table eps.logo_verification_keys force row level security;
revoke all on eps.upload_sessions,eps.logo_verification_keys from public,anon,authenticated,service_role,eps_api_owner;
grant select,insert on eps.upload_sessions to eps_api_owner;
grant update(status,reservation_revision) on eps.upload_sessions to eps_api_owner;
grant select on eps.upload_sessions to eps_logo_verify_owner;
grant update(status,completed_at) on eps.upload_sessions to eps_logo_verify_owner;
grant select on eps.logo_verification_keys to eps_logo_verify_owner;
grant insert(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status) on eps.media_assets to eps_api_owner;
grant update(status) on eps.media_assets to eps_api_owner;
grant select on eps.media_assets to eps_logo_verify_owner;
grant update(status,sha256,width,height) on eps.media_assets to eps_logo_verify_owner;
grant select,insert on eps.idempotency_records to eps_logo_verify_owner;
grant insert on eps.audit_events to eps_logo_verify_owner;

-- Narrow boolean helper: no media/storage lookup and no caller actor argument.
create function eps.logo_scope(p_workspace uuid,p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from eps.workspaces ws join public.projects project on project.id=ws.project_id
    where ws.id=p_workspace and ws.archived_at is null and project.archived_at is null
      and eps.has_capability(case when p_write then 'workspaces.write' else 'workspaces.read' end)
      and eps.project_scope(project.id,p_write))
$$;
create policy logo_upload_api_read on eps.upload_sessions for select to eps_api_owner
  using(principal_id=auth.uid() and eps.logo_scope(workspace_id,true));
create policy logo_upload_api_insert on eps.upload_sessions for insert to eps_api_owner
  with check(principal_id=auth.uid() and eps.logo_scope(workspace_id,true) and status='open' and reservation_revision=1);
create policy logo_upload_api_cancel on eps.upload_sessions for update to eps_api_owner
  using(principal_id=auth.uid() and eps.logo_scope(workspace_id,true) and status='open')
  with check(principal_id=auth.uid() and eps.logo_scope(workspace_id,true) and status='cancelled');
create policy logo_upload_verifier_read on eps.upload_sessions for select to eps_logo_verify_owner
  using(principal_id=auth.uid() and eps.logo_scope(workspace_id,true));
create policy logo_upload_verifier_complete on eps.upload_sessions for update to eps_logo_verify_owner
  using(principal_id=auth.uid() and eps.logo_scope(workspace_id,true) and status='open' and expires_at>clock_timestamp())
  with check(principal_id=auth.uid() and eps.logo_scope(workspace_id,true) and status='completed');
create policy logo_key_verifier on eps.logo_verification_keys for select to eps_logo_verify_owner
  using(purpose='client_logo' and revoked_at is null);
create policy logo_media_api_insert on eps.media_assets for insert to eps_api_owner
  with check(purpose='client_logo' and bucket='eps-brand-assets' and client_id is null
    and eps.logo_scope(origin_workspace_id,true) and status='uploading' and sha256 is null and width is null and height is null
    and object_key='assets/'||id::text||'/original.'||case mime_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' end);
create policy logo_media_api_cancel on eps.media_assets for update to eps_api_owner
  using(status='uploading' and exists(select 1 from eps.upload_sessions upload where upload.asset_id=media_assets.id and upload.principal_id=auth.uid() and eps.logo_scope(upload.workspace_id,true)))
  with check(status='failed');
create policy logo_media_verifier_read on eps.media_assets for select to eps_logo_verify_owner
  using(exists(select 1 from eps.upload_sessions upload where upload.asset_id=media_assets.id and upload.principal_id=auth.uid() and eps.logo_scope(upload.workspace_id,true)));
create policy logo_media_verifier_complete on eps.media_assets for update to eps_logo_verify_owner
  using(status='uploading' and exists(select 1 from eps.upload_sessions upload where upload.asset_id=media_assets.id and upload.principal_id=auth.uid() and upload.status='open' and upload.expires_at>clock_timestamp() and eps.logo_scope(upload.workspace_id,true)))
  with check(status='ready' and width::bigint*height::bigint<=40000000 and sha256 is not null and width is not null and height is not null);
create policy logo_idempotency_verifier on eps.idempotency_records for all to eps_logo_verify_owner
  using(principal_id=auth.uid() and operation='complete_upload') with check(principal_id=auth.uid() and operation='complete_upload');
create policy logo_audit_verifier on eps.audit_events for insert to eps_logo_verify_owner
  with check(principal_id=auth.uid() and action='complete_upload');

create function eps.logo_integer(p_value jsonb,p_min bigint,p_max bigint) returns bigint
language plpgsql immutable security invoker set search_path='' as $$ begin
  if jsonb_typeof(p_value) is distinct from 'number' or p_value::text !~ '^[0-9]{1,16}$'
    or p_value::numeric<p_min or p_value::numeric>p_max then perform eps.fail('INVALID_REQUEST','An integer is outside its allowed bounds.',400); end if;
  return p_value::text::bigint;
end $$;
create function eps.logo_asset_dto(p_asset eps.media_assets) returns jsonb
language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('id',(p_asset).id,'purpose',(p_asset).purpose,'filename',(p_asset).filename,'mime_type',(p_asset).mime_type,
    'size_bytes',(p_asset).size_bytes,'sha256',(p_asset).sha256,'status',(p_asset).status,'duration_ms',null,'width',(p_asset).width,'height',(p_asset).height,
    'source_asset_id',null,'source_timestamp_ms',null,'created_at',(p_asset).created_at)
$$;
create function eps.logo_upload_dto(p_upload uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('upload_id',upload.id,'asset',eps.logo_asset_dto(asset),'principal_id',upload.principal_id,
    'workspace_id',upload.workspace_id,'reservation_revision',upload.reservation_revision,'verification_id',upload.verification_id,
    'bucket',upload.bucket,'object_key',upload.object_key,'expected_size_bytes',upload.expected_size_bytes,
    'expected_mime_type',upload.expected_mime_type,'expected_sha256',upload.expected_sha256,'expires_at',upload.expires_at,
    'status',case when upload.status='open' and upload.expires_at<=clock_timestamp() then 'expired' else upload.status end)
  from eps.upload_sessions upload join eps.media_assets asset on asset.id=upload.asset_id where upload.id=p_upload
$$;
create function eps.logo_require_upload(p_upload uuid) returns eps.upload_sessions
language plpgsql stable security invoker set search_path='' as $$ declare upload eps.upload_sessions; begin
  perform eps.require_capability('workspaces.write');
  select * into upload from eps.upload_sessions current_upload where current_upload.id=p_upload and current_upload.principal_id=auth.uid() and eps.logo_scope(current_upload.workspace_id,true);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Upload not found in your writable scope.',404); end if;
  return upload;
end $$;
create function eps.logo_check_completion(p_input jsonb,p_upload eps.upload_sessions) returns void
language plpgsql immutable security invoker set search_path='' as $$ begin
  perform eps.check_input(p_input,array['actual_size_bytes','start_processing','sha256']);
  if eps.logo_integer(p_input->'actual_size_bytes',1,5242880)<>p_upload.expected_size_bytes
    or jsonb_typeof(p_input->'start_processing') is distinct from 'boolean'
  then perform eps.fail('INVALID_REQUEST','Completion assertions do not match the upload.',400); end if;
  if p_input?'sha256' and (jsonb_typeof(p_input->'sha256') is distinct from 'string' or (p_input->>'sha256')!~'^[a-f0-9]{64}$'
    or (p_upload.expected_sha256 is not null and p_input->>'sha256'<>p_upload.expected_sha256))
  then perform eps.fail('INVALID_REQUEST','The supplied checksum is invalid or mismatched.',400); end if;
end $$;
create function eps.logo_completion_value(p_asset uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('asset',eps.logo_asset_dto(asset),'processing_job_id',null,'status','ready') from eps.media_assets asset where asset.id=p_asset and asset.status='ready'
$$;
-- New keys used after completion still bind the exact public input, without
-- inventing another Ready transition or audit effect. Caller already checked scope.
create function eps.logo_remember_completion(p_key text,p_input jsonb,p_response jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$ declare replay jsonb; begin
  replay:=eps.idempotency_begin('complete_upload',p_key,p_input);
  if replay is not null then return replay; end if;
  insert into eps.idempotency_records(principal_id,operation,key,request_hash,response)
    values(auth.uid(),'complete_upload',p_key,encode(sha256(convert_to(p_input::text,'UTF8')),'hex'),p_response);
  return p_response;
end $$;

create function public.eps_reserve_logo_upload(p_input jsonb,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare workspace uuid; asset_id uuid:=gen_random_uuid(); upload_id uuid:=gen_random_uuid(); mime text; filename text; bytes bigint; checksum text; object_key text; response jsonb;
begin
  perform eps.require_capability('workspaces.write');
  perform eps.check_input(p_input,array['workspace_id','purpose','filename','mime_type','size_bytes','sha256']);
  workspace:=eps.input_uuid(eps.input_text(p_input,'workspace_id',200));
  if not eps.logo_scope(workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  if eps.input_text(p_input,'purpose',30)<>'client_logo' then perform eps.fail('INVALID_REQUEST','Only client logos are supported by this operation.',400); end if;
  if p_idempotency_key is null then perform eps.fail('INVALID_REQUEST','Idempotency-Key is required.',400); end if;
  filename:=eps.input_text(p_input,'filename',255); mime:=eps.input_text(p_input,'mime_type',100); bytes:=eps.logo_integer(p_input->'size_bytes',1,5242880);
  if filename ~ E'[/\\\\]' or mime not in ('image/png','image/jpeg','image/webp') then perform eps.fail('INVALID_REQUEST','Use a simple PNG, JPEG or WebP filename and allowed type.',400); end if;
  if p_input?'sha256' then checksum:=eps.input_text(p_input,'sha256',64); if checksum!~'^[a-f0-9]{64}$' then perform eps.fail('INVALID_REQUEST','Invalid checksum.',400); end if; end if;
  response:=eps.idempotency_begin('create_upload_session',p_idempotency_key,p_input);
  if response is not null then
    -- Stable resource replay, fresh mutable status; never mint from stale open metadata.
    response:=eps.logo_upload_dto((response->>'upload_id')::uuid);
    if response is null then perform eps.fail('RESOURCE_NOT_FOUND','Reserved upload is unavailable.',404); end if;
    return response;
  end if;
  object_key:='assets/'||asset_id::text||'/original.'||case mime when 'image/png' then 'png' when 'image/jpeg' then 'jpg' else 'webp' end;
  insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status)
    values(asset_id,workspace,'client_logo',filename,mime,'eps-brand-assets',object_key,bytes,'uploading');
  insert into eps.upload_sessions(id,asset_id,principal_id,workspace_id,bucket,object_key,expected_size_bytes,expected_mime_type,expected_sha256)
    values(upload_id,asset_id,auth.uid(),workspace,'eps-brand-assets',object_key,bytes,mime,checksum);
  response:=eps.logo_upload_dto(upload_id);
  return eps.finish_mutation('create_upload_session',p_idempotency_key,p_input,response,upload_id);
end $$;
create function public.eps_get_logo_upload(p_upload_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$ begin
  perform eps.logo_require_upload(p_upload_id); return eps.logo_upload_dto(p_upload_id);
end $$;
create function public.eps_prepare_logo_completion(p_upload_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$ declare upload eps.upload_sessions; replay jsonb; asset eps.media_assets; begin
  upload:=eps.logo_require_upload(p_upload_id); perform eps.logo_check_completion(p_input,upload);
  if p_idempotency_key is null then perform eps.fail('INVALID_REQUEST','Idempotency-Key is required.',400); end if;
  replay:=eps.idempotency_begin('complete_upload',p_idempotency_key,jsonb_build_object('id',p_upload_id,'input',p_input));
  if replay is null and upload.status='completed' then
    select * into asset from eps.media_assets current_asset where current_asset.id=upload.asset_id;
    if p_input?'sha256' and p_input->>'sha256' is distinct from asset.sha256 then perform eps.fail('INVALID_REQUEST','Completed upload checksum differs.',400); end if;
    replay:=eps.logo_completion_value(upload.asset_id); if replay is null then perform eps.fail('INVALID_TRANSITION','Completed asset is unavailable.',409); end if;
    replay:=eps.logo_remember_completion(p_idempotency_key,jsonb_build_object('id',p_upload_id,'input',p_input),replay);
  end if;
  if replay is null and (upload.status<>'open' or upload.expires_at<=clock_timestamp()) then perform eps.fail('INVALID_TRANSITION','This upload is cancelled or expired.',409); end if;
  return jsonb_build_object('reservation',eps.logo_upload_dto(p_upload_id),'replay',replay);
end $$;

create function eps.logo_decode_receipt(p_value text,p_max_bytes integer,p_exact_bytes integer default null) returns bytea
language plpgsql immutable security invoker set search_path='' as $$ declare bytes bytea; expected integer; begin
  if p_value is null or octet_length(p_value)<1 or octet_length(p_value)>ceil(p_max_bytes*4.0/3.0)::integer
    or length(p_value)%4=1 or p_value!~'^[A-Za-z0-9_-]+$' then perform eps.fail('ACCESS_DENIED','Verification receipt is invalid.',403); end if;
  expected:=floor(length(p_value)*3.0/4.0)::integer;
  if expected>p_max_bytes or (p_exact_bytes is not null and expected<>p_exact_bytes) then perform eps.fail('ACCESS_DENIED','Verification receipt is invalid.',403); end if;
  bytes:=decode(translate(p_value,'-_','+/')||repeat('=',(4-length(p_value)%4)%4),'base64');
  if octet_length(bytes)<>expected or rtrim(translate(replace(encode(bytes,'base64'),E'\n',''),'+/','-_'),'=')<>p_value then perform eps.fail('ACCESS_DENIED','Verification receipt is invalid.',403); end if;
  return bytes;
end $$;
create function eps.logo_verify_receipt(p_upload eps.upload_sessions,p_payload text,p_mac text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare bytes bytea; supplied bytea; computed bytea; original json; claims jsonb; key eps.logo_verification_keys; field text; count_keys integer; unique_keys integer; diff integer:=0; i integer;
  issued bigint; expires bigint; current_second bigint; width bigint; height bigint; size bigint;
begin
  bytes:=eps.logo_decode_receipt(p_payload,4096); supplied:=eps.logo_decode_receipt(p_mac,32,32);
  begin original:=convert_from(bytes,'UTF8')::json; exception when others then perform eps.fail('ACCESS_DENIED','Verification receipt is invalid.',403); end;
  if json_typeof(original) is distinct from 'object' then perform eps.fail('ACCESS_DENIED','Verification receipt is invalid.',403); end if;
  select count(*),count(distinct item.key) into count_keys,unique_keys from json_each(original) item;
  if count_keys<>19 or unique_keys<>19 then perform eps.fail('ACCESS_DENIED','Verification receipt has invalid fields.',403); end if;
  claims:=original::jsonb;
  perform eps.check_input(claims,array['schema_version','audience','purpose','key_id','verification_id','upload_id','asset_id','principal_id','workspace_id','reservation_revision','bucket','object_key','size_bytes','sha256','mime_type','width','height','issued_at','expires_at']);
  foreach field in array array['schema_version','audience','purpose','key_id','verification_id','upload_id','asset_id','principal_id','workspace_id','bucket','object_key','sha256','mime_type'] loop
    if jsonb_typeof(claims->field) is distinct from 'string' then perform eps.fail('ACCESS_DENIED','Verification receipt has invalid fields.',403); end if;
  end loop;
  if claims->>'key_id'!~'^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' then perform eps.fail('ACCESS_DENIED','Verification receipt is invalid.',403); end if;
  select * into key from eps.logo_verification_keys current_key where current_key.key_id=claims->>'key_id' and current_key.purpose='client_logo' and current_key.revoked_at is null;
  if not found then perform eps.fail('ACCESS_DENIED','Verification receipt is invalid.',403); end if;
  computed:=extensions.hmac(bytes,key.secret,'sha256');
  -- Exactly 32 iterations; never claim bytea equality is a constant-time MAC check.
  for i in 0..31 loop diff:=diff | (get_byte(computed,i) # get_byte(supplied,i)); end loop;
  if diff<>0 then perform eps.fail('ACCESS_DENIED','Verification receipt is invalid.',403); end if;
  issued:=eps.logo_integer(claims->'issued_at',0,253402300799); expires:=eps.logo_integer(claims->'expires_at',0,253402300799);
  current_second:=floor(extract(epoch from clock_timestamp()))::bigint;
  if issued>current_second or expires<=current_second or expires<=issued or expires-issued>120
    or key.not_before>to_timestamp(issued) or (key.not_after is not null and key.not_after<to_timestamp(expires)) then perform eps.fail('ACCESS_DENIED','Verification receipt is expired or not active.',403); end if;
  size:=eps.logo_integer(claims->'size_bytes',1,5242880); width:=eps.logo_integer(claims->'width',1,40000000); height:=eps.logo_integer(claims->'height',1,40000000);
  if claims->>'schema_version' is distinct from '1.0' or claims->>'audience' is distinct from 'eps.logo-verification.v1' or claims->>'purpose' is distinct from 'client_logo'
    or claims->>'verification_id' is distinct from p_upload.verification_id::text or claims->>'upload_id' is distinct from p_upload.id::text
    or claims->>'asset_id' is distinct from p_upload.asset_id::text or claims->>'principal_id' is distinct from auth.uid()::text
    or claims->>'workspace_id' is distinct from p_upload.workspace_id::text or eps.logo_integer(claims->'reservation_revision',1,9007199254740991)<>p_upload.reservation_revision
    or claims->>'bucket' is distinct from p_upload.bucket or claims->>'object_key' is distinct from p_upload.object_key
    or size<>p_upload.expected_size_bytes or claims->>'mime_type' is distinct from p_upload.expected_mime_type
    or claims->>'sha256'!~'^[a-f0-9]{64}$' or (p_upload.expected_sha256 is not null and claims->>'sha256'<>p_upload.expected_sha256)
    or width*height>40000000 then perform eps.fail('ACCESS_DENIED','Verification receipt does not match the reserved source.',403); end if;
  return claims;
end $$;
create function public.eps_finalize_logo_completion(p_upload_id uuid,p_input jsonb,p_idempotency_key text,p_payload text,p_mac text) returns jsonb
language plpgsql security definer set search_path='' as $$ declare upload eps.upload_sessions; claims jsonb; replay jsonb; result jsonb; payload jsonb; asset eps.media_assets; changed integer; begin
  upload:=eps.logo_require_upload(p_upload_id); perform eps.logo_check_completion(p_input,upload);
  if p_idempotency_key is null then perform eps.fail('INVALID_REQUEST','Idempotency-Key is required.',400); end if;
  payload:=jsonb_build_object('id',p_upload_id,'input',p_input);
  replay:=eps.idempotency_begin('complete_upload',p_idempotency_key,payload); if replay is not null then return replay; end if;
  -- Serialize completion/cancellation, then inspect closed states before the
  -- transition-only UPDATE RLS filters applied by SELECT FOR UPDATE.
  perform pg_advisory_xact_lock(hashtextextended('eps:logo-upload:'||p_upload_id::text,0));
  select * into upload from eps.upload_sessions current_upload where current_upload.id=p_upload_id and current_upload.principal_id=auth.uid() and eps.logo_scope(current_upload.workspace_id,true);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Writable upload not found.',404); end if;
  select * into asset from eps.media_assets current_asset where current_asset.id=upload.asset_id;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Reserved asset not found.',404); end if;
  if upload.status='completed' then
    if p_input?'sha256' and p_input->>'sha256' is distinct from asset.sha256 then perform eps.fail('INVALID_REQUEST','Completed checksum differs.',400); end if;
    result:=eps.logo_completion_value(upload.asset_id); if result is null then perform eps.fail('INVALID_TRANSITION','Completed asset unavailable.',409); end if;
    return eps.logo_remember_completion(p_idempotency_key,payload,result);
  end if;
  if upload.status<>'open' or upload.expires_at<=clock_timestamp() or asset.status<>'uploading' then perform eps.fail('INVALID_TRANSITION','This upload is cancelled, expired or unavailable.',409); end if;
  select * into upload from eps.upload_sessions current_upload where current_upload.id=p_upload_id and current_upload.principal_id=auth.uid() and eps.logo_scope(current_upload.workspace_id,true) for update;
  if not found then perform eps.fail('INVALID_TRANSITION','The upload is no longer available for completion.',409); end if;
  select * into asset from eps.media_assets current_asset where current_asset.id=upload.asset_id for update;
  if not found or upload.status<>'open' or upload.expires_at<=clock_timestamp() or asset.status<>'uploading' then perform eps.fail('INVALID_TRANSITION','The reserved source changed or expired.',409); end if;
  claims:=eps.logo_verify_receipt(upload,p_payload,p_mac);
  if p_input?'sha256' and p_input->>'sha256' is distinct from claims->>'sha256' then perform eps.fail('INVALID_REQUEST','Actual checksum differs from the completion assertion.',400); end if;
  update eps.media_assets set status='ready',sha256=claims->>'sha256',width=(claims->>'width')::integer,height=(claims->>'height')::integer where id=upload.asset_id;
  get diagnostics changed=row_count;
  if changed<>1 then perform eps.fail('INVALID_TRANSITION','The reserved source changed or expired before publication.',409); end if;
  update eps.upload_sessions set status='completed',completed_at=clock_timestamp() where id=upload.id;
  get diagnostics changed=row_count;
  if changed<>1 then perform eps.fail('INVALID_TRANSITION','The upload changed or expired before completion.',409); end if;
  result:=eps.logo_completion_value(upload.asset_id);
  if result is null then perform eps.fail('INVALID_TRANSITION','Verified completion could not be published.',409); end if;
  return eps.finish_mutation('complete_upload',p_idempotency_key,payload,result,upload.asset_id);
end $$;
create function public.eps_cancel_logo_upload(p_upload_id uuid,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$ declare upload eps.upload_sessions; response jsonb; payload jsonb; changed integer; begin
  upload:=eps.logo_require_upload(p_upload_id);
  if p_idempotency_key is null then perform eps.fail('INVALID_REQUEST','Idempotency-Key is required.',400); end if;
  payload:=jsonb_build_object('id',p_upload_id); response:=eps.idempotency_begin('cancel_upload',p_idempotency_key,payload); if response is not null then return response; end if;
  perform pg_advisory_xact_lock(hashtextextended('eps:logo-upload:'||p_upload_id::text,0));
  select * into upload from eps.upload_sessions current_upload where current_upload.id=p_upload_id and current_upload.principal_id=auth.uid() and eps.logo_scope(current_upload.workspace_id,true);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Writable upload not found.',404); end if;
  if upload.status='completed' then perform eps.fail('INVALID_TRANSITION','A completed upload cannot be cancelled.',409); end if;
  if upload.status='open' then
    select * into upload from eps.upload_sessions current_upload where current_upload.id=p_upload_id and current_upload.principal_id=auth.uid() and eps.logo_scope(current_upload.workspace_id,true) for update;
    if not found then perform eps.fail('RESOURCE_NOT_FOUND','Writable upload not found.',404); end if;
    update eps.media_assets set status='failed' where id=upload.asset_id and status='uploading';
    get diagnostics changed=row_count;
    if changed<>1 then perform eps.fail('INVALID_TRANSITION','The reserved source changed before cancellation.',409); end if;
    update eps.upload_sessions set status='cancelled',reservation_revision=reservation_revision+1 where id=upload.id;
    get diagnostics changed=row_count;
    if changed<>1 then perform eps.fail('INVALID_TRANSITION','The upload changed before cancellation.',409); end if;
  end if;
  response:=jsonb_build_object('success',true,'affected_ids',jsonb_build_array(upload.id,upload.asset_id));
  return eps.finish_mutation('cancel_upload',p_idempotency_key,payload,response,upload.id);
end $$;
create function public.eps_get_logo_media(p_asset_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$ declare asset eps.media_assets; begin
  perform eps.require_capability('workspaces.read'); select * into asset from eps.media_assets current_asset where current_asset.id=p_asset_id;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Media not found in your scope.',404); end if;
  return jsonb_build_object('asset',eps.logo_asset_dto(asset),'bucket',asset.bucket,'object_key',asset.object_key);
end $$;

create function eps.logo_storage_insert_allowed(p_bucket text,p_key text) returns boolean
language plpgsql stable security definer set search_path='' as $$ declare headers jsonb; begin
  if p_bucket is distinct from 'eps-brand-assets' or auth.uid() is null then return false; end if;
  if not(storage.allow_only_operation('object.upload') or storage.allow_only_operation('object.sign_upload_url')) then return false; end if;
  begin headers:=nullif(current_setting('request.headers',true),'')::jsonb; exception when others then return false; end;
  if jsonb_typeof(headers) is distinct from 'object' or headers->'x-upsert' is distinct from '"false"'::jsonb then return false; end if;
  return exists(select 1 from eps.upload_sessions upload where upload.bucket=p_bucket and upload.object_key=p_key and upload.principal_id=auth.uid() and upload.status='open' and upload.expires_at>clock_timestamp() and eps.logo_scope(upload.workspace_id,true));
end $$;
create function eps.logo_storage_read_allowed(p_bucket text,p_key text) returns boolean
language plpgsql stable security definer set search_path='' as $$ begin
  if p_bucket is distinct from 'eps-brand-assets' or auth.uid() is null or not storage.allow_only_operation('object.get_authenticated') then return false; end if;
  return exists(select 1 from eps.media_assets asset where asset.bucket=p_bucket and asset.object_key=p_key
    and (asset.status='ready' or exists(select 1 from eps.upload_sessions upload where upload.asset_id=asset.id and upload.principal_id=auth.uid() and upload.status='open' and upload.expires_at>clock_timestamp() and eps.logo_scope(upload.workspace_id,true))));
end $$;

do $bucket$ begin
  if exists(select 1 from storage.buckets where id='eps-brand-assets' and (public or file_size_limit is distinct from 5242880::bigint
    or allowed_mime_types is null or not(allowed_mime_types @> array['image/png','image/jpeg','image/webp'] and allowed_mime_types <@ array['image/png','image/jpeg','image/webp'])))
  then raise exception 'EXISTING_BRAND_BUCKET_CONFIGURATION_MISMATCH'; end if;
  if not exists(select 1 from storage.buckets where id='eps-brand-assets') then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('eps-brand-assets','eps-brand-assets',false,5242880,array['image/png','image/jpeg','image/webp']);
  end if;
end $bucket$;
create policy eps_logo_insert on storage.objects for insert to authenticated
  with check(bucket_id='eps-brand-assets' and eps.logo_storage_insert_allowed(bucket_id,name));
create policy eps_logo_insert_guard on storage.objects as restrictive for insert to authenticated
  with check(bucket_id<>'eps-brand-assets' or eps.logo_storage_insert_allowed(bucket_id,name));
create policy eps_logo_update_guard on storage.objects as restrictive for update to authenticated
  using(bucket_id<>'eps-brand-assets') with check(bucket_id<>'eps-brand-assets');
create policy eps_logo_delete_guard on storage.objects as restrictive for delete to authenticated using(bucket_id<>'eps-brand-assets');
create policy eps_logo_read on storage.objects for select to authenticated
  using(bucket_id='eps-brand-assets' and eps.logo_storage_read_allowed(bucket_id,name));
create policy eps_logo_read_guard on storage.objects as restrictive for select to authenticated
  using(bucket_id<>'eps-brand-assets' or eps.logo_storage_read_allowed(bucket_id,name));
-- Auth inheritance supplies managed Auth access, not authority to manipulate bytes.
-- This role-specific restrictive guard denies even inherited Storage table ACLs.
create policy eps_logo_verifier_no_storage on storage.objects as restrictive for all to eps_logo_verify_owner
  using(false) with check(false);
create policy eps_logo_verifier_no_buckets on storage.buckets as restrictive for all to eps_logo_verify_owner
  using(false) with check(false);

-- Transfer only the new, fixed function set. Never broaden an existing owner.
grant create on schema eps,public to eps_api_owner,eps_logo_verify_owner;
do $owners$ declare fn record; begin
  for fn in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='eps' and p.proname in ('logo_scope','logo_integer','logo_asset_dto','logo_upload_dto','logo_require_upload','logo_check_completion','logo_completion_value','logo_remember_completion','logo_decode_receipt','logo_verify_receipt','logo_storage_insert_allowed','logo_storage_read_allowed'))
      or(n.nspname='public' and p.proname in ('eps_reserve_logo_upload','eps_get_logo_upload','eps_prepare_logo_completion','eps_finalize_logo_completion','eps_cancel_logo_upload','eps_get_logo_media')) loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',fn.signature);
    if fn.proname in ('logo_decode_receipt','logo_verify_receipt','eps_finalize_logo_completion') then execute format('alter function %s owner to eps_logo_verify_owner',fn.signature);
    else execute format('alter function %s owner to eps_api_owner',fn.signature); end if;
    if fn.nspname='public' then execute format('grant execute on function %s to authenticated',fn.signature); end if;
  end loop;
end $owners$;
revoke create on schema eps,public from eps_api_owner,eps_logo_verify_owner;
grant execute on function eps.logo_scope(uuid,boolean),eps.logo_storage_insert_allowed(text,text),eps.logo_storage_read_allowed(text,text) to authenticated;
grant execute on function eps.logo_scope(uuid,boolean),eps.logo_integer(jsonb,bigint,bigint),eps.logo_asset_dto(eps.media_assets),eps.logo_upload_dto(uuid),eps.logo_require_upload(uuid),eps.logo_check_completion(jsonb,eps.upload_sessions),eps.logo_completion_value(uuid),eps.logo_remember_completion(text,jsonb,jsonb),eps.require_capability(text),eps.check_input(jsonb,text[]),eps.fail(text,text,integer,bigint),eps.idempotency_begin(text,text,jsonb),eps.finish_mutation(text,text,jsonb,jsonb,uuid) to eps_logo_verify_owner;
do $security$ begin
  if pg_has_role('authenticated','eps_logo_verify_owner','MEMBER') or pg_has_role('eps_api_owner','eps_logo_verify_owner','MEMBER')
    or pg_has_role('eps_logo_verify_owner','eps_api_owner','MEMBER')
    or has_table_privilege('eps_api_owner','eps.logo_verification_keys','SELECT')
    or has_table_privilege('authenticated','eps.upload_sessions','SELECT')
    or has_table_privilege('authenticated','eps.logo_verification_keys','SELECT')
    or exists(select 1 from pg_roles where rolname='eps_logo_verify_owner' and (rolcanlogin or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb))
  then raise exception 'UNSAFE_LOGO_VERIFIER_PRIVILEGES'; end if;
end $security$;
notify pgrst,'reload schema';
