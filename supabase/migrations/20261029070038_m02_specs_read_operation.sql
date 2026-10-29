-- Additive13: hosted Storage1.80.2 metadata lookup and byte-read operations.
-- Preserve every existing business/lease/purpose predicate. No new role/grant,
-- function, bucket, signed URL, listing, public-info, HEAD or write authority.
do $guard$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941']::text[]
  or (select count(*) from pg_catalog.pg_policy p join (values
    ('eps_specs_original_read',true,'authenticated','f6d2d1289247f9f9483a2e1c6b98da96af6f5fafbe695531919cfde36bf7193e'),
    ('eps_specs_capability_read',true,'anon','ec091021f817dba389632dfd7897323df82b2ed4882a70983457f84c045969b1'),
    ('eps_specs_read_guard',false,'public','108d82ff37bea506f7e825f0c8e507b7b162d7427c2b2d8350c6eae011743ae0')
   ) expected(name,permissive,role_name,qual_sha) on expected.name=p.polname
   where p.polrelid='storage.objects'::regclass and p.polcmd='r' and p.polpermissive=expected.permissive
    and p.polroles=case when expected.role_name='public' then array[0::oid] else array[(expected.role_name::regrole)::oid] end
    and encode(sha256(convert_to(pg_get_expr(p.polqual,p.polrelid),'UTF8')),'hex')=expected.qual_sha)<>3
 then raise exception 'SPECS_READ_OPERATION_EXACT12_REQUIRED'; end if;
end $guard$;
-- BEGIN CANONICAL SPECS READ OPERATION CORE
alter policy eps_specs_original_read on storage.objects using(
 bucket_id='eps-specs-assets'
 and (storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info'))
 and eps.specs_storage_original_read(bucket_id,name));
alter policy eps_specs_capability_read on storage.objects using(
 bucket_id in('eps-specs-assets','eps-specs-outputs')
 and (storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info'))
 and eps.specs_storage_capability(bucket_id,name,'read'));
alter policy eps_specs_read_guard on storage.objects using(
 bucket_id not in('eps-specs-assets','eps-specs-outputs')
 or (storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info'))
 and (bucket_id='eps-specs-assets' and eps.specs_storage_original_read(bucket_id,name) or eps.specs_storage_capability(bucket_id,name,'read')));
-- END CANONICAL SPECS READ OPERATION CORE
