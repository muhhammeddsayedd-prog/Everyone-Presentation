-- Trusted owned metadata only. No pg_stats values, claims, source rows or text.
select jsonb_build_object(
 'observed_at',clock_timestamp(),'server_version_num',current_setting('server_version_num'),
 'settings',(select jsonb_object_agg(name,setting order by name)from pg_settings where name in
 ('jit','jit_above_cost','jit_inline_above_cost','jit_optimize_above_cost','plan_cache_mode',
  'default_statistics_target','autovacuum','autovacuum_analyze_threshold','autovacuum_analyze_scale_factor')),
 'tables',(select jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,
  'estimated_rows',c.reltuples,'pages',c.relpages,'all_visible_pages',c.relallvisible,
  'last_analyze',s.last_analyze,'last_autoanalyze',s.last_autoanalyze,
  'analyze_count',s.analyze_count,'autoanalyze_count',s.autoanalyze_count,
  'live_estimate',s.n_live_tup,'modifications_since_analyze',s.n_mod_since_analyze)
  order by n.nspname,c.relname)from pg_class c join pg_namespace n on n.oid=c.relnamespace
  join pg_stat_all_tables s on s.relid=c.oid where c.oid in
 ('auth.sessions'::regclass,'eps.assignments'::regclass,'eps.candidate_media'::regclass,
  'eps.candidates'::regclass,'eps.mcp_oauth_resources'::regclass,'eps.media_assets'::regclass,
  'eps.presentation_version_assets'::regclass,'eps.presentation_versions'::regclass,
  'eps.presentation_video_english_transcripts'::regclass,'eps.presentation_video_transcripts'::regclass,
  'eps.roles'::regclass,'eps.slots'::regclass,'eps.version_slides'::regclass,
  'eps.workspace_candidates'::regclass,'eps.workspaces'::regclass,
  'public.app_capability_grants'::regclass,'public.project_memberships'::regclass,'public.projects'::regclass)));
