-- SOURCE-ONLY CANDIDATE, OUTSIDE CANONICAL MIGRATION HISTORY. Never dispatched.
-- A reviewed owned-local harness must supply BEGIN/ROLLBACK and this exact marker.
-- Future promotion requires its own migration/release proof; no historical backfill.
set local search_path='';
set local lock_timeout='3s';
set local statement_timeout='30s';
do $$begin
 if current_user<>'postgres' or current_database()<>'postgres'
 or current_setting('eps.job_attempt_trace_candidate',true) is distinct from 'owned-local-source-only-v1'
 or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from array[
  '20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320',
  '20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600',
  '20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218',
  '20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824','20261031010000',
  '20261031104603','20261031130207','20261031143711','20261031182038']::text[]
 or to_regclass('eps.job_stage_attempts') is not null
 or to_regprocedure('eps.capture_job_stage_attempt()') is not null
 or exists(select 1 from pg_roles where rolname='eps_job_trace_owner')
 or exists(select 1 from pg_trigger where tgrelid='eps.jobs'::regclass and tgname='capture_job_stage_attempt')
 then raise exception 'M07_ATTEMPT_TRACE_OWNED_LOCAL35_REQUIRED'; end if;
end$$;

-- No existing application role receives INSERT, SELECT, UPDATE, DELETE or EXECUTE.
-- This new non-login owner can only insert the typed projection through its trigger.
create role eps_job_trace_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_job_trace_owner to postgres;
grant usage on schema eps to eps_job_trace_owner;
create table eps.job_stage_attempts (
 schema_version text not null default '1.0' check(schema_version='1.0'),
 job_id uuid not null references eps.jobs(id) on delete restrict,
 attempt_id uuid not null,
 kind text not null,
 stage text not null,
 attempt integer not null check(attempt>=1),
 stage_attempt integer not null check(stage_attempt between 1 and attempt),
 dispatch_generation bigint not null check(dispatch_generation between 1 and 9007199254740991),
 correlation_id text not null check(correlation_id~'^[A-Za-z0-9._:-]{1,128}$'),
 input_hash text not null check(input_hash~'^[a-f0-9]{64}$'),
 workflow_execution_id text check(workflow_execution_id~'^[A-Za-z0-9._:-]{1,200}$'),
 workflow_execution_ref_state text not null check(workflow_execution_ref_state in('recorded','not_provided','invalid_omitted')),
 claimed_at timestamptz not null check(isfinite(claimed_at)),
 job_row_version bigint not null check(job_row_version between 1 and 9007199254740991),
 primary key(job_id,attempt_id),
 unique(job_id,attempt),
 -- Explicit presentation/PDF retries may reset stage_attempts; this is metadata,
 -- not a globally unique identity. Total attempt and attempt UUID remain unique.
 check((workflow_execution_ref_state='recorded')=(workflow_execution_id is not null)),
 check((kind='specs_extract' and stage in('prepare_document','extract_specs','apply_specs'))
  or(kind='candidate_scan' and stage in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate'))
  or(kind='frame_extract' and stage in('extract_frames','apply_frames'))
  or(kind='ai_suggestion' and stage in('prepare_suggestion','generate_suggestion','validate_suggestion'))
  or(kind='review_fit' and stage='measure_review_fit')
  or(kind='presentation_render' and stage in('prepare_presentation','render_presentation','validate_presentation','publish_presentation'))
  or(kind='presentation_export' and stage='render_export'))
);
-- The job/attempt primary key is the bounded operator-query index. No unbounded API.
alter table eps.job_stage_attempts enable row level security;
alter table eps.job_stage_attempts force row level security;
revoke all on eps.job_stage_attempts from public,anon,authenticated,service_role;
grant insert(schema_version,job_id,attempt_id,kind,stage,attempt,stage_attempt,dispatch_generation,correlation_id,
 input_hash,workflow_execution_id,workflow_execution_ref_state,claimed_at,job_row_version)
 on eps.job_stage_attempts to eps_job_trace_owner;
create policy job_stage_attempts_capture on eps.job_stage_attempts for insert to eps_job_trace_owner
 with check(pg_catalog.pg_trigger_depth()>0);

create function eps.capture_job_stage_attempt() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare execution_ref text; ref_state text; stage_count integer;
begin
 if tg_relid<>'eps.jobs'::regclass or tg_op<>'UPDATE' or tg_level<>'ROW' or tg_when<>'AFTER'
 then raise exception 'ATTEMPT_TRACE_TRIGGER_SCOPE_REQUIRED'; end if;
 if new.current_attempt_id is null or new.current_attempt_id is not distinct from old.current_attempt_id
 then return null; end if;
 -- A genuine claim increments both counters while preserving job/source identity.
 -- Failure rolls the trace and claim back together; it never leaves an untraced claim.
 stage_count:=(new.stage_attempts->>new.stage)::integer;
 if new.status is distinct from 'running' or new.attempt<>old.attempt+1
 or stage_count is null or stage_count<>coalesce((old.stage_attempts->>new.stage)::integer,0)+1
 or new.row_version<>old.row_version+1 or new.id<>old.id or new.kind<>old.kind
 or new.input_hash<>old.input_hash or new.correlation_id<>old.correlation_id
 then raise exception 'ATTEMPT_TRACE_CLAIM_INVARIANT_REQUIRED'; end if;
 -- Existing claim functions accept bounded text; do not persist arbitrary free text.
 -- Invalid legacy/direct service refs remain an explicit omission, never a guess.
 if new.n8n_execution_id is null then ref_state:='not_provided';
 elsif new.n8n_execution_id~'^[A-Za-z0-9._:-]{1,200}$' then
  execution_ref:=new.n8n_execution_id;ref_state:='recorded';
 else ref_state:='invalid_omitted'; end if;
 insert into eps.job_stage_attempts(schema_version,job_id,attempt_id,kind,stage,attempt,stage_attempt,dispatch_generation,
  correlation_id,input_hash,workflow_execution_id,workflow_execution_ref_state,claimed_at,job_row_version)
 values('1.0',new.id,new.current_attempt_id,new.kind,new.stage,new.attempt,stage_count,new.dispatch_generation,
  new.correlation_id,new.input_hash,execution_ref,ref_state,new.updated_at,new.row_version);
 return null;
end$$;
grant create on schema eps to eps_job_trace_owner;
alter function eps.capture_job_stage_attempt() owner to eps_job_trace_owner;
revoke create on schema eps from eps_job_trace_owner;
revoke all on function eps.capture_job_stage_attempt() from public,anon,authenticated,service_role;
create trigger capture_job_stage_attempt after update of current_attempt_id on eps.jobs
 for each row when(new.current_attempt_id is not null and new.current_attempt_id is distinct from old.current_attempt_id)
 execute function eps.capture_job_stage_attempt();
comment on table eps.job_stage_attempts is
 'Operator-only append-only correlation for future committed claims; no historical reconstruction, payloads, leases, actor/session credentials or n8n node retention.';
