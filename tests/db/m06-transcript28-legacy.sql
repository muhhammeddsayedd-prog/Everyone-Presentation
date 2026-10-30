-- Synthetic-only setup BEFORE28: an actual Generate RPC captures an old video.
-- Ready artifact metadata below is owner-injected, not native/PDF/workflow proof.
set local role postgres;
insert into public.app_capability_grants(principal_id,capability)values(current_setting('eps.casting.fixture.actor')::uuid,'review_links.manage')on conflict do nothing;
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,duration_ms,status)
 values('8a9f0000-0000-4000-8000-000000000001',current_setting('eps.casting.fixture.workspace')::uuid,'candidate_video','synthetic-source.mp4','video/mp4','eps-candidate-assets','m06-28/synthetic-source.mp4',100,repeat('d',64),640,480,1000,'ready');
insert into eps.candidate_media(id,candidate_id,source_asset_id,original_transcript,languages)
 values('8a9f0000-0000-4000-8000-000000000002','8a5a0000-0000-4000-8000-000000000001','8a9f0000-0000-4000-8000-000000000001',
 E' PRIVATE_TRANSCRIPT_A\tline\n'||U&'\0645\0631\062D\0628\0627'||E'\r ',array['ar','AR','ar']);
update eps.workspace_candidates set selected_candidate_media_id='8a9f0000-0000-4000-8000-000000000002',selected_frame_asset_ids='{}',media_confirmed=true,internal_notes='PRIVATE_INTERNAL_NOTE_NOT_TRANSCRIPT'
 where id=current_setting('eps.casting.fixture.pool')::uuid;
do $$begin
 perform set_config('eps.t28.video','8a9f0000-0000-4000-8000-000000000001',true);
 perform set_config('eps.t28.media','8a9f0000-0000-4000-8000-000000000002',true);
end$$;
create function pg_temp.t28_measure(p_series uuid)returns void language plpgsql volatile security definer set search_path=''as $$
declare r jsonb;j uuid:=gen_random_uuid();begin
 r:=eps.review_snapshot_data(current_setting('eps.casting.fixture.workspace')::uuid,p_series,null);
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id,status)
 values(j,current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.casting.fixture.actor')::uuid,'review_fit',p_series,'{}',repeat('f',64),'eps.review-job-input.pg-jsonb.v1',eps.presentation_hash(to_jsonb(j)),'measure_review_fit','m06-transcript-synthetic-fit','succeeded');
 insert into eps.review_fit_results(job_id,workspace_id,series_id,input_fingerprint,status,result)
 values(j,current_setting('eps.casting.fixture.workspace')::uuid,p_series,r->>'input_fingerprint','measured',jsonb_build_object('overflows','[]'::jsonb,'measured_at','2026-10-30T00:00:00.000000Z'));
end$$;
create function pg_temp.t28_generate(p_key text)returns jsonb language plpgsql volatile security invoker set search_path=''as $$
declare r jsonb;body jsonb;ack jsonb;begin
 perform pg_temp.t28_measure(current_setting('eps.m05.selection')::uuid);
 r:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.m05.selection')::uuid,null);
 body:=jsonb_build_object('expected_workspace_row_version',public.eps_get_workspace(current_setting('eps.casting.fixture.workspace')::uuid)->'row_version',
  'expected_draft_revision',r->'draft_revision','expected_input_fingerprint',r->'input_fingerprint');
 ack:=public.eps_generate_version(current_setting('eps.m05.selection')::uuid,body,p_key);
 perform set_config('eps.t28.lastbody',body::text,true);return ack;
end$$;
create function pg_temp.t28_ready(p_version uuid)returns void language plpgsql volatile security definer set search_path=''as $$
declare v eps.presentation_versions;a uuid;attempt uuid:=gen_random_uuid();pdf uuid;manifest_id uuid;kind text;begin
 select * into v from eps.presentation_versions where id=p_version;
 if not found or v.status<>'queued'then raise exception'M06_TRANSCRIPT_SYNTHETIC_READY_SETUP_REQUIRED';end if;
 foreach kind in array array['presentation_manifest','presentation_pdf']loop
  a:=gen_random_uuid();
  insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,status,producing_job_id,producing_attempt_id,output_stage,output_key)
  values(a,v.workspace_id,kind,case kind when'presentation_pdf'then'synthetic.pdf'else'synthetic-manifest.json'end,
   case kind when'presentation_pdf'then'application/pdf'else'application/json'end,'eps-presentation-outputs',
   'jobs/'||v.generation_job_id||'/attempts/'||attempt||'/'||a||case kind when'presentation_pdf'then'.pdf'else'.json'end,
   100,case kind when'presentation_pdf'then repeat('b',64)else v.manifest_sha256 end,'ready',v.generation_job_id,attempt,'render_presentation',kind);
  insert into eps.presentation_version_assets(version_id,asset_id,asset_kind,bucket,object_key,mime_type,byte_size,sha256,width,height,duration_ms,source_asset_id,timestamp_ms,filename,asset_created_at)
   select v.id,id,purpose,bucket,object_key,mime_type,size_bytes,sha256,width,height,duration_ms,source_asset_id,source_timestamp_ms,filename,created_at from eps.media_assets where id=a;
  if kind='presentation_pdf'then pdf:=a;else manifest_id:=a;end if;
 end loop;
 update eps.presentation_versions set status='ready',pdf_asset_id=pdf,manifest_asset_id=manifest_id,ready_at=clock_timestamp()where id=v.id;
 update eps.jobs set status='succeeded'where id=v.generation_job_id;
 update eps.presentation_series set latest_ready_version_id=v.id,latest_ready_version_no=v.version_number where id=v.series_id;
end$$;
set local role authenticated;
do $$declare ack jsonb;begin
 ack:=pg_temp.t28_generate('m06-transcript-legacy-original');
 perform set_config('eps.t28.legacy',ack->>'resource_id',true);
 perform set_config('eps.t28.legacy_ack',ack::text,true);
 perform set_config('eps.t28.legacy_body',current_setting('eps.t28.lastbody'),true);
 perform pg_temp.t28_ready((ack->>'resource_id')::uuid);
end$$;
set local role postgres;
do $$begin
 perform set_config('eps.t28.old_versions',(select coalesce(jsonb_object_agg(v.id::text,eps.presentation_hash(to_jsonb(v))),'{}'::jsonb)from eps.presentation_versions v)::text,true);
end$$;
update eps.candidate_media set original_transcript=E' PRIVATE_TRANSCRIPT_B\tline\n'||U&'\0645\0631\062D\0628\0627\0085'||E'\r ',row_version=row_version+1 where id=current_setting('eps.t28.media')::uuid;
