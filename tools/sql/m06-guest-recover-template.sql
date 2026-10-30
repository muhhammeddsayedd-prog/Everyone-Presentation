-- Read-only recovery for the SAME retained recipient after an unknown write.
with admission as materialized (
 select current_user='postgres' and current_database()='postgres'
 and (select rolsuper or rolbypassrls from pg_roles where rolname=current_user)
 and (select array_agg(version order by version)from supabase_migrations.schema_migrations)=array[__VERSIONS__]::text[]
 and (select count(*)from eps.review_gateway_config)=1
 and not exists(select 1 from pg_trigger where tgrelid='eps.review_gateway_config'::regclass and not tgisinternal)
 and not exists(select 1 from pg_rewrite where ev_class='eps.review_gateway_config'::regclass)
 and (select encode(sha256(convert_to(coalesce(string_agg(conname||E'\n'||pg_get_constraintdef(oid),E'\n'order by conname),''),'UTF8')),'hex')from pg_constraint where conrelid='eps.review_gateway_config'::regclass)='__CONSTRAINT_SHA__'
 as allowed
)
select jsonb_build_object('query_role',current_user,'database',current_database(),'changed_rows',0,
 'key_bytes',octet_length(backend_key),
 'recipient_key_id',extensions.pgp_key_id(extensions.dearmor(convert_from(decode('__PUBLIC_HEX__','hex'),'UTF8'))),
 'ciphertext',replace(encode(extensions.pgp_pub_encrypt_bytea(backend_key,extensions.dearmor(convert_from(decode('__PUBLIC_HEX__','hex'),'UTF8')),'cipher-algo=aes256,compress-algo=0,disable-mdc=0'),'base64'),E'\n',''),
 'nonce_hmac',encode(extensions.hmac(convert_to('__NONCE__','UTF8'),backend_key,'sha256'),'hex')
)as guest_bootstrap from eps.review_gateway_config,admission
where admission.allowed and id and not enabled and octet_length(backend_key)=32;
