-- Cycle 7 A3: m18 notes and default review audience, m19 template 1.4.0 (review capture, issues, fingerprint,
-- generation snapshot/inventory/manifest/render context, guest context, legacy 1.3.0 explanation).
-- Synthetic metadata only (no real people or media). Runs as supabase_admin on the disposable replica; rolls back.
begin;
set local search_path='';
alter table auth.users add column if not exists is_anonymous boolean not null default false,add column if not exists deleted_at timestamptz,add column if not exists banned_until timestamptz;
set local session_replication_role=replica;
insert into auth.users(id,instance_id,aud,role,email) values
 ('a3000000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a3-producer@example.invalid');
insert into public.app_capability_grants(principal_id,capability) select 'a3000000-0000-4000-8000-0000000000a1',capability
 from unnest(array['projects.read','workspaces.read','workspaces.write','cast.read','cast.write','presentations.generate','settings.manage','review_links.manage']) capability;
insert into public.projects(id,name) values('a3000000-0000-4000-8000-00000000c001','A3 synthetic project');
insert into public.project_memberships(project_id,principal_id,can_write) values('a3000000-0000-4000-8000-00000000c001','a3000000-0000-4000-8000-0000000000a1',true);
insert into eps.workspaces(id,project_id) values('a3000000-0000-4000-8000-00000000d001','a3000000-0000-4000-8000-00000000c001');
insert into eps.app_settings(singleton,template_version) values(true,'1.3.0') on conflict(singleton) do update set template_version='1.3.0',default_audience_preset_id=null;
insert into eps.presentation_processing_config(id,enabled,renderer_version,application_origin) values(true,true,'everyone-casting-pdf-v1','http://127.0.0.1:3000')
 on conflict(id) do update set enabled=true,renderer_version='everyone-casting-pdf-v1',application_origin='http://127.0.0.1:3000';
insert into eps.audience_presets(id,key,label,scope) values
 ('a3000000-0000-4000-8000-0000000a1c01','a3-client','Client','external'),('a3000000-0000-4000-8000-0000000a1c02','a3-agency','Agency','internal'),
 ('a3000000-0000-4000-8000-0000000a1c03','a3-old','Old','external');
update eps.audience_presets set archived=true where id='a3000000-0000-4000-8000-0000000a1c03';
-- Roles R1 (one slot: Main P1 frame portrait, Backup P2 photo portrait, Option P3 no picture) and R2 (one open slot).
insert into eps.roles(id,workspace_id,name,requirements,sort_order) values
 ('a3000000-0000-4000-8000-0000000e0101','a3000000-0000-4000-8000-00000000d001','Saudi Daughter','{}',0),
 ('a3000000-0000-4000-8000-0000000e0102','a3000000-0000-4000-8000-00000000d001','Web Designer','{}',1);
insert into eps.slots(id,workspace_id,role_id,ordinal,label,sort_order) values
 ('a3000000-0000-4000-8000-0000000e0201','a3000000-0000-4000-8000-00000000d001','a3000000-0000-4000-8000-0000000e0101',1,'Slot 1',0),
 ('a3000000-0000-4000-8000-0000000e0202','a3000000-0000-4000-8000-00000000d001','a3000000-0000-4000-8000-0000000e0102',1,'Slot 1',0);
insert into eps.candidates(id,facts,casting_id,source_kind,created_by,reviewed_facts_fingerprint)
select id,jsonb_build_object('name','A3 Person '||n,'casting_id','A3-'||n,'age_or_range',null,'stated_gender',null,'height_measurements',null,'languages','[]'::jsonb,'accents','[]'::jsonb,'skills_experience',null,'city',null,'previous_projects_roles',null,'classification',null),
 'A3-'||n,'manual','a3000000-0000-4000-8000-0000000000a1',null
from (values(1,'a3000000-0000-4000-8000-0000000e0001'::uuid),(2,'a3000000-0000-4000-8000-0000000e0002'),(3,'a3000000-0000-4000-8000-0000000e0003')) v(n,id);
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,duration_ms,status) values
 ('a3000000-0000-4000-8000-0000000a0001','a3000000-0000-4000-8000-00000000d001','candidate_video','v1.mp4','video/mp4','eps-candidate-assets','assets/a3/v1.mp4',1000,repeat('a',64),640,480,10000,'ready');
insert into eps.candidate_media(id,candidate_id,source_asset_id,selected_frame_asset_ids) values
 ('a3000000-0000-4000-8000-0000000b0001','a3000000-0000-4000-8000-0000000e0001','a3000000-0000-4000-8000-0000000a0001','{a3000000-0000-4000-8000-0000000f0001}');
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,status,source_asset_id,producing_job_id,producing_attempt_id,output_stage,output_key,source_timestamp_ms) values
 ('a3000000-0000-4000-8000-0000000f0001','a3000000-0000-4000-8000-00000000d001','candidate_frame','f1.jpg','image/jpeg','eps-candidate-outputs','frames/a3/f1.jpg',1000,repeat('c',64),1080,1920,'ready','a3000000-0000-4000-8000-0000000a0001',gen_random_uuid(),gen_random_uuid(),'prepare_candidate','frame_1',100);
insert into eps.candidate_media_frames(candidate_media_id,asset_id) values('a3000000-0000-4000-8000-0000000b0001','a3000000-0000-4000-8000-0000000f0001');
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,status) values
 ('a3000000-0000-4000-8000-000000010001','a3000000-0000-4000-8000-00000000d001','candidate_photo','p2.jpg','image/jpeg','eps-candidate-photos','archive/a3/p2.jpg',1000,repeat('d',64),800,1000,'ready'),
 ('a3000000-0000-4000-8000-000000010002','a3000000-0000-4000-8000-00000000d001','candidate_photo','t2.jpg','image/jpeg','eps-candidate-photos','archive/a3/t2.jpg',100,repeat('e',64),80,100,'ready'),
 ('a3000000-0000-4000-8000-000000010003','a3000000-0000-4000-8000-00000000d001','candidate_photo','p3.jpg','image/jpeg','eps-candidate-photos','archive/a3/p3.jpg',1000,repeat('f',64),800,1000,'uploading'),
 ('a3000000-0000-4000-8000-000000010004','a3000000-0000-4000-8000-00000000d001','candidate_photo','t3.jpg','image/jpeg','eps-candidate-photos','archive/a3/t3.jpg',100,repeat('b',64),80,100,'ready');
insert into eps.candidate_photos(id,candidate_id,position,asset_id,thumb_asset_id,width,height,source_key) values
 ('a3000000-0000-4000-8000-000000020002','a3000000-0000-4000-8000-0000000e0002',1,'a3000000-0000-4000-8000-000000010001','a3000000-0000-4000-8000-000000010002',800,1000,'a3/p2'),
 ('a3000000-0000-4000-8000-000000020003','a3000000-0000-4000-8000-0000000e0003',1,'a3000000-0000-4000-8000-000000010003','a3000000-0000-4000-8000-000000010004',800,1000,'a3/p3');
insert into eps.workspace_candidates(id,workspace_id,candidate_id,selected_candidate_media_id,selected_frame_asset_ids,portrait_asset_id,portrait_source,portrait_crop,media_selection_state) values
 ('a3000000-0000-4000-8000-000000030001','a3000000-0000-4000-8000-00000000d001','a3000000-0000-4000-8000-0000000e0001','a3000000-0000-4000-8000-0000000b0001','{a3000000-0000-4000-8000-0000000f0001}','a3000000-0000-4000-8000-0000000f0001','frame',null,'pinned'),
 ('a3000000-0000-4000-8000-000000030002','a3000000-0000-4000-8000-00000000d001','a3000000-0000-4000-8000-0000000e0002',null,'{}','a3000000-0000-4000-8000-000000010001','photo','{"focal_x":0.3,"focal_y":0.25}','pinned'),
 ('a3000000-0000-4000-8000-000000030003','a3000000-0000-4000-8000-00000000d001','a3000000-0000-4000-8000-0000000e0003',null,'{}',null,null,null,'unset');
insert into eps.assignments(id,workspace_id,slot_id,workspace_candidate_id,position,shortlist_included,sort_order) values
 ('a3000000-0000-4000-8000-000000040001','a3000000-0000-4000-8000-00000000d001','a3000000-0000-4000-8000-0000000e0201','a3000000-0000-4000-8000-000000030001','main',true,0),
 ('a3000000-0000-4000-8000-000000040002','a3000000-0000-4000-8000-00000000d001','a3000000-0000-4000-8000-0000000e0201','a3000000-0000-4000-8000-000000030002','backup',true,1),
 ('a3000000-0000-4000-8000-000000040003','a3000000-0000-4000-8000-00000000d001','a3000000-0000-4000-8000-0000000e0201','a3000000-0000-4000-8000-000000030003','option',true,2);
-- Scenes: R1 appears in Front Door and Home Gathering of one sequence (auto twice -> printed once, combined caption).
insert into eps.scenes(id,workspace_id,scene_number,title,sequence_label,setting,sort_order) values
 ('a3000000-0000-4000-8000-000000050001','a3000000-0000-4000-8000-00000000d001','1','Front Door','Mother’s Birthday',null,0),
 ('a3000000-0000-4000-8000-000000050002','a3000000-0000-4000-8000-00000000d001','2','Home Gathering','Mother’s Birthday',null,1),
 ('a3000000-0000-4000-8000-000000050003','a3000000-0000-4000-8000-00000000d001','3','Draft scene',null,null,2),
 ('a3000000-0000-4000-8000-000000050004','a3000000-0000-4000-8000-00000000d001','4','Secret scene',null,'Secret setting',3);
update eps.scenes set status='proposed' where id='a3000000-0000-4000-8000-000000050003';
insert into eps.scene_occurrences(id,workspace_id,scene_id,role_id,display_title,presentation_note,deck_placement,sort_order) values
 ('a3000000-0000-4000-8000-000000060001','a3000000-0000-4000-8000-00000000d001','a3000000-0000-4000-8000-000000050001','a3000000-0000-4000-8000-0000000e0101',null,null,'auto',0),
 ('a3000000-0000-4000-8000-000000060002','a3000000-0000-4000-8000-00000000d001','a3000000-0000-4000-8000-000000050002','a3000000-0000-4000-8000-0000000e0101',null,'We’ll choose Only One.','auto',0),
 ('a3000000-0000-4000-8000-000000060003','a3000000-0000-4000-8000-00000000d001','a3000000-0000-4000-8000-000000050002','a3000000-0000-4000-8000-0000000e0102','Web Designer',null,'auto',1),
 -- Hidden links (one on a printed scene, one on a scene nothing prints) are internal only.
 ('a3000000-0000-4000-8000-000000060004','a3000000-0000-4000-8000-00000000d001','a3000000-0000-4000-8000-000000050001','a3000000-0000-4000-8000-0000000e0102','Secret hidden title','Secret hidden note','hidden',1),
 ('a3000000-0000-4000-8000-000000060005','a3000000-0000-4000-8000-00000000d001','a3000000-0000-4000-8000-000000050004','a3000000-0000-4000-8000-0000000e0101','Secret title','Secret note','hidden',0);
set local session_replication_role=origin;

-- The deck a guest composes: the snapshot with the guest scenes and per-version role keys in place of internal ids.
create function pg_temp.a3_guest_snapshot(p_snapshot jsonb)returns jsonb language sql immutable as $$
 select jsonb_set(jsonb_set(p_snapshot,'{presentation,scenes}',g#>'{presentation,scenes}'),'{slides}',
  (select jsonb_agg(v||jsonb_build_object('role_id',g->'presentation_role_keys'->((n-1)::integer))order by n)
   from(select v,row_number()over(order by o)n from jsonb_array_elements(p_snapshot->'slides')with ordinality x(v,o)where v->>'kind'<>'cover')q))
 from(select eps.guest_presentation_1_4(p_snapshot)g)z$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-0000000000a1","role":"authenticated","is_anonymous":false}',true),set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-0000000000a1',true);
do $$declare settings jsonb;series jsonb;review jsonb;legacy jsonb;failed text;role jsonb;slot jsonb;fingerprint text;begin
 -- m18: no default audience -> an ordinary series is refused with AUDIENCE_DEFAULT_REQUIRED (never the first preset).
 begin perform public.eps_create_presentation_series('{"workspace_id":"a3000000-0000-4000-8000-00000000d001","output_type":"shortlist"}','a3-series-key-0000001');failed:='accepted';
 exception when raise_exception then failed:=sqlerrm;end;
 if failed<>'AUDIENCE_DEFAULT_REQUIRED'then raise exception'A3_FAIL default required %',failed;end if;
 settings:=public.eps_get_settings();
 if not settings?'default_audience_preset_id'or settings->'default_audience_preset_id'<>'null'::jsonb then raise exception'A3_FAIL settings dto %',settings;end if;
 -- An archived preset cannot become the default.
 begin perform public.eps_update_settings(jsonb_build_object('row_version',(settings->>'row_version')::bigint,'default_audience_preset_id','a3000000-0000-4000-8000-0000000a1c03'),'a3-settings-key-000001');failed:='accepted';
 exception when raise_exception then failed:=sqlerrm;end;
 if failed<>'INVALID_REQUEST'then raise exception'A3_FAIL archived default %',failed;end if;
 settings:=public.eps_update_settings(jsonb_build_object('row_version',(settings->>'row_version')::bigint,'default_audience_preset_id','a3000000-0000-4000-8000-0000000a1c01'),'a3-settings-key-000002');
 if settings->>'default_audience_preset_id'<>'a3000000-0000-4000-8000-0000000a1c01'or settings->>'template_version'<>'1.3.0'then raise exception'A3_FAIL default saved %',settings;end if;
 -- 1.3.0 series (default audience): the photo-only portrait is explained and blocks generation.
 series:=public.eps_create_presentation_series('{"workspace_id":"a3000000-0000-4000-8000-00000000d001","output_type":"shortlist"}','a3-series-key-0000002');
 if series->>'audience_preset_id'<>'a3000000-0000-4000-8000-0000000a1c01'or series->>'template_version'<>'1.3.0'or not series?'cover_note'then raise exception'A3_FAIL default series %',series;end if;
 legacy:=public.eps_get_workspace_review('a3000000-0000-4000-8000-00000000d001',(series->>'id')::uuid,null);
 if legacy?'presentation'or not exists(select 1 from jsonb_array_elements(legacy->'issues')i where i->>'code'='TEMPLATE_PORTRAIT_UNSUPPORTED'and i->>'severity'='blocking'and i->>'entity_id'='a3000000-0000-4000-8000-000000040002')
  or exists(select 1 from jsonb_array_elements(legacy->'issues')i where i->>'code'like'PORTRAIT_%'or i->>'code'='NO_PRESENTATION_PICTURE')then raise exception'A3_FAIL legacy issues %',legacy->'issues';end if;
 perform set_config('a3.legacy',series->>'id',true);
 -- Notes: role and slot (note-only slot update keeps the label).
 role:=public.eps_update_role('a3000000-0000-4000-8000-0000000e0101','{"row_version":1,"presentation_note":"Role note."}','a3-role-key-00000001');
 slot:=public.eps_update_slot('a3000000-0000-4000-8000-0000000e0202','{"row_version":1,"presentation_note":"Missing."}','a3-slot-key-00000001');
 if role->>'presentation_note'<>'Role note.'or slot->>'presentation_note'<>'Missing.'or slot->>'label'<>'Slot 1'then raise exception'A3_FAIL notes % %',role,slot;end if;
 begin perform public.eps_update_slot('a3000000-0000-4000-8000-0000000e0202',jsonb_build_object('row_version',2,'presentation_note',repeat('x',501)),'a3-slot-key-00000002');failed:='accepted';
 exception when raise_exception then failed:=sqlerrm;end;
 if failed<>'VALIDATION_FAILED'then raise exception'A3_FAIL long note %',failed;end if;
 -- 1.4.0 becomes the default only through Settings; then a new series with an explicit Agency context.
 settings:=public.eps_update_settings(jsonb_build_object('row_version',(settings->>'row_version')::bigint,'template_version','1.4.0'),'a3-settings-key-000003');
 series:=public.eps_create_presentation_series('{"workspace_id":"a3000000-0000-4000-8000-00000000d001","output_type":"shortlist","audience_preset_id":"a3000000-0000-4000-8000-0000000a1c02"}','a3-series-key-0000003');
 if series->>'template_version'<>'1.4.0'or series->>'audience_preset_id'<>'a3000000-0000-4000-8000-0000000a1c02'then raise exception'A3_FAIL 1.4 series %',series;end if;
 series:=public.eps_update_presentation_series((series->>'id')::uuid,'{"row_version":1,"cover_note":" Pending Availability. "}','a3-cover-key-0000001');
 if series->>'cover_note'<>'Pending Availability.'then raise exception'A3_FAIL cover note %',series;end if;
 perform set_config('a3.series',series->>'id',true);
 review:=public.eps_get_workspace_review('a3000000-0000-4000-8000-00000000d001',(series->>'id')::uuid,null);
 if review#>>'{presentation,cover_note}'<>'Pending Availability.'or jsonb_array_length(review#>'{presentation,slides}')<>jsonb_array_length(review->'slides')
  or jsonb_array_length(review#>'{presentation,scenes}')<>3 or review#>>'{presentation,scenes,0,sequence_label}'<>'Mother’s Birthday'
  or jsonb_array_length(review#>'{presentation,scenes,1,occurrences}')<>2 or review#>>'{presentation,scenes,1,occurrences,0,presentation_note}'<>'We’ll choose Only One.'
 then raise exception'A3_FAIL presentation scenes %',review->'presentation';end if;
 -- Pictures: P1 frame portrait (default focus), P2 photo portrait (crop focus in thousandths), P3 none -> warning; slot/role notes.
 if review#>'{presentation,slides,0,portrait}'<>jsonb_build_object('asset_id','a3000000-0000-4000-8000-0000000f0001','source','frame','width',1080,'height',1920,'sha256',repeat('c',64),'focal',jsonb_build_array(500,400))
  or review#>'{presentation,slides,1,portrait}'<>jsonb_build_object('asset_id','a3000000-0000-4000-8000-000000010001','source','photo','width',800,'height',1000,'sha256',repeat('d',64),'focal',jsonb_build_array(300,250))
  or review#>'{presentation,slides,2,portrait}'<>'null'::jsonb or review#>>'{presentation,slides,2,picture_state}'<>'unset'
  or review#>>'{presentation,slides,0,role_note}'<>'Role note.'or review#>>'{presentation,slides,3,slot_note}'<>'Missing.'or review#>'{presentation,slides,3,picture_state}'<>'null'::jsonb
  or not exists(select 1 from jsonb_array_elements(review->'issues')i where i->>'code'='NO_PRESENTATION_PICTURE'and i->>'severity'='warning'and i->>'entity_id'='a3000000-0000-4000-8000-000000040003')
  or exists(select 1 from jsonb_array_elements(review->'issues')i where i->>'code'like'TEMPLATE_PORTRAIT%')
 then raise exception'A3_FAIL presentation slides % issues %',review#>'{presentation,slides}',review->'issues';end if;
 perform set_config('a3.fingerprint',review->>'input_fingerprint',true);
end $$;

-- Presentation changes made elsewhere (scene placement, picture state) change the 1.4.0 fingerprint and issues.
reset role;
update eps.scene_occurrences set deck_placement='repeat' where id='a3000000-0000-4000-8000-000000060002';
update eps.workspace_candidates set portrait_asset_id='a3000000-0000-4000-8000-000000010003',portrait_source='photo',media_selection_state='pinned' where id='a3000000-0000-4000-8000-000000030003';
set local role authenticated;
do $$declare review jsonb;begin
 review:=public.eps_get_workspace_review('a3000000-0000-4000-8000-00000000d001',current_setting('a3.series')::uuid,null);
 if review->>'input_fingerprint'=current_setting('a3.fingerprint')or review#>>'{presentation,scenes,1,occurrences,0,deck_placement}'<>'repeat'
  or not exists(select 1 from jsonb_array_elements(review->'issues')i where i->>'code'='PORTRAIT_PROCESSING'and i->>'severity'='blocking')
  or exists(select 1 from jsonb_array_elements(review->'issues')i where i->>'code'='NO_PRESENTATION_PICTURE')
  or review->'can_generate'<>'false'::jsonb then raise exception'A3_FAIL change detection %',review->'issues';end if;
end $$;
reset role;
update eps.workspace_candidates set portrait_asset_id=null,portrait_source=null,media_selection_state='intentionally_empty' where id='a3000000-0000-4000-8000-000000030003';
set local role authenticated;
do $$declare review jsonb;begin
 review:=public.eps_get_workspace_review('a3000000-0000-4000-8000-00000000d001',current_setting('a3.series')::uuid,null);
 if review#>>'{presentation,slides,2,picture_state}'<>'intentionally_empty'or exists(select 1 from jsonb_array_elements(review->'issues')i where i->>'code'in('NO_PRESENTATION_PICTURE','PORTRAIT_PROCESSING','PORTRAIT_UNAVAILABLE'))
 then raise exception'A3_FAIL intentionally empty %',review->'issues';end if;
 perform set_config('a3.fingerprint',review->>'input_fingerprint',true);
end $$;

-- Generation needs a measured layout for the exact fingerprint. It arrives through the real worker stage path (fit
-- request, claim, stage input, recorded measurement), which rebuilds the 1.4.0 snapshot as eps_review_stage_owner with
-- an archive-photo portrait pinned (P2).
reset role;
-- The replica image's extensions schema lacks the canonical USAGE grant for the stage owner (rolled back).
grant usage on schema extensions to eps_review_stage_owner;
insert into eps.review_processing_config(id,enabled,model,prompt_version,renderer_version) values(true,true,'synthetic-model','synthetic-prompt','everyone-casting-pdf-v1')
 on conflict(id) do update set enabled=true,renderer_version='everyone-casting-pdf-v1';
set local role authenticated;
do $$declare queued jsonb;begin
 queued:=public.eps_request_workspace_review_fit('a3000000-0000-4000-8000-00000000d001',current_setting('a3.series')::uuid,jsonb_build_object('expected_input_fingerprint',current_setting('a3.fingerprint')),'a3-fit-key-000000001');
 perform set_config('a3.fit_job',queued->>'job_id',true);
end $$;
reset role;
do $$declare job eps.jobs;claim jsonb;input jsonb;receipt jsonb;fonts jsonb;begin
 select * into job from eps.jobs where id=current_setting('a3.fit_job')::uuid;
 if not eps.review_stage_source_matches(job)then raise exception'A3_FAIL stage source match';end if;
 claim:=eps.claim_review_job_stage(jsonb_build_object('job_id',job.id,'stage','measure_review_fit','input_hash',job.input_hash));
 input:=eps.get_review_stage_input(job.id,(claim->>'attempt_id')::uuid,claim->>'lease_token');
 if input#>>'{review,presentation,slides,1,portrait,source}'<>'photo'or input#>>'{review,input_fingerprint}'<>current_setting('a3.fingerprint')
 then raise exception'A3_FAIL stage input %',input#>'{review,presentation,slides}';end if;
 select font_hashes into fonts from eps.presentation_templates where key=job.input#>>'{template,key}'and version=job.input#>>'{template,version}';
 receipt:=eps.record_review_job_event(jsonb_build_object('event_id','a3-fit-measured','job_id',job.id,'attempt_id',claim->>'attempt_id','lease_token',claim->>'lease_token',
  'stage','measure_review_fit','sequence',1,'event_type','succeeded','input_hash',job.input_hash,'result_schema','review-fit-measurement.v1',
  'result',jsonb_build_object('schema_version','1.0','input_fingerprint',current_setting('a3.fingerprint'),'template_content_sha256',job.input#>>'{template,content_sha256}',
   'renderer_version',job.input#>>'{configuration,renderer_version}','chromium_version','synthetic-chromium','font_hashes',fonts,'overflows','[]'::jsonb,
   'measured_at',to_char(clock_timestamp()at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'))));
 if receipt->>'job_status'<>'succeeded'or not exists(select 1 from eps.review_fit_results where job_id=job.id and status='measured'and input_fingerprint=current_setting('a3.fingerprint'))
 then raise exception'A3_FAIL fit not recorded % %',receipt,(select error from eps.jobs where id=job.id);end if;
end $$;
select set_config('a3.wsrv',(select row_version::text from eps.workspaces where id='a3000000-0000-4000-8000-00000000d001'),true);
set local role authenticated;
do $$declare review jsonb;accepted jsonb;version eps.presentation_versions;counts jsonb;guest jsonb;begin
 review:=public.eps_get_workspace_review('a3000000-0000-4000-8000-00000000d001',current_setting('a3.series')::uuid,null);
 if review->'can_generate'<>'true'::jsonb then raise exception'A3_FAIL not generatable %',review->'issues';end if;
 accepted:=public.eps_generate_version(current_setting('a3.series')::uuid,jsonb_build_object('expected_workspace_row_version',current_setting('a3.wsrv')::bigint,
  'expected_draft_revision',(review->>'draft_revision')::bigint,'expected_input_fingerprint',review->>'input_fingerprint'),'a3-generate-key-00001');
 perform set_config('a3.version',accepted->>'resource_id',true);
end $$;
reset role;
do $$declare version eps.presentation_versions;counts jsonb;guest jsonb;begin
 select * into version from eps.presentation_versions where id=current_setting('a3.version')::uuid;
 counts:=eps.editorial_deck_counts_1_4(version.snapshot);
 if version.snapshot->'presentation'is null or version.snapshot#>>'{presentation,cover_note}'<>'Pending Availability.'
  or not exists(select 1 from jsonb_array_elements(version.snapshot->'asset_inventory')a where a->>'asset_kind'='candidate_photo'and a->>'bucket'='eps-candidate-photos'and a->>'asset_id'='a3000000-0000-4000-8000-000000010001')
  or not exists(select 1 from eps.presentation_version_assets where version_id=version.id and asset_kind='candidate_photo')
  or version.manifest->'presentation'<>version.snapshot->'presentation'
  or eps.presentation_render_context(version.snapshot)->'presentation'<>version.snapshot->'presentation'
  or version.page_count<>(counts->>'pages')::integer
 then raise exception'A3_FAIL snapshot % counts %',version.snapshot->'presentation',counts;end if;
 -- Cover + closing, one divider (one sequence), R1 at its auto occurrence and again at its repeat occurrence
 -- (Main|Backup page + one option page each), R2 (open) one silhouette page. The TS mirror test covers the rest.
 if (counts->>'pages')::integer<>2+1+2+2+1 or (counts->>'candidate_fields')::integer<>0 or (counts->>'video_links')::integer<>0 then raise exception'A3_FAIL counts %',counts;end if;
 -- Guests get the context with per-version role keys instead of internal identities.
 guest:=eps.guest_presentation_1_4(version.snapshot);
 if guest->'presentation_role_keys'<>'["r1","r1","r1","r4"]'::jsonb or guest#>>'{presentation,scenes,0,occurrences,0,role_id}'<>'r1'
  or guest::text like'%a3000000-0000-4000-8000-0000000e0101%'then raise exception'A3_FAIL guest context %',guest;end if;
 -- Hidden links and the scene that prints nothing never reach guests (the snapshot keeps them), and the deck a guest
 -- composes from what it receives equals the PDF deck.
 if guest::text like'%Secret%'or jsonb_array_length(guest#>'{presentation,scenes}')<>2 or jsonb_array_length(guest#>'{presentation,scenes,0,occurrences}')<>1
  or version.snapshot::text not like'%Secret hidden note%'then raise exception'A3_FAIL guest printed-only scenes %',guest#>'{presentation,scenes}';end if;
 if eps.editorial_deck_counts_1_4(pg_temp.a3_guest_snapshot(version.snapshot))<>counts then raise exception'A3_FAIL guest deck differs %',guest#>'{presentation,scenes}';end if;
 -- Earlier snapshots keep their manifest and render context shape.
 if eps.presentation_manifest(version.snapshot-'presentation')?'presentation'or eps.presentation_render_context(version.snapshot-'presentation')?'presentation'then raise exception'A3_FAIL older shape';end if;
end $$;
-- The 1.3.0 series is unchanged in kind: it still refuses generation while the photo-only portrait is pinned.
set local role authenticated;
do $$declare legacy jsonb;begin
 legacy:=public.eps_get_workspace_review('a3000000-0000-4000-8000-00000000d001',current_setting('a3.legacy')::uuid,null);
 if legacy->'template'->>'version'<>'1.3.0'or legacy?'presentation'then raise exception'A3_FAIL legacy series changed %',legacy->'template';end if;
end $$;
reset role;
update eps.workspace_candidates set portrait_asset_id=null,portrait_source=null,portrait_crop=null,media_selection_state='intentionally_empty' where id='a3000000-0000-4000-8000-000000030001';
set local role authenticated;
do $$declare legacy jsonb;begin
 legacy:=public.eps_get_workspace_review('a3000000-0000-4000-8000-00000000d001',current_setting('a3.legacy')::uuid,null);
 if not exists(select 1 from jsonb_array_elements(legacy->'issues')i where i->>'code'='TEMPLATE_PORTRAIT_EMPTY_IGNORED'and i->>'severity'='warning'
   and i->>'entity_id'='a3000000-0000-4000-8000-000000040001'and i->>'repair_action'like'%1.4.0%')
 then raise exception'A3_FAIL legacy empty picture warning %',legacy->'issues';end if;
end $$;
reset role;
-- Guest scene grouping stays identical to the PDF when scenes that print nothing are left out (synthetic snapshots):
-- between two printing scenes of one sequence a neutral separator keeps them apart; inside a printing sequence the
-- empty scene stays as a stub without its own title, number or setting.
do $$declare base jsonb;snap jsonb;guest jsonb;begin
 base:=jsonb_build_object('cover',jsonb_build_object('client_name','Synthetic','logo_asset_id',null),
  'slides',jsonb_build_array(jsonb_build_object('kind','candidate','role_id','R1','slot_id','S1','position','main','frames','[]'::jsonb),
   jsonb_build_object('kind','open_slot','role_id','R2','slot_id','S2','position',null,'frames','[]'::jsonb)),
  'presentation',jsonb_build_object('cover_note',null,'slides',jsonb_build_array(
   jsonb_build_object('role_note',null,'slot_note',null,'picture_state','pinned','portrait',null),jsonb_build_object('role_note',null,'slot_note',null,'picture_state',null,'portrait',null))));
 snap:=jsonb_set(base,'{presentation,scenes}',jsonb_build_array(
  jsonb_build_object('scene_id','X','scene_number','1','title','Arrival','sequence_label','Seq A','setting',null,'occurrences',jsonb_build_array(jsonb_build_object('occurrence_id','o1','role_id','R1','display_title',null,'setting_override',null,'presentation_note',null,'deck_placement','auto'))),
  jsonb_build_object('scene_id','Y','scene_number','2','title','Hidden middle','sequence_label','Seq B','setting','Hidden place','occurrences',jsonb_build_array(jsonb_build_object('occurrence_id','o2','role_id','R2','display_title','Hidden title','setting_override',null,'presentation_note','Hidden note','deck_placement','hidden'))),
  jsonb_build_object('scene_id','Z','scene_number','3','title','Departure','sequence_label','Seq A','setting',null,'occurrences',jsonb_build_array(jsonb_build_object('occurrence_id','o3','role_id','R1','display_title',null,'setting_override',null,'presentation_note',null,'deck_placement','repeat')))));
 guest:=eps.guest_presentation_1_4(snap);
 if guest::text like'%Hidden%'or jsonb_array_length(guest#>'{presentation,scenes}')<>3 or guest#>'{presentation,scenes,1,sequence_label}'<>'null'::jsonb
  or eps.editorial_deck_counts_1_4(pg_temp.a3_guest_snapshot(snap))<>eps.editorial_deck_counts_1_4(snap)
 then raise exception'A3_FAIL guest separator %',guest#>'{presentation,scenes}';end if;
 snap:=jsonb_set(snap,'{presentation,scenes,1,sequence_label}','"Seq A"');
 guest:=eps.guest_presentation_1_4(snap);
 if guest::text like'%Hidden%'or jsonb_array_length(guest#>'{presentation,scenes}')<>3 or guest#>>'{presentation,scenes,1,title}'<>'Seq A'
  or guest#>'{presentation,scenes,1,occurrences}'<>'[]'::jsonb or eps.editorial_deck_counts_1_4(pg_temp.a3_guest_snapshot(snap))<>eps.editorial_deck_counts_1_4(snap)
 then raise exception'A3_FAIL guest stub %',guest#>'{presentation,scenes}';end if;
end $$;
select json_build_object('result','passed','checks',json_build_array('audience_default_required','archived_default_refused','default_saved','legacy_photo_explained',
 'role_slot_notes','note_length','template_1_4_via_settings','explicit_context_series','cover_note','scenes_captured','portraits_captured','no_picture_warning',
 'fingerprint_tracks_presentation','processing_distinct','intentionally_empty','fit_stage_path_photo_portrait','generation_snapshot','photo_inventory','manifest_render_context','mirror_pages',
 'guest_context','guest_printed_scenes_only','guest_deck_equals_pdf','older_shapes','legacy_empty_picture_warning','guest_grouping_separator','guest_grouping_stub'))::text;
rollback;
