-- Fixed successful-app metadata only; no transcript, facts, URL or provider body.
begin read only;
set local search_path='';
set local statement_timeout='10s';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres' or not exists(
  select 1 from eps.jobs j where j.id='55415ff2-e049-468f-a0a1-7240fba350b0'
   and j.workspace_id='e470aefd-e0f7-480c-bf0d-170cb2cb7069' and j.kind='candidate_scan' and j.status='succeeded'
   and j.input_asset_id='20c0ed17-5705-4056-a53d-9898384d4187')
 then raise exception 'M03_SUCCESS_USAGE_SCOPE_UNCONFIRMED'; end if;
end $$;
select jsonb_build_object('observed_at',clock_timestamp(),'job_id',p.job_id,'attempt_id',p.attempt_id,
 'provider','openai','requested_model_matches',m->>'requested_model'='gpt-transcribe',
 'sdk_matches',m->>'sdk_version'='7.45.1','audio_duration_ms',m->'audio_duration_ms',
 'usage_seconds',case when jsonb_typeof(m#>'{usage,seconds}')='number' then (m#>>'{usage,seconds}')::numeric end,
 'usage_type_is_duration',m#>>'{usage,type}'='duration') as usage
from eps.candidate_stage_payloads p cross join lateral jsonb_array_elements(p.payload->'provider_metadata') m
where p.job_id='55415ff2-e049-468f-a0a1-7240fba350b0' and p.stage='transcribe_candidate';
rollback;
