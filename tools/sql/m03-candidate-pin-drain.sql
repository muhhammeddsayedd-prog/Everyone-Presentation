-- Fixed metadata-only drain guard; no leases, source text or credentials.
begin isolation level repeatable read read only;
set local statement_timeout='15s';
select jsonb_build_object(
  'observed_at',clock_timestamp(),'query_role',current_user,'database',current_database(),
  'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
  'active_candidate_jobs',(select count(*) from eps.jobs where kind='candidate_scan' and status in('queued','running')),
  'leased_candidate_dispatches',(select count(*) from eps.outbox_events o join eps.jobs j on j.id=o.job_id where j.kind='candidate_scan' and o.status='leased'),
  'candidate_enabled',(select enabled from eps.candidate_asset_config where id),
  'protected_job_still_waiting',exists(select 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496' and status='waiting_for_input')
) as candidate_pin_drain;
rollback;
