-- Persistent synthetic seed for the cycle-7 integrated local check (disposable replica only).
-- Two producers, one project/workspace, library people with archive photos (one photo-only), and a
-- worker simulator that drives the real record_job_event stage path with controlled provider results.
set search_path='';
alter table auth.users add column if not exists is_anonymous boolean not null default false,add column if not exists deleted_at timestamptz,add column if not exists banned_until timestamptz;
grant usage on schema extensions to eps_candidate_stage_owner,eps_candidate_assets_owner,eps_jobs_owner;

insert into auth.users(id,instance_id,aud,role,email) values
 ('c7000000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','producer-a@example.invalid'),
 ('c7000000-0000-4000-8000-0000000000a2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','producer-b@example.invalid')
 on conflict do nothing;
insert into public.app_capability_grants(principal_id,capability)
 select principal,capability from unnest(array['c7000000-0000-4000-8000-0000000000a1','c7000000-0000-4000-8000-0000000000a2']::uuid[]) principal,
 unnest(array['projects.read','projects.write','workspaces.read','workspaces.write','cast.read','cast.upload','cast.write','cast.review','presentations.generate','review_links.manage','settings.manage','operations.read','operations.retry']) capability
 on conflict do nothing;
insert into public.projects(id,name) values('c7000000-0000-4000-8000-00000000c001','Cycle 7 integrated project') on conflict do nothing;
insert into public.project_memberships(project_id,principal_id,can_write) values
 ('c7000000-0000-4000-8000-00000000c001','c7000000-0000-4000-8000-0000000000a1',true),
 ('c7000000-0000-4000-8000-00000000c001','c7000000-0000-4000-8000-0000000000a2',true) on conflict do nothing;
insert into eps.workspaces(id,project_id) values('c7000000-0000-4000-8000-00000000d001','c7000000-0000-4000-8000-00000000c001') on conflict do nothing;
insert into eps.candidate_asset_config(id,enabled,transcription_model,extraction_model) values(true,true,'synthetic-transcription-model','synthetic-extraction-model')
 on conflict (id) do update set enabled=true,transcription_model=excluded.transcription_model,extraction_model=excluded.extraction_model,english_transcript_version=null;

-- Library: 30 manual people with spaced creation times (ordering), two pairs with identical timestamps,
-- and archive people with photos (c7..f001 has photos only, no tape).
set session_replication_role=replica;
insert into eps.candidates(id,casting_id,facts,source_kind,created_by,created_at,updated_at)
select ('c7000000-0000-4000-8000-0000000'||lpad(n::text,5,'0'))::uuid,'EPS-C7-'||n,
 jsonb_build_object('name','Synthetic Person '||n,'casting_id','EPS-C7-'||n,'age_or_range',null,'stated_gender',case when n%2=0 then 'Female' else 'Male' end,'height_measurements',null,
  'languages','["English"]'::jsonb,'accents','[]'::jsonb,'skills_experience',null,'city',case when n%3=0 then 'Cairo' else 'Riyadh' end,'previous_projects_roles',null,'classification',null),
 'manual','c7000000-0000-4000-8000-0000000000a1',
 timestamptz '2026-11-01 00:00:00+00' + make_interval(mins=>case when n in (11,12) then 110 when n in (21,22) then 210 else n*10 end),
 timestamptz '2026-11-01 00:00:00+00' + make_interval(mins=>n*10)
from generate_series(1,30) n on conflict do nothing;
insert into eps.candidates(id,casting_id,facts,source_kind,created_by,created_at,updated_at)
values ('c7000000-0000-4000-8000-00000000f001','EPS-C7-PHOTO','{"name":"Photo Only Person","casting_id":"EPS-C7-PHOTO","age_or_range":null,"stated_gender":"Female","height_measurements":null,"languages":[],"accents":[],"skills_experience":null,"city":"Cairo","previous_projects_roles":null,"classification":null}','archive','c7000000-0000-4000-8000-0000000000a1','2026-11-02 00:00:00+00','2026-11-02 00:00:00+00')
on conflict do nothing;
insert into eps.media_assets(id,purpose,filename,bucket,object_key,mime_type,size_bytes,sha256,width,height,status,origin_workspace_id) values
 ('c7000000-0000-4000-8000-00000000e001','candidate_photo','p1.jpg','eps-candidate-photos','archive/c7/p1.jpg','image/jpeg',1000,repeat('b',64),800,1000,'ready','c7000000-0000-4000-8000-00000000d001'),
 ('c7000000-0000-4000-8000-00000000e002','candidate_photo','p1-thumb.jpg','eps-candidate-photos','archive/c7/p1t.jpg','image/jpeg',500,repeat('c',64),200,250,'ready','c7000000-0000-4000-8000-00000000d001'),
 ('c7000000-0000-4000-8000-00000000e003','candidate_photo','p2.jpg','eps-candidate-photos','archive/c7/p2.jpg','image/jpeg',1000,repeat('d',64),800,1000,'ready','c7000000-0000-4000-8000-00000000d001'),
 ('c7000000-0000-4000-8000-00000000e004','candidate_photo','p2-thumb.jpg','eps-candidate-photos','archive/c7/p2t.jpg','image/jpeg',500,repeat('e',64),200,250,'ready','c7000000-0000-4000-8000-00000000d001')
 on conflict do nothing;
insert into eps.candidate_photos(id,candidate_id,position,asset_id,thumb_asset_id,width,height,source_key) values
 ('c7000000-0000-4000-8000-00000000b001','c7000000-0000-4000-8000-00000000f001',1,'c7000000-0000-4000-8000-00000000e001','c7000000-0000-4000-8000-00000000e002',800,1000,'c7/1'),
 ('c7000000-0000-4000-8000-00000000b002','c7000000-0000-4000-8000-00000000f001',2,'c7000000-0000-4000-8000-00000000e003','c7000000-0000-4000-8000-00000000e004',800,1000,'c7/2')
 on conflict do nothing;
insert into eps.candidate_attributes(candidate_id,cover_photo_id,name_ar,talent_type) values('c7000000-0000-4000-8000-00000000f001','c7000000-0000-4000-8000-00000000b002','شخص بالصور فقط','talent') on conflict do nothing;
set session_replication_role=origin;

-- Worker simulator (supabase_admin only). Drives prepare -> transcribe -> extract -> select_frames -> apply through
-- eps.record_job_event exactly as the worker does, with a controlled "silent video, manual profile" provider result.
create schema if not exists c7sim;
revoke all on schema c7sim from public;
create or replace function c7sim.claim(job uuid) returns jsonb language plpgsql as $$declare item eps.jobs;begin
 -- Simulated time: a queued retry's backoff has elapsed.
 update eps.jobs set available_at=clock_timestamp() where id=job and status='queued' and available_at>clock_timestamp();
 select * into strict item from eps.jobs where id=job;
 return eps.claim_job_stage(jsonb_build_object('job_id',item.id,'stage',item.stage,'input_hash',item.input_hash));
end $$;
create or replace function c7sim.event(lease jsonb,payload jsonb,schema_name text,kind text default 'succeeded') returns jsonb language sql as $$
 select jsonb_build_object('event_id',gen_random_uuid(),'job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token',
  'stage',lease->'stage','sequence',1,'event_type',kind,'input_hash',lease#>'{input,input_hash}','result',payload,'result_schema',schema_name)
$$;
create or replace function c7sim.stage(job uuid) returns text language sql as $$ select stage from eps.jobs where id=job $$;
-- Advance one stage (or all remaining when p_all). Returns the job status.
create or replace function c7sim.advance(job uuid, p_all boolean default true) returns text language plpgsql as $$
declare lease jsonb;receipt jsonb;asset uuid;st text;digest text;begin
 loop
  select input_asset_id,stage into asset,st from eps.jobs where id=job;
  select coalesce((select u.expected_sha256 from eps.candidate_uploads u where u.asset_id=asset),(select m.sha256 from eps.media_assets m where m.id=asset),repeat('a',64)) into digest;
  lease:=c7sim.claim(job);
  if st like 'prepare%' then receipt:=eps.record_job_event(c7sim.event(lease,jsonb_build_object('source_asset_id',asset,'source_sha256',digest,'probe',jsonb_build_object('duration_ms',1000,'width',640,'height',480,'rotation_degrees',0,'frame_rate',25,'video_codec','h264','audio_codec',null,'has_audio',false,'container','mp4','source_start_ms',0),
   'audio_chunks','[]'::jsonb,'sampled_frames','[]'::jsonb,'warnings','["NO_AUDIO"]'::jsonb,'implementation_version','video-preparation.v1','ffmpeg_version','synthetic-sql-metadata-fixture'),'media-preparation.v1'));
  elsif st like 'transcribe%' then receipt:=eps.record_job_event(c7sim.event(lease,jsonb_build_object('source_asset_id',asset,'transcript_asset',null,'original_transcript',null,'languages','[]'::jsonb,'segment_count',0,'timestamp_precision','chunk','missing_transcript_reason','NO_INTELLIGIBLE_AUDIO','provider_metadata','[]'::jsonb),'candidate-transcript-stage.v1'));
  elsif st like 'extract%' then receipt:=eps.record_job_event(c7sim.event(lease,jsonb_build_object('source_asset_id',asset,'result',null,'manual_profile_required',true,'provider_metadata',null),'candidate-extraction-stage.v1'));
  elsif st like 'select%frame%' then receipt:=eps.record_job_event(c7sim.event(lease,jsonb_build_object('schema_version','1.0','source_asset_id',asset,'selected_frames','[]'::jsonb,'insufficient_frames_reason','No real source frames were prepared; manual material selection remains available.','selection_method','no_frames','metadata',null),'frame-selection-stage.v1'));
  else receipt:=eps.record_job_event(c7sim.event(lease,jsonb_build_object('source_asset_id',asset),'candidate-application.v1'));
  end if;
  exit when not p_all or receipt->>'job_status'<>'queued';
 end loop;
 return receipt->>'job_status';
end $$;
-- Fail the current stage with a non-retryable worker error (a corrupt-file style failure the user retries).
drop function if exists c7sim.fail(uuid,text);
create or replace function c7sim.fail(job uuid, p_code text default 'SOURCE_UNREADABLE', p_retryable boolean default false) returns text language plpgsql as $$
declare lease jsonb;receipt jsonb;begin
 lease:=c7sim.claim(job);
 receipt:=eps.record_job_event(jsonb_build_object('event_id',gen_random_uuid(),'job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token',
  'stage',lease->'stage','sequence',1,'event_type','failed','input_hash',lease#>'{input,input_hash}',
  'error',jsonb_build_object('code',p_code,'message','Synthetic integrated-check failure.','details','{}'::jsonb,'retryable',p_retryable)));
 return receipt->>'job_status';
end $$;
-- Live has one Studio settings row (template 1.3.0 default before this release); the replica dump carries none.
insert into eps.app_settings(singleton,template_version) values(true,'1.3.0') on conflict do nothing;
-- Rows seeded with triggers disabled need their derived search projection (m20 backfills existing rows itself).
do $$begin if to_regprocedure('eps.refresh_candidate_projection(uuid)') is not null then
 perform eps.refresh_candidate_projection(id) from eps.candidates; end if; end$$;
