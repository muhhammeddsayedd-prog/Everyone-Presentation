-- Fresh common fixture; cumulative edits are not the operation request size.
set local role postgres;
do $$declare n integer;c uuid;p uuid;pools uuid[]:='{}';base jsonb;begin
 select facts into base from eps.candidates where id='8a5a0000-0000-4000-8000-000000000001';
 for n in 1..120 loop
  c:=gen_random_uuid();p:=gen_random_uuid();
  insert into eps.candidates(id,facts,casting_id,source_kind,created_by)values(c,jsonb_set(base,'{casting_id}',to_jsonb('M04-BOUND-'||n)),'M04-BOUND-'||n,'manual',current_setting('eps.casting.fixture.actor')::uuid);
  insert into eps.workspace_candidates(id,workspace_id,candidate_id)values(p,current_setting('eps.casting.fixture.workspace')::uuid,c);pools:=array_append(pools,p);
  -- Large existing board constructor, not120 public-create acceptance claims.
  insert into eps.assignments(workspace_id,slot_id,workspace_candidate_id,sort_order)values(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.casting.fixture.slot')::uuid,p,n-1);
 end loop;update eps.slots set row_version=121 where id=current_setting('eps.casting.fixture.slot')::uuid;perform set_config('eps.bounds.pools',to_jsonb(pools)::text,true);
end$$;
set local role authenticated;
do $$declare w uuid:=current_setting('eps.casting.fixture.workspace')::uuid;s uuid:=current_setting('eps.casting.fixture.slot')::uuid;a jsonb;b jsonb;v jsonb;key text;p uuid;sv bigint:=123;body jsonb;first_page jsonb;next_page jsonb;begin
 a:=public.eps_create_assignment(w,jsonb_build_object('slot_id',s,'workspace_candidate_id',current_setting('eps.casting.fixture.pool'),'expected_slot_row_version',121),'bounds-a');
 b:=public.eps_create_assignment(w,jsonb_build_object('slot_id',s,'workspace_candidate_id',current_setting('eps.casting.fixture.pool2'),'expected_slot_row_version',122),'bounds-b');
 foreach key in array array['name_or_id','age_or_range','height_measurements','languages_accents','skills_experience','city','previous_projects_roles','classification','availability','presentation_notes']loop
  a:=public.eps_update_assignment((a->>'id')::uuid,jsonb_build_object('row_version',a->'row_version','slide_wording',jsonb_build_object(key,repeat('x',50000))),'bounds-a-'||key);
  b:=public.eps_update_assignment((b->>'id')::uuid,jsonb_build_object('row_version',b->'row_version','slide_wording',jsonb_build_object(key,repeat('y',50000))),'bounds-b-'||key);
 end loop;
 if octet_length((a->'slide_wording')::text)<400000 then raise exception'M04_CUMULATIVE_WORDING_MUST_EXCEED_REQUEST_BUDGET';end if;
 begin perform public.eps_update_assignment((a->>'id')::uuid,jsonb_build_object('row_version',a->'row_version','internal_notes',repeat('z',70000)),'bounds-oversized');raise exception'EXPECTED_REQUEST_BYTE_BUDGET';exception when sqlstate'P0001'then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
 begin perform public.eps_update_assignment((a->>'id')::uuid,jsonb_build_object('row_version',a->'row_version','internal_notes',chr(1)),'bounds-controls');raise exception'EXPECTED_UNSUPPORTED_CONTROL';exception when sqlstate'P0001'then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
 a:=public.eps_update_assignment((a->>'id')::uuid,jsonb_build_object('row_version',a->'row_version','internal_notes',E'\t  '||chr(160)||'Arabic العربية'||chr(160)||E'  \r\n'),'bounds-trim');
 if a->>'internal_notes'is distinct from chr(160)||'Arabic العربية'||chr(160)then raise exception'M04_ASCII_TRIM_MUST_PRESERVE_UNICODE';end if;
 perform public.eps_set_slot_main(s,jsonb_build_object('assignment_id',a->'id','expected_slot_row_version',sv,'replacement_behavior','move_previous_to_backup'),'bounds-main-a');sv:=sv+1;
 perform public.eps_set_slot_main(s,jsonb_build_object('assignment_id',b->'id','expected_slot_row_version',sv,'replacement_behavior','move_previous_to_backup'),'bounds-main-b');
 first_page:=public.eps_list_assignments(w,'selection',null,100);next_page:=public.eps_list_assignments(w,'selection',first_page->'page'->>'next_cursor',100);
 if jsonb_array_length(first_page->'data')<>100 or jsonb_array_length(next_page->'data')<>22 or next_page->'page'->>'next_cursor'is not null then raise exception'M04_LARGE_BOARD_PAGINATION_FAILED';end if;
 perform set_config('eps.bounds.ids',(select jsonb_agg(value->'id'order by n desc)::text from jsonb_array_elements((first_page->'data')||(next_page->'data'))with ordinality e(value,n)),true);
 body:=jsonb_build_object('row_version',public.eps_get_workspace(w)->'row_version','assignment_ids_by_slot',jsonb_build_object(s::text,current_setting('eps.bounds.ids')::jsonb));
 perform public.eps_reorder_workspace(w,body,'bounds-reorder122');
end$$;
set local role postgres;
do $$begin
 if not exists(select 1 from eps.assignment_change_events where operation='set_main'and octet_length(payload::text)>1048576)then raise exception'M04_ACTUAL_LARGE_MAIN_INVERSE_NOT_PROVEN';end if;
 if not exists(select 1 from eps.assignment_change_events where operation='reorder'and jsonb_array_length(payload->'before')=100)or not exists(select 1 from eps.assignment_change_events where operation='reorder'and jsonb_array_length(payload->'before')=22)then raise exception'M04_FULL_REORDER_AUDIT_MUST_BATCH_WITHOUT_SCOPE_REDUCTION';end if;
 if exists(select 1 from eps.assignment_change_events where octet_length(payload::text)>4194304 or jsonb_array_length(payload->'before')>100 or jsonb_array_length(payload->'after')>100)then raise exception'M04_PRIVATE_EVENT_BOUND_EXCEEDED';end if;
 if(select count(*)from eps.assignments where archived_at is null)<>122 then raise exception'M04_FULL_BOARD_RETAINED';end if;
end$$;
select'M04_CUMULATIVE_WORDING_LARGE_MAIN_BOUNDED_PRIVATE_BATCHES_AND_122_ROW_REORDER_PASSED';
