-- M00 read-only metadata inventory. No row data, function bodies or credentials.
begin read only;
set local statement_timeout = '15s';
select jsonb_build_object(
  'database', current_database(),
  'postgres_version', current_setting('server_version'),
  'extensions', (select coalesce(jsonb_agg(jsonb_build_object('name', extname, 'version', extversion)), '[]') from pg_extension),
  'schemas', (select coalesce(jsonb_agg(nspname order by nspname), '[]') from pg_namespace where nspname not like 'pg_%' and nspname <> 'information_schema'),
  'relations', (select coalesce(jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', c.relname, 'kind', c.relkind, 'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity) order by n.nspname,c.relname), '[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p','v','m') and n.nspname in ('public','eps','auth','storage','supabase_migrations')),
  'columns', (select coalesce(jsonb_agg(jsonb_build_object('schema', table_schema, 'table', table_name, 'column', column_name, 'type', data_type, 'udt', udt_name, 'nullable', is_nullable) order by table_schema,table_name,ordinal_position), '[]') from information_schema.columns where table_schema in ('public','eps','supabase_migrations')),
  'constraints', (select coalesce(jsonb_agg(jsonb_build_object('schema', n.nspname, 'table', c.relname, 'name', con.conname, 'type', con.contype, 'definition', pg_get_constraintdef(con.oid)) order by n.nspname,c.relname,con.conname), '[]') from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','eps')),
  'functions', (select coalesce(jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', p.proname, 'arguments', pg_get_function_identity_arguments(p.oid), 'result', pg_get_function_result(p.oid), 'security_definer', p.prosecdef, 'owner', pg_get_userbyid(p.proowner)) order by n.nspname,p.proname), '[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','eps')),
  'policies', (select coalesce(jsonb_agg(jsonb_build_object('schema', schemaname, 'table', tablename, 'name', policyname, 'roles', roles, 'command', cmd, 'using', qual, 'check', with_check) order by schemaname,tablename,policyname), '[]') from pg_policies where schemaname in ('public','eps','storage')),
  'grants', (select coalesce(jsonb_agg(jsonb_build_object('schema', table_schema, 'table', table_name, 'grantee', grantee, 'privilege', privilege_type) order by table_schema,table_name,grantee,privilege_type), '[]') from information_schema.role_table_grants where table_schema in ('public','eps') and grantee in ('anon','authenticated','service_role')),
  'triggers', (select coalesce(jsonb_agg(jsonb_build_object('schema', event_object_schema, 'table', event_object_table, 'name', trigger_name, 'event', event_manipulation, 'timing', action_timing) order by event_object_schema,event_object_table,trigger_name), '[]') from information_schema.triggers where event_object_schema in ('public','eps'))
) as inventory;
rollback;
