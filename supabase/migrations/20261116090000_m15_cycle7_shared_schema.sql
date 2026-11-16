-- m15 cycle 7 shared schema (additive).
--
-- 1. Project presentation media: one presentation portrait per project member, chosen
--    independently of the introduction video. A portrait is either an extracted video
--    frame or an archive/portfolio photograph of the same person. Crop/focal point is kept
--    so preview, PDF and PowerPoint frame the picture identically. media_selection_state
--    distinguishes an uninitialised legacy row (unset) from an explicit choice (pinned) and
--    a deliberate "no picture" (intentionally_empty).
-- 2. Structured scenes and scene occurrences. A role remains the canonical character and
--    owns slots and assignments; an occurrence only says "this character appears in this
--    scene", so every occurrence of the same role shares Main/Option/Backup/shortlist.
--
-- Functions that read or write these columns arrive in later cycle-7 migrations. This file
-- creates no functions and changes no existing function, policy or grant.
do $$ begin
  if to_regclass('eps.scenes') is not null or exists(select 1 from information_schema.columns where table_schema='eps' and table_name='workspace_candidates' and column_name='portrait_asset_id') then
    raise exception 'M15_ALREADY_APPLIED';
  end if;
  if to_regclass('eps.workspace_candidates') is null or to_regclass('eps.roles') is null or to_regclass('eps.media_assets') is null then
    raise exception 'M15_PREREQUISITES_MISSING';
  end if;
end $$;

-- 1. Presentation media ---------------------------------------------------------------
alter table eps.workspace_candidates
  add column portrait_asset_id uuid references eps.media_assets(id) on delete restrict,
  add column portrait_source text,
  add column portrait_crop jsonb,
  add column media_selection_state text not null default 'unset';
alter table eps.workspace_candidates
  add constraint workspace_candidates_portrait_source_check check (portrait_source is null or portrait_source in ('frame','photo')),
  add constraint workspace_candidates_portrait_pair_check check ((portrait_asset_id is null) = (portrait_source is null)),
  add constraint workspace_candidates_portrait_crop_check check (portrait_crop is null or (jsonb_typeof(portrait_crop)='object' and octet_length(portrait_crop::text)<=2000)),
  add constraint workspace_candidates_media_selection_state_check check (media_selection_state in ('unset','pinned','intentionally_empty')),
  add constraint workspace_candidates_intentionally_empty_check check (media_selection_state<>'intentionally_empty' or portrait_asset_id is null);
-- Existing rows: an explicitly chosen introduction is a pin; everything else stays unset and
-- is offered as a reviewable repair suggestion (never guessed here).
update eps.workspace_candidates set media_selection_state='pinned' where selected_candidate_media_id is not null;
create index workspace_candidates_portrait_idx on eps.workspace_candidates(portrait_asset_id) where portrait_asset_id is not null;
grant update(portrait_asset_id,portrait_source,portrait_crop,media_selection_state) on eps.workspace_candidates to eps_cast_owner;
comment on column eps.workspace_candidates.portrait_asset_id is 'Project presentation portrait (candidate_frame or candidate_photo asset of this candidate). Library edits never change it.';
comment on column eps.workspace_candidates.media_selection_state is 'unset = legacy/uninitialised; pinned = chosen (by a person or the add-to-project default); intentionally_empty = deliberately no picture.';

-- 2. Scenes -----------------------------------------------------------------------------
create table eps.scenes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references eps.workspaces(id) on delete restrict,
  scene_number text check (scene_number is null or length(scene_number) between 1 and 40),
  title text not null check (length(btrim(title)) between 1 and 300),
  sequence_label text check (sequence_label is null or length(sequence_label) between 1 and 300),
  setting text check (setting is null or length(setting) between 1 and 300),
  notes text check (notes is null or length(notes) <= 4000),
  requirements jsonb not null default '{}'::jsonb check (jsonb_typeof(requirements)='object' and octet_length(requirements::text)<=20000),
  source_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(source_refs)='array' and octet_length(source_refs::text)<=20000),
  status text not null default 'confirmed' check (status in ('proposed','confirmed')),
  source_job_id uuid,
  sort_order bigint not null check (sort_order between 0 and 9007199254740991),
  archived_at timestamptz,
  row_version bigint not null default 1 check (row_version between 1 and 9007199254740991),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (workspace_id, id)
);
create index scenes_workspace_order_idx on eps.scenes(workspace_id, sort_order, id) where archived_at is null;
comment on table eps.scenes is 'Structured scene/story/setting records of a project. Casting stays on roles/slots; scenes only reference roles through scene_occurrences.';

create table eps.scene_occurrences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  scene_id uuid not null,
  role_id uuid not null,
  slot_ids uuid[] not null default '{}'::uuid[] check (cardinality(slot_ids) <= 1000),
  display_title text check (display_title is null or length(display_title) between 1 and 300),
  setting_override text check (setting_override is null or length(setting_override) between 1 and 300),
  presentation_note text check (presentation_note is null or length(presentation_note) between 1 and 500),
  deck_placement text not null default 'auto' check (deck_placement in ('auto','repeat','hidden')),
  status text not null default 'confirmed' check (status in ('proposed','confirmed')),
  source_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(source_refs)='array' and octet_length(source_refs::text)<=20000),
  sort_order bigint not null check (sort_order between 0 and 9007199254740991),
  archived_at timestamptz,
  row_version bigint not null default 1 check (row_version between 1 and 9007199254740991),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (workspace_id, id),
  foreign key (workspace_id, scene_id) references eps.scenes(workspace_id, id) on delete restrict,
  foreign key (workspace_id, role_id) references eps.roles(workspace_id, id) on delete restrict
);
create unique index scene_occurrences_active_unique on eps.scene_occurrences(scene_id, role_id) where archived_at is null;
create index scene_occurrences_scene_order_idx on eps.scene_occurrences(scene_id, sort_order, id) where archived_at is null;
create index scene_occurrences_role_idx on eps.scene_occurrences(role_id) where archived_at is null;
comment on table eps.scene_occurrences is 'A canonical role (character) appearing in a scene. Empty slot_ids means every slot of the role. Two occurrences of one role share every casting decision.';
comment on column eps.scene_occurrences.deck_placement is 'auto = printed once at the first occurrence with a combined setting caption; repeat = also printed here; hidden = not printed here.';

do $$ declare target regclass; begin
  foreach target in array array['eps.scenes'::regclass,'eps.scene_occurrences'::regclass] loop
    execute format('alter table %s enable row level security', target);
    execute format('alter table %s force row level security', target);
    execute format('revoke all on %s from public,anon,authenticated,service_role', target);
  end loop;
end $$;

grant select, insert on eps.scenes, eps.scene_occurrences to eps_specs_owner;
grant update(scene_number,title,sequence_label,setting,notes,requirements,source_refs,status,sort_order,archived_at,row_version,updated_at) on eps.scenes to eps_specs_owner;
grant update(slot_ids,display_title,setting_override,presentation_note,deck_placement,status,source_refs,sort_order,archived_at,row_version,updated_at) on eps.scene_occurrences to eps_specs_owner;
grant select, insert on eps.scenes, eps.scene_occurrences to eps_specs_apply_owner;
grant select on eps.scenes, eps.scene_occurrences to eps_casting_owner, eps_review_owner, eps_review_stage_owner;

create policy scenes_read on eps.scenes for select to eps_specs_owner using (eps.specs_scope(workspace_id,false) or eps.specs_scope(workspace_id,true));
create policy scenes_insert on eps.scenes for insert to eps_specs_owner with check (eps.specs_scope(workspace_id,true));
create policy scenes_update on eps.scenes for update to eps_specs_owner using (eps.specs_scope(workspace_id,true)) with check (eps.specs_scope(workspace_id,true));
create policy scenes_stage_apply_read on eps.scenes for select to eps_specs_apply_owner using (true);
create policy scenes_stage_apply_insert on eps.scenes for insert to eps_specs_apply_owner with check (true);
create policy scenes_casting_read on eps.scenes for select to eps_casting_owner using (eps.casting_scope(workspace_id,false) or eps.casting_scope(workspace_id,true));
create policy scenes_review_read on eps.scenes for select to eps_review_owner using (eps.review_scope(workspace_id));
create policy scenes_review_stage_read on eps.scenes for select to eps_review_stage_owner using (true);

create policy scene_occurrences_read on eps.scene_occurrences for select to eps_specs_owner using (eps.specs_scope(workspace_id,false) or eps.specs_scope(workspace_id,true));
create policy scene_occurrences_insert on eps.scene_occurrences for insert to eps_specs_owner with check (eps.specs_scope(workspace_id,true));
create policy scene_occurrences_update on eps.scene_occurrences for update to eps_specs_owner using (eps.specs_scope(workspace_id,true)) with check (eps.specs_scope(workspace_id,true));
create policy scene_occurrences_stage_apply_read on eps.scene_occurrences for select to eps_specs_apply_owner using (true);
create policy scene_occurrences_stage_apply_insert on eps.scene_occurrences for insert to eps_specs_apply_owner with check (true);
create policy scene_occurrences_casting_read on eps.scene_occurrences for select to eps_casting_owner using (eps.casting_scope(workspace_id,false) or eps.casting_scope(workspace_id,true));
create policy scene_occurrences_review_read on eps.scene_occurrences for select to eps_review_owner using (eps.review_scope(workspace_id));
create policy scene_occurrences_review_stage_read on eps.scene_occurrences for select to eps_review_stage_owner using (true);
