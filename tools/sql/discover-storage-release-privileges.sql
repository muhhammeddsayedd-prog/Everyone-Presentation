begin read only;
select jsonb_build_object(
 'observed_at',clock_timestamp(),
 'query_role',current_user,
 'supautils_policy_grants',current_setting('supautils.policy_grants',true),
 'schema',(select jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl) from pg_namespace where nspname='storage'),
 'tables',(select coalesce(jsonb_agg(jsonb_build_object(
   'table',c.oid::regclass::text,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl,
   'query_role_owner_membership',pg_has_role(current_user,c.relowner,'USAGE'),
   'rls_enabled',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
   'query_role_insert',has_table_privilege(current_user,c.oid,'INSERT'),
   'authenticated_insert',has_table_privilege('authenticated',c.oid,'INSERT'))),'[]'::jsonb)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='storage' and c.relname in ('buckets','objects')),
 'helpers',(select coalesce(jsonb_agg(p.oid::regprocedure::text),'[]'::jsonb)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='storage' and p.proname in ('operation','allow_only_operation')),
 'hmac_schema',(select n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='hmac' and pg_get_function_identity_arguments(p.oid)='bytea, bytea, text' limit 1),
 'triggers',(select coalesce(jsonb_agg(jsonb_build_object('table',c.oid::regclass::text,'name',t.tgname,'definition',pg_get_triggerdef(t.oid))),'[]'::jsonb)
   from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='storage' and c.relname in ('buckets','objects') and not t.tgisinternal)
) as storage_release_privileges;
rollback;
