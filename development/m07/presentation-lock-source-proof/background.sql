-- Declared synthetic retained metadata exercises existing RLS joins; it is NOT
-- a render/Storage/native acceptance fixture. Original Ready rows stay untouched.
do $background$declare bg uuid;project uuid;series uuid;actor uuid:='a4410000-0000-4000-8000-000000000002';i integer;j integer;n integer;pool uuid;slot uuid;media_n integer;rid uuid;req jsonb;review jsonb;slide jsonb;frozen jsonb;slides jsonb;inventory jsonb;snapshot jsonb;manifest jsonb;version uuid;job uuid;attempt uuid;manifest_asset uuid;pdf_asset uuid;logo uuid;assets uuid[];source eps.media_assets;created timestamptz:=clock_timestamp();begin
 select c.workspace,c.project,c.series into bg,project,series from locksource41_proof.context c where label='background';
 req:=jsonb_build_object('age_range',null,'gender_requirement',null,'appearance_performance',null,'languages','[]'::jsonb,'accents','[]'::jsonb,'skills','[]'::jsonb,'scene_references','[]'::jsonb,'shoot_dates','[]'::jsonb,'location',null,'availability_requirements',null,'other_instructions',null);
 rid:=locksource41_proof.uid('background-role');
 insert into eps.roles(id,workspace_id,name,headcount,category,requirements,sort_order)values(rid,bg,'Synthetic retained metadata role',35,'synthetic',req,0);
 for i in 1..12 loop
  pool:=locksource41_proof.uid('background-pool-'||i);
  insert into eps.workspace_candidates(id,workspace_id,candidate_id,selected_candidate_media_id,selected_frame_asset_ids,media_confirmed)
   values(pool,bg,locksource41_proof.uid('candidate-'||i),locksource41_proof.uid('media-'||i),array[locksource41_proof.uid('frame-'||((i-1)*3+1)),locksource41_proof.uid('frame-'||((i-1)*3+2)),locksource41_proof.uid('frame-'||((i-1)*3+3))],true);
  for j in 1..case when i=12 then 2 else 3 end loop
   n:=(i-1)*3+j;slot:=locksource41_proof.uid('background-slot-'||n);
   insert into eps.slots(id,workspace_id,role_id,ordinal,label,sort_order)values(slot,bg,rid,n,'Synthetic retained slot '||n,n);
   insert into eps.assignments(id,workspace_id,slot_id,workspace_candidate_id,position,shortlist_included,sort_order)
    values(locksource41_proof.uid('background-assignment-'||n),bg,slot,pool,'main',true,n);
  end loop;
 end loop;
 logo:=locksource41_proof.uid('background-logo');
 insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,status)
  values(logo,bg,'client_logo','synthetic-logo.png','image/png','eps-brand-assets','synthetic/'||current_setting('eps.locksource41.run')||'/logo.png',1,repeat('b',64),64,64,'ready');
 update eps.workspaces set logo_asset_id=logo where id=bg;
 review:=eps.review_snapshot_data(bg,series,null);
 for i in 1..12 loop
  version:=locksource41_proof.uid('background-version-'||i);job:=locksource41_proof.uid('background-job-'||i);attempt:=locksource41_proof.uid('background-attempt-'||i);
  manifest_asset:=locksource41_proof.uid('background-manifest-'||i);pdf_asset:=locksource41_proof.uid('background-pdf-'||i);
  insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,dedupe_key,status,stage,correlation_id)
   values(job,bg,actor,'presentation_render',version,'{}',repeat('c',64),'synthetic-retained-'||i,'succeeded','publish_presentation','synthetic-retained-'||i);
  insert into eps.job_stage_attempts(job_id,attempt_id,kind,stage,attempt,stage_attempt,dispatch_generation,correlation_id,input_hash,workflow_execution_ref_state,claimed_at,job_row_version)
   values(job,attempt,'presentation_render','publish_presentation',1,1,1,'synthetic-retained-'||i,repeat('c',64),'not_provided',created,1);
  slides:=jsonb_build_array(jsonb_build_object('id',locksource41_proof.uid('background-slide-'||i||'-0'),'version_id',version,'order',0,'kind','cover','assignment_id',null,'candidate_id',null,'role_label',null,'role_category',null,'slot_label',null,'position',null,'fields',null,'requirements',null,'frame_asset_ids','[]'::jsonb,'video_asset_id',null,'logo_asset_id',case when i<=8 then logo end,'role_id',null,'slot_id',null,'candidate_media_id',null,'provisional',false,'review_status',null,'frames','[]'::jsonb));
  for j in 1..case when i=12 then 2 else 3 end loop
   n:=(i-1)*3+j;select v into slide from jsonb_array_elements(review->'slides')v where v->>'assignment_id'=locksource41_proof.uid('background-assignment-'||n)::text;
   if slide is null then raise exception'LOCKSOURCE41_BACKGROUND_REVIEW_REQUIRED';end if;
   frozen:=jsonb_build_object('id',locksource41_proof.uid('background-slide-'||i||'-'||j),'version_id',version,'order',j,'kind',slide->'kind','assignment_id',slide->'assignment_id','candidate_id',slide->'candidate_id','role_label',slide->'role_name','role_category',slide->'role_category','slot_label',slide->'slot_label','position',slide->'position','fields',slide->'fields','source_fields',slide->'source_fields','requirements',slide->'requirements','frame_asset_ids',(select coalesce(jsonb_agg(f->'asset_id'order by ord),'[]')from jsonb_array_elements(slide->'frames')with ordinality x(f,ord)),'video_asset_id',slide->'video_asset_id','logo_asset_id',null,'role_id',slide->'role_id','slot_id',slide->'slot_id','candidate_media_id',slide->'candidate_media_id','provisional',slide->'provisional','review_status',slide->'review_status','frames',slide->'frames');
   slides:=slides||jsonb_build_array(frozen);
  end loop;
  media_n:=i;assets:=array[locksource41_proof.uid('video-'||media_n),locksource41_proof.uid('frame-'||((media_n-1)*3+1)),locksource41_proof.uid('frame-'||((media_n-1)*3+2)),locksource41_proof.uid('frame-'||((media_n-1)*3+3))];if i<=8 then assets:=assets||logo;end if;
  select jsonb_agg(jsonb_build_object('asset_id',a.id,'sha256',a.sha256,'asset_kind',a.purpose,'mime_type',a.mime_type,'byte_size',a.size_bytes,'bucket',a.bucket,'object_key',a.object_key,'width',a.width,'height',a.height,'duration_ms',a.duration_ms,'source_asset_id',a.source_asset_id,'timestamp_ms',a.source_timestamp_ms)order by a.id)into inventory from eps.media_assets a where a.id=any(assets);
  snapshot:=jsonb_build_object('schema_version','1.0','hash_protocol','eps-cast-canonical-v1','version_id',version,'series_id',series,'workspace_id',bg,'project_id',project,'version_no',i,'created_at',eps.presentation_time(created),'input_workspace_row_version',(select row_version from eps.workspaces where id=bg),'input_draft_revision',(select draft_revision from eps.workspaces where id=bg),'input_fingerprint',review->>'input_fingerprint','template',(review->'template')||jsonb_build_object('font_hashes',(select pt.font_hashes from eps.presentation_templates pt where pt.key='everyone-casting'and pt.version='1.1.0')),'render_configuration',jsonb_build_object('renderer_version',(select renderer_version from eps.presentation_processing_config where id),'application_origin',(select application_origin from eps.presentation_processing_config where id)),'audience_snapshot',(select audience_snapshot from eps.presentation_series where id=series),'cover',(review->'cover')||jsonb_build_object('logo_asset_id',case when i<=8 then logo end),'slides',slides,'asset_inventory',inventory);
  manifest:=eps.presentation_manifest(snapshot);
  insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,status,producing_job_id,producing_attempt_id,output_stage,output_key)
   values(manifest_asset,bg,'presentation_manifest','synthetic-manifest.json','application/json','eps-presentation-outputs','synthetic/'||version||'/manifest.json',octet_length(manifest::text),encode(sha256(convert_to(manifest::text,'UTF8')),'hex'),'ready',job,attempt,'render_presentation','presentation_manifest'),
   (pdf_asset,bg,'presentation_pdf','synthetic.pdf','application/pdf','eps-presentation-outputs','synthetic/'||version||'/presentation.pdf',1,repeat('d',64),'ready',job,attempt,'render_presentation','presentation_pdf');
  insert into eps.presentation_versions(id,series_id,workspace_id,project_id,version_number,status,input_workspace_row_version,source_draft_revision,input_fingerprint,snapshot,snapshot_sha256,manifest,manifest_sha256,inventory_sha256,page_count,generation_job_id,generated_by,manifest_asset_id,pdf_asset_id,ready_at,created_at,english_transcript_version)
   values(version,series,bg,project,i,'ready',(select row_version from eps.workspaces where id=bg),(select draft_revision from eps.workspaces where id=bg),review->>'input_fingerprint',snapshot,eps.presentation_hash(snapshot),manifest,eps.presentation_hash(manifest),eps.presentation_hash(inventory),jsonb_array_length(slides),job,actor,manifest_asset,pdf_asset,created,created,'1.0');
  for slide in select value from jsonb_array_elements(slides)loop insert into eps.version_slides(id,version_id,ordinal,kind,source_assignment_id,source_slot_id,snapshot,content_sha256)values((slide->>'id')::uuid,version,(slide->>'order')::integer,slide->>'kind',(slide->>'assignment_id')::uuid,(slide->>'slot_id')::uuid,slide,eps.presentation_hash(slide));end loop;
  for source in select * from eps.media_assets where id=any(assets)loop insert into eps.presentation_version_assets(version_id,asset_id,asset_kind,bucket,object_key,mime_type,byte_size,sha256,width,height,duration_ms,source_asset_id,timestamp_ms,filename,asset_created_at)values(version,source.id,source.purpose,source.bucket,source.object_key,source.mime_type,source.size_bytes,source.sha256,source.width,source.height,source.duration_ms,source.source_asset_id,source.source_timestamp_ms,source.filename,source.created_at);end loop;
 end loop;
 -- Fill the remaining global asset background with declared metadata only.
 for i in 1..501-(select count(*)from eps.media_assets)loop insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,duration_ms,status)values(locksource41_proof.uid('filler-video-'||i),bg,'candidate_video','synthetic-filler.mp4','video/mp4','eps-candidate-assets','synthetic/'||current_setting('eps.locksource41.run')||'/filler/'||i,1,repeat('e',64),64,64,1000,'ready');end loop;
 if(select count(*)from eps.candidates)<>28 or(select count(*)from eps.candidate_media)<>27 or(select count(*)from eps.candidate_media_frames)<>328 or(select count(*)from eps.media_assets)<>501 or(select count(*)from eps.presentation_versions where status='ready')<>13 or(select count(*)from eps.version_slides)<>63 or(select count(*)from eps.presentation_version_assets)<>60 then raise exception'LOCKSOURCE41_SYNTHETIC_BACKGROUND_COUNTS_REQUIRED';end if;
end$background$;
