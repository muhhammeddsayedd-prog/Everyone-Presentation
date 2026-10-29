-- One fixed operational transition, not a migration or credential provisioner.
-- Existing role + one executor membership + three nonsecret readiness flags.
begin;
set local statement_timeout='10s';
set local lock_timeout='3s';
set local search_path='';
lock table eps.specs_asset_config in exclusive mode;
lock table eps.specs_verification_keys in share mode;
do $activate$
declare runtime_oid oid; mode integer; changed bigint; expected_groups text[]; expected_functions oid[]; actual_functions oid[];
 expected_settings text[]:=array['auto_explain.log_min_duration=-1','auto_explain.log_nested_statements=false','auto_explain.log_parameter_max_length=0',
  'log_min_duration_statement=-1','log_min_error_statement=panic','log_parameter_max_length=0','log_parameter_max_length_on_error=0','log_statement=none','pg_stat_statements.track=none'];
 actual_settings text[]; source_config jsonb;
begin
 perform pg_advisory_xact_lock(20261029,101);
 if current_user<>'postgres' or current_database()<>'postgres'
  or not exists(select 1 from pg_roles where rolname=current_user and rolcreaterole and rolbypassrls)
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941']::text[]
  or (select count(*) from eps.specs_asset_config)<>1
  or not exists(select 1 from eps.specs_asset_config where id=1 and not uploads_enabled and not capabilities_enabled and not file_pipeline_enabled)
  or (select count(*) from eps.specs_verification_keys)<>1
  or not exists(select 1 from eps.specs_verification_keys where key_id='eps-specs-dev-20261029-v1' and purpose='specs' and octet_length(secret)=32
    and revoked_at is null and not_before<=clock_timestamp() and (not_after is null or not_after>clock_timestamp()))
 then raise exception 'SPECS_ASSET_ACTIVATION_PRECONDITION_FAILED'; end if;
 select oid into runtime_oid from pg_roles where rolname='eps_specs_runtime';
 if runtime_oid is null then raise exception 'SPECS_ASSET_EXISTING_RUNTIME_REQUIRED'; end if;
 select to_jsonb(c) into source_config from eps.specs_pipeline_config c where id=1;
 if source_config is null or source_config->'enabled' is distinct from 'true'::jsonb then raise exception 'SPECS_EXISTING_TEXT_PIPELINE_REQUIRED'; end if;
 for mode in 0..1 loop
  if not exists(select 1 from pg_roles r where r.oid=runtime_oid and r.rolcanlogin and not r.rolinherit and not r.rolsuper and not r.rolbypassrls
    and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication and r.rolconnlimit=4 and r.rolvaliduntil>clock_timestamp())
   or has_schema_privilege(runtime_oid,'auth','USAGE')
   or exists(select 1 from pg_namespace n where n.nspname in('eps','public','auth','storage') and has_schema_privilege(runtime_oid,n.oid,'CREATE'))
   or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p','v','m','f') and n.nspname in('eps','public','auth','storage')
    and(has_table_privilege(runtime_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') or has_any_column_privilege(runtime_oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
   or exists(select 1 from pg_shdepend d where d.refclassid='pg_authid'::regclass and d.refobjid=runtime_oid and d.deptype='o')
  then raise exception 'SPECS_ASSET_NARROW_RUNTIME_REQUIRED'; end if;
  expected_groups:=case when mode=0 then array['eps_jobs_dispatcher','eps_jobs_executor'] else array['eps_jobs_dispatcher','eps_jobs_executor','eps_specs_assets_executor'] end;
  if not(select count(*)=cardinality(expected_groups) and coalesce(bool_and(p.rolname=any(expected_groups) and pg_get_userbyid(m.grantor)='postgres'
    and m.inherit_option and not m.set_option and not m.admin_option),false)
   from pg_auth_members m join pg_roles p on p.oid=m.roleid where m.member=runtime_oid)
   or not(select count(*)<=1 and coalesce(bool_and(p.rolname='postgres' and pg_get_userbyid(m.grantor)='supabase_admin'
    and m.admin_option and not m.inherit_option and not m.set_option),true)
   from pg_auth_members m join pg_roles p on p.oid=m.member where m.roleid=runtime_oid)
  then raise exception 'SPECS_ASSET_EXACT_MEMBERSHIPS_REQUIRED'; end if;
  if (select count(*) from pg_db_role_setting where setrole=runtime_oid)<>1 then raise exception 'SPECS_ASSET_EXACT_ROLE_DEFAULTS_REQUIRED'; end if;
  select array_agg(value order by value) into actual_settings from pg_db_role_setting s,unnest(s.setconfig) entries(value) where s.setrole=runtime_oid and s.setdatabase=0;
  if actual_settings is distinct from expected_settings then raise exception 'SPECS_ASSET_EXACT_ROLE_DEFAULTS_REQUIRED'; end if;
  expected_functions:=array['eps.claim_job_outbox(integer)'::regprocedure::oid,'eps.finish_job_outbox(uuid,text,boolean)'::regprocedure::oid,
   'eps.claim_job_stage(jsonb)'::regprocedure::oid,'eps.get_specs_stage_input(uuid,uuid,text)'::regprocedure::oid,
   'eps.record_job_event(jsonb)'::regprocedure::oid,'eps.recover_job_stages(integer)'::regprocedure::oid];
  if mode=1 then expected_functions:=expected_functions||array['eps.get_job_asset_access(jsonb)'::regprocedure::oid,'eps.reserve_job_output(jsonb)'::regprocedure::oid,
   'eps.complete_job_output(jsonb)'::regprocedure::oid,'eps.store_specs_preparation(jsonb)'::regprocedure::oid]; end if;
  select array_agg(item order by item) into expected_functions from unnest(expected_functions) entries(item);
  select array_agg(p.oid order by p.oid) into actual_functions from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where(n.nspname='eps' or n.nspname='public' and(p.proname like 'eps\_%' escape '\' or p.prosecdef)) and has_function_privilege(runtime_oid,p.oid,'EXECUTE');
  if actual_functions is distinct from expected_functions then raise exception 'SPECS_ASSET_EXACT_EXECUTE_REQUIRED'; end if;
  if mode=0 then
   grant eps_specs_assets_executor to eps_specs_runtime with inherit true,set false,admin false;
   update eps.specs_asset_config set uploads_enabled=true,capabilities_enabled=true,file_pipeline_enabled=true
    where id=1 and not uploads_enabled and not capabilities_enabled and not file_pipeline_enabled;
   get diagnostics changed=row_count;
   if changed<>1 then raise exception 'SPECS_ASSET_FLAGS_NOT_UPDATED'; end if;
  end if;
 end loop;
 if not exists(select 1 from eps.specs_asset_config where id=1 and uploads_enabled and capabilities_enabled and file_pipeline_enabled)
  or (select to_jsonb(c) from eps.specs_pipeline_config c where id=1) is distinct from source_config
 then raise exception 'SPECS_ASSET_ACTIVATION_POSTCONDITION_FAILED'; end if;
end $activate$;
select jsonb_build_object('role','eps_specs_runtime','added_group','eps_specs_assets_executor','inherit',true,'set',false,'admin',false,
 'configuration',(select to_jsonb(c) from eps.specs_asset_config c where id=1),'key_id','eps-specs-dev-20261029-v1',
 'credentials_created',false,'business_facts_written',false) as enabled;
commit;
