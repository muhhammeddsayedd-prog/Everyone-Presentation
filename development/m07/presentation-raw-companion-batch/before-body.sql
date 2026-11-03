
declare version eps.presentation_versions;pin record;media eps.candidate_media;source_ids uuid[];
 value_text text;value_status text;value_hash text;value_languages text[];captured integer:=0;prior_context text;capture_slide_video_ids text[]:='{}'::text[];capture_slide_media_ids text[]:='{}'::text[];
begin
 select * into version from eps.presentation_versions where id=p_version;
 if not found or version.status<>'queued'or version.generated_by is distinct from auth.uid()
 or not eps.presentation_scope(version.workspace_id,true)
 then perform eps.fail('IMMUTABLE_VERSION','Source companions are captured only by a fresh authorized generation.',409);end if;
 if exists(select 1 from eps.presentation_video_transcripts where version_id=version.id)
 then perform eps.fail('IMMUTABLE_VERSION','The source companion is already captured.',409);end if;
 prior_context:=current_setting('eps.presentation.transcript_capture_version',true);
 perform set_config('eps.presentation.transcript_capture_version',version.id::text,true);
 if exists(select 1 from eps.presentation_version_assets p where p.version_id=version.id and p.asset_kind='candidate_video')then
  select coalesce(array_agg(d.snapshot->>'video_asset_id'order by d.ordinal,d.id),'{}'::text[]),
   coalesce(array_agg(d.snapshot->>'candidate_media_id'order by d.ordinal,d.id),'{}'::text[])
  into capture_slide_video_ids,capture_slide_media_ids
  from eps.version_slides d where d.version_id=version.id and d.kind='candidate';
 end if;
 for pin in select p.asset_id from eps.presentation_version_assets p where p.version_id=version.id and p.asset_kind='candidate_video'order by p.asset_id loop
  select array_agg(distinct(d.candidate_media_id)::uuid)into source_ids from unnest(capture_slide_video_ids,capture_slide_media_ids)d(video_asset_id,candidate_media_id)
   where d.video_asset_id=pin.asset_id::text and d.candidate_media_id is not null;
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
 if version.english_transcript_version='1.0'then perform eps.capture_presentation_video_english_transcripts(version.id);end if;
 perform set_config('eps.presentation.transcript_capture_version',coalesce(prior_context,''),true);
 return captured;
end