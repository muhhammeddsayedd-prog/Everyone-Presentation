-- Lets Mostafa's cast archive live in eps as candidates. Additive only. Rehearsed on a branch 2026-11-09.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';

-- 1. New candidate source.
alter table eps.candidates drop constraint candidates_source_kind_check;
alter table eps.candidates add constraint candidates_source_kind_check check(source_kind in('manual','scan','archive'));

-- 2. Tape order.
alter table eps.candidate_media add column source_position integer check(source_position>=1);
create unique index candidate_media_source_position_unique on eps.candidate_media(candidate_id,source_position) where source_position is not null;

-- 3. New stored-file type. Same pattern as m03: every deployed branch is preserved, one closed branch is added.
do $$declare definition text;begin
 select pg_get_constraintdef(oid) into definition from pg_constraint where conrelid='eps.media_assets'::regclass and conname='media_assets_typed_purpose_check';
 if definition is null or strpos(definition,'candidate_photo')>0 or strpos(definition,'ELSE false')=0 then raise exception 'PHOTO_PURPOSE_BASELINE_MISMATCH';end if;
 definition:=replace(definition,'ELSE false',$branch$WHEN 'candidate_photo'::text THEN
 bucket='eps-candidate-photos' and mime_type='image/jpeg' and size_bytes between 1 and 5242880 and client_id is null and origin_workspace_id is not null
 and source_asset_id is null and producing_job_id is null and producing_attempt_id is null and output_stage is null and output_key is null and source_timestamp_ms is null and duration_ms is null
 and (status<>'ready' or sha256 is not null and width between 1 and 4096 and height between 1 and 4096)
 ELSE false$branch$);
 alter table eps.media_assets drop constraint media_assets_typed_purpose_check;
 execute 'alter table eps.media_assets add constraint media_assets_typed_purpose_check '||definition;
end $$;

-- 4. Photo storage: private, readable with cast.read, written only by the service key during import.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('eps-candidate-photos','eps-candidate-photos',false,5242880,array['image/jpeg']);
create function eps.candidate_photo_read_allowed(p_bucket text,p_key text) returns boolean language sql volatile security definer set search_path='' as $$
 select auth.uid() is not null and eps.has_capability('cast.read') and exists(select 1 from eps.media_assets a where a.bucket=p_bucket and a.object_key=p_key and a.status='ready' and a.purpose='candidate_photo')
$$;
revoke all on function eps.candidate_photo_read_allowed(text,text) from public,anon,service_role;
grant execute on function eps.candidate_photo_read_allowed(text,text) to authenticated;
create policy eps_candidate_photos_read on storage.objects for select to authenticated using(bucket_id='eps-candidate-photos' and (storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info') or storage.allow_only_operation('object.sign')) and eps.candidate_photo_read_allowed(bucket_id,name));
create policy eps_candidate_photos_read_guard on storage.objects as restrictive for select to public using(bucket_id<>'eps-candidate-photos' or (storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info') or storage.allow_only_operation('object.sign')) and eps.candidate_photo_read_allowed(bucket_id,name));
create policy eps_candidate_photos_insert_guard on storage.objects as restrictive for insert to public with check(bucket_id<>'eps-candidate-photos');
create policy eps_candidate_photos_update_guard on storage.objects as restrictive for update to public using(bucket_id<>'eps-candidate-photos') with check(bucket_id<>'eps-candidate-photos');
create policy eps_candidate_photos_delete_guard on storage.objects as restrictive for delete to public using(bucket_id<>'eps-candidate-photos');

-- 5. Photos.
create table eps.candidate_photos(
 id uuid primary key default gen_random_uuid(),candidate_id uuid not null references eps.candidates(id) on delete restrict,
 position integer not null check(position>=1),
 asset_id uuid not null unique references eps.media_assets(id) on delete restrict,thumb_asset_id uuid not null unique references eps.media_assets(id) on delete restrict,
 width integer not null check(width>0),height integer not null check(height>0),source_key text not null check(length(source_key) between 1 and 500),
 created_at timestamptz not null default clock_timestamp(),unique(candidate_id,position),unique(candidate_id,id),check(asset_id<>thumb_asset_id)
);

-- 6. Labels: one row per candidate.
create table eps.candidate_attributes(
 candidate_id uuid primary key references eps.candidates(id) on delete restrict,
 name_ar text check(length(name_ar) between 1 and 500),
 talent_type text not null default 'talent' check(talent_type in('talent','real_family','group')),
 look text,skin_tone text,nationality text,country text,
 playing_age text[] not null default '{}' check(playing_age<@array['Baby','Kids','Child','Teen 13-17','Age 18-24','Age 25-34','Age 35-44','Age 45-54','Age 55-64','Age 65+']::text[]),
 hair_length text[] not null default '{}' check(hair_length<@array['Short','Shoulder Length','Long']::text[]),
 hair_texture text[] not null default '{}' check(hair_texture<@array['Curly','Wavy','Straight','Afro']::text[]),
 hair_colour text[] not null default '{}' check(hair_colour<@array['Dark','Black','Brown','Dark Brown','Light Brown','Blonde','Auburn','Red','Ginger','Grey','White']::text[]),
 hair_style text[] not null default '{}' check(hair_style<@array['Bald','Shaved Head','Receding','Tied Back','Braids','Fringe','Bob','Voluminous']::text[]),
 hair_colouring text[] not null default '{}' check(hair_colouring<@array['Highlights','Dyed','Bleached']::text[]),
 tags text[] not null default '{}',
 cover_photo_id uuid,
 source_project text,source_id text,imported_at timestamptz,
 field_sources jsonb not null default '{}' check(jsonb_typeof(field_sources)='object'),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 constraint candidate_attributes_cover_fk foreign key(candidate_id,cover_photo_id) references eps.candidate_photos(candidate_id,id) on delete restrict deferrable initially deferred
);
create unique index candidate_attributes_source_unique on eps.candidate_attributes(source_project,source_id) where source_id is not null;
create index candidate_attributes_tags_idx on eps.candidate_attributes using gin(tags);
create index candidate_attributes_playing_age_idx on eps.candidate_attributes using gin(playing_age);

-- 7. Access: read with cast.read through the cast owner role. No write or delete path yet.
do $$declare target regclass;begin foreach target in array array['eps.candidate_photos'::regclass,'eps.candidate_attributes'::regclass] loop
 execute format('alter table %s enable row level security',target);execute format('alter table %s force row level security',target);
 execute format('revoke all on %s from public,anon,authenticated,service_role,eps_api_owner,eps_jobs_owner,eps_jobs_executor,eps_specs_owner',target);
 execute format('grant select on %s to eps_cast_owner',target);
end loop;end $$;
create policy cast_photos_read on eps.candidate_photos for select to eps_cast_owner using(eps.has_capability('cast.read'));
create policy cast_attributes_read on eps.candidate_attributes for select to eps_cast_owner using(eps.has_capability('cast.read'));
