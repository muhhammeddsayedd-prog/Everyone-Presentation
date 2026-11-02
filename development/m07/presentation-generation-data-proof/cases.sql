-- Private owned-test observations only. No public function/role/timeout change.
create function pg_temp.data_reuse_capture(p_version uuid)returns jsonb
language plpgsql volatile security invoker set search_path=''as $capture$
declare started timestamptz:=clock_timestamp();n integer;begin
 if current_user<>'eps_review_owner'or current_setting('statement_timeout')<>'8s'
 then raise exception'DATA_REUSE_CAPTURE_CALLER_REQUIRED';end if;
 n:=eps.capture_presentation_video_transcripts(p_version);
 return jsonb_build_object('ok',true,'captured',n,'duration_ms',extract(epoch from(clock_timestamp()-started))*1000);
exception when invalid_text_representation then return jsonb_build_object('ok',false,'code','22P02');
 when query_canceled then return jsonb_build_object('ok',false,'code','57014');
 when raise_exception then
  if sqlerrm in('SNAPSHOT_INVALID','IMMUTABLE_VERSION','CAPABILITY_REQUIRED','RESOURCE_NOT_FOUND','AUTH_REQUIRED')
  then return jsonb_build_object('ok',false,'code',sqlerrm);end if;raise;
end$capture$;

create function pg_temp.data_reuse_pin_projection(p_version uuid)returns jsonb
language plpgsql stable security invoker set search_path=''as $pins$
declare v eps.presentation_versions;begin
 if current_user<>'postgres'then raise exception'DATA_REUSE_PRIVATE_OBSERVER_REQUIRED';end if;
 select * into v from eps.presentation_versions where id=p_version;
 if not found or v.status<>'queued'or v.generated_by<>'a4410000-0000-4000-8000-000000000001'::uuid
 then raise exception'DATA_REUSE_NEW_SYNTHETIC_VERSION_REQUIRED';end if;
 return jsonb_build_object(
  'pin_metadata_sha256',(select eps.presentation_hash(coalesce(jsonb_agg(to_jsonb(p)-'version_id'order by p.asset_id),'[]'))from eps.presentation_version_assets p where p.version_id=p_version),
  'raw_count',(select count(*)from eps.presentation_video_transcripts where version_id=p_version),
  'english_count',(select count(*)from eps.presentation_video_english_transcripts where version_id=p_version),
  'english_states',(select coalesce(jsonb_agg(distinct status order by status),'[]')from eps.presentation_video_english_transcripts where version_id=p_version),
  'private_filename_examined_count',(select count(*)from eps.presentation_version_assets where version_id=p_version and asset_kind='candidate_video'),
  'private_filename_sha256',(select eps.presentation_hash(coalesce(jsonb_agg(filename order by asset_id),'[]'))from eps.presentation_version_assets where version_id=p_version and asset_kind='candidate_video'),
  'private_filename_in_output',exists(select 1 from eps.presentation_version_assets p where p.version_id=p_version and p.asset_kind='candidate_video'and(position(p.filename in v.snapshot::text)>0 or position(p.filename in v.manifest::text)>0)));
end$pins$;
