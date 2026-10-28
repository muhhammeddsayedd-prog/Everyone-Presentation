-- Fixed administrative inspection. NEVER persist stdout: digest is memory-only.
-- No key value, personal row or user fixture is returned.
begin read only;
set local statement_timeout='10s';
select jsonb_build_object(
  'query_role',current_user,'database',current_database(),
  'unrestricted_visibility',(select rolbypassrls or rolsuper from pg_roles where rolname=current_user),
  'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
  'uploads_disabled',(select position('''available_purposes'',''[]''::jsonb' in regexp_replace(prosrc,'[[:space:]]','','g'))>0 from pg_proc where oid='public.eps_get_capabilities()'::regprocedure),
  'random_source_present',to_regprocedure('extensions.gen_random_bytes(integer)') is not null,
  'key_count',(select count(*) from eps.logo_verification_keys),
  'keys',(select coalesce(jsonb_agg(jsonb_build_object('key_id',key_id,'purpose',purpose,'bytes',octet_length(secret),
    'not_before',not_before,'not_after',not_after,'revoked',revoked_at is not null,
    'active',revoked_at is null and not_before<=clock_timestamp() and (not_after is null or not_after>clock_timestamp()),
    'digest',encode(extensions.digest(secret,'sha256'),'hex')) order by key_id),'[]'::jsonb) from eps.logo_verification_keys)
) as verifier;
rollback;
