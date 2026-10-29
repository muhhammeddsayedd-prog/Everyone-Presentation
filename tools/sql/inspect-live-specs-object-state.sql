-- Read-only managed-object visibility flags for the ONE existing PDF asset.
-- No caller impersonation, source bytes, object key, owner identity or credentials.
begin read only;
set local statement_timeout='10s';
set local search_path='';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941']::text[]
  or not exists(select 1 from eps.media_assets a join eps.specs_upload_sessions u on u.asset_id=a.id
   where a.id='64e07944-43b9-46a0-aef2-92430a38773c' and u.id='e2b251a0-a25c-4919-a722-28c6ff84f408'
    and a.origin_workspace_id='098d5b48-42a3-475b-b562-735c9eafce80' and a.bucket='eps-specs-assets' and a.purpose='specs')
 then raise exception 'LIVE_SPECS_OBJECT_STATE_TARGET_UNCONFIRMED'; end if;
end $$;
with object_row as (
 select to_jsonb(o) value from storage.objects o join eps.media_assets a on a.bucket=o.bucket_id and a.object_key=o.name
 where a.id='64e07944-43b9-46a0-aef2-92430a38773c'
), bucket_row as (select to_jsonb(b) value from storage.buckets b where b.id='eps-specs-assets')
select jsonb_build_object('observed_at',pg_catalog.clock_timestamp(),'query_role',current_user,'writes_requested',false,
 'object_rows',(select count(*) from object_row),
 'visibility_columns',(select coalesce(jsonb_agg(a.attname order by a.attname),'[]'::jsonb) from pg_catalog.pg_attribute a
   where a.attrelid='storage.objects'::regclass and not a.attisdropped and a.attnum>0 and a.attname in('archived_at','deleted_at','is_delete_marker','delete_marker','is_versioned','is_latest','is_current','version','version_id','current_version')),
 'object_state',(select jsonb_build_object('archived_at_column',value?'archived_at','archived',value?'archived_at' and value->'archived_at'<>'null'::jsonb,
   'deleted_at_column',value?'deleted_at','deleted',value?'deleted_at' and value->'deleted_at'<>'null'::jsonb,
   'delete_marker_column',value?'is_delete_marker','delete_marker',case when jsonb_typeof(value->'is_delete_marker')='boolean' then value->'is_delete_marker' else null end,
   'is_versioned_column',value?'is_versioned','is_versioned',case when jsonb_typeof(value->'is_versioned')='boolean' then value->'is_versioned' else null end,
   'is_latest',case when jsonb_typeof(value->'is_latest')='boolean' then value->'is_latest' else null end,
   'is_current',case when jsonb_typeof(value->'is_current')='boolean' then value->'is_current' else null end,
   'version_present',coalesce(value->>'version','')<>'',
   'version_uuid',case when value->>'version'~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then value->>'version' else null end,
   'version_id_present',coalesce(value->>'version_id','')<>'','current_version_present',coalesce(value->>'current_version','')<>'') from object_row),
 'bucket_state',(select jsonb_build_object('public',value->'public','versioning_column',value?'versioning','versioning_enabled_column',value?'versioning_enabled','versioning_status_column',value?'versioning_status',
   'versioning_enabled',case when jsonb_typeof(value->'versioning_enabled')='boolean' then value->'versioning_enabled' else null end,
   'versioning_state',case when value->>'versioning' in('Enabled','Suspended','Disabled','enabled','suspended','disabled','ENABLED','SUSPENDED','DISABLED') then value->>'versioning' else null end,
   'versioning_status',case when value->>'versioning_status' in('Enabled','Suspended','Disabled','enabled','suspended','disabled','ENABLED','SUSPENDED','DISABLED') then value->>'versioning_status' else null end) from bucket_row),
 'object_versions_relation_present',to_regclass('storage.object_versions') is not null
) as live_specs_object_state;
rollback;
