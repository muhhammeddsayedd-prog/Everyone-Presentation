-- Synthetic profiles and canonical project memberships, inside parent rollback.
create function pg_temp.cast_assert(value boolean,label text) returns void language plpgsql as $$ begin if value is distinct from true then raise exception 'M03_ASSERTION: %',label; end if; end $$;
do $$ begin
 if exists(select 1 from auth.users where id::text like '7a3c0000-%') or exists(select 1 from public.projects where id::text like '7b3c0000-%') then raise exception 'M03_SYNTHETIC_PREFIX_ALREADY_PRESENT'; end if;
end $$;
insert into auth.users(id,is_anonymous,deleted_at,banned_until) values
 ('7a3c0000-0000-4000-8000-000000000001',false,null,null),('7a3c0000-0000-4000-8000-000000000002',false,null,null),('7a3c0000-0000-4000-8000-000000000003',false,null,null);
insert into public.projects(id,name) values ('7b3c0000-0000-4000-8000-000000000001','Synthetic candidate first'),('7b3c0000-0000-4000-8000-000000000002','Synthetic candidate second');
insert into eps.workspaces(id,project_id) values ('7c3c0000-0000-4000-8000-000000000001','7b3c0000-0000-4000-8000-000000000001'),('7c3c0000-0000-4000-8000-000000000002','7b3c0000-0000-4000-8000-000000000002');
insert into public.project_memberships(project_id,principal_id,can_write) values ('7b3c0000-0000-4000-8000-000000000001','7a3c0000-0000-4000-8000-000000000001',true),('7b3c0000-0000-4000-8000-000000000002','7a3c0000-0000-4000-8000-000000000001',true),('7b3c0000-0000-4000-8000-000000000001','7a3c0000-0000-4000-8000-000000000002',true);
insert into public.app_capability_grants(principal_id,capability) select '7a3c0000-0000-4000-8000-000000000001'::uuid,value from unnest(array['projects.read','workspaces.read','workspaces.write','cast.read','cast.write','cast.review']) value;
insert into public.app_capability_grants(principal_id,capability) select '7a3c0000-0000-4000-8000-000000000002'::uuid,value from unnest(array['projects.read','workspaces.read','workspaces.write','cast.read','cast.upload']) value;
select set_config('request.jwt.claim.sub','7a3c0000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"7a3c0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('eps.m03.facts','{"name":"Synthetic Person","casting_id":null,"age_or_range":null,"stated_gender":null,"height_measurements":null,"languages":[],"accents":[],"skills_experience":null,"city":null,"previous_projects_roles":null,"classification":null}',true);
select set_config('eps.m03.first',public.eps_create_candidate(jsonb_build_object('facts',current_setting('eps.m03.facts')::jsonb),'m03-synthetic-create-first')::text,true);
select pg_temp.cast_assert(current_setting('eps.m03.first')::jsonb->>'review_status'='unreviewed','manual starts Unreviewed');
select pg_temp.cast_assert(current_setting('eps.m03.first')::jsonb->'facts'->>'age_or_range' is null,'unknown age stays null');
select pg_temp.cast_assert(current_setting('eps.m03.first')::jsonb->'facts'->>'casting_id' like 'EPS-%','generated casting ID');
select pg_temp.cast_assert(public.eps_create_candidate(jsonb_build_object('facts',current_setting('eps.m03.facts')::jsonb),'m03-synthetic-create-first')=current_setting('eps.m03.first')::jsonb,'same-key create exact replay');
select set_config('eps.m03.reviewed',public.eps_confirm_candidate_reviewed((current_setting('eps.m03.first')::jsonb->>'id')::uuid,'{"row_version":1,"confirmation_note":"Synthetic factual check"}','m03-synthetic-review-first')::text,true);
select pg_temp.cast_assert(current_setting('eps.m03.reviewed')::jsonb->>'review_status'='reviewed','authorized review');
select set_config('eps.m03.pool_one',public.eps_add_workspace_candidate('7c3c0000-0000-4000-8000-000000000001',jsonb_build_object('candidate_id',current_setting('eps.m03.first')::jsonb->>'id','availability','Available Friday'),'m03-synthetic-pool-first')::text,true);
select set_config('eps.m03.pool_two',public.eps_add_workspace_candidate('7c3c0000-0000-4000-8000-000000000002',jsonb_build_object('candidate_id',current_setting('eps.m03.first')::jsonb->>'id','availability','Not available Friday'),'m03-synthetic-pool-second')::text,true);
select pg_temp.cast_assert(public.eps_get_candidate((current_setting('eps.m03.first')::jsonb->>'id')::uuid)->>'review_status'='reviewed','project availability does not reset review');
select pg_temp.cast_assert(current_setting('eps.m03.pool_one')::jsonb->>'availability'='Available Friday' and current_setting('eps.m03.pool_two')::jsonb->>'availability'='Not available Friday','independent project availability');
select pg_temp.cast_assert(jsonb_array_length(public.eps_search_candidates('{"language":"Arabic","include_unknown":false}')->'data')=0,'unknown excluded when requested');
select pg_temp.cast_assert(public.eps_search_candidates('{"language":"Arabic","include_unknown":true}')->'data'->0->'search_match'->'unknown_filter_fields'='["language"]','unknown labelled, never positive match');
select pg_temp.cast_assert(jsonb_array_length(public.eps_search_candidates('{"q":"Not this person","language":"Arabic"}')->'data')=0,'unknown never bypasses text query');
select pg_temp.cast_assert(jsonb_array_length(public.eps_search_candidates('{"q":"languages"}')->'data')=0,'fact keys are not supplied searchable facts');
select set_config('eps.m03.edited',public.eps_update_candidate((current_setting('eps.m03.first')::jsonb->>'id')::uuid,jsonb_build_object('row_version',2,'facts',jsonb_set(current_setting('eps.m03.facts')::jsonb,'{city}','"Cairo"')),'m03-synthetic-edit-first')::text,true);
select pg_temp.cast_assert(current_setting('eps.m03.edited')::jsonb->>'review_status'='unreviewed' and current_setting('eps.m03.edited')::jsonb->>'reviewed_at' is null,'factual edit invalidates confirmation');
select pg_temp.cast_assert(current_setting('eps.m03.edited')::jsonb->'facts'->>'casting_id'=current_setting('eps.m03.first')::jsonb->'facts'->>'casting_id','null update preserves casting ID');
do $$ begin
 begin perform public.eps_update_candidate((current_setting('eps.m03.first')::jsonb->>'id')::uuid,jsonb_build_object('row_version',2,'facts',current_setting('eps.m03.facts')::jsonb),'m03-synthetic-stale-edit'); raise exception 'EXPECTED_STALE_DENIAL'; exception when raise_exception then if sqlerrm<>'STALE_RESOURCE_VERSION' then raise; end if; end;
 begin perform public.eps_create_candidate(jsonb_build_object('facts',jsonb_set(current_setting('eps.m03.facts')::jsonb,'{city}','"Different"')),'m03-synthetic-create-first'); raise exception 'EXPECTED_IDEMPOTENCY_DENIAL'; exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_KEY_REUSED' then raise; end if; end;
end $$;
select set_config('eps.m03.second',public.eps_create_candidate(jsonb_build_object('facts',current_setting('eps.m03.facts')::jsonb),'m03-synthetic-create-second')::text,true);
select pg_temp.cast_assert(current_setting('eps.m03.second')::jsonb->>'id'<>current_setting('eps.m03.first')::jsonb->>'id','same name creates independent identity');
select pg_temp.cast_assert(jsonb_array_length(public.eps_find_candidate_duplicates((current_setting('eps.m03.second')::jsonb->>'id')::uuid))=1,'same name suggests explicit duplicate');
select set_config('eps.m03.page',public.eps_search_candidates('{"limit":1}')::text,true);
select pg_temp.cast_assert(current_setting('eps.m03.page')::jsonb->'page'->>'next_cursor' is not null,'cursor returned');
select pg_temp.cast_assert(jsonb_array_length(public.eps_search_candidates(jsonb_build_object('limit',1,'cursor',current_setting('eps.m03.page')::jsonb->'page'->>'next_cursor'))->'data')=1,'next page');
do $$ begin
 begin perform public.eps_search_candidates(jsonb_build_object('limit',1,'city','Cairo','cursor',current_setting('eps.m03.page')::jsonb->'page'->>'next_cursor')); raise exception 'EXPECTED_CURSOR_DENIAL'; exception when raise_exception then if sqlerrm<>'INVALID_REQUEST' then raise; end if; end;
end $$;
select set_config('eps.m03.linked',public.eps_resolve_candidate_duplicate((current_setting('eps.m03.second')::jsonb->>'id')::uuid,jsonb_build_object('row_version',1,'action','link_existing','existing_candidate_id',current_setting('eps.m03.first')::jsonb->>'id','existing_candidate_row_version',3),'m03-synthetic-link-existing')::text,true);
select pg_temp.cast_assert(current_setting('eps.m03.linked')::jsonb=current_setting('eps.m03.edited')::jsonb||jsonb_build_object('possible_duplicate',false),'explicit link returns original facts unchanged');
select pg_temp.cast_assert(public.eps_resolve_candidate_duplicate((current_setting('eps.m03.second')::jsonb->>'id')::uuid,jsonb_build_object('row_version',1,'action','link_existing','existing_candidate_id',current_setting('eps.m03.first')::jsonb->>'id','existing_candidate_row_version',3),'m03-synthetic-link-existing')=current_setting('eps.m03.linked')::jsonb,'duplicate link replay idempotent');
select set_config('eps.m03.third',public.eps_create_candidate(jsonb_build_object('facts',current_setting('eps.m03.facts')::jsonb),'m03-synthetic-create-third')::text,true);
select pg_temp.cast_assert(public.eps_resolve_candidate_duplicate((current_setting('eps.m03.third')::jsonb->>'id')::uuid,'{"row_version":1,"action":"keep_new"}','m03-synthetic-keep-new')->>'possible_duplicate'='false','explicit keep new');
select 'M03_MANUAL_REVIEW_SEARCH_DUPLICATE_POOL_PASSED';

select set_config('request.jwt.claim.sub','7a3c0000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"7a3c0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
 begin perform public.eps_confirm_candidate_reviewed((current_setting('eps.m03.first')::jsonb->>'id')::uuid,'{"row_version":3}','m03-contributor-review-deny'); raise exception 'EXPECTED_REVIEW_DENIAL'; exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED' then raise; end if; end;
 begin perform public.eps_create_candidate(jsonb_build_object('facts',current_setting('eps.m03.facts')::jsonb),'m03-contributor-create-deny'); raise exception 'EXPECTED_WRITE_DENIAL'; exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED' then raise; end if; end;
 begin perform public.eps_list_workspace_candidates('7c3c0000-0000-4000-8000-000000000002'); raise exception 'EXPECTED_SCOPE_DENIAL'; exception when raise_exception then if sqlerrm<>'RESOURCE_NOT_FOUND' then raise; end if; end;
 begin perform count(*) from eps.candidates; raise exception 'EXPECTED_DIRECT_TABLE_DENIAL'; exception when insufficient_privilege then null; end;
 begin perform eps.cast_mutate('confirm_candidate_reviewed',(current_setting('eps.m03.first')::jsonb->>'id')::uuid,'{"row_version":3}','m03-private-function-deny'); raise exception 'EXPECTED_PRIVATE_FUNCTION_DENIAL'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','7a3c0000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"7a3c0000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin begin perform public.eps_search_candidates('{}'); raise exception 'EXPECTED_LIBRARY_DENIAL'; exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED' then raise; end if; end; end $$;
set local role anon;
do $$ begin begin perform public.eps_search_candidates('{}'); raise exception 'EXPECTED_GUEST_DENIAL'; exception when insufficient_privilege then null; end; end $$;
set local role postgres;
select pg_temp.cast_assert((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid in('eps.candidates'::regclass,'eps.candidate_media'::regclass,'eps.candidate_media_frames'::regclass,'eps.workspace_candidates'::regclass)),'forced RLS');
select pg_temp.cast_assert(not exists(select 1 from pg_roles where rolname='eps_cast_owner' and (rolsuper or rolbypassrls or rolcanlogin or rolcreaterole or rolcreatedb)),'narrow owner role');
select pg_temp.cast_assert((select count(*)=1 from eps.candidates where merged_into_candidate_id is not null),'one explicit merge');
select pg_temp.cast_assert((select count(*)=2 from eps.workspace_candidates where archived_at is null),'two projects, shared candidate');
select 'M03_RLS_CAPABILITY_SCOPE_DENIALS_PASSED';
