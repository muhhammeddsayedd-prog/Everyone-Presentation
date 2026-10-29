-- Synthetic succeeded provider proposal. No OpenAI, n8n or browser call here.
set local role postgres;
insert into public.app_capability_grants(principal_id,capability)select current_setting('eps.casting.fixture.actor')::uuid,value from unnest(array['cast.read','cast.write','presentations.generate'])value;
insert into eps.audience_presets(id,key,label,scope)values('8a7a0000-0000-4000-8000-000000000001','m04-ai-apply-internal','Synthetic AI apply','internal');
update eps.review_processing_config set enabled=true;
set local role authenticated;
do $$declare assignment jsonb;series jsonb;ack jsonb;body jsonb;begin
 assignment:=public.eps_create_assignment(current_setting('eps.casting.fixture.workspace')::uuid,jsonb_build_object('slot_id',current_setting('eps.casting.fixture.slot'),'workspace_candidate_id',current_setting('eps.casting.fixture.pool'),'expected_slot_row_version',1,'presentation_notes','A supplied concise note with no new facts.'),'m04-ai-apply-assignment');
 series:=public.eps_create_presentation_series(jsonb_build_object('workspace_id',current_setting('eps.casting.fixture.workspace'),'output_type','selection','audience_preset_id','8a7a0000-0000-4000-8000-000000000001'),'m04-ai-apply-series');
 ack:=public.eps_create_ai_suggestion(jsonb_build_object('workspace_id',current_setting('eps.casting.fixture.workspace'),'capability','slide_shorten','target_type','assignment','target_id',assignment->>'id','target_row_version',1,'field','presentation_notes','instruction','Shorten the supplied note without changing facts.'),'m04-ai-apply-suggestion');
 perform set_config('eps.aiapply.assignment',assignment->>'id',true);perform set_config('eps.aiapply.series',series->>'id',true);perform set_config('eps.aiapply.suggestion',ack->>'resource_id',true);perform set_config('eps.aiapply.job',ack->>'job_id',true);
end$$;
set local role postgres;
update eps.jobs set status='succeeded',stage='validate_suggestion'where id=current_setting('eps.aiapply.job')::uuid;
update eps.ai_suggestions set proposal=jsonb_build_object('schema_version','1.0','suggested_text','Supplied concise note.','proposed_changes',jsonb_build_array(jsonb_build_object('field','presentation_notes','old_value','A supplied concise note with no new facts.','new_value','Supplied concise note.')),'warnings','[]'::jsonb,'metadata','{}'::jsonb)where id=current_setting('eps.aiapply.suggestion')::uuid;
select set_config('eps.aiapply.original_facts',(select facts::text from eps.candidates where id='8a5a0000-0000-4000-8000-000000000001'),true);
set local role authenticated;
do $$declare proposal jsonb;review jsonb;begin
 proposal:=public.eps_get_ai_suggestion(current_setting('eps.aiapply.suggestion')::uuid);if proposal->>'status'<>'succeeded'then raise exception'SYNTHETIC_PROPOSAL_NOT_READY';end if;
 review:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.aiapply.series')::uuid,null);
 perform set_config('eps.aiapply.body',jsonb_build_object('row_version',1,'slide_wording',jsonb_build_object('presentation_notes',proposal->>'suggested_text'),'ai_suggestion_id',proposal->>'id','expected_series_id',current_setting('eps.aiapply.series'),'expected_input_fingerprint',review->>'input_fingerprint')::text,true);
end$$;
-- AI_APPLY_BASELINE_READY
set local role postgres;
update eps.candidates set facts=jsonb_set(facts,'{height_measurements}','"181 cm"')where id='8a5a0000-0000-4000-8000-000000000001';
set local role authenticated;
do $$declare body jsonb:=current_setting('eps.aiapply.body')::jsonb;review jsonb;begin
 begin perform public.eps_update_assignment(current_setting('eps.aiapply.assignment')::uuid,body,'m04-ai-apply-stale-facts');raise exception'STALE_AI_FACTS_APPLIED';exception when raise_exception then if sqlerrm<>'INPUT_CHANGED'then raise;end if;end;
 review:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.aiapply.series')::uuid,null);
 begin perform public.eps_update_assignment(current_setting('eps.aiapply.assignment')::uuid,body||jsonb_build_object('expected_input_fingerprint',review->>'input_fingerprint'),'m04-ai-apply-fresh-fp-old-source');raise exception'FRESH_FP_BYPASSED_OLD_AI_SOURCE';exception when raise_exception then if sqlerrm<>'INPUT_CHANGED'then raise;end if;end;
end$$;
set local role postgres;
update eps.candidates set facts=current_setting('eps.aiapply.original_facts')::jsonb where id='8a5a0000-0000-4000-8000-000000000001';
update eps.workspace_candidates set availability='Changed after proposal read.'where id=current_setting('eps.casting.fixture.pool')::uuid;
set local role authenticated;
do $$begin begin perform public.eps_update_assignment(current_setting('eps.aiapply.assignment')::uuid,current_setting('eps.aiapply.body')::jsonb,'m04-ai-apply-stale-availability');raise exception'STALE_AI_AVAILABILITY_APPLIED';exception when raise_exception then if sqlerrm<>'INPUT_CHANGED'then raise;end if;end;end$$;
set local role postgres;
update eps.workspace_candidates set availability=null where id=current_setting('eps.casting.fixture.pool')::uuid;
update public.projects set name='Changed canonical project after review read.'where id='8a0a0000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin begin perform public.eps_update_assignment(current_setting('eps.aiapply.assignment')::uuid,current_setting('eps.aiapply.body')::jsonb,'m04-ai-apply-stale-review');raise exception'STALE_AI_REVIEW_APPLIED';exception when raise_exception then if sqlerrm<>'INPUT_CHANGED'then raise;end if;end;end$$;
set local role postgres;
update public.projects set name='Synthetic casting workspace'where id='8a0a0000-0000-4000-8000-000000000001';
set local role authenticated;
select'M04_AI_APPLY_SHARED_FACTS_AVAILABILITY_AND_FULL_REVIEW_FENCED_PASSED';
do $$declare body jsonb:=current_setting('eps.aiapply.body')::jsonb;field text;value jsonb;begin
 foreach field in array array['ai_suggestion_id','expected_series_id','expected_input_fingerprint']loop
  begin perform public.eps_update_assignment(current_setting('eps.aiapply.assignment')::uuid,body-field,'m04-ai-apply-missing-'||field);raise exception'PARTIAL_AI_GUARD_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
  begin perform public.eps_update_assignment(current_setting('eps.aiapply.assignment')::uuid,body||jsonb_build_object(field,'null'::jsonb),'m04-ai-apply-null-'||field);raise exception'NULL_AI_GUARD_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
 end loop;
 begin perform public.eps_update_assignment(current_setting('eps.aiapply.assignment')::uuid,body||'{"position":"backup"}','m04-ai-apply-mixed-patch');raise exception'MIXED_AI_PATCH_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
 foreach value in array array['{"presentation_notes":"Different wording"}'::jsonb,'{"presentation_notes":"Supplied concise note.","city":"Injected"}'::jsonb]loop
  begin perform public.eps_update_assignment(current_setting('eps.aiapply.assignment')::uuid,body||jsonb_build_object('slide_wording',value),'m04-ai-apply-wrong-value-'||value::text);raise exception'WRONG_AI_WORDING_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
 end loop;
end$$;
select'M04_AI_APPLY_STRICT_ONE_FIELD_AND_GUARD_TYPES_PASSED';
do $$declare body jsonb:=current_setting('eps.aiapply.body')::jsonb;ack jsonb;begin
 ack:=public.eps_update_assignment(current_setting('eps.aiapply.assignment')::uuid,body,'m04-ai-apply-success');
 if ack->>'row_version'<>'2'or ack#>>'{slide_wording,presentation_notes}'<>'Supplied concise note.'or ack<>public.eps_update_assignment(current_setting('eps.aiapply.assignment')::uuid,body,'m04-ai-apply-success')then raise exception'GUARDED_AI_APPLY_OR_EXACT_ACK_REPLAY_FAILED';end if;
 perform public.eps_update_assignment(current_setting('eps.aiapply.assignment')::uuid,'{"row_version":2,"internal_notes":"Ordinary manual edit remains available."}','m04-ai-apply-manual');
end$$;
set local role postgres;
do $$begin
 if(select row_version from eps.candidates where id='8a5a0000-0000-4000-8000-000000000001')<>1 or(select row_version from eps.workspace_candidates where id=current_setting('eps.casting.fixture.pool')::uuid)<>1 then raise exception'AI_APPLY_MUTATED_CANONICAL_SOURCES';end if;
end$$;
update public.app_capability_grants set active=false where principal_id=current_setting('eps.casting.fixture.actor')::uuid and capability='cast.read';
set local role authenticated;
do $$begin begin perform public.eps_update_assignment(current_setting('eps.aiapply.assignment')::uuid,current_setting('eps.aiapply.body')::jsonb,'m04-ai-apply-success');raise exception'REVOKED_AI_REPLAY_ACCEPTED';exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED'then raise;end if;end;end$$;
set local role postgres;
update public.app_capability_grants set active=true where principal_id=current_setting('eps.casting.fixture.actor')::uuid and capability='cast.read';
set local role eps_review_owner;
do $$begin begin update eps.candidates set id=id where id='8a5a0000-0000-4000-8000-000000000001';raise exception'LOCK_ONLY_GRANT_ALLOWED_SOURCE_WRITE';exception when insufficient_privilege then null;end;end$$;
set local role postgres;
do $$begin if has_function_privilege('authenticated','eps.assert_assignment_ai_apply(uuid,jsonb)','EXECUTE')or has_function_privilege('service_role','eps.assert_assignment_ai_apply(uuid,jsonb)','EXECUTE')then raise exception'PRIVATE_APPLY_GUARD_EXPOSED';end if;end$$;
select'M04_AI_APPLY_ACK_CURRENT_AUTHORITY_MANUAL_EDIT_AND_LOCK_ONLY_RLS_PASSED';
