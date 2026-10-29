-- Additional SQL-only synthetic behavior. Derivative rows below are metadata
-- fixtures, never claimed as real JPEG/audio/provider output. Parent rolls back.
insert into public.app_capability_grants(principal_id,capability) select '7aae0000-0000-4000-8000-000000000001'::uuid,c from unnest(array['cast.write','cast.review','operations.retry']) c;
create function pg_temp.new_candidate_upload(label text,target uuid default null) returns jsonb language plpgsql as $$
declare input jsonb;reservation jsonb;completed jsonb;begin
 input:=jsonb_build_object('workspace_id','7cae0000-0000-4000-8000-000000000001','purpose','candidate_video','filename',label||'.mp4','mime_type','video/mp4','size_bytes',1000,'sha256',repeat('a',64));
 if target is not null then input:=input||jsonb_build_object('candidate_id',target);end if;
 execute 'set local role authenticated';reservation:=public.eps_reserve_candidate_upload(input,'behavior-reserve-'||label);
 completed:=public.eps_complete_candidate_upload((reservation->>'upload_id')::uuid,'{"actual_size_bytes":1000,"start_processing":true}','behavior-complete-'||label);
 execute 'set local role postgres';
 perform set_config('eps.kernel.job',completed->>'processing_job_id',true);perform set_config('eps.kernel.asset',reservation#>>'{asset,id}',true);
 return jsonb_build_object('job_id',completed->'processing_job_id','asset_id',reservation#>'{asset,id}');
end $$;
create function pg_temp.candidate_output(lease jsonb,kind text,output_name text,timestamp_ms bigint default null) returns jsonb language plpgsql as $$
declare reserved jsonb;completed jsonb;source uuid;begin
 select input_asset_id into source from eps.jobs where id=(lease->>'job_id')::uuid;
 reserved:=eps.reserve_job_output(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token',
  'asset_kind',kind,'output_key',output_name,'filename',output_name||case kind when 'audio' then '.mp3' when 'candidate_frame' then '.jpg' else '.json' end,
  'mime_type',case kind when 'audio' then 'audio/mpeg' when 'candidate_frame' then 'image/jpeg' else 'application/json' end,'expected_size_bytes',1000,'parent_asset_id',source,'time_offset_ms',timestamp_ms));
 completed:=eps.complete_job_output(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',reserved#>'{asset,id}',
  'sha256',case when kind='candidate_frame' then md5(output_name)||md5(output_name) else repeat(case kind when 'audio' then 'b' else 'd' end,64) end,'actual_size_bytes',1000,
  'width',case when kind='candidate_frame' then 320 end,'height',case when kind='candidate_frame' then 240 end,'duration_ms',case when kind='audio' then 1000 end));
 return jsonb_build_object('asset_id',completed->'id','sha256',completed->'sha256','size_bytes',completed->'size_bytes','mime_type',completed->'mime_type');
end $$;
create function pg_temp.candidate_prepare(lease jsonb,has_audio boolean,has_frame boolean) returns jsonb language plpgsql as $$
declare source uuid;audio jsonb:='[]';frames jsonb:='[]';ref jsonb;frame_index integer;timestamp_value bigint;begin
 select input_asset_id into source from eps.jobs where id=(lease->>'job_id')::uuid;
 if has_audio then ref:=pg_temp.candidate_output(lease,'audio','audio_0');audio:=jsonb_build_array(ref||jsonb_build_object('index',0,'start_ms',0,'end_ms',1000));end if;
 if has_frame then for frame_index in 0..2 loop timestamp_value:=200+frame_index*300;ref:=pg_temp.candidate_output(lease,'candidate_frame','frame_'||frame_index,timestamp_value);
  frames:=frames||jsonb_build_array(jsonb_build_object('frame_asset_id',ref->'asset_id','source_asset_id',source,'timestamp_ms',timestamp_value,'width',320,'height',240,'sha256',ref->'sha256','quality_flags','[]'::jsonb,
   'quality',jsonb_build_object('difference_hash',substr(md5(frame_index::text),1,16),'luminance',128,'contrast',42,'sharpness',77)));
 end loop;
 end if;
 return jsonb_build_object('source_asset_id',source,'source_sha256',repeat('a',64),'probe',jsonb_build_object('duration_ms',1000,'width',640,'height',480,'rotation_degrees',0,'frame_rate',25,'video_codec','h264','audio_codec',case when has_audio then 'aac' end,'has_audio',has_audio,'container','mp4','source_start_ms',0),
  'audio_chunks',audio,'sampled_frames',frames,'warnings',case when has_audio then '[]'::jsonb else '["NO_AUDIO"]'::jsonb end,'implementation_version','video-preparation.v1','ffmpeg_version','synthetic-sql-metadata-fixture');
end $$;
create function pg_temp.silent_to_apply() returns jsonb language plpgsql as $$
declare lease jsonb;source uuid:=current_setting('eps.kernel.asset')::uuid;receipt jsonb;begin
 lease:=pg_temp.kernel_claim();receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',pg_temp.candidate_prepare(lease,false,false),'media-preparation.v1'));perform pg_temp.kernel_assert(receipt->>'job_status'='queued','silent prepare');
 lease:=pg_temp.kernel_claim();receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('source_asset_id',source,'transcript_asset',null,'original_transcript',null,'languages','[]'::jsonb,'segment_count',0,'timestamp_precision','chunk','missing_transcript_reason','NO_INTELLIGIBLE_AUDIO','provider_metadata','[]'::jsonb),'candidate-transcript-stage.v1'));perform pg_temp.kernel_assert(receipt->>'job_status'='queued','silent transcribe');
 lease:=pg_temp.kernel_claim();receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('source_asset_id',source,'result',null,'manual_profile_required',true,'provider_metadata',null),'candidate-extraction-stage.v1'));perform pg_temp.kernel_assert(receipt->>'job_status'='queued','silent extract');
 lease:=pg_temp.kernel_claim();receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('schema_version','1.0','source_asset_id',source,'selected_frames','[]'::jsonb,'insufficient_frames_reason','NO_USABLE_REAL_FRAMES'),'frame-selection-stage.v1'));perform pg_temp.kernel_assert(receipt->>'job_status'='queued','silent selection');
 return pg_temp.kernel_claim();
end $$;

do $$
#variable_conflict use_column
declare created jsonb;lease jsonb;prepared jsonb;transcript jsonb;extraction jsonb;ref jsonb;receipt jsonb;source uuid;frame_ids uuid[];facts jsonb;evidence jsonb;field text;segment jsonb;count_before bigint;applied jsonb;begin
 created:=pg_temp.new_candidate_upload('grounded');source:=(created->>'asset_id')::uuid;
 lease:=pg_temp.kernel_claim();prepared:=pg_temp.candidate_prepare(lease,true,true);select array_agg((value->>'frame_asset_id')::uuid order by ordinal) into frame_ids from jsonb_array_elements(prepared->'sampled_frames') with ordinality item(value,ordinal);
 receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',prepared,'media-preparation.v1'));perform pg_temp.kernel_assert(receipt->>'job_status'='queued','grounded prepare');
 lease:=pg_temp.kernel_claim();ref:=pg_temp.candidate_output(lease,'transcript','transcript');
 segment:=jsonb_build_object('index',0,'start_ms',0,'end_ms',1000,'text','أنا اسمي Synthetic Intro. I am 34. I live in Cairo. I speak Arabic.');
 transcript:=jsonb_build_object('source_asset_id',source,'original_text',segment->'text','segments',jsonb_build_array(segment),'languages','["ar","en"]'::jsonb,'timestamp_precision','chunk');
 receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('source_asset_id',source,'transcript_asset',ref,'original_transcript',transcript,'languages','["ar","en"]'::jsonb,'segment_count',1,'timestamp_precision','chunk','missing_transcript_reason',null,'provider_metadata','[]'::jsonb),'candidate-transcript-stage.v1'));perform pg_temp.kernel_assert(receipt->>'job_status'='queued','grounded transcript');
 facts:='{"name":"Synthetic Intro","casting_id":null,"age_or_range":"34","stated_gender":null,"height_measurements":null,"languages":["Arabic"],"accents":[],"skills_experience":null,"city":"Cairo","previous_projects_roles":null,"classification":null}'::jsonb;evidence:='[]';
 foreach field in array array['name','age_or_range','languages','city'] loop evidence:=evidence||jsonb_build_array(jsonb_build_object('field_path','facts.'||field,'source',jsonb_build_object('asset_id',source,'page',null,'paragraph',null,'segment_index',0,'start_ms',0,'end_ms',1000,'quote',case field when 'name' then 'Synthetic Intro' when 'age_or_range' then 'I am 34.' when 'languages' then 'I speak Arabic.' else 'I live in Cairo.' end)));end loop;
 extraction:=jsonb_build_object('schema_version','1.0','source_asset_id',source,'facts',facts,'project_availability_statement',null,'evidence',evidence,'uncertainties','[]'::jsonb);
 lease:=pg_temp.kernel_claim();receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('source_asset_id',source,'result',extraction,'metadata',jsonb_build_object('provider','openai','sdk_version','7.45.1','requested_model','synthetic-extraction-model','input_sha256',lease#>'{input,input_hash}')),'candidate-extraction-stage.v1'));perform pg_temp.kernel_assert(receipt->>'job_status'='queued','grounded extraction staged privately');
 lease:=pg_temp.kernel_claim();receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('schema_version','1.0','source_asset_id',source,'selected_frames',(select jsonb_agg(jsonb_build_object('frame_asset_id',frame_id,'reason','Synthetic registered source frame') order by ordinal) from unnest(frame_ids) with ordinality item(frame_id,ordinal)),'insufficient_frames_reason',null),'frame-selection-stage.v1'));perform pg_temp.kernel_assert(receipt->>'job_status'='queued','three registered frames selected in order');
 lease:=pg_temp.kernel_claim();select count(*) into count_before from eps.candidates;
 begin
  update eps.candidate_stage_payloads set payload=jsonb_set(payload,'{result,evidence,0,source,quote}','"UNSUPPORTED CLAIM"') where job_id=(lease->>'job_id')::uuid and stage='extract_candidate';
  perform eps.apply_candidate_scan((lease->>'job_id')::uuid,(lease->>'attempt_id')::uuid,lease->>'lease_token',lease#>>'{input,input_hash}',jsonb_build_object('source_asset_id',source));
  raise exception 'EXPECTED_UNGROUNDED_FACT_DENIAL';
 exception when raise_exception then if sqlerrm<>'RESULT_INVALID' then raise;end if;end;
 perform pg_temp.kernel_assert((select count(*)=count_before from eps.candidates),'invalid evidence creates no profile');
 receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('source_asset_id',source),'candidate-application.v1'));perform pg_temp.kernel_assert(receipt->>'job_status'='succeeded','grounded application');
 select result into applied from eps.jobs where id=(lease->>'job_id')::uuid;perform set_config('eps.behavior.candidate',applied->>'candidate_id',true);perform set_config('eps.behavior.media',applied->>'candidate_media_id',true);perform set_config('eps.behavior.pool',applied->>'workspace_candidate_id',true);
 perform pg_temp.kernel_assert((select candidate_id=(applied->>'candidate_id')::uuid and selected_candidate_media_id=(applied->>'candidate_media_id')::uuid from eps.workspace_candidates where id=(applied->>'workspace_candidate_id')::uuid),'application returns this candidate own project participation, not another pool row');
 perform pg_temp.kernel_assert((select facts->>'name'='Synthetic Intro' and facts->>'city'='Cairo' and facts->>'age_or_range'='34' and age_as_of is null and facts->'height_measurements'='null' and reviewed_at is null from eps.candidates where id=(applied->>'candidate_id')::uuid),'supplied age retained, recording age date/height remain unknown, Unreviewed');
 perform pg_temp.kernel_assert((select original_transcript=transcript->>'original_text' and selected_frame_asset_ids=frame_ids from eps.candidate_media where id=(applied->>'candidate_media_id')::uuid),'Arabic original transcript and chosen frame order preserved');
 perform pg_temp.kernel_assert((select count(*)=3 and count(distinct a.sha256)=3 from eps.candidate_media_frames f join eps.media_assets a on a.id=f.asset_id where f.candidate_media_id=(applied->>'candidate_media_id')::uuid and a.source_asset_id=source and a.source_timestamp_ms in(200,500,800) and a.width=320 and a.height=240),'three distinct registered source/timestamp/aspect metadata records preserved');
end $$;
select 'CANDIDATE_GROUNDED_TRANSCRIPT_FRAME_AND_EVIDENCE_GUARD_PASSED';

do $$
#variable_conflict use_column
declare candidate uuid:=current_setting('eps.behavior.candidate')::uuid;created jsonb;lease jsonb;receipt jsonb;facts jsonb;reviewed jsonb;chosen uuid:=current_setting('eps.behavior.media')::uuid;begin
 execute 'set local role authenticated';reviewed:=public.eps_confirm_candidate_reviewed(candidate,'{"row_version":1}','behavior-confirm-initial');execute 'set local role postgres';
 created:=pg_temp.new_candidate_upload('manual-guard',candidate);lease:=pg_temp.silent_to_apply();
 execute 'set local role authenticated';facts:=public.eps_get_candidate(candidate)->'facts';facts:=jsonb_set(facts,'{city}','"Alexandria"');
 perform public.eps_update_candidate(candidate,jsonb_build_object('row_version',2,'facts',facts),'behavior-manual-correction');
 reviewed:=public.eps_confirm_candidate_reviewed(candidate,'{"row_version":3}','behavior-confirm-correction');execute 'set local role postgres';
 receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('source_asset_id',created->'asset_id'),'candidate-application.v1'));
 perform pg_temp.kernel_assert(receipt->>'job_status'='waiting_for_input','manual edit/review protects target from late callback');
 perform pg_temp.kernel_assert((select facts->>'city'='Alexandria' and row_version=4 and reviewed_facts_fingerprint=eps.cast_fingerprint(facts,field_sources) from eps.candidates where id=candidate),'confirmed correction and review fingerprint retained');
 perform pg_temp.kernel_assert((select count(*)=1 from eps.candidate_media where candidate_id=candidate),'guarded callback attaches no new media');
 created:=pg_temp.new_candidate_upload('append-existing',candidate);lease:=pg_temp.silent_to_apply();
 receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('source_asset_id',created->'asset_id'),'candidate-application.v1'));
 perform pg_temp.kernel_assert(receipt->>'job_status'='succeeded','fresh media can append to explicitly existing target');
 perform pg_temp.kernel_assert((select count(*)=2 from eps.candidate_media where candidate_id=candidate),'one additional media, no profile duplicate');
 perform pg_temp.kernel_assert((select facts->>'city'='Alexandria' and row_version=4 and reviewed_facts_fingerprint=eps.cast_fingerprint(facts,field_sources) from eps.candidates where id=candidate),'append never overwrites confirmed facts');
 perform pg_temp.kernel_assert((select selected_candidate_media_id=chosen from eps.workspace_candidates where id=current_setting('eps.behavior.pool')::uuid),'new media does not replace project chosen recording');
end $$;
select 'CANDIDATE_MANUAL_GUARD_AND_EXISTING_MEDIA_PINNING_PASSED';

do $$declare created jsonb;oldlease jsonb;newlease jsonb;event jsonb;receipt jsonb;version bigint;before_count bigint;begin
 created:=pg_temp.new_candidate_upload('lease-recovery');oldlease:=pg_temp.kernel_claim();select count(*) into before_count from eps.candidates;
 update eps.jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=(created->>'job_id')::uuid;
 event:=pg_temp.kernel_event(oldlease,'heartbeat');receipt:=eps.record_job_event(event);perform pg_temp.kernel_assert(receipt->'stale'='true' and receipt->'applied'='false','expired callback inert');
 perform pg_temp.kernel_assert((eps.recover_job_stages(100)->>'recovered')::integer=1,'one expired candidate lease recovered');
 update eps.jobs set available_at=clock_timestamp() where id=(created->>'job_id')::uuid;newlease:=pg_temp.kernel_claim();
 perform pg_temp.kernel_assert(newlease->>'attempt_id'<>oldlease->>'attempt_id' and newlease->>'lease_token'<>oldlease->>'lease_token','recovery fences previous attempt');
 receipt:=eps.record_job_event(pg_temp.kernel_event(oldlease,'heartbeat'));perform pg_temp.kernel_assert(receipt->'stale'='true' and receipt->'applied'='false','old attempt still inert after reclaim');
 select row_version into version from eps.jobs where id=(created->>'job_id')::uuid;
 execute 'set local role authenticated';perform public.eps_cancel_job((created->>'job_id')::uuid,jsonb_build_object('row_version',version),'behavior-cancel-current-job');execute 'set local role postgres';
 receipt:=eps.record_job_event(pg_temp.kernel_event(newlease,'heartbeat'));perform pg_temp.kernel_assert(receipt->'stale'='true' and receipt->'applied'='false' and receipt->>'job_status'='cancelled','cancel prevents delayed completion');
 perform pg_temp.kernel_assert((select count(*)=before_count from eps.candidates),'cancel/recovery never fabricates profile');
end $$;
set local role anon;
select pg_temp.kernel_expect('select public.eps_search_candidates(''{}'')','42501');
select pg_temp.kernel_expect('select eps.claim_job_stage(''{}'')','42501');
set local role postgres;
select 'CANDIDATE_EXPIRED_RECOVERY_STALE_CANCEL_AND_GUEST_PASSED';
