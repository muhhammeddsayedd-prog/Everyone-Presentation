-- Run ONLY after the exact reviewed specs candidate, in one owned-local
-- BEGIN ... ROLLBACK rehearsal. No provider/assignment/concurrency proof claimed.
-- Parent harness prelude BEFORE installing candidate (collision-guard first):
-- public.projects(id,name) = 7b710000-0000-4000-8000-000000000001,
-- 'Synthetic specs backfill fixture'; eps.workspaces id7c710000-0000-4000-8000-000000000001,
-- project_id that fixture, row_version19,draft_revision17,has_unpublished_changestrue.
-- No Auth principal or new cloud record is needed for this owned-local prelude.
do $$ begin
  if current_setting('eps.specs_candidate_rehearsal',true) is distinct from 'rollback-only-v1'
    or current_user<>'postgres' then raise exception 'SPECS_ROLLBACK_HARNESS_REQUIRED'; end if;
  if exists(select 1 from auth.users where id::text like '7a700000-%')
    or exists(select 1 from public.projects where id::text like '7b700000-%')
  then raise exception 'SPECS_FIXTURE_COLLISION_PRESERVE_DATA'; end if;
  if not exists(select 1 from eps.workspaces where id='7c710000-0000-4000-8000-000000000001'
    and project_id='7b710000-0000-4000-8000-000000000001' and row_version=19 and draft_revision=17)
  then raise exception 'SPECS_PRE_CANDIDATE_BACKFILL_FIXTURE_REQUIRED'; end if;
end $$;
create function pg_temp.specs_assert(condition boolean,label text) returns void language plpgsql as $$ begin
  if condition is distinct from true then raise exception 'SPECS_ASSERTION: %',label; end if;
end $$;
create function pg_temp.specs_expect(query text,expected text) returns void language plpgsql as $$ begin
  begin execute query; exception when others then
    if sqlerrm=expected or sqlstate=expected then return; end if;
    raise exception 'SPECS_WRONG_ERROR expected %, got % / %',expected,sqlstate,sqlerrm;
  end;
  raise exception 'SPECS_EXPECTED_ERROR_NOT_RAISED: %',expected;
end $$;
create function pg_temp.specs_actor(principal uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub',principal::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',principal,'role','authenticated','is_anonymous',false)::text,true);
end $$;
create function pg_temp.specs_put(name text,value jsonb) returns void language plpgsql as $$ begin perform set_config(name,value::text,true); end $$;
create function pg_temp.specs_get(name text) returns jsonb language sql stable as $$ select current_setting(name)::jsonb $$;
create function pg_temp.specs_requirements() returns jsonb language sql immutable as $$
  select '{"age_range":null,"gender_requirement":null,"appearance_performance":null,"languages":[],"accents":[],"skills":[],"scene_references":["1","3"],"shoot_dates":[],"location":null,"availability_requirements":null,"other_instructions":null}'::jsonb
$$;
create function pg_temp.specs_snapshot() returns jsonb language sql stable as $$
  select jsonb_build_array(
    (select jsonb_agg(jsonb_build_array(id,row_version,name,headcount,archived_at) order by id) from eps.roles where workspace_id='7c700000-0000-4000-8000-000000000001'),
    (select jsonb_agg(jsonb_build_array(id,row_version,label,provisional,archived_at) order by id) from eps.slots where workspace_id='7c700000-0000-4000-8000-000000000001'),
    (select jsonb_build_array(row_version,normalized_instructions) from eps.specs where workspace_id='7c700000-0000-4000-8000-000000000001'),
    (select jsonb_build_array(row_version,draft_revision) from eps.workspaces where id='7c700000-0000-4000-8000-000000000001'),
    (select count(*) from eps.audit_events),(select count(*) from eps.idempotency_records))
$$;
insert into auth.users(id) values('7a700000-0000-4000-8000-000000000001'),('7a700000-0000-4000-8000-000000000002'),('7a700000-0000-4000-8000-000000000003');
insert into public.projects(id,name) values('7b700000-0000-4000-8000-000000000001','Synthetic specs draft'),('7b700000-0000-4000-8000-000000000002','Synthetic other specs');
insert into public.project_memberships(project_id,principal_id,can_write) values
 ('7b700000-0000-4000-8000-000000000001','7a700000-0000-4000-8000-000000000001',true),
 ('7b700000-0000-4000-8000-000000000001','7a700000-0000-4000-8000-000000000002',false),
 ('7b710000-0000-4000-8000-000000000001','7a700000-0000-4000-8000-000000000001',true),
 ('7b700000-0000-4000-8000-000000000002','7a700000-0000-4000-8000-000000000003',true);
insert into public.app_capability_grants(principal_id,capability)
 select principal,capability from unnest(array['7a700000-0000-4000-8000-000000000001'::uuid,'7a700000-0000-4000-8000-000000000003'::uuid]) principal
 cross join unnest(array['projects.read','workspaces.read','workspaces.write']) capability;
insert into public.app_capability_grants(principal_id,capability)
 select '7a700000-0000-4000-8000-000000000002',capability from unnest(array['projects.read','workspaces.read']) capability;
insert into eps.workspaces(id,project_id) values('7c700000-0000-4000-8000-000000000001','7b700000-0000-4000-8000-000000000001'),('7c700000-0000-4000-8000-000000000002','7b700000-0000-4000-8000-000000000002');
select pg_temp.specs_assert((select count(*)=2 from eps.specs where workspace_id::text like '7c700000-%'),'insert trigger persists one stable spec per workspace');
select pg_temp.specs_assert((select count(*)=1 and bool_and(source_asset_id is null and source_text is null and processing_job_id is null and row_version=1)
 from eps.specs where workspace_id='7c710000-0000-4000-8000-000000000001'),'pre-existing workspace receives exactly one persistent empty spec through backfill');
select pg_temp.specs_put('eps.specs_test.jobs_before',(select to_jsonb(count(*)) from eps.jobs));
-- Trusted synthetic evidence fixture; no public source/job/asset setter is exposed.
update eps.specs set source_text='العمر غير محدد. Original English and Arabic source.',
 source_extraction='{"synthetic_evidence_only":true,"original_uncertainty":"age not specified"}'
 where workspace_id='7c700000-0000-4000-8000-000000000001';
select pg_temp.specs_assert((select count(*)=3 from pg_class where oid in('eps.specs'::regclass,'eps.roles'::regclass,'eps.slots'::regclass) and relrowsecurity and relforcerowsecurity),'draft tables force RLS');
select pg_temp.specs_assert(not has_table_privilege('authenticated','eps.specs','SELECT') and not has_table_privilege('authenticated','eps.roles','INSERT')
 and not has_function_privilege('authenticated','eps.specs_lock_workspace(uuid)','EXECUTE'),'no direct table/internal operation authority');
select pg_temp.specs_assert(not has_table_privilege('eps_specs_owner','eps.jobs','INSERT')
 and not has_function_privilege('eps_specs_owner','eps.m02_enqueue_specs_job(uuid,jsonb,text)','EXECUTE'),'manual draft role cannot forge processing jobs');
select pg_temp.specs_assert(has_column_privilege('eps_specs_initializer','eps.specs','workspace_id','INSERT')
 and not has_column_privilege('eps_specs_initializer','eps.specs','source_text','INSERT')
 and not has_table_privilege('eps_specs_initializer','eps.specs','SELECT')
 and not exists(select 1 from pg_roles where rolname in('eps_specs_owner','eps_specs_initializer') and (rolcanlogin or rolsuper or rolbypassrls)),'initializer is narrowly insert-only and both function roles cannot bypass RLS');

select pg_temp.specs_actor('7a700000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.specs_put('eps.specs_test.backfill',public.eps_get_specs('7c710000-0000-4000-8000-000000000001'));
select pg_temp.specs_assert(public.eps_get_specs('7c710000-0000-4000-8000-000000000001')=pg_temp.specs_get('eps.specs_test.backfill'),'backfilled spec GET is stable and read-only');
select pg_temp.specs_put('eps.specs_test.spec',public.eps_get_specs('7c700000-0000-4000-8000-000000000001'));
select pg_temp.specs_assert(public.eps_get_specs('7c700000-0000-4000-8000-000000000001')->>'id'=pg_temp.specs_get('eps.specs_test.spec')->>'id','GET reads stable identity without creating a spec');
select pg_temp.specs_put('eps.specs_test.unknown',public.eps_create_role('7c700000-0000-4000-8000-000000000001',
 jsonb_build_object('name','Waiter','headcount',null,'requirements',pg_temp.specs_requirements()),'specs-unknown'));
select pg_temp.specs_put('eps.specs_test.three',public.eps_create_role('7c700000-0000-4000-8000-000000000001',
 jsonb_build_object('name','Waiter','headcount',3,'requirements',pg_temp.specs_requirements()),'specs-three'));
select pg_temp.specs_assert(public.eps_create_role('7c700000-0000-4000-8000-000000000001',
 jsonb_build_object('name','Waiter','headcount',3,'requirements',pg_temp.specs_requirements()),'specs-three')=pg_temp.specs_get('eps.specs_test.three'),'same intent replays one role');
select pg_temp.specs_expect('select public.eps_create_role(''7c700000-0000-4000-8000-000000000001'',jsonb_build_object(''name'',''Changed'',''headcount'',3,''requirements'',pg_temp.specs_requirements()),''specs-three'')','IDEMPOTENCY_KEY_REUSED');
select pg_temp.specs_expect('select public.eps_create_role(''7c700000-0000-4000-8000-000000000001'',jsonb_build_object(''name'',''Zero'',''headcount'',0,''requirements'',pg_temp.specs_requirements()),''specs-zero'')','INVALID_REQUEST');
select pg_temp.specs_expect('select public.eps_create_role(''7c700000-0000-4000-8000-000000000001'',jsonb_build_object(''name'',''Missing'',''requirements'',pg_temp.specs_requirements()),''specs-missing'')','INVALID_REQUEST');
select pg_temp.specs_expect('select public.eps_create_role(''7c700000-0000-4000-8000-000000000001'',jsonb_build_object(''name'',''Large'',''headcount'',9007199254740991,''requirements'',pg_temp.specs_requirements()),''specs-large'')','SLOT_ALLOCATION_LIMIT_EXCEEDED');
select pg_temp.specs_expect('select public.eps_create_role(''7c700000-0000-4000-8000-000000000001'',jsonb_build_object(''name'',''Forged'',''headcount'',1,''principal_id'',''admin'',''requirements'',pg_temp.specs_requirements()),''specs-forged'')','INVALID_REQUEST');
select pg_temp.specs_put('eps.specs_test.original_slots',public.eps_list_slots((pg_temp.specs_get('eps.specs_test.three')->>'id')::uuid,null,100)->'data');
select pg_temp.specs_assert(jsonb_array_length(pg_temp.specs_get('eps.specs_test.original_slots'))=3,'three people creates three slots, not one per scene');
select pg_temp.specs_assert(jsonb_array_length(public.eps_list_roles('7c700000-0000-4000-8000-000000000001',null,1)->'data')=1
 and public.eps_list_roles('7c700000-0000-4000-8000-000000000001',null,1)->'page'->>'next_cursor' is not null,'stable role order uses bounded cursor pages');
reset role;
select pg_temp.specs_assert((select headcount is null from eps.roles where id=(pg_temp.specs_get('eps.specs_test.unknown')->>'id')::uuid)
 and (select count(*)=1 and bool_and(provisional) from eps.slots where role_id=(pg_temp.specs_get('eps.specs_test.unknown')->>'id')::uuid and archived_at is null),'unknown count remains null with one provisional slot');
update eps.roles set source_role='{"headcount":null,"requirements":{"age_range":null},"evidence":[{"quote":"العمر غير محدد"}]}',
 clarifications='[{"field_path":"headcount","reason":"Unknown count","source":null,"resolved":false},{"field_path":"requirements.age_range","reason":"Age not supplied","source":null,"resolved":false},{"field_path":"requirements.shoot_dates","reason":"Date not supplied","source":null,"resolved":false}]'
 where id=(pg_temp.specs_get('eps.specs_test.unknown')->>'id')::uuid;
select pg_temp.specs_put('eps.specs_test.first_slot',(select to_jsonb(id) from eps.slots where role_id=(pg_temp.specs_get('eps.specs_test.unknown')->>'id')::uuid));
select pg_temp.specs_put('eps.specs_test.draft_before',(select to_jsonb(draft_revision) from eps.workspaces where id='7c700000-0000-4000-8000-000000000001'));
set local role authenticated;
select public.eps_update_role((pg_temp.specs_get('eps.specs_test.unknown')->>'id')::uuid,
 jsonb_build_object('row_version',1,'requirements',pg_temp.specs_requirements()||'{"age_range":"20–35"}',
 'clarifications','[{"field_path":"requirements.age_range","reason":"Age not supplied","source":null,"resolved":true}]'::jsonb));
select pg_temp.specs_expect('select public.eps_update_role((pg_temp.specs_get(''eps.specs_test.unknown'')->>''id'')::uuid,''{"row_version":1,"name":"Stale"}'')','STALE_RESOURCE_VERSION');
select pg_temp.specs_expect('select public.eps_update_specs(''7c700000-0000-4000-8000-000000000001'',''{"row_version":1,"source_text":"forged replacement"}'')','INVALID_REQUEST');
select public.eps_update_specs('7c700000-0000-4000-8000-000000000001','{"row_version":1,"normalized_instructions":"Producer correction"}');
select pg_temp.specs_expect('select public.eps_update_specs(''7c700000-0000-4000-8000-000000000001'',''{"row_version":1,"normalized_instructions":"Stale"}'')','STALE_RESOURCE_VERSION');
select public.eps_resize_role_slots((pg_temp.specs_get('eps.specs_test.unknown')->>'id')::uuid,'{"row_version":2,"desired_count":1}','confirm-unknown');
reset role;
select pg_temp.specs_assert((select source_text='العمر غير محدد. Original English and Arabic source.' and source_extraction->>'original_uncertainty'='age not specified' and processing_job_id is null
 from eps.specs where workspace_id='7c700000-0000-4000-8000-000000000001'),'manual edit retains original source and never fabricates a processing job');
select pg_temp.specs_assert((select source_role->'headcount'='null'::jsonb and source_role->'requirements'->'age_range'='null'::jsonb
 and exists(select 1 from jsonb_array_elements(clarifications) item where item->>'field_path'='requirements.age_range' and item->>'resolved'='true')
 and exists(select 1 from jsonb_array_elements(clarifications) item where item->>'field_path'='requirements.shoot_dates' and item->>'resolved'='false')
 from eps.roles where id=(pg_temp.specs_get('eps.specs_test.unknown')->>'id')::uuid),'working confirmation retains unrelated uncertainty and original role evidence');
select pg_temp.specs_assert((select id=trim(both '"' from pg_temp.specs_get('eps.specs_test.first_slot')::text)::uuid and not provisional from eps.slots where role_id=(pg_temp.specs_get('eps.specs_test.unknown')->>'id')::uuid),'count confirmation keeps slot identity');
select pg_temp.specs_assert((select draft_revision=(pg_temp.specs_get('eps.specs_test.draft_before')::text)::bigint+3 and has_unpublished_changes from eps.workspaces where id='7c700000-0000-4000-8000-000000000001'),'each successful manual mutation advances actual workspace draft');

set local role authenticated;
select pg_temp.specs_expect('select public.eps_resize_role_slots((pg_temp.specs_get(''eps.specs_test.three'')->>''id'')::uuid,''{"row_version":1,"desired_count":2}'',''shrink-without-choice'')','SLOT_RETIREMENT_REQUIRED');
select pg_temp.specs_put('eps.specs_test.resized',public.eps_resize_role_slots((pg_temp.specs_get('eps.specs_test.three')->>'id')::uuid,
 jsonb_build_object('row_version',1,'desired_count',2,'retire_slot_ids',jsonb_build_array(pg_temp.specs_get('eps.specs_test.original_slots')->1->>'id')),'shrink-explicit'));
select pg_temp.specs_assert(public.eps_resize_role_slots((pg_temp.specs_get('eps.specs_test.three')->>'id')::uuid,
 jsonb_build_object('row_version',1,'desired_count',2,'retire_slot_ids',jsonb_build_array(pg_temp.specs_get('eps.specs_test.original_slots')->1->>'id')),'shrink-explicit')=pg_temp.specs_get('eps.specs_test.resized'),'resize retry replays without a second effect');
select public.eps_resize_role_slots((pg_temp.specs_get('eps.specs_test.three')->>'id')::uuid,'{"row_version":2,"desired_count":3}','grow-again');
select public.eps_update_slot((pg_temp.specs_get('eps.specs_test.original_slots')->0->>'id')::uuid,'{"row_version":1,"label":"Waiter A"}');
reset role;
select pg_temp.specs_assert((select array_agg(ordinal order by sort_order)=array[1,3,4]::bigint[] and count(*)=3 from eps.slots
 where role_id=(pg_temp.specs_get('eps.specs_test.three')->>'id')::uuid and archived_at is null),'growth preserves survivors and appends ordinal4, never reusing retired2');
select pg_temp.specs_assert((select count(*)=4 from eps.slots where role_id=(pg_temp.specs_get('eps.specs_test.three')->>'id')::uuid),'retired slot remains stored for history');
-- A relation-name sentinel exercises only the fail-closed integration gate.
-- It is not an invented assignment schema or proof of assignment retirement.
create view eps.assignments as select 1 as synthetic_gate_sentinel;
set local role authenticated;
select pg_temp.specs_expect('select public.eps_archive_role((pg_temp.specs_get(''eps.specs_test.three'')->>''id'')::uuid,''{"row_version":3}'',''archive-blocked'')','ASSIGNMENT_RETIREMENT_UNAVAILABLE');
select pg_temp.specs_expect('select public.eps_resize_role_slots((pg_temp.specs_get(''eps.specs_test.three'')->>''id'')::uuid,jsonb_build_object(''row_version'',3,''desired_count'',2,''retire_slot_ids'',jsonb_build_array(pg_temp.specs_get(''eps.specs_test.original_slots'')->0->>''id'')),''shrink-blocked'')','ASSIGNMENT_RETIREMENT_UNAVAILABLE');
reset role;
drop view eps.assignments;

-- Fail after role insertion to prove slot failure rolls back role, draft and audit.
create function pg_temp.specs_break_slot() returns trigger language plpgsql as $$ begin raise exception 'SYNTHETIC_SLOT_FAILURE'; end $$;
create trigger specs_test_break before insert on eps.slots for each row execute function pg_temp.specs_break_slot();
select pg_temp.specs_put('eps.specs_test.atomic_before',(select jsonb_build_array((select count(*) from eps.roles),(select draft_revision from eps.workspaces where id='7c700000-0000-4000-8000-000000000001'),(select count(*) from eps.audit_events))));
set local role authenticated;
select pg_temp.specs_expect('select public.eps_create_role(''7c700000-0000-4000-8000-000000000001'',jsonb_build_object(''name'',''Atomic failure'',''headcount'',1,''requirements'',pg_temp.specs_requirements()),''atomic-failure'')','SYNTHETIC_SLOT_FAILURE');
reset role;
drop trigger specs_test_break on eps.slots;
select pg_temp.specs_assert(pg_temp.specs_get('eps.specs_test.atomic_before')=(select jsonb_build_array((select count(*) from eps.roles),(select draft_revision from eps.workspaces where id='7c700000-0000-4000-8000-000000000001'),(select count(*) from eps.audit_events)))
 and not exists(select 1 from eps.idempotency_records where operation='specs.create_role' and key='atomic-failure'),'failure rolls back every coupled draft effect');
set local role authenticated;
select pg_temp.specs_put('eps.specs_test.provisional',public.eps_create_role('7c700000-0000-4000-8000-000000000001',
 jsonb_build_object('name','Provisional suppression fixture','headcount',null,'requirements',pg_temp.specs_requirements()),'suppression-provisional-fixture'));
reset role;

-- Silent suppression differs from an exception: exact effect checks must catch
-- it and roll back any already-inserted slot, versions, draft, audit and replay.
create function pg_temp.specs_suppress_write() returns trigger language plpgsql as $$ begin return null; end $$;
create trigger specs_test_suppress before update on eps.specs for each row execute function pg_temp.specs_suppress_write();
create trigger specs_test_suppress before update on eps.roles for each row execute function pg_temp.specs_suppress_write();
create trigger specs_test_suppress before update on eps.slots for each row execute function pg_temp.specs_suppress_write();
select pg_temp.specs_put('eps.specs_test.suppress_before',pg_temp.specs_snapshot());
set local role authenticated;
select pg_temp.specs_expect('select public.eps_update_specs(''7c700000-0000-4000-8000-000000000001'',''{"row_version":2,"normalized_instructions":"Suppressed"}'')','SPECS_STATE_INVALID');
select pg_temp.specs_expect('select public.eps_update_role((pg_temp.specs_get(''eps.specs_test.three'')->>''id'')::uuid,''{"row_version":3,"name":"Suppressed"}'')','SPECS_STATE_INVALID');
select pg_temp.specs_expect('select public.eps_update_slot((pg_temp.specs_get(''eps.specs_test.original_slots'')->0->>''id'')::uuid,''{"row_version":2,"label":"Suppressed"}'')','SPECS_STATE_INVALID');
select pg_temp.specs_expect('select public.eps_resize_role_slots((pg_temp.specs_get(''eps.specs_test.three'')->>''id'')::uuid,''{"row_version":3,"desired_count":4}'',''suppressed-role-after-slot'')','SPECS_STATE_INVALID');
select pg_temp.specs_expect('select public.eps_resize_role_slots((pg_temp.specs_get(''eps.specs_test.three'')->>''id'')::uuid,jsonb_build_object(''row_version'',3,''desired_count'',2,''retire_slot_ids'',jsonb_build_array(pg_temp.specs_get(''eps.specs_test.original_slots'')->0->>''id'')),''suppressed-retirement'')','SPECS_STATE_INVALID');
select pg_temp.specs_expect('select public.eps_resize_role_slots((pg_temp.specs_get(''eps.specs_test.provisional'')->>''id'')::uuid,''{"row_version":1,"desired_count":1}'',''suppressed-provisional-confirmation'')','SPECS_STATE_INVALID');
select pg_temp.specs_expect('select public.eps_archive_role((pg_temp.specs_get(''eps.specs_test.three'')->>''id'')::uuid,''{"row_version":3}'',''suppressed-archive'')','SPECS_STATE_INVALID');
reset role;
select pg_temp.specs_assert(pg_temp.specs_snapshot()=pg_temp.specs_get('eps.specs_test.suppress_before'),'suppressed single/bulk child updates roll back every coupled effect');
drop trigger specs_test_suppress on eps.specs;
drop trigger specs_test_suppress on eps.roles;
drop trigger specs_test_suppress on eps.slots;
create trigger specs_test_suppress_insert before insert on eps.slots for each row execute function pg_temp.specs_suppress_write();
set local role authenticated;
select pg_temp.specs_expect('select public.eps_create_role(''7c700000-0000-4000-8000-000000000001'',jsonb_build_object(''name'',''Suppressed slot'',''headcount'',1,''requirements'',pg_temp.specs_requirements()),''suppressed-slot-insert'')','SPECS_STATE_INVALID');
reset role;
drop trigger specs_test_suppress_insert on eps.slots;
create trigger specs_test_suppress_insert before insert on eps.roles for each row execute function pg_temp.specs_suppress_write();
set local role authenticated;
select pg_temp.specs_expect('select public.eps_create_role(''7c700000-0000-4000-8000-000000000001'',jsonb_build_object(''name'',''Suppressed role'',''headcount'',1,''requirements'',pg_temp.specs_requirements()),''suppressed-role-insert'')','SPECS_STATE_INVALID');
reset role;
drop trigger specs_test_suppress_insert on eps.roles;
select pg_temp.specs_assert(pg_temp.specs_snapshot()=pg_temp.specs_get('eps.specs_test.suppress_before'),'suppressed role/slot insert cannot commit a mismatched headcount or replay');
create trigger specs_test_suppress_insert before insert on eps.specs for each row execute function pg_temp.specs_suppress_write();
select pg_temp.specs_expect('insert into eps.workspaces(id,project_id,archived_at) values(''7c700000-0000-4000-8000-000000000003'',''7b700000-0000-4000-8000-000000000001'',clock_timestamp())','SPECS_INITIALIZATION_FAILED');
drop trigger specs_test_suppress_insert on eps.specs;
select pg_temp.specs_assert(not exists(select 1 from eps.workspaces where id='7c700000-0000-4000-8000-000000000003'),'suppressed initialization cannot commit a workspace without its stable spec');

set local role authenticated;
select pg_temp.specs_actor('7a700000-0000-4000-8000-000000000002');
select pg_temp.specs_assert(public.eps_get_specs('7c700000-0000-4000-8000-000000000001')->>'source_text'='العمر غير محدد. Original English and Arabic source.','permitted readonly actor can inspect internal source');
select pg_temp.specs_expect('select public.eps_update_role((pg_temp.specs_get(''eps.specs_test.three'')->>''id'')::uuid,''{"row_version":3,"name":"No permission"}'')','CAPABILITY_REQUIRED');
select pg_temp.specs_expect('select * from eps.specs','42501');
select pg_temp.specs_actor('7a700000-0000-4000-8000-000000000003');
select pg_temp.specs_expect('select public.eps_get_specs(''7c700000-0000-4000-8000-000000000001'')','RESOURCE_NOT_FOUND');
select pg_temp.specs_expect('select public.eps_update_slot((pg_temp.specs_get(''eps.specs_test.original_slots'')->0->>''id'')::uuid,''{"row_version":2,"label":"Other project"}'')','RESOURCE_NOT_FOUND');
select pg_temp.specs_actor('7a700000-0000-4000-8000-000000000001');
reset role;
update public.project_memberships set active=false where project_id='7b700000-0000-4000-8000-000000000001' and principal_id='7a700000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.specs_expect('select public.eps_create_role(''7c700000-0000-4000-8000-000000000001'',jsonb_build_object(''name'',''Waiter'',''headcount'',3,''requirements'',pg_temp.specs_requirements()),''specs-three'')','RESOURCE_NOT_FOUND');
reset role;
update public.project_memberships set active=true where project_id='7b700000-0000-4000-8000-000000000001' and principal_id='7a700000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.specs_put('eps.specs_test.archive',public.eps_archive_role((pg_temp.specs_get('eps.specs_test.three')->>'id')::uuid,'{"row_version":3,"reason":null}','archive-explicit'));
select pg_temp.specs_assert(public.eps_archive_role((pg_temp.specs_get('eps.specs_test.three')->>'id')::uuid,'{"row_version":3,"reason":null}','archive-explicit')=pg_temp.specs_get('eps.specs_test.archive'),'nullable-reason archival replay remains valid without recreating active rows');
select pg_temp.specs_expect('select public.eps_archive_role((pg_temp.specs_get(''eps.specs_test.three'')->>''id'')::uuid,''{"row_version":3,"reason":"Changed"}'',''archive-explicit'')','IDEMPOTENCY_KEY_REUSED');
select pg_temp.specs_expect('select public.eps_archive_role((pg_temp.specs_get(''eps.specs_test.unknown'')->>''id'')::uuid,''{"row_version":3,"reason":42}'',''archive-nontext'')','INVALID_REQUEST');
select pg_temp.specs_put('eps.specs_test.archive_text',public.eps_archive_role((pg_temp.specs_get('eps.specs_test.unknown')->>'id')::uuid,'{"row_version":3,"reason":""}','archive-empty-text'));
select pg_temp.specs_assert(public.eps_archive_role((pg_temp.specs_get('eps.specs_test.unknown')->>'id')::uuid,'{"row_version":3,"reason":""}','archive-empty-text')=pg_temp.specs_get('eps.specs_test.archive_text'),'empty text reason is valid and replayable');
select pg_temp.specs_expect('select public.eps_archive_role((pg_temp.specs_get(''eps.specs_test.unknown'')->>''id'')::uuid,''{"row_version":3,"reason":"Ordinary correction"}'',''archive-empty-text'')','IDEMPOTENCY_KEY_REUSED');
reset role;
select pg_temp.specs_assert((select count(*)=4 and bool_and(archived_at is not null) from eps.slots where role_id=(pg_temp.specs_get('eps.specs_test.three')->>'id')::uuid),'archiving retains all historical slot records');
select pg_temp.specs_assert((select to_jsonb(count(*)) from eps.jobs)=pg_temp.specs_get('eps.specs_test.jobs_before'),'no fake or actual processing job was created by manual edits');
select pg_temp.specs_assert((select row_version=19 and draft_revision=17 and has_unpublished_changes from eps.workspaces where id='7c710000-0000-4000-8000-000000000001')
 and (select count(*)=1 from eps.specs where workspace_id='7c710000-0000-4000-8000-000000000001'),'backfill and GET never rewrite existing workspace counters or duplicate its spec');
select pg_temp.specs_assert(not has_function_privilege('anon','public.eps_get_specs(uuid)','EXECUTE')
 and not has_function_privilege('service_role','public.eps_create_role(uuid,jsonb,text)','EXECUTE')
 and not pg_has_role('authenticated','eps_specs_owner','MEMBER'),'anonymous/service/reverse-role privilege boundaries preserved');
-- Harness must ROLLBACK and prove the candidate, fixtures and sentinel are absent.
