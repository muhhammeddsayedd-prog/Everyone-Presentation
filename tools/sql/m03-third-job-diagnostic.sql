-- Fixed failed third actual job; counts and bounded technical metadata only.
-- No raw error, filename, provider body, source, lease or grant digest returned.
begin isolation level repeatable read read only;
set local statement_timeout='15s';set local search_path='';set local timezone='UTC';
do $scope$begin
 if current_user<>'postgres' or current_database()<>'postgres' or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
  or (select count(*) from eps.jobs j join eps.workspaces w on w.id=j.workspace_id where j.id='237d0b59-4763-4229-ba32-f04fe2f29c79' and j.kind='candidate_scan' and j.workspace_id='e470aefd-e0f7-480c-bf0d-170cb2cb7069' and w.project_id='bd14d10f-b1c5-4d6a-8b4d-e5c48208433c' and j.input_asset_id='b4dc1c1d-6b7c-45b1-a4ed-b0063372b57f' and j.status='failed' and j.stage='transcribe_candidate')<>1
 then raise exception 'M03_THIRD_JOB_FIXED_FAILED_SCOPE_UNCONFIRMED';end if;
end $scope$;
with target as(select * from eps.jobs where id='237d0b59-4763-4229-ba32-f04fe2f29c79'),
attempts as(select e.attempt_id,min(e.stage) stage from eps.job_events e join target j on j.id=e.job_id group by e.attempt_id
 union select a.producing_attempt_id,min(a.output_stage) from eps.media_assets a join target j on j.id=a.producing_job_id where not exists(select 1 from eps.job_events e where e.job_id=j.id and e.attempt_id=a.producing_attempt_id) group by a.producing_attempt_id),
grants as(select g.attempt_id,coalesce(t.stage,'UNOBSERVED') stage,g.permission,a.purpose,count(*) grants,
 count(*) filter(where g.revoked_at is not null) revoked,count(*) filter(where g.expires_at<=clock_timestamp()) expired
 from eps.candidate_asset_grants g join target j on j.id=g.job_id join eps.media_assets a on a.id=g.asset_id left join attempts t on t.attempt_id=g.attempt_id
 group by g.attempt_id,t.stage,g.permission,a.purpose),
derivatives as(select a.producing_attempt_id attempt_id,a.output_stage stage,a.purpose,a.status,count(*) assets,count(*) filter(where a.sha256 is not null) checksummed_assets,
 min(a.size_bytes) minimum_size_bytes,max(a.size_bytes) maximum_size_bytes,min(a.source_timestamp_ms) minimum_timestamp_ms,max(a.source_timestamp_ms) maximum_timestamp_ms
 from eps.media_assets a join target j on j.id=a.producing_job_id group by a.producing_attempt_id,a.output_stage,a.purpose,a.status)
select jsonb_build_object('observed_at',clock_timestamp(),'query_role',current_user,'database',current_database(),
 'job',(select jsonb_build_object('job_id',id,'workspace_id',workspace_id,'status',status,'stage',stage,'current_attempt_id',current_attempt_id,'input_sha256',input_hash,
  'known_error_code',case when error->>'code' in('SOURCE_UNREADABLE','RESULT_INVALID','EXTRACTION_REFUSED','PROVIDER_RATE_LIMITED','DEPENDENCY_UNAVAILABLE','PROCESSING_FAILED','INPUT_CHANGED','CAPABILITY_REQUIRED','JOB_CANCELLED','RETRY_EXHAUSTED') then error->>'code' else 'UNRECOGNIZED' end,
  'error_retryable',coalesce(error->'retryable','false'),'stage_attempts',stage_attempts,
  'completed_stage_count',jsonb_array_length(completed_stages),'private_payload_count',(select count(*) from eps.candidate_stage_payloads p where p.job_id=target.id),
  'transcription_payload_present',exists(select 1 from eps.candidate_stage_payloads p where p.job_id=target.id and p.stage='transcribe_candidate')) from target),
 'grants',(select coalesce(jsonb_agg(jsonb_build_object('attempt_id',g.attempt_id,'stage',g.stage,'permission',g.permission,'purpose',g.purpose,'grant_count',g.grants,'revoked_count',g.revoked,'expired_count',g.expired) order by g.stage,g.attempt_id,g.permission,g.purpose),'[]') from grants g),
 'derivatives',(select coalesce(jsonb_agg(jsonb_build_object('attempt_id',d.attempt_id,'stage',d.stage,'purpose',d.purpose,'status',d.status,'asset_count',d.assets,'checksummed_assets',d.checksummed_assets,'minimum_size_bytes',d.minimum_size_bytes,'maximum_size_bytes',d.maximum_size_bytes,'minimum_timestamp_ms',d.minimum_timestamp_ms,'maximum_timestamp_ms',d.maximum_timestamp_ms) order by d.stage,d.attempt_id,d.purpose,d.status),'[]') from derivatives d),
 'protected_m02',jsonb_build_object('still_waiting',exists(select 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496' and status='waiting_for_input' and error->>'code'='INPUT_CHANGED' and row_version=7),
  'manual_note_retained',exists(select 1 from eps.specs where id='73a1a500-acfe-48cc-91ba-53a83b895118' and encode(sha256(convert_to(normalized_instructions,'UTF8')),'hex')='da8207eb46c2f43e524057238e1476d6261071b0bef2ae176adda174073b18af'))
) as diagnostic;
rollback;
