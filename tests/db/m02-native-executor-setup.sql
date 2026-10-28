-- COMMITTED SYNTHETIC LOCAL FIXTURE, never a migration or cloud seed.
-- Direct fixture data does not claim a user/API submission or provider call.
begin;
set local search_path='';
do $guard$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
  or coalesce(current_setting('eps.native_specs.fixture_run_id',true),'')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  or (select system_identifier::text from pg_control_system())<>'7701520506262638626'
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030']::text[]
  or to_regclass('eps_local_guard.native_specs_fixture') is not null
  or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps_local_guard' and p.proname like 'native_specs_fixture%')
  or exists(select 1 from auth.users where id::text like '7a980000-%')
  or exists(select 1 from public.projects where id::text like '7b980000-%')
  or exists(select 1 from eps.workspaces where id::text like '7c980000-%')
  or exists(select 1 from eps.jobs where id::text like '7f980000-%')
  or (select count(*) from eps.specs_pipeline_config)<>1 or exists(select 1 from eps.specs_pipeline_config where enabled)
 then raise exception 'NATIVE_FIXTURE_OWNED_LOCAL10_EMPTY_NAMESPACE_REQUIRED'; end if;
end $guard$;
create table eps_local_guard.native_specs_fixture (
 run_id uuid primary key, original_text text not null, corrected_text text not null,
 config_sha256 text not null, cases jsonb not null, replacement_job_id uuid, identity_sha256 text, verified_sha256 text,
 created_at timestamptz not null default clock_timestamp()
);
revoke all on eps_local_guard.native_specs_fixture from public,anon,authenticated,service_role,eps_jobs_executor,eps_native_specs_local_probe;
insert into eps_local_guard.native_specs_fixture(run_id,original_text,corrected_text,config_sha256,cases)
select current_setting('eps.native_specs.fixture_run_id')::uuid,
 chr(65279)||E'Synthetic actor 😀\r\n  continued\r\n\r\nالعمر غير محدد.\r\n',
 E'Synthetic corrected original\r\n\r\nExisting manual facts must remain.',
 (select encode(sha256(convert_to(jsonb_agg(to_jsonb(c) order by id)::text,'UTF8')),'hex') from eps.specs_pipeline_config c),'[]';

create function eps_local_guard.native_specs_fixture_require() returns void language plpgsql security invoker set search_path='' as $$
declare marker eps_local_guard.native_specs_fixture; begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
  or (select system_identifier::text from pg_control_system())<>'7701520506262638626'
 then raise exception 'NATIVE_FIXTURE_TARGET_CHANGED'; end if;
 select * into marker from eps_local_guard.native_specs_fixture;
 if not found or (select count(*) from eps_local_guard.native_specs_fixture)<>1
  or marker.run_id::text is distinct from current_setting('eps.native_specs.fixture_run_id',true)
  or marker.original_text is distinct from chr(65279)||E'Synthetic actor 😀\r\n  continued\r\n\r\nالعمر غير محدد.\r\n'
  or marker.corrected_text is distinct from E'Synthetic corrected original\r\n\r\nExisting manual facts must remain.'
  or marker.config_sha256 is distinct from (select encode(sha256(convert_to(jsonb_agg(to_jsonb(c) order by id)::text,'UTF8')),'hex') from eps.specs_pipeline_config c)
  or exists(select 1 from eps.specs_pipeline_config where enabled)
 then raise exception 'NATIVE_FIXTURE_MARKER_OR_CONFIG_CHANGED'; end if;
end $$;
create function eps_local_guard.native_specs_fixture_digest() returns text language sql stable security invoker set search_path='' as $$
 select encode(sha256(convert_to(jsonb_build_object(
  'auth',(select jsonb_agg(to_jsonb(v) order by id) from auth.users v where id::text like '7a980000-%'),
  'projects',(select jsonb_agg(to_jsonb(v) order by id) from public.projects v where id::text like '7b980000-%'),
  'memberships',(select jsonb_agg(to_jsonb(v) order by project_id,principal_id) from public.project_memberships v
   where principal_id::text like '7a980000-%' or project_id::text like '7b980000-%'),
  'grants',(select jsonb_agg(to_jsonb(v) order by principal_id,capability) from public.app_capability_grants v where principal_id::text like '7a980000-%'),
  'workspaces',(select jsonb_agg(to_jsonb(v) order by id) from eps.workspaces v
   where id::text like '7c980000-%' or project_id::text like '7b980000-%'),
  'specs',(select jsonb_agg(to_jsonb(v) order by id) from eps.specs v where workspace_id::text like '7c980000-%'),
  'roles',(select jsonb_agg(to_jsonb(v) order by id) from eps.roles v where workspace_id::text like '7c980000-%'),
  'slots',(select jsonb_agg(to_jsonb(v) order by id) from eps.slots v where workspace_id::text like '7c980000-%'),
  'jobs',(select jsonb_agg(to_jsonb(v) order by id) from eps.jobs v where workspace_id::text like '7c980000-%'),
  'inputs',(select jsonb_agg(to_jsonb(v) order by job_id) from eps.specs_source_inputs v where workspace_id::text like '7c980000-%'),
  'payloads',(select jsonb_agg(to_jsonb(v) order by id) from eps.specs_stage_payloads v where job_id in(select id from eps.jobs where workspace_id::text like '7c980000-%')),
  'events',(select jsonb_agg(to_jsonb(v) order by job_id,attempt_id,event_id) from eps.job_events v where job_id in(select id from eps.jobs where workspace_id::text like '7c980000-%')),
  'outbox',(select jsonb_agg(to_jsonb(v) order by id) from eps.outbox_events v where job_id in(select id from eps.jobs where workspace_id::text like '7c980000-%')),
  'audit',(select jsonb_agg(to_jsonb(v) order by id) from eps.audit_events v where principal_id::text like '7a980000-%'),
  'idem',(select jsonb_agg(to_jsonb(v) order by principal_id,operation,key) from eps.idempotency_records v where principal_id::text like '7a980000-%')
 )::text,'UTF8')),'hex')
$$;
create function eps_local_guard.native_specs_fixture_identity_digest() returns text language sql stable security invoker set search_path='' as $$
 select encode(sha256(convert_to(jsonb_build_object(
  'auth',(select jsonb_agg(to_jsonb(v) order by id) from auth.users v where id::text like '7a980000-%'),
  'projects',(select jsonb_agg(to_jsonb(v) order by id) from public.projects v where id::text like '7b980000-%'),
  'memberships',(select jsonb_agg(to_jsonb(v) order by project_id,principal_id) from public.project_memberships v
   where principal_id::text like '7a980000-%' or project_id::text like '7b980000-%'),
  'workspace_identities',(select jsonb_agg(jsonb_build_array(id,project_id) order by id) from eps.workspaces v
   where id::text like '7c980000-%' or project_id::text like '7b980000-%'),
  'clients',(select jsonb_agg(to_jsonb(v) order by client_id,principal_id) from public.client_memberships v where principal_id::text like '7a980000-%'),
  'grants',(select jsonb_agg(to_jsonb(v) order by principal_id,capability) from public.app_capability_grants v where principal_id::text like '7a980000-%'),
  'preferences',(select jsonb_agg(to_jsonb(v) order by principal_id,workspace_id) from eps.user_workspace_preferences v
   where principal_id::text like '7a980000-%' or workspace_id::text like '7c980000-%')
 )::text,'UTF8')),'hex')
$$;
create function eps_local_guard.native_specs_fixture_validate(p_final boolean default false) returns void language plpgsql security invoker set search_path='' as $$
declare marker eps_local_guard.native_specs_fixture; workspace eps.workspaces; spec eps.specs; job eps.jobs; retained eps.specs_source_inputs;
 item integer; expected_job uuid; expected_source text; applied boolean; extra_jobs integer; data_role eps.roles; payload eps.specs_stage_payloads; preparation eps.specs_stage_payloads;
begin
 perform eps_local_guard.native_specs_fixture_require();
 select * into strict marker from eps_local_guard.native_specs_fixture;
 if marker.identity_sha256 is distinct from eps_local_guard.native_specs_fixture_identity_digest()
  or (select count(*) from eps.workspaces where id::text like '7c980000-%')<>4
  or (select count(*) from eps.specs where workspace_id::text like '7c980000-%')<>4
 then raise exception 'NATIVE_FIXTURE_IDENTITY_OR_SCOPE_CHANGED'; end if;
 extra_jobs:=case when marker.replacement_job_id is null then 0 else 1 end;
 if (select count(*) from eps.jobs where workspace_id::text like '7c980000-%')<>4+extra_jobs
  or exists(select 1 from eps.jobs where workspace_id::text like '7c980000-%' and id not in
   ('7f980000-0000-4000-8000-000000000001','7f980000-0000-4000-8000-000000000002','7f980000-0000-4000-8000-000000000003','7f980000-0000-4000-8000-000000000004',coalesce(marker.replacement_job_id,'00000000-0000-0000-0000-000000000000')))
  or (select count(*) from eps.specs_source_inputs where workspace_id::text like '7c980000-%')<>4+extra_jobs
  or exists(select 1 from eps.media_assets where origin_workspace_id::text like '7c980000-%')
 then raise exception 'NATIVE_FIXTURE_UNKNOWN_JOB_OR_MEDIA'; end if;
 for item in 1..4 loop
  select * into strict workspace from eps.workspaces where id=('7c980000-0000-4000-8000-'||lpad(item::text,12,'0'))::uuid for update;
  select * into strict spec from eps.specs where workspace_id=workspace.id for update;
  if workspace.project_id<>('7b980000-0000-4000-8000-'||lpad(item::text,12,'0'))::uuid or workspace.archived_at is not null
   or workspace.module<>'casting' or workspace.logo_asset_id is not null or workspace.logo_placement<>'cover' or not workspace.has_unpublished_changes
   or spec.source_asset_id is not null or spec.clarifications<>'[]'
  then raise exception 'NATIVE_FIXTURE_RESOURCE_FIELDS_CHANGED'; end if;
  expected_job:=('7f980000-0000-4000-8000-'||lpad(item::text,12,'0'))::uuid;
  select * into strict job from eps.jobs where id=expected_job for update;
  select * into strict retained from eps.specs_source_inputs where job_id=job.id;
  if job.workspace_id<>workspace.id or job.resource_id<>spec.id or job.requested_by<>'7a980000-0000-4000-8000-000000000001'
   or job.kind<>'specs_extract' or job.input_asset_id is not null or job.input_hash<>eps.jobs_hash_v1(job.input)
   or retained.workspace_id<>workspace.id or retained.spec_id<>spec.id or retained.input_hash<>job.input_hash
   or retained.source_text<>marker.original_text or retained.source_row_version<>2
   or retained.source_hash<>encode(sha256(convert_to(marker.original_text,'UTF8')),'hex')
  then raise exception 'NATIVE_FIXTURE_ORIGINAL_INPUT_CHANGED'; end if;
  applied:=spec.source_extraction is not null;
  if item in(1,4) then
   if spec.source_text is distinct from marker.original_text or spec.source_row_version<>2 or spec.processing_job_id is distinct from job.id
    or spec.row_version<>(case when applied then 3 else 2 end)
    or workspace.row_version<>(case when applied then 3 else 2 end) or workspace.draft_revision<>(case when applied then 2 else 1 end)
    or spec.normalized_instructions is distinct from(case when applied then 'Synthetic normalized instructions' else null end)
    or spec.source_extraction_job_id is distinct from(case when applied then job.id else null end)
    or spec.source_language_codes is distinct from(case when applied then array['en','ar'] else array[]::text[] end)
   then raise exception 'NATIVE_FIXTURE_WORKING_FACTS_CHANGED'; end if;
  elsif item=2 then
   if applied or spec.source_text is distinct from marker.original_text or spec.source_row_version<>2 or spec.processing_job_id is distinct from job.id
    or spec.row_version<>2 or workspace.row_version<>2 or workspace.draft_revision<>1
    or spec.normalized_instructions is not null or spec.source_extraction_job_id is not null or cardinality(spec.source_language_codes)<>0
   then raise exception 'NATIVE_FIXTURE_CANCELLED_FACTS_CHANGED'; end if;
  else
   expected_source:=case when marker.replacement_job_id is null then marker.original_text else marker.corrected_text end;
   if applied or spec.source_text is distinct from expected_source or spec.source_row_version<>(case when extra_jobs=1 then 3 else 2 end)
    or spec.processing_job_id is distinct from coalesce(marker.replacement_job_id,job.id)
    or spec.row_version<>3+extra_jobs or workspace.row_version<>3+extra_jobs or workspace.draft_revision<>2+extra_jobs
    or spec.normalized_instructions is distinct from 'Synthetic manual facts retained' or spec.source_extraction_job_id is not null
    or cardinality(spec.source_language_codes)<>0
   then raise exception 'NATIVE_FIXTURE_CORRECTION_FACTS_CHANGED'; end if;
  end if;
  if (select count(*) from eps.roles where workspace_id=workspace.id)<>(case when applied then 1 else 0 end)
   or (select count(*) from eps.slots where workspace_id=workspace.id)<>(case when applied then 1 else 0 end)
  then raise exception 'NATIVE_FIXTURE_UNKNOWN_ROLE_OR_SLOT'; end if;
  if applied then
   select * into strict data_role from eps.roles where workspace_id=workspace.id for update;
   if data_role.name<>'' or data_role.headcount is not null or data_role.category is not null or data_role.sort_order<>0
    or data_role.row_version<>1 or data_role.archived_at is not null or data_role.spec_id is distinct from spec.id or data_role.source_job_id is distinct from job.id
    or data_role.source_role is distinct from spec.source_extraction#>'{roles,0}' or data_role.source_role->>'source_role_key' is distinct from 'native-synthetic-role'
    or (select count(*) from eps.slots where role_id=data_role.id and workspace_id=workspace.id and ordinal=1 and label='Slot 1'
      and sort_order=0 and provisional and row_version=1 and archived_at is null)<>1
   then raise exception 'NATIVE_FIXTURE_GENERATED_FACTS_CHANGED'; end if;
  end if;
  if p_final and (item in(1,4) and (job.status<>'succeeded' or job.stage<>'apply_specs' or not applied or jsonb_array_length(job.completed_stages)<>3)
   or item=2 and (job.status<>'cancelled' or job.stage<>'apply_specs' or jsonb_array_length(job.completed_stages)<>2)
   or item=3 and (job.status<>'waiting_for_input' or job.error->>'code' is distinct from 'INPUT_CHANGED' or jsonb_array_length(job.completed_stages)<>2))
  then raise exception 'NATIVE_FINAL_JOB_STATUS_UNCONFIRMED'; end if;
 end loop;
 if marker.replacement_job_id is not null then
  select * into strict job from eps.jobs where id=marker.replacement_job_id for update;
  select * into strict retained from eps.specs_source_inputs where job_id=job.id;
  if job.workspace_id<>'7c980000-0000-4000-8000-000000000003' or job.status<>'queued' or job.stage<>'prepare_document' or job.attempt<>0
   or retained.source_text<>marker.corrected_text or retained.source_row_version<>3 or retained.input_hash<>job.input_hash
   or job.requested_by<>'7a980000-0000-4000-8000-000000000001' or job.input_hash<>eps.jobs_hash_v1(job.input)
  then raise exception 'NATIVE_REPLACEMENT_JOB_CHANGED'; end if;
 elsif p_final then raise exception 'NATIVE_FINAL_CORRECTION_MISSING'; end if;
 for payload in select p.* from eps.specs_stage_payloads p join eps.jobs j on j.id=p.job_id where j.workspace_id::text like '7c980000-%' loop
  select * into strict job from eps.jobs where id=payload.job_id;
  select * into strict retained from eps.specs_source_inputs where job_id=payload.job_id;
  if payload.input_hash<>job.input_hash then raise exception 'NATIVE_PAYLOAD_SCOPE_CHANGED'; end if;
  if payload.stage='prepare_document' then
   if payload.prepared_text is distinct from replace(replace(retained.source_text,E'\r\n',E'\n'),E'\r',E'\n')
    or payload.paragraphs is distinct from eps.specs_stage_paragraphs(retained.source_text)
   then raise exception 'NATIVE_PREPARATION_CHANGED'; end if;
  else
   select * into strict preparation from eps.specs_stage_payloads where job_id=job.id and stage='prepare_document';
   perform eps.specs_stage_extract(payload.result->'result',preparation.paragraphs);
   perform eps.specs_stage_metadata(payload.result->'metadata',job,preparation.paragraphs);
  end if;
 end loop;
 if exists(select 1 from eps.audit_events a where a.principal_id::text like '7a980000-%' and (
  a.action='jobs.apply_specs' and a.resource_id in(select id from eps.specs where workspace_id in('7c980000-0000-4000-8000-000000000001','7c980000-0000-4000-8000-000000000004'))
  or marker.replacement_job_id is not null and a.action='jobs.enqueue' and a.resource_id=marker.replacement_job_id
  or marker.replacement_job_id is not null and a.action='specs.submit_specs' and a.resource_id in(select id from eps.specs where workspace_id='7c980000-0000-4000-8000-000000000003')) is not true)
  or exists(select 1 from eps.idempotency_records r where r.principal_id::text like '7a980000-%' and (
   marker.replacement_job_id is not null and r.operation='specs.submit_specs' and r.key='native-synthetic-correction-0001' and r.response->>'job_id'=marker.replacement_job_id::text
   or marker.replacement_job_id is not null and r.operation='jobs.enqueue' and r.key='specs.submit:'||encode(sha256(convert_to('native-synthetic-correction-0001','UTF8')),'hex') and r.response->>'id'=marker.replacement_job_id::text) is not true)
 then raise exception 'NATIVE_FIXTURE_UNRELATED_AUDIT_OR_RECEIPT'; end if;
end $$;
revoke all on function eps_local_guard.native_specs_fixture_require(),eps_local_guard.native_specs_fixture_digest(),eps_local_guard.native_specs_fixture_identity_digest(),eps_local_guard.native_specs_fixture_validate(boolean)
 from public,anon,authenticated,service_role,eps_jobs_executor,eps_native_specs_local_probe;

insert into auth.users(id,is_anonymous) values('7a980000-0000-4000-8000-000000000001',false);
insert into public.projects(id,name) select ('7b980000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'Synthetic native stage fixture '||i from generate_series(1,4) i;
insert into public.project_memberships(project_id,principal_id,can_write)
 select ('7b980000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'7a980000-0000-4000-8000-000000000001',true from generate_series(1,4) i;
insert into public.app_capability_grants(principal_id,capability)
 select '7a980000-0000-4000-8000-000000000001'::uuid,capability from unnest(array['projects.read','workspaces.write']) capability;
insert into eps.workspaces(id,project_id,row_version,draft_revision,has_unpublished_changes)
 select ('7c980000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('7b980000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,2,1,true from generate_series(1,4) i;
update eps.specs set source_text=(select original_text from eps_local_guard.native_specs_fixture),source_row_version=2,row_version=2
 where workspace_id::text like '7c980000-%';
-- This workspace already has manual facts. Correction/stale publication must
-- preserve them; the explicit later getInput denial isolates the source fence.
update eps.specs set normalized_instructions='Synthetic manual facts retained',row_version=row_version+1
 where workspace_id='7c980000-0000-4000-8000-000000000003';
update eps.workspaces set row_version=row_version+1,draft_revision=draft_revision+1
 where id='7c980000-0000-4000-8000-000000000003';
do $seed$ declare index_value integer; workspace_value uuid; spec_value uuid; job_value uuid; source_value text; epoch bigint; workspace_version bigint; body jsonb; fingerprint text; begin
 for index_value in 1..4 loop
  workspace_value:=('7c980000-0000-4000-8000-'||lpad(index_value::text,12,'0'))::uuid;
  job_value:=('7f980000-0000-4000-8000-'||lpad(index_value::text,12,'0'))::uuid;
  select id into strict spec_value from eps.specs where workspace_id=workspace_value;
  select row_version into strict workspace_version from eps.workspaces where id=workspace_value;
  select original_text into source_value from eps_local_guard.native_specs_fixture;
  epoch:=2;
  body:=jsonb_build_object('schema_version','1.0','specs_id',spec_value,'source_hash',encode(sha256(convert_to(source_value,'UTF8')),'hex'),
   'source_row_version',epoch,'workspace_row_version',workspace_version,
   'configuration',jsonb_build_object('document_preparation_version','document-preparation.v1','model_version','synthetic-native-acceptance-model',
    'prompt_version','spec_extract_v1.0.0','result_schema_version','1.0'));
  fingerprint:=eps.jobs_hash_v1(body);
  insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,dedupe_key,correlation_id)
   values(job_value,workspace_value,'7a980000-0000-4000-8000-000000000001','specs_extract',spec_value,body,fingerprint,
    encode(sha256(convert_to('specs_extract:'||workspace_value||':'||fingerprint,'UTF8')),'hex'),'native-synthetic-'||index_value);
  insert into eps.specs_source_inputs(job_id,workspace_id,spec_id,source_row_version,source_hash,input_hash,source_text)
   values(job_value,workspace_value,spec_value,epoch,body->>'source_hash',fingerprint,source_value);
  insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key)
   values(job_value,'prepare_document',fingerprint,1,job_value||':1');
  update eps.specs set processing_job_id=job_value where id=spec_value;
 end loop;
 update eps_local_guard.native_specs_fixture set cases=(select jsonb_agg(jsonb_build_object('name',name,'job_id',job.id,'input_hash',job.input_hash) order by ordinal)
  from (values(1,'happy'),(2,'cancelled'),(3,'source_changed'),(4,'recovery')) names(ordinal,name)
  join eps.jobs job on job.id=('7f980000-0000-4000-8000-'||lpad(ordinal::text,12,'0'))::uuid);
end $seed$;
update eps_local_guard.native_specs_fixture set identity_sha256=eps_local_guard.native_specs_fixture_identity_digest();
select eps_local_guard.native_specs_fixture_require();
select jsonb_build_object('cases',cases) from eps_local_guard.native_specs_fixture;
commit;
