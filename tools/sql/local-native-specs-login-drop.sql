-- Drop only this run's exact fixed test identity, after all its sessions settled.
-- No CASCADE, global HBA/logging changes, table ownership or Auth-user mutation.
do $guard$
declare candidate record; memberships integer; actual_defaults text[];
 expected_defaults text[]:=array['auto_explain.log_min_duration=-1','auto_explain.log_parameter_max_length=0',
  'log_min_duration_sample=-1','log_min_duration_statement=-1','log_parameter_max_length=0',
  'log_parameter_max_length_on_error=0','log_statement=none','log_transaction_sample_rate=0',
  'pgaudit.log=none','pgaudit.log_parameter=off','pgaudit.role='];
 run_id text:=current_setting('eps.native_specs.run_id',true);
begin
 if current_user<>'supabase_admin' or session_user<>'supabase_admin' or current_database()<>'postgres'
  or not (select rolsuper from pg_catalog.pg_roles where rolname=current_user)
  or (select system_identifier::text from pg_catalog.pg_control_system())<>'7701520506262638626'
  or run_id is null or run_id!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 then raise exception 'OWNED_LOCAL_NATIVE_LOGIN_DROP_REQUIRED'; end if;
 select role.*,pg_catalog.shobj_description(role.oid,'pg_authid') as marker into candidate
  from pg_catalog.pg_roles role where role.rolname='eps_native_specs_local_probe';
 if not found or candidate.marker is distinct from 'everyone-presentation-local-native-specs:'||run_id
  or not candidate.rolcanlogin or candidate.rolinherit or candidate.rolsuper or candidate.rolbypassrls
  or candidate.rolcreatedb or candidate.rolcreaterole or candidate.rolreplication or candidate.rolconnlimit<>4
  or candidate.rolvaliduntil is not null
  or exists(select 1 from pg_catalog.pg_authid where oid=candidate.oid and rolpassword is not null)
  or exists(select 1 from pg_catalog.pg_stat_activity where usesysid=candidate.oid)
  or exists(select 1 from pg_catalog.pg_shdepend where refclassid='pg_authid'::regclass and refobjid=candidate.oid and deptype='o')
 then raise exception 'LOCAL_NATIVE_LOGIN_OWNERSHIP_OR_SETTLEMENT_CHANGED'; end if;
 select count(*) into memberships from pg_catalog.pg_auth_members where member=candidate.oid or roleid=candidate.oid;
 if memberships<>1 or not exists(select 1 from pg_catalog.pg_auth_members membership
  join pg_catalog.pg_roles granted on granted.oid=membership.roleid where membership.member=candidate.oid
  and granted.rolname='eps_jobs_executor' and membership.inherit_option and not membership.set_option and not membership.admin_option)
 then raise exception 'LOCAL_NATIVE_LOGIN_MEMBERSHIP_CHANGED'; end if;
 select array_agg(value order by value) into actual_defaults from pg_catalog.pg_db_role_setting defaults,
  lateral unnest(defaults.setconfig) value where defaults.setrole=candidate.oid and defaults.setdatabase=0;
 if actual_defaults is distinct from expected_defaults
  or exists(select 1 from pg_catalog.pg_db_role_setting where setrole=candidate.oid and setdatabase<>0)
 then raise exception 'LOCAL_NATIVE_LOGIN_SETTINGS_CHANGED'; end if;
end $guard$;
drop role eps_native_specs_local_probe;
