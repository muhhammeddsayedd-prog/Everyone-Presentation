-- LOCAL DEVELOPMENT CANDIDATE. Not a released migration; execute only in an
-- owned-target rollback rehearsal. Existing 14 migrations/data remain intact.
-- Sources checked 2026-10-29: Supabase changelog and RLS docs; PostgreSQL17 locks.
set local lock_timeout='3s'; set local statement_timeout='30s'; set local search_path='';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or current_setting('eps.m03_candidate_rehearsal',true) is distinct from 'rollback-only-v1'
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations)
    is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500']::text[]
  or to_regclass('eps.candidates') is not null or to_regclass('eps.candidate_media') is not null
  or to_regclass('eps.workspace_candidates') is not null or exists(select 1 from pg_roles where rolname='eps_cast_owner')
 then raise exception 'M03_LOCAL14_ROLLBACK_BASELINE_REQUIRED'; end if;
end $$;

create role eps_cast_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_cast_owner to postgres;
grant authenticated to eps_cast_owner with inherit true,set false,admin false;
grant usage on schema eps,public to eps_cast_owner;
-- Source provenance extensions only. Upload purpose/MIME/size and worker object
-- verification are a separately coordinated M03 boundary.
alter table eps.media_assets add column source_timestamp_ms bigint check(source_timestamp_ms>=0);
alter table eps.media_assets add column duration_ms bigint check(duration_ms>=0);

create function eps.cast_canonical(p_value jsonb) returns text language sql immutable security invoker set search_path='' as $$
 select case jsonb_typeof(p_value)
 when 'object' then '{'||coalesce((select string_agg(to_jsonb(key)::text||':'||eps.cast_canonical(value),',' order by key collate "C") from jsonb_each(p_value)),'')||'}'
 when 'array' then '['||coalesce((select string_agg(eps.cast_canonical(value),',' order by ordinal) from jsonb_array_elements(p_value) with ordinality item(value,ordinal)),'')||']'
 else p_value::text end
$$;
create function eps.cast_fingerprint(p_facts jsonb,p_sources jsonb) returns text language sql immutable security invoker set search_path='' as $$
 select encode(sha256(convert_to(eps.cast_canonical(jsonb_build_object('facts',p_facts,'field_sources',p_sources)),'UTF8')),'hex')
$$;
create function eps.cast_facts(p_input jsonb) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare key text; item jsonb; result jsonb:='{}'; expected text[]:=array['name','casting_id','age_or_range','stated_gender','height_measurements','languages','accents','skills_experience','city','previous_projects_roles','classification']; begin
 perform eps.check_input(p_input,expected);
 if (select count(*) from jsonb_object_keys(p_input))<>11 or octet_length(p_input::text)>65536 then perform eps.fail('INVALID_REQUEST','Candidate facts do not match the published contract.',400); end if;
 foreach key in array expected loop
  item:=p_input->key;
  if key in('languages','accents') then
   if jsonb_typeof(item) is distinct from 'array' or jsonb_array_length(item)>100
    or exists(select 1 from jsonb_array_elements(item) value where jsonb_typeof(value)<>'string' or length(btrim(value#>>'{}')) not between 1 and 1000)
    or (select count(*)<>count(distinct lower(btrim(value))) from jsonb_array_elements_text(item) value)
   then perform eps.fail('INVALID_REQUEST','Expected unique supplied language/accent values.',400); end if;
   result:=result||jsonb_build_object(key,coalesce((select jsonb_agg(btrim(value) order by ordinal) from jsonb_array_elements_text(item) with ordinality list(value,ordinal)),'[]'::jsonb));
  else
   if item is null or not(jsonb_typeof(item)='string' or item='null'::jsonb) or length(item#>>'{}')>10000 then perform eps.fail('INVALID_REQUEST','Expected supplied text or null.',400); end if;
   result:=result||jsonb_build_object(key,nullif(btrim(item#>>'{}'),''));
  end if;
 end loop;
 return result;
end $$;
create function eps.cast_manual_sources(p_facts jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_object_agg(key,jsonb_build_object('kind','manual','principal_id',auth.uid())) from jsonb_object_keys(p_facts) key
$$;

create table eps.candidates (
 id uuid primary key default gen_random_uuid(), facts jsonb not null check(jsonb_typeof(facts)='object'),
 casting_id text not null check(length(casting_id) between 1 and 200), source_casting_id text check(length(source_casting_id) between 1 and 200),
 source_kind text not null check(source_kind in('manual','scan')), field_sources jsonb not null default '{}' check(jsonb_typeof(field_sources)='object'),
 age_as_of date, reviewed_at timestamptz, reviewed_by uuid references auth.users(id) on delete restrict,
 reviewed_facts_fingerprint text check(reviewed_facts_fingerprint ~ '^[a-f0-9]{64}$'), confirmation_note text,
 duplicate_resolution text check(duplicate_resolution in('keep_new','link_existing')), merged_into_candidate_id uuid references eps.candidates(id) on delete restrict,
 archived_at timestamptz, created_by uuid not null references auth.users(id) on delete restrict,
 row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 check(facts->>'casting_id'=casting_id), check(merged_into_candidate_id is null or merged_into_candidate_id<>id),
 check((reviewed_at is null and reviewed_by is null and reviewed_facts_fingerprint is null) or (reviewed_at is not null and reviewed_by is not null and reviewed_facts_fingerprint is not null))
);
create unique index candidates_casting_id_unique on eps.candidates(lower(casting_id));
create index candidates_active_idx on eps.candidates(id) where archived_at is null and merged_into_candidate_id is null;
create index candidates_name_idx on eps.candidates(lower(facts->>'name')) where archived_at is null;
create index candidates_source_casting_id_idx on eps.candidates(lower(source_casting_id)) where source_casting_id is not null;
create index candidates_merged_idx on eps.candidates(merged_into_candidate_id) where merged_into_candidate_id is not null;
create index candidates_reviewer_idx on eps.candidates(reviewed_by) where reviewed_by is not null;
create index candidates_creator_idx on eps.candidates(created_by);
create table eps.candidate_media (
 id uuid primary key default gen_random_uuid(), candidate_id uuid not null references eps.candidates(id) on delete restrict,
 source_asset_id uuid not null unique references eps.media_assets(id) on delete restrict,
 preview_asset_id uuid references eps.media_assets(id) on delete restrict, transcript_asset_id uuid references eps.media_assets(id) on delete restrict,
 original_transcript text, transcript_segments jsonb not null default '[]' check(jsonb_typeof(transcript_segments)='array'),
 languages text[] not null default '{}', extraction jsonb check(extraction is null or jsonb_typeof(extraction)='object'),
 source_job_id uuid references eps.jobs(id) on delete restrict,
 selected_frame_asset_ids uuid[] not null default '{}' check(cardinality(selected_frame_asset_ids)<=3),
 row_version bigint not null default 1 check(row_version between 1 and 9007199254740991), created_at timestamptz not null default clock_timestamp(),
 unique(candidate_id,id)
);
create index candidate_media_candidate_idx on eps.candidate_media(candidate_id,id);
create index candidate_media_preview_idx on eps.candidate_media(preview_asset_id) where preview_asset_id is not null;
create index candidate_media_transcript_idx on eps.candidate_media(transcript_asset_id) where transcript_asset_id is not null;
create index candidate_media_job_idx on eps.candidate_media(source_job_id) where source_job_id is not null;
create table eps.candidate_media_frames (
 candidate_media_id uuid not null references eps.candidate_media(id) on delete restrict,
 asset_id uuid not null references eps.media_assets(id) on delete restrict, quality_flags text[] not null default '{}',
 primary key(candidate_media_id,asset_id)
);
create index candidate_media_frames_asset_idx on eps.candidate_media_frames(asset_id);
create table eps.workspace_candidates (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references eps.workspaces(id) on delete restrict,
 candidate_id uuid not null references eps.candidates(id) on delete restrict,
 selected_candidate_media_id uuid, selected_frame_asset_ids uuid[] not null default '{}' check(cardinality(selected_frame_asset_ids)<=3),
 availability text, fresh_material_required boolean not null default false, media_confirmed boolean not null default false,
 internal_notes text, archived_at timestamptz,
 row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 constraint cast_pool_media_fk foreign key(candidate_id,selected_candidate_media_id) references eps.candidate_media(candidate_id,id) on delete restrict deferrable initially immediate,
 check(selected_candidate_media_id is not null or cardinality(selected_frame_asset_ids)=0), unique(workspace_id,id)
);
create unique index workspace_candidates_active_unique on eps.workspace_candidates(workspace_id,candidate_id) where archived_at is null;
create index workspace_candidates_candidate_idx on eps.workspace_candidates(candidate_id);
create index workspace_candidates_media_idx on eps.workspace_candidates(candidate_id,selected_candidate_media_id) where selected_candidate_media_id is not null;
comment on table eps.candidates is 'Single canonical reusable supplied fact owner in the owner-confirmed initially empty business database; no duplicate person table.';
comment on column eps.candidates.age_as_of is 'Observation date of the stated age, never a guessed birth date or automatically incremented age.';
comment on table eps.candidate_media is 'Immutable source evidence and append-only material; attaching media does not overwrite reviewed candidate facts.';
comment on table eps.workspace_candidates is 'Project-only availability and pinned chosen material; changing another project cannot replace these choices.';

do $$ declare target regclass; begin foreach target in array array['eps.candidates'::regclass,'eps.candidate_media'::regclass,'eps.candidate_media_frames'::regclass,'eps.workspace_candidates'::regclass] loop
 execute format('alter table %s enable row level security',target); execute format('alter table %s force row level security',target);
 execute format('revoke all on %s from public,anon,authenticated,service_role,eps_api_owner,eps_jobs_owner,eps_jobs_executor,eps_specs_owner',target);
end loop; end $$;
grant select,insert on eps.candidates,eps.candidate_media,eps.candidate_media_frames,eps.workspace_candidates to eps_cast_owner;
grant update(facts,casting_id,field_sources,age_as_of,reviewed_at,reviewed_by,reviewed_facts_fingerprint,confirmation_note,duplicate_resolution,merged_into_candidate_id,archived_at,row_version,updated_at) on eps.candidates to eps_cast_owner;
grant update(candidate_id,selected_frame_asset_ids,row_version) on eps.candidate_media to eps_cast_owner;
grant update(candidate_id,selected_candidate_media_id,selected_frame_asset_ids,availability,fresh_material_required,media_confirmed,internal_notes,archived_at,row_version,updated_at) on eps.workspace_candidates to eps_cast_owner;
grant select on eps.media_assets,eps.workspaces to eps_cast_owner;
grant update(row_version,draft_revision,has_unpublished_changes,updated_at) on eps.workspaces to eps_cast_owner;
grant select,insert on eps.idempotency_records to eps_cast_owner; grant insert on eps.audit_events to eps_cast_owner;
grant execute on function eps.fail(text,text,integer,bigint),eps.has_capability(text),eps.require_capability(text),eps.project_scope(uuid,boolean),eps.check_input(jsonb,text[]),eps.input_uuid(text),eps.expected_version(jsonb,text),eps.idempotency_begin(text,text,jsonb),eps.finish_mutation(text,text,jsonb,jsonb,uuid),eps.page_result(jsonb[],integer) to eps_cast_owner;
create function eps.cast_workspace_scope(p_workspace uuid,p_write boolean default false) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from eps.workspaces workspace join public.projects project on project.id=workspace.project_id where workspace.id=p_workspace and workspace.archived_at is null and project.archived_at is null and eps.project_scope(project.id,p_write) and eps.has_capability(case when p_write then 'workspaces.write' else 'workspaces.read' end))
$$;
create policy cast_workspace_read on eps.workspaces for select to eps_cast_owner using(archived_at is null and eps.project_scope(project_id,false) and (eps.has_capability('workspaces.read') or eps.has_capability('workspaces.write')));
create policy cast_workspace_update on eps.workspaces for update to eps_cast_owner using(archived_at is null and eps.project_scope(project_id,true) and eps.has_capability('workspaces.write')) with check(archived_at is null and eps.project_scope(project_id,true) and eps.has_capability('workspaces.write'));
create policy cast_candidates_read on eps.candidates for select to eps_cast_owner using(eps.has_capability('cast.read'));
create policy cast_candidates_insert on eps.candidates for insert to eps_cast_owner with check(eps.has_capability('cast.write') and created_by=auth.uid());
create policy cast_candidates_update on eps.candidates for update to eps_cast_owner using(eps.has_capability('cast.write') or eps.has_capability('cast.review')) with check(eps.has_capability('cast.write') or eps.has_capability('cast.review'));
create policy cast_media_read on eps.candidate_media for select to eps_cast_owner using(eps.has_capability('cast.read'));
create policy cast_media_insert on eps.candidate_media for insert to eps_cast_owner with check(eps.has_capability('cast.write'));
create policy cast_media_update on eps.candidate_media for update to eps_cast_owner using(eps.has_capability('cast.write')) with check(eps.has_capability('cast.write'));
create policy cast_frames_read on eps.candidate_media_frames for select to eps_cast_owner using(eps.has_capability('cast.read'));
create policy cast_frames_insert on eps.candidate_media_frames for insert to eps_cast_owner with check(eps.has_capability('cast.write'));
create policy cast_pool_read on eps.workspace_candidates for select to eps_cast_owner using(eps.cast_workspace_scope(workspace_id,false) or eps.cast_workspace_scope(workspace_id,true));
create policy cast_pool_insert on eps.workspace_candidates for insert to eps_cast_owner with check(eps.cast_workspace_scope(workspace_id,true) and eps.has_capability('cast.read'));
create policy cast_pool_update on eps.workspace_candidates for update to eps_cast_owner using(eps.cast_workspace_scope(workspace_id,true)) with check(eps.cast_workspace_scope(workspace_id,true));
create policy cast_assets_read on eps.media_assets for select to eps_cast_owner using(eps.has_capability('cast.read') and (eps.cast_workspace_scope(origin_workspace_id,false) or exists(select 1 from eps.candidate_media media where media.source_asset_id=media_assets.id or media.preview_asset_id=media_assets.id or media.transcript_asset_id=media_assets.id) or exists(select 1 from eps.candidate_media_frames frame where frame.asset_id=media_assets.id)));
create policy cast_idempotency on eps.idempotency_records for all to eps_cast_owner using(principal_id=auth.uid() and operation=any(array['cast.create_candidate','cast.update_candidate','cast.confirm_candidate_reviewed','cast.archive_candidate','cast.update_candidate_frames','cast.resolve_candidate_duplicate','cast.add_workspace_candidate','cast.update_workspace_candidate','cast.remove_workspace_candidate'])) with check(principal_id=auth.uid() and operation=any(array['cast.create_candidate','cast.update_candidate','cast.confirm_candidate_reviewed','cast.archive_candidate','cast.update_candidate_frames','cast.resolve_candidate_duplicate','cast.add_workspace_candidate','cast.update_workspace_candidate','cast.remove_workspace_candidate']));
create policy cast_audit on eps.audit_events for insert to eps_cast_owner with check(principal_id=auth.uid() and action=any(array['cast.create_candidate','cast.update_candidate','cast.confirm_candidate_reviewed','cast.archive_candidate','cast.update_candidate_frames','cast.resolve_candidate_duplicate','cast.add_workspace_candidate','cast.update_workspace_candidate','cast.remove_workspace_candidate']));
create policy eps_cast_no_objects on storage.objects as restrictive for all to eps_cast_owner using(false) with check(false);
create policy eps_cast_no_buckets on storage.buckets as restrictive for all to eps_cast_owner using(false) with check(false);

create function eps.cast_is_reviewed(p_row eps.candidates) returns boolean language sql immutable security invoker set search_path='' as $$
 select p_row.reviewed_facts_fingerprint is not null and p_row.reviewed_facts_fingerprint=eps.cast_fingerprint(p_row.facts,p_row.field_sources)
$$;
create function eps.cast_candidate_dto(p_id uuid,p_match jsonb default null) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',candidate.id,'facts',candidate.facts,'review_status',case when eps.cast_is_reviewed(candidate) then 'reviewed' else 'unreviewed' end,
 'reviewed_at',case when eps.cast_is_reviewed(candidate) then candidate.reviewed_at end,'reviewed_by',case when eps.cast_is_reviewed(candidate) then candidate.reviewed_by end,
 'search_match',p_match,'possible_duplicate',candidate.duplicate_resolution is null and exists(select 1 from eps.candidates other where other.id<>candidate.id and other.archived_at is null and other.merged_into_candidate_id is null and (nullif(lower(candidate.facts->>'name'),'')=lower(other.facts->>'name') or lower(candidate.source_casting_id)=lower(other.casting_id))),
 'merged_into_candidate_id',candidate.merged_into_candidate_id,'archived',candidate.archived_at is not null,'row_version',candidate.row_version,'created_at',candidate.created_at,'updated_at',candidate.updated_at) from eps.candidates candidate where candidate.id=p_id
$$;
create function eps.cast_media_dto(p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',media.id,'candidate_id',media.candidate_id,'source_asset_id',media.source_asset_id,'preview_asset_id',media.preview_asset_id,'transcript_asset_id',media.transcript_asset_id,'original_transcript',media.original_transcript,'languages',to_jsonb(media.languages),
 'available_frames',coalesce((select jsonb_agg(jsonb_build_object('asset_id',asset.id,'source_asset_id',asset.source_asset_id,'timestamp_ms',asset.source_timestamp_ms,'width',asset.width,'height',asset.height,'quality_flags',to_jsonb(frame.quality_flags)) order by asset.source_timestamp_ms,asset.id) from eps.candidate_media_frames frame join eps.media_assets asset on asset.id=frame.asset_id where frame.candidate_media_id=media.id and asset.status='ready'),'[]'::jsonb),
 'selected_frame_asset_ids',to_jsonb(media.selected_frame_asset_ids),'row_version',media.row_version) from eps.candidate_media media where media.id=p_id
$$;
create function eps.cast_pool_dto(p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',id,'workspace_id',workspace_id,'candidate_id',candidate_id,'selected_candidate_media_id',selected_candidate_media_id,'selected_frame_asset_ids',to_jsonb(selected_frame_asset_ids),'availability',availability,'fresh_material_required',fresh_material_required,'media_confirmed',media_confirmed,'internal_notes',internal_notes,'row_version',row_version) from eps.workspace_candidates where id=p_id
$$;
create function eps.cast_require_active(p_id uuid) returns eps.candidates language plpgsql volatile security invoker set search_path='' as $$
declare item eps.candidates; begin
 select * into item from eps.candidates where id=p_id and archived_at is null and merged_into_candidate_id is null for update;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active library profile not found.',404); end if; return item;
end $$;
create function eps.cast_search_match(p_facts jsonb,p_search jsonb) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare key text; field text; actual jsonb; wanted text; matched jsonb:='[]'; unknowns jsonb:='[]'; begin
 if nullif(btrim(p_search->>'q'),'') is not null and position(lower(btrim(p_search->>'q')) in lower(coalesce((select string_agg(case when jsonb_typeof(value)='array' then (select string_agg(element,' ') from jsonb_array_elements_text(value) element) else value#>>'{}' end,' ') from jsonb_each(p_facts)),'')))=0 then return null; end if;
 foreach key in array array['age_or_range','stated_gender','height_measurements','language','accent','skill','city','previous_project_role','classification'] loop
  wanted:=nullif(btrim(p_search->>key),''); if wanted is null then continue; end if;
  field:=case key when 'language' then 'languages' when 'accent' then 'accents' when 'skill' then 'skills_experience' when 'previous_project_role' then 'previous_projects_roles' else key end;
  actual:=p_facts->field;
  if actual is null or actual='null'::jsonb or actual='[]'::jsonb then
   if coalesce((p_search->>'include_unknown')::boolean,true)=false then return null; end if; unknowns:=unknowns||to_jsonb(key);
  elsif jsonb_typeof(actual)='array' then
   if not exists(select 1 from jsonb_array_elements_text(actual) value where position(lower(wanted) in lower(value))>0) then return null; end if;
   matched:=matched||to_jsonb(key);
  else
   if position(lower(wanted) in lower(actual#>>'{}'))=0 then return null; end if; matched:=matched||to_jsonb(key);
  end if;
 end loop;
 return jsonb_build_object('matched_filter_fields',matched,'unknown_filter_fields',unknowns);
end $$;
create function public.eps_search_candidates(p_search jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare key text; maximum integer; cursor_id uuid; cursor_value jsonb; fingerprint text; result jsonb[]; begin
 perform eps.require_capability('cast.read');
 perform eps.check_input(p_search,array['q','cursor','limit','include_unknown','review_status','age_or_range','stated_gender','height_measurements','language','accent','skill','city','previous_project_role','classification']);
 if octet_length(p_search::text)>10000 then perform eps.fail('INVALID_REQUEST','Search exceeds the request bound.',400); end if;
 foreach key in array array['q','cursor','age_or_range','stated_gender','height_measurements','language','accent','skill','city','previous_project_role','classification'] loop
  if p_search?key and (jsonb_typeof(p_search->key)<>'string' or length(p_search->>key)>case when key='cursor' then 4000 else 500 end) then perform eps.fail('INVALID_REQUEST','Invalid search text.',400); end if;
 end loop;
 if p_search?'include_unknown' and jsonb_typeof(p_search->'include_unknown')<>'boolean' or p_search?'review_status' and p_search->>'review_status' not in('reviewed','unreviewed') then perform eps.fail('INVALID_REQUEST','Invalid search filter.',400); end if;
 if p_search?'limit' and (jsonb_typeof(p_search->'limit')<>'number' or (p_search->>'limit')!~'^[1-9][0-9]{0,2}$') then perform eps.fail('INVALID_REQUEST','Invalid page size.',400); end if;
 maximum:=coalesce((p_search->>'limit')::integer,25); if maximum not between 1 and 100 then perform eps.fail('INVALID_REQUEST','Invalid page size.',400); end if;
 fingerprint:=encode(sha256(convert_to((p_search-'cursor'-'limit')::text,'UTF8')),'hex');
 if p_search?'cursor' and p_search->>'cursor'<>'' then
  begin cursor_value:=convert_from(decode(p_search->>'cursor','base64'),'UTF8')::jsonb; cursor_id:=eps.input_uuid(cursor_value->>'last');
   if cursor_value->>'query' is distinct from fingerprint then perform eps.fail('INVALID_REQUEST','Cursor does not match the current filters.',400); end if;
  exception when invalid_parameter_value or invalid_text_representation or character_not_in_repertoire then perform eps.fail('INVALID_REQUEST','Invalid pagination cursor.',400); end;
 end if;
 select array_agg(dto order by id) into result from (
  select candidate.id,eps.cast_candidate_dto(candidate.id,eps.cast_search_match(candidate.facts,p_search)) dto from eps.candidates candidate
  where candidate.archived_at is null and candidate.merged_into_candidate_id is null and (cursor_id is null or candidate.id>cursor_id)
   and eps.cast_search_match(candidate.facts,p_search) is not null
   and (not p_search?'review_status' or (p_search->>'review_status'='reviewed')=eps.cast_is_reviewed(candidate))
  order by candidate.id limit maximum+1
 ) page;
 return jsonb_build_object('data',coalesce(to_jsonb(result[1:maximum]),'[]'::jsonb),'page',jsonb_build_object('next_cursor',case when cardinality(result)>maximum then replace(encode(convert_to(jsonb_build_object('last',result[maximum]->>'id','query',fingerprint)::text,'UTF8'),'base64'),E'\n','') end));
end $$;
create function public.eps_get_candidate(p_candidate_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 perform eps.require_capability('cast.read'); select eps.cast_candidate_dto(id) into result from eps.candidates where id=p_candidate_id and archived_at is null and merged_into_candidate_id is null;
 if result is null then perform eps.fail('RESOURCE_NOT_FOUND','Active library profile not found.',404); end if; return result;
end $$;
create function public.eps_get_candidate_media(p_candidate_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform eps.require_capability('cast.read');
 if not exists(select 1 from eps.candidates where id=p_candidate_id and archived_at is null and merged_into_candidate_id is null) then perform eps.fail('RESOURCE_NOT_FOUND','Active library profile not found.',404); end if;
 return coalesce((select jsonb_agg(eps.cast_media_dto(id) order by created_at,id) from eps.candidate_media where candidate_id=p_candidate_id),'[]'::jsonb);
end $$;
create function public.eps_find_candidate_duplicates(p_candidate_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare candidate eps.candidates; begin
 perform eps.require_capability('cast.read'); select * into candidate from eps.candidates where id=p_candidate_id and archived_at is null and merged_into_candidate_id is null;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Active library profile not found.',404); end if;
 return coalesce((select jsonb_agg(jsonb_build_object('candidate_id',other.id,'display_name',other.facts->'name','match_reasons',case when lower(candidate.source_casting_id)=lower(other.casting_id) then jsonb_build_array('Same supplied casting ID; explicit identity choice required') else jsonb_build_array('Same supplied name; explicit identity choice required') end) order by other.id) from eps.candidates other where other.id<>candidate.id and other.archived_at is null and other.merged_into_candidate_id is null and (nullif(lower(candidate.facts->>'name'),'')=lower(other.facts->>'name') or lower(candidate.source_casting_id)=lower(other.casting_id))),'[]'::jsonb);
end $$;
create function public.eps_list_workspace_candidates(p_workspace_id uuid,p_cursor text default null,p_limit integer default 25) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare last_id uuid; result jsonb[]; begin
 perform eps.require_capability('workspaces.read');
 if not eps.cast_workspace_scope(p_workspace_id,false) then perform eps.fail('RESOURCE_NOT_FOUND','Workspace not found.',404); end if;
 if p_limit is null or p_limit not between 1 and 100 then perform eps.fail('INVALID_REQUEST','Invalid page size.',400); end if;
 if p_cursor is not null then last_id:=eps.input_uuid(p_cursor); end if;
 select array_agg(dto order by id) into result from (select id,eps.cast_pool_dto(id) dto from eps.workspace_candidates where workspace_id=p_workspace_id and archived_at is null and (last_id is null or id>last_id) order by id limit p_limit+1) page;
 return eps.page_result(result,p_limit);
end $$;

-- All browser/API/MCP mutation wrappers enter this common permission/version/
-- idempotency boundary. Provider input has no public route to these internals.
create function eps.cast_mutate(p_operation text,p_resource_id uuid,p_input jsonb,p_key text) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
#variable_conflict use_variable
declare candidate eps.candidates; existing eps.candidates; pool eps.workspace_candidates; medium eps.candidate_media;
 payload jsonb; replay jsonb; result jsonb; facts jsonb; sources jsonb; key text; asset uuid; media_id uuid; frames uuid[];
 workspace_id uuid; generated_id uuid; operation text:='cast.'||p_operation; selection_changed boolean:=false; changed boolean; begin
 if p_operation not in('create_candidate','update_candidate','confirm_candidate_reviewed','archive_candidate','update_candidate_frames','resolve_candidate_duplicate','add_workspace_candidate','update_workspace_candidate','remove_workspace_candidate') then perform eps.fail('INVALID_REQUEST','Unknown candidate operation.',400); end if;
 perform eps.require_capability(case when p_operation='confirm_candidate_reviewed' then 'cast.review' when p_operation in('add_workspace_candidate','update_workspace_candidate','remove_workspace_candidate') then 'workspaces.write' else 'cast.write' end);
 perform eps.require_capability('cast.read');
 if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>100000 then perform eps.fail('INVALID_REQUEST','Invalid bounded candidate input.',400); end if;
 if p_operation='create_candidate' then
  perform eps.check_input(p_input,array['facts','source_asset_ids']); facts:=eps.cast_facts(p_input->'facts');
  if p_input?'source_asset_ids' and (jsonb_typeof(p_input->'source_asset_ids')<>'array' or jsonb_array_length(p_input->'source_asset_ids')>100) then perform eps.fail('INVALID_REQUEST','Invalid source asset list.',400); end if;
 elsif p_operation='update_candidate' then perform eps.check_input(p_input,array['row_version','facts']); facts:=eps.cast_facts(p_input->'facts');
 elsif p_operation='confirm_candidate_reviewed' then
  perform eps.check_input(p_input,array['row_version','confirmation_note']);
  if p_input?'confirmation_note' and not(jsonb_typeof(p_input->'confirmation_note')='string' or p_input->'confirmation_note'='null'::jsonb) then perform eps.fail('INVALID_REQUEST','Invalid confirmation note.',400); end if;
 elsif p_operation in('archive_candidate','remove_workspace_candidate') then perform eps.check_input(p_input,array['row_version']);
 elsif p_operation='update_candidate_frames' then perform eps.check_input(p_input,array['row_version','selected_frame_asset_ids']);
 elsif p_operation='resolve_candidate_duplicate' then
  perform eps.check_input(p_input,array['row_version','action','existing_candidate_id','existing_candidate_row_version']);
  if p_input->>'action' not in('keep_new','link_existing') or p_input->>'action' is null then perform eps.fail('INVALID_REQUEST','Choose existing or new explicitly.',400); end if;
  if p_input->>'action'='keep_new' and (p_input?'existing_candidate_id' or p_input?'existing_candidate_row_version') then perform eps.fail('INVALID_REQUEST','New identity choice cannot include an existing profile.',400); end if;
 elsif p_operation='add_workspace_candidate' then
  perform eps.check_input(p_input,array['candidate_id','selected_candidate_media_id','availability','fresh_material_required']);
 else perform eps.check_input(p_input,array['row_version','selected_candidate_media_id','selected_frame_asset_ids','availability','fresh_material_required','media_confirmed','internal_notes']);
 end if;
 if p_operation in('add_workspace_candidate','update_workspace_candidate') then
  foreach key in array array['availability','internal_notes'] loop if p_input?key and not(jsonb_typeof(p_input->key)='string' or p_input->key='null'::jsonb) then perform eps.fail('INVALID_REQUEST','Expected project text or null.',400); end if; end loop;
  foreach key in array array['fresh_material_required','media_confirmed'] loop if p_input?key and jsonb_typeof(p_input->key)<>'boolean' then perform eps.fail('INVALID_REQUEST','Expected project boolean.',400); end if; end loop;
 end if;
 if p_key is null or length(p_key) not between 16 and 200 then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','A stable Idempotency-Key is required.',400); end if;
 payload:=jsonb_build_object('id',p_resource_id,'input',p_input); replay:=eps.idempotency_begin(operation,p_key,payload);
 perform eps.require_capability(case when p_operation='confirm_candidate_reviewed' then 'cast.review' when p_operation in('add_workspace_candidate','update_workspace_candidate','remove_workspace_candidate') then 'workspaces.write' else 'cast.write' end);
 perform eps.require_capability('cast.read');
 -- Scope is deliberately checked after the advisory wait, including on replay.
 if p_operation in('add_workspace_candidate','update_workspace_candidate','remove_workspace_candidate') then
  if p_operation='add_workspace_candidate' then workspace_id:=p_resource_id;
  else select * into pool from eps.workspace_candidates where id=p_resource_id and archived_at is null; workspace_id:=pool.workspace_id; end if;
  if workspace_id is null or not eps.cast_workspace_scope(workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace candidate not found.',404); end if;
  perform 1 from eps.workspaces where id=workspace_id for update;
  if not eps.cast_workspace_scope(workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  if replay is not null then return replay; end if;
  if p_operation<>'add_workspace_candidate' then select * into pool from eps.workspace_candidates where id=p_resource_id and archived_at is null for update; if not found then perform eps.fail('RESOURCE_NOT_FOUND','Workspace candidate not found.',404); end if;
   if eps.expected_version(p_input)<>pool.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Workspace candidate changed.',409,pool.row_version); end if;
  end if;
 elsif p_operation='update_candidate_frames' then
  select * into medium from eps.candidate_media where id=p_resource_id for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Candidate recording not found.',404); end if;
  candidate:=eps.cast_require_active(medium.candidate_id); if replay is not null then return replay; end if;
  if eps.expected_version(p_input)<>medium.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Candidate recording changed.',409,medium.row_version); end if;
 elsif p_operation<>'create_candidate' then
  if p_operation='resolve_candidate_duplicate' and p_input->>'action'='link_existing' then
   generated_id:=eps.input_uuid(p_input->>'existing_candidate_id'); if generated_id=p_resource_id then perform eps.fail('INVALID_REQUEST','A profile cannot merge into itself.',400); end if;
   perform 1 from eps.candidates where id in(p_resource_id,generated_id) order by id for update;
   existing:=eps.cast_require_active(generated_id);
  end if;
  -- A successful same-key link replays even though the provisional is archived.
  select * into candidate from eps.candidates where id=p_resource_id for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Library profile not found.',404); end if;
  if replay is not null then return replay; end if;
  if candidate.archived_at is not null or candidate.merged_into_candidate_id is not null then perform eps.fail('INVALID_TRANSITION','This profile is archived or already linked.',409); end if;
  if eps.expected_version(p_input)<>candidate.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Candidate facts changed.',409,candidate.row_version); end if;
 else if replay is not null then return replay; end if;
 end if;

 if p_operation='create_candidate' then
  generated_id:=gen_random_uuid(); facts:=jsonb_set(facts,'{casting_id}',to_jsonb(coalesce(facts->>'casting_id','EPS-'||upper(replace(generated_id::text,'-','')))));
  insert into eps.candidates(id,facts,casting_id,source_kind,field_sources,age_as_of,created_by) values(generated_id,facts,facts->>'casting_id','manual',eps.cast_manual_sources(facts),case when facts->>'age_or_range' is not null then current_date end,auth.uid());
  for key in select value from jsonb_array_elements_text(coalesce(p_input->'source_asset_ids','[]')) value loop
   asset:=eps.input_uuid(key);
   if not exists(select 1 from eps.media_assets where id=asset and status='ready' and purpose in('candidate_video','candidate_support')) then perform eps.fail('MEDIA_REFERENCE_INVALID','Choose an accessible ready candidate source.',422); end if;
   insert into eps.candidate_media(candidate_id,source_asset_id) values(generated_id,asset);
  end loop;
  result:=eps.cast_candidate_dto(generated_id);
 elsif p_operation='update_candidate' then
  facts:=jsonb_set(facts,'{casting_id}',to_jsonb(coalesce(facts->>'casting_id',candidate.casting_id))); sources:=candidate.field_sources;
  for key in select jsonb_object_keys(facts) loop if facts->key is distinct from candidate.facts->key then sources:=sources||jsonb_build_object(key,jsonb_build_object('kind','manual','principal_id',auth.uid())); end if; end loop;
  changed:=eps.cast_fingerprint(facts,sources)<>eps.cast_fingerprint(candidate.facts,candidate.field_sources);
  update eps.candidates set facts=facts,casting_id=facts->>'casting_id',field_sources=sources,
   age_as_of=case when facts->'age_or_range' is distinct from candidate.facts->'age_or_range' then case when facts->>'age_or_range' is not null then current_date end else candidate.age_as_of end,
   reviewed_at=case when changed then null else reviewed_at end,reviewed_by=case when changed then null else reviewed_by end,reviewed_facts_fingerprint=case when changed then null else reviewed_facts_fingerprint end,confirmation_note=case when changed then null else confirmation_note end,row_version=row_version+1,updated_at=clock_timestamp() where id=candidate.id;
  result:=eps.cast_candidate_dto(candidate.id);
 elsif p_operation='confirm_candidate_reviewed' then
  update eps.candidates set reviewed_at=clock_timestamp(),reviewed_by=auth.uid(),reviewed_facts_fingerprint=eps.cast_fingerprint(candidate.facts,candidate.field_sources),confirmation_note=p_input->>'confirmation_note',row_version=row_version+1,updated_at=clock_timestamp() where id=candidate.id;
  result:=eps.cast_candidate_dto(candidate.id);
 elsif p_operation='archive_candidate' then
  update eps.candidates set archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp() where id=candidate.id;
  result:=jsonb_build_object('success',true,'affected_ids',jsonb_build_array(candidate.id));
 elsif p_operation='update_candidate_frames' then
  frames:=eps.cast_selected_frames(medium.id,p_input->'selected_frame_asset_ids');
  update eps.candidate_media set selected_frame_asset_ids=frames,row_version=row_version+1 where id=medium.id;
  result:=eps.cast_media_dto(medium.id);
 elsif p_operation='resolve_candidate_duplicate' then
  if p_input->>'action'='keep_new' then update eps.candidates set duplicate_resolution='keep_new',row_version=row_version+1,updated_at=clock_timestamp() where id=candidate.id; result:=eps.cast_candidate_dto(candidate.id);
  else
   if eps.expected_version(p_input,'existing_candidate_row_version')<>existing.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Existing profile changed.',409,existing.row_version); end if;
   -- Project pins must be resolved in that project's writable scope; do not
   -- silently mutate inaccessible projects or collapse two existing pool rows.
   if exists(select 1 from eps.workspace_candidates provisional where provisional.candidate_id=candidate.id and provisional.archived_at is null and (not eps.cast_workspace_scope(provisional.workspace_id,true) or exists(select 1 from eps.workspace_candidates already where already.workspace_id=provisional.workspace_id and already.candidate_id=existing.id and already.archived_at is null))) then perform eps.fail('DUPLICATE_WORKSPACE_CONFLICT','Resolve project participation before linking these profiles.',409); end if;
   -- Re-point the explicit identity in one transaction while preserving every
   -- selected source/frame/availability value. Immutable versions keep snapshots.
   set constraints eps.cast_pool_media_fk deferred;
   update eps.candidate_media set candidate_id=existing.id where candidate_id=candidate.id;
   for workspace_id in select distinct participation.workspace_id from eps.workspace_candidates participation where participation.candidate_id=candidate.id and participation.archived_at is null loop perform eps.cast_changed(workspace_id); end loop;
   update eps.workspace_candidates set candidate_id=existing.id,row_version=row_version+1,updated_at=clock_timestamp() where candidate_id=candidate.id and archived_at is null;
   set constraints eps.cast_pool_media_fk immediate;
   update eps.candidates set merged_into_candidate_id=existing.id,duplicate_resolution='link_existing',archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp() where id=candidate.id;
   result:=eps.cast_candidate_dto(existing.id);
  end if;
 elsif p_operation='add_workspace_candidate' then
  candidate:=eps.cast_require_active(eps.input_uuid(p_input->>'candidate_id'));
  media_id:=case when p_input->>'selected_candidate_media_id' is not null then eps.input_uuid(p_input->>'selected_candidate_media_id') end;
  if media_id is not null then select * into medium from eps.candidate_media where id=media_id and candidate_id=candidate.id; if not found then perform eps.fail('MEDIA_REFERENCE_INVALID','Choose this candidate source recording.',422); end if; end if;
  insert into eps.workspace_candidates(workspace_id,candidate_id,selected_candidate_media_id,selected_frame_asset_ids,availability,fresh_material_required)
   values(workspace_id,candidate.id,media_id,coalesce(medium.selected_frame_asset_ids,'{}'),nullif(btrim(p_input->>'availability'),''),coalesce((p_input->>'fresh_material_required')::boolean,false)) returning id into generated_id;
  perform eps.cast_changed(workspace_id); result:=eps.cast_pool_dto(generated_id);
 elsif p_operation='update_workspace_candidate' then
  media_id:=case when p_input?'selected_candidate_media_id' then case when p_input->>'selected_candidate_media_id' is not null then eps.input_uuid(p_input->>'selected_candidate_media_id') end else pool.selected_candidate_media_id end;
  selection_changed:=media_id is distinct from pool.selected_candidate_media_id;
  if media_id is not null then select * into medium from eps.candidate_media where id=media_id and candidate_id=pool.candidate_id; if not found then perform eps.fail('MEDIA_REFERENCE_INVALID','Choose this candidate source recording.',422); end if; end if;
  frames:=eps.cast_selected_frames(media_id,case when p_input?'selected_frame_asset_ids' then p_input->'selected_frame_asset_ids' when selection_changed then to_jsonb(coalesce(medium.selected_frame_asset_ids,'{}')) else to_jsonb(pool.selected_frame_asset_ids) end);
  update eps.workspace_candidates set selected_candidate_media_id=media_id,selected_frame_asset_ids=frames,
   availability=case when p_input?'availability' then nullif(btrim(p_input->>'availability'),'') else availability end,
   fresh_material_required=case when p_input?'fresh_material_required' then (p_input->>'fresh_material_required')::boolean else fresh_material_required end,
   media_confirmed=case when p_input?'media_confirmed' then (p_input->>'media_confirmed')::boolean when selection_changed then false else media_confirmed end,
   internal_notes=case when p_input?'internal_notes' then nullif(btrim(p_input->>'internal_notes'),'') else internal_notes end,row_version=row_version+1,updated_at=clock_timestamp() where id=pool.id;
  perform eps.cast_changed(workspace_id); result:=eps.cast_pool_dto(pool.id);
 else
  if to_regclass('eps.assignments') is not null then perform eps.fail('ASSIGNMENT_RETIREMENT_UNAVAILABLE','Assignment archival must be integrated before candidate removal.',503); end if;
  update eps.workspace_candidates set archived_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp() where id=pool.id;
  perform eps.cast_changed(workspace_id); result:=jsonb_build_object('success',true,'affected_ids',jsonb_build_array(pool.id));
 end if;
 return eps.finish_mutation(operation,p_key,payload,result,coalesce(generated_id,p_resource_id));
end $$;

create function public.eps_create_candidate(p_input jsonb,p_idempotency_key text) returns jsonb language sql volatile security definer set search_path='' as $$ select eps.cast_mutate('create_candidate',null,p_input,p_idempotency_key) $$;
create function public.eps_update_candidate(p_candidate_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language sql volatile security definer set search_path='' as $$ select eps.cast_mutate('update_candidate',p_candidate_id,p_input,p_idempotency_key) $$;
create function public.eps_confirm_candidate_reviewed(p_candidate_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language sql volatile security definer set search_path='' as $$ select eps.cast_mutate('confirm_candidate_reviewed',p_candidate_id,p_input,p_idempotency_key) $$;
create function public.eps_archive_candidate(p_candidate_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language sql volatile security definer set search_path='' as $$ select eps.cast_mutate('archive_candidate',p_candidate_id,p_input,p_idempotency_key) $$;
create function public.eps_update_candidate_frames(p_candidate_media_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language sql volatile security definer set search_path='' as $$ select eps.cast_mutate('update_candidate_frames',p_candidate_media_id,p_input,p_idempotency_key) $$;
create function public.eps_resolve_candidate_duplicate(p_candidate_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language sql volatile security definer set search_path='' as $$ select eps.cast_mutate('resolve_candidate_duplicate',p_candidate_id,p_input,p_idempotency_key) $$;
create function public.eps_add_workspace_candidate(p_workspace_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language sql volatile security definer set search_path='' as $$ select eps.cast_mutate('add_workspace_candidate',p_workspace_id,p_input,p_idempotency_key) $$;
create function public.eps_update_workspace_candidate(p_workspace_candidate_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language sql volatile security definer set search_path='' as $$ select eps.cast_mutate('update_workspace_candidate',p_workspace_candidate_id,p_input,p_idempotency_key) $$;
create function public.eps_remove_workspace_candidate(p_workspace_candidate_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language sql volatile security definer set search_path='' as $$ select eps.cast_mutate('remove_workspace_candidate',p_workspace_candidate_id,p_input,p_idempotency_key) $$;

create function eps.cast_changed(p_workspace uuid) returns void language plpgsql volatile security invoker set search_path='' as $$
declare changed bigint; begin
 update eps.workspaces set row_version=row_version+1,draft_revision=draft_revision+1,has_unpublished_changes=true,updated_at=clock_timestamp() where id=p_workspace and eps.cast_workspace_scope(id,true);
 get diagnostics changed=row_count; if changed<>1 then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
end $$;
create function eps.cast_selected_frames(p_media uuid,p_frames jsonb) returns uuid[] language plpgsql stable security invoker set search_path='' as $$
declare result uuid[]; source uuid; begin
 if jsonb_typeof(p_frames) is distinct from 'array' or jsonb_array_length(p_frames)>3 or exists(select 1 from jsonb_array_elements(p_frames) item where jsonb_typeof(item)<>'string') then perform eps.fail('INVALID_REQUEST','Choose up to three distinct real frames.',400); end if;
 select coalesce(array_agg(eps.input_uuid(value) order by ordinal),'{}') into result from jsonb_array_elements_text(p_frames) with ordinality list(value,ordinal);
 if cardinality(result)<>(select count(distinct value) from unnest(result) value) then perform eps.fail('INVALID_REQUEST','Repeated frame selection is not permitted.',400); end if;
 if p_media is null and cardinality(result)>0 then perform eps.fail('MEDIA_REFERENCE_INVALID','Frames require a chosen source recording.',422); end if;
 select source_asset_id into source from eps.candidate_media where id=p_media;
 if exists(select 1 from unnest(result) chosen where not exists(select 1 from eps.candidate_media_frames frame join eps.media_assets asset on asset.id=frame.asset_id where frame.candidate_media_id=p_media and frame.asset_id=chosen and asset.source_asset_id=source and asset.status='ready' and asset.purpose='candidate_frame' and asset.width>0 and asset.height>0 and asset.source_timestamp_ms>=0)) then perform eps.fail('MEDIA_REFERENCE_INVALID','Frames must be ready derivatives of the chosen recording.',422); end if;
 return result;
end $$;

-- No direct private-schema RPC, no new storage authority, no BYPASSRLS role.
grant create on schema eps,public to eps_cast_owner;
do $$ declare routine regprocedure; is_public boolean; begin
 for routine,is_public in select proc.oid::regprocedure,ns.nspname='public' from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace where ns.nspname='eps' and proc.proname like 'cast\_%' escape '\' or ns.nspname='public' and proc.proname in('eps_search_candidates','eps_get_candidate','eps_get_candidate_media','eps_find_candidate_duplicates','eps_list_workspace_candidates','eps_create_candidate','eps_update_candidate','eps_confirm_candidate_reviewed','eps_archive_candidate','eps_update_candidate_frames','eps_resolve_candidate_duplicate','eps_add_workspace_candidate','eps_update_workspace_candidate','eps_remove_workspace_candidate') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',routine);
  execute format('alter function %s owner to eps_cast_owner',routine);
  if is_public then execute format('grant execute on function %s to authenticated',routine); end if;
 end loop;
end $$;
revoke create on schema eps,public from eps_cast_owner;
