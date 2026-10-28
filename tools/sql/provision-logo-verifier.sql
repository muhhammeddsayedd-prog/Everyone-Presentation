-- FIXED privileged provisioning query. NEVER log/persist stdout or stderr.
-- The only secret is generated INSIDE PostgreSQL, then captured only in the
-- reviewed Python process memory for a protected ignored local env file.
-- This is not a public RPC, migration, seed or runtime feature enablement.
begin;
set local lock_timeout='5s';
set local statement_timeout='10s';
lock table eps.logo_verification_keys in exclusive mode;
do $$ begin
  if current_user<>'postgres' or current_database()<>'postgres'
    or not exists(select 1 from pg_roles where rolname=current_user and (rolbypassrls or rolsuper))
    or (select array_agg(version order by version) from supabase_migrations.schema_migrations)
      is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205']::text[]
    or not exists(select 1 from pg_proc where oid='public.eps_get_capabilities()'::regprocedure
      and position('''available_purposes'',''[]''::jsonb' in regexp_replace(prosrc,'[[:space:]]','','g'))>0)
    or exists(select 1 from eps.logo_verification_keys)
  then raise exception 'LOGO_VERIFIER_PROVISIONING_PRECONDITION_FAILED'; end if;
end $$;
with inserted as (
  insert into eps.logo_verification_keys(key_id,purpose,secret)
    values('eps-logo-dev-20261028-v1','client_logo',extensions.gen_random_bytes(32))
  returning key_id,purpose,secret
)
select jsonb_build_object('key_id',key_id,'purpose',purpose,
  'secret_base64url',rtrim(translate(replace(encode(secret,'base64'),E'\n',''),'+/','-_'),'=')) as provisioned
from inserted;
commit;
