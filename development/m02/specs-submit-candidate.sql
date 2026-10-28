-- REVIEW CANDIDATE ONLY. The fixed owned-local harness owns BEGIN/ROLLBACK.
-- No root migration, cloud write, runtime enablement, credentials or service role.
-- Initial pasted text + exact current source/config reuse only. Different-source
-- ordinary correction remains pending immutable internal input retention; this
-- gate is not a product restriction or a source revision-manager feature.
-- Sources: https://supabase.com/docs/guides/database/functions
-- https://www.postgresql.org/docs/17/explicit-locking.html
set local lock_timeout='5s';
set local statement_timeout='30s';
set local search_path='';

do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or current_setting('eps.specs_submit_candidate_rehearsal',true) is distinct from 'rollback-only-v1'
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145']::text[]
  or to_regclass('eps.specs_pipeline_config') is not null
  or exists(select 1 from pg_roles where rolname='eps_specs_submit_owner')
  or exists(select 1 from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace where
    ns.nspname='eps' and proc.proname like 'specs_submit\_%' escape '\' or ns.nspname='public' and proc.proname='eps_submit_specs')
  or exists(select 1 from pg_policy where polname like 'specs_submit\_%' escape '\' or polname like 'eps_specs_submit\_%' escape '\')
 then raise exception 'SPECS_SUBMIT_REVIEWED_NINE_VERSION_ROLLBACK_REQUIRED'; end if;
end $$;

create role eps_specs_submit_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_specs_submit_owner to postgres;
grant authenticated to eps_specs_submit_owner with inherit true,set false,admin false;
grant usage on schema eps,public to eps_specs_submit_owner;

create table eps.specs_pipeline_config (
 id integer primary key check(id=1), enabled boolean not null default false,
 document_preparation_version text, model_version text, prompt_version text, result_schema_version text,
 check(document_preparation_version is null or length(document_preparation_version) between 1 and 200 and document_preparation_version=btrim(document_preparation_version)),
 check(model_version is null or length(model_version) between 1 and 200 and model_version=btrim(model_version)),
 check(prompt_version is null or length(prompt_version) between 1 and 200 and prompt_version=btrim(prompt_version)),
 check(result_schema_version is null or length(result_schema_version) between 1 and 200 and result_schema_version=btrim(result_schema_version)),
 check(not enabled or document_preparation_version is not null and model_version is not null and prompt_version is not null and result_schema_version is not null)
);
comment on table eps.specs_pipeline_config is 'Trusted nonsecret version metadata only. Default disabled; no public writer. One frozen SELECT per submission. Operator pause/inflight fencing is not established by this initial candidate.';
alter table eps.specs_pipeline_config enable row level security;
alter table eps.specs_pipeline_config force row level security;
revoke all on eps.specs_pipeline_config from public,anon,authenticated,service_role,eps_api_owner,eps_specs_owner,eps_specs_initializer,eps_logo_verify_owner,eps_jobs_owner,eps_jobs_dispatcher;
grant select on eps.specs_pipeline_config to eps_specs_submit_owner;
create policy specs_submit_pipeline_read on eps.specs_pipeline_config for select to eps_specs_submit_owner using(id=1);
insert into eps.specs_pipeline_config(id) values(1);

-- New source authority is isolated from the existing manual-edit owner.
grant select on eps.specs to eps_specs_submit_owner;
grant update(source_asset_id,source_text,source_row_version,processing_job_id,row_version,updated_at) on eps.specs to eps_specs_submit_owner;
grant select(id,project_id,archived_at,row_version,draft_revision),update(row_version,draft_revision,has_unpublished_changes,updated_at)
 on eps.workspaces to eps_specs_submit_owner;
grant select(workspace_id) on eps.roles,eps.slots to eps_specs_submit_owner;
grant select(id,workspace_id,kind,resource_id,input,input_hash,dedupe_key,dispatch_generation,requested_by,status,stage,attempt,
 progress_completed,progress_total,batch_id,input_asset_id,error,created_at,updated_at,row_version) on eps.jobs to eps_specs_submit_owner;
grant select(job_id,stage,input_hash,dispatch_generation,dedupe_key,status) on eps.outbox_events to eps_specs_submit_owner;
grant select,insert on eps.idempotency_records to eps_specs_submit_owner;
grant select(id,principal_id,action,resource_id,request_id,client_type),insert on eps.audit_events to eps_specs_submit_owner;
grant execute on function eps.require_capability(text),eps.fail(text,text,integer,bigint),eps.check_input(jsonb,text[]),eps.input_uuid(text),
 eps.expected_version(jsonb,text),eps.idempotency_begin(text,text,jsonb),eps.specs_scope(uuid,boolean),eps.specs_lock_workspace(uuid),
 eps.specs_changed(uuid),eps.specs_assert_rows(bigint,bigint),eps.jobs_dto(uuid),eps.jobs_hash_v1(jsonb),eps.m02_enqueue_specs_job(uuid,jsonb,text)
 to eps_specs_submit_owner;

create policy specs_submit_workspace_read on eps.workspaces for select to eps_specs_submit_owner
 using(archived_at is null and eps.has_capability('workspaces.write') and eps.project_scope(project_id,true));
create policy specs_submit_workspace_update on eps.workspaces for update to eps_specs_submit_owner
 using(archived_at is null and eps.has_capability('workspaces.write') and eps.project_scope(project_id,true))
 with check(archived_at is null and eps.has_capability('workspaces.write') and eps.project_scope(project_id,true));
create policy specs_submit_read on eps.specs for select to eps_specs_submit_owner using(eps.specs_scope(workspace_id,true));
create policy specs_submit_update on eps.specs for update to eps_specs_submit_owner using(eps.specs_scope(workspace_id,true)) with check(eps.specs_scope(workspace_id,true));
create policy specs_submit_roles_read on eps.roles for select to eps_specs_submit_owner using(eps.specs_scope(workspace_id,true));
create policy specs_submit_slots_read on eps.slots for select to eps_specs_submit_owner using(eps.specs_scope(workspace_id,true));
create policy specs_submit_jobs_read on eps.jobs for select to eps_specs_submit_owner using(eps.specs_scope(workspace_id,true));
create policy specs_submit_outbox_read on eps.outbox_events for select to eps_specs_submit_owner
 using(exists(select 1 from eps.jobs visible_job where visible_job.id=outbox_events.job_id and eps.specs_scope(visible_job.workspace_id,true)));
create policy specs_submit_idempotency_read on eps.idempotency_records for select to eps_specs_submit_owner
 using(principal_id=auth.uid() and (
   operation='specs.submit_specs' and exists(select 1 from eps.jobs visible_job where visible_job.id::text=idempotency_records.response->>'job_id' and eps.specs_scope(visible_job.workspace_id,true))
   or operation='jobs.enqueue' and key like 'specs.submit:%' and exists(select 1 from eps.jobs visible_job where visible_job.id::text=idempotency_records.response->>'id' and eps.specs_scope(visible_job.workspace_id,true))));
create policy specs_submit_idempotency_insert on eps.idempotency_records for insert to eps_specs_submit_owner
 with check(principal_id=auth.uid() and operation='specs.submit_specs' and exists(select 1 from eps.jobs visible_job
  where visible_job.id::text=idempotency_records.response->>'job_id' and eps.specs_scope(visible_job.workspace_id,true)));
create policy specs_submit_audit_read on eps.audit_events for select to eps_specs_submit_owner
 using(principal_id=auth.uid() and (action='jobs.enqueue' and exists(select 1 from eps.jobs visible_job where visible_job.id=audit_events.resource_id and eps.specs_scope(visible_job.workspace_id,true))
  or action='specs.submit_specs' and exists(select 1 from eps.specs visible_spec where visible_spec.id=audit_events.resource_id and eps.specs_scope(visible_spec.workspace_id,true))));
create policy specs_submit_audit_insert on eps.audit_events for insert to eps_specs_submit_owner
 with check(principal_id=auth.uid() and action='specs.submit_specs' and exists(select 1 from eps.specs visible_spec
  where visible_spec.id=audit_events.resource_id and eps.specs_scope(visible_spec.workspace_id,true)));
create policy eps_specs_submit_no_objects on storage.objects as restrictive for all to eps_specs_submit_owner using(false) with check(false);
create policy eps_specs_submit_no_buckets on storage.buckets as restrictive for all to eps_specs_submit_owner using(false) with check(false);

create function eps.specs_submit_text(p_text text) returns void language plpgsql immutable security invoker set search_path='' as $$
declare whitespace text:=E' \t\n\r'||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279);
begin
 if p_text is null or length(btrim(p_text,whitespace))=0 then perform eps.fail('INVALID_REQUEST','Provide nonempty source text.',400); end if;
 if p_text ~ ('['||chr(1)||'-'||chr(8)||chr(11)||chr(12)||chr(14)||'-'||chr(31)||']') then
  perform eps.fail('INVALID_REQUEST','Source text contains unsupported control characters.',400);
 end if;
 -- Validation never normalizes, trims or rewrites the original text.
end $$;

create function eps.specs_submit_ack(p_job uuid,p_spec uuid,p_workspace uuid) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare dto jsonb; begin
 dto:=eps.jobs_dto(p_job);
 if dto is null or dto->>'id' is distinct from p_job::text or dto->>'workspace_id' is distinct from p_workspace::text
  or dto->>'resource_id' is distinct from p_spec::text or dto->>'kind' is distinct from 'specs_extract'
  or dto->>'status' is null or dto->>'status' not in('queued','running','waiting_for_input','succeeded','failed','cancelled')
 then perform eps.fail('SPECS_STATE_INVALID','The source processing job could not be confirmed.',409); end if;
 return jsonb_build_object('job_id',p_job,'resource_id',p_spec,'poll_url','/api/v1/jobs/'||p_job::text,'status',dto->>'status');
end $$;

create function eps.specs_submit_remember(p_key text,p_payload jsonb,p_response jsonb) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare changed bigint; expected_hash text:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'); begin
 insert into eps.idempotency_records(principal_id,operation,key,request_hash,response)
  values(auth.uid(),'specs.submit_specs',p_key,expected_hash,p_response);
 get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
 if (select count(*) from eps.idempotency_records receipt where receipt.principal_id=auth.uid() and receipt.operation='specs.submit_specs'
  and receipt.key=p_key and receipt.request_hash=expected_hash and receipt.response=p_response)<>1
 then perform eps.fail('SPECS_STATE_INVALID','The source acknowledgement was not stored completely.',409); end if;
 return p_response;
end $$;

create function eps.specs_submit_audit(p_spec uuid) returns void language plpgsql volatile security invoker set search_path='' as $$
declare headers jsonb:='{}'; trace_request_id text; declared_client_type text; changed bigint; event_id uuid; begin
 begin headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb; exception when invalid_text_representation then headers:='{}'; end;
 if jsonb_typeof(headers) is distinct from 'object' then headers:='{}'; end if;
 trace_request_id:=headers->>'x-eps-request-id'; if trace_request_id is not null and trace_request_id!~'^[A-Za-z0-9._:-]{1,128}$' then trace_request_id:=null; end if;
 declared_client_type:=headers->>'x-eps-client-type'; if declared_client_type is null or declared_client_type not in('browser','api','mcp') then declared_client_type:='api'; end if;
 insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type)
  values(auth.uid(),'specs.submit_specs',p_spec,trace_request_id,declared_client_type) returning id into event_id;
 get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
 if not exists(select 1 from eps.audit_events event where event.id=event_id and event.principal_id=auth.uid() and event.action='specs.submit_specs'
  and event.resource_id=p_spec and event.request_id is not distinct from trace_request_id and event.client_type=declared_client_type)
 then perform eps.fail('SPECS_STATE_INVALID','The source audit was not stored completely.',409); end if;
end $$;

create function public.eps_submit_specs(p_workspace_id uuid,p_input jsonb,p_idempotency_key text default null) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare spec_row eps.specs; config_row eps.specs_pipeline_config; workspace_row record; current_job record;
 payload jsonb; configuration jsonb; frozen jsonb; dto jsonb; response jsonb; cached jsonb;
 submitted_text text; source_hash text; internal_key text; accepted_job_id uuid; changed bigint;
begin
 perform set_config('eps.jobs.mode','user',true);
 perform eps.require_capability('workspaces.write');
 perform eps.check_input(p_input,array['source_asset_id','source_text','row_version']);
 if octet_length(p_input::text)>65536 or (p_input?'source_asset_id')=(p_input?'source_text')
 then perform eps.fail('INVALID_REQUEST','Provide exactly one bounded source asset or pasted text.',400); end if;
 if p_input?'source_text' then
  if jsonb_typeof(p_input->'source_text') is distinct from 'string' then perform eps.fail('INVALID_REQUEST','Provide source text.',400); end if;
  submitted_text:=p_input->>'source_text'; perform eps.specs_submit_text(submitted_text);
 else
  if jsonb_typeof(p_input->'source_asset_id') is distinct from 'string' or length(p_input->>'source_asset_id') not between 1 and 200
  then perform eps.fail('INVALID_REQUEST','Provide a bounded source asset identifier.',400); end if;
  perform eps.input_uuid(p_input->>'source_asset_id');
 end if;
 if p_input?'row_version' then perform eps.expected_version(p_input); end if;
 if p_idempotency_key is null then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key is required.',400); end if;
 if length(p_idempotency_key) not between 16 and 200 then perform eps.fail('INVALID_REQUEST','Provide an Idempotency-Key of 16 to 200 characters.',400); end if;
 if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 payload:=jsonb_build_object('id',p_workspace_id,'input',p_input);
 -- Own this actor's exact request lock before any resource lock. Calling the
 -- shared idempotency helper later reacquires only this already-owned lock.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':specs.submit_specs:'||p_idempotency_key,0));
 perform eps.specs_lock_workspace(p_workspace_id);
 select * into spec_row from eps.specs source where source.workspace_id=p_workspace_id for update;
 if not found then perform eps.fail('SPECS_STATE_INVALID','The workspace source record is missing.',409); end if;
 perform eps.require_capability('workspaces.write');
 if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 if p_input?'source_asset_id' then perform eps.fail('FEATURE_NOT_IMPLEMENTED','File specs submission needs purpose-aware private storage. Existing work was kept.',503); end if;
 -- SELECT-only trusted metadata: no UPDATE grant or unproved pause fence.
 select * into config_row from eps.specs_pipeline_config configuration_row where configuration_row.id=1;
 if not found or not config_row.enabled then perform eps.fail('DEPENDENCY_UNAVAILABLE','Specs processing is not ready. The source and existing draft were kept.',503); end if;
 configuration:=jsonb_build_object('document_preparation_version',config_row.document_preparation_version,'model_version',config_row.model_version,
  'prompt_version',config_row.prompt_version,'result_schema_version',config_row.result_schema_version);
 cached:=eps.idempotency_begin('specs.submit_specs',p_idempotency_key,payload);
 perform eps.require_capability('workspaces.write');
 if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 if cached is not null then return cached; end if;
 if p_input?'row_version' then
  if eps.expected_version(p_input)<>spec_row.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Specs changed.',409,spec_row.row_version); end if;
 elsif spec_row.row_version<>1 or spec_row.source_row_version<>1 or spec_row.source_asset_id is not null or spec_row.source_text is not null
  or spec_row.normalized_instructions is not null or spec_row.clarifications<>'[]'::jsonb or spec_row.source_extraction is not null
  or spec_row.source_language_codes<>array[]::text[] or spec_row.processing_job_id is not null
  or exists(select 1 from eps.roles role where role.workspace_id=p_workspace_id) or exists(select 1 from eps.slots slot where slot.workspace_id=p_workspace_id)
 then perform eps.fail('INVALID_REQUEST','Provide the current Spec.row_version for this non-pristine source.',400); end if;
 source_hash:=encode(sha256(convert_to(submitted_text,'UTF8')),'hex');
 if spec_row.source_text is not null or spec_row.source_asset_id is not null then
  if spec_row.source_asset_id is not null or spec_row.source_text is distinct from submitted_text then
   perform eps.fail('FEATURE_NOT_IMPLEMENTED','Replacing an existing original source needs immutable input retention. Existing source and working edits were kept.',503);
  end if;
  select job.id,job.workspace_id,job.kind,job.resource_id,job.input,job.input_hash into current_job from eps.jobs job where job.id=spec_row.processing_job_id;
  if not found or current_job.workspace_id<>p_workspace_id or current_job.resource_id<>spec_row.id or current_job.kind<>'specs_extract'
   or current_job.input->>'schema_version' is distinct from '1.0' or current_job.input->>'specs_id' is distinct from spec_row.id::text
   or current_job.input->>'source_hash' is distinct from source_hash or current_job.input->'source_row_version' is distinct from to_jsonb(spec_row.source_row_version)
   or current_job.input_hash is distinct from eps.jobs_hash_v1(current_job.input)
  then perform eps.fail('SPECS_STATE_INVALID','The current source job does not match this source and workspace.',409); end if;
  if current_job.input->'configuration' is distinct from configuration then
   perform eps.fail('FEATURE_NOT_IMPLEMENTED','Reprocessing with changed configuration needs the retained-input boundary. Existing source and working edits were kept.',503);
  end if;
  response:=eps.specs_submit_ack(current_job.id,spec_row.id,p_workspace_id);
  perform eps.require_capability('workspaces.write');
  if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  return eps.specs_submit_remember(p_idempotency_key,payload,response);
 end if;
 if spec_row.source_extraction is not null or spec_row.source_language_codes<>array[]::text[] or spec_row.processing_job_id is not null or spec_row.source_row_version<>1 then
  perform eps.fail('SPECS_STATE_INVALID','Existing source provenance cannot be replaced by this initial submission.',409);
 end if;
 select row_version,draft_revision into workspace_row from eps.workspaces workspace where workspace.id=p_workspace_id;
 if spec_row.row_version>=9007199254740991 or workspace_row.row_version>=9007199254740991 or workspace_row.draft_revision>=9007199254740991 then
  perform eps.fail('SPECS_STATE_INVALID','The source or workspace version limit has been reached.',409);
 end if;
 update eps.specs source set source_asset_id=null,source_text=submitted_text,source_row_version=spec_row.source_row_version+1,
  row_version=spec_row.row_version+1,processing_job_id=null,updated_at=clock_timestamp()
  where source.id=spec_row.id and source.row_version=spec_row.row_version and source.source_row_version=spec_row.source_row_version;
 get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
 perform eps.specs_changed(p_workspace_id);
 if not exists(select 1 from eps.workspaces workspace where workspace.id=p_workspace_id and workspace.row_version=workspace_row.row_version+1 and workspace.draft_revision=workspace_row.draft_revision+1)
 then perform eps.fail('SPECS_STATE_INVALID','The workspace source revision was not stored completely.',409); end if;
 frozen:=jsonb_build_object('schema_version','1.0','specs_id',spec_row.id,'source_hash',source_hash,
  'source_row_version',spec_row.source_row_version+1,'workspace_row_version',workspace_row.row_version+1,'configuration',configuration);
 internal_key:='specs.submit:'||encode(sha256(convert_to(p_idempotency_key,'UTF8')),'hex');
 dto:=eps.m02_enqueue_specs_job(p_workspace_id,frozen,internal_key);
 accepted_job_id:=eps.input_uuid(dto->>'id');
 if dto->>'workspace_id' is distinct from p_workspace_id::text or dto->>'resource_id' is distinct from spec_row.id::text or dto->>'status' is distinct from 'queued'
  or not exists(select 1 from eps.jobs job where job.id=accepted_job_id and job.workspace_id=p_workspace_id and job.resource_id=spec_row.id and job.kind='specs_extract'
   and job.requested_by=auth.uid() and job.input=frozen and job.input_hash=eps.jobs_hash_v1(frozen) and job.status='queued' and job.stage='prepare_document' and job.attempt=0 and job.dispatch_generation=1)
  or (select count(*) from eps.outbox_events event where event.job_id=accepted_job_id and event.input_hash=eps.jobs_hash_v1(frozen) and event.stage='prepare_document'
   and event.dispatch_generation=1 and event.dedupe_key=accepted_job_id::text||':1' and event.status='pending')<>1
  or (select count(*) from eps.audit_events event where event.principal_id=auth.uid() and event.action='jobs.enqueue' and event.resource_id=accepted_job_id)<>1
  or (select count(*) from eps.idempotency_records receipt where receipt.principal_id=auth.uid() and receipt.operation='jobs.enqueue' and receipt.key=internal_key
   and receipt.request_hash=encode(sha256(convert_to(jsonb_build_object('workspace_id',p_workspace_id,'input',frozen)::text,'UTF8')),'hex') and receipt.response=dto)<>1
 then perform eps.fail('SPECS_STATE_INVALID','The source job, dispatch and receipt were not stored completely.',409); end if;
 update eps.specs source set processing_job_id=accepted_job_id where source.id=spec_row.id and source.row_version=spec_row.row_version+1
  and source.source_row_version=spec_row.source_row_version+1 and source.processing_job_id is null and source.source_text=submitted_text;
 get diagnostics changed=row_count; perform eps.specs_assert_rows(changed,1);
 if not exists(select 1 from eps.specs source where source.id=spec_row.id and source.source_text=submitted_text and source.source_asset_id is null
  and source.source_row_version=spec_row.source_row_version+1 and source.row_version=spec_row.row_version+1 and source.processing_job_id=accepted_job_id
  and source.normalized_instructions is not distinct from spec_row.normalized_instructions and source.clarifications=spec_row.clarifications
  and source.source_extraction is not distinct from spec_row.source_extraction and source.source_language_codes=spec_row.source_language_codes)
 then perform eps.fail('SPECS_STATE_INVALID','The source and processing pointer were not stored completely.',409); end if;
 response:=eps.specs_submit_ack(accepted_job_id,spec_row.id,p_workspace_id);
 perform eps.specs_submit_remember(p_idempotency_key,payload,response);
 perform eps.specs_submit_audit(spec_row.id);
 perform eps.require_capability('workspaces.write');
 if not eps.specs_scope(p_workspace_id,true) then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
 return response;
end $$;

grant create on schema eps,public to eps_specs_submit_owner;
do $$ declare routine record; begin
 for routine in select proc.oid::regprocedure signature from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace where
   ns.nspname='eps' and proc.proname like 'specs_submit\_%' escape '\' or ns.nspname='public' and proc.proname='eps_submit_specs' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role,eps_api_owner,eps_specs_owner,eps_specs_initializer,eps_logo_verify_owner,eps_jobs_owner,eps_jobs_dispatcher',routine.signature);
  execute format('alter function %s owner to eps_specs_submit_owner',routine.signature);
 end loop;
end $$;
grant execute on function public.eps_submit_specs(uuid,jsonb,text) to authenticated;
revoke create on schema eps,public from eps_specs_submit_owner;
