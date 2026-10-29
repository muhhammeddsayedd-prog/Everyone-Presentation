-- Nonsecret metadata gate. No support key or SUSET logging access is required.
begin isolation level repeatable read read only;
set local statement_timeout='15s';set local search_path='';
select jsonb_build_object('query_role',current_user,'database',current_database(),
 'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
 'candidate_active_jobs',(select count(*)from eps.jobs where kind='candidate_scan'and status in('queued','running')),
 'frame_active_jobs',(select count(*)from eps.jobs where kind='frame_extract'and status in('queued','running')),
 'leased_dispatches',(select count(*)from eps.outbox_events o join eps.jobs j on j.id=o.job_id where j.kind in('candidate_scan','frame_extract')and o.status='leased')
)as m03_frame_drain;
rollback;
