-- Synthetic metadata only. Parent owns BEGIN/savepoint/ROLLBACK and Auth RLS.
set local role postgres;
do $$begin if exists(select 1 from auth.users where id::text like'8a1a0000-%')or exists(select 1 from public.projects where id::text like'8a0a0000-%')then raise exception'M04_FIXTURE_NAMESPACE_OCCUPIED';end if;end$$;
insert into auth.users(id,is_anonymous,deleted_at,banned_until)values('8a1a0000-0000-4000-8000-000000000001',false,null,null),('8a1a0000-0000-4000-8000-000000000002',false,null,null);
insert into public.app_capability_grants(principal_id,capability)select actor,value from unnest(array['8a1a0000-0000-4000-8000-000000000001'::uuid,'8a1a0000-0000-4000-8000-000000000002'::uuid])actor cross join unnest(array['projects.read','workspaces.read','workspaces.write'])value;
insert into public.projects(id,name)values('8a0a0000-0000-4000-8000-000000000001','Synthetic casting workspace'),('8a0a0000-0000-4000-8000-000000000002','Synthetic foreign casting workspace');
insert into public.project_memberships(project_id,principal_id,can_write)values
 ('8a0a0000-0000-4000-8000-000000000001','8a1a0000-0000-4000-8000-000000000001',true),
 ('8a0a0000-0000-4000-8000-000000000001','8a1a0000-0000-4000-8000-000000000002',true),
 ('8a0a0000-0000-4000-8000-000000000002','8a1a0000-0000-4000-8000-000000000002',true);
insert into eps.workspaces(id,project_id)values('8a2a0000-0000-4000-8000-000000000001','8a0a0000-0000-4000-8000-000000000001'),('8a2a0000-0000-4000-8000-000000000002','8a0a0000-0000-4000-8000-000000000002');
insert into eps.roles(id,workspace_id,name,headcount,sort_order,requirements)values
 ('8a3a0000-0000-4000-8000-000000000001','8a2a0000-0000-4000-8000-000000000001','Synthetic first role',1,0,'{"age_range":null,"gender_requirement":null,"appearance_performance":null,"languages":[],"accents":[],"skills":[],"scene_references":[],"shoot_dates":[],"location":null,"availability_requirements":null,"other_instructions":null}'),
 ('8a3a0000-0000-4000-8000-000000000002','8a2a0000-0000-4000-8000-000000000001','Synthetic second role',1,1,'{"age_range":null,"gender_requirement":null,"appearance_performance":null,"languages":[],"accents":[],"skills":[],"scene_references":[],"shoot_dates":[],"location":null,"availability_requirements":null,"other_instructions":null}'),
 ('8a3a0000-0000-4000-8000-000000000003','8a2a0000-0000-4000-8000-000000000002','Synthetic foreign role',1,0,'{"age_range":null,"gender_requirement":null,"appearance_performance":null,"languages":[],"accents":[],"skills":[],"scene_references":[],"shoot_dates":[],"location":null,"availability_requirements":null,"other_instructions":null}');
insert into eps.slots(id,workspace_id,role_id,ordinal,label,sort_order)values
 ('8a4a0000-0000-4000-8000-000000000001','8a2a0000-0000-4000-8000-000000000001','8a3a0000-0000-4000-8000-000000000001',1,'Synthetic first slot',0),
 ('8a4a0000-0000-4000-8000-000000000002','8a2a0000-0000-4000-8000-000000000001','8a3a0000-0000-4000-8000-000000000002',1,'Synthetic second slot',0),
 ('8a4a0000-0000-4000-8000-000000000003','8a2a0000-0000-4000-8000-000000000002','8a3a0000-0000-4000-8000-000000000003',1,'Synthetic foreign slot',0);
insert into eps.candidates(id,facts,casting_id,source_kind,created_by)select id,jsonb_build_object('name','Synthetic casting profile','casting_id',casting_id,'age_or_range',null,'stated_gender',null,'height_measurements',null,'languages','[]'::jsonb,'accents','[]'::jsonb,'skills_experience',null,'city',null,'previous_projects_roles',null,'classification',null),casting_id,'manual','8a1a0000-0000-4000-8000-000000000001'::uuid from(values('8a5a0000-0000-4000-8000-000000000001'::uuid,'M04-SYNTHETIC-1'),('8a5a0000-0000-4000-8000-000000000002'::uuid,'M04-SYNTHETIC-2'))v(id,casting_id);
insert into eps.workspace_candidates(id,workspace_id,candidate_id)values
 ('8a6a0000-0000-4000-8000-000000000001','8a2a0000-0000-4000-8000-000000000001','8a5a0000-0000-4000-8000-000000000001'),
 ('8a6a0000-0000-4000-8000-000000000002','8a2a0000-0000-4000-8000-000000000001','8a5a0000-0000-4000-8000-000000000002'),
 ('8a6a0000-0000-4000-8000-000000000003','8a2a0000-0000-4000-8000-000000000002','8a5a0000-0000-4000-8000-000000000001');
select set_config('eps.casting.fixture.actor','8a1a0000-0000-4000-8000-000000000001',true),set_config('eps.casting.fixture.actor2','8a1a0000-0000-4000-8000-000000000002',true),set_config('eps.casting.fixture.workspace','8a2a0000-0000-4000-8000-000000000001',true),set_config('eps.casting.fixture.workspace2','8a2a0000-0000-4000-8000-000000000002',true),set_config('eps.casting.fixture.slot','8a4a0000-0000-4000-8000-000000000001',true),set_config('eps.casting.fixture.slot2','8a4a0000-0000-4000-8000-000000000002',true),set_config('eps.casting.fixture.pool','8a6a0000-0000-4000-8000-000000000001',true),set_config('eps.casting.fixture.pool2','8a6a0000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
