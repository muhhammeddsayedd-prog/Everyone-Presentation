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
