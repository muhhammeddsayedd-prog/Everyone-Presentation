-- M02 additive candidate14. Parent/owned-local harness owns BEGIN/ROLLBACK.
-- No original job/source/business mutation, identity provisioning or cloud dispatch.
set local lock_timeout='5s';
set local statement_timeout='30s';
set local search_path='';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038']::text[]
  or to_regclass('eps.job_stage_claim_replays') is not null
  or to_regprocedure('eps.claim_job_stage_replay(jsonb,text,text,text)') is not null
 then raise exception 'SERVICE_CLAIM_REVIEWED_THIRTEEN_REQUIRED'; end if;
end $$;
create table eps.job_stage_claim_replays (
 service_principal name not null,
 idempotency_key text not null check(length(idempotency_key) between 16 and 200),
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 job_id uuid not null references eps.jobs(id),
 attempt_id uuid not null,
 key_id text not null check(key_id~'^[A-Za-z0-9._-]{1,64}$'),
 encrypted_response bytea,
 expires_at timestamptz not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(service_principal,idempotency_key)
);
create index job_stage_claim_replays_expiry_idx on eps.job_stage_claim_replays(expires_at) where encrypted_response is not null;
alter table eps.job_stage_claim_replays enable row level security;
alter table eps.job_stage_claim_replays force row level security;
revoke all on eps.job_stage_claim_replays from public,anon,authenticated,service_role;
grant select,insert,update on eps.job_stage_claim_replays to eps_specs_stage_owner;
create policy job_stage_claim_replay_owner on eps.job_stage_claim_replays for all to eps_specs_stage_owner
 using(service_principal=session_user) with check(service_principal=session_user);
grant usage on schema extensions to eps_specs_stage_owner;
grant execute on function extensions.pgp_sym_encrypt(text,text,text),extensions.pgp_sym_decrypt(bytea,text) to eps_specs_stage_owner;

create function eps.claim_job_stage_replay(p_input jsonb,p_idempotency_key text,p_key_id text,p_encryption_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old eps.job_stage_claim_replays; job eps.jobs; response jsonb; request_hash_value text; expiry timestamptz; begin
 perform eps.specs_stage_assert(p_idempotency_key is not null and length(p_idempotency_key) between 16 and 200
  and p_idempotency_key!~'[[:cntrl:][:space:]]' and p_key_id~'^[A-Za-z0-9._-]{1,64}$'
  and p_encryption_key~'^[a-f0-9]{64}$');
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','stage','input_hash','workflow_execution_id'],array['job_id','stage','input_hash']));
 perform eps.specs_stage_assert(jsonb_typeof(p_input->'job_id')='string' and (p_input->>'job_id')~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$');
 request_hash_value:=encode(sha256(convert_to(p_input::text,'UTF8')),'hex');
 -- Serialize one service/key intent before reading/claiming the locked job.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(session_user::text||':claim:'||p_idempotency_key,0));
 select * into old from eps.job_stage_claim_replays where service_principal=session_user and idempotency_key=p_idempotency_key for update;
 if found then
  if old.request_hash<>request_hash_value then perform eps.fail('IDEMPOTENCY_KEY_REUSED','The claim key names another request.',409); end if;
  job:=eps.specs_stage_lock(old.job_id);
  perform eps.specs_stage_configuration(job.input->'configuration');
  perform eps.specs_stage_assert(eps.specs_stage_source_matches(job),'INPUT_CHANGED');
  perform eps.specs_stage_assert(job.status<>'cancelled' and job.cancel_requested_at is null and job.input_hash=p_input->>'input_hash'
   and old.expires_at>clock_timestamp() and old.encrypted_response is not null,'STALE_STAGE_LEASE');
  if old.key_id<>p_key_id then perform eps.fail('CLAIM_REPLAY_KEY_UNAVAILABLE','The claim replay key is unavailable.',503); end if;
  begin response:=extensions.pgp_sym_decrypt(old.encrypted_response,p_encryption_key)::jsonb;
  exception when others then perform eps.fail('CLAIM_REPLAY_KEY_UNAVAILABLE','The claim replay key is unavailable.',503); end;
  if (response->>'already_completed')::boolean then
   perform eps.specs_stage_assert(response->>'lease_token'='' and response->>'job_id'=job.id::text
    and response->>'attempt_id'=old.attempt_id::text and response->>'stage'=p_input->>'stage'
    and exists(select 1 from jsonb_array_elements(job.completed_stages) value where value->>'attempt_id'=old.attempt_id::text
     and value->>'stage'=p_input->>'stage' and value->>'input_hash'=job.input_hash),'STALE_STAGE_LEASE');
   return response;
  end if;
  perform eps.specs_stage_assert(job.status='running' and job.current_attempt_id=old.attempt_id and job.stage=p_input->>'stage'
   and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
  perform eps.specs_stage_assert(response->>'job_id'=job.id::text and response->>'attempt_id'=job.current_attempt_id::text
   and response->>'stage'=job.stage and response#>>'{input,input_hash}'=job.input_hash
   and job.lease_token_digest=encode(sha256(convert_to(response->>'lease_token','UTF8')),'hex'),'STAGE_STATE_INVALID');
  return response;
 end if;
 -- Clear expired ciphertext in a bounded batch. Hash tombstones prevent key reuse.
 update eps.job_stage_claim_replays set encrypted_response=null where (service_principal,idempotency_key) in
  (select service_principal,idempotency_key from eps.job_stage_claim_replays where service_principal=session_user
   and expires_at<=clock_timestamp() and encrypted_response is not null order by expires_at limit 100 for update skip locked);
 response:=eps.claim_job_stage(p_input);
 expiry:=case when (response->>'already_completed')::boolean then clock_timestamp()+interval '90 seconds' else (response->>'lease_expires_at')::timestamptz end;
 insert into eps.job_stage_claim_replays(service_principal,idempotency_key,request_hash,job_id,attempt_id,key_id,encrypted_response,expires_at)
 values(session_user,p_idempotency_key,request_hash_value,(response->>'job_id')::uuid,(response->>'attempt_id')::uuid,p_key_id,
  extensions.pgp_sym_encrypt(response::text,p_encryption_key,'cipher-algo=aes256,compress-algo=0'),expiry);
 return response;
end $$;
grant create on schema eps to eps_specs_stage_owner;
alter function eps.claim_job_stage_replay(jsonb,text,text,text) owner to eps_specs_stage_owner;
revoke create on schema eps from eps_specs_stage_owner;
revoke all on function eps.claim_job_stage_replay(jsonb,text,text,text) from public,anon,authenticated,service_role;
grant execute on function eps.claim_job_stage_replay(jsonb,text,text,text) to eps_jobs_executor;
comment on table eps.job_stage_claim_replays is 'Private short-lived encrypted stage-claim replay; key never persisted. Hash tombstones retained; expired ciphertext scrubbed in bounded subsequent claims.';
