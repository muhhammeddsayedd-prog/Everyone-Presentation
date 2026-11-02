begin isolation level repeatable read read only;
set local search_path='';
set local timezone='UTC';
set local statement_timeout='20s';
with scope(label,id)as(values('legacy','86936940-b48d-497d-b1ff-8e0da0913afa'::uuid),('controlled','5505def3-f7af-4684-968c-d1b154931601'::uuid))
select jsonb_build_object('database',current_database(),'operator',current_user,'read_only',current_setting('transaction_read_only')='on','observed_at',clock_timestamp(),'history_count',(select count(*)from supabase_migrations.schema_migrations),
 'workspaces',(select jsonb_agg(jsonb_build_object('label',s.label,'id',s.id,
 'roles_active',(select count(*)from eps.roles x where x.workspace_id=s.id and x.archived_at is null),'roles_archived',(select count(*)from eps.roles x where x.workspace_id=s.id and x.archived_at is not null),
 'slots_active',(select count(*)from eps.slots x where x.workspace_id=s.id and x.archived_at is null),'slots_archived',(select count(*)from eps.slots x where x.workspace_id=s.id and x.archived_at is not null),
 'slots_under_active_roles',(select count(*)from eps.slots x join eps.roles r on r.id=x.role_id where x.workspace_id=s.id and x.archived_at is null and r.archived_at is null),
 'assignments_active',(select count(*)from eps.assignments x where x.workspace_id=s.id and x.archived_at is null),'assignments_archived',(select count(*)from eps.assignments x where x.workspace_id=s.id and x.archived_at is not null),
 'pool_active',(select count(*)from eps.workspace_candidates x where x.workspace_id=s.id and x.archived_at is null),'pool_archived',(select count(*)from eps.workspace_candidates x where x.workspace_id=s.id and x.archived_at is not null),
 'distinct_active_assignment_candidates',(select count(distinct p.candidate_id)from eps.assignments a join eps.workspace_candidates p on p.id=a.workspace_candidate_id where a.workspace_id=s.id and a.archived_at is null),
 'distinct_selected_media',(select count(distinct p.selected_candidate_media_id)from eps.assignments a join eps.workspace_candidates p on p.id=a.workspace_candidate_id where a.workspace_id=s.id and a.archived_at is null),
 'distinct_selected_frame_assets',(select count(distinct f)from eps.assignments a join eps.workspace_candidates p on p.id=a.workspace_candidate_id cross join lateral unnest(p.selected_frame_asset_ids)f where a.workspace_id=s.id and a.archived_at is null))order by s.label)from scope s),
 'global_relation_counts',jsonb_build_object('candidates',(select count(*)from eps.candidates),'candidate_media',(select count(*)from eps.candidate_media),'candidate_media_frames',(select count(*)from eps.candidate_media_frames),'media_assets',(select count(*)from eps.media_assets)),
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'source_sha256',encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex'),'definition',pg_get_functiondef(p.oid))order by p.oid::regprocedure::text)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='public'and p.proname in('eps_generate_version','eps_get_workspace_review'))or(n.nspname='eps'and p.proname in('review_snapshot_data','review_snapshot','presentation_lock_sources','presentation_hash')))
)as cancellation_source;
rollback;
