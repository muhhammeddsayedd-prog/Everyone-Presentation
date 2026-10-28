-- Non-personal service metadata, read-only. No auth row payloads or storage objects.
begin read only;
set local statement_timeout = '10s';
select jsonb_build_object(
  'auth_user_count', (select count(*) from auth.users),
  'storage_buckets', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'public', public, 'file_size_limit', file_size_limit, 'allowed_mime_types', allowed_mime_types)), '[]') from storage.buckets),
  'business_relations_other_schemas', (select coalesce(jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', c.relname, 'kind', c.relkind)), '[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p','v','m') and n.nspname not like 'pg_%' and n.nspname not in ('information_schema','auth','storage','public','eps','extensions','realtime','vault','graphql','graphql_public'))
) as service_inventory;
rollback;
