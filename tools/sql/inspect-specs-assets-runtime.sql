-- Fixed metadata inspection only. No source/output, passwords, verifier key
-- material, grant tokens, Auth rows or business identities are returned.
begin read only;
set local statement_timeout='10s';
set local search_path='';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941']::text[]
 then raise exception 'SPECS_ASSET_ACTIVATION_FIXED12_REQUIRED'; end if;
end $$;
select jsonb_build_object('query_role',current_user,'database',current_database(),
 'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'configuration',(select to_jsonb(c) from eps.specs_asset_config c where id=1),
 'configuration_rows',(select count(*) from eps.specs_asset_config),
 'verifier',jsonb_build_object('count',(select count(*) from eps.specs_verification_keys),
  'expected_active',exists(select 1 from eps.specs_verification_keys where key_id='eps-specs-dev-20261029-v1' and purpose='specs'
   and octet_length(secret)=32 and revoked_at is null and not_before<=clock_timestamp() and (not_after is null or not_after>clock_timestamp()))),
 'runtime',(select jsonb_build_object('name',r.rolname,'login',r.rolcanlogin,'inherit',r.rolinherit,'superuser',r.rolsuper,'bypass_rls',r.rolbypassrls,
  'create_db',r.rolcreatedb,'create_role',r.rolcreaterole,'replication',r.rolreplication,'connection_limit',r.rolconnlimit,'valid_until',r.rolvaliduntil,
  'parents',(select coalesce(jsonb_agg(jsonb_build_object('name',p.rolname,'grantor',pg_get_userbyid(m.grantor),'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) order by p.rolname),'[]')
   from pg_auth_members m join pg_roles p on p.oid=m.roleid where m.member=r.oid),
  'incoming',(select coalesce(jsonb_agg(jsonb_build_object('name',p.rolname,'grantor',pg_get_userbyid(m.grantor),'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) order by p.rolname,m.admin_option,m.inherit_option,m.set_option),'[]')
   from pg_auth_members m join pg_roles p on p.oid=m.member where m.roleid=r.oid),
  'settings',(select coalesce(jsonb_agg(jsonb_build_object('database',s.setdatabase,'values',(select coalesce(jsonb_agg(value order by value),'[]') from unnest(s.setconfig) entries(value)
    where split_part(value,'=',1) in('log_statement','log_parameter_max_length','log_parameter_max_length_on_error','log_min_error_statement','log_min_duration_statement',
     'auto_explain.log_min_duration','auto_explain.log_parameter_max_length','auto_explain.log_nested_statements','pg_stat_statements.track')),
   'unknown_setting',exists(select 1 from unnest(s.setconfig) entries(value) where split_part(value,'=',1) not in
    ('log_statement','log_parameter_max_length','log_parameter_max_length_on_error','log_min_error_statement','log_min_duration_statement',
     'auto_explain.log_min_duration','auto_explain.log_parameter_max_length','auto_explain.log_nested_statements','pg_stat_statements.track'))) order by s.setdatabase),'[]')
   from pg_db_role_setting s where s.setrole=r.oid),
  'auth_schema_usage',has_schema_privilege(r.oid,'auth','USAGE'),
  'schema_create',exists(select 1 from pg_namespace n where n.nspname in('eps','public','auth','storage') and has_schema_privilege(r.oid,n.oid,'CREATE')),
  'table_authority',exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p','v','m','f') and n.nspname in('eps','public','auth','storage')
   and(has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') or has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))),
  'owned_objects',exists(select 1 from pg_shdepend d where d.refclassid='pg_authid'::regclass and d.refobjid=r.oid and d.deptype='o'),
  'execute',(select coalesce(jsonb_agg(n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')' order by n.nspname,p.proname,oidvectortypes(p.proargtypes)),'[]')
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='eps' or n.nspname='public' and(p.proname like 'eps\_%' escape '\' or p.prosecdef)) and has_function_privilege(r.oid,p.oid,'EXECUTE')))
  from pg_roles r where r.rolname='eps_specs_runtime')) as state;
rollback;
