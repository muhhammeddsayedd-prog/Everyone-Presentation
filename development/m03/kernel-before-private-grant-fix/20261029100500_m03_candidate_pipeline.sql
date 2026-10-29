-- M03 coordinated candidate pipeline17 after exact reviewed16.
-- Private native/provider stages, reusable facts/media and scoped uploads.
-- No source fixture, identity, provider credential or runtime enablement.
set local lock_timeout='5s';set local statement_timeout='30s';set local search_path='';
do $baseline$begin
 if current_user<>'postgres' or current_database()<>'postgres' or
 (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600']::text[]
 then raise exception 'CANDIDATE_PIPELINE_REVIEWED_SIXTEEN_REQUIRED';end if;
end $baseline$;

-- Exact reviewed fragment: development/m03/candidate-kernel-tables.sql
-- Candidate16 prelude, composed after reviewed candidate library15 and before
-- root-owned upload RPC/Storage policies. Root/harness owns the transaction.
set local lock_timeout='5s';set local statement_timeout='30s';set local search_path='';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres' or to_regclass('eps.candidates') is null
  or to_regclass('eps.candidate_uploads') is not null or to_regclass('eps.candidate_stage_payloads') is not null
  or exists(select 1 from pg_roles where rolname in('eps_candidate_stage_owner','eps_candidate_assets_owner','eps_candidate_upload_owner'))
 then raise exception 'CANDIDATE_KERNEL_LIBRARY_AND_NEW_BOUNDARY_REQUIRED';end if;
end $$;
create role eps_candidate_stage_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
create role eps_candidate_assets_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
create role eps_candidate_upload_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_candidate_stage_owner,eps_candidate_assets_owner,eps_candidate_upload_owner to postgres;
grant authenticated to eps_candidate_upload_owner with inherit true,set false,admin false;
grant usage on schema eps,public,extensions to eps_candidate_stage_owner,eps_candidate_assets_owner,eps_candidate_upload_owner;
create table eps.candidate_asset_config (
 id boolean primary key default true check(id),enabled boolean not null default false,
 transcription_model text,extraction_model text,prompt_version text not null default 'candidate-v1' check(prompt_version='candidate-v1'),
 schema_version text not null default '1.0' check(schema_version='1.0'),
 media_implementation_version text not null default 'video-preparation.v1' check(media_implementation_version='video-preparation.v1'),
 check(not enabled or transcription_model is not null and length(transcription_model) between 1 and 200 and extraction_model is not null and length(extraction_model) between 1 and 200)
);
insert into eps.candidate_asset_config(id) values(true);
create table eps.candidate_uploads (
 id uuid primary key default gen_random_uuid(),asset_id uuid not null unique references eps.media_assets(id) on delete restrict,
 principal_id uuid not null references auth.users(id) on delete restrict,workspace_id uuid not null references eps.workspaces(id) on delete restrict,
 reservation_revision bigint not null default 1 check(reservation_revision between 1 and 9007199254740991),
 bucket text not null check(bucket='eps-candidate-assets'),object_key text not null,
 expected_size_bytes bigint not null check(expected_size_bytes between 1 and 268435456),
 expected_mime_type text not null check(expected_mime_type in('video/mp4','video/quicktime','video/webm','video/x-matroska')),
 expected_sha256 text check(expected_sha256~'^[a-f0-9]{64}$'),
 status text not null default 'open' check(status in('open','completed','cancelled')),
 target_candidate_id uuid references eps.candidates(id) on delete restrict,target_candidate_row_version bigint check(target_candidate_row_version between 1 and 9007199254740991),
 job_id uuid unique references eps.jobs(id) on delete restrict,batch_id uuid,
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default clock_timestamp()+interval '24 hours',completed_at timestamptz,
 completed_input jsonb check(completed_input is null or jsonb_typeof(completed_input)='object'),
 check(expires_at>created_at),check((status='completed')=(completed_at is not null)),check((status='completed')=(completed_input is not null)),
 check((status='completed')=(job_id is not null)),check((target_candidate_id is null)=(target_candidate_row_version is null)),unique(bucket,object_key)
);
create index candidate_uploads_actor_workspace on eps.candidate_uploads(principal_id,workspace_id);
create index candidate_uploads_open_expiry on eps.candidate_uploads(expires_at) where status='open';
create table eps.candidate_stage_payloads (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references eps.workspaces(id) on delete restrict,
 job_id uuid not null references eps.jobs(id) on delete restrict,
 stage text not null check(stage in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate')),
 attempt_id uuid not null,input_hash text not null check(input_hash~'^[a-f0-9]{64}$'),
 result_schema text not null check(length(result_schema) between 1 and 100),payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=393216),
 created_at timestamptz not null default clock_timestamp(),unique(job_id,stage,input_hash)
);
create index candidate_stage_payloads_workspace_idx on eps.candidate_stage_payloads(workspace_id);
create table eps.candidate_asset_grants (
 id uuid primary key default gen_random_uuid(),token_digest text not null unique check(token_digest~'^[a-f0-9]{64}$'),
 job_id uuid not null references eps.jobs(id) on delete restrict,attempt_id uuid not null,input_hash text not null check(input_hash~'^[a-f0-9]{64}$'),
 asset_id uuid not null references eps.media_assets(id) on delete restrict,bucket text not null check(bucket in('eps-candidate-assets','eps-candidate-outputs')),
 object_key text not null,permission text not null check(permission in('read','write')),
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,revoked_at timestamptz,
 check(expires_at>created_at and expires_at<=created_at+interval '60 seconds')
);
create index candidate_asset_grants_job_idx on eps.candidate_asset_grants(job_id,attempt_id);
create index candidate_asset_grants_asset_idx on eps.candidate_asset_grants(asset_id);
alter table eps.candidate_asset_config enable row level security;alter table eps.candidate_asset_config force row level security;
alter table eps.candidate_uploads enable row level security;alter table eps.candidate_uploads force row level security;
alter table eps.candidate_stage_payloads enable row level security;alter table eps.candidate_stage_payloads force row level security;
alter table eps.candidate_asset_grants enable row level security;alter table eps.candidate_asset_grants force row level security;
revoke all on eps.candidate_asset_config,eps.candidate_uploads,eps.candidate_stage_payloads from public,anon,authenticated,service_role,eps_api_owner;
revoke all on eps.candidate_asset_grants from public,anon,authenticated,service_role,eps_api_owner;
grant select on eps.candidate_asset_config to eps_candidate_stage_owner,eps_candidate_assets_owner,eps_candidate_upload_owner;
create policy candidate_config_internal_read on eps.candidate_asset_config for select to eps_candidate_stage_owner,eps_candidate_assets_owner,eps_candidate_upload_owner using(true);
grant select on eps.candidate_uploads to eps_candidate_stage_owner,eps_candidate_assets_owner;
grant select,insert on eps.candidate_stage_payloads to eps_candidate_stage_owner;
grant select on eps.candidate_stage_payloads to eps_candidate_assets_owner;
grant select,insert on eps.candidate_asset_grants to eps_candidate_assets_owner;
create policy candidate_grant_service_read on eps.candidate_asset_grants for select to eps_candidate_assets_owner using(true);
create policy candidate_grant_service_insert on eps.candidate_asset_grants for insert to eps_candidate_assets_owner with check(true);
create policy candidate_upload_service_read on eps.candidate_uploads for select to eps_candidate_stage_owner,eps_candidate_assets_owner using(true);
create policy candidate_payload_service_read on eps.candidate_stage_payloads for select to eps_candidate_stage_owner,eps_candidate_assets_owner using(true);
create policy candidate_payload_stage_insert on eps.candidate_stage_payloads for insert to eps_candidate_stage_owner with check(exists(select 1 from eps.jobs j where j.id=job_id and j.kind='candidate_scan' and j.workspace_id=candidate_stage_payloads.workspace_id and j.current_attempt_id=attempt_id and j.input_hash=candidate_stage_payloads.input_hash));
-- New owners have no direct Storage or Auth access. Their fixed helpers return
-- only exact-object short-lived grants; originals/derivatives remain private.
create policy candidate_owners_no_objects on storage.objects as restrictive for all to eps_candidate_stage_owner,eps_candidate_assets_owner,eps_candidate_upload_owner using(false) with check(false);
create policy candidate_owners_no_buckets on storage.buckets as restrictive for all to eps_candidate_stage_owner,eps_candidate_assets_owner,eps_candidate_upload_owner using(false) with check(false);
comment on table eps.candidate_stage_payloads is 'Private typed candidate stage outputs; original transcript and source-grounded facts never enter public jobs/completed_stages/outbox.';


-- Exact reviewed fragment: development/m03/candidate-user-assets.sql
-- Candidate16 composed user/storage boundary. After kernel tables; before or
-- after service helpers (PLpgSQL enqueue lookup occurs at invocation). No enable.
set local lock_timeout='5s'; set local statement_timeout='30s'; set local search_path='';
alter table eps.media_assets drop constraint media_assets_typed_purpose_check;
alter table eps.media_assets add constraint media_assets_typed_purpose_check check((case purpose
 when 'client_logo' then mime_type in('image/png','image/jpeg','image/webp') and size_bytes between 1 and 5242880
  and source_asset_id is null and producing_job_id is null and producing_attempt_id is null and output_stage is null and output_key is null
  and (status<>'ready' or sha256 is not null and width is not null and height is not null and width::bigint*height::bigint<=40000000)
 when 'specs' then mime_type in('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')
  and size_bytes between 1 and 20971520 and width is null and height is null and client_id is null and origin_workspace_id is not null
  and source_asset_id is null and producing_job_id is null and producing_attempt_id is null and output_stage is null and output_key is null
  and (status<>'ready' or sha256 is not null)
 when 'document_text' then mime_type='application/json' and size_bytes between 1 and 20971520
  and width is null and height is null and client_id is null and origin_workspace_id is not null and source_asset_id is not null
  and producing_job_id is not null and producing_attempt_id is not null and output_stage='prepare_document' and output_key='document_text'
  and (status<>'ready' or sha256 is not null)
 when 'candidate_video' then mime_type in('video/mp4','video/quicktime','video/webm','video/x-matroska') and size_bytes between 1 and 268435456
  and bucket='eps-candidate-assets' and client_id is null and origin_workspace_id is not null
  and source_asset_id is null and producing_job_id is null and producing_attempt_id is null and output_stage is null and output_key is null
  and source_timestamp_ms is null and (status<>'ready' or sha256 is not null and width between 1 and 4096 and height between 1 and 4096 and duration_ms between 1 and 1800000)
 when 'audio' then mime_type='audio/mpeg' and size_bytes between 1 and 20971520 and width is null and height is null and source_timestamp_ms is null
  and bucket='eps-candidate-outputs' and client_id is null and origin_workspace_id is not null and source_asset_id is not null
  and producing_job_id is not null and producing_attempt_id is not null and output_stage='prepare_candidate' and length(output_key) between 1 and 100
  and (status<>'ready' or sha256 is not null)
 when 'transcript' then mime_type='application/json' and size_bytes between 1 and 2097152 and width is null and height is null and source_timestamp_ms is null and duration_ms is null
  and bucket='eps-candidate-outputs' and client_id is null and origin_workspace_id is not null and source_asset_id is not null
  and producing_job_id is not null and producing_attempt_id is not null and output_stage='transcribe_candidate' and length(output_key) between 1 and 100
  and (status<>'ready' or sha256 is not null)
 when 'candidate_frame' then mime_type='image/jpeg' and size_bytes between 1 and 20971520 and duration_ms is null
  and bucket='eps-candidate-outputs' and client_id is null and origin_workspace_id is not null and source_asset_id is not null
  and producing_job_id is not null and producing_attempt_id is not null and output_stage in('prepare_candidate','extract_frames') and length(output_key) between 1 and 100
  and (status<>'ready' or sha256 is not null and width between 1 and 4096 and height between 1 and 4096 and source_timestamp_ms between 0 and 1800000)
 else false end) is true);

grant select on eps.workspaces,eps.media_assets,eps.candidates,eps.candidate_media,eps.candidate_media_frames to eps_candidate_upload_owner;
grant update(row_version) on eps.workspaces to eps_candidate_upload_owner;
grant insert(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status) on eps.media_assets to eps_candidate_upload_owner;
grant select,insert on eps.candidate_uploads to eps_candidate_upload_owner;
grant update(status,reservation_revision,expected_sha256) on eps.candidate_uploads to eps_candidate_upload_owner;
grant select,insert on eps.idempotency_records to eps_candidate_upload_owner;
grant insert on eps.audit_events to eps_candidate_upload_owner;
grant execute on function eps.has_capability(text),eps.require_capability(text),eps.logo_scope(uuid,boolean),eps.project_scope(uuid,boolean),eps.fail(text,text,integer,bigint),eps.input_uuid(text),eps.check_input(jsonb,text[]),eps.logo_integer(jsonb,bigint,bigint),eps.idempotency_begin(text,text,jsonb),eps.finish_mutation(text,text,jsonb,jsonb,uuid) to eps_candidate_upload_owner;
create function eps.candidate_upload_scope(p_workspace uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and eps.has_capability('cast.upload') and eps.has_capability('cast.read') and eps.logo_scope(p_workspace,true)
$$;
create policy candidate_upload_workspace_read on eps.workspaces for select to eps_candidate_upload_owner using(eps.logo_scope(id,false) or eps.logo_scope(id,true));
create policy candidate_upload_workspace_lock on eps.workspaces for update to eps_candidate_upload_owner using(eps.candidate_upload_scope(id)) with check(false);
create policy candidate_upload_candidate_read on eps.candidates for select to eps_candidate_upload_owner using(eps.has_capability('cast.read'));
create policy candidate_upload_media_read on eps.candidate_media for select to eps_candidate_upload_owner using(eps.has_capability('cast.read'));
create policy candidate_upload_frames_read on eps.candidate_media_frames for select to eps_candidate_upload_owner using(eps.has_capability('cast.read'));
create policy candidate_upload_assets_read on eps.media_assets for select to eps_candidate_upload_owner using(
 purpose in('candidate_video','audio','transcript','candidate_frame') and eps.has_capability('cast.read') and
 (eps.logo_scope(origin_workspace_id,false) or eps.logo_scope(origin_workspace_id,true)
  or exists(select 1 from eps.candidate_media m where m.source_asset_id=media_assets.id or m.preview_asset_id=media_assets.id or m.transcript_asset_id=media_assets.id)
  or exists(select 1 from eps.candidate_media_frames f where f.asset_id=media_assets.id)));
create policy candidate_upload_asset_insert on eps.media_assets for insert to eps_candidate_upload_owner with check(
 purpose='candidate_video' and status='uploading' and eps.candidate_upload_scope(origin_workspace_id));
create policy candidate_upload_actor_read on eps.candidate_uploads for select to eps_candidate_upload_owner using(principal_id=auth.uid() and eps.candidate_upload_scope(workspace_id));
create policy candidate_upload_actor_insert on eps.candidate_uploads for insert to eps_candidate_upload_owner with check(principal_id=auth.uid() and status='open' and job_id is null and eps.candidate_upload_scope(workspace_id));
create policy candidate_upload_actor_cancel on eps.candidate_uploads for update to eps_candidate_upload_owner using(principal_id=auth.uid() and status='open' and eps.candidate_upload_scope(workspace_id)) with check(principal_id=auth.uid() and status='cancelled' and job_id is null and eps.candidate_upload_scope(workspace_id));
create policy candidate_upload_actor_hash on eps.candidate_uploads for update to eps_candidate_upload_owner using(principal_id=auth.uid() and status='open' and eps.candidate_upload_scope(workspace_id)) with check(principal_id=auth.uid() and status='open' and job_id is null and eps.candidate_upload_scope(workspace_id));
create policy candidate_upload_idempotency on eps.idempotency_records for all to eps_candidate_upload_owner using(principal_id=auth.uid() and operation in('candidate.reserve_upload','candidate.complete_upload','candidate.cancel_upload')) with check(principal_id=auth.uid() and operation in('candidate.reserve_upload','candidate.complete_upload','candidate.cancel_upload'));
create policy candidate_upload_audit on eps.audit_events for insert to eps_candidate_upload_owner with check(principal_id=auth.uid() and action in('candidate.reserve_upload','candidate.complete_upload','candidate.cancel_upload'));

create function eps.candidate_asset_dto(p_asset eps.media_assets) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',p_asset.id,'purpose',p_asset.purpose,'filename',p_asset.filename,'mime_type',p_asset.mime_type,'size_bytes',p_asset.size_bytes,'sha256',p_asset.sha256,'status',p_asset.status,'duration_ms',p_asset.duration_ms,'width',p_asset.width,'height',p_asset.height,'source_asset_id',p_asset.source_asset_id,'source_timestamp_ms',p_asset.source_timestamp_ms,'created_at',p_asset.created_at)
$$;
create function eps.candidate_upload_dto(p_upload uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('upload_id',u.id,'asset',eps.candidate_asset_dto(a),'principal_id',u.principal_id,'workspace_id',u.workspace_id,
  'bucket',u.bucket,'object_key',u.object_key,'expected_size_bytes',u.expected_size_bytes,'expected_mime_type',u.expected_mime_type,'expected_sha256',u.expected_sha256,
  'expires_at',u.expires_at,'status',case when u.status='open' and u.expires_at<=clock_timestamp() then 'expired' else u.status end)
 from eps.candidate_uploads u join eps.media_assets a on a.id=u.asset_id where u.id=p_upload
$$;
create function eps.candidate_upload_require(p_upload uuid) returns eps.candidate_uploads language plpgsql volatile security invoker set search_path='' as $$
declare item eps.candidate_uploads; begin
 select * into item from eps.candidate_uploads where id=p_upload;
 if not found or item.principal_id is distinct from auth.uid() or not eps.candidate_upload_scope(item.workspace_id) then perform eps.fail('RESOURCE_NOT_FOUND','Candidate upload not found.',404); end if;
 return item;
end $$;
create function public.eps_reserve_candidate_upload(p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare ws uuid;asset_id_value uuid:=gen_random_uuid();upload_id_value uuid:=gen_random_uuid();mime text;ext text;size bigint;replay jsonb;target uuid;target_version bigint;batch uuid; begin
 perform eps.check_input(p_input,array['workspace_id','candidate_id','batch_id','purpose','filename','mime_type','size_bytes','sha256']);
 ws:=eps.input_uuid(p_input->>'workspace_id'); mime:=p_input->>'mime_type';
 if not eps.candidate_upload_scope(ws) then perform eps.fail('RESOURCE_NOT_FOUND','Writable candidate workspace not found.',404);end if;
 if p_input->>'purpose' is distinct from 'candidate_video' or jsonb_typeof(p_input->'filename') is distinct from 'string' or length(btrim(p_input->>'filename')) not between 1 and 255
  or p_input->>'filename'~E'[/\\\\[:cntrl:]]' or mime not in('video/mp4','video/quicktime','video/webm','video/x-matroska')
  or p_input?'sha256' and (jsonb_typeof(p_input->'sha256') is distinct from 'string' or p_input->>'sha256'!~'^[a-f0-9]{64}$')
 then perform eps.fail('INVALID_REQUEST','Provide a supported video and simple filename.',400); end if;
 size:=eps.logo_integer(p_input->'size_bytes',1,268435456);
 if p_input?'batch_id' then batch:=eps.input_uuid(p_input->>'batch_id');end if;
 if p_input?'candidate_id' then target:=eps.input_uuid(p_input->>'candidate_id');select row_version into target_version from eps.candidates where id=target and archived_at is null and merged_into_candidate_id is null;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Candidate not found.',404);end if;end if;
 replay:=eps.idempotency_begin('candidate.reserve_upload',p_idempotency_key,p_input);
 if replay is not null then perform eps.candidate_upload_require((replay->>'upload_id')::uuid);return eps.candidate_upload_dto((replay->>'upload_id')::uuid);end if;
 if not exists(select 1 from eps.candidate_asset_config where id and enabled) then perform eps.fail('FEATURE_NOT_IMPLEMENTED','Candidate video uploads are not enabled.',503);end if;
 ext:=case mime when 'video/mp4' then 'mp4' when 'video/quicktime' then 'mov' when 'video/webm' then 'webm' else 'mkv' end;
 insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status)
 values(asset_id_value,ws,'candidate_video',p_input->>'filename',mime,'eps-candidate-assets','assets/'||asset_id_value||'/original.'||ext,size,'uploading');
 insert into eps.candidate_uploads(id,asset_id,principal_id,workspace_id,bucket,object_key,expected_size_bytes,expected_mime_type,expected_sha256,target_candidate_id,target_candidate_row_version,batch_id)
 values(upload_id_value,asset_id_value,auth.uid(),ws,'eps-candidate-assets','assets/'||asset_id_value||'/original.'||ext,size,mime,p_input->>'sha256',target,target_version,batch);
 return eps.finish_mutation('candidate.reserve_upload',p_idempotency_key,p_input,eps.candidate_upload_dto(upload_id_value),asset_id_value);
end $$;
create function public.eps_get_candidate_upload(p_upload_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$ begin
 perform eps.candidate_upload_require(p_upload_id); return eps.candidate_upload_dto(p_upload_id);
end $$;
create function public.eps_complete_candidate_upload(p_upload_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare item eps.candidate_uploads;replay jsonb;payload jsonb:=jsonb_build_object('id',p_upload_id,'input',p_input);job jsonb;asset eps.media_assets;result jsonb;begin
 item:=eps.candidate_upload_require(p_upload_id);perform eps.check_input(p_input,array['sha256','actual_size_bytes','start_processing']);
 if jsonb_typeof(p_input->'start_processing') is distinct from 'boolean' or p_input->'start_processing'<>'true'::jsonb
  or eps.logo_integer(p_input->'actual_size_bytes',1,268435456)<>item.expected_size_bytes
  or p_input?'sha256' and (jsonb_typeof(p_input->'sha256') is distinct from 'string' or p_input->>'sha256'!~'^[a-f0-9]{64}$' or item.expected_sha256 is not null and p_input->>'sha256'<>item.expected_sha256)
 then perform eps.fail('INVALID_REQUEST','Complete this reserved video with matching size/hash and processing enabled.',400);end if;
 replay:=eps.idempotency_begin('candidate.complete_upload',p_idempotency_key,payload);
 item:=eps.candidate_upload_require(p_upload_id);
 if replay is not null then return replay;end if;
 if item.status='cancelled' or item.status='open' and item.expires_at<=clock_timestamp() then perform eps.fail('UPLOAD_EXPIRED','This upload is cancelled or expired.',409);end if;
 -- Same lock order as enqueue: workspace, then upload intent. A completion-only
 -- checksum becomes a frozen assertion before any native/provider work starts.
 if item.status='open' then
  perform 1 from eps.workspaces where id=item.workspace_id for update;
  select * into item from eps.candidate_uploads where id=p_upload_id for update;
  if not found or not eps.candidate_upload_scope(item.workspace_id) or item.status<>'open' or item.expires_at<=clock_timestamp() then perform eps.fail('UPLOAD_EXPIRED','This video upload is no longer open.',409);end if;
  if p_input?'sha256' then
   if item.expected_sha256 is not null and item.expected_sha256<>p_input->>'sha256' then perform eps.fail('INVALID_REQUEST','The completion checksum differs from its reservation.',400);end if;
   if item.expected_sha256 is null then update eps.candidate_uploads set expected_sha256=p_input->>'sha256' where id=p_upload_id;end if;
  end if;
 end if;
 job:=eps.enqueue_candidate_scan(p_upload_id);
 select * into asset from eps.media_assets where id=item.asset_id;
 result:=jsonb_build_object('asset',eps.candidate_asset_dto(asset),'processing_job_id',job->>'job_id','status','queued');
 return eps.finish_mutation('candidate.complete_upload',p_idempotency_key,payload,result,item.asset_id);
end $$;
create function public.eps_cancel_candidate_upload(p_upload_id uuid,p_idempotency_key text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare item eps.candidate_uploads;replay jsonb;payload jsonb:=jsonb_build_object('id',p_upload_id);result jsonb;begin
 item:=eps.candidate_upload_require(p_upload_id);replay:=eps.idempotency_begin('candidate.cancel_upload',p_idempotency_key,payload);item:=eps.candidate_upload_require(p_upload_id);
 if replay is not null then return replay;end if;
 if item.status='completed' then perform eps.fail('INVALID_TRANSITION','This video already has a processing job. Cancel it in Processing.',409);end if;
 update eps.candidate_uploads set status='cancelled',reservation_revision=reservation_revision+1 where id=p_upload_id and status='open';
 result:=jsonb_build_object('success',true,'affected_ids',jsonb_build_array(p_upload_id));return eps.finish_mutation('candidate.cancel_upload',p_idempotency_key,payload,result,item.asset_id);
end $$;
create function public.eps_get_candidate_asset(p_asset_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare asset eps.media_assets;begin
 perform eps.require_capability('cast.read');select * into asset from eps.media_assets where id=p_asset_id and purpose in('candidate_video','candidate_frame','audio','transcript') and status='ready';
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Ready candidate media not found.',404);end if;
 return jsonb_build_object('asset',eps.candidate_asset_dto(asset),'bucket',asset.bucket,'object_key',asset.object_key);
end $$;
create function eps.candidate_storage_insert_allowed(p_bucket text,p_key text) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare headers jsonb;begin
 if p_bucket is distinct from 'eps-candidate-assets' or auth.uid() is null then return false;end if;
 begin headers:=nullif(current_setting('request.headers',true),'')::jsonb;exception when others then return false;end;
 if jsonb_typeof(headers) is distinct from 'object' or headers->>'x-upsert' is distinct from 'false' then return false;end if;
 return exists(select 1 from eps.candidate_uploads u join eps.media_assets a on a.id=u.asset_id where u.principal_id=auth.uid() and u.bucket=p_bucket and u.object_key=p_key and u.status='open' and u.expires_at>clock_timestamp() and a.status='uploading' and eps.candidate_upload_scope(u.workspace_id));
end $$;
create function eps.candidate_storage_read_allowed(p_bucket text,p_key text) returns boolean language sql volatile security definer set search_path='' as $$
 select auth.uid() is not null and eps.has_capability('cast.read') and exists(select 1 from eps.media_assets a where a.bucket=p_bucket and a.object_key=p_key and a.status='ready' and a.purpose in('candidate_video','candidate_frame','audio','transcript'))
$$;

grant create on schema eps,public to eps_candidate_upload_owner;
do $$declare routine regprocedure;begin
 foreach routine in array array['eps.candidate_upload_scope(uuid)'::regprocedure,'eps.candidate_asset_dto(eps.media_assets)'::regprocedure,'eps.candidate_upload_dto(uuid)'::regprocedure,'eps.candidate_upload_require(uuid)'::regprocedure,
 'public.eps_reserve_candidate_upload(jsonb,text)'::regprocedure,'public.eps_get_candidate_upload(uuid)'::regprocedure,'public.eps_complete_candidate_upload(uuid,jsonb,text)'::regprocedure,'public.eps_cancel_candidate_upload(uuid,text)'::regprocedure,'public.eps_get_candidate_asset(uuid)'::regprocedure,
 'eps.candidate_storage_insert_allowed(text,text)'::regprocedure,'eps.candidate_storage_read_allowed(text,text)'::regprocedure] loop
 execute format('alter function %s owner to eps_candidate_upload_owner',routine);execute format('revoke all on function %s from public,anon,authenticated,service_role',routine);
 if routine::text like 'eps_%' or routine::text like 'public.eps_%' then execute format('grant execute on function %s to authenticated',routine);end if;
 end loop;
end $$;
revoke create on schema eps,public from eps_candidate_upload_owner;
grant execute on function eps.candidate_storage_insert_allowed(text,text),eps.candidate_storage_read_allowed(text,text) to authenticated;
grant execute on function eps.candidate_asset_dto(eps.media_assets) to eps_candidate_assets_owner,eps_candidate_stage_owner;

do $$declare bucket_id text;mimes text[];maximum bigint;begin
 foreach bucket_id in array array['eps-candidate-assets','eps-candidate-outputs'] loop
 mimes:=case when bucket_id='eps-candidate-assets' then array['video/mp4','video/quicktime','video/webm','video/x-matroska'] else array['audio/mpeg','image/jpeg','application/json'] end;
 maximum:=case when bucket_id='eps-candidate-assets' then 268435456 else 20971520 end;
 if exists(select 1 from storage.buckets b where b.id=bucket_id) then raise exception 'NEW_CANDIDATE_BUCKET_REQUIRED';end if;
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values(bucket_id,bucket_id,false,maximum,mimes);
 end loop;
end $$;
create policy eps_candidate_user_insert on storage.objects for insert to authenticated with check(bucket_id='eps-candidate-assets' and (storage.allow_only_operation('object.upload') or storage.allow_only_operation('object.sign_upload_url')) and eps.candidate_storage_insert_allowed(bucket_id,name));
create policy eps_candidate_user_read on storage.objects for select to authenticated using(bucket_id in('eps-candidate-assets','eps-candidate-outputs') and (storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info') or storage.allow_only_operation('object.sign')) and eps.candidate_storage_read_allowed(bucket_id,name));
-- Service policies are composed after eps.candidate_capability_allowed exists.
notify pgrst,'reload schema';


-- Exact reviewed fragment: development/m03/candidate-kernel.sql
-- Private candidate job kernel. Compose after candidate-kernel-tables.sql and
-- root-owned candidate upload/Storage constraints; no public service identity.
set local search_path='';
alter table eps.jobs drop constraint jobs_kind_check;
alter table eps.jobs add constraint jobs_kind_check check(kind in('specs_extract','candidate_scan'));
alter table eps.jobs drop constraint jobs_stage_check;
alter table eps.jobs add constraint jobs_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate'));
alter table eps.jobs add constraint jobs_kind_stage_check check((kind='specs_extract' and stage in('prepare_document','extract_specs','apply_specs')) or (kind='candidate_scan' and stage in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate')));
alter table eps.jobs drop constraint jobs_input_hash_version_check;
alter table eps.jobs add constraint jobs_input_hash_version_check check(input_hash_version in('eps.specs-input.pg-jsonb.v1','eps.candidate-input.pg-jsonb.v1'));
alter table eps.job_events drop constraint job_events_stage_check;
alter table eps.job_events add constraint job_events_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate'));
alter table eps.outbox_events drop constraint outbox_events_stage_check;
alter table eps.outbox_events add constraint outbox_events_stage_check check(stage in('prepare_document','extract_specs','apply_specs','prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate'));

grant select on eps.jobs,eps.job_events,eps.outbox_events,eps.media_assets to eps_candidate_stage_owner;
grant update on eps.jobs to eps_candidate_stage_owner;
grant insert on eps.job_events,eps.outbox_events to eps_candidate_stage_owner;
grant select(id,project_id,archived_at),update(id) on eps.workspaces to eps_candidate_stage_owner;
grant update(id) on eps.candidate_uploads to eps_candidate_stage_owner;
grant select(id,archived_at) on public.projects to eps_candidate_stage_owner;
grant select(project_id,principal_id,active,can_write) on public.project_memberships to eps_candidate_stage_owner;
grant select(principal_id,capability,active) on public.app_capability_grants to eps_candidate_stage_owner;
grant update(status,sha256,width,height,duration_ms) on eps.media_assets to eps_candidate_stage_owner;
grant execute on function eps.job_requester_active(uuid),eps.fail(text,text,integer,bigint),eps.specs_stage_assert(boolean,text),
 eps.specs_stage_shape(jsonb,text[],text[]),eps.specs_stage_integer(jsonb,bigint,bigint),eps.specs_stage_error(text,boolean,jsonb) to eps_candidate_stage_owner;
grant execute on function extensions.gen_random_bytes(integer) to eps_candidate_stage_owner,eps_candidate_assets_owner;
create policy candidate_stage_jobs_read on eps.jobs for select to eps_candidate_stage_owner using(kind='candidate_scan');
create policy candidate_stage_jobs_update on eps.jobs for update to eps_candidate_stage_owner using(kind='candidate_scan') with check(kind='candidate_scan');
create policy candidate_stage_events_read on eps.job_events for select to eps_candidate_stage_owner using(true);
create policy candidate_stage_events_insert on eps.job_events for insert to eps_candidate_stage_owner with check(true);
create policy candidate_stage_outbox_read on eps.outbox_events for select to eps_candidate_stage_owner using(true);
create policy candidate_stage_outbox_insert on eps.outbox_events for insert to eps_candidate_stage_owner with check(true);
create policy candidate_stage_workspace_read on eps.workspaces for select to eps_candidate_stage_owner using(true);
create policy candidate_stage_workspace_lock on eps.workspaces for update to eps_candidate_stage_owner using(true) with check(false);
create policy candidate_stage_upload_lock on eps.candidate_uploads for update to eps_candidate_stage_owner using(true) with check(false);
create policy candidate_stage_project_read on public.projects for select to eps_candidate_stage_owner using(true);
create policy candidate_stage_membership_read on public.project_memberships for select to eps_candidate_stage_owner using(true);
create policy candidate_stage_capability_read on public.app_capability_grants for select to eps_candidate_stage_owner using(true);
create policy candidate_stage_media_read on eps.media_assets for select to eps_candidate_stage_owner using(purpose in('candidate_video','audio','transcript','candidate_frame'));
create policy candidate_stage_original_ready on eps.media_assets for update to eps_candidate_stage_owner using(purpose='candidate_video' and status='uploading') with check(purpose='candidate_video' and status='ready' and sha256 is not null and duration_ms between 1 and 1800000 and width>0 and height>0);

create function eps.candidate_job_hash(p_input jsonb) returns text language sql immutable security invoker set search_path='' as $$
 select encode(sha256(convert_to('eps.candidate-input.pg-jsonb.v1:'||p_input::text,'UTF8')),'hex')
$$;
create function eps.candidate_stage_can_write(p_principal uuid,p_workspace uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id
  join public.project_memberships m on m.project_id=p.id and m.principal_id=p_principal
  where w.id=p_workspace and w.archived_at is null and p.archived_at is null and eps.job_requester_active(p_principal) and m.active and m.can_write
   and not exists(select 1 from unnest(array['projects.read','workspaces.write','cast.read','cast.upload']) required
    where not exists(select 1 from public.app_capability_grants g where g.principal_id=p_principal and g.capability=required and g.active)))
$$;
create function eps.candidate_stage_source_matches(p_job eps.jobs) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from eps.candidate_uploads u join eps.media_assets a on a.id=u.asset_id join eps.workspaces w on w.id=u.workspace_id
  where u.id=p_job.resource_id and u.job_id=p_job.id and u.status='completed' and u.completed_input=p_job.input
   and u.principal_id=p_job.requested_by and u.workspace_id=p_job.workspace_id and a.origin_workspace_id=p_job.workspace_id
   and a.id=p_job.input_asset_id and a.purpose='candidate_video' and a.status in('uploading','ready')
   and a.size_bytes=u.expected_size_bytes and a.mime_type=u.expected_mime_type and a.bucket=u.bucket and a.object_key=u.object_key
   and p_job.kind='candidate_scan' and p_job.input->>'schema_version'='1.0' and p_job.input->>'workspace_id'=w.id::text
   and p_job.input->>'project_id'=w.project_id::text and p_job.input->>'source_asset_id'=a.id::text
   and p_job.input->>'source_size_bytes'=a.size_bytes::text and p_job.input->>'source_mime_type'=a.mime_type
   and p_job.input->'source_declared_sha256'=coalesce(to_jsonb(u.expected_sha256),'null'::jsonb)
   and p_job.input_hash_version='eps.candidate-input.pg-jsonb.v1' and p_job.input_hash=eps.candidate_job_hash(p_job.input))
$$;
create function eps.candidate_stage_lock(p_job uuid,p_require_access boolean default true) returns eps.jobs language plpgsql volatile security definer set search_path='' as $$
declare identity_row eps.jobs; job eps.jobs; locked uuid;begin
 select * into identity_row from eps.jobs where id=p_job and kind='candidate_scan';
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Candidate processing job not found.',404);end if;
 select id into locked from eps.workspaces where id=identity_row.workspace_id for update;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');
 select id into locked from eps.candidate_uploads where id=identity_row.resource_id and workspace_id=identity_row.workspace_id for update;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');
 select * into job from eps.jobs where id=p_job and workspace_id=identity_row.workspace_id and resource_id=identity_row.resource_id and kind='candidate_scan' for update;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');
 if p_require_access then perform eps.specs_stage_assert(eps.candidate_stage_can_write(job.requested_by,job.workspace_id),'CAPABILITY_REQUIRED');end if;
 return job;
end $$;
create function eps.candidate_is_job(p_job uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from eps.jobs where id=p_job and kind='candidate_scan')
$$;
create function eps.candidate_stage_current(p_job uuid,p_attempt uuid,p_lease text) returns eps.jobs language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;begin
 job:=eps.candidate_stage_lock(p_job);
 perform eps.specs_stage_assert(job.status='running' and job.current_attempt_id=p_attempt and job.cancel_requested_at is null and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(p_lease~'^[a-f0-9]{64}$' and job.lease_token_digest=encode(sha256(convert_to(p_lease,'UTF8')),'hex'),'LEASE_INVALID');
 perform eps.specs_stage_assert(eps.candidate_stage_source_matches(job),'INPUT_CHANGED');return job;
end $$;
create function eps.candidate_stage_live(p_job uuid,p_attempt uuid,p_input_hash text) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from eps.jobs j where j.id=p_job and j.kind='candidate_scan' and j.current_attempt_id=p_attempt and j.status='running'
  and j.input_hash=p_input_hash and j.cancel_requested_at is null and j.lease_expires_at>clock_timestamp()
  and eps.candidate_stage_can_write(j.requested_by,j.workspace_id) and eps.candidate_stage_source_matches(j))
$$;
create function eps.claim_candidate_job_stage(p_input jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;completed jsonb;token_value text;attempts integer;at_value timestamptz;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','stage','input_hash','workflow_execution_id'],array['job_id','stage','input_hash'])
  and p_input->>'stage' in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate') and p_input->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.candidate_stage_lock((p_input->>'job_id')::uuid);at_value:=clock_timestamp();
 perform eps.specs_stage_assert(exists(select 1 from eps.candidate_asset_config where id and enabled),'DEPENDENCY_UNAVAILABLE');
 perform eps.specs_stage_assert(eps.candidate_stage_source_matches(job),'INPUT_CHANGED');
 perform eps.specs_stage_assert(job.input_hash=p_input->>'input_hash','INPUT_HASH_MISMATCH');
 if job.status='cancelled' or job.cancel_requested_at is not null then perform eps.fail('JOB_CANCELLED','Candidate processing was cancelled.',409);end if;
 select value into completed from jsonb_array_elements(job.completed_stages) value where value->>'stage'=p_input->>'stage' and value->>'input_hash'=job.input_hash;
 if completed is not null then return jsonb_build_object('job_id',job.id,'stage',p_input->>'stage','attempt_id',completed->>'attempt_id','lease_token','',
  'lease_expires_at',completed->>'completed_at','already_completed',true,'input',jsonb_build_object('input_hash',job.input_hash,'result_schema',completed->>'result_schema','result',completed->'result'));end if;
 perform eps.specs_stage_assert(job.stage=p_input->>'stage','STAGE_OUT_OF_ORDER');
 if job.status='running' and job.lease_expires_at>at_value then perform eps.fail('JOB_ALREADY_RUNNING','Candidate stage already has an active lease.',409);end if;
 perform eps.specs_stage_assert(job.status in('queued','running') and job.available_at<=at_value,'JOB_NOT_AVAILABLE');
 attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);perform eps.specs_stage_assert(attempts<3,'RETRY_EXHAUSTED');
 token_value:=encode(extensions.gen_random_bytes(32),'hex');
 update eps.jobs set status='running',attempt=attempt+1,current_attempt_id=gen_random_uuid(),lease_token_digest=encode(sha256(convert_to(token_value,'UTF8')),'hex'),
  lease_expires_at=at_value+interval '90 seconds',heartbeat_at=at_value,last_event_sequence=0,stage_attempts=jsonb_set(stage_attempts,array[stage],to_jsonb(attempts+1)),
  progress_completed=0,progress_total=null,error=null,n8n_execution_id=p_input->>'workflow_execution_id',row_version=row_version+1,updated_at=at_value where id=job.id returning * into job;
 return jsonb_build_object('job_id',job.id,'stage',job.stage,'attempt_id',job.current_attempt_id,'lease_token',token_value,'lease_expires_at',job.lease_expires_at,
  'already_completed',false,'input',job.input||jsonb_build_object('input_hash',job.input_hash));
end $$;
create function eps.get_candidate_stage_input(p_job uuid,p_attempt uuid,p_lease text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;source eps.media_assets;prepared jsonb;transcript jsonb;begin
 job:=eps.candidate_stage_current(p_job,p_attempt,p_lease);select * into strict source from eps.media_assets where id=job.input_asset_id;
 select payload into prepared from eps.candidate_stage_payloads where job_id=job.id and input_hash=job.input_hash and stage='prepare_candidate';
 select payload into transcript from eps.candidate_stage_payloads where job_id=job.id and input_hash=job.input_hash and stage='transcribe_candidate';
 return jsonb_build_object('job_id',job.id,'attempt_id',job.current_attempt_id,'stage',job.stage,'input_hash',job.input_hash,
  'configuration',jsonb_build_object('media_preparation_version',job.input#>'{configuration,media_implementation_version}',
   'transcription_model_version',job.input#>'{configuration,transcription_model}','extraction_model_version',job.input#>'{configuration,extraction_model}',
   'prompt_version','candidate_extract_v1','result_schema_version','1.0'),
  'source',jsonb_build_object('asset_id',source.id,'sha256',coalesce(source.sha256,job.input->>'source_declared_sha256'),'size_bytes',source.size_bytes,'mime_type',source.mime_type))
  ||case when prepared is null then '{}'::jsonb else jsonb_build_object('prepared',prepared) end
  ||case when transcript is null then '{}'::jsonb else jsonb_build_object('transcript_asset',transcript->'transcript_asset') end
  ||jsonb_build_object('allow_partial_transcription',coalesce((job.stage_attempts->>'transcribe_candidate')::integer,0)>=3,
   'allow_partial_extraction',coalesce((job.stage_attempts->>'extract_candidate')::integer,0)>=3);
end $$;

-- Fixed definer owners, not a new runtime group or general SQL API.
grant create on schema eps to eps_candidate_stage_owner;
do $$ declare routine record;begin
 for routine in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps' and p.proname in
  ('candidate_job_hash','candidate_stage_can_write','candidate_stage_source_matches','candidate_stage_lock','candidate_is_job','candidate_stage_current','candidate_stage_live','claim_candidate_job_stage','get_candidate_stage_input') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',routine.signature);
  execute format('alter function %s owner to eps_candidate_stage_owner',routine.signature);
 end loop;
end $$;
revoke create on schema eps from eps_candidate_stage_owner;
grant execute on function eps.claim_candidate_job_stage(jsonb),eps.get_candidate_stage_input(uuid,uuid,text),eps.candidate_is_job(uuid),
 eps.candidate_stage_lock(uuid,boolean),eps.candidate_stage_source_matches(eps.jobs),eps.candidate_stage_live(uuid,uuid,text) to eps_specs_stage_owner;
grant execute on function eps.candidate_is_job(uuid),eps.candidate_stage_current(uuid,uuid,text),eps.candidate_stage_live(uuid,uuid,text) to eps_specs_assets_owner,eps_candidate_assets_owner;


-- Exact reviewed fragment: development/m03/candidate-kernel-enqueue.sql
-- Narrow authorized completion hook. Parent upload API performs actual transfer
-- metadata checks; native preparation independently verifies bytes/checksum.
grant select,insert on eps.jobs to eps_candidate_upload_owner;
grant insert on eps.outbox_events to eps_candidate_upload_owner;
grant select on eps.candidate_uploads to eps_candidate_upload_owner;
grant update(status,completed_at,completed_input,job_id) on eps.candidate_uploads to eps_candidate_upload_owner;
grant select(id,project_id,archived_at),update(id) on eps.workspaces to eps_candidate_upload_owner;
grant execute on function eps.candidate_job_hash(jsonb),eps.candidate_stage_can_write(uuid,uuid),eps.require_capability(text),eps.fail(text,text,integer,bigint),eps.specs_stage_assert(boolean,text) to eps_candidate_upload_owner;
create policy candidate_upload_enqueue_job_read on eps.jobs for select to eps_candidate_upload_owner using(kind='candidate_scan' and requested_by=auth.uid());
create policy candidate_upload_enqueue_job_insert on eps.jobs for insert to eps_candidate_upload_owner with check(kind='candidate_scan' and requested_by=auth.uid()
 and stage='prepare_candidate' and status='queued' and attempt=0 and current_attempt_id is null and lease_token_digest is null and dispatch_generation=1
 and exists(select 1 from eps.candidate_uploads u where u.id=resource_id and u.asset_id=input_asset_id and u.workspace_id=jobs.workspace_id and u.principal_id=auth.uid()));
create policy candidate_upload_enqueue_outbox on eps.outbox_events for insert to eps_candidate_upload_owner with check(exists(select 1 from eps.jobs j where j.id=job_id and j.kind='candidate_scan' and j.requested_by=auth.uid() and stage='prepare_candidate' and dispatch_generation=1));
create policy candidate_upload_self_read on eps.candidate_uploads for select to eps_candidate_upload_owner using(principal_id=auth.uid());
create policy candidate_upload_self_update on eps.candidate_uploads for update to eps_candidate_upload_owner
 using(principal_id=auth.uid() and eps.candidate_stage_can_write(auth.uid(),workspace_id))
 with check(principal_id=auth.uid() and status='completed' and completed_input is not null and job_id is not null and eps.candidate_stage_can_write(auth.uid(),workspace_id));
create policy candidate_upload_enqueue_workspace_read on eps.workspaces for select to eps_candidate_upload_owner using(eps.candidate_stage_can_write(auth.uid(),id));
create policy candidate_upload_enqueue_workspace_lock on eps.workspaces for update to eps_candidate_upload_owner using(eps.candidate_stage_can_write(auth.uid(),id)) with check(false);
create function eps.enqueue_candidate_scan(p_upload_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare intent eps.candidate_uploads; workspace eps.workspaces; config eps.candidate_asset_config; job eps.jobs; input_value jsonb; job_id uuid:=gen_random_uuid();hash_value text;begin
 perform eps.require_capability('cast.read');perform eps.require_capability('cast.upload');perform eps.require_capability('workspaces.write');perform eps.require_capability('projects.read');
 select * into intent from eps.candidate_uploads where id=p_upload_id and principal_id=auth.uid();
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Candidate upload not found.',404);end if;
 select * into workspace from eps.workspaces where id=intent.workspace_id for update;
 perform eps.specs_stage_assert(found and eps.candidate_stage_can_write(auth.uid(),workspace.id),'RESOURCE_NOT_FOUND');
 select * into intent from eps.candidate_uploads where id=p_upload_id and workspace_id=workspace.id and principal_id=auth.uid() for update;
 if intent.status='completed' then
  select * into job from eps.jobs where id=intent.job_id and kind='candidate_scan' and requested_by=auth.uid();perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
  return jsonb_build_object('job_id',job.id,'resource_id',intent.asset_id,'status',job.status,'poll_url','/api/v1/jobs/'||job.id::text);
 end if;
 perform eps.specs_stage_assert(intent.status='open' and intent.expires_at>clock_timestamp(),'INVALID_TRANSITION');
 select * into config from eps.candidate_asset_config where id and enabled;
 if not found then perform eps.fail('DEPENDENCY_UNAVAILABLE','Candidate processing is not configured.',503);end if;
 input_value:=jsonb_build_object('schema_version','1.0','workspace_id',workspace.id,'project_id',workspace.project_id,'source_asset_id',intent.asset_id,
  'source_size_bytes',intent.expected_size_bytes,'source_mime_type',intent.expected_mime_type,'source_declared_sha256',intent.expected_sha256,
  'target_candidate_id',intent.target_candidate_id,'target_candidate_row_version',intent.target_candidate_row_version,
  'configuration',jsonb_build_object('transcription_model',config.transcription_model,'extraction_model',config.extraction_model,'prompt_version',config.prompt_version,
   'schema_version',config.schema_version,'media_implementation_version',config.media_implementation_version));
 hash_value:=eps.candidate_job_hash(input_value);
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input_asset_id,batch_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id)
 values(job_id,workspace.id,auth.uid(),'candidate_scan',intent.id,intent.asset_id,intent.batch_id,input_value,hash_value,'eps.candidate-input.pg-jsonb.v1',
  encode(sha256(convert_to('candidate_scan:'||intent.id::text,'UTF8')),'hex'),'prepare_candidate','candidate:'||job_id::text) returning * into job;
 insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key) values(job.id,job.stage,job.input_hash,1,job.id::text||':1');
 update eps.candidate_uploads set status='completed',completed_at=clock_timestamp(),completed_input=input_value,job_id=job.id where id=intent.id and status='open';
 perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
 return jsonb_build_object('job_id',job.id,'resource_id',intent.asset_id,'status',job.status,'poll_url','/api/v1/jobs/'||job.id::text);
end $$;
grant create on schema eps to eps_candidate_upload_owner;
alter function eps.enqueue_candidate_scan(uuid) owner to eps_candidate_upload_owner;
revoke create on schema eps from eps_candidate_upload_owner;
revoke all on function eps.enqueue_candidate_scan(uuid) from public,anon,authenticated,service_role;
-- Only the authenticated upload completion definer may invoke this hook.


-- Exact reviewed fragment: development/m03/candidates-apply-candidate.sql
-- LOCAL DEVELOPMENT COMPOSITION after candidate core and candidate kernel.
-- No upload reservation, arbitrary source setter, role provisioning or network.
set local search_path=''; set local lock_timeout='3s'; set local statement_timeout='30s';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or to_regclass('eps.candidates') is null or to_regclass('eps.candidate_stage_payloads') is null
  or not exists(select 1 from pg_roles where rolname='eps_candidate_stage_owner')
  or exists(select 1 from pg_roles where rolname='eps_candidate_apply_owner')
 then raise exception 'M03_APPLY_LOCAL_COMPOSITION_REQUIRED'; end if;
end $$;
create role eps_candidate_apply_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_candidate_apply_owner to postgres;
grant usage on schema eps,public to eps_candidate_apply_owner;
grant select on eps.jobs,eps.candidate_stage_payloads,eps.media_assets,eps.candidates,eps.candidate_media,eps.candidate_media_frames,eps.workspace_candidates to eps_candidate_apply_owner;
grant select(id,project_id,archived_at,row_version,draft_revision) on eps.workspaces to eps_candidate_apply_owner;
grant select(id,archived_at) on public.projects to eps_candidate_apply_owner;
grant select(project_id,principal_id,can_write,active) on public.project_memberships to eps_candidate_apply_owner;
grant select(principal_id,capability,active) on public.app_capability_grants to eps_candidate_apply_owner;
grant insert on eps.candidates,eps.candidate_media,eps.candidate_media_frames,eps.workspace_candidates to eps_candidate_apply_owner;
grant update(row_version,draft_revision,has_unpublished_changes,updated_at) on eps.workspaces to eps_candidate_apply_owner;
grant insert(principal_id,action,resource_id,request_id,client_type) on eps.audit_events to eps_candidate_apply_owner;
-- SELECT FOR UPDATE requires a harmless UPDATE grant even when the function
-- only locks the immutable job. No status/input/lease mutation is authorized.
grant update(row_version) on eps.jobs,eps.candidates to eps_candidate_apply_owner;
grant execute on function eps.fail(text,text,integer,bigint),eps.input_uuid(text),eps.check_input(jsonb,text[]),eps.cast_facts(jsonb),eps.cast_fingerprint(jsonb,jsonb),eps.cast_canonical(jsonb),eps.job_requester_active(uuid) to eps_candidate_apply_owner;
create policy candidate_apply_jobs_read on eps.jobs for select to eps_candidate_apply_owner using(kind='candidate_scan');
create policy candidate_apply_jobs_lock on eps.jobs for update to eps_candidate_apply_owner using(kind='candidate_scan') with check(kind='candidate_scan');
create policy candidate_apply_payload_read on eps.candidate_stage_payloads for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_assets_read on eps.media_assets for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_candidates_read on eps.candidates for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_candidates_lock on eps.candidates for update to eps_candidate_apply_owner using(true) with check(true);
create policy candidate_apply_candidates_insert on eps.candidates for insert to eps_candidate_apply_owner with check(source_kind='scan' and exists(select 1 from eps.jobs job where job.id::text=current_setting('eps.candidate_apply.job_id',true) and job.requested_by=created_by and job.kind='candidate_scan' and job.stage='apply_candidate' and job.status='running'));
create policy candidate_apply_media_read on eps.candidate_media for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_media_insert on eps.candidate_media for insert to eps_candidate_apply_owner with check(source_job_id::text=current_setting('eps.candidate_apply.job_id',true));
create policy candidate_apply_frames_read on eps.candidate_media_frames for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_frames_insert on eps.candidate_media_frames for insert to eps_candidate_apply_owner with check(exists(select 1 from eps.candidate_media media where media.id=candidate_media_id and media.source_job_id::text=current_setting('eps.candidate_apply.job_id',true)));
create policy candidate_apply_pool_read on eps.workspace_candidates for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_pool_insert on eps.workspace_candidates for insert to eps_candidate_apply_owner with check(exists(select 1 from eps.jobs job where job.id::text=current_setting('eps.candidate_apply.job_id',true) and job.workspace_id=workspace_candidates.workspace_id));
create policy candidate_apply_workspace_read on eps.workspaces for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_workspace_update on eps.workspaces for update to eps_candidate_apply_owner using(exists(select 1 from eps.jobs job where job.id::text=current_setting('eps.candidate_apply.job_id',true) and job.workspace_id=workspaces.id)) with check(exists(select 1 from eps.jobs job where job.id::text=current_setting('eps.candidate_apply.job_id',true) and job.workspace_id=workspaces.id));
create policy candidate_apply_project_read on public.projects for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_membership_read on public.project_memberships for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_capability_read on public.app_capability_grants for select to eps_candidate_apply_owner using(true);
create policy candidate_apply_audit_insert on eps.audit_events for insert to eps_candidate_apply_owner with check(action='candidate.scan_applied' and client_type='api' and exists(select 1 from eps.jobs job where job.id::text=current_setting('eps.candidate_apply.job_id',true) and job.requested_by=audit_events.principal_id));

create function eps.candidate_apply_assert(p_condition boolean,p_code text default 'RESULT_INVALID') returns void language plpgsql immutable security invoker set search_path='' as $$ begin
 if p_condition is distinct from true then perform eps.fail(p_code,'The candidate application could not be validated.',case when p_code='LEASE_INVALID' then 403 when p_code='RESOURCE_NOT_FOUND' then 404 else 409 end); end if;
end $$;
create function eps.apply_candidate_scan(p_job_id uuid,p_attempt_id uuid,p_lease_token text,p_input_hash text,p_result jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
#variable_conflict use_variable
declare job eps.jobs; source eps.media_assets; candidate eps.candidates; media eps.candidate_media; workspace eps.workspaces;
 prepared eps.candidate_stage_payloads; transcribed eps.candidate_stage_payloads; extracted eps.candidate_stage_payloads; selected eps.candidate_stage_payloads;
 extraction jsonb; transcript jsonb; facts jsonb; provenance jsonb:='{}'; evidence jsonb; ref jsonb; segment jsonb; field text; claim jsonb; frame jsonb; frame_asset eps.media_assets;
 candidate_id uuid; media_id uuid; pool_id uuid; source_casting_id text; chosen_frames uuid[]; transcript_id uuid; languages text[]; issues text[]:='{}'; result jsonb; changed bigint; begin
 perform eps.candidate_apply_assert(p_job_id is not null and p_attempt_id is not null and length(p_lease_token) between 1 and 1024 and p_input_hash ~ '^[a-f0-9]{64}$','INVALID_REQUEST');
 select * into job from eps.jobs where id=p_job_id and kind='candidate_scan' for update;
 perform eps.candidate_apply_assert(found,'RESOURCE_NOT_FOUND');
 perform eps.candidate_apply_assert(job.stage='apply_candidate' and job.status='running' and job.cancel_requested_at is null and job.current_attempt_id=p_attempt_id and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.candidate_apply_assert(job.lease_token_digest=encode(sha256(convert_to(p_lease_token,'UTF8')),'hex'),'LEASE_INVALID');
 perform eps.candidate_apply_assert(job.input_hash=p_input_hash,'INPUT_HASH_MISMATCH');
 perform eps.candidate_apply_assert(job.input->>'schema_version'='1.0' and job.input->>'workspace_id'=job.workspace_id::text and job.input->>'source_asset_id'=job.input_asset_id::text,'INPUT_CHANGED');
 perform eps.candidate_apply_assert(jsonb_typeof(p_result)='object' and (select count(*)=1 from jsonb_object_keys(p_result)) and p_result->>'source_asset_id'=job.input_asset_id::text);
 perform set_config('eps.candidate_apply.job_id',job.id::text,true);
 select id,project_id,archived_at,row_version,draft_revision into workspace.id,workspace.project_id,workspace.archived_at,workspace.row_version,workspace.draft_revision
  from eps.workspaces where id=job.workspace_id and archived_at is null for update;
 perform eps.candidate_apply_assert(found and workspace.project_id::text=job.input->>'project_id','INPUT_CHANGED');
 perform eps.candidate_apply_assert(eps.job_requester_active(job.requested_by) and exists(select 1 from public.projects where id=workspace.project_id and archived_at is null)
  and exists(select 1 from public.project_memberships where project_id=workspace.project_id and principal_id=job.requested_by and active and can_write)
  and not exists(select 1 from unnest(array['projects.read','workspaces.write','cast.upload','cast.read']) required where not exists(select 1 from public.app_capability_grants where principal_id=job.requested_by and capability=required and active)),'CAPABILITY_REQUIRED');
 select * into source from eps.media_assets where id=job.input_asset_id and status='ready' and purpose='candidate_video';
 perform eps.candidate_apply_assert(found and source.origin_workspace_id=job.workspace_id and source.size_bytes=(job.input->>'source_size_bytes')::bigint and source.mime_type=job.input->>'source_mime_type' and source.sha256 is not null and source.duration_ms>0 and source.width>0 and source.height>0,'INPUT_CHANGED');
 select * into prepared from eps.candidate_stage_payloads where job_id=job.id and stage='prepare_candidate' and input_hash=job.input_hash;
 perform eps.candidate_apply_assert(found and prepared.result_schema='media-preparation.v1' and prepared.payload->>'source_asset_id'=source.id::text and prepared.payload->>'source_sha256'=source.sha256);
 select * into transcribed from eps.candidate_stage_payloads where job_id=job.id and stage='transcribe_candidate' and input_hash=job.input_hash;
 perform eps.candidate_apply_assert(found and transcribed.result_schema='candidate-transcript-stage.v1' and transcribed.payload->>'source_asset_id'=source.id::text);
 select * into extracted from eps.candidate_stage_payloads where job_id=job.id and stage='extract_candidate' and input_hash=job.input_hash;
 perform eps.candidate_apply_assert(found and extracted.result_schema='candidate-extraction-stage.v1' and extracted.payload->>'source_asset_id'=source.id::text);
 select * into selected from eps.candidate_stage_payloads where job_id=job.id and stage='select_frames' and input_hash=job.input_hash;
 perform eps.candidate_apply_assert(found and selected.result_schema='frame-selection-stage.v1' and selected.payload->>'source_asset_id'=source.id::text);
 -- The four canonical payload IDs must be the successful completed outputs,
 -- rather than a stale private payload injected before a stage completed.
 perform eps.candidate_apply_assert(not exists(select 1 from (values(prepared.id,prepared.stage,prepared.attempt_id),(transcribed.id,transcribed.stage,transcribed.attempt_id),(extracted.id,extracted.stage,extracted.attempt_id),(selected.id,selected.stage,selected.attempt_id)) payload(id,stage,attempt) where not exists(select 1 from jsonb_array_elements(job.completed_stages) completed where completed->>'stage'=payload.stage and completed->>'attempt_id'=payload.attempt::text and completed->>'input_hash'=job.input_hash and completed#>>'{result,stage_output_id}'=payload.id::text)));
 transcript:=transcribed.payload->'original_transcript'; extraction:=extracted.payload->'result';
 if extraction is null or extraction='null'::jsonb then
  perform eps.candidate_apply_assert(extracted.payload->'manual_profile_required'='true'::jsonb and (
   transcript='null'::jsonb and transcribed.payload->'transcript_asset'='null'::jsonb
   or extracted.payload->>'missing_extraction_reason'='CANDIDATE_EXTRACTION_FAILED' and jsonb_typeof(transcript)='object'
    and transcript->>'source_asset_id'=source.id::text and jsonb_typeof(transcript->'original_text')='string' and jsonb_typeof(transcript->'segments')='array'));
  facts:='{"name":null,"casting_id":null,"age_or_range":null,"stated_gender":null,"height_measurements":null,"languages":[],"accents":[],"skills_experience":null,"city":null,"previous_projects_roles":null,"classification":null}'::jsonb;
 else
  perform eps.candidate_apply_assert(extraction->>'schema_version'='1.0' and extraction->>'source_asset_id'=source.id::text and transcript->>'source_asset_id'=source.id::text and jsonb_typeof(transcript->'segments')='array' and jsonb_typeof(transcript->'original_text')='string' and jsonb_typeof(extraction->'evidence')='array');
  facts:=eps.cast_facts(extraction->'facts');
  for evidence in select value from jsonb_array_elements(extraction->'evidence') loop
   field:=evidence->>'field_path'; ref:=evidence->'source';
   perform eps.candidate_apply_assert(field='project_availability_statement' or field=any(array['facts.name','facts.casting_id','facts.age_or_range','facts.stated_gender','facts.height_measurements','facts.languages','facts.accents','facts.skills_experience','facts.city','facts.previous_projects_roles','facts.classification']));
   select value into segment from jsonb_array_elements(transcript->'segments') value where value->'index'=ref->'segment_index';
   perform eps.candidate_apply_assert(segment is not null and ref->>'asset_id'=source.id::text and ref->'page'='null'::jsonb and ref->'paragraph'='null'::jsonb and nullif(btrim(ref->>'quote'),'') is not null and position(ref->>'quote' in segment->>'text')>0 and ref->'start_ms'=segment->'start_ms' and ref->'end_ms'=segment->'end_ms');
   if field like 'facts.%' and not provenance?substring(field from 7) then provenance:=provenance||jsonb_build_object(substring(field from 7),jsonb_build_object('kind','transcript','source',ref)); end if;
  end loop;
  for field,claim in select key,value from jsonb_each(facts) loop
   if claim<>'null'::jsonb and claim<>'[]'::jsonb then perform eps.candidate_apply_assert(provenance?field); end if;
  end loop;
  if extraction->'project_availability_statement'<>'null'::jsonb then perform eps.candidate_apply_assert(exists(select 1 from jsonb_array_elements(extraction->'evidence') value where value->>'field_path'='project_availability_statement')); end if;
 end if;
 if transcribed.payload->'transcript_asset'<>'null'::jsonb then
  transcript_id:=eps.input_uuid(transcribed.payload#>>'{transcript_asset,asset_id}');
  perform eps.candidate_apply_assert(exists(select 1 from eps.media_assets asset where asset.id=transcript_id and asset.status='ready' and asset.purpose='transcript' and asset.mime_type='application/json' and asset.sha256=transcribed.payload#>>'{transcript_asset,sha256}' and asset.source_asset_id=source.id and asset.producing_job_id=job.id and asset.producing_attempt_id=transcribed.attempt_id and asset.output_stage='transcribe_candidate'));
 end if;
 select coalesce(array_agg(value),'{}') into languages from jsonb_array_elements_text(transcribed.payload->'languages') value;
 perform eps.candidate_apply_assert(jsonb_typeof(selected.payload->'selected_frames')='array' and jsonb_array_length(selected.payload->'selected_frames')<=3);
 select coalesce(array_agg(eps.input_uuid(value->>'frame_asset_id') order by ordinal),'{}') into chosen_frames from jsonb_array_elements(selected.payload->'selected_frames') with ordinality list(value,ordinal);
 perform eps.candidate_apply_assert(cardinality(chosen_frames)=(select count(distinct frame_id) from unnest(chosen_frames) frame_id));
 if cardinality(chosen_frames)<3 then perform eps.candidate_apply_assert(nullif(btrim(selected.payload->>'insufficient_frames_reason'),'') is not null); end if;
 perform eps.candidate_apply_assert(not exists(select 1 from unnest(chosen_frames) frame_id where not exists(select 1 from jsonb_array_elements(prepared.payload->'sampled_frames') available where available->>'frame_asset_id'=frame_id::text)));
 if prepared.payload#>'{probe,has_audio}'='false'::jsonb or transcribed.payload->>'missing_transcript_reason'='NO_INTELLIGIBLE_AUDIO' then issues:=array_append(issues,'NO_AUDIO');end if;
 if transcribed.payload->>'missing_transcript_reason'='TRANSCRIPTION_FAILED' then issues:=array_append(issues,'TRANSCRIPTION_FAILED');end if;
 if extracted.payload->>'missing_extraction_reason'='CANDIDATE_EXTRACTION_FAILED' then issues:=array_append(issues,'EXTRACTION_FAILED');end if;
 if cardinality(chosen_frames)<3 then issues:=array_append(issues,'INSUFFICIENT_FRAMES');end if;
 candidate_id:=case when job.input->>'target_candidate_id' is not null then eps.input_uuid(job.input->>'target_candidate_id') end;
 if candidate_id is not null then
  select * into candidate from eps.candidates where id=candidate_id and archived_at is null and merged_into_candidate_id is null for update;
  perform eps.candidate_apply_assert(found and candidate.row_version=(job.input->>'target_candidate_row_version')::bigint,'INPUT_CHANGED');
  -- New media is appended; supplied facts and factual confirmation are untouched.
 else
  candidate_id:=gen_random_uuid(); source_casting_id:=facts->>'casting_id';
  if source_casting_id is null or exists(select 1 from eps.candidates where lower(casting_id)=lower(source_casting_id)) then facts:=jsonb_set(facts,'{casting_id}',to_jsonb('EPS-'||upper(replace(candidate_id::text,'-','')))); end if;
  -- Upload time does not establish when an old recording's stated age applied.
  -- Keep that context unknown until a real recording/as-of date is supplied.
  insert into eps.candidates(id,facts,casting_id,source_casting_id,source_kind,field_sources,age_as_of,created_by)
   values(candidate_id,facts,facts->>'casting_id',source_casting_id,'scan',provenance,null,job.requested_by);
 end if;
 -- Stable source asset uniqueness protects uncertain completion/retries. The
 -- kernel handles callback replay; a different job cannot reassign this video.
 select * into media from eps.candidate_media where source_asset_id=source.id;
 if found then
  perform eps.candidate_apply_assert(media.source_job_id=job.id and media.candidate_id=candidate_id,'INPUT_CHANGED'); media_id:=media.id;
 else
  media_id:=gen_random_uuid();
  insert into eps.candidate_media(id,candidate_id,source_asset_id,transcript_asset_id,original_transcript,transcript_segments,languages,extraction,source_job_id,selected_frame_asset_ids,processing_issues)
   values(media_id,candidate_id,source.id,transcript_id,transcript->>'original_text',coalesce(transcript->'segments','[]'::jsonb),languages,nullif(extraction,'null'::jsonb),job.id,chosen_frames,issues);
  for frame in select value from jsonb_array_elements(prepared.payload->'sampled_frames') loop
   select * into frame_asset from eps.media_assets where id=eps.input_uuid(frame->>'frame_asset_id');
   perform eps.candidate_apply_assert(found and frame_asset.status='ready' and frame_asset.purpose='candidate_frame' and frame_asset.source_asset_id=source.id and frame_asset.producing_job_id=job.id and frame_asset.producing_attempt_id=prepared.attempt_id and frame_asset.output_stage='prepare_candidate' and frame_asset.sha256=frame->>'sha256' and frame_asset.source_timestamp_ms=(frame->>'timestamp_ms')::bigint and frame_asset.source_timestamp_ms<source.duration_ms and frame_asset.width=(frame->>'width')::integer and frame_asset.height=(frame->>'height')::integer);
   insert into eps.candidate_media_frames(candidate_media_id,asset_id,quality_flags) values(media_id,frame_asset.id,array(select jsonb_array_elements_text(frame->'quality_flags')));
  end loop;
 end if;
 select participation.id into pool_id from eps.workspace_candidates participation
  where participation.workspace_id=job.workspace_id and participation.candidate_id=candidate_id and participation.archived_at is null;
 if not found then
  insert into eps.workspace_candidates(workspace_id,candidate_id,selected_candidate_media_id,selected_frame_asset_ids,availability)
   values(job.workspace_id,candidate_id,media_id,chosen_frames,extraction->>'project_availability_statement') returning id into pool_id;
 end if;
 -- Existing workspace media/fresh-material/availability/notes are pinned. The
 -- original project may explicitly choose this new recording after review.
 update eps.workspaces set row_version=row_version+1,draft_revision=draft_revision+1,has_unpublished_changes=true,updated_at=clock_timestamp() where id=job.workspace_id;
 get diagnostics changed=row_count; perform eps.candidate_apply_assert(changed=1,'INPUT_CHANGED');
 insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type) values(job.requested_by,'candidate.scan_applied',candidate_id,job.correlation_id,'api');
 result:=jsonb_build_object('candidate_id',candidate_id,'candidate_media_id',media_id,'workspace_candidate_id',pool_id,'source_asset_id',source.id,'workspace_id',job.workspace_id,'review_status',case when candidate.reviewed_facts_fingerprint is not null and candidate.reviewed_facts_fingerprint=eps.cast_fingerprint(candidate.facts,candidate.field_sources) then 'reviewed' else 'unreviewed' end);
 return result;
end $$;
grant create on schema eps to eps_candidate_apply_owner;
alter function eps.candidate_apply_assert(boolean,text) owner to eps_candidate_apply_owner;
alter function eps.apply_candidate_scan(uuid,uuid,text,text,jsonb) owner to eps_candidate_apply_owner;
revoke create on schema eps from eps_candidate_apply_owner;
revoke all on function eps.candidate_apply_assert(boolean,text),eps.apply_candidate_scan(uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role,eps_jobs_executor,eps_cast_owner;
grant execute on function eps.apply_candidate_scan(uuid,uuid,text,text,jsonb) to eps_candidate_stage_owner;


-- Exact reviewed fragment: development/m03/candidate-kernel-events.sql
-- Typed private payload validation and fenced commit. No facts/transcript in jobs.
grant execute on function eps.cast_facts(jsonb),eps.check_input(jsonb,text[]),eps.specs_stage_strings(jsonb) to eps_candidate_stage_owner;
create function eps.candidate_stage_asset_reference(p_ref jsonb,p_job eps.jobs,p_purpose text,p_attempt uuid) returns boolean
language sql volatile security definer set search_path='' as $$
 select exists(select 1 from eps.media_assets a where a.id::text=p_ref->>'asset_id' and a.origin_workspace_id=p_job.workspace_id
  and a.purpose=p_purpose and a.status='ready' and a.source_asset_id=p_job.input_asset_id and a.producing_job_id=p_job.id and a.producing_attempt_id=p_attempt
  and a.sha256=p_ref->>'sha256' and a.mime_type=p_ref->>'mime_type' and a.size_bytes::text=p_ref->>'size_bytes')
$$;
create function eps.candidate_validate_stage(p_job eps.jobs,p_schema text,p_payload jsonb) returns void
language plpgsql volatile security definer set search_path='' as $$
declare prepared eps.candidate_stage_payloads;transcribed eps.candidate_stage_payloads;ref jsonb;item jsonb;source eps.media_assets;duration bigint;ordinal bigint;metadata jsonb;begin
 perform eps.specs_stage_assert(jsonb_typeof(p_payload)='object' and octet_length(p_payload::text)<=393216 and p_payload->>'source_asset_id'=p_job.input_asset_id::text,'RESULT_INVALID');
 select * into strict source from eps.media_assets where id=p_job.input_asset_id;
 if p_job.stage='prepare_candidate' then
  perform eps.specs_stage_assert(p_schema='media-preparation.v1' and eps.specs_stage_shape(p_payload,
   array['source_asset_id','source_sha256','probe','audio_chunks','sampled_frames','warnings','implementation_version','ffmpeg_version'],
   array['source_asset_id','source_sha256','probe','audio_chunks','sampled_frames','warnings','implementation_version','ffmpeg_version'])
   and p_payload->>'source_sha256'~'^[a-f0-9]{64}$' and (p_job.input->'source_declared_sha256'='null' or p_payload->>'source_sha256'=p_job.input->>'source_declared_sha256')
   and p_payload->>'implementation_version'='video-preparation.v1' and length(p_payload->>'ffmpeg_version') between 1 and 500
   and jsonb_typeof(p_payload->'audio_chunks')='array' and jsonb_array_length(p_payload->'audio_chunks')<=16
   and jsonb_typeof(p_payload->'sampled_frames')='array' and jsonb_array_length(p_payload->'sampled_frames')<=12
   and eps.specs_stage_strings(p_payload->'warnings') and jsonb_array_length(p_payload->'warnings')<=100,'RESULT_INVALID');
  item:=p_payload->'probe';perform eps.specs_stage_assert(eps.specs_stage_shape(item,array['duration_ms','width','height','rotation_degrees','frame_rate','video_codec','audio_codec','has_audio','container','source_start_ms'])
   and eps.specs_stage_integer(item->'duration_ms',1,1800000) and eps.specs_stage_integer(item->'width',1,4096) and eps.specs_stage_integer(item->'height',1,4096)
   and item->>'rotation_degrees' in('0','90','180','270') and jsonb_typeof(item->'frame_rate')='number' and (item->>'frame_rate')::numeric between 0.001 and 120
   and jsonb_typeof(item->'has_audio')='boolean' and jsonb_typeof(item->'video_codec')='string' and length(item->>'video_codec') between 1 and 100
   and jsonb_typeof(item->'container')='string' and length(item->>'container') between 1 and 200 and eps.specs_stage_integer(item->'source_start_ms',0,1800000),'RESULT_INVALID');
  duration:=(item->>'duration_ms')::bigint;ordinal:=0;
  for ref in select value from jsonb_array_elements(p_payload->'audio_chunks') loop
   perform eps.specs_stage_assert(ref->>'index'=ordinal::text and eps.candidate_stage_asset_reference(ref,p_job,'audio',p_job.current_attempt_id)
    and eps.specs_stage_integer(ref->'start_ms',0,duration) and eps.specs_stage_integer(ref->'end_ms',1,duration)
    and (ref->>'end_ms')::bigint>(ref->>'start_ms')::bigint and (ref->>'end_ms')::bigint-(ref->>'start_ms')::bigint<=120000,'RESULT_INVALID');ordinal:=ordinal+1;
  end loop;
  for ref in select value from jsonb_array_elements(p_payload->'sampled_frames') loop
   perform eps.specs_stage_assert(exists(select 1 from eps.media_assets a where a.id::text=ref->>'frame_asset_id' and a.purpose='candidate_frame' and a.status='ready'
    and a.source_asset_id=source.id and a.producing_job_id=p_job.id and a.producing_attempt_id=p_job.current_attempt_id and a.output_stage='prepare_candidate'
    and a.sha256=ref->>'sha256' and a.source_timestamp_ms::text=ref->>'timestamp_ms' and a.width::text=ref->>'width' and a.height::text=ref->>'height'
    and a.source_timestamp_ms<duration) and ref->>'source_asset_id'=source.id::text and jsonb_typeof(ref->'quality')='object'
    and ref#>>'{quality,difference_hash}'~'^[a-f0-9]{16}$' and jsonb_typeof(ref#>'{quality,luminance}')='number'
    and jsonb_typeof(ref#>'{quality,contrast}')='number' and jsonb_typeof(ref#>'{quality,sharpness}')='number','RESULT_INVALID');
  end loop;
  perform eps.specs_stage_assert((select count(*)=count(distinct value->>'frame_asset_id') from jsonb_array_elements(p_payload->'sampled_frames')),'RESULT_INVALID');
  if source.status='ready' then perform eps.specs_stage_assert(source.sha256=p_payload->>'source_sha256' and source.duration_ms=duration and source.width=(item->>'width')::integer and source.height=(item->>'height')::integer,'RESULT_INVALID');
  else update eps.media_assets set status='ready',sha256=p_payload->>'source_sha256',width=(item->>'width')::integer,height=(item->>'height')::integer,duration_ms=duration where id=source.id and status='uploading';perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');end if;
 elsif p_job.stage='transcribe_candidate' then
  perform eps.specs_stage_assert(p_schema='candidate-transcript-stage.v1' and eps.specs_stage_shape(p_payload,
   array['source_asset_id','transcript_asset','original_transcript','languages','segment_count','timestamp_precision','missing_transcript_reason','provider_error_code','provider_metadata'],
   array['source_asset_id','transcript_asset','original_transcript','languages','segment_count','timestamp_precision','missing_transcript_reason','provider_metadata'])
   and p_payload->>'timestamp_precision'='chunk' and eps.specs_stage_strings(p_payload->'languages') and jsonb_array_length(p_payload->'languages')<=100
   and eps.specs_stage_integer(p_payload->'segment_count',0,1000) and jsonb_typeof(p_payload->'provider_metadata')='array' and jsonb_array_length(p_payload->'provider_metadata')<=16,'RESULT_INVALID');
  select * into strict prepared from eps.candidate_stage_payloads where job_id=p_job.id and input_hash=p_job.input_hash and stage='prepare_candidate';
  if p_payload->'original_transcript'='null' then
   perform eps.specs_stage_assert(p_payload->'transcript_asset'='null' and p_payload->'languages'='[]' and p_payload->>'segment_count'='0'
    and p_payload->>'missing_transcript_reason' in('NO_INTELLIGIBLE_AUDIO','TRANSCRIPTION_FAILED')
    and (not(p_payload?'provider_error_code') or p_payload->>'provider_error_code' in('TRANSCRIPTION_EMPTY','TRANSCRIPTION_RESULT_INVALID','OPENAI_ACCESS_DENIED','OPENAI_QUOTA_EXCEEDED','OPENAI_RATE_LIMITED','OPENAI_TIMEOUT','OPENAI_UNAVAILABLE','OPENAI_REQUEST_REJECTED'))
    and (not(coalesce(p_payload->>'provider_error_code','') in('OPENAI_RATE_LIMITED','OPENAI_TIMEOUT','OPENAI_UNAVAILABLE')) or coalesce((p_job.stage_attempts->>'transcribe_candidate')::integer,0)>=3),'RESULT_INVALID');
  else
   ref:=p_payload->'original_transcript';perform eps.specs_stage_assert(eps.specs_stage_shape(ref,array['source_asset_id','segments','original_text','languages','timestamp_precision'])
    and ref->>'source_asset_id'=source.id::text and ref->>'timestamp_precision'='chunk' and jsonb_typeof(ref->'original_text')='string'
    and length(ref->>'original_text') between 1 and 200000 and ref->'languages'=p_payload->'languages' and jsonb_typeof(ref->'segments')='array'
    and jsonb_array_length(ref->'segments')=(p_payload->>'segment_count')::integer and (p_payload->>'segment_count')::integer between 1 and 1000
    and p_payload->'missing_transcript_reason'='null' and eps.candidate_stage_asset_reference(p_payload->'transcript_asset',p_job,'transcript',p_job.current_attempt_id),'RESULT_INVALID');
   ordinal:=0;for item in select value from jsonb_array_elements(ref->'segments') loop
    perform eps.specs_stage_assert(eps.specs_stage_shape(item,array['index','start_ms','end_ms','text']) and item->>'index'=ordinal::text
     and eps.specs_stage_integer(item->'start_ms',0,source.duration_ms) and eps.specs_stage_integer(item->'end_ms',1,source.duration_ms)
     and (item->>'end_ms')::bigint>(item->>'start_ms')::bigint and jsonb_typeof(item->'text')='string' and length(btrim(item->>'text')) between 1 and 200000
     and exists(select 1 from jsonb_array_elements(prepared.payload->'audio_chunks') chunk where chunk->'start_ms'=item->'start_ms' and chunk->'end_ms'=item->'end_ms'),'RESULT_INVALID');ordinal:=ordinal+1;
   end loop;
  end if;
 elsif p_job.stage='extract_candidate' then
  perform eps.specs_stage_assert(p_schema='candidate-extraction-stage.v1' and eps.specs_stage_shape(p_payload,array['source_asset_id','result','metadata','manual_profile_required','provider_metadata','missing_extraction_reason','provider_error_code'],array['source_asset_id','result']),'RESULT_INVALID');
  select * into strict transcribed from eps.candidate_stage_payloads where job_id=p_job.id and input_hash=p_job.input_hash and stage='transcribe_candidate';
  if p_payload->'result'='null' then perform eps.specs_stage_assert(p_payload->'manual_profile_required'='true'
   and (transcribed.payload->'original_transcript'='null' or p_payload->>'missing_extraction_reason'='CANDIDATE_EXTRACTION_FAILED'
    and p_payload->>'provider_error_code' in('OPENAI_ACCESS_DENIED','OPENAI_QUOTA_EXCEEDED','OPENAI_RATE_LIMITED','OPENAI_TIMEOUT','OPENAI_UNAVAILABLE','OPENAI_REQUEST_REJECTED',
     'AI_REFUSAL','AI_RESULT_INVALID','AI_EVIDENCE_INVALID','AI_EVIDENCE_MISSING','AI_SOURCE_MISMATCH','AI_RESPONSE_INVALID','AI_RESPONSE_NOT_COMPLETE','AI_OUTPUT_UNEXPECTED'))
   and (not(coalesce(p_payload->>'provider_error_code','') in('OPENAI_RATE_LIMITED','OPENAI_TIMEOUT','OPENAI_UNAVAILABLE')) or coalesce((p_job.stage_attempts->>'extract_candidate')::integer,0)>=3),'RESULT_INVALID');
  else
   item:=p_payload->'result';perform eps.specs_stage_assert(eps.specs_stage_shape(item,array['schema_version','source_asset_id','facts','project_availability_statement','evidence','uncertainties'])
    and item->>'schema_version'='1.0' and item->>'source_asset_id'=source.id::text and jsonb_typeof(item->'evidence')='array' and jsonb_array_length(item->'evidence')<=1000
    and jsonb_typeof(item->'uncertainties')='array' and jsonb_array_length(item->'uncertainties')<=1000,'RESULT_INVALID');
   perform eps.cast_facts(item->'facts');
   -- Final apply independently verifies every field/quote against original segments.
   metadata:=p_payload->'metadata';perform eps.specs_stage_assert(metadata->>'provider'='openai' and metadata->>'sdk_version'='7.45.1'
    and metadata->>'requested_model'=p_job.input#>>'{configuration,extraction_model}' and metadata->>'input_sha256'=p_job.input_hash,'RESULT_INVALID');
  end if;
 elsif p_job.stage='select_frames' then
  perform eps.specs_stage_assert(p_schema='frame-selection-stage.v1' and eps.specs_stage_shape(p_payload,array['schema_version','source_asset_id','selected_frames','insufficient_frames_reason'])
   and p_payload->>'schema_version'='1.0' and jsonb_typeof(p_payload->'selected_frames')='array' and jsonb_array_length(p_payload->'selected_frames')<=3
   and (jsonb_array_length(p_payload->'selected_frames')=3 or length(btrim(p_payload->>'insufficient_frames_reason'))>0),'RESULT_INVALID');
  select * into strict prepared from eps.candidate_stage_payloads where job_id=p_job.id and input_hash=p_job.input_hash and stage='prepare_candidate';
  for ref in select value from jsonb_array_elements(p_payload->'selected_frames') loop
   perform eps.specs_stage_assert(eps.specs_stage_shape(ref,array['frame_asset_id','reason']) and length(btrim(ref->>'reason')) between 1 and 2000
    and exists(select 1 from jsonb_array_elements(prepared.payload->'sampled_frames') frame where frame->>'frame_asset_id'=ref->>'frame_asset_id'),'RESULT_INVALID');
  end loop;
  perform eps.specs_stage_assert((select count(*)=count(distinct value->>'frame_asset_id') from jsonb_array_elements(p_payload->'selected_frames')),'RESULT_INVALID');
 else perform eps.specs_stage_assert(p_schema='candidate-application.v1' and eps.specs_stage_shape(p_payload,array['source_asset_id']),'RESULT_INVALID');end if;
end $$;

create function eps.record_candidate_job_event(p_event jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;previous eps.job_events;event_receipt jsonb;digest_value text;event_attempt uuid;event_sequence bigint;at_value timestamptz;
 safe_error jsonb;attempts integer;payload_id uuid;next_stage text;application jsonb;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_event,array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash','result_schema','result','error'],array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash'])
  and octet_length(p_event::text)<=409600 and p_event->>'stage' in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate')
  and p_event->>'event_type' in('heartbeat','progress','succeeded','failed') and eps.specs_stage_integer(p_event->'sequence',1)
  and length(p_event->>'event_id') between 1 and 200 and p_event->>'lease_token'~'^[a-f0-9]{64}$' and p_event->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.candidate_stage_lock((p_event->>'job_id')::uuid);event_attempt:=(p_event->>'attempt_id')::uuid;event_sequence:=(p_event->>'sequence')::bigint;at_value:=clock_timestamp();
 digest_value:=encode(sha256(convert_to(p_event::text,'UTF8')),'hex');
 select * into previous from eps.job_events where job_id=job.id and attempt_id=event_attempt and event_id=p_event->>'event_id';
 if found then perform eps.specs_stage_assert(previous.payload_digest=digest_value,'EVENT_ID_CONFLICT');return previous.receipt||'{"duplicate":true,"applied":false}'::jsonb;end if;
 perform eps.specs_stage_assert(not exists(select 1 from eps.job_events where job_id=job.id and attempt_id=event_attempt and sequence=event_sequence),'EVENT_SEQUENCE_CONFLICT');
 event_receipt:=jsonb_build_object('event_id',p_event->>'event_id','applied',false,'duplicate',false,'stale',false,'job_status',job.status);
 if job.status<>'running' or job.cancel_requested_at is not null or job.current_attempt_id<>event_attempt or job.stage<>p_event->>'stage' or job.lease_expires_at<=at_value then return event_receipt||'{"stale":true}'::jsonb;end if;
 perform eps.specs_stage_assert(job.lease_token_digest=encode(sha256(convert_to(p_event->>'lease_token','UTF8')),'hex'),'LEASE_INVALID');
 perform eps.specs_stage_assert(job.input_hash=p_event->>'input_hash','INPUT_HASH_MISMATCH');
 if event_sequence<=job.last_event_sequence then return event_receipt||'{"stale":true}'::jsonb;end if;
 if not eps.candidate_stage_source_matches(job) then job.status:='waiting_for_input';safe_error:=eps.specs_stage_error('INPUT_CHANGED');
 elsif p_event->>'event_type'='heartbeat' then
  perform eps.specs_stage_assert(not(p_event?'result') and not(p_event?'result_schema') and coalesce(p_event->'error','null')='null');
  job.heartbeat_at:=at_value;job.lease_expires_at:=at_value+interval '90 seconds';
 elsif p_event->>'event_type'='progress' then
  perform eps.specs_stage_assert(eps.specs_stage_shape(p_event->'result',array['progress_completed','progress_total'])
   and eps.specs_stage_integer(p_event#>'{result,progress_completed}',job.progress_completed) and (p_event#>'{result,progress_total}'='null' or eps.specs_stage_integer(p_event#>'{result,progress_total}',(p_event#>>'{result,progress_completed}')::bigint)),'INVALID_PROGRESS');
  job.progress_completed:=(p_event#>>'{result,progress_completed}')::bigint;job.progress_total:=(p_event#>>'{result,progress_total}')::bigint;
 elsif p_event->>'event_type'='failed' then
  perform eps.specs_stage_assert(not(p_event?'result') and eps.specs_stage_shape(p_event->'error',array['code','message','details','retryable'])
   and jsonb_typeof(p_event#>'{error,code}')='string' and length(p_event#>>'{error,code}') between 1 and 200
   and jsonb_typeof(p_event#>'{error,message}')='string' and length(p_event#>>'{error,message}') between 1 and 2000
   and jsonb_typeof(p_event#>'{error,details}')='object' and octet_length((p_event#>'{error,details}')::text)<=16384
   and jsonb_typeof(p_event#>'{error,retryable}')='boolean');
  safe_error:=eps.specs_stage_error(p_event#>>'{error,code}',(p_event#>>'{error,retryable}')::boolean,p_event#>'{error,details,retry_after_seconds}');
 else
  begin
   perform eps.candidate_validate_stage(job,p_event->>'result_schema',p_event->'result');
   if job.stage='apply_candidate' then application:=eps.apply_candidate_scan(job.id,event_attempt,p_event->>'lease_token',job.input_hash,p_event->'result');end if;
   insert into eps.candidate_stage_payloads(workspace_id,job_id,stage,attempt_id,input_hash,result_schema,payload)
    values(job.workspace_id,job.id,job.stage,event_attempt,job.input_hash,p_event->>'result_schema',p_event->'result') returning id into payload_id;
  exception when raise_exception then
   if sqlerrm in('RESULT_INVALID','INVALID_REQUEST','CANDIDATE_SCAN_INVALID') then safe_error:=eps.specs_stage_error('RESULT_INVALID');
   elsif sqlerrm in('INPUT_CHANGED','STALE_RESOURCE_VERSION') then job.status:='waiting_for_input';safe_error:=eps.specs_stage_error('INPUT_CHANGED');else raise;end if;
  end;
  if safe_error is null then
   job.completed_stages:=job.completed_stages||jsonb_build_array(jsonb_build_object('stage',job.stage,'attempt_id',event_attempt,'input_hash',job.input_hash,
    'result_schema',p_event->>'result_schema','result',jsonb_build_object('stage_output_id',payload_id),'completed_at',at_value));
   next_stage:=case job.stage when 'prepare_candidate' then 'transcribe_candidate' when 'transcribe_candidate' then 'extract_candidate' when 'extract_candidate' then 'select_frames' when 'select_frames' then 'apply_candidate' else null end;
   if next_stage is null then job.status:='succeeded';job.result:=application;
   else job.status:='queued';job.stage:=next_stage;job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value;job.progress_completed:=0;job.progress_total:=null;end if;
   job.lease_token_digest:=null;job.lease_expires_at:=null;
  end if;
 end if;
 if safe_error is not null then
  job.error:=safe_error;job.lease_token_digest:=null;job.lease_expires_at:=null;
  if job.status<>'waiting_for_input' then
   attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);
   if safe_error->'retryable'='true' and attempts<3 then job.status:='queued';job.dispatch_generation:=job.dispatch_generation+1;
    job.available_at:=at_value+make_interval(secs=>least(300,2*power(2,greatest(attempts-1,0)))::double precision);
   else job.status:='failed';end if;
  end if;
 end if;
 update eps.jobs set status=job.status,stage=job.stage,completed_stages=job.completed_stages,result=job.result,error=job.error,
  last_event_sequence=event_sequence,heartbeat_at=job.heartbeat_at,lease_expires_at=job.lease_expires_at,lease_token_digest=job.lease_token_digest,
  available_at=job.available_at,dispatch_generation=job.dispatch_generation,progress_completed=job.progress_completed,progress_total=job.progress_total,row_version=row_version+1,updated_at=at_value where id=job.id;
 if job.status='queued' then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)
  values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;
 event_receipt:=event_receipt||jsonb_build_object('applied',true,'job_status',job.status);
 insert into eps.job_events(job_id,attempt_id,event_id,sequence,stage,event_type,payload_digest,receipt)
  values(job.id,event_attempt,p_event->>'event_id',event_sequence,p_event->>'stage',p_event->>'event_type',digest_value,event_receipt);
 return event_receipt;
end $$;


-- Exact reviewed fragment: development/m03/candidate-kernel-assets.sql
-- Narrow candidate exact-object grants and immutable derivative operations.
grant select on eps.jobs,eps.media_assets to eps_candidate_assets_owner;
grant insert(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status,source_asset_id,producing_job_id,producing_attempt_id,output_stage,output_key,source_timestamp_ms) on eps.media_assets to eps_candidate_assets_owner;
grant update(status,sha256,width,height,duration_ms) on eps.media_assets to eps_candidate_assets_owner;
grant execute on function eps.input_uuid(text),eps.logo_integer(jsonb,bigint,bigint),eps.fail(text,text,integer,bigint),eps.specs_stage_assert(boolean,text),eps.specs_stage_shape(jsonb,text[],text[]) to eps_candidate_assets_owner;
create policy candidate_asset_job_read on eps.jobs for select to eps_candidate_assets_owner using(kind='candidate_scan');
create policy candidate_asset_service_read on eps.media_assets for select to eps_candidate_assets_owner using(purpose in('candidate_video','audio','transcript','candidate_frame'));
create policy candidate_asset_service_insert on eps.media_assets for insert to eps_candidate_assets_owner with check(purpose in('audio','transcript','candidate_frame') and status='uploading'
 and bucket='eps-candidate-outputs' and sha256 is null and eps.candidate_stage_live(producing_job_id,producing_attempt_id,(select j.input_hash from eps.jobs j where j.id=producing_job_id)));
create policy candidate_asset_service_complete on eps.media_assets for update to eps_candidate_assets_owner using(purpose in('audio','transcript','candidate_frame') and status='uploading'
 and eps.candidate_stage_live(producing_job_id,producing_attempt_id,(select j.input_hash from eps.jobs j where j.id=producing_job_id))) with check(status='ready' and sha256 is not null);

create function eps.candidate_prior_asset(p_job eps.jobs,p_asset eps.media_assets) returns boolean language sql volatile security invoker set search_path='' as $$
 select exists(select 1 from eps.candidate_stage_payloads p where p.job_id=p_job.id and p.input_hash=p_job.input_hash and p.attempt_id=p_asset.producing_attempt_id and p.stage=p_asset.output_stage
  and exists(select 1 from jsonb_array_elements(p_job.completed_stages) completed where completed#>>'{result,stage_output_id}'=p.id::text and completed->>'attempt_id'=p.attempt_id::text)
  and (p.payload#>>'{transcript_asset,asset_id}'=p_asset.id::text
   or exists(select 1 from jsonb_array_elements(coalesce(p.payload->'audio_chunks','[]')) item where item->>'asset_id'=p_asset.id::text)
   or exists(select 1 from jsonb_array_elements(coalesce(p.payload->'sampled_frames','[]')) item where item->>'frame_asset_id'=p_asset.id::text)))
$$;
create function eps.get_candidate_asset_access(p_input jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;asset eps.media_assets;permission text;token_value text;at_value timestamptz;expiry timestamptz;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','asset_id','access'],array['job_id','attempt_id','lease_token','asset_id']));
 job:=eps.candidate_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 permission:=coalesce(p_input->>'access','read');perform eps.specs_stage_assert(permission in('read','write'));
 select * into asset from eps.media_assets a where a.id=eps.input_uuid(p_input->>'asset_id') and a.origin_workspace_id=job.workspace_id;
 if not found or not(permission='read' and asset.id=job.input_asset_id and asset.purpose='candidate_video'
  and (asset.status='ready' or asset.status='uploading' and job.stage='prepare_candidate')
  or asset.source_asset_id=job.input_asset_id and asset.producing_job_id=job.id and asset.purpose in('audio','transcript','candidate_frame')
   and (asset.producing_attempt_id=job.current_attempt_id and asset.output_stage=job.stage and asset.status in('uploading','ready') and (permission='read' or asset.status='uploading')
    or permission='read' and asset.status='ready' and eps.candidate_prior_asset(job,asset)))
 then perform eps.fail('RESOURCE_NOT_FOUND','Asset not available to this candidate stage.',404);end if;
 at_value:=clock_timestamp();expiry:=least(job.lease_expires_at,at_value+interval '60 seconds');perform eps.specs_stage_assert(expiry>at_value,'STALE_STAGE_LEASE');
 token_value:=rtrim(translate(replace(encode(extensions.gen_random_bytes(32),'base64'),E'\n',''),'+/','-_'),'=');
 insert into eps.candidate_asset_grants(token_digest,job_id,attempt_id,input_hash,asset_id,bucket,object_key,permission,created_at,expires_at)
 values(encode(sha256(convert_to(token_value,'UTF8')),'hex'),job.id,job.current_attempt_id,job.input_hash,asset.id,asset.bucket,asset.object_key,permission,at_value,expiry);
 return jsonb_build_object('asset_id',asset.id,'bucket',asset.bucket,'object_key',asset.object_key,'permission',permission,'grant_token',token_value,'expires_at',expiry,'mime_type',asset.mime_type,'size_bytes',asset.size_bytes,'sha256',asset.sha256);
end $$;
create function eps.reserve_candidate_job_output(p_input jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;existing eps.media_assets;asset_id_value uuid:=gen_random_uuid();expected_size bigint;kind text;key_value text;mime text;extension text;timestamp_value bigint;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','output_key','asset_kind','filename','mime_type','expected_size_bytes','parent_asset_id','time_offset_ms']));
 job:=eps.candidate_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 kind:=p_input->>'asset_kind';key_value:=p_input->>'output_key';mime:=p_input->>'mime_type';
 perform eps.specs_stage_assert(p_input->>'parent_asset_id'=job.input_asset_id::text and jsonb_typeof(p_input->'filename')='string' and length(p_input->>'filename') between 1 and 255 and p_input->>'filename'!~E'[/\\[:cntrl:]]');
 if kind='audio' then perform eps.specs_stage_assert(job.stage='prepare_candidate' and key_value~'^audio_([0-9]|1[0-5])$' and mime='audio/mpeg' and p_input->'time_offset_ms'='null');extension:='mp3';
 elsif kind='candidate_frame' then perform eps.specs_stage_assert(job.stage='prepare_candidate' and key_value~'^frame_([0-9]|1[01])$' and mime='image/jpeg');
  timestamp_value:=eps.logo_integer(p_input->'time_offset_ms',0,1800000);extension:='jpg';
 elsif kind='transcript' then perform eps.specs_stage_assert(job.stage='transcribe_candidate' and key_value='transcript' and mime='application/json' and p_input->'time_offset_ms'='null');extension:='json';
 else perform eps.fail('INVALID_REQUEST','Unsupported candidate output purpose.',400);end if;
 expected_size:=eps.logo_integer(p_input->'expected_size_bytes',1,case when kind='transcript' then 2097152 else 20971520 end);
 select * into existing from eps.media_assets where producing_job_id=job.id and producing_attempt_id=job.current_attempt_id and output_key=key_value;
 if found then
  if existing.purpose<>kind or existing.size_bytes<>expected_size or existing.mime_type<>mime or existing.filename<>p_input->>'filename'
   or existing.source_asset_id<>job.input_asset_id or existing.output_stage<>job.stage or existing.source_timestamp_ms is distinct from timestamp_value
  then perform eps.fail('IDEMPOTENCY_KEY_REUSED','Logical candidate output metadata changed.',409);end if;
 else
  insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status,source_asset_id,producing_job_id,producing_attempt_id,output_stage,output_key,source_timestamp_ms)
  values(asset_id_value,job.workspace_id,kind,p_input->>'filename',mime,'eps-candidate-outputs','jobs/'||job.id||'/attempts/'||job.current_attempt_id||'/'||asset_id_value||'.'||extension,
   expected_size,'uploading',job.input_asset_id,job.id,job.current_attempt_id,job.stage,key_value,timestamp_value) returning * into existing;
 end if;
 return jsonb_build_object('asset',eps.candidate_asset_dto(existing),'bucket',existing.bucket,'object_key',existing.object_key);
end $$;
create function eps.complete_candidate_job_output(p_input jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;asset eps.media_assets;w integer;h integer;duration bigint;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','asset_id','sha256','actual_size_bytes','width','height','duration_ms']));
 job:=eps.candidate_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 -- The current parent job lock serializes all completion attempts. Read a Ready
 -- replay before taking an UPDATE row policy restricted to uploading outputs.
 select * into asset from eps.media_assets a where a.id=eps.input_uuid(p_input->>'asset_id') and a.producing_job_id=job.id and a.producing_attempt_id=job.current_attempt_id and a.output_stage=job.stage;
 if not found or asset.purpose not in('audio','transcript','candidate_frame') or asset.source_asset_id<>job.input_asset_id then perform eps.fail('RESOURCE_NOT_FOUND','Candidate output not in active attempt.',404);end if;
 perform eps.specs_stage_assert(p_input->>'sha256'~'^[a-f0-9]{64}$' and eps.logo_integer(p_input->'actual_size_bytes',1,20971520)=asset.size_bytes);
 if asset.purpose='candidate_frame' then w:=eps.logo_integer(p_input->'width',1,4096);h:=eps.logo_integer(p_input->'height',1,4096);perform eps.specs_stage_assert(p_input->'duration_ms'='null');
 else perform eps.specs_stage_assert(p_input->'width'='null' and p_input->'height'='null');
  if asset.purpose='audio' and p_input->'duration_ms'<>'null' then duration:=eps.logo_integer(p_input->'duration_ms',1,120000);else perform eps.specs_stage_assert(p_input->'duration_ms'='null');end if;
 end if;
 if asset.status='ready' then
  if asset.sha256 is distinct from p_input->>'sha256' or asset.width is distinct from w or asset.height is distinct from h or asset.duration_ms is distinct from duration
  then perform eps.fail('IDEMPOTENCY_KEY_REUSED','Candidate output was completed with different verified bytes.',409);end if;
 else
  perform eps.specs_stage_assert(asset.status='uploading','INVALID_TRANSITION');
  update eps.media_assets set status='ready',sha256=p_input->>'sha256',width=w,height=h,duration_ms=duration where id=asset.id returning * into asset;
 end if;
 return eps.candidate_asset_dto(asset);
end $$;
create function eps.candidate_capability_allowed(p_bucket text,p_key text,p_permission text) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare headers jsonb;token_value text;begin
 if p_bucket not in('eps-candidate-assets','eps-candidate-outputs') or p_permission not in('read','write') then return false;end if;
 begin headers:=nullif(current_setting('request.headers',true),'')::jsonb;exception when others then return false;end;
 token_value:=headers->>'x-eps-asset-grant';if jsonb_typeof(headers)<>'object' or token_value is null or token_value!~'^[A-Za-z0-9_-]{43}$' then return false;end if;
 return exists(select 1 from eps.candidate_asset_grants g join eps.media_assets a on a.id=g.asset_id join eps.jobs j on j.id=g.job_id
  where g.token_digest=encode(sha256(convert_to(token_value,'UTF8')),'hex') and g.bucket=p_bucket and g.object_key=p_key and g.permission=p_permission
   and g.expires_at>clock_timestamp() and g.revoked_at is null and a.bucket=p_bucket and a.object_key=p_key and a.origin_workspace_id=j.workspace_id
   and eps.candidate_stage_live(j.id,g.attempt_id,g.input_hash)
   and (p_permission='read' and (a.id=j.input_asset_id and a.purpose='candidate_video' and (a.status='ready' or a.status='uploading' and j.stage='prepare_candidate')
     or a.source_asset_id=j.input_asset_id and a.producing_job_id=j.id and a.status in('uploading','ready') and (a.producing_attempt_id=j.current_attempt_id and a.output_stage=j.stage or a.status='ready' and eps.candidate_prior_asset(j,a)))
    or p_permission='write' and p_bucket='eps-candidate-outputs' and a.status='uploading' and a.source_asset_id=j.input_asset_id and a.producing_job_id=j.id
     and a.producing_attempt_id=j.current_attempt_id and a.output_stage=j.stage and headers->>'x-upsert'='false' and headers->>'content-type'=a.mime_type));
end $$;
grant create on schema eps to eps_candidate_assets_owner;
do $$declare routine regprocedure;begin
 foreach routine in array array['eps.candidate_prior_asset(eps.jobs,eps.media_assets)'::regprocedure,'eps.get_candidate_asset_access(jsonb)'::regprocedure,
 'eps.reserve_candidate_job_output(jsonb)'::regprocedure,'eps.complete_candidate_job_output(jsonb)'::regprocedure,'eps.candidate_capability_allowed(text,text,text)'::regprocedure] loop
  execute format('alter function %s owner to eps_candidate_assets_owner',routine);execute format('revoke all on function %s from public,anon,authenticated,service_role',routine);
 end loop;
end $$;
revoke create on schema eps from eps_candidate_assets_owner;
grant execute on function eps.get_candidate_asset_access(jsonb),eps.reserve_candidate_job_output(jsonb),eps.complete_candidate_job_output(jsonb) to eps_specs_assets_owner;
grant execute on function eps.candidate_capability_allowed(text,text,text) to anon,authenticated;


-- Exact reviewed fragment: development/m03/candidate-kernel-dispatch.sql
-- Private recovery plus guarded feature dispatch into the existing narrow port.
create function eps.recover_candidate_job_stages(p_limit integer) returns integer language plpgsql volatile security definer set search_path='' as $$
declare candidate record;job eps.jobs;recovered integer:=0;locked uuid;at_value timestamptz;obsolete boolean;attempts integer;begin
 perform eps.specs_stage_assert(p_limit between 0 and 100);if p_limit=0 then return 0;end if;
 for candidate in select j.id,j.workspace_id from eps.jobs j where j.kind='candidate_scan' and j.status in('queued','running')
  and (j.status='running' and j.lease_expires_at<=clock_timestamp() or not eps.candidate_stage_can_write(j.requested_by,j.workspace_id) or not eps.candidate_stage_source_matches(j))
  order by j.lease_expires_at nulls last,j.id limit 1000 loop
  exit when recovered>=p_limit;
  select id into locked from eps.workspaces where id=candidate.workspace_id for update skip locked;if not found then continue;end if;
  job:=eps.candidate_stage_lock(candidate.id,false);at_value:=clock_timestamp();if job.status not in('queued','running') then continue;end if;
  obsolete:=not eps.candidate_stage_can_write(job.requested_by,job.workspace_id) or not eps.candidate_stage_source_matches(job);
  if not obsolete and (job.status='queued' or job.lease_expires_at>at_value) then continue;end if;
  attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);
  if obsolete then job.status:='waiting_for_input';job.error:=eps.specs_stage_error('INPUT_CHANGED');
  elsif attempts>=3 then job.status:='failed';job.error:=jsonb_build_object('code','RETRY_EXHAUSTED','message','Candidate stage retry budget exhausted. Existing media and edits were retained.','details','{}'::jsonb,'retryable',false);
  else job.status:='queued';job.error:=eps.specs_stage_error('LEASE_EXPIRED');job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval '2 seconds';end if;
  update eps.jobs set status=job.status,error=job.error,lease_token_digest=null,lease_expires_at=null,available_at=job.available_at,dispatch_generation=job.dispatch_generation,row_version=row_version+1,updated_at=at_value where id=job.id;
  if job.status='queued' then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at) values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;
  recovered:=recovered+1;
 end loop;return recovered;
end $$;
grant create on schema eps to eps_candidate_stage_owner;
do $$declare routine regprocedure;begin
 foreach routine in array array['eps.candidate_stage_asset_reference(jsonb,eps.jobs,text,uuid)'::regprocedure,'eps.candidate_validate_stage(eps.jobs,text,jsonb)'::regprocedure,
 'eps.record_candidate_job_event(jsonb)'::regprocedure,'eps.recover_candidate_job_stages(integer)'::regprocedure] loop
  execute format('alter function %s owner to eps_candidate_stage_owner',routine);execute format('revoke all on function %s from public,anon,authenticated,service_role',routine);
 end loop;
end $$;
revoke create on schema eps from eps_candidate_stage_owner;
grant execute on function eps.record_candidate_job_event(jsonb),eps.recover_candidate_job_stages(integer) to eps_specs_stage_owner;

-- Preserve each proven specs implementation byte-for-byte except a closed
-- dispatch branch. Hash checks stop on any unexpected preceding implementation.
-- No new service EXECUTE grants or arbitrary kind/handler selection is added.
do $dispatch$
declare item record;source text;definition text;replacement text;begin
 for item in select * from (values
  ('eps.claim_job_stage(jsonb)','213bb7a05f3e0b60f8a1564cc2ccebf156c11d2fd776b17a4ece2a25e4b4c7ad',
   E'begin\n',E'begin\n if p_input->>''stage'' in(''prepare_candidate'',''transcribe_candidate'',''extract_candidate'',''select_frames'',''apply_candidate'') then return eps.claim_candidate_job_stage(p_input);end if;\n'),
  ('eps.record_job_event(jsonb)','53c3d545c77e401adb898635085ec14376bc671f2810220277b5dda42729d0d4',
   E'begin\n',E'begin\n if p_event->>''stage'' in(''prepare_candidate'',''transcribe_candidate'',''extract_candidate'',''select_frames'',''apply_candidate'') then return eps.record_candidate_job_event(p_event);end if;\n'),
  ('eps.get_specs_stage_input(uuid,uuid,text)','564b721ccaa4be5d13bcc765f638beb8ea4ad32d34ebc11386b4a125432d0bab',
   E'begin\n',E'begin\n if eps.candidate_is_job(p_job_id) then return eps.get_candidate_stage_input(p_job_id,p_attempt_id,p_lease_token);end if;\n'),
  ('eps.recover_job_stages(integer)','305343413bcf218e162b716aae4b38c88942303b1c9aa7a5da295784c5af956d',
   'return jsonb_build_object(''recovered'',recovered);','return jsonb_build_object(''recovered'',recovered+eps.recover_candidate_job_stages(p_limit-recovered));'),
  ('eps.get_job_asset_access(jsonb)','f11b9381b0e95e923e66984e83d416c7070c0db4f4314034c0334176108ecfcc',
   E'begin\n',E'begin\n if eps.candidate_is_job(eps.input_uuid(p_input->>''job_id'')) then return eps.get_candidate_asset_access(p_input);end if;\n'),
  ('eps.reserve_job_output(jsonb)','e663c98955de501a5c7c0ada5fdaf0f5129f5096562adc4057bdf10339622a03',
   E'begin\n',E'begin\n if eps.candidate_is_job(eps.input_uuid(p_input->>''job_id'')) then return eps.reserve_candidate_job_output(p_input);end if;\n'),
  ('eps.complete_job_output(jsonb)','00a65070176dd0d284c62da2ccebd09acf966de520e5c3ee04ff1bfb38518fce',
   E'begin\n',E'begin\n if eps.candidate_is_job(eps.input_uuid(p_input->>''job_id'')) then return eps.complete_candidate_job_output(p_input);end if;\n')
 ) as changes(signature,old_hash,anchor,insert_value) loop
  select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>item.old_hash then raise exception 'REVIEWED_M02_DISPATCH_SOURCE_REQUIRED: %',item.signature;end if;
  if position(E'\r\n' in source)>0 then item.anchor:=replace(item.anchor,E'\n',E'\r\n');item.insert_value:=replace(item.insert_value,E'\n',E'\r\n');end if;
  if position(item.anchor in source)=0 then raise exception 'REVIEWED_M02_DISPATCH_ANCHOR_REQUIRED: %',item.signature;end if;
  -- Only replace the first top-level BEGIN; nested parser blocks retain source.
  if item.anchor in(E'begin\n',E'begin\r\n') then replacement:=overlay(source placing item.insert_value from position(item.anchor in source) for length(item.anchor));
  else replacement:=replace(source,item.anchor,item.insert_value);end if;
  definition:=replace(definition,source,replacement);execute definition;
 end loop;
 -- Durable claim replay uses the same private record/ciphertext and current
 -- identity; only the per-kind resource/source checks are dispatched.
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid='eps.claim_job_stage_replay(jsonb,text,text,text)'::regprocedure;
 if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>'e7ef7d1a6d2d83acb7d0c6520a8bf56ec5016ebf897adc85f033e1cef32eefe4' then raise exception 'REVIEWED_M02_REPLAY_SOURCE_REQUIRED';end if;
 replacement:=replace(source,'job:=eps.specs_stage_lock(old.job_id);','if eps.candidate_is_job(old.job_id) then job:=eps.candidate_stage_lock(old.job_id);else job:=eps.specs_stage_lock(old.job_id);end if;');
 replacement:=replace(replacement,'perform eps.specs_stage_configuration(job.input->''configuration'');','if job.kind=''specs_extract'' then perform eps.specs_stage_configuration(job.input->''configuration'');end if;');
 replacement:=replace(replacement,'eps.specs_stage_source_matches(job)','case when job.kind=''candidate_scan'' then eps.candidate_stage_source_matches(job) else eps.specs_stage_source_matches(job) end');
 if replacement=source then raise exception 'REPLAY_DISPATCH_ANCHORS_REQUIRED';end if;execute replace(definition,source,replacement);
end $dispatch$;
notify pgrst,'reload schema';


-- Exact reviewed fragment: development/m03/candidate-storage-policies.sql
-- Compose after candidate user helpers and service capability helper.
-- Exact operation, object, requester and current lease gates compose with all
-- existing policies; no bucket list/HEAD/update/delete authority is introduced.
create policy eps_candidate_service_read on storage.objects for select to anon using(
 bucket_id in('eps-candidate-assets','eps-candidate-outputs') and
 (storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info'))
 and eps.candidate_capability_allowed(bucket_id,name,'read'));
create policy eps_candidate_service_write on storage.objects for insert to anon with check(
 bucket_id='eps-candidate-outputs' and storage.allow_only_operation('object.upload') and eps.candidate_capability_allowed(bucket_id,name,'write'));
create policy eps_candidate_insert_guard on storage.objects as restrictive for insert to public with check(
 bucket_id not in('eps-candidate-assets','eps-candidate-outputs')
 or bucket_id='eps-candidate-assets' and (storage.allow_only_operation('object.upload') or storage.allow_only_operation('object.sign_upload_url')) and eps.candidate_storage_insert_allowed(bucket_id,name)
 or bucket_id='eps-candidate-outputs' and storage.allow_only_operation('object.upload') and eps.candidate_capability_allowed(bucket_id,name,'write'));
create policy eps_candidate_read_guard on storage.objects as restrictive for select to public using(
 bucket_id not in('eps-candidate-assets','eps-candidate-outputs')
 or (storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info'))
  and (eps.candidate_storage_read_allowed(bucket_id,name) or eps.candidate_capability_allowed(bucket_id,name,'read'))
 or storage.allow_only_operation('object.sign') and eps.candidate_storage_read_allowed(bucket_id,name));
create policy eps_candidate_update_guard on storage.objects as restrictive for update to public using(bucket_id not in('eps-candidate-assets','eps-candidate-outputs')) with check(bucket_id not in('eps-candidate-assets','eps-candidate-outputs'));
create policy eps_candidate_delete_guard on storage.objects as restrictive for delete to public using(bucket_id not in('eps-candidate-assets','eps-candidate-outputs'));
-- A restrictive policy may evaluate these predicates as anon even when its
-- authenticated branch is false; predicates explicitly reject null auth.uid.
grant execute on function eps.candidate_storage_insert_allowed(text,text),eps.candidate_storage_read_allowed(text,text) to anon;


-- Exact reviewed fragment: development/m03/candidate-library-lifecycle-forward.sql
-- M03 forward lifecycle fixes. Core15 remains immutable. Compose after kernel.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
alter table eps.candidate_media add column processing_issues text[] not null default '{}'
 check(cardinality(processing_issues)<=4 and processing_issues<@array['NO_AUDIO','TRANSCRIPTION_FAILED','EXTRACTION_FAILED','INSUFFICIENT_FRAMES']::text[]);
comment on column eps.candidate_media.processing_issues is 'Fixed safe technical outcome codes derived from private validated stage payloads, never raw provider errors or inferred personal facts.';
create or replace function eps.cast_media_dto(p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',media.id,'candidate_id',media.candidate_id,'source_asset_id',media.source_asset_id,'preview_asset_id',media.preview_asset_id,'transcript_asset_id',media.transcript_asset_id,'original_transcript',media.original_transcript,'languages',to_jsonb(media.languages),
 'available_frames',coalesce((select jsonb_agg(jsonb_build_object('asset_id',asset.id,'source_asset_id',asset.source_asset_id,'timestamp_ms',asset.source_timestamp_ms,'width',asset.width,'height',asset.height,'quality_flags',to_jsonb(frame.quality_flags)) order by asset.source_timestamp_ms,asset.id) from eps.candidate_media_frames frame join eps.media_assets asset on asset.id=frame.asset_id where frame.candidate_media_id=media.id and asset.status='ready'),'[]'::jsonb),
 'selected_frame_asset_ids',to_jsonb(media.selected_frame_asset_ids),'processing_issues',to_jsonb(media.processing_issues),'row_version',media.row_version) from eps.candidate_media media where media.id=p_id
$$;
create table eps.cast_operation_notes (
 principal_id uuid not null references auth.users(id) on delete restrict,
 operation text not null check(operation in('cast.archive_candidate','cast.remove_workspace_candidate')),
 key text not null check(length(key) between 16 and 200),resource_id uuid not null,
 reason text not null check(length(reason) between 1 and 10000),created_at timestamptz not null default clock_timestamp(),
 primary key(principal_id,operation,key)
);
create index cast_operation_notes_resource_idx on eps.cast_operation_notes(resource_id);
alter table eps.cast_operation_notes enable row level security;alter table eps.cast_operation_notes force row level security;
revoke all on eps.cast_operation_notes from public,anon,authenticated,service_role;
grant insert(principal_id,operation,key,resource_id,reason) on eps.cast_operation_notes to eps_cast_owner;
create policy cast_notes_insert on eps.cast_operation_notes for insert to eps_cast_owner with check(principal_id=auth.uid() and (
 operation='cast.archive_candidate' and eps.has_capability('cast.write') or operation='cast.remove_workspace_candidate' and eps.has_capability('workspaces.write')));
comment on table eps.cast_operation_notes is 'Private audit context for optional published ArchiveRequest.reason; not profile facts, feedback or a fact-conflict product.';

create or replace function public.eps_get_candidate(p_candidate_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 perform eps.require_capability('cast.read');select eps.cast_candidate_dto(id) into result from eps.candidates where id=p_candidate_id;
 if result is null then perform eps.fail('RESOURCE_NOT_FOUND','Library profile not found.',404);end if;return result;
end $$;
create or replace function public.eps_find_candidate_duplicates(p_candidate_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare candidate eps.candidates;begin
 perform eps.require_capability('cast.read');select * into candidate from eps.candidates where id=p_candidate_id;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Library profile not found.',404);end if;
 if candidate.archived_at is not null or candidate.merged_into_candidate_id is not null then return '[]'::jsonb;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('candidate_id',other.id,'display_name',other.facts->'name','match_reasons',case when lower(candidate.source_casting_id)=lower(other.casting_id) then jsonb_build_array('Same supplied casting ID; explicit identity choice required') else jsonb_build_array('Same supplied name; explicit identity choice required') end) order by other.id) from eps.candidates other where other.id<>candidate.id and other.archived_at is null and other.merged_into_candidate_id is null and (nullif(lower(candidate.facts->>'name'),'')=lower(other.facts->>'name') or lower(candidate.source_casting_id)=lower(other.casting_id))),'[]'::jsonb);
end $$;
create or replace function public.eps_get_candidate_media(p_candidate_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform eps.require_capability('cast.read');
 if not exists(select 1 from eps.candidates where id=p_candidate_id) then perform eps.fail('RESOURCE_NOT_FOUND','Library profile not found.',404);end if;
 return coalesce((select jsonb_agg(eps.cast_media_dto(id) order by created_at,id) from eps.candidate_media where candidate_id=p_candidate_id),'[]'::jsonb);
end $$;

create function eps.cast_archive_with_reason(p_kind text,p_id uuid,p_input jsonb,p_key text) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare source eps.candidates;pool eps.workspace_candidates;workspace uuid;payload jsonb;replay jsonb;result jsonb;operation text;note text;begin
 if p_kind not in('candidate','pool') then perform eps.fail('INVALID_REQUEST','Unknown archive operation.',400);end if;
 operation:=case when p_kind='candidate' then 'cast.archive_candidate' else 'cast.remove_workspace_candidate' end;
 perform eps.require_capability(case when p_kind='candidate' then 'cast.write' else 'workspaces.write' end);
 perform eps.check_input(p_input,array['row_version','reason']);
 if octet_length(p_input::text)>65536 or p_input?'reason' and not(jsonb_typeof(p_input->'reason')='string' or p_input->'reason'='null'::jsonb) or length(p_input->>'reason')>10000 then perform eps.fail('INVALID_REQUEST','Invalid bounded archive reason.',400);end if;
 if p_key is null or length(p_key) not between 16 and 200 then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','A stable Idempotency-Key is required.',400);end if;
 payload:=jsonb_build_object('id',p_id,'input',p_input);replay:=eps.idempotency_begin(operation,p_key,payload);
 perform eps.require_capability(case when p_kind='candidate' then 'cast.write' else 'workspaces.write' end);
 if p_kind='candidate' then
  perform eps.require_capability('cast.read');select * into source from eps.candidates where id=p_id for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Library profile not found.',404);end if;
  if replay is not null then return replay;end if;
  if source.archived_at is not null or source.merged_into_candidate_id is not null then perform eps.fail('INVALID_TRANSITION','Profile is already archived or linked.',409);end if;
  if eps.expected_version(p_input)<>source.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Candidate changed.',409,source.row_version);end if;
  update eps.candidates set archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp() where id=source.id;
 else
  select workspace_id into workspace from eps.workspace_candidates where id=p_id;
  if workspace is null or not eps.cast_workspace_scope(workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable project candidate not found.',404);end if;
  perform 1 from eps.workspaces where id=workspace for update;
  if not eps.cast_workspace_scope(workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable project not found.',404);end if;
  select * into pool from eps.workspace_candidates where id=p_id for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Project candidate not found.',404);end if;
  if replay is not null then return replay;end if;
  if pool.archived_at is not null then perform eps.fail('INVALID_TRANSITION','Project candidate already removed.',409);end if;
  if eps.expected_version(p_input)<>pool.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Project candidate changed.',409,pool.row_version);end if;
  if to_regclass('eps.assignments') is not null then perform eps.fail('ASSIGNMENT_RETIREMENT_UNAVAILABLE','Assignment archival must be integrated before project candidate removal.',503);end if;
  update eps.workspace_candidates set archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp() where id=pool.id;
  perform eps.cast_changed(workspace);
 end if;
 result:=eps.finish_mutation(operation,p_key,payload,jsonb_build_object('success',true,'affected_ids',jsonb_build_array(p_id)),p_id);
 note:=nullif(btrim(p_input->>'reason'),'');if note is not null then insert into eps.cast_operation_notes(principal_id,operation,key,resource_id,reason) values(auth.uid(),operation,p_key,p_id,note);end if;
 return result;
end $$;
create or replace function public.eps_archive_candidate(p_candidate_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language sql volatile security definer set search_path='' as $$ select eps.cast_archive_with_reason('candidate',p_candidate_id,p_input,p_idempotency_key) $$;
create or replace function public.eps_remove_workspace_candidate(p_workspace_candidate_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language sql volatile security definer set search_path='' as $$ select eps.cast_archive_with_reason('pool',p_workspace_candidate_id,p_input,p_idempotency_key) $$;

create function eps.cast_link_duplicate(p_id uuid,p_input jsonb,p_key text) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare source_row eps.candidates;target_row eps.candidates;target_id uuid;payload jsonb;replay jsonb;participation eps.workspace_candidates;workspace uuid;affected_workspaces uuid[];result jsonb;begin
 perform eps.require_capability('cast.write');perform eps.require_capability('cast.read');
 perform eps.check_input(p_input,array['row_version','action','existing_candidate_id','existing_candidate_row_version']);
 if p_input->>'action'='keep_new' then return eps.cast_mutate('resolve_candidate_duplicate',p_id,p_input,p_key);end if;
 if p_input->>'action' is distinct from 'link_existing' or octet_length(p_input::text)>65536 then perform eps.fail('INVALID_REQUEST','Choose an explicit identity resolution.',400);end if;
 target_id:=eps.input_uuid(p_input->>'existing_candidate_id');if target_id=p_id then perform eps.fail('INVALID_REQUEST','A profile cannot link to itself.',400);end if;
 if p_key is null or length(p_key) not between 16 and 200 then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','A stable Idempotency-Key is required.',400);end if;
 payload:=jsonb_build_object('id',p_id,'input',p_input);replay:=eps.idempotency_begin('cast.resolve_candidate_duplicate',p_key,payload);
 -- Consistent visible-workspace then identity order. Hidden project references
 -- cannot be rewritten by this acting user; their composite FKs remain a guard.
 for workspace in select distinct pool.workspace_id from eps.workspace_candidates pool where pool.candidate_id=p_id order by pool.workspace_id loop
  if not eps.cast_workspace_scope(workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable project participation not found.',404);end if;
  perform 1 from eps.workspaces where id=workspace for update;
 end loop;
 perform 1 from eps.candidates where id in(p_id,target_id) order by id for update;
 perform eps.require_capability('cast.write');perform eps.require_capability('cast.read');
 select * into source_row from eps.candidates where id=p_id;select * into target_row from eps.candidates where id=target_id and archived_at is null and merged_into_candidate_id is null;
 if source_row.id is null or target_row.id is null then perform eps.fail('RESOURCE_NOT_FOUND','Library profile not found.',404);end if;
 if replay is not null then return replay;end if;
 if source_row.archived_at is not null or source_row.merged_into_candidate_id is not null then perform eps.fail('INVALID_TRANSITION','Profile is already archived or linked.',409);end if;
 if eps.expected_version(p_input)<>source_row.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Provisional candidate changed.',409,source_row.row_version);end if;
 if eps.expected_version(p_input,'existing_candidate_row_version')<>target_row.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Existing candidate changed.',409,target_row.row_version);end if;
 if to_regclass('eps.assignments') is not null then perform eps.fail('ASSIGNMENT_RETIREMENT_UNAVAILABLE','Assignment identity transfer must be integrated before linking profiles.',503);end if;
 select coalesce(array_agg(distinct pool.workspace_id),'{}') into affected_workspaces from eps.workspace_candidates pool where pool.candidate_id=source_row.id;
 set constraints eps.cast_pool_media_fk deferred;
 -- Preserve the existing participation's choices. The provisional participation
 -- is archived when both already exist in one project; its ID/notes/media/history
 -- remain. Otherwise the same participation ID is re-keyed without choice edits.
 for participation in select * from eps.workspace_candidates pool where pool.candidate_id=source_row.id order by pool.workspace_id,pool.id for update loop
  if not eps.cast_workspace_scope(participation.workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable project participation not found.',404);end if;
  update eps.workspace_candidates pool set candidate_id=target_row.id,
   archived_at=case when participation.archived_at is null and exists(select 1 from eps.workspace_candidates existing where existing.workspace_id=participation.workspace_id and existing.candidate_id=target_row.id and existing.archived_at is null) then clock_timestamp() else participation.archived_at end,
   row_version=pool.row_version+1,updated_at=clock_timestamp() where pool.id=participation.id;
 end loop;
 update eps.candidate_media set candidate_id=target_row.id,row_version=row_version+1 where candidate_id=source_row.id;
 set constraints eps.cast_pool_media_fk immediate;
 for workspace in select value from unnest(affected_workspaces) value order by value loop
  -- Update only projects this acting user can edit, never a hidden pool row.
  if eps.cast_workspace_scope(workspace,true) then perform eps.cast_changed(workspace);end if;
 end loop;
 update eps.candidates set merged_into_candidate_id=target_row.id,duplicate_resolution='link_existing',archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp() where id=source_row.id;
 result:=eps.cast_candidate_dto(target_row.id);
 return eps.finish_mutation('cast.resolve_candidate_duplicate',p_key,payload,result,source_row.id);
end $$;
create or replace function public.eps_resolve_candidate_duplicate(p_candidate_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language sql volatile security definer set search_path='' as $$ select eps.cast_link_duplicate(p_candidate_id,p_input,p_idempotency_key) $$;
grant create on schema eps to eps_cast_owner;
alter function eps.cast_archive_with_reason(text,uuid,jsonb,text) owner to eps_cast_owner;
alter function eps.cast_link_duplicate(uuid,jsonb,text) owner to eps_cast_owner;
revoke create on schema eps from eps_cast_owner;
revoke all on function eps.cast_archive_with_reason(text,uuid,jsonb,text),eps.cast_link_duplicate(uuid,jsonb,text) from public,anon,authenticated,service_role;
