-- Fixed read-only pre-rollout observation. No job IDs, private inputs or leases
-- are returned. All queues consumed by the local worker must be drained.
begin isolation level repeatable read read only;
set local search_path='';set local statement_timeout='10s';
select jsonb_build_object('observed_at',clock_timestamp(),'query_role',current_user,'database',current_database(),
 'queued_jobs',count(*)filter(where status='queued'),'running_jobs',count(*)filter(where status='running'),
 'unexpired_leases',count(*)filter(where lease_expires_at>clock_timestamp()))as vision_worker_idle
from eps.jobs;
rollback;
