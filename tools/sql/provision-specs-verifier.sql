-- Fixed administrative operation, not a migration/public API. Keep all CLI
-- output private in captured process memory. No literal secret enters SQL.
begin;
set local lock_timeout='5s';
set local statement_timeout='10s';
lock table eps.specs_asset_config in share mode;
lock table eps.specs_verification_keys in exclusive mode;
do $$ begin
  if current_user<>'postgres' or current_database()<>'postgres'
    or not exists(select 1 from pg_roles where rolname=current_user and (rolbypassrls or rolsuper))
    or (select array_agg(version order by version) from supabase_migrations.schema_migrations)
      is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205',
        '20261028072515','20261028162702','20261028162800','20261028172320','20261028184145',
        '20261028222030','20261029001520','20261029003941']::text[]
    or (select count(*) from eps.specs_asset_config)<>1
    or not exists(select 1 from eps.specs_asset_config where id=1
      and not uploads_enabled and not capabilities_enabled and not file_pipeline_enabled)
    or exists(select 1 from eps.specs_verification_keys)
  then raise exception 'SPECS_VERIFIER_PROVISIONING_PRECONDITION_FAILED'; end if;
end $$;
with inserted as (
  insert into eps.specs_verification_keys(key_id,purpose,secret)
    values('eps-specs-dev-20261029-v1','specs',extensions.gen_random_bytes(32))
  returning key_id,purpose,secret
)
select jsonb_build_object('key_id',key_id,'purpose',purpose,'key_bytes',octet_length(secret),
  'secret_base64url',rtrim(translate(replace(encode(secret,'base64'),E'\n',''),'+/','-_'),'='),
  'uploads_enabled',config.uploads_enabled,'capabilities_enabled',config.capabilities_enabled,
  'file_pipeline_enabled',config.file_pipeline_enabled) as provisioned
from inserted cross join eps.specs_asset_config config where config.id=1;
commit;
