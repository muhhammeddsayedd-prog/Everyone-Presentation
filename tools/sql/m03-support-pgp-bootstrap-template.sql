-- Only PUBLIC recipient armor(hex) and public nonce/history are substituted.
-- Raw verifier bytes are generated server-side and never become query text or
-- parameters. This single DML statement returns ciphertext/HMAC/metadata only.
with admission as materialized(
 select current_user='postgres'and current_database()='postgres'
  and(select rolsuper or rolbypassrls from pg_roles where rolname=current_user)
  and(select array_agg(version order by version)from supabase_migrations.schema_migrations)=array[__VERSIONS__]::text[]
  and exists(select 1 from eps.candidate_support_config where id and not uploads_enabled)
  and not exists(select 1 from eps.support_verification_keys where key_id='eps-candidate-support-local-20261029-v1')
  and not exists(select 1 from pg_trigger where tgrelid='eps.support_verification_keys'::regclass and not tgisinternal)
  and not exists(select 1 from pg_rewrite where ev_class='eps.support_verification_keys'::regclass)
  and(select encode(sha256(convert_to(coalesce(string_agg(conname||E'\n'||pg_get_constraintdef(oid),E'\n'order by conname),''),'UTF8')),'hex')from pg_constraint where conrelid='eps.support_verification_keys'::regclass)='__CONSTRAINT_SHA__'
  and pg_try_advisory_xact_lock(hashtextextended('eps.support.pgp.bootstrap',0))as allowed
), generated as materialized(
 select extensions.gen_random_bytes(32)as secret from admission where allowed
), inserted as(
 insert into eps.support_verification_keys(key_id,purpose,secret)
 select 'eps-candidate-support-local-20261029-v1','candidate_support',secret from generated
 returning key_id,purpose,secret,not_before,not_after,revoked_at,created_at
)
select jsonb_build_object('query_role',current_user,'database',current_database(),'inserted_rows',1,
 'key_metadata',jsonb_build_object('key_id',key_id,'purpose',purpose,'not_before',not_before,'not_after',not_after,'revoked_at',revoked_at,'created_at',created_at),
 'recipient_key_id',extensions.pgp_key_id(extensions.dearmor(convert_from(decode('__PUBLIC_HEX__','hex'),'UTF8'))),
 'ciphertext',replace(encode(extensions.pgp_pub_encrypt_bytea(secret,extensions.dearmor(convert_from(decode('__PUBLIC_HEX__','hex'),'UTF8')),'cipher-algo=aes256,compress-algo=0,disable-mdc=0'),'base64'),E'\n',''),
 'nonce_hmac',encode(extensions.hmac(convert_to('__NONCE__','UTF8'),secret,'sha256'),'hex')
)as support_bootstrap from inserted;
