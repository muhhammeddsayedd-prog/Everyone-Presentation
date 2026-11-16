-- Cycle 7 A1: project membership, default media pins, picture fields, library-edit isolation,
-- media repairs, the extra-tape save step, get_job candidate_result and the uploads list.
-- Synthetic metadata only (no real people or media). Runs as supabase_admin; rolls back.
begin;
set local search_path='';
-- The bare replica image lacks GoTrue's is_anonymous/deleted_at/banned_until columns (canonical has them).
alter table auth.users add column if not exists is_anonymous boolean not null default false,add column if not exists deleted_at timestamptz,add column if not exists banned_until timestamptz;
set local session_replication_role=replica;
insert into auth.users(id,instance_id,aud,role,email) values
 ('a1000000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a1-producer@example.invalid'),
 ('a1000000-0000-4000-8000-0000000000b2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a1-editor@example.invalid');
insert into public.app_capability_grants(principal_id,capability) select actor,capability from unnest(array['a1000000-0000-4000-8000-0000000000a1','a1000000-0000-4000-8000-0000000000b2']::uuid[]) actor
 cross join unnest(array['projects.read','workspaces.read','workspaces.write','cast.read','cast.write','cast.upload','cast.review']) capability;
insert into public.projects(id,name) values('a1000000-0000-4000-8000-00000000c001','A1 synthetic project');
insert into public.project_memberships(project_id,principal_id,can_write) values
 ('a1000000-0000-4000-8000-00000000c001','a1000000-0000-4000-8000-0000000000a1',true),('a1000000-0000-4000-8000-00000000c001','a1000000-0000-4000-8000-0000000000b2',true);
insert into eps.workspaces(id,project_id) values('a1000000-0000-4000-8000-00000000d001','a1000000-0000-4000-8000-00000000c001');
-- People: P1 two introductions (older M1 with F1..F3, newer M2 with F4), P2 cover photo + M3 (F5),
-- P3 nothing, P4 legacy row with M4 (F6), P5 the extra-tape target (cover photo), P6 archived.
insert into eps.candidates(id,facts,casting_id,source_kind,created_by,created_at)
select id,jsonb_build_object('name','A1 Person '||n,'casting_id','A1-'||n,'age_or_range',null,'stated_gender',null,'height_measurements',null,'languages','[]'::jsonb,'accents','[]'::jsonb,'skills_experience',null,'city',null,'previous_projects_roles',null,'classification',null),
 'A1-'||n,'manual','a1000000-0000-4000-8000-0000000000a1',timestamptz '2026-01-01 00:00:00+00'+n*interval '1 hour'
from (values(1,'a1000000-0000-4000-8000-0000000e0001'::uuid),(2,'a1000000-0000-4000-8000-0000000e0002'),(3,'a1000000-0000-4000-8000-0000000e0003'),(4,'a1000000-0000-4000-8000-0000000e0004'),(5,'a1000000-0000-4000-8000-0000000e0005'),(6,'a1000000-0000-4000-8000-0000000e0006')) v(n,id);
update eps.candidates set archived_at=clock_timestamp() where id='a1000000-0000-4000-8000-0000000e0006';
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,duration_ms,status)
select id,'a1000000-0000-4000-8000-00000000d001','candidate_video','v'||n||'.mp4','video/mp4','eps-candidate-assets','assets/a1/v'||n||'.mp4',1000,repeat('a',64),640,480,10000,'ready'
from (values(1,'a1000000-0000-4000-8000-0000000a0001'::uuid),(2,'a1000000-0000-4000-8000-0000000a0002'),(3,'a1000000-0000-4000-8000-0000000a0003'),(4,'a1000000-0000-4000-8000-0000000a0004'),(5,'a1000000-0000-4000-8000-0000000a0005')) v(n,id);
insert into eps.candidate_media(id,candidate_id,source_asset_id,selected_frame_asset_ids,created_at) values
 ('a1000000-0000-4000-8000-0000000b0001','a1000000-0000-4000-8000-0000000e0001','a1000000-0000-4000-8000-0000000a0001','{a1000000-0000-4000-8000-0000000f0002,a1000000-0000-4000-8000-0000000f0001}','2026-02-01 00:00:00+00'),
 ('a1000000-0000-4000-8000-0000000b0002','a1000000-0000-4000-8000-0000000e0001','a1000000-0000-4000-8000-0000000a0002','{a1000000-0000-4000-8000-0000000f0004}','2026-02-02 00:00:00+00'),
 ('a1000000-0000-4000-8000-0000000b0003','a1000000-0000-4000-8000-0000000e0002','a1000000-0000-4000-8000-0000000a0003','{a1000000-0000-4000-8000-0000000f0005}','2026-02-03 00:00:00+00'),
 ('a1000000-0000-4000-8000-0000000b0004','a1000000-0000-4000-8000-0000000e0004','a1000000-0000-4000-8000-0000000a0004','{a1000000-0000-4000-8000-0000000f0006}','2026-02-04 00:00:00+00');
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,status,source_asset_id,producing_job_id,producing_attempt_id,output_stage,output_key,source_timestamp_ms)
select id,'a1000000-0000-4000-8000-00000000d001','candidate_frame','f'||n||'.jpg','image/jpeg','eps-candidate-outputs','frames/a1/f'||n||'.jpg',1000,repeat('c',64),320,240,'ready',video,gen_random_uuid(),gen_random_uuid(),'prepare_candidate','frame_'||n,n*100
from (values(1,'a1000000-0000-4000-8000-0000000f0001'::uuid,'a1000000-0000-4000-8000-0000000a0001'::uuid),(2,'a1000000-0000-4000-8000-0000000f0002','a1000000-0000-4000-8000-0000000a0001'),(3,'a1000000-0000-4000-8000-0000000f0003','a1000000-0000-4000-8000-0000000a0001'),
 (4,'a1000000-0000-4000-8000-0000000f0004','a1000000-0000-4000-8000-0000000a0002'),(5,'a1000000-0000-4000-8000-0000000f0005','a1000000-0000-4000-8000-0000000a0003'),(6,'a1000000-0000-4000-8000-0000000f0006','a1000000-0000-4000-8000-0000000a0004')) v(n,id,video);
insert into eps.candidate_media_frames(candidate_media_id,asset_id) values
 ('a1000000-0000-4000-8000-0000000b0001','a1000000-0000-4000-8000-0000000f0001'),('a1000000-0000-4000-8000-0000000b0001','a1000000-0000-4000-8000-0000000f0002'),('a1000000-0000-4000-8000-0000000b0001','a1000000-0000-4000-8000-0000000f0003'),
 ('a1000000-0000-4000-8000-0000000b0002','a1000000-0000-4000-8000-0000000f0004'),('a1000000-0000-4000-8000-0000000b0003','a1000000-0000-4000-8000-0000000f0005'),('a1000000-0000-4000-8000-0000000b0004','a1000000-0000-4000-8000-0000000f0006');
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,status)
select id,'a1000000-0000-4000-8000-00000000d001','candidate_photo','p'||n||'.jpg','image/jpeg','eps-candidate-photos','archive/a1/p'||n||'.jpg',1000,repeat('d',64),400,500,'ready'
from (values(1,'a1000000-0000-4000-8000-000000010001'::uuid),(2,'a1000000-0000-4000-8000-000000010002'),(3,'a1000000-0000-4000-8000-000000010003'),(4,'a1000000-0000-4000-8000-000000010004')) v(n,id);
insert into eps.candidate_photos(id,candidate_id,position,asset_id,thumb_asset_id,width,height,source_key) values
 ('a1000000-0000-4000-8000-000000020002','a1000000-0000-4000-8000-0000000e0002',1,'a1000000-0000-4000-8000-000000010001','a1000000-0000-4000-8000-000000010002',400,500,'a1/p2'),
 ('a1000000-0000-4000-8000-000000020005','a1000000-0000-4000-8000-0000000e0005',1,'a1000000-0000-4000-8000-000000010003','a1000000-0000-4000-8000-000000010004',400,500,'a1/p5');
insert into eps.candidate_attributes(candidate_id,cover_photo_id,name_ar,talent_type) values
 ('a1000000-0000-4000-8000-0000000e0002','a1000000-0000-4000-8000-000000020002','شخص اثنان','talent'),
 ('a1000000-0000-4000-8000-0000000e0005','a1000000-0000-4000-8000-000000020005',null,'real_family');
-- Legacy rows (before m15 defaults): P4 with a ready introduction, P3 without media; both unset.
insert into eps.workspace_candidates(id,workspace_id,candidate_id,media_selection_state) values
 ('a1000000-0000-4000-8000-000000030004','a1000000-0000-4000-8000-00000000d001','a1000000-0000-4000-8000-0000000e0004','unset'),
 ('a1000000-0000-4000-8000-000000030003','a1000000-0000-4000-8000-00000000d001','a1000000-0000-4000-8000-0000000e0003','unset');
set local session_replication_role=origin;

-- Act as the producer.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated","is_anonymous":false}',true),set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-0000000000a1',true);
do $$declare added jsonb; again jsonb; photo jsonb; failed text; begin
 -- Default pins: newest ready introduction (M2), its frames, picture = first frame (no cover photo).
 added:=public.eps_add_workspace_candidate('a1000000-0000-4000-8000-00000000d001','{"candidate_id":"a1000000-0000-4000-8000-0000000e0001"}','a1-add-p1-key-000001');
 if added->>'selected_candidate_media_id'<>'a1000000-0000-4000-8000-0000000b0002' or added->'selected_frame_asset_ids'<>'["a1000000-0000-4000-8000-0000000f0004"]'::jsonb
  or added->>'portrait_asset_id'<>'a1000000-0000-4000-8000-0000000f0004' or added->>'portrait_source'<>'frame' or added->>'media_selection_state'<>'pinned' or added->'already_member'<>'false'::jsonb
 then raise exception 'A1_FAIL default pins %',added;end if;
 -- Same key replays exactly.
 again:=public.eps_add_workspace_candidate('a1000000-0000-4000-8000-00000000d001','{"candidate_id":"a1000000-0000-4000-8000-0000000e0001"}','a1-add-p1-key-000001');
 if again<>added then raise exception 'A1_FAIL replay % %',again,added;end if;
 -- A different key (double click, retry after an uncertain response) returns the same membership.
 again:=public.eps_add_workspace_candidate('a1000000-0000-4000-8000-00000000d001','{"candidate_id":"a1000000-0000-4000-8000-0000000e0001"}','a1-add-p1-key-000002');
 if again->>'id'<>added->>'id' or again->'already_member'<>'true'::jsonb then raise exception 'A1_FAIL repeat add %',again;end if;
 perform set_config('a1.pool1',added->>'id',true);
 -- Cover photo wins over a frame.
 photo:=public.eps_add_workspace_candidate('a1000000-0000-4000-8000-00000000d001','{"candidate_id":"a1000000-0000-4000-8000-0000000e0002"}','a1-add-p2-key-000001');
 if photo->>'portrait_asset_id'<>'a1000000-0000-4000-8000-000000010001' or photo->>'portrait_source'<>'photo' or photo->>'selected_candidate_media_id'<>'a1000000-0000-4000-8000-0000000b0003'
 then raise exception 'A1_FAIL cover photo default %',photo;end if;
 perform set_config('a1.pool2',photo->>'id',true);
 -- A picture of someone else is refused.
 begin
  perform public.eps_add_workspace_candidate('a1000000-0000-4000-8000-00000000d001','{"candidate_id":"a1000000-0000-4000-8000-0000000e0005","portrait_asset_id":"a1000000-0000-4000-8000-0000000f0001","portrait_source":"frame"}','a1-add-p5-key-000001');
  failed:='accepted';
 exception when raise_exception then failed:=sqlerrm; end;
 if failed<>'MEDIA_REFERENCE_INVALID' then raise exception 'A1_FAIL foreign picture %',failed;end if;
 -- Shape errors fail before any write.
 begin
  perform public.eps_add_workspace_candidate('a1000000-0000-4000-8000-00000000d001','{"candidate_id":"a1000000-0000-4000-8000-0000000e0005","media_selection_state":"unset"}','a1-add-p5-key-000002');
  failed:='accepted';
 exception when raise_exception then failed:=sqlerrm; end;
 if failed<>'INVALID_REQUEST' then raise exception 'A1_FAIL state shape %',failed;end if;
end $$;
-- A second producer adding the same person converges on the one membership.
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-0000000000b2","role":"authenticated","is_anonymous":false}',true),set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-0000000000b2',true);
do $$declare again jsonb; begin
 again:=public.eps_add_workspace_candidate('a1000000-0000-4000-8000-00000000d001','{"candidate_id":"a1000000-0000-4000-8000-0000000e0001"}','a1-add-p1-key-000001');
 if again->>'id'<>current_setting('a1.pool1') or again->'already_member'<>'true'::jsonb then raise exception 'A1_FAIL other user add %',again;end if;
end $$;
reset role;
do $$begin
 if (select count(*) from eps.workspace_candidates where workspace_id='a1000000-0000-4000-8000-00000000d001' and candidate_id='a1000000-0000-4000-8000-0000000e0001' and archived_at is null)<>1
 then raise exception 'A1_FAIL more than one membership';end if;
end $$;

-- Picture fields on update; library edits leave project pins alone.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated","is_anonymous":false}',true),set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-0000000000a1',true);
do $$declare pool jsonb; failed text; profile jsonb; media jsonb; begin
 pool:=public.eps_update_workspace_candidate(current_setting('a1.pool1')::uuid,'{"row_version":1,"portrait_asset_id":"a1000000-0000-4000-8000-0000000f0001","portrait_source":"frame","portrait_crop":{"focal_x":0.4,"focal_y":0.3},"media_confirmed":true}','a1-upd-p1-key-000001');
 if pool->>'portrait_asset_id'<>'a1000000-0000-4000-8000-0000000f0001' or pool->'portrait_crop'->>'focal_x'<>'0.4' or pool->>'media_selection_state'<>'pinned' or pool->'media_confirmed'<>'true'::jsonb then raise exception 'A1_FAIL set picture %',pool;end if;
 -- Changing the introduction keeps the chosen picture.
 pool:=public.eps_update_workspace_candidate(current_setting('a1.pool1')::uuid,jsonb_build_object('row_version',(pool->>'row_version')::int,'selected_candidate_media_id','a1000000-0000-4000-8000-0000000b0001'),'a1-upd-p1-key-000002');
 if pool->>'portrait_asset_id'<>'a1000000-0000-4000-8000-0000000f0001' or pool->'portrait_crop' is null or pool->'portrait_crop'='null'::jsonb
  or pool->'selected_frame_asset_ids'<>'["a1000000-0000-4000-8000-0000000f0002","a1000000-0000-4000-8000-0000000f0001"]'::jsonb then raise exception 'A1_FAIL intro change kept picture %',pool;end if;
 -- Bad crop is refused.
 begin
  perform public.eps_update_workspace_candidate(current_setting('a1.pool1')::uuid,jsonb_build_object('row_version',(pool->>'row_version')::int,'portrait_crop',jsonb_build_object('focal_x',1.5,'focal_y',0.5)),'a1-upd-p1-key-000003');
  failed:='accepted';
 exception when raise_exception then failed:=sqlerrm; end;
 if failed<>'INVALID_REQUEST' then raise exception 'A1_FAIL crop bound %',failed;end if;
 -- A crop rectangle is not part of the picture contract (outputs use only the focus point): refused, not ignored.
 begin
  perform public.eps_update_workspace_candidate(current_setting('a1.pool1')::uuid,jsonb_build_object('row_version',(pool->>'row_version')::int,'portrait_crop',jsonb_build_object('focal_x',0.5,'focal_y',0.4,'rect',jsonb_build_object('x',0,'y',0,'width',1,'height',1))),'a1-upd-p1-key-000004');
  failed:='accepted';
 exception when raise_exception then failed:=sqlerrm; end;
 if failed<>'INVALID_REQUEST' then raise exception 'A1_FAIL crop rect refused %',failed;end if;
 -- Library edits: facts and the library frame choice never touch the project row.
 profile:=public.eps_get_candidate('a1000000-0000-4000-8000-0000000e0001');
 perform public.eps_update_candidate('a1000000-0000-4000-8000-0000000e0001',jsonb_build_object('row_version',(profile->>'row_version')::int,'facts',(profile->'facts')||'{"city":"Synthetic City"}'),'a1-lib-p1-key-000001');
 perform public.eps_update_candidate_frames('a1000000-0000-4000-8000-0000000b0001','{"row_version":1,"selected_frame_asset_ids":["a1000000-0000-4000-8000-0000000f0003"]}','a1-lib-p1-key-000002');
 perform set_config('a1.pool1_version',pool->>'row_version',true);
 -- Intentionally empty clears the picture and keeps the introduction.
 pool:=public.eps_update_workspace_candidate(current_setting('a1.pool2')::uuid,'{"row_version":1,"media_selection_state":"intentionally_empty"}','a1-upd-p2-key-000001');
 if pool->>'media_selection_state'<>'intentionally_empty' or pool->'portrait_asset_id'<>'null'::jsonb or pool->>'selected_candidate_media_id'<>'a1000000-0000-4000-8000-0000000b0003' then raise exception 'A1_FAIL intentionally empty %',pool;end if;
end $$;
reset role;
do $$declare item eps.workspace_candidates; begin
 select * into item from eps.workspace_candidates where id=current_setting('a1.pool1')::uuid;
 if item.row_version<>current_setting('a1.pool1_version')::bigint or item.portrait_asset_id<>'a1000000-0000-4000-8000-0000000f0001' or item.selected_frame_asset_ids<>'{a1000000-0000-4000-8000-0000000f0002,a1000000-0000-4000-8000-0000000f0001}'::uuid[]
 then raise exception 'A1_FAIL library edit changed project pins %',to_jsonb(item);end if;
end $$;

-- Repairs: suggest only untouched legacy rows; apply only the listed, unchanged ones.
set local role authenticated;
do $$declare suggested jsonb; applied jsonb; again jsonb; begin
 suggested:=public.eps_suggest_media_repairs('a1000000-0000-4000-8000-00000000d001');
 if jsonb_array_length(suggested->'data')<>2
  or (select item->>'reason' from jsonb_array_elements(suggested->'data') item where item->>'workspace_candidate_id'='a1000000-0000-4000-8000-000000030004')<>'default_available'
  or (select item#>>'{suggestion,portrait_asset_id}' from jsonb_array_elements(suggested->'data') item where item->>'workspace_candidate_id'='a1000000-0000-4000-8000-000000030004')<>'a1000000-0000-4000-8000-0000000f0006'
  or (select item->>'reason' from jsonb_array_elements(suggested->'data') item where item->>'workspace_candidate_id'='a1000000-0000-4000-8000-000000030003')<>'no_media_available'
 then raise exception 'A1_FAIL suggest %',suggested;end if;
 applied:=public.eps_apply_media_repairs('a1000000-0000-4000-8000-00000000d001',jsonb_build_object('items',jsonb_build_array(
   jsonb_build_object('workspace_candidate_id','a1000000-0000-4000-8000-000000030004','row_version',1),
   jsonb_build_object('workspace_candidate_id','a1000000-0000-4000-8000-000000030003','row_version',1),
   jsonb_build_object('workspace_candidate_id',current_setting('a1.pool2'),'row_version',2))),'a1-repair-key-000001');
 if jsonb_array_length(applied->'applied')<>1 or applied#>>'{applied,0,id}'<>'a1000000-0000-4000-8000-000000030004' or applied#>>'{applied,0,media_selection_state}'<>'pinned'
  or applied#>>'{applied,0,selected_candidate_media_id}'<>'a1000000-0000-4000-8000-0000000b0004'
  or (select string_agg(item->>'reason',',' order by item->>'reason') from jsonb_array_elements(applied->'skipped') item)<>'already_chosen,no_media_available'
 then raise exception 'A1_FAIL apply repairs %',applied;end if;
 again:=public.eps_apply_media_repairs('a1000000-0000-4000-8000-00000000d001',jsonb_build_object('items',jsonb_build_array(
   jsonb_build_object('workspace_candidate_id','a1000000-0000-4000-8000-000000030004','row_version',1),
   jsonb_build_object('workspace_candidate_id','a1000000-0000-4000-8000-000000030003','row_version',1),
   jsonb_build_object('workspace_candidate_id',current_setting('a1.pool2'),'row_version',2))),'a1-repair-key-000001');
 if again<>applied then raise exception 'A1_FAIL repair replay';end if;
 again:=public.eps_apply_media_repairs('a1000000-0000-4000-8000-00000000d001','{"items":[{"workspace_candidate_id":"a1000000-0000-4000-8000-000000030004","row_version":1}]}','a1-repair-key-000002');
 if again->'applied'<>'[]'::jsonb or again#>>'{skipped,0,reason}'<>'changed' then raise exception 'A1_FAIL stale repair %',again;end if;
end $$;
reset role;

-- Remove and re-add: an add key whose membership was removed never re-adds the person and never replays the
-- archived row (409 MEMBERSHIP_REMOVED naming it); a re-add is a new request with a new key.
set local role authenticated;
do $$declare again jsonb; readded jsonb; removed jsonb; failed text; detail text; begin
 again:=public.eps_add_workspace_candidate('a1000000-0000-4000-8000-00000000d001','{"candidate_id":"a1000000-0000-4000-8000-0000000e0001"}','a1-add-p1-key-000003');
 -- An already-active member keeps its project choices (picture, crop, introduction).
 if again->>'id'<>current_setting('a1.pool1') or again->'already_member'<>'true'::jsonb or again->>'portrait_asset_id'<>'a1000000-0000-4000-8000-0000000f0001'
  or again->'portrait_crop' is null or again->'portrait_crop'='null'::jsonb or again->>'selected_candidate_media_id'<>'a1000000-0000-4000-8000-0000000b0001' then raise exception 'A1_FAIL active member untouched %',again;end if;
 removed:=public.eps_remove_workspace_candidate(current_setting('a1.pool1')::uuid,jsonb_build_object('row_version',(again->>'row_version')::int),'a1-remove-p1-key-0001');
 if removed->'success'<>'true'::jsonb then raise exception 'A1_FAIL remove %',removed;end if;
 -- Old keys (the original add and an already_member replay) now fail instead of re-adding or replaying the archived row.
 begin perform public.eps_add_workspace_candidate('a1000000-0000-4000-8000-00000000d001','{"candidate_id":"a1000000-0000-4000-8000-0000000e0001"}','a1-add-p1-key-000001'); failed:='accepted';
 exception when raise_exception then failed:=sqlerrm; get stacked diagnostics detail=pg_exception_detail; end;
 if failed<>'MEMBERSHIP_REMOVED' or (detail::jsonb)->>'removed_workspace_candidate_id'<>current_setting('a1.pool1') or ((detail::jsonb)->>'status')::int<>409 then raise exception 'A1_FAIL old key after removal % %',failed,detail;end if;
 begin perform public.eps_add_workspace_candidate('a1000000-0000-4000-8000-00000000d001','{"candidate_id":"a1000000-0000-4000-8000-0000000e0001"}','a1-add-p1-key-000003'); failed:='accepted';
 exception when raise_exception then failed:=sqlerrm; end;
 if failed<>'MEMBERSHIP_REMOVED' then raise exception 'A1_FAIL old already_member key after removal %',failed;end if;
 -- A new key re-adds as a new row (already_member false proves the old keys added nobody); its replay returns it.
 readded:=public.eps_add_workspace_candidate('a1000000-0000-4000-8000-00000000d001','{"candidate_id":"a1000000-0000-4000-8000-0000000e0001"}','a1-add-p1-key-000004');
 if readded->>'id'=current_setting('a1.pool1') or readded->'already_member'<>'false'::jsonb or readded->>'media_selection_state'<>'pinned' then raise exception 'A1_FAIL re-add with a new key %',readded;end if;
 again:=public.eps_add_workspace_candidate('a1000000-0000-4000-8000-00000000d001','{"candidate_id":"a1000000-0000-4000-8000-0000000e0001"}','a1-add-p1-key-000004');
 if again->>'id'<>readded->>'id' or again->'already_member'<>'false'::jsonb then raise exception 'A1_FAIL new key replay %',again;end if;
 -- The old key still names the removed row, never the new membership.
 begin perform public.eps_add_workspace_candidate('a1000000-0000-4000-8000-00000000d001','{"candidate_id":"a1000000-0000-4000-8000-0000000e0001"}','a1-add-p1-key-000001'); failed:='accepted';
 exception when raise_exception then failed:=sqlerrm; end;
 if failed<>'MEMBERSHIP_REMOVED' then raise exception 'A1_FAIL old key after re-add %',failed;end if;
 -- Another fresh key while the person is active returns the existing membership.
 again:=public.eps_add_workspace_candidate('a1000000-0000-4000-8000-00000000d001','{"candidate_id":"a1000000-0000-4000-8000-0000000e0001"}','a1-add-p1-key-000005');
 if again->>'id'<>readded->>'id' or again->'already_member'<>'true'::jsonb then raise exception 'A1_FAIL fresh key after re-add %',again;end if;
 perform set_config('a1.pool1_new',readded->>'id',true);
end $$;
reset role;
do $$begin
 if (select count(*) from eps.workspace_candidates where workspace_id='a1000000-0000-4000-8000-00000000d001' and candidate_id='a1000000-0000-4000-8000-0000000e0001' and archived_at is null)<>1
  or (select archived_at is null from eps.workspace_candidates where id=current_setting('a1.pool1')::uuid)
 then raise exception 'A1_FAIL remove/re-add rows';end if;
end $$;

-- Save step: an extra tape for P5 after two profile edits succeeds and pins the cover photo.
set local session_replication_role=replica;
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,status,source_asset_id,producing_job_id,producing_attempt_id,output_stage,output_key,source_timestamp_ms)
 values('a1000000-0000-4000-8000-0000000f0007','a1000000-0000-4000-8000-00000000d001','candidate_frame','f7.jpg','image/jpeg','eps-candidate-outputs','frames/a1/f7.jpg',1000,repeat('e',64),320,240,'ready','a1000000-0000-4000-8000-0000000a0005','a1000000-0000-4000-8000-000000040001','a1000000-0000-4000-8000-000000050001','prepare_candidate','frame_0',500);
update eps.candidates set row_version=3,facts=facts||'{"city":"Edited during processing"}' where id='a1000000-0000-4000-8000-0000000e0005';
create function pg_temp.a1_stage_job(job uuid,upload uuid,video uuid,target uuid,frames jsonb) returns void language plpgsql as $$
declare input jsonb; hash text:=repeat('1',64); stages text[]:=array['prepare_candidate','transcribe_candidate','extract_candidate','select_frames']; stage text; payload uuid; completed jsonb:='[]'; attempt uuid;begin
 input:=jsonb_build_object('schema_version','1.0','workspace_id','a1000000-0000-4000-8000-00000000d001','project_id','a1000000-0000-4000-8000-00000000c001','source_asset_id',video,'source_size_bytes',1000,'source_mime_type','video/mp4',
  'source_declared_sha256',null,'target_candidate_id',target,'target_candidate_row_version',1,'configuration',jsonb_build_object('transcription_model','synthetic','extraction_model','synthetic','prompt_version','synthetic','schema_version','1.0','media_implementation_version','synthetic'));
 foreach stage in array stages loop
  attempt:=case when stage='prepare_candidate' then 'a1000000-0000-4000-8000-000000050001'::uuid else gen_random_uuid() end; payload:=gen_random_uuid();
  insert into eps.candidate_stage_payloads(id,workspace_id,job_id,stage,attempt_id,input_hash,result_schema,payload) values(payload,'a1000000-0000-4000-8000-00000000d001',job,stage,attempt,hash,
   case stage when 'prepare_candidate' then 'media-preparation.v1' when 'transcribe_candidate' then 'candidate-transcript-stage.v1' when 'extract_candidate' then 'candidate-extraction-stage.v1' else 'frame-selection-stage.v1' end,
   case stage when 'prepare_candidate' then jsonb_build_object('source_asset_id',video,'source_sha256',repeat('a',64),'probe',jsonb_build_object('has_audio',false),'sampled_frames',
     (select coalesce(jsonb_agg(jsonb_build_object('frame_asset_id',f,'timestamp_ms',500,'width',320,'height',240,'sha256',repeat('e',64),'quality_flags','[]'::jsonb)),'[]') from jsonb_array_elements_text(frames) f))
    when 'transcribe_candidate' then jsonb_build_object('source_asset_id',video,'transcript_asset',null,'original_transcript',null,'languages','[]'::jsonb,'missing_transcript_reason','NO_INTELLIGIBLE_AUDIO')
    when 'extract_candidate' then jsonb_build_object('source_asset_id',video,'result',null,'manual_profile_required',true)
    else jsonb_build_object('source_asset_id',video,'selected_frames',(select coalesce(jsonb_agg(jsonb_build_object('frame_asset_id',f)),'[]') from jsonb_array_elements_text(frames) f),'insufficient_frames_reason','SYNTHETIC_FEW_FRAMES','selection_method','vision') end);
  completed:=completed||jsonb_build_array(jsonb_build_object('stage',stage,'attempt_id',attempt,'input_hash',hash,'result',jsonb_build_object('stage_output_id',payload)));
 end loop;
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input_asset_id,input,input_hash,input_hash_version,dedupe_key,status,stage,current_attempt_id,lease_token_digest,lease_expires_at,completed_stages,correlation_id)
  values(job,'a1000000-0000-4000-8000-00000000d001','a1000000-0000-4000-8000-0000000000a1','candidate_scan',upload,video,input,hash,'eps.candidate-input.pg-jsonb.v1',encode(sha256(convert_to(job::text,'UTF8')),'hex'),'running','apply_candidate',
   'a1000000-0000-4000-8000-0000000000ff',encode(sha256(convert_to('a1-lease','UTF8')),'hex'),clock_timestamp()+interval '5 minutes',completed,'candidate:'||job::text);
 insert into eps.candidate_uploads(id,asset_id,principal_id,workspace_id,bucket,object_key,expected_size_bytes,expected_mime_type,status,target_candidate_id,target_candidate_row_version,job_id,completed_at,completed_input,created_at)
  values(upload,video,'a1000000-0000-4000-8000-0000000000a1','a1000000-0000-4000-8000-00000000d001','eps-candidate-assets','assets/a1/upload-'||upload::text||'.mp4',1000,'video/mp4','completed',target,1,job,clock_timestamp(),input,timestamptz '2026-03-01 00:00:00+00');
end $$;
select pg_temp.a1_stage_job('a1000000-0000-4000-8000-000000040001','a1000000-0000-4000-8000-000000060001','a1000000-0000-4000-8000-0000000a0005','a1000000-0000-4000-8000-0000000e0005','["a1000000-0000-4000-8000-0000000f0007"]');
-- An archived target still fails.
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,duration_ms,status)
 values('a1000000-0000-4000-8000-0000000a0006','a1000000-0000-4000-8000-00000000d001','candidate_video','v6.mp4','video/mp4','eps-candidate-assets','assets/a1/v6.mp4',1000,repeat('a',64),640,480,10000,'ready');
select pg_temp.a1_stage_job('a1000000-0000-4000-8000-000000040002','a1000000-0000-4000-8000-000000060002','a1000000-0000-4000-8000-0000000a0006','a1000000-0000-4000-8000-0000000e0006','[]');
-- An open upload (still transferring) appears newest first in the uploads list.
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status)
 values('a1000000-0000-4000-8000-0000000a0007','a1000000-0000-4000-8000-00000000d001','candidate_video','v7.mp4','video/mp4','eps-candidate-assets','assets/a1/v7.mp4',1000,'uploading');
insert into eps.candidate_uploads(id,asset_id,principal_id,workspace_id,bucket,object_key,expected_size_bytes,expected_mime_type,status,created_at,expires_at)
 values('a1000000-0000-4000-8000-000000060003','a1000000-0000-4000-8000-0000000a0007','a1000000-0000-4000-8000-0000000000a1','a1000000-0000-4000-8000-00000000d001','eps-candidate-assets','assets/a1/upload-open.mp4',1000,'video/mp4','open',timestamptz '2026-03-02 00:00:00+00',clock_timestamp()+interval '1 day');
set local session_replication_role=origin;
do $$declare applied jsonb; failed text; begin
 applied:=eps.apply_candidate_scan('a1000000-0000-4000-8000-000000040001','a1000000-0000-4000-8000-0000000000ff','a1-lease',repeat('1',64),'{"source_asset_id":"a1000000-0000-4000-8000-0000000a0005"}');
 if applied->>'candidate_id'<>'a1000000-0000-4000-8000-0000000e0005' or applied->>'workspace_candidate_id' is null then raise exception 'A1_FAIL extra tape apply %',applied;end if;
 if not exists(select 1 from eps.workspace_candidates where id=(applied->>'workspace_candidate_id')::uuid and portrait_asset_id='a1000000-0000-4000-8000-000000010003' and portrait_source='photo'
   and media_selection_state='pinned' and selected_frame_asset_ids='{a1000000-0000-4000-8000-0000000f0007}')
 then raise exception 'A1_FAIL apply pins %',(select to_jsonb(w) from eps.workspace_candidates w where id=(applied->>'workspace_candidate_id')::uuid);end if;
 if (select facts->>'city' from eps.candidates where id='a1000000-0000-4000-8000-0000000e0005')<>'Edited during processing' then raise exception 'A1_FAIL facts touched';end if;
 update eps.jobs set status='succeeded',result=applied,lease_token_digest=null,lease_expires_at=null where id='a1000000-0000-4000-8000-000000040001';
 perform set_config('a1.applied',applied::text,true);
 begin
  perform eps.apply_candidate_scan('a1000000-0000-4000-8000-000000040002','a1000000-0000-4000-8000-0000000000ff','a1-lease',repeat('1',64),'{"source_asset_id":"a1000000-0000-4000-8000-0000000a0006"}');
  failed:='accepted';
 exception when raise_exception then failed:=sqlerrm; end;
 if failed<>'INPUT_CHANGED' then raise exception 'A1_FAIL archived target %',failed;end if;
end $$;
set local role authenticated;
do $$declare job jsonb; uploads jsonb; applied jsonb:=current_setting('a1.applied')::jsonb; begin
 job:=public.eps_get_job('a1000000-0000-4000-8000-000000040001');
 if job#>>'{candidate_result,workspace_candidate_id}'<>applied->>'workspace_candidate_id' or job#>>'{candidate_result,candidate_id}'<>'a1000000-0000-4000-8000-0000000e0005' then raise exception 'A1_FAIL get_job result %',job;end if;
 uploads:=public.eps_list_workspace_uploads('a1000000-0000-4000-8000-00000000d001',null,1);
 if uploads#>>'{data,0,upload_id}'<>'a1000000-0000-4000-8000-000000060003' or uploads#>>'{data,0,state}'<>'uploading' or uploads#>'{page,next_cursor}'='null'::jsonb then raise exception 'A1_FAIL uploads page 1 %',uploads;end if;
 uploads:=public.eps_list_workspace_uploads('a1000000-0000-4000-8000-00000000d001',uploads#>>'{page,next_cursor}',1);
 if uploads#>>'{data,0,upload_id}'<>'a1000000-0000-4000-8000-000000060002' or uploads#>>'{data,0,state}'<>'processing' then raise exception 'A1_FAIL uploads page 2 %',uploads;end if;
 uploads:=public.eps_list_workspace_uploads('a1000000-0000-4000-8000-00000000d001',null,10);
 if (select item->>'state'||'/'||(item->>'workspace_candidate_id') from jsonb_array_elements(uploads->'data') item where item->>'upload_id'='a1000000-0000-4000-8000-000000060001')<>'ready/'||(applied->>'workspace_candidate_id')
 then raise exception 'A1_FAIL ready upload %',uploads;end if;
end $$;
reset role;

select json_build_object('result','passed','file','a1-membership-media','checks',json_build_array('default_pins','replay','repeat_add_other_key','other_user_add','single_membership',
 'cover_photo_default','foreign_picture_refused','picture_update','intro_change_keeps_picture','crop_bound','library_edits_isolated','intentionally_empty',
 'repair_suggest','repair_apply','repair_replay','repair_stale','crop_rect_refused','active_member_untouched','remove_readd_new_row','old_key_no_archived_replay','old_key_membership_removed','extra_tape_after_edit','apply_pins_cover','archived_target_fails','get_job_candidate_result','uploads_list'))::text;
rollback;
