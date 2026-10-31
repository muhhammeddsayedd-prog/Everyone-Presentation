-- After guarded standard M04/M05 + m06-transcript28-legacy synthetic setup,
-- before applying34, in the same transaction. Original29 is never this target.
set local role postgres;
do $$begin
 if current_database()!~'^eps_english34_[a-f0-9]{32}$'
 or current_database()<>'eps_english34_'||current_setting('eps.english34_test_run',true)
 or not exists(select 1 from pg_database where datname=current_database()
  and oid::text=current_setting('eps.english34_test_oid',true)and datdba='postgres'::regrole
  and shobj_description(oid,'pg_database')='eps-english34-owned:'||current_setting('eps.english34_test_run',true))
 then raise exception'ENGLISH34_OWNED_SYNTHETIC_DATABASE_REQUIRED';end if;
 if to_regclass('eps.presentation_video_english_transcripts')is not null
 then raise exception'ENGLISH34_PREIMAGE_ALREADY_CHANGED';end if;
 perform set_config('eps.english34.old_versions',(select coalesce(jsonb_object_agg(v.id::text,eps.presentation_hash(to_jsonb(v))),'{}'::jsonb)from eps.presentation_versions v)::text,true);
 perform set_config('eps.english34.old_raw',(select coalesce(jsonb_object_agg(t.version_id::text||'/'||t.video_asset_id,eps.presentation_hash(to_jsonb(t))),'{}'::jsonb)from eps.presentation_video_transcripts t)::text,true);
end$$;
