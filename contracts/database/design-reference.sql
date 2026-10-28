-- Everyone Presentation Studio — LOGICAL DESIGN REFERENCE, 27 October 2026.
-- NOT A MIGRATION. No live Everyone schema has been inspected for this pack.
-- The exception below intentionally prevents execution. The final ROLLBACK is
-- a second guard. Do not delete the guard and deploy this file. M00 must map
-- canonical project/client/principal/person objects, field ownership, grants,
-- runtime auth, policies and migration history before writing real migrations.
-- Some relationship/JSON/media-array invariants require the transaction
-- functions documented in docs/data/TRANSACTION_FUNCTIONS.md. They are not
-- implemented by this reference DDL. No public/API grants are supplied.

begin;
do $design_guard$
begin
  raise exception 'DESIGN REFERENCE ONLY: reconcile central schema in M00 and author tested migrations; do not execute this file';
end
$design_guard$;

create schema eps;

create table eps.integration_bindings (
  id uuid primary key default gen_random_uuid(),
  entity_kind text not null check (entity_kind in ('project','client','principal','candidate')),
  source_system text not null,
  source_entity text not null,
  source_key jsonb not null check (jsonb_typeof(source_key) = 'object'),
  source_key_fingerprint text not null,
  active boolean not null default true,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (entity_kind, source_system, source_entity, source_key_fingerprint)
);
-- Add actual typed canonical FKs/adapter checks after discovery. Binding kind
-- and canonical existence are enforced by trusted operations, never assumed.

create table eps.workspaces (
  id uuid primary key default gen_random_uuid(),
  project_binding_id uuid not null references eps.integration_bindings(id),
  module_type text not null default 'casting' check (module_type = 'casting'),
  status text not null default 'active' check (status in ('active','archived')),
  logo_asset_id uuid,
  logo_placement text not null default 'cover' check (logo_placement in ('cover','every_slide')),
  draft_revision bigint not null default 1 check (draft_revision > 0),
  created_by uuid not null references eps.integration_bindings(id),
  updated_by uuid references eps.integration_bindings(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0)
);
create unique index workspaces_one_active_project_module
  on eps.workspaces (project_binding_id, module_type) where status = 'active';

create table eps.media_assets (
  id uuid primary key default gen_random_uuid(),
  asset_kind text not null check (asset_kind in (
    'spec_document','candidate_video','audio_derivative','frame','client_logo',
    'presentation_pdf','presentation_preview','presentation_manifest','transcript',
    'candidate_support','preview_video','document_text','document_page')),
  origin_workspace_id uuid references eps.workspaces(id),
  bucket text not null,
  object_key text not null,
  original_filename text,
  mime_type text,
  byte_size bigint check (byte_size >= 0),
  sha256 text,
  status text not null default 'uploading' check (status in ('uploading','ready','failed','quarantined','archived')),
  parent_asset_id uuid references eps.media_assets(id),
  time_offset_ms bigint check (time_offset_ms >= 0),
  width integer check (width > 0),
  height integer check (height > 0),
  duration_ms bigint check (duration_ms >= 0),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  uploaded_by uuid references eps.integration_bindings(id),
  producing_job_id uuid,
  producing_attempt_id uuid,
  output_stage text,
  output_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  unique (bucket, object_key)
);
alter table eps.workspaces add constraint workspaces_logo_asset_fk
  foreign key (logo_asset_id) references eps.media_assets(id);
create index media_assets_workspace on eps.media_assets(origin_workspace_id);
create index media_assets_parent on eps.media_assets(parent_asset_id);
create unique index media_assets_reserved_job_output
  on eps.media_assets(producing_job_id, producing_attempt_id, output_stage, output_key)
  where producing_job_id is not null;

create table eps.specs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references eps.workspaces(id),
  source_asset_id uuid references eps.media_assets(id),
  source_text text,
  input_kind text check (input_kind in ('pdf','docx','doc','text')),
  extraction_status text not null default 'empty' check (extraction_status in ('empty','queued','running','ready','failed')),
  requirements jsonb not null default '{}' check (jsonb_typeof(requirements) = 'object'),
  clarifications jsonb not null default '[]' check (jsonb_typeof(clarifications) = 'array'),
  source_language text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references eps.integration_bindings(id),
  row_version bigint not null default 1 check (row_version > 0),
  unique (workspace_id, id)
);

create table eps.roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references eps.workspaces(id),
  spec_id uuid,
  name text not null,
  headcount integer check (headcount > 0),
  requirements jsonb not null default '{}' check (jsonb_typeof(requirements) = 'object'),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references eps.integration_bindings(id),
  row_version bigint not null default 1 check (row_version > 0),
  unique (workspace_id, id),
  foreign key (workspace_id, spec_id) references eps.specs(workspace_id, id)
);
create index roles_order on eps.roles(workspace_id, sort_order) where archived_at is null;

create table eps.slots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references eps.workspaces(id),
  role_id uuid not null,
  ordinal integer not null check (ordinal > 0),
  label text not null,
  requirements_override jsonb not null default '{}' check (jsonb_typeof(requirements_override) = 'object'),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (workspace_id, id),
  foreign key (workspace_id, role_id) references eps.roles(workspace_id, id)
);
create unique index slots_active_role_ordinal on eps.slots(role_id, ordinal) where archived_at is null;
create index slots_order on eps.slots(workspace_id, role_id, sort_order) where archived_at is null;

create table eps.candidates (
  id uuid primary key default gen_random_uuid(),
  canonical_binding_id uuid unique references eps.integration_bindings(id),
  casting_id text not null unique,
  -- These fact columns are logical fallback ownership only. Reuse canonical
  -- shared fact columns through the adapter rather than duplicating them.
  display_name text,
  age_or_range text,
  height_measurements text,
  skills_experience text,
  previous_projects_roles text,
  -- Preserve supplied display text above. Numeric/array fields below are
  -- conservative search projections, never substitutes for the original facts.
  stated_age_min smallint check (stated_age_min >= 0),
  stated_age_max smallint check (stated_age_max >= 0),
  age_as_of date,
  gender_stated text,
  height_cm numeric(5,1) check (height_cm > 0),
  measurements jsonb not null default '{}' check (jsonb_typeof(measurements) = 'object'),
  languages text[] not null default '{}',
  accents text[] not null default '{}',
  skills text[] not null default '{}',
  experience text,
  city text,
  previous_projects jsonb not null default '[]' check (jsonb_typeof(previous_projects) = 'array'),
  classification text,
  field_sources jsonb not null default '{}' check (jsonb_typeof(field_sources) = 'object'),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','reviewed')),
  reviewed_by uuid references eps.integration_bindings(id),
  reviewed_at timestamptz,
  reviewed_row_version bigint,
  reviewed_facts_fingerprint text,
  merged_into_candidate_id uuid references eps.candidates(id),
  archived_at timestamptz,
  created_by uuid references eps.integration_bindings(id),
  updated_by uuid references eps.integration_bindings(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0),
  check (stated_age_min is null or stated_age_max is null or stated_age_min <= stated_age_max),
  check (merged_into_candidate_id is null or merged_into_candidate_id <> id),
  check (review_status <> 'reviewed' or (reviewed_by is not null and reviewed_at is not null and reviewed_row_version is not null and reviewed_facts_fingerprint is not null))
);
create index candidates_active_name on eps.candidates(lower(display_name)) where archived_at is null;
create index candidates_active_city_class on eps.candidates(city, classification) where archived_at is null;

create table eps.candidate_media (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references eps.candidates(id),
  video_asset_id uuid not null references eps.media_assets(id),
  preview_asset_id uuid references eps.media_assets(id),
  transcript_asset_id uuid references eps.media_assets(id),
  transcript_original text,
  transcript_language text,
  transcript_languages text[] not null default '{}',
  normalized_facts jsonb not null default '{}' check (jsonb_typeof(normalized_facts) = 'object'),
  selected_frame_asset_ids uuid[] not null default '{}',
  frames_confirmed_at timestamptz,
  frames_confirmed_by uuid references eps.integration_bindings(id),
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (candidate_id, id),
  check (cardinality(selected_frame_asset_ids) <= 3)
);
-- Transaction validates distinct frame IDs, each asset FK and source-video relation.
create unique index candidate_media_active_source on eps.candidate_media(candidate_id, video_asset_id) where archived_at is null;
create unique index candidate_media_one_default on eps.candidate_media(candidate_id) where is_default and archived_at is null;

create table eps.workspace_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references eps.workspaces(id),
  candidate_id uuid not null references eps.candidates(id),
  selected_candidate_media_id uuid,
  selected_frame_asset_ids uuid[] not null default '{}',
  availability text,
  internal_notes text,
  fresh_material_required boolean not null default false,
  media_confirmed_at timestamptz,
  media_confirmed_by uuid references eps.integration_bindings(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (workspace_id, id),
  foreign key (candidate_id, selected_candidate_media_id) references eps.candidate_media(candidate_id, id),
  check (cardinality(selected_frame_asset_ids) <= 3)
);
create unique index workspace_candidates_one_active_person
  on eps.workspace_candidates(workspace_id, candidate_id) where archived_at is null;

create table eps.assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references eps.workspaces(id),
  slot_id uuid not null,
  workspace_candidate_id uuid not null,
  position text not null default 'option' check (position in ('option','main','backup')),
  shortlist_included boolean not null default false,
  presentation_notes text,
  internal_notes text,
  slide_wording jsonb not null default '{}' check (jsonb_typeof(slide_wording) = 'object'),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references eps.integration_bindings(id),
  row_version bigint not null default 1 check (row_version > 0),
  unique (workspace_id, id),
  foreign key (workspace_id, slot_id) references eps.slots(workspace_id, id),
  foreign key (workspace_id, workspace_candidate_id) references eps.workspace_candidates(workspace_id, id)
);
create unique index assignments_one_active_person_slot
  on eps.assignments(slot_id, workspace_candidate_id) where archived_at is null;
create unique index assignments_one_active_main
  on eps.assignments(slot_id) where position = 'main' and archived_at is null;
create index assignments_workspace_order on eps.assignments(workspace_id, slot_id, sort_order) where archived_at is null;
-- Selection = all active assignments in active slots. No selection_included column.

create table eps.audience_presets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  scope text not null check (scope in ('internal','external')),
  settings jsonb not null default '{}' check (jsonb_typeof(settings) = 'object'),
  archived_at timestamptz,
  created_by uuid references eps.integration_bindings(id),
  updated_by uuid references eps.integration_bindings(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0)
);
-- Reuse existing compatible central settings if present. Recommended local seed
-- labels: Internal Production / Agency / Client. No external preset exposes
-- internal notes, and preset edits never mutate an existing series snapshot.

create table eps.presentation_series (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references eps.workspaces(id),
  output_type text not null check (output_type in ('selection','shortlist')),
  audience_scope text not null check (audience_scope in ('internal','external')),
  audience_preset_id uuid not null references eps.audience_presets(id),
  audience_preset_key text not null,
  title text,
  audience_preset_snapshot jsonb not null check (jsonb_typeof(audience_preset_snapshot) = 'object'),
  scope_fingerprint text not null,
  next_version_number integer not null default 1 check (next_version_number > 0),
  latest_ready_version_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (workspace_id, output_type, scope_fingerprint)
);

create table eps.presentation_versions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references eps.presentation_series(id),
  version_number integer not null check (version_number > 0),
  status text not null default 'queued' check (status in ('queued','rendering','ready','failed')),
  source_draft_revision bigint not null,
  input_fingerprint text not null,
  template_key text not null,
  template_version text not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  snapshot_sha256 text not null,
  pdf_asset_id uuid references eps.media_assets(id),
  manifest jsonb not null default '{}' check (jsonb_typeof(manifest) = 'object'),
  generated_by uuid not null references eps.integration_bindings(id),
  ready_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  unique (series_id, version_number),
  unique (series_id, id),
  check (status <> 'ready' or (ready_at is not null and pdf_asset_id is not null))
);
alter table eps.presentation_series add constraint series_latest_version_same_series
  foreign key (id, latest_ready_version_id) references eps.presentation_versions(series_id, id);
create index versions_ready_order on eps.presentation_versions(series_id, version_number desc) where status = 'ready';
-- Real migrations must add immutable-content guards: snapshot/template/order
-- cannot change after capture. Only lifecycle/artifact fields are writable.

create table eps.version_slides (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references eps.presentation_versions(id),
  ordinal integer not null check (ordinal > 0),
  kind text not null check (kind in ('cover','candidate','pending')),
  source_assignment_id uuid references eps.assignments(id),
  source_slot_id uuid references eps.slots(id),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  content_sha256 text not null,
  unique (version_id, ordinal),
  unique (version_id, id),
  check (kind <> 'candidate' or (source_assignment_id is not null and source_slot_id is not null)),
  check (kind <> 'pending' or source_slot_id is not null)
);
create unique index version_slides_one_assignment on eps.version_slides(version_id, source_assignment_id) where kind = 'candidate';

create table eps.review_links (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references eps.presentation_series(id),
  token_digest text not null unique,
  token_prefix text,
  label text,
  token_generation bigint not null default 1 check (token_generation > 0),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  pdf_download_enabled boolean not null default true,
  export_revision bigint not null default 1 check (export_revision > 0),
  created_by uuid not null references eps.integration_bindings(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  unique (series_id, id)
);
-- create_review_link sets expires_at = creation + 30 days unless explicitly set.
-- No stored plaintext bearer token. Only external series may receive guest links.

create table eps.presentation_exports (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null,
  version_id uuid not null,
  review_link_id uuid not null,
  template_version text not null,
  export_revision bigint not null check (export_revision > 0),
  status text not null default 'queued' check (status in ('queued','rendering','ready','failed')),
  pdf_asset_id uuid references eps.media_assets(id),
  media_grant_id uuid,
  job_id uuid,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  failure_code text,
  foreign key (series_id, version_id) references eps.presentation_versions(series_id, id),
  foreign key (series_id, review_link_id) references eps.review_links(series_id, id),
  unique (version_id, review_link_id, template_version, export_revision),
  unique (review_link_id, version_id, id),
  check (status <> 'ready' or (pdf_asset_id is not null and media_grant_id is not null and ready_at is not null))
);

create table eps.review_media_grants (
  id uuid primary key default gen_random_uuid(),
  review_link_id uuid not null references eps.review_links(id),
  version_id uuid not null references eps.presentation_versions(id),
  export_id uuid not null,
  parent_token_generation bigint not null check (parent_token_generation > 0),
  token_digest text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (review_link_id, version_id, export_id)
    references eps.presentation_exports(review_link_id, version_id, id),
  unique (export_id, id)
);
alter table eps.presentation_exports add constraint export_grant_matches_export
  foreign key (id, media_grant_id) references eps.review_media_grants(export_id, id);
create index review_media_grants_parent on eps.review_media_grants(review_link_id);
-- update_review_link propagates expiry to all non-revoked child grants, including
-- naturally expired grants. Never clears revoked_at. Download flag gates only
-- PDF preparation/download; viewing/media still checks parent view access.

create table eps.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  review_link_id uuid not null references eps.review_links(id),
  session_token_digest text not null unique,
  link_token_generation bigint not null check (link_token_generation > 0),
  display_name text,
  company text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table eps.feedback_comments (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null,
  version_id uuid not null,
  slide_id uuid not null,
  guest_session_id uuid references eps.guest_sessions(id),
  author_principal_id uuid references eps.integration_bindings(id),
  author_name_snapshot text not null,
  company_snapshot text,
  parent_comment_id uuid,
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references eps.integration_bindings(id),
  body text not null check (length(trim(body)) > 0),
  visibility text not null default 'external' check (visibility in ('external','internal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  foreign key (series_id, version_id) references eps.presentation_versions(series_id, id),
  foreign key (version_id, slide_id) references eps.version_slides(version_id, id),
  check (num_nonnulls(guest_session_id, author_principal_id) = 1),
  check (guest_session_id is null or visibility = 'external'),
  unique (series_id, version_id, slide_id, id),
  foreign key (series_id, version_id, slide_id, parent_comment_id)
    references eps.feedback_comments(series_id, version_id, slide_id, id),
  check (parent_comment_id is null or parent_comment_id <> id),
  check (not resolved or (resolved_at is not null and resolved_by is not null))
);
create index feedback_comments_visible on eps.feedback_comments(version_id, slide_id, visibility, created_at) where deleted_at is null;

create table eps.feedback_preferences (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null,
  version_id uuid not null,
  slide_id uuid not null,
  guest_session_id uuid references eps.guest_sessions(id),
  author_principal_id uuid references eps.integration_bindings(id),
  author_name_snapshot text not null,
  preference text not null check (preference in ('preferred','maybe','not_preferred')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0),
  foreign key (series_id, version_id) references eps.presentation_versions(series_id, id),
  foreign key (version_id, slide_id) references eps.version_slides(version_id, id),
  check (num_nonnulls(guest_session_id, author_principal_id) = 1)
);
create unique index feedback_preferences_guest_once on eps.feedback_preferences(slide_id, guest_session_id) where guest_session_id is not null;
create unique index feedback_preferences_internal_once on eps.feedback_preferences(slide_id, author_principal_id) where author_principal_id is not null;
-- Transaction validates named guest, guest's parent series, Ready viewed
-- version, candidate slide for preferences, and current link/session state.

create table eps.jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  workspace_id uuid references eps.workspaces(id),
  resource_type text not null,
  resource_id uuid,
  parent_job_id uuid references eps.jobs(id),
  status text not null default 'queued' check (status in ('queued','running','waiting_for_input','succeeded','failed','cancelled')),
  stage text,
  progress jsonb not null default '{}' check (jsonb_typeof(progress) = 'object'),
  attempt integer not null default 0 check (attempt >= 0),
  current_attempt_id uuid,
  last_event_sequence bigint not null default 0 check (last_event_sequence >= 0),
  lease_token_digest text,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  input jsonb not null check (jsonb_typeof(input) = 'object'),
  input_sha256 text not null,
  result jsonb,
  error jsonb,
  dedupe_key text not null unique,
  n8n_execution_id text,
  requested_by uuid references eps.integration_bindings(id),
  cancel_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0)
);
create index jobs_workspace_status on eps.jobs(workspace_id, status, created_at);
create index jobs_expired_lease on eps.jobs(lease_expires_at) where status = 'running';
alter table eps.presentation_exports add constraint export_job_fk foreign key(job_id) references eps.jobs(id);
alter table eps.media_assets add constraint media_producing_job_fk foreign key(producing_job_id) references eps.jobs(id);

create table eps.job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references eps.jobs(id),
  attempt integer not null check (attempt >= 0),
  attempt_id uuid not null,
  sequence bigint not null check (sequence >= 0),
  event_id text not null,
  event_type text not null,
  stage text,
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (job_id, attempt_id, event_id),
  unique (job_id, attempt_id, sequence)
);

create table eps.outbox_events (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending','leased','delivered','dead')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  delivered_at timestamptz,
  last_error jsonb,
  created_at timestamptz not null default now()
);
create index outbox_available on eps.outbox_events(available_at, created_at) where status = 'pending';
create index outbox_expired_lease on eps.outbox_events(lease_expires_at) where status = 'leased';

create table eps.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  actor_scope text not null,
  operation_id text not null,
  key text not null,
  request_sha256 text not null,
  state text not null default 'in_progress' check (state in ('in_progress','completed','failed')),
  resource_type text,
  resource_id uuid,
  response_status integer,
  response_body jsonb,
  response_encrypted bytea,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (actor_scope, operation_id, key),
  check (response_body is null or response_encrypted is null)
);
-- Sensitive one-time link responses use encrypted replay content, server-held
-- key, 24-hour initial TTL. Permanent link/grant tables remain hash-only.

create table eps.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_principal_id uuid references eps.integration_bindings(id),
  actor_kind text not null check (actor_kind in ('user','agent','service','guest')),
  actor_client_id text,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  workspace_id uuid references eps.workspaces(id),
  request_id text not null,
  change_summary jsonb not null default '{}' check (jsonb_typeof(change_summary) = 'object'),
  created_at timestamptz not null default now()
);
create index audit_workspace_time on eps.audit_events(workspace_id, created_at desc);
create index audit_request on eps.audit_events(request_id);

-- Deliberately deny direct access. Real migrations define tested runtime roles,
-- actor-context helpers, policies and function execute grants after discovery.
-- Leaving RLS enabled without policies is not an implemented app access model.
do $rls_reference$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'eps' loop
    execute format('alter table eps.%I enable row level security', t.tablename);
    execute format('alter table eps.%I force row level security', t.tablename);
    execute format('revoke all on table eps.%I from public', t.tablename);
  end loop;
end
$rls_reference$;
revoke all on schema eps from public;

-- REQUIRED IMPLEMENTATION WORK NOT EXPRESSED BY THE REFERENCE DDL:
-- 1. Canonical FK/identity-kind validation and actual field-owner adapters.
-- 2. Trusted actor-context, capability/project checks, RLS and explicit grants.
-- 3. updated_at/row_version/draft_revision increments and immutable guards.
-- 4. Actual frame FK/source validation and asset relationship authorization.
-- 5. Atomic Main replacement/Undo, duplicate resolution and slot resizing.
-- 6. Consistent-snapshot input fingerprint check, immutable capture, monotonically advancing latest-ready pointer.
-- 7. Link expiry propagation, guest ownership, version-scoped grants.
-- 8. Fenced callbacks, idempotency and outbox dispatch transactions.
-- 9. Storage API integration; no direct storage.objects mutation.
-- 10. Schema-level JSON validation matching application contract schemas.

rollback;
