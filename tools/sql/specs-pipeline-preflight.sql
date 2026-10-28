-- Fixed cloud READ ONLY metadata. No passwords, Auth rows, keys or source.
begin read only;
set local statement_timeout='20s';
set local search_path='';
select jsonb_build_object(
 'query_role',current_user,'database',current_database(),
 'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
 'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'new_relations',(select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind) order by c.relname),'[]')
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='eps'
   and c.relname in('specs_source_inputs','specs_pipeline_config','specs_stage_payloads')),
 'new_functions',(select coalesce(jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) order by n.nspname,p.proname,p.oid),'[]')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps'
   and (p.proname like 'specs_submit\_%' escape '\' or p.proname like 'specs_stage\_%' escape '\'
    or p.proname in('job_requester_active','claim_job_stage','get_specs_stage_input','record_job_event','recover_job_stages'))
   or n.nspname='public' and p.proname='eps_submit_specs'),
 'new_roles',(select coalesce(jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'superuser',rolsuper,'bypassrls',rolbypassrls) order by rolname),'[]')
  from pg_roles where rolname in('eps_specs_submit_owner','eps_specs_stage_owner','eps_specs_apply_owner','eps_jobs_executor','eps_specs_runtime')),
 'provenance_columns',(select coalesce(jsonb_agg(jsonb_build_array(c.relname,a.attname) order by c.relname,a.attname),'[]')
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='eps' and not a.attisdropped
   and (c.relname='specs' and a.attname='source_extraction_job_id' or c.relname='roles' and a.attname='source_job_id')),
 'settings',(select jsonb_object_agg(name,current_setting(name,true)) from unnest(array[
  'server_version','password_encryption','shared_preload_libraries','log_statement','log_min_error_statement','log_parameter_max_length',
  'log_parameter_max_length_on_error','log_min_duration_statement','log_min_duration_sample','log_transaction_sample_rate',
  'pgaudit.log','pgaudit.log_parameter','pgaudit.role','auto_explain.log_min_duration','auto_explain.log_parameter_max_length',
  'pg_stat_statements.track','pg_stat_statements.track_utility','pg_stat_statements.track_planning','pg_stat_statements.save',
  'supautils.privileged_role','supautils.privileged_role_allowed_configs']) name),
 'parameter_authority',(select jsonb_agg(jsonb_build_object('name',name,'context',context,
   'set',has_parameter_privilege(current_user,name,'SET'),'alter_system',has_parameter_privilege(current_user,name,'ALTER SYSTEM')) order by name)
  from pg_settings where name in('password_encryption','log_statement','log_min_error_statement','log_parameter_max_length','log_parameter_max_length_on_error',
   'log_min_duration_statement','log_min_duration_sample','log_transaction_sample_rate','pgaudit.log','pgaudit.log_parameter','pgaudit.role',
   'auto_explain.log_min_duration','auto_explain.log_parameter_max_length','pg_stat_statements.track','pg_stat_statements.track_utility')),
 'extensions',(select coalesce(jsonb_agg(jsonb_build_object('name',extname,'version',extversion,'schema',n.nspname) order by extname),'[]')
   from pg_extension e join pg_namespace n on n.oid=e.extnamespace where extname in('pg_stat_statements','pgaudit','pgcrypto')),
 'current_role',(select jsonb_build_object('name',rolname,'login',rolcanlogin,'superuser',rolsuper,'bypassrls',rolbypassrls,'createrole',rolcreaterole) from pg_roles where rolname=current_user)
) as specs_pipeline_preflight;
rollback;
