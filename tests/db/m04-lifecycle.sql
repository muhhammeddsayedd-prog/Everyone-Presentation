-- Synthetic metadata-only acceptance. Parent installs core+lifecycle, creates
-- a fresh fixture savepoint, and rolls back every row/role/policy/DDL afterward.
-- No native bytes, provider, cloud, generated version or retirement-Undo credit.
set local role postgres;
create function pg_temp.lifecycle_assert(ok boolean,label text)returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception'M04_LIFECYCLE_ASSERTION: %',label;end if;
end$$;
create function pg_temp.lifecycle_actor(p_actor uuid)returns void language plpgsql as $$begin
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated','is_anonymous',false)::text,true);
end$$;
create function pg_temp.lifecycle_requirements()returns jsonb language sql immutable as $$
 select '{"age_range":null,"gender_requirement":null,"appearance_performance":null,"languages":[],"accents":[],"skills":[],"scene_references":[],"shoot_dates":[],"location":null,"availability_requirements":null,"other_instructions":null}'::jsonb
$$;
create function pg_temp.lifecycle_slot_version(p_slot uuid)returns bigint language plpgsql as $$declare role_id uuid;v bigint;begin
 role_id:=(public.eps_get_casting_context('slot',p_slot)->>'role_id')::uuid;
 select(value->>'row_version')::bigint into strict v from jsonb_array_elements(public.eps_list_slots(role_id,null,100)->'data')where value->>'id'=p_slot::text;
 return v;
end$$;
create function pg_temp.lifecycle_add(p_workspace uuid,p_slot uuid,p_pool uuid,p_key text)returns jsonb language plpgsql as $$begin
 return public.eps_create_assignment(p_workspace,jsonb_build_object('slot_id',p_slot,'workspace_candidate_id',p_pool,'expected_slot_row_version',pg_temp.lifecycle_slot_version(p_slot)),p_key);
end$$;
create function pg_temp.lifecycle_assignment(p_workspace uuid,p_assignment uuid)returns jsonb language sql as $$
 select value from jsonb_array_elements(public.eps_list_assignments(p_workspace,'selection',null,100)->'data')where value->>'id'=p_assignment::text
$$;
select pg_temp.lifecycle_actor(current_setting('eps.casting.fixture.actor')::uuid);
set local role authenticated;
do $$declare w uuid:=current_setting('eps.casting.fixture.workspace')::uuid;p uuid:=current_setting('eps.casting.fixture.pool')::uuid;p2 uuid:=current_setting('eps.casting.fixture.pool2')::uuid;
 role_value jsonb;slots jsonb;a jsonb;b jsonb;c jsonb;res jsonb;body jsonb;retire uuid;begin
 -- Keep independent assignments in the fixture's original two roles.
 a:=pg_temp.lifecycle_add(w,current_setting('eps.casting.fixture.slot')::uuid,p,'lifecycle-original-source');
 b:=pg_temp.lifecycle_add(w,current_setting('eps.casting.fixture.slot')::uuid,p2,'lifecycle-original-target');
 c:=pg_temp.lifecycle_add(w,current_setting('eps.casting.fixture.slot2')::uuid,p,'lifecycle-original-other-role');
 perform set_config('eps.lifecycle.source_assignment',a->>'id',true);perform set_config('eps.lifecycle.target_assignment',b->>'id',true);perform set_config('eps.lifecycle.other_assignment',c->>'id',true);
 role_value:=public.eps_create_role(w,jsonb_build_object('name','Synthetic lifecycle three-slot role','headcount',3,'requirements',pg_temp.lifecycle_requirements()),'lifecycle-create-three-role');
 slots:=public.eps_list_slots((role_value->>'id')::uuid,null,100)->'data';
 a:=pg_temp.lifecycle_add(w,(slots->0->>'id')::uuid,p,'lifecycle-three-first');
 b:=pg_temp.lifecycle_add(w,(slots->1->>'id')::uuid,p2,'lifecycle-three-retired');
 c:=pg_temp.lifecycle_add(w,(slots->2->>'id')::uuid,p,'lifecycle-three-last');retire:=(slots->1->>'id')::uuid;
 perform public.eps_set_slot_main(retire,jsonb_build_object('assignment_id',b->'id','expected_slot_row_version',pg_temp.lifecycle_slot_version(retire),'replacement_behavior','move_previous_to_backup'),'lifecycle-retired-main');
 body:=jsonb_build_object('row_version',role_value->'row_version','desired_count',2,'retire_slot_ids',jsonb_build_array(retire));
 res:=public.eps_resize_role_slots((role_value->>'id')::uuid,body,'lifecycle-resize-explicit');
 perform pg_temp.lifecycle_assert(res=public.eps_resize_role_slots((role_value->>'id')::uuid,body,'lifecycle-resize-explicit'),'retirement exact replay');
 perform pg_temp.lifecycle_assert((res->>'headcount')::integer=2,'corrected headcount retained');
 perform pg_temp.lifecycle_assert(pg_temp.lifecycle_assignment(w,(b->>'id')::uuid)is null,'only explicitly retired slot assignment leaves Selection');
 perform pg_temp.lifecycle_assert(pg_temp.lifecycle_assignment(w,(a->>'id')::uuid)is not null and pg_temp.lifecycle_assignment(w,(c->>'id')::uuid)is not null,'other slot assignments retained');
 body:=jsonb_build_object('row_version',res->'row_version','reason','Synthetic scoped role closure');
 res:=public.eps_archive_role((role_value->>'id')::uuid,body,'lifecycle-archive-role');
 perform pg_temp.lifecycle_assert(res=public.eps_archive_role((role_value->>'id')::uuid,body,'lifecycle-archive-role'),'role archival exact replay');
 perform pg_temp.lifecycle_assert(jsonb_array_length(res->'affected_ids')=5,'archive result names role, two slots and two assignments');
 perform pg_temp.lifecycle_assert(jsonb_array_length(public.eps_list_assignments(w,'selection',null,100)->'data')=3,'unrelated fixture role assignments preserved');
 perform set_config('eps.lifecycle.retired_assignment',b->>'id',true);perform set_config('eps.lifecycle.closed_role',role_value->>'id',true);
end$$;
set local role postgres;
do $$begin
 perform pg_temp.lifecycle_assert((select archived_at is not null and position='main'from eps.assignments where id=current_setting('eps.lifecycle.retired_assignment')::uuid),'retired Main preserved as archived history');
 perform pg_temp.lifecycle_assert(exists(select 1 from eps.assignment_change_events where operation='retire_slots'and jsonb_array_length(payload->'before')=1 and payload#>>'{before,0,position}'='main'),'private inverse retains actual former Main');
 perform pg_temp.lifecycle_assert(exists(select 1 from eps.assignment_change_events where operation='archive_role'and jsonb_array_length(payload->'before')=2),'role assignment effects retained privately');
end$$;
select'M04_SCOPED_ROLE_RESIZE_ARCHIVE_ASSIGNMENTS_HISTORY_AND_REPLAY_PASSED';

-- Project removal through the actual user RPC; the contributor still has no
-- cast.write/review grant. This constructor is synthetic metadata only.
insert into eps.candidates(id,facts,casting_id,source_kind,created_by)
 select'8a5a0000-0000-4000-8000-000000000003',jsonb_set(facts,'{casting_id}','"M04-SYNTHETIC-3"'),'M04-SYNTHETIC-3','manual',created_by from eps.candidates where id='8a5a0000-0000-4000-8000-000000000001';
insert into eps.workspace_candidates(id,workspace_id,candidate_id)values('8a6a0000-0000-4000-8000-000000000004','8a2a0000-0000-4000-8000-000000000001','8a5a0000-0000-4000-8000-000000000003');
set local role authenticated;
do $$declare w uuid:=current_setting('eps.casting.fixture.workspace')::uuid;s uuid:=current_setting('eps.casting.fixture.slot2')::uuid;a jsonb;res jsonb;body jsonb;before_slot bigint;begin
 a:=pg_temp.lifecycle_add(w,s,'8a6a0000-0000-4000-8000-000000000004','lifecycle-removable-project-person');before_slot:=pg_temp.lifecycle_slot_version(s);
 body:='{"row_version":1,"reason":"Synthetic project-only removal"}';res:=public.eps_remove_workspace_candidate('8a6a0000-0000-4000-8000-000000000004',body,'lifecycle-remove-project-person');
 perform pg_temp.lifecycle_assert(res=public.eps_remove_workspace_candidate('8a6a0000-0000-4000-8000-000000000004',body,'lifecycle-remove-project-person'),'pool removal exact replay');
 perform pg_temp.lifecycle_assert(res->>'success'='true'and res->'affected_ids'? (a->>'id')and jsonb_array_length(res->'affected_ids')=2,'pool plus affected assignment returned');
 perform pg_temp.lifecycle_assert(pg_temp.lifecycle_slot_version(s)=before_slot+1,'pool removal invalidates the affected slot revision once');
 perform pg_temp.lifecycle_assert(jsonb_array_length(public.eps_list_assignments(w,'selection',null,100)->'data')=3,'pool removal preserves independent assignments');
end$$;
set local role postgres;
do $$begin
 perform pg_temp.lifecycle_assert((select archived_at is null from eps.candidates where id='8a5a0000-0000-4000-8000-000000000003'),'project removal retains shared candidate');
 perform pg_temp.lifecycle_assert((select archived_at is not null from eps.workspace_candidates where id='8a6a0000-0000-4000-8000-000000000004'),'project participation archived');
 perform pg_temp.lifecycle_assert(exists(select 1 from eps.assignment_change_events where operation='remove_workspace_candidate'),'private removal effects persisted');
end$$;
select'M04_PROJECT_POOL_REMOVAL_RETIRES_ONLY_ITS_ASSIGNMENTS_AND_RETAINS_LIBRARY_PASSED';

-- A pristine synthetic generated draft in the OTHER workspace. No provider or
-- source processing credit: these are direct SQL metadata fixtures for the guard.
do $$declare spec eps.specs;r eps.roles;role_value jsonb;job uuid:='8aaa0000-0000-4000-8000-000000000001';
 original_text text:='Synthetic original source retained only for SQL baseline-guard testing.';original_hash text;frozen jsonb;frozen_hash text;workspace_version bigint;begin
 select * into strict spec from eps.specs where workspace_id=current_setting('eps.casting.fixture.workspace2')::uuid;
 select * into strict r from eps.roles where workspace_id=spec.workspace_id and archived_at is null;
 role_value:=jsonb_build_object('source_role_key','synthetic-source-role','name',r.name,'headcount',1,'category',r.category,'requirements',r.requirements,'evidence','[]'::jsonb,'clarifications','[]'::jsonb);
 original_hash:=encode(sha256(convert_to(original_text,'UTF8')),'hex');
 select row_version into workspace_version from eps.workspaces where id=spec.workspace_id;
 frozen:=jsonb_build_object('schema_version','1.0','specs_id',spec.id,'source_hash',original_hash,'source_row_version',spec.source_row_version,'workspace_row_version',workspace_version,
  'configuration',jsonb_build_object('document_preparation_version','synthetic-source-guard.v1','model_version','synthetic-no-provider','prompt_version','synthetic-source-guard.v1','result_schema_version','1.0'));
 frozen_hash:=eps.jobs_hash_v1(frozen);
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,dedupe_key,status,stage,correlation_id)
 values(job,spec.workspace_id,current_setting('eps.casting.fixture.actor2')::uuid,'specs_extract',spec.id,frozen,frozen_hash,repeat('d',64),'succeeded','apply_specs','synthetic:m04-lifecycle-source-guard');
 insert into eps.specs_source_inputs(job_id,workspace_id,spec_id,source_row_version,source_hash,input_hash,source_text,source_asset_id,source_mime_type,source_size_bytes)
 values(job,spec.workspace_id,spec.id,spec.source_row_version,original_hash,frozen_hash,original_text,null,null,null);
 update eps.specs set source_text=original_text,normalized_instructions=null,source_language_codes='{}',clarifications='[]',source_extraction_job_id=job,
  source_extraction=jsonb_build_object('schema_version','1.0','source_asset_id',null,'source_language_codes','[]'::jsonb,'roles',jsonb_build_array(role_value),'general_instructions',null,'clarifications','[]'::jsonb)where id=spec.id;
 update eps.roles set source_job_id=job,source_role=role_value,spec_id=spec.id,row_version=1,clarifications='[]'where id=r.id;
 update eps.slots set label=r.name||' 1',row_version=1 where role_id=r.id;
 select * into spec from eps.specs where id=spec.id;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 execute'set local role eps_specs_apply_owner';
 perform pg_temp.lifecycle_assert(eps.specs_machine_baseline(spec),'unrelated active assignments do not disable pristine source correction globally');
 spec.normalized_instructions:='Synthetic later manual instruction';
 perform pg_temp.lifecycle_assert(not eps.specs_machine_baseline(spec),'existing manual instruction protection remains');
 execute'set local role postgres';
end$$;
select pg_temp.lifecycle_actor(current_setting('eps.casting.fixture.actor2')::uuid);
set local role authenticated;
do $$declare w uuid:=current_setting('eps.casting.fixture.workspace2')::uuid;s uuid;result jsonb;begin
 select(value->>'id')::uuid into strict s from jsonb_array_elements(public.eps_list_slots('8a3a0000-0000-4000-8000-000000000003',null,100)->'data');
 result:=pg_temp.lifecycle_add(w,s,'8a6a0000-0000-4000-8000-000000000003','lifecycle-other-project-source-assignment');
 perform set_config('eps.lifecycle.foreign_assignment',result->>'id',true);
end$$;
set local role postgres;
do $$declare spec eps.specs;begin
 select * into strict spec from eps.specs where workspace_id=current_setting('eps.casting.fixture.workspace2')::uuid;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 execute'set local role eps_specs_apply_owner';
 perform pg_temp.lifecycle_assert(eps.casting_has_active_assignments(spec.workspace_id),'service helper sees active rows through FORCE RLS without user project scope');
 perform pg_temp.lifecycle_assert(not eps.specs_machine_baseline(spec),'active casting prevents machine source replacement');
 execute'set local role postgres';
end$$;
select'M04_SOURCE_BASELINE_SCOPED_ASSIGNMENT_SERVICE_VISIBILITY_AND_MANUAL_PROTECTION_PASSED';

-- Ready supporting association is a SQL metadata fixture, NOT verified bytes.
insert into public.app_capability_grants(principal_id,capability)select actor,c from unnest(array['8a1a0000-0000-4000-8000-000000000001'::uuid,'8a1a0000-0000-4000-8000-000000000002'::uuid])actor cross join unnest(array['cast.read','cast.write'])c;
insert into public.app_capability_grants(principal_id,capability)values('8a1a0000-0000-4000-8000-000000000002','cast.review');
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status,sha256,width,height)
 values('8a7a0000-0000-4000-8000-000000000001','8a2a0000-0000-4000-8000-000000000001','candidate_support','synthetic-lifecycle.png','image/png','eps-candidate-support','synthetic/lifecycle/source-support.png',100,'ready',repeat('a',64),16,16);
insert into eps.support_uploads(id,asset_id,principal_id,workspace_id,candidate_id,bucket,object_key,expected_size_bytes,expected_mime_type,expected_sha256,status,completed_at,completion_value)
 values('8a8a0000-0000-4000-8000-000000000001','8a7a0000-0000-4000-8000-000000000001','8a1a0000-0000-4000-8000-000000000001','8a2a0000-0000-4000-8000-000000000001','8a5a0000-0000-4000-8000-000000000001','eps-candidate-support','synthetic/lifecycle/source-support.png',100,'image/png',repeat('a',64),'completed',clock_timestamp(),'{"synthetic_metadata_fixture":true}');
insert into eps.candidate_support(id,candidate_id,asset_id,upload_id,created_by)values('8a9a0000-0000-4000-8000-000000000001','8a5a0000-0000-4000-8000-000000000001','8a7a0000-0000-4000-8000-000000000001','8a8a0000-0000-4000-8000-000000000001','8a1a0000-0000-4000-8000-000000000001');
select set_config('eps.lifecycle.support_upload_hash',(select encode(sha256(convert_to(to_jsonb(u)::text,'UTF8')),'hex')from eps.support_uploads u where id='8a8a0000-0000-4000-8000-000000000001'),true);
select set_config('eps.lifecycle.support_asset_hash',(select encode(sha256(convert_to(to_jsonb(a)::text,'UTF8')),'hex')from eps.media_assets a where id='8a7a0000-0000-4000-8000-000000000001'),true);
select pg_temp.lifecycle_actor(current_setting('eps.casting.fixture.actor')::uuid);
set local role authenticated;
do $$declare w uuid:=current_setting('eps.casting.fixture.workspace')::uuid;a jsonb;b jsonb;body jsonb;begin
 a:=pg_temp.lifecycle_assignment(w,current_setting('eps.lifecycle.source_assignment')::uuid);
 a:=public.eps_update_assignment((a->>'id')::uuid,jsonb_build_object('row_version',a->'row_version','shortlist_included',true,'presentation_notes','Synthetic source note','internal_notes','Synthetic source private note','slide_wording','{"skills_experience":"Source display text"}'::jsonb),'lifecycle-source-choice-notes');
 b:=pg_temp.lifecycle_assignment(w,current_setting('eps.lifecycle.target_assignment')::uuid);
 b:=public.eps_update_assignment((b->>'id')::uuid,jsonb_build_object('row_version',b->'row_version','position','backup','presentation_notes','Synthetic retained target note','slide_wording','{"skills_experience":"Retained target display"}'::jsonb),'lifecycle-target-choice-notes');
 perform public.eps_set_slot_main(current_setting('eps.casting.fixture.slot')::uuid,jsonb_build_object('assignment_id',a->'id','expected_slot_row_version',pg_temp.lifecycle_slot_version(current_setting('eps.casting.fixture.slot')::uuid),'replacement_behavior','move_previous_to_backup'),'lifecycle-source-main-before-link');
 body:='{"row_version":1,"action":"link_existing","existing_candidate_id":"8a5a0000-0000-4000-8000-000000000002","existing_candidate_row_version":1}';
 begin perform public.eps_resolve_candidate_duplicate('8a5a0000-0000-4000-8000-000000000001',body,'lifecycle-hidden-source-project-denied');raise exception'EXPECTED_RESOURCE_NOT_FOUND';
 exception when sqlstate'P0001'then if sqlerrm<>'RESOURCE_NOT_FOUND'then raise;end if;end;
 begin perform eps.casting_duplicate_workspace_ids('8a5a0000-0000-4000-8000-000000000001');raise exception'EXPECTED_PRIVATE_SCOPE_HELPER_DENIAL';exception when insufficient_privilege then null;end;
end$$;
set local role postgres;
select set_config('eps.lifecycle.target_pool_hash',(select encode(sha256(convert_to(to_jsonb(w)::text,'UTF8')),'hex')from eps.workspace_candidates w where id=current_setting('eps.casting.fixture.pool2')::uuid),true);
select set_config('eps.lifecycle.slot_before_merge',(select row_version::text from eps.slots where id=current_setting('eps.casting.fixture.slot')::uuid),true);
select pg_temp.lifecycle_actor(current_setting('eps.casting.fixture.actor2')::uuid);
set local role authenticated;
do $$declare target jsonb;body jsonb;res jsonb;begin
 target:=public.eps_confirm_candidate_reviewed('8a5a0000-0000-4000-8000-000000000002','{"row_version":1}','lifecycle-confirm-target-facts');
 perform set_config('eps.lifecycle.target_before_merge',target::text,true);
 body:=jsonb_build_object('row_version',1,'action','link_existing','existing_candidate_id',target->'id','existing_candidate_row_version',target->'row_version');
 res:=public.eps_resolve_candidate_duplicate('8a5a0000-0000-4000-8000-000000000001',body,'lifecycle-explicit-authorized-identity-link');
 perform pg_temp.lifecycle_assert(res=public.eps_resolve_candidate_duplicate('8a5a0000-0000-4000-8000-000000000001',body,'lifecycle-explicit-authorized-identity-link'),'same-key link replays after source pool rekey');
 perform pg_temp.lifecycle_assert(res->'facts'=target->'facts'and res->'review_status'=target->'review_status'and res->'row_version'=target->'row_version','target facts/review/version not overwritten');
 perform set_config('eps.lifecycle.merge_request',body::text,true);
end$$;
set local role postgres;
do $$declare source_id uuid:=current_setting('eps.lifecycle.source_assignment')::uuid;target_id uuid:=current_setting('eps.lifecycle.target_assignment')::uuid;begin
 perform pg_temp.lifecycle_assert((select archived_at is not null from eps.assignments where id=source_id),'same-slot source duplicate archived');
 perform pg_temp.lifecycle_assert((select archived_at is null and position='main'and shortlist_included and presentation_notes='Synthetic retained target note'and slide_wording->>'skills_experience'='Retained target display'and sort_order=1 from eps.assignments where id=target_id),'target assignment ID/order/note/wording kept; Main precedence and Shortlist OR applied');
 perform pg_temp.lifecycle_assert((select workspace_candidate_id=current_setting('eps.casting.fixture.pool2')::uuid and archived_at is null from eps.assignments where id=current_setting('eps.lifecycle.other_assignment')::uuid),'independent source role remapped to existing target pool');
 perform pg_temp.lifecycle_assert((select workspace_candidate_id='8a6a0000-0000-4000-8000-000000000003'and row_version=2 and archived_at is null from eps.assignments where id=current_setting('eps.lifecycle.foreign_assignment')::uuid),'other project retains same participation and assignment identity');
 perform pg_temp.lifecycle_assert((select row_version=current_setting('eps.lifecycle.slot_before_merge')::bigint+1 from eps.slots where id=current_setting('eps.casting.fixture.slot')::uuid),'merge bumps affected slot once');
 perform pg_temp.lifecycle_assert((select encode(sha256(convert_to(to_jsonb(w)::text,'UTF8')),'hex')=current_setting('eps.lifecycle.target_pool_hash')from eps.workspace_candidates w where id=current_setting('eps.casting.fixture.pool2')::uuid),'target project availability/media/frame/notes row preserved exactly (fixture uses NULL media)');
 perform pg_temp.lifecycle_assert(exists(select 1 from eps.assignment_change_events where operation='link_duplicate'and payload#>>'{before,0,presentation_notes}'='Synthetic source note'and payload#>>'{before,1,presentation_notes}'='Synthetic retained target note'),'both original assignment notes kept in private effect');
 perform pg_temp.lifecycle_assert((select candidate_id='8a5a0000-0000-4000-8000-000000000002'and row_version=2 from eps.candidate_support where id='8a9a0000-0000-4000-8000-000000000001'),'post19 supporting association transfer hook preserved');
 perform pg_temp.lifecycle_assert((select encode(sha256(convert_to(to_jsonb(u)::text,'UTF8')),'hex')=current_setting('eps.lifecycle.support_upload_hash')from eps.support_uploads u where id='8a8a0000-0000-4000-8000-000000000001'),'original upload identity/verification metadata immutable');
 perform pg_temp.lifecycle_assert((select encode(sha256(convert_to(to_jsonb(a)::text,'UTF8')),'hex')=current_setting('eps.lifecycle.support_asset_hash')from eps.media_assets a where id='8a7a0000-0000-4000-8000-000000000001'),'original supporting asset metadata immutable');
 update public.project_memberships set can_write=false where principal_id=current_setting('eps.casting.fixture.actor2')::uuid and project_id='8a0a0000-0000-4000-8000-000000000002';
end$$;
set local role authenticated;
do $$begin
 begin perform public.eps_resolve_candidate_duplicate('8a5a0000-0000-4000-8000-000000000001',current_setting('eps.lifecycle.merge_request')::jsonb,'lifecycle-explicit-authorized-identity-link');raise exception'EXPECTED_REVOKED_PROJECT_REPLAY_DENIAL';
 exception when sqlstate'P0001'then if sqlerrm<>'RESOURCE_NOT_FOUND'then raise;end if;end;
end$$;
set local role postgres;
-- A library-only editor can explicitly resolve two identities that have no
-- project participation. Empty scope must not invent project-write authority.
insert into eps.candidates(id,facts,casting_id,source_kind,created_by)
 select id,jsonb_set(c.facts,'{casting_id}',to_jsonb(casting_id)),casting_id,'manual',c.created_by
 from(values('8a5a0000-0000-4000-8000-000000000004'::uuid,'M04-SYNTHETIC-LIBRARY-1'),('8a5a0000-0000-4000-8000-000000000005'::uuid,'M04-SYNTHETIC-LIBRARY-2'))v(id,casting_id)
 cross join lateral(select facts,created_by from eps.candidates where id='8a5a0000-0000-4000-8000-000000000002')c;
update public.app_capability_grants set active=false where principal_id=current_setting('eps.casting.fixture.actor')::uuid and capability in('workspaces.read','workspaces.write');
select pg_temp.lifecycle_actor(current_setting('eps.casting.fixture.actor')::uuid);
set local role authenticated;
do $$declare body jsonb;target jsonb;result jsonb;begin
 perform pg_temp.lifecycle_assert(eps.has_capability('cast.read')and eps.has_capability('cast.write')and not eps.has_capability('workspaces.read')and not eps.has_capability('workspaces.write'),'library-only editor has no project workspace authority');
 target:=public.eps_get_candidate('8a5a0000-0000-4000-8000-000000000005');
 body:='{"row_version":1,"action":"link_existing","existing_candidate_id":"8a5a0000-0000-4000-8000-000000000005","existing_candidate_row_version":1}';
 result:=public.eps_resolve_candidate_duplicate('8a5a0000-0000-4000-8000-000000000004',body,'lifecycle-library-only-explicit-link');
 perform pg_temp.lifecycle_assert(result=public.eps_resolve_candidate_duplicate('8a5a0000-0000-4000-8000-000000000004',body,'lifecycle-library-only-explicit-link'),'library-only link replays without workspace permission');
 perform pg_temp.lifecycle_assert(result->'facts'=target->'facts'and result->'review_status'=target->'review_status'and result->'row_version'=target->'row_version','library-only target facts/review/version retained');
end$$;
set local role postgres;
do $$begin
 perform pg_temp.lifecycle_assert((select merged_into_candidate_id='8a5a0000-0000-4000-8000-000000000005'from eps.candidates where id='8a5a0000-0000-4000-8000-000000000004'),'library-only source explicitly linked');
 perform pg_temp.lifecycle_assert(not exists(select 1 from eps.workspace_candidates where candidate_id in('8a5a0000-0000-4000-8000-000000000004','8a5a0000-0000-4000-8000-000000000005')),'library-only link invents no project participation');
end$$;
select'M04_EXPLICIT_DUPLICATE_COLLAPSE_SUPPORT_IMMUTABILITY_HIDDEN_SCOPE_AND_REVOKED_REPLAY_PASSED';
