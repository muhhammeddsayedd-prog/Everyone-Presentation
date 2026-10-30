-- Compile only PUBLIC recipient armor, nonce, exact history and catalog seal.
-- The backend key is generated within PostgreSQL. It is never a SQL parameter.
with admission as materialized (
 select current_user='postgres' and current_database()='postgres'
 and (select rolsuper or rolbypassrls from pg_roles where rolname=current_user)
 and (select array_agg(version order by version)from supabase_migrations.schema_migrations)=array[__VERSIONS__]::text[]
 and (select count(*)from eps.review_gateway_config)=1
 and exists(select 1 from eps.review_gateway_config where id and not enabled and backend_key is null
   and replay_ttl_seconds=86400 and session_ttl_seconds=3600)
 and not exists(select 1 from pg_trigger where tgrelid='eps.review_gateway_config'::regclass and not tgisinternal)
 and not exists(select 1 from pg_rewrite where ev_class='eps.review_gateway_config'::regclass)
 and (select encode(sha256(convert_to(coalesce(string_agg(conname||E'\n'||pg_get_constraintdef(oid),E'\n'order by conname),''),'UTF8')),'hex')from pg_constraint where conrelid='eps.review_gateway_config'::regclass)='__CONSTRAINT_SHA__'
 and pg_try_advisory_xact_lock(hashtextextended('eps.m06.guest.bootstrap',0)) as allowed
), generated as materialized (
 select extensions.gen_random_bytes(32)as secret from admission where allowed
), changed as (
 update eps.review_gateway_config set backend_key=generated.secret from generated
 where id and not enabled and backend_key is null returning backend_key
)
select jsonb_build_object('query_role',current_user,'database',current_database(),'changed_rows',1,
 'key_bytes',octet_length(backend_key),
 'recipient_key_id',extensions.pgp_key_id(extensions.dearmor(convert_from(decode('__PUBLIC_HEX__','hex'),'UTF8'))),
 'ciphertext',replace(encode(extensions.pgp_pub_encrypt_bytea(backend_key,extensions.dearmor(convert_from(decode('__PUBLIC_HEX__','hex'),'UTF8')),'cipher-algo=aes256,compress-algo=0,disable-mdc=0'),'base64'),E'\n',''),
 'nonce_hmac',encode(extensions.hmac(convert_to('__NONCE__','UTF8'),backend_key,'sha256'),'hex')
)as guest_bootstrap from changed;
