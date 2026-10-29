-- Explicit READ ONLY re-encryption after an uncertain claimed bootstrap.
-- Same fixed key ID, original PUBLIC recipient and original public nonce only.
begin read only;
select jsonb_build_object('query_role',current_user,'database',current_database(),'inserted_rows',0,
 'key_metadata',jsonb_build_object('key_id',key_id,'purpose',purpose,'not_before',not_before,'not_after',not_after,'revoked_at',revoked_at,'created_at',created_at),
 'recipient_key_id',extensions.pgp_key_id(extensions.dearmor(convert_from(decode('__PUBLIC_HEX__','hex'),'UTF8'))),
 'ciphertext',replace(encode(extensions.pgp_pub_encrypt_bytea(secret,extensions.dearmor(convert_from(decode('__PUBLIC_HEX__','hex'),'UTF8')),'cipher-algo=aes256,compress-algo=0,disable-mdc=0'),'base64'),E'\n',''),
 'nonce_hmac',encode(extensions.hmac(convert_to('__NONCE__','UTF8'),secret,'sha256'),'hex')
)as support_bootstrap from eps.support_verification_keys
where current_user='postgres'and current_database()='postgres'and(select rolsuper or rolbypassrls from pg_roles where rolname=current_user)
 and(select array_agg(version order by version)from supabase_migrations.schema_migrations)=array[__VERSIONS__]::text[]
 and exists(select 1 from eps.candidate_support_config where id and not uploads_enabled)
 and key_id='eps-candidate-support-local-20261029-v1'and purpose='candidate_support'and octet_length(secret)=32
 and revoked_at is null and not_before<=clock_timestamp()and not_after is null;
rollback;
