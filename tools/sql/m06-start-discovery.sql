begin isolation level repeatable read read only;
set local search_path=''; set local lock_timeout='3s'; set local statement_timeout='15s';
with owner_source as (
 select requested_by from eps.jobs where id='9a5ddb61-6a9a-4157-b6be-8653cf2eadef'
 and kind='candidate_scan' and status='succeeded' and stage='apply_candidate'
)
select jsonb_build_object(
 'observed_at',clock_timestamp(),'query_role',current_user,'database',current_database(),
 'history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'existing_requester_count',(select count(*)from owner_source),
 'producer_active_capabilities',(select coalesce(jsonb_agg(capability order by capability),'[]'::jsonb)
   from public.app_capability_grants g join owner_source o on o.requested_by=g.principal_id where g.active),
 'link_manager_rows',(select jsonb_build_object('count',count(*),'active',bool_or(g.active))
   from public.app_capability_grants g join owner_source o on o.requested_by=g.principal_id where g.capability='review_links.manage'),
 'dummy_series',(select jsonb_agg(jsonb_build_object('id',s.id,'output_type',s.output_type,
   'audience_scope',s.audience_snapshot->>'scope','latest_ready_version_id',s.latest_ready_version_id,'template_version',s.template_version)order by s.id)
   from eps.presentation_series s where workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'),
 'guest_schema_present',to_regclass('eps.review_links')is not null
)as m06_start;
rollback;
