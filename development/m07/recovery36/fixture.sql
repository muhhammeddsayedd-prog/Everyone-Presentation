-- Synthetic METADATA ONLY: no video bytes, provider output or Ready PDF exists.
-- Caller prefixes owned database/OID/marker + actual34-36 and actor/Auth fixtures.
set local role postgres;
update eps.candidate_asset_config set english_transcript_version='1.0'where id;
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,duration_ms,status)
values('8a9f0000-0000-4000-8000-000000000001',current_setting('eps.casting.fixture.workspace')::uuid,'candidate_video','synthetic-metadata-only.mp4','video/mp4','eps-candidate-assets','recovery36/synthetic-metadata-only.mp4',1,repeat('a',64),160,90,2000,'ready');
insert into eps.candidate_media(id,candidate_id,source_asset_id,original_transcript,languages,
 english_transcript,english_transcript_status,english_transcript_source_sha256,english_transcript_input_hash,english_transcript_metadata)
values('8a9f0000-0000-4000-8000-000000000002','8a5a0000-0000-4000-8000-000000000001','8a9f0000-0000-4000-8000-000000000001','Authored synthetic original.',array['en'],
 'Authored synthetic English.','available',encode(sha256(convert_to('Authored synthetic original.','UTF8')),'hex'),repeat('e',64),'[{"fixture":"synthetic-metadata-only; no provider"}]');
update eps.workspace_candidates set selected_candidate_media_id='8a9f0000-0000-4000-8000-000000000002',selected_frame_asset_ids='{}',media_confirmed=true
where id=current_setting('eps.casting.fixture.pool')::uuid;
-- Existing fixture layout measurement is deliberately replaced by a current
-- synthetic measurement after changing media; no native layout is claimed.
do $$declare r jsonb;j uuid:=gen_random_uuid();begin
 r:=eps.review_snapshot_data(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.m05.selection')::uuid,null);
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id,status)
 values(j,current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.casting.fixture.actor')::uuid,'review_fit',current_setting('eps.m05.selection')::uuid,'{}',repeat('f',64),'eps.review-job-input.pg-jsonb.v1',eps.presentation_hash(to_jsonb(j)),'measure_review_fit','recovery36-synthetic-layout','succeeded');
 insert into eps.review_fit_results(job_id,workspace_id,series_id,input_fingerprint,status,result)
 values(j,current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.m05.selection')::uuid,r->>'input_fingerprint','measured','{"overflows":[],"measured_at":"2026-11-01T00:00:00.000000Z"}');
end$$;
set local role authenticated;
do $$declare r jsonb;a jsonb;begin
 r:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.m05.selection')::uuid,null);
 a:=public.eps_generate_version(current_setting('eps.m05.selection')::uuid,jsonb_build_object('expected_workspace_row_version',public.eps_get_workspace(current_setting('eps.casting.fixture.workspace')::uuid)->'row_version','expected_draft_revision',r->'draft_revision','expected_input_fingerprint',r->'input_fingerprint'),'recovery36-metadata-generate');
 perform set_config('eps.recovery36.ack',a::text,true);
end$$;
set local role postgres;
select set_config('eps.recovery36.hash',(select input_hash from eps.jobs where id=(current_setting('eps.recovery36.ack')::jsonb->>'job_id')::uuid),true);
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare lease jsonb;event jsonb;ack jsonb;begin
 lease:=eps.claim_job_stage_replay(jsonb_build_object('job_id',current_setting('eps.recovery36.ack')::jsonb->'job_id','stage','prepare_presentation','input_hash',current_setting('eps.recovery36.hash'),'workflow_execution_id','synthetic-recovery36-prepare'),'recovery36-claim-prepare','synthetic-key',repeat('a',64));
 event:=jsonb_build_object('job_id',current_setting('eps.recovery36.ack')::jsonb->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage','prepare_presentation','input_hash',current_setting('eps.recovery36.hash'),'event_id','recovery36-heartbeat','sequence',1,'event_type','heartbeat');
 ack:=eps.record_job_event(event);
 if ack->'applied' is distinct from 'true'::jsonb or ack->'stale' is distinct from 'false'::jsonb then raise exception'RECOVERY36_REAL_CLAIM_EVENT_REQUIRED';end if;
 perform set_config('eps.recovery36.lease',lease::text,true);
end$$;
set local role eps_jobs_dispatcher;
select set_config('eps.recovery36.outbox',eps.claim_job_outbox(25)::text,true);
set local role postgres;
do $$declare v uuid:=(current_setting('eps.recovery36.ack')::jsonb->>'resource_id')::uuid;begin
 if (select english_transcript_version from eps.presentation_versions where id=v)is distinct from '1.0'
 or(select status from eps.presentation_versions where id=v)is distinct from 'rendering'
 or(select count(*)from eps.presentation_video_english_transcripts where version_id=v)<>1
 or(select count(*)from eps.job_stage_attempts where job_id=(current_setting('eps.recovery36.ack')::jsonb->>'job_id')::uuid)<>1
 then raise exception'RECOVERY36_POPULATED_CAPTURE_REQUIRED';end if;
end$$;
-- This result stays in the protected local SQL port, never public receipts.
select jsonb_build_object('fixture',jsonb_build_object('ack',current_setting('eps.recovery36.ack')::jsonb,'hash',current_setting('eps.recovery36.hash'),'lease',current_setting('eps.recovery36.lease')::jsonb,'outbox',current_setting('eps.recovery36.outbox')::jsonb));
