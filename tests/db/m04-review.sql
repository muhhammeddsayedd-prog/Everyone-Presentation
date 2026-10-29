-- Synthetic metadata only. Parent owns fixture namespace and transaction rollback.
set local role postgres;
insert into public.app_capability_grants(principal_id,capability)select current_setting('eps.casting.fixture.actor')::uuid,value from unnest(array['presentations.generate','cast.read','cast.write','cast.review'])value;
insert into eps.audience_presets(id,key,label,scope)values('8a7a0000-0000-4000-8000-000000000001','m04-review-internal','Synthetic internal','internal');
update eps.roles set name='Father'where id='8a3a0000-0000-4000-8000-000000000001';
update eps.roles set name='Manager'where id='8a3a0000-0000-4000-8000-000000000002';
update eps.candidates set facts=facts||jsonb_build_object('name',case id when'8a5a0000-0000-4000-8000-000000000001'then'Samir'else'Omar'end,'skills_experience','Full supplied experience retained for both role pages.','height_measurements','178 cm')where id in('8a5a0000-0000-4000-8000-000000000001','8a5a0000-0000-4000-8000-000000000002');
insert into eps.candidates(id,facts,casting_id,source_kind,created_by)values('8a5a0000-0000-4000-8000-000000000003','{"name":"Maya","casting_id":"M04-SYNTHETIC-3","age_or_range":null,"stated_gender":null,"height_measurements":null,"languages":[],"accents":[],"skills_experience":null,"city":null,"previous_projects_roles":null,"classification":null}','M04-SYNTHETIC-3','manual',current_setting('eps.casting.fixture.actor')::uuid),('8a5a0000-0000-4000-8000-000000000004','{"name":"Lina","casting_id":"M04-SYNTHETIC-4","age_or_range":null,"stated_gender":null,"height_measurements":null,"languages":[],"accents":[],"skills_experience":null,"city":null,"previous_projects_roles":null,"classification":null}','M04-SYNTHETIC-4','manual',current_setting('eps.casting.fixture.actor')::uuid);
insert into eps.workspace_candidates(id,workspace_id,candidate_id)values('8a6a0000-0000-4000-8000-000000000004',current_setting('eps.casting.fixture.workspace')::uuid,'8a5a0000-0000-4000-8000-000000000003'),('8a6a0000-0000-4000-8000-000000000005',current_setting('eps.casting.fixture.workspace')::uuid,'8a5a0000-0000-4000-8000-000000000004');
insert into eps.roles(id,workspace_id,name,headcount,sort_order,requirements)select '8a3a0000-0000-4000-8000-000000000004',current_setting('eps.casting.fixture.workspace')::uuid,'Waiter',3,2,requirements from eps.roles where id='8a3a0000-0000-4000-8000-000000000001';
update eps.roles set requirements=(select requirements from eps.roles where id='8a3a0000-0000-4000-8000-000000000001')where id='8a3a0000-0000-4000-8000-000000000004';
insert into eps.slots(id,workspace_id,role_id,ordinal,label,sort_order)select ('8a4a0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,current_setting('eps.casting.fixture.workspace')::uuid,'8a3a0000-0000-4000-8000-000000000004',n-3,'Waiter '||(n-3)::text,n-4 from generate_series(4,6)n;
set local role authenticated;
do $$declare selection jsonb;shortlist jsonb;body jsonb;replay jsonb;begin
 body:=jsonb_build_object('workspace_id',current_setting('eps.casting.fixture.workspace'),'output_type','selection','audience_preset_id','8a7a0000-0000-4000-8000-000000000001');
 selection:=public.eps_create_presentation_series(body,'m04-review-series-selection');replay:=public.eps_create_presentation_series(body,'m04-review-series-selection');
 if selection<>replay or public.eps_create_presentation_series(body,'m04-review-series-second-intent')->>'id'<>selection->>'id'or selection->>'template_content_sha256'<>'8cfc99e874b2810d782f0a447628039e52e48a337fe1ce5b6286799c56e90001'or selection->>'latest_ready_version_id'is not null then raise exception'M04_SERIES_REUSE_OR_TEMPLATE_FAILED';end if;
 begin perform public.eps_create_presentation_series(body||'{"output_type":"shortlist"}','m04-review-series-selection');raise exception'CHANGED_KEY_ACCEPTED';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_KEY_REUSED'then raise;end if;end;
 shortlist:=public.eps_create_presentation_series(body||'{"output_type":"shortlist"}','m04-review-series-shortlist');
 perform set_config('eps.review.fixture.selection',selection->>'id',true);perform set_config('eps.review.fixture.shortlist',shortlist->>'id',true);
 if jsonb_array_length(public.eps_list_presentation_series(jsonb_build_object('workspace_id',current_setting('eps.casting.fixture.workspace'),'limit',1))->'data')<>1 then raise exception'M04_SERIES_PAGING_FAILED';end if;
 begin perform public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace2')::uuid,(selection->>'id')::uuid,null);raise exception'FOREIGN_SERIES_ACCEPTED';exception when raise_exception then if sqlerrm<>'RESOURCE_NOT_FOUND'then raise;end if;end;
 begin perform public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,(selection->>'id')::uuid,'shortlist');raise exception'OUTPUT_MISMATCH_ACCEPTED';exception when raise_exception then if sqlerrm<>'INVALID_RELATIONSHIP'then raise;end if;end;
end$$;
select'M04_REVIEW_SERIES_POLICY_SNAPSHOT_SCOPE_REPLAY_PASSED';
do $$declare r record;slot_version bigint;assignment jsonb;begin
 for r in select * from(values
 ('8a4a0000-0000-4000-8000-000000000001','8a6a0000-0000-4000-8000-000000000001',true),
 ('8a4a0000-0000-4000-8000-000000000001','8a6a0000-0000-4000-8000-000000000002',false),
 ('8a4a0000-0000-4000-8000-000000000002','8a6a0000-0000-4000-8000-000000000001',true),
 ('8a4a0000-0000-4000-8000-000000000002','8a6a0000-0000-4000-8000-000000000004',false),
 ('8a4a0000-0000-4000-8000-000000000004','8a6a0000-0000-4000-8000-000000000002',true),
 ('8a4a0000-0000-4000-8000-000000000005','8a6a0000-0000-4000-8000-000000000004',false))v(slot,pool,shortlist)loop
  select(row->>'row_version')::bigint into slot_version from jsonb_array_elements(public.eps_list_slots((case r.slot when'8a4a0000-0000-4000-8000-000000000001'then'8a3a0000-0000-4000-8000-000000000001'when'8a4a0000-0000-4000-8000-000000000002'then'8a3a0000-0000-4000-8000-000000000002'else'8a3a0000-0000-4000-8000-000000000004'end)::uuid,null,100)->'data')row where row->>'id'=r.slot;
  assignment:=public.eps_create_assignment(current_setting('eps.casting.fixture.workspace')::uuid,jsonb_build_object('slot_id',r.slot,'workspace_candidate_id',r.pool,'expected_slot_row_version',slot_version,'shortlist_included',r.shortlist),'m04-review-assign-'||r.slot||r.pool);
 end loop;
end$$;
do $$declare w uuid:=current_setting('eps.casting.fixture.workspace')::uuid;selection jsonb;shortlist jsonb;keys integer;begin
 selection:=public.eps_get_workspace_review(w,current_setting('eps.review.fixture.selection')::uuid,null);shortlist:=public.eps_get_workspace_review(w,current_setting('eps.review.fixture.shortlist')::uuid,null);
 if selection->>'candidate_slide_count'<>'6'or selection->>'pending_slide_count'<>'1'or shortlist->>'candidate_slide_count'<>'3'or shortlist->>'pending_slide_count'<>'2'then raise exception'M04_FIXTURE_COUNTS_FAILED';end if;
 if(select jsonb_agg(value#>>'{fields,name_or_id}'order by ordinal)from jsonb_array_elements(selection->'slides')with ordinality v(value,ordinal))<>'["Samir","Omar","Samir","Maya","Omar","Maya","Not provided"]'::jsonb then raise exception'M04_FIXTURE_ORDER_FAILED';end if;
 if exists(select 1 from jsonb_array_elements(selection->'slides')slide where(select count(*)from jsonb_object_keys(slide->'fields'))<>10 or slide?'internal_notes'or slide?'original_transcript')then raise exception'M04_TEN_FIELDS_OR_PRIVACY_FAILED';end if;
 if selection->'can_generate'<>'false'or selection#>>'{fit,status}'<>'unmeasured'then raise exception'M04_UNMEASURED_FIT_NOT_HONEST';end if;
 perform set_config('eps.review.fixture.before',selection->>'input_fingerprint',true);perform set_config('eps.review.fixture.draft',selection->>'draft_revision',true);
end$$;
set local role postgres;
update eps.candidates set facts=jsonb_set(facts,'{height_measurements}','"180 cm"')where id='8a5a0000-0000-4000-8000-000000000001';
set local role authenticated;
do $$declare value jsonb;begin
 value:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.review.fixture.selection')::uuid,null);
 if value->>'input_fingerprint'=current_setting('eps.review.fixture.before')or value->>'draft_revision'<>current_setting('eps.review.fixture.draft')or value#>>'{slides,0,fields,height_measurements}'<>'180 cm'or value#>>'{slides,2,fields,height_measurements}'<>'180 cm'then raise exception'M04_SHARED_FACT_INVALIDATION_FAILED';end if;
 perform set_config('eps.review.fixture.before',value->>'input_fingerprint',true);
end$$;
select'M04_REVIEW_TEN_FIELDS_ORDER_PENDING_AND_SHARED_FACT_FINGERPRINT_PASSED';
set local role postgres;
update eps.assignments set slide_wording='{"skills_experience":"Short supplied experience"}',presentation_notes='Only this assignment',internal_notes='Private synthetic note'where workspace_id=current_setting('eps.casting.fixture.workspace')::uuid and slot_id='8a4a0000-0000-4000-8000-000000000001'and workspace_candidate_id='8a6a0000-0000-4000-8000-000000000001';
set local role authenticated;
do $$declare value jsonb;begin
 value:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.review.fixture.selection')::uuid,null);
 if value#>>'{slides,0,fields,skills_experience}'<>'Short supplied experience'or value#>>'{slides,0,source_fields,skills_experience}'<>'Full supplied experience retained for both role pages.'or value#>>'{slides,2,fields,skills_experience}'<>'Full supplied experience retained for both role pages.'or position('Private synthetic note'in value::text)>0 then raise exception'M04_WORDING_OR_PRIVATE_NOTES_FAILED';end if;
 perform set_config('eps.review.fixture.before',value->>'input_fingerprint',true);
end$$;
set local role postgres;
-- Synthetic Ready metadata validates relationship/geometry hashing, not Storage byte IO.
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,status,width,height,duration_ms)values('8a8a0000-0000-4000-8000-000000000001',current_setting('eps.casting.fixture.workspace')::uuid,'candidate_video','synthetic-review.mp4','video/mp4','eps-candidate-assets','assets/8a8a0000-0000-4000-8000-000000000001/original.mp4',1000,repeat('a',64),'ready',640,480,5000);
insert into eps.jobs(id,workspace_id,requested_by,kind,status,stage,resource_id,input_asset_id,input,input_hash,input_hash_version,dedupe_key,correlation_id)values('8a9a0000-0000-4000-8000-000000000001',current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.casting.fixture.actor')::uuid,'candidate_scan','succeeded','apply_candidate','8aaa0000-0000-4000-8000-000000000001','8a8a0000-0000-4000-8000-000000000001','{"synthetic_metadata_only":true}',repeat('a',64),'eps.candidate-input.pg-jsonb.v1',repeat('a',64),'synthetic-review-lineage');
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,status,width,height,source_asset_id,source_timestamp_ms,producing_job_id,producing_attempt_id,output_stage,output_key)select('8a8a0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,current_setting('eps.casting.fixture.workspace')::uuid,'candidate_frame','synthetic-review.jpg','image/jpeg','eps-candidate-outputs','synthetic-review/frame-'||n::text||'.jpg',1000,repeat(n::text,64),'ready',320,240,'8a8a0000-0000-4000-8000-000000000001',n*100,'8a9a0000-0000-4000-8000-000000000001','8aba0000-0000-4000-8000-000000000001','prepare_candidate','frame_'||n::text from generate_series(2,3)n;
insert into eps.candidate_media(id,candidate_id,source_asset_id)values('8aaa0000-0000-4000-8000-000000000001','8a5a0000-0000-4000-8000-000000000001','8a8a0000-0000-4000-8000-000000000001');
insert into eps.candidate_media_frames(candidate_media_id,asset_id)select'8aaa0000-0000-4000-8000-000000000001',('8a8a0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(2,3)n;
update eps.workspace_candidates set selected_candidate_media_id='8aaa0000-0000-4000-8000-000000000001',selected_frame_asset_ids=array['8a8a0000-0000-4000-8000-000000000002'::uuid,'8a8a0000-0000-4000-8000-000000000003'::uuid]where id='8a6a0000-0000-4000-8000-000000000001';
set local role authenticated;
do $$declare value jsonb;begin
 value:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.review.fixture.selection')::uuid,null);
 if value->>'input_fingerprint'=current_setting('eps.review.fixture.before')or value#>>'{slides,0,frames,0,asset_id}'<>'8a8a0000-0000-4000-8000-000000000002'or value#>>'{slides,2,frames,1,sha256}'<>repeat('3',64)then raise exception'M04_SELECTED_MEDIA_HASH_FAILED';end if;
 perform set_config('eps.review.fixture.before',value->>'input_fingerprint',true);
end$$;
set local role postgres;
update eps.workspace_candidates set selected_frame_asset_ids=array['8a8a0000-0000-4000-8000-000000000003'::uuid,'8a8a0000-0000-4000-8000-000000000002'::uuid]where id='8a6a0000-0000-4000-8000-000000000001';
set local role authenticated;
do $$declare value jsonb;begin
 value:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.review.fixture.selection')::uuid,null);
 if value->>'input_fingerprint'=current_setting('eps.review.fixture.before')or value#>>'{slides,0,frames,0,asset_id}'<>'8a8a0000-0000-4000-8000-000000000003'then raise exception'M04_FRAME_ORDER_HASH_FAILED';end if;
 perform set_config('eps.review.fixture.before',value->>'input_fingerprint',true);
end$$;
set local role postgres;
-- Unselected extra frame and media bookkeeping revision do not change captured content.
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,status,width,height,source_asset_id,source_timestamp_ms,producing_job_id,producing_attempt_id,output_stage,output_key)values('8a8a0000-0000-4000-8000-000000000004',current_setting('eps.casting.fixture.workspace')::uuid,'candidate_frame','unselected-review.jpg','image/jpeg','eps-candidate-outputs','synthetic-review/frame-4.jpg',1000,repeat('4',64),'ready',320,240,'8a8a0000-0000-4000-8000-000000000001',400,'8a9a0000-0000-4000-8000-000000000001','8aba0000-0000-4000-8000-000000000001','prepare_candidate','frame_4');
insert into eps.candidate_media_frames(candidate_media_id,asset_id)values('8aaa0000-0000-4000-8000-000000000001','8a8a0000-0000-4000-8000-000000000004');
-- An unrelated job timestamp and unselected library default do not affect slides.
update eps.candidate_media set row_version=row_version+1 where candidate_id='8a5a0000-0000-4000-8000-000000000001';
set local role authenticated;
do $$declare value jsonb;begin
 value:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.review.fixture.selection')::uuid,null);
 if value->>'input_fingerprint'<>current_setting('eps.review.fixture.before')then raise exception'M04_UNRELATED_INPUT_INVALIDATION_FAILED';end if;
end$$;
select'M04_REVIEW_MEDIA_PIN_HASH_ORDER_AND_UNRELATED_PROCESSING_STABILITY_PASSED';
set local role postgres;
update public.app_capability_grants set active=false where principal_id=current_setting('eps.casting.fixture.actor')::uuid and capability='cast.read';
set local role authenticated;
do $$begin
 begin perform public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.review.fixture.selection')::uuid,null);raise exception'M04_FACT_PERMISSION_ACCEPTED';exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED'then raise;end if;end;
 if has_table_privilege('authenticated','eps.presentation_series','SELECT')or has_table_privilege('service_role','eps.presentation_series','SELECT')or has_function_privilege('anon','public.eps_get_workspace_review(uuid,uuid,text)','EXECUTE')then raise exception'M04_REVIEW_DIRECT_AUTHORITY_LEAK';end if;
end$$;
select'M04_REVIEW_SCOPE_REVIEWED_PERMISSION_AND_TEMPLATE_BINDING_PASSED';
