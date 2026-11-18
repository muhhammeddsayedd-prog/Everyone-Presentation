-- m20: multimodal candidate enrichment (appearance observations) and Cast Library search facets. Additive.
--
--  * eps.candidate_observation_media / eps.candidate_observations: neutral, observable appearance suggestions from authorised
--    archive photos and already extracted video frames. Each observation keeps its source media (frame timestamp, recording
--    context), confidence, evidence, status (suggested|confirmed|rejected|overridden) and the human override with who/when.
--    Multi-person or ambiguous media is marked ambiguous and never merged; a reviewer picks the target person by confirming.
--    Reanalysis only refreshes still-suggested rows: confirmed, rejected and overridden rows are never touched.
--  * eps.enrichment_batches / items: bounded, resumable, idempotent batches with a spend cap. Each item is one
--    eps.jobs row (kind candidate_appearance, single stage analyze_appearance) dispatched through the existing outbox,
--    n8n route and worker lease/event kernel. The worker never receives a new executable function: the five existing
--    service dispatchers gain one closed branch each (exact preceding source pinned).
--  * eps.candidate_search_projection + eps.cast_facet_match + public.eps_candidate_facets: per-facet counts of distinct
--    active people (OR within a facet, AND across facets, each facet counted with the other facets applied), with an
--    explicit unknown count. Sources: confirmed/overridden observations, m09 supplied attributes, supplied facts.
--  * public.eps_search_candidates (A1, m16) gains optional "facets"/"facet_include_unknown" through one guarded seam; the same
--    row predicate (eps.cast_library_row_ok) backs search results and facet counts, so counts agree for the same filters.
--  * Reads/reviews: public.eps_list_candidate_observations, public.eps_review_candidate_observation,
--    public.eps_start_enrichment_batch, public.eps_get_enrichment_batch.
-- Vocabularies mirror contracts/appearance-taxonomy.json (checked by tests/contracts/appearance-taxonomy.test.ts).
-- Nothing here infers race, ethnicity, nationality, religion or gender identity; there is no such column or value.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='30min'; -- projection backfill over the whole Library (6,835 people live) exceeds 2 minutes

do $m20$declare item record;begin
 if to_regclass('eps.candidate_observations') is not null or to_regclass('eps.enrichment_batches') is not null
  or exists(select 1 from pg_roles where rolname='eps_appearance_owner') then raise exception 'M20_ALREADY_APPLIED';end if;
 if to_regclass('eps.candidate_attributes') is null or to_regclass('eps.candidate_photos') is null
  or to_regprocedure('public.eps_list_candidate_photos(uuid)') is null then raise exception 'M20_REQUIRES_M09_M14';end if;
 for item in select * from(values
  ('eps.claim_job_stage(jsonb)','9ea28ccdd0b670b022c2ac6e31e5f86b27a8ef39541a11c2d3a6a382eccf3e2d'),
  ('eps.get_specs_stage_input(uuid,uuid,text)','32d100e4eb4ca21a8fb2a8049b26468af34e2d28365ae5a31ac2a79a7374127d'),
  ('eps.record_job_event(jsonb)','96d70c9e16e3361789f2082fb605941fc08e654a96d6b13a6abbfe6bd730d4e8'),
  ('eps.get_job_asset_access(jsonb)','76443c945131f0c7e832014e8dba09995d917397a001a742a62cb91a15278842'),
  ('eps.recover_job_stages(integer)','db7390a966236eed63990da16430e5d16e46b31da441ffb2107e29b2ef171bf1'),
  ('public.eps_search_candidates(jsonb)','4463653a7f4ce3564e086639a2f4fe9b98731de94acba906e27fc0bf6c196837'))v(signature,expected) loop
  if to_regprocedure(item.signature) is null or (select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') from pg_proc where oid=item.signature::regprocedure)<>item.expected
  then raise exception 'M20_EXACT_PRECEDING_PORT_SOURCE_REQUIRED:%',item.signature;end if;
 end loop;
end$m20$;

-- 1. One owner role for every m20 object. No login; it inherits only what authenticated already has.
create role eps_appearance_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_appearance_owner to postgres;
grant authenticated to eps_appearance_owner with inherit true,set false,admin false;
grant usage on schema eps,public to eps_appearance_owner;

-- 2. New job kind/stage: one closed branch on every kind/stage check (same composition as m06).
do $$declare item record;definition text;begin
 for item in select conname,pg_get_constraintdef(oid)body,conrelid::regclass tab from pg_constraint where connamespace='eps'::regnamespace
  and conname in('jobs_kind_check','jobs_stage_check','jobs_kind_stage_check','jobs_input_hash_version_check','job_events_stage_check','outbox_events_stage_check','job_stage_attempts_check2') loop
  definition:=item.body;
  if item.conname='jobs_kind_check' then definition:=replace(definition,'''presentation_export''::text','''presentation_export''::text,''candidate_appearance''::text');
  elsif item.conname in('jobs_kind_stage_check','job_stage_attempts_check2') then definition:='CHECK ('||substring(definition from 7)||' OR(kind=''candidate_appearance''and stage=''analyze_appearance''))';
  elsif item.conname='jobs_input_hash_version_check' then definition:=replace(definition,'''eps.presentation-export-input.cast-canonical.v1''::text','''eps.presentation-export-input.cast-canonical.v1''::text,''eps.appearance-input.pg-jsonb.v1''::text');
  else definition:=replace(definition,'''render_export''::text','''render_export''::text,''analyze_appearance''::text');end if;
  if definition=item.body then raise exception 'M20_STAGE_CONSTRAINT_ANCHOR_REQUIRED:%',item.conname;end if;
  execute format('alter table %s drop constraint %I',item.tab,item.conname);execute format('alter table %s add constraint %I %s',item.tab,item.conname,definition);
 end loop;
 if (select count(*) from pg_constraint where connamespace='eps'::regnamespace and conname in('jobs_kind_check','jobs_stage_check','jobs_kind_stage_check','jobs_input_hash_version_check','job_events_stage_check','outbox_events_stage_check','job_stage_attempts_check2')
  and pg_get_constraintdef(oid) ~ '(candidate_appearance|analyze_appearance|appearance-input)')<>7 then raise exception 'M20_STAGE_CONSTRAINTS_INCOMPLETE';end if;
end$$;

-- 3. Taxonomy (mirror of contracts/appearance-taxonomy.json).
create function eps.appearance_vocabulary() returns jsonb language sql immutable set search_path='' as $$select '{
 "hair_length":["bald_or_shaved","short","shoulder_length","long"],
 "hair_colour":["black","dark","dark_brown","brown","light_brown","blonde","auburn","red","grey","white"],
 "hair_texture":["straight","wavy","curly","coily"],
 "facial_hair":["none","stubble","moustache","goatee","beard"],
 "glasses":["none","glasses","sunglasses"],
 "skin_tone":["very_light","light","medium","tan","brown","dark"],
 "build":["slim","average","athletic","broad","larger"],
 "playing_age":["baby","kids","child","teen_13_17","age_18_24","age_25_34","age_35_44","age_45_54","age_55_64","age_65_plus"],
 "clothing_style":["formal","smart_casual","casual","sportswear","uniform","costume"],
 "head_covering":["none","present"],
 "visible_tattoos":["none","present"]}'::jsonb$$;
-- Supplied (m09) archive labels -> taxonomy keys. Lower-cased lookup; anything else stays a supplied label as-is.
create function eps.appearance_supplied_map() returns jsonb language sql immutable set search_path='' as $$select '{
 "hair_length":{"short":"short","shoulder length":"shoulder_length","long":"long","bald":"bald_or_shaved","shaved head":"bald_or_shaved"},
 "hair_colour":{"black":"black","dark":"dark","dark brown":"dark_brown","brown":"brown","light brown":"light_brown","blonde":"blonde","auburn":"auburn","red":"red","ginger":"red","grey":"grey","white":"white"},
 "hair_texture":{"straight":"straight","wavy":"wavy","curly":"curly","afro":"coily"},
 "playing_age":{"baby":"baby","kids":"kids","child":"child","teen 13-17":"teen_13_17","age 18-24":"age_18_24","age 25-34":"age_25_34","age 35-44":"age_35_44","age 45-54":"age_45_54","age 55-64":"age_55_64","age 65+":"age_65_plus"},
 "skin_tone":{"very light":"very_light","very fair":"very_light","porcelain":"very_light","light":"light","fair":"light","medium":"medium","olive":"medium","wheatish":"medium","tan":"tan","tanned":"tan","brown":"brown","dark":"dark","deep":"dark"}}'::jsonb$$;
create function eps.appearance_value_valid(p_attribute text,p_value text) returns boolean language sql immutable set search_path='' as $$
 select p_attribute is not null and p_value is not null and eps.appearance_vocabulary() ? p_attribute and (p_value='unknown' or (eps.appearance_vocabulary()->p_attribute) ? p_value)$$;
create function eps.appearance_facet_keys_allowed() returns text[] language sql immutable set search_path='' as $$
 select array['talent_type','city','stated_gender','playing_age','skin_tone','hair_length','hair_colour','hair_texture','facial_hair','glasses','build','languages','tags']$$;
-- Arabic/Latin search normalisation: case, whitespace, tatweel, Arabic diacritics, alef forms and alef maqsura.
create function eps.appearance_norm(p_text text) returns text language sql immutable set search_path='' as $$
 select nullif(btrim(regexp_replace(translate(regexp_replace(lower(coalesce(p_text,'')),'[ـً-ٰٟ]','','g'),
  chr(1571)||chr(1573)||chr(1570)||chr(1649)||chr(1609),chr(1575)||chr(1575)||chr(1575)||chr(1575)||chr(1610)),'\s+',' ','g')),'')$$;
-- Identity terms that must never appear in model free text (contracts/appearance-taxonomy.json forbidden_terms).
create function eps.appearance_forbidden_terms() returns text[] language sql immutable set search_path='' as $$select array['race','racial','ethnic','ethnicity','nationality','national','citizen','religion','religious','muslim','christian','jewish','hindu','buddhist','sikh','arab','arabian','middle eastern','mideast','north african','african','asian','south asian','east asian','european','caucasian','white person','black person','latino','latina','hispanic','indian','pakistani','filipino','khaleeji','gulf','levantine','saudi','emirati','egyptian','lebanese','syrian','jordanian','iraqi','moroccan','sudanese','persian','iranian','turkish','kuwaiti','qatari','omani','bahraini','yemeni','palestinian','western','american','british','russian','chinese','japanese','korean','nigerian','lookalike','look-alike','looks like','resembles','gender','male','female','man','woman','men','women','boy','girl','masculine','feminine','transgender','trans','nonbinary','non-binary','gay','lesbian','queer','hijab','niqab','abaya','kandura','dishdasha','thobe','ghutra','shemagh','keffiyeh','turban','kippah','yarmulke','burqa','عربي','عربية','مسلم','مسلمة','مسيحي','سعودي','سعودية','اماراتي','مصري','مصرية','خليجي','خليجية','شامي','كويتي','قطري','عماني','بحريني','يمني','فلسطيني','لبناني','سوري','عراقي','اردني','مغربي','رجل','امرأة','ولد','بنت','حجاب','نقاب','عباية']::text[]$$;
create function eps.appearance_text_allowed(p_text text) returns boolean language sql immutable set search_path='' as $$
 select p_text is null or not exists(select 1 from unnest(eps.appearance_forbidden_terms()) t
  where ' '||regexp_replace(eps.appearance_norm(p_text),'[^[:alnum:]؀-ۿ]+',' ','g')||' ' like '% '||btrim(regexp_replace(eps.appearance_norm(t),'[^[:alnum:]؀-ۿ]+',' ','g'))||' %')$$;
create function eps.appearance_supplied_key(p_attribute text,p_label text) returns text language sql immutable set search_path='' as $$
 select coalesce(eps.appearance_supplied_map()->p_attribute->>eps.appearance_norm(p_label),eps.appearance_norm(p_label))$$;
-- A supplied archive tag becomes a facet/search key only when it names no protected identity (forbidden_terms), is not a
-- "look" label (look/regional_look are forbidden facets) and is not the person's supplied nationality or country. Screened
-- tags stay visible as attributed archive labels on the profile; they are never filters.
create function eps.appearance_tag_facet_ok(p_label text,p_nationality text,p_country text) returns boolean language sql immutable set search_path='' as $$
 select eps.appearance_norm(p_label) is not null and eps.appearance_text_allowed(p_label)
  and ' '||regexp_replace(eps.appearance_norm(p_label),'[^[:alnum:]؀-ۿ]+',' ','g')||' ' !~ ' (look|looks|lookalike|lookalikes|مظهر) '
  and eps.appearance_norm(p_label) is distinct from eps.appearance_norm(p_nationality) and eps.appearance_norm(p_label) is distinct from eps.appearance_norm(p_country)$$;

-- 4. Tables.
create table eps.appearance_config(
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 model text check(model is null or length(model) between 1 and 200),
 prompt_version text not null default 'appearance-v1' check(prompt_version='appearance-v1'),
 schema_version text not null default '1.0' check(schema_version='1.0'),
 taxonomy_version text not null default 'appearance-taxonomy.v1' check(taxonomy_version='appearance-taxonomy.v1'),
 max_images integer not null default 6 check(max_images between 1 and 12),
 input_usd_per_mtok numeric(12,4) check(input_usd_per_mtok>=0),
 output_usd_per_mtok numeric(12,4) check(output_usd_per_mtok>=0),
 check(not enabled or model is not null and input_usd_per_mtok is not null and output_usd_per_mtok is not null));
insert into eps.appearance_config(id)values(true);
comment on table eps.appearance_config is 'Appearance enrichment switch, model and operator-supplied prices (USD per million tokens). Disabled until an operator sets them; nothing here is a price claim.';

create table eps.enrichment_batches(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references eps.workspaces(id) on delete restrict,
 requested_by uuid not null references auth.users(id) on delete restrict,
 idempotency_key text not null check(length(idempotency_key) between 16 and 200),
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 scope jsonb not null check(jsonb_typeof(scope)='object' and octet_length(scope::text)<=65536),
 item_limit integer not null check(item_limit between 1 and 1000),
 spend_cap_cents integer not null check(spend_cap_cents between 1 and 1000000),
 spent_micro_usd bigint not null default 0 check(spent_micro_usd>=0),
 input_usd_per_mtok numeric(12,4) not null check(input_usd_per_mtok>=0),
 output_usd_per_mtok numeric(12,4) not null check(output_usd_per_mtok>=0),
 model text not null check(length(model) between 1 and 200),
 prompt_version text not null check(prompt_version='appearance-v1'),
 max_in_flight smallint not null default 2 check(max_in_flight between 1 and 4),
 status text not null default 'running' check(status in('running','completed','stopped_spend_cap','cancelled')),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),
 unique(requested_by,idempotency_key));
create table eps.enrichment_batch_items(
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references eps.enrichment_batches(id) on delete restrict,
 candidate_id uuid not null references eps.candidates(id) on delete restrict,
 position integer not null check(position>=1),
 status text not null default 'pending' check(status in('pending','queued','succeeded','failed','skipped')),
 job_id uuid references eps.jobs(id) on delete restrict,
 error_code text check(error_code is null or error_code~'^[A-Z][A-Z0-9_]{1,63}$'),
 input_tokens bigint not null default 0 check(input_tokens>=0),output_tokens bigint not null default 0 check(output_tokens>=0),
 cost_micro_usd bigint not null default 0 check(cost_micro_usd>=0),
 updated_at timestamptz not null default clock_timestamp(),
 unique(batch_id,candidate_id),unique(batch_id,position),
 check(status not in('queued','succeeded') or job_id is not null),check(status<>'pending' or job_id is null));
create unique index enrichment_batch_items_job on eps.enrichment_batch_items(job_id) where job_id is not null;
create index enrichment_batch_items_next on eps.enrichment_batch_items(batch_id,position) where status='pending';

create table eps.candidate_observation_media(
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid not null references eps.candidates(id) on delete restrict,
 asset_id uuid not null references eps.media_assets(id) on delete restrict,
 source_kind text not null check(source_kind in('photo','frame')),
 candidate_media_id uuid references eps.candidate_media(id) on delete restrict,
 frame_timestamp_ms bigint check(frame_timestamp_ms is null or frame_timestamp_ms between 0 and 86400000),
 media_category text not null check(media_category in('portfolio_photo','headshot','full_body','video_frame')),
 recording_context text not null check(recording_context in('archive_photo','introduction_video')),
 media_added_at timestamptz not null,
 people_count smallint not null check(people_count between 0 and 10),
 ambiguous boolean not null,
 target_person_index smallint check(target_person_index between 0 and 9),
 quality_note text check(quality_note is null or length(quality_note)<=300 and eps.appearance_text_allowed(quality_note)),
 last_job_id uuid not null references eps.jobs(id) on delete restrict,
 model text not null check(length(model) between 1 and 200),
 prompt_version text not null check(prompt_version='appearance-v1'),
 analyzed_at timestamptz not null,
 row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),
 unique(candidate_id,asset_id),unique(candidate_id,id),
 check((source_kind='frame')=(candidate_media_id is not null and frame_timestamp_ms is not null)),
 check(ambiguous or people_count<=1));
create table eps.candidate_observations(
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid not null,
 media_id uuid not null,
 person_index smallint not null check(person_index between 0 and 9),
 position_note text check(position_note is null or length(position_note) between 1 and 200 and eps.appearance_text_allowed(position_note)),
 attribute text not null check(eps.appearance_vocabulary() ? attribute),
 suggested_value text not null check(eps.appearance_value_valid(attribute,suggested_value)),
 confidence text not null check(confidence in('low','medium','high')),
 evidence text check(evidence is null or length(evidence) between 1 and 300 and eps.appearance_text_allowed(evidence)),
 status text not null default 'suggested' check(status in('suggested','confirmed','rejected','overridden')),
 override_value text check(override_value is null or eps.appearance_value_valid(attribute,override_value) and override_value<>'unknown'),
 reviewed_by uuid references auth.users(id) on delete restrict,
 reviewed_at timestamptz,
 job_id uuid not null references eps.jobs(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),
 foreign key(candidate_id,media_id) references eps.candidate_observation_media(candidate_id,id) on delete restrict,
 unique(media_id,person_index,attribute),
 check((status='overridden')=(override_value is not null)),
 check((status='suggested')=(reviewed_by is null) and (reviewed_by is null)=(reviewed_at is null)),
 check(status<>'confirmed' or suggested_value<>'unknown'));
create index candidate_observations_candidate on eps.candidate_observations(candidate_id,media_id);
create index candidate_observations_reviewed on eps.candidate_observations(candidate_id) where status in('confirmed','overridden');
comment on table eps.candidate_observations is 'Neutral observable appearance per media and visible person. Suggestions never change supplied facts; only confirmed/overridden rows feed search facets.';

create table eps.candidate_search_projection(
 candidate_id uuid primary key references eps.candidates(id) on delete restrict,
 active boolean not null,
 name_norm text,name_ar_norm text,casting_id_norm text not null,
 tags text[] not null default '{}',
 facet_keys text[] not null default '{}',
 facet_names text[] not null default '{}',
 updated_at timestamptz not null default clock_timestamp());
create index candidate_search_projection_facets on eps.candidate_search_projection using gin(facet_keys) where active;
create index candidate_search_projection_tags on eps.candidate_search_projection using gin(tags) where active;
create index candidate_search_projection_name on eps.candidate_search_projection(name_norm text_pattern_ops) where active;
create index candidate_search_projection_name_ar on eps.candidate_search_projection(name_ar_norm text_pattern_ops) where active;
-- Trigram indexes only when pg_trgm is already installed; this migration never installs an extension.
do $$declare schema_name text;begin
 select n.nspname into schema_name from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_trgm';
 if schema_name is not null then
  execute format('create index candidate_search_projection_name_trgm on eps.candidate_search_projection using gin(name_norm %I.gin_trgm_ops) where active',schema_name);
  execute format('create index candidate_search_projection_name_ar_trgm on eps.candidate_search_projection using gin(name_ar_norm %I.gin_trgm_ops) where active',schema_name);
 end if;
end$$;
comment on table eps.candidate_search_projection is 'Derived search keys per candidate (normalised EN/AR names, casting id, tags, facet_keys "facet:value"). Rebuilt by triggers; never edited directly.';

create table eps.appearance_asset_grants(
 id uuid primary key default gen_random_uuid(),
 token_digest text not null unique check(token_digest~'^[a-f0-9]{64}$'),
 job_id uuid not null references eps.jobs(id) on delete restrict,
 attempt_id uuid not null,input_hash text not null check(input_hash~'^[a-f0-9]{64}$'),
 asset_id uuid not null references eps.media_assets(id) on delete restrict,
 bucket text not null check(bucket in('eps-candidate-photos','eps-candidate-outputs')),object_key text not null check(length(object_key) between 1 and 1024),
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 check(expires_at>created_at and expires_at<=created_at+interval '1 minute'));
create index appearance_asset_grants_job on eps.appearance_asset_grants(job_id,attempt_id);

do $$declare target regclass;begin foreach target in array array['eps.appearance_config'::regclass,'eps.enrichment_batches'::regclass,'eps.enrichment_batch_items'::regclass,
 'eps.candidate_observation_media'::regclass,'eps.candidate_observations'::regclass,'eps.candidate_search_projection'::regclass,'eps.appearance_asset_grants'::regclass] loop
 execute format('alter table %s enable row level security',target);execute format('alter table %s force row level security',target);
 execute format('revoke all on %s from public,anon,authenticated,service_role',target);
 execute format('grant select,insert,update on %s to eps_appearance_owner',target);
 execute format('create policy appearance_owner_all on %s for all to eps_appearance_owner using(true) with check(true)',target);
end loop;end$$;
-- A1's search (eps_cast_owner) reads the projection and calls eps.cast_facet_match.
grant select on eps.candidate_search_projection to eps_cast_owner;
create policy cast_projection_read on eps.candidate_search_projection for select to eps_cast_owner using((select eps.has_capability('cast.read')));

-- 5. What the owner role reads/writes in existing tables (functions own every write; no user gets a table privilege).
grant select on eps.candidates,eps.candidate_media,eps.candidate_media_frames,eps.candidate_photos,eps.candidate_attributes,eps.media_assets to eps_appearance_owner;
create policy appearance_candidates_read on eps.candidates for select to eps_appearance_owner using(true);
create policy appearance_candidate_media_read on eps.candidate_media for select to eps_appearance_owner using(true);
create policy appearance_candidate_frames_read on eps.candidate_media_frames for select to eps_appearance_owner using(true);
create policy appearance_photos_read on eps.candidate_photos for select to eps_appearance_owner using(true);
create policy appearance_attributes_read on eps.candidate_attributes for select to eps_appearance_owner using(true);
create policy appearance_assets_read on eps.media_assets for select to eps_appearance_owner using(purpose in('candidate_photo','candidate_frame'));
grant select,update(id) on eps.workspaces to eps_appearance_owner;
create policy appearance_workspace_read on eps.workspaces for select to eps_appearance_owner using(true);
create policy appearance_workspace_lock on eps.workspaces for update to eps_appearance_owner using(true) with check(false);
grant select on public.projects,public.project_memberships,public.app_capability_grants to eps_appearance_owner;
create policy appearance_projects_read on public.projects for select to eps_appearance_owner using(true);
create policy appearance_memberships_read on public.project_memberships for select to eps_appearance_owner using(true);
create policy appearance_capabilities_read on public.app_capability_grants for select to eps_appearance_owner using(true);
grant select,insert,update on eps.jobs to eps_appearance_owner;
create policy appearance_jobs_read on eps.jobs for select to eps_appearance_owner using(kind='candidate_appearance');
create policy appearance_jobs_insert on eps.jobs for insert to eps_appearance_owner with check(kind='candidate_appearance' and stage='analyze_appearance' and status='queued' and attempt=0
 and dispatch_generation=1 and current_attempt_id is null and lease_token_digest is null and input_hash_version='eps.appearance-input.pg-jsonb.v1');
create policy appearance_jobs_update on eps.jobs for update to eps_appearance_owner using(kind='candidate_appearance') with check(kind='candidate_appearance' and stage='analyze_appearance');
grant select,insert on eps.outbox_events,eps.job_events to eps_appearance_owner;
create policy appearance_outbox_read on eps.outbox_events for select to eps_appearance_owner using(stage='analyze_appearance');
create policy appearance_outbox_insert on eps.outbox_events for insert to eps_appearance_owner with check(stage='analyze_appearance' and exists(select 1 from eps.jobs j where j.id=job_id and j.kind='candidate_appearance'
 and j.status='queued' and j.input_hash=outbox_events.input_hash and j.dispatch_generation=outbox_events.dispatch_generation));
create policy appearance_events_read on eps.job_events for select to eps_appearance_owner using(stage='analyze_appearance');
create policy appearance_events_insert on eps.job_events for insert to eps_appearance_owner with check(stage='analyze_appearance');
grant insert on eps.audit_events to eps_appearance_owner;
create policy appearance_audit on eps.audit_events for insert to eps_appearance_owner with check(principal_id=(select auth.uid()) and action in('appearance.review_observation','appearance.start_batch'));
-- Observation reviews record their Idempotency-Key through eps.idempotency_begin/eps.finish_mutation (acting user only).
grant select,insert on eps.idempotency_records to eps_appearance_owner;
create policy appearance_idempotency on eps.idempotency_records for all to eps_appearance_owner using(principal_id=(select auth.uid()) and operation='appearance.review_observation')
 with check(principal_id=(select auth.uid()) and operation='appearance.review_observation');
-- The existing operations page reads every job kind through eps_jobs_owner (jobs_read already covers all kinds).

-- 6. Projection: facet keys "facet:value" per candidate, from supplied facts, supplied m09 labels and confirmed observations.
create function eps.appearance_projection_row(p_candidate uuid) returns eps.candidate_search_projection language plpgsql stable security definer set search_path='' as $$
declare c eps.candidates;a eps.candidate_attributes;keys text[]:='{}';row_value eps.candidate_search_projection;begin
 select * into c from eps.candidates where id=p_candidate;if not found then return null;end if;
 select * into a from eps.candidate_attributes where candidate_id=p_candidate;
 keys:=keys||coalesce((select array_agg('city:'||v) from(select eps.appearance_norm(c.facts->>'city') v)x where v is not null),'{}');
 keys:=keys||coalesce((select array_agg('stated_gender:'||v) from(select eps.appearance_norm(c.facts->>'stated_gender') v)x where v is not null),'{}');
 if jsonb_typeof(c.facts->'languages')='array' then
  keys:=keys||coalesce((select array_agg(distinct 'languages:'||eps.appearance_norm(l)) from jsonb_array_elements_text(c.facts->'languages') l where eps.appearance_norm(l) is not null),'{}');end if;
 if a.candidate_id is not null then
  -- Supplied look, nationality and country labels are never facets (taxonomy forbidden_attributes); free-text skin tone
  -- only counts when it maps onto the closed vocabulary.
  keys:=keys||array['talent_type:'||a.talent_type];
  if eps.appearance_value_valid('skin_tone',eps.appearance_supplied_key('skin_tone',a.skin_tone)) and eps.appearance_supplied_key('skin_tone',a.skin_tone)<>'unknown' then
   keys:=keys||('skin_tone:'||eps.appearance_supplied_key('skin_tone',a.skin_tone));end if;
  keys:=keys||coalesce((select array_agg('playing_age:'||eps.appearance_supplied_key('playing_age',v)) from unnest(a.playing_age) v),'{}')
   ||coalesce((select array_agg('hair_length:'||eps.appearance_supplied_key('hair_length',v)) from unnest(a.hair_length) v),'{}')
   ||coalesce((select array_agg('hair_length:bald_or_shaved'::text) from unnest(a.hair_style) v where v in('Bald','Shaved Head')),'{}')
   ||coalesce((select array_agg('hair_texture:'||eps.appearance_supplied_key('hair_texture',v)) from unnest(a.hair_texture) v),'{}')
   ||coalesce((select array_agg('hair_colour:'||eps.appearance_supplied_key('hair_colour',v)) from unnest(a.hair_colour) v),'{}')
   ||coalesce((select array_agg('tags:'||eps.appearance_norm(v)) from unnest(a.tags) v where eps.appearance_tag_facet_ok(v,a.nationality,a.country)),'{}');
 end if;
 keys:=keys||coalesce((select array_agg(o.attribute||':'||case o.status when 'overridden' then o.override_value else o.suggested_value end)
  from eps.candidate_observations o join eps.candidate_observation_media m on m.id=o.media_id
  where o.candidate_id=p_candidate and o.status in('confirmed','overridden') and (not m.ambiguous or m.target_person_index=o.person_index)
   and o.attribute in('playing_age','skin_tone','hair_length','hair_colour','hair_texture','facial_hair','glasses','build')
   and case o.status when 'overridden' then o.override_value else o.suggested_value end<>'unknown'),'{}');
 select coalesce(array_agg(distinct k order by k),'{}') into keys from unnest(keys) k;
 row_value.candidate_id:=c.id;row_value.active:=c.archived_at is null and c.merged_into_candidate_id is null;
 row_value.name_norm:=eps.appearance_norm(c.facts->>'name');row_value.name_ar_norm:=eps.appearance_norm(a.name_ar);row_value.casting_id_norm:=lower(c.casting_id);
 row_value.tags:=coalesce((select array_agg(distinct eps.appearance_norm(v)) from unnest(a.tags) v where eps.appearance_tag_facet_ok(v,a.nationality,a.country)),'{}');
 row_value.facet_keys:=keys;row_value.facet_names:=coalesce((select array_agg(distinct split_part(k,':',1) order by split_part(k,':',1)) from unnest(keys) k),'{}');
 row_value.updated_at:=clock_timestamp();return row_value;
end$$;
create function eps.refresh_candidate_projection(p_candidate uuid) returns void language plpgsql volatile security definer set search_path='' as $$
declare r eps.candidate_search_projection;begin
 r:=eps.appearance_projection_row(p_candidate);if r.candidate_id is null then return;end if;
 insert into eps.candidate_search_projection select (r).* on conflict(candidate_id) do update set active=excluded.active,name_norm=excluded.name_norm,name_ar_norm=excluded.name_ar_norm,
  casting_id_norm=excluded.casting_id_norm,tags=excluded.tags,facet_keys=excluded.facet_keys,facet_names=excluded.facet_names,updated_at=excluded.updated_at;
end$$;
create function eps.appearance_projection_trigger() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_table_name='candidates' then perform eps.refresh_candidate_projection(new.id);
 elsif tg_table_name='candidate_observation_media' then perform eps.refresh_candidate_projection(new.candidate_id);
 else perform eps.refresh_candidate_projection(new.candidate_id);end if;
 return null;
end$$;
create trigger appearance_projection after insert or update of facts,casting_id,archived_at,merged_into_candidate_id on eps.candidates for each row execute function eps.appearance_projection_trigger();
create trigger appearance_projection after insert or update on eps.candidate_attributes for each row execute function eps.appearance_projection_trigger();
create trigger appearance_projection after insert or update of status,override_value,suggested_value on eps.candidate_observations for each row execute function eps.appearance_projection_trigger();
create trigger appearance_projection after update of ambiguous,target_person_index on eps.candidate_observation_media for each row execute function eps.appearance_projection_trigger();

-- 7. Facet filters: {"facets":{"hair_colour":["black","dark"],...},"include_unknown":false}. OR within a facet, AND across.
create function eps.appearance_filters(p_filters jsonb) returns jsonb language plpgsql immutable set search_path='' as $$declare f record;v jsonb;begin
 if p_filters is null or p_filters='null'::jsonb then return '{"facets":{},"include_unknown":false}'::jsonb;end if;
 if jsonb_typeof(p_filters)<>'object' or exists(select 1 from jsonb_object_keys(p_filters) k where k not in('facets','include_unknown','q','search'))
  or p_filters ? 'include_unknown' and jsonb_typeof(p_filters->'include_unknown')<>'boolean'
  or p_filters ? 'q' and (jsonb_typeof(p_filters->'q')<>'string' or length(p_filters->>'q')>200)
  or p_filters ? 'search' and (jsonb_typeof(p_filters->'search')<>'object' or octet_length((p_filters->'search')::text)>10000
   or exists(select 1 from jsonb_each(p_filters->'search') e where e.key not in('q','include_unknown','review_status','age_or_range','stated_gender','height_measurements','language','accent',
    'skill','city','previous_project_role','classification') or e.key='include_unknown' and jsonb_typeof(e.value)<>'boolean' or e.key<>'include_unknown' and (jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}')>500))
   or p_filters->'search'?'review_status' and p_filters#>>'{search,review_status}' not in('reviewed','unreviewed'))
  or p_filters ? 'facets' and jsonb_typeof(p_filters->'facets')<>'object' then perform eps.fail('VALIDATION_FAILED','Provide facets as {facet:[values]} and include_unknown as a boolean.',400);end if;
 for f in select key,value from jsonb_each(coalesce(p_filters->'facets','{}')) loop
  if not f.key=any(eps.appearance_facet_keys_allowed()) or jsonb_typeof(f.value)<>'array' or jsonb_array_length(f.value)>50 then perform eps.fail('VALIDATION_FAILED','Unsupported facet filter.',400);end if;
  for v in select value from jsonb_array_elements(f.value) loop
   if jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 200 then perform eps.fail('VALIDATION_FAILED','Facet values are short strings.',400);end if;
  end loop;
 end loop;
 return jsonb_build_object('facets',coalesce((select jsonb_object_agg(key,(select coalesce(jsonb_agg(distinct x order by x),'[]'::jsonb) from(
   select case when e='unknown' then e when key in('city','stated_gender','languages','tags') then eps.appearance_norm(e) else e end x from jsonb_array_elements_text(value) e)y))
  from jsonb_each(coalesce(p_filters->'facets','{}')) where jsonb_array_length(value)>0),'{}'::jsonb),'include_unknown',coalesce((p_filters->>'include_unknown')::boolean,false),
  'q',eps.appearance_norm(p_filters->>'q'),'search',coalesce(p_filters->'search','{}'::jsonb));
end$$;
-- Normalised substring match over English/Arabic names, casting id and tags (null/empty query matches everyone).
create function eps.appearance_text_ok(p_name text,p_name_ar text,p_casting text,p_tags text[],p_q text) returns boolean language sql immutable set search_path='' as $$
 select p_q is null or strpos(coalesce(p_name,''),p_q)>0 or strpos(coalesce(p_name_ar,''),p_q)>0 or strpos(p_casting,p_q)>0 or exists(select 1 from unnest(p_tags) t where strpos(t,p_q)>0)$$;
create function eps.appearance_filter_ok(p_keys text[],p_names text[],p_filters jsonb,p_skip text) returns boolean language sql immutable set search_path='' as $$
 select not exists(select 1 from jsonb_each(p_filters->'facets') f where f.key is distinct from p_skip
  and not(p_keys && array(select f.key||':'||v from jsonb_array_elements_text(f.value) v)
   or not(f.key=any(p_names)) and ((p_filters->>'include_unknown')::boolean or f.value ? 'unknown')))$$;
-- For A1's search: normalised EN/AR name, casting id or tag match (same rule eps_candidate_facets applies for "q").
create function eps.cast_text_match(p_candidate_id uuid,p_q text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select eps.appearance_text_ok(p.name_norm,p.name_ar_norm,p.casting_id_norm,p.tags,eps.appearance_norm(p_q)) from eps.candidate_search_projection p where p.candidate_id=p_candidate_id),false)$$;
-- For A1's search: true when the candidate passes every facet filter (normalised filters only; see eps.appearance_filters).
create function eps.cast_facet_match(p_candidate_id uuid,p_filters jsonb) returns boolean language plpgsql stable security definer set search_path='' as $$
declare filters jsonb:=eps.appearance_filters(p_filters);begin
 if filters->'facets'='{}'::jsonb then return true;end if;
 return coalesce((select eps.appearance_filter_ok(p.facet_keys,p.facet_names,filters,null) from eps.candidate_search_projection p where p.candidate_id=p_candidate_id),false);
end$$;
-- The single Cast Library row predicate shared by public.eps_search_candidates and public.eps_candidate_facets:
-- A1's supplied-fact filters (cast_search_match; its q, or the normalised EN/AR name/casting id/tag match), Reviewed
-- status, and facet filters. p_search uses A1's search keys plus "facets" and "facet_include_unknown".
create function eps.cast_library_row_ok(p_candidate eps.candidates,p_search jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select (eps.cast_search_match(p_candidate.facts,p_search) is not null
   or nullif(btrim(p_search->>'q'),'') is not null and eps.cast_search_match(p_candidate.facts,p_search-'q') is not null and eps.cast_text_match(p_candidate.id,p_search->>'q'))
  and (not p_search?'review_status' or (p_search->>'review_status'='reviewed')=eps.cast_is_reviewed(p_candidate))
  and (not p_search?'facets' or eps.cast_facet_match(p_candidate.id,jsonb_build_object('facets',p_search->'facets','include_unknown',coalesce(p_search->'facet_include_unknown','false'::jsonb))))$$;
create function public.eps_candidate_facets(p_filters jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare filters jsonb;search jsonb;facets jsonb:='[]';f text;total bigint;unknown bigint;matched bigint;vals jsonb;begin
 perform eps.require_capability('cast.read');filters:=eps.appearance_filters(p_filters);
 -- Same supplied-fact/text/Reviewed predicate as search; facet filters are applied per facet below.
 search:=filters->'search'||case when filters->>'q' is not null then jsonb_build_object('q',filters->>'q') else '{}'::jsonb end;
 select count(*) into total from eps.candidate_search_projection p join eps.candidates c on c.id=p.candidate_id where p.active and eps.appearance_filter_ok(p.facet_keys,p.facet_names,filters,null)
  and eps.cast_library_row_ok(c,search);
 foreach f in array eps.appearance_facet_keys_allowed() loop
  select count(*),count(*) filter(where not(f=any(p.facet_names))) into matched,unknown from eps.candidate_search_projection p join eps.candidates c on c.id=p.candidate_id
   where p.active and eps.appearance_filter_ok(p.facet_keys,p.facet_names,filters,f) and eps.cast_library_row_ok(c,search);
  select coalesce(jsonb_agg(jsonb_build_object('value',value,'count',n) order by n desc,value),'[]') into vals from(
   select substr(k,length(f)+2) value,count(distinct p.candidate_id) n from eps.candidate_search_projection p join eps.candidates c on c.id=p.candidate_id cross join unnest(p.facet_keys) k
   where p.active and k like f||':%' and eps.appearance_filter_ok(p.facet_keys,p.facet_names,filters,f) and eps.cast_library_row_ok(c,search)
   group by 1 order by 2 desc,1 limit case when f='tags' then 30 else 100 end)x;
  facets:=facets||jsonb_build_array(jsonb_build_object('key',f,'matched',matched,'unknown',unknown,'values',vals,
   'selected',coalesce(filters#>array['facets',f],'[]'::jsonb)));
 end loop;
 return jsonb_build_object('data',jsonb_build_object('total',total,'filters',filters,'facets',facets));
end$$;

-- 8. Observation reads and review.
create function eps.appearance_observation_dto(o eps.candidate_observations) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',o.id,'media_id',o.media_id,'person_index',o.person_index,'position_note',o.position_note,'attribute',o.attribute,'suggested_value',o.suggested_value,
  'confidence',o.confidence,'evidence',o.evidence,'status',o.status,'override_value',o.override_value,
  'effective_value',case o.status when 'confirmed' then o.suggested_value when 'overridden' then o.override_value else null end,
  'reviewed_by',o.reviewed_by,'reviewed_at',o.reviewed_at,'row_version',o.row_version)$$;
create function eps.appearance_media_dto(m eps.candidate_observation_media) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',m.id,'asset_id',m.asset_id,'source_kind',m.source_kind,
  'thumb_asset_id',case when m.source_kind='photo' then (select p.thumb_asset_id from eps.candidate_photos p where p.asset_id=m.asset_id and p.candidate_id=m.candidate_id) else m.asset_id end,
  'candidate_media_id',m.candidate_media_id,'frame_timestamp_ms',m.frame_timestamp_ms,'media_category',m.media_category,'recording_context',m.recording_context,
  'media_added_at',m.media_added_at,'people_count',m.people_count,'ambiguous',m.ambiguous,'target_person_index',m.target_person_index,'quality_note',m.quality_note,
  'model',m.model,'prompt_version',m.prompt_version,'analyzed_at',m.analyzed_at,'row_version',m.row_version,
  'observations',coalesce((select jsonb_agg(eps.appearance_observation_dto(o) order by o.person_index,o.attribute) from eps.candidate_observations o where o.media_id=m.id),'[]'::jsonb))$$;
-- Supplied information with its real provenance, shown beside (never merged with) observations:
--  * archive labels (m09) carry their import source; they are neither self-reported nor human-confirmed;
--  * supplied facts carry their field source (transcript/manual/archive) as stored on the candidate;
--  * stated age is supplied information, separate from any playing-age suggestion.
create function eps.appearance_supplied_dto(p_candidate uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'archive',(select jsonb_build_object('source',jsonb_build_object('kind','archive_import','source_project',a.source_project,'source_id',a.source_id,'imported_at',a.imported_at),
    'name_ar',a.name_ar,'talent_type',a.talent_type,'look',a.look,'skin_tone',a.skin_tone,'playing_age',to_jsonb(a.playing_age),'hair_length',to_jsonb(a.hair_length),
    'hair_texture',to_jsonb(a.hair_texture),'hair_colour',to_jsonb(a.hair_colour),'hair_style',to_jsonb(a.hair_style),'hair_colouring',to_jsonb(a.hair_colouring),'tags',to_jsonb(a.tags))
   from eps.candidate_attributes a where a.candidate_id=p_candidate),
  'facts',(select jsonb_agg(jsonb_build_object('key',k,'value',c.facts->k,
    'source',case when jsonb_typeof(c.field_sources->k)='object' and c.field_sources->k->>'kind' in('manual','transcript','archive') then c.field_sources->k->>'kind'
     when c.source_kind='archive' and c.facts->k is not null and c.facts->k<>'null'::jsonb then 'archive' else null end) order by ord)
   from eps.candidates c,unnest(array['stated_gender','age_or_range','city','languages']) with ordinality u(k,ord) where c.id=p_candidate))$$;
create function public.eps_list_candidate_observations(p_candidate_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform eps.require_capability('cast.read');
 if p_candidate_id is null or not exists(select 1 from eps.candidates where id=p_candidate_id) then perform eps.fail('RESOURCE_NOT_FOUND','Candidate not found.',404);end if;
 return jsonb_build_object('data',jsonb_build_object('candidate_id',p_candidate_id,'supplied',eps.appearance_supplied_dto(p_candidate_id),'media',coalesce((select jsonb_agg(eps.appearance_media_dto(m) order by m.media_added_at desc,m.id)
  from(select * from eps.candidate_observation_media where candidate_id=p_candidate_id order by media_added_at desc,id limit 100)m),'[]'::jsonb)));
end$$;
-- body: {"row_version":n,"action":"confirm"|"reject"|"override"|"reset","value":"<taxonomy key>"(override only)}.
-- Repeating the same decision is idempotent (no version needed to match); a different decision on a stale version is refused.
-- The Idempotency-Key is recorded (eps.idempotency_records): the same key and body replays the first response; the same key
-- with a different body is IDEMPOTENCY_KEY_REUSED. Capabilities are checked before any replay.
create function public.eps_review_candidate_observation(p_observation_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare o eps.candidate_observations;m eps.candidate_observation_media;action text;next_status text;next_value text;principal uuid:=auth.uid();payload jsonb;replay jsonb;begin
 perform eps.require_capability('cast.read');perform eps.require_capability('cast.review');
 if p_idempotency_key is null or length(p_idempotency_key) not between 16 and 200 then perform eps.fail('VALIDATION_FAILED','Provide a stable Idempotency-Key.',400);end if;
 if jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in('row_version','action','value'))
  or jsonb_typeof(p_input->'row_version')<>'number' or p_input->>'action' not in('confirm','reject','override','reset')
  or (p_input->>'action'='override')<>(jsonb_typeof(p_input->'value')='string') then perform eps.fail('VALIDATION_FAILED','Provide row_version, an action and a value only for override.',400);end if;
 payload:=jsonb_build_object('id',p_observation_id,'input',p_input);
 replay:=eps.idempotency_begin('appearance.review_observation',p_idempotency_key,payload);if replay is not null then return replay;end if;
 select * into o from eps.candidate_observations where id=p_observation_id for update;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Observation not found.',404);end if;
 select * into m from eps.candidate_observation_media where id=o.media_id for update;
 action:=p_input->>'action';next_status:=case action when 'confirm' then 'confirmed' when 'reject' then 'rejected' when 'override' then 'overridden' else 'suggested' end;
 next_value:=case when action='override' then p_input->>'value' end;
 if action='override' and not eps.appearance_value_valid(o.attribute,next_value) or next_value='unknown' then perform eps.fail('VALIDATION_FAILED','Choose a value from this attribute''s vocabulary.',400);end if;
 if action='confirm' and o.suggested_value='unknown' then perform eps.fail('VALIDATION_FAILED','An unknown suggestion cannot be confirmed; override it with an observed value or reject it.',400);end if;
 if o.status=next_status and o.override_value is not distinct from next_value then
  return eps.finish_mutation('appearance.review_observation',p_idempotency_key,payload,jsonb_build_object('data',eps.appearance_observation_dto(o),'changed',false),o.id);end if;
 if (p_input->>'row_version')::bigint<>o.row_version then perform eps.fail('STALE_RESOURCE_VERSION','This observation changed. Reload and review again.',409,o.row_version);end if;
 if m.ambiguous and action in('confirm','override') then
  if m.target_person_index is null then update eps.candidate_observation_media set target_person_index=o.person_index,row_version=row_version+1 where id=m.id;
  elsif m.target_person_index<>o.person_index then perform eps.fail('TARGET_PERSON_CONFLICT','Another person in this media is already confirmed as the candidate.',409);end if;
 end if;
 update eps.candidate_observations set status=next_status,override_value=next_value,reviewed_by=case when next_status='suggested' then null else principal end,
  reviewed_at=case when next_status='suggested' then null else clock_timestamp() end,updated_at=clock_timestamp(),row_version=row_version+1 where id=o.id returning * into o;
 if m.ambiguous and action in('reject','reset') and m.target_person_index=o.person_index and not exists(select 1 from eps.candidate_observations x where x.media_id=m.id
  and x.person_index=o.person_index and x.status in('confirmed','overridden')) then update eps.candidate_observation_media set target_person_index=null,row_version=row_version+1 where id=m.id;end if;
 return eps.finish_mutation('appearance.review_observation',p_idempotency_key,payload,jsonb_build_object('data',eps.appearance_observation_dto(o),'changed',true),o.id);
end$$;

-- 9. Batches and the job kernel for candidate_appearance / analyze_appearance.
create function eps.appearance_hash(p_value jsonb) returns text language sql immutable set search_path='' as $$select encode(sha256(convert_to(p_value::text,'UTF8')),'hex')$$;
create function eps.appearance_error(p_code text,p_retryable boolean default false) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('code',p_code,'message',case p_code
  when 'PERMISSION_CHANGED' then 'The requester no longer has enrichment authority. Existing observations were kept.'
  when 'INPUT_CHANGED' then 'The candidate media changed before analysis. Existing observations were kept.'
  when 'RESULT_INVALID' then 'Analysis returned an invalid result. Existing observations were kept.'
  when 'LEASE_EXPIRED' then 'The processing lease expired before completion.'
  when 'RETRY_EXHAUSTED' then 'Appearance analysis retry budget exhausted. Existing observations were kept.'
  when 'PROVIDER_RATE_LIMITED' then 'The processing provider is temporarily rate limited.'
  when 'DEPENDENCY_UNAVAILABLE' then 'A required processing service is temporarily unavailable.'
  else 'Appearance analysis failed. Existing observations were kept.' end,'details','{}'::jsonb,'retryable',p_retryable)$$;
create function eps.appearance_is_job(p_job uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from eps.jobs where id=p_job and kind='candidate_appearance')$$;
create function eps.appearance_can_write(p_principal uuid,p_workspace uuid) returns boolean language sql stable security definer set search_path='' as $$
 select eps.job_requester_active(p_principal) and exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id join public.project_memberships m on m.project_id=p.id
  where w.id=p_workspace and w.archived_at is null and p.archived_at is null and m.principal_id=p_principal and m.active and m.can_write)
 and exists(select 1 from public.app_capability_grants g where g.principal_id=p_principal and g.capability='cast.write' and g.active)
 and exists(select 1 from public.app_capability_grants g where g.principal_id=p_principal and g.capability='cast.read' and g.active)$$;
-- Ready authorised media for one person: cover photo, other archive photos, chosen frames, then other extracted frames.
create function eps.appearance_media_input(p_candidate uuid,p_limit integer) returns jsonb language sql stable security definer set search_path='' as $$
 with cover as(select cover_photo_id from eps.candidate_attributes where candidate_id=p_candidate),
 photos as(select a.id asset_id,'photo' kind,null::uuid candidate_media_id,null::bigint ts,a.size_bytes,a.sha256,a.width,a.height,
   case when p.id=(select cover_photo_id from cover) then 0 else 1 end grp,p.position ord
  from eps.candidate_photos p join eps.media_assets a on a.id=p.asset_id where p.candidate_id=p_candidate and a.status='ready' and a.purpose='candidate_photo' and a.sha256 is not null),
 frames as(select a.id asset_id,'frame' kind,cm.id candidate_media_id,a.source_timestamp_ms ts,a.size_bytes,a.sha256,a.width,a.height,
   case when a.id=any(cm.selected_frame_asset_ids) then 2 else 3 end grp,coalesce(cm.source_position,1000)*100000000+a.source_timestamp_ms ord
  from eps.candidate_media cm join eps.candidate_media_frames f on f.candidate_media_id=cm.id join eps.media_assets a on a.id=f.asset_id
  where cm.candidate_id=p_candidate and a.status='ready' and a.purpose='candidate_frame' and a.mime_type='image/jpeg' and a.sha256 is not null and a.source_timestamp_ms is not null),
 chosen as(select * from(select * from photos union all select * from frames)x order by grp,ord,asset_id limit p_limit)
 select coalesce(jsonb_agg(jsonb_build_object('media_ref','m'||n,'asset_id',asset_id,'source_kind',kind,'candidate_media_id',candidate_media_id,'frame_timestamp_ms',ts,
  'mime_type','image/jpeg','size_bytes',size_bytes,'sha256',sha256,'width',width,'height',height) order by n),'[]'::jsonb)
 from(select *,row_number() over(order by grp,ord,asset_id) n from chosen)y$$;
create function eps.appearance_stage_matches(p_job eps.jobs) returns boolean language sql stable security definer set search_path='' as $$
 select p_job.kind='candidate_appearance' and p_job.stage='analyze_appearance' and p_job.input_hash_version='eps.appearance-input.pg-jsonb.v1' and p_job.input_hash=eps.appearance_hash(p_job.input)
 and exists(select 1 from eps.candidates c where c.id=p_job.resource_id and c.archived_at is null and c.merged_into_candidate_id is null and p_job.input->>'candidate_id'=c.id::text)
 and jsonb_array_length(p_job.input->'media')>=1
 and not exists(select 1 from jsonb_array_elements(p_job.input->'media') e where not exists(select 1 from eps.media_assets a where a.id=(e->>'asset_id')::uuid and a.status='ready'
  and a.sha256=e->>'sha256' and a.size_bytes=(e->>'size_bytes')::bigint and a.mime_type='image/jpeg'
  and (e->>'source_kind'='photo' and a.purpose='candidate_photo' and exists(select 1 from eps.candidate_photos p where p.asset_id=a.id and p.candidate_id=p_job.resource_id)
   or e->>'source_kind'='frame' and a.purpose='candidate_frame' and exists(select 1 from eps.candidate_media cm join eps.candidate_media_frames f on f.candidate_media_id=cm.id
    where f.asset_id=a.id and cm.candidate_id=p_job.resource_id and cm.id::text=e->>'candidate_media_id'))))$$;
create function eps.appearance_stage_lock(p_job uuid,p_require_access boolean default true) returns eps.jobs language plpgsql volatile security definer set search_path='' as $$
declare identity eps.jobs;job eps.jobs;begin
 select * into identity from eps.jobs where id=p_job and kind='candidate_appearance';if not found then perform eps.fail('RESOURCE_NOT_FOUND','Appearance job not found.',404);end if;
 perform 1 from eps.workspaces where id=identity.workspace_id for update;
 select * into job from eps.jobs where id=p_job and workspace_id=identity.workspace_id and kind='candidate_appearance' for update;
 perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
 if p_require_access and not eps.appearance_can_write(job.requested_by,job.workspace_id) then perform eps.fail('PERMISSION_CHANGED','The requester no longer has enrichment authority.',403);end if;
 return job;
end$$;
create function eps.appearance_stage_current(p_job uuid,p_attempt uuid,p_token text) returns eps.jobs language plpgsql volatile security definer set search_path='' as $$declare job eps.jobs;begin
 job:=eps.appearance_stage_lock(p_job);
 perform eps.specs_stage_assert(job.status='running' and job.current_attempt_id=p_attempt and job.cancel_requested_at is null and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(p_token~'^[a-f0-9]{64}$' and job.lease_token_digest=encode(sha256(convert_to(p_token,'UTF8')),'hex'),'LEASE_INVALID');
 perform eps.specs_stage_assert(eps.appearance_stage_matches(job),'INPUT_CHANGED');return job;
end$$;
create function eps.appearance_stage_live(p_job uuid,p_attempt uuid,p_hash text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from eps.jobs j where j.id=p_job and j.kind='candidate_appearance' and j.current_attempt_id=p_attempt and j.input_hash=p_hash and j.status='running'
  and j.cancel_requested_at is null and j.lease_expires_at>clock_timestamp() and eps.appearance_can_write(j.requested_by,j.workspace_id))$$;

-- Enqueue the next pending items of a running batch while under the in-flight bound and the spend cap.
create function eps.appearance_advance(p_batch uuid) returns void language plpgsql volatile security definer set search_path='' as $$
declare b eps.enrichment_batches;item eps.enrichment_batch_items;cfg eps.appearance_config;media jsonb;job_input jsonb;new_job uuid;in_flight integer;begin
 select * into b from eps.enrichment_batches where id=p_batch for update;if not found or b.status<>'running' then return;end if;
 select * into cfg from eps.appearance_config where id;
 loop
  select count(*) into in_flight from eps.enrichment_batch_items where batch_id=b.id and status='queued';
  if b.spent_micro_usd>=b.spend_cap_cents::bigint*10000 then
   if exists(select 1 from eps.enrichment_batch_items where batch_id=b.id and status='pending') then
    update eps.enrichment_batches set status='stopped_spend_cap',completed_at=clock_timestamp(),updated_at=clock_timestamp(),row_version=row_version+1 where id=b.id;return;end if;
  end if;
  select * into item from eps.enrichment_batch_items where batch_id=b.id and status='pending' order by position limit 1 for update;
  if not found then
   if in_flight=0 then update eps.enrichment_batches set status='completed',completed_at=clock_timestamp(),updated_at=clock_timestamp(),row_version=row_version+1 where id=b.id;end if;return;end if;
  exit when in_flight>=b.max_in_flight;
  if not coalesce(cfg.enabled,false) or cfg.model is distinct from b.model then
   update eps.enrichment_batch_items set status='failed',error_code='ENRICHMENT_DISABLED',updated_at=clock_timestamp() where id=item.id;continue;end if;
  if not exists(select 1 from eps.candidates where id=item.candidate_id and archived_at is null and merged_into_candidate_id is null) then
   update eps.enrichment_batch_items set status='skipped',error_code='CANDIDATE_INACTIVE',updated_at=clock_timestamp() where id=item.id;continue;end if;
  media:=eps.appearance_media_input(item.candidate_id,cfg.max_images);
  if jsonb_array_length(media)=0 then update eps.enrichment_batch_items set status='skipped',error_code='NO_READY_MEDIA',updated_at=clock_timestamp() where id=item.id;continue;end if;
  new_job:=gen_random_uuid();
  job_input:=jsonb_build_object('schema_version','1.0','batch_id',b.id,'item_id',item.id,'candidate_id',item.candidate_id,
   'configuration',jsonb_build_object('model',b.model,'prompt_version',b.prompt_version,'schema_version','1.0','taxonomy_version','appearance-taxonomy.v1','max_images',cfg.max_images),'media',media);
  insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,batch_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id)
   values(new_job,b.workspace_id,b.requested_by,'candidate_appearance',item.candidate_id,b.id,job_input,eps.appearance_hash(job_input),'eps.appearance-input.pg-jsonb.v1',
    encode(sha256(convert_to('candidate_appearance:'||b.id||':'||item.id,'UTF8')),'hex'),'analyze_appearance',new_job::text);
  insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)values(new_job,'analyze_appearance',eps.appearance_hash(job_input),1,new_job::text||':1',clock_timestamp());
  update eps.enrichment_batch_items set status='queued',job_id=new_job,updated_at=clock_timestamp() where id=item.id;
 end loop;
end$$;
create function eps.appearance_batch_dto(p_batch uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',b.id,'workspace_id',b.workspace_id,'status',b.status,'scope',b.scope,'item_limit',b.item_limit,'spend_cap_cents',b.spend_cap_cents,
  'spent_micro_usd',b.spent_micro_usd,'model',b.model,'prompt_version',b.prompt_version,'created_at',b.created_at,'updated_at',b.updated_at,'completed_at',b.completed_at,'row_version',b.row_version,
  'counts',(select jsonb_build_object('total',count(*),'pending',count(*) filter(where status='pending'),'queued',count(*) filter(where status='queued'),
   'succeeded',count(*) filter(where status='succeeded'),'failed',count(*) filter(where status='failed'),'skipped',count(*) filter(where status='skipped'),
   'input_tokens',coalesce(sum(input_tokens),0),'output_tokens',coalesce(sum(output_tokens),0)) from eps.enrichment_batch_items i where i.batch_id=b.id),
  'items',(select coalesce(jsonb_agg(jsonb_build_object('candidate_id',i.candidate_id,'position',i.position,'status',i.status,'job_id',i.job_id,'error_code',i.error_code,
   'cost_micro_usd',i.cost_micro_usd) order by i.position),'[]'::jsonb) from(select * from eps.enrichment_batch_items where batch_id=b.id order by position limit 200)i))
 from eps.enrichment_batches b where b.id=p_batch$$;
-- body: {"workspace_id":id,"candidate_ids":[...]} or {"workspace_id":id,"filters":{facets...}}, plus "limit" and "spend_cap_cents".
-- Same Idempotency-Key and same body returns the existing batch (and resumes it if it was stopped only by the cap and the cap is unchanged: no).
create function public.eps_start_enrichment_batch(p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare principal uuid:=auth.uid();cfg eps.appearance_config;existing eps.enrichment_batches;v_batch uuid:=gen_random_uuid();v_scope jsonb;v_hash text;filters jsonb;n integer;begin
 perform eps.require_capability('cast.read');perform eps.require_capability('cast.write');
 if p_idempotency_key is null or length(p_idempotency_key) not between 16 and 200 then perform eps.fail('VALIDATION_FAILED','Provide a stable Idempotency-Key.',400);end if;
 if jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in('workspace_id','candidate_ids','filters','limit','spend_cap_cents'))
  or not(p_input ?& array['workspace_id','limit','spend_cap_cents']) or (p_input ? 'candidate_ids')=(p_input ? 'filters')
  or not eps.specs_stage_integer(p_input->'limit',1,1000) or not eps.specs_stage_integer(p_input->'spend_cap_cents',1,1000000)
  or p_input ? 'candidate_ids' and (jsonb_typeof(p_input->'candidate_ids')<>'array' or jsonb_array_length(p_input->'candidate_ids') not between 1 and 1000
   or exists(select 1 from jsonb_array_elements(p_input->'candidate_ids') e where jsonb_typeof(e)<>'string' or e#>>'{}'!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'))
  or jsonb_typeof(p_input->'workspace_id')<>'string' or p_input->>'workspace_id'!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 then perform eps.fail('VALIDATION_FAILED','Provide workspace_id, either candidate_ids or filters, limit (1-1000) and spend_cap_cents.',400);end if;
 filters:=case when p_input ? 'filters' then eps.appearance_filters(p_input->'filters') end;
 v_scope:=case when p_input ? 'candidate_ids' then jsonb_build_object('kind','candidates','candidate_ids',p_input->'candidate_ids') else jsonb_build_object('kind','filters','filters',filters) end;
 v_hash:=eps.appearance_hash(jsonb_build_object('workspace_id',p_input->'workspace_id','scope',v_scope,'limit',p_input->'limit','spend_cap_cents',p_input->'spend_cap_cents'));
 select * into existing from eps.enrichment_batches where requested_by=principal and idempotency_key=p_idempotency_key;
 if found then
  if existing.request_hash<>v_hash then perform eps.fail('IDEMPOTENCY_KEY_REUSED','This Idempotency-Key was used for a different batch.',409);end if;
  -- A replay may enqueue more work, so it needs the same current workspace authority as a new batch.
  if not eps.appearance_can_write(principal,existing.workspace_id) then perform eps.fail('ACCESS_DENIED','You cannot start processing in this workspace.',403);end if;
  perform eps.appearance_advance(existing.id);return jsonb_build_object('data',eps.appearance_batch_dto(existing.id),'created',false);
 end if;
 if not eps.appearance_can_write(principal,(p_input->>'workspace_id')::uuid) then perform eps.fail('ACCESS_DENIED','You cannot start processing in this workspace.',403);end if;
 select * into cfg from eps.appearance_config where id;
 if not coalesce(cfg.enabled,false) then perform eps.fail('ENRICHMENT_UNAVAILABLE','Appearance enrichment is not configured.',503);end if;
 insert into eps.enrichment_batches(id,workspace_id,requested_by,idempotency_key,request_hash,scope,item_limit,spend_cap_cents,input_usd_per_mtok,output_usd_per_mtok,model,prompt_version)
  values(v_batch,(p_input->>'workspace_id')::uuid,principal,p_idempotency_key,v_hash,v_scope,(p_input->>'limit')::integer,(p_input->>'spend_cap_cents')::integer,
   cfg.input_usd_per_mtok,cfg.output_usd_per_mtok,cfg.model,cfg.prompt_version);
 if p_input ? 'candidate_ids' then
  insert into eps.enrichment_batch_items(batch_id,candidate_id,position)
  select v_batch,c.id,row_number() over(order by x.ord) from(select distinct on(e) e::uuid id,ord from jsonb_array_elements_text(p_input->'candidate_ids') with ordinality t(e,ord) order by e,ord)x
   join eps.candidates c on c.id=x.id and c.archived_at is null and c.merged_into_candidate_id is null order by x.ord limit (p_input->>'limit')::integer;
 else
  -- People never analysed with this prompt first, then newest first.
  insert into eps.enrichment_batch_items(batch_id,candidate_id,position)
  select v_batch,p.candidate_id,row_number() over(order by analysed,c.created_at desc,c.id) from eps.candidate_search_projection p join eps.candidates c on c.id=p.candidate_id
   cross join lateral(select exists(select 1 from eps.candidate_observation_media m where m.candidate_id=p.candidate_id and m.prompt_version=cfg.prompt_version) analysed)a
   where p.active and eps.appearance_filter_ok(p.facet_keys,p.facet_names,filters,null)
    and eps.cast_library_row_ok(c,filters->'search'||case when filters->>'q' is not null then jsonb_build_object('q',filters->>'q') else '{}'::jsonb end) order by analysed,c.created_at desc,c.id limit (p_input->>'limit')::integer;
 end if;
 get diagnostics n=row_count;
 if n=0 then perform eps.fail('VALIDATION_FAILED','No active people match this batch.',422);end if;
 insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type) values(principal,'appearance.start_batch',v_batch,null,'api');
 perform eps.appearance_advance(v_batch);
 return jsonb_build_object('data',eps.appearance_batch_dto(v_batch),'created',true);
end$$;
create function public.eps_get_enrichment_batch(p_batch_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare b eps.enrichment_batches;begin
 perform eps.require_capability('cast.read');
 select * into b from eps.enrichment_batches where id=p_batch_id;
 if not found or b.requested_by<>auth.uid() and not eps.has_capability('operations.read') then perform eps.fail('RESOURCE_NOT_FOUND','Enrichment batch not found.',404);end if;
 return jsonb_build_object('data',eps.appearance_batch_dto(b.id));
end$$;

-- Job status changes settle the batch item and advance the batch (success is recorded by the apply itself).
create function eps.appearance_job_lifecycle() returns trigger language plpgsql security definer set search_path='' as $$declare item eps.enrichment_batch_items;begin
 if new.kind<>'candidate_appearance' or new.status=old.status or new.status not in('succeeded','failed','cancelled','waiting_for_input') then return null;end if;
 select * into item from eps.enrichment_batch_items where job_id=new.id for update;if not found then return null;end if;
 if item.status='queued' then update eps.enrichment_batch_items set status=case when new.status='succeeded' then 'succeeded' else 'failed' end,
  error_code=case when new.status='succeeded' then null when new.status='cancelled' then 'JOB_CANCELLED' else coalesce(new.error->>'code','PROCESSING_FAILED') end,updated_at=clock_timestamp() where id=item.id;end if;
 perform eps.appearance_advance(item.batch_id);return null;
end$$;
create trigger appearance_job_lifecycle after update of status on eps.jobs for each row execute function eps.appearance_job_lifecycle();

create function eps.appearance_usage(p_job eps.jobs,p_input bigint,p_output bigint) returns void language plpgsql volatile security definer set search_path='' as $$
declare b eps.enrichment_batches;cost bigint;begin
 select * into b from eps.enrichment_batches where id=(p_job.input->>'batch_id')::uuid for update;if not found then return;end if;
 cost:=ceil(p_input*b.input_usd_per_mtok+p_output*b.output_usd_per_mtok)::bigint; -- tokens x USD per million tokens = micro-USD
 update eps.enrichment_batch_items set input_tokens=input_tokens+p_input,output_tokens=output_tokens+p_output,cost_micro_usd=cost_micro_usd+cost,updated_at=clock_timestamp() where job_id=p_job.id;
 update eps.enrichment_batches set spent_micro_usd=spent_micro_usd+cost,updated_at=clock_timestamp(),row_version=row_version+1 where id=b.id;
end$$;
-- Validate and apply one analysis. Suggested rows are refreshed; confirmed/rejected/overridden rows are never changed.
create function eps.appearance_apply(p_job eps.jobs,p_result jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare media jsonb;person jsonb;attr record;ref jsonb;m eps.candidate_observation_media;people integer;ambiguous boolean;observations integer:=0;at_value timestamptz:=clock_timestamp();
 category text;asset eps.media_assets;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_result,array['schema_version','model','prompt_version','taxonomy_version','usage','media'])
  and p_result->>'schema_version'='1.0' and p_result->>'prompt_version'=p_job.input#>>'{configuration,prompt_version}' and p_result->>'taxonomy_version'='appearance-taxonomy.v1'
  and jsonb_typeof(p_result->'model')='string' and length(p_result->>'model') between 1 and 200
  and eps.specs_stage_shape(p_result->'usage',array['input_tokens','output_tokens'],array['input_tokens','output_tokens'])
  and eps.specs_stage_integer(p_result#>'{usage,input_tokens}',0,100000000) and eps.specs_stage_integer(p_result#>'{usage,output_tokens}',0,100000000)
  and jsonb_typeof(p_result->'media')='array' and jsonb_array_length(p_result->'media')=jsonb_array_length(p_job.input->'media'),'RESULT_INVALID');
 for media in select value from jsonb_array_elements(p_result->'media') loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(media,array['media_ref','asset_id','media_category','people_count','ambiguous','quality_note','people'],array['media_ref','asset_id','media_category','people_count','ambiguous','quality_note','people'])
   and media->>'media_category' in('portfolio_photo','headshot','full_body','video_frame') and eps.specs_stage_integer(media->'people_count',0,10)
   and jsonb_typeof(media->'ambiguous')='boolean' and (media->'quality_note'='null' or jsonb_typeof(media->'quality_note')='string' and length(media->>'quality_note') between 1 and 300)
   and jsonb_typeof(media->'people')='array' and jsonb_array_length(media->'people')<=(media->>'people_count')::integer
   and eps.appearance_text_allowed(media->>'quality_note'),'RESULT_INVALID');
  select value into ref from jsonb_array_elements(p_job.input->'media') where value->>'media_ref'=media->>'media_ref' and value->>'asset_id'=media->>'asset_id';
  perform eps.specs_stage_assert(ref is not null,'RESULT_INVALID');
  perform eps.specs_stage_assert((select count(*) from jsonb_array_elements(p_result->'media') x where x->>'media_ref'=media->>'media_ref')=1,'RESULT_INVALID');
  category:=media->>'media_category';
  -- Video frames are always video frames; photos may be any photo category.
  perform eps.specs_stage_assert((ref->>'source_kind'='frame')=(category='video_frame'),'RESULT_INVALID');
  people:=(media->>'people_count')::integer;ambiguous:=(media->>'ambiguous')::boolean or people<>1 or jsonb_array_length(media->'people')>1;
  select * into asset from eps.media_assets where id=(ref->>'asset_id')::uuid;
  insert into eps.candidate_observation_media(candidate_id,asset_id,source_kind,candidate_media_id,frame_timestamp_ms,media_category,recording_context,media_added_at,people_count,ambiguous,
   quality_note,last_job_id,model,prompt_version,analyzed_at)
  values(p_job.resource_id,asset.id,ref->>'source_kind',(ref->>'candidate_media_id')::uuid,(ref->>'frame_timestamp_ms')::bigint,category,
   case when ref->>'source_kind'='photo' then 'archive_photo' else 'introduction_video' end,asset.created_at,people,ambiguous,media->>'quality_note',p_job.id,p_result->>'model',
   p_job.input#>>'{configuration,prompt_version}',at_value)
  -- Rerun: a reviewer-established target person is kept. When the new result makes the media ambiguous (e.g. now two
  -- people) and no target was recorded yet, the person whose rows were already confirmed/overridden becomes the target,
  -- so human decisions stay searchable; the new rows remain suggestions until reviewed.
  on conflict(candidate_id,asset_id) do update set media_category=excluded.media_category,people_count=excluded.people_count,ambiguous=excluded.ambiguous or eps.candidate_observation_media.ambiguous and eps.candidate_observation_media.target_person_index is not null,
   target_person_index=coalesce(eps.candidate_observation_media.target_person_index,case when excluded.ambiguous then(select min(x.person_index) from eps.candidate_observations x
    where x.media_id=eps.candidate_observation_media.id and x.status in('confirmed','overridden'))end),
   quality_note=excluded.quality_note,last_job_id=excluded.last_job_id,model=excluded.model,prompt_version=excluded.prompt_version,analyzed_at=excluded.analyzed_at,row_version=eps.candidate_observation_media.row_version+1
  returning * into m;
  for person in select value from jsonb_array_elements(media->'people') loop
   perform eps.specs_stage_assert(eps.specs_stage_shape(person,array['person_index','position_note','attributes'],array['person_index','position_note','attributes'])
    and eps.specs_stage_integer(person->'person_index',0,9) and (person->'position_note'='null' or jsonb_typeof(person->'position_note')='string' and length(person->>'position_note') between 1 and 200)
    and jsonb_typeof(person->'attributes')='object' and (person->>'person_index')::integer<people
    and (select count(*) from jsonb_array_elements(media->'people') x where x->'person_index'=person->'person_index')=1
    and eps.appearance_text_allowed(person->>'position_note'),'RESULT_INVALID');
   for attr in select key,value from jsonb_each(person->'attributes') loop
    perform eps.specs_stage_assert(eps.specs_stage_shape(attr.value,array['value','confidence','evidence'],array['value','confidence','evidence'])
     and jsonb_typeof(attr.value->'value')='string' and eps.appearance_value_valid(attr.key,attr.value->>'value') and attr.value->>'confidence' in('low','medium','high')
     and (attr.value->'evidence'='null' or jsonb_typeof(attr.value->'evidence')='string' and length(attr.value->>'evidence') between 1 and 300)
     and eps.appearance_text_allowed(attr.value->>'evidence'),'RESULT_INVALID');
    insert into eps.candidate_observations(candidate_id,media_id,person_index,position_note,attribute,suggested_value,confidence,evidence,job_id)
    values(p_job.resource_id,m.id,(person->>'person_index')::smallint,person->>'position_note',attr.key,attr.value->>'value',attr.value->>'confidence',attr.value->>'evidence',p_job.id)
    on conflict(media_id,person_index,attribute) do update set position_note=excluded.position_note,suggested_value=excluded.suggested_value,confidence=excluded.confidence,evidence=excluded.evidence,
     job_id=excluded.job_id,updated_at=clock_timestamp(),row_version=eps.candidate_observations.row_version+1
    where eps.candidate_observations.status='suggested';
    observations:=observations+1;
   end loop;
  end loop;
 end loop;
 perform eps.appearance_usage(p_job,(p_result#>>'{usage,input_tokens}')::bigint,(p_result#>>'{usage,output_tokens}')::bigint);
 return jsonb_build_object('media_count',jsonb_array_length(p_result->'media'),'observation_count',observations);
end$$;

create function eps.claim_appearance_job_stage(p_input jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;completed jsonb;token text;attempts integer;at_value timestamptz;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','stage','input_hash','workflow_execution_id'],array['job_id','stage','input_hash']) and p_input->>'stage'='analyze_appearance' and p_input->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.appearance_stage_lock((p_input->>'job_id')::uuid);at_value:=clock_timestamp();
 perform eps.specs_stage_assert(exists(select 1 from eps.appearance_config where id and enabled and model=job.input#>>'{configuration,model}'),'DEPENDENCY_UNAVAILABLE');
 perform eps.specs_stage_assert(job.input_hash=p_input->>'input_hash','INPUT_HASH_MISMATCH');perform eps.specs_stage_assert(eps.appearance_stage_matches(job),'INPUT_CHANGED');
 if job.status='cancelled' or job.cancel_requested_at is not null then perform eps.fail('JOB_CANCELLED','Appearance analysis was cancelled.',409);end if;
 select value into completed from jsonb_array_elements(job.completed_stages) value where value->>'stage'=p_input->>'stage' and value->>'input_hash'=job.input_hash;
 if completed is not null then return jsonb_build_object('job_id',job.id,'stage',p_input->>'stage','attempt_id',completed->>'attempt_id','lease_token','','lease_expires_at',completed->>'completed_at',
  'already_completed',true,'input',jsonb_build_object('input_hash',job.input_hash,'result_schema',completed->>'result_schema','result',completed->'result'));end if;
 perform eps.specs_stage_assert(job.stage=p_input->>'stage','STAGE_OUT_OF_ORDER');
 if job.status='running' and job.lease_expires_at>at_value then perform eps.fail('JOB_ALREADY_RUNNING','This stage already has an active lease.',409);end if;
 perform eps.specs_stage_assert(job.status in('queued','running') and job.available_at<=at_value,'JOB_NOT_AVAILABLE');
 attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);perform eps.specs_stage_assert(attempts<3,'RETRY_EXHAUSTED');token:=encode(extensions.gen_random_bytes(32),'hex');
 update eps.jobs set status='running',attempt=attempt+1,current_attempt_id=gen_random_uuid(),lease_token_digest=encode(sha256(convert_to(token,'UTF8')),'hex'),lease_expires_at=at_value+interval '90 seconds',
  heartbeat_at=at_value,last_event_sequence=0,stage_attempts=jsonb_set(stage_attempts,array[stage],to_jsonb(attempts+1)),progress_completed=0,progress_total=null,error=null,
  n8n_execution_id=p_input->>'workflow_execution_id',row_version=row_version+1,updated_at=at_value where id=job.id returning * into job;
 return jsonb_build_object('job_id',job.id,'stage',job.stage,'attempt_id',job.current_attempt_id,'lease_token',token,'lease_expires_at',job.lease_expires_at,'already_completed',false,
  'input',job.input||jsonb_build_object('input_hash',job.input_hash));
end$$;
create function eps.get_appearance_stage_input(p_job_id uuid,p_attempt_id uuid,p_lease_token text) returns jsonb language plpgsql volatile security definer set search_path='' as $$declare job eps.jobs;begin
 job:=eps.appearance_stage_current(p_job_id,p_attempt_id,p_lease_token);
 return job.input||jsonb_build_object('job_id',job.id,'attempt_id',p_attempt_id,'stage','analyze_appearance','input_hash',job.input_hash);
end$$;
create function eps.get_appearance_asset_access(p_input jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;asset eps.media_assets;token text;at_value timestamptz;expiry timestamptz;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','asset_id','access'],array['job_id','attempt_id','lease_token','asset_id'])
  and coalesce(p_input->>'access','read')='read');
 job:=eps.appearance_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 select * into asset from eps.media_assets a where a.id=eps.input_uuid(p_input->>'asset_id') and a.status='ready'
  and exists(select 1 from jsonb_array_elements(job.input->'media') e where e->>'asset_id'=a.id::text and e->>'sha256'=a.sha256);
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Asset not available to this appearance stage.',404);end if;
 at_value:=clock_timestamp();expiry:=least(job.lease_expires_at,at_value+interval '60 seconds');perform eps.specs_stage_assert(expiry>at_value,'STALE_STAGE_LEASE');
 token:=rtrim(translate(replace(encode(extensions.gen_random_bytes(32),'base64'),E'\n',''),'+/','-_'),'=');
 insert into eps.appearance_asset_grants(token_digest,job_id,attempt_id,input_hash,asset_id,bucket,object_key,created_at,expires_at)
  values(encode(sha256(convert_to(token,'UTF8')),'hex'),job.id,job.current_attempt_id,job.input_hash,asset.id,asset.bucket,asset.object_key,at_value,expiry);
 return jsonb_build_object('asset_id',asset.id,'bucket',asset.bucket,'object_key',asset.object_key,'permission','read','grant_token',token,'expires_at',expiry,
  'mime_type',asset.mime_type,'size_bytes',asset.size_bytes,'sha256',asset.sha256);
end$$;
create function eps.appearance_capability_allowed(p_bucket text,p_key text,p_permission text) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare headers jsonb;token text;begin
 if p_bucket not in('eps-candidate-photos','eps-candidate-outputs') or p_permission<>'read' then return false;end if;
 begin headers:=nullif(current_setting('request.headers',true),'')::jsonb;exception when others then return false;end;
 token:=headers->>'x-eps-asset-grant';if jsonb_typeof(headers) is distinct from 'object' or token is null or token!~'^[A-Za-z0-9_-]{43}$' then return false;end if;
 return exists(select 1 from eps.appearance_asset_grants g join eps.media_assets a on a.id=g.asset_id where g.token_digest=encode(sha256(convert_to(token,'UTF8')),'hex')
  and g.bucket=p_bucket and g.object_key=p_key and g.expires_at>clock_timestamp() and a.bucket=p_bucket and a.object_key=p_key and a.status='ready'
  and eps.appearance_stage_live(g.job_id,g.attempt_id,g.input_hash));
end$$;
create function eps.record_appearance_job_event(p_event jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;previous eps.job_events;receipt jsonb;digest text;attempt uuid;sequence_value bigint;at_value timestamptz;safe_error jsonb;applied jsonb;usage jsonb;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_event,array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash','result_schema','result','error'],
  array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash']) and octet_length(p_event::text)<=409600 and p_event->>'stage'='analyze_appearance'
  and p_event->>'event_type' in('heartbeat','progress','succeeded','failed') and eps.specs_stage_integer(p_event->'sequence',1) and length(p_event->>'event_id') between 1 and 200
  and p_event->>'lease_token'~'^[a-f0-9]{64}$' and p_event->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.appearance_stage_lock((p_event->>'job_id')::uuid,false);at_value:=clock_timestamp();attempt:=(p_event->>'attempt_id')::uuid;sequence_value:=(p_event->>'sequence')::bigint;
 digest:=encode(sha256(convert_to(p_event::text,'UTF8')),'hex');
 select * into previous from eps.job_events where job_id=job.id and attempt_id=attempt and event_id=p_event->>'event_id';
 if found then perform eps.specs_stage_assert(previous.payload_digest=digest,'EVENT_ID_CONFLICT');return previous.receipt||'{"duplicate":true,"applied":false}'::jsonb;end if;
 perform eps.specs_stage_assert(not exists(select 1 from eps.job_events where job_id=job.id and attempt_id=attempt and sequence=sequence_value),'EVENT_SEQUENCE_CONFLICT');
 receipt:=jsonb_build_object('event_id',p_event->>'event_id','applied',false,'duplicate',false,'stale',false,'job_status',job.status);
 if job.status<>'running' or job.cancel_requested_at is not null or job.current_attempt_id<>attempt or job.stage<>p_event->>'stage' or job.lease_expires_at<=at_value then return receipt||'{"stale":true}'::jsonb;end if;
 perform eps.specs_stage_assert(job.lease_token_digest=encode(sha256(convert_to(p_event->>'lease_token','UTF8')),'hex'),'LEASE_INVALID');
 perform eps.specs_stage_assert(job.input_hash=p_event->>'input_hash','INPUT_HASH_MISMATCH');
 if sequence_value<=job.last_event_sequence then return receipt||'{"stale":true}'::jsonb;end if;
 if not eps.appearance_can_write(job.requested_by,job.workspace_id) then safe_error:=eps.appearance_error('PERMISSION_CHANGED');
 elsif not eps.appearance_stage_matches(job) then safe_error:=eps.appearance_error('INPUT_CHANGED');
 elsif p_event->>'event_type'='heartbeat' then
  perform eps.specs_stage_assert(not(p_event?'result') and not(p_event?'result_schema') and coalesce(p_event->'error','null')='null');job.heartbeat_at:=at_value;job.lease_expires_at:=at_value+interval '90 seconds';
 elsif p_event->>'event_type'='progress' then
  perform eps.specs_stage_assert(eps.specs_stage_shape(p_event->'result',array['progress_completed','progress_total']) and eps.specs_stage_integer(p_event#>'{result,progress_completed}',job.progress_completed)
   and (p_event#>'{result,progress_total}'='null' or eps.specs_stage_integer(p_event#>'{result,progress_total}',(p_event#>>'{result,progress_completed}')::bigint)),'INVALID_PROGRESS');
  job.progress_completed:=(p_event#>>'{result,progress_completed}')::bigint;job.progress_total:=(p_event#>>'{result,progress_total}')::bigint;
 elsif p_event->>'event_type'='failed' then
  perform eps.specs_stage_assert(not(p_event?'result') and eps.specs_stage_shape(p_event->'error',array['code','message','details','retryable']) and jsonb_typeof(p_event#>'{error,code}')='string'
   and length(p_event#>>'{error,code}') between 1 and 64 and jsonb_typeof(p_event#>'{error,retryable}')='boolean' and jsonb_typeof(p_event#>'{error,details}')='object'
   and octet_length((p_event#>'{error,details}')::text)<=16384);
  -- A provider call that consumed tokens before failing still counts toward the spend cap.
  usage:=p_event#>'{error,details,usage}';
  if usage is not null and eps.specs_stage_shape(usage,array['input_tokens','output_tokens'],array['input_tokens','output_tokens'])
   and eps.specs_stage_integer(usage->'input_tokens',0,100000000) and eps.specs_stage_integer(usage->'output_tokens',0,100000000) then
   perform eps.appearance_usage(job,(usage->>'input_tokens')::bigint,(usage->>'output_tokens')::bigint);end if;
  safe_error:=eps.appearance_error(case when p_event#>>'{error,code}' in('PROVIDER_RATE_LIMITED','DEPENDENCY_UNAVAILABLE','RESULT_INVALID','INPUT_CHANGED') then p_event#>>'{error,code}' else 'PROCESSING_FAILED' end,
   (p_event#>>'{error,retryable}')::boolean and p_event#>>'{error,code}' in('PROVIDER_RATE_LIMITED','DEPENDENCY_UNAVAILABLE'));
 else
  begin
   perform eps.specs_stage_assert(p_event->>'result_schema'='candidate-appearance-result.v1','RESULT_INVALID');applied:=eps.appearance_apply(job,p_event->'result');
  exception when raise_exception then if sqlerrm in('RESULT_INVALID','INVALID_REQUEST') then safe_error:=eps.appearance_error('RESULT_INVALID');else raise;end if;end;
  if safe_error is null then
   job.completed_stages:=job.completed_stages||jsonb_build_array(jsonb_build_object('stage',job.stage,'attempt_id',attempt,'input_hash',job.input_hash,'result_schema',p_event->>'result_schema',
    'result',applied,'completed_at',at_value));
   job.status:='succeeded';job.result:=applied||jsonb_build_object('usage',p_event#>'{result,usage}','model',p_event#>'{result,model}');job.lease_token_digest:=null;job.lease_expires_at:=null;
  end if;
 end if;
 if safe_error is not null then
  job.error:=safe_error;job.lease_token_digest:=null;job.lease_expires_at:=null;
  if safe_error->'retryable'='true' and coalesce((job.stage_attempts->>job.stage)::integer,0)<3 then job.status:='queued';job.dispatch_generation:=job.dispatch_generation+1;
   job.available_at:=at_value+make_interval(secs=>least(300,2*power(2,greatest(coalesce((job.stage_attempts->>job.stage)::integer,1)-1,0)))::double precision);
  elsif safe_error->>'code'='INPUT_CHANGED' then job.status:='waiting_for_input';else job.status:='failed';end if;
 end if;
 update eps.jobs set status=job.status,stage=job.stage,completed_stages=job.completed_stages,result=job.result,error=job.error,last_event_sequence=sequence_value,heartbeat_at=job.heartbeat_at,
  lease_expires_at=job.lease_expires_at,lease_token_digest=job.lease_token_digest,available_at=job.available_at,dispatch_generation=job.dispatch_generation,progress_completed=job.progress_completed,
  progress_total=job.progress_total,row_version=row_version+1,updated_at=at_value where id=job.id;
 if job.status='queued' then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)
  values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;
 receipt:=receipt||jsonb_build_object('applied',true,'job_status',job.status);
 insert into eps.job_events(job_id,attempt_id,event_id,sequence,stage,event_type,payload_digest,receipt)values(job.id,attempt,p_event->>'event_id',sequence_value,p_event->>'stage',p_event->>'event_type',digest,receipt);
 return receipt;
end$$;
create function eps.recover_appearance_job_stages(p_limit integer) returns integer language plpgsql volatile security definer set search_path='' as $$
declare item record;job eps.jobs;recovered integer:=0;at_value timestamptz;begin
 perform eps.specs_stage_assert(p_limit between 0 and 100);if p_limit=0 then return 0;end if;
 for item in select id,workspace_id from eps.jobs where kind='candidate_appearance' and status in('queued','running') order by lease_expires_at nulls last,id limit 1000 loop
  exit when recovered>=p_limit;perform 1 from eps.workspaces where id=item.workspace_id for update skip locked;if not found then continue;end if;
  job:=eps.appearance_stage_lock(item.id,false);if job.status not in('queued','running') or job.cancel_requested_at is not null then continue;end if;at_value:=clock_timestamp();
  if not eps.appearance_can_write(job.requested_by,job.workspace_id) then job.status:='failed';job.error:=eps.appearance_error('PERMISSION_CHANGED');
  elsif not eps.appearance_stage_matches(job) then job.status:='waiting_for_input';job.error:=eps.appearance_error('INPUT_CHANGED');
  elsif job.status='queued' or job.lease_expires_at>at_value then continue;
  elsif coalesce((job.stage_attempts->>job.stage)::integer,0)>=3 then job.status:='failed';job.error:=eps.appearance_error('RETRY_EXHAUSTED');
  else job.status:='queued';job.error:=eps.appearance_error('LEASE_EXPIRED',true);job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval '2 seconds';end if;
  update eps.jobs set status=job.status,error=job.error,lease_token_digest=null,lease_expires_at=null,available_at=job.available_at,dispatch_generation=job.dispatch_generation,row_version=row_version+1,updated_at=at_value where id=job.id;
  if job.status='queued' then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)
   values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;recovered:=recovered+1;
 end loop;return recovered;
end$$;

-- 10. Ownership and rights.
grant create on schema eps,public to eps_appearance_owner;
do $own$declare r regprocedure;begin
 for r in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps' and (p.proname like 'appearance\_%' or p.proname in('refresh_candidate_projection',
  'cast_facet_match','cast_text_match','cast_library_row_ok','claim_appearance_job_stage','get_appearance_stage_input','get_appearance_asset_access','record_appearance_job_event','recover_appearance_job_stages'))
  or n.nspname='public' and p.proname in('eps_candidate_facets','eps_list_candidate_observations','eps_review_candidate_observation','eps_start_enrichment_batch','eps_get_enrichment_batch') loop
  execute format('alter function %s owner to eps_appearance_owner',r);execute format('revoke all on function %s from public,anon,authenticated,service_role',r);
 end loop;
end$own$;
revoke create on schema eps,public from eps_appearance_owner;
grant execute on function eps.fail(text,text,integer,bigint),eps.require_capability(text),eps.has_capability(text),eps.input_uuid(text),eps.specs_stage_assert(boolean,text),
 eps.specs_stage_shape(jsonb,text[],text[]),eps.specs_stage_integer(jsonb,bigint,bigint),eps.job_requester_active(uuid),
 eps.idempotency_begin(text,text,jsonb),eps.finish_mutation(text,text,jsonb,jsonb,uuid) to eps_appearance_owner;
-- Pure helpers used inside checks and by the owners' functions. Never PUBLIC: the worker runtime login verifies its exact executable set.
grant execute on function eps.appearance_vocabulary(),eps.appearance_value_valid(text,text),eps.appearance_forbidden_terms(),eps.appearance_text_allowed(text),eps.appearance_supplied_map(),eps.appearance_supplied_key(text,text),eps.appearance_norm(text),
 eps.appearance_facet_keys_allowed(),eps.appearance_filters(jsonb),eps.appearance_filter_ok(text[],text[],jsonb,text),eps.appearance_text_ok(text,text,text,text[],text) to eps_appearance_owner,eps_cast_owner;
grant execute on function public.eps_candidate_facets(jsonb),public.eps_list_candidate_observations(uuid),public.eps_review_candidate_observation(uuid,jsonb,text),
 public.eps_start_enrichment_batch(jsonb,text),public.eps_get_enrichment_batch(uuid) to authenticated;
grant execute on function eps.cast_facet_match(uuid,jsonb),eps.cast_text_match(uuid,text),eps.cast_library_row_ok(eps.candidates,jsonb) to eps_cast_owner;
grant execute on function eps.cast_search_match(jsonb,jsonb),eps.cast_is_reviewed(eps.candidates),eps.cast_fingerprint(jsonb,jsonb),eps.cast_supplied_age_bounds(text) to eps_appearance_owner;
grant execute on function eps.appearance_is_job(uuid),eps.claim_appearance_job_stage(jsonb),eps.get_appearance_stage_input(uuid,uuid,text),eps.record_appearance_job_event(jsonb),
 eps.recover_appearance_job_stages(integer) to eps_specs_stage_owner;
grant execute on function eps.appearance_is_job(uuid),eps.get_appearance_asset_access(jsonb) to eps_specs_assets_owner;
grant execute on function eps.appearance_capability_allowed(text,text,text) to anon,authenticated;

-- 11. One closed branch in each existing worker port (exact preceding source checked above).
do $dispatch$declare item record;source text;definition text;replacement text;at_value integer;begin
 for item in select * from(values
  ('eps.claim_job_stage(jsonb)','if p_input->>''stage''=''analyze_appearance''then return eps.claim_appearance_job_stage(p_input);end if;'),
  ('eps.get_specs_stage_input(uuid,uuid,text)','if eps.appearance_is_job(p_job_id)then return eps.get_appearance_stage_input(p_job_id,p_attempt_id,p_lease_token);end if;'),
  ('eps.record_job_event(jsonb)','if p_event->>''stage''=''analyze_appearance''then return eps.record_appearance_job_event(p_event);end if;'),
  ('eps.get_job_asset_access(jsonb)','if eps.appearance_is_job(eps.input_uuid(p_input->>''job_id''))then return eps.get_appearance_asset_access(p_input);end if;'),
  ('eps.recover_job_stages(integer)',''))v(signature,dispatch) loop
  select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n') into source,definition from pg_proc where oid=item.signature::regprocedure;
  if item.dispatch<>'' then at_value:=position('begin' in source);replacement:=overlay(source placing E'begin\n '||item.dispatch||E'\n' from at_value for 6);
  else replacement:=replace(source,'recovered:=eps.recover_export_job_stages(p_limit);','recovered:=eps.recover_appearance_job_stages(p_limit);recovered:=recovered+eps.recover_export_job_stages(p_limit-recovered);');end if;
  if replacement=source then raise exception 'M20_PORT_DISPATCH_ANCHOR_REQUIRED:%',item.signature;end if;
  execute replace(definition,source,replacement);
 end loop;
end$dispatch$;

-- 12. Storage: a live appearance grant may read exactly its photo/frame object. Existing restrictive guards gain the same branch.
-- Readback fails closed: the new policy must exist and every expected guard that exists must now carry the grant branch
-- (the m09 photo guard is required). The disposable replica has only a minimal storage stub (storage.objects shape and an
-- allow_only_operation that returns false), so it proves this catalogue composition, not Storage API behaviour.
do $$declare item record;guards text[]:=array['eps_candidate_photos_read_guard','eps_candidate_read_guard'];guard_before jsonb;begin
 if to_regclass('storage.objects') is null then raise exception 'M20_STORAGE_REQUIRED';end if;
 if not exists(select 1 from pg_policy where polrelid='storage.objects'::regclass and polname='eps_candidate_photos_read_guard') then raise exception 'M20_STORAGE_GUARD_REQUIRED';end if;
 select coalesce(jsonb_object_agg(polname,pg_get_expr(polqual,polrelid)),'{}') into guard_before from pg_policy where polrelid='storage.objects'::regclass and polname=any(guards);
 if exists(select 1 from jsonb_each_text(guard_before) where value like '%appearance_capability_allowed%') then raise exception 'M20_STORAGE_GUARD_ALREADY_COMPOSED';end if;
 execute $p$create policy eps_appearance_read on storage.objects for select to anon using(bucket_id in('eps-candidate-photos','eps-candidate-outputs')
  and (storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info')) and eps.appearance_capability_allowed(bucket_id,name,'read'))$p$;
 for item in select polname,pg_get_expr(polqual,polrelid) body from pg_policy where polrelid='storage.objects'::regclass and polname=any(guards) loop
  execute format('alter policy %I on storage.objects using((%s) OR((storage.allow_only_operation(''object.get_authenticated'') OR storage.allow_only_operation(''object.get_authenticated_info'')) AND eps.appearance_capability_allowed(bucket_id,name,''read'')))',item.polname,item.body);
 end loop;
 if not exists(select 1 from pg_policy where polrelid='storage.objects'::regclass and polname='eps_appearance_read' and polpermissive and polcmd='r'
   and polroles=array['anon'::regrole::oid] and pg_get_expr(polqual,polrelid) like '%appearance_capability_allowed(bucket_id, name, ''read''::text)%')
  or (select count(*) from pg_policy where polrelid='storage.objects'::regclass and polname=any(guards))<>(select count(*) from jsonb_object_keys(guard_before))
  or exists(select 1 from pg_policy p where p.polrelid='storage.objects'::regclass and p.polname=any(guards) and (pg_get_expr(p.polqual,p.polrelid) not like '%appearance_capability_allowed(bucket_id, name, ''read''::text)%'
   or pg_get_expr(p.polqual,p.polrelid) is not distinct from guard_before->>p.polname::text))
 then raise exception 'M20_STORAGE_POLICY_READBACK_FAILED';end if;
end$$;

-- 12b. A1's newest-first search (m16) gains facet filtering through one seam; cursor v2 (the fingerprint already covers every
-- search key except cursor/limit), membership batching and the card DTO are untouched.
do $search$declare source text;definition text;replacement text;begin
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n') into source,definition from pg_proc where oid='public.eps_search_candidates(jsonb)'::regprocedure;
 replacement:=replace(source,$a$'previous_project_role','classification']);$a$,$a$'previous_project_role','classification','facets','facet_include_unknown']);
 if p_search?'facet_include_unknown' and jsonb_typeof(p_search->'facet_include_unknown')<>'boolean' then perform eps.fail('INVALID_REQUEST','Invalid facet filter.',400); end if;
 if p_search?'facets' then perform eps.appearance_filters(jsonb_build_object('facets',p_search->'facets')); end if;$a$);
 replacement:=replace(replacement,$a$   and eps.cast_search_match(candidate.facts,p_search) is not null
   and (not p_search?'review_status' or (p_search->>'review_status'='reviewed')=eps.cast_is_reviewed(candidate))
$a$,$a$   and eps.cast_library_row_ok(candidate,p_search)
$a$);
 if replacement=source or (length(replacement)-length(replace(replacement,'cast_library_row_ok','')))<>length('cast_library_row_ok') or strpos(replacement,'facet_include_unknown')=0
 then raise exception 'M20_SEARCH_SEAM_CHANGED';end if;
 execute replace(definition,source,replacement);
end$search$;
grant execute on function eps.appearance_filters(jsonb) to eps_cast_owner;

-- 13. Backfill the projection for every existing candidate (derived data only).
insert into eps.candidate_search_projection select r.* from eps.candidates c cross join lateral eps.appearance_projection_row(c.id) r;

-- 14. Readback.
do $check$begin
 if (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in('eps_candidate_facets','eps_list_candidate_observations','eps_review_candidate_observation','eps_start_enrichment_batch','eps_get_enrichment_batch')
   and pg_get_userbyid(proowner)='eps_appearance_owner' and prosecdef)<>5
  or has_function_privilege('anon','public.eps_candidate_facets(jsonb)','execute') or not has_function_privilege('authenticated','public.eps_candidate_facets(jsonb)','execute')
  or has_function_privilege('authenticated','eps.claim_appearance_job_stage(jsonb)','execute') or has_function_privilege('authenticated','eps.cast_facet_match(uuid,jsonb)','execute')
  or has_schema_privilege('eps_appearance_owner','eps','create') or has_schema_privilege('eps_appearance_owner','public','create')
  or (select count(*) from pg_proc where oid in('eps.claim_job_stage(jsonb)'::regprocedure,'eps.get_specs_stage_input(uuid,uuid,text)'::regprocedure,'eps.record_job_event(jsonb)'::regprocedure,
   'eps.get_job_asset_access(jsonb)'::regprocedure,'eps.recover_job_stages(integer)'::regprocedure) and prosrc like '%appearance%')<>5
  or (select count(*) from eps.candidate_search_projection)<>(select count(*) from eps.candidates)
 then raise exception 'M20_READBACK_FAILED';end if;
end$check$;
