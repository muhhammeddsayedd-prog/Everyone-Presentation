-- Requires test-target + standard M04/M05 + m06-transcript28-legacy fixtures,
-- before34.sql + migration34 + validation-tests.sql, in one owned transaction.
-- Synthetic Ready metadata below proves freezing/access only, never PDF bytes.
set local role postgres;
do $$declare before jsonb;after jsonb;begin
 if current_database()!~'^eps_english34_[a-f0-9]{32}$'
 or current_database()<>'eps_english34_'||current_setting('eps.english34_test_run',true)
 or not exists(select 1 from pg_database where datname=current_database()
  and oid::text=current_setting('eps.english34_test_oid',true)and datdba='postgres'::regrole
  and shobj_description(oid,'pg_database')='eps-english34-owned:'||current_setting('eps.english34_test_run',true))
 then raise exception'ENGLISH34_OWNED_SYNTHETIC_DATABASE_REQUIRED';end if;
 before:=current_setting('eps.english34.old_versions')::jsonb;
 select coalesce(jsonb_object_agg(v.id::text,eps.presentation_hash(to_jsonb(v)-'english_transcript_version')),'{}'::jsonb)into after from eps.presentation_versions v;
 perform pg_temp.english34_assert(before=after);
 before:=current_setting('eps.english34.old_raw')::jsonb;
 select coalesce(jsonb_object_agg(t.version_id::text||'/'||t.video_asset_id,eps.presentation_hash(to_jsonb(t))),'{}'::jsonb)into after from eps.presentation_video_transcripts t;
 perform pg_temp.english34_assert(before=after);
 perform pg_temp.english34_assert(not exists(select 1 from eps.presentation_video_english_transcripts));
end$$;
set local role authenticated;
do $$declare data jsonb;ack jsonb;begin
 data:=public.eps_get_version_asset(current_setting('eps.t28.legacy')::uuid,current_setting('eps.t28.video')::uuid,'video')->'transcript';
 perform pg_temp.english34_assert(data->'english_text'='null'and data->>'english_status'='not_captured'and data->'english_sha256'='null');
 ack:=public.eps_generate_version(current_setting('eps.m05.selection')::uuid,current_setting('eps.t28.legacy_body')::jsonb,'m06-transcript-legacy-original');
 perform pg_temp.english34_assert(ack=current_setting('eps.t28.legacy_ack')::jsonb);
end$$;
set local role postgres;
do $$begin
 perform pg_temp.english34_assert(not exists(select 1 from eps.presentation_video_english_transcripts));
end$$;
-- Add synthetic English projection only to current library media, preserving raw.
update eps.candidate_media set english_transcript='Synthetic English introduction.',english_transcript_status='available',
 english_transcript_source_sha256=encode(sha256(convert_to(original_transcript,'UTF8')),'hex'),english_transcript_input_hash=repeat('e',64),
 english_transcript_metadata=pg_temp.english34_payload()#>'{english_transcript,metadata}',row_version=row_version+1
 where id=current_setting('eps.t28.media')::uuid;
set local role authenticated;
do $$declare ack jsonb;data jsonb;again jsonb;begin
 ack:=pg_temp.t28_generate('english34-frozen');perform set_config('eps.english34.frozen',ack->>'resource_id',true);
 again:=public.eps_generate_version(current_setting('eps.m05.selection')::uuid,current_setting('eps.t28.lastbody')::jsonb,'english34-frozen');
 perform pg_temp.english34_assert(ack=again);
 perform pg_temp.t28_ready((ack->>'resource_id')::uuid);
 data:=public.eps_get_version_asset((ack->>'resource_id')::uuid,current_setting('eps.t28.video')::uuid,'video')->'transcript';
 perform pg_temp.english34_assert(data->>'english_status'='available'and data->>'english_text'='Synthetic English introduction.'
  and data->>'english_sha256'=encode(sha256(convert_to('Synthetic English introduction.','UTF8')),'hex'));
 perform set_config('eps.english34.frozen_dto',data::text,true);
end$$;
set local role postgres;
do $$declare item eps.presentation_video_english_transcripts;version eps.presentation_versions;begin
 select * into strict version from eps.presentation_versions where id=current_setting('eps.english34.frozen')::uuid;
 select * into strict item from eps.presentation_video_english_transcripts where version_id=version.id;
 perform pg_temp.english34_assert(version.english_transcript_version='1.0'and item.captured_at=version.created_at
  and item.candidate_media_id=current_setting('eps.t28.media')::uuid
  and item.source_sha256=(select source_sha256 from eps.presentation_video_transcripts where version_id=version.id and video_asset_id=item.video_asset_id));
 perform pg_temp.english34_assert(version.snapshot::text not like'%Synthetic English introduction.%'and version.manifest::text not like'%Synthetic English introduction.%');
 begin update eps.presentation_video_english_transcripts set english_text='Changed'where version_id=version.id;raise exception'ENGLISH34_IMMUTABLE_UPDATE_ACCEPTED';
 exception when raise_exception then if sqlerrm<>'IMMUTABLE_VERSION'then raise;end if;end;
 begin delete from eps.presentation_video_english_transcripts where version_id=version.id;raise exception'ENGLISH34_IMMUTABLE_DELETE_ACCEPTED';
 exception when raise_exception then if sqlerrm<>'IMMUTABLE_VERSION'then raise;end if;end;
 begin update eps.presentation_versions set english_transcript_version=null where id=version.id;raise exception'ENGLISH34_COHORT_MUTABLE';
 exception when raise_exception then if sqlerrm<>'IMMUTABLE_VERSION'then raise;end if;end;
end$$;
update eps.candidate_media set english_transcript='Later library English text.',row_version=row_version+1 where id=current_setting('eps.t28.media')::uuid;
set local role authenticated;
do $$declare data jsonb;begin
 data:=public.eps_get_version_asset(current_setting('eps.english34.frozen')::uuid,current_setting('eps.t28.video')::uuid,'video')->'transcript';
 perform pg_temp.english34_assert(data=current_setting('eps.english34.frozen_dto')::jsonb);
 data:=public.eps_get_version_asset(current_setting('eps.t28.legacy')::uuid,current_setting('eps.t28.video')::uuid,'video')->'transcript';
 perform pg_temp.english34_assert(data->'english_text'='null'and data->>'english_status'='not_captured');
end$$;
set local role eps_review_owner;
do $$begin
 begin perform eps.capture_presentation_video_english_transcripts(current_setting('eps.t28.legacy')::uuid);raise exception'ENGLISH34_READY_BACKFILL_ALLOWED';
 exception when raise_exception then if sqlerrm<>'IMMUTABLE_VERSION'then raise;end if;end;
 begin perform eps.presentation_video_english_transcript(current_setting('eps.english34.frozen')::uuid,gen_random_uuid());raise exception'ENGLISH34_FOREIGN_VIDEO_ACCEPTED';
 exception when raise_exception then if sqlerrm<>'RESOURCE_NOT_FOUND'then raise;end if;end;
end$$;
set local role postgres;
select'ENGLISH34_FUTURE_CAPTURE_LEGACY_REPLAY_IMMUTABLE_FIXED_VERSION_PASSED_SYNTHETIC_ONLY';
