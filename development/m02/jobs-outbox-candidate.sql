-- M02 LOCAL REVIEW CANDIDATE ONLY. Not a released migration; execute ONLY inside
-- the integration owner's guarded five-migration local rollback rehearsal.
-- No source/provider/media/user fixtures, credentials or runtime enablement.
set local lock_timeout='3s';
set local statement_timeout='30s';
set local search_path='';
do $$ begin
  if current_user<>'postgres' or current_database()<>'postgres'
    or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
    or (select array_agg(version order by version) from supabase_migrations.schema_migrations)
      is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515']::text[]
    or to_regclass('eps.jobs') is not null or to_regclass('eps.job_events') is not null or to_regclass('eps.outbox_events') is not null
    or exists(select 1 from pg_roles where rolname in('eps_jobs_owner','eps_jobs_dispatcher'))
  then raise exception 'M02_OWNED_LOCAL_FIVE_MIGRATION_CANDIDATE_REQUIRED'; end if;
end $$;

create role eps_jobs_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
create role eps_jobs_dispatcher nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_jobs_owner,eps_jobs_dispatcher to postgres;
grant authenticated to eps_jobs_owner with inherit true,set false,admin false;
grant usage on schema eps,public,extensions to eps_jobs_owner;
grant usage on schema eps to eps_jobs_dispatcher;

create table eps.jobs (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references eps.workspaces(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  kind text not null check(kind='specs_extract'), resource_id uuid not null,
  input_asset_id uuid references eps.media_assets(id) on delete restrict, batch_id uuid,
  input jsonb not null check(jsonb_typeof(input)='object' and octet_length(input::text)<=65536),
  input_hash text not null check(input_hash~'^[a-f0-9]{64}$'),
  input_hash_version text not null default 'eps.specs-input.pg-jsonb.v1' check(input_hash_version='eps.specs-input.pg-jsonb.v1'),
  dedupe_key text not null unique check(dedupe_key~'^[a-f0-9]{64}$'),
  status text not null default 'queued' check(status in('queued','running','waiting_for_input','succeeded','failed','cancelled')),
  stage text not null default 'prepare_document' check(stage in('prepare_document','extract_specs','apply_specs')),
  attempt integer not null default 0 check(attempt>=0), current_attempt_id uuid,
  lease_token_digest text check(lease_token_digest~'^[a-f0-9]{64}$'), lease_expires_at timestamptz, heartbeat_at timestamptz,
  last_event_sequence bigint not null default 0 check(last_event_sequence between 0 and 9007199254740991),
  stage_attempts jsonb not null default '{}' check(jsonb_typeof(stage_attempts)='object'),
  completed_stages jsonb not null default '[]' check(jsonb_typeof(completed_stages)='array'),
  progress_completed bigint not null default 0 check(progress_completed between 0 and 9007199254740991),
  progress_total bigint check(progress_total between progress_completed and 9007199254740991),
  result jsonb check(result is null or jsonb_typeof(result)='object'), error jsonb check(error is null or jsonb_typeof(error)='object'),
  available_at timestamptz not null default clock_timestamp(), cancel_requested_at timestamptz,
  dispatch_generation bigint not null default 1 check(dispatch_generation between 1 and 9007199254740991),
  correlation_id text not null check(correlation_id~'^[A-Za-z0-9._:-]{1,128}$'), n8n_execution_id text,
  created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),
  check((lease_token_digest is null)=(lease_expires_at is null)),
  check(status<>'running' or current_attempt_id is not null and lease_token_digest is not null)
);
create index jobs_workspace_status_id on eps.jobs(workspace_id,status,id);
create index jobs_expired_stage on eps.jobs(lease_expires_at,id) where status='running';
create table eps.job_events (
  job_id uuid not null references eps.jobs(id) on delete restrict, attempt_id uuid not null,
  event_id text not null check(length(event_id) between 1 and 200), sequence bigint not null check(sequence between 1 and 9007199254740991),
  stage text not null check(stage in('prepare_document','extract_specs','apply_specs')),
  event_type text not null check(event_type in('heartbeat','progress','succeeded','failed')),
  payload_digest text not null check(payload_digest~'^[a-f0-9]{64}$'), receipt jsonb not null check(jsonb_typeof(receipt)='object'),
  created_at timestamptz not null default clock_timestamp(), primary key(job_id,attempt_id,event_id), unique(job_id,attempt_id,sequence)
);
create table eps.outbox_events (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references eps.jobs(id) on delete restrict,
  topic text not null default 'jobs.stage.ready' check(topic='jobs.stage.ready'),
  stage text not null check(stage in('prepare_document','extract_specs','apply_specs')),
  input_hash text not null check(input_hash~'^[a-f0-9]{64}$'), dispatch_generation bigint not null check(dispatch_generation between 1 and 9007199254740991),
  dedupe_key text not null unique, status text not null default 'pending' check(status in('pending','leased','delivered','dead')),
  attempt_count integer not null default 0 check(attempt_count between 0 and 5), available_at timestamptz not null default clock_timestamp(),
  lease_token_digest text check(lease_token_digest~'^[a-f0-9]{64}$'), lease_expires_at timestamptz, delivered_at timestamptz,
  last_error jsonb check(last_error is null or jsonb_typeof(last_error)='object'), created_at timestamptz not null default clock_timestamp(),
  check(dedupe_key=job_id::text||':'||dispatch_generation::text),
  check(status<>'leased' or lease_token_digest is not null and lease_expires_at is not null),
  check(status in('leased','delivered') or lease_token_digest is null and lease_expires_at is null),
  check((status='delivered')=(delivered_at is not null))
);
create index outbox_pending_available on eps.outbox_events(available_at,id) where status='pending';
create index outbox_expired_dispatch on eps.outbox_events(lease_expires_at,id) where status='leased';
alter table eps.jobs enable row level security; alter table eps.jobs force row level security;
alter table eps.job_events enable row level security; alter table eps.job_events force row level security;
alter table eps.outbox_events enable row level security; alter table eps.outbox_events force row level security;
revoke all on eps.jobs,eps.job_events,eps.outbox_events from public,anon,authenticated,service_role,eps_api_owner,eps_jobs_dispatcher;
grant select,insert,update on eps.jobs,eps.outbox_events to eps_jobs_owner;
grant select on eps.job_events to eps_jobs_owner;
grant select(id,project_id,archived_at,row_version) on eps.workspaces to eps_jobs_owner;
grant select,insert on eps.idempotency_records to eps_jobs_owner;
grant insert on eps.audit_events to eps_jobs_owner;
grant execute on function eps.has_capability(text),eps.project_scope(uuid,boolean),eps.require_capability(text),eps.fail(text,text,integer,bigint),
  eps.check_input(jsonb,text[]),eps.expected_version(jsonb,text),eps.idempotency_begin(text,text,jsonb),eps.finish_mutation(text,text,jsonb,jsonb,uuid) to eps_jobs_owner;
create policy jobs_workspace_identity on eps.workspaces for select to eps_jobs_owner
  using(archived_at is null and eps.project_scope(project_id,false) and (eps.has_capability('workspaces.read') or eps.has_capability('workspaces.write') or eps.has_capability('operations.read') or eps.has_capability('operations.retry')));
create function eps.jobs_can_access(p_workspace uuid,p_action text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from eps.workspaces workspace join public.projects project on project.id=workspace.project_id
    where workspace.id=p_workspace and workspace.archived_at is null and project.archived_at is null
      and eps.project_scope(project.id,p_action in('enqueue','operate'))
      and case p_action when 'read' then eps.has_capability('workspaces.read') or eps.has_capability('operations.read')
        when 'enqueue' then eps.has_capability('workspaces.write') when 'operate' then eps.has_capability('operations.retry') else false end)
$$;
create function eps.jobs_dispatch_mode() returns boolean language sql stable security invoker set search_path='' as $$
  select current_setting('eps.jobs.mode',true)='dispatcher'
$$;
create policy jobs_read on eps.jobs for select to eps_jobs_owner using(eps.jobs_dispatch_mode() or eps.jobs_can_access(workspace_id,'read') or eps.jobs_can_access(workspace_id,'enqueue') or eps.jobs_can_access(workspace_id,'operate'));
create policy jobs_insert on eps.jobs for insert to eps_jobs_owner with check(not eps.jobs_dispatch_mode() and requested_by=auth.uid() and eps.jobs_can_access(workspace_id,'enqueue')
  and status='queued' and stage='prepare_document' and attempt=0 and current_attempt_id is null and lease_token_digest is null and dispatch_generation=1);
create policy jobs_update on eps.jobs for update to eps_jobs_owner using(eps.jobs_dispatch_mode() or eps.jobs_can_access(workspace_id,'operate'))
  with check(eps.jobs_dispatch_mode() or eps.jobs_can_access(workspace_id,'operate'));
create policy job_events_read on eps.job_events for select to eps_jobs_owner using(exists(select 1 from eps.jobs job where job.id=job_id));
create policy outbox_read on eps.outbox_events for select to eps_jobs_owner using(eps.jobs_dispatch_mode() or exists(select 1 from eps.jobs job where job.id=job_id));
create policy outbox_insert on eps.outbox_events for insert to eps_jobs_owner with check(eps.jobs_dispatch_mode() or exists(select 1 from eps.jobs job where job.id=job_id and (eps.jobs_can_access(job.workspace_id,'enqueue') or eps.jobs_can_access(job.workspace_id,'operate'))));
create policy outbox_update on eps.outbox_events for update to eps_jobs_owner using(eps.jobs_dispatch_mode()) with check(eps.jobs_dispatch_mode());
create policy jobs_idempotency on eps.idempotency_records for all to eps_jobs_owner using(principal_id=auth.uid() and operation in('jobs.enqueue','jobs.retry','jobs.cancel'))
  with check(principal_id=auth.uid() and operation in('jobs.enqueue','jobs.retry','jobs.cancel'));
create policy jobs_audit on eps.audit_events for insert to eps_jobs_owner with check(principal_id=auth.uid() and action in('jobs.enqueue','jobs.retry','jobs.cancel'));
-- Auth inheritance must not create Storage authority for the new function owner.
create policy eps_jobs_no_objects on storage.objects as restrictive for all to eps_jobs_owner,eps_jobs_dispatcher using(false) with check(false);
create policy eps_jobs_no_buckets on storage.buckets as restrictive for all to eps_jobs_owner,eps_jobs_dispatcher using(false) with check(false);

create function eps.jobs_dto(p_job uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',id,'workspace_id',workspace_id,'kind',kind,'status',status,'stage',stage,'attempt',attempt,
    'progress_completed',progress_completed,'progress_total',progress_total,'batch_id',batch_id,'input_asset_id',input_asset_id,'resource_id',resource_id,
    'error',error,'created_at',created_at,'updated_at',updated_at,'row_version',row_version) from eps.jobs where id=p_job
$$;
create function eps.jobs_remember(p_operation text,p_key text,p_input jsonb,p_response jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$ begin
  insert into eps.idempotency_records(principal_id,operation,key,request_hash,response) values(auth.uid(),p_operation,p_key,encode(sha256(convert_to(p_input::text,'UTF8')),'hex'),p_response);
  return p_response;
end $$;
create function eps.jobs_hash_v1(p_input jsonb) returns text language sql immutable security invoker set search_path='' as $$
  select encode(sha256(convert_to('eps.specs-input.pg-jsonb.v1:'||p_input::text,'UTF8')),'hex')
$$;
create function eps.jobs_add_dispatch(p_job eps.jobs) returns void language sql security invoker set search_path='' as $$
  insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)
    values((p_job).id,(p_job).stage,(p_job).input_hash,(p_job).dispatch_generation,(p_job).id::text||':'||(p_job).dispatch_generation::text,(p_job).available_at)
$$;

-- INTERNAL ONLY: no user/API-owner EXECUTE grant until submit_specs exists and
-- locks/validates the actual specs/source records in this same transaction.
create function eps.m02_enqueue_specs_job(p_workspace_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare job eps.jobs; payload jsonb; response jsonb; fingerprint text; dedupe text; source uuid; workspace_version bigint; version bigint; item text; headers jsonb; correlation text;
begin
  perform set_config('eps.jobs.mode','user',true); perform eps.require_capability('workspaces.write');
  if not eps.jobs_can_access(p_workspace_id,'enqueue') then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  perform eps.check_input(p_input,array['schema_version','specs_id','source_hash','source_row_version','workspace_row_version','configuration']);
  if p_input->>'schema_version' is distinct from '1.0' or jsonb_typeof(p_input->'specs_id') is distinct from 'string'
    or jsonb_typeof(p_input->'source_hash') is distinct from 'string' or p_input->>'source_hash'!~'^[a-f0-9]{64}$'
  then perform eps.fail('INVALID_REQUEST','Invalid frozen specs references.',400); end if;
  begin source:=(p_input->>'specs_id')::uuid; exception when others then perform eps.fail('INVALID_REQUEST','Invalid specs identity.',400); end;
  foreach item in array array['source_row_version','workspace_row_version'] loop
    if jsonb_typeof(p_input->item) is distinct from 'number' or (p_input->item)::text!~'^[1-9][0-9]{0,15}$' or (p_input->>item)::numeric>9007199254740991
    then perform eps.fail('INVALID_REQUEST','Invalid source/workspace version.',400); end if;
  end loop;
  perform eps.check_input(p_input->'configuration',array['document_preparation_version','model_version','prompt_version','result_schema_version']);
  foreach item in array array['document_preparation_version','model_version','prompt_version','result_schema_version'] loop
    if jsonb_typeof(p_input->'configuration'->item) is distinct from 'string' or length(p_input->'configuration'->>item) not between 1 and 200
    then perform eps.fail('INVALID_REQUEST','Versioned processing configuration is required.',400); end if;
  end loop;
  if p_idempotency_key is null then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key required.',400); end if;
  payload:=jsonb_build_object('workspace_id',p_workspace_id,'input',p_input);
  response:=eps.idempotency_begin('jobs.enqueue',p_idempotency_key,payload); if response is not null then return response; end if;
  select row_version into workspace_version from eps.workspaces where id=p_workspace_id;
  version:=(p_input->>'workspace_row_version')::bigint;
  if workspace_version is distinct from version then perform eps.fail('STALE_RESOURCE_VERSION','Workspace changed.',409,workspace_version); end if;
  fingerprint:=eps.jobs_hash_v1(p_input); dedupe:=encode(sha256(convert_to('specs_extract:'||p_workspace_id::text||':'||fingerprint,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended('eps:jobs:dedupe:'||dedupe,0));
  select * into job from eps.jobs existing where existing.dedupe_key=dedupe;
  if found then return eps.jobs_remember('jobs.enqueue',p_idempotency_key,payload,eps.jobs_dto(job.id)); end if;
  begin headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb; exception when others then headers:='{}'; end;
  correlation:=headers->>'x-eps-request-id'; if correlation is null or correlation!~'^[A-Za-z0-9._:-]{1,128}$' then correlation:=gen_random_uuid()::text; end if;
  insert into eps.jobs(workspace_id,requested_by,kind,resource_id,input,input_hash,dedupe_key,correlation_id)
    values(p_workspace_id,auth.uid(),'specs_extract',source,p_input,fingerprint,dedupe,correlation) returning * into job;
  perform eps.jobs_add_dispatch(job);
  return eps.finish_mutation('jobs.enqueue',p_idempotency_key,payload,eps.jobs_dto(job.id),job.id);
end $$;

create function public.eps_get_job(p_job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare response jsonb; begin
  perform set_config('eps.jobs.mode','user',true);
  if auth.uid() is null then perform eps.fail('AUTH_REQUIRED','Sign in.',401); end if;
  if not(eps.has_capability('workspaces.read') or eps.has_capability('operations.read')) then perform eps.fail('CAPABILITY_REQUIRED','Job read capability required.',403); end if;
  select eps.jobs_dto(id) into response from eps.jobs where id=p_job_id and eps.jobs_can_access(workspace_id,'read');
  if response is null then perform eps.fail('RESOURCE_NOT_FOUND','Job not found.',404); end if; return response;
end $$;
create function public.eps_list_jobs(p_workspace_id uuid default null,p_status text default null,p_cursor uuid default null,p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$ declare items jsonb[]; begin
  perform set_config('eps.jobs.mode','user',true);
  if auth.uid() is null then perform eps.fail('AUTH_REQUIRED','Sign in.',401); end if;
  if not(eps.has_capability('workspaces.read') or eps.has_capability('operations.read')) then perform eps.fail('CAPABILITY_REQUIRED','Job read capability required.',403); end if;
  if p_limit is null or p_limit not between 1 and 100 or p_status is not null and p_status not in('queued','running','waiting_for_input','succeeded','failed','cancelled')
  then perform eps.fail('INVALID_REQUEST','Invalid jobs filter.',400); end if;
  select coalesce(array_agg(dto order by id),array[]::jsonb[]) into items from
    (select id,eps.jobs_dto(id) dto from eps.jobs where (p_workspace_id is null or workspace_id=p_workspace_id) and (p_status is null or status=p_status)
      and (p_cursor is null or id>p_cursor) and eps.jobs_can_access(workspace_id,'read') order by id limit p_limit+1) page;
  return jsonb_build_object('data',to_jsonb(items[1:p_limit]),'page',jsonb_build_object('next_cursor',case when cardinality(items)>p_limit then items[p_limit]->>'id' else null end));
end $$;

create function public.eps_retry_job(p_job_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare job eps.jobs; payload jsonb; response jsonb; expected bigint; changed integer; begin
  perform set_config('eps.jobs.mode','user',true); perform eps.require_capability('operations.retry'); perform eps.check_input(p_input,array['row_version','reason']); expected:=eps.expected_version(p_input);
  if p_input?'reason' and jsonb_typeof(p_input->'reason') not in('null','string') then perform eps.fail('INVALID_REQUEST','Reason must be text or null.',400); end if;
  select * into job from eps.jobs where id=p_job_id and eps.jobs_can_access(workspace_id,'operate') for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Operable job not found.',404); end if;
  if p_idempotency_key is null then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key required.',400); end if;
  payload:=jsonb_build_object('id',p_job_id,'input',p_input); response:=eps.idempotency_begin('jobs.retry',p_idempotency_key,payload); if response is not null then return response; end if;
  if job.row_version<>expected then perform eps.fail('STALE_RESOURCE_VERSION','Job changed.',409,job.row_version); end if;
  if job.status<>'failed' or job.cancel_requested_at is not null or coalesce((job.error->>'retryable')::boolean,false) is not true
    or coalesce((job.stage_attempts->>job.stage)::integer,0)>=3 then perform eps.fail('INVALID_TRANSITION','Job cannot be retried.',409); end if;
  update eps.jobs set status='queued',error=null,available_at=clock_timestamp(),lease_token_digest=null,lease_expires_at=null,
    dispatch_generation=dispatch_generation+1,row_version=row_version+1,updated_at=clock_timestamp() where id=job.id and row_version=expected returning * into job;
  get diagnostics changed=row_count; if changed<>1 then perform eps.fail('STALE_RESOURCE_VERSION','Job changed.',409); end if;
  perform eps.jobs_add_dispatch(job);
  return eps.finish_mutation('jobs.retry',p_idempotency_key,payload,eps.jobs_dto(job.id),job.id);
end $$;
create function public.eps_cancel_job(p_job_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare job eps.jobs; payload jsonb; response jsonb; expected bigint; changed integer; begin
  perform set_config('eps.jobs.mode','user',true); perform eps.require_capability('operations.retry'); perform eps.check_input(p_input,array['row_version','reason']); expected:=eps.expected_version(p_input);
  if p_input?'reason' and jsonb_typeof(p_input->'reason') not in('null','string') then perform eps.fail('INVALID_REQUEST','Reason must be text or null.',400); end if;
  select * into job from eps.jobs where id=p_job_id and eps.jobs_can_access(workspace_id,'operate') for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Operable job not found.',404); end if;
  if p_idempotency_key is null then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key required.',400); end if;
  payload:=jsonb_build_object('id',p_job_id,'input',p_input); response:=eps.idempotency_begin('jobs.cancel',p_idempotency_key,payload); if response is not null then return response; end if;
  if job.row_version<>expected then perform eps.fail('STALE_RESOURCE_VERSION','Job changed.',409,job.row_version); end if;
  if job.status='succeeded' then perform eps.fail('INVALID_TRANSITION','Successful job cannot be cancelled.',409); end if;
  if job.status='cancelled' then return eps.jobs_remember('jobs.cancel',p_idempotency_key,payload,eps.jobs_dto(job.id)); end if;
  update eps.jobs set status='cancelled',cancel_requested_at=clock_timestamp(),lease_token_digest=null,lease_expires_at=null,
    row_version=row_version+1,updated_at=clock_timestamp() where id=job.id and row_version=expected;
  get diagnostics changed=row_count; if changed<>1 then perform eps.fail('STALE_RESOURCE_VERSION','Job changed.',409); end if;
  return eps.finish_mutation('jobs.cancel',p_idempotency_key,payload,eps.jobs_dto(job.id),job.id);
end $$;

create function eps.claim_job_outbox(p_limit integer default 25) returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate record; event eps.outbox_events; job eps.jobs; token text; leases jsonb:='[]'; changed integer; begin
  perform set_config('eps.jobs.mode','dispatcher',true);
  if p_limit is null or p_limit not between 1 and 100 then perform eps.fail('INVALID_REQUEST','Bounded dispatch batch required.',400); end if;
  -- All mutators lock JOB before OUTBOX. This bounded initial read holds no row
  -- locks; both parent identity and eligibility are rechecked after parent lock.
  for candidate in select id,job_id from eps.outbox_events where status='pending' and available_at<=clock_timestamp() or status='leased' and lease_expires_at<=clock_timestamp()
      order by available_at,id limit p_limit loop
    select * into job from eps.jobs where id=candidate.job_id for update skip locked;
    if not found then continue; end if;
    select * into event from eps.outbox_events current_event where current_event.id=candidate.id and current_event.job_id=job.id
      and (current_event.status='pending' and current_event.available_at<=clock_timestamp() or current_event.status='leased' and current_event.lease_expires_at<=clock_timestamp()) for update skip locked;
    if not found then continue; end if;
    if job.status not in('queued','running') or job.cancel_requested_at is not null or job.stage<>event.stage or job.dispatch_generation<>event.dispatch_generation or job.input_hash<>event.input_hash then
      update eps.outbox_events set status='dead',lease_token_digest=null,lease_expires_at=null,last_error=jsonb_build_object('code','DISPATCH_OBSOLETE','message','Dispatch no longer names the current job stage.','details','{}'::jsonb,'retryable',false) where id=event.id; continue;
    end if;
    if event.attempt_count>=5 then
      update eps.outbox_events set status='dead',lease_token_digest=null,lease_expires_at=null,last_error=jsonb_build_object('code','DISPATCH_UNAVAILABLE','message','The processing request could not be dispatched.','details','{}'::jsonb,'retryable',true) where id=event.id;
      if job.status='queued' then update eps.jobs set status='failed',error=jsonb_build_object('code','DISPATCH_UNAVAILABLE','message','The processing request could not be dispatched.','details','{}'::jsonb,'retryable',true),row_version=row_version+1,updated_at=clock_timestamp() where id=job.id; end if; continue;
    end if;
    token:=rtrim(translate(encode(extensions.gen_random_bytes(32),'base64'),'+/','-_'),'=');
    update eps.outbox_events set status='leased',attempt_count=attempt_count+1,lease_token_digest=encode(sha256(convert_to(token,'UTF8')),'hex'),lease_expires_at=clock_timestamp()+interval '90 seconds' where id=event.id;
    get diagnostics changed=row_count; if changed<>1 then perform eps.fail('INVALID_TRANSITION','Dispatch changed while claiming.',409); end if;
    leases:=leases||jsonb_build_array(jsonb_build_object('id',event.id,'lease_token',token,'lease_expires_at',(select lease_expires_at from eps.outbox_events where id=event.id),
      'envelope',jsonb_build_object('event_id',event.id,'event_type','job.stage_ready','contract_version','1.0','job_id',job.id,'kind',job.kind,'stage',job.stage,'input_hash',job.input_hash,'correlation_id',job.correlation_id)));
  end loop;
  return jsonb_build_object('leases',leases);
end $$;
create function eps.finish_job_outbox(p_outbox_id uuid,p_lease_token text,p_accepted boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare parent_uuid uuid; event eps.outbox_events; job eps.jobs; fingerprint text; delay double precision; changed integer; begin
  perform set_config('eps.jobs.mode','dispatcher',true);
  if p_lease_token is null or length(p_lease_token)<>43 or p_lease_token!~'^[A-Za-z0-9_-]{43}$' or p_accepted is null then perform eps.fail('INVALID_REQUEST','Dispatch lease and acceptance required.',400); end if;
  fingerprint:=encode(sha256(convert_to(p_lease_token,'UTF8')),'hex');
  select job_id into parent_uuid from eps.outbox_events where id=p_outbox_id;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Dispatch not found.',404); end if;
  select * into job from eps.jobs where id=parent_uuid for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Dispatch parent not found.',404); end if;
  select * into event from eps.outbox_events where id=p_outbox_id and job_id=job.id for update;
  if not found then perform eps.fail('INVALID_TRANSITION','Dispatch identity changed before acknowledgement.',409); end if;
  if event.status='delivered' and event.lease_token_digest=fingerprint and p_accepted then return jsonb_build_object('acknowledged',true,'stale',false); end if;
  if event.status<>'leased' or event.lease_token_digest is distinct from fingerprint or event.lease_expires_at<=clock_timestamp() then perform eps.fail('INVALID_TRANSITION','Dispatch lease is stale.',409); end if;
  if job.status not in('queued','running') or job.cancel_requested_at is not null or job.stage<>event.stage or job.dispatch_generation<>event.dispatch_generation or job.input_hash<>event.input_hash then
    update eps.outbox_events set status='dead',lease_token_digest=null,lease_expires_at=null,last_error=jsonb_build_object('code','DISPATCH_OBSOLETE','message','Dispatch no longer names the current job stage.','details','{}'::jsonb,'retryable',false) where id=event.id;
    return jsonb_build_object('acknowledged',false,'stale',true);
  end if;
  if p_accepted then
    update eps.outbox_events set status='delivered',delivered_at=clock_timestamp(),lease_expires_at=null where id=event.id and status='leased' and lease_token_digest=fingerprint and lease_expires_at>clock_timestamp();
  else
    delay:=least(300.0,2.0*power(2.0,least(event.attempt_count-1,20))*(0.5+random()));
    update eps.outbox_events set status=case when attempt_count>=5 then 'dead' else 'pending' end,available_at=clock_timestamp()+delay*interval '1 second',lease_token_digest=null,lease_expires_at=null,
      last_error=jsonb_build_object('code','DISPATCH_UNAVAILABLE','message','The processing request could not be dispatched.','details','{}'::jsonb,'retryable',true)
      where id=event.id and status='leased' and lease_token_digest=fingerprint and lease_expires_at>clock_timestamp();
  end if;
  get diagnostics changed=row_count; if changed<>1 then perform eps.fail('INVALID_TRANSITION','Dispatch expired before acknowledgement.',409); end if;
  if not p_accepted and event.attempt_count>=5 and job.status='queued' then
    update eps.jobs set status='failed',error=jsonb_build_object('code','DISPATCH_UNAVAILABLE','message','The processing request could not be dispatched.','details','{}'::jsonb,'retryable',true),row_version=row_version+1,updated_at=clock_timestamp() where id=job.id;
  end if;
  return jsonb_build_object('acknowledged',p_accepted,'stale',false);
end $$;

grant create on schema eps,public to eps_jobs_owner;
do $$ declare routine record; begin
  for routine in select proc.oid::regprocedure signature,namespace.nspname,proc.proname from pg_proc proc join pg_namespace namespace on namespace.oid=proc.pronamespace
    where namespace.nspname='eps' and proc.proname in('jobs_can_access','jobs_dispatch_mode','jobs_dto','jobs_remember','jobs_hash_v1','jobs_add_dispatch','m02_enqueue_specs_job','claim_job_outbox','finish_job_outbox')
      or namespace.nspname='public' and proc.proname in('eps_get_job','eps_list_jobs','eps_retry_job','eps_cancel_job') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role,eps_api_owner,eps_jobs_dispatcher',routine.signature);
    execute format('alter function %s owner to eps_jobs_owner',routine.signature);
    if routine.nspname='public' then execute format('grant execute on function %s to authenticated',routine.signature); end if;
  end loop;
end $$;
revoke create on schema eps,public from eps_jobs_owner;
grant execute on function eps.claim_job_outbox(integer),eps.finish_job_outbox(uuid,text,boolean) to eps_jobs_dispatcher;
do $$ begin
  if pg_has_role('authenticated','eps_jobs_owner','MEMBER') or pg_has_role('eps_api_owner','eps_jobs_owner','MEMBER') or pg_has_role('eps_jobs_dispatcher','eps_jobs_owner','MEMBER')
    or has_table_privilege('eps_jobs_dispatcher','eps.jobs','UPDATE') or has_table_privilege('authenticated','eps.jobs','SELECT')
  then raise exception 'M02_JOBS_ROLE_BOUNDARY_INVALID'; end if;
end $$;
