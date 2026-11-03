
declare version eps.presentation_versions;raw eps.presentation_video_transcripts;media eps.candidate_media;prior_context text;captured integer:=0;capture_video_ids uuid[]:='{}'::uuid[];capture_media_ids uuid[]:='{}'::uuid[];capture_inserted integer:=0;
begin
 select * into version from eps.presentation_versions where id=p_version;
 if not found or version.status<>'queued'or version.english_transcript_version is distinct from'1.0'
  or version.generated_by is distinct from auth.uid()or not eps.presentation_scope(version.workspace_id,true)
 then perform eps.fail('IMMUTABLE_VERSION','English companions require a fresh authorized generation.',409);end if;
 if exists(select 1 from eps.presentation_video_english_transcripts where version_id=p_version)
 then perform eps.fail('IMMUTABLE_VERSION','English companions are already captured.',409);end if;
 prior_context:=current_setting('eps.presentation.english_transcript_capture_version',true);
 perform set_config('eps.presentation.english_transcript_capture_version',p_version::text,true);
 for raw in select * from eps.presentation_video_transcripts where version_id=p_version order by video_asset_id loop
  select * into media from eps.candidate_media where id=raw.candidate_media_id and source_asset_id=raw.video_asset_id for share;
  if not found or media.row_version<>raw.source_media_row_version
   or(media.english_transcript_status in('available','unavailable')and media.english_transcript_source_sha256 is distinct from raw.source_sha256)
   or(media.english_transcript_status='not_provided'and raw.status<>'not_provided')
  then perform eps.fail('SNAPSHOT_INVALID','The selected English transcript cannot be captured.',503);end if;
  capture_video_ids:=array_append(capture_video_ids,raw.video_asset_id);
  capture_media_ids:=array_append(capture_media_ids,media.id);
  captured:=captured+1;
 end loop;
 if captured>0 then
  insert into eps.presentation_video_english_transcripts(version_id,video_asset_id,candidate_media_id,source_media_row_version,status,english_text,source_sha256,english_sha256,captured_at)
   select p_version,r.video_asset_id,m.id,r.source_media_row_version,m.english_transcript_status,m.english_transcript,
    m.english_transcript_source_sha256,case when m.english_transcript_status='available'then encode(sha256(convert_to(m.english_transcript,'UTF8')),'hex')end,version.created_at
   from unnest(capture_video_ids,capture_media_ids)with ordinality d(video_asset_id,candidate_media_id,ordinal)
   join eps.presentation_video_transcripts r on r.version_id=p_version and r.video_asset_id=d.video_asset_id and r.candidate_media_id=d.candidate_media_id
   join eps.candidate_media m on m.id=d.candidate_media_id and m.source_asset_id=d.video_asset_id order by d.ordinal;
  get diagnostics capture_inserted=row_count;
 end if;
 if not eps.presentation_scope(version.workspace_id,true)
 then perform eps.fail('IMMUTABLE_VERSION','English companions require a fresh authorized generation.',409);end if;
 if capture_inserted<>captured then perform eps.fail('SNAPSHOT_INVALID','English transcript capture is incomplete.',503);end if;
 if captured<>(select count(*)from eps.presentation_version_assets where version_id=p_version and asset_kind='candidate_video')
 then perform eps.fail('SNAPSHOT_INVALID','English transcript capture is incomplete.',503);end if;
 perform set_config('eps.presentation.english_transcript_capture_version',coalesce(prior_context,''),true);return captured;
end