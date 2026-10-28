-- Fixed owned-local metadata/count snapshot. No source/user/key values returned.
begin read only;
set local timezone='UTC';
do $snapshot$
declare relation record; amount bigint; row_digest text; counts jsonb:='{}'; digests jsonb:='{}'; snapshot_value jsonb;
begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
  or coalesce(current_setting('eps.native_specs.fixture_run_id',true),'')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  or (select system_identifier::text from pg_control_system())<>'7701520506262638626'
  or not (select rolbypassrls or rolsuper from pg_roles where rolname=current_user)
  or (select count(*) from supabase_migrations.schema_migrations)<>10
  or to_regclass('eps.specs_source_inputs') is null
 then raise exception 'NATIVE_OWNED_TEN_VERSION_SNAPSHOT_REQUIRED'; end if;
 for relation in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in('public','eps','auth','storage','eps_local_guard','supabase_migrations') and c.relkind in('r','p') order by n.nspname,c.relname loop
  execute format('select count(*) from %I.%I',relation.nspname,relation.relname) into amount;
  counts:=counts||jsonb_build_object(relation.nspname||'.'||relation.relname,amount);
  -- Only local synthetic table contents are inspected; raw values never leave
  -- PostgreSQL. Canonical ordered JSON hashes detect changes beyond row counts.
  execute format('select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(v) order by to_jsonb(v)::text),''[]'')::text,''UTF8'')),''hex'') from %I.%I v',relation.nspname,relation.relname) into row_digest;
  digests:=digests||jsonb_build_object(relation.nspname||'.'||relation.relname,row_digest);
 end loop;
 select jsonb_build_object(
  'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
  'migration_sources',(select jsonb_agg(jsonb_build_array(path,sha256) order by path) from eps_local_guard.migration_replay),
  'counts',counts,
  'row_digests',digests,
  'pipeline_config_rows',(select count(*) from eps.specs_pipeline_config),
  'pipeline_config_disabled',not exists(select 1 from eps.specs_pipeline_config where enabled),
  'pipeline_config_sha256',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(config) order by id),'[]')::text,'UTF8')),'hex') from eps.specs_pipeline_config config),
  'catalog',jsonb_build_object(
   'relations',(select jsonb_agg(jsonb_build_array(c.oid,n.nspname,c.relname,c.relkind,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.relacl) order by c.oid)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','eps','auth','storage','eps_local_guard','supabase_migrations')),
   'columns',(select jsonb_agg(jsonb_build_array(a.attrelid,a.attnum,a.attname,a.atttypid,a.attnotnull,a.attisdropped,a.attacl,
     encode(sha256(convert_to(coalesce(pg_get_expr(d.adbin,d.adrelid),''),'UTF8')),'hex')) order by a.attrelid,a.attnum)
    from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and n.nspname in('public','eps','auth','storage','eps_local_guard','supabase_migrations')),
   'routines',(select jsonb_agg(jsonb_build_array(p.oid,n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),
     p.proowner,p.prosecdef,p.provolatile,encode(sha256(convert_to(coalesce(p.proconfig::text,''),'UTF8')),'hex'),p.proacl,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')) order by p.oid)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','eps','auth','storage','eps_local_guard')),
   'policies',(select jsonb_agg(jsonb_build_array(p.oid,p.polrelid,p.polname,p.polroles,p.polcmd,p.polpermissive,
     encode(sha256(convert_to(coalesce(pg_get_expr(p.polqual,p.polrelid),''),'UTF8')),'hex'),
     encode(sha256(convert_to(coalesce(pg_get_expr(p.polwithcheck,p.polrelid),''),'UTF8')),'hex')) order by p.oid)
    from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','eps','auth','storage')),
   'triggers',(select jsonb_agg(jsonb_build_array(t.oid,t.tgrelid,t.tgname,t.tgenabled,encode(sha256(convert_to(pg_get_triggerdef(t.oid),'UTF8')),'hex')) order by t.oid)
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in('public','eps','auth','storage')),
   'constraints',(select jsonb_agg(jsonb_build_array(c.oid,c.conrelid,c.conname,pg_get_constraintdef(c.oid)) order by c.oid)
    from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in('public','eps','auth','storage','eps_local_guard','supabase_migrations')),
   'roles',(select jsonb_agg(jsonb_build_array(oid,rolname,rolcanlogin,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolbypassrls,rolreplication,rolconnlimit) order by oid) from pg_roles),
   'memberships',(select jsonb_agg(jsonb_build_array(roleid,member,grantor,admin_option,inherit_option,set_option) order by roleid,member,grantor) from pg_auth_members),
   'role_settings',(select jsonb_agg(jsonb_build_array(setdatabase,setrole,encode(sha256(convert_to(setconfig::text,'UTF8')),'hex')) order by setdatabase,setrole) from pg_db_role_setting),
   'shared_descriptions',(select jsonb_agg(jsonb_build_array(objoid,classoid,encode(sha256(convert_to(description,'UTF8')),'hex')) order by classoid,objoid) from pg_shdescription)
  )) into snapshot_value;
 perform set_config('eps.native_specs.snapshot',snapshot_value::text,true);
end $snapshot$;
select current_setting('eps.native_specs.snapshot')::jsonb;
rollback;
