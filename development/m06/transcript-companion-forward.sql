-- Additive28: a frozen source-text companion beside retained original video.
-- No old-version backfill, snapshot/manifest/PDF/fingerprint/runtime change.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
do $m06_transcript_predecessor$begin
 if current_user<>'postgres'or current_database()<>'postgres'
 or(select count(*)from supabase_migrations.schema_migrations)<>27
 or(select max(version)from supabase_migrations.schema_migrations)<>'20261030013832'
 or not exists(select 1 from supabase_migrations.schema_migrations where version='20261030013832'and name='m06_guest_storage_policy_composition')
 or to_regclass('eps.presentation_video_transcripts')is not null
 or has_schema_privilege('eps_review_owner','eps','CREATE')
 then raise exception'M06_TRANSCRIPT_EXACT_REVIEWED27_REQUIRED';end if;
end$m06_transcript_predecessor$;

-- Match the existing source-data C0/DEL convention. C1 and original language
-- bytes are preserved. PostgreSQL UTF8 text cannot contain NUL/lone surrogates.
create function eps.presentation_source_text_valid(p_text text,p_maximum integer)returns boolean
language sql immutable security invoker set search_path=''as $$
 select coalesce(p_text is not null and p_maximum between 1 and 200000
  and length(p_text)between 1 and p_maximum
  and p_text!~U&'[\0001-\0008\000B\000C\000E-\001F\007F]'
  and p_text~U&'[^\0009\000A\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]',false)
$$;
create function eps.presentation_source_languages_valid(p_languages text[])returns boolean
language sql immutable security invoker set search_path=''as $$
 select coalesce(p_languages is not null and cardinality(p_languages)<=100
  and(cardinality(p_languages)=0 or array_ndims(p_languages)=1 and array_lower(p_languages,1)=1)
  and not exists(select 1 from unnest(p_languages)value where not eps.presentation_source_text_valid(value,1000)
   or value~U&'[\0001-\001F\007F]'),false)
$$;

create table eps.presentation_video_transcripts(
 version_id uuid not null,video_asset_id uuid not null,
 candidate_media_id uuid not null references eps.candidate_media(id)on delete restrict,
 source_media_row_version bigint not null check(source_media_row_version between 1 and 9007199254740991),
 status text not null check(status in('available','not_provided')),
 original_text text,source_sha256 text,languages text[]not null default'{}',
 captured_at timestamptz not null,
 primary key(version_id,video_asset_id),
 foreign key(version_id,video_asset_id)references eps.presentation_version_assets(version_id,asset_id)on delete restrict,
 check(eps.presentation_source_languages_valid(languages)),
 check((status='available'and original_text is not null and eps.presentation_source_text_valid(original_text,200000)
   and source_sha256 is not null and source_sha256~'^[a-f0-9]{64}$'
   and source_sha256=encode(sha256(convert_to(original_text,'UTF8')),'hex'))
  or(status='not_provided'and original_text is null and source_sha256 is null and languages='{}'::text[]))
);
create index presentation_video_transcript_source on eps.presentation_video_transcripts(candidate_media_id,version_id);
alter table eps.presentation_video_transcripts enable row level security;
alter table eps.presentation_video_transcripts force row level security;
revoke all on eps.presentation_video_transcripts from public,anon,authenticated,service_role;
grant select,insert on eps.presentation_video_transcripts to eps_review_owner;
grant select on eps.presentation_video_transcripts to eps_guest_owner;
create policy presentation_video_transcript_internal_read on eps.presentation_video_transcripts for select to eps_review_owner using(
 exists(select 1 from eps.presentation_versions v where v.id=presentation_video_transcripts.version_id and eps.presentation_scope(v.workspace_id)));
create policy presentation_video_transcript_guest_read on eps.presentation_video_transcripts for select to eps_guest_owner using(true);
create policy presentation_video_transcript_capture on eps.presentation_video_transcripts for insert to eps_review_owner with check(
 version_id::text=current_setting('eps.presentation.transcript_capture_version',true)
 and exists(select 1 from eps.presentation_versions v
  join eps.presentation_version_assets p on p.version_id=v.id and p.asset_id=presentation_video_transcripts.video_asset_id and p.asset_kind='candidate_video'
  join eps.candidate_media m on m.id=presentation_video_transcripts.candidate_media_id and m.source_asset_id=p.asset_id
  where v.id=presentation_video_transcripts.version_id and v.status='queued'and v.generated_by=auth.uid()
   and eps.presentation_scope(v.workspace_id,true)and presentation_video_transcripts.captured_at=v.created_at and presentation_video_transcripts.source_media_row_version=m.row_version
   and exists(select 1 from eps.version_slides d where d.version_id=v.id and d.kind='candidate'
    and d.snapshot->>'candidate_media_id'=m.id::text and d.snapshot->>'video_asset_id'=p.asset_id::text)
   and((presentation_video_transcripts.status='available'and presentation_video_transcripts.original_text=m.original_transcript and presentation_video_transcripts.languages=m.languages)
    or(presentation_video_transcripts.status='not_provided'and(m.original_transcript is null
     or m.original_transcript!~U&'[^\0009\000A\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]'))))
);
create trigger presentation_video_transcript_immutable before update or delete on eps.presentation_video_transcripts
 for each row execute function eps.presentation_immutable_row();

create function eps.capture_presentation_video_transcripts(p_version uuid)returns integer
language plpgsql volatile security invoker set search_path=''as $$
declare version eps.presentation_versions;pin record;media eps.candidate_media;source_ids uuid[];
 value_text text;value_status text;value_hash text;value_languages text[];captured integer:=0;prior_context text;
begin
 select * into version from eps.presentation_versions where id=p_version;
 if not found or version.status<>'queued'or version.generated_by is distinct from auth.uid()
 or not eps.presentation_scope(version.workspace_id,true)
 then perform eps.fail('IMMUTABLE_VERSION','Source companions are captured only by a fresh authorized generation.',409);end if;
 if exists(select 1 from eps.presentation_video_transcripts where version_id=version.id)
 then perform eps.fail('IMMUTABLE_VERSION','The source companion is already captured.',409);end if;
 prior_context:=current_setting('eps.presentation.transcript_capture_version',true);
 perform set_config('eps.presentation.transcript_capture_version',version.id::text,true);
 for pin in select p.asset_id from eps.presentation_version_assets p where p.version_id=version.id and p.asset_kind='candidate_video'order by p.asset_id loop
  select array_agg(distinct(d.snapshot->>'candidate_media_id')::uuid)into source_ids from eps.version_slides d
   where d.version_id=version.id and d.kind='candidate'and d.snapshot->>'video_asset_id'=pin.asset_id::text and d.snapshot->>'candidate_media_id'is not null;
  if coalesce(cardinality(source_ids),0)<>1 then perform eps.fail('SNAPSHOT_INVALID','The selected original source cannot be captured.',503);end if;
  select * into media from eps.candidate_media where id=source_ids[1]and source_asset_id=pin.asset_id for share;
  if not found then perform eps.fail('SNAPSHOT_INVALID','The selected original source cannot be captured.',503);end if;
  if media.original_transcript is null or media.original_transcript!~U&'[^\0009\000A\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]'then
   value_status:='not_provided';value_text:=null;value_hash:=null;value_languages:='{}';
  else
   -- Validate before INSERT: a CHECK failure must never echo source text in DETAIL.
   if not eps.presentation_source_text_valid(media.original_transcript,200000)
   or not eps.presentation_source_languages_valid(media.languages)
   then perform eps.fail('SNAPSHOT_INVALID','The selected source transcript cannot be captured.',503);end if;
   value_status:='available';value_text:=media.original_transcript;value_languages:=media.languages;
   value_hash:=encode(sha256(convert_to(value_text,'UTF8')),'hex');
  end if;
  insert into eps.presentation_video_transcripts(version_id,video_asset_id,candidate_media_id,source_media_row_version,status,original_text,source_sha256,languages,captured_at)
   values(version.id,pin.asset_id,media.id,media.row_version,value_status,value_text,value_hash,value_languages,version.created_at);
  captured:=captured+1;
 end loop;
 if captured<>(select count(*)from eps.presentation_version_assets where version_id=version.id and asset_kind='candidate_video')
 then perform eps.fail('SNAPSHOT_INVALID','The selected source transcript capture is incomplete.',503);end if;
 perform set_config('eps.presentation.transcript_capture_version',coalesce(prior_context,''),true);
 return captured;
end$$;

create function eps.presentation_video_transcript(p_version uuid,p_asset uuid)returns jsonb
language plpgsql stable security invoker set search_path=''as $$
declare item eps.presentation_video_transcripts;
begin
 -- The existing caller has already validated its exact current video authority.
 -- This extra pin check prevents accidental use for another asset purpose.
 if not exists(select 1 from eps.presentation_version_assets p where p.version_id=p_version and p.asset_id=p_asset and p.asset_kind='candidate_video')
 then perform eps.fail('RESOURCE_NOT_FOUND','Fixed-version original video not found.',404);end if;
 select * into item from eps.presentation_video_transcripts where version_id=p_version and video_asset_id=p_asset;
 if not found then return jsonb_build_object('version_id',p_version,'asset_id',p_asset,'status','not_captured',
  'original_text',null,'languages','[]'::jsonb,'source_kind','source_transcript','source_sha256',null);end if;
 return jsonb_build_object('version_id',p_version,'asset_id',p_asset,'status',item.status,
  'original_text',item.original_text,'languages',to_jsonb(item.languages),'source_kind','source_transcript','source_sha256',item.source_sha256);
end$$;

-- Only trusted existing owners use these helpers. No public digest read path.
grant create on schema eps to eps_review_owner;
alter function eps.presentation_source_text_valid(text,integer)owner to eps_review_owner;
alter function eps.presentation_source_languages_valid(text[])owner to eps_review_owner;
alter function eps.capture_presentation_video_transcripts(uuid)owner to eps_review_owner;
alter function eps.presentation_video_transcript(uuid,uuid)owner to eps_review_owner;
revoke create on schema eps from eps_review_owner;
revoke all on function eps.presentation_source_text_valid(text,integer),eps.presentation_source_languages_valid(text[]),
 eps.capture_presentation_video_transcripts(uuid),eps.presentation_video_transcript(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function eps.presentation_video_transcript(uuid,uuid)to eps_guest_owner;

do $m06_transcript_ports$
declare item record;source text;definition text;replacement text;
begin
 for item in select * from(values
  ('public.eps_generate_version(uuid,jsonb,text)','1be2e4902217a7d1fe71c09537156fc5fda499bea258a40006baca8877b693bb'),
  ('public.eps_get_version_asset(uuid,uuid,text)','dca8ddec35db307e9f52186d674cf8414344048e17feed6a5be5ed5ad8f6be1e'),
  ('eps.guest_asset_issue(uuid,text,uuid,uuid,text,uuid)','9fb14e95e0c8a75185aeda016161ce5147c5fedd1989fc9a15ba5f777867143c')
 )v(signature,expected_sha256)loop
  select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(source,'UTF8')),'hex')<>item.expected_sha256 then raise exception'M06_TRANSCRIPT_EXACT_PRECEDING_PORT_REQUIRED:%',item.signature;end if;
  if item.signature='public.eps_generate_version(uuid,jsonb,text)'then
   replacement:=replace(source,' update eps.presentation_series set next_version_number=next_version_number+1',
    E' perform eps.capture_presentation_video_transcripts(version_id);\n update eps.presentation_series set next_version_number=next_version_number+1');
  elsif item.signature='public.eps_get_version_asset(uuid,uuid,text)'then
   replacement:=replace(source,'''object_key'',pin.object_key);',
    '''object_key'',pin.object_key)||case when p_purpose=''video''then jsonb_build_object(''transcript'',eps.presentation_video_transcript(version.id,p_asset_id))else''{}''::jsonb end;');
  else
   replacement:=replace(source,'''parent_expires_at'',eps.presentation_time(least(link.expires_at,coalesce(session.expires_at,grant_row.expires_at))));',
    '''parent_expires_at'',eps.presentation_time(least(link.expires_at,coalesce(session.expires_at,grant_row.expires_at))))||case when p_purpose=''video''then jsonb_build_object(''transcript'',eps.presentation_video_transcript(version.id,p_asset))else''{}''::jsonb end;');
  end if;
  if replacement=source then raise exception'M06_TRANSCRIPT_CAPTURE_READ_ANCHOR_REQUIRED:%',item.signature;end if;
  execute replace(definition,source,replacement);
 end loop;
end$m06_transcript_ports$;
