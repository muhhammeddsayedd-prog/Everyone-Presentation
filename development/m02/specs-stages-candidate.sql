-- REVIEW CANDIDATE ONLY: fixed owned-local BEGIN/ROLLBACK, never cloud/history.
-- Private specs stage kernel; no login identity, gateway or worker is provisioned.
-- PostgreSQL17 SELECT/RLS: https://www.postgresql.org/docs/17/sql-select.html
-- https://www.postgresql.org/docs/17/ddl-rowsecurity.html
set local lock_timeout='5s';
set local statement_timeout='30s';
set local search_path='';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or current_setting('eps.specs_stages_candidate_rehearsal',true) is distinct from 'rollback-only-v1'
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145']::text[]
  or to_regclass('eps.specs_stage_payloads') is not null
  or exists(select 1 from pg_roles where rolname in('eps_specs_stage_owner','eps_specs_apply_owner','eps_jobs_executor'))
  or exists(select 1 from pg_proc f join pg_namespace n on n.oid=f.pronamespace where n.nspname='eps' and
   (f.proname like 'specs_stage\_%' escape '\' or f.proname in('claim_job_stage','record_job_event','get_specs_stage_input','recover_job_stages','job_requester_active')))
  or exists(select 1 from pg_policy where polname like 'specs_stage\_%' escape '\')
 then raise exception 'SPECS_STAGES_REVIEWED_NINE_VERSION_ROLLBACK_REQUIRED'; end if;
end $$;
create role eps_specs_stage_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
create role eps_specs_apply_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
create role eps_jobs_executor nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_specs_stage_owner,eps_specs_apply_owner,eps_jobs_executor to postgres;
grant usage on schema eps,public to eps_specs_stage_owner;
grant usage on schema eps to eps_jobs_executor;
grant usage on schema eps,public to eps_specs_apply_owner;
-- No inherited authenticated authority, user JWT or dispatcher-mode GUC.
-- Deliberate, isolated managed-Auth exception: hosted auth.users has RLS and no
-- read policies, and postgres cannot delegate auth schema USAGE. Only this
-- UUID -> boolean lookup has postgres ownership/BYPASS authority. No source,
-- email, claims, DML, locks, dynamic SQL or caller-selected query is exposed.
create function eps.job_requester_active(p_principal uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select coalesce(p_principal is not null and exists(select 1 from auth.users principal
  where principal.id=p_principal and principal.is_anonymous is false and principal.deleted_at is null
   and (principal.banned_until is null or principal.banned_until<=pg_catalog.clock_timestamp())),false)
$$;
revoke all on function eps.job_requester_active(uuid) from public,anon,authenticated,service_role,eps_api_owner,eps_specs_owner,eps_specs_initializer,eps_jobs_owner,eps_jobs_dispatcher,eps_logo_verify_owner,eps_jobs_executor,eps_specs_stage_owner,eps_specs_apply_owner;
grant execute on function eps.job_requester_active(uuid) to eps_specs_stage_owner,eps_specs_apply_owner;
grant select(id,archived_at) on public.projects to eps_specs_stage_owner;
grant select(project_id,principal_id,active,can_write) on public.project_memberships to eps_specs_stage_owner;
grant select(principal_id,capability,active) on public.app_capability_grants to eps_specs_stage_owner;
grant select(id,project_id,archived_at,row_version),update(row_version) on eps.workspaces to eps_specs_stage_owner;
grant select on eps.specs to eps_specs_stage_owner;
grant update(row_version) on eps.specs to eps_specs_stage_owner;
grant select on eps.jobs,eps.job_events,eps.outbox_events to eps_specs_stage_owner;
grant update(status,stage,attempt,current_attempt_id,lease_token_digest,lease_expires_at,heartbeat_at,last_event_sequence,stage_attempts,
 completed_stages,progress_completed,progress_total,result,error,available_at,dispatch_generation,n8n_execution_id,updated_at,row_version)
 on eps.jobs to eps_specs_stage_owner;
grant insert on eps.job_events,eps.outbox_events to eps_specs_stage_owner;
grant execute on function eps.fail(text,text,integer,bigint),eps.jobs_hash_v1(jsonb) to eps_specs_stage_owner;
create policy specs_stage_projects on public.projects for select to eps_specs_stage_owner using(true);
create policy specs_stage_memberships on public.project_memberships for select to eps_specs_stage_owner using(true);
create policy specs_stage_capabilities on public.app_capability_grants for select to eps_specs_stage_owner using(true);
create policy specs_stage_workspace_read on eps.workspaces for select to eps_specs_stage_owner using(true);
-- UPDATE privilege/USING permits ordered FOR UPDATE locks; actual DML is denied.
create policy specs_stage_workspace_lock on eps.workspaces for update to eps_specs_stage_owner using(true) with check(false);
create policy specs_stage_spec_read on eps.specs for select to eps_specs_stage_owner using(true);
create policy specs_stage_spec_lock on eps.specs for update to eps_specs_stage_owner using(true) with check(false);
create policy specs_stage_job_read on eps.jobs for select to eps_specs_stage_owner using(kind='specs_extract');
create policy specs_stage_job_update on eps.jobs for update to eps_specs_stage_owner using(kind='specs_extract') with check(kind='specs_extract');
create policy specs_stage_event_read on eps.job_events for select to eps_specs_stage_owner using(true);
create policy specs_stage_event_insert on eps.job_events for insert to eps_specs_stage_owner with check(true);
create policy specs_stage_outbox_read on eps.outbox_events for select to eps_specs_stage_owner using(true);
create policy specs_stage_outbox_insert on eps.outbox_events for insert to eps_specs_stage_owner with check(true);

create table eps.specs_stage_payloads (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references eps.jobs(id) on delete restrict,
 stage text not null check(stage in('prepare_document','extract_specs')), attempt_id uuid not null,
 input_hash text not null check(input_hash~'^[a-f0-9]{64}$'), result_schema text not null,
 result jsonb not null check(jsonb_typeof(result)='object' and octet_length(result::text)<=262144),
 prepared_text text, paragraphs jsonb,
 created_at timestamptz not null default clock_timestamp(), unique(job_id,stage),
 check(stage='prepare_document' and prepared_text is not null and paragraphs is not null or stage='extract_specs' and prepared_text is null and paragraphs is null),
 check(paragraphs is null or jsonb_typeof(paragraphs)='array' and jsonb_array_length(paragraphs)<=10000)
);
comment on table eps.specs_stage_payloads is 'Private source/evidence/result staging, never public job metadata or event receipts. Initial-text-only candidate, not a source revision manager.';
alter table eps.specs_stage_payloads enable row level security;
alter table eps.specs_stage_payloads force row level security;
revoke all on eps.specs_stage_payloads from public,anon,authenticated,service_role,eps_api_owner,eps_specs_owner,eps_specs_initializer,eps_jobs_owner,eps_jobs_dispatcher,eps_jobs_executor;
grant select,insert on eps.specs_stage_payloads to eps_specs_stage_owner;
create policy specs_stage_payload_read on eps.specs_stage_payloads for select to eps_specs_stage_owner using(true);
create policy specs_stage_payload_insert on eps.specs_stage_payloads for insert to eps_specs_stage_owner with check(true);

create function eps.specs_stage_assert(p_condition boolean,p_code text default 'INVALID_REQUEST') returns void
language plpgsql immutable security invoker set search_path='' as $$ begin
 if p_condition is distinct from true then perform eps.fail(p_code,'The processing operation could not be validated.',case
  when p_code='INVALID_REQUEST' then 400 when p_code='RESOURCE_NOT_FOUND' then 404 when p_code in('CAPABILITY_REQUIRED','LEASE_INVALID') then 403 else 409 end); end if;
end $$;

-- This separate owner may publish only the initial, still-pristine extraction.
-- The executor and general stage owner have no canonical resource DML authority.
grant select(id,archived_at) on public.projects to eps_specs_apply_owner;
grant select(project_id,principal_id,active,can_write) on public.project_memberships to eps_specs_apply_owner;
grant select(principal_id,capability,active) on public.app_capability_grants to eps_specs_apply_owner;
grant select on eps.jobs,eps.specs_stage_payloads,eps.specs,eps.roles,eps.slots to eps_specs_apply_owner;
grant select(id,project_id,archived_at,row_version,draft_revision,has_unpublished_changes) on eps.workspaces to eps_specs_apply_owner;
grant update(row_version,draft_revision,has_unpublished_changes,updated_at) on eps.workspaces to eps_specs_apply_owner;
grant update(normalized_instructions,clarifications,source_extraction,source_language_codes,row_version,updated_at) on eps.specs to eps_specs_apply_owner;
grant insert(workspace_id,spec_id,name,headcount,category,requirements,clarifications,source_role,sort_order) on eps.roles to eps_specs_apply_owner;
grant insert(workspace_id,role_id,ordinal,label,sort_order,provisional) on eps.slots to eps_specs_apply_owner;
grant update(row_version) on eps.roles,eps.slots to eps_specs_apply_owner;
grant insert(principal_id,action,resource_id,request_id,client_type) on eps.audit_events to eps_specs_apply_owner;
create policy specs_stage_apply_projects on public.projects for select to eps_specs_apply_owner using(true);
create policy specs_stage_apply_memberships on public.project_memberships for select to eps_specs_apply_owner using(true);
create policy specs_stage_apply_capabilities on public.app_capability_grants for select to eps_specs_apply_owner using(true);
create policy specs_stage_apply_job on eps.jobs for select to eps_specs_apply_owner using(kind='specs_extract');
create policy specs_stage_apply_payload on eps.specs_stage_payloads for select to eps_specs_apply_owner using(true);
create policy specs_stage_apply_workspace_read on eps.workspaces for select to eps_specs_apply_owner using(true);
create policy specs_stage_apply_workspace_update on eps.workspaces for update to eps_specs_apply_owner using(true) with check(true);
create policy specs_stage_apply_spec_read on eps.specs for select to eps_specs_apply_owner using(true);
create policy specs_stage_apply_spec_update on eps.specs for update to eps_specs_apply_owner using(true) with check(true);
create policy specs_stage_apply_roles_read on eps.roles for select to eps_specs_apply_owner using(true);
create policy specs_stage_apply_roles_lock on eps.roles for update to eps_specs_apply_owner using(true) with check(false);
create policy specs_stage_apply_roles_insert on eps.roles for insert to eps_specs_apply_owner with check(true);
create policy specs_stage_apply_slots_read on eps.slots for select to eps_specs_apply_owner using(true);
create policy specs_stage_apply_slots_lock on eps.slots for update to eps_specs_apply_owner using(true) with check(false);
create policy specs_stage_apply_slots_insert on eps.slots for insert to eps_specs_apply_owner with check(true);
create policy specs_stage_apply_audit on eps.audit_events for insert to eps_specs_apply_owner with check(action='jobs.apply_specs' and client_type='api'
 and exists(select 1 from eps.specs spec join eps.jobs job on job.id=spec.processing_job_id where spec.id=audit_events.resource_id
  and job.requested_by=audit_events.principal_id and job.correlation_id=audit_events.request_id));
create function eps.specs_stage_apply(p_job eps.jobs) returns jsonb language plpgsql security definer set search_path='' as $$
declare spec eps.specs; saved eps.specs_stage_payloads; preparation eps.specs_stage_payloads; workspace_version bigint; workspace_draft bigint; extraction jsonb; role_value jsonb;
 current_role_id uuid; role_index bigint:=0; slot_count bigint:=0; requested_slots numeric; count_value bigint; ordinal_value bigint; working_clarifications_value jsonb; changed bigint; marker_count bigint:=0;
begin
 -- Caller already holds workspace -> Spec -> job. Repeat exact binding under
 -- those locks; this helper never acquires job/outbox after child role locks.
 select row_version,draft_revision into workspace_version,workspace_draft from eps.workspaces where id=p_job.workspace_id for update;
 select * into spec from eps.specs where id=p_job.resource_id and workspace_id=p_job.workspace_id for update;
 perform eps.specs_stage_assert(found and eps.specs_stage_source_matches(p_job) and eps.specs_stage_can_write(p_job.requested_by,p_job.workspace_id),'INPUT_CHANGED');
 perform 1 from eps.roles where workspace_id=p_job.workspace_id order by id for update;
 perform 1 from eps.slots where workspace_id=p_job.workspace_id order by id for update;
 perform eps.specs_stage_assert(workspace_version::text=p_job.input->>'workspace_row_version'
  and spec.normalized_instructions is null and spec.clarifications='[]' and spec.source_extraction is null and cardinality(spec.source_language_codes)=0
  and not exists(select 1 from eps.roles where workspace_id=p_job.workspace_id)
  and not exists(select 1 from eps.slots where workspace_id=p_job.workspace_id),'INPUT_CHANGED');
 select * into saved from eps.specs_stage_payloads where job_id=p_job.id and stage='extract_specs' and input_hash=p_job.input_hash;
 perform eps.specs_stage_assert(found and saved.result_schema='specs-extraction-stage.v1','RESULT_INVALID');
 select * into preparation from eps.specs_stage_payloads where job_id=p_job.id and stage='prepare_document' and input_hash=p_job.input_hash;
 perform eps.specs_stage_assert(found and preparation.paragraphs=eps.specs_stage_paragraphs(spec.source_text)
  and preparation.prepared_text=replace(replace(spec.source_text,E'\r\n',E'\n'),E'\r',E'\n'),'RESULT_INVALID'); extraction:=saved.result->'result';
 perform eps.specs_stage_extract(extraction,preparation.paragraphs); perform eps.specs_stage_metadata(saved.result->'metadata',p_job,preparation.paragraphs);
 select coalesce(sum(coalesce((value->>'headcount')::numeric,1)),0) into requested_slots from jsonb_array_elements(extraction->'roles');
 -- Same default budget as commitSpecsExtraction; no huge safe-integer loop.
 perform eps.specs_stage_assert(requested_slots<=1000,'SLOT_ALLOCATION_LIMIT_EXCEEDED');
 for role_value in select value from jsonb_array_elements(extraction->'roles') with ordinality entries(value,ordinal) order by ordinal loop
  select coalesce(jsonb_agg(value||jsonb_build_object('resolved',false) order by ordinal),'[]') into working_clarifications_value from jsonb_array_elements(role_value->'clarifications') with ordinality entries(value,ordinal);
  if role_value->'headcount'='null' and not exists(select 1 from jsonb_array_elements(working_clarifications_value) where value->>'field_path'='headcount') then
   working_clarifications_value:=working_clarifications_value||jsonb_build_array(jsonb_build_object('field_path','headcount','reason','Headcount is not known. The single slot is provisional.','source',null,'resolved',false)); end if;
  if coalesce(role_value->>'name','')='' and not exists(select 1 from jsonb_array_elements(working_clarifications_value) where value->>'field_path'='name') then
   working_clarifications_value:=working_clarifications_value||jsonb_build_array(jsonb_build_object('field_path','name','reason','Role name is not provided.','source',null,'resolved',false)); end if;
  marker_count:=marker_count+jsonb_array_length(working_clarifications_value);
  insert into eps.roles(workspace_id,spec_id,name,headcount,category,requirements,clarifications,source_role,sort_order)
   values(p_job.workspace_id,spec.id,coalesce(role_value->>'name',''),(role_value->>'headcount')::bigint,role_value->>'category',role_value->'requirements',working_clarifications_value,role_value,role_index)
   returning id into current_role_id;
  get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
  count_value:=coalesce((role_value->>'headcount')::bigint,1);
  for ordinal_value in 1..count_value loop
   insert into eps.slots(workspace_id,role_id,ordinal,label,sort_order,provisional)
    values(p_job.workspace_id,current_role_id,ordinal_value,coalesce(nullif(role_value->>'name',''),'Slot')||' '||ordinal_value,ordinal_value-1,role_value->'headcount'='null');
   get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
  end loop;
  perform eps.specs_stage_assert(exists(select 1 from eps.roles where id=current_role_id and workspace_id=p_job.workspace_id and spec_id=spec.id
    and name=coalesce(role_value->>'name','') and headcount is not distinct from (role_value->>'headcount')::bigint
    and category is not distinct from role_value->>'category' and requirements=role_value->'requirements' and roles.clarifications=working_clarifications_value
    and source_role=role_value and sort_order=role_index and row_version=1 and archived_at is null)
   and (select count(*) from eps.slots where role_id=current_role_id)=count_value
   and not exists(select 1 from eps.slots where role_id=current_role_id and (workspace_id<>p_job.workspace_id or archived_at is not null or row_version<>1
    or ordinal not between 1 and count_value or sort_order<>ordinal-1 or label<>coalesce(nullif(role_value->>'name',''),'Slot')||' '||ordinal
    or provisional is distinct from (role_value->'headcount'='null'))),'STAGE_STATE_INVALID');
  role_index:=role_index+1; slot_count:=slot_count+count_value;
 end loop;
 select coalesce(jsonb_agg(value||jsonb_build_object('resolved',false) order by ordinal),'[]') into working_clarifications_value from jsonb_array_elements(extraction->'clarifications') with ordinality entries(value,ordinal);
 marker_count:=marker_count+jsonb_array_length(working_clarifications_value);
 update eps.specs set normalized_instructions=extraction->>'general_instructions',clarifications=working_clarifications_value,source_extraction=extraction,
  source_language_codes=array(select jsonb_array_elements_text(extraction->'source_language_codes')),row_version=row_version+1,updated_at=clock_timestamp()
  where id=spec.id and row_version=spec.row_version and processing_job_id=p_job.id;
 get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
 perform eps.specs_stage_assert(exists(select 1 from eps.specs current_spec where current_spec.id=spec.id and current_spec.workspace_id=p_job.workspace_id
  and current_spec.row_version=spec.row_version+1 and current_spec.source_text is not distinct from spec.source_text
  and current_spec.source_asset_id is not distinct from spec.source_asset_id and current_spec.source_row_version=spec.source_row_version
  and current_spec.processing_job_id=p_job.id and current_spec.normalized_instructions is not distinct from extraction->>'general_instructions'
  and current_spec.clarifications=working_clarifications_value and current_spec.source_extraction=extraction
  and current_spec.source_language_codes=array(select jsonb_array_elements_text(extraction->'source_language_codes'))),'STAGE_STATE_INVALID');
 update eps.workspaces set row_version=row_version+1,draft_revision=draft_revision+1,has_unpublished_changes=true,updated_at=clock_timestamp()
  where id=p_job.workspace_id and row_version=workspace_version;
 get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
 perform eps.specs_stage_assert(exists(select 1 from eps.workspaces where id=p_job.workspace_id and row_version=workspace_version+1 and draft_revision=workspace_draft+1 and has_unpublished_changes)
  and (select count(*) from eps.roles where workspace_id=p_job.workspace_id)=role_index
  and (select count(*) from eps.slots where workspace_id=p_job.workspace_id)=slot_count,'STAGE_STATE_INVALID');
 insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type) values(p_job.requested_by,'jobs.apply_specs',spec.id,p_job.correlation_id,'api');
 get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
 perform eps.specs_stage_assert(eps.specs_stage_can_write(p_job.requested_by,p_job.workspace_id),'CAPABILITY_REQUIRED');
 return jsonb_build_object('specs_id',spec.id,'workspace_id',p_job.workspace_id,'role_count',role_index,'slot_count',slot_count,'clarification_count',marker_count);
end $$;
create function eps.specs_stage_shape(p_value jsonb,p_keys text[],p_required text[] default null) returns boolean
language plpgsql immutable security invoker set search_path='' as $$ begin
 if jsonb_typeof(p_value) is distinct from 'object' then return false; end if;
 return not exists(select 1 from jsonb_object_keys(p_value) entry where not(entry=any(p_keys)))
  and (p_required is null or p_value?&p_required);
end $$;
create function eps.specs_stage_integer(p_value jsonb,p_min bigint default 0,p_max bigint default 9007199254740991) returns boolean
language plpgsql immutable security invoker set search_path='' as $$ begin
 if jsonb_typeof(p_value) is distinct from 'number' or p_value::text!~'^[0-9]+$' then return false; end if;
 return (p_value::text)::numeric between p_min and p_max;
end $$;
create function eps.specs_stage_text(p_value jsonb,p_nullable boolean default false) returns boolean
language sql immutable security invoker set search_path='' as $$
 select jsonb_typeof(p_value)='string' or p_nullable and p_value='null'::jsonb
$$;
create function eps.specs_stage_strings(p_value jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$ begin
 if jsonb_typeof(p_value) is distinct from 'array' then return false; end if;
 return not exists(select 1 from jsonb_array_elements(p_value) entry where jsonb_typeof(entry)<>'string');
end $$;
create function eps.specs_stage_nonblank(p_text text) returns boolean language sql immutable security invoker set search_path='' as $$
 -- ECMAScript String.trim whitespace, including VT/FF and NBSP/BOM; deliberately
 -- excludes NEL/zero-width space. Shared by source lines, role keys and quotes.
 select p_text is not null and length(btrim(p_text,E' \t\n\r'||chr(11)||chr(12)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279)))>0
$$;
create function eps.specs_stage_can_write(p_principal uuid,p_workspace uuid) returns boolean language sql volatile security invoker set search_path='' as $$
 select exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id
  join public.project_memberships m on m.project_id=p.id and m.principal_id=p_principal
  where w.id=p_workspace and w.archived_at is null and p.archived_at is null and eps.job_requester_active(p_principal) and m.active and m.can_write
   and not exists(select 1 from unnest(array['projects.read','workspaces.write']) required
    where not exists(select 1 from public.app_capability_grants g where g.principal_id=p_principal and g.capability=required and g.active)))
$$;
-- The unlocked lookup never returns content. All entry points then lock parent
-- workspace -> Spec -> job. Legacy cancellation/dispatch take only job -> outbox.
create function eps.specs_stage_lock(p_job uuid,p_require_access boolean default true) returns eps.jobs language plpgsql volatile security invoker set search_path='' as $$
declare identity_row eps.jobs; job eps.jobs; spec eps.specs; workspace uuid; begin
 select * into identity_row from eps.jobs where id=p_job;
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Processing job not found.',404); end if;
 select id into workspace from eps.workspaces where id=identity_row.workspace_id for update;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');
 select * into spec from eps.specs where id=identity_row.resource_id and workspace_id=identity_row.workspace_id for update;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');
 select * into job from eps.jobs where id=p_job for update;
 perform eps.specs_stage_assert(found and job.workspace_id=workspace and job.resource_id=spec.id,'RESOURCE_NOT_FOUND');
 -- Fresh command snapshot after every potentially blocking resource lock.
 if p_require_access then perform eps.specs_stage_assert(eps.specs_stage_can_write(job.requested_by,job.workspace_id),'CAPABILITY_REQUIRED'); end if;
 return job;
end $$;
create function eps.specs_stage_source_matches(p_job eps.jobs) returns boolean language sql volatile security invoker set search_path='' as $$
 select exists(select 1 from eps.specs spec where spec.id=p_job.resource_id and spec.workspace_id=p_job.workspace_id
  and spec.processing_job_id=p_job.id and spec.source_asset_id is null and p_job.input_asset_id is null and spec.source_text is not null
  and spec.id::text=p_job.input->>'specs_id' and spec.source_row_version::text=p_job.input->>'source_row_version'
  and encode(sha256(convert_to(spec.source_text,'UTF8')),'hex')=p_job.input->>'source_hash'
  and p_job.input_hash_version='eps.specs-input.pg-jsonb.v1' and eps.jobs_hash_v1(p_job.input)=p_job.input_hash)
$$;
create function eps.specs_stage_configuration(p_configuration jsonb) returns void language plpgsql immutable security invoker set search_path='' as $$ begin
 -- Reviewed installed worker/prompt/schema manifest, not caller-selected hashes.
 if not coalesce(eps.specs_stage_shape(p_configuration,array['document_preparation_version','model_version','prompt_version','result_schema_version'],array['document_preparation_version','model_version','prompt_version','result_schema_version'])
  and p_configuration->>'document_preparation_version'='document-preparation.v1'
  and p_configuration->>'prompt_version'='spec_extract_v1.0.0' and p_configuration->>'result_schema_version'='1.0'
  and jsonb_typeof(p_configuration->'model_version')='string' and (p_configuration->>'model_version')~'^[A-Za-z0-9._:-]{1,200}$',false)
 then perform eps.fail('FEATURE_NOT_IMPLEMENTED','This processing configuration is not available.',503); end if;
end $$;
create function eps.specs_stage_paragraphs(p_text text) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare normalized text:=replace(replace(p_text,E'\r\n',E'\n'),E'\r',E'\n'); line text; paragraphs jsonb:='[]';
 offset_value bigint:=0; start_value bigint; end_value bigint; parts text[]:='{}'; line_units bigint;
begin
 perform eps.specs_stage_assert(p_text is not null and octet_length(p_text)<=20971520
  and length(normalized)+length(regexp_replace(normalized,U&'[\0001-\FFFF]','','g'))<=2000000
  and normalized !~ ('['||chr(1)||'-'||chr(8)||chr(11)||chr(12)||chr(14)||'-'||chr(31)||']'),'RESULT_INVALID');
 foreach line in array string_to_array(normalized,E'\n') loop
  line_units:=length(line)+length(regexp_replace(line,U&'[\0001-\FFFF]','','g'));
  if eps.specs_stage_nonblank(line) then
   start_value:=coalesce(start_value,offset_value); end_value:=offset_value+line_units; parts:=array_append(parts,line);
  elsif start_value is not null then
   paragraphs:=paragraphs||jsonb_build_array(jsonb_build_object('index',jsonb_array_length(paragraphs),'page',null,'start',start_value,'end',end_value,'text',array_to_string(parts,E'\n')));
   start_value:=null; parts:='{}';
  end if;
  offset_value:=offset_value+line_units+1;
  perform eps.specs_stage_assert(jsonb_array_length(paragraphs)<=10000,'RESULT_INVALID');
 end loop;
 if start_value is not null then paragraphs:=paragraphs||jsonb_build_array(jsonb_build_object('index',jsonb_array_length(paragraphs),'page',null,'start',start_value,'end',end_value,'text',array_to_string(parts,E'\n'))); end if;
 perform eps.specs_stage_assert(jsonb_array_length(paragraphs) between 1 and 10000,'RESULT_INVALID'); return paragraphs;
end $$;
create function eps.specs_stage_reference(p_value jsonb,p_paragraphs jsonb) returns void language plpgsql immutable security invoker set search_path='' as $$
declare target jsonb; begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['asset_id','page','paragraph','segment_index','start_ms','end_ms','quote'],array['asset_id','page','paragraph','segment_index','start_ms','end_ms','quote'])
  and p_value->'asset_id'='null'::jsonb and p_value->'page'='null'::jsonb and p_value->'segment_index'='null'::jsonb
  and p_value->'start_ms'='null'::jsonb and p_value->'end_ms'='null'::jsonb
  and eps.specs_stage_integer(p_value->'paragraph',0,9999) and eps.specs_stage_text(p_value->'quote',true),'RESULT_INVALID');
 target:=p_paragraphs->((p_value->>'paragraph')::integer);
 perform eps.specs_stage_assert(target is not null and (p_value->'quote'='null'::jsonb or eps.specs_stage_nonblank(p_value->>'quote') and position(p_value->>'quote' in target->>'text')>0),'RESULT_INVALID');
end $$;
create function eps.specs_stage_clarifications(p_value jsonb,p_paragraphs jsonb) returns void language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb; begin
 perform eps.specs_stage_assert(jsonb_typeof(p_value)='array','RESULT_INVALID');
 for item in select value from jsonb_array_elements(p_value) loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(item,array['field_path','reason','source'],array['field_path','reason','source'])
   and eps.specs_stage_text(item->'field_path') and length(item->>'field_path')>0 and eps.specs_stage_text(item->'reason') and length(item->>'reason')>0,'RESULT_INVALID');
  if item->'source'<>'null'::jsonb then perform eps.specs_stage_reference(item->'source',p_paragraphs); end if;
 end loop;
end $$;
create function eps.specs_stage_extract(p_value jsonb,p_paragraphs jsonb) returns void language plpgsql immutable security invoker set search_path='' as $$
declare role_value jsonb; requirements jsonb; reference jsonb; field text; begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['schema_version','source_asset_id','source_language_codes','roles','general_instructions','clarifications'],array['schema_version','source_asset_id','source_language_codes','roles','general_instructions','clarifications'])
  and p_value->>'schema_version'='1.0' and p_value->'source_asset_id'='null'::jsonb and eps.specs_stage_strings(p_value->'source_language_codes')
  and jsonb_typeof(p_value->'roles')='array' and eps.specs_stage_text(p_value->'general_instructions',true),'RESULT_INVALID');
 perform eps.specs_stage_clarifications(p_value->'clarifications',p_paragraphs);
 perform eps.specs_stage_assert(not exists(select 1 from jsonb_array_elements(p_value->'roles') entries(value) group by entries.value->>'source_role_key' having count(*)>1),'RESULT_INVALID');
 for role_value in select value from jsonb_array_elements(p_value->'roles') loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(role_value,array['source_role_key','name','headcount','category','requirements','evidence','clarifications'],array['source_role_key','name','headcount','category','requirements','evidence','clarifications'])
   and eps.specs_stage_text(role_value->'source_role_key') and length(role_value->>'source_role_key')>0 and eps.specs_stage_text(role_value->'name',true)
   and eps.specs_stage_text(role_value->'category',true) and (role_value->'headcount'='null'::jsonb or eps.specs_stage_integer(role_value->'headcount',1))
   and jsonb_typeof(role_value->'evidence')='array'
   and eps.specs_stage_nonblank(role_value->>'source_role_key'),'RESULT_INVALID');
  perform eps.specs_stage_assert(jsonb_array_length(role_value->'evidence')>0,'RESULT_INVALID');
  requirements:=role_value->'requirements';
  perform eps.specs_stage_assert(eps.specs_stage_shape(requirements,array['age_range','gender_requirement','appearance_performance','languages','accents','skills','scene_references','shoot_dates','location','availability_requirements','other_instructions'],array['age_range','gender_requirement','appearance_performance','languages','accents','skills','scene_references','shoot_dates','location','availability_requirements','other_instructions']),'RESULT_INVALID');
  foreach field in array array['age_range','gender_requirement','appearance_performance','location','availability_requirements','other_instructions'] loop
   perform eps.specs_stage_assert(eps.specs_stage_text(requirements->field,true),'RESULT_INVALID'); end loop;
  foreach field in array array['languages','accents','skills','scene_references','shoot_dates'] loop
   perform eps.specs_stage_assert(eps.specs_stage_strings(requirements->field),'RESULT_INVALID'); end loop;
  for reference in select value from jsonb_array_elements(role_value->'evidence') loop perform eps.specs_stage_reference(reference,p_paragraphs); end loop;
  perform eps.specs_stage_clarifications(role_value->'clarifications',p_paragraphs);
 end loop;
end $$;
-- Byte-identical JSON serialization to the adapter's explicit {index,page,text}
-- projection, not pg-jsonb whitespace/order. Text stays in this private operation.
create function eps.specs_stage_prepared_hash(p_paragraphs jsonb) returns text language sql immutable security invoker set search_path='' as $$
 select encode(sha256(convert_to('{"source_asset_id":null,"paragraphs":['||coalesce(string_agg(
  '{"index":'||(item->>'index')||',"page":null,"text":'||to_json(item->>'text')::text||'}',',' order by ordinal),'')||']}', 'UTF8')),'hex')
 from jsonb_array_elements(p_paragraphs) with ordinality entries(item,ordinal)
$$;
create function eps.specs_stage_metadata(p_value jsonb,p_job eps.jobs,p_paragraphs jsonb) returns void language plpgsql immutable security invoker set search_path='' as $$
declare field text; usage_value jsonb; begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['provider','sdk_version','requested_model','resolved_model','response_id','request_id','correlation_id','input_sha256','prepared_source_sha256','prompt_version','prompt_sha256','schema_version','schema_sha256','provider_schema_sha256','usage'],array['provider','sdk_version','requested_model','resolved_model','response_id','request_id','correlation_id','input_sha256','prepared_source_sha256','prompt_version','prompt_sha256','schema_version','schema_sha256','provider_schema_sha256','usage'])
  and p_value->>'provider'='openai' and p_value->>'sdk_version'='7.45.1' and p_value->>'schema_version'='1.0'
  and p_value->>'input_sha256'=p_job.input_hash and p_value->>'prepared_source_sha256'=eps.specs_stage_prepared_hash(p_paragraphs)
  and p_value->>'requested_model'=p_job.input#>>'{configuration,model_version}'
  and p_value->>'prompt_version'=p_job.input#>>'{configuration,prompt_version}' and p_value->>'correlation_id'=p_job.correlation_id,'RESULT_INVALID');
 perform eps.specs_stage_assert(p_value->>'prompt_version'='spec_extract_v1.0.0'
  and p_value->>'prompt_sha256'='ab03fd026edb3d139fd93fdd51cb475474d6c4e3c8f6395b65014574e7e29eee'
  and p_value->>'schema_sha256'='e8ffee51eee20f687abbfc12c2476248ccb5a59c1122fde418bc89db3ff58085'
  and p_value->>'provider_schema_sha256'='d73a11450f2714c5649ab9a663f0a3483f68feefd1f482bc62575a9a608a1216','RESULT_INVALID');
 foreach field in array array['requested_model','resolved_model','response_id','correlation_id','prompt_version'] loop
  perform eps.specs_stage_assert(jsonb_typeof(p_value->field)='string' and (p_value->>field)~'^[A-Za-z0-9._:-]{1,200}$','RESULT_INVALID'); end loop;
 perform eps.specs_stage_assert(p_value->'request_id'='null' or jsonb_typeof(p_value->'request_id')='string' and (p_value->>'request_id')~'^[A-Za-z0-9._:-]{1,200}$','RESULT_INVALID');
 foreach field in array array['prompt_sha256','schema_sha256','provider_schema_sha256'] loop
  perform eps.specs_stage_assert(jsonb_typeof(p_value->field)='string' and (p_value->>field)~'^[a-f0-9]{64}$','RESULT_INVALID'); end loop;
 usage_value:=p_value->'usage';
 if usage_value<>'null' then
  perform eps.specs_stage_assert(eps.specs_stage_shape(usage_value,array['input_tokens','output_tokens','total_tokens'],array['input_tokens','output_tokens','total_tokens'])
   and eps.specs_stage_integer(usage_value->'input_tokens') and eps.specs_stage_integer(usage_value->'output_tokens') and eps.specs_stage_integer(usage_value->'total_tokens'),'RESULT_INVALID');
 end if;
end $$;
create function eps.specs_stage_error(p_code text,p_retryable boolean default true,p_hint jsonb default null) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$ declare message_value text; retry_value boolean:=false; details jsonb:='{}'; begin
 message_value:=case p_code
  when 'SOURCE_UNREADABLE' then 'The supplied source cannot be read. Replace it or enter its information manually.'
  when 'UNSUPPORTED_FORMAT' then 'This source format is unsupported. Convert it or use manual text entry.'
  when 'RESULT_INVALID' then 'Processing returned an invalid result. The source and existing edits have been preserved.'
  when 'EXTRACTION_REFUSED' then 'Extraction could not complete for this input. Use ordinary editing or another source.'
  when 'PROVIDER_RATE_LIMITED' then 'The processing provider is temporarily rate limited.'
  when 'DEPENDENCY_UNAVAILABLE' then 'A required processing service is temporarily unavailable.'
  when 'LEASE_EXPIRED' then 'The processing lease expired before completion.'
  when 'DISPATCH_UNAVAILABLE' then 'The processing request could not be dispatched.'
  when 'INPUT_CHANGED' then 'The source or working draft changed. Existing edits were preserved.'
  else 'Processing failed. The source and existing edits have been preserved.' end;
 if p_code not in('SOURCE_UNREADABLE','UNSUPPORTED_FORMAT','RESULT_INVALID','EXTRACTION_REFUSED','PROVIDER_RATE_LIMITED','DEPENDENCY_UNAVAILABLE','LEASE_EXPIRED','DISPATCH_UNAVAILABLE','INPUT_CHANGED','PROCESSING_FAILED') then p_code:='PROCESSING_FAILED'; end if;
 retry_value:=p_code in('PROVIDER_RATE_LIMITED','DEPENDENCY_UNAVAILABLE','LEASE_EXPIRED','DISPATCH_UNAVAILABLE') and p_retryable is true;
 if jsonb_typeof(p_hint)='number' and (p_hint::text)::numeric between 0 and 86400 then details:=jsonb_build_object('retry_after_seconds',p_hint); end if;
 return jsonb_build_object('code',p_code,'message',message_value,'details',details,'retryable',retry_value);
end $$;
create function eps.specs_stage_dispatch(p_job eps.jobs) returns void language plpgsql security invoker set search_path='' as $$ declare changed bigint; begin
 insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)
 values(p_job.id,p_job.stage,p_job.input_hash,p_job.dispatch_generation,p_job.id::text||':'||p_job.dispatch_generation,p_job.available_at);
 get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
 perform eps.specs_stage_assert(exists(select 1 from eps.outbox_events where job_id=p_job.id and stage=p_job.stage and input_hash=p_job.input_hash
  and dispatch_generation=p_job.dispatch_generation and dedupe_key=p_job.id::text||':'||p_job.dispatch_generation and available_at=p_job.available_at
  and status='pending' and attempt_count=0 and lease_token_digest is null and lease_expires_at is null and delivered_at is null),'STAGE_STATE_INVALID');
end $$;

create function eps.claim_job_stage(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare job eps.jobs; requested_job uuid; completed jsonb; token_value text; attempts integer; changed bigint; at_value timestamptz; begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','stage','input_hash','workflow_execution_id'],array['job_id','stage','input_hash']));
 perform eps.specs_stage_assert(jsonb_typeof(p_input->'job_id')='string' and (p_input->>'job_id')~'^[a-fA-F0-9-]{36}$'
  and p_input->>'stage' in('prepare_document','extract_specs','apply_specs') and (p_input->>'input_hash')~'^[a-f0-9]{64}$'
  and (not(p_input?'workflow_execution_id') or jsonb_typeof(p_input->'workflow_execution_id')='string' and length(p_input->>'workflow_execution_id') between 1 and 200));
 begin requested_job:=(p_input->>'job_id')::uuid; exception when invalid_text_representation then perform eps.fail('INVALID_REQUEST','Invalid processing job identifier.',400); end;
 job:=eps.specs_stage_lock(requested_job); at_value:=clock_timestamp();
 perform eps.specs_stage_configuration(job.input->'configuration');
 perform eps.specs_stage_assert(job.input_hash=p_input->>'input_hash','INPUT_HASH_MISMATCH');
 perform eps.specs_stage_assert(eps.specs_stage_source_matches(job),'INPUT_CHANGED');
 if job.status='cancelled' or job.cancel_requested_at is not null then perform eps.fail('JOB_CANCELLED','This job has been cancelled.',409); end if;
 select value into completed from jsonb_array_elements(job.completed_stages) where value->>'stage'=p_input->>'stage' and value->>'input_hash'=job.input_hash;
 if completed is not null then return jsonb_build_object('job_id',job.id,'stage',p_input->>'stage','attempt_id',completed->>'attempt_id',
  'lease_token','','lease_expires_at',completed->>'completed_at','already_completed',true,'input',jsonb_build_object('input_hash',job.input_hash,'result_schema',completed->>'result_schema','result',completed->'result')); end if;
 perform eps.specs_stage_assert(job.stage=p_input->>'stage','STAGE_OUT_OF_ORDER');
 if job.status='running' and job.lease_expires_at>at_value then perform eps.fail('JOB_ALREADY_RUNNING','This stage already has an active lease.',409); end if;
 perform eps.specs_stage_assert(job.status in('queued','running') and job.available_at<=at_value,'JOB_NOT_AVAILABLE');
 attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);
 if attempts>=3 then perform eps.fail('RETRY_EXHAUSTED','The bounded stage attempt budget is exhausted.',409); end if;
 token_value:=encode(extensions.gen_random_bytes(32),'hex');
 update eps.jobs set status='running',attempt=attempt+1,current_attempt_id=gen_random_uuid(),lease_token_digest=encode(sha256(convert_to(token_value,'UTF8')),'hex'),
  lease_expires_at=at_value+interval '90 seconds',heartbeat_at=at_value,last_event_sequence=0,stage_attempts=jsonb_set(stage_attempts,array[stage],to_jsonb(attempts+1)),
  progress_completed=0,progress_total=null,error=null,n8n_execution_id=p_input->>'workflow_execution_id',row_version=row_version+1,updated_at=at_value
  where id=job.id and row_version=job.row_version returning * into job;
 get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
 perform eps.specs_stage_assert(job.status='running' and job.stage=p_input->>'stage' and job.input_hash=p_input->>'input_hash'
  and job.current_attempt_id is not null and job.lease_token_digest=encode(sha256(convert_to(token_value,'UTF8')),'hex')
  and job.lease_expires_at=at_value+interval '90 seconds' and eps.specs_stage_source_matches(job),'STAGE_STATE_INVALID');
 return jsonb_build_object('job_id',job.id,'stage',job.stage,'attempt_id',job.current_attempt_id,'lease_token',token_value,'lease_expires_at',job.lease_expires_at,
  'already_completed',false,'input',job.input||jsonb_build_object('input_hash',job.input_hash,'previous_stage_results',job.completed_stages));
end $$;
create function eps.get_specs_stage_input(p_job_id uuid,p_attempt_id uuid,p_lease_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare job eps.jobs; spec eps.specs; prepared eps.specs_stage_payloads; common jsonb; begin
 perform eps.specs_stage_assert(p_job_id is not null and p_attempt_id is not null and length(p_lease_token) between 1 and 1024);
 job:=eps.specs_stage_lock(p_job_id);
 perform eps.specs_stage_configuration(job.input->'configuration');
 perform eps.specs_stage_assert(job.status='running' and job.cancel_requested_at is null and job.current_attempt_id=p_attempt_id and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(job.lease_token_digest=encode(sha256(convert_to(p_lease_token,'UTF8')),'hex'),'LEASE_INVALID');
 perform eps.specs_stage_assert(eps.specs_stage_source_matches(job),'INPUT_CHANGED');
 common:=jsonb_build_object('job_id',job.id,'attempt_id',job.current_attempt_id,'stage',job.stage,'input_hash',job.input_hash,'correlation_id',job.correlation_id);
 select * into strict spec from eps.specs where id=job.resource_id;
 if job.stage='prepare_document' then return common||jsonb_build_object('source_kind','pasted_text','source_asset_id',null,'source_text',spec.source_text,'source_sha256',job.input->>'source_hash','configuration',job.input->'configuration'); end if;
 if job.stage='extract_specs' then
  select * into prepared from eps.specs_stage_payloads where job_id=job.id and stage='prepare_document' and input_hash=job.input_hash;
  perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
  perform eps.specs_stage_assert(prepared.prepared_text=replace(replace(spec.source_text,E'\r\n',E'\n'),E'\r',E'\n')
   and prepared.paragraphs=eps.specs_stage_paragraphs(spec.source_text),'STAGE_STATE_INVALID');
  return common||jsonb_build_object('source_kind','pasted_text','source_asset_id',null,'source_sha256',job.input->>'source_hash','text',prepared.prepared_text,'paragraphs',prepared.paragraphs,'configuration',job.input->'configuration');
 end if;
 if job.stage='apply_specs' then return common||jsonb_build_object('specs_id',job.resource_id,'workspace_id',job.workspace_id,'source_sha256',job.input->>'source_hash','configuration',job.input->'configuration'); end if;
 perform eps.fail('STAGE_OUT_OF_ORDER','This stage is not available.',409);
end $$;

create function eps.record_job_event(p_event jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare job eps.jobs; previous eps.job_events; event_receipt_value jsonb; digest_value text; event_job uuid; event_attempt uuid; event_sequence bigint;
 at_value timestamptz; changed bigint; safe_error jsonb; attempts integer; hint numeric; wait_seconds numeric; body jsonb; spec eps.specs;
 prepared eps.specs_stage_payloads; payload_id uuid; normalized text; prepared_paragraphs_value jsonb; valid_result boolean:=true; schema_name text; completed jsonb; application_result jsonb;
begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_event,array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash','result_schema','result','error'],array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash'])
  and octet_length(p_event::text)<=294912);
 perform eps.specs_stage_assert(jsonb_typeof(p_event->'event_id')='string' and length(p_event->>'event_id') between 1 and 200
  and jsonb_typeof(p_event->'lease_token')='string' and length(p_event->>'lease_token') between 1 and 1024
  and jsonb_typeof(p_event->'job_id')='string' and jsonb_typeof(p_event->'attempt_id')='string'
  and p_event->>'stage' in('prepare_document','extract_specs','apply_specs') and p_event->>'event_type' in('heartbeat','progress','succeeded','failed')
  and (p_event->>'input_hash')~'^[a-f0-9]{64}$' and eps.specs_stage_integer(p_event->'sequence',1));
 begin event_job:=(p_event->>'job_id')::uuid; event_attempt:=(p_event->>'attempt_id')::uuid; exception when invalid_text_representation then perform eps.fail('INVALID_REQUEST','Invalid callback identifiers.',400); end;
 event_sequence:=(p_event->>'sequence')::bigint;
 perform eps.specs_stage_assert(not(p_event?'result_schema') or eps.specs_stage_text(p_event->'result_schema',true));
 if p_event->>'event_type'='succeeded' then
  perform eps.specs_stage_assert(jsonb_typeof(p_event->'result')='object' and jsonb_typeof(p_event->'result_schema')='string' and coalesce(p_event->'error','null')='null');
 elsif p_event->>'event_type'='failed' then
  perform eps.specs_stage_assert(not(p_event?'result') and eps.specs_stage_shape(p_event->'error',array['code','message','details','retryable'],array['code','message','details','retryable'])
   and jsonb_typeof(p_event#>'{error,code}')='string' and length(p_event#>>'{error,code}') between 1 and 200
   and jsonb_typeof(p_event#>'{error,message}')='string' and length(p_event#>>'{error,message}') between 1 and 2000
   and jsonb_typeof(p_event#>'{error,details}')='object' and octet_length((p_event#>'{error,details}')::text)<=16384 and jsonb_typeof(p_event#>'{error,retryable}')='boolean');
 elsif p_event->>'event_type'='heartbeat' then
  perform eps.specs_stage_assert(not(p_event?'result') and not(p_event?'result_schema') and coalesce(p_event->'error','null')='null');
 end if;
 job:=eps.specs_stage_lock(event_job); at_value:=clock_timestamp(); digest_value:=encode(sha256(convert_to(p_event::text,'UTF8')),'hex');
 select * into previous from eps.job_events where job_id=job.id and attempt_id=event_attempt and event_id=p_event->>'event_id';
 if found then
  perform eps.specs_stage_assert(previous.payload_digest=digest_value,'EVENT_ID_CONFLICT');
  return previous.receipt||jsonb_build_object('duplicate',true,'applied',false);
 end if;
 perform eps.specs_stage_assert(not exists(select 1 from eps.job_events where job_id=job.id and attempt_id=event_attempt and sequence=event_sequence),'EVENT_SEQUENCE_CONFLICT');
 event_receipt_value:=jsonb_build_object('event_id',p_event->>'event_id','applied',false,'duplicate',false,'stale',false,'job_status',job.status);
 if job.status<>'running' or job.cancel_requested_at is not null or job.current_attempt_id<>event_attempt or job.stage<>p_event->>'stage' or job.lease_expires_at<=at_value then return event_receipt_value||jsonb_build_object('stale',true); end if;
 perform eps.specs_stage_assert(job.lease_token_digest=encode(sha256(convert_to(p_event->>'lease_token','UTF8')),'hex'),'LEASE_INVALID');
 perform eps.specs_stage_assert(job.input_hash=p_event->>'input_hash','INPUT_HASH_MISMATCH');
 if event_sequence<=job.last_event_sequence then event_receipt_value:=event_receipt_value||jsonb_build_object('stale',true);
 else
  job.last_event_sequence:=event_sequence;
  if p_event->>'event_type'='heartbeat' then job.heartbeat_at:=at_value; job.lease_expires_at:=at_value+interval '90 seconds';
  elsif p_event->>'event_type'='progress' then
   body:=p_event->'result'; perform eps.specs_stage_assert(eps.specs_stage_shape(body,array['progress_completed','progress_total'],array['progress_completed','progress_total'])
    and eps.specs_stage_integer(body->'progress_completed',job.progress_completed) and (body->'progress_total'='null' or eps.specs_stage_integer(body->'progress_total'))
    and not(p_event?'result_schema') and coalesce(p_event->'error','null')='null','INVALID_PROGRESS');
   perform eps.specs_stage_assert(body->'progress_total'='null' or (body->>'progress_total')::bigint>=(body->>'progress_completed')::bigint,'INVALID_PROGRESS');
   job.progress_completed:=(body->>'progress_completed')::bigint; job.progress_total:=(body->>'progress_total')::bigint;
  elsif p_event->>'event_type'='failed' then
   safe_error:=eps.specs_stage_error(p_event#>>'{error,code}',(p_event#>>'{error,retryable}')::boolean,p_event#>'{error,details,retry_after_seconds}');
  else
   body:=p_event->'result'; schema_name:=p_event->>'result_schema';
   begin
    perform eps.specs_stage_assert(eps.specs_stage_source_matches(job),'INPUT_CHANGED');
    perform eps.specs_stage_assert(octet_length(body::text)<=262144,'RESULT_INVALID');
    if job.stage='prepare_document' then
     perform eps.specs_stage_assert(schema_name='document-preparation.v1' and eps.specs_stage_shape(body,array['source_asset_id','text_asset_id','page_assets','paragraph_count','extraction_method','warnings'],array['source_asset_id','text_asset_id','page_assets','paragraph_count','extraction_method','warnings'])
      and body->'source_asset_id'='null' and body->'text_asset_id'='null' and body->'page_assets'='[]' and body->>'extraction_method'='plain_text' and body->'warnings'='[]','RESULT_INVALID');
     select * into strict spec from eps.specs where id=job.resource_id;
     normalized:=replace(replace(spec.source_text,E'\r\n',E'\n'),E'\r',E'\n'); prepared_paragraphs_value:=eps.specs_stage_paragraphs(spec.source_text);
     perform eps.specs_stage_assert(eps.specs_stage_integer(body->'paragraph_count'),'RESULT_INVALID');
     perform eps.specs_stage_assert((body->>'paragraph_count')::bigint=jsonb_array_length(prepared_paragraphs_value),'RESULT_INVALID');
    elsif job.stage='extract_specs' then
     perform eps.specs_stage_assert(schema_name='specs-extraction-stage.v1' and eps.specs_stage_shape(body,array['result','metadata'],array['result','metadata']),'RESULT_INVALID');
     select * into prepared from eps.specs_stage_payloads where job_id=job.id and stage='prepare_document' and input_hash=job.input_hash;
     perform eps.specs_stage_assert(found,'RESULT_INVALID'); perform eps.specs_stage_extract(body->'result',prepared.paragraphs);
     perform eps.specs_stage_metadata(body->'metadata',job,prepared.paragraphs);
    else
     perform eps.specs_stage_assert(schema_name='specs-application.v1' and eps.specs_stage_shape(body,array['specs_id','workspace_id'],array['specs_id','workspace_id'])
      and body->>'specs_id'=job.resource_id::text and body->>'workspace_id'=job.workspace_id::text,'RESULT_INVALID');
     application_result:=eps.specs_stage_apply(job);
    end if;
   exception when raise_exception then
    if sqlerrm in('RESULT_INVALID','SLOT_ALLOCATION_LIMIT_EXCEEDED') then valid_result:=false; safe_error:=eps.specs_stage_error('RESULT_INVALID');
    elsif sqlerrm='INPUT_CHANGED' then valid_result:=false; job.status:='waiting_for_input'; safe_error:=eps.specs_stage_error('INPUT_CHANGED'); else raise; end if;
   end;
   if valid_result then
    if job.stage<>'apply_specs' then
     insert into eps.specs_stage_payloads(job_id,stage,attempt_id,input_hash,result_schema,result,prepared_text,paragraphs)
      values(job.id,job.stage,event_attempt,job.input_hash,schema_name,body,normalized,prepared_paragraphs_value) returning id into payload_id;
     get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
     perform eps.specs_stage_assert(exists(select 1 from eps.specs_stage_payloads where id=payload_id and job_id=job.id and stage=job.stage
      and attempt_id=event_attempt and input_hash=job.input_hash and result_schema=schema_name and result=body
      and prepared_text is not distinct from normalized and specs_stage_payloads.paragraphs is not distinct from prepared_paragraphs_value),'STAGE_STATE_INVALID');
    end if;
    completed:=jsonb_build_object('stage',job.stage,'attempt_id',event_attempt,'input_hash',job.input_hash,'result_schema',schema_name,
     'result',coalesce(application_result,jsonb_build_object('stage_output_id',payload_id)),'completed_at',at_value);
    job.completed_stages:=job.completed_stages||jsonb_build_array(completed);
    if job.stage='apply_specs' then job.status:='succeeded'; job.result:=application_result;
    else job.stage:=case job.stage when 'prepare_document' then 'extract_specs' else 'apply_specs' end;
     job.status:='queued'; job.available_at:=at_value; job.dispatch_generation:=job.dispatch_generation+1;
    end if;
    job.progress_completed:=0; job.progress_total:=null; job.lease_token_digest:=null; job.lease_expires_at:=null;
    if job.status='queued' then perform eps.specs_stage_dispatch(job); end if;
   end if;
  end if;
  if safe_error is not null then
   job.error:=safe_error; job.lease_token_digest:=null; job.lease_expires_at:=null; attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);
   if job.status='waiting_for_input' then null;
   elsif (safe_error->>'retryable')::boolean and attempts<3 then
    hint:=coalesce((safe_error#>>'{details,retry_after_seconds}')::numeric,0);
    wait_seconds:=greatest(hint,least(300,2*power(2,greatest(attempts-1,0))*(0.5+random())));
    job.status:='queued'; job.available_at:=at_value+make_interval(secs=>wait_seconds::double precision); job.dispatch_generation:=job.dispatch_generation+1; perform eps.specs_stage_dispatch(job);
   else
    job.status:='failed';
    if (safe_error->>'retryable')::boolean and attempts>=3 then job.error:=jsonb_build_object('code','RETRY_EXHAUSTED','message','The bounded retry budget for this stage has been exhausted. Existing results were preserved.','details',jsonb_build_object('cause_code',safe_error->>'code'),'retryable',false); end if;
   end if;
  end if;
  update eps.jobs set status=job.status,stage=job.stage,lease_token_digest=job.lease_token_digest,lease_expires_at=job.lease_expires_at,heartbeat_at=job.heartbeat_at,
   last_event_sequence=job.last_event_sequence,completed_stages=job.completed_stages,progress_completed=job.progress_completed,progress_total=job.progress_total,
   error=job.error,result=job.result,available_at=job.available_at,dispatch_generation=job.dispatch_generation,row_version=row_version+1,updated_at=at_value
   where id=job.id and row_version=job.row_version and status='running' and current_attempt_id=event_attempt and lease_expires_at>clock_timestamp();
  get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STALE_STAGE_LEASE');
  job.row_version:=job.row_version+1; job.updated_at:=at_value;
  perform eps.specs_stage_assert((select to_jsonb(current_job)=to_jsonb(job) from eps.jobs current_job where current_job.id=job.id),'STAGE_STATE_INVALID');
  -- Recheck stored principal rather than trusting a JWT or event actor field.
  perform eps.specs_stage_assert(eps.specs_stage_can_write(job.requested_by,job.workspace_id),'CAPABILITY_REQUIRED');
  event_receipt_value:=event_receipt_value||jsonb_build_object('applied',true,'job_status',job.status);
 end if;
 insert into eps.job_events(job_id,attempt_id,event_id,sequence,stage,event_type,payload_digest,receipt)
 values(job.id,event_attempt,p_event->>'event_id',event_sequence,p_event->>'stage',p_event->>'event_type',digest_value,event_receipt_value);
 get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
 perform eps.specs_stage_assert(exists(select 1 from eps.job_events where job_id=job.id and attempt_id=event_attempt and event_id=p_event->>'event_id'
  and sequence=event_sequence and stage=p_event->>'stage' and event_type=p_event->>'event_type' and payload_digest=digest_value
  and job_events.receipt=event_receipt_value),'STAGE_STATE_INVALID'); return event_receipt_value;
end $$;

-- Bounded lease reconciliation. It changes only queue state, never facts or raw
-- source. Explicit requester checks remain required for all input/publication.
create function eps.recover_job_stages(p_limit integer default 25) returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate record; job eps.jobs; changed bigint; recovered integer:=0; at_value timestamptz; attempts integer;
begin
 perform eps.specs_stage_assert(p_limit between 1 and 100);
 for candidate in select id from eps.jobs where status='running' and lease_expires_at<=clock_timestamp() order by lease_expires_at,id limit 1000 loop
  exit when recovered>=p_limit;
  job:=eps.specs_stage_lock(candidate.id,false); at_value:=clock_timestamp();
  if job.status<>'running' or job.lease_expires_at>at_value then continue; end if;
  attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);
  if not eps.specs_stage_can_write(job.requested_by,job.workspace_id) or not eps.specs_stage_source_matches(job) then
   job.status:='waiting_for_input'; job.error:=eps.specs_stage_error('INPUT_CHANGED');
  elsif attempts>=3 then
   job.status:='failed'; job.error:=jsonb_build_object('code','RETRY_EXHAUSTED','message','The bounded retry budget for this stage has been exhausted. Existing results were preserved.','details',jsonb_build_object('cause_code','LEASE_EXPIRED'),'retryable',false);
  else
   job.status:='queued'; job.error:=eps.specs_stage_error('LEASE_EXPIRED'); job.dispatch_generation:=job.dispatch_generation+1;
   job.available_at:=at_value+make_interval(secs=>least(300,2*power(2,greatest(attempts-1,0))*(0.5+random()))::double precision);
  end if;
  update eps.jobs set status=job.status,error=job.error,lease_token_digest=null,lease_expires_at=null,available_at=job.available_at,
   dispatch_generation=job.dispatch_generation,row_version=row_version+1,updated_at=at_value where id=job.id and row_version=job.row_version
   and status='running' and lease_expires_at<=clock_timestamp();
  get diagnostics changed=row_count; perform eps.specs_stage_assert(changed=1,'STAGE_STATE_INVALID');
  if job.status='queued' then perform eps.specs_stage_dispatch(job); end if;
  recovered:=recovered+1;
 end loop;
 return jsonb_build_object('recovered',recovered);
end $$;

-- Exact candidate routines only. No public-schema endpoint or implicit PUBLIC grant.
grant create on schema eps to eps_specs_stage_owner,eps_specs_apply_owner;
do $$ declare routine record; begin
 for routine in select f.oid::regprocedure signature from pg_proc f join pg_namespace n on n.oid=f.pronamespace
  where n.nspname='eps' and (f.proname like 'specs_stage\_%' escape '\' or f.proname in('claim_job_stage','record_job_event','get_specs_stage_input','recover_job_stages')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role,eps_api_owner,eps_jobs_owner,eps_jobs_dispatcher,eps_specs_owner,eps_jobs_executor',routine.signature);
  execute format('alter function %s owner to eps_specs_stage_owner',routine.signature);
 end loop;
end $$;
alter function eps.specs_stage_apply(eps.jobs) owner to eps_specs_apply_owner;
grant execute on function eps.specs_stage_apply(eps.jobs) to eps_specs_stage_owner;
grant execute on function eps.specs_stage_assert(boolean,text),eps.specs_stage_shape(jsonb,text[],text[]),eps.specs_stage_integer(jsonb,bigint,bigint),
 eps.specs_stage_text(jsonb,boolean),eps.specs_stage_strings(jsonb),eps.specs_stage_nonblank(text),eps.specs_stage_can_write(uuid,uuid),eps.specs_stage_source_matches(eps.jobs),
 eps.specs_stage_reference(jsonb,jsonb),eps.specs_stage_clarifications(jsonb,jsonb),eps.specs_stage_extract(jsonb,jsonb),
 eps.specs_stage_prepared_hash(jsonb),eps.specs_stage_metadata(jsonb,eps.jobs,jsonb),eps.specs_stage_paragraphs(text),eps.jobs_hash_v1(jsonb),eps.fail(text,text,integer,bigint)
 to eps_specs_apply_owner;
grant execute on function eps.claim_job_stage(jsonb),eps.record_job_event(jsonb),eps.get_specs_stage_input(uuid,uuid,text),eps.recover_job_stages(integer) to eps_jobs_executor;
grant usage on schema extensions to eps_specs_stage_owner;
grant execute on function extensions.gen_random_bytes(integer) to eps_specs_stage_owner;
revoke create on schema eps from eps_specs_stage_owner,eps_specs_apply_owner;
