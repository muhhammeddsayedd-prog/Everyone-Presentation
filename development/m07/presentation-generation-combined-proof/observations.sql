-- Owned-test observer only. No private row/text/filename is returned.
create function pg_temp.combined_manifest_projection(p_version uuid)returns jsonb
language plpgsql stable security invoker set search_path=''as $manifest$
declare v eps.presentation_versions;item jsonb;encoded text;
begin
 if current_user<>'postgres'then raise exception'COMBINED_PRIVATE_OBSERVER_REQUIRED';end if;
 select * into v from eps.presentation_versions where id=p_version;
 if not found or v.status<>'queued'or v.generated_by<>'a4410000-0000-4000-8000-000000000001'::uuid
 then raise exception'COMBINED_NEW_OWNED_QUEUED_VERSION_REQUIRED';end if;
 encoded:=(v.manifest-'created_at')::text;
 for item in select value from jsonb_array_elements(v.snapshot->'slides')loop
  encoded:=replace(encoded,item->>'id',md5('synthetic-normalized-slide-'||(item->>'order'))::uuid::text);
 end loop;
 encoded:=replace(encoded,p_version::text,'00000000-0000-4000-8000-000000000001');
 return jsonb_build_object(
  'normalized_manifest_sha256',eps.presentation_hash(encoded::jsonb),
  'normalization',jsonb_build_array('top-level created_at','generated version_id','generated slide ids by ordinal'),
  'inventory_sha256',v.inventory_sha256,'input_fingerprint',v.input_fingerprint,
  'stored_snapshot_hash_valid',eps.presentation_hash(v.snapshot)=v.snapshot_sha256,
  'stored_manifest_hash_valid',eps.presentation_hash(v.manifest)=v.manifest_sha256,
  'stored_inventory_hash_valid',eps.presentation_hash(v.snapshot->'asset_inventory')=v.inventory_sha256);
end$manifest$;
