-- Synthetic metadata-only common fixture, inside a parent rollback/savepoint.
-- This creates no real bytes, images, speech, provider usage or cloud acceptance.
set local role postgres;
do $$ begin
 if exists(select 1 from auth.users where id::text like '7f1f0000-%')
   or exists(select 1 from public.projects where id::text like '7f0f0000-%')
 then raise exception 'M03_FRAME_FIXTURE_PREFIX_ALREADY_PRESENT';end if;
end $$;
insert into auth.users(id,is_anonymous,deleted_at,banned_until) values('7f1f0000-0000-4000-8000-000000000001',false,null,null);
insert into public.app_capability_grants(principal_id,capability)
 select '7f1f0000-0000-4000-8000-000000000001'::uuid,value from unnest(array['cast.read','cast.upload','operations.retry']) value;
insert into public.projects(id,name) values('7f0f0000-0000-4000-8000-000000000001','Synthetic original frame project'),
 ('7f0f0000-0000-4000-8000-000000000002','Synthetic independent pinned project');
insert into eps.workspaces(id,project_id) values('7f2f0000-0000-4000-8000-000000000001','7f0f0000-0000-4000-8000-000000000001'),
 ('7f2f0000-0000-4000-8000-000000000002','7f0f0000-0000-4000-8000-000000000002');
-- Deliberately no project membership for this global library requester.
insert into eps.candidates(id,facts,casting_id,source_kind,created_by) values('7f3f0000-0000-4000-8000-000000000001',
 '{"name":"Synthetic frame profile","casting_id":"EPS-SYNTHETIC-FRAME","age_or_range":null,"stated_gender":null,"height_measurements":null,"languages":[],"accents":[],"skills_experience":null,"city":null,"previous_projects_roles":null,"classification":null}',
 'EPS-SYNTHETIC-FRAME','manual','7f1f0000-0000-4000-8000-000000000001');
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,status,width,height,duration_ms)
 values('7f4f0000-0000-4000-8000-000000000001','7f2f0000-0000-4000-8000-000000000001','candidate_video','synthetic-frame-source.mp4','video/mp4','eps-candidate-assets',
 'assets/7f4f0000-0000-4000-8000-000000000001/original.mp4',1000,repeat('a',64),'ready',640,480,5000);
insert into eps.jobs(id,workspace_id,requested_by,kind,status,stage,resource_id,input_asset_id,input,input_hash,input_hash_version,dedupe_key,correlation_id)
 values('7f6f0000-0000-4000-8000-000000000001','7f2f0000-0000-4000-8000-000000000001','7f1f0000-0000-4000-8000-000000000001','candidate_scan','succeeded','apply_candidate',
 '7f9f0000-0000-4000-8000-000000000001','7f4f0000-0000-4000-8000-000000000001',
 '{"synthetic_historical_metadata_fixture":true}',repeat('d',64),'eps.candidate-input.pg-jsonb.v1',repeat('d',64),'synthetic-existing-frame-lineage');
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,status,width,height,source_asset_id,source_timestamp_ms,producing_job_id,producing_attempt_id,output_stage,output_key)
 values('7f4f0000-0000-4000-8000-000000000002','7f2f0000-0000-4000-8000-000000000001','candidate_frame','synthetic-existing.jpg','image/jpeg','eps-candidate-outputs',
 'jobs/7f6f0000-0000-4000-8000-000000000001/attempts/7f8f0000-0000-4000-8000-000000000001/7f4f0000-0000-4000-8000-000000000002.jpg',1000,repeat('b',64),'ready',320,240,'7f4f0000-0000-4000-8000-000000000001',500,
 '7f6f0000-0000-4000-8000-000000000001','7f8f0000-0000-4000-8000-000000000001','prepare_candidate','frame_0');
insert into eps.candidate_media(id,candidate_id,source_asset_id,selected_frame_asset_ids)
 values('7f5f0000-0000-4000-8000-000000000001','7f3f0000-0000-4000-8000-000000000001','7f4f0000-0000-4000-8000-000000000001',array['7f4f0000-0000-4000-8000-000000000002'::uuid]);
insert into eps.candidate_media_frames(candidate_media_id,asset_id) values('7f5f0000-0000-4000-8000-000000000001','7f4f0000-0000-4000-8000-000000000002');
insert into eps.workspace_candidates(id,workspace_id,candidate_id,selected_candidate_media_id,selected_frame_asset_ids,availability)
 values('7f7f0000-0000-4000-8000-000000000001','7f2f0000-0000-4000-8000-000000000001','7f3f0000-0000-4000-8000-000000000001','7f5f0000-0000-4000-8000-000000000001',array['7f4f0000-0000-4000-8000-000000000002'::uuid],'Synthetic first-project availability'),
 ('7f7f0000-0000-4000-8000-000000000002','7f2f0000-0000-4000-8000-000000000002','7f3f0000-0000-4000-8000-000000000001','7f5f0000-0000-4000-8000-000000000001',array['7f4f0000-0000-4000-8000-000000000002'::uuid],'Synthetic second-project availability');
update eps.frame_extraction_config set enabled=true,native_image_id='sha256:'||repeat('e',64) where id;
select set_config('eps.frame.fixture.principal','7f1f0000-0000-4000-8000-000000000001',true);
select set_config('eps.frame.fixture.source','7f4f0000-0000-4000-8000-000000000001',true);
select set_config('eps.frame.fixture.media','7f5f0000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.sub',current_setting('eps.frame.fixture.principal'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.frame.fixture.principal'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('eps.frame.fixture.job',(public.eps_extract_candidate_frames(current_setting('eps.frame.fixture.media')::uuid,
 jsonb_build_object('source_asset_id',current_setting('eps.frame.fixture.source'),'timestamps_ms','[1000,4500]'::jsonb),'synthetic-frame-fixture-enqueue')->>'job_id'),true);
set local role postgres;
