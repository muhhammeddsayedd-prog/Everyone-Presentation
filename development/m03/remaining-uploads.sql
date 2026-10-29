-- DEVELOPMENT FRAGMENT ONLY. Compose after reviewed17; no runtime enablement/key.
set local lock_timeout='3s';set local statement_timeout='30s';set local search_path='';
do $$begin
 if current_user<>'postgres' or current_database()<>'postgres' or to_regclass('eps.candidate_stage_payloads') is null
  or to_regclass('eps.support_uploads') is not null or exists(select 1 from pg_roles where rolname in('eps_support_upload_owner','eps_support_verify_owner'))
 then raise exception 'M03_SUPPORT_REVIEWED17_NEW_FRAGMENT_REQUIRED';end if;
end $$;
create role eps_support_upload_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
create role eps_support_verify_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_support_upload_owner,eps_support_verify_owner to postgres;
grant authenticated to eps_support_upload_owner,eps_support_verify_owner with inherit true,set false,admin false;
grant usage on schema eps,public to eps_support_upload_owner,eps_support_verify_owner;
create table eps.candidate_support_config(id boolean primary key default true check(id),uploads_enabled boolean not null default false);
insert into eps.candidate_support_config(id)values(true);
create table eps.support_uploads(
 id uuid primary key default gen_random_uuid(),asset_id uuid not null unique references eps.media_assets(id) on delete restrict,
 principal_id uuid not null references auth.users(id) on delete restrict,workspace_id uuid not null references eps.workspaces(id) on delete restrict,
 candidate_id uuid not null references eps.candidates(id) on delete restrict,batch_id uuid,
 reservation_revision bigint not null default 1 check(reservation_revision between 1 and 9007199254740991),verification_id uuid not null default gen_random_uuid(),
 bucket text not null check(bucket='eps-candidate-support'),object_key text not null,
 expected_size_bytes bigint not null check(expected_size_bytes between 1 and 20971520),
 expected_mime_type text not null check(expected_mime_type in('image/png','image/jpeg','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')),
 expected_sha256 text check(expected_sha256~'^[a-f0-9]{64}$'),status text not null default 'open' check(status in('open','completed','cancelled')),
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default clock_timestamp()+interval '24 hours',completed_at timestamptz,completion_value jsonb,
 check(expires_at>created_at),check((status='completed')=(completed_at is not null)),check((status='completed')=(completion_value is not null)),unique(bucket,object_key),
 check(expected_mime_type not like 'image/%' or expected_size_bytes<=5242880)
);
create index support_uploads_actor_workspace on eps.support_uploads(principal_id,workspace_id);
create table eps.support_verification_keys(
 key_id text primary key check(key_id~'^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),purpose text not null default 'candidate_support' check(purpose='candidate_support'),
 secret bytea not null check(octet_length(secret)=32),not_before timestamptz not null default clock_timestamp(),not_after timestamptz,revoked_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),check(not_after is null or not_after>not_before)
);
create table eps.candidate_support(
 id uuid primary key default gen_random_uuid(),candidate_id uuid not null references eps.candidates(id) on delete restrict,
 asset_id uuid not null unique references eps.media_assets(id) on delete restrict,upload_id uuid not null unique references eps.support_uploads(id) on delete restrict,
 row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),archived_at timestamptz,archived_by uuid references auth.users(id) on delete restrict,
 check((archived_at is null)=(archived_by is null))
);
create index candidate_support_active_page on eps.candidate_support(candidate_id,created_at desc,id desc)where archived_at is null;
do $$declare rel text;begin foreach rel in array array['candidate_support_config','support_uploads','support_verification_keys','candidate_support']loop
 execute format('alter table eps.%I enable row level security',rel);execute format('alter table eps.%I force row level security',rel);
 execute format('revoke all on table eps.%I from public,anon,authenticated,service_role',rel);
end loop;end $$;
-- Preserve every deployed purpose branch byte-for-byte, adding one closed branch.
do $$declare definition text;begin
 select pg_get_constraintdef(oid) into definition from pg_constraint where conrelid='eps.media_assets'::regclass and conname='media_assets_typed_purpose_check';
 if definition is null or strpos(definition,'candidate_support')>0 or strpos(definition,'ELSE false')=0 then raise exception 'SUPPORT_PURPOSE_BASELINE_MISMATCH';end if;
 definition:=replace(definition,'ELSE false', $branch$WHEN 'candidate_support'::text THEN
 bucket='eps-candidate-support' and client_id is null and origin_workspace_id is not null and source_asset_id is null
 and producing_job_id is null and producing_attempt_id is null and output_stage is null and output_key is null and source_timestamp_ms is null and duration_ms is null
 and ((mime_type in('image/png','image/jpeg','image/webp') and size_bytes between 1 and 5242880 and (status<>'ready' or sha256 is not null and width>0 and height>0 and width::bigint*height::bigint<=40000000))
 or (mime_type in('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain') and size_bytes between 1 and 20971520 and width is null and height is null and(status<>'ready' or sha256 is not null)))
 ELSE false$branch$);
 alter table eps.media_assets drop constraint media_assets_typed_purpose_check;
 execute 'alter table eps.media_assets add constraint media_assets_typed_purpose_check '||definition;
end $$;
grant execute on function eps.has_capability(text),eps.require_capability(text),eps.logo_scope(uuid,boolean),eps.logo_integer(jsonb,bigint,bigint),eps.logo_decode_receipt(text,integer,integer),eps.fail(text,text,integer,bigint),eps.check_input(jsonb,text[]),eps.input_uuid(text),eps.idempotency_begin(text,text,jsonb),eps.finish_mutation(text,text,jsonb,jsonb,uuid)
 to eps_support_upload_owner,eps_support_verify_owner;
create function eps.support_scope(p_workspace uuid)returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and eps.has_capability('cast.read') and eps.has_capability('cast.upload') and eps.logo_scope(p_workspace,true)
$$;
grant select on eps.candidate_support_config to eps_support_upload_owner,eps_support_verify_owner;
create policy support_config_read on eps.candidate_support_config for select to eps_support_upload_owner,eps_support_verify_owner using(true);
grant select,insert on eps.support_uploads to eps_support_upload_owner;
grant update(status,reservation_revision)on eps.support_uploads to eps_support_upload_owner;
grant select,update(status,completed_at,completion_value)on eps.support_uploads to eps_support_verify_owner;
create policy support_upload_read on eps.support_uploads for select to eps_support_upload_owner,eps_support_verify_owner using(principal_id=auth.uid()and eps.support_scope(workspace_id));
create policy support_upload_insert on eps.support_uploads for insert to eps_support_upload_owner with check(principal_id=auth.uid()and status='open'and reservation_revision=1 and eps.support_scope(workspace_id));
create policy support_upload_cancel on eps.support_uploads for update to eps_support_upload_owner using(principal_id=auth.uid()and eps.support_scope(workspace_id))with check(principal_id=auth.uid()and status='cancelled'and eps.support_scope(workspace_id));
create policy support_upload_complete on eps.support_uploads for update to eps_support_verify_owner using(principal_id=auth.uid()and eps.support_scope(workspace_id))with check(principal_id=auth.uid()and status='completed'and eps.support_scope(workspace_id));
grant select on eps.support_verification_keys to eps_support_verify_owner;
create policy support_key_read on eps.support_verification_keys for select to eps_support_verify_owner using(purpose='candidate_support'and revoked_at is null);
grant select on eps.candidates to eps_support_upload_owner,eps_support_verify_owner;
grant update(row_version)on eps.candidates to eps_support_upload_owner,eps_support_verify_owner;
create policy support_candidate_read on eps.candidates for select to eps_support_upload_owner,eps_support_verify_owner using(eps.has_capability('cast.read'));
create policy support_candidate_lock on eps.candidates for update to eps_support_upload_owner,eps_support_verify_owner using(eps.has_capability('cast.read'))with check(false);
grant select(id,project_id,archived_at),update(row_version)on eps.workspaces to eps_support_upload_owner,eps_support_verify_owner;
create policy support_workspace_read on eps.workspaces for select to eps_support_upload_owner,eps_support_verify_owner using(eps.support_scope(id));
create policy support_workspace_lock on eps.workspaces for update to eps_support_upload_owner,eps_support_verify_owner using(eps.support_scope(id))with check(false);
grant select on eps.media_assets to eps_support_upload_owner,eps_support_verify_owner;
grant insert(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status)on eps.media_assets to eps_support_upload_owner;
grant update(status)on eps.media_assets to eps_support_upload_owner;
grant update(status,sha256,width,height)on eps.media_assets to eps_support_verify_owner;
create policy support_asset_read on eps.media_assets for select to eps_support_upload_owner,eps_support_verify_owner using(purpose='candidate_support'and eps.has_capability('cast.read'));
create policy support_asset_insert on eps.media_assets for insert to eps_support_upload_owner with check(purpose='candidate_support'and status='uploading'and sha256 is null and bucket='eps-candidate-support'and eps.support_scope(origin_workspace_id));
create policy support_asset_cancel on eps.media_assets for update to eps_support_upload_owner using(purpose='candidate_support'and status='uploading'and exists(select 1 from eps.support_uploads u where u.asset_id=media_assets.id and u.principal_id=auth.uid()and eps.support_scope(u.workspace_id)))with check(status='failed');
create policy support_asset_verify on eps.media_assets for update to eps_support_verify_owner using(purpose='candidate_support'and status='uploading'and exists(select 1 from eps.support_uploads u where u.asset_id=media_assets.id and u.principal_id=auth.uid()and u.status='open'and u.expires_at>clock_timestamp()and eps.support_scope(u.workspace_id)))with check(purpose='candidate_support'and status='ready'and sha256 is not null);
grant select on eps.candidate_support to eps_support_upload_owner,eps_support_verify_owner;
grant insert on eps.candidate_support to eps_support_verify_owner;
grant update(archived_at,archived_by,row_version)on eps.candidate_support to eps_support_upload_owner;
create policy support_association_read on eps.candidate_support for select to eps_support_upload_owner,eps_support_verify_owner using(eps.has_capability('cast.read'));
create policy support_association_insert on eps.candidate_support for insert to eps_support_verify_owner with check(created_by=auth.uid()and archived_at is null and exists(select 1 from eps.support_uploads u where u.id=upload_id and u.asset_id=candidate_support.asset_id and u.candidate_id=candidate_support.candidate_id and u.principal_id=auth.uid()and eps.support_scope(u.workspace_id)));
create policy support_association_archive on eps.candidate_support for update to eps_support_upload_owner using(eps.has_capability('cast.read')and eps.has_capability('cast.write'))with check(archived_by=auth.uid()and archived_at is not null and eps.has_capability('cast.write'));
grant select,insert on eps.idempotency_records to eps_support_upload_owner,eps_support_verify_owner;
grant insert on eps.audit_events to eps_support_upload_owner,eps_support_verify_owner;
create policy support_idempotency on eps.idempotency_records for all to eps_support_upload_owner,eps_support_verify_owner using(principal_id=auth.uid()and operation in('support.reserve_upload','support.complete_upload','support.cancel_upload','support.archive'))with check(principal_id=auth.uid()and operation in('support.reserve_upload','support.complete_upload','support.cancel_upload','support.archive'));
create policy support_audit on eps.audit_events for insert to eps_support_upload_owner,eps_support_verify_owner with check(principal_id=auth.uid()and action in('support.reserve_upload','support.complete_upload','support.cancel_upload','support.archive'));
create function eps.support_media_dto(p_asset eps.media_assets)returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('id',p_asset.id,'purpose',p_asset.purpose,'filename',p_asset.filename,'mime_type',p_asset.mime_type,'size_bytes',p_asset.size_bytes,'sha256',p_asset.sha256,'status',p_asset.status,'duration_ms',p_asset.duration_ms,'width',p_asset.width,'height',p_asset.height,'source_asset_id',p_asset.source_asset_id,'source_timestamp_ms',p_asset.source_timestamp_ms,'created_at',p_asset.created_at)
$$;
create function eps.support_upload_dto(p_upload uuid)returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('upload_id',u.id,'asset',eps.support_media_dto(a),'principal_id',u.principal_id,'workspace_id',u.workspace_id,'candidate_id',u.candidate_id,'reservation_revision',u.reservation_revision,'verification_id',u.verification_id,'bucket',u.bucket,'object_key',u.object_key,'expected_size_bytes',u.expected_size_bytes,'expected_mime_type',u.expected_mime_type,'expected_sha256',u.expected_sha256,'expires_at',u.expires_at,'status',case when u.status='open'and u.expires_at<=clock_timestamp()then'expired'else u.status end)
 from eps.support_uploads u join eps.media_assets a on a.id=u.asset_id where u.id=p_upload
$$;
create function eps.support_require(p_upload uuid)returns eps.support_uploads language plpgsql volatile security invoker set search_path='' as $$declare u eps.support_uploads;begin
 select * into u from eps.support_uploads where id=p_upload and principal_id=auth.uid()and eps.support_scope(workspace_id);
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Supporting upload not found.',404);end if;return u;
end $$;
create function eps.support_check_completion(p_input jsonb,p_upload eps.support_uploads)returns void language plpgsql immutable security invoker set search_path='' as $$begin
 perform eps.check_input(p_input,array['actual_size_bytes','sha256','start_processing']);
 if eps.logo_integer(p_input->'actual_size_bytes',1,20971520)<>p_upload.expected_size_bytes or p_input->'start_processing' is distinct from 'false'::jsonb
  or p_input?'sha256'and(jsonb_typeof(p_input->'sha256')is distinct from'string'or p_input->>'sha256'!~'^[a-f0-9]{64}$'or p_upload.expected_sha256 is not null and p_input->>'sha256'<>p_upload.expected_sha256)
 then perform eps.fail('INVALID_REQUEST','Supporting-file completion must match its reservation without AI processing.',400);end if;
 if p_upload.status='completed'and p_input?'sha256'and p_input->>'sha256'is distinct from p_upload.completion_value#>>'{asset,sha256}'then perform eps.fail('INVALID_TRANSITION','Completion checksum changed.',409);end if;
end $$;
create function public.eps_reserve_support_upload(p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare ws uuid;target uuid;batch uuid;mime text;ext text;size bigint;replay jsonb;upload uuid:=gen_random_uuid();asset uuid:=gen_random_uuid();begin
 perform eps.check_input(p_input,array['workspace_id','candidate_id','batch_id','purpose','filename','mime_type','size_bytes','sha256']);ws:=eps.input_uuid(p_input->>'workspace_id');target:=eps.input_uuid(p_input->>'candidate_id');mime:=p_input->>'mime_type';
 if not eps.support_scope(ws)then perform eps.fail('RESOURCE_NOT_FOUND','Writable supporting-file workspace not found.',404);end if;
 if p_input->>'purpose'is distinct from'candidate_support'or jsonb_typeof(p_input->'filename')is distinct from'string'or length(btrim(p_input->>'filename'))not between 1 and 255 or p_input->>'filename'~E'[/\\\\[:cntrl:]]'
  or mime not in('image/png','image/jpeg','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')
  or p_input?'sha256'and(jsonb_typeof(p_input->'sha256')is distinct from'string'or p_input->>'sha256'!~'^[a-f0-9]{64}$')then perform eps.fail('INVALID_REQUEST','Provide a supported reference file and candidate.',400);end if;
 size:=eps.logo_integer(p_input->'size_bytes',1,case when mime like'image/%'then 5242880 else 20971520 end);if p_input?'batch_id'then batch:=eps.input_uuid(p_input->>'batch_id');end if;
 if not exists(select 1 from eps.candidates where id=target and archived_at is null and merged_into_candidate_id is null)then perform eps.fail('RESOURCE_NOT_FOUND','Active candidate not found.',404);end if;
 replay:=eps.idempotency_begin('support.reserve_upload',p_idempotency_key,p_input);if replay is not null then perform eps.support_require((replay->>'upload_id')::uuid);return eps.support_upload_dto((replay->>'upload_id')::uuid);end if;
 if not exists(select 1 from eps.candidate_support_config where id and uploads_enabled)then perform eps.fail('FEATURE_NOT_IMPLEMENTED','Supporting uploads are disabled.',503);end if;
 perform 1 from eps.workspaces where id=ws for update;perform 1 from eps.candidates where id=target and archived_at is null and merged_into_candidate_id is null for update;
 if not found or not eps.support_scope(ws)then perform eps.fail('RESOURCE_NOT_FOUND','Writable candidate not found.',404);end if;
 ext:=case mime when'image/png'then'png'when'image/jpeg'then'jpg'when'image/webp'then'webp'when'application/pdf'then'pdf'when'text/plain'then'txt'else'docx'end;
 insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status)values(asset,ws,'candidate_support',p_input->>'filename',mime,'eps-candidate-support','assets/'||asset||'/original.'||ext,size,'uploading');
 insert into eps.support_uploads(id,asset_id,principal_id,workspace_id,candidate_id,batch_id,bucket,object_key,expected_size_bytes,expected_mime_type,expected_sha256)values(upload,asset,auth.uid(),ws,target,batch,'eps-candidate-support','assets/'||asset||'/original.'||ext,size,mime,p_input->>'sha256');
 return eps.finish_mutation('support.reserve_upload',p_idempotency_key,p_input,eps.support_upload_dto(upload),asset);
end $$;
create function public.eps_get_support_upload(p_upload_id uuid)returns jsonb language plpgsql volatile security definer set search_path='' as $$begin perform eps.support_require(p_upload_id);return eps.support_upload_dto(p_upload_id);end $$;
create function public.eps_prepare_support_completion(p_upload_id uuid,p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path='' as $$declare u eps.support_uploads;replay jsonb;payload jsonb:=jsonb_build_object('id',p_upload_id,'input',p_input);begin
 u:=eps.support_require(p_upload_id);perform eps.support_check_completion(p_input,u);replay:=eps.idempotency_begin('support.complete_upload',p_idempotency_key,payload);u:=eps.support_require(p_upload_id);
 if replay is null and u.status='completed'then replay:=eps.finish_mutation('support.complete_upload',p_idempotency_key,payload,u.completion_value,u.asset_id);end if;
 return jsonb_build_object('reservation',eps.support_upload_dto(p_upload_id),'replay',replay);
end $$;
create function eps.support_verify_receipt(p_upload eps.support_uploads,p_payload text,p_mac text)returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare bytes bytea;supplied bytea;computed bytea;original json;claims jsonb;key eps.support_verification_keys;count_keys integer;distinct_keys integer;difference integer:=0;i integer;issued bigint;expires bigint;current_second bigint;expected_format text;w bigint;h bigint;begin
 bytes:=eps.logo_decode_receipt(p_payload,4096);supplied:=eps.logo_decode_receipt(p_mac,32,32);
 begin original:=convert_from(bytes,'UTF8')::json;if json_typeof(original)is distinct from'object'then raise exception'invalid';end if;
 select count(*),count(distinct item.key)into count_keys,distinct_keys from json_each(original)item;if count_keys<>21 or distinct_keys<>21 then raise exception'invalid';end if;claims:=original::jsonb;
 exception when others then perform eps.fail('ACCESS_DENIED','Invalid supporting-file verification.',403);end;
 perform eps.check_input(claims,array['schema_version','audience','purpose','key_id','verification_id','upload_id','asset_id','principal_id','workspace_id','candidate_id','width','height','reservation_revision','bucket','object_key','size_bytes','sha256','mime_type','verified_format','issued_at','expires_at']);
 if jsonb_typeof(claims->'key_id')is distinct from'string'or claims->>'key_id'!~'^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'then perform eps.fail('ACCESS_DENIED','Invalid supporting-file verification.',403);end if;
 select * into key from eps.support_verification_keys k where k.key_id=claims->>'key_id'and k.purpose='candidate_support'and k.revoked_at is null;if not found then perform eps.fail('ACCESS_DENIED','Invalid supporting-file verification.',403);end if;
 computed:=extensions.hmac(bytes,key.secret,'sha256');for i in 0..31 loop difference:=difference|(get_byte(computed,i)#get_byte(supplied,i));end loop;if difference<>0 then perform eps.fail('ACCESS_DENIED','Invalid supporting-file verification.',403);end if;
 issued:=eps.logo_integer(claims->'issued_at',0,253402300799);expires:=eps.logo_integer(claims->'expires_at',0,253402300799);current_second:=floor(extract(epoch from clock_timestamp()))::bigint;
 expected_format:=case p_upload.expected_mime_type when'image/png'then'png'when'image/jpeg'then'jpeg'when'image/webp'then'webp'when'application/pdf'then'pdf'when'text/plain'then'utf8_text'else'docx'end;
 if p_upload.expected_mime_type like'image/%'then w:=eps.logo_integer(claims->'width',1,40000000);h:=eps.logo_integer(claims->'height',1,40000000);if w*h>40000000 then perform eps.fail('ACCESS_DENIED','Image dimensions exceed the verified limit.',403);end if;
 elsif claims->'width'is distinct from'null'::jsonb or claims->'height'is distinct from'null'::jsonb then perform eps.fail('ACCESS_DENIED','Invalid document dimensions.',403);end if;
 if issued>current_second or expires<=current_second or expires<=issued or expires-issued>120 or key.not_before>to_timestamp(issued)or key.not_after is not null and key.not_after<to_timestamp(expires)
 or claims->>'schema_version'is distinct from'candidate-support-verification.v1'or claims->>'audience'is distinct from'eps.candidate-support-verification'or claims->>'purpose'is distinct from'candidate_support'
 or claims->>'verification_id'is distinct from p_upload.verification_id::text or claims->>'upload_id'is distinct from p_upload.id::text or claims->>'asset_id'is distinct from p_upload.asset_id::text or claims->>'principal_id'is distinct from auth.uid()::text or claims->>'workspace_id'is distinct from p_upload.workspace_id::text or claims->>'candidate_id'is distinct from p_upload.candidate_id::text
 or eps.logo_integer(claims->'reservation_revision',1,9007199254740991)<>p_upload.reservation_revision or claims->>'bucket'is distinct from p_upload.bucket or claims->>'object_key'is distinct from p_upload.object_key
 or eps.logo_integer(claims->'size_bytes',1,20971520)<>p_upload.expected_size_bytes or claims->>'mime_type'is distinct from p_upload.expected_mime_type or claims->>'verified_format'is distinct from expected_format
 or jsonb_typeof(claims->'sha256')is distinct from'string'or claims->>'sha256'!~'^[a-f0-9]{64}$'or p_upload.expected_sha256 is not null and claims->>'sha256'<>p_upload.expected_sha256
 then perform eps.fail('ACCESS_DENIED','Supporting-file verification scope or lifetime is invalid.',403);end if;return claims;
end $$;
create function public.eps_finalize_support_completion(p_upload_id uuid,p_input jsonb,p_idempotency_key text,p_payload text,p_mac text)returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare u eps.support_uploads;payload jsonb:=jsonb_build_object('id',p_upload_id,'input',p_input);replay jsonb;claims jsonb;asset eps.media_assets;result jsonb;begin
 u:=eps.support_require(p_upload_id);perform eps.support_check_completion(p_input,u);replay:=eps.idempotency_begin('support.complete_upload',p_idempotency_key,payload);u:=eps.support_require(p_upload_id);if replay is not null then return replay;end if;
 if u.status='completed'then return eps.finish_mutation('support.complete_upload',p_idempotency_key,payload,u.completion_value,u.asset_id);end if;
 perform 1 from eps.workspaces where id=u.workspace_id for update;perform 1 from eps.candidates where id=u.candidate_id and archived_at is null and merged_into_candidate_id is null for update;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active candidate not found.',404);end if;
 select * into u from eps.support_uploads where id=p_upload_id for update;perform eps.support_check_completion(p_input,u);
 if u.status='completed'then return eps.finish_mutation('support.complete_upload',p_idempotency_key,payload,u.completion_value,u.asset_id);end if;
 if u.status<>'open'or u.expires_at<=clock_timestamp()or not eps.support_scope(u.workspace_id)then perform eps.fail('UPLOAD_EXPIRED','Supporting upload is cancelled or expired.',409);end if;
 if not exists(select 1 from eps.candidate_support_config where id and uploads_enabled)then perform eps.fail('FEATURE_NOT_IMPLEMENTED','Supporting uploads are disabled.',503);end if;
 claims:=eps.support_verify_receipt(u,p_payload,p_mac);if p_input?'sha256'and p_input->>'sha256'<>claims->>'sha256'then perform eps.fail('INVALID_REQUEST','Completion checksum differs from verified bytes.',400);end if;
 select * into asset from eps.media_assets where id=u.asset_id for update;
 if not found or asset.purpose<>'candidate_support'or asset.status<>'uploading'or asset.size_bytes<>u.expected_size_bytes or asset.mime_type<>u.expected_mime_type then perform eps.fail('INVALID_TRANSITION','Supporting asset is not awaiting verification.',409);end if;
 update eps.media_assets set status='ready',sha256=claims->>'sha256',width=(claims->>'width')::integer,height=(claims->>'height')::integer where id=asset.id and status='uploading';if not found then perform eps.fail('INVALID_TRANSITION','Supporting asset did not become Ready.',409);end if;
 select * into asset from eps.media_assets where id=u.asset_id;
 if asset.status is distinct from'ready'or asset.sha256 is distinct from claims->>'sha256'or asset.width is distinct from(claims->>'width')::integer or asset.height is distinct from(claims->>'height')::integer then perform eps.fail('INVALID_TRANSITION','Verified supporting metadata was altered during completion.',409);end if;
 insert into eps.candidate_support(candidate_id,asset_id,upload_id,created_by)values(u.candidate_id,u.asset_id,u.id,auth.uid());
 select * into asset from eps.media_assets where id=u.asset_id;result:=jsonb_build_object('asset',eps.support_media_dto(asset),'processing_job_id',null,'status','ready');
 update eps.support_uploads set status='completed',completed_at=clock_timestamp(),completion_value=result where id=u.id and status='open'and expires_at>clock_timestamp();if not found then perform eps.fail('UPLOAD_EXPIRED','Supporting upload expired during completion.',409);end if;
 return eps.finish_mutation('support.complete_upload',p_idempotency_key,payload,result,asset.id);
end $$;
create function public.eps_cancel_support_upload(p_upload_id uuid,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path='' as $$declare u eps.support_uploads;payload jsonb:=jsonb_build_object('id',p_upload_id);replay jsonb;result jsonb;begin
 u:=eps.support_require(p_upload_id);replay:=eps.idempotency_begin('support.cancel_upload',p_idempotency_key,payload);u:=eps.support_require(p_upload_id);if replay is not null then return replay;end if;
 perform 1 from eps.workspaces where id=u.workspace_id for update;perform 1 from eps.candidates where id=u.candidate_id for update;select * into u from eps.support_uploads where id=p_upload_id for update;
 if u.status='completed'then perform eps.fail('INVALID_TRANSITION','Archive a completed supporting file instead.',409);end if;
 if u.status='open'then update eps.media_assets set status='failed'where id=u.asset_id and status='uploading';update eps.support_uploads set status='cancelled',reservation_revision=reservation_revision+1 where id=u.id;end if;
 result:=jsonb_build_object('success',true,'affected_ids',jsonb_build_array(u.id,u.asset_id));return eps.finish_mutation('support.cancel_upload',p_idempotency_key,payload,result,u.asset_id);
end $$;
create function public.eps_get_candidate_support_asset(p_asset_id uuid)returns jsonb language plpgsql stable security definer set search_path='' as $$declare a eps.media_assets;begin
 perform eps.require_capability('cast.read');select * into a from eps.media_assets where id=p_asset_id and purpose='candidate_support'and status='ready'and exists(select 1 from eps.candidate_support s where s.asset_id=media_assets.id);
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Ready supporting file not found.',404);end if;return jsonb_build_object('asset',eps.support_media_dto(a),'bucket',a.bucket,'object_key',a.object_key);
end $$;
create function public.eps_list_candidate_support(p_candidate_id uuid,p_cursor uuid default null,p_limit integer default 25)returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;cursor_time timestamptz;begin
 perform eps.require_capability('cast.read');if p_limit is null or p_limit<1 or p_limit>100 then perform eps.fail('INVALID_REQUEST','Provide a bounded supporting-file page.',400);end if;
 if not exists(select 1 from eps.candidates where id=p_candidate_id)then perform eps.fail('RESOURCE_NOT_FOUND','Candidate not found.',404);end if;
 if p_cursor is not null then select created_at into cursor_time from eps.candidate_support where id=p_cursor and candidate_id=p_candidate_id;if not found then perform eps.fail('INVALID_REQUEST','Supporting-file cursor is outside this candidate.',400);end if;end if;
 with page as(select s.*,eps.support_media_dto(a)asset from eps.candidate_support s join eps.media_assets a on a.id=s.asset_id where s.candidate_id=p_candidate_id and s.archived_at is null and a.status='ready'and(p_cursor is null or(s.created_at,s.id)<(cursor_time,p_cursor))order by s.created_at desc,s.id desc limit p_limit+1),numbered as(select *,row_number()over(order by created_at desc,id desc)n from page)
 select jsonb_build_object('data',coalesce(jsonb_agg(jsonb_build_object('id',id,'row_version',row_version,'candidate_id',candidate_id,'asset',asset,'created_at',created_at)order by n)filter(where n<=p_limit),'[]'::jsonb),'page',jsonb_build_object('next_cursor',case when count(*)>p_limit then(max(id::text)filter(where n=p_limit))else null end))into result from numbered;return result;
end $$;
create function public.eps_archive_candidate_support(p_support_id uuid,p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path='' as $$declare s eps.candidate_support;payload jsonb:=jsonb_build_object('id',p_support_id,'input',p_input);replay jsonb;begin
 perform eps.require_capability('cast.read');perform eps.require_capability('cast.write');perform eps.check_input(p_input,array['row_version']);perform eps.logo_integer(p_input->'row_version',1,9007199254740991);
 select * into s from eps.candidate_support where id=p_support_id;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Supporting file not found.',404);end if;
 replay:=eps.idempotency_begin('support.archive',p_idempotency_key,payload);if replay is not null then return replay;end if;
 select * into s from eps.candidate_support where id=p_support_id for update;if s.row_version<>(p_input->>'row_version')::bigint then perform eps.fail('STALE_RESOURCE_VERSION','Supporting file changed. Reload it before archiving.',409,s.row_version);end if;
 if s.archived_at is null then update eps.candidate_support set archived_at=clock_timestamp(),archived_by=auth.uid(),row_version=row_version+1 where id=s.id;end if;
 return eps.finish_mutation('support.archive',p_idempotency_key,payload,jsonb_build_object('ok',true),s.id);
end $$;
create function eps.support_storage_insert(p_bucket text,p_key text)returns boolean language plpgsql volatile security definer set search_path='' as $$declare h jsonb;begin
 if p_bucket is distinct from'eps-candidate-support'or auth.uid()is null or not exists(select 1 from eps.candidate_support_config where id and uploads_enabled)then return false;end if;
 begin h:=nullif(current_setting('request.headers',true),'')::jsonb;exception when others then return false;end;
 if jsonb_typeof(h)is distinct from'object'or h->>'x-upsert'is distinct from'false'then return false;end if;
 return exists(select 1 from eps.support_uploads u where u.principal_id=auth.uid()and u.bucket=p_bucket and u.object_key=p_key and u.status='open'and u.expires_at>clock_timestamp()and eps.support_scope(u.workspace_id));
end $$;
create function eps.support_storage_read(p_bucket text,p_key text)returns boolean language sql volatile security definer set search_path='' as $$
 select p_bucket='eps-candidate-support'and auth.uid()is not null and eps.has_capability('cast.read')and exists(select 1 from eps.media_assets a where a.bucket=p_bucket and a.object_key=p_key and a.purpose='candidate_support'and(a.status='ready'and exists(select 1 from eps.candidate_support s where s.asset_id=a.id)or a.status='uploading'and exists(select 1 from eps.support_uploads u where u.asset_id=a.id and u.principal_id=auth.uid()and u.status='open'and u.expires_at>clock_timestamp()and eps.support_scope(u.workspace_id))))
$$;
-- Exact ownership/grants: no prefix LIKE/wildcard can expose internal helpers.
grant create on schema eps,public to eps_support_upload_owner,eps_support_verify_owner;
do $$declare r regprocedure;begin
 foreach r in array array['eps.support_scope(uuid)'::regprocedure,'eps.support_media_dto(eps.media_assets)'::regprocedure,'eps.support_upload_dto(uuid)'::regprocedure,'eps.support_require(uuid)'::regprocedure,'eps.support_check_completion(jsonb,eps.support_uploads)'::regprocedure,
 'public.eps_reserve_support_upload(jsonb,text)'::regprocedure,'public.eps_get_support_upload(uuid)'::regprocedure,'public.eps_prepare_support_completion(uuid,jsonb,text)'::regprocedure,'public.eps_cancel_support_upload(uuid,text)'::regprocedure,'public.eps_get_candidate_support_asset(uuid)'::regprocedure,'public.eps_list_candidate_support(uuid,uuid,integer)'::regprocedure,'public.eps_archive_candidate_support(uuid,jsonb,text)'::regprocedure,'eps.support_storage_insert(text,text)'::regprocedure,'eps.support_storage_read(text,text)'::regprocedure]loop
 execute format('alter function %s owner to eps_support_upload_owner',r);execute format('revoke all on function %s from public,anon,authenticated,service_role',r);
 end loop;
 foreach r in array array['eps.support_verify_receipt(eps.support_uploads,text,text)'::regprocedure,'public.eps_finalize_support_completion(uuid,jsonb,text,text,text)'::regprocedure]loop execute format('alter function %s owner to eps_support_verify_owner',r);execute format('revoke all on function %s from public,anon,authenticated,service_role',r);end loop;
end $$;
revoke create on schema eps,public from eps_support_upload_owner,eps_support_verify_owner;
grant execute on function eps.support_scope(uuid),eps.support_media_dto(eps.media_assets),eps.support_upload_dto(uuid),eps.support_require(uuid),eps.support_check_completion(jsonb,eps.support_uploads)to eps_support_verify_owner;
grant execute on function public.eps_reserve_support_upload(jsonb,text),public.eps_get_support_upload(uuid),public.eps_prepare_support_completion(uuid,jsonb,text),public.eps_finalize_support_completion(uuid,jsonb,text,text,text),public.eps_cancel_support_upload(uuid,text),public.eps_get_candidate_support_asset(uuid),public.eps_list_candidate_support(uuid,uuid,integer),public.eps_archive_candidate_support(uuid,jsonb,text)to authenticated;
grant execute on function eps.support_storage_insert(text,text),eps.support_storage_read(text,text)to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('eps-candidate-support','eps-candidate-support',false,20971520,array['image/png','image/jpeg','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']);
create policy eps_support_insert on storage.objects for insert to authenticated with check(bucket_id='eps-candidate-support'and(storage.allow_only_operation('object.upload')or storage.allow_only_operation('object.sign_upload_url'))and eps.support_storage_insert(bucket_id,name));
create policy eps_support_read on storage.objects for select to authenticated using(bucket_id='eps-candidate-support'and(storage.allow_only_operation('object.get_authenticated')or storage.allow_only_operation('object.get_authenticated_info')or storage.allow_only_operation('object.sign'))and eps.support_storage_read(bucket_id,name));
-- No UPDATE/DELETE/list permission; known Ready originals remain private/retained.
notify pgrst,'reload schema';

create policy support_owners_no_objects on storage.objects as restrictive for all to eps_support_upload_owner,eps_support_verify_owner using(false)with check(false);
create policy support_owners_no_buckets on storage.buckets as restrictive for all to eps_support_upload_owner,eps_support_verify_owner using(false)with check(false);
create policy eps_support_insert_guard on storage.objects as restrictive for insert to public with check(bucket_id<>'eps-candidate-support'or(storage.allow_only_operation('object.upload')or storage.allow_only_operation('object.sign_upload_url'))and eps.support_storage_insert(bucket_id,name));
create policy eps_support_read_guard on storage.objects as restrictive for select to public using(bucket_id<>'eps-candidate-support'or(storage.allow_only_operation('object.get_authenticated')or storage.allow_only_operation('object.get_authenticated_info')or storage.allow_only_operation('object.sign'))and eps.support_storage_read(bucket_id,name));
create policy eps_support_update_guard on storage.objects as restrictive for update to public using(bucket_id<>'eps-candidate-support')with check(bucket_id<>'eps-candidate-support');
create policy eps_support_delete_guard on storage.objects as restrictive for delete to public using(bucket_id<>'eps-candidate-support');
grant execute on function eps.support_storage_insert(text,text),eps.support_storage_read(text,text)to anon;
-- A lost final TUS response must be confirmed by Storage.info before web enqueue.
-- Initial original bytes remain readable only through the native scoped lease.
create function eps.candidate_pending_info_allowed(p_bucket text,p_key text)returns boolean language sql volatile security definer set search_path='' as $$
 select p_bucket='eps-candidate-assets'and auth.uid()is not null and exists(select 1 from eps.candidate_uploads u join eps.media_assets a on a.id=u.asset_id
 where u.principal_id=auth.uid()and u.bucket=p_bucket and u.object_key=p_key and u.status='open'and u.expires_at>clock_timestamp()and a.status='uploading'and eps.candidate_upload_scope(u.workspace_id))
$$;
grant create on schema eps to eps_candidate_upload_owner;
alter function eps.candidate_pending_info_allowed(text,text)owner to eps_candidate_upload_owner;
revoke create on schema eps from eps_candidate_upload_owner;
revoke all on function eps.candidate_pending_info_allowed(text,text)from public,anon,authenticated,service_role;
grant execute on function eps.candidate_pending_info_allowed(text,text)to anon,authenticated;
create policy eps_candidate_pending_info on storage.objects for select to authenticated using(bucket_id='eps-candidate-assets'and storage.allow_only_operation('object.get_authenticated_info')and eps.candidate_pending_info_allowed(bucket_id,name));
do $$declare expression text;begin
 select pg_get_expr(polqual,polrelid)into expression from pg_policy where polrelid='storage.objects'::regclass and polname='eps_candidate_read_guard'and not polpermissive and polcmd='r'and polroles=array[0::oid];
 if expression is null or strpos(expression,'candidate_pending_info_allowed')>0 then raise exception 'CANDIDATE_READ_GUARD_BASELINE_REQUIRED';end if;
 drop policy eps_candidate_read_guard on storage.objects;
 execute 'create policy eps_candidate_read_guard on storage.objects as restrictive for select to public using(('||expression||')or(bucket_id=''eps-candidate-assets''and storage.allow_only_operation(''object.get_authenticated_info'')and eps.candidate_pending_info_allowed(bucket_id,name)))';
end $$;

-- Explicit identity resolution transfers Ready association ownership atomically.
-- Immutable source bytes and upload receipt candidate identity are retained.
grant update(candidate_id)on eps.candidate_support to eps_support_upload_owner;
create policy support_association_merge on eps.candidate_support for update to eps_support_upload_owner
 using(eps.has_capability('cast.read')and eps.has_capability('cast.write')and exists(select 1 from eps.candidates c where c.id=candidate_support.candidate_id and c.merged_into_candidate_id is not null and c.duplicate_resolution='link_existing'))
 with check(eps.has_capability('cast.read')and eps.has_capability('cast.write')and exists(select 1 from eps.candidates c where c.id=candidate_support.candidate_id and c.archived_at is null and c.merged_into_candidate_id is null));
drop policy support_audit on eps.audit_events;
create policy support_audit on eps.audit_events for insert to eps_support_upload_owner,eps_support_verify_owner with check(principal_id=auth.uid()and action in('support.reserve_upload','support.complete_upload','support.cancel_upload','support.archive','support.merge_association'));
create function eps.support_move_after_merge(p_source uuid,p_target uuid)returns void language plpgsql volatile security definer set search_path='' as $$
declare item eps.candidate_support;h jsonb:='{}';request_id text;client_type text;begin
 perform eps.require_capability('cast.read');perform eps.require_capability('cast.write');
 if p_source=p_target or not exists(select 1 from eps.candidates where id=p_source and merged_into_candidate_id=p_target and archived_at is not null and duplicate_resolution='link_existing')
 or not exists(select 1 from eps.candidates where id=p_target and archived_at is null and merged_into_candidate_id is null)then perform eps.fail('INVALID_TRANSITION','An explicit completed candidate merge is required.',409);end if;
 begin h:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}');exception when others then h:='{}';end;
 request_id:=h->>'x-eps-request-id';if request_id is null or request_id!~'^[A-Za-z0-9._:-]{1,128}$'then request_id:=null;end if;
 client_type:=h->>'x-eps-client-type';if client_type is null or client_type not in('browser','api','mcp')then client_type:='api';end if;
 for item in select s.* from eps.candidate_support s join eps.media_assets a on a.id=s.asset_id where s.candidate_id=p_source and a.status='ready'order by s.id for update of s loop
  update eps.candidate_support set candidate_id=p_target,row_version=row_version+1 where id=item.id and candidate_id=p_source;
  if not found then perform eps.fail('INVALID_TRANSITION','Supporting-file association changed during merge.',409);end if;
  insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type)values(auth.uid(),'support.merge_association',item.id,request_id,client_type);
 end loop;
end $$;
grant create on schema eps to eps_support_upload_owner;
alter function eps.support_move_after_merge(uuid,uuid)owner to eps_support_upload_owner;
revoke create on schema eps from eps_support_upload_owner;
revoke all on function eps.support_move_after_merge(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function eps.support_move_after_merge(uuid,uuid)to eps_cast_owner;
do $$declare definition text;body text;needle text:=' result:=eps.cast_candidate_dto(target_row.id);';begin
 select prosrc into body from pg_proc where oid='eps.cast_link_duplicate(uuid,jsonb,text)'::regprocedure;
 if encode(sha256(convert_to(replace(body,E'\r\n',E'\n'),'UTF8')),'hex')<>'77ed6422c08d43c55829719bb729474faaf3077691c334691063d95a84e20952'
 or (length(body)-length(replace(body,needle,'')))/length(needle)<>1 then raise exception 'SUPPORT_DUPLICATE_EXACT_REVIEWED17_SOURCE_REQUIRED';end if;
 select pg_get_functiondef('eps.cast_link_duplicate(uuid,jsonb,text)'::regprocedure)into definition;
 definition:=replace(definition,needle,' perform eps.support_move_after_merge(source_row.id,target_row.id);'||E'\n'||needle);execute definition;
end $$;
