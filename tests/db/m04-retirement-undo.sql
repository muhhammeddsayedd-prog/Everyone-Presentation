-- All identities/notes are synthetic; the parent rolls back this complete fixture.
set local role postgres;
insert into public.app_capability_grants(principal_id,capability)values(current_setting('eps.casting.fixture.actor')::uuid,'cast.read');
set local role authenticated;
do $$declare w uuid:=current_setting('eps.casting.fixture.workspace')::uuid;s uuid:=current_setting('eps.casting.fixture.slot')::uuid;p uuid:=current_setting('eps.casting.fixture.pool')::uuid;
 assignment jsonb;main jsonb;effect jsonb;result jsonb;body jsonb;begin
 assignment:=public.eps_create_assignment(w,jsonb_build_object('slot_id',s,'workspace_candidate_id',p,'expected_slot_row_version',1,'shortlist_included',true,'presentation_notes','Synthetic retained retirement note'),'m04-inverse-assignment');
 main:=public.eps_set_slot_main(s,jsonb_build_object('assignment_id',assignment->>'id','expected_slot_row_version',2,'replacement_behavior','move_previous_to_backup'),'m04-inverse-main');
 result:=public.eps_archive_role('8a3a0000-0000-4000-8000-000000000001','{"row_version":1}','m04-inverse-role-archive');
 effect:=public.eps_get_casting_retirement(w,'8a3a0000-0000-4000-8000-000000000001');
 if effect->>'operation'<>'archive_role'or effect->'can_undo'<>'true'or effect->>'main_count'<>'1'or effect->>'shortlist_count'<>'1'or jsonb_array_length(effect->'assignment_ids')<>1 then raise exception'M04_ROLE_EFFECT_DTO_FAILED';end if;
 body:=jsonb_build_object('expected_workspace_row_version',effect->'expected_workspace_row_version');
 result:=public.eps_undo_casting_retirement(w,(effect->>'undo_event_id')::uuid,body,'m04-inverse-role-undo');
 if result<>public.eps_undo_casting_retirement(w,(effect->>'undo_event_id')::uuid,body,'m04-inverse-role-undo')then raise exception'M04_ROLE_INVERSE_REPLAY_FAILED';end if;
 if(public.eps_get_casting_retirement(w,'8a3a0000-0000-4000-8000-000000000001')->>'unavailable_reason')<>'ALREADY_UNDONE'then raise exception'M04_ROLE_INVERSE_NOT_CONSUMED';end if;
 if not exists(select 1 from jsonb_array_elements(public.eps_list_assignments(w,'selection',null,100)->'data')a where a->>'id'=assignment->>'id'and a->>'position'='main'and a->'shortlist_included'='true'and a->>'presentation_notes'='Synthetic retained retirement note')then raise exception'M04_ROLE_INVERSE_FACT_OR_POSITION_LOST';end if;
 perform set_config('eps.review.inverse.assignment',assignment->>'id',true);
end$$;
select'M04_ROLE_RETIREMENT_TYPED_UNDO_HISTORY_AND_REPLAY_PASSED';
do $$declare w uuid:=current_setting('eps.casting.fixture.workspace')::uuid;s uuid:=current_setting('eps.casting.fixture.slot')::uuid;p uuid:=current_setting('eps.casting.fixture.pool')::uuid;
 effect jsonb;other jsonb;main jsonb;body jsonb;result jsonb;slot_version bigint;begin
 perform public.eps_remove_workspace_candidate(p,'{"row_version":1}','m04-inverse-pool-remove');
 effect:=public.eps_get_casting_retirement(w,p);if effect->'can_undo'<>'true'or effect->>'main_count'<>'1'then raise exception'M04_POOL_EFFECT_FAILED';end if;
 body:=jsonb_build_object('expected_workspace_row_version',effect->'expected_workspace_row_version');
 result:=public.eps_undo_casting_retirement(w,(effect->>'undo_event_id')::uuid,body,'m04-inverse-pool-immediate-undo');
 if not exists(select 1 from jsonb_array_elements(public.eps_list_assignments(w,'selection',null,100)->'data')a where a->>'id'=current_setting('eps.review.inverse.assignment')and a->>'position'='main')then raise exception'M04_POOL_IMMEDIATE_UNDO_FAILED';end if;
 perform public.eps_remove_workspace_candidate(p,'{"row_version":3}','m04-inverse-pool-remove-again');
 effect:=public.eps_get_casting_retirement(w,p);body:=jsonb_build_object('expected_workspace_row_version',effect->'expected_workspace_row_version');
 select(a->>'row_version')::bigint into slot_version from jsonb_array_elements(public.eps_list_slots('8a3a0000-0000-4000-8000-000000000001',null,100)->'data')a where a->>'id'=s::text;
 other:=public.eps_create_assignment(w,jsonb_build_object('slot_id',s,'workspace_candidate_id',current_setting('eps.casting.fixture.pool2'),'expected_slot_row_version',slot_version),'m04-inverse-pool-other');
 begin perform public.eps_undo_casting_retirement(w,(effect->>'undo_event_id')::uuid,body,'m04-inverse-pool-stale');raise exception'STALE_INVERSE_ACCEPTED';exception when raise_exception then if sqlerrm<>'STALE_RESOURCE_VERSION'then raise;end if;end;
 main:=public.eps_set_slot_main(s,jsonb_build_object('assignment_id',other->>'id','expected_slot_row_version',slot_version+1,'replacement_behavior','move_previous_to_backup'),'m04-inverse-other-main');
 effect:=public.eps_get_casting_retirement(w,p);if effect->'can_undo'<>'false'or effect->>'unavailable_reason'<>'MAIN_CHANGED'then raise exception'M04_NEW_MAIN_NOT_PROTECTED';end if;
 begin perform public.eps_undo_casting_retirement(w,(effect->>'undo_event_id')::uuid,jsonb_build_object('expected_workspace_row_version',effect->'expected_workspace_row_version'),'m04-inverse-conflicting-main');raise exception'CONFLICTING_MAIN_OVERWRITTEN';exception when raise_exception then if sqlerrm<>'RETIREMENT_UNDO_INVALID'then raise;end if;end;
 perform public.eps_set_slot_main(s,jsonb_build_object('assignment_id',null,'expected_slot_row_version',(main#>>'{slot,row_version}')::bigint,'replacement_behavior','move_previous_to_backup'),'m04-inverse-clear-new-main');
 effect:=public.eps_get_casting_retirement(w,p);if effect->'can_undo'<>'false'then raise exception'M04_INTERVENING_SLOT_VERSION_NOT_RETAINED';end if;
 if exists(select 1 from jsonb_array_elements(public.eps_list_assignments(w,'selection',null,100)->'data')a where a->>'id'=current_setting('eps.review.inverse.assignment'))or not exists(select 1 from jsonb_array_elements(public.eps_list_assignments(w,'selection',null,100)->'data')a where a->>'id'=other->>'id'and a->>'position'='backup')then raise exception'M04_POOL_INVERSE_CHANGED_NEWER_CHOICE';end if;
end$$;
select'M04_POOL_RETIREMENT_UNDO_MAIN_CONFLICT_STALE_AND_LIBRARY_PRESERVATION_PASSED';
set local role postgres;
update eps.roles set headcount=2 where id='8a3a0000-0000-4000-8000-000000000002';
insert into eps.slots(id,workspace_id,role_id,ordinal,label,sort_order)values('8a4a0000-0000-4000-8000-000000000004',current_setting('eps.casting.fixture.workspace')::uuid,'8a3a0000-0000-4000-8000-000000000002',2,'Synthetic second-role slot2',1);
set local role authenticated;
do $$declare w uuid:=current_setting('eps.casting.fixture.workspace')::uuid;effect jsonb;result jsonb;begin
 perform public.eps_resize_role_slots('8a3a0000-0000-4000-8000-000000000002','{"row_version":1,"desired_count":1,"retire_slot_ids":["8a4a0000-0000-4000-8000-000000000004"]}','m04-inverse-slot-retire');
 effect:=public.eps_get_casting_retirement(w,'8a3a0000-0000-4000-8000-000000000002');if effect->>'operation'<>'retire_slots'or effect->'can_undo'<>'true'or jsonb_array_length(effect->'assignment_ids')<>0 then raise exception'M04_EMPTY_SLOT_INVERSE_MISSING';end if;
 perform set_config('eps.review.inverse.slot.effect',effect::text,true);
end$$;
set local role postgres;
update public.project_memberships set can_write=false where principal_id=current_setting('eps.casting.fixture.actor')::uuid and project_id='8a0a0000-0000-4000-8000-000000000001';
set local role authenticated;
do $$declare effect jsonb:=current_setting('eps.review.inverse.slot.effect')::jsonb;begin
 begin perform public.eps_undo_casting_retirement(current_setting('eps.casting.fixture.workspace')::uuid,(effect->>'undo_event_id')::uuid,jsonb_build_object('expected_workspace_row_version',effect->'expected_workspace_row_version'),'m04-inverse-revoked');raise exception'REVOKED_INVERSE_ACCEPTED';exception when raise_exception then if sqlerrm<>'RESOURCE_NOT_FOUND'then raise;end if;end;
end$$;
set local role postgres;
update public.project_memberships set can_write=true where principal_id=current_setting('eps.casting.fixture.actor')::uuid and project_id='8a0a0000-0000-4000-8000-000000000001';
set local role authenticated;
do $$declare w uuid:=current_setting('eps.casting.fixture.workspace')::uuid;effect jsonb;begin
 effect:=public.eps_get_casting_retirement(w,'8a3a0000-0000-4000-8000-000000000002');perform public.eps_undo_casting_retirement(w,(effect->>'undo_event_id')::uuid,jsonb_build_object('expected_workspace_row_version',effect->'expected_workspace_row_version'),'m04-inverse-slots-undo');
 if jsonb_array_length(public.eps_list_slots('8a3a0000-0000-4000-8000-000000000002',null,100)->'data')<>2 then raise exception'M04_SLOT_RESTORE_HEADCOUNT_FAILED';end if;
end$$;
select'M04_SLOT_RETIREMENT_COMPLETE_INVERSE_CURRENT_AUTHORITY_PASSED';
