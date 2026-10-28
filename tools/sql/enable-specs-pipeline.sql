-- Nonsecret operator metadata. No identities, business facts or source writes.
begin;
set local statement_timeout='10s';
set local lock_timeout='3s';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030']::text[]
  or not exists(select 1 from pg_roles where rolname='eps_specs_runtime' and rolcanlogin and rolvaliduntil>clock_timestamp()+interval '1 day')
  or not exists(select 1 from eps.specs_pipeline_config where id=1 and not enabled and model_version is null
   and document_preparation_version is null and prompt_version is null and result_schema_version is null)
  or exists(select 1 from eps.jobs)
 then raise exception 'SPECS_PIPELINE_ENABLE_PRECONDITION_FAILED'; end if;
end $$;
update eps.specs_pipeline_config set enabled=true,document_preparation_version='document-preparation.v1',
 model_version='gpt-6.1-sol',prompt_version='spec_extract_v1.0.0',result_schema_version='1.0' where id=1;
select jsonb_build_object('configuration',(select to_jsonb(c) from eps.specs_pipeline_config c where id=1),
 'jobs',(select count(*) from eps.jobs),'source_inputs',(select count(*) from eps.specs_source_inputs),
 'roles',(select count(*) from eps.roles),'slots',(select count(*) from eps.slots)) as enabled;
commit;
