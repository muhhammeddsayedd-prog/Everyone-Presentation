-- Context projects/workspaces/series are created by real local authenticated RPCs.
create table locksource41_proof.objects(kind text not null,n integer not null,id uuid not null,primary key(kind,n));
create table locksource41_proof.seed_counts as select
 (select count(*)from eps.candidates)candidates,(select count(*)from eps.candidate_media)media,
 (select count(*)from eps.candidate_media_frames)frames,(select count(*)from eps.media_assets)assets,
 (select count(*)from eps.presentation_versions where status='ready')ready,
 (select count(*)from eps.version_slides)slides,(select count(*)from eps.presentation_version_assets)pins;
do $scale$declare i integer;j integer;n integer;media_n integer;role_n integer;ws uuid;bg uuid;cid uuid;mid uuid;vid uuid;job uuid;attempt uuid;rid uuid;sid uuid;pool uuid;facts jsonb;req jsonb;frames uuid[];actor uuid:='a4410000-0000-4000-8000-000000000001';begin
 if(select candidates<>3 or media<>1 or frames<>0 or assets<>4 or ready<>1 or slides<>16 or pins<>4 from locksource41_proof.seed_counts)then raise exception'LOCKSOURCE41_FROZEN_SYNTHETIC_SCALE_REQUIRED';end if;
 select workspace into bg from locksource41_proof.context where label='background';
 req:=jsonb_build_object('age_range',null,'gender_requirement',null,'appearance_performance',null,'languages','[]'::jsonb,'accents','[]'::jsonb,'skills','[]'::jsonb,'scene_references','[]'::jsonb,'shoot_dates','[]'::jsonb,'location',null,'availability_requirements',null,'other_instructions',null);
 for i in 1..25 loop
  cid:=locksource41_proof.uid('candidate-'||i);facts:=jsonb_build_object('casting_id','SYNTHETIC-LOCK-'||i,'name','Synthetic performer '||i,'age_or_range','Not provided','height_measurements','Not provided','languages_accents','Not provided','appearance_performance','Not provided','skills_summary',repeat('Synthetic fixture. ',35));
  insert into eps.candidates(id,facts,casting_id,source_kind,field_sources,reviewed_at,reviewed_by,reviewed_facts_fingerprint,created_by)
   values(cid,facts,'SYNTHETIC-LOCK-'||i,'manual','{}',clock_timestamp(),actor,eps.cast_fingerprint(facts,'{}'),actor);
  insert into locksource41_proof.objects values('candidate',i,cid);
 end loop;
 for i in 1..26 loop
  cid:=locksource41_proof.uid('candidate-'||least(i,25));mid:=locksource41_proof.uid('media-'||i);vid:=locksource41_proof.uid('video-'||i);job:=locksource41_proof.uid('media-job-'||i);attempt:=locksource41_proof.uid('media-attempt-'||i);
  select workspace into ws from locksource41_proof.context where label=case when i=1 then'control'when i<=12 then'large'else'background'end;
  insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,duration_ms,status)
   values(vid,ws,'candidate_video','synthetic-'||i||'.mp4','video/mp4','eps-candidate-assets','synthetic/'||current_setting('eps.locksource41.run')||'/'||i||'.mp4',1,encode(sha256(convert_to('synthetic video','UTF8')),'hex'),64,64,1000,'ready');
  insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,dedupe_key,status,stage,correlation_id)
   values(job,ws,actor,'candidate_scan',vid,'{}',repeat('a',64),'synthetic-lock-media-'||i,'succeeded','apply_candidate','synthetic-lock-media-'||i);
  insert into eps.job_stage_attempts(job_id,attempt_id,kind,stage,attempt,stage_attempt,dispatch_generation,correlation_id,input_hash,workflow_execution_ref_state,claimed_at,job_row_version)
   values(job,attempt,'candidate_scan','prepare_candidate',1,1,1,'synthetic-lock-media-'||i,repeat('a',64),'not_provided',clock_timestamp(),1);
  insert into eps.candidate_media(id,candidate_id,source_asset_id,source_job_id,processing_issues)values(mid,cid,vid,job,array['NO_AUDIO']);
  insert into locksource41_proof.objects values('media',i,mid),('video',i,vid);
 end loop;
 for i in 1..328 loop
  media_n:=case when i<=78 then((i-1)/3)+1 else((i-79)%26)+1 end;
  mid:=locksource41_proof.uid('media-'||media_n);vid:=locksource41_proof.uid('video-'||media_n);job:=locksource41_proof.uid('media-job-'||media_n);attempt:=locksource41_proof.uid('media-attempt-'||media_n);
  select origin_workspace_id into ws from eps.media_assets where id=vid;
  insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,status,source_asset_id,producing_job_id,producing_attempt_id,output_stage,output_key,source_timestamp_ms)
   values(locksource41_proof.uid('frame-'||i),ws,'candidate_frame','synthetic-frame-'||i||'.jpg','image/jpeg','eps-candidate-outputs','synthetic/'||current_setting('eps.locksource41.run')||'/frames/'||i||'.jpg',1,encode(sha256(convert_to('synthetic frame','UTF8')),'hex'),64,64,'ready',vid,job,attempt,'prepare_candidate','synthetic-frame-'||i,i);
  insert into eps.candidate_media_frames(candidate_media_id,asset_id)values(mid,locksource41_proof.uid('frame-'||i));
  insert into locksource41_proof.objects values('frame',i,locksource41_proof.uid('frame-'||i));
 end loop;
 for i in 1..26 loop update eps.candidate_media set selected_frame_asset_ids=array[locksource41_proof.uid('frame-'||((i-1)*3+1)),locksource41_proof.uid('frame-'||((i-1)*3+2)),locksource41_proof.uid('frame-'||((i-1)*3+3))]where id=locksource41_proof.uid('media-'||i);end loop;
 for n in 1..2 loop
  select workspace into ws from locksource41_proof.context where label=case when n=1 then'control'else'large'end;
  for i in 1..case when n=1 then 1 else 36 end loop
   rid:=locksource41_proof.uid('role-'||n||'-'||i);
   insert into eps.roles(id,workspace_id,name,headcount,category,requirements,sort_order,archived_at)
    values(rid,ws,'Synthetic role '||i,case when n=1 then 1 else 8 end,'synthetic',req,i,case when n=2 and i>2 then clock_timestamp()end);
   insert into locksource41_proof.objects values('role-'||n,i,rid);
  end loop;
  for i in 1..case when n=1 then 1 else 563 end loop
   role_n:=case when n=1 then 1 when i<=16 then((i-1)/8)+1 else((i-17)%34)+3 end;sid:=locksource41_proof.uid('slot-'||n||'-'||i);
   insert into eps.slots(id,workspace_id,role_id,ordinal,label,sort_order,archived_at)values(sid,ws,locksource41_proof.uid('role-'||n||'-'||role_n),i,'Synthetic slot '||i,i,case when n=2 and i>16 then clock_timestamp()end);
   insert into locksource41_proof.objects values('slot-'||n,i,sid);
  end loop;
  for i in 1..case when n=1 then 1 else 15 end loop
   media_n:=case when n=1 then 1 else i+1 end;pool:=locksource41_proof.uid('pool-'||n||'-'||i);
   frames:=array[locksource41_proof.uid('frame-'||((media_n-1)*3+1)),locksource41_proof.uid('frame-'||((media_n-1)*3+2)),locksource41_proof.uid('frame-'||((media_n-1)*3+3))];
   insert into eps.workspace_candidates(id,workspace_id,candidate_id,selected_candidate_media_id,selected_frame_asset_ids,media_confirmed,archived_at)
    values(pool,ws,locksource41_proof.uid('candidate-'||case when n=1 then 1 when i<=11 then i+1 else i+1 end),locksource41_proof.uid('media-'||media_n),frames,true,case when n=2 and i>11 then clock_timestamp()end);
   insert into locksource41_proof.objects values('pool-'||n,i,pool);
  end loop;
  for i in 1..case when n=1 then 1 else 20 end loop
   sid:=locksource41_proof.uid('slot-'||n||'-'||case when n=1 then 1 when i<=19 then((i-1)%16)+1 else 17 end);
   pool:=locksource41_proof.uid('pool-'||n||'-'||case when n=1 then 1 when i<=19 then((i-1)%11)+1 else 12 end);
   insert into eps.assignments(id,workspace_id,slot_id,workspace_candidate_id,position,shortlist_included,sort_order,archived_at)
    values(locksource41_proof.uid('assignment-'||n||'-'||i),ws,sid,pool,case when n=1 or i<=16 then'main'else'option'end,true,i,case when n=2 and i=20 then clock_timestamp()end);
   insert into locksource41_proof.objects values('assignment-'||n,i,locksource41_proof.uid('assignment-'||n||'-'||i));
  end loop;
 end loop;
end$scale$;
