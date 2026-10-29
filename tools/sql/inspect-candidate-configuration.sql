-- Fixed metadata-only configuration inspection. No source, provider or secret rows.
begin read only;
set local statement_timeout='10s';
set local search_path='';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500']::text[]
 then raise exception 'CANDIDATE_CONFIGURATION_FIXED17_REQUIRED'; end if;
end $$;
select jsonb_build_object('query_role',current_user,'database',current_database(),
 'configuration_rows',(select count(*) from eps.candidate_asset_config),
 'configuration',(select to_jsonb(c) from eps.candidate_asset_config c where id),
 'active_candidate_jobs',(select count(*) from eps.jobs where kind='candidate_scan' and status in('queued','running')),
 'active_candidate_uploads',(select count(*) from eps.candidate_uploads where status='open' and expires_at>clock_timestamp())) as candidate_configuration;
rollback;
