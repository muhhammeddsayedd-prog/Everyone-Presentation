-- M03 additive remaining media/library18 after exact reviewed17.
-- Supporting references, source-grounded filters, immutable native frame append, requester-only frame jobs.
-- No fixture data, credentials, native-image enablement or runtime activation.
set local lock_timeout='5s';set local statement_timeout='30s';set local search_path='';
do $baseline$begin
 if current_user<>'postgres' or current_database()<>'postgres' or
 (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500']::text[]
 then raise exception 'M03_REMAINING_REVIEWED_SEVENTEEN_REQUIRED';end if;
end $baseline$;

-- Exact reviewed fragment: development/m03/remaining-uploads.sql
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


-- Exact reviewed fragment: development/m03/remaining-filters.sql
-- M03 additive role-filter projection. Development fragment for reviewed migration18 composition.
-- Existing forced-RLS eps_specs_owner already has scoped role reads. No new table, policy or runtime authority.
-- Database-function security reference: https://supabase.com/docs/guides/database/functions
set local search_path='';
set local lock_timeout='3s';
set local statement_timeout='30s';
-- Search keeps raw supplied text. Only these exact integer/range forms get numeric overlap semantics.
create function eps.cast_supplied_age_bounds(p_value text) returns integer[]
language plpgsql immutable strict security invoker set search_path='' as $$
declare parts text[];minimum integer;maximum integer;begin
  parts:=regexp_match(btrim(p_value,E' \t\r\n'),'^([0-9]{1,3})(?: *[-–—] *([0-9]{1,3}))?$');
  if parts is null then return null;end if;
  minimum:=parts[1]::integer;maximum:=coalesce(parts[2],parts[1])::integer;
  if minimum>maximum or maximum>130 then return null;end if;
  return array[minimum,maximum];
end $$;
create or replace function eps.cast_search_match(p_facts jsonb,p_search jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare key text;field text;actual jsonb;wanted text;actual_age integer[];wanted_age integer[];matched jsonb:='[]';unknowns jsonb:='[]';begin
  if nullif(btrim(p_search->>'q'),'') is not null and position(lower(btrim(p_search->>'q')) in lower(coalesce((select string_agg(case when jsonb_typeof(value)='array' then (select string_agg(element,' ') from jsonb_array_elements_text(value) element) else value#>>'{}' end,' ') from jsonb_each(p_facts)),'')))=0 then return null;end if;
  foreach key in array array['age_or_range','stated_gender','height_measurements','language','accent','skill','city','previous_project_role','classification'] loop
    wanted:=nullif(btrim(p_search->>key,E' \t\r\n'),'');if wanted is null then continue;end if;
    field:=case key when 'language' then 'languages' when 'accent' then 'accents' when 'skill' then 'skills_experience' when 'previous_project_role' then 'previous_projects_roles' else key end;
    actual:=p_facts->field;
    if actual is null or actual='null'::jsonb or actual='[]'::jsonb then
      if coalesce((p_search->>'include_unknown')::boolean,true)=false then return null;end if;unknowns:=unknowns||to_jsonb(key);
    elsif key='stated_gender' then
      if lower(btrim(actual#>>'{}',E' \t\r\n'))<>lower(wanted) then return null;end if;matched:=matched||to_jsonb(key);
    elsif key='age_or_range' then
      actual_age:=eps.cast_supplied_age_bounds(actual#>>'{}');wanted_age:=eps.cast_supplied_age_bounds(wanted);
      if actual_age is not null and wanted_age is not null then
        if actual_age[1]>wanted_age[2] or wanted_age[1]>actual_age[2] then return null;end if;
      elsif position(lower(wanted) in lower(actual#>>'{}'))=0 then return null;end if;
      matched:=matched||to_jsonb(key);
    elsif jsonb_typeof(actual)='array' then
      if not exists(select 1 from jsonb_array_elements_text(actual) value where position(lower(wanted) in lower(value))>0) then return null;end if;matched:=matched||to_jsonb(key);
    else
      if position(lower(wanted) in lower(actual#>>'{}'))=0 then return null;end if;matched:=matched||to_jsonb(key);
    end if;
  end loop;
  return jsonb_build_object('matched_filter_fields',matched,'unknown_filter_fields',unknowns);
end $$;
revoke all on function eps.cast_supplied_age_bounds(text) from public,anon,authenticated,service_role;
grant create on schema eps to eps_cast_owner;
alter function eps.cast_supplied_age_bounds(text) owner to eps_cast_owner;
revoke create on schema eps from eps_cast_owner;
create function public.eps_suggest_candidate_filters(p_role_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare role record; filters jsonb; begin
  perform eps.require_capability('workspaces.read');
  perform eps.require_capability('cast.read');
  select resource.id,resource.category,resource.requirements into role from eps.roles resource
    where resource.id=p_role_id and resource.archived_at is null and eps.specs_scope(resource.workspace_id,false);
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active role not found in an accessible workspace.',404); end if;
  perform eps.specs_check_requirements(role.requirements);
  -- No transformations from role name, shoot location, appearance, free instructions or candidate data.
  -- Retain the first identical field/value's source path; distinct values remain separate editable choices.
  with values_to_suggest as (
    select 1::bigint ordinal,'age_or_range'::text field,role.requirements->>'age_range' value,'requirements.age_range'::text source_field
    union all select 2,'stated_gender',role.requirements->>'gender_requirement','requirements.gender_requirement'
    union all select 3 + item.ordinal,'language',item.value,'requirements.languages['||(item.ordinal-1)::text||']'
      from jsonb_array_elements_text(role.requirements->'languages') with ordinality item(value,ordinal)
    union all select 3 + jsonb_array_length(role.requirements->'languages') + item.ordinal,'accent',item.value,'requirements.accents['||(item.ordinal-1)::text||']'
      from jsonb_array_elements_text(role.requirements->'accents') with ordinality item(value,ordinal)
    union all select 3 + jsonb_array_length(role.requirements->'languages') + jsonb_array_length(role.requirements->'accents') + item.ordinal,
      'skill',item.value,'requirements.skills['||(item.ordinal-1)::text||']'
      from jsonb_array_elements_text(role.requirements->'skills') with ordinality item(value,ordinal)
    union all select 4 + jsonb_array_length(role.requirements->'languages') + jsonb_array_length(role.requirements->'accents') + jsonb_array_length(role.requirements->'skills'),
      'classification',role.category,'category'
  ), distinct_values as (
    select distinct on(field,value) ordinal,field,value,source_field from values_to_suggest
      where value is not null and btrim(value,E' \t\r\n')<>'' order by field,value,ordinal
  )
  select coalesce(jsonb_agg(jsonb_build_object('field',field,'value',value,'source_field',source_field) order by ordinal),'[]'::jsonb)
    into filters from distinct_values;
  return jsonb_build_object('role_id',role.id,'include_unknown',true,'suggested_filters',filters,'explanations',jsonb_build_array(
    'Suggestions copy explicit current role requirements. Change or clear any filter before searching.',
    'Unknown supplied candidate values remain included and labelled; known contradictions do not match.',
    'These filters do not rank suitability or select a candidate.'));
end $$;
revoke all on function public.eps_suggest_candidate_filters(uuid) from public,anon,authenticated,service_role;
grant create on schema public to eps_specs_owner;
alter function public.eps_suggest_candidate_filters(uuid) owner to eps_specs_owner;
revoke create on schema public from eps_specs_owner;
grant execute on function public.eps_suggest_candidate_filters(uuid) to authenticated;


-- Exact reviewed fragment: development/m03/remaining-frames.sql
-- M03 frame extraction: development fragment composed after reviewed17 and
-- support/filter fragments. Disabled until separately reviewed activation.
set local search_path='';
set local lock_timeout='3s';
set local statement_timeout='30s';

alter table eps.jobs drop constraint jobs_kind_check;
alter table eps.jobs add constraint jobs_kind_check check(kind in('specs_extract','candidate_scan','frame_extract'));
alter table eps.jobs drop constraint jobs_stage_check;
alter table eps.jobs add constraint jobs_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate','extract_frames','apply_frames'));
alter table eps.jobs drop constraint jobs_kind_stage_check;
alter table eps.jobs add constraint jobs_kind_stage_check check((kind='specs_extract' and stage in('prepare_document','extract_specs','apply_specs')) or (kind='candidate_scan' and stage in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate')) or (kind='frame_extract' and stage in('extract_frames','apply_frames')));
alter table eps.jobs drop constraint jobs_input_hash_version_check;
alter table eps.jobs add constraint jobs_input_hash_version_check check(input_hash_version in('eps.specs-input.pg-jsonb.v1','eps.candidate-input.pg-jsonb.v1','eps.frame-input.pg-jsonb.v1'));
alter table eps.job_events drop constraint job_events_stage_check;
alter table eps.job_events add constraint job_events_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate','extract_frames','apply_frames'));
alter table eps.outbox_events drop constraint outbox_events_stage_check;
alter table eps.outbox_events add constraint outbox_events_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate','extract_frames','apply_frames'));
alter table eps.candidate_stage_payloads drop constraint candidate_stage_payloads_stage_check;
alter table eps.candidate_stage_payloads add constraint candidate_stage_payloads_stage_check check(stage in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate','extract_frames','apply_frames'));

create table eps.frame_extraction_config (
 id boolean primary key default true check(id),enabled boolean not null default false,
 native_image_id text check(native_image_id~'^sha256:[a-f0-9]{64}$'),
 implementation_version text not null default 'frame-extraction.v1' check(implementation_version='frame-extraction.v1'),
 check(not enabled or native_image_id is not null)
);
insert into eps.frame_extraction_config(id) values(true);
create table eps.frame_extraction_requests (
 job_id uuid primary key references eps.jobs(id) on delete restrict,
 candidate_media_id uuid not null references eps.candidate_media(id) on delete restrict,
 candidate_id uuid not null references eps.candidates(id) on delete restrict,
 source_asset_id uuid not null references eps.media_assets(id) on delete restrict,
 media_row_version bigint not null check(media_row_version between 1 and 9007199254740991),
 frozen_input jsonb not null check(jsonb_typeof(frozen_input)='object' and octet_length(frozen_input::text)<=16384),
 created_at timestamptz not null default clock_timestamp()
);
create index frame_requests_media_idx on eps.frame_extraction_requests(candidate_media_id);
create index frame_requests_source_idx on eps.frame_extraction_requests(source_asset_id);
create index frame_requests_candidate_idx on eps.frame_extraction_requests(candidate_id);
alter table eps.frame_extraction_config enable row level security;alter table eps.frame_extraction_config force row level security;
alter table eps.frame_extraction_requests enable row level security;alter table eps.frame_extraction_requests force row level security;
revoke all on eps.frame_extraction_config,eps.frame_extraction_requests from public,anon,authenticated,service_role,eps_api_owner;
grant select on eps.frame_extraction_config to eps_candidate_stage_owner,eps_candidate_assets_owner,eps_cast_owner;
grant select on eps.frame_extraction_requests to eps_candidate_stage_owner,eps_candidate_assets_owner;
grant select,insert on eps.frame_extraction_requests to eps_cast_owner;
create policy frame_config_internal_read on eps.frame_extraction_config for select to eps_candidate_stage_owner,eps_candidate_assets_owner,eps_cast_owner using(true);
create policy frame_requests_service_read on eps.frame_extraction_requests for select to eps_candidate_stage_owner,eps_candidate_assets_owner using(true);
create policy frame_requests_user_read on eps.frame_extraction_requests for select to eps_cast_owner using(eps.has_capability('cast.read') and exists(select 1 from eps.jobs j where j.id=job_id and j.requested_by=auth.uid() and j.kind='frame_extract'));
create policy frame_requests_user_insert on eps.frame_extraction_requests for insert to eps_cast_owner with check(eps.has_capability('cast.upload') and eps.has_capability('cast.read') and exists(select 1 from eps.jobs j where j.id=job_id and j.requested_by=auth.uid() and j.kind='frame_extract' and j.resource_id=candidate_media_id and j.input_asset_id=source_asset_id and j.input=frozen_input));
grant select,insert on eps.jobs to eps_cast_owner;grant insert on eps.outbox_events to eps_cast_owner;
grant execute on function eps.specs_stage_assert(boolean,text),eps.specs_stage_shape(jsonb,text[],text[]),eps.specs_stage_integer(jsonb,bigint,bigint) to eps_cast_owner;
create policy frame_enqueue_job_read on eps.jobs for select to eps_cast_owner using(kind='frame_extract' and requested_by=auth.uid() and eps.has_capability('cast.read'));
create policy frame_enqueue_job_insert on eps.jobs for insert to eps_cast_owner with check(kind='frame_extract' and requested_by=auth.uid() and eps.has_capability('cast.read') and eps.has_capability('cast.upload')
 and stage='extract_frames' and status='queued' and attempt=0 and current_attempt_id is null and lease_token_digest is null and dispatch_generation=1
 and exists(select 1 from eps.candidate_media m join eps.media_assets a on a.id=m.source_asset_id where m.id=resource_id and a.id=input_asset_id and a.origin_workspace_id=jobs.workspace_id and a.status='ready' and a.purpose='candidate_video'));
create policy frame_enqueue_dispatch on eps.outbox_events for insert to eps_cast_owner with check(exists(select 1 from eps.jobs j where j.id=job_id and j.kind='frame_extract' and j.requested_by=auth.uid() and stage='extract_frames' and dispatch_generation=1));
create policy frame_enqueue_idempotency on eps.idempotency_records for all to eps_cast_owner using(principal_id=auth.uid() and operation='cast.extract_candidate_frames') with check(principal_id=auth.uid() and operation='cast.extract_candidate_frames');
create policy frame_enqueue_audit on eps.audit_events for insert to eps_cast_owner with check(principal_id=auth.uid() and action='cast.extract_candidate_frames');
create policy frame_stage_jobs_read on eps.jobs for select to eps_candidate_stage_owner using(kind='frame_extract');
create policy frame_stage_jobs_update on eps.jobs for update to eps_candidate_stage_owner using(kind='frame_extract') with check(kind='frame_extract');
create policy frame_asset_jobs_read on eps.jobs for select to eps_candidate_assets_owner using(kind='frame_extract');
grant select on eps.candidates,eps.candidate_media,eps.candidate_media_frames to eps_candidate_stage_owner;
grant update(id) on eps.candidates to eps_candidate_stage_owner;
grant update(row_version) on eps.candidate_media to eps_candidate_stage_owner;
grant insert on eps.candidate_media_frames to eps_candidate_stage_owner;
grant insert(principal_id,action,resource_id,request_id,client_type) on eps.audit_events to eps_candidate_stage_owner;
create policy frame_stage_candidate_read on eps.candidates for select to eps_candidate_stage_owner using(true);
create policy frame_stage_candidate_lock on eps.candidates for update to eps_candidate_stage_owner using(true) with check(false);
create policy frame_stage_media_read on eps.candidate_media for select to eps_candidate_stage_owner using(true);
create policy frame_stage_media_update on eps.candidate_media for update to eps_candidate_stage_owner using(true) with check(exists(select 1 from eps.jobs j where j.id::text=current_setting('eps.frame_apply.job_id',true) and j.kind='frame_extract' and j.stage='apply_frames' and j.resource_id=candidate_media.id and j.status='running'));
create policy frame_stage_frames_read on eps.candidate_media_frames for select to eps_candidate_stage_owner using(true);
create policy frame_stage_frames_insert on eps.candidate_media_frames for insert to eps_candidate_stage_owner with check(exists(select 1 from eps.jobs j where j.id::text=current_setting('eps.frame_apply.job_id',true) and j.kind='frame_extract' and j.stage='apply_frames' and j.resource_id=candidate_media_id and j.status='running'));
create policy frame_stage_payload_insert on eps.candidate_stage_payloads for insert to eps_candidate_stage_owner with check(stage in('extract_frames','apply_frames') and exists(select 1 from eps.jobs j where j.id=job_id and j.kind='frame_extract' and j.workspace_id=candidate_stage_payloads.workspace_id and j.current_attempt_id=attempt_id and j.input_hash=candidate_stage_payloads.input_hash));
create policy frame_apply_audit on eps.audit_events for insert to eps_candidate_stage_owner with check(action='candidate.frames_extracted' and client_type='api' and exists(select 1 from eps.jobs j where j.id::text=current_setting('eps.frame_apply.job_id',true) and j.kind='frame_extract' and j.requested_by=audit_events.principal_id));

create function eps.frame_job_hash(p_input jsonb) returns text language sql immutable security invoker set search_path='' as $$
 select encode(sha256(convert_to('eps.frame-input.pg-jsonb.v1:'||p_input::text,'UTF8')),'hex')
$$;
create function eps.frame_stage_can_execute(p_principal uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select eps.job_requester_active(p_principal) and not exists(select 1 from unnest(array['cast.read','cast.upload']) required where not exists(select 1 from public.app_capability_grants g where g.principal_id=p_principal and g.capability=required and g.active))
$$;
create function eps.frame_is_job(p_job uuid) returns boolean language sql volatile security definer set search_path='' as $$ select exists(select 1 from eps.jobs where id=p_job and kind='frame_extract') $$;
create function eps.frame_capture_input(p_media uuid,p_actor uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare m eps.candidate_media;c eps.candidates;a eps.media_assets;begin
 perform eps.specs_stage_assert(eps.frame_stage_can_execute(p_actor),'CAPABILITY_REQUIRED');
 select * into m from eps.candidate_media where id=p_media;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Introduction not found.',404);end if;
 select * into c from eps.candidates where id=m.candidate_id for update;
 perform eps.specs_stage_assert(found and c.archived_at is null and c.merged_into_candidate_id is null,'RESOURCE_NOT_FOUND');
 select * into m from eps.candidate_media where id=p_media and candidate_id=c.id for update;
 select * into a from eps.media_assets where id=m.source_asset_id and purpose='candidate_video' and status='ready';
 perform eps.specs_stage_assert(found and a.sha256~'^[a-f0-9]{64}$' and a.duration_ms between 1 and 1800000 and a.origin_workspace_id is not null,'MEDIA_REFERENCE_INVALID');
 return jsonb_build_object('schema_version','1.0','candidate_media_id',m.id,'candidate_id',c.id,'media_row_version',m.row_version,'workspace_id',a.origin_workspace_id,
  'source_asset_id',a.id,'source_sha256',a.sha256,'source_size_bytes',a.size_bytes,'source_mime_type',a.mime_type,'source_duration_ms',a.duration_ms);
end $$;
create function eps.frame_source_identity_matches(p_job eps.jobs) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from eps.frame_extraction_requests r join eps.candidate_media m on m.id=r.candidate_media_id join eps.candidates c on c.id=m.candidate_id join eps.media_assets a on a.id=m.source_asset_id
  where r.job_id=p_job.id and p_job.kind='frame_extract' and r.frozen_input=p_job.input and r.candidate_media_id=p_job.resource_id and r.candidate_id=c.id
   and r.source_asset_id=p_job.input_asset_id and r.source_asset_id=a.id and c.archived_at is null and c.merged_into_candidate_id is null
   and a.status='ready' and a.purpose='candidate_video' and a.origin_workspace_id=p_job.workspace_id and p_job.input->>'source_sha256'=a.sha256
   and p_job.input->>'source_size_bytes'=a.size_bytes::text and p_job.input->>'source_mime_type'=a.mime_type and p_job.input->>'source_duration_ms'=a.duration_ms::text
   and p_job.input->>'candidate_media_id'=m.id::text and p_job.input->>'candidate_id'=c.id::text and p_job.input->>'media_row_version'=r.media_row_version::text
   and p_job.input_hash_version='eps.frame-input.pg-jsonb.v1' and p_job.input_hash=eps.frame_job_hash(p_job.input))
$$;
create function eps.frame_source_matches(p_job eps.jobs) returns boolean language sql volatile security definer set search_path='' as $$
 select eps.frame_source_identity_matches(p_job) and exists(select 1 from eps.frame_extraction_requests r join eps.candidate_media m on m.id=r.candidate_media_id where r.job_id=p_job.id and m.row_version=r.media_row_version)
$$;
create function eps.frame_stage_lock(p_job uuid,p_require_access boolean default true) returns eps.jobs language plpgsql volatile security definer set search_path='' as $$
declare r eps.frame_extraction_requests;job eps.jobs;locked uuid;begin
 select * into r from eps.frame_extraction_requests where job_id=p_job;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Frame extraction job not found.',404);end if;
 select id into locked from eps.candidates where id=r.candidate_id for update;
 select id into locked from eps.candidate_media where id=r.candidate_media_id for update;
 select * into job from eps.jobs where id=p_job and kind='frame_extract' and resource_id=r.candidate_media_id and input_asset_id=r.source_asset_id for update;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');if p_require_access then perform eps.specs_stage_assert(eps.frame_stage_can_execute(job.requested_by),'CAPABILITY_REQUIRED');end if;return job;
end $$;
create function eps.frame_stage_current(p_job uuid,p_attempt uuid,p_lease text) returns eps.jobs language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;begin
 job:=eps.frame_stage_lock(p_job);perform eps.specs_stage_assert(job.status='running' and job.current_attempt_id=p_attempt and job.cancel_requested_at is null and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(p_lease~'^[a-f0-9]{64}$' and job.lease_token_digest=encode(sha256(convert_to(p_lease,'UTF8')),'hex'),'LEASE_INVALID');
 perform eps.specs_stage_assert(eps.frame_source_matches(job),'INPUT_CHANGED');return job;
end $$;
create function eps.frame_stage_live(p_job uuid,p_attempt uuid,p_input_hash text) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from eps.jobs j where j.id=p_job and j.kind='frame_extract' and j.current_attempt_id=p_attempt and j.status='running' and j.input_hash=p_input_hash and j.cancel_requested_at is null and j.lease_expires_at>clock_timestamp() and eps.frame_stage_can_execute(j.requested_by) and eps.frame_source_matches(j))
$$;
create function public.eps_extract_candidate_frames(p_candidate_media_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare captured jsonb;input_value jsonb;payload jsonb;response jsonb;config eps.frame_extraction_config;job eps.jobs;fingerprint text;timestamps jsonb;count_frames integer;begin
 perform eps.require_capability('cast.read');perform eps.require_capability('cast.upload');
 perform eps.specs_stage_assert(p_idempotency_key is not null and length(p_idempotency_key) between 16 and 200 and p_idempotency_key!~'[[:cntrl:]]');
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['source_asset_id','timestamps_ms']) and octet_length(p_input::text)<=4096 and jsonb_typeof(p_input->'source_asset_id')='string' and jsonb_typeof(p_input->'timestamps_ms')='array' and jsonb_array_length(p_input->'timestamps_ms') between 1 and 10);
 captured:=eps.frame_capture_input(p_candidate_media_id,auth.uid());
 perform eps.specs_stage_assert(p_input->>'source_asset_id'=captured->>'source_asset_id','MEDIA_REFERENCE_INVALID');
 perform eps.specs_stage_assert(not exists(select 1 from jsonb_array_elements(p_input->'timestamps_ms') t where not eps.specs_stage_integer(t,0,(captured->>'source_duration_ms')::bigint-1))
  and (select count(*)=count(distinct value) from jsonb_array_elements(p_input->'timestamps_ms')));
 select jsonb_agg(value order by value::bigint) into timestamps from jsonb_array_elements(p_input->'timestamps_ms');
 payload:=jsonb_build_object('candidate_media_id',p_candidate_media_id,'input',jsonb_build_object('source_asset_id',p_input->>'source_asset_id','timestamps_ms',timestamps));
 response:=eps.idempotency_begin('cast.extract_candidate_frames',p_idempotency_key,payload);
 captured:=eps.frame_capture_input(p_candidate_media_id,auth.uid());if response is not null then return response;end if;
 select count(*) into count_frames from eps.candidate_media_frames where candidate_media_id=p_candidate_media_id;
 perform eps.specs_stage_assert(count_frames+jsonb_array_length(timestamps)<=100,'MEDIA_REFERENCE_INVALID');
 select * into config from eps.frame_extraction_config where id and enabled;if not found then perform eps.fail('DEPENDENCY_UNAVAILABLE','Chosen-frame extraction is not configured.',503);end if;
 input_value:=captured||jsonb_build_object('timestamps_ms',timestamps,'configuration',jsonb_build_object('implementation_version',config.implementation_version,'native_image_id',config.native_image_id));
 fingerprint:=eps.frame_job_hash(input_value);
 select * into job from eps.jobs where kind='frame_extract' and dedupe_key=encode(sha256(convert_to('frame_extract:'||auth.uid()::text||':'||fingerprint,'UTF8')),'hex');
 if not found then
  insert into eps.jobs(workspace_id,requested_by,kind,resource_id,input_asset_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id)
  values((captured->>'workspace_id')::uuid,auth.uid(),'frame_extract',p_candidate_media_id,(captured->>'source_asset_id')::uuid,input_value,fingerprint,'eps.frame-input.pg-jsonb.v1',encode(sha256(convert_to('frame_extract:'||auth.uid()::text||':'||fingerprint,'UTF8')),'hex'),'extract_frames','frames:'||gen_random_uuid()::text) returning * into job;
  insert into eps.frame_extraction_requests(job_id,candidate_media_id,candidate_id,source_asset_id,media_row_version,frozen_input) values(job.id,p_candidate_media_id,(captured->>'candidate_id')::uuid,job.input_asset_id,(captured->>'media_row_version')::bigint,input_value);
  insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key) values(job.id,job.stage,job.input_hash,1,job.id::text||':1');
 end if;
 return eps.finish_mutation('cast.extract_candidate_frames',p_idempotency_key,payload,jsonb_build_object('job_id',job.id,'resource_id',p_candidate_media_id,'poll_url','/api/v1/jobs/'||job.id::text,'status',job.status),p_candidate_media_id);
end $$;

create function eps.get_frame_stage_input(p_job uuid,p_attempt uuid,p_lease text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;a eps.media_assets;begin
 job:=eps.frame_stage_current(p_job,p_attempt,p_lease);select * into strict a from eps.media_assets where id=job.input_asset_id;
 return jsonb_build_object('job_id',job.id,'attempt_id',job.current_attempt_id,'stage',job.stage,'input_hash',job.input_hash,'configuration',job.input->'configuration',
  'candidate_media_id',job.resource_id,'timestamps_ms',job.input->'timestamps_ms','source_duration_ms',a.duration_ms,
  'source',jsonb_build_object('asset_id',a.id,'sha256',a.sha256,'size_bytes',a.size_bytes,'mime_type',a.mime_type));
end $$;
create function eps.frame_validate_stage(p_job eps.jobs,p_schema text,p_payload jsonb) returns void language plpgsql volatile security definer set search_path='' as $$
declare item jsonb;frame jsonb;ordinal integer:=0;geometry jsonb;ratio jsonb;begin
 perform eps.specs_stage_assert(jsonb_typeof(p_payload)='object' and octet_length(p_payload::text)<=393216 and p_payload->>'source_asset_id'=p_job.input_asset_id::text,'RESULT_INVALID');
 if p_job.stage='apply_frames' then perform eps.specs_stage_assert(p_schema='frame-application.v1' and eps.specs_stage_shape(p_payload,array['source_asset_id']),'RESULT_INVALID');return;end if;
 perform eps.specs_stage_assert(p_job.stage='extract_frames' and p_schema='frame-extraction-stage.v1' and eps.specs_stage_shape(p_payload,array['source_asset_id','source_sha256','frames','requests','warnings','implementation_version','native_image_id','ffmpeg_version','display_geometry'])
  and p_payload->>'source_sha256'=p_job.input->>'source_sha256' and p_payload->>'implementation_version'='frame-extraction.v1' and p_payload->>'native_image_id'=p_job.input#>>'{configuration,native_image_id}'
  and jsonb_typeof(p_payload->'ffmpeg_version')='string' and length(p_payload->>'ffmpeg_version') between 1 and 500
  and jsonb_typeof(p_payload->'frames')='array' and jsonb_array_length(p_payload->'frames')<=10 and jsonb_typeof(p_payload->'requests')='array'
  and jsonb_array_length(p_payload->'requests')=jsonb_array_length(p_job.input->'timestamps_ms') and eps.specs_stage_strings(p_payload->'warnings') and jsonb_array_length(p_payload->'warnings')<=32,'RESULT_INVALID');
 geometry:=p_payload->'display_geometry';perform eps.specs_stage_assert(eps.specs_stage_shape(geometry,array['sample_aspect_ratio','display_aspect_ratio','width','height']) and eps.specs_stage_integer(geometry->'width',1,1280) and eps.specs_stage_integer(geometry->'height',1,1280),'RESULT_INVALID');
 foreach ratio in array array[geometry->'sample_aspect_ratio',geometry->'display_aspect_ratio'] loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(ratio,array['numerator','denominator']) and eps.specs_stage_integer(ratio->'numerator',1) and eps.specs_stage_integer(ratio->'denominator',1),'RESULT_INVALID');
 end loop;
 for frame in select value from jsonb_array_elements(p_payload->'frames') loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(frame,array['asset_id','sha256','size_bytes','mime_type','source_asset_id','timestamp_ms','width','height','quality_flags'])
   and frame->>'source_asset_id'=p_job.input_asset_id::text and frame->>'mime_type'='image/jpeg' and frame->'width'=geometry->'width' and frame->'height'=geometry->'height'
   and eps.specs_stage_integer(frame->'timestamp_ms',0,(p_job.input->>'source_duration_ms')::bigint-1) and eps.specs_stage_strings(frame->'quality_flags')
   and not exists(select 1 from jsonb_array_elements_text(frame->'quality_flags') flag where flag not in('EXPOSURE_LIMIT','LOW_DETAIL'))
   and exists(select 1 from eps.media_assets a where a.id::text=frame->>'asset_id' and a.origin_workspace_id=p_job.workspace_id and a.purpose='candidate_frame' and a.status='ready'
    and a.source_asset_id=p_job.input_asset_id and a.producing_job_id=p_job.id and a.producing_attempt_id=p_job.current_attempt_id and a.output_stage='extract_frames'
    and a.sha256=frame->>'sha256' and a.size_bytes::text=frame->>'size_bytes' and a.mime_type=frame->>'mime_type' and a.width::text=frame->>'width' and a.height::text=frame->>'height' and a.source_timestamp_ms::text=frame->>'timestamp_ms'),'RESULT_INVALID');
 end loop;
 perform eps.specs_stage_assert((select count(*)=count(distinct value->>'asset_id') from jsonb_array_elements(p_payload->'frames')),'RESULT_INVALID');
 for item in select value from jsonb_array_elements(p_payload->'requests') loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(item,array['requested_timestamp_ms','frame_asset_id','actual_timestamp_ms','unavailable_reason']) and item->'requested_timestamp_ms'=p_job.input->'timestamps_ms'->ordinal,'RESULT_INVALID');ordinal:=ordinal+1;
  if item->'frame_asset_id'='null' then perform eps.specs_stage_assert(item->'actual_timestamp_ms'='null' and item->>'unavailable_reason'='FRAME_TIMESTAMP_UNAVAILABLE','RESULT_INVALID');
  else perform eps.specs_stage_assert(item->'unavailable_reason'='null' and eps.specs_stage_integer(item->'actual_timestamp_ms',(item->>'requested_timestamp_ms')::bigint,(p_job.input->>'source_duration_ms')::bigint-1)
   and exists(select 1 from jsonb_array_elements(p_payload->'frames') f where f->>'asset_id'=item->>'frame_asset_id' and f->'timestamp_ms'=item->'actual_timestamp_ms'),'RESULT_INVALID');end if;
 end loop;
 perform eps.specs_stage_assert(not exists(select 1 from jsonb_array_elements(p_payload->'frames') f where not exists(select 1 from jsonb_array_elements(p_payload->'requests') r where r->>'frame_asset_id'=f->>'asset_id')),'RESULT_INVALID');
end $$;
create function eps.apply_frame_extraction(p_job_id uuid,p_attempt_id uuid,p_lease_token text,p_input_hash text,p_result jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;payload jsonb;frame jsonb;new_ids jsonb:='[]';unavailable integer;unavailable_times jsonb;public_warnings jsonb;begin
 job:=eps.frame_stage_current(p_job_id,p_attempt_id,p_lease_token);
 perform eps.specs_stage_assert(job.stage='apply_frames' and job.input_hash=p_input_hash and eps.specs_stage_shape(p_result,array['source_asset_id']) and p_result->>'source_asset_id'=job.input_asset_id::text,'RESULT_INVALID');
 select p.payload into payload from eps.candidate_stage_payloads p where p.job_id=job.id and p.input_hash=job.input_hash and p.stage='extract_frames'
  and exists(select 1 from jsonb_array_elements(job.completed_stages) s where s->>'stage'='extract_frames' and s#>>'{result,stage_output_id}'=p.id::text and s->>'attempt_id'=p.attempt_id::text);
 perform eps.specs_stage_assert(payload is not null and payload->>'source_sha256'=job.input->>'source_sha256','RESULT_INVALID');
 perform eps.specs_stage_assert((select count(*) from eps.candidate_media_frames where candidate_media_id=job.resource_id)+jsonb_array_length(payload->'frames')<=100,'INPUT_CHANGED');
 perform set_config('eps.frame_apply.job_id',job.id::text,true);
 for frame in select value from jsonb_array_elements(payload->'frames') loop
  perform eps.specs_stage_assert(not exists(select 1 from eps.candidate_media_frames where candidate_media_id=job.resource_id and asset_id=(frame->>'asset_id')::uuid),'RESULT_INVALID');
  insert into eps.candidate_media_frames(candidate_media_id,asset_id,quality_flags) values(job.resource_id,(frame->>'asset_id')::uuid,array(select jsonb_array_elements_text(frame->'quality_flags')));
  new_ids:=new_ids||jsonb_build_array(frame->>'asset_id');
 end loop;
 if jsonb_array_length(new_ids)>0 then update eps.candidate_media set row_version=row_version+1 where id=job.resource_id and row_version=(job.input->>'media_row_version')::bigint;perform eps.specs_stage_assert(found,'INPUT_CHANGED');end if;
 select count(*),coalesce(jsonb_agg(r->'requested_timestamp_ms' order by ordinal),'[]'::jsonb) into unavailable,unavailable_times from jsonb_array_elements(payload->'requests') with ordinality list(r,ordinal) where r->'frame_asset_id'='null';
 select coalesce(jsonb_agg(flag order by flag),'[]'::jsonb) into public_warnings from (select distinct flag from jsonb_array_elements_text(payload->'warnings') flag where flag in('FRAME_TIMESTAMP_SHARED','FRAME_TIMESTAMP_UNAVAILABLE')) safe;
 insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type) values(job.requested_by,'candidate.frames_extracted',job.resource_id,job.correlation_id,'api');
 return jsonb_build_object('candidate_media_id',job.resource_id,'source_asset_id',job.input_asset_id,'frame_asset_ids',new_ids,'requested_count',jsonb_array_length(payload->'requests'),'frame_count',jsonb_array_length(new_ids),'unavailable_count',unavailable,'unavailable_timestamps_ms',unavailable_times,'warnings',public_warnings);
end $$;
create function eps.recover_frame_job_stages(p_limit integer) returns integer language plpgsql volatile security definer set search_path='' as $$
declare candidate record;job eps.jobs;recovered integer:=0;at_value timestamptz;obsolete boolean;attempts integer;begin
 perform eps.specs_stage_assert(p_limit between 0 and 100);if p_limit=0 then return 0;end if;
 for candidate in select j.id from eps.jobs j where j.kind='frame_extract' and j.status in('queued','running') and (j.status='running' and j.lease_expires_at<=clock_timestamp() or not eps.frame_stage_can_execute(j.requested_by) or not eps.frame_source_matches(j)) order by j.lease_expires_at nulls last,j.id limit 100 loop
  exit when recovered>=p_limit;job:=eps.frame_stage_lock(candidate.id,false);at_value:=clock_timestamp();if job.status not in('queued','running') then continue;end if;
  obsolete:=not eps.frame_stage_can_execute(job.requested_by) or not eps.frame_source_matches(job);if not obsolete and (job.status='queued' or job.lease_expires_at>at_value) then continue;end if;
  attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);
  if obsolete then job.status:='waiting_for_input';job.error:=eps.specs_stage_error('INPUT_CHANGED');
  elsif attempts>=3 then job.status:='failed';job.error:=jsonb_build_object('code','RETRY_EXHAUSTED','message','Frame extraction retry budget exhausted. Existing material was preserved.','details','{}'::jsonb,'retryable',false);
  else job.status:='queued';job.error:=eps.specs_stage_error('LEASE_EXPIRED');job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval '2 seconds';end if;
  update eps.jobs set status=job.status,error=job.error,lease_token_digest=null,lease_expires_at=null,available_at=job.available_at,dispatch_generation=job.dispatch_generation,row_version=row_version+1,updated_at=at_value where id=job.id;
  if job.status='queued' then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at) values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;recovered:=recovered+1;
 end loop;return recovered;
end $$;

-- Exact-source cloning retains the proven lease/event/asset machinery. Only the
-- named closed kind/stage/validator/apply dispatch changes; no generic SQL port.
do $frame_clones$
declare item record;source text;definition text;replacement text;old_next text;begin
 for item in select * from (values
  ('eps.claim_candidate_job_stage(jsonb)','claim_candidate_job_stage','claim_frame_job_stage','e5ac1c5fe0a22f45163f61c9cb51cf90ccf8d351bb38005070d27bcf643140f4'),
  ('eps.record_candidate_job_event(jsonb)','record_candidate_job_event','record_frame_job_event','2c7cacbd9329955fac77f8cea9dc4a0d5aef1bd23dca318ee6ad767cfefe433d'),
  ('eps.get_candidate_asset_access(jsonb)','get_candidate_asset_access','get_frame_asset_access','41e83770011836dcef48ccda3741c95b638185d93138a09b420d06569701d6af'),
  ('eps.reserve_candidate_job_output(jsonb)','reserve_candidate_job_output','reserve_frame_job_output','fe1e39058b643592ccea14b9840a32f13934e0333301f860aefe419d03bd8b73'),
  ('eps.complete_candidate_job_output(jsonb)','complete_candidate_job_output','complete_frame_job_output','a9d129a5ba2f4b012ff54a7d1e81b1dcc0dde74825bd0005c3cd6c2a1469f221'),
  ('eps.candidate_capability_allowed(text,text,text)','candidate_capability_allowed','frame_capability_allowed','fbe7f0270534a1f65554c095aca6e1cbf5862624e59d450c06c73374618ffd07')
 ) as clones(signature,old_name,new_name,old_hash) loop
  select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>item.old_hash then raise exception 'REVIEWED_FRAME_LEAF_SOURCE_REQUIRED: %',item.signature;end if;
  replacement:=replace(replace(replace(replace(source,'eps.candidate_stage_current','eps.frame_stage_current'),'eps.candidate_stage_lock','eps.frame_stage_lock'),'eps.candidate_stage_source_matches','eps.frame_source_matches'),'eps.candidate_stage_live','eps.frame_stage_live');
  if item.old_name='claim_candidate_job_stage' then
   replacement:=replace(replacement,'''prepare_candidate'',''transcribe_candidate'',''extract_candidate'',''select_frames'',''apply_candidate''','''extract_frames'',''apply_frames''');
   replacement:=replace(replacement,'eps.candidate_asset_config where id and enabled','eps.frame_extraction_config where id and enabled and native_image_id=job.input#>>''{configuration,native_image_id}''');
   replacement:=replace(replacement,'eps.frame_source_matches(job)','(eps.frame_source_matches(job) or eps.frame_source_identity_matches(job) and exists(select 1 from jsonb_array_elements(job.completed_stages) s where s->>''stage''=p_input->>''stage'' and s->>''input_hash''=job.input_hash))');
  elsif item.old_name='record_candidate_job_event' then
   replacement:=replace(replacement,'''prepare_candidate'',''transcribe_candidate'',''extract_candidate'',''select_frames'',''apply_candidate''','''extract_frames'',''apply_frames''');
   replacement:=replace(replace(replacement,'eps.candidate_validate_stage','eps.frame_validate_stage'),'eps.apply_candidate_scan','eps.apply_frame_extraction');
   replacement:=replace(replacement,'job.stage=''apply_candidate''','job.stage=''apply_frames''');
   old_next:='case job.stage when ''prepare_candidate'' then ''transcribe_candidate'' when ''transcribe_candidate'' then ''extract_candidate'' when ''extract_candidate'' then ''select_frames'' when ''select_frames'' then ''apply_candidate'' else null end';
   if position(old_next in replacement)=0 then raise exception 'REVIEWED_FRAME_STAGE_CHAIN_REQUIRED';end if;
   replacement:=replace(replacement,old_next,'case job.stage when ''extract_frames'' then ''apply_frames'' else null end');
  elsif item.old_name='reserve_candidate_job_output' then
   replacement:=replace(replacement,'kind:=p_input->>''asset_kind'';','kind:=p_input->>''asset_kind'';perform eps.specs_stage_assert(kind=''candidate_frame'');');
   replacement:=replace(replacement,'job.stage=''prepare_candidate''','job.stage=''extract_frames''');
   replacement:=replace(replacement,'^frame_([0-9]|1[01])$','^frame_[0-9]$');
  elsif item.old_name='complete_candidate_job_output' then replacement:=replace(replacement,'asset.purpose not in(''audio'',''transcript'',''candidate_frame'')','asset.purpose<>''candidate_frame''');
  end if;
  if replacement=source then raise exception 'REVIEWED_FRAME_CLONE_TRANSFORM_REQUIRED';end if;
  definition:=replace(replace(definition,source,replacement),'FUNCTION eps.'||item.old_name||'(','FUNCTION eps.'||item.new_name||'(');execute definition;
 end loop;
end $frame_clones$;

create policy frame_asset_service_insert on eps.media_assets for insert to eps_candidate_assets_owner with check(purpose='candidate_frame' and status='uploading' and bucket='eps-candidate-outputs' and sha256 is null and output_stage='extract_frames' and eps.frame_stage_live(producing_job_id,producing_attempt_id,(select j.input_hash from eps.jobs j where j.id=producing_job_id)));
create policy frame_asset_service_complete on eps.media_assets for update to eps_candidate_assets_owner using(purpose='candidate_frame' and status='uploading' and output_stage='extract_frames' and eps.frame_stage_live(producing_job_id,producing_attempt_id,(select j.input_hash from eps.jobs j where j.id=producing_job_id))) with check(status='ready' and sha256 is not null);

grant create on schema eps to eps_candidate_stage_owner,eps_candidate_assets_owner;
do $$declare routine regprocedure;begin
 foreach routine in array array[
  'eps.frame_job_hash(jsonb)'::regprocedure,'eps.frame_stage_can_execute(uuid)'::regprocedure,'eps.frame_is_job(uuid)'::regprocedure,
  'eps.frame_capture_input(uuid,uuid)'::regprocedure,'eps.frame_source_identity_matches(eps.jobs)'::regprocedure,'eps.frame_source_matches(eps.jobs)'::regprocedure,'eps.frame_stage_lock(uuid,boolean)'::regprocedure,
  'eps.frame_stage_current(uuid,uuid,text)'::regprocedure,'eps.frame_stage_live(uuid,uuid,text)'::regprocedure,
  'eps.claim_frame_job_stage(jsonb)'::regprocedure,'eps.get_frame_stage_input(uuid,uuid,text)'::regprocedure,'eps.frame_validate_stage(eps.jobs,text,jsonb)'::regprocedure,
  'eps.apply_frame_extraction(uuid,uuid,text,text,jsonb)'::regprocedure,'eps.record_frame_job_event(jsonb)'::regprocedure,'eps.recover_frame_job_stages(integer)'::regprocedure
 ] loop execute format('alter function %s owner to eps_candidate_stage_owner',routine);execute format('revoke all on function %s from public,anon,authenticated,service_role,eps_api_owner,eps_cast_owner',routine);end loop;
 foreach routine in array array['eps.get_frame_asset_access(jsonb)'::regprocedure,'eps.reserve_frame_job_output(jsonb)'::regprocedure,'eps.complete_frame_job_output(jsonb)'::regprocedure,'eps.frame_capability_allowed(text,text,text)'::regprocedure]
 loop execute format('alter function %s owner to eps_candidate_assets_owner',routine);execute format('revoke all on function %s from public,anon,authenticated,service_role,eps_api_owner,eps_cast_owner',routine);end loop;
end $$;
revoke create on schema eps from eps_candidate_stage_owner,eps_candidate_assets_owner;
grant execute on function eps.frame_capture_input(uuid,uuid),eps.frame_job_hash(jsonb) to eps_cast_owner;
grant execute on function eps.frame_stage_current(uuid,uuid,text),eps.frame_stage_live(uuid,uuid,text) to eps_candidate_assets_owner;
grant execute on function eps.frame_is_job(uuid),eps.claim_frame_job_stage(jsonb),eps.get_frame_stage_input(uuid,uuid,text),eps.record_frame_job_event(jsonb),eps.recover_frame_job_stages(integer),eps.frame_stage_lock(uuid,boolean),eps.frame_source_matches(eps.jobs),eps.frame_source_identity_matches(eps.jobs) to eps_specs_stage_owner;
grant execute on function eps.frame_is_job(uuid),eps.get_frame_asset_access(jsonb),eps.reserve_frame_job_output(jsonb),eps.complete_frame_job_output(jsonb) to eps_specs_assets_owner;
grant execute on function eps.frame_is_job(uuid),eps.frame_source_matches(eps.jobs),eps.frame_stage_can_execute(uuid) to eps_jobs_owner;
grant create on schema public to eps_cast_owner;
alter function public.eps_extract_candidate_frames(uuid,jsonb,text) owner to eps_cast_owner;
revoke create on schema public from eps_cast_owner;
revoke all on function public.eps_extract_candidate_frames(uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.eps_extract_candidate_frames(uuid,jsonb,text) to authenticated;

-- Preserve17 implementations except closed frame dispatch. Login roles keep
-- exactly their existing11 entrypoints; none receives a new function grant.
do $frame_dispatch$
declare item record;source text;definition text;replacement text;anchor text;insertion text;begin
 for item in select * from (values
  ('eps.claim_job_stage(jsonb)','8fcace269d3eee540a48828674634f7fbd5497579ab68586bb6db7f3a7d507b3',E'begin\n',E'begin\n if p_input->>''stage'' in(''extract_frames'',''apply_frames'') then return eps.claim_frame_job_stage(p_input);end if;\n'),
  ('eps.record_job_event(jsonb)','a5f7bc003cddf5025ee3e5688ef9cece2a9d45529e9c38ed5516ad8283349b54',E'begin\n',E'begin\n if p_event->>''stage'' in(''extract_frames'',''apply_frames'') then return eps.record_frame_job_event(p_event);end if;\n'),
  ('eps.get_specs_stage_input(uuid,uuid,text)','19255d9da9f1338e4736a0c58aa9b95165d737cc95fcbfb892fa3ec6ba673cca',E'begin\n',E'begin\n if eps.frame_is_job(p_job_id) then return eps.get_frame_stage_input(p_job_id,p_attempt_id,p_lease_token);end if;\n'),
  ('eps.get_job_asset_access(jsonb)','cbeb99eeaeba5833541ccacacca40786e25405af5b108225688214d69d91f7e7',E'begin\n',E'begin\n if eps.frame_is_job(eps.input_uuid(p_input->>''job_id'')) then return eps.get_frame_asset_access(p_input);end if;\n'),
  ('eps.reserve_job_output(jsonb)','ccf48ffc8dcbe82696b7da9f835f0c38944887f0000294d0f0e742b3710a9b78',E'begin\n',E'begin\n if eps.frame_is_job(eps.input_uuid(p_input->>''job_id'')) then return eps.reserve_frame_job_output(p_input);end if;\n'),
  ('eps.complete_job_output(jsonb)','db6031c3c128b17245fd1d5e5e00ba0ef87c5f088920f0cc9d450eb1cc5db6c4',E'begin\n',E'begin\n if eps.frame_is_job(eps.input_uuid(p_input->>''job_id'')) then return eps.complete_frame_job_output(p_input);end if;\n'),
  ('eps.recover_job_stages(integer)','a793eba7674871d3fda3851864e94a894dbb5f08aab3fca7f24c718364c0c434','return jsonb_build_object(''recovered'',recovered+eps.recover_candidate_job_stages(p_limit-recovered));','recovered:=recovered+eps.recover_candidate_job_stages(p_limit-recovered);return jsonb_build_object(''recovered'',recovered+eps.recover_frame_job_stages(p_limit-recovered));'),
  ('eps.candidate_capability_allowed(text,text,text)','fbe7f0270534a1f65554c095aca6e1cbf5862624e59d450c06c73374618ffd07',E'begin\n',E'begin\n if eps.frame_capability_allowed(p_bucket,p_key,p_permission) then return true;end if;\n')
 ) as changes(signature,old_hash,old_anchor,new_value) loop
  select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>item.old_hash then raise exception 'REVIEWED_FRAME_DISPATCH_SOURCE_REQUIRED: %',item.signature;end if;
  anchor:=item.old_anchor;insertion:=item.new_value;if position(E'\r\n' in source)>0 then anchor:=replace(anchor,E'\n',E'\r\n');insertion:=replace(insertion,E'\n',E'\r\n');end if;
  if position(anchor in source)=0 then raise exception 'REVIEWED_FRAME_DISPATCH_ANCHOR_REQUIRED: %',item.signature;end if;
  if anchor in(E'begin\n',E'begin\r\n') then replacement:=overlay(source placing insertion from position(anchor in source) for length(anchor));else replacement:=replace(source,anchor,insertion);end if;
  execute replace(definition,source,replacement);
 end loop;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid='eps.claim_job_stage_replay(jsonb,text,text,text)'::regprocedure;
 if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>'83e2e0dd6c629ef23173a9b74eafa98b8ccdb9338060bfb55217108037f0531d' then raise exception 'REVIEWED_FRAME_REPLAY_SOURCE_REQUIRED';end if;
 anchor:='if eps.candidate_is_job(old.job_id) then job:=eps.candidate_stage_lock(old.job_id);else job:=eps.specs_stage_lock(old.job_id);end if;';
 if position(anchor in source)=0 then raise exception 'REVIEWED_FRAME_REPLAY_LOCK_REQUIRED';end if;
 replacement:=replace(source,anchor,'if eps.frame_is_job(old.job_id) then job:=eps.frame_stage_lock(old.job_id);elsif eps.candidate_is_job(old.job_id) then job:=eps.candidate_stage_lock(old.job_id);else job:=eps.specs_stage_lock(old.job_id);end if;');
 anchor:='case when job.kind=''candidate_scan'' then eps.candidate_stage_source_matches(job) else eps.specs_stage_source_matches(job) end';
 if position(anchor in replacement)=0 then raise exception 'REVIEWED_FRAME_REPLAY_SOURCE_ANCHOR_REQUIRED';end if;
 replacement:=replace(replacement,anchor,'case when job.kind=''frame_extract'' then (eps.frame_source_matches(job) or eps.frame_source_identity_matches(job) and exists(select 1 from jsonb_array_elements(job.completed_stages) s where s->>''stage''=p_input->>''stage'' and s->>''input_hash''=job.input_hash)) when job.kind=''candidate_scan'' then eps.candidate_stage_source_matches(job) else eps.specs_stage_source_matches(job) end');
 execute replace(definition,source,replacement);
end $frame_dispatch$;
notify pgrst,'reload schema';


-- Exact reviewed fragment: development/m03/remaining-frame-user-jobs.sql
-- Compose AFTER remaining-frames.sql. Frame jobs are requester-only global library work;
-- their origin workspace is lineage, not an extra project-membership requirement.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
do $baseline$
declare item record;actual text;begin
  for item in select * from (values
    ('public.eps_get_job(uuid)','12b0ca41408f90e234e572e141a1f4c29b5974f56901d47e24fb9b156b70a810'),
    ('public.eps_list_jobs(uuid,text,uuid,integer)','582adfd0958de33dc0d1eac0ffb55feb7be303bf7fd7f3a46d5850cfe530352d'),
    ('public.eps_retry_job(uuid,jsonb,text)','f5ef70c8cff5621f603712d6bebe5b50775a5669112d4921dc3183aa348db41a'),
    ('public.eps_cancel_job(uuid,jsonb,text)','601b0246f5ef907f9e02f5f39fc11c9b650cc42baa81bab31dbcb08d0faa2403')
  ) expected(signature,sha) loop
    select encode(sha256(convert_to(replace(proc.prosrc,E'\r\n',E'\n'),'UTF8')),'hex') into actual
      from pg_proc proc where proc.oid=to_regprocedure(item.signature) and proc.proowner='eps_jobs_owner'::regrole
      and proc.prosecdef and proc.proconfig=array['search_path=""'] and proc.provolatile='v' and proc.prokind='f'
      and not proc.proleakproof and proc.prorettype='jsonb'::regtype;
    if actual is distinct from item.sha then raise exception 'FRAME_USER_JOB_WRAPPER_BASELINE_CHANGED';end if;
  end loop;
  for item in select * from (values
    ('eps.jobs','jobs_read','r','0dba772a7e4cdea132233564c66d74c28d99fb4994c5fa02de7e0602cdb0e22e'),
    ('eps.jobs','jobs_update','w','3acaca0bc88fd65a9b9630de87f5c8775a4317aab6a273bf449e7919c781ee20'),
    ('eps.outbox_events','outbox_insert','a','7c72cba3563f1fda88acc24b44afc864d678b6140ead0358a84f5106e90a978b')
  ) expected(relation_name,policy_name,command,sha) loop
    select encode(sha256(convert_to(coalesce(pg_get_expr(policy.polqual,policy.polrelid),'')||E'\n'||coalesce(pg_get_expr(policy.polwithcheck,policy.polrelid),''),'UTF8')),'hex') into actual
      from pg_policy policy where policy.polrelid=to_regclass(item.relation_name) and policy.polname=item.policy_name
      and policy.polroles=array['eps_jobs_owner'::regrole::oid] and policy.polpermissive and policy.polcmd::text=item.command;
    if actual is distinct from item.sha then raise exception 'FRAME_USER_JOB_POLICY_BASELINE_CHANGED';end if;
  end loop;
  if not exists(select 1 from pg_proc proc where proc.oid='eps.jobs_dto(uuid)'::regprocedure
    and proc.proowner='eps_jobs_owner'::regrole and not proc.prosecdef and proc.provolatile='s'
    and proc.proconfig=array['search_path=""'] and proc.prorettype='jsonb'::regtype
    and encode(sha256(convert_to(replace(proc.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='f543148bb07b8f572bddad844555dca82bddf36af99fdae84dbb46517117590a')
  then raise exception 'FRAME_JOB_DTO_BASELINE_CHANGED';end if;
end $baseline$;

create function eps.frame_user_can_read(p_job eps.jobs) returns boolean language sql volatile security invoker set search_path='' as $$
  select (p_job).kind='frame_extract' and (p_job).requested_by=auth.uid() and eps.has_capability('cast.read')
    and eps.frame_is_job((p_job).id)
$$;
create function eps.frame_user_can_operate(p_job eps.jobs,p_retry boolean) returns boolean language sql volatile security invoker set search_path='' as $$
  select eps.frame_user_can_read(p_job) and eps.has_capability('operations.retry')
    and (not p_retry or eps.frame_stage_can_execute((p_job).requested_by) and eps.frame_source_matches(p_job))
$$;
-- Result-only safe projection: no private stage-table grants, raw warnings or source payloads.
create function eps.frame_user_outcome(p_job eps.jobs) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb:=p_job.result;requested integer;extracted integer;unavailable integer;duration integer;item jsonb;warning_values jsonb:='[]';begin
  if p_job.kind<>'frame_extract' or p_job.status<>'succeeded' then return null;end if;
  if jsonb_typeof(result) is distinct from 'object' or (select count(*) from jsonb_object_keys(result))<>8
    or result->>'candidate_media_id' is distinct from p_job.resource_id::text or result->>'source_asset_id' is distinct from p_job.input_asset_id::text
    or jsonb_typeof(result->'frame_asset_ids') is distinct from 'array' or jsonb_array_length(result->'frame_asset_ids')>10
    or jsonb_typeof(result->'unavailable_timestamps_ms') is distinct from 'array' or jsonb_array_length(result->'unavailable_timestamps_ms')>10
    or jsonb_typeof(result->'warnings') is distinct from 'array' or jsonb_array_length(result->'warnings')>2
    or jsonb_typeof(p_job.input->'timestamps_ms') is distinct from 'array' or jsonb_array_length(p_job.input->'timestamps_ms') not between 1 and 10
  then perform eps.fail('RESULT_INVALID','Frame extraction outcome is unavailable.',503);end if;
  foreach item in array array[result->'requested_count',result->'frame_count',result->'unavailable_count',p_job.input->'source_duration_ms'] loop
    if jsonb_typeof(item) is distinct from 'number' or item::text!~'^[0-9]{1,7}$' then perform eps.fail('RESULT_INVALID','Frame extraction outcome is unavailable.',503);end if;
  end loop;
  requested:=(result->>'requested_count')::integer;extracted:=(result->>'frame_count')::integer;unavailable:=(result->>'unavailable_count')::integer;duration:=(p_job.input->>'source_duration_ms')::integer;
  if requested not between 1 and 10 or extracted not between 0 and 10 or unavailable not between 0 and 10 or duration not between 1 and 1800000
    or requested<>jsonb_array_length(p_job.input->'timestamps_ms') or extracted<>jsonb_array_length(result->'frame_asset_ids')
    or unavailable<>jsonb_array_length(result->'unavailable_timestamps_ms') or extracted+unavailable>requested
    or exists(select 1 from jsonb_array_elements(result->'frame_asset_ids') value where jsonb_typeof(value)<>'string' or value#>>'{}'!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
    or (select count(*)<>count(distinct value) from jsonb_array_elements(result->'frame_asset_ids'))
    or exists(select 1 from jsonb_array_elements(result->'warnings') value where jsonb_typeof(value)<>'string' or value#>>'{}' not in('FRAME_TIMESTAMP_SHARED','FRAME_TIMESTAMP_UNAVAILABLE'))
    or (select count(*)<>count(distinct value) from jsonb_array_elements(result->'warnings'))
  then perform eps.fail('RESULT_INVALID','Frame extraction outcome is unavailable.',503);end if;
  for item in select value from jsonb_array_elements(result->'unavailable_timestamps_ms') loop
    if jsonb_typeof(item) is distinct from 'number' or item::text!~'^[0-9]{1,7}$' then perform eps.fail('RESULT_INVALID','Frame extraction outcome is unavailable.',503);end if;
    if item::text::integer>=duration or not(p_job.input->'timestamps_ms' @> jsonb_build_array(item)) then perform eps.fail('RESULT_INVALID','Frame extraction outcome is unavailable.',503);end if;
  end loop;
  if (select count(*)<>count(distinct value) from jsonb_array_elements(result->'unavailable_timestamps_ms')) then perform eps.fail('RESULT_INVALID','Frame extraction outcome is unavailable.',503);end if;
  if extracted<requested-unavailable then warning_values:=warning_values||'"FRAME_TIMESTAMP_SHARED"'::jsonb;end if;
  if unavailable>0 then warning_values:=warning_values||'"FRAME_TIMESTAMP_UNAVAILABLE"'::jsonb;end if;
  return jsonb_build_object('requested_count',requested,'extracted_count',extracted,'unavailable_timestamps_ms',result->'unavailable_timestamps_ms','warnings',warning_values);
end $$;
revoke all on function eps.frame_user_can_read(eps.jobs),eps.frame_user_can_operate(eps.jobs,boolean),eps.frame_user_outcome(eps.jobs) from public,anon,authenticated,service_role;
grant create on schema eps to eps_jobs_owner;
alter function eps.frame_user_can_read(eps.jobs) owner to eps_jobs_owner;
alter function eps.frame_user_can_operate(eps.jobs,boolean) owner to eps_jobs_owner;
alter function eps.frame_user_outcome(eps.jobs) owner to eps_jobs_owner;
revoke create on schema eps from eps_jobs_owner;
create or replace function eps.jobs_dto(p_job uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',id,'workspace_id',workspace_id,'kind',kind,'status',status,'stage',stage,'attempt',attempt,
    'progress_completed',progress_completed,'progress_total',progress_total,'batch_id',batch_id,'input_asset_id',input_asset_id,'resource_id',resource_id,
    'error',error,'created_at',created_at,'updated_at',updated_at,'row_version',row_version)
    ||case when kind='frame_extract' and status='succeeded' then jsonb_build_object('frame_extraction',eps.frame_user_outcome(jobs)) else '{}'::jsonb end
  from eps.jobs where id=p_job
$$;

-- Dispatcher paths retain their original authority. User paths cannot fall back to
-- origin-project access for frame jobs belonging to somebody else.
alter policy jobs_read on eps.jobs using(
  eps.jobs_dispatch_mode()
  or kind<>'frame_extract' and (eps.jobs_can_access(workspace_id,'read') or eps.jobs_can_access(workspace_id,'enqueue') or eps.jobs_can_access(workspace_id,'operate'))
  or kind='frame_extract' and requested_by=auth.uid() and eps.has_capability('cast.read'));
alter policy jobs_update on eps.jobs using(
  eps.jobs_dispatch_mode() or kind<>'frame_extract' and eps.jobs_can_access(workspace_id,'operate')
  or kind='frame_extract' and requested_by=auth.uid() and eps.has_capability('cast.read') and eps.has_capability('operations.retry'))
  with check(eps.jobs_dispatch_mode() or kind<>'frame_extract' and eps.jobs_can_access(workspace_id,'operate')
  or kind='frame_extract' and requested_by=auth.uid() and eps.has_capability('cast.read') and eps.has_capability('operations.retry'));
alter policy outbox_insert on eps.outbox_events with check(eps.jobs_dispatch_mode() or exists(
  select 1 from eps.jobs job where job.id=outbox_events.job_id and (
    job.kind<>'frame_extract' and (eps.jobs_can_access(job.workspace_id,'enqueue') or eps.jobs_can_access(job.workspace_id,'operate'))
    or job.kind='frame_extract' and eps.frame_user_can_operate(job,true))));

-- Exact source guards above and bounded single replacements preserve all original
-- ordinary-job validation, lifecycle, versioning, idempotency, audit and DTO logic.
do $wrappers$
declare signature text;definition text;old_text text;new_text text;operation text;retry boolean;begin
  foreach signature in array array['public.eps_get_job(uuid)','public.eps_list_jobs(uuid,text,uuid,integer)'] loop
    definition:=pg_get_functiondef(signature::regprocedure);
    old_text:='if not(eps.has_capability(''workspaces.read'') or eps.has_capability(''operations.read'')) then';
    new_text:='if not(eps.has_capability(''workspaces.read'') or eps.has_capability(''operations.read'') or eps.has_capability(''cast.read'')) then';
    if length(definition)-length(replace(definition,old_text,''))<>length(old_text) then raise exception 'FRAME_JOB_READ_CAPABILITY_SEAM_CHANGED';end if;
    definition:=replace(definition,old_text,new_text);
    old_text:='and eps.jobs_can_access(workspace_id,''read'')';
    new_text:='and (kind=''frame_extract'' and eps.frame_user_can_read(jobs) or kind<>''frame_extract'' and eps.jobs_can_access(workspace_id,''read''))';
    if length(definition)-length(replace(definition,old_text,''))<>length(old_text) then raise exception 'FRAME_JOB_READ_SCOPE_SEAM_CHANGED';end if;
    execute replace(definition,old_text,new_text);
  end loop;
  foreach operation in array array['retry','cancel'] loop
    retry:=operation='retry';signature:='public.eps_'||operation||'_job(uuid,jsonb,text)';definition:=pg_get_functiondef(signature::regprocedure);
    old_text:='select * into job from eps.jobs where id=p_job_id and eps.jobs_can_access(workspace_id,''operate'') for update;';
    new_text:='select * into job from eps.jobs where id=p_job_id and (case when kind=''frame_extract'' then eps.frame_user_can_operate(jobs,'||retry::text||') else eps.jobs_can_access(workspace_id,''operate'') end) for update;';
    if length(definition)-length(replace(definition,old_text,''))<>length(old_text) then raise exception 'FRAME_JOB_OPERATE_SCOPE_SEAM_CHANGED';end if;
    definition:=replace(definition,old_text,new_text);
    old_text:='if not eps.jobs_can_access(job.workspace_id,''operate'') then';
    new_text:='if not(case when job.kind=''frame_extract'' then eps.frame_user_can_operate(job,'||retry::text||') else eps.jobs_can_access(job.workspace_id,''operate'') end) then';
    if length(definition)-length(replace(definition,old_text,''))<>length(old_text) then raise exception 'FRAME_JOB_OPERATE_REPLAY_SEAM_CHANGED';end if;
    execute replace(definition,old_text,new_text);
  end loop;
end $wrappers$;
