-- Read-only normalized statement metadata. Never select query text into output.
-- Do not reset pg_stat_statements or change tracking/logging configuration.
begin read only;
set local statement_timeout='10s';
set local search_path='';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or to_regclass('extensions.pg_stat_statements') is null
  or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
 then raise exception 'STORAGE_SELECT_SHAPES_UNAVAILABLE'; end if;
end $$;
with candidates as (
 select s.userid,r.rolname,s.calls,s.rows,s.query,
  regexp_replace(lower(s.query),'"','','g') normalized
 from extensions.pg_stat_statements s join pg_catalog.pg_roles r on r.oid=s.userid
 where r.rolname in('authenticated','anon','authenticator','supabase_storage_admin','service_role')
  and s.dbid=(select oid from pg_catalog.pg_database where datname=current_database())
), selected as (
 select * from candidates where normalized~'^[[:space:]]*(select|with)[[:space:]]'
  and normalized~'(from|join)[[:space:]]+storage[.][[:space:]]*objects([[:space:]]|$)'
 order by calls desc,rolname limit 80
)
select jsonb_build_object('observed_at',pg_catalog.clock_timestamp(),'query_role',current_user,'writes_requested',false,
 'stats_reset_requested',false,'query_text_recorded',false,'limit',80,
 'statements',(select coalesce(jsonb_agg(jsonb_build_object('role',rolname,'calls',calls,'rows',rows,
  'query_sha256',encode(sha256(convert_to(query,'UTF8')),'hex'),
  'uses_for_share',normalized~'for[[:space:]]+share',
  'uses_for_key_share',normalized~'for[[:space:]]+key[[:space:]]+share',
  'uses_for_update',normalized~'for[[:space:]]+(no[[:space:]]+key[[:space:]]+)?update',
  'filters_archived_at_null',normalized~'archived_at[[:space:]]+is[[:space:]]+null',
  'mentions_delete_marker',position('is_delete_marker' in normalized)>0,
  'mentions_version',position('version' in normalized)>0) order by calls desc,rolname),'[]'::jsonb) from selected)
) as storage_select_shapes;
rollback;
