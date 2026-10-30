-- M07 authorized READ ONLY catalogue discovery for canonical pyibofyctwnqpvktepse.
-- No Auth rows, token/credential/config values, table samples or mutations.
begin read only;
select jsonb_build_object(
  'observed_at',clock_timestamp(),
  'auth_relations',coalesce((select jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'relation',c.relname,'kind',c.relkind,
    'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
    'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull)
      order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
    'constraints',(select jsonb_agg(jsonb_build_object('name',con.conname,'type',con.contype,'definition',pg_get_constraintdef(con.oid)))
      from pg_constraint con where con.conrelid=c.oid),
    'indexes',(select jsonb_agg(pg_get_indexdef(i.indexrelid)) from pg_index i where i.indrelid=c.oid),
    'acl',c.relacl::text
  ) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='auth' and c.relkind in('r','p','v') and (c.relname='sessions' or c.relname like 'oauth%')),'[]'::jsonb),
  'possible_settings_relations',coalesce((select jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'relation',c.relname,
    'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod)) order by a.attnum)
      from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in('public','eps') and c.relkind in('r','p','v')
      and c.relname ~ '(setting|template|model|preset|oauth|delegat|processing_config|pipeline_config|asset_config)'),'[]'::jsonb),
  'eps_owner_roles',coalesce((select jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'superuser',rolsuper,'bypass_rls',rolbypassrls)
    order by rolname) from pg_roles where rolname like 'eps%owner'),'[]'::jsonb),
  'auth_session_grants',coalesce((select jsonb_agg(jsonb_build_object('grantee',grantee,'privilege',privilege_type,'column',column_name)
    order by grantee,column_name,privilege_type) from information_schema.column_privileges
    where table_schema='auth' and table_name='sessions'),'[]'::jsonb),
  'migration_count',(select count(*) from supabase_migrations.schema_migrations)
) as m07_catalogue_discovery;
rollback;
