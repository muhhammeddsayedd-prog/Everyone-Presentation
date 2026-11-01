-- SOURCE TEMPLATE ONLY. An operator must bind $1 UUID, $2 after-attempt, $3 limit.
-- Existing administrative PostgreSQL identity only; no user/worker grant or RPC.
-- Explicit allowlist avoids input/result/error/receipt/auth/session/node payloads.
select jsonb_build_object('schema_version',a.schema_version,'job_id',a.job_id,'attempt_id',a.attempt_id,
 'kind',a.kind,'stage',a.stage,'attempt',a.attempt,'stage_attempt',a.stage_attempt,
 'dispatch_generation',a.dispatch_generation,'correlation_id',a.correlation_id,'input_hash',a.input_hash,
 'workflow_execution_id',a.workflow_execution_id,'workflow_execution_ref_state',a.workflow_execution_ref_state,
 'claimed_at',a.claimed_at,'job_row_version',a.job_row_version) as attempt,
 coalesce(events.events,'[]'::jsonb) as events,
 coalesce(events.truncated,false) as events_truncated
from eps.job_stage_attempts a
left join lateral (
 select jsonb_agg(jsonb_build_object('sequence',sequence,'event_type',event_type,'created_at',created_at)
  order by sequence) filter(where ordinal<=100) as events,
  count(*)>100 as truncated
 from (
  select sequence,event_type,created_at,row_number()over(order by sequence)as ordinal
  from eps.job_events e where e.job_id=a.job_id and e.attempt_id=a.attempt_id order by sequence limit 101
 ) bounded
) events on true
where a.job_id=$1::uuid and a.attempt>$2::integer
 and $2::integer>=0 and $3::integer between 1 and 100
order by a.attempt limit $3::integer;
