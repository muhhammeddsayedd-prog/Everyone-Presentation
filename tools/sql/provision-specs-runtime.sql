-- Fixed machine LOGIN provisioning. The password exists only inside this
-- transaction and its one private response. No literal secret reaches SQL text.
begin;
set local statement_timeout='15s';
set local lock_timeout='3s';
set local search_path='';
do $provision$
declare password text;
begin
 perform pg_advisory_xact_lock(20261028, 2230);
 if current_user<>'postgres' or current_database()<>'postgres'
  or not exists(select 1 from pg_roles where rolname=current_user and rolcreaterole and rolbypassrls)
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030']::text[]
  or exists(select 1 from pg_roles where rolname='eps_specs_runtime')
  or not exists(select 1 from eps.specs_pipeline_config where id=1 and not enabled and model_version is null)
  or current_setting('password_encryption')<>'scram-sha-256'
  or coalesce(current_setting('pgaudit.log',true),'none')<>'none'
  or coalesce(current_setting('pgaudit.log_parameter',true),'off') not in('off','false','0')
  or coalesce(current_setting('pgaudit.role',true),'')<>''
  or current_setting('pg_stat_statements.track')<>'top'
  or current_setting('log_min_duration_sample') not in('-1','-1ms')
  or current_setting('log_transaction_sample_rate')::numeric<>0
 then raise exception 'SPECS_RUNTIME_PROVISIONING_PRECONDITION_FAILED'; end if;
 create role eps_specs_runtime nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls connection limit 4;
 grant eps_jobs_executor,eps_jobs_dispatcher to eps_specs_runtime with inherit true,set false,admin false;
 -- Managed Supautils permits these settings on the dedicated role. No global
 -- logging, Auth, SSL enforcement, pooler or billing setting changes.
 alter role eps_specs_runtime set log_statement='none';
 alter role eps_specs_runtime set log_parameter_max_length=0;
 alter role eps_specs_runtime set log_parameter_max_length_on_error=0;
 alter role eps_specs_runtime set log_min_error_statement='panic';
 alter role eps_specs_runtime set log_min_duration_statement=-1;
 alter role eps_specs_runtime set auto_explain.log_min_duration=-1;
 alter role eps_specs_runtime set auto_explain.log_parameter_max_length=0;
 alter role eps_specs_runtime set auto_explain.log_nested_statements=false;
 alter role eps_specs_runtime set pg_stat_statements.track='none';
 password:=encode(extensions.gen_random_bytes(48),'hex');
 begin
  execute format('alter role eps_specs_runtime login password %L valid until %L',password,(clock_timestamp()+interval '30 days')::text);
 exception when others then
  raise exception 'SPECS_RUNTIME_CREDENTIAL_INSTALL_FAILED';
 end;
 perform set_config('eps.private_runtime_password',password,true);
end $provision$;
select jsonb_build_object('role','eps_specs_runtime','password',current_setting('eps.private_runtime_password'),
 'expires_at',(select rolvaliduntil from pg_roles where rolname='eps_specs_runtime'),
 'memberships',(select jsonb_agg(jsonb_build_object('parent',parent.rolname,'member',member.rolname,'grantor',pg_get_userbyid(m.grantor),
   'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) order by parent.rolname,member.rolname)
  from pg_auth_members m join pg_roles parent on parent.oid=m.roleid join pg_roles member on member.oid=m.member
  where parent.rolname='eps_specs_runtime' or member.rolname='eps_specs_runtime'),
 'settings',(select rolconfig from pg_roles where rolname='eps_specs_runtime')) as provisioned;
commit;
