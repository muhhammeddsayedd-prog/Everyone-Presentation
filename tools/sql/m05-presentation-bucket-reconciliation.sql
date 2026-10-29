-- Read-only managed Storage metadata. No source objects, identities or secrets.
begin isolation level repeatable read read only;
set local search_path='';set local timezone='UTC';set local statement_timeout='15s';
do $scope$begin
 if current_user<>'postgres'or current_database()<>'postgres'
 or(select count(*)from supabase_migrations.schema_migrations)<>24
 or(select max(version)from supabase_migrations.schema_migrations)<>'20261029215218'
 or(select count(*)from storage.buckets where id='eps-presentation-outputs')<>1
 or(select count(*)from pg_attribute where attrelid='storage.buckets'::regclass and not attisdropped
  and attname in('avif_autodetection','lifecycle_configuration','lifecycle_configuration_generation','type','versioning_status'))<>5
 then raise exception'M05_FIXED24_MANAGED_BUCKET_METADATA_REQUIRED';end if;
end $scope$;
select jsonb_build_object('schema_version','1.0','query_role',current_user,'database',current_database(),
 'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
 'versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'position',a.attnum,'type',format_type(a.atttypid,a.atttypmod),
  'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid),
  'type_metadata',jsonb_build_object('schema',n.nspname,'name',t.typname,'kind',t.typtype,
   'base',case when t.typbasetype=0 then null else format_type(t.typbasetype,t.typtypmod)end,
   'type_not_null',t.typnotnull,'type_default',t.typdefault,
   'enum_labels',(select jsonb_agg(enumlabel order by enumsortorder)from pg_enum where enumtypid=t.oid)))order by a.attname)
  from pg_attribute a join pg_type t on t.oid=a.atttypid join pg_namespace n on n.oid=t.typnamespace
  left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid='storage.buckets'::regclass and not a.attisdropped
  and a.attname in('avif_autodetection','lifecycle_configuration','lifecycle_configuration_generation','type','versioning_status')),
 'constraints',(select coalesce(jsonb_agg(jsonb_build_object('name',c.conname,'type',c.contype,'definition',pg_get_constraintdef(c.oid),
  'validated',c.convalidated,'deferrable',c.condeferrable,'initially_deferred',c.condeferred,
  'columns',(select jsonb_agg(a.attname order by keys.ord)from unnest(c.conkey)with ordinality keys(num,ord)
   join pg_attribute a on a.attrelid=c.conrelid and a.attnum=keys.num))order by c.conname),'[]')
  from pg_constraint c where c.conrelid='storage.buckets'::regclass
  or c.contypid in(select atttypid from pg_attribute where attrelid='storage.buckets'::regclass
   and attname in('avif_autodetection','lifecycle_configuration','lifecycle_configuration_generation','type','versioning_status'))),
 'bucket_fields',(select jsonb_build_object('avif_autodetection',b.avif_autodetection,'lifecycle_configuration',b.lifecycle_configuration,
  'lifecycle_configuration_generation',b.lifecycle_configuration_generation,'type',b.type,'versioning_status',b.versioning_status)
  from storage.buckets b where id='eps-presentation-outputs'))as m05_presentation_bucket_metadata;
rollback;
