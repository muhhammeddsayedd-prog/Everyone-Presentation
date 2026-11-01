-- Synthetic local-only assertions. Parent owns the exact disposable target and ROLLBACK.
create temporary table proof_checks(label text primary key);
grant insert on proof_checks to authenticated;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$begin
 if value is distinct from true then raise exception 'PROJECT39_ASSERTION_FAILED: %',label;end if;
 insert into proof_checks values(label);
end$$;
create function pg_temp.denied(query text,expected text,label text) returns void language plpgsql as $$begin
 begin execute query;exception when others then
  if sqlstate=expected or sqlerrm=expected then perform pg_temp.ok(true,label);return;end if;
  raise exception 'PROJECT39_WRONG_ERROR: % % %',label,sqlstate,sqlerrm;
 end;raise exception 'PROJECT39_EXPECTED_DENIAL: %',label;
end$$;
create function pg_temp.actor(subject uuid) returns void language plpgsql as $$begin
 perform set_config('request.jwt.claim.sub',subject::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated','is_anonymous',false)::text,true);
end$$;

select pg_temp.ok((select rolcanlogin=false and rolsuper=false and rolbypassrls=false and rolcreaterole=false from pg_roles where rolname='eps_project_creator'),'narrow creator role');
select pg_temp.ok((select p.prosecdef and p.proowner::regrole::text='eps_project_creator' and p.proconfig=array['search_path=""'] from pg_proc p where p.oid='public.eps_create_project(jsonb,text)'::regprocedure),'fixed definer and search path');
select pg_temp.ok(not has_function_privilege('anon','public.eps_create_project(jsonb,text)','execute') and not has_function_privilege('service_role','public.eps_create_project(jsonb,text)','execute'),'no guest or service execution');
select pg_temp.ok(not has_table_privilege('authenticated','public.projects','insert') and not has_table_privilege('authenticated','public.project_memberships','insert'),'no direct table writes');
select pg_temp.ok(not pg_has_role('authenticated','eps_project_creator','MEMBER'),'no reverse creator membership');
select pg_temp.ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='eps.project_creation_intents'::regclass),'intent forced RLS');
select pg_temp.ok((select count(*)=38 from supabase_migrations.schema_migrations),'retained history38');

insert into auth.users(id,is_anonymous)values('a4390000-0000-4000-8000-000000000001',false),('a4390000-0000-4000-8000-000000000002',false),('a4390000-0000-4000-8000-000000000003',false);
insert into public.app_capability_grants(principal_id,capability)
 select actor,cap from unnest(array['a4390000-0000-4000-8000-000000000001'::uuid,'a4390000-0000-4000-8000-000000000002'::uuid])actor
 cross join unnest(array['projects.read','projects.write','workspaces.read','workspaces.write'])cap;
insert into public.app_capability_grants(principal_id,capability)values('a4390000-0000-4000-8000-000000000003','projects.read');
insert into public.clients(id,name)values('a4390000-0000-4000-8000-000000000011','Synthetic permitted client'),('a4390000-0000-4000-8000-000000000012','Synthetic foreign client');
insert into public.client_memberships(client_id,principal_id,can_write)values('a4390000-0000-4000-8000-000000000011','a4390000-0000-4000-8000-000000000001',true),('a4390000-0000-4000-8000-000000000012','a4390000-0000-4000-8000-000000000002',true);
select pg_temp.actor('a4390000-0000-4000-8000-000000000001');set local role authenticated;
select pg_temp.ok(jsonb_array_length(public.eps_list_project_clients()->'data')=1,'authorized client listing');
select pg_temp.denied($q$select public.eps_create_project('{"name":"Invalid","presentation_type":"unknown"}','project39-invalid-type')$q$,'INVALID_REQUEST','unknown type denied');
select pg_temp.denied($q$select public.eps_create_project('{"name":"Invalid","presentation_type":"casting","principal_id":"a4390000-0000-4000-8000-000000000002"}','project39-forged-actor')$q$,'INVALID_REQUEST','forged actor denied');
select pg_temp.denied($q$select public.eps_create_project('{"name":"Valid","presentation_type":"casting"}','short')$q$,'INVALID_REQUEST','short idempotency denied');
select pg_temp.denied($q$select public.eps_create_project('{"name":"Foreign","presentation_type":"casting","client_id":"a4390000-0000-4000-8000-000000000012"}','project39-foreign-client')$q$,'RESOURCE_NOT_FOUND','foreign client denied');
do $$declare result jsonb;begin
 result:=public.eps_create_project('{"name":"Synthetic SQL39","presentation_type":"casting"}','project39-create-main');
 perform set_config('eps.project39.created',result->>'id',true);perform set_config('eps.project39.receipt',result::text,true);
 perform pg_temp.ok(result->>'presentation_type'='casting' and result->'casting_workspace_id'='null'::jsonb and result->'client_id'='null'::jsonb and result->>'can_edit'='true','central project created without workspace');
 perform pg_temp.ok(public.eps_create_project('{"name":"Synthetic SQL39","presentation_type":"casting"}','project39-create-main')=result,'identical replay stable');
 perform pg_temp.ok(public.eps_get_project((result->>'id')::uuid)=result,'fresh read matches creation');
end$$;
select pg_temp.denied($q$select public.eps_create_project('{"name":"Different","presentation_type":"casting"}','project39-create-main')$q$,'IDEMPOTENCY_KEY_REUSED','changed intent denied');
select pg_temp.denied($q$insert into public.projects(id,name)values(gen_random_uuid(),'Direct denial')$q$,'42501','direct project insert denied');
select pg_temp.denied($q$select * from eps.project_creation_intents$q$,'42501','private intent table denied');
-- SET ROLE is authorized against session_user, so use a genuinely constrained
-- session identity for this assertion rather than the original admin session.
reset role;set session authorization authenticated;
select pg_temp.denied($q$set local role eps_project_creator$q$,'42501','creator role escalation denied');
reset session authorization;set local role authenticated;
do $$declare result jsonb;begin
 result:=public.eps_update_project(current_setting('eps.project39.created')::uuid,'{"row_version":1,"name":"Synthetic renamed SQL39"}','project39-rename-main');
 perform pg_temp.ok(result->>'name'='Synthetic renamed SQL39','normal project rename');
 perform pg_temp.ok(public.eps_create_project('{"name":"Synthetic SQL39","presentation_type":"casting"}','project39-create-main')=current_setting('eps.project39.receipt')::jsonb,'rename then replay stable receipt');
 perform pg_temp.ok(public.eps_get_project(current_setting('eps.project39.created')::uuid)->>'name'='Synthetic renamed SQL39','replay preserves current name');
 result:=public.eps_create_workspace(jsonb_build_object('project_id',current_setting('eps.project39.created'),'initial_output','selection'),'project39-workspace-start');
 perform pg_temp.ok(result->>'project_id'=current_setting('eps.project39.created'),'separate Casting workspace starts');
end$$;
select pg_temp.actor('a4390000-0000-4000-8000-000000000002');
select pg_temp.denied($q$select public.eps_get_project(current_setting('eps.project39.created')::uuid)$q$,'RESOURCE_NOT_FOUND','foreign actor read denied');
select pg_temp.actor('a4390000-0000-4000-8000-000000000003');
select pg_temp.denied($q$select public.eps_create_project('{"name":"Contributor","presentation_type":"casting"}','project39-contributor-denial')$q$,'CAPABILITY_REQUIRED','read-only contributor create denied');
select pg_temp.actor('a4390000-0000-4000-8000-000000000001');reset role;
update public.project_memberships set active=false where project_id=current_setting('eps.project39.created')::uuid and principal_id='a4390000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.denied($q$select public.eps_create_project('{"name":"Synthetic SQL39","presentation_type":"casting"}','project39-create-main')$q$,'RESOURCE_NOT_FOUND','revoked project replay denied');
reset role;update public.project_memberships set active=true where project_id=current_setting('eps.project39.created')::uuid and principal_id='a4390000-0000-4000-8000-000000000001';
update public.app_capability_grants set active=false where principal_id='a4390000-0000-4000-8000-000000000001' and capability='projects.write';
set local role authenticated;
select pg_temp.denied($q$select public.eps_create_project('{"name":"Synthetic SQL39","presentation_type":"casting"}','project39-create-main')$q$,'CAPABILITY_REQUIRED','revoked capability replay denied');
reset role;update public.app_capability_grants set active=true where principal_id='a4390000-0000-4000-8000-000000000001' and capability='projects.write';
set local role authenticated;
do $$declare result jsonb;begin
 result:=public.eps_create_project('{"name":"Synthetic planned type","presentation_type":"wardrobe","client_id":"a4390000-0000-4000-8000-000000000011"}','project39-planned-client');
 perform set_config('eps.project39.client_project',result->>'id',true);
 perform pg_temp.ok(result->>'presentation_type'='wardrobe' and result->>'client_id'='a4390000-0000-4000-8000-000000000011' and result->'casting_workspace_id'='null'::jsonb,'planned type and permitted client persist');
end$$;
reset role;update public.client_memberships set active=false where client_id='a4390000-0000-4000-8000-000000000011' and principal_id='a4390000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.denied($q$select public.eps_create_project('{"name":"Synthetic planned type","presentation_type":"wardrobe","client_id":"a4390000-0000-4000-8000-000000000011"}','project39-planned-client')$q$,'RESOURCE_NOT_FOUND','revoked client replay denied');
reset role;
select pg_temp.ok((select count(*)=1 from eps.idempotency_records where principal_id='a4390000-0000-4000-8000-000000000001' and operation='create_project' and key='project39-create-main'),'one creation idempotency record');
select pg_temp.ok((select count(*)=1 from eps.audit_events where principal_id='a4390000-0000-4000-8000-000000000001' and action='create_project' and resource_id=current_setting('eps.project39.created')::uuid),'one creation audit');
update public.projects set archived_at=now() where id=current_setting('eps.project39.created')::uuid;
set local role authenticated;
select pg_temp.denied($q$select public.eps_create_project('{"name":"Synthetic SQL39","presentation_type":"casting"}','project39-create-main')$q$,'RESOURCE_NOT_FOUND','archived project replay denied');
reset role;
select jsonb_build_object('assertions',(select count(*)from proof_checks),'labels',(select jsonb_agg(label order by label)from proof_checks));
