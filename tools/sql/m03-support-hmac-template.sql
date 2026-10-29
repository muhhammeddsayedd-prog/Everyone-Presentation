-- PUBLIC challenge only. No verifier, private recipient or secret digest input.
begin read only;
select jsonb_build_object('query_role',current_user,'database',current_database(),
 'key_metadata',jsonb_build_object('key_id',key_id,'purpose',purpose,'not_before',not_before,'not_after',not_after,'revoked_at',revoked_at,'created_at',created_at),
 'nonce_hmac',encode(extensions.hmac(convert_to('__NONCE__','UTF8'),secret,'sha256'),'hex')
)as m03_support_challenge from eps.support_verification_keys
where current_user='postgres'and current_database()='postgres'and(select rolsuper or rolbypassrls from pg_roles where rolname=current_user)
 and(select array_agg(version order by version)from supabase_migrations.schema_migrations)=array[__VERSIONS__]::text[]
 and key_id='eps-candidate-support-local-20261029-v1'and purpose='candidate_support'and octet_length(secret)=32
 and revoked_at is null and not_before<=clock_timestamp()and not_after is null;
rollback;
