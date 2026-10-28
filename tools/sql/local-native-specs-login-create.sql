-- LOCAL ACCEPTANCE FIXTURE ONLY. Not an application/cloud migration.
-- The fixed wrapper verifies the owned container before opening this transaction.
-- The run UUID is nonsecret; source, lease and provider payloads are never passed here.
do $guard$
declare run_id text:=current_setting('eps.native_specs.run_id',true);
begin
 if current_user<>'supabase_admin' or session_user<>'supabase_admin' or current_database()<>'postgres'
  or not (select rolsuper from pg_catalog.pg_roles where rolname=current_user)
  or (select system_identifier::text from pg_catalog.pg_control_system())<>'7701520506262638626'
  or run_id is null or run_id!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  or exists(select 1 from pg_catalog.pg_roles where rolname='eps_native_specs_local_probe')
  or not exists(select 1 from pg_catalog.pg_roles where rolname='eps_jobs_executor'
    and not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication)
  or to_regclass('eps.specs_source_inputs') is null
  or to_regprocedure('eps.get_specs_stage_input(uuid,uuid,text)') is null
 then raise exception 'OWNED_LOCAL_NATIVE_LOGIN_CREATE_REQUIRED'; end if;
end $guard$;
create role eps_native_specs_local_probe login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls connection limit 4 password null;
grant eps_jobs_executor to eps_native_specs_local_probe with inherit true,set false,admin false;
alter role eps_native_specs_local_probe set log_parameter_max_length=0;
alter role eps_native_specs_local_probe set log_parameter_max_length_on_error=0;
alter role eps_native_specs_local_probe set log_statement='none';
alter role eps_native_specs_local_probe set log_min_duration_statement=-1;
alter role eps_native_specs_local_probe set log_min_duration_sample=-1;
alter role eps_native_specs_local_probe set log_transaction_sample_rate=0;
alter role eps_native_specs_local_probe set auto_explain.log_min_duration=-1;
alter role eps_native_specs_local_probe set auto_explain.log_parameter_max_length=0;
alter role eps_native_specs_local_probe set pgaudit.log='none';
alter role eps_native_specs_local_probe set pgaudit.log_parameter='off';
alter role eps_native_specs_local_probe set pgaudit.role='';
do $marker$ begin
 execute format('comment on role eps_native_specs_local_probe is %L','everyone-presentation-local-native-specs:'||current_setting('eps.native_specs.run_id'));
end $marker$;
