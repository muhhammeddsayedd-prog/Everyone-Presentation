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
 'applicable_select_policies',(select jsonb_agg(jsonb_build_object('effective_role',scope.role_name,'relation',p.polrelid::regclass::text,'name',p.polname,'permissive',p.polpermissive,'command',p.polcmd,
  'using_sha256',encode(sha256(convert_to(coalesce(pg_get_expr(p.polqual,p.polrelid),''),'UTF8')),'hex'),
  'check_sha256',encode(sha256(convert_to(coalesce(pg_get_expr(p.polwithcheck,p.polrelid),''),'UTF8')),'hex')) order by scope.role_name,p.polrelid::regclass::text,p.polname)
  from (values ('authenticated','storage.objects'::regclass),('eps_specs_upload_owner','eps.media_assets'::regclass),('eps_specs_upload_owner','eps.specs_upload_sessions'::regclass),
    ('eps_api_owner','eps.workspaces'::regclass),('eps_api_owner','public.projects'::regclass),('eps_api_owner','public.project_memberships'::regclass),('eps_api_owner','public.app_capability_grants'::regclass)) scope(role_name,relation)
   join pg_catalog.pg_policy p on p.polrelid=scope.relation and p.polcmd in('r','*')
  where exists(select 1 from unnest(p.polroles) r(role_id) where case when role_id=0 then true else pg_has_role(scope.role_name,role_id,'USAGE') end)),
 'statements',(select coalesce(jsonb_agg(jsonb_build_object('role',rolname,'calls',calls,'rows',rows,
  'query_sha256',encode(sha256(convert_to(query,'UTF8')),'hex'),
  'uses_for_share',normalized~'for[[:space:]]+share',
  'uses_for_key_share',normalized~'for[[:space:]]+key[[:space:]]+share',
  'uses_for_update',normalized~'for[[:space:]]+(no[[:space:]]+key[[:space:]]+)?update',
  'filters_archived_at_null',normalized~'archived_at[[:space:]]+is[[:space:]]+null',
  'mentions_delete_marker',position('is_delete_marker' in normalized)>0,
  'mentions_version',position('version' in normalized)>0,
  'version_predicate',case when normalized~'(^|[^a-z0-9_])version[[:space:]]+is[[:space:]]+null' then 'is_null'
    when normalized~'(^|[^a-z0-9_])version[[:space:]]*=[[:space:]]*[$][0-9]+' then 'equals_parameter'
    when normalized~'(^|[^a-z0-9_])version[[:space:]]*=' then 'equals_other' else 'none_detected' end,
  'is_versioned_predicate',case when normalized~'is_versioned[[:space:]]+is[[:space:]]+false' then 'is_false'
    when normalized~'is_versioned[[:space:]]*=[[:space:]]*false' then 'equals_false'
    when normalized~'is_versioned[[:space:]]*=[[:space:]]*true' then 'equals_true'
    when normalized~'is_versioned[[:space:]]*=[[:space:]]*[$][0-9]+' then 'equals_parameter'
    when position('is_versioned' in normalized)>0 then 'other_reference' else 'none_detected' end,
  'has_owner_predicate',normalized~'(^|[^a-z0-9_])owner(_id)?[[:space:]]*=',
  'has_name_equality',normalized~'(^|[^a-z0-9_])name[[:space:]]*=',
  'has_bucket_equality',normalized~'(^|[^a-z0-9_])bucket_id[[:space:]]*=') order by calls desc,rolname),'[]'::jsonb) from selected)
) as storage_select_shapes;
rollback;
