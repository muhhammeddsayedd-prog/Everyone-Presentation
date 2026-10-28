-- Exact reviewed candidate/assertions in one owned-local BEGIN ... ROLLBACK.
-- Synthetic SQL fixtures only; no provider, hosted or two-backend proof.
do $$ begin
 if current_user<>'postgres' or current_setting('eps.role_order_candidate_rehearsal',true) is distinct from 'rollback-only-v1'
  or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
 then raise exception 'ROLE_ORDER_LOCAL_ROLLBACK_REQUIRED'; end if;
 if exists(select 1 from auth.users where id::text like '7a930000-%')
   or exists(select 1 from public.projects where id::text like '7b930000-%')
   or exists(select 1 from eps.workspaces where id::text like '7c930000-%')
 then raise exception 'ROLE_ORDER_FIXTURE_COLLISION_PRESERVE_DATA'; end if;
end $$;
create function pg_temp.order_assert(value boolean,label text) returns void language plpgsql as $$ begin
 if value is distinct from true then raise exception 'ROLE_ORDER_ASSERTION: %',label; end if;
end $$;
create function pg_temp.order_expect(query text,expected text) returns void language plpgsql as $$ begin
 begin execute query; exception when others then
  if sqlerrm=expected or sqlstate=expected then return; end if;
  raise exception 'ROLE_ORDER_WRONG_ERROR expected %, got % / %',expected,sqlstate,sqlerrm;
 end;
 raise exception 'ROLE_ORDER_EXPECTED_ERROR_NOT_RAISED: %',expected;
end $$;
create function pg_temp.order_actor(principal uuid) returns void language plpgsql as $$ begin
 perform set_config('request.jwt.claim.sub',principal::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',principal,'role','authenticated','is_anonymous',false)::text,true);
end $$;
create function pg_temp.order_snapshot() returns jsonb language sql stable as $$
 select jsonb_build_object(
  'workspaces',(select jsonb_agg(to_jsonb(value) order by id) from eps.workspaces value where id::text like '7c930000-%'),
  'specs',(select jsonb_agg(to_jsonb(value) order by id) from eps.specs value where workspace_id::text like '7c930000-%'),
  'roles',(select jsonb_agg(to_jsonb(value) order by id) from eps.roles value where workspace_id::text like '7c930000-%'),
  'slots',(select jsonb_agg(to_jsonb(value) order by id) from eps.slots value where workspace_id::text like '7c930000-%'),
  'preferences',(select jsonb_agg(to_jsonb(value) order by principal_id,workspace_id) from eps.user_workspace_preferences value where workspace_id::text like '7c930000-%'),
  'audit',(select jsonb_agg(to_jsonb(value) order by id) from eps.audit_events value where principal_id::text like '7a930000-%'),
  'replay',(select jsonb_agg(to_jsonb(value) order by principal_id,operation,key) from eps.idempotency_records value where principal_id::text like '7a930000-%'),
  'jobs',(select count(*) from eps.jobs),'outbox',(select count(*) from eps.outbox_events),'job_events',(select count(*) from eps.job_events))
$$;
insert into auth.users(id) values('7a930000-0000-4000-8000-000000000001'),('7a930000-0000-4000-8000-000000000002'),('7a930000-0000-4000-8000-000000000003');
insert into public.projects(id,name) values('7b930000-0000-4000-8000-000000000001','Synthetic role order'),('7b930000-0000-4000-8000-000000000002','Synthetic empty role order'),('7b930000-0000-4000-8000-000000000003','Synthetic foreign role order');
insert into eps.workspaces(id,project_id,row_version,draft_revision,has_unpublished_changes) values
 ('7c930000-0000-4000-8000-000000000001','7b930000-0000-4000-8000-000000000001',9,17,false),
 ('7c930000-0000-4000-8000-000000000002','7b930000-0000-4000-8000-000000000002',3,7,false),
 ('7c930000-0000-4000-8000-000000000003','7b930000-0000-4000-8000-000000000003',1,0,false);
insert into public.project_memberships(project_id,principal_id,can_write) values
 ('7b930000-0000-4000-8000-000000000001','7a930000-0000-4000-8000-000000000001',true),
 ('7b930000-0000-4000-8000-000000000002','7a930000-0000-4000-8000-000000000001',true),
 ('7b930000-0000-4000-8000-000000000001','7a930000-0000-4000-8000-000000000002',false),
 ('7b930000-0000-4000-8000-000000000003','7a930000-0000-4000-8000-000000000003',true);
insert into public.app_capability_grants(principal_id,capability)
 select principal,capability from unnest(array['7a930000-0000-4000-8000-000000000001'::uuid,'7a930000-0000-4000-8000-000000000002','7a930000-0000-4000-8000-000000000003']) principal
 cross join unnest(array['projects.read','workspaces.write']) capability;
insert into eps.user_workspace_preferences(principal_id,workspace_id,active_output) values
 ('7a930000-0000-4000-8000-000000000001','7c930000-0000-4000-8000-000000000001','shortlist');
-- Trusted, synthetic original evidence. No extraction/provider success implied.
update eps.specs set source_text='SYNTHETIC ORIGINAL SOURCE',normalized_instructions='Synthetic working instructions',
 source_extraction='{"synthetic_original":true}',source_language_codes=array['en'],
 clarifications='[{"field_path":"headcount","reason":"Synthetic missing fact","source":null,"resolved":false}]'
 where workspace_id='7c930000-0000-4000-8000-000000000001';
insert into eps.roles(id,workspace_id,spec_id,name,headcount,requirements,source_role,sort_order,row_version,archived_at)
 select ('7d930000-0000-4000-8000-'||lpad(number::text,12,'0'))::uuid,spec.workspace_id,spec.id,'Synthetic role '||number,case when number=1 then null else 1 end,
  '{"age_range":null,"gender_requirement":null,"appearance_performance":null,"languages":[],"accents":[],"skills":[],"scene_references":[],"shoot_dates":[],"location":null,"availability_requirements":null,"other_instructions":null}'::jsonb,
  jsonb_build_object('synthetic_original',true,'number',number),number-1,
  case number when 1 then 4 when 2 then 7 when 3 then 2 else 5 end,case when number=4 then now() else null end
 from generate_series(1,4) number cross join eps.specs spec where spec.workspace_id='7c930000-0000-4000-8000-000000000001';
insert into eps.roles(id,workspace_id,name,headcount,requirements,sort_order)
 values('7d930000-0000-4000-8000-000000000005','7c930000-0000-4000-8000-000000000003','Synthetic foreign role',1,'{}',0);
insert into eps.slots(id,workspace_id,role_id,ordinal,label,sort_order,provisional,archived_at)
 select ('7e930000-0000-4000-8000-'||lpad(number::text,12,'0'))::uuid,'7c930000-0000-4000-8000-000000000001',
  ('7d930000-0000-4000-8000-'||lpad(number::text,12,'0'))::uuid,1,'Synthetic stable slot '||number,0,number=1,case when number=4 then now() else null end
 from generate_series(1,4) number;
select set_config('eps.order.original',pg_temp.order_snapshot()::text,true);
select pg_temp.order_actor('7a930000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.order_expect('select eps.specs_order_workspace_dto(''7c930000-0000-4000-8000-000000000001'')','42501');
-- No workspaces.read capability: reorder must not add an uncontracted read gate.
select pg_temp.order_expect('select public.eps_get_workspace(''7c930000-0000-4000-8000-000000000001'')','CAPABILITY_REQUIRED');
select public.eps_reorder_workspace('7c930000-0000-4000-8000-000000000002','{"row_version":3,"role_ids":[]}','empty');
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000002'',''{"row_version":3}'',''empty'')','IDEMPOTENCY_KEY_REUSED');
select public.eps_reorder_workspace('7c930000-0000-4000-8000-000000000001','{"row_version":9}','absent');
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":9,"slot_ids_by_role":{}}'',''maps'')','FEATURE_NOT_IMPLEMENTED');
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":9,"assignment_ids_by_slot":{}}'',''maps'')','FEATURE_NOT_IMPLEMENTED');
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":9,"role_ids":null}'')','INVALID_REQUEST');
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":9,"role_ids":null,"slot_ids_by_role":{}}'')','INVALID_REQUEST');
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":9,"slot_ids_by_role":null}'')','INVALID_REQUEST');
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":9,"assignment_ids_by_slot":{"slot":[1]}}'')','INVALID_REQUEST');
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":null}'')','INVALID_REQUEST');
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":8}'')','STALE_RESOURCE_VERSION');
reset role;
select pg_temp.order_assert((select row_version=9 and draft_revision=17 and not has_unpublished_changes from eps.workspaces where id='7c930000-0000-4000-8000-000000000001')
 and (select count(*)=0 from eps.audit_events where action='specs.reorder_workspace')
 and (select count(*)=2 from eps.idempotency_records where operation='specs.reorder_workspace'),'empty/absent no-op cache without audit/version effect');
select set_config('eps.order.before',pg_temp.order_snapshot()::text,true);
set local role authenticated;
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":9,"role_ids":[]}'')','ROLE_ORDER_INVALID');
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":9,"role_ids":["7d930000-0000-4000-8000-000000000001","7d930000-0000-4000-8000-000000000001","7d930000-0000-4000-8000-000000000003"]}'')','ROLE_ORDER_INVALID');
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":9,"role_ids":["7d930000-0000-4000-8000-000000000001","7d930000-0000-4000-8000-000000000002","7d930000-0000-4000-8000-000000000005"]}'')','ROLE_ORDER_INVALID');
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":9,"role_ids":["7d930000-0000-4000-8000-000000000001","7d930000-0000-4000-8000-000000000002","7d930000-0000-4000-8000-000000000004"]}'')','ROLE_ORDER_INVALID');
reset role;
select pg_temp.order_assert(pg_temp.order_snapshot()=current_setting('eps.order.before')::jsonb,'invalid permutations have no partial effects');
select set_config('request.headers','{"x-eps-request-id":"synthetic-role-order","x-eps-client-type":"mcp","authorization":"synthetic-private-must-not-persist"}',true);
set local role authenticated;
select set_config('eps.order.response',public.eps_reorder_workspace('7c930000-0000-4000-8000-000000000001',
 '{"row_version":9,"role_ids":["7d930000-0000-4000-8000-000000000002","7d930000-0000-4000-8000-000000000001","7d930000-0000-4000-8000-000000000003"]}','swap')::text,true);
select pg_temp.order_assert(current_setting('eps.order.response')::jsonb->>'active_output'='shortlist'
 and current_setting('eps.order.response')::jsonb->>'row_version'='10','exact acting-user Workspace projection');
reset role;
select pg_temp.order_assert((select row_version=10 and draft_revision=18 and has_unpublished_changes from eps.workspaces where id='7c930000-0000-4000-8000-000000000001')
 and (select sort_order=1 and row_version=5 from eps.roles where id='7d930000-0000-4000-8000-000000000001')
 and (select sort_order=0 and row_version=8 from eps.roles where id='7d930000-0000-4000-8000-000000000002')
 and (select sort_order=2 and row_version=2 from eps.roles where id='7d930000-0000-4000-8000-000000000003')
 and (select sort_order=3 and row_version=5 from eps.roles where id='7d930000-0000-4000-8000-000000000004')
 and (select count(*)=1 and bool_and(resource_id='7c930000-0000-4000-8000-000000000001' and request_id='synthetic-role-order' and client_type='mcp') from eps.audit_events where action='specs.reorder_workspace'),
 'only changed active roles version; one coupled workspace/draft/audit effect');
select pg_temp.order_assert(pg_temp.order_snapshot()->'specs'=current_setting('eps.order.original')::jsonb->'specs'
 and pg_temp.order_snapshot()->'slots'=current_setting('eps.order.original')::jsonb->'slots'
 and pg_temp.order_snapshot()->'preferences'=current_setting('eps.order.original')::jsonb->'preferences',
 'all source evidence, stable slot identities/history and per-user preferences remain exact');
select pg_temp.order_assert((select jsonb_agg(to_jsonb(role)-array['sort_order','row_version','updated_at'] order by id) from eps.roles role where workspace_id::text like '7c930000-%')=
 (select jsonb_agg(value-array['sort_order','row_version','updated_at'] order by value->>'id') from jsonb_array_elements(current_setting('eps.order.original')::jsonb->'roles') value),
 'all role source/working facts and identities preserved');
set local role authenticated;
select public.eps_reorder_workspace('7c930000-0000-4000-8000-000000000001',
 '{"row_version":10,"role_ids":["7d930000-0000-4000-8000-000000000002","7d930000-0000-4000-8000-000000000001","7d930000-0000-4000-8000-000000000003"]}','canonical-noop');
reset role;
select pg_temp.order_assert((select row_version=10 and draft_revision=18 from eps.workspaces where id='7c930000-0000-4000-8000-000000000001')
 and (select count(*)=1 from eps.audit_events where action='specs.reorder_workspace'),'same canonical order adds no audit or revision');
select set_config('eps.order.before',pg_temp.order_snapshot()::text,true);
set local role authenticated;
select pg_temp.order_assert(public.eps_reorder_workspace('7c930000-0000-4000-8000-000000000001',
 '{"row_version":9,"role_ids":["7d930000-0000-4000-8000-000000000002","7d930000-0000-4000-8000-000000000001","7d930000-0000-4000-8000-000000000003"]}','swap')=current_setting('eps.order.response')::jsonb,'legitimate cached replay precedes stale version');
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":10}'',''swap'')','IDEMPOTENCY_KEY_REUSED');
reset role;
select pg_temp.order_assert(pg_temp.order_snapshot()=current_setting('eps.order.before')::jsonb,'replay and key conflicts have no additional effect');

-- Before-row fault injection must roll back roles, workspace, audit and replay.
create function pg_temp.order_suppress() returns trigger language plpgsql as $$ begin return null; end $$;
create trigger order_suppress_role before update on eps.roles for each row execute function pg_temp.order_suppress();
set local role authenticated;
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":10,"role_ids":["7d930000-0000-4000-8000-000000000001","7d930000-0000-4000-8000-000000000002","7d930000-0000-4000-8000-000000000003"]}'',''suppressed-role'')','SPECS_STATE_INVALID');
reset role;
drop trigger order_suppress_role on eps.roles;
select pg_temp.order_assert(pg_temp.order_snapshot()=current_setting('eps.order.before')::jsonb,'suppressed role write has no partial effect');
create trigger order_suppress_workspace before update on eps.workspaces for each row execute function pg_temp.order_suppress();
set local role authenticated;
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":10,"role_ids":["7d930000-0000-4000-8000-000000000001","7d930000-0000-4000-8000-000000000002","7d930000-0000-4000-8000-000000000003"]}'',''suppressed-workspace'')','RESOURCE_NOT_FOUND');
reset role;
drop trigger order_suppress_workspace on eps.workspaces;
select pg_temp.order_assert(pg_temp.order_snapshot()=current_setting('eps.order.before')::jsonb,'suppressed workspace write rolls role writes back');
create trigger order_suppress_audit before insert on eps.audit_events for each row execute function pg_temp.order_suppress();
set local role authenticated;
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":10,"role_ids":["7d930000-0000-4000-8000-000000000001","7d930000-0000-4000-8000-000000000002","7d930000-0000-4000-8000-000000000003"]}'',''suppressed-audit'')','SPECS_STATE_INVALID');
reset role;
drop trigger order_suppress_audit on eps.audit_events;
select pg_temp.order_assert(pg_temp.order_snapshot()=current_setting('eps.order.before')::jsonb,'suppressed audit rolls entire mutation/cache back');
create trigger order_suppress_replay before insert on eps.idempotency_records for each row execute function pg_temp.order_suppress();
set local role authenticated;
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":10,"role_ids":["7d930000-0000-4000-8000-000000000001","7d930000-0000-4000-8000-000000000002","7d930000-0000-4000-8000-000000000003"]}'',''suppressed-cache'')','SPECS_STATE_INVALID');
reset role;
drop trigger order_suppress_replay on eps.idempotency_records;
select pg_temp.order_assert(pg_temp.order_snapshot()=current_setting('eps.order.before')::jsonb,'suppressed cache rolls entire mutation back');

-- Current membership/capability gates also protect stored responses.
update public.project_memberships set active=false where project_id='7b930000-0000-4000-8000-000000000001' and principal_id='7a930000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":9}'',''absent'')','RESOURCE_NOT_FOUND');
reset role;
update public.project_memberships set active=true where project_id='7b930000-0000-4000-8000-000000000001' and principal_id='7a930000-0000-4000-8000-000000000001';
update public.app_capability_grants set active=false where principal_id='7a930000-0000-4000-8000-000000000001' and capability='workspaces.write';
set local role authenticated;
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":9}'',''absent'')','CAPABILITY_REQUIRED');
reset role;
update public.app_capability_grants set active=true where principal_id='7a930000-0000-4000-8000-000000000001' and capability='workspaces.write';
select pg_temp.order_actor('7a930000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":10}'')','RESOURCE_NOT_FOUND');
reset role;
select pg_temp.order_actor('7a930000-0000-4000-8000-000000000003');
set local role authenticated;
select pg_temp.order_expect('select public.eps_reorder_workspace(''7c930000-0000-4000-8000-000000000001'',''{"row_version":10}'')','RESOURCE_NOT_FOUND');
reset role;
select pg_temp.order_assert(pg_temp.order_snapshot()=current_setting('eps.order.before')::jsonb,'restored synthetic membership and all access denials leave prior data intact');
-- Sparse but already equal logical order is preserved, not normalized on a no-op.
update eps.roles set sort_order=sort_order*10 where workspace_id='7c930000-0000-4000-8000-000000000001' and archived_at is null;
select set_config('eps.order.sparse',pg_temp.order_snapshot()::text,true);
select pg_temp.order_actor('7a930000-0000-4000-8000-000000000001');
set local role authenticated;
select public.eps_reorder_workspace('7c930000-0000-4000-8000-000000000001',
 '{"row_version":10,"role_ids":["7d930000-0000-4000-8000-000000000002","7d930000-0000-4000-8000-000000000001","7d930000-0000-4000-8000-000000000003"]}');
reset role;
select pg_temp.order_assert(pg_temp.order_snapshot()=current_setting('eps.order.sparse')::jsonb,'same sparse logical order has zero writes');
-- Later changes may invalidate an old permutation, but never its legitimate key.
insert into eps.roles(id,workspace_id,name,headcount,requirements,sort_order)
 values('7d930000-0000-4000-8000-000000000006','7c930000-0000-4000-8000-000000000001','Synthetic later role',1,'{}',30);
update eps.workspaces set row_version=row_version+1,draft_revision=draft_revision+1 where id='7c930000-0000-4000-8000-000000000001';
select set_config('eps.order.later',pg_temp.order_snapshot()::text,true);
set local role authenticated;
select pg_temp.order_assert(public.eps_reorder_workspace('7c930000-0000-4000-8000-000000000001',
 '{"row_version":9,"role_ids":["7d930000-0000-4000-8000-000000000002","7d930000-0000-4000-8000-000000000001","7d930000-0000-4000-8000-000000000003"]}','swap')=current_setting('eps.order.response')::jsonb,'valid replay survives later active-role/version changes');
reset role;
select pg_temp.order_assert(pg_temp.order_snapshot()=current_setting('eps.order.later')::jsonb,'cached replay never reapplies the obsolete permutation');
select pg_temp.order_assert(not has_function_privilege('anon','public.eps_reorder_workspace(uuid,jsonb,text)','EXECUTE')
 and not has_function_privilege('service_role','public.eps_reorder_workspace(uuid,jsonb,text)','EXECUTE')
 and not has_table_privilege('eps_specs_owner','eps.user_workspace_preferences','SELECT')
 and not has_column_privilege('eps_specs_owner','eps.workspaces','logo_asset_id','SELECT')
 and not has_column_privilege('eps_specs_owner','eps.roles','source_role','UPDATE')
 and has_column_privilege('eps_specs_owner','eps.roles','sort_order','UPDATE'), 'narrow RPC/DTO/column authority only');
select jsonb_build_object('role_order_candidate_assertions',true,'rollback_required',true,'concurrent_sessions_tested',false,'cloud_called',false,'provider_called',false);
