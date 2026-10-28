begin read only;
select jsonb_build_object(
  'observed_at', clock_timestamp(),
  'storage_helpers', (select coalesce(jsonb_agg(jsonb_build_object(
    'identity', p.oid::regprocedure::text,
    'owner', pg_get_userbyid(p.proowner),
    'security_definer', p.prosecdef,
    'authenticated_execute', has_function_privilege('authenticated',p.oid,'execute'),
    'definition', pg_get_functiondef(p.oid)) order by p.proname), '[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='storage' and (p.proname ilike '%operation%' or p.proname ilike '%request%' or p.proname ilike '%header%')),
  'hmac_functions', (select coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname,
    'identity', p.oid::regprocedure::text,
    'owner', pg_get_userbyid(p.proowner),
    'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute'))), '[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='hmac'),
  'object_policies', (select coalesce(jsonb_agg(jsonb_build_object('policy',policyname,'command',cmd,'roles',roles,'using',qual,'check',with_check)), '[]'::jsonb)
    from pg_policies where schemaname='storage' and tablename='objects'),
  'storage_columns', (select coalesce(jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type) order by table_name,ordinal_position), '[]'::jsonb)
    from information_schema.columns where table_schema='storage' and table_name in ('objects','buckets'))
) as storage_context;
rollback;
