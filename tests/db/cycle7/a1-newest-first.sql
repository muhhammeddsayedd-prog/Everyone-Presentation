-- Cycle 7 A1: newest-first keyset paging for Cast Library search and the project candidate list,
-- versioned cursors, and the library card fields (membership, Arabic name, type, tapes, processing).
-- Synthetic metadata only. Runs as supabase_admin; rolls back.
begin;
set local search_path='';
alter table auth.users add column if not exists is_anonymous boolean not null default false,add column if not exists deleted_at timestamptz,add column if not exists banned_until timestamptz;
set local session_replication_role=replica;
insert into auth.users(id,instance_id,aud,role,email) values('a1100000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a1-order@example.invalid');
insert into public.app_capability_grants(principal_id,capability) select 'a1100000-0000-4000-8000-0000000000a1',capability from unnest(array['projects.read','workspaces.read','workspaces.write','cast.read','cast.write']) capability;
insert into public.projects(id,name) values('a1100000-0000-4000-8000-00000000c001','A1 order project'),('a1100000-0000-4000-8000-00000000c002','A1 foreign project');
insert into public.project_memberships(project_id,principal_id,can_write) values('a1100000-0000-4000-8000-00000000c001','a1100000-0000-4000-8000-0000000000a1',true);
insert into eps.workspaces(id,project_id) values('a1100000-0000-4000-8000-00000000d001','a1100000-0000-4000-8000-00000000c001'),('a1100000-0000-4000-8000-00000000d002','a1100000-0000-4000-8000-00000000c002');
-- Seven people; two pairs share a creation time (the id breaks the tie).
insert into eps.candidates(id,facts,casting_id,source_kind,created_by,created_at,updated_at)
select id,jsonb_build_object('name','A1Order '||n,'casting_id','A1O-'||n,'age_or_range',null,'stated_gender',null,'height_measurements',null,'languages','[]'::jsonb,'accents','[]'::jsonb,'skills_experience',null,'city',null,'previous_projects_roles',null,'classification',null),
 'A1O-'||n,'manual','a1100000-0000-4000-8000-0000000000a1',at,at
from (values(1,'a1100000-0000-4000-8000-0000000e0001'::uuid,timestamptz '2026-01-01 00:00:00+00'),(2,'a1100000-0000-4000-8000-0000000e0002','2026-01-02 00:00:00+00'),(3,'a1100000-0000-4000-8000-0000000e0003','2026-01-02 00:00:00+00'),
 (4,'a1100000-0000-4000-8000-0000000e0004','2026-01-03 00:00:00+00'),(5,'a1100000-0000-4000-8000-0000000e0005','2026-01-04 00:00:00+00'),(6,'a1100000-0000-4000-8000-0000000e0006','2026-01-04 00:00:00+00'),
 (7,'a1100000-0000-4000-8000-0000000e0007','2026-01-05 00:00:00+00')) v(n,id,at);
update eps.candidates set facts=facts||'{"city":"Filterville"}' where id in('a1100000-0000-4000-8000-0000000e0002','a1100000-0000-4000-8000-0000000e0003','a1100000-0000-4000-8000-0000000e0006');
insert into eps.candidate_attributes(candidate_id,name_ar,talent_type) values('a1100000-0000-4000-8000-0000000e0007','أ ترتيب سبعة','group');
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,duration_ms,status)
select id,'a1100000-0000-4000-8000-00000000d001','candidate_video','o'||n||'.mp4','video/mp4','eps-candidate-assets','assets/a1o/'||n||'.mp4',1000,repeat('a',64),640,480,1000,'ready'
from (values(1,'a1100000-0000-4000-8000-0000000a0001'::uuid),(2,'a1100000-0000-4000-8000-0000000a0002')) v(n,id);
insert into eps.candidate_media(candidate_id,source_asset_id) values('a1100000-0000-4000-8000-0000000e0007','a1100000-0000-4000-8000-0000000a0001'),('a1100000-0000-4000-8000-0000000e0007','a1100000-0000-4000-8000-0000000a0002');
-- Memberships are created oldest-person-last, so membership time would give the opposite order.
insert into eps.workspace_candidates(workspace_id,candidate_id,created_at,media_selection_state)
select 'a1100000-0000-4000-8000-00000000d001',id,timestamptz '2026-06-01 00:00:00+00'-n*interval '1 day','unset'
from (values(1,'a1100000-0000-4000-8000-0000000e0001'::uuid),(2,'a1100000-0000-4000-8000-0000000e0002'),(3,'a1100000-0000-4000-8000-0000000e0003'),(4,'a1100000-0000-4000-8000-0000000e0004'),(5,'a1100000-0000-4000-8000-0000000e0005')) v(n,id);
-- A new tape for person 6 is still processing.
insert into eps.jobs(workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,status,stage,correlation_id)
values('a1100000-0000-4000-8000-00000000d001','a1100000-0000-4000-8000-0000000000a1','candidate_scan',gen_random_uuid(),jsonb_build_object('target_candidate_id','a1100000-0000-4000-8000-0000000e0006'),repeat('2',64),'eps.candidate-input.pg-jsonb.v1',repeat('3',64),'queued','prepare_candidate','candidate:a1-order');
set local session_replication_role=origin;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1100000-0000-4000-8000-0000000000a1","role":"authenticated","is_anonymous":false}',true),set_config('request.jwt.claim.sub','a1100000-0000-4000-8000-0000000000a1',true);
do $$declare page jsonb; seen text[]:='{}'; expected text[]; cursor_value text; failed text; v1 text; card jsonb; begin
 expected:=array['a1100000-0000-4000-8000-0000000e0007','a1100000-0000-4000-8000-0000000e0006','a1100000-0000-4000-8000-0000000e0005','a1100000-0000-4000-8000-0000000e0004',
  'a1100000-0000-4000-8000-0000000e0003','a1100000-0000-4000-8000-0000000e0002','a1100000-0000-4000-8000-0000000e0001'];
 page:=public.eps_search_candidates('{"q":"A1Order","limit":3,"workspace_id":"a1100000-0000-4000-8000-00000000d001"}');
 seen:=seen||array(select item->>'id' from jsonb_array_elements(page->'data') item);
 -- Card fields arrive with the page.
 card:=page->'data'->0;
 if card->>'name_ar'<>'أ ترتيب سبعة' or card->>'talent_type'<>'group' or (card->>'tape_count')::int<>2 or card->'membership'<>'null'::jsonb or card->'processing'<>'false'::jsonb then raise exception 'A1_FAIL card fields %',card;end if;
 if page#>'{data,1,processing}'<>'true'::jsonb then raise exception 'A1_FAIL processing flag %',page->'data'->1;end if;
 if page#>>'{data,2,membership,state}'<>'in_project' or page#>>'{data,2,membership,workspace_candidate_id}' is null then raise exception 'A1_FAIL membership %',page->'data'->2;end if;
 cursor_value:=page#>>'{page,next_cursor}';
 -- A new arrival and an old edit while paging change nothing for the following pages.
 reset role;
 insert into eps.candidates(id,facts,casting_id,source_kind,created_by) select 'a1100000-0000-4000-8000-0000000e0008',jsonb_set(facts,'{name}','"A1Order 8"')||'{"casting_id":"A1O-8"}','A1O-8','manual',created_by from eps.candidates where id='a1100000-0000-4000-8000-0000000e0001';
 update eps.candidates set facts=facts||'{"city":"Edited later"}',updated_at=clock_timestamp(),row_version=row_version+1 where id='a1100000-0000-4000-8000-0000000e0001';
 set local role authenticated;
 page:=public.eps_search_candidates(jsonb_build_object('q','A1Order','limit',3,'workspace_id','a1100000-0000-4000-8000-00000000d001','cursor',cursor_value));
 seen:=seen||array(select item->>'id' from jsonb_array_elements(page->'data') item);
 page:=public.eps_search_candidates(jsonb_build_object('q','A1Order','limit',3,'workspace_id','a1100000-0000-4000-8000-00000000d001','cursor',page#>>'{page,next_cursor}'));
 seen:=seen||array(select item->>'id' from jsonb_array_elements(page->'data') item);
 if seen<>expected or page#>'{page,next_cursor}'<>'null'::jsonb then raise exception 'A1_FAIL search order % %',seen,page->'page';end if;
 -- Restarting shows the new arrival first.
 page:=public.eps_search_candidates('{"q":"A1Order","limit":1}');
 if page#>>'{data,0,id}'<>'a1100000-0000-4000-8000-0000000e0008' then raise exception 'A1_FAIL new arrival first %',page;end if;
 -- Cursors from other filters, the old v1 shape or garbage are refused clearly.
 begin perform public.eps_search_candidates(jsonb_build_object('q','A1Ord','limit',3,'cursor',cursor_value)); failed:='accepted';
 exception when raise_exception then failed:=sqlerrm; end;
 if failed<>'INVALID_CURSOR' then raise exception 'A1_FAIL foreign cursor %',failed;end if;
 v1:=replace(encode(convert_to(jsonb_build_object('last','a1100000-0000-4000-8000-0000000e0005','query',repeat('0',64))::text,'UTF8'),'base64'),E'\n','');
 begin perform public.eps_search_candidates(jsonb_build_object('q','A1Order','cursor',v1)); failed:='accepted';
 exception when raise_exception then failed:=sqlerrm; end;
 if failed<>'INVALID_CURSOR' then raise exception 'A1_FAIL v1 cursor %',failed;end if;
 begin perform public.eps_search_candidates('{"q":"A1Order","cursor":"not a cursor"}'); failed:='accepted';
 exception when raise_exception then failed:=sqlerrm; end;
 if failed<>'INVALID_CURSOR' then raise exception 'A1_FAIL garbage cursor %',failed;end if;
 -- Membership is read only in a project the caller can read.
 begin perform public.eps_search_candidates('{"q":"A1Order","workspace_id":"a1100000-0000-4000-8000-00000000d002"}'); failed:='accepted';
 exception when raise_exception then failed:=sqlerrm; end;
 if failed<>'RESOURCE_NOT_FOUND' then raise exception 'A1_FAIL foreign workspace %',failed;end if;
end $$;

-- Filtered results keep the same order and a filter-bound cursor (equal timestamps 2/3 split across pages).
do $$declare page jsonb; seen text[]:='{}'; begin
 page:=public.eps_search_candidates('{"q":"A1Order","city":"Filterville","include_unknown":false,"limit":2}');
 seen:=seen||array(select item->>'id' from jsonb_array_elements(page->'data') item);
 page:=public.eps_search_candidates(jsonb_build_object('q','A1Order','city','Filterville','include_unknown',false,'limit',2,'cursor',page#>>'{page,next_cursor}'));
 seen:=seen||array(select item->>'id' from jsonb_array_elements(page->'data') item);
 if seen<>array['a1100000-0000-4000-8000-0000000e0006','a1100000-0000-4000-8000-0000000e0003','a1100000-0000-4000-8000-0000000e0002'] or page#>'{page,next_cursor}'<>'null'::jsonb
 then raise exception 'A1_FAIL filtered order % %',seen,page->'page';end if;
end $$;

-- Project list: newest person first by creation time (not membership time), across pages.
do $$declare page jsonb; seen text[]:='{}'; failed text; begin
 page:=public.eps_list_workspace_candidates('a1100000-0000-4000-8000-00000000d001',null,2);
 seen:=seen||array(select item->>'candidate_id' from jsonb_array_elements(page->'data') item);
 if page#>'{data,0}'?'candidate_created_at' then raise exception 'A1_FAIL internal sort key leaked';end if;
 page:=public.eps_list_workspace_candidates('a1100000-0000-4000-8000-00000000d001',page#>>'{page,next_cursor}',2);
 seen:=seen||array(select item->>'candidate_id' from jsonb_array_elements(page->'data') item);
 page:=public.eps_list_workspace_candidates('a1100000-0000-4000-8000-00000000d001',page#>>'{page,next_cursor}',2);
 seen:=seen||array(select item->>'candidate_id' from jsonb_array_elements(page->'data') item);
 if seen<>array['a1100000-0000-4000-8000-0000000e0005','a1100000-0000-4000-8000-0000000e0004','a1100000-0000-4000-8000-0000000e0003','a1100000-0000-4000-8000-0000000e0002','a1100000-0000-4000-8000-0000000e0001']
  or page#>'{page,next_cursor}'<>'null'::jsonb then raise exception 'A1_FAIL project order % %',seen,page->'page';end if;
 -- The old raw-id cursor is refused.
 begin perform public.eps_list_workspace_candidates('a1100000-0000-4000-8000-00000000d001','a1100000-0000-4000-8000-0000000e0005',2); failed:='accepted';
 exception when raise_exception then failed:=sqlerrm; end;
 if failed<>'INVALID_CURSOR' then raise exception 'A1_FAIL raw id cursor %',failed;end if;
end $$;
reset role;

-- The processing flag shows only jobs the caller may see: a project colleague without operations.read does not see
-- someone else's upload; with operations.read they do.
set local session_replication_role=replica;
insert into auth.users(id,instance_id,aud,role,email) values('a1100000-0000-4000-8000-0000000000a2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a1-colleague@example.invalid');
insert into public.app_capability_grants(principal_id,capability) select 'a1100000-0000-4000-8000-0000000000a2',capability from unnest(array['projects.read','workspaces.read','cast.read']) capability;
insert into public.project_memberships(project_id,principal_id,can_write) values('a1100000-0000-4000-8000-00000000c001','a1100000-0000-4000-8000-0000000000a2',false);
set local session_replication_role=origin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1100000-0000-4000-8000-0000000000a2","role":"authenticated","is_anonymous":false}',true),set_config('request.jwt.claim.sub','a1100000-0000-4000-8000-0000000000a2',true);
do $$declare card jsonb; begin
 select item into card from jsonb_array_elements(public.eps_search_candidates('{"q":"A1Order 6"}')->'data') item where item->>'id'='a1100000-0000-4000-8000-0000000e0006';
 if card is null or card->'processing'<>'false'::jsonb then raise exception 'A1_FAIL colleague sees foreign upload %',card;end if;
end $$;
reset role;
insert into public.app_capability_grants(principal_id,capability) values('a1100000-0000-4000-8000-0000000000a2','operations.read');
set local role authenticated;
do $$declare card jsonb; begin
 select item into card from jsonb_array_elements(public.eps_search_candidates('{"q":"A1Order 6"}')->'data') item where item->>'id'='a1100000-0000-4000-8000-0000000e0006';
 if card is null or card->'processing'<>'true'::jsonb then raise exception 'A1_FAIL operations.read sees uploads %',card;end if;
end $$;
reset role;

select json_build_object('result','passed','file','a1-newest-first','checks',json_build_array('search_pages_newest_first','equal_timestamps_tiebreak','new_arrival_stable_pages','old_edit_not_reordered',
 'filtered_pages','card_fields','processing_flag','membership_batched','foreign_cursor','v1_cursor','garbage_cursor','foreign_workspace','project_pages_by_creation','list_raw_cursor_refused',
 'processing_flag_requester_only','processing_flag_operations_read'))::text;
rollback;
