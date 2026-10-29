-- ROLLBACK REHEARSAL CANDIDATE ONLY. Never execute this file against cloud.
-- Root creates the additive migration only after reviewed local/Storage proofs.
set local lock_timeout='5s';
set local statement_timeout='60s';
do $candidate_guard$ begin
 if current_database()<>'postgres' or current_user<>'postgres'
  or current_setting('eps.specs_assets_rehearsal',true) is distinct from 'rollback-only-v1'
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030']::text[]
 then raise exception 'SPECS_ASSETS_OWNED_LOCAL10_ROLLBACK_REQUIRED'; end if;
end $candidate_guard$;

-- BEGIN CANONICAL SPECS ASSETS CORE
do $prerequisites$ begin
 if to_regclass('eps.specs_source_inputs') is null or to_regclass('storage.objects') is null
  or to_regprocedure('storage.allow_only_operation(text)') is null
  or to_regprocedure('eps.specs_stage_lock(uuid,boolean)') is null
  or to_regclass('eps.specs_asset_config') is not null or to_regclass('eps.specs_upload_sessions') is not null
  or to_regclass('eps.specs_asset_grants') is not null or to_regclass('eps.specs_file_preparations') is not null
  or exists(select 1 from pg_roles where rolname in('eps_specs_upload_owner','eps_specs_verify_owner','eps_specs_assets_owner','eps_specs_assets_executor'))
 then raise exception 'SPECS_ASSETS_EXACT10_EMPTY_NAMESPACE_REQUIRED'; end if;
end $prerequisites$;

create role eps_specs_upload_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
create role eps_specs_verify_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
create role eps_specs_assets_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
create role eps_specs_assets_executor nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_specs_upload_owner,eps_specs_verify_owner,eps_specs_assets_owner,eps_specs_assets_executor to postgres;
grant authenticated to eps_specs_upload_owner,eps_specs_verify_owner with inherit true,set false,admin false;
grant usage on schema eps,public to eps_specs_upload_owner,eps_specs_verify_owner,eps_specs_assets_owner;
grant usage on schema eps to eps_specs_assets_executor;
grant usage on schema extensions to eps_specs_verify_owner,eps_specs_assets_owner;
grant execute on function extensions.hmac(bytea,bytea,text) to eps_specs_verify_owner;
grant execute on function extensions.gen_random_bytes(integer) to eps_specs_assets_owner;

-- Preserve logo invariants while admitting explicitly typed document originals
-- and attempt-owned derivatives. No other media purpose is enabled here.
alter table eps.media_assets drop constraint media_assets_purpose_check;
alter table eps.media_assets drop constraint media_assets_mime_type_check;
alter table eps.media_assets drop constraint media_assets_size_bytes_check;
alter table eps.media_assets drop constraint media_assets_check1;
alter table eps.media_assets add column source_asset_id uuid references eps.media_assets(id) on delete restrict;
alter table eps.media_assets add column producing_job_id uuid references eps.jobs(id) on delete restrict;
alter table eps.media_assets add column producing_attempt_id uuid;
alter table eps.media_assets add column output_stage text;
alter table eps.media_assets add column output_key text;
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
 else false end) is true);
alter table eps.media_assets add constraint media_assets_retained_document_key unique(id,origin_workspace_id,sha256);
create unique index media_assets_attempt_output_key on eps.media_assets(producing_job_id,producing_attempt_id,output_key) where producing_job_id is not null;
create index media_assets_source_asset on eps.media_assets(source_asset_id) where source_asset_id is not null;

alter table eps.specs_source_inputs alter column source_text drop not null;
alter table eps.specs_source_inputs add column source_asset_id uuid;
alter table eps.specs_source_inputs add column source_mime_type text;
alter table eps.specs_source_inputs add column source_size_bytes bigint;
alter table eps.specs_source_inputs drop constraint specs_source_inputs_hash_check;
alter table eps.specs_source_inputs add constraint specs_source_inputs_kind_check check(((
 source_asset_id is null and source_text is not null and source_mime_type is null and source_size_bytes is null
 and source_hash=encode(sha256(convert_to(source_text,'UTF8')),'hex')) or (
 source_asset_id is not null and source_text is null
 and source_mime_type in('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')
 and source_size_bytes between 1 and 20971520)) is true);
alter table eps.specs_source_inputs add constraint specs_source_inputs_asset_fk foreign key(source_asset_id,workspace_id,source_hash)
 references eps.media_assets(id,origin_workspace_id,sha256) on delete restrict;
create index specs_source_inputs_asset_idx on eps.specs_source_inputs(source_asset_id) where source_asset_id is not null;
comment on table eps.specs_source_inputs is 'Append-only exact per-job original text OR immutable verified original asset reference/hash; old extraction and role provenance remain resolvable. No revision manager.';

create table eps.specs_asset_config (
 id smallint primary key check(id=1), uploads_enabled boolean not null default false,
 capabilities_enabled boolean not null default false, file_pipeline_enabled boolean not null default false
);
insert into eps.specs_asset_config(id) values(1);
create table eps.specs_upload_sessions (
 id uuid primary key default gen_random_uuid(), asset_id uuid not null unique references eps.media_assets(id) on delete restrict,
 principal_id uuid not null references auth.users(id) on delete restrict, workspace_id uuid not null references eps.workspaces(id) on delete restrict,
 reservation_revision bigint not null default 1 check(reservation_revision between 1 and 9007199254740991),
 verification_id uuid not null default gen_random_uuid(), spec_row_version bigint not null check(spec_row_version between 1 and 9007199254740991),
 bucket text not null check(bucket='eps-specs-assets'), object_key text not null,
 expected_size_bytes bigint not null check(expected_size_bytes between 1 and 20971520),
 expected_mime_type text not null check(expected_mime_type in('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')),
 expected_sha256 text check(expected_sha256~'^[a-f0-9]{64}$'),
 status text not null default 'open' check(status in('open','completed','cancelled')),
 created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null default clock_timestamp()+interval '2 hours', completed_at timestamptz,
 completion_value jsonb, check(expires_at>created_at), check((status='completed')=(completed_at is not null)),
 check((status='completed')=(completion_value is not null)), unique(bucket,object_key)
);
create index specs_upload_sessions_principal_workspace on eps.specs_upload_sessions(principal_id,workspace_id);
create table eps.specs_verification_keys (
 key_id text primary key check(key_id~'^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'), purpose text not null default 'specs' check(purpose='specs'),
 secret bytea not null check(octet_length(secret)=32), not_before timestamptz not null default clock_timestamp(),
 not_after timestamptz, revoked_at timestamptz, created_at timestamptz not null default clock_timestamp(), check(not_after is null or not_after>not_before)
);
create table eps.specs_asset_grants (
 id uuid primary key default gen_random_uuid(), token_digest text not null unique check(token_digest~'^[a-f0-9]{64}$'),
 job_id uuid not null references eps.jobs(id) on delete restrict, attempt_id uuid not null, input_hash text not null check(input_hash~'^[a-f0-9]{64}$'),
 asset_id uuid not null references eps.media_assets(id) on delete restrict,
 bucket text not null check(bucket in('eps-specs-assets','eps-specs-outputs')), object_key text not null,
 permission text not null check(permission in('read','write')), created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null, revoked_at timestamptz,
 check(expires_at>created_at and expires_at<=created_at+interval '90 seconds')
);
create index specs_asset_grants_job_expiry on eps.specs_asset_grants(job_id,attempt_id,expires_at);
create table eps.specs_file_preparations (
 job_id uuid not null references eps.jobs(id) on delete restrict, attempt_id uuid not null,
 input_hash text not null check(input_hash~'^[a-f0-9]{64}$'), asset_id uuid not null unique references eps.media_assets(id) on delete restrict,
 payload_utf8 text not null check(octet_length(payload_utf8) between 1 and 20971520),
 created_at timestamptz not null default clock_timestamp(), primary key(job_id,attempt_id)
);
comment on table eps.specs_file_preparations is 'Private pending native preparation per attempt. Exact uploaded derivative bytes/hash are validated before a terminal stage event can promote this data. Never public job metadata.';
do $private_tables$ declare relation text; begin
 foreach relation in array array['specs_asset_config','specs_upload_sessions','specs_verification_keys','specs_asset_grants','specs_file_preparations'] loop
  execute format('alter table eps.%I enable row level security',relation);
  execute format('alter table eps.%I force row level security',relation);
  execute format('revoke all on table eps.%I from public,anon,authenticated,service_role',relation);
 end loop;
end $private_tables$;

grant select on eps.specs_asset_config to eps_specs_upload_owner,eps_specs_verify_owner,eps_specs_assets_owner,eps_specs_submit_owner,eps_specs_stage_owner;
create policy specs_asset_config_runtime on eps.specs_asset_config for select to eps_specs_upload_owner,eps_specs_verify_owner,eps_specs_assets_owner,eps_specs_submit_owner,eps_specs_stage_owner using(true);
grant select,insert on eps.specs_upload_sessions to eps_specs_upload_owner;
grant update(status,reservation_revision) on eps.specs_upload_sessions to eps_specs_upload_owner;
grant select on eps.specs_upload_sessions,eps.specs_verification_keys to eps_specs_verify_owner;
grant update(status,completed_at,completion_value) on eps.specs_upload_sessions to eps_specs_verify_owner;
grant select(id,workspace_id,row_version),update(row_version) on eps.specs to eps_specs_upload_owner,eps_specs_verify_owner;
grant select(id,project_id,archived_at),update(row_version) on eps.workspaces to eps_specs_upload_owner,eps_specs_verify_owner;
create policy specs_upload_workspace_read on eps.workspaces for select to eps_specs_upload_owner,eps_specs_verify_owner using(eps.logo_scope(id,true));
create policy specs_upload_workspace_lock on eps.workspaces for update to eps_specs_upload_owner,eps_specs_verify_owner using(eps.logo_scope(id,true)) with check(false);
create policy specs_upload_spec_read on eps.specs for select to eps_specs_upload_owner,eps_specs_verify_owner using(eps.logo_scope(workspace_id,true));
create policy specs_upload_spec_lock on eps.specs for update to eps_specs_upload_owner,eps_specs_verify_owner using(eps.logo_scope(workspace_id,true)) with check(false);
grant select,insert on eps.idempotency_records to eps_specs_upload_owner,eps_specs_verify_owner;
grant insert on eps.audit_events to eps_specs_upload_owner,eps_specs_verify_owner;
create policy specs_upload_idempotency on eps.idempotency_records for all to eps_specs_upload_owner,eps_specs_verify_owner
 using(principal_id=auth.uid() and operation in('specs.reserve_upload','specs.complete_upload','specs.cancel_upload'))
 with check(principal_id=auth.uid() and operation in('specs.reserve_upload','specs.complete_upload','specs.cancel_upload'));
create policy specs_upload_audit on eps.audit_events for insert to eps_specs_upload_owner,eps_specs_verify_owner
 with check(principal_id=auth.uid() and action in('specs.reserve_upload','specs.complete_upload','specs.cancel_upload'));
create policy specs_upload_read on eps.specs_upload_sessions for select to eps_specs_upload_owner,eps_specs_verify_owner
 using(principal_id=auth.uid() and eps.logo_scope(workspace_id,true));
create policy specs_upload_insert on eps.specs_upload_sessions for insert to eps_specs_upload_owner
 with check(principal_id=auth.uid() and status='open' and reservation_revision=1 and eps.logo_scope(workspace_id,true));
create policy specs_upload_cancel on eps.specs_upload_sessions for update to eps_specs_upload_owner
 using(principal_id=auth.uid() and eps.logo_scope(workspace_id,true)) with check(status='cancelled' and principal_id=auth.uid() and eps.logo_scope(workspace_id,true));
create policy specs_upload_complete on eps.specs_upload_sessions for update to eps_specs_verify_owner
 using(principal_id=auth.uid() and eps.logo_scope(workspace_id,true)) with check(status='completed' and principal_id=auth.uid() and eps.logo_scope(workspace_id,true));
create policy specs_verify_key_read on eps.specs_verification_keys for select to eps_specs_verify_owner using(purpose='specs' and revoked_at is null);

grant select on eps.media_assets to eps_specs_upload_owner,eps_specs_verify_owner,eps_specs_assets_owner,eps_specs_submit_owner,eps_specs_stage_owner,eps_specs_apply_owner;
grant select(input_asset_id) on eps.jobs to eps_specs_submit_owner;
grant insert(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status) on eps.media_assets to eps_specs_upload_owner;
grant update(status) on eps.media_assets to eps_specs_upload_owner;
grant update(status,sha256) on eps.media_assets to eps_specs_verify_owner;
grant insert(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status,source_asset_id,producing_job_id,producing_attempt_id,output_stage,output_key) on eps.media_assets to eps_specs_assets_owner;
grant update(status,sha256) on eps.media_assets to eps_specs_assets_owner;
create policy specs_original_read on eps.media_assets for select to eps_specs_upload_owner,eps_specs_verify_owner
 using(purpose='specs' and eps.logo_scope(origin_workspace_id,false));
create policy specs_original_insert on eps.media_assets for insert to eps_specs_upload_owner
 with check(purpose='specs' and status='uploading' and sha256 is null and bucket='eps-specs-assets' and eps.logo_scope(origin_workspace_id,true)
  and object_key='assets/'||id::text||'/original.'||case mime_type when 'application/pdf' then 'pdf' when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx' when 'text/plain' then 'txt' end);
create policy specs_original_cancel on eps.media_assets for update to eps_specs_upload_owner
 using(purpose='specs' and status='uploading' and exists(select 1 from eps.specs_upload_sessions u where u.asset_id=media_assets.id and u.principal_id=auth.uid() and eps.logo_scope(u.workspace_id,true))) with check(status='failed');
create policy specs_original_verify on eps.media_assets for update to eps_specs_verify_owner
 using(purpose='specs' and status='uploading' and exists(select 1 from eps.specs_upload_sessions u where u.asset_id=media_assets.id and u.principal_id=auth.uid() and u.status='open' and u.expires_at>clock_timestamp() and eps.logo_scope(u.workspace_id,true)))
 with check(purpose='specs' and status='ready' and sha256 is not null and width is null and height is null);
create policy specs_asset_submit_read on eps.media_assets for select to eps_specs_submit_owner using(purpose='specs' and status='ready' and eps.specs_scope(origin_workspace_id,true));
create policy specs_asset_service_read on eps.media_assets for select to eps_specs_stage_owner,eps_specs_apply_owner,eps_specs_assets_owner using(purpose in('specs','document_text'));
grant select,insert on eps.specs_asset_grants,eps.specs_file_preparations to eps_specs_assets_owner;
grant select on eps.specs_file_preparations to eps_specs_stage_owner,eps_specs_apply_owner;
grant select on eps.specs_stage_payloads to eps_specs_assets_owner;
create policy specs_assets_prepared_refs on eps.specs_stage_payloads for select to eps_specs_assets_owner using(stage='prepare_document');
create policy specs_asset_grant_service_read on eps.specs_asset_grants for select to eps_specs_assets_owner using(true);
create policy specs_asset_grant_service_insert on eps.specs_asset_grants for insert to eps_specs_assets_owner with check(true);
create policy specs_preparation_service_read on eps.specs_file_preparations for select to eps_specs_assets_owner,eps_specs_stage_owner,eps_specs_apply_owner using(true);
create policy specs_preparation_service_insert on eps.specs_file_preparations for insert to eps_specs_assets_owner with check(true);

-- Boolean/scope helpers retain the existing status lookup exception under the
-- stage owner. New asset roles receive no direct managed Auth grants.
create function eps.specs_assets_current(p_job uuid,p_attempt uuid,p_lease text) returns eps.jobs
language plpgsql volatile security definer set search_path='' as $$ declare job eps.jobs; begin
 job:=eps.specs_stage_lock(p_job);
 perform eps.specs_stage_assert(job.status='running' and job.current_attempt_id=p_attempt and job.cancel_requested_at is null
  and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(p_lease is not null and length(p_lease) between 1 and 1024
  and job.lease_token_digest=encode(sha256(convert_to(p_lease,'UTF8')),'hex'),'LEASE_INVALID');
 perform eps.specs_stage_assert(eps.specs_stage_source_matches(job),'INPUT_CHANGED'); return job;
end $$;
create function eps.specs_assets_live(p_job uuid,p_attempt uuid,p_input_hash text) returns boolean
language sql volatile security definer set search_path='' as $$
 select exists(select 1 from eps.jobs j where j.id=p_job and j.kind='specs_extract' and j.current_attempt_id=p_attempt and j.input_hash=p_input_hash
  and j.status='running' and j.cancel_requested_at is null and j.lease_expires_at>clock_timestamp()
  and eps.specs_stage_source_matches(j) and eps.specs_stage_can_write(j.requested_by,j.workspace_id))
$$;
revoke all on function eps.specs_assets_current(uuid,uuid,text),eps.specs_assets_live(uuid,uuid,text) from public,anon,authenticated,service_role;
grant create on schema eps to eps_specs_stage_owner;
alter function eps.specs_assets_current(uuid,uuid,text) owner to eps_specs_stage_owner;
alter function eps.specs_assets_live(uuid,uuid,text) owner to eps_specs_stage_owner;
revoke create on schema eps from eps_specs_stage_owner;
grant execute on function eps.specs_assets_current(uuid,uuid,text),eps.specs_assets_live(uuid,uuid,text) to eps_specs_assets_owner;

create policy specs_output_insert on eps.media_assets for insert to eps_specs_assets_owner
 with check(purpose='document_text' and status='uploading' and sha256 is null and bucket='eps-specs-outputs'
  and object_key='jobs/'||producing_job_id::text||'/attempts/'||producing_attempt_id::text||'/'||id::text||'.json'
  and exists(select 1 from eps.jobs j where j.id=producing_job_id and j.workspace_id=origin_workspace_id and j.input_asset_id=source_asset_id and j.stage=output_stage
   and eps.specs_assets_live(j.id,producing_attempt_id,j.input_hash)));
-- UPDATE USING permits row locking of Ready outputs; operation code restricts
-- the one uploading->Ready transition and asserts every resulting field.
create policy specs_output_complete on eps.media_assets for update to eps_specs_assets_owner
 using(purpose='document_text' and eps.specs_assets_live(producing_job_id,producing_attempt_id,(select j.input_hash from eps.jobs j where j.id=producing_job_id)))
 with check(purpose='document_text' and status='ready' and sha256 is not null and exists(select 1 from eps.jobs j where j.id=producing_job_id and j.workspace_id=origin_workspace_id and j.input_asset_id=source_asset_id and j.stage=output_stage
   and eps.specs_assets_live(j.id,producing_attempt_id,j.input_hash)));
grant select(id,workspace_id,input_hash,resource_id,input_asset_id,kind,current_attempt_id,stage,status,lease_expires_at,requested_by) on eps.jobs to eps_specs_assets_owner;
create policy specs_asset_job_read on eps.jobs for select to eps_specs_assets_owner using(kind='specs_extract');
grant execute on function eps.logo_scope(uuid,boolean),eps.logo_integer(jsonb,bigint,bigint),eps.logo_decode_receipt(text,integer,integer),eps.fail(text,text,integer,bigint),
 eps.require_capability(text),eps.check_input(jsonb,text[]),eps.input_uuid(text),eps.idempotency_begin(text,text,jsonb),eps.finish_mutation(text,text,jsonb,jsonb,uuid)
 to eps_specs_upload_owner,eps_specs_verify_owner;
grant execute on function public.eps_submit_specs(uuid,jsonb,text) to eps_specs_verify_owner;
grant execute on function eps.fail(text,text,integer,bigint),eps.specs_stage_assert(boolean,text),eps.specs_stage_shape(jsonb,text[],text[]),eps.specs_stage_integer(jsonb,bigint,bigint),eps.specs_stage_paragraphs(text)
 to eps_specs_assets_owner;

-- Further fixed upload/capability/output and source/application functions follow.
create function eps.specs_media_dto(p_asset eps.media_assets) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('id',(p_asset).id,'purpose',(p_asset).purpose,'filename',(p_asset).filename,'mime_type',(p_asset).mime_type,
  'size_bytes',(p_asset).size_bytes,'sha256',(p_asset).sha256,'status',(p_asset).status,'duration_ms',null,'width',(p_asset).width,'height',(p_asset).height,
  'source_asset_id',(p_asset).source_asset_id,'source_timestamp_ms',null,'created_at',(p_asset).created_at)
$$;
create function eps.specs_upload_dto(p_upload uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('upload_id',u.id,'asset',eps.specs_media_dto(a),'principal_id',u.principal_id,'workspace_id',u.workspace_id,
  'reservation_revision',u.reservation_revision,'verification_id',u.verification_id,'spec_row_version',u.spec_row_version,'bucket',u.bucket,'object_key',u.object_key,
  'expected_size_bytes',u.expected_size_bytes,'expected_mime_type',u.expected_mime_type,'expected_sha256',u.expected_sha256,'expires_at',u.expires_at,
  'status',case when u.status='open' and u.expires_at<=clock_timestamp() then 'expired' else u.status end)
 from eps.specs_upload_sessions u join eps.media_assets a on a.id=u.asset_id where u.id=p_upload
$$;
create function eps.specs_upload_require(p_upload uuid) returns eps.specs_upload_sessions
language plpgsql volatile security invoker set search_path='' as $$ declare upload eps.specs_upload_sessions; begin
 perform eps.require_capability('workspaces.write');
 select * into upload from eps.specs_upload_sessions u where u.id=p_upload and u.principal_id=auth.uid() and eps.logo_scope(u.workspace_id,true);
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Document upload not found.',404); end if; return upload;
end $$;
create function eps.specs_upload_remember(p_operation text,p_key text,p_input jsonb,p_response jsonb) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$ declare changed bigint; begin
 insert into eps.idempotency_records(principal_id,operation,key,request_hash,response)
 values(auth.uid(),p_operation,p_key,encode(sha256(convert_to(p_input::text,'UTF8')),'hex'),p_response);
 get diagnostics changed=row_count; if changed<>1 then perform eps.fail('SPECS_STATE_INVALID','The document receipt was not stored.',409); end if; return p_response;
end $$;
create function eps.specs_upload_check_completion(p_input jsonb,p_upload eps.specs_upload_sessions) returns void
language plpgsql immutable security invoker set search_path='' as $$ begin
 perform eps.check_input(p_input,array['actual_size_bytes','start_processing','sha256']);
 if eps.logo_integer(p_input->'actual_size_bytes',1,20971520)<>p_upload.expected_size_bytes
  or jsonb_typeof(p_input->'start_processing') is distinct from 'boolean'
  or p_input?'sha256' and (jsonb_typeof(p_input->'sha256') is distinct from 'string' or p_input->>'sha256'!~'^[a-f0-9]{64}$'
   or p_upload.expected_sha256 is not null and p_input->>'sha256'<>p_upload.expected_sha256)
 then perform eps.fail('INVALID_REQUEST','Document completion does not match its reservation.',400); end if;
 if p_upload.status='completed' and ((p_input->>'start_processing')::boolean is distinct from (p_upload.completion_value->>'status'='queued')
  or p_input?'sha256' and p_input->>'sha256' is distinct from p_upload.completion_value#>>'{asset,sha256}')
 then perform eps.fail('INVALID_TRANSITION','This document was completed with different processing assertions.',409); end if;
end $$;

create function public.eps_reserve_specs_upload(p_input jsonb,p_idempotency_key text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare workspace uuid; current_spec_version bigint; response jsonb; upload_id uuid:=gen_random_uuid(); asset_id uuid:=gen_random_uuid();
 mime text; extension text; size bigint; changed bigint; result jsonb;
begin
 perform eps.require_capability('workspaces.write');
 perform eps.check_input(p_input,array['workspace_id','purpose','filename','mime_type','size_bytes','sha256']);
 workspace:=eps.input_uuid(p_input->>'workspace_id'); mime:=p_input->>'mime_type';
 if p_input->>'purpose' is distinct from 'specs' or jsonb_typeof(p_input->'filename') is distinct from 'string'
  or length(btrim(p_input->>'filename')) not between 1 and 255 or p_input->>'filename'~E'[/\\\\[:cntrl:]]'
  or mime not in('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')
  or p_input?'sha256' and (jsonb_typeof(p_input->'sha256') is distinct from 'string' or p_input->>'sha256'!~'^[a-f0-9]{64}$')
 then perform eps.fail('INVALID_REQUEST','Provide a supported document and simple filename.',400); end if;
 size:=eps.logo_integer(p_input->'size_bytes',1,20971520);
 if not eps.logo_scope(workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 response:=eps.idempotency_begin('specs.reserve_upload',p_idempotency_key,p_input);
 if not eps.logo_scope(workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 if response is not null then
  upload_id:=eps.input_uuid(response->>'upload_id'); perform eps.specs_upload_require(upload_id); return eps.specs_upload_dto(upload_id);
 end if;
 if not exists(select 1 from eps.specs_asset_config where id=1 and uploads_enabled) then perform eps.fail('FEATURE_NOT_IMPLEMENTED','Document uploads are not enabled.',503); end if;
 perform 1 from eps.workspaces w where w.id=workspace for update;
 select s.row_version into current_spec_version from eps.specs s where s.workspace_id=workspace for update;
 if not found or not eps.logo_scope(workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable source not found.',404); end if;
 extension:=case mime when 'application/pdf' then 'pdf' when 'text/plain' then 'txt' else 'docx' end;
 insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status)
 values(asset_id,workspace,'specs',p_input->>'filename',mime,'eps-specs-assets','assets/'||asset_id::text||'/original.'||extension,size,'uploading');
 get diagnostics changed=row_count; if changed<>1 then perform eps.fail('SPECS_STATE_INVALID','The document asset was not reserved.',409); end if;
 insert into eps.specs_upload_sessions(id,asset_id,principal_id,workspace_id,spec_row_version,bucket,object_key,expected_size_bytes,expected_mime_type,expected_sha256)
 values(upload_id,asset_id,auth.uid(),workspace,current_spec_version,'eps-specs-assets','assets/'||asset_id::text||'/original.'||extension,size,mime,p_input->>'sha256');
 get diagnostics changed=row_count; if changed<>1 then perform eps.fail('SPECS_STATE_INVALID','The document upload was not reserved.',409); end if;
 result:=eps.specs_upload_dto(upload_id);
 if result is null or result#>>'{asset,id}'<>asset_id::text or result->>'spec_row_version'<>current_spec_version::text
  or result->>'status'<>'open' or result#>>'{asset,status}'<>'uploading'
 then perform eps.fail('SPECS_STATE_INVALID','The document reservation was not stored completely.',409); end if;
 result:=eps.finish_mutation('specs.reserve_upload',p_idempotency_key,p_input,result,asset_id);
 if not eps.logo_scope(workspace,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if; return result;
end $$;
create function public.eps_get_specs_upload(p_upload_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$ begin
 perform eps.specs_upload_require(p_upload_id); return eps.specs_upload_dto(p_upload_id);
end $$;
create function public.eps_prepare_specs_completion(p_upload_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare upload eps.specs_upload_sessions; replay jsonb; payload jsonb:=jsonb_build_object('id',p_upload_id,'input',p_input); begin
 upload:=eps.specs_upload_require(p_upload_id); perform eps.specs_upload_check_completion(p_input,upload);
 replay:=eps.idempotency_begin('specs.complete_upload',p_idempotency_key,payload);
 upload:=eps.specs_upload_require(p_upload_id); perform eps.specs_upload_check_completion(p_input,upload);
 if replay is null and upload.status='completed' then
  replay:=eps.specs_upload_remember('specs.complete_upload',p_idempotency_key,payload,upload.completion_value);
 end if;
 return jsonb_build_object('reservation',eps.specs_upload_dto(p_upload_id),'replay',replay);
end $$;

create function eps.specs_verify_original_receipt(p_upload eps.specs_upload_sessions,p_payload text,p_mac text) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare bytes bytea; supplied bytea; computed bytea; original json; claims jsonb; key eps.specs_verification_keys;
 field text; count_keys integer; distinct_keys integer; difference integer:=0; index_value integer; issued bigint; expires bigint; current_second bigint; size bigint; expected_format text;
begin
 bytes:=eps.logo_decode_receipt(p_payload,4096); supplied:=eps.logo_decode_receipt(p_mac,32,32);
 begin
  original:=convert_from(bytes,'UTF8')::json;
  if json_typeof(original) is distinct from 'object' then perform eps.fail('ACCESS_DENIED','Invalid document verification.',403); end if;
  select count(*),count(distinct item.key) into count_keys,distinct_keys from json_each(original) item;
  if count_keys<>18 or distinct_keys<>18 then perform eps.fail('ACCESS_DENIED','Invalid document verification fields.',403); end if;
  claims:=original::jsonb;
 exception when others then perform eps.fail('ACCESS_DENIED','Invalid document verification.',403); end;
 perform eps.check_input(claims,array['schema_version','audience','purpose','key_id','verification_id','upload_id','asset_id','principal_id','workspace_id','reservation_revision','bucket','object_key','size_bytes','sha256','mime_type','verified_format','issued_at','expires_at']);
 foreach field in array array['schema_version','audience','purpose','key_id','verification_id','upload_id','asset_id','principal_id','workspace_id','bucket','object_key','sha256','mime_type','verified_format'] loop
  if jsonb_typeof(claims->field) is distinct from 'string' then perform eps.fail('ACCESS_DENIED','Invalid document verification fields.',403); end if;
 end loop;
 if claims->>'key_id'!~'^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' then perform eps.fail('ACCESS_DENIED','Invalid document verification.',403); end if;
 select * into key from eps.specs_verification_keys k where k.key_id=claims->>'key_id' and k.purpose='specs' and k.revoked_at is null;
 if not found then perform eps.fail('ACCESS_DENIED','Invalid document verification.',403); end if;
 computed:=extensions.hmac(bytes,key.secret,'sha256');
 for index_value in 0..31 loop difference:=difference|(get_byte(computed,index_value)#get_byte(supplied,index_value)); end loop;
 if difference<>0 then perform eps.fail('ACCESS_DENIED','Invalid document verification.',403); end if;
 issued:=eps.logo_integer(claims->'issued_at',0,253402300799); expires:=eps.logo_integer(claims->'expires_at',0,253402300799);
 size:=eps.logo_integer(claims->'size_bytes',1,20971520); current_second:=floor(extract(epoch from clock_timestamp()))::bigint;
 expected_format:=case p_upload.expected_mime_type when 'application/pdf' then 'pdf' when 'text/plain' then 'utf8_text' else 'docx' end;
 if issued>current_second or expires<=current_second or expires<=issued or expires-issued>120
  or key.not_before>to_timestamp(issued) or key.not_after is not null and key.not_after<to_timestamp(expires)
  or claims->>'schema_version' is distinct from 'specs-original-verification.v1' or claims->>'audience' is distinct from 'eps.specs-original-verification'
  or claims->>'purpose' is distinct from 'specs' or claims->>'verification_id' is distinct from p_upload.verification_id::text
  or claims->>'upload_id' is distinct from p_upload.id::text or claims->>'asset_id' is distinct from p_upload.asset_id::text
  or claims->>'principal_id' is distinct from auth.uid()::text or claims->>'workspace_id' is distinct from p_upload.workspace_id::text
  or eps.logo_integer(claims->'reservation_revision',1,9007199254740991)<>p_upload.reservation_revision
  or claims->>'bucket' is distinct from p_upload.bucket or claims->>'object_key' is distinct from p_upload.object_key
  or size<>p_upload.expected_size_bytes or claims->>'mime_type' is distinct from p_upload.expected_mime_type
  or claims->>'verified_format' is distinct from expected_format or claims->>'sha256'!~'^[a-f0-9]{64}$'
  or p_upload.expected_sha256 is not null and claims->>'sha256'<>p_upload.expected_sha256
 then perform eps.fail('ACCESS_DENIED','Document verification scope or lifetime is invalid.',403); end if; return claims;
end $$;
create function public.eps_finalize_specs_completion(p_upload_id uuid,p_input jsonb,p_idempotency_key text,p_payload text,p_mac text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare upload eps.specs_upload_sessions; payload jsonb:=jsonb_build_object('id',p_upload_id,'input',p_input);
 replay jsonb; claims jsonb; asset eps.media_assets; changed bigint; ack jsonb; result jsonb; source_version bigint;
begin
 upload:=eps.specs_upload_require(p_upload_id); perform eps.specs_upload_check_completion(p_input,upload);
 replay:=eps.idempotency_begin('specs.complete_upload',p_idempotency_key,payload); upload:=eps.specs_upload_require(p_upload_id); perform eps.specs_upload_check_completion(p_input,upload);
 if replay is not null then return replay; end if;
 if upload.status='completed' then return eps.specs_upload_remember('specs.complete_upload',p_idempotency_key,payload,upload.completion_value); end if;
 if upload.status<>'open' or upload.expires_at<=clock_timestamp() then perform eps.fail('UPLOAD_EXPIRED','This document upload is closed or expired.',409); end if;
 perform 1 from eps.workspaces w where w.id=upload.workspace_id for update;
 select s.row_version into source_version from eps.specs s where s.workspace_id=upload.workspace_id for update;
 upload:=eps.specs_upload_require(p_upload_id); perform eps.specs_upload_check_completion(p_input,upload);
 select * into upload from eps.specs_upload_sessions u where u.id=p_upload_id for update;
 perform eps.specs_upload_check_completion(p_input,upload);
 if upload.status='completed' then return eps.specs_upload_remember('specs.complete_upload',p_idempotency_key,payload,upload.completion_value); end if;
 if upload.status<>'open' or upload.expires_at<=clock_timestamp() or not eps.logo_scope(upload.workspace_id,true) then perform eps.fail('UPLOAD_EXPIRED','This document upload is closed or expired.',409); end if;
 claims:=eps.specs_verify_original_receipt(upload,p_payload,p_mac);
 select * into asset from eps.media_assets a where a.id=upload.asset_id for update;
 if not found or asset.status<>'uploading' or asset.purpose<>'specs' or asset.size_bytes<>upload.expected_size_bytes or asset.mime_type<>upload.expected_mime_type
 then perform eps.fail('INVALID_TRANSITION','The document asset is not awaiting verification.',409); end if;
 update eps.media_assets set status='ready',sha256=claims->>'sha256' where id=asset.id and status='uploading';
 get diagnostics changed=row_count; if changed<>1 then perform eps.fail('SPECS_STATE_INVALID','The verified document was not stored.',409); end if;
 select * into asset from eps.media_assets a where a.id=upload.asset_id;
 if asset.status<>'ready' or asset.sha256 is distinct from claims->>'sha256' or asset.width is not null or asset.height is not null
 then perform eps.fail('SPECS_STATE_INVALID','The verified document metadata was altered.',409); end if;
 if (p_input->>'start_processing')::boolean then
  if source_version<>upload.spec_row_version then perform eps.fail('STALE_RESOURCE_VERSION','Specs changed during upload. Complete without processing, reload, then submit this asset.',409,source_version); end if;
  ack:=public.eps_submit_specs(upload.workspace_id,jsonb_build_object('source_asset_id',asset.id,'row_version',upload.spec_row_version),
   'specs.upload:'||encode(sha256(convert_to(p_idempotency_key,'UTF8')),'hex'));
 end if;
 result:=jsonb_build_object('asset',eps.specs_media_dto(asset),'processing_job_id',ack->'job_id','status',case when ack is null then 'ready' else 'queued' end);
 update eps.specs_upload_sessions set status='completed',completed_at=clock_timestamp(),completion_value=result
 where id=upload.id and status='open' and expires_at>clock_timestamp();
 get diagnostics changed=row_count; if changed<>1 then perform eps.fail('SPECS_STATE_INVALID','The document session expired during completion.',409); end if;
 if not exists(select 1 from eps.specs_upload_sessions u where u.id=upload.id and u.status='completed' and u.completion_value=result)
  or not eps.logo_scope(upload.workspace_id,true) then perform eps.fail('SPECS_STATE_INVALID','The document completion was not stored completely.',409); end if;
 return eps.finish_mutation('specs.complete_upload',p_idempotency_key,payload,result,asset.id);
end $$;
create function public.eps_cancel_specs_upload(p_upload_id uuid,p_idempotency_key text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare upload eps.specs_upload_sessions; payload jsonb:=jsonb_build_object('id',p_upload_id); replay jsonb; result jsonb; changed bigint; begin
 upload:=eps.specs_upload_require(p_upload_id); replay:=eps.idempotency_begin('specs.cancel_upload',p_idempotency_key,payload); upload:=eps.specs_upload_require(p_upload_id);
 if replay is not null then return replay; end if;
 if upload.status='completed' then perform eps.fail('INVALID_TRANSITION','A completed document upload cannot be cancelled.',409); end if;
 if upload.status='open' then
  perform 1 from eps.workspaces w where w.id=upload.workspace_id for update;
  perform 1 from eps.specs s where s.workspace_id=upload.workspace_id for update;
  upload:=eps.specs_upload_require(p_upload_id);
  select * into upload from eps.specs_upload_sessions u where u.id=p_upload_id for update;
  if upload.status='completed' then perform eps.fail('INVALID_TRANSITION','A completed document upload cannot be cancelled.',409); end if;
  if upload.status='open' then
   update eps.media_assets set status='failed' where id=upload.asset_id and status='uploading';
   get diagnostics changed=row_count; if changed<>1 then perform eps.fail('SPECS_STATE_INVALID','The document cancellation was not stored.',409); end if;
   update eps.specs_upload_sessions set status='cancelled',reservation_revision=reservation_revision+1 where id=upload.id and status='open';
   get diagnostics changed=row_count; if changed<>1 then perform eps.fail('SPECS_STATE_INVALID','The document cancellation was not stored.',409); end if;
  end if;
 end if;
 if not eps.logo_scope(upload.workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable upload not found.',404); end if;
 result:=jsonb_build_object('success',true,'affected_ids',jsonb_build_array(upload.id,upload.asset_id));
 return eps.finish_mutation('specs.cancel_upload',p_idempotency_key,payload,result,upload.asset_id);
end $$;
create function public.eps_get_specs_media(p_asset_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$ declare asset eps.media_assets; begin
 if auth.uid() is null then perform eps.fail('AUTH_REQUIRED','Sign in.',401); end if;
 select * into asset from eps.media_assets a where a.id=p_asset_id and a.purpose='specs' and a.status='ready' and eps.logo_scope(a.origin_workspace_id,false);
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Document not found.',404); end if;
 return jsonb_build_object('asset',eps.specs_media_dto(asset),'bucket',asset.bucket,'object_key',asset.object_key);
end $$;

create function eps.specs_storage_original_insert(p_bucket text,p_key text) returns boolean
language plpgsql volatile security definer set search_path='' as $$ declare headers jsonb; begin
 if p_bucket is distinct from 'eps-specs-assets' or auth.uid() is null
  or not exists(select 1 from eps.specs_asset_config where id=1 and uploads_enabled) then return false; end if;
 begin headers:=nullif(current_setting('request.headers',true),'')::jsonb; exception when others then return false; end;
 if jsonb_typeof(headers) is distinct from 'object' or headers->'x-upsert' is distinct from '"false"'::jsonb then return false; end if;
 return exists(select 1 from eps.specs_upload_sessions u where u.bucket=p_bucket and u.object_key=p_key and u.principal_id=auth.uid()
  and u.status='open' and u.expires_at>clock_timestamp() and eps.logo_scope(u.workspace_id,true));
end $$;
create function eps.specs_storage_original_read(p_bucket text,p_key text) returns boolean
language plpgsql volatile security definer set search_path='' as $$ begin
 if p_bucket is distinct from 'eps-specs-assets' or auth.uid() is null then return false; end if;
 return exists(select 1 from eps.media_assets a where a.purpose='specs' and a.bucket=p_bucket and a.object_key=p_key
  and (a.status='ready' and eps.logo_scope(a.origin_workspace_id,false)
   or a.status='uploading' and exists(select 1 from eps.specs_upload_sessions u where u.asset_id=a.id and u.principal_id=auth.uid()
    and u.status='open' and u.expires_at>clock_timestamp() and eps.logo_scope(u.workspace_id,true))));
end $$;
create function eps.specs_storage_capability(p_bucket text,p_key text,p_permission text) returns boolean
language plpgsql volatile security definer set search_path='' as $$ declare headers jsonb; token text; begin
 if p_bucket not in('eps-specs-assets','eps-specs-outputs') or p_permission not in('read','write')
  or not exists(select 1 from eps.specs_asset_config where id=1 and capabilities_enabled) then return false; end if;
 begin headers:=nullif(current_setting('request.headers',true),'')::jsonb; exception when others then return false; end;
 if jsonb_typeof(headers) is distinct from 'object' or jsonb_typeof(headers->'x-eps-asset-grant') is distinct from 'string'
  or p_permission='write' and headers->'x-upsert' is distinct from '"false"'::jsonb then return false; end if;
 token:=headers->>'x-eps-asset-grant'; if length(token)<>43 or token!~'^[A-Za-z0-9_-]{43}$' then return false; end if;
 return exists(select 1 from eps.specs_asset_grants g join eps.media_assets a on a.id=g.asset_id
  where g.token_digest=encode(sha256(convert_to(token,'UTF8')),'hex') and g.bucket=p_bucket and g.object_key=p_key and g.permission=p_permission
   and g.revoked_at is null and g.expires_at>clock_timestamp() and a.bucket=g.bucket and a.object_key=g.object_key
   and (p_permission='read' and (a.purpose='specs' and a.status='ready' or a.purpose='document_text' and a.status in('uploading','ready'))
    or p_permission='write' and a.purpose='document_text' and a.status='uploading' and a.producing_job_id=g.job_id and a.producing_attempt_id=g.attempt_id)
   and eps.specs_assets_live(g.job_id,g.attempt_id,g.input_hash));
end $$;

do $buckets$ declare bucket_id text; mimes text[]; begin
 foreach bucket_id in array array['eps-specs-assets','eps-specs-outputs'] loop
  mimes:=case when bucket_id='eps-specs-assets' then array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'] else array['application/json'] end;
  if exists(select 1 from storage.buckets b where b.id=bucket_id and (b.public or b.file_size_limit is distinct from 20971520::bigint
   or b.allowed_mime_types is null or not(b.allowed_mime_types @> mimes and b.allowed_mime_types <@ mimes)))
  then raise exception 'EXISTING_SPECS_BUCKET_CONFIGURATION_MISMATCH'; end if;
  if not exists(select 1 from storage.buckets b where b.id=bucket_id) then
   insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values(bucket_id,bucket_id,false,20971520,mimes);
  end if;
 end loop;
end $buckets$;
-- The operation helper runs as the actual Storage caller. The asset owner does
-- not inherit an Auth/anon role or receive managed Storage table privileges.
create policy eps_specs_original_insert on storage.objects for insert to authenticated
 with check(bucket_id='eps-specs-assets' and (storage.allow_only_operation('object.upload') or storage.allow_only_operation('object.sign_upload_url'))
  and eps.specs_storage_original_insert(bucket_id,name));
create policy eps_specs_original_read on storage.objects for select to authenticated
 using(bucket_id='eps-specs-assets' and storage.allow_only_operation('object.get_authenticated') and eps.specs_storage_original_read(bucket_id,name));
create policy eps_specs_capability_read on storage.objects for select to anon
 using(bucket_id in('eps-specs-assets','eps-specs-outputs') and storage.allow_only_operation('object.get_authenticated') and eps.specs_storage_capability(bucket_id,name,'read'));
create policy eps_specs_capability_write on storage.objects for insert to anon
 with check(bucket_id='eps-specs-outputs' and storage.allow_only_operation('object.upload') and eps.specs_storage_capability(bucket_id,name,'write'));
create policy eps_specs_insert_guard on storage.objects as restrictive for insert to public
 with check(bucket_id not in('eps-specs-assets','eps-specs-outputs')
  or bucket_id='eps-specs-assets' and (storage.allow_only_operation('object.upload') or storage.allow_only_operation('object.sign_upload_url')) and eps.specs_storage_original_insert(bucket_id,name)
  or bucket_id='eps-specs-outputs' and storage.allow_only_operation('object.upload') and eps.specs_storage_capability(bucket_id,name,'write'));
create policy eps_specs_read_guard on storage.objects as restrictive for select to public
 using(bucket_id not in('eps-specs-assets','eps-specs-outputs') or storage.allow_only_operation('object.get_authenticated')
  and (bucket_id='eps-specs-assets' and eps.specs_storage_original_read(bucket_id,name) or eps.specs_storage_capability(bucket_id,name,'read')));
create policy eps_specs_update_guard on storage.objects as restrictive for update to public
 using(bucket_id not in('eps-specs-assets','eps-specs-outputs')) with check(bucket_id not in('eps-specs-assets','eps-specs-outputs'));
create policy eps_specs_delete_guard on storage.objects as restrictive for delete to public using(bucket_id not in('eps-specs-assets','eps-specs-outputs'));
-- Function owners cannot turn inherited user ACLs into general Storage DML.
create policy eps_specs_owners_no_objects on storage.objects as restrictive for all to eps_specs_upload_owner,eps_specs_verify_owner,eps_specs_assets_owner using(false) with check(false);
create policy eps_specs_owners_no_buckets on storage.buckets as restrictive for all to eps_specs_upload_owner,eps_specs_verify_owner,eps_specs_assets_owner using(false) with check(false);

create function eps.get_job_asset_access(p_input jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs; asset eps.media_assets; permission text; grant_token text; at_value timestamptz; expiry timestamptz; changed bigint; begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','asset_id','access'],array['job_id','attempt_id','lease_token','asset_id']));
 job:=eps.specs_assets_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 if not exists(select 1 from eps.specs_asset_config where id=1 and capabilities_enabled and file_pipeline_enabled)
 then perform eps.fail('FEATURE_NOT_IMPLEMENTED','Document service transfer is not enabled.',503); end if;
 permission:=coalesce(p_input->>'access','read'); if p_input?'access' and jsonb_typeof(p_input->'access') is distinct from 'string' or permission not in('read','write') then perform eps.fail('INVALID_REQUEST','Unknown document transfer mode.',400); end if;
 select * into asset from eps.media_assets a where a.id=eps.input_uuid(p_input->>'asset_id') and a.origin_workspace_id=job.workspace_id;
 if not found or not(
  permission='read' and asset.purpose='specs' and asset.status='ready' and asset.id=job.input_asset_id and asset.sha256=job.input->>'source_hash'
  or asset.purpose='document_text' and asset.producing_job_id=job.id and asset.source_asset_id=job.input_asset_id
   and (asset.producing_attempt_id=job.current_attempt_id and asset.output_stage=job.stage and asset.status in('uploading','ready') and (permission='read' or asset.status='uploading')
    or permission='read' and asset.status='ready' and exists(select 1 from eps.specs_stage_payloads p where p.job_id=job.id and p.stage='prepare_document' and p.input_hash=job.input_hash and p.result->>'text_asset_id'=asset.id::text)))
 then perform eps.fail('RESOURCE_NOT_FOUND','This asset does not belong to the active stage.',404); end if;
 at_value:=clock_timestamp(); expiry:=least(job.lease_expires_at,at_value+interval '60 seconds');
 if expiry<=at_value then perform eps.fail('STALE_STAGE_LEASE','This stage lease expired.',409); end if;
 grant_token:=rtrim(translate(replace(encode(extensions.gen_random_bytes(32),'base64'),E'\n',''),'+/','-_'),'=');
 insert into eps.specs_asset_grants(token_digest,job_id,attempt_id,input_hash,asset_id,bucket,object_key,permission,created_at,expires_at)
 values(encode(sha256(convert_to(grant_token,'UTF8')),'hex'),job.id,job.current_attempt_id,job.input_hash,asset.id,asset.bucket,asset.object_key,permission,at_value,expiry);
 get diagnostics changed=row_count; if changed<>1 then perform eps.fail('STAGE_STATE_INVALID','Document transfer authority was not reserved.',409); end if;
 if not eps.specs_assets_live(job.id,job.current_attempt_id,job.input_hash) then perform eps.fail('INPUT_CHANGED','Document transfer scope changed.',409); end if;
 -- Private adapter projection. It validates the fixed bucket/key and constructs
 -- the actual ServiceAssetAccess origin/method/header DTO, never an arbitrary URL.
 return jsonb_build_object('asset_id',asset.id,'bucket',asset.bucket,'object_key',asset.object_key,'permission',permission,
  'grant_token',grant_token,'expires_at',expiry,'mime_type',asset.mime_type,'size_bytes',asset.size_bytes,'sha256',asset.sha256);
end $$;

create function eps.reserve_job_output(p_input jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs; existing eps.media_assets; asset_id uuid:=gen_random_uuid(); expected_size bigint; changed bigint; begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','output_key','asset_kind','filename','mime_type','expected_size_bytes','parent_asset_id','time_offset_ms'],array['job_id','attempt_id','lease_token','output_key','asset_kind','filename','mime_type','expected_size_bytes','parent_asset_id','time_offset_ms']));
 job:=eps.specs_assets_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 expected_size:=eps.logo_integer(p_input->'expected_size_bytes',1,20971520);
 if job.stage<>'prepare_document' or job.input_asset_id is null or p_input->>'output_key' is distinct from 'document_text'
  or p_input->>'asset_kind' is distinct from 'document_text' or p_input->>'filename' is distinct from 'prepared-document.json'
  or p_input->>'mime_type' is distinct from 'application/json' or p_input->>'parent_asset_id' is distinct from job.input_asset_id::text
  or p_input->'time_offset_ms' is distinct from 'null'::jsonb
 then perform eps.fail('INVALID_REQUEST','Document output does not match this stage and original.',400); end if;
 if not exists(select 1 from eps.specs_asset_config where id=1 and capabilities_enabled and file_pipeline_enabled)
 then perform eps.fail('FEATURE_NOT_IMPLEMENTED','Document service output is not enabled.',503); end if;
 select * into existing from eps.media_assets a where a.producing_job_id=job.id and a.producing_attempt_id=job.current_attempt_id and a.output_key='document_text';
 if found then
  if existing.origin_workspace_id<>job.workspace_id or existing.source_asset_id<>job.input_asset_id or existing.filename<>p_input->>'filename'
   or existing.mime_type<>p_input->>'mime_type' or existing.size_bytes<>expected_size or existing.output_stage<>job.stage
  then perform eps.fail('IDEMPOTENCY_KEY_REUSED','This logical output key has different metadata.',409); end if;
  return jsonb_build_object('asset',eps.specs_media_dto(existing),'bucket',existing.bucket,'object_key',existing.object_key);
 end if;
 insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status,source_asset_id,producing_job_id,producing_attempt_id,output_stage,output_key)
 values(asset_id,job.workspace_id,'document_text','prepared-document.json','application/json','eps-specs-outputs',
  'jobs/'||job.id::text||'/attempts/'||job.current_attempt_id::text||'/'||asset_id::text||'.json',expected_size,'uploading',job.input_asset_id,job.id,job.current_attempt_id,job.stage,'document_text') returning * into existing;
 get diagnostics changed=row_count; if changed<>1 or existing.id is distinct from asset_id or existing.status<>'uploading'
  then perform eps.fail('STAGE_STATE_INVALID','The document output was not reserved completely.',409); end if;
 return jsonb_build_object('asset',eps.specs_media_dto(existing),'bucket',existing.bucket,'object_key',existing.object_key);
end $$;
create function eps.complete_job_output(p_input jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs; asset eps.media_assets; changed bigint; begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','asset_id','sha256','actual_size_bytes','width','height','duration_ms']));
 job:=eps.specs_assets_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 select * into asset from eps.media_assets a where a.id=eps.input_uuid(p_input->>'asset_id') and a.producing_job_id=job.id and a.producing_attempt_id=job.current_attempt_id;
 if not found or asset.purpose<>'document_text' or asset.source_asset_id is distinct from job.input_asset_id or asset.output_stage<>job.stage
 then perform eps.fail('RESOURCE_NOT_FOUND','This output does not belong to the active stage.',404); end if;
 if jsonb_typeof(p_input->'sha256') is distinct from 'string' or p_input->>'sha256'!~'^[a-f0-9]{64}$'
  or eps.logo_integer(p_input->'actual_size_bytes',1,20971520)<>asset.size_bytes
  or p_input->'width' is distinct from 'null'::jsonb or p_input->'height' is distinct from 'null'::jsonb or p_input->'duration_ms' is distinct from 'null'::jsonb
 then perform eps.fail('INVALID_REQUEST','The verified derivative metadata does not match the reservation.',400); end if;
 if asset.status='ready' then
  if asset.sha256 is distinct from p_input->>'sha256' then perform eps.fail('IDEMPOTENCY_KEY_REUSED','This output was completed with different bytes.',409); end if;
  return eps.specs_media_dto(asset);
 end if;
 select * into asset from eps.media_assets a where a.id=asset.id for update;
 if asset.status<>'uploading' then perform eps.fail('INVALID_TRANSITION','This output is not awaiting verification.',409); end if;
 -- Only the trusted native service may invoke this operation. Its adapter has
 -- independently re-downloaded and hashed actual stored bytes before this call.
 update eps.media_assets set status='ready',sha256=p_input->>'sha256' where id=asset.id and status='uploading';
 get diagnostics changed=row_count; if changed<>1 then perform eps.fail('STAGE_STATE_INVALID','The derivative was not marked Ready.',409); end if;
 select * into asset from eps.media_assets a where a.id=eps.input_uuid(p_input->>'asset_id');
 if asset.status<>'ready' or asset.sha256 is distinct from p_input->>'sha256' or not eps.specs_assets_live(job.id,job.current_attempt_id,job.input_hash)
 then perform eps.fail('STAGE_STATE_INVALID','The verified derivative was not stored completely.',409); end if;
 return eps.specs_media_dto(asset);
end $$;

create function eps.specs_utf16_length(p_text text) returns bigint
language sql immutable strict security invoker set search_path='' as $$
 -- One linear Unicode regex pass. Repeated UTF8 substring-by-position would
 -- rescan prefixes quadratically at the supported 2M-character limit.
 select char_length(p_text)::bigint+regexp_count(p_text collate "C",'['||chr(65536)||'-'||chr(1114111)||']')::bigint
$$;
create function eps.specs_validate_file_preparation(p_job eps.jobs,p_asset eps.media_assets,p_payload_utf8 text) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare prepared jsonb; paragraph jsonb; ordinal_value bigint:=0; character_cursor integer:=1; utf16_cursor bigint:=0;
 paragraph_text text; gap text; remaining text; occurrence integer; expected_page bigint; previous_page bigint:=0; text_value text; field text;
begin
 perform eps.specs_stage_assert(p_job.input_asset_id is not null and p_asset.purpose='document_text'
  and p_asset.producing_job_id=p_job.id and p_asset.source_asset_id=p_job.input_asset_id and p_asset.status='ready' and p_asset.output_stage='prepare_document'
  and octet_length(p_payload_utf8) between 1 and 20971520 and octet_length(p_payload_utf8)=p_asset.size_bytes
  and p_asset.sha256=encode(sha256(convert_to(p_payload_utf8,'UTF8')),'hex'),'RESULT_INVALID');
 if p_job.stage='prepare_document' then
  perform eps.specs_stage_assert(p_asset.producing_attempt_id=p_job.current_attempt_id,'RESULT_INVALID');
 else
  perform eps.specs_stage_assert(p_job.stage in('extract_specs','apply_specs') and exists(select 1 from eps.specs_stage_payloads staged
   where staged.job_id=p_job.id and staged.stage='prepare_document' and staged.attempt_id=p_asset.producing_attempt_id
    and staged.input_hash=p_job.input_hash and staged.result->>'text_asset_id'=p_asset.id::text),'RESULT_INVALID');
 end if;
 begin prepared:=p_payload_utf8::jsonb; exception when others then perform eps.specs_stage_assert(false,'RESULT_INVALID'); end;
 perform eps.specs_stage_assert(eps.specs_stage_shape(prepared,array['schema_version','sourceAssetId','sourceSha256','text','paragraphs','extractionMethod','warnings'])
  and prepared->>'schema_version'='document-text-v1' and prepared->>'sourceAssetId'=p_job.input_asset_id::text
  and prepared->>'sourceSha256'=p_job.input->>'source_hash' and jsonb_typeof(prepared->'text')='string'
  and length(prepared->>'text') between 1 and 2000000 and jsonb_typeof(prepared->'paragraphs')='array'
  and jsonb_array_length(prepared->'paragraphs') between 1 and 10000 and eps.specs_stage_strings(prepared->'warnings')
  and jsonb_array_length(prepared->'warnings')<=200,'RESULT_INVALID');
 text_value:=prepared->>'text';
 perform eps.specs_stage_assert(position(E'\r' in text_value)=0
  and text_value!~('['||chr(1)||'-'||chr(8)||chr(11)||chr(12)||chr(14)||'-'||chr(31)||']'),'RESULT_INVALID');
 for paragraph in select value from jsonb_array_elements(prepared->'paragraphs') loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(paragraph,array['index','page','start','end','text'])
   and paragraph->'index'=to_jsonb(ordinal_value) and eps.specs_stage_integer(paragraph->'start',0,4000000)
   and eps.specs_stage_integer(paragraph->'end',1,4000000) and jsonb_typeof(paragraph->'text')='string'
   and eps.specs_stage_nonblank(paragraph->>'text'),'RESULT_INVALID');
  paragraph_text:=paragraph->>'text'; remaining:=substring(text_value from character_cursor);
  occurrence:=position(paragraph_text in remaining);
  perform eps.specs_stage_assert(occurrence>0,'RESULT_INVALID'); gap:=substring(remaining from 1 for occurrence-1);
  perform eps.specs_stage_assert(not eps.specs_stage_nonblank(gap),'RESULT_INVALID');
  utf16_cursor:=utf16_cursor+eps.specs_utf16_length(gap);
  perform eps.specs_stage_assert(paragraph->'start'=to_jsonb(utf16_cursor),'RESULT_INVALID');
  utf16_cursor:=utf16_cursor+eps.specs_utf16_length(paragraph_text);
  perform eps.specs_stage_assert(paragraph->'end'=to_jsonb(utf16_cursor),'RESULT_INVALID');
  character_cursor:=character_cursor+occurrence-1+length(paragraph_text);
  if prepared->>'extractionMethod'='pdf_text' then
   perform eps.specs_stage_assert(eps.specs_stage_integer(paragraph->'page',1,200),'RESULT_INVALID');
   expected_page:=(paragraph->>'page')::bigint;
   perform eps.specs_stage_assert(expected_page>=previous_page,'RESULT_INVALID'); previous_page:=expected_page;
  else perform eps.specs_stage_assert(paragraph->'page'='null'::jsonb,'RESULT_INVALID'); end if;
  ordinal_value:=ordinal_value+1;
 end loop;
 perform eps.specs_stage_assert(not eps.specs_stage_nonblank(substring(text_value from character_cursor))
  and prepared->>'extractionMethod' in('plain_text','pdf_text','docx_text'),'RESULT_INVALID');
 foreach field in array array['schema_version','sourceAssetId','sourceSha256','text','extractionMethod'] loop
  perform eps.specs_stage_assert(jsonb_typeof(prepared->field)='string','RESULT_INVALID');
 end loop;
 return prepared;
end $$;
create function eps.store_specs_preparation(p_input jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs; asset eps.media_assets; original_mime text; prepared jsonb; existing eps.specs_file_preparations; changed bigint; begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','asset_id','payload_utf8']));
 job:=eps.specs_assets_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 if job.stage<>'prepare_document' or job.input_asset_id is null or jsonb_typeof(p_input->'payload_utf8') is distinct from 'string'
 then perform eps.fail('INVALID_REQUEST','This stage does not accept a private document preparation.',400); end if;
 select * into asset from eps.media_assets a where a.id=eps.input_uuid(p_input->>'asset_id') and a.origin_workspace_id=job.workspace_id;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Prepared derivative not found.',404); end if;
 prepared:=eps.specs_validate_file_preparation(job,asset,p_input->>'payload_utf8');
 select a.mime_type into original_mime from eps.media_assets a where a.id=job.input_asset_id and a.purpose='specs' and a.status='ready';
 if prepared->>'extractionMethod' is distinct from (case original_mime when 'application/pdf' then 'pdf_text'
  when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx_text' when 'text/plain' then 'plain_text' else null end)
 then perform eps.fail('RESULT_INVALID','Prepared document format does not match its verified original.',409); end if;
 select * into existing from eps.specs_file_preparations p where p.job_id=job.id and p.attempt_id=job.current_attempt_id;
 if found then
  if existing.input_hash<>job.input_hash or existing.asset_id<>asset.id or existing.payload_utf8 is distinct from p_input->>'payload_utf8'
  then perform eps.fail('EVENT_ID_CONFLICT','This attempt already stored different document preparation.',409); end if;
 else
  insert into eps.specs_file_preparations(job_id,attempt_id,input_hash,asset_id,payload_utf8)
  values(job.id,job.current_attempt_id,job.input_hash,asset.id,p_input->>'payload_utf8');
  get diagnostics changed=row_count; if changed<>1 then perform eps.fail('STAGE_STATE_INVALID','Private document preparation was not stored.',409); end if;
 end if;
 if not exists(select 1 from eps.specs_file_preparations p where p.job_id=job.id and p.attempt_id=job.current_attempt_id
  and p.asset_id=asset.id and p.input_hash=job.input_hash and p.payload_utf8=p_input->>'payload_utf8')
  or not eps.specs_assets_live(job.id,job.current_attempt_id,job.input_hash)
 then perform eps.fail('STAGE_STATE_INVALID','Private document preparation was not stored completely.',409); end if;
 return jsonb_build_object('stored',true);
end $$;

create function eps.specs_generated_clarifications(p_role jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$ declare result jsonb; begin
 select coalesce(jsonb_agg(value||jsonb_build_object('resolved',false) order by ordinal),'[]') into result
 from jsonb_array_elements(p_role->'clarifications') with ordinality entries(value,ordinal);
 if p_role->'headcount'='null' and not exists(select 1 from jsonb_array_elements(result) where value->>'field_path'='headcount') then
  result:=result||jsonb_build_array(jsonb_build_object('field_path','headcount','reason','Headcount is not known. The single slot is provisional.','source',null,'resolved',false));
 end if;
 if coalesce(p_role->>'name','')='' and not exists(select 1 from jsonb_array_elements(result) where value->>'field_path'='name') then
  result:=result||jsonb_build_array(jsonb_build_object('field_path','name','reason','Role name is not provided.','source',null,'resolved',false));
 end if; return result;
end $$;
create function eps.specs_machine_baseline(p_spec eps.specs) returns boolean
language plpgsql volatile security invoker set search_path='' as $$
declare role_value jsonb; data_role eps.roles; expected_clarifications jsonb; role_index bigint:=0; expected_slots bigint; role_count bigint;
begin
 if p_spec.source_extraction is null or p_spec.source_extraction_job_id is null or to_regclass('eps.assignments') is not null then return false; end if;
 if p_spec.normalized_instructions is distinct from p_spec.source_extraction->>'general_instructions'
  or p_spec.source_language_codes is distinct from array(select jsonb_array_elements_text(p_spec.source_extraction->'source_language_codes')) then return false; end if;
 select coalesce(jsonb_agg(value||jsonb_build_object('resolved',false) order by ordinal),'[]') into expected_clarifications
 from jsonb_array_elements(p_spec.source_extraction->'clarifications') with ordinality entries(value,ordinal);
 if p_spec.clarifications is distinct from expected_clarifications then return false; end if;
 select count(*) into role_count from eps.roles r where r.workspace_id=p_spec.workspace_id and r.archived_at is null;
 if role_count<>jsonb_array_length(p_spec.source_extraction->'roles') then return false; end if;
 for role_value in select value from jsonb_array_elements(p_spec.source_extraction->'roles') loop
  select * into data_role from eps.roles r where r.workspace_id=p_spec.workspace_id and r.spec_id=p_spec.id and r.archived_at is null and r.sort_order=role_index;
  if not found or data_role.source_job_id is distinct from p_spec.source_extraction_job_id or data_role.source_role is distinct from role_value
   or data_role.row_version<>1 or data_role.name is distinct from coalesce(role_value->>'name','')
   or data_role.headcount is distinct from (role_value->>'headcount')::bigint or data_role.category is distinct from role_value->>'category'
   or data_role.requirements is distinct from role_value->'requirements' or data_role.clarifications is distinct from eps.specs_generated_clarifications(role_value)
  then return false; end if;
  expected_slots:=coalesce((role_value->>'headcount')::bigint,1);
  if (select count(*) from eps.slots s where s.role_id=data_role.id and s.archived_at is null)<>expected_slots
   or exists(select 1 from eps.slots s where s.role_id=data_role.id and s.archived_at is null and (s.workspace_id<>p_spec.workspace_id
    or s.ordinal not between 1 and expected_slots or s.sort_order<>s.ordinal-1 or s.row_version<>1
    or s.label is distinct from coalesce(nullif(role_value->>'name',''),'Slot')||' '||s.ordinal
    or s.provisional is distinct from (role_value->'headcount'='null'::jsonb)))
  then return false; end if;
  role_index:=role_index+1;
 end loop;
 return not exists(select 1 from eps.slots s where s.workspace_id=p_spec.workspace_id and s.archived_at is null
  and not exists(select 1 from eps.roles r where r.id=s.role_id and r.workspace_id=p_spec.workspace_id and r.archived_at is null));
end $$;

-- GENERATED FILE-AWARE VALIDATION AND ENQUEUE
-- The fixed file enqueue branch parses the actual source asset UUID.
grant execute on function eps.input_uuid(text) to eps_jobs_owner;
create function eps.specs_document_reference(p_value jsonb,p_paragraphs jsonb,p_source_asset uuid) returns void language plpgsql immutable security invoker set search_path='' as $$
declare matching jsonb; begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['asset_id','page','paragraph','segment_index','start_ms','end_ms','quote'])
  and p_source_asset is not null and p_value->'asset_id'=to_jsonb(p_source_asset)
  and p_value->'segment_index'='null'::jsonb and p_value->'start_ms'='null'::jsonb and p_value->'end_ms'='null'::jsonb
  and (p_value->'page'='null'::jsonb or eps.specs_stage_integer(p_value->'page',1,200))
  and (p_value->'paragraph'='null'::jsonb or eps.specs_stage_integer(p_value->'paragraph',0,9999))
  and (p_value->'page'<>'null'::jsonb or p_value->'paragraph'<>'null'::jsonb) and eps.specs_stage_text(p_value->'quote',true),'RESULT_INVALID');
 select jsonb_agg(entries.value) into matching from jsonb_array_elements(p_paragraphs) entries(value)
  where (p_value->'paragraph'='null'::jsonb or entries.value->'index'=p_value->'paragraph') and (p_value->'page'='null'::jsonb or entries.value->'page'=p_value->'page');
 perform eps.specs_stage_assert(matching is not null and (p_value->'quote'='null'::jsonb or eps.specs_stage_nonblank(p_value->>'quote')
  and exists(select 1 from jsonb_array_elements(matching) entries(value) where position(p_value->>'quote' in entries.value->>'text')>0)),'RESULT_INVALID');
end $$;

create function eps.specs_document_clarifications(p_value jsonb,p_paragraphs jsonb,p_source_asset uuid) returns void language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb; begin
 perform eps.specs_stage_assert(jsonb_typeof(p_value)='array','RESULT_INVALID');
 for item in select value from jsonb_array_elements(p_value) loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(item,array['field_path','reason','source'],array['field_path','reason','source'])
   and eps.specs_stage_text(item->'field_path') and length(item->>'field_path')>0 and eps.specs_stage_text(item->'reason') and length(item->>'reason')>0,'RESULT_INVALID');
  if item->'source'<>'null'::jsonb then perform eps.specs_document_reference(item->'source',p_paragraphs,p_source_asset); end if;
 end loop;
end $$;

create function eps.specs_document_extract(p_value jsonb,p_paragraphs jsonb,p_source_asset uuid) returns void language plpgsql immutable security invoker set search_path='' as $$
declare role_value jsonb; requirements jsonb; reference jsonb; field text; begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['schema_version','source_asset_id','source_language_codes','roles','general_instructions','clarifications'],array['schema_version','source_asset_id','source_language_codes','roles','general_instructions','clarifications'])
  and p_value->>'schema_version'='1.0' and p_source_asset is not null and p_value->'source_asset_id'=to_jsonb(p_source_asset) and eps.specs_stage_strings(p_value->'source_language_codes')
  and jsonb_typeof(p_value->'roles')='array' and eps.specs_stage_text(p_value->'general_instructions',true),'RESULT_INVALID');
 perform eps.specs_document_clarifications(p_value->'clarifications',p_paragraphs,p_source_asset);
 perform eps.specs_stage_assert(not exists(select 1 from jsonb_array_elements(p_value->'roles') entries(value) group by entries.value->>'source_role_key' having count(*)>1),'RESULT_INVALID');
 for role_value in select value from jsonb_array_elements(p_value->'roles') loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(role_value,array['source_role_key','name','headcount','category','requirements','evidence','clarifications'],array['source_role_key','name','headcount','category','requirements','evidence','clarifications'])
   and eps.specs_stage_text(role_value->'source_role_key') and length(role_value->>'source_role_key')>0 and eps.specs_stage_text(role_value->'name',true)
   and eps.specs_stage_text(role_value->'category',true) and (role_value->'headcount'='null'::jsonb or eps.specs_stage_integer(role_value->'headcount',1))
   and jsonb_typeof(role_value->'evidence')='array'
   and eps.specs_stage_nonblank(role_value->>'source_role_key'),'RESULT_INVALID');
  perform eps.specs_stage_assert(jsonb_array_length(role_value->'evidence')>0,'RESULT_INVALID');
  requirements:=role_value->'requirements';
  perform eps.specs_stage_assert(eps.specs_stage_shape(requirements,array['age_range','gender_requirement','appearance_performance','languages','accents','skills','scene_references','shoot_dates','location','availability_requirements','other_instructions'],array['age_range','gender_requirement','appearance_performance','languages','accents','skills','scene_references','shoot_dates','location','availability_requirements','other_instructions']),'RESULT_INVALID');
  foreach field in array array['age_range','gender_requirement','appearance_performance','location','availability_requirements','other_instructions'] loop
   perform eps.specs_stage_assert(eps.specs_stage_text(requirements->field,true),'RESULT_INVALID'); end loop;
  foreach field in array array['languages','accents','skills','scene_references','shoot_dates'] loop
   perform eps.specs_stage_assert(eps.specs_stage_strings(requirements->field),'RESULT_INVALID'); end loop;
  for reference in select value from jsonb_array_elements(role_value->'evidence') loop perform eps.specs_document_reference(reference,p_paragraphs,p_source_asset); end loop;
  perform eps.specs_document_clarifications(role_value->'clarifications',p_paragraphs,p_source_asset);
 end loop;
end $$;

create function eps.specs_document_prepared_hash(p_source_asset uuid,p_paragraphs jsonb) returns text language sql immutable security invoker set search_path='' as $$
 select encode(sha256(convert_to('{"source_asset_id":'||coalesce(to_json(p_source_asset)::text,'null')||',"paragraphs":['||coalesce(string_agg(
  '{"index":'||(item->>'index')||',"page":'||coalesce((item->'page')::text,'null')||',"text":'||to_json(item->>'text')::text||'}',',' order by ordinal),'')||']}', 'UTF8')),'hex')
 from jsonb_array_elements(p_paragraphs) with ordinality entries(item,ordinal)
$$;

create or replace function eps.specs_stage_metadata(p_value jsonb,p_job eps.jobs,p_paragraphs jsonb) returns void language plpgsql immutable security invoker set search_path='' as $$
declare field text; usage_value jsonb; begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['provider','sdk_version','requested_model','resolved_model','response_id','request_id','correlation_id','input_sha256','prepared_source_sha256','prompt_version','prompt_sha256','schema_version','schema_sha256','provider_schema_sha256','usage'],array['provider','sdk_version','requested_model','resolved_model','response_id','request_id','correlation_id','input_sha256','prepared_source_sha256','prompt_version','prompt_sha256','schema_version','schema_sha256','provider_schema_sha256','usage'])
  and p_value->>'provider'='openai' and p_value->>'sdk_version'='7.45.1' and p_value->>'schema_version'='1.0'
  and p_value->>'input_sha256'=p_job.input_hash and p_value->>'prepared_source_sha256'=eps.specs_document_prepared_hash(p_job.input_asset_id,p_paragraphs)
  and p_value->>'requested_model'=p_job.input#>>'{configuration,model_version}'
  and p_value->>'prompt_version'=p_job.input#>>'{configuration,prompt_version}' and p_value->>'correlation_id'=p_job.correlation_id,'RESULT_INVALID');
 perform eps.specs_stage_assert(p_value->>'prompt_version'='spec_extract_v1.0.0'
  and p_value->>'prompt_sha256'='ab03fd026edb3d139fd93fdd51cb475474d6c4e3c8f6395b65014574e7e29eee'
  and p_value->>'schema_sha256'='e8ffee51eee20f687abbfc12c2476248ccb5a59c1122fde418bc89db3ff58085'
  and p_value->>'provider_schema_sha256'='d73a11450f2714c5649ab9a663f0a3483f68feefd1f482bc62575a9a608a1216','RESULT_INVALID');
 foreach field in array array['requested_model','resolved_model','response_id','correlation_id','prompt_version'] loop
  perform eps.specs_stage_assert(jsonb_typeof(p_value->field)='string' and (p_value->>field)~'^[A-Za-z0-9._:-]{1,200}$','RESULT_INVALID'); end loop;
 perform eps.specs_stage_assert(p_value->'request_id'='null' or jsonb_typeof(p_value->'request_id')='string' and (p_value->>'request_id')~'^[A-Za-z0-9._:-]{1,200}$','RESULT_INVALID');
 foreach field in array array['prompt_sha256','schema_sha256','provider_schema_sha256'] loop
  perform eps.specs_stage_assert(jsonb_typeof(p_value->field)='string' and (p_value->>field)~'^[a-f0-9]{64}$','RESULT_INVALID'); end loop;
 usage_value:=p_value->'usage';
 if usage_value<>'null' then
  perform eps.specs_stage_assert(eps.specs_stage_shape(usage_value,array['input_tokens','output_tokens','total_tokens'],array['input_tokens','output_tokens','total_tokens'])
   and eps.specs_stage_integer(usage_value->'input_tokens') and eps.specs_stage_integer(usage_value->'output_tokens') and eps.specs_stage_integer(usage_value->'total_tokens'),'RESULT_INVALID');
 end if;
end $$;

create or replace function eps.specs_stage_source_matches(p_job eps.jobs) returns boolean language sql volatile security invoker set search_path='' as $$
 select exists(select 1 from eps.specs s join eps.specs_source_inputs r on r.job_id=p_job.id and r.workspace_id=s.workspace_id and r.spec_id=s.id
  left join eps.media_assets a on a.id=r.source_asset_id and a.origin_workspace_id=r.workspace_id
  where s.id=p_job.resource_id and s.workspace_id=p_job.workspace_id and s.processing_job_id=p_job.id
   and s.id::text=p_job.input->>'specs_id' and s.source_row_version::text=p_job.input->>'source_row_version'
   and r.source_row_version=s.source_row_version and r.source_hash=p_job.input->>'source_hash' and r.input_hash=p_job.input_hash
   and p_job.input_hash_version='eps.specs-input.pg-jsonb.v1' and eps.jobs_hash_v1(p_job.input)=p_job.input_hash
   and (r.source_asset_id is null and p_job.input_asset_id is null and s.source_asset_id is null and s.source_text is not null
     and p_job.input->>'schema_version'='1.0' and r.source_text=s.source_text and encode(sha256(convert_to(r.source_text,'UTF8')),'hex')=r.source_hash
    or r.source_asset_id is not null and s.source_text is null and r.source_text is null and s.source_asset_id=r.source_asset_id
     and p_job.input_asset_id=r.source_asset_id and p_job.input->>'source_asset_id'=r.source_asset_id::text and p_job.input->>'schema_version'='1.1'
     and a.purpose='specs' and a.status='ready' and a.sha256=r.source_hash and a.mime_type=r.source_mime_type and a.size_bytes=r.source_size_bytes))
$$;

create or replace function eps.m02_enqueue_specs_job(p_workspace_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare job eps.jobs; payload jsonb; response jsonb; fingerprint text; dedupe text; source uuid; workspace_version bigint; version bigint; item text; headers jsonb; correlation text;
begin
  perform set_config('eps.jobs.mode','user',true); perform eps.require_capability('workspaces.write');
  if not eps.jobs_can_access(p_workspace_id,'enqueue') then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  perform eps.check_input(p_input,array['schema_version','specs_id','source_hash','source_row_version','workspace_row_version','configuration','source_asset_id']);
  if p_input->>'schema_version' is distinct from (case when p_input?'source_asset_id' then '1.1' else '1.0' end) or jsonb_typeof(p_input->'specs_id') is distinct from 'string'
    or jsonb_typeof(p_input->'source_hash') is distinct from 'string' or p_input->>'source_hash'!~'^[a-f0-9]{64}$'
  then perform eps.fail('INVALID_REQUEST','Invalid frozen specs references.',400); end if;
  begin source:=(p_input->>'specs_id')::uuid; exception when others then perform eps.fail('INVALID_REQUEST','Invalid specs identity.',400); end;
  foreach item in array array['source_row_version','workspace_row_version'] loop
    if jsonb_typeof(p_input->item) is distinct from 'number' or (p_input->item)::text!~'^[1-9][0-9]{0,15}$' or (p_input->>item)::numeric>9007199254740991
    then perform eps.fail('INVALID_REQUEST','Invalid source/workspace version.',400); end if;
  end loop;
  perform eps.check_input(p_input->'configuration',array['document_preparation_version','model_version','prompt_version','result_schema_version']);
  foreach item in array array['document_preparation_version','model_version','prompt_version','result_schema_version'] loop
    if jsonb_typeof(p_input->'configuration'->item) is distinct from 'string' or length(p_input->'configuration'->>item) not between 1 and 200
    then perform eps.fail('INVALID_REQUEST','Versioned processing configuration is required.',400); end if;
  end loop;
  if p_idempotency_key is null then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key required.',400); end if;
  payload:=jsonb_build_object('workspace_id',p_workspace_id,'input',p_input);
  response:=eps.idempotency_begin('jobs.enqueue',p_idempotency_key,payload);
  -- A blocking advisory lock can outlive a permission change. Use a fresh
  -- READ COMMITTED command snapshot before disclosing any cached response.
  if not eps.jobs_can_access(p_workspace_id,'enqueue') then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  if response is not null then return response; end if;
  select row_version into workspace_version from eps.workspaces where id=p_workspace_id;
  version:=(p_input->>'workspace_row_version')::bigint;
  if workspace_version is distinct from version then perform eps.fail('STALE_RESOURCE_VERSION','Workspace changed.',409,workspace_version); end if;
  fingerprint:=eps.jobs_hash_v1(p_input); dedupe:=encode(sha256(convert_to('specs_extract:'||p_workspace_id::text||':'||fingerprint,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended('eps:jobs:dedupe:'||dedupe,0));
  if not eps.jobs_can_access(p_workspace_id,'enqueue') then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  select * into job from eps.jobs existing where existing.dedupe_key=dedupe;
  if found then return eps.jobs_remember('jobs.enqueue',p_idempotency_key,payload,eps.jobs_dto(job.id)); end if;
  begin headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb; exception when others then headers:='{}'; end;
  correlation:=headers->>'x-eps-request-id'; if correlation is null or correlation!~'^[A-Za-z0-9._:-]{1,128}$' then correlation:=gen_random_uuid()::text; end if;
  insert into eps.jobs(workspace_id,requested_by,kind,resource_id,input_asset_id,input,input_hash,dedupe_key,correlation_id)
    values(p_workspace_id,auth.uid(),'specs_extract',source,case when p_input?'source_asset_id' then eps.input_uuid(p_input->>'source_asset_id') else null end,p_input,fingerprint,dedupe,correlation) returning * into job;
  perform eps.jobs_add_dispatch(job);
  return eps.finish_mutation('jobs.enqueue',p_idempotency_key,payload,eps.jobs_dto(job.id),job.id);
end $$;

create function eps.specs_submit_retain_asset(p_job_id uuid,p_asset_id uuid) returns void language plpgsql volatile security invoker set search_path='' as $$
declare j record; a eps.media_assets; changed bigint; begin
 select id,workspace_id,requested_by,kind,input_asset_id,input,input_hash,resource_id into j from eps.jobs where id=p_job_id and requested_by=auth.uid() and kind='specs_extract';
 select * into a from eps.media_assets where id=p_asset_id and purpose='specs' and status='ready' and origin_workspace_id=j.workspace_id;
 if not found or j.input_asset_id is distinct from a.id or j.input->>'source_asset_id' is distinct from a.id::text
  or j.input->>'source_hash' is distinct from a.sha256 or j.input_hash is distinct from eps.jobs_hash_v1(j.input) or not eps.specs_scope(j.workspace_id,true)
 then perform eps.fail('SPECS_STATE_INVALID','The immutable original asset does not match its job.',409); end if;
 insert into eps.specs_source_inputs(job_id,workspace_id,spec_id,source_row_version,source_hash,input_hash,source_asset_id,source_mime_type,source_size_bytes)
 values(j.id,j.workspace_id,j.resource_id,(j.input->>'source_row_version')::bigint,a.sha256,j.input_hash,a.id,a.mime_type,a.size_bytes);
 get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
 if not exists(select 1 from eps.specs_source_inputs r where r.job_id=j.id and r.source_asset_id=a.id and r.source_text is null
  and r.source_hash=a.sha256 and r.input_hash=j.input_hash and r.source_mime_type=a.mime_type and r.source_size_bytes=a.size_bytes)
 then perform eps.fail('SPECS_STATE_INVALID','The immutable original asset was not retained completely.',409); end if;
end $$;

create or replace function public.eps_submit_specs(p_workspace_id uuid,p_input jsonb,p_idempotency_key text default null) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare spec_row eps.specs; config_row eps.specs_pipeline_config; workspace_row record; current_job record; retained_row eps.specs_source_inputs; selected_asset eps.media_assets;
 payload jsonb; configuration jsonb; frozen jsonb; dto jsonb; result jsonb; cached jsonb; submitted_text text; submitted_asset uuid;
 source_hash text; internal_key text; accepted_job_id uuid; changed bigint; next_source_epoch bigint; source_changed boolean;
begin
 perform set_config('eps.jobs.mode','user',true); perform eps.require_capability('workspaces.write');
 perform eps.check_input(p_input,array['source_asset_id','source_text','row_version']);
 if octet_length(p_input::text)>65536 or (p_input?'source_asset_id')=(p_input?'source_text') then perform eps.fail('INVALID_REQUEST','Provide one bounded original source.',400); end if;
 if p_input?'source_text' then
  if jsonb_typeof(p_input->'source_text') is distinct from 'string' then perform eps.fail('INVALID_REQUEST','Provide original text.',400); end if;
  submitted_text:=p_input->>'source_text'; perform eps.specs_submit_text(submitted_text);
 else
  if jsonb_typeof(p_input->'source_asset_id') is distinct from 'string' then perform eps.fail('INVALID_REQUEST','Provide an original asset identity.',400); end if;
  submitted_asset:=eps.input_uuid(p_input->>'source_asset_id');
 end if;
 if p_input?'row_version' then perform eps.expected_version(p_input); end if;
 if p_idempotency_key is null then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key is required.',400); end if;
 if length(p_idempotency_key) not between 16 and 200 then perform eps.fail('INVALID_REQUEST','Provide a bounded Idempotency-Key.',400); end if;
 if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 payload:=jsonb_build_object('id',p_workspace_id,'input',p_input);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':specs.submit_specs:'||p_idempotency_key,0));
 perform eps.specs_lock_workspace(p_workspace_id);
 select * into spec_row from eps.specs s where s.workspace_id=p_workspace_id for update;
 if not found then perform eps.fail('SPECS_STATE_INVALID','The source record is missing.',409); end if;
 perform eps.require_capability('workspaces.write');
 if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 cached:=eps.idempotency_begin('specs.submit_specs',p_idempotency_key,payload);
 perform eps.require_capability('workspaces.write');
 if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 if cached is not null then return cached; end if;
 select * into config_row from eps.specs_pipeline_config c where c.id=1;
 if not found or not config_row.enabled then perform eps.fail('DEPENDENCY_UNAVAILABLE','Specs processing is paused. Existing work was kept.',503); end if;
 configuration:=jsonb_build_object('document_preparation_version',config_row.document_preparation_version,'model_version',config_row.model_version,
  'prompt_version',config_row.prompt_version,'result_schema_version',config_row.result_schema_version);
 if submitted_asset is not null then
  if not exists(select 1 from eps.specs_asset_config where id=1 and file_pipeline_enabled) then perform eps.fail('FEATURE_NOT_IMPLEMENTED','File processing is not enabled.',503); end if;
  select * into selected_asset from eps.media_assets a where a.id=submitted_asset and a.origin_workspace_id=p_workspace_id and a.purpose='specs' and a.status='ready';
  if not found or selected_asset.sha256 is null then perform eps.fail('RESOURCE_NOT_FOUND','Verified original document not found in this workspace.',404); end if;
  source_hash:=selected_asset.sha256;
 else source_hash:=encode(sha256(convert_to(submitted_text,'UTF8')),'hex'); end if;
 if p_input?'row_version' then
  if eps.expected_version(p_input)<>spec_row.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Specs changed.',409,spec_row.row_version); end if;
 elsif spec_row.row_version<>1 or spec_row.source_row_version<>1 or spec_row.source_asset_id is not null or spec_row.source_text is not null
  or spec_row.normalized_instructions is not null or spec_row.clarifications<>'[]' or spec_row.source_extraction is not null
  or cardinality(spec_row.source_language_codes)<>0 or spec_row.processing_job_id is not null
  or exists(select 1 from eps.roles r where r.workspace_id=p_workspace_id) or exists(select 1 from eps.slots s where s.workspace_id=p_workspace_id)
 then perform eps.fail('INVALID_REQUEST','Provide current Spec.row_version for an existing source.',400); end if;
 if spec_row.source_text is not null or spec_row.source_asset_id is not null then
  select j.id,j.workspace_id,j.kind,j.resource_id,j.input_asset_id,j.input,j.input_hash into current_job from eps.jobs j where j.id=spec_row.processing_job_id;
  if not found or current_job.workspace_id<>p_workspace_id or current_job.resource_id<>spec_row.id or current_job.kind<>'specs_extract'
   or current_job.input->>'specs_id' is distinct from spec_row.id::text or current_job.input->'source_row_version' is distinct from to_jsonb(spec_row.source_row_version)
   or current_job.input_hash is distinct from eps.jobs_hash_v1(current_job.input) or current_job.input_asset_id is distinct from spec_row.source_asset_id
  then perform eps.fail('SPECS_STATE_INVALID','The current source job does not match this workspace.',409); end if;
  select * into retained_row from eps.specs_source_inputs r where r.job_id=current_job.id;
  if not found or retained_row.workspace_id<>p_workspace_id or retained_row.spec_id<>spec_row.id or retained_row.input_hash<>current_job.input_hash
   or retained_row.source_row_version<>spec_row.source_row_version or retained_row.source_asset_id is distinct from spec_row.source_asset_id
   or retained_row.source_text is distinct from spec_row.source_text or retained_row.source_hash is distinct from current_job.input->>'source_hash'
   or (spec_row.source_asset_id is null and (current_job.input->>'schema_version' is distinct from '1.0'
    or retained_row.source_hash is distinct from encode(sha256(convert_to(spec_row.source_text,'UTF8')),'hex')))
   or (spec_row.source_asset_id is not null and (current_job.input->>'schema_version' is distinct from '1.1'
    or current_job.input->>'source_asset_id' is distinct from spec_row.source_asset_id::text))
  then perform eps.fail('SPECS_STATE_INVALID','The current source is missing its exact immutable input.',409); end if;
  if spec_row.source_text is not distinct from submitted_text and spec_row.source_asset_id is not distinct from submitted_asset
   and current_job.input->'configuration'=configuration then
   result:=eps.specs_submit_ack(current_job.id,spec_row.id,p_workspace_id);
   perform eps.require_capability('workspaces.write');
   if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
   return eps.specs_submit_remember(p_idempotency_key,payload,result);
  end if;
 elsif spec_row.source_extraction is not null or cardinality(spec_row.source_language_codes)<>0 or spec_row.processing_job_id is not null or spec_row.source_row_version<>1 then
  perform eps.fail('SPECS_STATE_INVALID','Unknown existing provenance cannot be replaced.',409);
 end if;
 source_changed:=spec_row.source_text is distinct from submitted_text or spec_row.source_asset_id is distinct from submitted_asset;
 select row_version,draft_revision into workspace_row from eps.workspaces w where w.id=p_workspace_id;
 if spec_row.row_version>=9007199254740991 or workspace_row.row_version>=9007199254740991 or workspace_row.draft_revision>=9007199254740991
  or source_changed and spec_row.source_row_version>=9007199254740991 then perform eps.fail('SPECS_STATE_INVALID','A source version limit was reached.',409); end if;
 next_source_epoch:=spec_row.source_row_version+case when source_changed then 1 else 0 end;
 update eps.specs set source_asset_id=submitted_asset,source_text=submitted_text,source_row_version=next_source_epoch,row_version=spec_row.row_version+1,
  processing_job_id=null,updated_at=clock_timestamp() where id=spec_row.id and row_version=spec_row.row_version and source_row_version=spec_row.source_row_version;
 get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1); perform eps.specs_changed(p_workspace_id);
 if not exists(select 1 from eps.workspaces w where w.id=p_workspace_id and w.row_version=workspace_row.row_version+1 and w.draft_revision=workspace_row.draft_revision+1)
 then perform eps.fail('SPECS_STATE_INVALID','The source revision was not stored completely.',409); end if;
 frozen:=jsonb_build_object('schema_version',case when submitted_asset is null then '1.0' else '1.1' end,'specs_id',spec_row.id,'source_hash',source_hash,
  'source_row_version',next_source_epoch,'workspace_row_version',workspace_row.row_version+1,'configuration',configuration);
 if submitted_asset is not null then frozen:=frozen||jsonb_build_object('source_asset_id',submitted_asset); end if;
 internal_key:='specs.submit:'||encode(sha256(convert_to(p_idempotency_key,'UTF8')),'hex');
 dto:=eps.m02_enqueue_specs_job(p_workspace_id,frozen,internal_key); accepted_job_id:=eps.input_uuid(dto->>'id');
 if dto->>'workspace_id' is distinct from p_workspace_id::text or dto->>'resource_id' is distinct from spec_row.id::text or dto->>'status' is distinct from 'queued'
  or not exists(select 1 from eps.jobs j where j.id=accepted_job_id and j.workspace_id=p_workspace_id and j.resource_id=spec_row.id and j.kind='specs_extract'
   and j.requested_by=auth.uid() and j.input=frozen and j.input_hash=eps.jobs_hash_v1(frozen) and j.input_asset_id is not distinct from submitted_asset
   and j.status='queued' and j.stage='prepare_document' and j.attempt=0 and j.dispatch_generation=1)
  or (select count(*) from eps.outbox_events e where e.job_id=accepted_job_id and e.input_hash=eps.jobs_hash_v1(frozen) and e.stage='prepare_document' and e.dispatch_generation=1 and e.status='pending')<>1
  or (select count(*) from eps.audit_events e where e.principal_id=auth.uid() and e.action='jobs.enqueue' and e.resource_id=accepted_job_id)<>1
  or (select count(*) from eps.idempotency_records r where r.principal_id=auth.uid() and r.operation='jobs.enqueue' and r.key=internal_key
   and r.request_hash=encode(sha256(convert_to(jsonb_build_object('workspace_id',p_workspace_id,'input',frozen)::text,'UTF8')),'hex') and r.response=dto)<>1
 then perform eps.fail('SPECS_STATE_INVALID','The source, job and outbox were not stored atomically.',409); end if;
 if submitted_asset is null then perform eps.specs_submit_retain_source(accepted_job_id,submitted_text);
 else perform eps.specs_submit_retain_asset(accepted_job_id,submitted_asset); end if;
 update eps.specs set processing_job_id=accepted_job_id where id=spec_row.id and row_version=spec_row.row_version+1
  and source_row_version=next_source_epoch and processing_job_id is null and source_text is not distinct from submitted_text and source_asset_id is not distinct from submitted_asset;
 get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
 if not exists(select 1 from eps.specs s where s.id=spec_row.id and s.row_version=spec_row.row_version+1 and s.source_row_version=next_source_epoch
  and s.source_text is not distinct from submitted_text and s.source_asset_id is not distinct from submitted_asset and s.processing_job_id=accepted_job_id
  and s.normalized_instructions is not distinct from spec_row.normalized_instructions and s.clarifications=spec_row.clarifications
  and s.source_extraction is not distinct from spec_row.source_extraction and s.source_language_codes=spec_row.source_language_codes
  and s.source_extraction_job_id is not distinct from spec_row.source_extraction_job_id)
 then perform eps.fail('SPECS_STATE_INVALID','The current pointer and preserved facts were not stored completely.',409); end if;
 result:=eps.specs_submit_ack(accepted_job_id,spec_row.id,p_workspace_id);
 perform eps.specs_submit_remember(p_idempotency_key,payload,result); perform eps.specs_submit_audit(spec_row.id); perform eps.require_capability('workspaces.write');
 if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if; return result;
end $$;

-- FILE-AWARE SAFE MACHINE REPLACEMENT
-- Existing apply owner receives only retirement fields for exact generated rows.
grant update(archived_at,row_version,updated_at) on eps.roles,eps.slots to eps_specs_apply_owner;
create policy specs_apply_generated_role_archive on eps.roles for update to eps_specs_apply_owner
 using(source_job_id is not null and row_version=1 and archived_at is null)
 with check(source_job_id is not null and row_version=2 and archived_at is not null);
create policy specs_apply_generated_slot_archive on eps.slots for update to eps_specs_apply_owner
 using(row_version=1 and archived_at is null and exists(select 1 from eps.roles r where r.id=slots.role_id and r.source_job_id is not null))
 with check(row_version=2 and archived_at is not null);
create or replace function eps.specs_stage_apply(p_job eps.jobs) returns jsonb language plpgsql security definer set search_path='' as $$
declare spec eps.specs; saved eps.specs_stage_payloads; preparation eps.specs_stage_payloads; workspace_version bigint; workspace_draft bigint; extraction jsonb; role_value jsonb; frozen_source_text text;
 current_role_id uuid; role_index bigint:=0; slot_count bigint:=0; requested_slots numeric; count_value bigint; ordinal_value bigint; working_clarifications_value jsonb; changed bigint; marker_count bigint:=0; old_role_count bigint; old_slot_count bigint; archive_time timestamptz; old_roles jsonb; old_slots jsonb; prepared_asset eps.media_assets; pending eps.specs_file_preparations; checked_preparation jsonb;
begin
 -- Caller already holds workspace -> Spec -> job. Repeat exact binding under
 -- those locks; this helper never acquires job/outbox after child role locks.
 select row_version,draft_revision into workspace_version,workspace_draft from eps.workspaces where id=p_job.workspace_id for update;
 select * into spec from eps.specs where id=p_job.resource_id and workspace_id=p_job.workspace_id for update;
 perform eps.specs_stage_assert(found and eps.specs_stage_source_matches(p_job) and eps.specs_stage_can_write(p_job.requested_by,p_job.workspace_id),'INPUT_CHANGED');
 select source_text into frozen_source_text from eps.specs_source_inputs where job_id=p_job.id;
 perform eps.specs_stage_assert(found,'INPUT_CHANGED');
 perform 1 from eps.roles where workspace_id=p_job.workspace_id order by id for update;
 perform 1 from eps.slots where workspace_id=p_job.workspace_id order by id for update;
 perform eps.specs_stage_assert(workspace_version::text=p_job.input->>'workspace_row_version'
  and ((spec.normalized_instructions is null and spec.clarifications='[]' and spec.source_extraction is null and cardinality(spec.source_language_codes)=0
   and not exists(select 1 from eps.roles where workspace_id=p_job.workspace_id)
   and not exists(select 1 from eps.slots where workspace_id=p_job.workspace_id)) or eps.specs_machine_baseline(spec)),'INPUT_CHANGED');
 select * into saved from eps.specs_stage_payloads where job_id=p_job.id and stage='extract_specs' and input_hash=p_job.input_hash;
 perform eps.specs_stage_assert(found and saved.result_schema='specs-extraction-stage.v1','RESULT_INVALID');
 select * into preparation from eps.specs_stage_payloads where job_id=p_job.id and stage='prepare_document' and input_hash=p_job.input_hash;
 perform eps.specs_stage_assert(found,'RESULT_INVALID'); extraction:=saved.result->'result';
 if p_job.input_asset_id is null then
  perform eps.specs_stage_assert(preparation.paragraphs=eps.specs_stage_paragraphs(frozen_source_text)
   and preparation.prepared_text=replace(replace(frozen_source_text,E'\r\n',E'\n'),E'\r',E'\n'),'RESULT_INVALID');
  perform eps.specs_stage_extract(extraction,preparation.paragraphs);
 else
  select * into prepared_asset from eps.media_assets where id=(preparation.result->>'text_asset_id')::uuid;
  perform eps.specs_stage_assert(found,'RESULT_INVALID');
  select * into pending from eps.specs_file_preparations where job_id=p_job.id and attempt_id=preparation.attempt_id and asset_id=prepared_asset.id and input_hash=p_job.input_hash;
  perform eps.specs_stage_assert(found,'RESULT_INVALID'); checked_preparation:=eps.specs_validate_file_preparation(p_job,prepared_asset,pending.payload_utf8);
  perform eps.specs_stage_assert(preparation.prepared_text=checked_preparation->>'text' and preparation.paragraphs=checked_preparation->'paragraphs','RESULT_INVALID');
  perform eps.specs_document_extract(extraction,preparation.paragraphs,p_job.input_asset_id);
 end if;
 perform eps.specs_stage_metadata(saved.result->'metadata',p_job,preparation.paragraphs);
 select coalesce(sum(coalesce((value->>'headcount')::numeric,1)),0) into requested_slots from jsonb_array_elements(extraction->'roles');
 -- Same default budget as commitSpecsExtraction; no huge safe-integer loop.
 perform eps.specs_stage_assert(requested_slots<=1000,'SLOT_ALLOCATION_LIMIT_EXCEEDED');
 -- Archive only the exact untouched machine generation; retain every source
 -- and historical identity. No assignment adapter exists yet, so its presence
 -- disables replacement in specs_machine_baseline rather than guessing facts.
 select count(*) into old_role_count from eps.roles where workspace_id=p_job.workspace_id and archived_at is null;
 select count(*) into old_slot_count from eps.slots where workspace_id=p_job.workspace_id and archived_at is null;
 if old_role_count>0 or old_slot_count>0 then
  perform eps.specs_stage_assert(eps.specs_machine_baseline(spec),'INPUT_CHANGED'); archive_time:=clock_timestamp();
  select coalesce(jsonb_agg(to_jsonb(r)-array['archived_at','row_version','updated_at'] order by id),'[]') into old_roles from eps.roles r where workspace_id=p_job.workspace_id and archived_at is null;
  select coalesce(jsonb_agg(to_jsonb(r)-array['archived_at','row_version','updated_at'] order by id),'[]') into old_slots from eps.slots r where workspace_id=p_job.workspace_id and archived_at is null;
  update eps.slots set archived_at=archive_time,row_version=row_version+1,updated_at=archive_time where workspace_id=p_job.workspace_id and archived_at is null;
  get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=old_slot_count,'STAGE_STATE_INVALID');
  update eps.roles set archived_at=archive_time,row_version=row_version+1,updated_at=archive_time where workspace_id=p_job.workspace_id and archived_at is null;
  get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=old_role_count,'STAGE_STATE_INVALID');
  perform eps.specs_stage_assert((select jsonb_agg(to_jsonb(r)-array['archived_at','row_version','updated_at'] order by id) from eps.roles r where id in(select (value->>'id')::uuid from jsonb_array_elements(old_roles)))=old_roles
   and (old_slot_count=0 or (select jsonb_agg(to_jsonb(r)-array['archived_at','row_version','updated_at'] order by id) from eps.slots r where id in(select (value->>'id')::uuid from jsonb_array_elements(old_slots)))=old_slots)
   and not exists(select 1 from eps.roles r where id in(select (value->>'id')::uuid from jsonb_array_elements(old_roles)) and (archived_at is distinct from archive_time or row_version<>2 or updated_at is distinct from archive_time))
   and not exists(select 1 from eps.slots r where id in(select (value->>'id')::uuid from jsonb_array_elements(old_slots)) and (archived_at is distinct from archive_time or row_version<>2 or updated_at is distinct from archive_time)),'STAGE_STATE_INVALID');
 end if;
 for role_value in select value from jsonb_array_elements(extraction->'roles') with ordinality entries(value,ordinal) order by ordinal loop
  select coalesce(jsonb_agg(value||jsonb_build_object('resolved',false) order by ordinal),'[]') into working_clarifications_value from jsonb_array_elements(role_value->'clarifications') with ordinality entries(value,ordinal);
  if role_value->'headcount'='null' and not exists(select 1 from jsonb_array_elements(working_clarifications_value) where value->>'field_path'='headcount') then
   working_clarifications_value:=working_clarifications_value||jsonb_build_array(jsonb_build_object('field_path','headcount','reason','Headcount is not known. The single slot is provisional.','source',null,'resolved',false)); end if;
  if coalesce(role_value->>'name','')='' and not exists(select 1 from jsonb_array_elements(working_clarifications_value) where value->>'field_path'='name') then
   working_clarifications_value:=working_clarifications_value||jsonb_build_array(jsonb_build_object('field_path','name','reason','Role name is not provided.','source',null,'resolved',false)); end if;
  marker_count:=marker_count+jsonb_array_length(working_clarifications_value);
  insert into eps.roles(workspace_id,spec_id,name,headcount,category,requirements,clarifications,source_role,sort_order,source_job_id)
   values(p_job.workspace_id,spec.id,coalesce(role_value->>'name',''),(role_value->>'headcount')::bigint,role_value->>'category',role_value->'requirements',working_clarifications_value,role_value,role_index,p_job.id)
   returning id into current_role_id;
  get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
  count_value:=coalesce((role_value->>'headcount')::bigint,1);
  for ordinal_value in 1..count_value loop
   insert into eps.slots(workspace_id,role_id,ordinal,label,sort_order,provisional)
    values(p_job.workspace_id,current_role_id,ordinal_value,coalesce(nullif(role_value->>'name',''),'Slot')||' '||ordinal_value,ordinal_value-1,role_value->'headcount'='null');
   get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
  end loop;
  perform eps.specs_stage_assert(exists(select 1 from eps.roles where id=current_role_id and workspace_id=p_job.workspace_id and spec_id=spec.id
    and name=coalesce(role_value->>'name','') and headcount is not distinct from (role_value->>'headcount')::bigint
    and category is not distinct from role_value->>'category' and requirements=role_value->'requirements' and roles.clarifications=working_clarifications_value
    and source_role=role_value and source_job_id=p_job.id and sort_order=role_index and row_version=1 and archived_at is null)
   and (select count(*) from eps.slots where role_id=current_role_id)=count_value
   and not exists(select 1 from eps.slots where role_id=current_role_id and (workspace_id<>p_job.workspace_id or archived_at is not null or row_version<>1
    or ordinal not between 1 and count_value or sort_order<>ordinal-1 or label<>coalesce(nullif(role_value->>'name',''),'Slot')||' '||ordinal
    or provisional is distinct from (role_value->'headcount'='null'))),'STAGE_STATE_INVALID');
  role_index:=role_index+1; slot_count:=slot_count+count_value;
 end loop;
 select coalesce(jsonb_agg(value||jsonb_build_object('resolved',false) order by ordinal),'[]') into working_clarifications_value from jsonb_array_elements(extraction->'clarifications') with ordinality entries(value,ordinal);
 marker_count:=marker_count+jsonb_array_length(working_clarifications_value);
 update eps.specs set normalized_instructions=extraction->>'general_instructions',clarifications=working_clarifications_value,source_extraction=extraction,source_extraction_job_id=p_job.id,
  source_language_codes=array(select jsonb_array_elements_text(extraction->'source_language_codes')),row_version=row_version+1,updated_at=clock_timestamp()
  where id=spec.id and row_version=spec.row_version and processing_job_id=p_job.id;
 get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
 perform eps.specs_stage_assert(exists(select 1 from eps.specs current_spec where current_spec.id=spec.id and current_spec.workspace_id=p_job.workspace_id
  and current_spec.row_version=spec.row_version+1 and current_spec.source_text is not distinct from spec.source_text
  and current_spec.source_asset_id is not distinct from spec.source_asset_id and current_spec.source_row_version=spec.source_row_version
  and current_spec.processing_job_id=p_job.id and current_spec.normalized_instructions is not distinct from extraction->>'general_instructions'
  and current_spec.clarifications=working_clarifications_value and current_spec.source_extraction=extraction and current_spec.source_extraction_job_id=p_job.id
  and current_spec.source_language_codes=array(select jsonb_array_elements_text(extraction->'source_language_codes'))),'STAGE_STATE_INVALID');
 update eps.workspaces set row_version=row_version+1,draft_revision=draft_revision+1,has_unpublished_changes=true,updated_at=clock_timestamp()
  where id=p_job.workspace_id and row_version=workspace_version;
 get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
 perform eps.specs_stage_assert(exists(select 1 from eps.workspaces where id=p_job.workspace_id and row_version=workspace_version+1 and draft_revision=workspace_draft+1 and has_unpublished_changes)
  and (select count(*) from eps.roles where workspace_id=p_job.workspace_id and archived_at is null)=role_index
  and (select count(*) from eps.slots where workspace_id=p_job.workspace_id and archived_at is null)=slot_count,'STAGE_STATE_INVALID');
 insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type) values(p_job.requested_by,'jobs.apply_specs',spec.id,p_job.correlation_id,'api');
 get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
 perform eps.specs_stage_assert(eps.specs_stage_can_write(p_job.requested_by,p_job.workspace_id),'CAPABILITY_REQUIRED');
 return jsonb_build_object('specs_id',spec.id,'workspace_id',p_job.workspace_id,'role_count',role_index,'slot_count',slot_count,'clarification_count',marker_count);
end $$;
create or replace function eps.claim_job_stage(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare job eps.jobs; requested_job uuid; completed jsonb; token_value text; attempts integer; changed bigint; at_value timestamptz; begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','stage','input_hash','workflow_execution_id'],array['job_id','stage','input_hash']));
 perform eps.specs_stage_assert(jsonb_typeof(p_input->'job_id')='string' and (p_input->>'job_id')~'^[a-fA-F0-9-]{36}$'
  and p_input->>'stage' in('prepare_document','extract_specs','apply_specs') and (p_input->>'input_hash')~'^[a-f0-9]{64}$'
  and (not(p_input?'workflow_execution_id') or jsonb_typeof(p_input->'workflow_execution_id')='string' and length(p_input->>'workflow_execution_id') between 1 and 200));
 begin requested_job:=(p_input->>'job_id')::uuid; exception when invalid_text_representation then perform eps.fail('INVALID_REQUEST','Invalid processing job identifier.',400); end;
 job:=eps.specs_stage_lock(requested_job); at_value:=clock_timestamp();
 perform eps.specs_stage_configuration(job.input->'configuration');
 perform eps.specs_stage_assert(job.input_hash=p_input->>'input_hash','INPUT_HASH_MISMATCH');
 perform eps.specs_stage_assert(eps.specs_stage_source_matches(job),'INPUT_CHANGED');
 if job.status='cancelled' or job.cancel_requested_at is not null then perform eps.fail('JOB_CANCELLED','This job has been cancelled.',409); end if;
 select value into completed from jsonb_array_elements(job.completed_stages) where value->>'stage'=p_input->>'stage' and value->>'input_hash'=job.input_hash;
 if completed is not null then return jsonb_build_object('job_id',job.id,'stage',p_input->>'stage','attempt_id',completed->>'attempt_id',
  'lease_token','','lease_expires_at',completed->>'completed_at','already_completed',true,'input',jsonb_build_object('input_hash',job.input_hash,'result_schema',completed->>'result_schema','result',completed->'result')); end if;
 if job.input_asset_id is not null and not exists(select 1 from eps.specs_asset_config where id=1 and file_pipeline_enabled and capabilities_enabled) then perform eps.fail('DEPENDENCY_UNAVAILABLE','Private document processing is not ready.',503); end if;
 perform eps.specs_stage_assert(job.stage=p_input->>'stage','STAGE_OUT_OF_ORDER');
 if job.status='running' and job.lease_expires_at>at_value then perform eps.fail('JOB_ALREADY_RUNNING','This stage already has an active lease.',409); end if;
 perform eps.specs_stage_assert(job.status in('queued','running') and job.available_at<=at_value,'JOB_NOT_AVAILABLE');
 attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);
 if attempts>=3 then perform eps.fail('RETRY_EXHAUSTED','The bounded stage attempt budget is exhausted.',409); end if;
 token_value:=encode(extensions.gen_random_bytes(32),'hex');
 update eps.jobs set status='running',attempt=attempt+1,current_attempt_id=gen_random_uuid(),lease_token_digest=encode(sha256(convert_to(token_value,'UTF8')),'hex'),
  lease_expires_at=at_value+interval '90 seconds',heartbeat_at=at_value,last_event_sequence=0,stage_attempts=jsonb_set(stage_attempts,array[stage],to_jsonb(attempts+1)),
  progress_completed=0,progress_total=null,error=null,n8n_execution_id=p_input->>'workflow_execution_id',row_version=row_version+1,updated_at=at_value
  where id=job.id and row_version=job.row_version returning * into job;
 get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
 perform eps.specs_stage_assert(job.status='running' and job.stage=p_input->>'stage' and job.input_hash=p_input->>'input_hash'
  and job.current_attempt_id is not null and job.lease_token_digest=encode(sha256(convert_to(token_value,'UTF8')),'hex')
  and job.lease_expires_at=at_value+interval '90 seconds' and eps.specs_stage_source_matches(job),'STAGE_STATE_INVALID');
 return jsonb_build_object('job_id',job.id,'stage',job.stage,'attempt_id',job.current_attempt_id,'lease_token',token_value,'lease_expires_at',job.lease_expires_at,
  'already_completed',false,'input',job.input||jsonb_build_object('input_hash',job.input_hash,'previous_stage_results',job.completed_stages));
end $$;
create or replace function eps.get_specs_stage_input(p_job_id uuid,p_attempt_id uuid,p_lease_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare job eps.jobs; retained_source eps.specs_source_inputs; prepared eps.specs_stage_payloads; common jsonb; prepared_asset eps.media_assets; pending eps.specs_file_preparations; verified jsonb; begin
 perform eps.specs_stage_assert(p_job_id is not null and p_attempt_id is not null and length(p_lease_token) between 1 and 1024);
 job:=eps.specs_stage_lock(p_job_id);
 perform eps.specs_stage_configuration(job.input->'configuration');
 perform eps.specs_stage_assert(job.status='running' and job.cancel_requested_at is null and job.current_attempt_id=p_attempt_id and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(job.lease_token_digest=encode(sha256(convert_to(p_lease_token,'UTF8')),'hex'),'LEASE_INVALID');
 perform eps.specs_stage_assert(eps.specs_stage_source_matches(job),'INPUT_CHANGED');
 common:=jsonb_build_object('job_id',job.id,'attempt_id',job.current_attempt_id,'stage',job.stage,'input_hash',job.input_hash,'correlation_id',job.correlation_id);
 select * into retained_source from eps.specs_source_inputs where job_id=job.id;
 perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
 if job.stage='prepare_document' and job.input_asset_id is not null then return common||jsonb_build_object('source_kind','asset','source_asset_id',retained_source.source_asset_id,'source_sha256',retained_source.source_hash,'mime_type',retained_source.source_mime_type,'size_bytes',retained_source.source_size_bytes,'configuration',job.input->'configuration'); end if;
 if job.stage='prepare_document' then return common||jsonb_build_object('source_kind','pasted_text','source_asset_id',null,'source_text',retained_source.source_text,'source_sha256',retained_source.source_hash,'configuration',job.input->'configuration'); end if;
 if job.stage='extract_specs' then
  select * into prepared from eps.specs_stage_payloads where job_id=job.id and stage='prepare_document' and input_hash=job.input_hash;
  perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
  if job.input_asset_id is null then
   perform eps.specs_stage_assert(prepared.prepared_text=replace(replace(retained_source.source_text,E'\r\n',E'\n'),E'\r',E'\n')
    and prepared.paragraphs=eps.specs_stage_paragraphs(retained_source.source_text),'STAGE_STATE_INVALID');
  else
   select * into prepared_asset from eps.media_assets where id=(prepared.result->>'text_asset_id')::uuid;
   perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
   select * into pending from eps.specs_file_preparations where job_id=job.id and attempt_id=prepared.attempt_id and asset_id=prepared_asset.id and input_hash=job.input_hash;
   perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID'); verified:=eps.specs_validate_file_preparation(job,prepared_asset,pending.payload_utf8);
   perform eps.specs_stage_assert(prepared.prepared_text=verified->>'text' and prepared.paragraphs=verified->'paragraphs','STAGE_STATE_INVALID');
  end if;
  return common||jsonb_build_object('source_kind',case when job.input_asset_id is null then 'pasted_text' else 'asset' end,'source_asset_id',job.input_asset_id,'source_sha256',job.input->>'source_hash','text',prepared.prepared_text,'paragraphs',prepared.paragraphs,'configuration',job.input->'configuration');
 end if;
 if job.stage='apply_specs' then return common||jsonb_build_object('specs_id',job.resource_id,'workspace_id',job.workspace_id,'source_sha256',job.input->>'source_hash','configuration',job.input->'configuration'); end if;
 perform eps.fail('STAGE_OUT_OF_ORDER','This stage is not available.',409);
end $$;
create or replace function eps.record_job_event(p_event jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare job eps.jobs; previous eps.job_events; event_receipt_value jsonb; digest_value text; event_job uuid; event_attempt uuid; event_sequence bigint;
 at_value timestamptz; changed bigint; safe_error jsonb; attempts integer; hint numeric; wait_seconds numeric; body jsonb; spec eps.specs;
 prepared eps.specs_stage_payloads; payload_id uuid; normalized text; prepared_paragraphs_value jsonb; valid_result boolean:=true; schema_name text; completed jsonb; application_result jsonb; frozen_source_text text; prepared_asset eps.media_assets; pending eps.specs_file_preparations; verified jsonb;
begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_event,array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash','result_schema','result','error'],array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash'])
  and octet_length(p_event::text)<=294912);
 perform eps.specs_stage_assert(jsonb_typeof(p_event->'event_id')='string' and length(p_event->>'event_id') between 1 and 200
  and jsonb_typeof(p_event->'lease_token')='string' and length(p_event->>'lease_token') between 1 and 1024
  and jsonb_typeof(p_event->'job_id')='string' and jsonb_typeof(p_event->'attempt_id')='string'
  and p_event->>'stage' in('prepare_document','extract_specs','apply_specs') and p_event->>'event_type' in('heartbeat','progress','succeeded','failed')
  and (p_event->>'input_hash')~'^[a-f0-9]{64}$' and eps.specs_stage_integer(p_event->'sequence',1));
 begin event_job:=(p_event->>'job_id')::uuid; event_attempt:=(p_event->>'attempt_id')::uuid; exception when invalid_text_representation then perform eps.fail('INVALID_REQUEST','Invalid callback identifiers.',400); end;
 event_sequence:=(p_event->>'sequence')::bigint;
 perform eps.specs_stage_assert(not(p_event?'result_schema') or eps.specs_stage_text(p_event->'result_schema',true));
 if p_event->>'event_type'='succeeded' then
  perform eps.specs_stage_assert(jsonb_typeof(p_event->'result')='object' and jsonb_typeof(p_event->'result_schema')='string' and coalesce(p_event->'error','null')='null');
 elsif p_event->>'event_type'='failed' then
  perform eps.specs_stage_assert(not(p_event?'result') and eps.specs_stage_shape(p_event->'error',array['code','message','details','retryable'],array['code','message','details','retryable'])
   and jsonb_typeof(p_event#>'{error,code}')='string' and length(p_event#>>'{error,code}') between 1 and 200
   and jsonb_typeof(p_event#>'{error,message}')='string' and length(p_event#>>'{error,message}') between 1 and 2000
   and jsonb_typeof(p_event#>'{error,details}')='object' and octet_length((p_event#>'{error,details}')::text)<=16384 and jsonb_typeof(p_event#>'{error,retryable}')='boolean');
 elsif p_event->>'event_type'='heartbeat' then
  perform eps.specs_stage_assert(not(p_event?'result') and not(p_event?'result_schema') and coalesce(p_event->'error','null')='null');
 end if;
 job:=eps.specs_stage_lock(event_job); at_value:=clock_timestamp(); digest_value:=encode(sha256(convert_to(p_event::text,'UTF8')),'hex');
 select * into previous from eps.job_events where job_id=job.id and attempt_id=event_attempt and event_id=p_event->>'event_id';
 if found then
  perform eps.specs_stage_assert(previous.payload_digest=digest_value,'EVENT_ID_CONFLICT');
  return previous.receipt||jsonb_build_object('duplicate',true,'applied',false);
 end if;
 perform eps.specs_stage_assert(not exists(select 1 from eps.job_events where job_id=job.id and attempt_id=event_attempt and sequence=event_sequence),'EVENT_SEQUENCE_CONFLICT');
 event_receipt_value:=jsonb_build_object('event_id',p_event->>'event_id','applied',false,'duplicate',false,'stale',false,'job_status',job.status);
 if job.status<>'running' or job.cancel_requested_at is not null or job.current_attempt_id<>event_attempt or job.stage<>p_event->>'stage' or job.lease_expires_at<=at_value then return event_receipt_value||jsonb_build_object('stale',true); end if;
 perform eps.specs_stage_assert(job.lease_token_digest=encode(sha256(convert_to(p_event->>'lease_token','UTF8')),'hex'),'LEASE_INVALID');
 perform eps.specs_stage_assert(job.input_hash=p_event->>'input_hash','INPUT_HASH_MISMATCH');
 if event_sequence<=job.last_event_sequence then event_receipt_value:=event_receipt_value||jsonb_build_object('stale',true);
 else
  job.last_event_sequence:=event_sequence;
  if not eps.specs_stage_source_matches(job) then
   job.status:='waiting_for_input'; safe_error:=eps.specs_stage_error('INPUT_CHANGED');
  elsif p_event->>'event_type'='heartbeat' then job.heartbeat_at:=at_value; job.lease_expires_at:=at_value+interval '90 seconds';
  elsif p_event->>'event_type'='progress' then
   body:=p_event->'result'; perform eps.specs_stage_assert(eps.specs_stage_shape(body,array['progress_completed','progress_total'],array['progress_completed','progress_total'])
    and eps.specs_stage_integer(body->'progress_completed',job.progress_completed) and (body->'progress_total'='null' or eps.specs_stage_integer(body->'progress_total'))
    and not(p_event?'result_schema') and coalesce(p_event->'error','null')='null','INVALID_PROGRESS');
   perform eps.specs_stage_assert(body->'progress_total'='null' or (body->>'progress_total')::bigint>=(body->>'progress_completed')::bigint,'INVALID_PROGRESS');
   job.progress_completed:=(body->>'progress_completed')::bigint; job.progress_total:=(body->>'progress_total')::bigint;
  elsif p_event->>'event_type'='failed' then
   safe_error:=eps.specs_stage_error(p_event#>>'{error,code}',(p_event#>>'{error,retryable}')::boolean,p_event#>'{error,details,retry_after_seconds}');
  else
   body:=p_event->'result'; schema_name:=p_event->>'result_schema';
   begin
    perform eps.specs_stage_assert(eps.specs_stage_source_matches(job),'INPUT_CHANGED');
    perform eps.specs_stage_assert(octet_length(body::text)<=262144,'RESULT_INVALID');
    if job.stage='prepare_document' then
     perform eps.specs_stage_assert(schema_name='document-preparation.v1' and eps.specs_stage_shape(body,array['source_asset_id','text_asset_id','page_assets','paragraph_count','extraction_method','warnings'],array['source_asset_id','text_asset_id','page_assets','paragraph_count','extraction_method','warnings'])
      and body->'page_assets'='[]' and eps.specs_stage_integer(body->'paragraph_count'),'RESULT_INVALID');
     if job.input_asset_id is null then
      perform eps.specs_stage_assert(body->'source_asset_id'='null' and body->'text_asset_id'='null' and body->>'extraction_method'='plain_text' and body->'warnings'='[]','RESULT_INVALID');
      select source_text into frozen_source_text from eps.specs_source_inputs where job_id=job.id;
      perform eps.specs_stage_assert(found,'INPUT_CHANGED');
      normalized:=replace(replace(frozen_source_text,E'\r\n',E'\n'),E'\r',E'\n'); prepared_paragraphs_value:=eps.specs_stage_paragraphs(frozen_source_text);
     else
      perform eps.specs_stage_assert(body->>'source_asset_id'=job.input_asset_id::text and (body->>'text_asset_id')~'^[a-f0-9-]{36}$','RESULT_INVALID');
      select * into pending from eps.specs_file_preparations where job_id=job.id and attempt_id=event_attempt and input_hash=job.input_hash;
      perform eps.specs_stage_assert(found and pending.asset_id::text=body->>'text_asset_id','RESULT_INVALID');
      select * into prepared_asset from eps.media_assets where id=pending.asset_id;
      perform eps.specs_stage_assert(found,'RESULT_INVALID'); verified:=eps.specs_validate_file_preparation(job,prepared_asset,pending.payload_utf8);
      perform eps.specs_stage_assert(body->>'extraction_method'=verified->>'extractionMethod' and body->'warnings'=verified->'warnings','RESULT_INVALID');
      normalized:=verified->>'text'; prepared_paragraphs_value:=verified->'paragraphs';
     end if;
     perform eps.specs_stage_assert((body->>'paragraph_count')::bigint=jsonb_array_length(prepared_paragraphs_value),'RESULT_INVALID');
    elsif job.stage='extract_specs' then
     perform eps.specs_stage_assert(schema_name='specs-extraction-stage.v1' and eps.specs_stage_shape(body,array['result','metadata'],array['result','metadata']),'RESULT_INVALID');
     select * into prepared from eps.specs_stage_payloads where job_id=job.id and stage='prepare_document' and input_hash=job.input_hash;
     perform eps.specs_stage_assert(found,'RESULT_INVALID'); if job.input_asset_id is null then perform eps.specs_stage_extract(body->'result',prepared.paragraphs);
     else perform eps.specs_document_extract(body->'result',prepared.paragraphs,job.input_asset_id); end if;
     perform eps.specs_stage_metadata(body->'metadata',job,prepared.paragraphs);
    else
     perform eps.specs_stage_assert(schema_name='specs-application.v1' and eps.specs_stage_shape(body,array['specs_id','workspace_id'],array['specs_id','workspace_id'])
      and body->>'specs_id'=job.resource_id::text and body->>'workspace_id'=job.workspace_id::text,'RESULT_INVALID');
     application_result:=eps.specs_stage_apply(job);
    end if;
   exception when raise_exception then
    if sqlerrm in('RESULT_INVALID','SLOT_ALLOCATION_LIMIT_EXCEEDED') then valid_result:=false; safe_error:=eps.specs_stage_error('RESULT_INVALID');
    elsif sqlerrm='INPUT_CHANGED' then valid_result:=false; job.status:='waiting_for_input'; safe_error:=eps.specs_stage_error('INPUT_CHANGED'); else raise; end if;
   end;
   if valid_result then
    if job.stage<>'apply_specs' then
     insert into eps.specs_stage_payloads(job_id,stage,attempt_id,input_hash,result_schema,result,prepared_text,paragraphs)
      values(job.id,job.stage,event_attempt,job.input_hash,schema_name,body,normalized,prepared_paragraphs_value) returning id into payload_id;
     get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
     perform eps.specs_stage_assert(exists(select 1 from eps.specs_stage_payloads where id=payload_id and job_id=job.id and stage=job.stage
      and attempt_id=event_attempt and input_hash=job.input_hash and result_schema=schema_name and result=body
      and prepared_text is not distinct from normalized and specs_stage_payloads.paragraphs is not distinct from prepared_paragraphs_value),'STAGE_STATE_INVALID');
    end if;
    completed:=jsonb_build_object('stage',job.stage,'attempt_id',event_attempt,'input_hash',job.input_hash,'result_schema',schema_name,
     'result',coalesce(application_result,jsonb_build_object('stage_output_id',payload_id)),'completed_at',at_value);
    job.completed_stages:=job.completed_stages||jsonb_build_array(completed);
    if job.stage='apply_specs' then job.status:='succeeded'; job.result:=application_result;
    else job.stage:=case job.stage when 'prepare_document' then 'extract_specs' else 'apply_specs' end;
     job.status:='queued'; job.available_at:=at_value; job.dispatch_generation:=job.dispatch_generation+1;
    end if;
    job.progress_completed:=0; job.progress_total:=null; job.lease_token_digest:=null; job.lease_expires_at:=null;
    if job.status='queued' then perform eps.specs_stage_dispatch(job); end if;
   end if;
  end if;
  if safe_error is not null then
   job.error:=safe_error; job.lease_token_digest:=null; job.lease_expires_at:=null; attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);
   if job.status='waiting_for_input' then null;
   elsif (safe_error->>'retryable')::boolean and attempts<3 then
    hint:=coalesce((safe_error#>>'{details,retry_after_seconds}')::numeric,0);
    wait_seconds:=greatest(hint,least(300,2*power(2,greatest(attempts-1,0))*(0.5+random())));
    job.status:='queued'; job.available_at:=at_value+make_interval(secs=>wait_seconds::double precision); job.dispatch_generation:=job.dispatch_generation+1; perform eps.specs_stage_dispatch(job);
   else
    job.status:='failed';
    if (safe_error->>'retryable')::boolean and attempts>=3 then job.error:=jsonb_build_object('code','RETRY_EXHAUSTED','message','The bounded retry budget for this stage has been exhausted. Existing results were preserved.','details',jsonb_build_object('cause_code',safe_error->>'code'),'retryable',false); end if;
   end if;
  end if;
  update eps.jobs set status=job.status,stage=job.stage,lease_token_digest=job.lease_token_digest,lease_expires_at=job.lease_expires_at,heartbeat_at=job.heartbeat_at,
   last_event_sequence=job.last_event_sequence,completed_stages=job.completed_stages,progress_completed=job.progress_completed,progress_total=job.progress_total,
   error=job.error,result=job.result,available_at=job.available_at,dispatch_generation=job.dispatch_generation,row_version=row_version+1,updated_at=at_value
   where id=job.id and row_version=job.row_version and status='running' and current_attempt_id=event_attempt and lease_expires_at>clock_timestamp();
  get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STALE_STAGE_LEASE');
  job.row_version:=job.row_version+1; job.updated_at:=at_value;
  perform eps.specs_stage_assert((select to_jsonb(current_job)=to_jsonb(job) from eps.jobs current_job where current_job.id=job.id),'STAGE_STATE_INVALID');
  -- Recheck stored principal rather than trusting a JWT or event actor field.
  perform eps.specs_stage_assert(eps.specs_stage_can_write(job.requested_by,job.workspace_id),'CAPABILITY_REQUIRED');
  event_receipt_value:=event_receipt_value||jsonb_build_object('applied',true,'job_status',job.status);
 end if;
 insert into eps.job_events(job_id,attempt_id,event_id,sequence,stage,event_type,payload_digest,receipt)
 values(job.id,event_attempt,p_event->>'event_id',event_sequence,p_event->>'stage',p_event->>'event_type',digest_value,event_receipt_value);
 get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
 perform eps.specs_stage_assert(exists(select 1 from eps.job_events where job_id=job.id and attempt_id=event_attempt and event_id=p_event->>'event_id'
  and sequence=event_sequence and stage=p_event->>'stage' and event_type=p_event->>'event_type' and payload_digest=digest_value
  and job_events.receipt=event_receipt_value),'STAGE_STATE_INVALID'); return event_receipt_value;
end $$;

-- Function ownership and EXECUTE are explicit. No new function retains PUBLIC
-- execution, no caller receives table rights or the receipt key, and the one
-- pre-existing postgres-owned Auth boolean exception is not modified here.
grant create on schema eps,public to eps_specs_upload_owner,eps_specs_verify_owner,eps_specs_assets_owner;
grant create on schema eps to eps_specs_stage_owner,eps_specs_apply_owner,eps_specs_submit_owner;
do $owners$ declare routine record; begin
 for routine in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in('eps','public') and p.proname in(
  'specs_media_dto','specs_upload_dto','specs_upload_require','specs_upload_remember','specs_upload_check_completion',
  'eps_reserve_specs_upload','eps_get_specs_upload','eps_prepare_specs_completion','eps_cancel_specs_upload','eps_get_specs_media',
  'specs_verify_original_receipt','eps_finalize_specs_completion','specs_storage_original_insert','specs_storage_original_read','specs_storage_capability',
  'get_job_asset_access','reserve_job_output','complete_job_output','store_specs_preparation','specs_utf16_length','specs_validate_file_preparation',
  'specs_generated_clarifications','specs_machine_baseline','specs_document_reference','specs_document_clarifications','specs_document_extract','specs_document_prepared_hash','specs_submit_retain_asset') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role,eps_api_owner,eps_jobs_executor',routine.signature);
  execute format('alter function %s owner to %I',routine.signature,case
   when routine.proname in('specs_verify_original_receipt','eps_finalize_specs_completion') then 'eps_specs_verify_owner'
   when routine.proname in('get_job_asset_access','reserve_job_output','complete_job_output','store_specs_preparation','specs_storage_capability') then 'eps_specs_assets_owner'
   when routine.proname='specs_submit_retain_asset' then 'eps_specs_submit_owner'
   when routine.proname in('specs_generated_clarifications','specs_machine_baseline') then 'eps_specs_apply_owner'
   when routine.proname in('specs_utf16_length','specs_validate_file_preparation','specs_document_reference','specs_document_clarifications','specs_document_extract','specs_document_prepared_hash') then 'eps_specs_stage_owner'
   else 'eps_specs_upload_owner' end);
 end loop;
end $owners$;
grant execute on function eps.specs_media_dto(eps.media_assets) to eps_specs_verify_owner,eps_specs_assets_owner;
grant execute on function eps.specs_upload_dto(uuid),eps.specs_upload_require(uuid),eps.specs_upload_remember(text,text,jsonb,jsonb),eps.specs_upload_check_completion(jsonb,eps.specs_upload_sessions) to eps_specs_verify_owner;
grant execute on function eps.specs_document_prepared_hash(uuid,jsonb) to eps_specs_apply_owner;
grant execute on function eps.specs_document_reference(jsonb,jsonb,uuid),eps.specs_document_clarifications(jsonb,jsonb,uuid),eps.specs_document_extract(jsonb,jsonb,uuid),eps.specs_validate_file_preparation(eps.jobs,eps.media_assets,text) to eps_specs_apply_owner;
grant execute on function eps.specs_validate_file_preparation(eps.jobs,eps.media_assets,text),eps.specs_utf16_length(text) to eps_specs_assets_owner,eps_specs_apply_owner;
grant execute on function eps.specs_stage_text(jsonb,boolean),eps.specs_stage_strings(jsonb),eps.specs_stage_nonblank(text),eps.logo_integer(jsonb,bigint,bigint),eps.input_uuid(text) to eps_specs_assets_owner;
grant execute on function public.eps_reserve_specs_upload(jsonb,text),public.eps_get_specs_upload(uuid),public.eps_prepare_specs_completion(uuid,jsonb,text),public.eps_finalize_specs_completion(uuid,jsonb,text,text,text),public.eps_cancel_specs_upload(uuid,text),public.eps_get_specs_media(uuid) to authenticated;
grant usage on schema eps to anon,authenticated;
grant execute on function eps.specs_storage_original_insert(text,text),eps.specs_storage_original_read(text,text),eps.specs_storage_capability(text,text,text) to anon,authenticated;
grant execute on function eps.get_job_asset_access(jsonb),eps.reserve_job_output(jsonb),eps.complete_job_output(jsonb),eps.store_specs_preparation(jsonb) to eps_specs_assets_executor;
revoke create on schema eps,public from eps_specs_upload_owner,eps_specs_verify_owner,eps_specs_assets_owner;
-- Existing owner creation grants are transaction-scoped only for ownership
-- transfer of new helpers; leave the canonical schemas closed afterwards.
revoke create on schema eps from eps_specs_stage_owner,eps_specs_apply_owner,eps_specs_submit_owner;
-- Capability advertisement is still intersected with the actual BFF verifier
-- and signer. Defaults remain false until hosted header/operation/logging proof.
grant select(id,uploads_enabled,capabilities_enabled,file_pipeline_enabled) on eps.specs_asset_config to eps_api_owner;
create policy specs_asset_capability_read on eps.specs_asset_config for select to eps_api_owner using(true);
create or replace function public.eps_get_capabilities() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare upload_purposes jsonb:='[]'::jsonb; mimes jsonb:='["image/png","image/jpeg","image/webp"]'::jsonb; maximum bigint:=5242880; begin
 if auth.uid() is null or coalesce(auth.jwt()->'is_anonymous','false'::jsonb)<>'false'::jsonb then
  perform eps.fail('AUTH_REQUIRED','An internal signed-in user is required.',401); end if;
 if eps.has_capability('workspaces.read') and eps.has_capability('workspaces.write')
  and exists(select 1 from public.projects project where project.archived_at is null and eps.project_scope(project.id,true)) then
  upload_purposes:=jsonb_build_array('client_logo');
  if exists(select 1 from eps.specs_asset_config where id=1 and uploads_enabled and capabilities_enabled and file_pipeline_enabled) then
   upload_purposes:=upload_purposes||jsonb_build_array('specs'); maximum:=20971520;
   mimes:=mimes||jsonb_build_array('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain');
  end if;
 end if;
 return jsonb_build_object('principal_id',auth.uid(),'capabilities',coalesce((select jsonb_agg(g.capability order by g.capability)
  from public.app_capability_grants g where g.principal_id=auth.uid() and g.active),'[]'::jsonb),'timezone','Africa/Cairo','enabled_modules',jsonb_build_array('casting'),
  'upload_policy',jsonb_build_object('allowed_mime_types',mimes,'maximum_file_bytes',maximum,'recommended_batch_size',200,'available_purposes',upload_purposes));
end $$;
notify pgrst,'reload schema';
-- END CANONICAL SPECS ASSETS CORE
