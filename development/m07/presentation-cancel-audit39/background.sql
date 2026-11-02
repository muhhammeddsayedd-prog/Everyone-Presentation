begin isolation level repeatable read read only;
set local search_path='';
set local timezone='UTC';
set local statement_timeout='20s';
with scope(label,id)as(values('legacy','86936940-b48d-497d-b1ff-8e0da0913afa'::uuid),('controlled','5505def3-f7af-4684-968c-d1b154931601'::uuid))
select jsonb_build_object('database',current_database(),'operator',current_user,'read_only',current_setting('transaction_read_only')='on','observed_at',clock_timestamp(),'history_count',(select count(*)from supabase_migrations.schema_migrations),
 'global',jsonb_build_object('versions',(select count(*)from eps.presentation_versions),'ready_versions',(select count(*)from eps.presentation_versions where status='ready'),'version_slides',(select count(*)from eps.version_slides),'version_asset_pins',(select count(*)from eps.presentation_version_assets),'presentation_exports',(select count(*)from eps.presentation_exports),'review_links',(select count(*)from eps.review_links),'review_media_grants',(select count(*)from eps.review_media_grants)),
 'workspace_payload_sizes',(select jsonb_agg(jsonb_build_object('label',s.label,
 'spec_rows',(select count(*)from eps.specs x where x.workspace_id=s.id),'normalized_instruction_bytes',(select coalesce(sum(octet_length(x.normalized_instructions::text)),0)from eps.specs x where x.workspace_id=s.id),
 'active_role_requirement_bytes',(select coalesce(sum(octet_length(x.requirements::text)),0)from eps.roles x where x.workspace_id=s.id and x.archived_at is null),
 'assignment_weighted_fact_source_bytes',(select coalesce(sum(octet_length(c.facts::text)+octet_length(c.field_sources::text)),0)from eps.assignments a join eps.workspace_candidates p on p.id=a.workspace_candidate_id join eps.candidates c on c.id=p.candidate_id where a.workspace_id=s.id and a.archived_at is null),
 'distinct_selected_media_original_transcript_bytes',(select coalesce(sum(octet_length(m.original_transcript)),0)from eps.candidate_media m where m.id in(select p.selected_candidate_media_id from eps.assignments a join eps.workspace_candidates p on p.id=a.workspace_candidate_id where a.workspace_id=s.id and a.archived_at is null)))order by s.label)from scope s)
)as background_metadata;
rollback;
