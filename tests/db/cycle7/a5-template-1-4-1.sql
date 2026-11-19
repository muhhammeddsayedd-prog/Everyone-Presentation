-- Cycle 8 A5: m23 template 1.4.1 (1.4.0 layout + name, age and height under each portrait): registration beside an
-- unchanged 1.4.0, Settings, review capture of the presentation context, fit stage path, generation (snapshot,
-- archive-photo inventory and pin, page count), the caption-region mirror, guest context, fit messages, and the
-- height grammar shared with packages/templates/versions/1.4.1/compose-casting.ts.
-- Synthetic metadata only (no real people or media). Runs as supabase_admin on the disposable replica; rolls back.
begin;
set local search_path='';
alter table auth.users add column if not exists is_anonymous boolean not null default false,add column if not exists deleted_at timestamptz,add column if not exists banned_until timestamptz;

-- Registration: 1.4.1 is registered with the pinned identity; 1.4.0 keeps its own; the default is not 1.4.1.
do $$begin
 if not exists(select 1 from eps.presentation_templates where key='everyone-casting'and version='1.4.1'and registered and font_key='everyone-film-fonts-v1'
   and content_sha256 ~'^[a-f0-9]{64}$'and(select count(*)from jsonb_object_keys(font_hashes))=9
   and font_hashes=(select font_hashes from eps.presentation_templates where key='everyone-casting'and version='1.4.0'))
 or not exists(select 1 from eps.presentation_templates where key='everyone-casting'and version='1.4.0'and registered and content_sha256='b4fbd16ff5038c8a97583d1225294fbe0c26b71439f850e7fb888ff4320b9ac8')
 or(select count(*)from eps.presentation_templates where key='everyone-casting'and registered)<>6
 or coalesce((select template_version from eps.app_settings where singleton),'')='1.4.1'
 then raise exception'A5_FAIL registration';end if;
end $$;

-- The height grammar agrees with the composer on every case (expected values printed by captionHeight).
do $$declare item jsonb;begin
 for item in select v from jsonb_array_elements($json$[["Height: 173; weight: 77. Units not stated.",true],["180 cm",true],["weight 70 kg",false],["",false],["   ",false],["Not provided",false],["PENDING",false],["173",true],["180.",true],["1.73m",true],["Height:173cm",true],["5'11\"",true],["5′ 11″",true],["180 cm, 75 kg",true],["77 kg",false],["Height / Measurements",false],["Height: unknown; 180",false],["Chest 90, height 182 cm",true],["Height 180 in Cairo",true],["height is 6 ft",true],["1735",false],["éheight 180",true],["height_180",false],["xheight: 180",false],["HEIGHT=180CM",true],["Height (cm): 173",false],["Weight: 60; Height - 1,68 m",true],["Units not stated",false],["6ft2",true],["Height: 72 in.",true],["170 centimetres tall",true],["Hauteur 170 cm",false],["١٧٣",false],["height: 175 cm",true],["Height:  180 mm",true]]$json$::jsonb)v loop
  if eps.editorial141_has_height(item->0)is distinct from(item->>1)::boolean then raise exception'A5_FAIL height % expected %',item->0,item->1;end if;
 end loop;
 if eps.editorial141_has_height('null'::jsonb)or eps.editorial141_has_height('173'::jsonb)or eps.editorial141_provided('" Pending "'::jsonb)or not eps.editorial141_provided('" Layla "'::jsonb)
 then raise exception'A5_FAIL provided';end if;
 if eps.review_fit_message('presentation.caption_name',false)<>'The name under the portrait does not fit on two lines.'
  or eps.review_fit_message('presentation.caption_details',true)not like'Shorten this person''s age or height wording%'
  or eps.review_fit_message('presentation.note',false)<>'The highlighted note does not fit on one line.'
  or eps.review_fit_message('name_or_id',false)<>'Text exceeds the selected slide layout.'
 then raise exception'A5_FAIL fit messages';end if;
end $$;

set local session_replication_role=replica;
insert into auth.users(id,instance_id,aud,role,email) values
 ('a5000000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a5-producer@example.invalid');
insert into public.app_capability_grants(principal_id,capability) select 'a5000000-0000-4000-8000-0000000000a1',capability
 from unnest(array['projects.read','workspaces.read','workspaces.write','cast.read','cast.write','presentations.generate','settings.manage','review_links.manage']) capability;
insert into public.projects(id,name) values('a5000000-0000-4000-8000-00000000c001','A5 synthetic project');
insert into public.project_memberships(project_id,principal_id,can_write) values('a5000000-0000-4000-8000-00000000c001','a5000000-0000-4000-8000-0000000000a1',true);
insert into eps.workspaces(id,project_id) values('a5000000-0000-4000-8000-00000000d001','a5000000-0000-4000-8000-00000000c001');
insert into eps.app_settings(singleton,template_version) values(true,'1.4.0') on conflict(singleton) do update set template_version='1.4.0',default_audience_preset_id=null;
insert into eps.presentation_processing_config(id,enabled,renderer_version,application_origin) values(true,true,'everyone-casting-pdf-v1','http://127.0.0.1:3000')
 on conflict(id) do update set enabled=true,renderer_version='everyone-casting-pdf-v1',application_origin='http://127.0.0.1:3000';
insert into eps.audience_presets(id,key,label,scope) values('a5000000-0000-4000-8000-0000000a1c01','a5-client','Client','external');
-- Role R1 (one slot: Main P1 frame portrait, Backup P2 photo portrait, Option P3 no picture) and R2 (one open slot).
insert into eps.roles(id,workspace_id,name,requirements,sort_order) values
 ('a5000000-0000-4000-8000-0000000e0101','a5000000-0000-4000-8000-00000000d001','Saudi Daughter','{}',0),
 ('a5000000-0000-4000-8000-0000000e0102','a5000000-0000-4000-8000-00000000d001','Web Designer','{}',1);
insert into eps.slots(id,workspace_id,role_id,ordinal,label,sort_order) values
 ('a5000000-0000-4000-8000-0000000e0201','a5000000-0000-4000-8000-00000000d001','a5000000-0000-4000-8000-0000000e0101',1,'Slot 1',0),
 ('a5000000-0000-4000-8000-0000000e0202','a5000000-0000-4000-8000-00000000d001','a5000000-0000-4000-8000-0000000e0102',1,'Slot 1',0);
-- P1: name, age and labelled height (+ weight); P2: name and a bare height; P3: name and only a weight.
insert into eps.candidates(id,facts,casting_id,source_kind,created_by,reviewed_facts_fingerprint)
select id,jsonb_build_object('name','A5 Person '||n,'casting_id','A5-'||n,'age_or_range',age,'stated_gender',null,'height_measurements',height,'languages','[]'::jsonb,'accents','[]'::jsonb,'skills_experience','Secret skill','city','Secret city','previous_projects_roles',null,'classification',null),
 'A5-'||n,'manual','a5000000-0000-4000-8000-0000000000a1',null
from (values(1,'a5000000-0000-4000-8000-0000000e0001'::uuid,'34','Height: 173; weight: 77. Units not stated.'),(2,'a5000000-0000-4000-8000-0000000e0002',null,'180 cm'),(3,'a5000000-0000-4000-8000-0000000e0003',null,'weight 70 kg')) v(n,id,age,height);
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,duration_ms,status) values
 ('a5000000-0000-4000-8000-0000000a0001','a5000000-0000-4000-8000-00000000d001','candidate_video','v1.mp4','video/mp4','eps-candidate-assets','assets/a5/v1.mp4',1000,repeat('a',64),640,480,10000,'ready');
insert into eps.candidate_media(id,candidate_id,source_asset_id,selected_frame_asset_ids) values
 ('a5000000-0000-4000-8000-0000000b0001','a5000000-0000-4000-8000-0000000e0001','a5000000-0000-4000-8000-0000000a0001','{a5000000-0000-4000-8000-0000000f0001}');
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,status,source_asset_id,producing_job_id,producing_attempt_id,output_stage,output_key,source_timestamp_ms) values
 ('a5000000-0000-4000-8000-0000000f0001','a5000000-0000-4000-8000-00000000d001','candidate_frame','f1.jpg','image/jpeg','eps-candidate-outputs','frames/a5/f1.jpg',1000,repeat('c',64),1080,1920,'ready','a5000000-0000-4000-8000-0000000a0001',gen_random_uuid(),gen_random_uuid(),'prepare_candidate','frame_1',100);
insert into eps.candidate_media_frames(candidate_media_id,asset_id) values('a5000000-0000-4000-8000-0000000b0001','a5000000-0000-4000-8000-0000000f0001');
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,status) values
 ('a5000000-0000-4000-8000-000000010001','a5000000-0000-4000-8000-00000000d001','candidate_photo','p2.jpg','image/jpeg','eps-candidate-photos','archive/a5/p2.jpg',1000,repeat('d',64),800,1000,'ready'),
 ('a5000000-0000-4000-8000-000000010002','a5000000-0000-4000-8000-00000000d001','candidate_photo','t2.jpg','image/jpeg','eps-candidate-photos','archive/a5/t2.jpg',100,repeat('e',64),80,100,'ready');
insert into eps.candidate_photos(id,candidate_id,position,asset_id,thumb_asset_id,width,height,source_key) values
 ('a5000000-0000-4000-8000-000000020002','a5000000-0000-4000-8000-0000000e0002',1,'a5000000-0000-4000-8000-000000010001','a5000000-0000-4000-8000-000000010002',800,1000,'a5/p2');
insert into eps.workspace_candidates(id,workspace_id,candidate_id,selected_candidate_media_id,selected_frame_asset_ids,portrait_asset_id,portrait_source,portrait_crop,media_selection_state) values
 ('a5000000-0000-4000-8000-000000030001','a5000000-0000-4000-8000-00000000d001','a5000000-0000-4000-8000-0000000e0001','a5000000-0000-4000-8000-0000000b0001','{a5000000-0000-4000-8000-0000000f0001}','a5000000-0000-4000-8000-0000000f0001','frame',null,'pinned'),
 ('a5000000-0000-4000-8000-000000030002','a5000000-0000-4000-8000-00000000d001','a5000000-0000-4000-8000-0000000e0002',null,'{}','a5000000-0000-4000-8000-000000010001','photo','{"focal_x":0.3,"focal_y":0.25}','pinned'),
 ('a5000000-0000-4000-8000-000000030003','a5000000-0000-4000-8000-00000000d001','a5000000-0000-4000-8000-0000000e0003',null,'{}',null,null,null,'intentionally_empty');
insert into eps.assignments(id,workspace_id,slot_id,workspace_candidate_id,position,shortlist_included,sort_order) values
 ('a5000000-0000-4000-8000-000000040001','a5000000-0000-4000-8000-00000000d001','a5000000-0000-4000-8000-0000000e0201','a5000000-0000-4000-8000-000000030001','main',true,0),
 ('a5000000-0000-4000-8000-000000040002','a5000000-0000-4000-8000-00000000d001','a5000000-0000-4000-8000-0000000e0201','a5000000-0000-4000-8000-000000030002','backup',true,1),
 ('a5000000-0000-4000-8000-000000040003','a5000000-0000-4000-8000-00000000d001','a5000000-0000-4000-8000-0000000e0201','a5000000-0000-4000-8000-000000030003','option',true,2);
-- Scenes: R1 auto in Front Door and Home Gathering of one sequence (printed once) and repeated in a later scene.
insert into eps.scenes(id,workspace_id,scene_number,title,sequence_label,setting,sort_order) values
 ('a5000000-0000-4000-8000-000000050001','a5000000-0000-4000-8000-00000000d001','1','Front Door','Mother’s Birthday',null,0),
 ('a5000000-0000-4000-8000-000000050002','a5000000-0000-4000-8000-00000000d001','2','Home Gathering','Mother’s Birthday',null,1),
 ('a5000000-0000-4000-8000-000000050003','a5000000-0000-4000-8000-00000000d001','3','Farewell',null,'Garden',2);
insert into eps.scene_occurrences(id,workspace_id,scene_id,role_id,display_title,presentation_note,deck_placement,sort_order) values
 ('a5000000-0000-4000-8000-000000060001','a5000000-0000-4000-8000-00000000d001','a5000000-0000-4000-8000-000000050001','a5000000-0000-4000-8000-0000000e0101',null,null,'auto',0),
 ('a5000000-0000-4000-8000-000000060002','a5000000-0000-4000-8000-00000000d001','a5000000-0000-4000-8000-000000050002','a5000000-0000-4000-8000-0000000e0101',null,'We’ll choose Only One.','auto',0),
 ('a5000000-0000-4000-8000-000000060003','a5000000-0000-4000-8000-00000000d001','a5000000-0000-4000-8000-000000050002','a5000000-0000-4000-8000-0000000e0102','Web Designer',null,'auto',1),
 ('a5000000-0000-4000-8000-000000060004','a5000000-0000-4000-8000-00000000d001','a5000000-0000-4000-8000-000000050003','a5000000-0000-4000-8000-0000000e0101',null,null,'repeat',0);
set local session_replication_role=origin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a5000000-0000-4000-8000-0000000000a1","role":"authenticated","is_anonymous":false}',true),set_config('request.jwt.claim.sub','a5000000-0000-4000-8000-0000000000a1',true);
do $$declare settings jsonb;series jsonb;older jsonb;review jsonb;begin
 settings:=public.eps_get_settings();
 settings:=public.eps_update_settings(jsonb_build_object('row_version',(settings->>'row_version')::bigint,'default_audience_preset_id','a5000000-0000-4000-8000-0000000a1c01'),'a5-settings-key-000001');
 -- A 1.4.0 series made before the switch keeps 1.4.0 and its capture.
 older:=public.eps_create_presentation_series('{"workspace_id":"a5000000-0000-4000-8000-00000000d001","output_type":"shortlist"}','a5-series-key-0000001');
 if older->>'template_version'<>'1.4.0'then raise exception'A5_FAIL older series %',older;end if;
 review:=public.eps_get_workspace_review('a5000000-0000-4000-8000-00000000d001',(older->>'id')::uuid,null);
 if review#>>'{template,version}'<>'1.4.0'or not review?'presentation'then raise exception'A5_FAIL 1.4.0 review %',review->'template';end if;
 -- 1.4.1 becomes the default only through Settings (m23 never sets it).
 settings:=public.eps_update_settings(jsonb_build_object('row_version',(settings->>'row_version')::bigint,'template_version','1.4.1'),'a5-settings-key-000002');
 if settings->>'template_version'<>'1.4.1'then raise exception'A5_FAIL settings %',settings;end if;
 series:=public.eps_create_presentation_series('{"workspace_id":"a5000000-0000-4000-8000-00000000d001","output_type":"shortlist"}','a5-series-key-0000002');
 if series->>'template_version'<>'1.4.1'or series->>'id'=older->>'id'then raise exception'A5_FAIL 1.4.1 series %',series;end if;
 perform set_config('a5.series_sha',series->>'template_content_sha256',true);
 series:=public.eps_update_presentation_series((series->>'id')::uuid,'{"row_version":1,"cover_note":"Pending Availability."}','a5-cover-key-0000001');
 perform set_config('a5.series',series->>'id',true);
 review:=public.eps_get_workspace_review('a5000000-0000-4000-8000-00000000d001',(series->>'id')::uuid,null);
 -- The 1.4.1 review captures the same presentation context as 1.4.0 and the facts the captions print.
 if review#>>'{template,version}'<>'1.4.1'or review#>>'{presentation,cover_note}'<>'Pending Availability.'or jsonb_array_length(review#>'{presentation,scenes}')<>3
  or review#>'{presentation,slides,1,portrait}'<>jsonb_build_object('asset_id','a5000000-0000-4000-8000-000000010001','source','photo','width',800,'height',1000,'sha256',repeat('d',64),'focal',jsonb_build_array(300,250))
  or review#>>'{presentation,slides,2,picture_state}'<>'intentionally_empty'
  or review#>>'{slides,0,fields,name_or_id}'<>'A5 Person 1'or review#>>'{slides,0,fields,age_or_range}'<>'34'
  or review#>>'{slides,0,fields,height_measurements}'<>'Height: 173; weight: 77. Units not stated.'or review#>>'{slides,1,fields,age_or_range}'<>'Not provided'
  or exists(select 1 from jsonb_array_elements(review->'issues')i where i->>'code'in('TEMPLATE_UPGRADE_REQUIRED','TEMPLATE_PORTRAIT_UNSUPPORTED','TEMPLATE_PORTRAIT_SUBSTITUTED'))
 then raise exception'A5_FAIL 1.4.1 review % issues %',review->'presentation',review->'issues';end if;
 perform set_config('a5.fingerprint',review->>'input_fingerprint',true);
end $$;

-- Fit measurement through the real worker stage path, as for 1.4.0 (nine fonts; photo portrait in the stage input).
reset role;
grant usage on schema extensions to eps_review_stage_owner;
insert into eps.review_processing_config(id,enabled,model,prompt_version,renderer_version) values(true,true,'synthetic-model','synthetic-prompt','everyone-casting-pdf-v1')
 on conflict(id) do update set enabled=true,renderer_version='everyone-casting-pdf-v1';
set local role authenticated;
do $$declare queued jsonb;begin
 queued:=public.eps_request_workspace_review_fit('a5000000-0000-4000-8000-00000000d001',current_setting('a5.series')::uuid,jsonb_build_object('expected_input_fingerprint',current_setting('a5.fingerprint')),'a5-fit-key-000000001');
 perform set_config('a5.fit_job',queued->>'job_id',true);
end $$;
reset role;
do $$declare job eps.jobs;claim jsonb;input jsonb;receipt jsonb;fonts jsonb;begin
 select * into job from eps.jobs where id=current_setting('a5.fit_job')::uuid;
 if job.input#>>'{template,version}'<>'1.4.1'or not eps.review_stage_source_matches(job)then raise exception'A5_FAIL stage source %',job.input->'template';end if;
 claim:=eps.claim_review_job_stage(jsonb_build_object('job_id',job.id,'stage','measure_review_fit','input_hash',job.input_hash));
 input:=eps.get_review_stage_input(job.id,(claim->>'attempt_id')::uuid,claim->>'lease_token');
 if input#>>'{review,presentation,slides,1,portrait,source}'<>'photo'or input#>>'{review,template,version}'<>'1.4.1'then raise exception'A5_FAIL stage input %',input#>'{review,template}';end if;
 select font_hashes into fonts from eps.presentation_templates where key='everyone-casting'and version='1.4.1';
 receipt:=eps.record_review_job_event(jsonb_build_object('event_id','a5-fit-measured','job_id',job.id,'attempt_id',claim->>'attempt_id','lease_token',claim->>'lease_token',
  'stage','measure_review_fit','sequence',1,'event_type','succeeded','input_hash',job.input_hash,'result_schema','review-fit-measurement.v1',
  'result',jsonb_build_object('schema_version','1.0','input_fingerprint',current_setting('a5.fingerprint'),'template_content_sha256',job.input#>>'{template,content_sha256}',
   'renderer_version',job.input#>>'{configuration,renderer_version}','chromium_version','synthetic-chromium','font_hashes',fonts,'overflows','[]'::jsonb,
   'measured_at',to_char(clock_timestamp()at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'))));
 if receipt->>'job_status'<>'succeeded'then raise exception'A5_FAIL fit not recorded % %',receipt,(select error from eps.jobs where id=job.id);end if;
end $$;
select set_config('a5.wsrv',(select row_version::text from eps.workspaces where id='a5000000-0000-4000-8000-00000000d001'),true);
set local role authenticated;
do $$declare review jsonb;accepted jsonb;begin
 review:=public.eps_get_workspace_review('a5000000-0000-4000-8000-00000000d001',current_setting('a5.series')::uuid,null);
 if review->'can_generate'<>'true'::jsonb then raise exception'A5_FAIL not generatable %',review->'issues';end if;
 accepted:=public.eps_generate_version(current_setting('a5.series')::uuid,jsonb_build_object('expected_workspace_row_version',current_setting('a5.wsrv')::bigint,
  'expected_draft_revision',(review->>'draft_revision')::bigint,'expected_input_fingerprint',review->>'input_fingerprint'),'a5-generate-key-00001');
 perform set_config('a5.version',accepted->>'resource_id',true);
end $$;
reset role;
do $$declare version eps.presentation_versions;counts jsonb;base jsonb;guest jsonb;snap jsonb;begin
 select * into version from eps.presentation_versions where id=current_setting('a5.version')::uuid;
 counts:=eps.editorial_deck_counts_1_4_1(version.snapshot);base:=eps.editorial_deck_counts_1_4(version.snapshot);
 if version.snapshot#>>'{template,version}'<>'1.4.1'or version.snapshot->'presentation'is null
  or version.snapshot#>>'{template,content_sha256}'<>current_setting('a5.series_sha')
  or current_setting('a5.series_sha')<>(select t.content_sha256 from eps.presentation_templates t where t.key='everyone-casting'and t.version='1.4.1')
  or not exists(select 1 from jsonb_array_elements(version.snapshot->'asset_inventory')a where a->>'asset_kind'='candidate_photo'and a->>'asset_id'='a5000000-0000-4000-8000-000000010001')
  or not exists(select 1 from eps.presentation_version_assets where version_id=version.id and asset_kind='candidate_photo')
  or version.manifest->'presentation'<>version.snapshot->'presentation'
  or version.page_count<>(counts->>'pages')::integer
 then raise exception'A5_FAIL snapshot % counts %',version.snapshot->'presentation',counts;end if;
 -- Captions never change pages or pictures. R1 prints twice (auto + repeat): P1 name + "34 | 173" (2 regions),
 -- P2 name + "180 cm" (2), P3 name only (1; a weight is not a height) -> 5 per print, 10 in all; R2 is open (none).
 if counts-'text_regions'<>base-'text_regions'or(counts->>'text_regions')::integer<>(base->>'text_regions')::integer+10
  or(counts->>'pages')::integer<>2+2+2+1+2 or(counts->>'candidate_fields')::integer<>0 or(counts->>'video_links')::integer<>0
 then raise exception'A5_FAIL counts % base %',counts,base;end if;
 -- Guests receive the 1.4.1 presentation context (version-agnostic since m19) and compose the same counts.
 guest:=eps.guest_presentation_1_4(version.snapshot);
 snap:=jsonb_set(jsonb_set(version.snapshot,'{presentation,scenes}',guest#>'{presentation,scenes}'),'{slides}',
  (select jsonb_agg(v||jsonb_build_object('role_id',guest->'presentation_role_keys'->((n-1)::integer))order by n)
   from(select v,row_number()over(order by o)n from jsonb_array_elements(version.snapshot->'slides')with ordinality x(v,o)where v->>'kind'<>'cover')q));
 if guest->'presentation_role_keys'<>'["r1","r1","r1","r4"]'::jsonb or eps.editorial_deck_counts_1_4_1(snap)<>counts then raise exception'A5_FAIL guest %',guest;end if;
 -- Without the scenes every role prints once; a role with only hidden occurrences prints once in the opening section.
 if(eps.editorial_deck_counts_1_4_1(version.snapshot#-'{presentation,scenes}')->>'text_regions')::integer
   <>(eps.editorial_deck_counts_1_4(version.snapshot#-'{presentation,scenes}')->>'text_regions')::integer+5
 then raise exception'A5_FAIL no scenes';end if;
 snap:=jsonb_set(version.snapshot,'{presentation,scenes}',jsonb_build_array(jsonb_build_object('scene_id','s','scene_number',null,'title','Only hidden','sequence_label',null,'setting',null,
  'occurrences',jsonb_build_array(jsonb_build_object('occurrence_id','o','role_id','a5000000-0000-4000-8000-0000000e0101','display_title',null,'setting_override',null,'presentation_note',null,'deck_placement','hidden')))));
 if(eps.editorial_deck_counts_1_4_1(snap)->>'text_regions')::integer<>(eps.editorial_deck_counts_1_4(snap)->>'text_regions')::integer+5 then raise exception'A5_FAIL hidden only';end if;
 -- A 1.4.0 snapshot of the same content is still counted by the 1.4.0 mirror (no captions).
 if eps.editorial_deck_counts_1_4(jsonb_set(version.snapshot,'{template,version}','"1.4.0"'))<>base then raise exception'A5_FAIL 1.4.0 unchanged';end if;
end $$;
select json_build_object('result','passed','checks',json_build_array('registration','height_grammar','fit_messages','older_series_keeps_1_4_0','settings_1_4_1',
 'review_capture','fit_stage_path','generation_snapshot','photo_inventory_and_pin','page_count','caption_regions','guest_context','scene_prints','mirror_1_4_0_unchanged'))::text;
rollback;
